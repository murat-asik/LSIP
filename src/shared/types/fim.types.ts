/**
 * File Integrity Monitoring (FIM) shared types.
 * Hash-based file change detection for critical system paths.
 */

export interface FimEntry {
  id: number;
  filePath: string;
  fileName: string;
  directory: string;
  hashSha256: string;
  previousHash?: string;
  fileSize: number;
  lastModified: number;
  lastChecked: number;
  status: 'unchanged' | 'modified' | 'new' | 'deleted' | 'error';
  owner?: string;
  permissions?: string;
}

export interface FimChangeEvent {
  id: number;
  timestamp: number;
  filePath: string;
  changeType: 'created' | 'modified' | 'deleted' | 'permission_change';
  previousHash?: string;
  currentHash?: string;
  previousSize?: number;
  currentSize?: number;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
}

export interface FimWatchPath {
  path: string;
  recursive: boolean;
  patterns: string[];   // e.g. ['*.exe', '*.dll', '*.sys']
  label: string;
}

export interface FimSummary {
  limitedPaths?: string[];
  lastScanAt?: number;
  lastError?: string;
  monitoredFiles: number;
  totalChanges: number;
  criticalChanges: number;
  watchPaths: FimWatchPath[];
  recentChanges: FimChangeEvent[];
}
