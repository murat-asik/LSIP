import { BaseModule } from '../base-module';
import { TimelineAggregator } from './timeline-aggregator';
import { TimelineEvent, TimelineQueryFilter, TimelineStats } from '../../../shared/types/timeline.types';
import { databaseManager } from '../../core/database-manager';

export class TimelineModule extends BaseModule {
  public readonly name = 'timeline';
  public readonly displayName = 'Unified Timeline';

  public async initialize(): Promise<void> {
    this.logger.info('Initializing Unified Timeline Module...');

    // 1. Query timeline events with filter
    this.registerIpcHandler<TimelineQueryFilter, TimelineEvent[]>('query', async (filter) => {
      const now = Date.now();
      const startTime = filter.startTime || (now - 86400000); // Default 24h
      const endTime = filter.endTime || now;
      const limit = filter.limit || 500;

      return TimelineAggregator.buildTimeline(
        startTime,
        endTime,
        limit,
        filter.sources,
        filter.severities,
        filter.searchQuery
      );
    });

    // 2. Get timeline statistics
    this.registerIpcHandler<TimelineQueryFilter, TimelineStats>('stats', async (filter) => {
      return this.getTimelineStats(filter);
    });

    // 3. Bookmark a timeline event
    this.registerIpcHandler<{ eventId: string; bookmarked: boolean }, boolean>('bookmark', async (payload) => {
      try {
        if (payload.bookmarked) {
          await databaseManager.queryRun(
            'config',
            'INSERT INTO bookmarks (id, type, target_id, created_at) VALUES (?, "timeline", ?, ?) ON CONFLICT DO NOTHING',
            [`timeline_${payload.eventId}`, payload.eventId, Date.now()]
          );
        } else {
          await databaseManager.queryRun(
            'config',
            'DELETE FROM bookmarks WHERE id = ?',
            [`timeline_${payload.eventId}`]
          );
        }
        return true;
      } catch (err: any) {
        this.logger.error('Failed to bookmark timeline event', { error: err.message });
        return false;
      }
    });

    this.logger.info('Unified Timeline Module initialized.');
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down Unified Timeline Module...');
    this.unregisterIpcHandlers();
  }

  private async getTimelineStats(filter: TimelineQueryFilter): Promise<TimelineStats> {
    const now = Date.now();
    const startTime = filter.startTime || (now - 86400000);
    const endTime = filter.endTime || now;

    // Fetch all events for stats calculation
    const events = await TimelineAggregator.buildTimeline(startTime, endTime, 2000);

    const stats: TimelineStats = {
      totalEvents: events.length,
      criticalCount: events.filter(e => e.severity === 'critical').length,
      highCount: events.filter(e => e.severity === 'high').length,
      mediumCount: events.filter(e => e.severity === 'medium').length,
      lowCount: events.filter(e => e.severity === 'low').length,
      infoCount: events.filter(e => e.severity === 'info').length,
      bySource: {
        process: events.filter(e => e.source === 'process').length,
        network: events.filter(e => e.source === 'network').length,
        event_log: events.filter(e => e.source === 'event_log').length,
        asset: events.filter(e => e.source === 'asset').length,
        dns: events.filter(e => e.source === 'dns').length,
        reputation: events.filter(e => e.source === 'reputation').length,
      },
      timeRange: {
        start: events.length > 0 ? events[events.length - 1].timestamp : startTime,
        end: events.length > 0 ? events[0].timestamp : endTime,
      },
    };

    return stats;
  }
}
export default TimelineModule;
