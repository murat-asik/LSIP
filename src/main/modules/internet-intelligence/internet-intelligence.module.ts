import { BaseModule } from '../base-module';
import { providerManager } from './provider-manager';
import { cacheManager } from './cache-manager';
import { secureConfigManager } from './secure-config';
import { IndicatorType, ProviderConfig, GlobalInternetConfig } from './types';
import { registerAllProviders } from './providers';
import { createModuleLogger } from '../../core/logger';

const log = createModuleLogger('internet-intelligence.module');

export class InternetIntelligenceModule extends BaseModule {
  public readonly name = 'internet';
  public readonly displayName = 'Internet Intelligence Foundation';

  public async initialize(): Promise<void> {
    console.log('[InternetIntelligence] initialize() called');
    // 1. Initialize SQLite Cache Database
    await cacheManager.initialize();

    // 2. Auto-Register Built-in Providers
    registerAllProviders();

    // 3. Provider initialization is now LAZY — providers initialize on first query.
    //    No HTTP connections, no timers, no allocations until user performs an investigation.

    // 4. Register IPC Channels
    this.registerIpcHandlers();

    log.info('Internet Intelligence Foundation initialized. Providers ready for lazy initialization.');
  }

  public async shutdown(): Promise<void> {
    log.info('Internet Intelligence Foundation shut down.');
  }

  private registerIpcHandlers(): void {
    this.registerIpcHandler('query', async ({ indicator, type }: { indicator: string; type: IndicatorType }) => {
      return await providerManager.query(indicator, type);
    });

    this.registerIpcHandler('test-connections', async () => {
      return await providerManager.testConnections();
    });

    this.registerIpcHandler('get-health', async () => {
      return await providerManager.getDetailedHealth();
    });

    this.registerIpcHandler('get-configs', async () => {
      const configs = secureConfigManager.getAllProviderConfigs();
      return configs;
    });

    this.registerIpcHandler('save-config', async (config: ProviderConfig) => {
      secureConfigManager.saveProviderConfig(config);
      const provider = providerManager.getProvider(config.id);
      if (provider && config.enabled) {
        try {
          await provider.initialize(secureConfigManager.getProviderCredentials(config.id));
        } catch (err: any) {
          log.error(`Re-initialization failed for provider ${config.id}`, { error: err.message });
        }
      }
      return true;
    });

    this.registerIpcHandler('remove-api-key', async (providerId: string) => {
      secureConfigManager.removeApiKey(providerId);
      return true;
    });

    this.registerIpcHandler('clear-cache', async () => {
      await cacheManager.clearAll();
      return true;
    });

    this.registerIpcHandler('get-global-config', async () => {
      return secureConfigManager.getGlobalConfig();
    });

    this.registerIpcHandler('save-global-config', async (config: Partial<GlobalInternetConfig>) => {
      secureConfigManager.saveGlobalConfig(config);
      return true;
    });
  }
}
