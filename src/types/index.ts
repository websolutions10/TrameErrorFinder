export type ErrorSeverity = 'critical' | 'major' | 'minor' | 'warning';

export type ChartMode = 'surveillance' | 'fichier'; // (hérité, plus utilisé par le graphique)

/** Vues du graphique : courbes « Surveillance » (nouvelles) et « Depuis le fichier » (cumul), barres cadence + cumul, mini-échelles par niveau */
export type ChartView = 'surveillance' | 'fichier' | 'cadence' | 'niveaux';

export interface MonitoringRule {
  keyword: string;
  severity: ErrorSeverity;
}

export interface TrameError {
  id: string;
  timestamp: Date;
  errorCode: string;
  description: string;
  severity: ErrorSeverity;
  trameId: string;
  fieldPosition?: number;
  expectedValue?: string;
  receivedValue?: string;
  source: string;
  /** Instant (ms) où l'outil a vu cette ligne pour la première fois — PAS l'heure du log */
  detectedAt: number;
  /** true = déjà présente à l'ouverture du fichier (historique), pas une nouveauté */
  baseline: boolean;
  /** Message normalisé (chiffres remplacés par #) pour regrouper les récurrences */
  pattern: string;
}

/** Nouvelles erreurs vues lors d'une relecture (hors historique d'ouverture) */
export interface DetectionEvent {
  t: number;
  /** Durée (ms) depuis la relecture précédente */
  dt: number;
  critical: number;
  major: number;
  minor: number;
  warning: number;
  /** Gros paquet vu d'un coup après une pause / une longue absence : étalement réel inconnu */
  catchUp: boolean;
}

export interface PauseSpan {
  start: number;
  end: number | null;
}

export interface TrameErrorCount {
  timestamp: string;
  total: number;
  critical: number;
  major: number;
  minor: number;
  warning: number;
}

export interface ErrorStats {
  totalErrors: number;
  criticalCount: number;
  majorCount: number;
  minorCount: number;
  warningCount: number;
  errorRate: number;
  lastErrorTime: Date | null;
  tramesAnalyzed: number;
  tramesInError: number;
}

export interface ModuleSpyConfig {
  endpoint: string;
  pollingInterval: number;
  trameId: string;
  moduleName: string;
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
}
