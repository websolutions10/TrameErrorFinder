import { memo } from 'react';
import { Repeat } from 'lucide-react';
import type { PatternGroup } from '../utils/cadence';
import type { ErrorSeverity } from '../types';

const COLORS: Record<ErrorSeverity, string> = {
  critical: 'bg-red-500', major: 'bg-orange-500', minor: 'bg-yellow-500', warning: 'bg-cyan-500',
};

interface Props {
  groups: PatternGroup[];
  total: number;
  active: string | null;
  onSelect: (pattern: string | null) => void;
}

export const PatternsPanel = memo(function PatternsPanel({ groups, total, active, onSelect }: Props) {
  if (groups.length === 0) return null;
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <Repeat className="w-4 h-4 text-violet-400" />
        <h2 className="text-white font-semibold text-lg">Motifs récurrents</h2>
      </div>
      <p className="text-slate-500 text-xs mb-4">Messages identiques (chiffres ignorés). Clic = filtre le journal.</p>
      <div className="space-y-3">
        {groups.map(g => {
          const pct = total > 0 ? (g.count / total) * 100 : 0;
          const isActive = active === g.pattern;
          return (
            <button
              key={g.pattern}
              onClick={() => onSelect(isActive ? null : g.pattern)}
              className={`w-full text-left rounded-lg px-3 py-2 border transition-colors ${isActive ? 'border-violet-500/60 bg-violet-500/10' : 'border-slate-700 bg-slate-900/40 hover:border-slate-500'}`}
              title={g.example}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-slate-200 text-xs font-mono truncate">{g.pattern}</span>
                <span className="text-white font-mono font-bold text-sm flex-shrink-0">
                  {g.count}
                  {g.recent > 0 && <span className="ml-1.5 text-orange-400 text-[10px] font-semibold">+{g.recent} récents</span>}
                </span>
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${COLORS[g.severity]}`} style={{ width: `${Math.max(2, pct)}%` }} />
              </div>
              <p className="text-slate-600 text-[10px] mt-1">{pct.toFixed(0)} % des erreurs</p>
            </button>
          );
        })}
      </div>
    </div>
  );
});
