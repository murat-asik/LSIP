/**
 * DNS Intelligence shared types.
 * Local DNS cache and query analysis for security monitoring.
 */

export interface DnsQueryRecord {
  id: number;
  timestamp: number;
  queryName: string;
  queryType: string;     // A, AAAA, CNAME, MX, TXT, PTR, SRV, etc.
  response: string;
  ttl?: number;
  sourceIp?: string;
  pid?: number;
  processName?: string;
  isRare: boolean;
  riskLevel: 'safe' | 'suspicious' | 'malicious';
  tags: string[];
}

export interface DnsDomainStats {
  domain: string;
  queryCount: number;
  uniqueSubdomains: number;
  firstSeen: number;
  lastSeen: number;
  recordTypes: string[];
  resolvedIps: string[];
  associatedProcesses: string[];
  riskLevel: 'safe' | 'suspicious' | 'malicious';
  anomalyFlags: string[];
}

export interface DnsAnomalyRule {
  id: string;
  name: string;
  description: string;
  check: string;  // Rule type: 'long_domain', 'high_entropy', 'rare_tld', 'rapid_queries', 'dga_pattern'
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface DnsSummary {
  totalQueries: number;
  uniqueDomains: number;
  suspiciousCount: number;
  topDomains: { domain: string; count: number }[];
  recentQueries: DnsQueryRecord[];
  anomaliesDetected: number;
}

export interface DnsQueryFilter {
  searchQuery?: string;
  riskLevel?: string;
  queryType?: string;
  startTime?: number;
  endTime?: number;
  processName?: string;
  limit?: number;
}
