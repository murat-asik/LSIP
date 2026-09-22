/**
 * Reputation Engine shared types.
 * Defines the data structures for local risk scoring and host reputation analysis.
 */

export interface RiskFactor {
  id: string;
  category: 'process' | 'network' | 'event' | 'port' | 'behavioral';
  label: string;
  description: string;
  weight: number;       // 0.0 – 1.0 contribution
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidence: string;     // Raw evidence string
  timestamp: number;
}

export interface HostReputation {
  hostId: string;       // IP address or hostname
  ipAddress?: string;
  hostname?: string;
  riskScore: number;    // 0 – 100
  confidence: number;   // 0.0 – 1.0
  lastCalculated: number;
  factors: RiskFactor[];
  recommendations: string[];
  trend: 'rising' | 'stable' | 'declining';
  scoreHistory: ScoreHistoryEntry[];
}

export interface ScoreHistoryEntry {
  score: number;
  timestamp: number;
  delta: number;
}

export interface ProcessReputation {
  pid: number;
  name: string;
  path: string;
  riskScore: number;
  factors: RiskFactor[];
  isSigned: boolean;
  isElevated: boolean;
  networkConnections: number;
  suspiciousIndicators: string[];
}

export interface ReputationSummary {
  totalHosts: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  averageScore: number;
  lastScanTime: number;
  topThreats: HostReputation[];
}

export interface ReputationQueryFilter {
  minScore?: number;
  maxScore?: number;
  severity?: string;
  searchQuery?: string;
  limit?: number;
}
