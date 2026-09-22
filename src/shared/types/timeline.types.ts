/**
 * Unified Timeline shared types.
 * Cross-module event aggregation for security operations timeline.
 */

export type TimelineEventSource = 
  | 'process'
  | 'network'
  | 'event_log'
  | 'asset'
  | 'dns'
  | 'reputation';

export type TimelineSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface TimelineEvent {
  id: string;
  timestamp: number;
  source: TimelineEventSource;
  severity: TimelineSeverity;
  title: string;
  description: string;
  details: any;
  entityId?: string;      // PID, IP, hostname, etc.
  entityType?: string;    // process, host, connection
  tags: string[];
  isBookmarked?: boolean;
}

export interface TimelineQueryFilter {
  startTime?: number;
  endTime?: number;
  sources?: TimelineEventSource[];
  severities?: TimelineSeverity[];
  searchQuery?: string;
  entityId?: string;
  tags?: string[];
  limit?: number;
}

export interface TimelineStats {
  totalEvents: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  bySource: Record<TimelineEventSource, number>;
  timeRange: { start: number; end: number };
}
