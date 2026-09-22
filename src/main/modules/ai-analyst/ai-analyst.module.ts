import { ipcMain } from 'electron';
import { BaseModule } from '../base-module';
import { databaseManager } from '../../core/database-manager';

export interface AiAnalystSummary {
  riskScore: number | null;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN';
  executiveSummary: string;
  attackSurfaceOverview: string;
  exposedServicesAnalysis: string;
  certificateHealthAnalysis: string;
  securityHeadersAnalysis: string;
  threatIntelligenceSynthesis: string;
  recommendedMitigations: string[];
}

export class AiAnalystModule extends BaseModule {
  public readonly name = 'ai-analyst';
  public readonly displayName = 'AI Security Analyst';
  public readonly version = '1.0.0';

  public async initialize(): Promise<void> {
    this.initLogger();
    this.registerIpcHandlers();
    this.logger.info('AI Security Analyst module initialized.');
  }

  public async shutdown(): Promise<void> {
    this.unregisterIpcHandlers();
    this.logger.info('AI Security Analyst module shut down.');
  }

  private registerIpcHandlers() {
    this.registerRawIpcHandler('ai-analyst:analyze', async (_event, inputData?: any) => {
      try {
        const assets = await databaseManager.queryAll('assets', 'SELECT * FROM assets LIMIT 20');
        const openPorts = await databaseManager.queryAll('assets', 'SELECT * FROM asset_ports WHERE state = "open" LIMIT 50');
        const redteamPorts = await databaseManager.queryAll('redteam', 'SELECT * FROM redteam_ports WHERE state = "open" LIMIT 50');
        const httpScans = await databaseManager.queryAll('redteam', 'SELECT * FROM redteam_http_analysis LIMIT 10');
        const sslScans = await databaseManager.queryAll('redteam', 'SELECT * FROM redteam_ssl_inspection LIMIT 10');
        const dfirEvidence = await databaseManager.queryAll('dfir', 'SELECT * FROM dfir_evidence LIMIT 10');

        const totalExposedPorts = openPorts.length + redteamPorts.length;
        const totalEvidenceItems = dfirEvidence.length;
        const missingHsts = httpScans.filter((h: any) => h.hsts === 0).length;
        const expiredCerts = sslScans.filter((s: any) => s.is_expired === 1).length;

        let riskScore = 15;
        if (totalExposedPorts > 5) riskScore += 25;
        if (missingHsts > 0) riskScore += 15;
        if (expiredCerts > 0) riskScore += 20;
        if (totalEvidenceItems > 0) riskScore += 10;
        riskScore = Math.min(100, riskScore);

        let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
        if (riskScore >= 75) riskLevel = 'CRITICAL';
        else if (riskScore >= 50) riskLevel = 'HIGH';
        else if (riskScore >= 30) riskLevel = 'MEDIUM';

        const hasMeasurements = totalExposedPorts > 0 || httpScans.length > 0 || sslScans.length > 0;
        const summary: AiAnalystSummary = {
          riskScore: hasMeasurements ? riskScore : null,
          riskLevel: hasMeasurements ? riskLevel : 'UNKNOWN',
          executiveSummary: hasMeasurements ? `Ölçüm kapsamıyla sınırlı kural tabanlı özet: ${totalExposedPorts} açık port kaydı, ${httpScans.length} HTTP ve ${sslScans.length} TLS ölçümü değerlendirildi. Risk puanı ${riskScore}/100; ${totalEvidenceItems} delil kaydı mevcut. Bu puan bütün sistemin güvenli olduğunu doğrulamaz.` : 'Risk değerlendirmesi için yeterli güvenlik ölçümü bulunamadı; güven durumu bilinmiyor.',
          attackSurfaceOverview: `Kayıt kapsamı: ${assets.length} varlık ve ${totalExposedPorts} açık port kaydı. Sonuçlar farklı zaman/hedeflere ait olabilir; envanterin tamamını veya güncel ağ durumunu kanıtlamaz.`,
          exposedServicesAnalysis: openPorts.length > 0 
            ? `Active service telemetry detected listening services on TCP ports: ${openPorts.map((p: any) => p.port + '/' + (p.service || 'unknown')).join(', ')}. Recommend verifying binding interface configurations.`
            : 'Servis ölçümü bulunamadı; bu sonuç açık servis olmadığı anlamına gelmez.',
          certificateHealthAnalysis: expiredCerts > 0 
            ? `CRITICAL ALERT: Detected ${expiredCerts} expired TLS certificates. Expired certificates degrade transport layer confidentiality and trigger browser warnings.`
            : (sslScans.length ? 'Kayıtlı taramalarda süresi dolmuş sertifika görülmedi; zincir güveni ayrıca doğrulanmalıdır.' : 'Sertifika ölçümü yok; güven durumu bilinmiyor.'),
          securityHeadersAnalysis: missingHsts > 0 
            ? `Web security header inspection revealed ${missingHsts} endpoint(s) missing HTTP Strict Transport Security (HSTS).`
            : (httpScans.length ? 'Kayıtlı ölçümlerde HSTS eksikliği görülmedi; diğer başlıklar ayrı değerlendirilmelidir.' : 'HTTP başlığı ölçümü yok; güven durumu bilinmiyor.'),
          threatIntelligenceSynthesis: 'Bu özet IOC/C2 taraması yapmaz. İlgili istihbarat ve IOC sekmelerindeki ölçümleri ayrıca inceleyin.',
          recommendedMitigations: [
            'Enforce HSTS (Strict-Transport-Security: max-age=31536000; includeSubDomains) on web applications.',
            'Restrict listening management ports (SSH 22, RDP 3389, SMB 445) to authorized internal IP ranges.',
            'Review forensic registry persistence locations (HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run).',
            'Ensure TLS 1.3 or 1.2 is enforced with strong AEAD cipher suites (AES-256-GCM, CHACHA20-POLY1305).',
            'Maintain continuous FIM (File Integrity Monitoring) on core system binaries.'
          ]
        };

        return { success: true, data: summary };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });
  }
}
