import {
  FolderOpen, FileText, Play, Pause, RefreshCw, StopCircle,
  AlertTriangle, CheckCircle, Eye, Clock, Info, Download, Trash2,
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
  keywords: string[];
  canExport: boolean;
  onSelectFile: () => void;
  onStopWatching: () => void;
  onTogglePause: () => void;
  onForceRefresh: () => void;
  onExport: () => void;
  onClear: () => void;
}

export function RealFileSelector({
  isWatching, isPaused, fileName, lastModified, lineCount, errorCount,
  fallbackMode, hasNativeAPI, keywords, canExport,
  onSelectFile, onStopWatching, onTogglePause, onForceRefresh, onExport, onClear,
}: Props) {
  const auto = !fallbackMode && hasNativeAPI;

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 h-full flex flex-col gap-3">
      {/* Titre + exports */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2 rounded-lg ${isWatching ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-violet-500/10 border border-violet-500/20'}`}>
            {isWatching ? <Eye className="w-5 h-5 text-emerald-400" /> : <FolderOpen className="w-5 h-5 text-violet-400" />}
          </div>
          <div className="min-w-0">
            <h2 className="text-white font-semibold text-lg leading-tight">
              {isWatching ? 'Surveillance fichier active' : 'Sélectionner un fichier'}
            </h2>
            <p className="text-slate-400 text-sm truncate">
              {isWatching
                ? (keywords.length > 0
                    ? `Détection en temps réel : ${keywords.map(k => `"${k}"`).join(', ')}`
                    : 'Aucun mot-clé surveillé — ajoutez-en un')
                : 'Choisissez le fichier à surveiller'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onExport}
            disabled={!canExport}
            className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Exporter CSV
          </button>
          <button
            onClick={onClear}
            className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            RAZ
          </button>
        </div>
      </div>

      {!isWatching ? (
        <div className="flex-1 flex flex-col items-center justify-center py-2">
          <button onClick={onSelectFile}
            className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-violet-600/30 transition-all hover:scale-105 active:scale-100">
            <FolderOpen className="w-5 h-5" />
            <span>Sélectionner le fichier à surveiller</span>
          </button>
          <p className="text-slate-500 text-xs mt-3">
            Formats : <code className="text-slate-400">.txt</code> <code className="text-slate-400">.log</code> <code className="text-slate-400">.csv</code>
          </p>
        </div>
      ) : (
        <>
          {/* Fichier + état de la surveillance */}
          <div className="flex items-center gap-x-4 gap-y-2 flex-wrap bg-slate-900/50 rounded-lg px-4 py-2.5 border border-slate-700">
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

            {/* État */}
            <div className={`ml-auto flex items-center gap-2 text-sm px-3 py-1 rounded-full border ${
              !auto ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                : isPaused ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
              {auto ? (
                <>
                  <span className={`w-2.5 h-2.5 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
                  {isPaused ? 'En pause' : 'Active — relecture chaque seconde'}
                </>
              ) : (
                <><Info className="w-4 h-4" />Mode manuel — rechargez après chaque modification</>
              )}
            </div>
          </div>

          {/* Boutons de contrôle */}
          <div className="flex items-center gap-3 flex-wrap">
            {auto && (
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
            <span className="text-slate-500 text-xs">
              {fallbackMode ? <>Modifiez <code className="text-violet-400">{fileName}</code> puis rechargez-le</> : <>Les modifications de <code className="text-violet-400">{fileName}</code> sont prises en compte automatiquement</>}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
