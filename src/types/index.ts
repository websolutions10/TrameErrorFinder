export type ErrorSeverity = 'critical' | 'major' | 'minor' | 'warning';

export type ChartMode = 'surveillance' | 'fichier';

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
