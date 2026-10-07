import { useEffect, useMemo, useRef, useState } from 'react';
import type { DetectionEvent, PauseSpan, ErrorSeverity } from '../types';
import {
  AlertSettings, DEFAULT_ALERT_SETTINGS, buildBuckets, evaluateAlerts,
} from '../utils/cadence';

const STORAGE_KEY = 'cadenceSettings';
const BASE_TITLE = 'Surveillance des erreurs de trame';

function loadSettings(): AlertSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_ALERT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* défaut */ }
  return DEFAULT_ALERT_SETTINGS;
}

let audioCtx: AudioContext | null = null;
function beep() {
  try {
    audioCtx = audioCtx ?? new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioCtx;
    [0, 0.28].forEach(offset => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 880;
      gain.gain.value = 0.06;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.18);
    });
  } catch { /* son indisponible */ }
}

export function useCadence(p: {
  events: DetectionEvent[];
  pauses: PauseSpan[];
  sessionStart: number | null;
  baselineCount: number;
  baselineLevels: Record<ErrorSeverity, number>;
  isWatching: boolean;
}) {
  const { events, pauses, sessionStart, baselineCount, baselineLevels, isWatching } = p;
  const [settings, setSettings] = useState<AlertSettings>(loadSettings);
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); }, [settings]);

  // L'axe du temps continue d'avancer tant qu'un fichier est suivi (pause comprise)
  useEffect(() => {
    if (!isWatching) return;
    setTick(Date.now());
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isWatching]);

  const lastEventT = events.length ? events[events.length - 1].t : 0;
  const now = Math.max(tick, lastEventT);
  const bucketMs = settings.windowSec * 1000;

  const buckets = useMemo(
    () => buildBuckets({ events, pauses, sessionStart, now, bucketMs, baselineCount, baselineLevels }),
    [events, pauses, sessionStart, now, bucketMs, baselineCount, baselineLevels],
  );
  const alert = useMemo(
    () => evaluateAlerts({ events, now, sessionStart, settings }),
    [events, now, sessionStart, settings],
  );

  // Son à l'entrée en alerte + titre d'onglet
  const prevLevel = useRef(alert.level);
  useEffect(() => {
    if (alert.level === 'alert' && prevLevel.current !== 'alert' && settings.sound) beep();
    prevLevel.current = alert.level;
    document.title =
      alert.level === 'alert' ? `🔴 ALERTE — ${BASE_TITLE}` :
      alert.level === 'accel' ? `🟠 En hausse — ${BASE_TITLE}` : BASE_TITLE;
  }, [alert.level, settings.sound]);
  useEffect(() => () => { document.title = BASE_TITLE; }, []);

  return { settings, setSettings, now, bucketMs, buckets, alert };
}
