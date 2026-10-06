import type { DetectionEvent, PauseSpan, ErrorSeverity, TrameError } from '../types';

export const CATCHUP_MS = 20_000; // au-delà, une relecture est considérée comme un « rattrapage »
export const MAX_BUCKETS = 60;
export const WINDOW_OPTIONS = [10, 30, 60, 300] as const; // secondes

export interface Bucket {
  start: number;
  end: number;
  critical: number;
  major: number;
  minor: number;
  warning: number;
  total: number;
  catchUp: boolean;
  catchUpCount: number;
  catchUpDt: number;
  paused: boolean;
  cumul: number;
  normal: number | null;
}

export interface AlertSettings {
  windowSec: number;
  threshold: number; // critiques + majeures par fenêtre
  sound: boolean;
}

export const DEFAULT_ALERT_SETTINGS: AlertSettings = { windowSec: 30, threshold: 5, sound: false };

export type AlertLevel = 'ok' | 'accel' | 'alert';

export interface CatchUpInfo {
  t: number;
  count: number;
  dt: number;
  perMin: number;
  /** Critiques + majeures par fenêtre, en moyenne sur la durée du rattrapage */
  critMajorPerWindow: number;
}

export interface AlertState {
  level: AlertLevel;
  critMajor: number; // critiques + majeures vues EN DIRECT dans la fenêtre glissante (rattrapages exclus)
  all: number; // toutes nouvelles erreurs vues en direct dans la fenêtre (rattrapages exclus)
  live: number; // alias de all (conservé pour lisibilité)
  normal: number | null; // moyenne « normale » par fenêtre
  catchUp: CatchUpInfo | null;
}

const sum = (e: DetectionEvent) => e.critical + e.major + e.minor + e.warning;

export function buildBuckets(p: {
  events: DetectionEvent[];
  pauses: PauseSpan[];
  sessionStart: number | null;
  now: number;
  bucketMs: number;
  baselineCount: number;
  maxBuckets?: number;
}): Bucket[] {
  const { events, pauses, sessionStart, now, bucketMs, baselineCount } = p;
  const max = p.maxBuckets ?? MAX_BUCKETS;
  if (sessionStart == null) return [];
  const first = Math.floor(sessionStart / bucketMs) * bucketMs;
  const last = Math.floor(Math.max(now, sessionStart) / bucketMs) * bucketMs;
  const firstShown = Math.max(first, last - (max - 1) * bucketMs);
  const n = Math.round((last - firstShown) / bucketMs) + 1;

  let cumul = baselineCount;
  for (const e of events) if (e.t < firstShown) cumul += sum(e);

  const buckets: Bucket[] = Array.from({ length: n }, (_, i) => {
    const start = firstShown + i * bucketMs;
    const end = start + bucketMs;
    const paused = pauses.some(s => s.start < end && (s.end ?? Math.max(now, end)) > start);
    return {
      start, end, critical: 0, major: 0, minor: 0, warning: 0, total: 0,
      catchUp: false, catchUpCount: 0, catchUpDt: 0, paused, cumul: 0, normal: null,
    };
  });

  for (const e of events) {
    if (e.t < firstShown) continue;
    const i = Math.min(n - 1, Math.floor((e.t - firstShown) / bucketMs));
    const b = buckets[i];
    b.critical += e.critical; b.major += e.major; b.minor += e.minor; b.warning += e.warning;
    b.total += sum(e);
    if (e.catchUp) { b.catchUp = true; b.catchUpCount += sum(e); b.catchUpDt = Math.max(b.catchUpDt, e.dt); }
  }

  buckets.forEach((b, i) => {
    cumul += b.total;
    b.cumul = cumul;
    const prev = buckets.slice(Math.max(0, i - 10), i).filter(x => !x.catchUp && !x.paused);
    b.normal = prev.length >= 3 ? prev.reduce((a, x) => a + x.total, 0) / prev.length : null;
  });
  return buckets;
}

/** Plages consécutives de buckets en pause (pour les zones ambrées) */
export function pausedRanges(buckets: Bucket[]): { x1: number; x2: number }[] {
  const out: { x1: number; x2: number }[] = [];
  let cur: { x1: number; x2: number } | null = null;
  for (const b of buckets) {
    if (b.paused) { if (cur) cur.x2 = b.start; else cur = { x1: b.start, x2: b.start }; }
    else if (cur) { out.push(cur); cur = null; }
  }
  if (cur) out.push(cur);
  return out;
}

export function evaluateAlerts(p: {
  events: DetectionEvent[];
  now: number;
  sessionStart: number | null;
  settings: AlertSettings;
}): AlertState {
  const { events, now, sessionStart, settings } = p;
  const windowMs = settings.windowSec * 1000;
  // Seules les erreurs vues en direct comptent pour l'alerte : un rattrapage (pause, longue absence)
  // n'est pas « en train d'arriver » — il a sa propre bannière.
  let critMajor = 0, live = 0;
  for (const e of events) {
    if (!e.catchUp && e.t > now - windowMs && e.t <= now) {
      critMajor += e.critical + e.major;
      live += sum(e);
    }
  }
  const all = live;

  // « Normal » = moyenne par fenêtre sur les 10 fenêtres précédentes (rattrapages exclus)
  let normal: number | null = null;
  if (sessionStart != null) {
    const histStart = Math.max(sessionStart, now - 11 * windowMs);
    const histEnd = now - windowMs;
    const nWin = (histEnd - histStart) / windowMs;
    if (nWin >= 3) {
      const tot = events
        .filter(e => !e.catchUp && e.t >= histStart && e.t < histEnd)
        .reduce((a, e) => a + sum(e), 0);
      normal = tot / nWin;
    }
  }

  let level: AlertLevel = 'ok';
  if (settings.threshold > 0 && critMajor >= settings.threshold) level = 'alert';
  else if (live >= 3 && normal != null && live >= 3 * Math.max(normal, 0.5)) level = 'accel';

  let catchUp: CatchUpInfo | null = null;
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.catchUp) {
      if (now - e.t < 120_000) {
        catchUp = {
          t: e.t, count: sum(e), dt: e.dt, perMin: sum(e) / (e.dt / 60_000),
          critMajorPerWindow: (e.critical + e.major) * (windowMs / e.dt),
        };
      }
      break;
    }
  }
  return { level, critMajor, all, live, normal, catchUp };
}

/** Normalise un message : chiffres → #, retire un éventuel horodatage de tête */
export function normalizePattern(line: string): string {
  let s = line.toLowerCase().replace(/0x[0-9a-f]+/g, '#').replace(/\d+/g, '#');
  s = s.replace(/^[\s#\-:/.,t[\]()]+/, '').replace(/\s+/g, ' ').trim();
  return s.slice(0, 80) || '(vide)';
}

export interface PatternGroup {
  pattern: string;
  count: number;
  recent: number; // nouvelles occurrences sur la période récente
  severity: ErrorSeverity;
  example: string;
}

const SEV_RANK: Record<ErrorSeverity, number> = { critical: 3, major: 2, minor: 1, warning: 0 };

export function groupPatterns(errors: TrameError[], recentSinceMs: number, top = 6): PatternGroup[] {
  const map = new Map<string, PatternGroup>();
  for (const e of errors) {
    let g = map.get(e.pattern);
    if (!g) { g = { pattern: e.pattern, count: 0, recent: 0, severity: e.severity, example: e.description }; map.set(e.pattern, g); }
    g.count++;
    if (!e.baseline && e.detectedAt >= recentSinceMs) g.recent++;
    if (SEV_RANK[e.severity] > SEV_RANK[g.severity]) g.severity = e.severity;
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, top);
}

export function fmtTime(ms: number, withSeconds = true): string {
  return new Date(ms).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit', ...(withSeconds ? { second: '2-digit' } : {}),
  });
}

export function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 90) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 90) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}
