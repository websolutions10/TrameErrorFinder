import { AlertOctagon, TrendingUp, History, X } from 'lucide-react';
import type { AlertState } from '../utils/cadence';
import { fmtDuration } from '../utils/cadence';

interface Props {
  alert: AlertState;
  windowSec: number;
  threshold: number;
  dismissedCatchUp: number | null;
  onDismissCatchUp: (t: number) => void;
}

export function AlertBanner({ alert, windowSec, threshold, dismissedCatchUp, onDismissCatchUp }: Props) {
  const win = fmtDuration(windowSec * 1000);
  const showCatchUp = alert.catchUp && alert.catchUp.t !== dismissedCatchUp;
  const aboveThreshold = !!alert.catchUp && threshold > 0 && alert.catchUp.critMajorPerWindow >= threshold;
  if (alert.level === 'ok' && !showCatchUp) return null;

  return (
    <div className="space-y-2">
      {alert.level === 'alert' && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-red-500/50 bg-red-500/15 text-red-200 animate-pulse">
          <AlertOctagon className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div className="text-sm">
            <strong className="text-red-300">ALERTE</strong> — {Math.round(alert.critMajor)} erreurs critiques/majeures
            sur les {win} écoulées (seuil : {threshold}).
          </div>
        </div>
      )}
      {alert.level === 'accel' && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-orange-500/40 bg-orange-500/10 text-orange-200">
          <TrendingUp className="w-5 h-5 text-orange-400 flex-shrink-0" />
          <div className="text-sm">
            <strong className="text-orange-300">Rythme en hausse</strong> — {Math.round(alert.live)} erreurs sur {win}
            {alert.normal != null && <> contre ≈ {alert.normal.toFixed(1)} en temps normal</>}.
          </div>
        </div>
      )}
      {showCatchUp && alert.catchUp && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${aboveThreshold ? 'border-orange-500/40 bg-orange-500/10 text-orange-100' : 'border-cyan-500/30 bg-cyan-500/5 text-cyan-100'}`}>
          <History className={`w-5 h-5 flex-shrink-0 ${aboveThreshold ? 'text-orange-400' : 'text-cyan-400'}`} />
          <div className="text-sm flex-1">
            <strong className={aboveThreshold ? 'text-orange-300' : 'text-cyan-300'}>Rattrapage</strong> — {alert.catchUp.count} erreurs détectées d'un coup après {fmtDuration(alert.catchUp.dt)} sans relecture
            (≈ {alert.catchUp.perMin.toFixed(1)}/min en moyenne). Leur étalement réel est inconnu : elles sont hachurées sur le graphique.
            {aboveThreshold && <> En moyenne, le rythme critiques/majeures dépassait le seuil pendant cette période (≈ {Math.round(alert.catchUp.critMajorPerWindow)} par {win}).</>}
          </div>
          <button
            onClick={() => onDismissCatchUp(alert.catchUp!.t)}
            className="text-cyan-400 hover:text-white p-1"
            aria-label="Masquer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
