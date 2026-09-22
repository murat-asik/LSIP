import { IIntelligenceProvider, IndicatorType, IntelligenceObject, ProviderCapabilities, ProviderConfig } from './types';
import { createModuleLogger } from '../../core/logger';

export abstract class BaseIntelligenceProvider implements IIntelligenceProvider {
  public abstract readonly id: string;
  public abstract readonly name: string;
  public abstract readonly capabilities: ProviderCapabilities;

  protected config: ProviderConfig | null = null;
  protected log: ReturnType<typeof createModuleLogger>;

  // ── Lazy initialization guard ─────────────────────────────────────────────
  private _isInitialized = false;

  constructor() {
    this.log = createModuleLogger(`provider-${this.constructor.name.toLowerCase()}`);
  }

  public get isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * Initialize the provider with config.
   * Safe to call multiple times — only runs once per config version.
   */
  public async initialize(config: ProviderConfig): Promise<void> {
    const configChanged = this.config?.apiKey !== config.apiKey || this.config?.enabled !== config.enabled;

    if (this._isInitialized && !configChanged) {
      // Already initialized with same config — skip
      return;
    }

    this.config = config;
    this._isInitialized = true;
    this.log.info(`Initialized ${this.name} (${this.id}). Enabled: ${config.enabled}`);
  }

  /**
   * Reset initialization state (e.g., after config change).
   */
  public resetInitialization(): void {
    this._isInitialized = false;
    this.config = null;
  }

  public abstract query(indicator: string, type: IndicatorType): Promise<IntelligenceObject>;

  public async queryBulk?(indicators: string[], type: IndicatorType): Promise<IntelligenceObject[]> {
    if (!this.capabilities.supportsBulk) {
      throw new Error(`Provider ${this.name} does not support bulk queries.`);
    }
    const results: IntelligenceObject[] = [];
    for (const ind of indicators) {
      results.push(await this.query(ind, type));
    }
    return results;
  }

  public abstract healthCheck(): Promise<boolean>;

  protected isSupported(type: IndicatorType): boolean {
    return this.capabilities.supportedTypes.includes(type);
  }

  protected checkApiKeyRequired(): void {
    if (this.capabilities.requiresApiKey && (!this.config?.apiKey || this.config.apiKey.trim() === '')) {
      throw new Error(`API key required for provider ${this.name}`);
    }
  }
}
