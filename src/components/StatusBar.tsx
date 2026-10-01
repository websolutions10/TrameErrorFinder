import { Activity, FileText, Circle } from 'lucide-react';
import type { ModuleSpyConfig } from '../types';

interface Props {
  config: ModuleSpyConfig;
  isRunning: boolean;
}

export function StatusBar({ config, isRunning }: Props) {
  const loaded = config.connectionStatus === 'connected';
  return (
    <div className="bg-slate-900 border-b border-slate-700 px-6 py-3 flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-400" />
          <span className="text-white font-bold text-lg tracking-wide">SURVEILLANCE ERREURS TRAME</span>
        </div>
        <div className="h-6 w-px bg-slate-600" />
        <span className="text-slate-400 text-sm">{config.moduleName}</span>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-400">Mot-clé :</span>
          <code className="text-cyan-300 font-mono font-semibold bg-cyan-500/10 px-1.5 py-0.5 rounded text-xs">{config.trameId}</code>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <FileText className={`w-4 h-4 ${loaded ? 'text-emerald-400' : 'text-slate-500'}`} />
          <span className={loaded ? 'text-emerald-400' : 'text-slate-500'}>{loaded ? 'Fichier chargé' : 'Aucun fichier'}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Circle className={`w-3 h-3 ${isRunning ? 'text-emerald-400 fill-emerald-400 animate-pulse' : 'text-slate-500 fill-slate-500'}`} />
          <span className={isRunning ? 'text-emerald-400' : 'text-slate-500'}>{isRunning ? 'Active' : 'Manuel'}</span>
        </div>
      </div>
    </div>
  );
}
