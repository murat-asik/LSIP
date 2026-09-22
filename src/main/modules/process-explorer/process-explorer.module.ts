import { integer } from '../../core/security';
import path from 'path';
import { BaseModule } from '../base-module';
import { ProcessCollector } from './process-collector';
import { ProcessInfo, ThreadInfo, ModuleInfo } from '../../../shared/types/process.types';
import { databaseManager } from '../../core/database-manager';

export class ProcessExplorerModule extends BaseModule {
  public readonly name = 'process';
  public readonly displayName = 'Process Explorer';
  private pollingTimer: NodeJS.Timeout | null = null;
  // Backpressure guard — prevents concurrent DB sync operations from stacking
  private isSyncingToDb = false;

  public async initialize(): Promise<void> {
    this.logger.info('Initializing Process Explorer Module...');

    // 1. Register IPC handlers for renderer
    this.registerIpcHandler<void, ProcessInfo[]>('list', async () => {
      const snapshot = await ProcessCollector.getProcessSnapshot();
      // Sync in background — only if a previous sync is not already running
      if (!this.isSyncingToDb) {
        this.syncSnapshotToDb(snapshot).catch((err) => {
          this.logger.error('Failed snapshot sync', { error: err.message });
        });
      }
      return snapshot;
    });

    this.registerIpcHandler<{ pid: number }, ThreadInfo[]>('threads', async (payload) => {
      integer(payload?.pid, 'PID');
      return await ProcessCollector.getProcessThreads(payload.pid);
    });

    this.registerIpcHandler<{ pid: number }, ModuleInfo[]>('modules', async (payload) => {
      integer(payload?.pid, 'PID');
      return await ProcessCollector.getProcessModules(payload.pid);
    });

    this.registerIpcHandler<{ pid: number }, boolean>('terminate', async (payload) => {
      integer(payload?.pid, 'PID');
      this.logger.warn(`Attempting to terminate process: PID ${payload.pid}`);
      
      return new Promise((resolve) => {
        const { execFile } = require('child_process');
        execFile(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'), ['/F', '/PID', String(payload.pid)], { windowsHide: true, timeout: 10000 }, (err: any) => {
          if (err) {
            this.logger.error(`Failed to terminate process ${payload.pid}`, { error: err.message });
            resolve(false);
          } else {
            this.logger.info(`Successfully terminated process ${payload.pid}`);
            resolve(true);
          }
        });
      });
    });

    this.logger.info('Process Explorer Module initialized.');
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down Process Explorer Module...');
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.unregisterIpcHandlers();
  }

  /**
   * Sync active processes details to process.db to build history.
   * Uses isSyncingToDb flag to prevent concurrent sync stacking.
   */
  private async syncSnapshotToDb(snapshot: ProcessInfo[]): Promise<void> {
    this.isSyncingToDb = true;
    const now = Date.now();
    try {
      // Get currently marked running PIDs in DB to track terminates
      const dbRunningPidsRows = await databaseManager.queryAll<{ pid: number; creation_time: number | null; name: string }>(
        'process',
        'SELECT pid, creation_time, name FROM processes WHERE is_running = 1'
      );
      const dbRunningPids = dbRunningPidsRows.map((r) => r.pid);
      const snapshotPids = new Set(snapshot.map((p) => p.pid));

      // Batch processes inserts
      for (const p of snapshot) {
        const previous = dbRunningPidsRows.find(row => row.pid === p.pid);
        const reused = Boolean(previous?.creation_time && p.creationTime && previous.creation_time !== p.creationTime);
        if (reused) {
          await databaseManager.queryRun('process',
            'INSERT INTO process_history (pid, name, action, timestamp) VALUES (?, ?, ?, ?)',
            [p.pid, previous!.name, 'stop', now]);
        }
        await databaseManager.queryRun(
          'process',
          `INSERT INTO processes (
            pid, ppid, name, path, command_line, user, integrity_level, token_elevation, is_signed, signature_status, first_seen, last_seen, creation_time, is_running
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
          ON CONFLICT(pid) DO UPDATE SET
            ppid = excluded.ppid, name = excluded.name, path = excluded.path,
            command_line = excluded.command_line, user = excluded.user,
            integrity_level = excluded.integrity_level, token_elevation = excluded.token_elevation,
            is_signed = excluded.is_signed, signature_status = excluded.signature_status,
            first_seen = CASE WHEN processes.is_running = 0 OR
              (processes.creation_time > 0 AND excluded.creation_time > 0 AND processes.creation_time != excluded.creation_time)
              THEN excluded.first_seen ELSE processes.first_seen END,
            creation_time = COALESCE(excluded.creation_time, processes.creation_time),
            last_seen = excluded.last_seen,
            is_running = 1`,
          [
            p.pid,
            p.ppid,
            p.name,
            p.path,
            p.commandLine,
            p.user,
            p.integrityLevel,
            p.isElevated ? 1 : 0,
            p.isSigned ? 1 : 0,
            p.signatureStatus,
            now,
            now,
            p.creationTime > 0 ? p.creationTime : null,
          ]
        );

        // If it was not running in DB previously, record 'start' event
        if (!previous || reused) {
          await databaseManager.queryRun(
            'process',
            `INSERT INTO process_history (pid, ppid, name, action, timestamp, user, command_line)
             VALUES (?, ?, ?, 'start', ?, ?, ?)`,
            [p.pid, p.ppid, p.name, now, p.user, p.commandLine]
          );
        }
      }

      // Record 'stop' events for processes no longer present
      for (const dbPid of dbRunningPids) {
        if (!snapshotPids.has(dbPid)) {
          await databaseManager.queryRun(
            'process',
            'UPDATE processes SET is_running = 0, last_seen = ? WHERE pid = ?',
            [now, dbPid]
          );

          const procDetails = await databaseManager.queryGet<{ name: string }>(
            'process',
            'SELECT name FROM processes WHERE pid = ?',
            [dbPid]
          );

          await databaseManager.queryRun(
            'process',
            'INSERT INTO process_history (pid, name, action, timestamp) VALUES (?, ?, "stop", ?)',
            [dbPid, procDetails?.name || 'Unknown', now]
          );
        }
      }
    } catch (err: any) {
      this.logger.error('Failed to sync process snapshot to SQLite database', { error: err.message });
    } finally {
      this.isSyncingToDb = false;
    }
  }
}
export default ProcessExplorerModule;
