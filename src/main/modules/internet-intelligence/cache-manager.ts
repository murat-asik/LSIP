import { databaseManager } from '../../core/database-manager';
import { createModuleLogger } from '../../core/logger';
import { IndicatorType, IntelligenceObject } from './types';
import { secureConfigManager } from './secure-config';
import crypto from 'crypto';

const log = createModuleLogger('internet-cache');

export interface CacheEntryMetadata {
  indicator: string;
  type: IndicatorType;
  providerId: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  ttlMinutes: number;
  providerVersion: string;
  responseHash: string;
  source: string;
  provenance: 'CACHED' | 'STALE CACHE' | 'LIVE';
}

// L1 in-memory cache entry
interface L1Entry {
  data: IntelligenceObject;
  metadata: CacheEntryMetadata;
  expiresAt: number;
}

export interface CacheStats {
  l1Size: number;
  l1HitRate: number;
  l1Hits: number;
  l1Misses: number;
}

const MAX_L1_SIZE = 200; // Max entries in memory cache

export class CacheManager {
  private dbName = 'config';
  private initialized = false;

  // L1 in-memory cache (hot path — avoids SQLite roundtrip)
  private l1Cache = new Map<string, L1Entry>();
  private l1Hits = 0;
  private l1Misses = 0;

  private providerTtlSecondsMap: Record<string, number> = {
    abuseipdb: 900,    // 15 minutes
    virustotal: 1800,  // 30 minutes
    greynoise: 900,    // 15 minutes
    otx: 3600,         // 60 minutes
    geoip: 604800,     // 7 days
  };

  private makeL1Key(indicator: string, type: IndicatorType, providerId: string): string {
    return `${type}:${indicator}:${providerId}`;
  }

  public getStats(): CacheStats {
    const total = this.l1Hits + this.l1Misses;
    return {
      l1Size: this.l1Cache.size,
      l1HitRate: total > 0 ? Math.round((this.l1Hits / total) * 100) : 0,
      l1Hits: this.l1Hits,
      l1Misses: this.l1Misses,
    };
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Create cache table if it doesn't exist (preserves data across restarts)
      await databaseManager.queryExec(this.dbName, `
        CREATE TABLE IF NOT EXISTS intelligence_cache (
          indicator TEXT NOT NULL,
          type TEXT NOT NULL,
          provider_id TEXT NOT NULL,
          response_json TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          ttl_minutes INTEGER NOT NULL,
          provider_version TEXT NOT NULL,
          response_hash TEXT NOT NULL,
          source TEXT NOT NULL,
          provenance TEXT NOT NULL,
          PRIMARY KEY (indicator, type, provider_id)
        )
      `);

      this.initialized = true;
      log.info('Intelligence cache initialized (L1 memory + L2 SQLite).');
    } catch (err: any) {
      log.error('Failed to initialize intelligence cache', { error: err.message });
      throw err;
    }
  }

  public getProviderTtlSeconds(providerId: string): number {
    const configTtl = secureConfigManager.getGlobalConfig().cacheTtlSeconds;
    if (configTtl && configTtl !== 86400) return configTtl;
    return this.providerTtlSecondsMap[providerId] || 900;
  }

  public async get(
    indicator: string,
    type: IndicatorType,
    providerId: string
  ): Promise<{ data: IntelligenceObject; metadata: CacheEntryMetadata } | null> {
    if (!this.initialized) await this.initialize();

    const now = Date.now();
    const l1Key = this.makeL1Key(indicator, type, providerId);

    // ── L1 Memory Cache Check ─────────────────────────────────────────────
    const l1Entry = this.l1Cache.get(l1Key);
    if (l1Entry) {
      if (l1Entry.expiresAt > now) {
        this.l1Hits++;
        return { data: l1Entry.data, metadata: l1Entry.metadata };
      } else {
        // Expired in L1 — remove it
        this.l1Cache.delete(l1Key);
      }
    }

    this.l1Misses++;

    // ── L2 SQLite Cache Check ─────────────────────────────────────────────
    try {
      const rows = await databaseManager.queryAll<any>(
        this.dbName,
        `SELECT * FROM intelligence_cache WHERE indicator = ? AND type = ? AND provider_id = ?`,
        [indicator, type, providerId]
      );

      if (rows && rows.length > 0) {
        const row = rows[0];
        const data: IntelligenceObject = JSON.parse(row.response_json);
        const isExpired = row.expires_at <= now;
        const provenance: 'CACHED' | 'STALE CACHE' = isExpired ? 'STALE CACHE' : 'CACHED';

        data.provenance = provenance;

        const metadata: CacheEntryMetadata = {
          indicator: row.indicator,
          type: row.type as IndicatorType,
          providerId: row.provider_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          expiresAt: row.expires_at,
          ttlMinutes: row.ttl_minutes,
          providerVersion: row.provider_version || '2.0',
          responseHash: row.response_hash || '',
          source: row.source || providerId,
          provenance,
        };

        // Populate L1 cache for future hits (only if not expired)
        if (!isExpired) {
          this.setL1(l1Key, data, metadata, row.expires_at);
        }

        return { data, metadata };
      }
    } catch (err: any) {
      log.error(`Cache fetch failed for ${type}:${indicator} from ${providerId}`, { error: err.message });
    }

    return null;
  }

  public async set(
    indicator: string,
    type: IndicatorType,
    providerId: string,
    data: IntelligenceObject,
    ttlSeconds?: number
  ): Promise<void> {
    if (!this.initialized) await this.initialize();

    const effectiveTtl = ttlSeconds || this.getProviderTtlSeconds(providerId);
    const ttlMinutes = Math.round(effectiveTtl / 60);
    const now = Date.now();
    const expiresAt = now + effectiveTtl * 1000;

    const jsonString = JSON.stringify(data);
    const responseHash = crypto.createHash('md5').update(jsonString).digest('hex');

    // Update L1 cache immediately
    const l1Key = this.makeL1Key(indicator, type, providerId);
    const metadata: CacheEntryMetadata = {
      indicator,
      type,
      providerId,
      createdAt: now,
      updatedAt: now,
      expiresAt,
      ttlMinutes,
      providerVersion: '3.0',
      responseHash,
      source: providerId,
      provenance: 'CACHED',
    };
    this.setL1(l1Key, data, metadata, expiresAt);

    // Persist to L2 SQLite
    try {
      await databaseManager.queryRun(
        this.dbName,
        `INSERT OR REPLACE INTO intelligence_cache 
         (indicator, type, provider_id, response_json, created_at, updated_at, expires_at, ttl_minutes, provider_version, response_hash, source, provenance) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [indicator, type, providerId, jsonString, now, now, expiresAt, ttlMinutes, '3.0', responseHash, providerId, 'CACHED']
      );
    } catch (err: any) {
      log.error(`Cache set failed for ${type}:${indicator} from ${providerId}`, { error: err.message });
    }
  }

  public async remove(indicator: string, type: IndicatorType, providerId: string): Promise<void> {
    if (!this.initialized) await this.initialize();

    const l1Key = this.makeL1Key(indicator, type, providerId);
    this.l1Cache.delete(l1Key);

    try {
      await databaseManager.queryRun(
        this.dbName,
        `DELETE FROM intelligence_cache WHERE indicator = ? AND type = ? AND provider_id = ?`,
        [indicator, type, providerId]
      );
    } catch (err: any) {
      log.error(`Cache removal failed`, { error: err.message });
    }
  }

  public async clearAll(): Promise<void> {
    if (!this.initialized) await this.initialize();

    this.l1Cache.clear();
    this.l1Hits = 0;
    this.l1Misses = 0;

    try {
      await databaseManager.queryExec(this.dbName, `DELETE FROM intelligence_cache`);
      log.info('Cleared all intelligence cache (L1 + L2).');
    } catch (err: any) {
      log.error('Failed to clear intelligence cache', { error: err.message });
    }
  }

  private setL1(key: string, data: IntelligenceObject, metadata: CacheEntryMetadata, expiresAt: number): void {
    // LRU eviction — remove oldest entry if at capacity
    if (this.l1Cache.size >= MAX_L1_SIZE) {
      const firstKey = this.l1Cache.keys().next().value;
      if (firstKey) this.l1Cache.delete(firstKey);
    }

    this.l1Cache.set(key, { data, metadata, expiresAt });
  }
}

export const cacheManager = new CacheManager();
