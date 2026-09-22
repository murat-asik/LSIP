import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { app } from 'electron';
import { Worker } from 'worker_threads';
import { BaseModule } from '../base-module';
import { PluginInfo, PluginSummary } from '../../../shared/types/plugin.types';

export class PluginSystemModule extends BaseModule {
  public readonly name = 'plugins';
  public readonly displayName = 'Plugin System';
  private pluginsPath = path.join(app.getPath('userData'), 'plugins');
  private loadedPlugins: PluginInfo[] = [];
  private workers = new Map<string, Worker>();
  private scanning: Promise<void> | null = null;

  public async initialize(): Promise<void> {
    await fs.mkdir(this.pluginsPath, { recursive: true });
    await this.scanAndLoadPlugins();
    this.registerIpcHandler<void, PluginSummary>('summary', async () => ({
      loadedPlugins: this.loadedPlugins.length,
      activePlugins: this.loadedPlugins.filter(p => p.status === 'active').length,
      errorPlugins: this.loadedPlugins.filter(p => p.status === 'error').length,
      plugins: this.loadedPlugins,
    }));
    this.registerIpcHandler<void, boolean>('rescan', async () => { await this.scanAndLoadPlugins(); return true; });
  }

  private async stopWorkers(): Promise<void> {
    await Promise.all([...this.workers.values()].map(worker => new Promise<void>(resolve => {
      let finished = false;
      const finish = () => { if (finished) return; finished = true; clearTimeout(timer); void worker.terminate().finally(resolve); };
      const timer = setTimeout(finish, 2000);
      worker.once('exit', finish);
      worker.on('message', message => { if (message?.type === 'stopped') finish(); });
      worker.postMessage('shutdown');
    })));
    this.workers.clear();
  }
  public async shutdown(): Promise<void> {
    await this.scanning;
    await this.stopWorkers();
    this.loadedPlugins = [];
    this.unregisterIpcHandlers();
  }
  private async scanAndLoadPlugins(): Promise<void> {
    if (this.scanning) return this.scanning;
    this.scanning = this.scan();
    try { await this.scanning; } finally { this.scanning = null; }
  }
  private async scan(): Promise<void> {
    await this.stopWorkers();
    this.loadedPlugins = [];
    // This is a trust allowlist, not an OS sandbox. Only reviewed local code may run.
    let trusted: Record<string, string> = {};
    try {
      trusted = JSON.parse(await fs.readFile(path.join(this.pluginsPath, 'trusted-plugins.json'), 'utf8'));
      if (!trusted || typeof trusted !== 'object' || Array.isArray(trusted)) throw new Error('Invalid plugin trust manifest');
    } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
    for (const file of (await fs.readdir(this.pluginsPath)).filter(f => f.endsWith('.js')).slice(0, 100)) {
      const fullPath = path.join(this.pluginsPath, file);
      const info: PluginInfo = { id: file, name: file, version: '0.0.0', author: '', description: '', filePath: fullPath, status: 'disabled' };
      this.loadedPlugins.push(info);
      try {
        const stat = await fs.lstat(fullPath);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) throw new Error('Plugin must be a regular file under 1 MiB');
        const source = await fs.readFile(fullPath, 'utf8');
        const hash = crypto.createHash('sha256').update(source).digest('hex');
        if (!Object.hasOwn(trusted, file) || trusted[file] !== hash) {
          info.loadError = 'Plugin is not trusted or its SHA-256 has changed';
          continue;
        }
        const worker = new Worker(path.join(__dirname, 'plugin-worker.js'), {
          workerData: { source, fullPath }, resourceLimits: { maxOldGenerationSizeMb: 128 },
        });
        this.workers.set(file, worker);
        worker.on('error', error => { info.status = 'error'; info.loadError = error.message; });
        worker.on('exit', code => { if (info.status === 'active') { info.status = 'error'; info.loadError = `Plugin stopped (${code})`; } });
        const metadata = await new Promise<Record<string, string>>((resolve, reject) => {
          const timer = setTimeout(() => { void worker.terminate(); reject(new Error('Plugin initialization timed out')); }, 5000);
          const done = (error?: Error, value?: Record<string, string>) => { clearTimeout(timer); error ? reject(error) : resolve(value!); };
          worker.once('error', error => done(error));
          worker.once('exit', code => done(new Error(`Plugin exited before initialization (${code})`)));
          worker.once('message', result => result.type === 'ready' ? done(undefined, result.metadata) : done(new Error(result.error || 'Plugin initialization failed')));
        });
        Object.assign(info, metadata, { status: 'active' });
      } catch (error: any) {
        info.status = 'error'; info.loadError = error.message;
        const worker = this.workers.get(file);
        if (worker) { await worker.terminate(); this.workers.delete(file); }
      }
    }
  }
}
export default PluginSystemModule;
