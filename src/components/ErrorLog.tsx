import { AlertTriangle, AlertCircle, Info, XCircle, ChevronDown, ChevronUp, X } from 'lucide-react';
import { TrameError, ErrorSeverity } from '../types';
import { useState, useMemo, memo } from 'react';
import { fmtTime } from '../utils/cadence';

interface ErrorLogProps {
  errors: TrameError[];
  compact?: boolean; // masque Code et Source quand la place est limitée
}

const SEVERITY_CONFIG: Record<ErrorSeverity, {
  icon: typeof AlertTriangle;
  color: string;
  bg: string;
  border: string;
  label: string;
}> = {
  critical: {
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    label: 'CRITIQUE',
  },
  major: {
    icon: AlertCircle,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    label: 'MAJEURE',
  },
  minor: {
    icon: AlertTriangle,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    label: 'MINEURE',
  },
  warning: {
    icon: Info,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    label: 'WARNING',
  },
};

function ErrorRow({ error, compact = false }: { error: TrameError; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const config = SEVERITY_CONFIG[error.severity];
  const Icon = config.icon;

  return (
    <div
      className={`border-b border-slate-700/50 transition-colors ${
        error.severity === 'critical' ? 'bg-red-500/5' : 'hover:bg-slate-700/30'
      }`}
    >
      <div
        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Severity indicator */}
        <div className={`flex-shrink-0 p-1 rounded ${config.bg}`}>
          <Icon className={`w-4 h-4 ${config.color}`} />
        </div>

        {/* Heure de détection (pas l'heure du log) */}
        <span
          className="text-slate-400 text-xs font-mono w-20 flex-shrink-0"
          title={error.baseline ? "Déjà présente à l'ouverture du fichier" : "Heure à laquelle l'outil a vu cette erreur"}
        >
          {error.baseline ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-400 font-sans">ouverture</span>
          ) : (
            fmtTime(error.detectedAt)
          )}
        </span>

        {/* Severity badge */}
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${config.color} ${config.bg} ${config.border} flex-shrink-0`}
        >
          {config.label}
        </span>

        {/* Error code */}
        {!compact && (
          <span className="text-white font-mono text-sm font-semibold flex-shrink-0 w-28">
            {error.errorCode}
          </span>
        )}

        {/* Description */}
        <span className="text-slate-300 text-sm flex-1 truncate">
          {error.description}
        </span>

        {/* Source */}
        {!compact && (
          <span className="text-slate-500 text-xs font-mono flex-shrink-0">
            {error.source}
          </span>
        )}
        {compact && (
          <span className="text-slate-500 text-xs font-mono flex-shrink-0">
            {error.trameId}
          </span>
        )}

        {/* Expand icon */}
        <div className="flex-shrink-0 text-slate-500">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-3 pt-1 ml-12">
          <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-500">Trame ID</span>
              <p className="text-cyan-300 font-mono mt-0.5">{error.trameId}</p>
            </div>
            <div>
              <span className="text-slate-500">Position champ</span>
              <p className="text-white font-mono mt-0.5">
                {error.fieldPosition !== undefined ? `Octet ${error.fieldPosition}` : '—'}
              </p>
            </div>
            <div>
              <span className="text-slate-500">Valeur attendue</span>
              <p className="text-emerald-400 font-mono mt-0.5">
                {error.expectedValue || '—'}
              </p>
            </div>
            <div>
              <span className="text-slate-500">Valeur reçue</span>
              <p className="text-red-400 font-mono mt-0.5">
                {error.receivedValue || '—'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const MAX_ROWS = 500;

interface ErrorLogProps2 extends ErrorLogProps {
  /** Filtre issu d'un clic sur le graphique : erreurs vues pendant cette fenêtre */
  timeRange?: { start: number; end: number } | null;
  onClearTime?: () => void;
  /** Filtre issu d'un clic sur un motif récurrent */
  pattern?: string | null;
  onClearPattern?: () => void;
}

export const ErrorLog = memo(function ErrorLog({
  errors, compact = false, timeRange = null, onClearTime, pattern = null, onClearPattern,
}: ErrorLogProps2) {
  const [filter, setFilter] = useState<ErrorSeverity | 'all'>('all');
  const [onlyNew, setOnlyNew] = useState(false);

  const filteredErrors = useMemo(() => {
    let list = errors;
    if (filter !== 'all') list = list.filter(e => e.severity === filter);
    if (onlyNew || timeRange) list = list.filter(e => !e.baseline);
    if (timeRange) list = list.filter(e => e.detectedAt >= timeRange.start && e.detectedAt < timeRange.end);
    if (pattern) list = list.filter(e => e.pattern === pattern);
    // Récentes d'abord ; l'historique d'ouverture à la fin
    return [...list].sort((a, b) =>
      Number(a.baseline) - Number(b.baseline) ||
      b.detectedAt - a.detectedAt ||
      (b.fieldPosition ?? 0) - (a.fieldPosition ?? 0));
  }, [errors, filter, onlyNew, timeRange, pattern]);

  const shown = filteredErrors.slice(0, MAX_ROWS);
  const hasBaseline = errors.some(e => e.baseline);

  const filterButtons: { value: ErrorSeverity | 'all'; label: string; color: string }[] = [
    { value: 'all', label: 'Tous', color: 'text-white' },
    { value: 'critical', label: 'Critiques', color: 'text-red-400' },
    { value: 'major', label: 'Majeures', color: 'text-orange-400' },
    { value: 'minor', label: 'Mineures', color: 'text-yellow-400' },
    { value: 'warning', label: 'Warnings', color: 'text-cyan-400' },
  ];

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-white font-semibold text-lg">Journal des erreurs</h2>
          <p className="text-slate-400 text-sm mt-0.5">
            {filteredErrors.length} erreur{filteredErrors.length > 1 ? 's' : ''} affichée{filteredErrors.length > 1 ? 's' : ''}
            {filteredErrors.length > MAX_ROWS && <span className="text-slate-500"> (les {MAX_ROWS} plus récentes)</span>}
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-1">
          {filterButtons.map(({ value, label, color }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                filter === value
                  ? `bg-slate-700 ${color} shadow`
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Filtres actifs (graphique / motif) + historique d'ouverture */}
      {(timeRange || pattern || hasBaseline) && (
        <div className="px-5 py-2 border-b border-slate-700/60 flex items-center gap-2 flex-wrap text-xs">
          {timeRange && (
            <button
              onClick={onClearTime}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25"
            >
              Fenêtre {fmtTime(timeRange.start)} – {fmtTime(timeRange.end)} <X className="w-3 h-3" />
            </button>
          )}
          {pattern && (
            <button
              onClick={onClearPattern}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30 hover:bg-violet-500/25 max-w-full"
            >
              <span className="truncate font-mono">Motif : {pattern}</span> <X className="w-3 h-3 flex-shrink-0" />
            </button>
          )}
          {hasBaseline && !timeRange && (
            <button
              onClick={() => setOnlyNew(v => !v)}
              className={`px-2.5 py-1 rounded-full border ${onlyNew ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-600 hover:text-white'}`}
              title="Masque les erreurs déjà présentes quand le fichier a été ouvert"
            >
              {onlyNew ? 'Nouvelles seulement ✓' : 'Nouvelles seulement'}
            </button>
          )}
        </div>
      )}

      {/* Table header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-slate-900/50 border-b border-slate-700 text-xs text-slate-500 font-medium uppercase tracking-wider">
        <div className="w-6 flex-shrink-0" />
        <div className="w-20 flex-shrink-0" title="Heure à laquelle l'outil a détecté l'erreur (pas l'heure écrite dans le log)">Détectée</div>
        <div className="w-20 flex-shrink-0">Niveau</div>
        {!compact && <div className="w-28 flex-shrink-0">Code</div>}
        <div className="flex-1">Description</div>
        <div className={`${compact ? 'w-14' : 'w-24'} flex-shrink-0 text-right`}>{compact ? 'Ligne' : 'Source'}</div>
        <div className="w-4 flex-shrink-0" />
      </div>

      {/* Error list */}
      <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-track-slate-900 scrollbar-thumb-slate-600">
        {shown.length === 0 ? (
          <div className="px-4 py-12 text-center text-slate-500">
            Aucune erreur à afficher
          </div>
        ) : (
          shown.map((error) => (
            <ErrorRow key={error.id} error={error} compact={compact} />
          ))
        )}
      </div>
    </div>
  );
});
