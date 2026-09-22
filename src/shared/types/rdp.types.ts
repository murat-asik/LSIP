/**
 * RDP Monitor shared types.
 * RDP session tracking and login event analysis.
 */

export interface RdpSession {
  id: number;
  sessionId: number;
  username: string;
  state: 'Active' | 'Disconnected' | 'Connected' | 'Idle' | 'Listen';
  sourceIp?: string;
  loginTime: number;
  idleTime?: string;
  sessionType: string;
}

export interface RdpLoginEvent {
  id: number;
  timestamp: number;
  eventType: 'success' | 'failed' | 'disconnect' | 'reconnect';
  username: string;
  sourceIp: string;
  sourceHostname?: string;
  eventId: number;
  sessionId?: number;
  reason?: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
}

export interface RdpSummary {
  activeSessions: number;
  totalLoginEvents: number;
  failedAttempts: number;
  uniqueSourceIps: number;
  recentEvents: RdpLoginEvent[];
  sessions: RdpSession[];
}
