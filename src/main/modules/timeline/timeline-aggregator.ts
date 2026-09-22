/**
 * Timeline Aggregator — Cross-module event collection.
 * 
 * Queries process_history, connections, events, and assets databases
 * to build a unified chronological timeline of all security events.
 * Operates entirely offline using local SQLite stores.
 */

import { databaseManager } from '../../core/database-manager';
import { createModuleLogger } from '../../core/logger';
import { TimelineEvent, TimelineSeverity, TimelineEventSource } from '../../../shared/types/timeline.types';

const log = createModuleLogger('timeline-aggregator');

// Well-known critical Windows Event IDs
const CRITICAL_EVENT_IDS: Record<number, { severity: TimelineSeverity; label: string }> = {
  4624: { severity: 'info', label: 'Successful Logon' },
  4625: { severity: 'high', label: 'Failed Logon Attempt' },
  4672: { severity: 'medium', label: 'Special Privileges Assigned' },
  4688: { severity: 'info', label: 'Process Created' },
  4689: { severity: 'info', label: 'Process Terminated' },
  4720: { severity: 'high', label: 'User Account Created' },
  4728: { severity: 'medium', label: 'Member Added to Security Group' },
  1102: { severity: 'critical', label: 'Audit Log Cleared' },
  7045: { severity: 'high', label: 'New Service Installed' },
  1: { severity: 'info', label: 'Sysmon Process Create' },
  3: { severity: 'low', label: 'Sysmon Network Connection' },
  11: { severity: 'low', label: 'Sysmon File Create' },
};

export class TimelineAggregator {
  /**
   * Build a unified timeline from all local databases.
   */
  public static async buildTimeline(
    startTime: number,
    endTime: number,
    limit: number = 500,
    sources?: TimelineEventSource[],
    severities?: TimelineSeverity[],
    searchQuery?: string
  ): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];

    const shouldInclude = (src: TimelineEventSource) => {
      if (!sources || sources.length === 0) return true;
      return sources.includes(src);
    };

    try {
      // 1. Process History Events
      if (shouldInclude('process')) {
        const processEvents = await this.getProcessTimelineEvents(startTime, endTime);
        events.push(...processEvents);
      }

      // 2. Windows Event Log Events
      if (shouldInclude('event_log')) {
        const logEvents = await this.getEventLogTimelineEvents(startTime, endTime);
        events.push(...logEvents);
      }

      // 3. Network Connection Events
      if (shouldInclude('network')) {
        const networkEvents = await this.getNetworkTimelineEvents(startTime, endTime);
        events.push(...networkEvents);
      }

      // 4. Asset Discovery Events
      if (shouldInclude('asset')) {
        const assetEvents = await this.getAssetTimelineEvents(startTime, endTime);
        events.push(...assetEvents);
      }

      // 5. DNS Query Events
      if (shouldInclude('dns')) {
        const dnsEvents = await this.getDnsTimelineEvents(startTime, endTime);
        events.push(...dnsEvents);
      }
    } catch (err: any) {
      log.error('Timeline aggregation error', { error: err.message });
    }

    // Apply severity filter
    let filtered = events;
    if (severities && severities.length > 0) {
      filtered = filtered.filter(e => severities.includes(e.severity));
    }

    // Apply search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        (e.entityId && e.entityId.toLowerCase().includes(q)) ||
        e.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    // Sort by timestamp descending and limit
    filtered.sort((a, b) => b.timestamp - a.timestamp);
    return filtered.slice(0, limit);
  }

  // ── Process Events ───────────────────────────────────────────

  private static async getProcessTimelineEvents(startTime: number, endTime: number): Promise<TimelineEvent[]> {
    try {
      const rows = await databaseManager.queryAll<any>(
        'process',
        `SELECT * FROM process_history WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp DESC LIMIT 200`,
        [startTime, endTime]
      );

      return rows.map((r: any) => ({
        id: `proc-${r.id}`,
        timestamp: r.timestamp,
        source: 'process' as TimelineEventSource,
        severity: r.action === 'start' ? 'info' as TimelineSeverity : 'low' as TimelineSeverity,
        title: `Process ${r.action === 'start' ? 'Started' : 'Stopped'}: ${r.name}`,
        description: `PID ${r.pid}${r.user ? ` (${r.user})` : ''}${r.command_line ? ` — ${r.command_line.substring(0, 120)}` : ''}`,
        details: {
          pid: r.pid,
          ppid: r.ppid,
          name: r.name,
          action: r.action,
          user: r.user,
          commandLine: r.command_line,
        },
        entityId: r.pid.toString(),
        entityType: 'process',
        tags: ['process', r.action],
      }));
    } catch (err: any) {
      log.error('Failed to get process timeline events', { error: err.message });
      return [];
    }
  }

  // ── Event Log Events ─────────────────────────────────────────

  private static async getEventLogTimelineEvents(startTime: number, endTime: number): Promise<TimelineEvent[]> {
    try {
      const rows = await databaseManager.queryAll<any>(
        'events',
        `SELECT * FROM events WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp DESC LIMIT 200`,
        [startTime, endTime]
      );

      return rows.map((r: any) => {
        const knownEvent = CRITICAL_EVENT_IDS[r.event_id];
        const severity: TimelineSeverity = knownEvent?.severity || (r.level <= 2 ? 'high' : r.level === 3 ? 'medium' : 'info');
        const label = knownEvent?.label || `Event ${r.event_id}`;

        return {
          id: `evt-${r.id}`,
          timestamp: r.timestamp,
          source: 'event_log' as TimelineEventSource,
          severity,
          title: `[${r.source}] ${label} (ID: ${r.event_id})`,
          description: (r.message || '').substring(0, 200),
          details: {
            eventId: r.event_id,
            source: r.source,
            level: r.level,
            computer: r.computer,
            userName: r.user_name,
            userSid: r.user_sid,
          },
          entityId: r.computer,
          entityType: 'host',
          tags: ['event', r.source, `eid-${r.event_id}`],
          isBookmarked: r.is_bookmarked === 1,
        };
      });
    } catch (err: any) {
      log.error('Failed to get event log timeline events', { error: err.message });
      return [];
    }
  }

  // ── Network Events ───────────────────────────────────────────

  private static async getNetworkTimelineEvents(startTime: number, endTime: number): Promise<TimelineEvent[]> {
    try {
      const rows = await databaseManager.queryAll<any>(
        'network',
        `SELECT * FROM connections WHERE first_seen BETWEEN ? AND ? ORDER BY first_seen DESC LIMIT 200`,
        [startTime, endTime]
      );

      return rows.map((r: any) => ({
        id: `net-${r.id}`,
        timestamp: r.first_seen,
        source: 'network' as TimelineEventSource,
        severity: 'info' as TimelineSeverity,
        title: `New Connection: ${r.process_name || 'Unknown'} → ${r.remote_address}:${r.remote_port}`,
        description: `${r.protocol} ${r.local_address}:${r.local_port} → ${r.remote_address}:${r.remote_port} (${r.state || 'N/A'})`,
        details: {
          protocol: r.protocol,
          localAddress: r.local_address,
          localPort: r.local_port,
          remoteAddress: r.remote_address,
          remotePort: r.remote_port,
          state: r.state,
          pid: r.pid,
          processName: r.process_name,
        },
        entityId: r.remote_address,
        entityType: 'connection',
        tags: ['network', r.protocol, r.process_name || 'unknown'],
      }));
    } catch (err: any) {
      log.error('Failed to get network timeline events', { error: err.message });
      return [];
    }
  }

  // ── Asset Discovery Events ───────────────────────────────────

  private static async getAssetTimelineEvents(startTime: number, endTime: number): Promise<TimelineEvent[]> {
    try {
      const rows = await databaseManager.queryAll<any>(
        'assets',
        `SELECT * FROM assets WHERE first_seen BETWEEN ? AND ? ORDER BY first_seen DESC LIMIT 100`,
        [startTime, endTime]
      );

      return rows.map((r: any) => ({
        id: `asset-${r.id}`,
        timestamp: r.first_seen,
        source: 'asset' as TimelineEventSource,
        severity: 'low' as TimelineSeverity,
        title: `Asset Discovered: ${r.hostname || r.ip_address}`,
        description: `IP: ${r.ip_address}, MAC: ${r.mac_address || 'N/A'}, Vendor: ${r.vendor || 'Unknown'}${r.os_guess ? `, OS: ${r.os_guess}` : ''}`,
        details: {
          ip: r.ip_address,
          mac: r.mac_address,
          hostname: r.hostname,
          vendor: r.vendor,
          os: r.os_guess,
          riskScore: r.risk_score,
        },
        entityId: r.ip_address,
        entityType: 'host',
        tags: ['asset', 'discovery', r.vendor || 'unknown-vendor'],
      }));
    } catch (err: any) {
      log.error('Failed to get asset timeline events', { error: err.message });
      return [];
    }
  }

  // ── DNS Events ───────────────────────────────────────────────

  private static async getDnsTimelineEvents(startTime: number, endTime: number): Promise<TimelineEvent[]> {
    try {
      const rows = await databaseManager.queryAll<any>(
        'network',
        `SELECT * FROM dns_queries WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp DESC LIMIT 200`,
        [startTime, endTime]
      );

      return rows.map((r: any) => ({
        id: `dns-${r.id}`,
        timestamp: r.timestamp,
        source: 'dns' as TimelineEventSource,
        severity: r.is_rare ? 'medium' as TimelineSeverity : 'info' as TimelineSeverity,
        title: `DNS Query: ${r.query_name} (${r.query_type || 'A'})`,
        description: `Resolved: ${r.response || 'N/A'}, Process: ${r.process_name || 'Unknown'}`,
        details: {
          queryName: r.query_name,
          queryType: r.query_type,
          response: r.response,
          pid: r.pid,
          processName: r.process_name,
          isRare: r.is_rare === 1,
        },
        entityId: r.query_name,
        entityType: 'domain',
        tags: ['dns', r.query_type || 'A', r.is_rare === 1 ? 'rare' : 'normal'],
      }));
    } catch (err: any) {
      log.error('Failed to get DNS timeline events', { error: err.message });
      return [];
    }
  }
}
