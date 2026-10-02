import { useState, useCallback, useRef, useEffect } from 'react';
import type { TrameError, TrameErrorCount, ErrorStats, ErrorSeverity, ChartMode } from '../types';

const POLL_INTERVAL = 1000;

function classifySeverity(line: string): ErrorSeverity {
  const lower = line.toLowerCase();
  if (lower.includes('critical') || lower.includes('critique') || lower.includes('fatal')) return 'critical';
  if (lower.includes('major') || lower.includes('majeur') || lower.includes('grave')) return 'major';
  if (lower.includes('warning') || lower.includes('warn') || lower.includes('attention')) return 'warning';
  return 'minor';
}

function makeError(line: string, lineNumber: number): TrameError {
  return {
    id: `ERR-${lineNumber}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date(),
    errorCode: 'ERR_DIALOGUE',
    description: line.trim().substring(0, 150),
    severity: classifySeverity(line),
    trameId: `L${String(lineNumber).padStart(5, '0')}`,
    fieldPosition: lineNumber,
    expectedValue: '—',
    receivedValue: 'errordialogue',
    source: 'fichier local',
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
  const [chartMode, setChartMode] = useState<ChartMode>('surveillance');
  const [survData, setSurvData] = useState<TrameErrorCount[]>([]);
  const [fileData, setFileData] = useState<TrameErrorCount[]>([]);

  const handleRef = useRef<FileSystemFileHandle | null>(null);
  const timerRef = useRef<number | null>(null);
  const prevContent = useRef('');
  const prevTotal = useRef(0);
  const prevCounts = useRef({ critical: 0, major: 0, minor: 0, warning: 0 });
  const survHistory = useRef<TrameErrorCount[]>([]);
  const fileHistory = useRef<TrameErrorCount[]>([]);

  // Fallback mode: input[type=file] reload
  const [fallbackMode, setFallbackMode] = useState(false);
  const fallbackInputRef = useRef<HTMLInputElement | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);

  const hasNativeAPI = typeof window !== 'undefined' && 'showOpenFilePicker' in window;

  const parseContent = useCallback((content: string) => {
    if (content === prevContent.current) return;
    const lines = content.split('\n');
    const found: TrameError[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(KEYWORD)) {
        found.push(makeError(lines[i], i + 1));
      }
    }
    setFileContent(content);
    setErrors(found);
    const now = new Date();
    const nonEmpty = lines.filter(l => l.trim().length > 0).length;
    const cc = found.filter(e => e.severity === 'critical').length;
    const mc = found.filter(e => e.severity === 'major').length;
    const nc = found.filter(e => e.severity === 'minor').length;
    const wc = found.filter(e => e.severity === 'warning').length;
    const delta = Math.max(0, found.length - prevTotal.current);
    prevTotal.current = found.length;
    setStats({ totalErrors: found.length, criticalCount: cc, majorCount: mc, minorCount: nc, warningCount: wc, errorRate: delta, lastErrorTime: found.length > 0 ? now : null, tramesAnalyzed: nonEmpty, tramesInError: found.length });
    setLineCount(nonEmpty);
    setLastModified(now);
    const ts = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    fileHistory.current = [...fileHistory.current, { timestamp: ts, total: found.length, critical: cc, major: mc, minor: nc, warning: wc }].slice(-300);
    setFileData([...fileHistory.current]);
    const dc = Math.max(0, cc - prevCounts.current.critical);
    const dm = Math.max(0, mc - prevCounts.current.major);
    const dn = Math.max(0, nc - prevCounts.current.minor);
    const dw = Math.max(0, wc - prevCounts.current.warning);
    survHistory.current = [...survHistory.current, { timestamp: ts, total: dc + dm + dn + dw, critical: dc, major: dm, minor: dn, warning: dw }].slice(-300);
    setSurvData([...survHistory.current]);
    prevCounts.current = { critical: cc, major: mc, minor: nc, warning: wc };
    prevContent.current = content;
  }, []);

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
      prevContent.current = ''; prevTotal.current = 0;
      prevCounts.current = { critical: 0, major: 0, minor: 0, warning: 0 };
      survHistory.current = []; fileHistory.current = [];
      setFileName(handle.name); setIsWatching(true); setIsPaused(false); setFallbackMode(false);
      parseContent(text);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        if (handleRef.current) handleRef.current.getFile().then(f => f.text()).then(t => parseContent(t)).catch(() => {});
      }, POLL_INTERVAL);
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.error(e);
    }
  }, [parseContent]);

  // === Fallback: input[type=file] pour tout navigateur ===
  const handleFallbackFile = useCallback((e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    prevContent.current = ''; prevTotal.current = 0;
    prevCounts.current = { critical: 0, major: 0, minor: 0, warning: 0 };
    survHistory.current = []; fileHistory.current = [];
    setFileName(file.name); setIsWatching(true); setIsPaused(false); setFallbackMode(true);
    file.text().then(text => parseContent(text));
  }, [parseContent]);

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
    // Fallback
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
    if (fallbackTimerRef.current) { clearInterval(fallbackTimerRef.current); fallbackTimerRef.current = null; }
    handleRef.current = null;
    setIsWatching(false); setFileName('');
  }, []);

  const togglePause = useCallback(() => {
    setIsPaused(prev => {
      if (!prev) {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      } else {
        if (handleRef.current && !fallbackMode) {
          timerRef.current = window.setInterval(() => {
            if (handleRef.current) handleRef.current.getFile().then(f => f.text()).then(t => parseContent(t)).catch(() => {});
          }, POLL_INTERVAL);
        }
      }
      return !prev;
    });
  }, [parseContent, fallbackMode]);

  const forceRefresh = useCallback(() => {
    if (handleRef.current && !fallbackMode) {
      handleRef.current.getFile().then(f => f.text()).then(t => parseContent(t)).catch(() => {});
    } else {
      reloadFallback();
    }
  }, [parseContent, fallbackMode, reloadFallback]);

  const clearAll = useCallback(() => {
    stopWatching();
    setFileContent(''); setErrors([]); setSurvData([]); setFileData([]);
    setStats(emptyStats); setLineCount(0); setLastModified(null);
    prevContent.current = ''; prevTotal.current = 0;
    prevCounts.current = { critical: 0, major: 0, minor: 0, warning: 0 };
    survHistory.current = []; fileHistory.current = [];
  }, [stopWatching]);

  useEffect(() => { return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, []);

  const chartData = chartMode === 'surveillance' ? survData : fileData;

  return {
    hasNativeAPI,
    fallbackMode,
    isWatching, isPaused, fileName, lastModified, lineCount,
    fileContent, errors, chartData, stats, chartMode,
    setChartMode, selectFile, stopWatching, togglePause, forceRefresh, clearAll,
  };
}
