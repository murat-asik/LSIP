import { BaseIntelligenceProvider } from '../base-provider';
import { IndicatorType, IntelligenceObject, ProviderCapabilities, RiskLevel } from '../types';
import { httpClient } from '../http-client';

export class UrlHausProvider extends BaseIntelligenceProvider {
  public readonly id = 'urlhaus';
  public readonly name = 'URLhaus';

  public readonly capabilities: ProviderCapabilities = {
    supportedTypes: ['ip', 'domain', 'url'],
    requiresApiKey: true,
    supportsBulk: false,
  };

  public async query(indicator: string, type: IndicatorType): Promise<IntelligenceObject> {
    if (!this.isSupported(type)) {
      throw new Error(`Indicator type ${type} is not supported by ${this.name}`);
    }

    this.checkApiKeyRequired();
    let url = '';
    let body: any = null;

    if (type === 'url') {
      url = 'https://urlhaus-api.abuse.ch/v1/url/';
      body = `url=${encodeURIComponent(indicator)}`;
    } else if (type === 'ip' || type === 'domain') {
      url = 'https://urlhaus-api.abuse.ch/v1/host/';
      body = `host=${encodeURIComponent(indicator)}`;
    }

    const response = await httpClient.request(url, {
      method: 'POST',
      headers: {
        'Auth-Key': this.config!.apiKey!,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body,
      timeoutMs: this.config?.timeoutMs || 10000,
    });

    const data = response.data;
    if (!data || !['ok', 'no_results'].includes(data.query_status)) throw new Error('Invalid payload received from URLhaus API');
    if (data.query_status === 'no_results') {
      return {
        indicator,
        type,
        risk: 'unknown',
        confidence: 0,
        source: this.id,
        providerName: this.name,
        isConfigured: true,
        timestamp: Date.now(),
        rawResponse: response.data,
        httpStatus: response.status,
        requestDurationMs: response.durationMs,
        metadata: data || { query_status: 'no_results' }
      };
    }

    let risk: RiskLevel = 'unknown';
    let confidence = 0;
    
    if (data.query_status === 'ok') {
      if (type === 'url') {
        risk = data.url_status === 'online' ? 'critical' : 'high';
        confidence = 100;
      } else {
        const urlCount = data.urls ? data.urls.length : 0;
        if (urlCount >= 5) risk = 'critical';
        else if (urlCount >= 1) risk = 'high';
        else risk = 'none';
        confidence = 90;
      }
    } else {
      risk = 'none';
      confidence = 100;
    }

    return {
      indicator,
      type,
      risk,
      confidence,
      source: this.id,
      providerName: this.name,
      isConfigured: true,
      timestamp: Date.now(),
      tags: data.tags || [],
      rawResponse: response.data,
      httpStatus: response.status,
      requestDurationMs: response.durationMs,
      metadata: data,
    };
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.query('8.8.8.8', 'ip');
      return true;
    } catch (err: any) {
      this.log.warn(`Health check failed for ${this.name}: ${err.message}`);
      throw err;
    }
  }
}
