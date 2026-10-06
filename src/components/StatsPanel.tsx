import {
  AlertTriangle,
  XCircle,
  AlertCircle,
  Info,
  Zap,
  Clock,
  BarChart3,
  Shield,
} from 'lucide-react';
import { ErrorStats } from '../types';
import { CounterCard } from './CounterCard';

interface StatsPanelProps {
  stats: ErrorStats;
  /** Nouvelles erreurs (critiques+majeures) sur la fenêtre glissante, et seuil d'alerte associé */
  windowCount?: number;
  threshold?: number;
  windowLabel?: string;
}

export function StatsPanel({ stats, windowCount = 0, threshold = 0, windowLabel = '' }: StatsPanelProps) {
  const errorPct = stats.tramesAnalyzed > 0 ? (stats.tramesInError / stats.tramesAnalyzed) * 100 : 0;
  const errorPercentage = errorPct.toFixed(2);
  // Largeur = vraie proportion de lignes en erreur (33 % → un tiers de la barre), mini 2 % pour rester visible
  const pctWidth = errorPct > 0 ? Math.max(2, Math.min(100, errorPct)) : 0;
  // Nouvelles erreurs : barre pleine = seuil d'alerte atteint
  const newRatio = threshold > 0 ? Math.min(1, windowCount / threshold) : 0;

  return (
    <div className="space-y-4">
      {/* Compteur principal */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
        <h2 className="text-white font-semibold text-lg mb-1">Compteurs</h2>
        <p className="text-slate-400 text-sm mb-4">Vue en temps réel</p>

        <div className="space-y-3">
          <CounterCard
            label="Total erreurs"
            value={stats.totalErrors}
            icon={BarChart3}
            color="text-white"
            bgColor="bg-slate-700/50"
            borderColor="border-slate-600"
            animate={stats.totalErrors > 0}
          />
          <CounterCard
            label="Critiques"
            value={stats.criticalCount}
            icon={XCircle}
            color="text-red-400"
            bgColor="bg-red-500/5"
            borderColor="border-red-500/20"
            subtitle="Arrêt immédiat requis"
            animate={stats.criticalCount > 0}
          />
          <CounterCard
            label="Majeures"
            value={stats.majorCount}
            icon={AlertCircle}
            color="text-orange-400"
            bgColor="bg-orange-500/5"
            borderColor="border-orange-500/20"
            subtitle="Intervention nécessaire"
          />
          <CounterCard
            label="Mineures"
            value={stats.minorCount}
            icon={AlertTriangle}
            color="text-yellow-400"
            bgColor="bg-yellow-500/5"
            borderColor="border-yellow-500/20"
            subtitle="À surveiller"
          />
          <CounterCard
            label="Warnings"
            value={stats.warningCount}
            icon={Info}
            color="text-cyan-400"
            bgColor="bg-cyan-500/5"
            borderColor="border-cyan-500/20"
            subtitle="Information"
          />
        </div>
      </div>

      {/* Indicateurs techniques */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
        <h2 className="text-white font-semibold text-lg mb-4">Indicateurs</h2>

        <div className="space-y-4">
          {/* Taux d'erreur */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-slate-300 text-sm">Nouvelles erreurs{windowLabel ? ` (${windowLabel})` : ''}</span>
              </div>
              <span className="text-white font-mono font-bold">
                {Math.round(windowCount)}{threshold > 0 && <span className="text-slate-500 text-xs font-normal"> / {threshold}</span>}
              </span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  newRatio >= 1 ? 'bg-red-500' : newRatio >= 0.6 ? 'bg-orange-500' : newRatio > 0 ? 'bg-yellow-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${newRatio * 100}%` }}
              />
            </div>
            <p className="text-slate-600 text-[10px] mt-1">Barre pleine = seuil d'alerte (critiques + majeures)</p>
          </div>

          {/* Taux d'erreur sur trames */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-violet-400" />
                <span className="text-slate-300 text-sm">Taux d'erreur</span>
              </div>
              <span className="text-white font-mono font-bold">{errorPercentage}%</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  parseFloat(errorPercentage) > 10
                    ? 'bg-red-500'
                    : parseFloat(errorPercentage) > 5
                    ? 'bg-orange-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${pctWidth}%` }}
              />
            </div>
            <p className="text-slate-600 text-[10px] mt-1">Part des lignes du fichier en erreur (barre pleine = 100 %)</p>
          </div>

          {/* Stats numériques */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
              <div className="flex items-center gap-1.5 mb-1">
                <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500 text-[10px] uppercase tracking-wider">Lignes analysées</span>
              </div>
              <p className="text-white font-mono text-lg font-bold">
                {stats.tramesAnalyzed.toLocaleString('fr-FR')}
              </p>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500 text-[10px] uppercase tracking-wider">Dernière erreur</span>
              </div>
              <p className="text-white font-mono text-sm font-bold">
                {stats.lastErrorTime
                  ? stats.lastErrorTime.toLocaleTimeString('fr-FR')
                  : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
