import { useEffect, useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { useRealFileWatcher } from './hooks/useRealFileWatcher';
import { useCadence } from './hooks/useCadence';
import { AlertBanner } from './components/AlertBanner';
import { PatternsPanel } from './components/PatternsPanel';
import { groupPatterns } from './utils/cadence';
import type { TimeRange } from './components/ErrorChart';
import { StatusBar } from './components/StatusBar';
import { ErrorChart } from './components/ErrorChart';
import { StatsPanel } from './components/StatsPanel';
import { SeverityGauge } from './components/SeverityGauge';
import { ErrorLog } from './components/ErrorLog';
import { RealFileSelector } from './components/RealFileSelector';
import type { ModuleSpyConfig } from './types';

export default function App() {
  const {
  hasNativeAPI,
  fallbackMode,
  isWatching,
  isPaused,
  fileName,
  lastModified,
  lineCount,
  fileContent,
  errors,
  stats,
  events,
  samples,
  pauses,
  sessionStart,
  baselineCount,
  baselineLevels,
  selectFile,
  stopWatching,
  togglePause,
  forceRefresh,
  clearAll,

  rules,
  setRules,

} = useRealFileWatcher();

  const isActive = isWatching && !isPaused && !fallbackMode;

  const { settings, setSettings, now, bucketMs, buckets, alert } = useCadence({
    events, pauses, sessionStart, baselineCount, baselineLevels, isWatching,
  });

  // Sélection d'une fenêtre sur le graphique / d'un motif → filtre le journal
  const [selectedRange, setSelectedRange] = useState<TimeRange | null>(null);
  const [patternFilter, setPatternFilter] = useState<string | null>(null);
  const [dismissedCatchUp, setDismissedCatchUp] = useState<number | null>(null);
  useEffect(() => { setSelectedRange(null); setPatternFilter(null); setDismissedCatchUp(null); }, [sessionStart]);

  const patterns = useMemo(() => groupPatterns(errors, Date.now() - 5 * 60_000), [errors]);
  const windowLabel = settings.windowSec < 60 ? `${settings.windowSec} s` : `${settings.windowSec / 60} min`;

  const config: ModuleSpyConfig = {
    endpoint: fileName || '(non sélectionné)',
    pollingInterval: 1000,
    trameId: rules.map(r => r.keyword).join(', '),
    moduleName: 'Surveillance des erreurs de trame',
    connectionStatus: fileContent ? 'connected' : 'disconnected',
  };

  const handleExport = () => {
    if (errors.length === 0) return;
    const lines = [
      'Détectée à;Origine;Code;Severity;Description;Ligne;Source',
      ...errors.map(e =>
        `${new Date(e.detectedAt).toLocaleString('fr-FR')};${e.baseline ? 'ouverture' : 'nouvelle'};${e.errorCode};${e.severity};${e.description};${e.fieldPosition};${e.source}`
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `erreurs-trame-${new Date().toISOString().slice(0, 19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <StatusBar config={config} isRunning={isActive} />

      <div className="flex-1 p-5 space-y-5">
        {/* Mots-clés + fenêtre de surveillance (exports et RAZ inclus) */}
        <div className="grid grid-cols-1 xl:grid-cols-[auto_1fr] gap-5 items-stretch">
          <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3 xl:w-[420px]">
            <p className="text-cyan-400 text-sm mb-2 font-semibold">Mots-clés surveillés</p>

            {rules.map((rule, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  value={rule.keyword}
                  onChange={(e) => {
                    const updated = [...rules];
                    updated[index].keyword = e.target.value;
                    setRules(updated);
                  }}
                  placeholder="Mot-clé"
                  className="bg-slate-800 border border-slate-600 px-2 py-1 rounded text-white flex-1 min-w-0"
                />
                <select
                  value={rule.severity}
                  onChange={(e) => {
                    const updated = [...rules];
                    updated[index].severity = e.target.value as any;
                    setRules(updated);
                  }}
                  className="bg-slate-800 border border-slate-600 px-2 py-1 rounded text-white"
                >
                  <option value="critical">Critique</option>
                  <option value="major">Majeure</option>
                  <option value="minor">Mineure</option>
                  <option value="warning">Avertissement</option>
                </select>
                <button
                  onClick={() => {
                    const updated = [...rules];
                    updated.splice(index, 1);
                    setRules(updated);
                  }}
                  className="px-2 bg-red-600 rounded"
                >
                  X
                </button>
              </div>
            ))}

            <button
              onClick={() => setRules([...rules, { keyword: '', severity: 'minor' }])}
              className="px-3 py-1 bg-cyan-600 rounded text-sm"
            >
              + Ajouter
            </button>
          </div>

          <RealFileSelector
            isWatching={isWatching}
            isPaused={isPaused}
            fileName={fileName}
            lastModified={lastModified}
            lineCount={lineCount}
            errorCount={errors.length}
            fallbackMode={fallbackMode}
            hasNativeAPI={hasNativeAPI}
            keywords={rules.map(r => r.keyword.trim()).filter(Boolean)}
            canExport={errors.length > 0}
            onSelectFile={selectFile}
            onStopWatching={stopWatching}
            onTogglePause={togglePause}
            onForceRefresh={forceRefresh}
            onExport={handleExport}
            onClear={clearAll}
          />
        </div>

        {/* Alertes : seuil dépassé, rythme en hausse, rattrapage */}
        <AlertBanner
          alert={alert}
          windowSec={settings.windowSec}
          threshold={settings.threshold}
          dismissedCatchUp={dismissedCatchUp}
          onDismissCatchUp={setDismissedCatchUp}
        />

        {/* Graphique + Compteurs */}
        {(errors.length > 0 || buckets.length > 0) && (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
            <div className="xl:col-span-3 space-y-5">
              <ErrorChart
                buckets={buckets}
                bucketMs={bucketMs}
                samples={samples}
                pauses={pauses}
                now={now}
                settings={settings}
                onSettingsChange={setSettings}
                alertLevel={alert.level}
                selected={selectedRange}
                onSelect={setSelectedRange}
                baselineCount={baselineCount}
              />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <QuickStat label="Erreurs détectées" value={stats.totalErrors.toString()}
                  color={stats.totalErrors > 20 ? 'text-red-400' : stats.totalErrors > 5 ? 'text-orange-400' : stats.totalErrors > 0 ? 'text-amber-400' : 'text-emerald-400'}
                  pulse={stats.errorRate > 0} />
                <QuickStat label="Lignes analysées" value={stats.tramesAnalyzed.toLocaleString('fr-FR')} color="text-cyan-400" />
                <QuickStat label="Taux d'erreur"
                  value={stats.tramesAnalyzed > 0 ? `${((stats.tramesInError / stats.tramesAnalyzed) * 100).toFixed(1)}%` : '—'}
                  color="text-amber-400" />
                <QuickStat label={`Nouvelles (${windowLabel})`} value={Math.round(alert.all).toString()}
                  color={alert.all > 0 ? 'text-red-400' : 'text-slate-400'} pulse={alert.all > 0} />
              </div>

              {/* Sous le graphique : analyse + journal */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
                <div className="lg:col-span-1">
                  <SeverityGauge stats={stats} />
                </div>
                {errors.length > 0 && (
                  <div className="lg:col-span-2 min-w-0">
                    <ErrorLog
                      errors={errors}
                      compact
                      timeRange={selectedRange}
                      onClearTime={() => setSelectedRange(null)}
                      pattern={patternFilter}
                      onClearPattern={() => setPatternFilter(null)}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="xl:col-span-1 space-y-5">
              <StatsPanel stats={stats} windowCount={alert.critMajor} threshold={settings.threshold} windowLabel={windowLabel} />
              <PatternsPanel groups={patterns} total={stats.totalErrors} active={patternFilter} onSelect={setPatternFilter} />
            </div>
          </div>
        )}

        {/* État vide */}
        {errors.length === 0 && !fileContent && (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <h3 className="text-slate-400 text-xl font-semibold mb-2">Aucun fichier sélectionné</h3>
            <p className="text-slate-600 max-w-lg mx-auto">
              Cliquez sur le bouton ci-dessus pour choisir votre fichier{' '}
              <code className="text-violet-400 font-mono">testtrameerror.txt</code>
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-slate-800 pt-4 pb-2">
          <div className="flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2">
            <div className="flex items-center gap-4">
              <span>Surveillance des erreurs de trame</span>
              <span>•</span>
              <span>
              Détection : {rules.map(r => r.keyword).join(', ')}
              </span>
              {fileName && <><span>•</span><span>{fileName}</span></>}
            </div>
            <div>
              {isActive ? (
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium animate-pulse">▶ ACTIVE</span>
              ) : isWatching ? (
                <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">⏸ PAUSE</span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-slate-500/10 text-slate-400 border border-slate-500/20 font-medium">EN ATTENTE</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickStat({ label, value, color, pulse = false }: { label: string; value: string; color: string; pulse?: boolean }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3">
      <p className="text-slate-500 text-[10px] uppercase tracking-wider font-medium mb-1">{label}</p>
      <p className={`text-xl font-bold font-mono ${color} ${pulse ? 'animate-pulse' : ''}`}>{value}</p>
    </div>
  );
}
