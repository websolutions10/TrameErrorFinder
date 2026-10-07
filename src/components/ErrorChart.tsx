import { useMemo, useState, memo, type ReactNode } from 'react';
import {
  ComposedChart, AreaChart, BarChart, Area, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea, ReferenceDot, Cell,
} from 'recharts';
import { Bell, Volume2, VolumeX, Scissors, Eye } from 'lucide-react';
import type { ChartView, ErrorSeverity, DetectionEvent, PauseSpan } from '../types';
import {
  Bucket, AlertSettings, AlertLevel, WINDOW_OPTIONS, fmtTime, fmtDuration, pausedRanges,
} from '../utils/cadence';

const LEVELS: { key: ErrorSeverity; name: string; color: string; cum: keyof Bucket; grad: string }[] = [
  { key: 'critical', name: 'Critique', color: '#ef4444', cum: 'cumulCritical', grad: 'gc' },
  { key: 'major', name: 'Majeure', color: '#f97316', cum: 'cumulMajor', grad: 'gm' },
  { key: 'minor', name: 'Mineure', color: '#eab308', cum: 'cumulMinor', grad: 'gn' },
  { key: 'warning', name: 'Warning', color: '#06b6d4', cum: 'cumulWarning', grad: 'gw' },
];

const VIEWS: { id: ChartView; label: string; icon?: ReactNode; active: string; strip: string; title: string; desc: string }[] = [
  {
    id: 'surveillance', label: 'Surveillance', icon: <Eye className="w-3.5 h-3.5 text-emerald-300" />,
    active: 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30',
    strip: 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400',
    title: 'Mode Surveillance',
    desc: 'Valeur instantanée : nouvelles erreurs détectées à chaque relecture du fichier, une courbe par niveau de sévérité.',
  },
  {
    id: 'fichier', label: '📁 Depuis le fichier',
    active: 'bg-violet-600 text-white shadow-lg shadow-violet-600/30',
    strip: 'bg-violet-500/5 border-violet-500/20 text-violet-400',
    title: 'Mode Fichier',
    desc: 'Total cumulé de chaque niveau depuis l\'ouverture du fichier. La courbe ne fait que monter : une pente raide = une période chargée.',
  },
  {
    id: 'cadence', label: '📊 Cadence + cumul',
    active: 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30',
    strip: 'bg-cyan-500/5 border-cyan-500/20 text-cyan-400',
    title: 'Mode Cadence',
    desc: 'Barres empilées = nouvelles erreurs par fenêtre (le seuil d\'alerte est la ligne rouge). Ligne violette = total cumulé, lue sur l\'axe de droite.',
  },
  {
    id: 'niveaux', label: '🔍 Par niveau',
    active: 'bg-slate-600 text-white shadow-lg',
    strip: 'bg-slate-500/5 border-slate-500/20 text-slate-300',
    title: 'Mode Par niveau',
    desc: 'Une petite échelle par niveau : les niveaux rares restent lisibles même si un autre niveau est très abondant.',
  },
];

export interface TimeRange { start: number; end: number }

interface ErrorChartProps {
  buckets: Bucket[];
  bucketMs: number;
  samples: DetectionEvent[];
  pauses: PauseSpan[];
  now: number;
  settings: AlertSettings;
  onSettingsChange: (s: AlertSettings) => void;
  alertLevel: AlertLevel;
  selected: TimeRange | null;
  onSelect: (r: TimeRange | null) => void;
  baselineCount: number;
}

const GAP_MS = 5000; // au-delà, la courbe instantanée est coupée (pause, absence de relecture)

function BucketTooltip({ active, payload, mode }: any) {
  if (!active || !payload || !payload.length) return null;
  const b: Bucket = payload[0].payload;
  const cumulMode = mode === 'fichier';
  const rows = LEVELS.map(l => ({ l, v: (cumulMode ? b[l.cum] : b[l.key]) as number })).filter(r => r.v > 0);
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 shadow-xl max-w-xs">
      <p className="text-slate-300 text-xs mb-2 font-mono">
        {fmtTime(b.start)} → {fmtTime(b.end)} {b.paused && <span className="text-amber-400">(pause)</span>}
      </p>
      {rows.map(({ l, v }) => (
        <div key={l.key} className="flex items-center gap-2 text-sm">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} />
          <span className="text-slate-400">{cumulMode ? `Total ${l.name.toLowerCase()}` : l.name} :</span>
          <span className="text-white font-mono font-bold">{v}</span>
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
      {mode === 'cadence' && b.normal != null && <p className="text-slate-400 text-xs">Normal ≈ {b.normal.toFixed(1)} / fenêtre</p>}
      <p className="text-slate-500 text-[10px] mt-1.5">Clic : filtrer le journal sur cette fenêtre</p>
    </div>
  );
}

function SampleTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  if (p.gap) return null;
  const rows = LEVELS.filter(l => (p[l.key] ?? 0) > 0);
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 shadow-xl max-w-xs">
      <p className="text-slate-300 text-xs mb-2 font-mono">{fmtTime(p.mid)}</p>
      {rows.length === 0 && <p className="text-slate-400 text-sm">Aucune nouvelle erreur</p>}
      {rows.map(l => (
        <div key={l.key} className="flex items-center gap-2 text-sm">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} />
          <span className="text-slate-400">{l.name} :</span>
          <span className="text-white font-mono font-bold">{p[l.key]}</span>
        </div>
      ))}
      {p.catchUp && (
        <p className="text-amber-400 text-xs mt-1.5 leading-snug">
          ⚠ Rattrapage : {p.total} erreurs vues d'un coup après {fmtDuration(p.dt)} sans relecture. Étalement réel inconnu.
        </p>
      )}
      <p className="text-slate-500 text-[10px] mt-1.5">Clic : filtrer le journal (±2 s)</p>
    </div>
  );
}

function windowLabel(sec: number) {
  return sec < 60 ? `${sec} s` : `${sec / 60} min`;
}

export const ErrorChart = memo(function ErrorChart({
  buckets, bucketMs, samples, pauses, now, settings, onSettingsChange, alertLevel, selected, onSelect, baselineCount,
}: ErrorChartProps) {
  const [view, setView] = useState<ChartView>('surveillance');
  const [clip, setClip] = useState(true);
  const [showCumul, setShowCumul] = useState(true);
  const [showNormal, setShowNormal] = useState(false);

  const viewDef = VIEWS.find(v => v.id === view)!;
  const tickFmt = (v: number) => fmtTime(v, bucketMs < 60_000);

  // Axe X temporel : chaque point/barre est au milieu de sa fenêtre, les zones (pause, sélection) sont exactes
  const data = useMemo(() => buckets.map(b => ({ ...b, mid: b.start + bucketMs / 2 })), [buckets, bucketMs]);
  // Mode Surveillance : une valeur par relecture (instantané). Un trou > GAP_MS coupe la courbe (pause, absence)
  const survData = useMemo(() => {
    const out: any[] = [];
    samples.forEach((s, i) => {
      const prev = samples[i - 1];
      if (prev && s.t - prev.t > GAP_MS) {
        out.push({ mid: prev.t + 1, gap: true, critical: null, major: null, minor: null, warning: null });
      }
      out.push({
        mid: s.t, critical: s.critical, major: s.major, minor: s.minor, warning: s.warning,
        total: s.critical + s.major + s.minor + s.warning, catchUp: s.catchUp, afterPause: !!s.afterPause, dt: s.dt,
      });
    });
    return out;
  }, [samples]);
  const survDomain: [number, number] = samples.length
    ? [samples[0].t, Math.max(now, samples[samples.length - 1].t)]
    : [0, 1];
  const survCatchUps = useMemo(() => samples.filter(s => s.catchUp), [samples]);
  const survLevelMax = (s: DetectionEvent) => Math.max(s.critical, s.major, s.minor, s.warning);
  const survCap = Math.ceil(Math.max(Math.max(0, ...samples.filter(s => !s.catchUp).map(survLevelMax)), 3) * 1.25);
  const xDomain: [number, number] = buckets.length ? [buckets[0].start, buckets[buckets.length - 1].end] : [0, 1];
  const ranges = useMemo(() => pausedRanges(buckets), [buckets]);
  const catchUps = useMemo(() => buckets.filter(b => b.catchUp), [buckets]);
  const xAxisProps = {
    dataKey: 'mid', type: 'number' as const, scale: 'time' as const, domain: xDomain,
    tickFormatter: tickFmt, tickCount: 6, allowDataOverflow: true,
  };

  // Échelle : les rattrapages sont écrêtés pour ne pas écraser le reste (le chiffre reste affiché)
  const maxRegular = (fn: (b: Bucket) => number) => Math.max(0, ...buckets.filter(b => !b.catchUp).map(fn));
  const levelMax = (b: Bucket) => Math.max(b.critical, b.major, b.minor, b.warning);
  const capCadence = Math.ceil(Math.max(Math.max(maxRegular(b => b.total), 3) * 1.25, settings.threshold * 1.15));
  const capCurves = Math.ceil(Math.max(maxRegular(levelMax), 3) * 1.25);
  const cap = view === 'surveillance' ? survCap : view === 'cadence' ? capCadence : capCurves;
  const clippedBuckets = clip && view !== 'fichier' && view !== 'surveillance'
    ? catchUps.filter(b => (view === 'cadence' ? b.total : levelMax(b)) > cap)
    : [];
  const clippedSamples = clip && view === 'surveillance' ? survCatchUps.filter(s => survLevelMax(s) > survCap) : [];
  const canClip = view !== 'fichier';

  const handleClick = (state: any) => {
    const raw = state?.activeIndex ?? state?.activeTooltipIndex;
    const i = raw == null ? NaN : Number(raw);
    if (!Number.isFinite(i)) return;
    let range: TimeRange | null = null;
    if (view === 'surveillance') {
      const p = survData[i];
      if (p && !p.gap) range = { start: p.mid - 2000, end: p.mid + 2000 }; // ±2 s autour de la relecture cliquée
    } else {
      const b = buckets[i];
      if (b) range = { start: b.start, end: b.end };
    }
    if (!range) return;
    onSelect(selected && selected.start === range.start ? null : range);
  };

  const pill =
    alertLevel === 'alert' ? { t: 'ALERTE', c: 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse' } :
    alertLevel === 'accel' ? { t: 'En hausse', c: 'bg-orange-500/15 text-orange-300 border-orange-500/30' } :
    { t: 'Rythme normal', c: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };

  const defs = (
    <defs>
      {LEVELS.map(l => (
        <linearGradient key={l.grad} id={l.grad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={l.color} stopOpacity={0.2} />
          <stop offset="95%" stopColor={l.color} stopOpacity={0} />
        </linearGradient>
      ))}
      {LEVELS.map(l => (
        <pattern key={l.key} id={`hatch-${l.key}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill={l.color} fillOpacity={0.3} />
          <line x1="0" y1="0" x2="0" y2="6" stroke={l.color} strokeWidth="3" />
        </pattern>
      ))}
      <pattern id="hatch-band" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="8" height="8" fill="#f59e0b" fillOpacity={0.08} />
        <line x1="0" y1="0" x2="0" y2="8" stroke="#f59e0b" strokeWidth="2" strokeOpacity={0.45} />
      </pattern>
    </defs>
  );

  // Zones communes : pauses, fenêtre sélectionnée, rattrapages (bande hachurée)
  const selectionOverlay = (yAxisId?: string) =>
    selected == null ? null : selected.end - selected.start <= 1 ? (
      <ReferenceLine yAxisId={yAxisId} x={selected.start} stroke="#22d3ee" strokeOpacity={0.8} strokeWidth={2} />
    ) : (
      <ReferenceArea yAxisId={yAxisId} x1={selected.start} x2={selected.end} fill="#22d3ee" fillOpacity={0.15} stroke="#22d3ee" strokeOpacity={0.6} />
    );

  const overlays = (yAxisId?: string, labels = true) => (
    <>
      {view === 'surveillance'
        ? pauses.map((p, i) => (
            <ReferenceArea key={`p${i}`} yAxisId={yAxisId} x1={p.start} x2={p.end ?? Math.max(now, survDomain[1])} ifOverflow="hidden"
              fill="#f59e0b" fillOpacity={0.1} stroke="#f59e0b" strokeOpacity={0.3} strokeDasharray="3 3"
              label={labels ? { value: 'Pause', fill: '#fbbf24', fontSize: 10, position: 'insideTopLeft' } : undefined} />
          ))
        : ranges.map((r, i) => (
            <ReferenceArea key={`p${i}`} yAxisId={yAxisId} x1={r.x1} x2={r.x2 + bucketMs} fill="#f59e0b" fillOpacity={0.1} stroke="#f59e0b" strokeOpacity={0.3} strokeDasharray="3 3"
              label={labels ? { value: 'Pause', fill: '#fbbf24', fontSize: 10, position: 'insideTopLeft' } : undefined} />
          ))}
      {view === 'surveillance' && survCatchUps.filter(c => !c.afterPause).map(c => (
        <ReferenceArea key={`cu${c.t}`} yAxisId={yAxisId} x1={c.t - c.dt} x2={c.t} fill="url(#hatch-band)" stroke="#f59e0b" strokeOpacity={0.5} strokeDasharray="2 2" />
      ))}
      {view === 'fichier' && catchUps.map(b => (
        <ReferenceArea key={`cu${b.start}`} yAxisId={yAxisId} x1={b.start} x2={b.end} fill="url(#hatch-band)" stroke="#f59e0b" strokeOpacity={0.5} strokeDasharray="2 2" />
      ))}
      {selectionOverlay(yAxisId)}
    </>
  );

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-white font-semibold text-lg">Courbe d'erreurs en temps réel</h2>
            <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${pill.c}`}>{pill.t}</span>
          </div>
          <p className="text-slate-400 text-sm mt-0.5">
            {view === 'surveillance'
              ? <>Relecture instantanée — l'axe est l'heure de <em>détection</em> par l'outil</>
              : <>Fenêtres de {windowLabel(settings.windowSec)} — l'axe est l'heure de <em>détection</em> par l'outil</>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-1 flex-wrap">
            {VIEWS.map(v => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${view === v.id ? v.active : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
              >
                {v.icon}{v.label}
              </button>
            ))}
          </div>
          {view !== 'surveillance' && (
          <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-1" title="Taille de la fenêtre d'agrégation (et d'alerte)">
            {WINDOW_OPTIONS.map(w => (
              <button
                key={w}
                onClick={() => { onSelect(null); onSettingsChange({ ...settings, windowSec: w }); }}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${settings.windowSec === w ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
              >
                {windowLabel(w)}
              </button>
            ))}
          </div>
          )}
          {canClip && (
            <button
              onClick={() => setClip(c => !c)}
              title="Écrête les gros rattrapages pour que les petites variations restent lisibles (le nombre reste affiché)"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${clip ? 'bg-amber-600/20 text-amber-300 border-amber-500/30' : 'bg-slate-700 text-slate-400 border-slate-600 hover:text-white'}`}
            >
              <Scissors className="w-3.5 h-3.5" />
              {clip ? 'Pics écrêtés' : 'Échelle réelle'}
            </button>
          )}
        </div>
      </div>

      {/* Comment lire ce mode */}
      <div className={`mb-3 px-3 py-2 rounded-lg border text-xs ${viewDef.strip}`}>
        <strong>{viewDef.title}</strong> — {viewDef.desc}
      </div>

      {(view === 'surveillance' ? samples.length === 0 : buckets.length === 0) ? (
        <div className="h-72 flex items-center justify-center text-slate-600">En attente de données…</div>
      ) : view === 'surveillance' ? (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart accessibilityLayer={false} data={survData} margin={{ top: 14, right: 10, left: 0, bottom: 5 }} onClick={handleClick} style={{ cursor: 'pointer' }}>
              {defs}
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="mid" type="number" scale="time" domain={survDomain} allowDataOverflow tickFormatter={(v: number) => fmtTime(v)} tickCount={6}
                stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} />
              <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false}
                domain={clip ? [0, survCap] : [0, (m: number) => Math.max(m, 3)]} allowDataOverflow={clip} width={34} />
              <Tooltip content={<SampleTooltip />} cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }} isAnimationActive={false} />
              {overlays(undefined)}
              {LEVELS.map(l => (
                <Area key={l.key} type="linear" dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={2} fill={`url(#${l.grad})`}
                  dot={(pr: any) => (pr.value > 0
                    ? <circle key={`d${l.key}${pr.index}`} cx={pr.cx} cy={pr.cy} r={3} fill={l.color} />
                    : <g key={`d${l.key}${pr.index}`} />)}
                  connectNulls={false} isAnimationActive={false} />
              ))}
              {clippedSamples.map(c => (
                <ReferenceDot key={`c${c.t}`} x={c.t} y={survCap} r={0}
                  label={{ value: `▲ ${c.critical + c.major + c.minor + c.warning}`, fill: '#fbbf24', fontSize: 11, fontWeight: 700, position: 'insideBottom' }} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : view === 'fichier' ? (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart accessibilityLayer={false} data={data} margin={{ top: 14, right: 10, left: 0, bottom: 5 }} onClick={handleClick} style={{ cursor: 'pointer' }}>
              {defs}
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis {...xAxisProps} stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} />
              <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} domain={[0, 'auto']} width={34} />
              <Tooltip content={<BucketTooltip mode={view} />} cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }} isAnimationActive={false} />
              {overlays(undefined)}
              {LEVELS.map(l => (
                <Area key={l.key} type="monotone" dataKey={l.cum as string} name={l.name} stroke={l.color} strokeWidth={2}
                  fill={`url(#${l.grad})`} dot={{ r: 2, fill: l.color, strokeWidth: 0 }} isAnimationActive={false} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : view === 'cadence' ? (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart accessibilityLayer={false} data={data} margin={{ top: 14, right: 6, left: 0, bottom: 5 }} onClick={handleClick} style={{ cursor: 'pointer' }}>
              {defs}
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis {...xAxisProps} stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} />
              <YAxis yAxisId="left" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false}
                domain={clip ? [0, cap] : [0, 'auto']} allowDataOverflow={clip} width={34} />
              <YAxis yAxisId="right" orientation="right" hide={!showCumul} stroke="#64748b" tick={{ fill: '#a78bfa', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false}
                domain={[(m: number) => Math.max(0, Math.floor(m) - 1), (m: number) => Math.ceil(m) + 1]} width={40} />
              <Tooltip content={<BucketTooltip mode={view} />} cursor={{ fill: '#ffffff10' }} isAnimationActive={false} />
              {overlays('left')}
              {LEVELS.map(l => (
                <Bar key={l.key} yAxisId="left" dataKey={l.key} name={l.name} stackId="n" fill={l.color} isAnimationActive={false} maxBarSize={40}>
                  {buckets.map(b => (
                    <Cell key={b.start} fill={b.catchUp ? `url(#hatch-${l.key})` : l.color} stroke={b.catchUp ? l.color : undefined} strokeDasharray={b.catchUp ? '2 2' : undefined} />
                  ))}
                </Bar>
              ))}
              {showCumul && <Line yAxisId="right" type="monotone" dataKey="cumul" name="Cumul" stroke="#a78bfa" strokeWidth={2} strokeDasharray="5 3" dot={false} isAnimationActive={false} />}
              {showNormal && <Line yAxisId="left" type="monotone" dataKey="normal" name="Normal" stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="2 3" dot={false} isAnimationActive={false} />}
              {settings.threshold > 0 && (
                <ReferenceLine yAxisId="left" y={settings.threshold} stroke="#ef4444" strokeDasharray="6 4" strokeOpacity={0.8}
                  label={{ value: `Seuil ${settings.threshold}`, fill: '#f87171', fontSize: 10, position: 'insideTopRight' }} />
              )}
              {clippedBuckets.map(b => (
                <ReferenceDot key={`c${b.start}`} yAxisId="left" x={b.start + bucketMs / 2} y={cap} r={0}
                  label={{ value: `▲ ${b.total}`, fill: '#fbbf24', fontSize: 11, fontWeight: 700, position: 'insideBottom' }} />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {LEVELS.map(l => {
            const levelCap = Math.max(2, Math.ceil(maxRegular(b => b[l.key]) * 1.2));
            const sumAll = buckets.reduce((a, b) => a + b[l.key], 0);
            const lastV = buckets[buckets.length - 1][l.key];
            const lvlClipped = clip ? catchUps.filter(b => b[l.key] > levelCap) : [];
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
                    <BarChart accessibilityLayer={false} data={data} margin={{ top: 18, right: 4, left: 0, bottom: 0 }} onClick={handleClick} style={{ cursor: 'pointer' }}>
                      {defs}
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis {...xAxisProps} stroke="#64748b" tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} />
                      <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false}
                        domain={clip ? [0, levelCap] : [0, (m: number) => Math.max(m, 2)]} allowDataOverflow={clip} width={28} />
                      <Tooltip content={<BucketTooltip mode={view} />} cursor={{ fill: '#ffffff10' }} isAnimationActive={false} />
                      {overlays(undefined, false)}
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

      {/* Légende de lecture (adaptée au mode) */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        {(view === 'surveillance' || view === 'fichier') && LEVELS.map(l => (
          <span key={l.key}><span className="inline-block w-3 h-0.5 align-middle mr-1" style={{ backgroundColor: l.color }} />{l.name}</span>
        ))}
        {view === 'cadence' && (
          <>
            <span><span className="inline-block w-3 h-2.5 bg-slate-400 rounded-sm align-middle mr-1" />Barres = nouvelles erreurs / fenêtre</span>
            <button onClick={() => setShowCumul(v => !v)} className={`hover:text-white ${showCumul ? '' : 'line-through opacity-60'}`} title="Afficher / masquer le cumul">
              <span className="inline-block w-4 border-t-2 border-dashed border-violet-400 align-middle mr-1" />Cumul (axe de droite{baselineCount > 0 ? `, dont ${baselineCount} déjà là à l'ouverture` : ''})
            </button>
            <button onClick={() => setShowNormal(v => !v)} className={`hover:text-white ${showNormal ? '' : 'line-through opacity-60'}`} title="Afficher / masquer le rythme normal">
              <span className="inline-block w-4 border-t-2 border-dotted border-slate-300 align-middle mr-1" />Normal (moyenne récente)
            </button>
          </>
        )}
        <span><span className="inline-block w-3 h-2.5 rounded-sm align-middle mr-1" style={{ background: 'repeating-linear-gradient(45deg,#f59e0b 0 2px,transparent 2px 4px)' }} />Hachuré = rattrapage (vu d'un coup, étalement inconnu)</span>
        <span><span className="inline-block w-3 h-2.5 bg-amber-500/30 border border-dashed border-amber-500/60 align-middle mr-1" />Pause</span>
        <span className="text-slate-600">
          {view === 'surveillance'
            ? `Plage : ${fmtDuration(Math.max(0, survDomain[1] - survDomain[0]))} (${samples.length} relectures conservées)`
            : `Plage : ${fmtDuration(buckets.length * bucketMs)} (60 fenêtres max)`}
        </span>
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
