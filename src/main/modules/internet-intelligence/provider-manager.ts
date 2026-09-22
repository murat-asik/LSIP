import { createModuleLogger } from '../../core/logger';
import { IndicatorType, IntelligenceObject, IIntelligenceProvider } from './types';
import { cacheManager } from './cache-manager';
import { secureConfigManager } from './secure-config';
import { connectivityManager } from '../../core/connectivity-manager';
import { eventBus } from '../../core/event-bus';

const log = createModuleLogger('internet-provider-manager');

interface RateLimitTracker {
  minuteTimestamps: number[];
  dayTimestamps: number[];
}

interface ProviderMetrics {
  requests: number;
  cacheHits: number;
  cacheMisses: number;
  failures: number;
  totalLatencyMs: number;
}

export interface DetailedProviderHealth {
  id: string;
  name: string;
  enabled: boolean;
  configured: boolean;
  reachable: boolean;
  apiValid: boolean;
  status: string;
  latencyMs: number;
  cacheHits: number;
  cacheMisses: number;
  requests: number;
  failures: number;
}

export class ProviderManager {
  private providers = new Map<string, IIntelligenceProvider>();
  private rateLimitMap = new Map<string, RateLimitTracker>();
  private metricsMap = new Map<string, ProviderMetrics>();

  public registerProvider(provider: IIntelligenceProvider): void {
    if (this.providers.has(provider.id)) {
      log.warn(`Provider ${provider.id} is already registered. Overwriting.`);
    }
    this.providers.set(provider.id, provider);
    this.rateLimitMap.set(provider.id, { minuteTimestamps: [], dayTimestamps: [] });
    this.metricsMap.set(provider.id, { requests: 0, cacheHits: 0, cacheMisses: 0, failures: 0, totalLatencyMs: 0 });
    log.info(`Registered provider: ${provider.name} (${provider.id})`);
  }

  public getProviders(): IIntelligenceProvider[] {
    return Array.from(this.providers.values());
  }

  public getProvider(id: string): IIntelligenceProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Lazy provider initialization — only called when user performs a query.
   * Providers without API keys for requiresApiKey=true are skipped entirely.
   */
  public async initializeEnabledProviders(): Promise<void> {
    // V3: Providers initialize lazily on first query.
    // This method is now a no-op kept for API compatibility.
    log.info('Provider initialization is now lazy — providers initialize on first query.');
  }

  private getOrCreateMetrics(id: string): ProviderMetrics {
    if (!this.metricsMap.has(id)) {
      this.metricsMap.set(id, { requests: 0, cacheHits: 0, cacheMisses: 0, failures: 0, totalLatencyMs: 0 });
    }
    return this.metricsMap.get(id)!;
  }

  private checkAndRecordRateLimit(providerId: string): boolean {
    const config = secureConfigManager.getProviderCredentials(providerId);
    if (!config || !config.rateLimit) return true;

    const now = Date.now();
    const tracker = this.rateLimitMap.get(providerId) || { minuteTimestamps: [], dayTimestamps: [] };

    tracker.minuteTimestamps = tracker.minuteTimestamps.filter(ts => now - ts < 60000);
    tracker.dayTimestamps = tracker.dayTimestamps.filter(ts => now - ts < 86400000);

    const rpmLimit = config.rateLimit.requestsPerMinute ?? 0;
    const rpdLimit = config.rateLimit.requestsPerDay ?? 0;

    if (rpmLimit > 0 && tracker.minuteTimestamps.length >= rpmLimit) {
      log.warn(`Provider ${providerId} rate-limited (RPM: ${rpmLimit})`);
      return false;
    }

    if (rpdLimit > 0 && tracker.dayTimestamps.length >= rpdLimit) {
      log.warn(`Provider ${providerId} rate-limited (RPD: ${rpdLimit})`);
      return false;
    }

    tracker.minuteTimestamps.push(now);
    tracker.dayTimestamps.push(now);
    this.rateLimitMap.set(providerId, tracker);
    return true;
  }

  public async query(indicator: string, type: IndicatorType, forceRefresh = false): Promise<IntelligenceObject[]> {
    const globalConfig = secureConfigManager.getGlobalConfig();
    if (!globalConfig.enabled) {
      log.debug('Internet Intelligence globally disabled — skipping query.');
      return [];
    }

    const configs = secureConfigManager.getAllProviderCredentials();
    const connectivityState = connectivityManager.getState();
    const isOnline = connectivityState.isOnlineMode && !globalConfig.offlineMode;

    // Filter to capable and enabled providers
    const capableProviders = Array.from(this.providers.values()).filter(provider => {
      const config = configs.find(c => c.id === provider.id);
      const isEnabled = config ? config.enabled : true;
      return isEnabled && provider.capabilities.supportedTypes.includes(type);
    });

    if (capableProviders.length === 0) {
      log.debug(`No capable enabled providers for type: ${type}`);
      return [];
    }

    const queryPromises = capableProviders.map(async (provider): Promise<IntelligenceObject | null> => {
      const id = provider.id;
      const metrics = this.getOrCreateMetrics(id);
      let latestConfig = secureConfigManager.getProviderCredentials(id);

      if (!latestConfig) {
        latestConfig = {
          id,
          name: provider.name,
          enabled: true,
          timeoutMs: 10000,
          rateLimit: { requestsPerMinute: 60, requestsPerDay: 1000 },
        };
      }

      if (!latestConfig.enabled) return null;

      try {
        // ── Lazy provider initialization (only once per provider) ─────────────
        if (isOnline) {
          try {
            await provider.initialize(latestConfig);
          } catch (initErr: any) {
            log.error(`[PROVIDER INIT FAILED] Provider: ${provider.name} (${id})`, {
              providerId: id,
              providerName: provider.name,
              httpStatus: initErr.status || 500,
              errorMessage: initErr.message || 'Initialization failed',
              stackTrace: initErr.stack || new Error().stack,
              timestamp: Date.now(),
              indicator,
              type,
            });
            metrics.failures++;
            this.metricsMap.set(id, metrics);
            return {
              indicator,
              type,
              risk: 'unknown',
              confidence: 0,
              source: id,
              providerName: provider.name,
              isConfigured: false,
              timestamp: Date.now(),
              metadata: { errorDetails: `Initialization Failed: ${initErr.message}`, rawError: initErr.message, stackTrace: initErr.stack },
            };
          }
        }

        const apiKeyLoaded = !!(latestConfig.apiKey && latestConfig.apiKey.trim() !== '');

        // Providers requiring API key with no key — return unconfigured result, no resource allocation
        if (provider.capabilities.requiresApiKey && !apiKeyLoaded) {
          return {
            indicator,
            type,
            risk: 'unknown',
            confidence: 0,
            source: id,
            providerName: provider.name,
            isConfigured: false,
            timestamp: Date.now(),
            metadata: { errorDetails: 'API Key Missing' },
          };
        }

        metrics.requests++;

        if (isOnline && !forceRefresh) {
          // Check cache first (L1 memory, then L2 SQLite)
          const cached = await cacheManager.get(indicator, type, id);
          if (cached && cached.metadata.provenance === 'CACHED') {
            metrics.cacheHits++;
            this.metricsMap.set(id, metrics);
            return cached.data;
          }
        }

        if (isOnline) {
          // Check rate limit before live fetch
          if (!this.checkAndRecordRateLimit(id)) {
            const cacheResult = await cacheManager.get(indicator, type, id);
            if (cacheResult) {
              metrics.cacheHits++;
              this.metricsMap.set(id, metrics);
              return cacheResult.data;
            }
            log.warn(`[PROVIDER RATE LIMITED] Provider: ${provider.name} (${id})`, {
              providerId: id,
              providerName: provider.name,
              httpStatus: 429,
              errorMessage: 'Rate limit exceeded (RPM/RPD limit reached)',
              stackTrace: new Error().stack,
              timestamp: Date.now(),
              indicator,
              type,
            });
            return {
              indicator,
              type,
              risk: 'unknown',
              confidence: 0,
              source: id,
              providerName: provider.name,
              isConfigured: true,
              timestamp: Date.now(),
              httpStatus: 429,
              metadata: { errorDetails: 'Rate limit exceeded (HTTP 429)' },
            };
          }

          // Live fetch
          const startTime = Date.now();
          try {
            const liveData = await provider.query(indicator, type);
            const latency = Date.now() - startTime;

            metrics.totalLatencyMs += latency;
            metrics.cacheMisses++;
            this.metricsMap.set(id, metrics);

            liveData.provenance = 'LIVE';
            await cacheManager.set(indicator, type, id, liveData);

            // Publish event for interested modules
            eventBus.publish('provider:finished', {
              providerId: id,
              indicator,
              latencyMs: latency,
              fromCache: false,
            });

            log.debug(`Provider ${id} live fetch success. Latency: ${latency}ms`);
            return liveData;
          } catch (err: any) {
            metrics.failures++;
            this.metricsMap.set(id, metrics);

            const httpStatus = err.status || (err.response?.status) || 500;
            const errMsg = err.message || 'Unknown provider query error';
            const stackTrace = err.stack || new Error().stack;
            const timestamp = Date.now();

            log.error(`[PROVIDER QUERY FAILED] Provider: ${provider.name} (${id})`, {
              providerId: id,
              providerName: provider.name,
              httpStatus,
              errorMessage: errMsg,
              stackTrace,
              timestamp,
              indicator,
              type,
            });

            let errorDetails = errMsg;
            if (errMsg.includes('401') || errMsg.includes('Unauthorized')) errorDetails = '401 Unauthorized';
            else if (errMsg.includes('429') || errMsg.includes('Rate limit')) errorDetails = '429 Rate Limit';
            else if (errMsg.includes('timeout') || err.isTimeout) errorDetails = 'Timeout';
            else if (errMsg.includes('ENOTFOUND') || errMsg.includes('DNS')) errorDetails = 'DNS Failure';

            // Cache fallback
            const cacheFallback = await cacheManager.get(indicator, type, id);
            if (cacheFallback) {
              metrics.cacheHits++;
              this.metricsMap.set(id, metrics);
              return cacheFallback.data;
            }

            return {
              indicator,
              type,
              risk: 'unknown',
              confidence: 0,
              source: id,
              providerName: provider.name,
              isConfigured: true,
              timestamp,
              httpStatus,
              metadata: { errorDetails, rawError: errMsg, stackTrace, httpStatus },
            };
          }
        }

        // OFFLINE PATH — serve cache only
        const cacheResult = await cacheManager.get(indicator, type, id);
        if (cacheResult) {
          metrics.cacheHits++;
          this.metricsMap.set(id, metrics);
          eventBus.publish('provider:finished', {
            providerId: id,
            indicator,
            latencyMs: 0,
            fromCache: true,
          });
          return cacheResult.data;
        }

        metrics.cacheMisses++;
        this.metricsMap.set(id, metrics);
        return null;

      } catch (topErr: any) {
        log.error(`[UNHANDLED PROVIDER EXCEPTION] Provider: ${provider.name} (${id})`, {
          providerId: id,
          providerName: provider.name,
          httpStatus: topErr.status || 500,
          errorMessage: topErr.message || 'Unhandled provider error',
          stackTrace: topErr.stack || new Error().stack,
          timestamp: Date.now(),
          indicator,
          type,
        });

        return {
          indicator,
          type,
          risk: 'unknown',
          confidence: 0,
          source: id,
          providerName: provider.name,
          isConfigured: true,
          timestamp: Date.now(),
          metadata: { errorDetails: topErr.message, rawError: topErr.message, stackTrace: topErr.stack },
        };
      }
    });

    const settledResults = await Promise.allSettled(queryPromises);
    const finalResults: IntelligenceObject[] = [];

    for (const res of settledResults) {
      if (res.status === 'fulfilled' && res.value !== null) {
        finalResults.push(res.value);
      } else if (res.status === 'rejected') {
        log.error(`[PROMISE SETTLED REJECTED] Query promise rejected unexpectedly`, {
          reason: res.reason?.message || String(res.reason),
          stackTrace: res.reason?.stack || new Error().stack,
          timestamp: Date.now(),
        });
      }
    }

    return finalResults;
  }

  public async testConnections(): Promise<Record<string, { ok: boolean; message: string; status: string }>> {
    const statuses: Record<string, { ok: boolean; message: string; status: string }> = {};
    const configs = secureConfigManager.getAllProviderCredentials();

    const policy = secureConfigManager.getGlobalConfig();
    const online = connectivityManager.getState().isOnlineMode && policy.enabled && !policy.offlineMode;
    for (const [id, provider] of this.providers.entries()) {
      if (!online) { statuses[id] = { ok: false, message: 'Çevrimdışı: bağlantı testi yapılmadı.', status: 'Waiting For Connection' }; continue; }
      const config = configs.find(c => c.id === id);
      if (!config || !config.enabled) {
        statuses[id] = { ok: false, message: 'Disabled in configuration', status: 'Disabled' };
        continue;
      }

      if (provider.capabilities.requiresApiKey && (!config.apiKey || config.apiKey.trim() === '')) {
        statuses[id] = { ok: false, message: 'API Key Required', status: 'Invalid API Key' };
        continue;
      }

      if (!this.checkAndRecordRateLimit(id)) {
        statuses[id] = { ok: false, message: 'Rate limit exceeded (HTTP 429)', status: 'Rate Limited' };
        continue;
      }

      try {
        await provider.initialize(config);
        const isHealthy = await provider.healthCheck();
        statuses[id] = {
          ok: isHealthy,
          message: isHealthy ? 'Connection successful' : 'API key invalid or service unreachable',
          status: isHealthy ? 'Healthy' : 'Provider Offline',
        };
      } catch (err: any) {
        const status = err.status === 401 ? 'Invalid API Key' : err.status === 403 ? 'Access Denied' : err.status === 429 ? 'Rate Limited' : err.isCancelled ? 'Cancelled' : err.isTimeout ? 'Timeout' : err.status >= 500 ? 'Provider Offline' : 'Network Error';
        statuses[id] = { ok: false, message: err.status ? `HTTP ${err.status}` : status, status };
      }
    }

    return statuses;
  }

  public async getDetailedHealth(): Promise<DetailedProviderHealth[]> {
    const configs = secureConfigManager.getAllProviderCredentials();
    const connectivityState = connectivityManager.getState();
    const testResults = await this.testConnections();

    return Array.from(this.providers.values()).map(provider => {
      const id = provider.id;
      const config = configs.find(c => c.id === id);
      const metrics = this.getOrCreateMetrics(id);
      const test = testResults[id];

      const enabled = config?.enabled ?? false;
      const configured = !provider.capabilities.requiresApiKey || !!(config?.apiKey && config.apiKey.trim() !== '');

      let status = 'Disabled';
      if (!enabled) {
        status = 'Disabled';
      } else if (!configured && provider.capabilities.requiresApiKey) {
        status = 'Invalid API Key';
      } else if (!connectivityState.isOnlineMode) {
        status = 'Waiting For Connection';
      } else if (test?.ok) {
        status = 'Healthy';
      } else {
        status = test?.status || 'Provider Offline';
      }

      const avgLatency = metrics.requests > 0 ? Math.round(metrics.totalLatencyMs / metrics.requests) : 0;

      return {
        id,
        name: provider.name,
        enabled,
        configured,
        reachable: connectivityState.isOnlineMode && test?.ok === true,
        apiValid: test?.ok === true,
        status,
        latencyMs: avgLatency,
        cacheHits: metrics.cacheHits,
        cacheMisses: metrics.cacheMisses,
        requests: metrics.requests,
        failures: metrics.failures,
      };
    });
  }
}

export const providerManager = new ProviderManager();
