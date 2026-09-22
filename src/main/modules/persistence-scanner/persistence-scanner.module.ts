import { BaseModule } from '../base-module';
import { PersistenceCollector } from './persistence-collector';
import { PersistenceEntry, PersistenceSummary } from '../../../shared/types/persistence.types';

export class PersistenceScannerModule extends BaseModule {
  public readonly name = 'persistence';
  public readonly displayName = 'Persistence Scanner';

  public async initialize(): Promise<void> {
    this.logger.info('Initializing Persistence Scanner Module...');

    this.registerIpcHandler<void, PersistenceSummary>('summary', async () => {
      return this.getFullScan();
    });

    this.registerIpcHandler<void, PersistenceEntry[]>('registry', async () => {
      return PersistenceCollector.getRegistryRunKeys();
    });

    this.registerIpcHandler<void, PersistenceEntry[]>('tasks', async () => {
      return PersistenceCollector.getScheduledTasks();
    });

    this.registerIpcHandler<void, PersistenceEntry[]>('services', async () => {
      return PersistenceCollector.getServices();
    });

    this.registerIpcHandler<void, PersistenceEntry[]>('startup', async () => {
      return PersistenceCollector.getStartupFolders();
    });

    this.logger.info('Persistence Scanner Module initialized.');
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down Persistence Scanner Module...');
    this.unregisterIpcHandlers();
  }

  private async getFullScan(): Promise<PersistenceSummary> {
    const [registry, tasks, services, startupFolders] = await Promise.all([
      PersistenceCollector.getRegistryRunKeys(),
      PersistenceCollector.getScheduledTasks(),
      PersistenceCollector.getServices(),
      PersistenceCollector.getStartupFolders(),
    ]);

    const all = [...registry, ...tasks, ...services, ...startupFolders];
    const suspicious = all.filter(e => e.riskLevel === 'suspicious' || e.riskLevel === 'malicious');

    return {
      totalEntries: all.length,
      registryItems: registry.length,
      scheduledTasks: tasks.length,
      services: services.length,
      startupItems: startupFolders.length,
      suspiciousCount: suspicious.length,
      entries: all,
    };
  }
}
export default PersistenceScannerModule;
