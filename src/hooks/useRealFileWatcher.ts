import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  TrameError, ErrorStats, ErrorSeverity, MonitoringRule, DetectionEvent, PauseSpan,
} from '../types';
import { CATCHUP_MS, normalizePattern } from '../utils/cadence';

const POLL_INTERVAL = 1000;
const MAX_EVENTS = 5000;
const MAX_SAMPLES = 300; // relectures conservées pour la courbe instantanée

function classifySeverity(line: string): ErrorSeverity {
  const lower = line.toLowerCase();
  if (lower.includes('critical') || lower.includes('critique') || lower.includes('fatal')) return 'critical';
  if (lower.includes('major') || lower.includes('majeur') || lower.includes('grave')) return 'major';
  if (lower.includes('warning') || lower.includes('warn') || lower.includes('attention')) return 'warning';
  return 'minor';
}

function makeError(
  line: string, lineNumber: number, keyword: string, detectedAt: number, baseline: boolean, key: string,
): TrameError {
  return {
    id: `ERR-${key}`,
    timestamp: new Date(detectedAt),
    errorCode: keyword.toUpperCase().slice(0, 14),
    description: line.trim().substring(0, 150),
    severity: classifySeverity(line),
    trameId: `L${String(lineNumber).padStart(5, '0')}`,
    fieldPosition: lineNumber,
    expectedValue: '—',
    receivedValue: keyword,
    source: 'fichier local',
    detectedAt,
    baseline,
    pattern: normalizePattern(line),
  };
}

const emptyStats: ErrorStats = {
  totalErrors: 0, criticalCount: 0, majorCount: 0, minorCount: 0,
  warningCount: 0, errorRate: 0, lastErrorTime: null,
  tramesAnalyzed: 0, tramesInError: 0,
};

export function useRealFileWatcher() {
  const [isWatching, setIsWatching] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [fileName, setFileName] = useState('');
  const [lastModified, setLastModified] = useState<Date | null>(null);
  const [lineCount, setLineCount] = useState(0);
  const [fileContent, setFileContent] = useState('');
  const [errors, setErrors] = useState<TrameError[]>([]);
  const [stats, setStats] = useState<ErrorStats>(emptyStats);

  // Historique de surveillance (axe = moment où l'outil a VU l'erreur)
  const [events, setEvents] = useState<DetectionEvent[]>([]);
  const [samples, setSamples] = useState<DetectionEvent[]>([]); // une entrée par relecture (instantané)
  const [pauses, setPauses] = useState<PauseSpan[]>([]);
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [baselineCount, setBaselineCount] = useState(0);
  const [baselineLevels, setBaselineLevels] = useState<Record<ErrorSeverity, number>>({ critical: 0, major: 0, minor: 0, warning: 0 });

  const [rules, setRules] = useState<MonitoringRule[]>(() => {
    const saved = localStorage.getItem('monitoringRules');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* valeur corrompue : on repart du défaut */ }
    }
    return [{ keyword: 'errordialogue', severity: 'critical' }];
  });

  // Toujours la dernière version des règles (évite les closures périmées dans setInterval)
  const rulesRef = useRef(rules);
  rulesRef.current = rules;

  const handleRef = useRef<FileSystemFileHandle | null>(null);
  const timerRef = useRef<number | null>(null);
  const prevContent = useRef('');
  const seen = useRef<Map<string, { t: number; baseline: boolean }>>(new Map());
  const baselineDone = useRef(false);
  const lastReadAt = useRef(0);
  const resumedRef = useRef(false);
  const pausedRef = useRef(false);
  const eventsRef = useRef<DetectionEvent[]>([]);
  const samplesRef = useRef<DetectionEvent[]>([]);

  // Fallback mode: input[type=file] reload
  const [fallbackMode, setFallbackMode] = useState(false);
  const fallbackModeRef = useRef(false);
  const fileNameRef = useRef('');
  const isWatchingRef = useRef(false);
  const fallbackInputRef = useRef<HTMLInputElement | null>(null);

  const hasNativeAPI = typeof window !== 'undefined' && 'showOpenFilePicker' in window;

  /** Repart d'une session vierge : le contenu actuel devient l'« historique d'ouverture » */
  const resetSession = useCallback(() => {
    prevContent.current = '';
    seen.current = new Map();
    baselineDone.current = false;
    lastReadAt.current = 0;
    resumedRef.current = false;
    eventsRef.current = [];
    samplesRef.current = [];
    setEvents([]);
    setSamples([]);
    setPauses([]);
    setSessionStart(null);
    setBaselineCount(0);
    setBaselineLevels({ critical: 0, major: 0, minor: 0, warning: 0 });
  }, []);

  const pushSample = useCallback((ev: DetectionEvent) => {
    samplesRef.current = [...samplesRef.current, ev].slice(-MAX_SAMPLES);
    setSamples(samplesRef.current);
  }, []);

  const parseContent = useCallback((content: string, force = false) => {
    const nowMs = Date.now();
    const prevRead = lastReadAt.current;
    lastReadAt.current = nowMs; // à chaque lecture, même sans changement
    if (!force && content === prevContent.current) {
      // Relecture sans changement : point à zéro sur la courbe instantanée
      if (baselineDone.current) {
        pushSample({ t: nowMs, dt: Math.max(1, nowMs - prevRead), critical: 0, major: 0, minor: 0, warning: 0, catchUp: false, afterPause: resumedRef.current });
      }
      resumedRef.current = false; // reprise sans rien de nouveau : pas de rattrapage
      return;
    }
    const currentRules = rulesRef.current;
    const lines = content.split('\n');
    const isBaselineRead = !baselineDone.current;

    // 1) Repérer les lignes en erreur. Clé = contenu + n-ième occurrence (stable si le fichier grandit)
    const occ = new Map<string, number>();
    const nextSeen = new Map<string, { t: number; baseline: boolean }>();
    const found: TrameError[] = [];
    const fresh = { critical: 0, major: 0, minor: 0, warning: 0 };

    for (let i = 0; i < lines.length; i++) {
      const lower = lines[i].toLowerCase();
      for (const rule of currentRules) {
        if (!rule.keyword.trim()) continue; // ignore les règles vides
        if (lower.includes(rule.keyword.toLowerCase())) {
          const base = `${rule.keyword}|${lines[i].trim()}`;
          const n = (occ.get(base) ?? 0) + 1;
          occ.set(base, n);
          const key = `${base}#${n}`;
          let info = seen.current.get(key);
          let isNew = false;
          if (!info) { info = { t: nowMs, baseline: isBaselineRead }; isNew = true; }
          nextSeen.set(key, info);
          const err = { ...makeError(lines[i], i + 1, rule.keyword, info.t, info.baseline, key), severity: rule.severity };
          found.push(err);
          if (isNew && !isBaselineRead) fresh[err.severity]++;
          break;
        }
      }
    }
    seen.current = nextSeen; // purge les lignes disparues (fichier tronqué / roté)

    // 2) Événement de détection (jamais pour l'historique d'ouverture)
    const freshTotal = fresh.critical + fresh.major + fresh.minor + fresh.warning;
    if (isBaselineRead) {
      baselineDone.current = true;
      pushSample({ t: nowMs, dt: 1, critical: 0, major: 0, minor: 0, warning: 0, catchUp: false }); // point de départ
      setSessionStart(nowMs);
      setBaselineCount(found.length);
      setBaselineLevels({
        critical: found.filter(e => e.severity === 'critical').length,
        major: found.filter(e => e.severity === 'major').length,
        minor: found.filter(e => e.severity === 'minor').length,
        warning: found.filter(e => e.severity === 'warning').length,
      });
    } else {
      const dt = Math.max(1, nowMs - prevRead);
      const catchUp = freshTotal > 0 && (resumedRef.current || dt > CATCHUP_MS);
      const ev: DetectionEvent = { t: nowMs, dt, ...fresh, catchUp, afterPause: resumedRef.current };
      pushSample(ev);
      if (freshTotal > 0) {
        eventsRef.current = [...eventsRef.current, ev].slice(-MAX_EVENTS);
        setEvents(eventsRef.current);
      }
    }
    if (!isBaselineRead) resumedRef.current = false;

    // 3) Stats et listes
    const now = new Date(nowMs);
    const nonEmpty = lines.filter(l => l.trim().length > 0).length;
    const cc = found.filter(e => e.severity === 'critical').length;
    const mc = found.filter(e => e.severity === 'major').length;
    const nc = found.filter(e => e.severity === 'minor').length;
    const wc = found.filter(e => e.severity === 'warning').length;
    setFileContent(content);
    setErrors(found);
    setStats({
      totalErrors: found.length, criticalCount: cc, majorCount: mc, minorCount: nc, warningCount: wc,
      errorRate: freshTotal, lastErrorTime: found.length > 0 ? now : null,
      tramesAnalyzed: nonEmpty, tramesInError: found.length,
    });
    setLineCount(nonEmpty);
    setLastModified(now);
    prevContent.current = content;
  }, [pushSample]);

  const startPolling = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      if (handleRef.current) handleRef.current.getFile().then(f => f.text()).then(t => parseContent(t)).catch(() => {});
    }, POLL_INTERVAL);
  }, [parseContent]);

  // === Native API (Chrome/Edge ouverts directement) ===
  const selectFileNative = useCallback(async () => {
    try {
      // @ts-ignore
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'Fichiers texte', accept: { 'text/plain': ['.txt', '.log', '.csv'] } }],
        multiple: false,
      });
      handleRef.current = handle;
      const file = await handle.getFile();
      const text = await file.text();
      resetSession();
      pausedRef.current = false;
      fileNameRef.current = handle.name; isWatchingRef.current = true; fallbackModeRef.current = false;
      setFileName(handle.name); setIsWatching(true); setIsPaused(false); setFallbackMode(false);
      parseContent(text);
      startPolling();
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.error(e);
    }
  }, [parseContent, resetSession, startPolling]);

  // === Fallback: input[type=file] pour tout navigateur ===
  const handleFallbackFile = useCallback((e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    // Même fichier rechargé : on garde l'historique (c'est une relecture, pas un nouveau fichier)
    const isReload = isWatchingRef.current && fallbackModeRef.current && fileNameRef.current === file.name;
    if (!isReload) {
      resetSession();
      pausedRef.current = false;
    }
    fileNameRef.current = file.name; isWatchingRef.current = true; fallbackModeRef.current = true;
    setFileName(file.name); setIsWatching(true); setIsPaused(false); setFallbackMode(true);
    file.text().then(text => parseContent(text));
  }, [parseContent, resetSession]);

  // Créer le input hidden au mount
  useEffect(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.log,.csv';
    input.style.display = 'none';
    input.addEventListener('change', handleFallbackFile);
    document.body.appendChild(input);
    fallbackInputRef.current = input;
    return () => { input.removeEventListener('change', handleFallbackFile); input.remove(); };
  }, [handleFallbackFile]);

  const selectFile = useCallback(async () => {
    if (hasNativeAPI) {
      try { await selectFileNative(); return; } catch { /* fallback below */ }
    }
    if (fallbackInputRef.current) {
      fallbackInputRef.current.value = '';
      fallbackInputRef.current.click();
    }
  }, [hasNativeAPI, selectFileNative]);

  // Fallback re-read: user re-selects same file
  const reloadFallback = useCallback(() => {
    if (fallbackInputRef.current) {
      fallbackInputRef.current.value = '';
      fallbackInputRef.current.click();
    }
  }, []);

  const stopWatching = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    handleRef.current = null;
    isWatchingRef.current = false; fileNameRef.current = '';
    setIsWatching(false); setFileName('');
  }, []);

  const togglePause = useCallback(() => {
    const nowMs = Date.now();
    if (!pausedRef.current) {
      pausedRef.current = true;
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setPauses(p => [...p, { start: nowMs, end: null }]);
      setIsPaused(true);
    } else {
      pausedRef.current = false;
      resumedRef.current = true; // la prochaine relecture est un « rattrapage »
      setPauses(p => p.map((s, i) => (i === p.length - 1 && s.end == null ? { ...s, end: nowMs } : s)));
      if (handleRef.current && !fallbackModeRef.current) startPolling();
      setIsPaused(false);
    }
  }, [startPolling]);

  const forceRefresh = useCallback(() => {
    if (handleRef.current && !fallbackModeRef.current) {
      handleRef.current.getFile().then(f => f.text()).then(t => parseContent(t)).catch(() => {});
    } else {
      reloadFallback();
    }
  }, [parseContent, reloadFallback]);

  const clearAll = useCallback(() => {
    stopWatching();
    pausedRef.current = false;
    resetSession();
    setFileContent(''); setErrors([]);
    setStats(emptyStats); setLineCount(0); setLastModified(null);
    setIsPaused(false);
  }, [stopWatching, resetSession]);

  useEffect(() => { return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, []);

  // Quand les mots-clés changent : on ré-analyse le contenu déjà chargé et on repart d'un historique propre
  useEffect(() => {
    if (!prevContent.current) return;
    const t = window.setTimeout(() => {
      const content = prevContent.current;
      resetSession();
      parseContent(content, true);
    }, 400);
    return () => clearTimeout(t);
  }, [rules, parseContent, resetSession]);

  useEffect(() => {
    localStorage.setItem('monitoringRules', JSON.stringify(rules));
  }, [rules]);

  return {
    hasNativeAPI,
    fallbackMode,
    isWatching, isPaused, fileName, lastModified, lineCount,
    fileContent, errors, stats,
    events, samples, pauses, sessionStart, baselineCount, baselineLevels,
    selectFile, stopWatching, togglePause, forceRefresh, clearAll,
    rules,
    setRules,
  };
}
