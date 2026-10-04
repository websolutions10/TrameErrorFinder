import { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Maximize2, Minimize2 } from 'lucide-react';
import type { TrameErrorCount, ChartMode } from '../types';

interface ErrorChartProps {
  data: TrameErrorCount[];
  chartMode: ChartMode;
  onChartModeChange: (mode: ChartMode) => void;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 shadow-xl">
      <p className="text-slate-300 text-xs mb-2 font-mono">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-400 capitalize">{entry.name} :</span>
          <span className="text-white font-mono font-bold">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export function ErrorChart({ data, chartMode, onChartModeChange }: ErrorChartProps) {
  const [autoScale, setAutoScale] = useState(true);

  const yDomain = useMemo((): [number, number] | undefined => {
    if (autoScale || data.length === 0) return undefined;
    const maxVal = Math.max(...data.map(d => Math.max(d.critical, d.major, d.minor, d.warning)), 1);
    const steps = [5, 10, 20, 50, 100, 200, 500, 1000];
    const ceiling = steps.find(s => s >= maxVal) || Math.ceil(maxVal / 100) * 100;
    return [0, ceiling];
  }, [autoScale, data]);

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-white font-semibold text-lg">Courbe d'erreurs en temps réel</h2>
          <p className="text-slate-400 text-sm mt-0.5">
            {chartMode === 'surveillance'
              ? 'Nouvelles erreurs détectées à chaque relecture'
              : 'Total cumulé des erreurs dans le fichier'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-1">
            <button
              onClick={() => onChartModeChange('surveillance')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${chartMode === 'surveillance' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
            >
              📡 Surveillance
            </button>
            <button
              onClick={() => onChartModeChange('fichier')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${chartMode === 'fichier' ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
            >
              📁 Depuis le fichier
            </button>
          </div>
          <button
            onClick={() => setAutoScale(p => !p)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${autoScale ? 'bg-cyan-600/20 text-cyan-400 border-cyan-500/30' : 'bg-slate-700 text-slate-400 border-slate-600 hover:text-white'}`}
          >
            {autoScale ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            {autoScale ? 'Auto-scale ON' : 'Auto-scale OFF'}
          </button>
        </div>
      </div>

      <div className={`mb-3 px-3 py-2 rounded-lg border text-xs flex items-center gap-2 ${chartMode === 'surveillance' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-violet-500/5 border-violet-500/20 text-violet-400'}`}>
        {chartMode === 'surveillance'
          ? <>📡 <strong>Mode Surveillance</strong> — Nouvelles erreurs apparues entre chaque relecture</>
          : <>📁 <strong>Mode Fichier</strong> — Total cumulé de toutes les erreurs depuis le début</>}
      </div>

      <div className="h-72">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600">En attente de données…</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} /></linearGradient>
                <linearGradient id="gm" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f97316" stopOpacity={0.2} /><stop offset="95%" stopColor="#f97316" stopOpacity={0} /></linearGradient>
                <linearGradient id="gn" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#eab308" stopOpacity={0.2} /><stop offset="95%" stopColor="#eab308" stopOpacity={0} /></linearGradient>
                <linearGradient id="gw" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2} /><stop offset="95%" stopColor="#06b6d4" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="timestamp" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} interval="preserveStartEnd" />
              <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} domain={yDomain} />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36} formatter={(v: string) => <span className="text-slate-300 text-xs capitalize">{v}</span>} />
              <Area type="monotone" dataKey="critical" name="Critique" stroke="#ef4444" strokeWidth={2} fill="url(#gc)" />
              <Area type="monotone" dataKey="major" name="Majeure" stroke="#f97316" strokeWidth={2} fill="url(#gm)" />
              <Area type="monotone" dataKey="minor" name="Mineure" stroke="#eab308" strokeWidth={2} fill="url(#gn)" />
              <Area type="monotone" dataKey="warning" name="Warning" stroke="#06b6d4" strokeWidth={2} fill="url(#gw)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
