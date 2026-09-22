import { BaseIntelligenceProvider } from '../base-provider';
import { IndicatorType, IntelligenceObject, ProviderCapabilities, RiskLevel } from '../types';
import { httpClient } from '../http-client';

export class HybridAnalysisProvider extends BaseIntelligenceProvider {
  public readonly id = 'hybridanalysis';
  public readonly name = 'Hybrid Analysis';

  public readonly capabilities: ProviderCapabilities = {
    supportedTypes: ['hash'],
    requiresApiKey: true,
    supportsBulk: false,
  };

  public async query(indicator: string, type: IndicatorType): Promise<IntelligenceObject> {
    if (!this.isSupported(type)) {
      throw new Error(`Indicator type ${type} is not supported by ${this.name}`);
    }
    this.checkApiKeyRequired();

    const apiKey = this.config!.apiKey!;
    const url = 'https://www.hybrid-analysis.com/api/v2/search/hash';

    const response = await httpClient.request(url, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'User-Agent': 'Falcon Sandbox',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: `hash=${encodeURIComponent(indicator)}`,
      timeoutMs: this.config?.timeoutMs || 10000,
    });

    const data = response.data;
    if (!data || !Array.isArray(data)) {
      throw new Error('Invalid payload received from Hybrid Analysis API');
    }

    if (data.length === 0) {
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
        metadata: { reports: 0 }
      };
    }

    // Process the reports
    let maxThreatScore = 0;
    let verdict = 'unknown';

    for (const report of data) {
      if (report.threat_score > maxThreatScore) {
        maxThreatScore = report.threat_score;
      }
      if (report.verdict === 'malicious') {
        verdict = 'malicious';
      } else if (report.verdict === 'suspicious' && verdict !== 'malicious') {
        verdict = 'suspicious';
      }
    }

    let risk: RiskLevel = 'none';
    if (verdict === 'malicious' || maxThreatScore >= 80) {
      risk = 'critical';
    } else if (maxThreatScore >= 60) {
      risk = 'high';
    } else if (verdict === 'suspicious' || maxThreatScore >= 40) {
      risk = 'medium';
    } else if (maxThreatScore > 0) {
      risk = 'low';
    }

    return {
      indicator,
      type,
      risk,
      confidence: maxThreatScore > 0 ? maxThreatScore : 100,
      source: this.id,
      providerName: this.name,
      isConfigured: true,
      timestamp: Date.now(),
      malwareFamily: data[0]?.vxfamily,
      tags: data[0]?.tags || [],
      rawResponse: response.data,
      httpStatus: response.status,
      requestDurationMs: response.durationMs,
      metadata: {
        reports: data.length,
        maxThreatScore,
        verdict,
        firstReport: data[0],
      },
    };
  }

  public async healthCheck(): Promise<boolean> {
    if (!this.config?.apiKey) return false;
    try {
      await this.query('44d88612fea8a8f36de82e1278abb02f', 'hash');
      return true;
    } catch (err: any) {
      this.log.warn(`Health check failed for ${this.name}: ${err.message}`);
      throw err;
    }
  }
}
