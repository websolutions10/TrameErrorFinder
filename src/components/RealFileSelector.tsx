import {
  FolderOpen, FileText, Play, Pause, RefreshCw, StopCircle,
  AlertTriangle, CheckCircle, Eye, Clock, Zap, Info,
} from 'lucide-react';

interface Props {
  isWatching: boolean;
  isPaused: boolean;
  fileName: string;
  lastModified: Date | null;
  lineCount: number;
  errorCount: number;
  fallbackMode: boolean;
  hasNativeAPI: boolean;
  onSelectFile: () => void;
  onStopWatching: () => void;
  onTogglePause: () => void;
  onForceRefresh: () => void;
}

export function RealFileSelector({
  isWatching, isPaused, fileName, lastModified, lineCount, errorCount,
  fallbackMode, hasNativeAPI,
  onSelectFile, onStopWatching, onTogglePause, onForceRefresh,
}: Props) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isWatching ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-violet-500/10 border border-violet-500/20'}`}>
            {isWatching ? <Eye className="w-5 h-5 text-emerald-400" /> : <FolderOpen className="w-5 h-5 text-violet-400" />}
          </div>
          <div>
            <h2 className="text-white font-semibold text-lg">
              {isWatching ? '📡 Surveillance fichier active' : '📁 Sélectionner un fichier'}
            </h2>
            <p className="text-slate-400 text-sm">
              {isWatching ? 'Détection en temps réel du mot-clé "errordialogue"' : 'Choisissez le fichier à surveiller'}
            </p>
          </div>
        </div>
      </div>

      <div className="p-5">
        {!isWatching ? (
          <div className="text-center py-8">
            <button onClick={onSelectFile}
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-violet-600/30 transition-all hover:scale-105 active:scale-100">
              <FolderOpen className="w-6 h-6" />
              <span className="text-lg">Sélectionner le fichier à surveiller</span>
            </button>
            <p className="text-slate-500 text-sm mt-4">
              Formats : <code className="text-slate-400">.txt</code> <code className="text-slate-400">.log</code> <code className="text-slate-400">.csv</code>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Info fichier */}
            <div className="flex items-center gap-4 flex-wrap bg-slate-900/50 rounded-lg px-4 py-3 border border-slate-700">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-violet-400" />
                <span className="text-white font-mono font-semibold">{fileName}</span>
              </div>
              <div className="h-4 w-px bg-slate-600" />
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-400">Lignes :</span>
                <span className="text-cyan-400 font-mono font-bold">{lineCount}</span>
              </div>
              <div className="h-4 w-px bg-slate-600" />
              <div className="flex items-center gap-2 text-sm">
                {errorCount > 0 ? (
                  <><AlertTriangle className="w-4 h-4 text-red-400" /><span className="text-red-400 font-bold">{errorCount} erreur{errorCount > 1 ? 's' : ''}</span></>
                ) : (
                  <><CheckCircle className="w-4 h-4 text-emerald-400" /><span className="text-emerald-400">Aucune erreur</span></>
                )}
              </div>
              <div className="h-4 w-px bg-slate-600" />
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="text-slate-400">{lastModified ? lastModified.toLocaleTimeString('fr-FR') : '—'}</span>
              </div>
            </div>

            {/* Statut surveillance */}
            {!fallbackMode && hasNativeAPI ? (
              <div className={`flex items-center justify-center gap-3 py-3 rounded-lg ${isPaused ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-emerald-500/10 border border-emerald-500/30'}`}>
                <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
                <span className={`font-medium ${isPaused ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {isPaused ? '⏸ Surveillance en pause' : '▶ Surveillance active — relecture automatique chaque seconde'}
                </span>
                <Zap className={`w-4 h-4 ${isPaused ? 'text-amber-400' : 'text-emerald-400'}`} />
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3 py-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                <Info className="w-4 h-4 text-cyan-400" />
                <span className="text-cyan-400 font-medium text-sm">
                  Mode manuel — cliquez "Recharger le fichier" après chaque modification
                </span>
              </div>
            )}

            {/* Boutons de contrôle */}
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {!fallbackMode && hasNativeAPI && (
                <button onClick={onTogglePause}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${isPaused ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20' : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/20'}`}>
                  {isPaused ? <><Play className="w-4 h-4" />Reprendre</> : <><Pause className="w-4 h-4" />Pause</>}
                </button>
              )}
              <button onClick={onForceRefresh}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/20 transition-all">
                <RefreshCw className="w-4 h-4" />
                {fallbackMode ? 'Recharger le fichier' : 'Forcer relecture'}
              </button>
              <button onClick={onStopWatching}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 transition-all">
                <StopCircle className="w-4 h-4" />Arrêter
              </button>
            </div>

            <div className="text-center text-slate-500 text-sm">
              💡 Modifiez <code className="text-violet-400">{fileName}</code> puis {fallbackMode ? 'cliquez "Recharger le fichier"' : 'les changements apparaîtront automatiquement'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
