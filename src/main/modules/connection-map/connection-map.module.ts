import { BaseModule } from '../base-module';
import { ConnectionTracker } from './connection-tracker';
import { ActiveConnection } from '../../../shared/types/network.types';
import { databaseManager } from '../../core/database-manager';

export class ConnectionMapModule extends BaseModule {
  public readonly name = 'connection';
  public readonly displayName = 'Connection Map';
  private syncTimer: NodeJS.Timeout | null = null;

  public async initialize(): Promise<void> {
    this.logger.info('Initializing Connection Map Module...');

    // 1. Get active connections
    this.registerIpcHandler<void, ActiveConnection[]>('active', async () => {
      const activeConns = await ConnectionTracker.getActiveConnections();
      
      // Sync in background to events network DB
      this.syncActiveConnections(activeConns).catch((err) => {
        this.logger.error('Failed active connections sync', { error: err.message });
      });

      return activeConns;
    });

    this.logger.info('Connection Map Module initialized.');
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down Connection Map Module...');
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    this.unregisterIpcHandlers();
  }

  /**
   * Sync active connections to database history
   */
  private async syncActiveConnections(connections: ActiveConnection[]) {
    const now = Date.now();
    try {
      for (const conn of connections) {
        // Ignore loopback connections for statistics
        if (
          conn.remoteAddress === '127.0.0.1' ||
          conn.remoteAddress === '0.0.0.0' ||
          conn.remoteAddress === '::1' ||
          conn.remoteAddress === '*'
        ) {
          continue;
        }

        // Check if connection exists in history
        const existing = await databaseManager.queryGet<any>(
          'network',
          `SELECT id, first_seen FROM connections 
           WHERE local_address = ? AND local_port = ? AND remote_address = ? AND remote_port = ? AND protocol = ?`,
          [conn.localAddress, conn.localPort, conn.remoteAddress, conn.remotePort, conn.protocol]
        );

        if (existing) {
          // Update last seen
          await databaseManager.queryRun(
            'network',
            'UPDATE connections SET last_seen = ?, pid = ?, process_name = ? WHERE id = ?',
            [now, conn.pid, conn.processName || 'Unknown', existing.id]
          );
        } else {
          // Insert new record
          await databaseManager.queryRun(
            'network',
            `INSERT INTO connections (local_address, local_port, remote_address, remote_port, protocol, state, pid, process_name, first_seen, last_seen)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              conn.localAddress,
              conn.localPort,
              conn.remoteAddress,
              conn.remotePort,
              conn.protocol,
              conn.state || null,
              conn.pid,
              conn.processName || 'Unknown',
              now,
              now,
            ]
          );
        }
      }
    } catch (err: any) {
      this.logger.error('Failed to sync network connections table to database', { error: err.message });
    }
  }
}
export default ConnectionMapModule;
