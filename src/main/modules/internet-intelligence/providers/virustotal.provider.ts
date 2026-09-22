import { BaseIntelligenceProvider } from '../base-provider';
import { IndicatorType, IntelligenceObject, ProviderCapabilities, RiskLevel } from '../types';
import { httpClient } from '../http-client';

export class VirusTotalProvider extends BaseIntelligenceProvider {
  public readonly id = 'virustotal';
  public readonly name = 'VirusTotal';

  public readonly capabilities: ProviderCapabilities = {
    supportedTypes: ['ip', 'domain', 'url', 'hash'],
    requiresApiKey: true,
    supportsBulk: false,
  };

  public async query(indicator: string, type: IndicatorType): Promise<IntelligenceObject> {
    if (!this.isSupported(type)) {
      throw new Error(`Indicator type ${type} is not supported by ${this.name}`);
    }
    this.checkApiKeyRequired();

    const apiKey = this.config!.apiKey!;
    let endpoint = '';

    switch (type) {
      case 'ip':
        endpoint = `ip_addresses/${encodeURIComponent(indicator)}`;
        break;
      case 'domain':
        endpoint = `domains/${encodeURIComponent(indicator)}`;
        break;
      case 'hash':
        endpoint = `files/${encodeURIComponent(indicator)}`;
        break;
      case 'url':
        const urlId = Buffer.from(indicator).toString('base64url');
        endpoint = `urls/${urlId}`;
        break;
      default:
        throw new Error(`Unsupported indicator type ${type} for VirusTotal`);
    }

    const url = `https://www.virustotal.com/api/v3/${endpoint}`;

    const response = await httpClient.request(url, {
      method: 'GET',
      headers: {
        'x-apikey': apiKey,
        'Accept': 'application/json',
      },
      timeoutMs: this.config?.timeoutMs || 10000,
    });

    const attributes = response.data?.data?.attributes;
    if (!attributes) {
      throw new Error('Invalid payload received from VirusTotal API');
    }

    const stats = attributes.last_analysis_stats || {};
    const maliciousCount: number = stats.malicious || 0;
    const totalCount: number = (stats.harmless || 0) + (stats.malicious || 0) + (stats.suspicious || 0) + (stats.undetected || 0);

    const confidence = totalCount > 0 ? Math.round((maliciousCount / totalCount) * 100) : 0;

    let risk: RiskLevel = totalCount > 0 ? 'none' : 'unknown';
    if (maliciousCount >= 10) risk = 'critical';
    else if (maliciousCount >= 5) risk = 'high';
    else if (maliciousCount >= 2) risk = 'medium';
    else if (maliciousCount >= 1) risk = 'low';

    return {
      indicator,
      type,
      risk,
      confidence,
      source: this.id,
      providerName: this.name,
      isConfigured: true,
      timestamp: Date.now(),
      country: attributes.country,
      asn: attributes.asn ? `AS${attributes.asn}` : undefined,
      asnOwner: attributes.as_owner,
      tags: attributes.tags || [],
      malwareFamily: attributes.popular_threat_classification?.suggested_threat_label,
      rawResponse: response.data,
      httpStatus: response.status,
      requestDurationMs: response.durationMs,
      metadata: {
        lastAnalysisStats: stats,
        reputation: attributes.reputation,
        meaningfulName: attributes.meaningful_name,
        typeDescription: attributes.type_description,
      },
    };
  }

  public async healthCheck(): Promise<boolean> {
    if (!this.config?.apiKey) return false;
    try {
      // Light healthcheck query on 8.8.8.8
      await this.query('8.8.8.8', 'ip');
      return true;
    } catch (err: any) {
      this.log.warn(`Health check failed for ${this.name}: ${err.message}`);
      throw err;
    }
  }
}
