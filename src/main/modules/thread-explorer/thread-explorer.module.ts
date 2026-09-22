import { BaseModule } from '../base-module';
import { ThreadCollector } from './thread-collector';
import { ThreadEntry, ThreadSummary } from '../../../shared/types/thread.types';

export class ThreadExplorerModule extends BaseModule {
  public readonly name = 'threads';
  public readonly displayName = 'Thread Explorer';

  public async initialize(): Promise<void> {
    this.logger.info('Initializing Thread Explorer Module...');

    this.registerIpcHandler<{ pid?: number }, ThreadSummary>('summary', async (payload) => {
      const threads = await ThreadCollector.getThreads(payload?.pid);
      
      const uniqueProcs = new Set(threads.map(t => t.processId));
      const highPri = threads.filter(t => t.currentPriority > 8);

      return {
        totalThreads: threads.length,
        activeProcesses: uniqueProcs.size,
        highPriorityThreads: highPri.length,
        threads,
      };
    });

    this.registerIpcHandler<{ pid?: number }, ThreadEntry[]>('list', async (payload) => {
      return ThreadCollector.getThreads(payload?.pid);
    });

    this.logger.info('Thread Explorer Module initialized.');
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down Thread Explorer Module...');
    this.unregisterIpcHandlers();
  }
}
export default ThreadExplorerModule;
