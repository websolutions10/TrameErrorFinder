import { AlertTriangle, AlertCircle, Info, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { TrameError, ErrorSeverity } from '../types';
import { useState } from 'react';

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

        {/* Timestamp */}
        <span className="text-slate-400 text-xs font-mono w-20 flex-shrink-0">
          {error.timestamp.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
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

export function ErrorLog({ errors, compact = false }: ErrorLogProps) {
  const [filter, setFilter] = useState<ErrorSeverity | 'all'>('all');

  const filteredErrors =
    filter === 'all'
      ? errors
      : errors.filter((e) => e.severity === filter);

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

      {/* Table header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-slate-900/50 border-b border-slate-700 text-xs text-slate-500 font-medium uppercase tracking-wider">
        <div className="w-6 flex-shrink-0" />
        <div className="w-20 flex-shrink-0">Heure</div>
        <div className="w-20 flex-shrink-0">Niveau</div>
        {!compact && <div className="w-28 flex-shrink-0">Code</div>}
        <div className="flex-1">Description</div>
        <div className={`${compact ? 'w-14' : 'w-24'} flex-shrink-0 text-right`}>{compact ? 'Ligne' : 'Source'}</div>
        <div className="w-4 flex-shrink-0" />
      </div>

      {/* Error list */}
      <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-track-slate-900 scrollbar-thumb-slate-600">
        {filteredErrors.length === 0 ? (
          <div className="px-4 py-12 text-center text-slate-500">
            Aucune erreur à afficher
          </div>
        ) : (
          filteredErrors.map((error) => (
            <ErrorRow key={error.id} error={error} compact={compact} />
          ))
        )}
      </div>
    </div>
  );
}
