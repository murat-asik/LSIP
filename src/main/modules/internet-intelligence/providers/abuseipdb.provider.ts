import { BaseIntelligenceProvider } from '../base-provider';
import { IndicatorType, IntelligenceObject, ProviderCapabilities, RiskLevel } from '../types';
import { httpClient } from '../http-client';

export class AbuseIPDBProvider extends BaseIntelligenceProvider {
  public readonly id = 'abuseipdb';
  public readonly name = 'AbuseIPDB';

  public readonly capabilities: ProviderCapabilities = {
    supportedTypes: ['ip'],
    requiresApiKey: true,
    supportsBulk: false,
  };

  public async query(indicator: string, type: IndicatorType): Promise<IntelligenceObject> {
    if (!this.isSupported(type)) {
      throw new Error(`Indicator type ${type} is not supported by ${this.name}`);
    }
    this.checkApiKeyRequired();

    const apiKey = this.config!.apiKey!;
    const url = `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(indicator)}&maxAgeInDays=90&verbose`;


    const response = await httpClient.request(url, {
      method: 'GET',
      headers: {
        'Key': apiKey,
        'Accept': 'application/json',
      },
      timeoutMs: this.config?.timeoutMs || 10000,
    });


    const data = response.data?.data;
    if (!data) {
      throw new Error('Invalid payload received from AbuseIPDB API');
    }

    const abuseScore: number = data.abuseConfidenceScore ?? data.confidenceScore ?? 0;
    const totalReports: number = data.totalReports ?? data.reportsCount ?? 0;

    let risk: RiskLevel = 'none';
    if (abuseScore >= 80 || totalReports >= 100) risk = 'critical';
    else if (abuseScore >= 50 || totalReports >= 20) risk = 'high';
    else if (abuseScore >= 20 || totalReports >= 5) risk = 'medium';
    else if (abuseScore > 0 || totalReports > 0) risk = 'low';

    const confidence = abuseScore > 0 ? abuseScore : (totalReports > 0 ? Math.min(100, Math.max(50, totalReports)) : 0);

    const resultObject: IntelligenceObject = {
      indicator,
      type: 'ip',
      risk,
      confidence: confidence,
      source: this.id,
      providerName: this.name,
      isConfigured: true,
      timestamp: Date.now(),
      country: data.countryCode,
      asn: data.asn ? `AS${data.asn}` : undefined,
      asnOwner: data.isp,
      tags: data.usageType ? [data.usageType] : [],
      metadata: {
        domain: data.domain,
        totalReports: totalReports,
        numDistinctUsers: data.numDistinctUsers,
        lastReportedAt: data.lastReportedAt,
        usageType: data.usageType,
        isTor: data.isTor || false,
        isWhitelisted: data.isWhitelisted || false,
        isPublic: data.isPublic !== undefined ? data.isPublic : true,
        hostnames: data.hostnames || [],
        reports: data.reports || [],
        countryName: data.countryName,
        ipVersion: data.ipVersion,
      },
      rawResponse: response.data,
      httpStatus: response.status,
      requestDurationMs: response.durationMs,
    };


    return resultObject;
  }

  public async healthCheck(): Promise<boolean> {
    if (!this.config?.apiKey) return false;
    try {
      // Test query on 8.8.8.8
      await this.query('8.8.8.8', 'ip');
      return true;
    } catch (err: any) {
      this.log.warn(`Health check failed for ${this.name}: ${err.message}`);
      throw err;
    }
  }
}
