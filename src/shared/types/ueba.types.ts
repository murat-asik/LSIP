/**
 * Behavior Analytics (UEBA) shared types.
 * User and Entity Behavior Analytics anomalies.
 */

export interface UebaAnomaly {
  id: string;
  timestamp: number;
  entityType: 'user' | 'process' | 'host';
  entityName: string;
  anomalyType: 'login_spike' | 'port_scan' | 'high_cpu' | 'data_transfer' | 'lateral_movement' | 'mitre_t1059' | 'mitre_t1055';
  description: string;
  score: number; // 0-100
  confidence: number; // 0-100
}

export interface UebaSummary {
  activeAnomalies: number;
  criticalEntities: number;
  anomalies: UebaAnomaly[];
}
