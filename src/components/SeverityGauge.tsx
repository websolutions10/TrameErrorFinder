import { useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ErrorStats } from '../types';

interface SeverityGaugeProps {
  stats: ErrorStats;
}

export function SeverityGauge({ stats }: SeverityGaugeProps) {
  const total = stats.totalErrors || 1;
  const segments = [
    { label: 'Critique', count: stats.criticalCount, color: '#ef4444', pct: (stats.criticalCount / total) * 100 },
    { label: 'Majeure', count: stats.majorCount, color: '#f97316', pct: (stats.majorCount / total) * 100 },
    { label: 'Mineure', count: stats.minorCount, color: '#eab308', pct: (stats.minorCount / total) * 100 },
    { label: 'Warning', count: stats.warningCount, color: '#06b6d4', pct: (stats.warningCount / total) * 100 },
  ];

  // Score de santé : gravité pondérée par ligne analysée, convertie en note 0-100.
  // Contrairement à un total brut, il ne s'écrase pas à 0 sur un gros fichier.
  const weighted =
    stats.criticalCount * 10 + stats.majorCount * 3 + stats.minorCount * 1 + stats.warningCount * 0.2;
  const density = stats.tramesAnalyzed > 0 ? weighted / stats.tramesAnalyzed : 0;
  const K = 2; // sensibilité : plus K est grand, plus le score chute vite
  const healthScore = 100 * Math.exp(-K * density);

  // Tendance : on compare le score actuel à celui de quelques relectures plus tôt
  const scoreHistory = useRef<number[]>([]);
  const [trend, setTrend] = useState<'up' | 'down' | 'flat'>('flat');
  useEffect(() => {
    if (stats.tramesAnalyzed === 0) {
      scoreHistory.current = [];
      setTrend('flat');
      return;
    }
    const h = [...scoreHistory.current, healthScore].slice(-6);
    scoreHistory.current = h;
    if (h.length < 3) { setTrend('flat'); return; }
    const diff = h[h.length - 1] - h[0];
    setTrend(diff > 2 ? 'up' : diff < -2 ? 'down' : 'flat');
  }, [stats, healthScore]);

  const healthColor =
    healthScore > 70 ? '#10b981' : healthScore > 40 ? '#f59e0b' : '#ef4444';

  const healthLabel =
    healthScore > 70 ? 'BON' : healthScore > 40 ? 'DÉGRADÉ' : 'CRITIQUE';

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
      <h2 className="text-white font-semibold text-lg mb-4">Analyse des erreurs</h2>

      {/* Health score */}
      <div className="flex items-center justify-center mb-5">
        <div className="relative w-32 h-32">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="#1e293b"
              strokeWidth="10"
            />
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke={healthColor}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${healthScore * 3.14} 314`}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-2xl font-bold font-mono"
              style={{ color: healthColor }}
            >
              {Math.round(healthScore)}
            </span>
            <span
              className="text-[10px] font-bold tracking-wider"
              style={{ color: healthColor }}
            >
              {healthLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Tendance + explication du score */}
      <div className="text-center mb-5 -mt-2">
        <div
          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
            trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-slate-400'
          }`}
        >
          {trend === 'up' ? <TrendingUp className="w-3.5 h-3.5" /> : trend === 'down' ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
          {trend === 'up' ? 'Amélioration' : trend === 'down' ? 'Dégradation' : 'Stable'}
        </div>
        <p className="text-slate-500 text-[10px] mt-1.5 leading-snug">
          Gravité pondérée par ligne analysée<br />
          (critique ×10, majeure ×3, mineure ×1, warning ×0,2)
        </p>
        <p className="text-slate-600 text-[10px] font-mono mt-1">
          densité : {density.toFixed(3)} / ligne
        </p>
      </div>

      {/* Stacked bar */}
      <div className="h-4 rounded-full overflow-hidden flex bg-slate-700 mb-4">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className="h-full transition-all duration-500"
            style={{
              width: `${Math.max(seg.pct, seg.count > 0 ? 2 : 0)}%`,
              backgroundColor: seg.color,
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="space-y-2">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: seg.color }}
              />
              <span className="text-slate-300">{seg.label}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-white font-mono font-semibold">{seg.count}</span>
              <span className="text-slate-500 font-mono text-xs w-14 text-right">
                {seg.pct.toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
