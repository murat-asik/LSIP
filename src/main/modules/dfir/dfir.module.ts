import { text } from '../../core/security';
import { ipcMain } from 'electron';
import { BaseModule } from '../base-module';
import { databaseManager } from '../../core/database-manager';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { analyzeForensic } from './forensic-service';
import { acquireEvidence, verifyEvidence } from './evidence-vault';
import { runPowerShell } from '../../core/powershell';

export class DfirModule extends BaseModule {
  public readonly name = 'dfir';
  public readonly displayName = 'Digital Forensics & Incident Response';
  public readonly version = '1.0.0';

  public async initialize(): Promise<void> {
    this.initLogger();
    await databaseManager.queryExec('dfir', 'CREATE TABLE IF NOT EXISTS dfir_analysis (artifact_type TEXT NOT NULL, source TEXT NOT NULL, collected_at INTEGER NOT NULL, result_json TEXT NOT NULL, PRIMARY KEY(artifact_type, source))');
    await databaseManager.queryExec('dfir', 'CREATE TABLE IF NOT EXISTS dfir_analysis_runs (id TEXT PRIMARY KEY, artifact_type TEXT NOT NULL, source TEXT NOT NULL, collected_at INTEGER NOT NULL, result_json TEXT NOT NULL)');
    await databaseManager.queryExec('dfir', "INSERT OR IGNORE INTO dfir_analysis_runs SELECT 'legacy:' || hex(artifact_type) || ':' || hex(source), artifact_type, source, collected_at, result_json FROM dfir_analysis");
    await databaseManager.queryExec('dfir', 'CREATE INDEX IF NOT EXISTS idx_analysis_runs_type_time ON dfir_analysis_runs(artifact_type, collected_at DESC)');
    await databaseManager.queryExec('dfir', `CREATE TRIGGER IF NOT EXISTS acquired_evidence_custody AFTER INSERT ON dfir_evidence WHEN NEW.status = 'acquired' BEGIN INSERT INTO dfir_chain_of_custody(id,evidence_id,action,performed_by,timestamp,notes,hash_verification) VALUES('COC-' || lower(hex(randomblob(16))),NEW.id,'ENCRYPTED_COPY_ACQUIRED','Local analyst',NEW.added_at,'Source read and encrypted; SHA-256 recorded',NEW.file_hash); END`);
    this.registerIpcHandler('analyze-artifact', analyzeForensic);
    this.registerIpcHandler('acquire-evidence', acquireEvidence);
    this.registerIpcHandler('verify-evidence', verifyEvidence);
    this.registerIpcHandler('analysis-history', async ({type}:{type:string}) => databaseManager.queryAll('dfir','SELECT artifact_type,source,collected_at,result_json FROM dfir_analysis_runs WHERE artifact_type = ? ORDER BY collected_at DESC LIMIT 20',[type]));
    this.registerIpcHandlers();
    this.logger.info('DFIR module initialized.');
  }

  public async shutdown(): Promise<void> {
    this.unregisterIpcHandlers();
    this.logger.info('DFIR module shut down.');
  }

  private registerIpcHandlers() {
    // 1. Evidence List & Add
    this.registerRawIpcHandler('dfir:get-evidence', async () => {
      try {
        const rows = await databaseManager.queryAll('dfir', 'SELECT * FROM dfir_evidence ORDER BY added_at DESC');
        return { success: true, data: rows };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });

    this.registerRawIpcHandler('dfir:add-evidence', async (_event, evidence: { title: string; type: string; sourcePath?: string }) => {
      try {
        text(evidence?.title, 'Delil başlığı', 500); text(evidence?.type, 'Delil türü', 100);
        const id = 'EV-' + crypto.randomUUID();
        let hash = 'N/A';
        let size = 0;

        if (evidence.sourcePath) {
          text(evidence.sourcePath, 'Delil yolu');
          const file = await fs.promises.open(evidence.sourcePath, 'r');
          try {
            const before = await file.stat();
            if (!before.isFile()) throw new Error('Delil yolu normal bir dosya olmalı.');
            size = before.size;
            const digest = crypto.createHash('sha256');
            for await (const chunk of file.createReadStream({ autoClose: false })) digest.update(chunk);
            const after = await file.stat();
            if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) throw new Error('Dosya okuma sırasında değişti; delil kaydedilmedi.');
            hash = digest.digest('hex');
          } finally { await file.close(); }
        } else if (evidence.type.toLowerCase() === 'file') {
          throw new Error('Dosya delili için kaynak yolu gerekli.');
        }

        const now = Date.now();
        await databaseManager.queryRun('dfir', `
          INSERT INTO dfir_evidence (id, title, type, source_path, file_hash, file_size, status, added_at, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, evidence.title, evidence.type, evidence.sourcePath || '', hash, size, evidence.sourcePath ? 'hashed' : 'manual', now, JSON.stringify({ provenance: 'user-supplied', acquiredCopy: false })]);

        // Log Chain of Custody
        await databaseManager.queryRun('dfir', `
          INSERT INTO dfir_chain_of_custody (id, evidence_id, action, performed_by, timestamp, notes, hash_verification)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, ['COC-' + crypto.randomUUID(), id, 'EVIDENCE_ADDED', 'LSIP_DFIR_ANALYST', now, `Evidence item ${evidence.title} acquired.`, hash]);

        return { success: true, data: { id, hash, size } };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });

    // 2. Memory Analysis
    this.registerRawIpcHandler('dfir:get-memory-analysis', async () => {
      try {
        if (process.platform === 'win32') {
          try {
            const output = await new Promise<string>((resolve, reject) => runPowerShell("Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 100 Id, ProcessName, WorkingSet64, Handles, NPM, @{Name='KernelTimeMs';Expression={$_.PrivilegedProcessorTime.TotalMilliseconds}} | ConvertTo-Json", (error, stdout, stderr) => error ? reject(new Error(stderr || error.message)) : resolve(stdout)));
            const parsed = JSON.parse(output);
            const procs = Array.isArray(parsed) ? parsed : [parsed];
            const memoryArtifacts = procs.filter((p: any) => p && p.Id).map((p: any) => ({
              pid: p.Id,
              name: (p.ProcessName || 'Unknown') + '.exe',
              sizeMb: parseFloat(((p.WorkingSet64 || 0) / (1024 * 1024)).toFixed(1)),
              kernelTimeMs: p.KernelTimeMs ?? null,
              handleCount: p.Handles || 0,
              nonPagedPoolKb: Math.round((p.NPM || 0) / 1024),
              suspicious: ['cmd', 'powershell', 'rundll32', 'certutil'].includes((p.ProcessName || '').toLowerCase()),
              reason: ['cmd', 'powershell', 'rundll32', 'certutil'].includes((p.ProcessName || '').toLowerCase()) ? 'High-risk shell execution detected' : undefined,
            }));
            if (memoryArtifacts.length > 0) {
              return { success: true, data: memoryArtifacts };
            }
          } catch (e) {
            // fallback if PowerShell invocation fails
          }
        }
        return { success: false, data: [], error: 'Bellek süreç bilgisi toplanamadı; sonuç bilinmiyor.' };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });

    // 3. Registry Explorer
    this.registerRawIpcHandler('dfir:get-registry-keys', async () => {
      try {
        let keys = await databaseManager.queryAll('dfir', 'SELECT * FROM dfir_registry_keys');

        return { success: true, data: keys };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });

    // 4. Artifact Parsers
    this.registerRawIpcHandler('dfir:get-artifacts', async (_event, artifactType: string) => {
      try {
        switch (artifactType) {
          case 'prefetch':
            let prefetch = await databaseManager.queryAll('dfir', 'SELECT * FROM dfir_prefetch');

            return { success: true, data: prefetch };

          case 'amcache':
            let amcache = await databaseManager.queryAll('dfir', 'SELECT * FROM dfir_amcache');

            return { success: true, data: amcache };

          case 'shimcache':
            let shimcache = await databaseManager.queryAll('dfir', 'SELECT * FROM dfir_shimcache');

            return { success: true, data: shimcache };

          case 'jumplists':
            let jumplists = await databaseManager.queryAll('dfir', 'SELECT * FROM dfir_jumplists');

            return { success: true, data: jumplists };

          case 'srum':
            let srum = await databaseManager.queryAll('dfir', 'SELECT * FROM dfir_srum');

            return { success: true, data: srum };

          case 'usn':
            let usn = await databaseManager.queryAll('dfir', 'SELECT * FROM dfir_usn_journal');

            return { success: true, data: usn };

          case 'recycle':
          case 'recycle_bin':
            let recycle = await databaseManager.queryAll('dfir', 'SELECT * FROM dfir_recycle_bin');

            return { success: true, data: recycle };

          default:
            return { success: false, error: `Unknown artifact type: ${artifactType}` };
        }
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });

    // 5. Chain of Custody
    this.registerRawIpcHandler('dfir:get-chain-of-custody', async () => {
      try {
        const rows = await databaseManager.queryAll('dfir', 'SELECT * FROM dfir_chain_of_custody ORDER BY timestamp DESC');
        return { success: true, data: rows };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });
  }
}
