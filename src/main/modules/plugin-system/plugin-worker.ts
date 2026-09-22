import { parentPort, workerData } from 'worker_threads';
import path from 'path';
import Module from 'module';

// Trusted plugins execute away from Electron's main thread. This is not a permission sandbox.
async function start() {
  const pluginModule = new (Module as any)(workerData.fullPath);
  pluginModule.filename = workerData.fullPath;
  pluginModule.paths = (Module as any)._nodeModulePaths(path.dirname(workerData.fullPath));
  pluginModule._compile(workerData.source, workerData.fullPath);
  const plugin = pluginModule.exports;
  if (!plugin || typeof plugin !== 'object') throw new Error('Plugin must export an object');
  if (typeof plugin.init === 'function') await plugin.init();
  const metadata: Record<string, string> = {};
  for (const key of ['id', 'name', 'version', 'author', 'description']) {
    if (typeof plugin[key] === 'string') metadata[key] = plugin[key].slice(0, 4096);
  }
  parentPort!.on('message', async command => {
    if (command !== 'shutdown') return;
    try { if (typeof plugin.shutdown === 'function') await plugin.shutdown(); }
    finally { parentPort!.postMessage({ type: 'stopped' }); }
  });
  parentPort!.postMessage({ type: 'ready', metadata });
}
void start().catch(error => { parentPort!.postMessage({ type: 'error', error: String(error?.message || error) }); });
