/**
 * SMB Intelligence shared types.
 * SMB share enumeration, session tracking, and access monitoring.
 */

export interface SmbShare {
  name: string;
  path: string;
  description: string;
  shareType: 'disk' | 'print' | 'ipc' | 'special';
  permissions: string[];
  currentUsers: number;
  maxUsers: number;
  isHidden: boolean;
}

export interface SmbSession {
  id: number;
  username: string;
  computerName: string;
  clientIp: string;
  connectedTime: number;     // seconds
  idleTime: number;          // seconds
  openFiles: number;
  timestamp: number;
}

export interface SmbAccessEvent {
  id: number;
  timestamp: number;
  eventType: 'connect' | 'disconnect' | 'access' | 'denied';
  username: string;
  sourceIp: string;
  shareName: string;
  filePath?: string;
  severity: 'info' | 'low' | 'medium' | 'high';
}

export interface SmbSummary {
  totalShares: number;
  hiddenShares: number;
  activeSessions: number;
  recentAccessEvents: SmbAccessEvent[];
  shares: SmbShare[];
}
