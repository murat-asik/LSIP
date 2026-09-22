/**
 * IOC Scanner shared types.
 * Hash, IP, and Domain lookups.
 */

export interface IocMatch {
  id: string;
  indicator: string;
  type: 'hash' | 'ip' | 'domain';
  source: string; // Database table/module where it was found
  timestamp: number;
  context: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface IocScanResult {
  scanId: string;
  startTime: number;
  endTime: number;
  indicatorsSearched: number;
  matchesFound: number;
  matches: IocMatch[];
}
