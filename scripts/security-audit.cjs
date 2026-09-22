/* Local audit: runs real TypeScript functions with mocked OS, DB, Electron and
 * network boundaries. Never starts LSIP, kills processes or contacts targets.
 * Exit 1 means a security expectation failed; exit 2 means harness error.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { EventEmitter } = require('node:events');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'security-audit');
fs.mkdirSync(output, { recursive: true });
const results = [];
function check(id, title, secure, evidence) {
  results.push({ id, title, status: secure ? 'PASS' : 'FAIL', evidence });
}
function env(extra = {}) {
  const handlers = new Map(), commands = [], fileCommands = [], queries = [], logs = [], modules = new Map();
  const bus = new EventEmitter();
  bus.publish = (name, payload) => bus.emit(name,payload);
  bus.subscribe = (name, fn) => { bus.on(name,fn); return () => bus.off(name,fn); };
  const keyVault = new Map();
  const logger = Object.fromEntries(['info','warn','error','debug'].map(k => [k, (...a) => logs.push(a.join(' '))]));
  const config = { enabled: true, providers: {} };
  const configManager = {
    getModuleConfig: () => config,
    setModuleConfig: (_id, value) => Object.assign(config, value),
    get: () => ({ modules: { 'internet-intelligence': config }, ui: { refreshIntervalMs: 2000 } }),
  };
  const db = {
    queryAll: async (...a) => { queries.push(a); return []; },
    queryGet: async (...a) => { queries.push(a); return undefined; },
    queryRun: async (...a) => { queries.push(a); return { changes: 1 }; },
    queryExec: async (...a) => { queries.push(a); },
  };
  const electron = {
    ipcMain: { handle: (k, f) => handlers.set(k, f), removeHandler: k => handlers.delete(k) },
    safeStorage: { isEncryptionAvailable: () => true,
      encryptString: key => { const id = 'cipher-' + keyVault.size; keyVault.set(id,key); return Buffer.from(id); },
      decryptString: buffer => { if (!keyVault.has(buffer.toString())) throw new Error('Invalid cipher'); return keyVault.get(buffer.toString()); } },
  };
  const boundaries = {
    electron,
    'fs/promises': { opendir: async function* () {} },
    net: { isIPv4: require('net').isIPv4, isIP: require('net').isIP },
    child_process: {
      exec: (command, ...args) => { commands.push(command); args.at(-1)(null, '[]', ''); },
      execFile: (file, argv, ...args) => { fileCommands.push({ file, argv, options: args[0] }); args.at(-1)(null, '[]', ''); }
    },
    ...extra,
  };
  function load(relative) {
    const file = path.resolve(root, relative);
    if (modules.has(file)) return modules.get(file).exports;
    const mod = { exports: {} }; modules.set(file, mod);
    const source = fs.readFileSync(file, 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const localRequire = spec => {
      if (Object.hasOwn(boundaries, spec)) return boundaries[spec];
      if (spec.endsWith('/event-bus')) return { eventBus: bus };
      if (spec.endsWith('/connectivity-manager')) return { connectivityManager: { getState: () => ({ isOnlineMode: true }) } };
      if (spec.endsWith('/logger')) return { createModuleLogger: () => logger };
      if (spec.endsWith('/database-manager')) return { databaseManager: db };
      if (spec.endsWith('/config-manager')) return { configManager };
      if (spec.endsWith('/win32-ffi')) return { Win32Metrics: {} };
      if (['events','path','os','crypto','util','stream','stream/promises'].includes(spec)) return require(spec);
      if (spec.startsWith('.')) {
        let dependency = path.resolve(path.dirname(file), spec);
        if (!path.extname(dependency) || !dependency.endsWith('.ts')) dependency += '.ts';
        return load(path.relative(root, dependency));
      }
      throw new Error('Unmocked boundary blocked: ' + spec);
    };
    const context = vm.createContext({ exports: mod.exports, module: mod, require: localRequire,
      __dirname: path.dirname(file), __filename: file, Buffer, URL, AbortController,
      process: { platform: 'win32', cwd: () => root, env: {} },
      console: { log: (...a) => logs.push(a.join(' ')) },
      queueMicrotask, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
      ...(extra.globals || {}),
    });
    new vm.Script(code, { filename: file }).runInContext(context, { timeout: 3000 });
    return mod.exports;
  }
  const sender = new EventEmitter(); sender.mainFrame = { url: 'file:///audit/index.html', parent: null };
  const event = { sender, senderFrame: sender.mainFrame };
  const foreignEvent = { senderFrame: { url: 'https://untrusted.invalid/', parent: {} }, sender: { id: -1 } };
  if (boundaries.electron.ipcMain) load('src/main/core/security.ts').trustRenderer(sender, 'file:///audit/index.html');
  return { load, handlers, commands, fileCommands, queries, logs, config, electron, configManager, event, foreignEvent, db, bus };
}
async function main() {
  const e = env();
  const { ProcessExplorerModule } = e.load('src/main/modules/process-explorer/process-explorer.module.ts');
  await new ProcessExplorerModule().initialize();
  for (const [channel, pid] of [
    ['process:terminate', '0 & echo LSIP_AUDIT_MARKER'],
    ['process:threads', '0); Write-Output LSIP_AUDIT_MARKER; #'],
    ['process:modules', '0); Write-Output LSIP_AUDIT_MARKER; #'],
  ]) {
    const before = e.commands.length;
    await e.handlers.get(channel)(e.event, { pid });
    check('CMD-' + channel, 'Non-numeric PID must not enter a shell command', e.commands.length === before,
      { channel, captured: e.commands.slice(before), execution: 'mocked; no OS command executed' });
  }
  const { FimModule } = e.load('src/main/modules/fim/fim.module.ts');
  await new FimModule().initialize();
  for (const field of ['path','pattern']) {
    const payload = { path: 'C:\\audit-fixture', pattern: '*.txt' };
    payload[field] = '$(Write-Output LSIP_AUDIT_MARKER)';
    const before = e.commands.length;
    await e.handlers.get('fim:scan')(e.event, payload);
    check('CMD-fim-' + field, 'FIM input must remain literal data', e.commands.length === before && e.fileCommands.length === 0,
      { captured: e.commands.slice(before), execution: 'mocked; PowerShell parsing not executed' });
  }
  const { RdpMonitorModule } = e.load('src/main/modules/rdp-monitor/rdp-monitor.module.ts');
  await new RdpMonitorModule().initialize();
  const beforeRdp = e.commands.length;
  await e.handlers.get('rdp:events')(e.event, { limit: '$(Write-Output LSIP_AUDIT_MARKER)' });
  check('CMD-rdp-limit', 'RDP event limit must be a bounded integer', e.commands.length === beforeRdp,
    { markerReachedShell: e.commands.slice(beforeRdp).some(c => c.includes('LSIP_AUDIT_MARKER')), execution: 'mocked' });
  const { BaseModule } = e.load('src/main/modules/base-module.ts');
  class Probe extends BaseModule { name = 'audit'; displayName = 'Audit'; }
  const probe = new Probe();
  probe.registerIpcHandler('read', async () => 'PROTECTED_FIXTURE');
  let foreign;
  try { foreign = await e.handlers.get('audit:read')(e.foreignEvent, {}); } catch (err) { foreign = { success: false, error: err.message }; }
  check('IPC-origin', 'Reject unknown sender and subframe', foreign.success !== true, foreign);

  const { ReportGeneratorModule } = env({ 'fs/promises': {} }).load('src/main/modules/report-generator/report-generator.module.ts');
  const report = new ReportGeneratorModule();
  const html = report.generateHtml({ metadata: {}, recentEvents: [{ message: '</pre><script>globalThis.LSIP_AUDIT_MARKER=1</script><pre>' }] });
  fs.writeFileSync(path.join(output, 'report-xss-fixture.html'), html);
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  const sandbox = {};
  for (const match of scripts) vm.runInNewContext(match[1], sandbox, { timeout: 1000 });
  check('REPORT-html', 'Report must encode untrusted text as HTML text', scripts.length === 0,
    { scriptElements: scripts.length, harmlessMarkerExecutedInVm: sandbox.LSIP_AUDIT_MARKER === 1, browserExecutionTested: false });
  const csv = report.generateCsv({ metadata: {}, recentEvents: [{ timestamp: 0, event_id: 1, source: 'fixture', level: 1, message: '=1+1' }] });
  check('REPORT-csv', 'Neutralize formula cells', !csv.includes(',=1+1'), { formulaRow: csv.split('\n').find(l => l.includes('=1+1')) });

  const secEnv = env();
  const { secureConfigManager } = secEnv.load('src/main/modules/internet-intelligence/secure-config.ts');
  secureConfigManager.saveProviderConfig({ id: 'fixture', name: 'fixture', apiKey: 'SYNTHETIC-KEY-ONLY', enabled: true });
  check('SECRET-plain', 'Do not persist raw key alongside ciphertext', !JSON.stringify(secEnv.config).includes('SYNTHETIC-KEY-ONLY'), { plaintextStoredWithEncryptionAvailable: secEnv.config.providers.fixture.rawApiKey === 'SYNTHETIC-KEY-ONLY' });
  secEnv.config.providers.fixture.enabled = false;
  check('CONFIG-disabled', 'A stored key must not override disabled state', secureConfigManager.getProviderConfig('fixture').enabled === false, { storedEnabled: false });
  check('SECRET-return', 'UI config response must omit plaintext key', !secureConfigManager.getProviderConfig('fixture').apiKey, { plaintextReturned: !!secureConfigManager.getProviderConfig('fixture').apiKey, onlySyntheticKeyUsed: true });

  let signal;
  const he = env({ globals: { fetch: async (_url, opts) => {
    signal = opts.signal;
    return { status: 200, ok: true, headers: new Map([['content-type','application/json']]), body: { getReader: () => ({
      read: async () => { await new Promise(r => setTimeout(r,60)); return { done: true }; }, releaseLock() {}
    }) } };
  } } });
  const { httpClient } = he.load('src/main/modules/internet-intelligence/http-client.ts');
  const start = Date.now();
  let timedOut = false;
  try { await httpClient.request('https://fixture.invalid/?key=SYNTHETIC-KEY-ONLY', { timeoutMs: 10, retries: 0 }); } catch(err) { timedOut = err.isTimeout === true; }
  check('HTTP-body-timeout', 'Timeout must cover body consumption', signal.aborted && timedOut, { timeoutMs: 10, elapsedMs: Date.now() - start, aborted: signal.aborted });
  check('SECRET-url-log', 'Redact credentials from URL logs', !he.logs.join('\n').includes('SYNTHETIC-KEY-ONLY'), { syntheticKeyLogged: he.logs.join('\n').includes('SYNTHETIC-KEY-ONLY') });

  let socketCount = 0;
  class FakeSocket extends EventEmitter {
    constructor() { super(); socketCount++; }
    setTimeout() {} destroy() {} write() {}
    connect() { queueMicrotask(() => this.emit('error', new Error('synthetic'))); }
  }
  const re = env({ net: { Socket: FakeSocket }, tls: {}, dns: {}, http: {}, https: {} });
  const { RedTeamModule } = re.load('src/main/modules/redteam/redteam.module.ts');
  await new RedTeamModule().initialize();
  await re.handlers.get('redteam:scan-ports')(re.event, { target: 'fixture.invalid', ports: Array(1000).fill(80) });
  check('SCAN-bound', 'Bound and deduplicate scan work before opening sockets', socketCount < 1000, { mockSocketsCreated: socketCount, realConnections: 0 });
  const a = await re.handlers.get('redteam:get-attack-surface')(re.event, { target: 'fixture-a.invalid' });
  const b = await re.handlers.get('redteam:get-attack-surface')(re.event, { target: 'fixture-b.invalid' });
  check('DATA-fabricated', 'Do not return hardcoded CVEs as target findings', !(a.success && JSON.stringify(a.data.cveMatches) === JSON.stringify(b.data.cveMatches) && a.data.cveMatches.length), { first: a.data.cveMatches.map(c => c.cveId), identicalAcrossTargets: JSON.stringify(a.data.cveMatches) === JSON.stringify(b.data.cveMatches), realDiscoveryPerformed: false });

  const de = env({ fs: { promises: { open: async () => { throw new Error('ENOENT: synthetic missing fixture'); } } } });
  const { DfirModule } = de.load('src/main/modules/dfir/dfir.module.ts');
  await new DfirModule().initialize();
  const missing = await de.handlers.get('dfir:add-evidence')(de.event, { title: 'fixture', type: 'file', sourcePath: 'C:\\does-not-exist\\fixture' });
  check('DFIR-missing', 'Missing file evidence must not be marked parsed', !missing.success,
    { result: missing, insertedStatus: de.queries.find(q => q[1].includes('INSERT INTO dfir_evidence'))?.[2]?.[6] });
  await de.handlers.get('dfir:get-artifacts')(de.event, 'prefetch');
  check('DFIR-seed', 'Empty forensic database must not be populated with fabricated artifacts', !de.queries.some(q => q[1].includes('INSERT INTO dfir_prefetch')), { syntheticPrefetchInserted: de.queries.some(q => q[1].includes('INSERT INTO dfir_prefetch')) });

  const se = env({ './scanners/net-scanner': {}, './fingerprint/vendor-lookup': {} });
  const { AssetDiscoveryModule } = se.load('src/main/modules/asset-discovery/asset-discovery.module.ts');
  await new AssetDiscoveryModule().searchAssets("' OR 1=1 --");
  const query = se.queries[0];
  check('SQL-parameterization', 'Search text stays in SQL parameters', !query[1].includes('OR 1=1') && query[2].length > 0, { sql: query[1], params: query[2] });
  const ee = env({ './event-collector': {} });
  const { EventExplorerModule } = ee.load('src/main/modules/event-explorer/event-explorer.module.ts');
  try { await new EventExplorerModule().queryEventsFromDb({ limit: -1 }); } catch { /* Expected validation rejection. */ }
  check('SQL-limit', 'Reject negative or unbounded event query limits', !ee.queries.some(q => q[2]?.includes(-1)), { passedLimit: ee.queries[0]?.[2]?.at(-1) ?? null });

  let bridge;
  const pe = env({ electron: { contextBridge: { exposeInMainWorld: (_n,v) => { bridge = v; } }, ipcRenderer: { invoke: async c => c } } });
  pe.load('src/preload/index.ts');
  let blocked = false;
  try { await bridge.invoke('untrusted:channel'); } catch { blocked = true; }
  check('IPC-prefix-negative', 'Unlisted channel prefix is blocked', blocked, {});
  let admitted;
  try { admitted = await bridge.invoke('process:future-dangerous-action'); } catch { /* Expected whitelist rejection. */ }
  check('IPC-exact-list', 'Reject unlisted actions within known prefixes', !admitted, { admittedChannel: admitted });

  const dllFixture = [{ pid: 42, pname: 'fixture', mname: 'unsigned-fixture.dll', path: 'C:\\Users\\Public\\Windows\\unsigned-fixture.dll', comp: 'Microsoft Fixture (unverified)' }];
  const dl = env({ child_process: { execFile: (_file, _argv, ...args) => args.at(-1)(null, JSON.stringify(dllFixture), '') } });
  const { DllCollector } = dl.load('src/main/modules/dll-scanner/dll-collector.ts');
  const dlls = await DllCollector.getModules(42);
  check('DLL-trust', 'Metadata and path text must not establish signature or system trust', !dlls[0].isSigned && !dlls[0].isSystem, { isSigned: dlls[0].isSigned, isSystem: dlls[0].isSystem, signatureClaimRequiresVerifiedStatus: true });

  let healthCalls = 0;
  const off = env({ './cache-manager': { cacheManager: {} }, '../../core/connectivity-manager': { connectivityManager: { getState: () => ({ isOnlineMode: false }) } }, '../../core/event-bus': { eventBus: { publish() {} } } });
  const { providerManager } = off.load('src/main/modules/internet-intelligence/provider-manager.ts');
  off.config.providers.fixture = { enabled: true };
  providerManager.registerProvider({ id: 'fixture', name: 'fixture', capabilities: { requiresApiKey: false, supportedTypes: ['ip'] }, initialize: async () => {}, healthCheck: async () => { healthCalls++; return true; } });
  await providerManager.getDetailedHealth();
  check('OFFLINE-health', 'Offline health query must not trigger live provider health check', healthCalls === 0, { onlineMode: false, mockedHealthCalls: healthCalls });

  const ai = env();
  const { AiAnalystModule } = ai.load('src/main/modules/ai-analyst/ai-analyst.module.ts');
  await new AiAnalystModule().initialize();
  const emptyAnalysis = await ai.handlers.get('ai-analyst:analyze')(ai.event);
  check('DATA-empty-clean', 'Missing telemetry must not become verified clean verdict', emptyAnalysis.data.riskLevel === 'UNKNOWN' && emptyAnalysis.data.riskScore === null && !emptyAnalysis.data.certificateHealthAnalysis.includes('confirms valid chains'), { riskLevel: emptyAnalysis.data.riskLevel, riskScore: emptyAnalysis.data.riskScore, certificateVerdict: emptyAnalysis.data.certificateHealthAnalysis, queryResults: 'all empty' });

  const sqlite = new (require('sqlite3').Database)(':memory:');
  const sqlExec = sql => new Promise((resolve,reject) => sqlite.exec(sql, err => err ? reject(err) : resolve()));
  const dbSource = fs.readFileSync(path.join(root, 'src/main/core/database-manager.ts'), 'utf8');
  for (const table of ['events','process_history']) {
    const schema = dbSource.match(new RegExp('CREATE TABLE IF NOT EXISTS ' + table + ' \\([\\s\\S]+?\\);'));
    if (!schema) throw new Error('Schema not found: ' + table);
    await sqlExec(schema[0]);
  }
  const eventSource = fs.readFileSync(path.join(root, 'src/main/modules/event-explorer/event-explorer.module.ts'), 'utf8');
  const eventInsert = eventSource.match(/INSERT(?: OR IGNORE)? INTO events \([\s\S]+?VALUES \([\s\S]+?\)/)[0];
  let schemaError = '';
  try { await sqlExec(eventInsert.replaceAll('?', "'fixture'")); } catch (err) { schemaError = err.message; }
  check('EVENT-schema', 'Event ingestion SQL must match shipped schema', !schemaError, { sqliteError: schemaError, database: ':memory:' });
  const uebaSource = fs.readFileSync(path.join(root, 'src/main/modules/behavior-analytics/behavior-analytics.module.ts'), 'utf8');
  const parentQuery = uebaSource.match(/SELECT p\.pid[^"\r\n]+/)[0];
  let parentError = '';
  try { await sqlExec(parentQuery.replaceAll('?', '0')); } catch (err) { parentError = err.message; }
  check('UEBA-schema', 'Parent-child detection SQL must match shipped schema', !parentError, { sqliteError: parentError, database: ':memory:' });
  await new Promise((resolve,reject) => sqlite.close(err => err ? reject(err) : resolve()));

  // Inventory every source/build/config text file without exposing secret values.
  const crypto = require('node:crypto');
  const inventory = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (['.git','node_modules','security-audit','data','logs','tmp','output'].includes(entry.name)) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.(ts|tsx|js|cjs|mjs|json|html|md)$/.test(entry.name)) {
        const content = fs.readFileSync(file, 'utf8');
        const relative = path.relative(root, file).replaceAll('\\', '/');
        const sinks = [];
        if (/\.(ts|tsx|js|cjs|mjs)$/.test(file)) {
          const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
          function visit(node) {
            if (ts.isCallExpression(node)) {
              const callee = node.expression.getText(source);
              if (/exec|spawn|IpcHandler|ipcMain\.handle|writeFile|readFile|loadURL|loadFile|fetch|\.request$|\.connect$|require$/.test(callee)) {
                sinks.push({ line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, callee });
              }
            }
            ts.forEachChild(node, visit);
          }
          visit(source);
        }
        inventory.push({ path: relative, lines: content.split('\n').length, sha256: crypto.createHash('sha256').update(content).digest('hex'), sinks });
      }
    }
  }
  walk(root);
  fs.writeFileSync(path.join(output, 'inventory.json'), JSON.stringify(inventory, null, 2));

  const summary = { generatedAt: new Date().toISOString(), mode: 'real source functions; mocked external boundaries', counts: { total: results.length, pass: results.filter(r => r.status === 'PASS').length, fail: results.filter(r => r.status === 'FAIL').length }, results };
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = summary.counts.fail ? 1 : 0;
}
if (require.main === module) main().catch(err => { console.error(err); process.exitCode = 2; });
module.exports = { env };
