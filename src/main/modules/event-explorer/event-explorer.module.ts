import { eventIdentity } from '../../core/event-identity';
import { integer } from '../../core/security';
import { BaseModule } from '../base-module';
import { eventChannels, readEventPage, EventCursor } from './event-pages';
import { SecurityEvent, EventQueryFilter } from '../../../shared/types/event.types';
import { databaseManager } from '../../core/database-manager';
import { configManager } from '../../core/config-manager';

export class EventExplorerModule extends BaseModule {
  public readonly name = 'events';
  public readonly displayName = 'Event Explorer';
  private syncTimer: NodeJS.Timeout | null = null;
  private syncing: Promise<void> | null = null;
  private channelStatus: Record<string, { warning?: string; error?: string; more?: boolean; checkedAt: number }> = {};

  public async initialize(): Promise<void> {
    this.logger.info('Initializing Event Explorer Module...');
    await databaseManager.queryExec('events', 'CREATE TABLE IF NOT EXISTS event_cursors(channel TEXT PRIMARY KEY, record_id TEXT NOT NULL, timestamp TEXT NOT NULL)');
    this.registerIpcHandler('health', async () => this.channelStatus);

    // 1. Fetch filtered events from local SQLite database
    this.registerIpcHandler<EventQueryFilter, SecurityEvent[]>('query', async (filter) => {
      return this.queryEventsFromDb(filter);
    });

    // 2. Bookmark an event
    this.registerIpcHandler<{ id: number; bookmarked: boolean }, boolean>('bookmark', async (payload) => {
      const { id, bookmarked } = payload;
      await databaseManager.queryRun(
        'events',
        'UPDATE events SET is_bookmarked = ? WHERE id = ?',
        [bookmarked ? 1 : 0, id]
      );
      
      // Sync to config bookmarks table
      if (bookmarked) {
        await databaseManager.queryRun(
          'config',
          'INSERT INTO bookmarks (id, type, target_id, created_at) VALUES (?, "event", ?, ?) ON CONFLICT DO NOTHING',
          [`event_${id}`, id.toString(), Date.now()]
        );
      } else {
        await databaseManager.queryRun(
          'config',
          'DELETE FROM bookmarks WHERE id = ?',
          [`event_${id}`]
        );
      }
      return true;
    });

    // 3. Trigger manual events synchronization
    this.registerIpcHandler<void, boolean>('sync', async () => {
      await this.syncEvents();
      return true;
    });

    // 4. Start automatic background log synchronization loop
    const uiConfig = configManager.get();
    const interval = Math.max(uiConfig.ui.refreshIntervalMs * 4, 10000); // minimum 10 seconds
    
    // Initial sync
    this.syncEvents().catch((err) => {
      this.logger.error('Failed initial events sync', { error: err.message });
    });
    
    this.syncTimer = this.registerInterval(interval, () => {
      this.syncEvents().catch((err) => {
        this.logger.error('Failed events background sync', { error: err.message });
      });
    });

    this.logger.info('Event Explorer Module initialized.');
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down Event Explorer Module...');
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    this.unregisterIpcHandlers();
    await this.syncing?.catch(() => undefined);
  }

  /**
   * Reads new event logs from Windows APIs and saves to SQLite.
   */
  private syncEvents(): Promise<void> {
    if (this.syncing) return this.syncing;
    this.syncing = this.syncPages().finally(() => { this.syncing = null; });
    return this.syncing;
  }

  private async syncPages(): Promise<void> {
    let successful = 0;
    for (const channel of eventChannels) {
      try {
        let cursor = await databaseManager.queryGet<EventCursor>('events', 'SELECT record_id,timestamp FROM event_cursors WHERE channel=?', [channel]);
        // Fair bounded slices: backlog continues from the persisted cursor on the next tick.
        for (let slice = 0; slice < 4; slice++) {
          const page = await readEventPage(channel, cursor);
          const statements = page.events.map(e => ({
            sql: `INSERT OR IGNORE INTO events (event_id, source, level, timestamp, computer, user_sid, user_name, message, xml_data, parsed_data, event_key, is_bookmarked)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            params: [e.eventId,e.source,e.level,e.timestamp,e.computer,e.userSid || null,e.userName || null,e.message,e.xmlData || null,JSON.stringify(e.parsedData || {}),eventIdentity(e.computer,e.source,e.recordId,e.timestamp,e.eventId,e.message)],
          }));
          statements.push({sql:'INSERT INTO event_cursors(channel,record_id,timestamp) VALUES(?,?,?) ON CONFLICT(channel) DO UPDATE SET record_id=excluded.record_id,timestamp=excluded.timestamp',params:[channel,page.cursor.record_id,page.cursor.timestamp]});
          await databaseManager.atomicBatch('events', statements);
          this.channelStatus[channel] = { warning: page.warning || this.channelStatus[channel]?.warning, more: page.more, checkedAt: Date.now() };
          cursor = page.cursor;
          if (!page.more) break;
        }
        successful++;
      } catch (error: any) {
        this.channelStatus[channel] = { error: error.message, checkedAt: Date.now() };
        this.logger.warn('Event channel unavailable', { channel, error: error.message });
      }
    }
    if (!successful) throw new Error('No event channel could be collected');
    await this.rotateDatabase();
  }

  /**
   * Filters and retrieves logs from events.db
   */
  private async queryEventsFromDb(filter: EventQueryFilter): Promise<SecurityEvent[]> {
    let sql = 'SELECT * FROM events WHERE 1=1';
    const params: any[] = [];

    if (filter.eventId !== undefined) {
      sql += ' AND event_id = ?';
      params.push(filter.eventId);
    }

    if (filter.source) {
      sql += ' AND source = ?';
      params.push(filter.source);
    }

    if (filter.level !== undefined) {
      sql += ' AND level = ?';
      params.push(filter.level);
    }

    if (filter.startTime) {
      sql += ' AND timestamp >= ?';
      params.push(filter.startTime);
    }

    if (filter.endTime) {
      sql += ' AND timestamp <= ?';
      params.push(filter.endTime);
    }

    if (filter.isBookmarked !== undefined) {
      sql += ' AND is_bookmarked = ?';
      params.push(filter.isBookmarked ? 1 : 0);
    }

    if (filter.searchQuery) {
      sql += ' AND (message LIKE ? OR user_name LIKE ? OR computer LIKE ?)';
      const likeStr = `%${filter.searchQuery}%`;
      params.push(likeStr, likeStr, likeStr);
    }

    // Default sorting by timestamp descending
    sql += ' ORDER BY timestamp DESC';

    const limit = integer(filter.limit ?? 500, 'Kayıt sınırı', 5000);
    sql += ' LIMIT ?';
    params.push(limit);

    try {
      const rows = await databaseManager.queryAll<any>('events', sql, params);
      return rows.map((r) => ({
        id: r.id,
        eventId: r.event_id,
        source: r.source,
        level: r.level,
        timestamp: r.timestamp,
        computer: r.computer,
        userSid: r.user_sid || undefined,
        userName: r.user_name || undefined,
        message: r.message,
        xmlData: r.xml_data || undefined,
        parsedData: r.parsed_data ? JSON.parse(r.parsed_data) : undefined,
        isBookmarked: r.is_bookmarked === 1,
      }));
    } catch (err: any) {
      this.logger.error('Failed to query events table from database', { error: err.message });
      return [];
    }
  }

  /**
   * Truncate older rows if database exceeds limit
   */
  private async rotateDatabase() {
    try {
      const conf = configManager.get();
      const countRow = await databaseManager.queryGet<{ total: number }>(
        'events',
        'SELECT COUNT(*) as total FROM events'
      );
      
      const total = countRow?.total || 0;
      if (total > conf.database.maxEventRows) {
        const excess = total - conf.database.maxEventRows;
        this.logger.warn(`Events database exceeds size limit (${total}/${conf.database.maxEventRows} rows). Truncating oldest ${excess} entries.`);
        
        // Find threshold timestamp of the oldest record we want to keep
        const thresholdRow = await databaseManager.queryGet<{ ts: number }>(
          'events',
          `SELECT timestamp FROM events ORDER BY timestamp ASC LIMIT 1 OFFSET ?`,
          [excess]
        );

        if (thresholdRow) {
          await databaseManager.queryRun(
            'events',
            'DELETE FROM events WHERE timestamp < ? AND is_bookmarked = 0',
            [thresholdRow.ts]
          );
        }
      }
    } catch (err: any) {
      this.logger.error('Database rotation cleanup failed', { error: err.message });
    }
  }
}
export default EventExplorerModule;
