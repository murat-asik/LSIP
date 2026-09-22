import fs from 'fs/promises';
import path from 'path';
import { configManager } from '../../core/config-manager';
import { BaseModule } from '../base-module';
import { FimScanner } from './fim-scanner';
import { FimEntry, FimChangeEvent, FimSummary, FimWatchPath } from '../../../shared/types/fim.types';
import { databaseManager } from '../../core/database-manager';

export class FimModule extends BaseModule {
  public readonly name = 'fim';
  public readonly displayName = 'File Integrity (FIM)';
  private pending: Promise<FimEntry[]> | null = null;
  private limitedPaths = new Set<string>();
  private lastError: string | undefined;
  private lastScanAt = 0;
  private watched(): FimWatchPath[] {
    const paths = configManager.getModuleConfig(this.name).watchPaths;
    return Array.isArray(paths) ? paths.slice(0, 20) : [];
  }
  private scanPaths(paths: FimWatchPath[]): Promise<FimEntry[]> {
    if (this.pending) return Promise.reject(new Error('FIM scan already running'));
    this.pending = (async () => {
      const all: FimEntry[] = [];
      for (const watch of paths) {
        const entries = await FimScanner.scanDirectory(watch, 1000);
        const directory = path.resolve(watch.path);
        if (entries.length >= 1000) this.limitedPaths.add(directory); else this.limitedPaths.delete(directory);
        await this.syncEntries(entries);
        // An omitted result is not proof of deletion. Confirm each known file with the filesystem.
        const known = await databaseManager.queryAll<any>('ioc', 'SELECT * FROM fim_baseline WHERE directory = ? AND status != ?', [directory, 'deleted']);
        for (const previous of known) {
          try { await fs.lstat(previous.file_path); }
          catch (error: any) {
            if (error.code !== 'ENOENT') throw error;
            const now = Date.now();
            await databaseManager.queryRun('ioc', 'INSERT INTO fim_changes (timestamp, file_path, change_type, previous_hash, previous_size, severity) VALUES (?, ?, ?, ?, ?, ?)', [now, previous.file_path, 'deleted', previous.hash_sha256, previous.file_size, 'high']);
            await databaseManager.queryRun('ioc', 'UPDATE fim_baseline SET status = ?, last_checked = ? WHERE file_path = ?', ['deleted', now, previous.file_path]);
          }
        }
        all.push(...entries);
      }
      this.lastScanAt = Date.now(); this.lastError = undefined;
      return all;
    })().catch(error => { this.lastError = error.message; throw error; }).finally(() => { this.pending = null; });
    return this.pending;
  }

  public async initialize(): Promise<void> {
    this.logger.info('Initializing File Integrity Monitoring Module...');

    await this.ensureSchema();
    this.registerInterval(60000, () => {
      if (this.pending || !this.watched().length) return;
      void this.scanPaths(this.watched()).catch(error => this.logger.error('FIM monitoring failed', { error: error.message }));
    });

    this.registerIpcHandler<void, FimSummary>('summary', async () => {
      return this.getSummary();
    });

    this.registerIpcHandler<{ path: string; pattern?: string }, FimEntry[]>('scan', async (payload) => {
      const watchPath: FimWatchPath = {
        path: payload.path,
        recursive: false,
        patterns: [payload.pattern || '*.exe'],
        label: 'Custom Scan',
      };
      const paths = this.watched().filter(w => path.resolve(w.path) !== path.resolve(watchPath.path));
      if (paths.length >= 20) throw new Error('Maximum 20 watched directories');
      const entries = await this.scanPaths([watchPath]);
      configManager.setModuleConfig(this.name, { watchPaths: [...paths, watchPath] });
      return entries;
    });

    this.registerIpcHandler<void, FimEntry[]>('baseline', async () => {
      return this.runBaselineScan();
    });

    this.registerIpcHandler<void, FimChangeEvent[]>('changes', async () => {
      return this.getRecentChanges();
    });

    this.registerIpcHandler<void, FimWatchPath[]>('watch-paths', async () => {
      return FimScanner.getDefaultWatchPaths();
    });

    this.logger.info('File Integrity Monitoring Module initialized.');
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down FIM Module...');
    this.unregisterIpcHandlers();
    await this.pending?.catch(() => undefined);
  }

  private async ensureSchema(): Promise<void> {
    try {
      await databaseManager.queryExec('ioc', `
        CREATE TABLE IF NOT EXISTS fim_baseline (
          file_path TEXT PRIMARY KEY,
          file_name TEXT,
          directory TEXT,
          hash_sha256 TEXT,
          file_size INTEGER,
          last_modified INTEGER,
          last_checked INTEGER,
          status TEXT DEFAULT 'unchanged'
        )
      `);
      await databaseManager.queryExec('ioc', `
        CREATE TABLE IF NOT EXISTS fim_changes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp INTEGER,
          file_path TEXT,
          change_type TEXT,
          previous_hash TEXT,
          current_hash TEXT,
          previous_size INTEGER,
          current_size INTEGER,
          severity TEXT DEFAULT 'info'
        )
      `);
    } catch (err: any) {
      this.logger.error('FIM schema init failed', { error: err.message });
      throw err;
    }
  }

  private async runBaselineScan(): Promise<FimEntry[]> {
    const watchPaths = FimScanner.getDefaultWatchPaths();
    const entries = await this.scanPaths(watchPaths);
    const merged = new Map([...this.watched(), ...watchPaths].map(w => [path.resolve(w.path), w]));
    configManager.setModuleConfig(this.name, { watchPaths: [...merged.values()].slice(0, 20) });
    return entries;
  }

  private async syncEntries(entries: FimEntry[]): Promise<void> {
    const now = Date.now();

    for (const entry of entries) {
      try {
        const existing = await databaseManager.queryGet<any>(
          'ioc',
          'SELECT hash_sha256, file_size, status FROM fim_baseline WHERE file_path = ?',
          [entry.filePath]
        );

        if (existing) {
          if (existing.status === 'deleted') {
            await databaseManager.queryRun('ioc', 'INSERT INTO fim_changes (timestamp, file_path, change_type, previous_hash, current_hash, severity) VALUES (?, ?, ?, ?, ?, ?)', [now, entry.filePath, 'created', existing.hash_sha256, entry.hashSha256, 'medium']);
            entry.status = 'new';
          }
          // Check if hash changed
          if (existing.hash_sha256 && entry.hashSha256 && existing.hash_sha256 !== entry.hashSha256) {
            entry.status = 'modified';
            entry.previousHash = existing.hash_sha256;

            // Record the change
            const severity = entry.filePath.toLowerCase().includes('system32') ? 'high' : 'medium';
            await databaseManager.queryRun(
              'ioc',
              'INSERT INTO fim_changes (timestamp, file_path, change_type, previous_hash, current_hash, previous_size, current_size, severity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [now, entry.filePath, 'modified', existing.hash_sha256, entry.hashSha256, existing.file_size, entry.fileSize, severity]
            );
          }

          await databaseManager.queryRun(
            'ioc',
            'UPDATE fim_baseline SET hash_sha256 = ?, file_size = ?, last_modified = ?, last_checked = ?, status = ? WHERE file_path = ?',
            [entry.hashSha256, entry.fileSize, entry.lastModified, now, entry.status, entry.filePath]
          );
        } else {
          entry.status = 'new';
          await databaseManager.queryRun(
            'ioc',
            'INSERT INTO fim_baseline (file_path, file_name, directory, hash_sha256, file_size, last_modified, last_checked, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [entry.filePath, entry.fileName, entry.directory, entry.hashSha256, entry.fileSize, entry.lastModified, now, 'new']
          );
        }
      } catch (err: any) {
        this.logger.error(`FIM sync error for ${entry.filePath}`, { error: err.message });
        throw err;
      }
    }
  }

  private async getRecentChanges(): Promise<FimChangeEvent[]> {
    try {
      const rows = await databaseManager.queryAll<any>(
        'ioc',
        'SELECT * FROM fim_changes ORDER BY timestamp DESC LIMIT 100'
      );

      return rows.map((r: any) => ({
        id: r.id,
        timestamp: r.timestamp,
        filePath: r.file_path,
        changeType: r.change_type,
        previousHash: r.previous_hash,
        currentHash: r.current_hash,
        previousSize: r.previous_size,
        currentSize: r.current_size,
        severity: r.severity,
      }));
    } catch (error) { throw error; }
  }

  private async getSummary(): Promise<FimSummary> {
    try {
      const countRow = await databaseManager.queryGet<any>('ioc', 'SELECT COUNT(*) as cnt FROM fim_baseline');
      const changesRow = await databaseManager.queryGet<any>('ioc', 'SELECT COUNT(*) as cnt FROM fim_changes');
      const critRow = await databaseManager.queryGet<any>('ioc', "SELECT COUNT(*) as cnt FROM fim_changes WHERE severity IN ('high', 'critical')");
      const recentChanges = await this.getRecentChanges();

      return {
        monitoredFiles: countRow?.cnt || 0,
        totalChanges: changesRow?.cnt || 0,
        criticalChanges: critRow?.cnt || 0,
        watchPaths: this.watched(),
        limitedPaths: [...this.limitedPaths], lastScanAt: this.lastScanAt, lastError: this.lastError,
        recentChanges: recentChanges.slice(0, 20),
      };
    } catch (error) { throw error; }
  }
}
export default FimModule;
