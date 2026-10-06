import { useMemo, useState, memo } from 'react';
import {
  ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea, ReferenceDot, Cell,
} from 'recharts';
import { Bell, Volume2, VolumeX, Scissors } from 'lucide-react';
import type { ChartView, ErrorSeverity } from '../types';
import {
  Bucket, AlertSettings, AlertLevel, WINDOW_OPTIONS, fmtTime, fmtDuration, pausedRanges,
} from '../utils/cadence';

const LEVELS: { key: ErrorSeverity; name: string; color: string }[] = [
  { key: 'critical', name: 'Critique', color: '#ef4444' },
  { key: 'major', name: 'Majeure', color: '#f97316' },
  { key: 'minor', name: 'Mineure', color: '#eab308' },
  { key: 'warning', name: 'Warning', color: '#06b6d4' },
];

interface ErrorChartProps {
  buckets: Bucket[];
  bucketMs: number;
  settings: AlertSettings;
  onSettingsChange: (s: AlertSettings) => void;
  alertLevel: AlertLevel;
  selected: number | null;
  onSelect: (start: number | null) => void;
  baselineCount: number;
}

function BucketTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const b: Bucket = payload[0].payload;
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 shadow-xl max-w-xs">
      <p className="text-slate-300 text-xs mb-2 font-mono">
        {fmtTime(b.start)} → {fmtTime(b.end)} {b.paused && <span className="text-amber-400">(pause)</span>}
      </p>
      {LEVELS.filter(l => b[l.key] > 0).map(l => (
        <div key={l.key} className="flex items-center gap-2 text-sm">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} />
          <span className="text-slate-400">{l.name} :</span>
          <span className="text-white font-mono font-bold">{b[l.key]}</span>
        </div>
      ))}
      <p className="text-slate-200 text-sm mt-1.5">
        Nouvelles dans la fenêtre : <span className="font-mono font-bold">{b.total}</span>
      </p>
      {b.catchUp && (
        <p className="text-amber-400 text-xs mt-1.5 leading-snug">
          ⚠ Rattrapage : {b.catchUpCount} erreurs vues d'un coup après {fmtDuration(b.catchUpDt)} sans relecture
          (≈ {(b.catchUpCount / (b.catchUpDt / 60000)).toFixed(1)}/min en moyenne). Étalement réel inconnu.
        </p>
      )}
      <p className="text-violet-300 text-xs mt-1.5">Total cumulé : <span className="font-mono">{b.cumul}</span></p>
      {b.normal != null && <p className="text-slate-400 text-xs">Normal ≈ {b.normal.toFixed(1)} / fenêtre</p>}
      <p className="text-slate-500 text-[10px] mt-1.5">Clic : filtrer le journal sur cette fenêtre</p>
    </div>
  );
}

function windowLabel(sec: number) {
  return sec < 60 ? `${sec} s` : `${sec / 60} min`;
}

export const ErrorChart = memo(function ErrorChart({
  buckets, bucketMs, settings, onSettingsChange, alertLevel, selected, onSelect, baselineCount,
}: ErrorChartProps) {
  const [view, setView] = useState<ChartView>('cadence');
  const [clip, setClip] = useState(true);

  const tickFmt = (v: number) => fmtTime(v, bucketMs < 60_000);
  // Axe X temporel : chaque barre est centrée au milieu de sa fenêtre, les zones (pause, sélection) sont exactes
  const data = useMemo(() => buckets.map(b => ({ ...b, mid: b.start + bucketMs / 2 })), [buckets, bucketMs]);
  const xDomain: [number, number] = buckets.length
    ? [buckets[0].start, buckets[buckets.length - 1].end]
    : [0, 1];
  const ranges = useMemo(() => pausedRanges(buckets), [buckets]);
  const xAxisProps = {
    dataKey: 'mid', type: 'number' as const, scale: 'time' as const, domain: xDomain,
    tickFormatter: tickFmt, tickCount: 6, allowDataOverflow: true,
  };

  // Échelle : les rattrapages sont écrêtés pour ne pas écraser le reste (le chiffre reste affiché)
  const capFor = (values: (b: Bucket) => number) => {
    const regular = Math.max(0, ...buckets.filter(b => !b.catchUp).map(values));
    return Math.max(regular, 3) * 1.25;
  };
  const cap = Math.ceil(Math.max(capFor(b => b.total), settings.threshold * 1.15));
  const clipped = clip ? buckets.filter(b => b.catchUp && b.total > cap) : [];

  const handleClick = (state: any) => {
    const raw = state?.activeIndex ?? state?.activeTooltipIndex;
    const i = raw == null ? NaN : Number(raw);
    const b = Number.isFinite(i) ? buckets[i] : undefined;
    if (!b) return;
    onSelect(selected === b.start ? null : b.start);
  };

  const pill =
    alertLevel === 'alert' ? { t: 'ALERTE', c: 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse' } :
    alertLevel === 'accel' ? { t: 'En hausse', c: 'bg-orange-500/15 text-orange-300 border-orange-500/30' } :
    { t: 'Rythme normal', c: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };

  const hatch = (
    <defs>
      {LEVELS.map(l => (
        <pattern key={l.key} id={`hatch-${l.key}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill={l.color} fillOpacity={0.3} />
          <line x1="0" y1="0" x2="0" y2="6" stroke={l.color} strokeWidth="3" />
        </pattern>
      ))}
    </defs>
  );

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-white font-semibold text-lg">Évolution des erreurs</h2>
            <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${pill.c}`}>{pill.t}</span>
          </div>
          <p className="text-slate-400 text-sm mt-0.5">
            Nouvelles erreurs par fenêtre de {windowLabel(settings.windowSec)} — l'axe est l'heure de <em>détection</em>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-1">
            {(['cadence', 'niveaux'] as ChartView[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${view === v ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
              >
                {v === 'cadence' ? 'Cadence + cumul' : 'Par niveau'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-1" title="Taille de la fenêtre d'agrégation (et d'alerte)">
            {WINDOW_OPTIONS.map(w => (
              <button
                key={w}
                onClick={() => onSettingsChange({ ...settings, windowSec: w })}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${settings.windowSec === w ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
              >
                {windowLabel(w)}
              </button>
            ))}
          </div>
          <button
            onClick={() => setClip(c => !c)}
            title="Écrête les gros rattrapages pour que les petites barres restent lisibles (le nombre reste affiché)"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${clip ? 'bg-amber-600/20 text-amber-300 border-amber-500/30' : 'bg-slate-700 text-slate-400 border-slate-600 hover:text-white'}`}
          >
            <Scissors className="w-3.5 h-3.5" />
            {clip ? 'Pics écrêtés' : 'Échelle réelle'}
          </button>
        </div>
      </div>

      {buckets.length === 0 ? (
        <div className="h-72 flex items-center justify-center text-slate-600">En attente de données…</div>
      ) : view === 'cadence' ? (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart accessibilityLayer={false} data={data} margin={{ top: 14, right: 6, left: 0, bottom: 5 }} onClick={handleClick} style={{ cursor: 'pointer' }}>
              {hatch}
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis {...xAxisProps} stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} />
              <YAxis yAxisId="left" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false}
                domain={clip ? [0, cap] : [0, 'auto']} allowDataOverflow={clip} width={34} />
              <YAxis yAxisId="right" orientation="right" stroke="#64748b" tick={{ fill: '#a78bfa', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false}
                domain={[(m: number) => Math.max(0, Math.floor(m) - 1), (m: number) => Math.ceil(m) + 1]} width={40} />
              <Tooltip content={<BucketTooltip />} cursor={{ fill: '#ffffff10' }} isAnimationActive={false} />

              {ranges.map((r, i) => (
                <ReferenceArea key={`p${i}`} yAxisId="left" x1={r.x1} x2={r.x2 + bucketMs} fill="#f59e0b" fillOpacity={0.1} stroke="#f59e0b" strokeOpacity={0.3} strokeDasharray="3 3"
                  label={{ value: 'Pause', fill: '#fbbf24', fontSize: 10, position: 'insideTopLeft' }} />
              ))}
              {selected != null && (
                <ReferenceArea yAxisId="left" x1={selected} x2={selected + bucketMs} fill="#22d3ee" fillOpacity={0.15} stroke="#22d3ee" strokeOpacity={0.6} />
              )}

              {LEVELS.map(l => (
                <Bar key={l.key} yAxisId="left" dataKey={l.key} name={l.name} stackId="n" fill={l.color} isAnimationActive={false} maxBarSize={40}>
                  {buckets.map(b => (
                    <Cell key={b.start} fill={b.catchUp ? `url(#hatch-${l.key})` : l.color} stroke={b.catchUp ? l.color : undefined} strokeDasharray={b.catchUp ? '2 2' : undefined} />
                  ))}
                </Bar>
              ))}

              <Line yAxisId="right" type="monotone" dataKey="cumul" name="Cumul" stroke="#a78bfa" strokeWidth={2} strokeDasharray="5 3" dot={false} isAnimationActive={false} />
              <Line yAxisId="left" type="monotone" dataKey="normal" name="Normal" stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="2 3" dot={false} connectNulls={false} isAnimationActive={false} />

              {settings.threshold > 0 && (
                <ReferenceLine yAxisId="left" y={settings.threshold} stroke="#ef4444" strokeDasharray="6 4" strokeOpacity={0.8}
                  label={{ value: `Seuil ${settings.threshold}`, fill: '#f87171', fontSize: 10, position: 'insideTopRight' }} />
              )}
              {clipped.map(b => (
                <ReferenceDot key={`c${b.start}`} yAxisId="left" x={b.start + bucketMs / 2} y={cap} r={0}
                  label={{ value: `▲ ${b.total}`, fill: '#fbbf24', fontSize: 11, fontWeight: 700, position: 'insideBottom' }} />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {LEVELS.map(l => {
            const levelCap = Math.max(2, Math.ceil(Math.max(0, ...buckets.filter(b => !b.catchUp).map(b => b[l.key])) * 1.2));
            const sumAll = buckets.reduce((a, b) => a + b[l.key], 0);
            const lastV = buckets[buckets.length - 1][l.key];
            const lvlClipped = clip ? buckets.filter(b => b.catchUp && b[l.key] > levelCap) : [];
            return (
              <div key={l.key} className="bg-slate-900/40 border border-slate-700 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium flex items-center gap-2" style={{ color: l.color }}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} /> {l.name}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">{sumAll} au total · {lastV} dans la dernière fenêtre</span>
                </div>
                <div className="h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart accessibilityLayer={false} data={data} margin={{ top: 10, right: 4, left: 0, bottom: 0 }} onClick={handleClick} style={{ cursor: 'pointer' }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis {...xAxisProps} stroke="#64748b" tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} />
                      <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false}
                        domain={clip ? [0, levelCap] : [0, (m: number) => Math.max(m, 2)]} allowDataOverflow={clip} width={28} />
                      <Tooltip content={<BucketTooltip />} cursor={{ fill: '#ffffff10' }} isAnimationActive={false} />
                      {selected != null && <ReferenceArea x1={selected} x2={selected + bucketMs} fill="#22d3ee" fillOpacity={0.15} />}
                      <Bar dataKey={l.key} fill={l.color} isAnimationActive={false} maxBarSize={30}>
                        {buckets.map(b => (
                          <Cell key={b.start} fill={b.catchUp ? `url(#hatch-${l.key})` : l.color} stroke={b.catchUp ? l.color : undefined} strokeDasharray={b.catchUp ? '2 2' : undefined} />
                        ))}
                      </Bar>
                      {lvlClipped.map(b => (
                        <ReferenceDot key={`c${b.start}`} x={b.start + bucketMs / 2} y={levelCap} r={0}
                          label={{ value: `▲ ${b[l.key]}`, fill: '#fbbf24', fontSize: 10, fontWeight: 700, position: 'insideBottom' }} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {view === 'niveaux' && (
        <svg width="0" height="0" className="absolute">{hatch}</svg>
      )}

      {/* Légende de lecture */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span><span className="inline-block w-3 h-2.5 bg-slate-400 rounded-sm align-middle mr-1" />Barres = nouvelles erreurs dans la fenêtre</span>
        {view === 'cadence' && <span><span className="inline-block w-4 border-t-2 border-dashed border-violet-400 align-middle mr-1" />Cumul (axe de droite{baselineCount > 0 ? `, dont ${baselineCount} déjà là à l'ouverture` : ''})</span>}
        <span><span className="inline-block w-3 h-2.5 rounded-sm align-middle mr-1" style={{ background: 'repeating-linear-gradient(45deg,#94a3b8 0 2px,transparent 2px 4px)' }} />Hachuré = rattrapage (vu d'un coup, étalement inconnu)</span>
        <span><span className="inline-block w-3 h-2.5 bg-amber-500/30 border border-dashed border-amber-500/60 align-middle mr-1" />Pause</span>
        <span className="text-slate-600">Plage affichée : {fmtDuration(buckets.length * bucketMs)} (60 fenêtres max)</span>
        {view === 'cadence' && <span><span className="inline-block w-4 border-t-2 border-dotted border-slate-300 align-middle mr-1" />Normal (moyenne récente)</span>}
      </div>

      {/* Réglage des alertes */}
      <div className="mt-3 pt-3 border-t border-slate-700/60 flex items-center gap-3 flex-wrap text-xs text-slate-400">
        <Bell className="w-4 h-4 text-slate-500" />
        <span>Alerte si ≥</span>
        <input
          type="number" min={0} max={999} value={settings.threshold}
          onChange={e => onSettingsChange({ ...settings, threshold: Math.max(0, Math.min(999, Number(e.target.value) || 0)) })}
          className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white font-mono"
        />
        <span>erreurs critiques + majeures sur {windowLabel(settings.windowSec)} <span className="text-slate-600">(0 = désactivée)</span></span>
        <button
          onClick={() => onSettingsChange({ ...settings, sound: !settings.sound })}
          className={`ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${settings.sound ? 'bg-cyan-600/20 text-cyan-300 border-cyan-500/30' : 'bg-slate-800 text-slate-500 border-slate-600 hover:text-white'}`}
        >
          {settings.sound ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          Son {settings.sound ? 'activé' : 'coupé'}
        </button>
      </div>
    </div>
  );
});
