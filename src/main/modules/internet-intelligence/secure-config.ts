import { eventBus } from '../../core/event-bus';
import { safeStorage } from 'electron';
import { configManager } from '../../core/config-manager';
import { integer } from '../../core/security';
import { GlobalInternetConfig, ProviderConfig } from './types';
const IDS = ['abuseipdb','virustotal','urlhaus','hybridanalysis','otx','ipqualityscore','shodan','greynoise'];
export class SecureConfigManager {
  private namespace = 'internet-intelligence';
  private validateId(id: string) {
    if (typeof id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(id) || ['constructor','prototype'].includes(id)) throw new Error('Geçersiz sağlayıcı');
  }
  public getGlobalConfig(): GlobalInternetConfig {
    const r = configManager.getModuleConfig(this.namespace);
    return { enabled: r.enabled !== false, offlineMode: r.offlineMode === true, cacheTtlSeconds: r.cacheTtlSeconds ?? 86400 };
  }
  public saveGlobalConfig(c: Partial<GlobalInternetConfig>): void {
    const r = configManager.getModuleConfig(this.namespace);
    for (const k of ['enabled','offlineMode'] as const) if (c[k] !== undefined) {
      if (typeof c[k] !== 'boolean') throw new Error('Geçersiz tercih');
      r[k] = c[k];
    }
    if (c.cacheTtlSeconds !== undefined) r.cacheTtlSeconds = integer(c.cacheTtlSeconds, 'Önbellek süresi', 604800);
    configManager.setModuleConfig(this.namespace, r);
    eventBus.publish('internet:policy-changed', {});
  }
  private encrypt(key: string): string {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Güvenli anahtar deposu kullanılamıyor. Anahtar kaydedilmedi.');
    return safeStorage.encryptString(key).toString('base64');
  }
  // Main-process only: this object must never be returned over IPC.
  public getProviderCredentials(id: string): ProviderConfig {
    this.validateId(id);
    const r = configManager.getModuleConfig(this.namespace);
    r.providers ||= {};
    const d = r.providers[id] || {};
    let stored: string | undefined;
    const legacy = d.rawApiKey || d.apiKey;
    if (typeof legacy === 'string' && legacy.trim()) {
      d.encryptedApiKey = this.encrypt(legacy.trim()); d.keyStorageVersion = 1;
      delete d.rawApiKey; delete d.apiKey; r.providers[id] = d;
      configManager.setModuleConfig(this.namespace, r);
    eventBus.publish('internet:policy-changed', {});
    }
    if (d.encryptedApiKey) {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('Güvenli anahtar deposu kullanılamıyor.');
      try { stored = safeStorage.decryptString(Buffer.from(d.encryptedApiKey, 'base64')); }
      catch {
        if (d.keyStorageVersion !== 1) {
          const decoded = Buffer.from(d.encryptedApiKey, 'base64').toString('utf8');
          if (/^[\x21-\x7e]{8,4096}$/.test(decoded)) {
            stored = decoded; d.encryptedApiKey = this.encrypt(decoded); d.keyStorageVersion = 1;
            r.providers[id] = d; configManager.setModuleConfig(this.namespace, r);
    eventBus.publish('internet:policy-changed', {});
          }
        }
        if (!stored) throw new Error('Kayıtlı anahtar çözülemedi; yeniden kaydedin.');
      }
    }
    const apiKey = process.env[id.toUpperCase() + '_API_KEY']?.trim() || stored;
    return { id, name: d.name || id, enabled: d.enabled !== false, apiKey, configured: !!apiKey,
      timeoutMs: d.timeoutMs || 10000, rateLimit: d.rateLimit || { requestsPerMinute: 60, requestsPerDay: 1000 }, priority: d.priority ?? 10 };
  }
  public getProviderConfig(id: string): ProviderConfig {
    const { apiKey: _secret, ...result } = this.getProviderCredentials(id);
    return result;
  }
  public saveProviderConfig(c: ProviderConfig): void {
    this.validateId(c.id);
    if (typeof c.enabled !== 'boolean') throw new Error('Geçersiz sağlayıcı durumu');
    if (c.apiKey !== undefined && (typeof c.apiKey !== 'string' || c.apiKey.length > 4096)) throw new Error('Geçersiz anahtar');
    const r = configManager.getModuleConfig(this.namespace); r.providers ||= {};
    const old = r.providers[c.id] || {};
    const next = { ...old, name: c.name || c.id, enabled: c.enabled,
      timeoutMs: integer(c.timeoutMs ?? old.timeoutMs ?? 10000, 'Zaman aşımı', 60000, 100),
      rateLimit: {
        requestsPerMinute: integer(c.rateLimit?.requestsPerMinute ?? old.rateLimit?.requestsPerMinute ?? 60, 'Dakika kotası', 100000, 0),
        requestsPerDay: integer(c.rateLimit?.requestsPerDay ?? old.rateLimit?.requestsPerDay ?? 1000, 'Gün kotası', 10000000, 0)
      }, priority: integer(c.priority ?? old.priority ?? 10, 'Öncelik', 1000, 0) };
    const key = c.apiKey?.trim() || old.rawApiKey || old.apiKey;
    if (key) { next.encryptedApiKey = this.encrypt(key); next.keyStorageVersion = 1; }
    delete next.rawApiKey; delete next.apiKey;
    r.providers[c.id] = next; configManager.setModuleConfig(this.namespace, r);
    eventBus.publish('internet:policy-changed', {});
  }
  public removeApiKey(id: string): void {
    this.validateId(id);
    const r = configManager.getModuleConfig(this.namespace);
    if (r.providers?.[id]) {
      delete r.providers[id].encryptedApiKey; delete r.providers[id].rawApiKey; delete r.providers[id].apiKey;
      configManager.setModuleConfig(this.namespace,r);
    }
  }
  private ids(): string[] { return [...new Set([...IDS, ...Object.keys(configManager.getModuleConfig(this.namespace).providers || {})])]; }
  public getAllProviderConfigs(): ProviderConfig[] { return this.ids().map(id => this.getProviderConfig(id)); }
  public getAllProviderCredentials(): ProviderConfig[] { return this.ids().map(id => this.getProviderCredentials(id)); }
}
export const secureConfigManager = new SecureConfigManager();
