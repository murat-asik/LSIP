import { safeIpcHandle } from './security';
import { ipcMain } from 'electron';
import { createModuleLogger } from './logger';
import { moduleManager } from './module-manager';
import { WorkerPool } from './worker-pool';
import { container } from './service-container';
import { databaseManager } from './database-manager';
import { cacheManager } from '../modules/internet-intelligence/cache-manager';

const log = createModuleLogger('performance-ipc');

export interface PerformanceSnapshot {
  timestamp: number;
  mainProcess: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
    uptime: number;
  };
  modules: {
    total: number;
    initialized: number;
    active: number;
    sleeping: number;
    disposed: number;
    details: Array<{
      name: string;
      displayName: string;
      lifecycleState: string;
      lastActivityAt: number;
      ipcHandlerCount: number;
      timerCount: number;
    }>;
  };
  workerPool: {
    totalWorkers: number;
    activeWorkers: number;
    idleWorkers: number;
    queueDepth: number;
    completedTasks: number;
    failedTasks: number;
    averageTaskDurationMs: number;
  };
  cache: {
    l1Size: number;
    l1HitRate: number;
    l1Hits: number;
    l1Misses: number;
  };
  database: {
    openConnections: number;
  };
  environment: string;
}

let snapshotHistory: number[] = []; // Track request latencies for metrics

export function registerPerformanceIpc(): void {
  safeIpcHandle('perf:get-metrics', async (): Promise<PerformanceSnapshot> => {
    const start = Date.now();

    try {
      const mem = process.memoryUsage();
      const moduleStatuses = moduleManager.getFullStatus();

      const moduleBreakdown = {
        total: moduleStatuses.length,
        initialized: moduleStatuses.filter(m => m.lifecycleState === 'INITIALIZED').length,
        active: moduleStatuses.filter(m => m.lifecycleState === 'ACTIVE').length,
        sleeping: moduleStatuses.filter(m => m.lifecycleState === 'SLEEPING').length,
        disposed: moduleStatuses.filter(m => m.lifecycleState === 'DISPOSED').length,
        details: moduleStatuses,
      };

      let workerStats = {
        totalWorkers: 0,
        activeWorkers: 0,
        idleWorkers: 0,
        queueDepth: 0,
        completedTasks: 0,
        failedTasks: 0,
        averageTaskDurationMs: 0,
      };

      try {
        if (container.has('workerPool')) {
          const pool = container.get<WorkerPool>('workerPool');
          workerStats = pool.getStats();
        }
      } catch {
        // Worker pool may not be initialized yet
      }

      const cacheStats = cacheManager.getStats();

      // Count open SQLite connections
      const dbCount = (databaseManager as any).dbInstances?.size ?? 0;

      const snapshot: PerformanceSnapshot = {
        timestamp: Date.now(),
        mainProcess: {
          heapUsed: mem.heapUsed,
          heapTotal: mem.heapTotal,
          rss: mem.rss,
          external: mem.external,
          uptime: process.uptime(),
        },
        modules: moduleBreakdown,
        workerPool: workerStats,
        cache: cacheStats,
        database: {
          openConnections: dbCount,
        },
        environment: process.env.NODE_ENV || 'production',
      };

      snapshotHistory.push(Date.now() - start);
      if (snapshotHistory.length > 100) snapshotHistory.shift();

      return snapshot;
    } catch (err: any) {
      log.error('Failed to collect performance metrics', { error: err.message });
      throw err;
    }
  });

  safeIpcHandle('perf:export-diagnostics', async (): Promise<string> => {
    try {
      const mem = process.memoryUsage();
      const moduleStatuses = moduleManager.getFullStatus();

      let workerStats = {
        totalWorkers: 0, activeWorkers: 0, idleWorkers: 0,
        queueDepth: 0, completedTasks: 0, failedTasks: 0, averageTaskDurationMs: 0,
      };
      try {
        if (container.has('workerPool')) {
          workerStats = container.get<WorkerPool>('workerPool').getStats();
        }
      } catch { /* Worker pool may not be initialized yet */ }

      const cacheStats = cacheManager.getStats();
      const dbCount = (databaseManager as any).dbInstances?.size ?? 0;

      const snapshot: PerformanceSnapshot = {
        timestamp: Date.now(),
        mainProcess: {
          heapUsed: mem.heapUsed, heapTotal: mem.heapTotal,
          rss: mem.rss, external: mem.external, uptime: process.uptime(),
        },
        modules: {
          total: moduleStatuses.length,
          initialized: moduleStatuses.filter(m => m.lifecycleState === 'INITIALIZED').length,
          active: moduleStatuses.filter(m => m.lifecycleState === 'ACTIVE').length,
          sleeping: moduleStatuses.filter(m => m.lifecycleState === 'SLEEPING').length,
          disposed: moduleStatuses.filter(m => m.lifecycleState === 'DISPOSED').length,
          details: moduleStatuses,
        },
        workerPool: workerStats,
        cache: cacheStats,
        database: { openConnections: dbCount },
        environment: process.env.NODE_ENV || 'production',
      };

      return JSON.stringify(snapshot, null, 2);
    } catch (err: any) {
      log.error('Failed to export diagnostics', { error: err.message });
      return JSON.stringify({ error: err.message });
    }
  });

  log.info('Performance IPC handlers registered.');
}
