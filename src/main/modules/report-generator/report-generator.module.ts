import { dialog, BrowserWindow } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
import { BaseModule } from '../base-module';
import { databaseManager } from '../../core/database-manager';
import { ReportConfig, ReportResult } from '../../../shared/types/report.types';

export class ReportGeneratorModule extends BaseModule {
  public readonly name = 'reports';
  public readonly displayName = 'Report Generator';

  public async initialize(): Promise<void> {
    this.logger.info('Initializing Report Generator Module...');

    this.registerIpcHandler<ReportConfig, ReportResult>('generate', async (config) => {
      return this.generateReport(config);
    });

    this.logger.info('Report Generator Module initialized.');
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down Report Generator Module...');
    this.unregisterIpcHandlers();
  }

  private async generateReport(config: ReportConfig): Promise<ReportResult> {
    if (!config || !['json', 'html', 'csv', 'pdf'].includes(config.format)) throw new Error('Geçersiz rapor biçimi');
    const startTime = Date.now();
    try {
      // 1. Prompt user for save location
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Save Security Intelligence Report',
        defaultPath: path.join(os.homedir(), 'Desktop', `LSIP_Report_${new Date().toISOString().replace(/[:.]/g, '-')}.${config.format}`),
        filters: [
          { name: config.format.toUpperCase(), extensions: [config.format] }
        ]
      });

      if (canceled || !filePath) {
        return { success: false, errorMessage: 'Report generation canceled by user.' };
      }

      // 2. Gather Data
      const reportData: any = {
        metadata: {
          generatedAt: new Date().toISOString(),
          hostname: os.hostname(),
          platform: os.platform(),
          lsipVersion: '3.0.0'
        }
      };

      if(config.includeSystemInfo) {
        reportData.systemInfo={hostname:os.hostname(),osType:os.type(),release:os.release(),architecture:os.arch(),uptimeSeconds:os.uptime(),totalMemoryBytes:os.totalmem(),freeMemoryBytes:os.freemem(),logicalCpuCount:os.cpus().length};
      }
      if (config.includeReputation) {
        const rep = await databaseManager.queryAll<any>('reputation', 'SELECT * FROM host_reputation ORDER BY risk_score DESC LIMIT 100');
        reportData.reputation = rep;
      }

      if (config.includeAnomalies) {
        // FIM changes
        const fim = await databaseManager.queryAll<any>('ioc', "SELECT * FROM fim_changes WHERE severity IN ('high', 'critical') ORDER BY timestamp DESC LIMIT 50");
        reportData.fimAnomalies = fim;
      }

      if (config.includeConnections) {
        const conns = await databaseManager.queryAll<any>('network', "SELECT process_name, remote_address, remote_port, state FROM connections WHERE remote_address != '127.0.0.1' LIMIT 200");
        reportData.activeConnections = conns;
      }

      if (config.includeTimeline) {
        const events = await databaseManager.queryAll<any>('events', "SELECT event_id, source, level, message, timestamp FROM events ORDER BY timestamp DESC LIMIT 300");
        reportData.recentEvents = events;
      }

      let outputContent = '';

      if (config.format === 'json') {
        outputContent = JSON.stringify(reportData, null, 2);
        await fs.writeFile(filePath, outputContent, 'utf-8');
      } else if (config.format === 'html') {
        outputContent = this.generateHtml(reportData);
        await fs.writeFile(filePath, outputContent, 'utf-8');
      } else if (config.format === 'csv') {
        outputContent = this.generateCsv(reportData);
        await fs.writeFile(filePath, outputContent, 'utf-8');
      } else if (config.format === 'pdf') {
        outputContent = this.generateHtml(reportData);
        const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, javascript: false } });
        try {
        await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(outputContent));
        const pdfData = await win.webContents.printToPDF({
          printBackground: true,
          margins: { top: 1, bottom: 1, left: 1, right: 1 },
        });
        await fs.writeFile(filePath, pdfData);
        } finally { win.close(); }
      }

      const stats = await fs.stat(filePath);

      return {
        success: true,
        filePath,
        sizeBytes: stats.size,
        generationTimeMs: Date.now() - startTime
      };

    } catch (err: any) {
      this.logger.error('Failed to generate report', { error: err.message });
      return { success: false, errorMessage: err.message };
    }
  }

  private generateHtml(data: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
        <title>LSIP Security Report</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0a0e17; color: #f1f5f9; padding: 20px; }
          h1, h2 { color: #3b82f6; }
          .card { background: #1e293b; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #334155; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #334155; padding: 8px; text-align: left; }
          th { background: #0f172a; }
          .critical { color: #ef4444; }
          .high { color: #f97316; }
        </style>
      </head>
      <body>
        <h1>Local Security Intelligence Platform - Report</h1>
        <div class="card">
          <h2>Metadata</h2>
          <p>Generated At: ${escapeHtml(data.metadata.generatedAt)}</p>
          <p>Hostname: ${escapeHtml(data.metadata.hostname)}</p>
        </div>
        <div class="card">
          <h2>Raw Data Extract</h2>
          <pre style="white-space: pre-wrap; word-wrap: break-word; font-size: 12px;">${escapeHtml(JSON.stringify(data, null, 2))}</pre>
        </div>
      </body>
      </html>
    `;
  }

  private generateCsv(data: any): string {
    const lines: string[] = [];
    const escapeCell = (val: any) => {
      if (val === null || val === undefined) return '';
      let str = String(val);
      if (/^[\s\u0000-\u001f]*[=+@-]/.test(str)) str = "'" + str;
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    const row = (cells: any[]) => cells.map(escapeCell).join(',');

    // Metadata section
    lines.push('SECTION,LSIP Security Report Metadata');
    lines.push(row(['Generated At', data.metadata?.generatedAt || '']));
    lines.push(row(['Hostname', data.metadata?.hostname || '']));
    lines.push(row(['Platform', data.metadata?.platform || '']));
    lines.push(row(['LSIP Version', data.metadata?.lsipVersion || '']));
    lines.push('');

    if(data.systemInfo) {
      lines.push('SECTION,System Information');
      for(const [key,value] of Object.entries(data.systemInfo))lines.push(row([key,value]));
      lines.push('');
    }

    // Reputation section
    if (data.reputation && data.reputation.length > 0) {
      lines.push('SECTION,Host Reputation');
      lines.push(row(['Host ID', 'Risk Score', 'Confidence', 'Last Calculated']));
      for (const r of data.reputation) {
        lines.push(row([r.host_id, r.risk_score, r.confidence, new Date(r.last_calculated).toISOString()]));
      }
      lines.push('');
    }

    // FIM Anomalies section
    if (data.fimAnomalies && data.fimAnomalies.length > 0) {
      lines.push('SECTION,FIM Anomalies');
      lines.push(row(['Timestamp', 'File Path', 'Change Type', 'Severity', 'Previous Hash', 'Current Hash']));
      for (const f of data.fimAnomalies) {
        lines.push(row([
          new Date(f.timestamp).toISOString(),
          f.file_path, f.change_type || f.action,
          f.severity, f.previous_hash || '', f.current_hash || ''
        ]));
      }
      lines.push('');
    }

    // Active Connections section
    if (data.activeConnections && data.activeConnections.length > 0) {
      lines.push('SECTION,Active Connections');
      lines.push(row(['Process', 'Remote Address', 'Remote Port', 'State']));
      for (const c of data.activeConnections) {
        lines.push(row([c.process_name, c.remote_address, c.remote_port, c.state]));
      }
      lines.push('');
    }

    // Recent Events section
    if (data.recentEvents && data.recentEvents.length > 0) {
      lines.push('SECTION,Recent Security Events');
      lines.push(row(['Timestamp', 'Event ID', 'Source', 'Level', 'Message']));
      for (const e of data.recentEvents) {
        lines.push(row([
          new Date(e.timestamp).toISOString(),
          e.event_id, e.source, e.level,
          (e.message || '').substring(0, 200)
        ]));
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}
export default ReportGeneratorModule;
