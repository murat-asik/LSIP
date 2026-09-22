import { registerBackupIpc } from './core/backup-service';
import { getCollectorHealth } from './core/collector-health';
import { pathToFileURL } from 'url';
import { trustRenderer } from './core/security';
import { safeIpcHandle } from './core/security';
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { createModuleLogger } from './core/logger';
import { container } from './core/service-container';
import { configManager } from './core/config-manager';
import { databaseManager } from './core/database-manager';
import { moduleManager } from './core/module-manager';
import { WorkerPool } from './core/worker-pool';
import { eventBus } from './core/event-bus';
import { registerPerformanceIpc } from './core/performance.ipc';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ProcessExplorerModule } from './modules/process-explorer/process-explorer.module';
import { AssetDiscoveryModule } from './modules/asset-discovery/asset-discovery.module';
import { EventExplorerModule } from './modules/event-explorer/event-explorer.module';
import { ConnectionMapModule } from './modules/connection-map/connection-map.module';
import { ReputationEngineModule } from './modules/reputation-engine/reputation-engine.module';
import { TimelineModule } from './modules/timeline/timeline.module';
import { DnsIntelligenceModule } from './modules/dns-intelligence/dns-intelligence.module';
import { SmbIntelligenceModule } from './modules/smb-intelligence/smb-intelligence.module';
import { RdpMonitorModule } from './modules/rdp-monitor/rdp-monitor.module';
import { UsbMonitorModule } from './modules/usb-monitor/usb-monitor.module';
import { FimModule } from './modules/fim/fim.module';
import { PersistenceScannerModule } from './modules/persistence-scanner/persistence-scanner.module';
import { ThreadExplorerModule } from './modules/thread-explorer/thread-explorer.module';
import { DllScannerModule } from './modules/dll-scanner/dll-scanner.module';
import { CertScannerModule } from './modules/cert-scanner/cert-scanner.module';
import { IocScannerModule } from './modules/ioc-scanner/ioc-scanner.module';
import { BehaviorAnalyticsModule } from './modules/behavior-analytics/behavior-analytics.module';
import { ReportGeneratorModule } from './modules/report-generator/report-generator.module';
import { PluginSystemModule } from './modules/plugin-system/plugin-system.module';
import { InternetIntelligenceModule } from './modules/internet-intelligence/internet-intelligence.module';
import { CorrelationEngineModule } from './modules/correlation-engine/correlation-engine.module';
import { DfirModule } from './modules/dfir/dfir.module';
import { RedTeamModule } from './modules/redteam/redteam.module';
import { AiAnalystModule } from './modules/ai-analyst/ai-analyst.module';
import { connectivityManager } from './core/connectivity-manager';
import { EtwConsumer } from './core/etw-consumer';

// Module imports — registered but NOT initialized at startup (Category B)


const log = createModuleLogger('app-bootstrap');

// Map renderer tab IDs to backend module names
const TAB_TO_MODULE_MAP: Record<string, string> = {
  // Blue Team
  'dashboard': 'dashboard',
  'process': 'process',
  'threads': 'threads',
  'dlls': 'dlls',
  'assets': 'assets',
  'events': 'events',
  'connections': 'connection',
  'topology': 'connection',
  'reputation': 'reputation',
  'internet-investigation': 'internet',
  'timeline': 'timeline',
  'dns': 'dns',
  'smb': 'smb',
  'rdp': 'rdp',
  'usb': 'usb',
  'fim': 'fim',
  'persistence': 'persistence',
  'ioc': 'ioc',
  'behavior': 'behavior',
  'ai-analyst': 'ai-analyst',
  'reports': 'reports',
  'plugins': 'plugins',
  'certs': 'certs',
  'settings': 'dashboard', // Settings uses core
  'perf-monitor': 'dashboard', // Performance IPC is global, uses core
  // DFIR
  'dfir-evidence': 'dfir',
  'dfir-memory': 'dfir',
  'dfir-registry': 'dfir',
  'dfir-prefetch': 'dfir',
  'dfir-amcache': 'dfir',
  'dfir-shimcache': 'dfir',
  'dfir-jumplists': 'dfir',
  'dfir-srum': 'dfir',
  'dfir-usn': 'dfir',
  'dfir-recycle': 'dfir',
  // Red Team
  'red-ports': 'redteam',
  'red-http': 'redteam',
  'red-dns': 'redteam',
  'red-surface': 'redteam',
  // V3
  'v3-cases': 'dfir',
  'v3-ioc-graph': 'internet',
  'v3-evidence': 'dfir',
  'v3-timeline': 'timeline',
  'v3-process-tree': 'process',
  'v3-detection-lab': 'ioc',
  'v3-hunting': 'ioc',
  'v3-mitre': 'dfir',
  'v3-purple': 'redteam',
  'v3-knowledge': 'dfir',
};

export class Application {
  private mainWindow: BrowserWindow | null = null;
  private isQuitting = false;

  public async start() {
    log.info('Starting LSIP V3.0...');
    await databaseManager.ready;

    // ── 1. Register Core Services ───────────────────────────────────────────
    container.register('configManager', configManager);
    container.register('databaseManager', databaseManager);

    connectivityManager.initialize();
    container.register('connectivityManager', connectivityManager);

    const workerPool = new WorkerPool(4, 'general-worker.js');
    workerPool.initialize();
    container.register('workerPool', workerPool);

    // ── 2. Register ALL Modules (no initialization yet for Category B) ──────
    // Category A — Dashboard is the only core module that initializes at startup
    moduleManager.registerModule(new DashboardModule());

    // Category B — All lazy, init on first navigation
    moduleManager.registerModule(new ProcessExplorerModule());
    moduleManager.registerModule(new AssetDiscoveryModule());
    moduleManager.registerModule(new EventExplorerModule());
    moduleManager.registerModule(new ConnectionMapModule());
    moduleManager.registerModule(new ReputationEngineModule());
    moduleManager.registerModule(new TimelineModule());
    moduleManager.registerModule(new DnsIntelligenceModule());
    moduleManager.registerModule(new SmbIntelligenceModule());
    moduleManager.registerModule(new RdpMonitorModule());
    moduleManager.registerModule(new UsbMonitorModule());
    moduleManager.registerModule(new FimModule());
    moduleManager.registerModule(new PersistenceScannerModule());
    moduleManager.registerModule(new ThreadExplorerModule());
    moduleManager.registerModule(new DllScannerModule());
    moduleManager.registerModule(new CertScannerModule());
    moduleManager.registerModule(new IocScannerModule());
    moduleManager.registerModule(new BehaviorAnalyticsModule());
    moduleManager.registerModule(new ReportGeneratorModule());
    moduleManager.registerModule(new PluginSystemModule());
    moduleManager.registerModule(new InternetIntelligenceModule());
    moduleManager.registerModule(new CorrelationEngineModule());
    moduleManager.registerModule(new DfirModule());
    moduleManager.registerModule(new RedTeamModule());
    moduleManager.registerModule(new AiAnalystModule());

    // ── 3. Initialize CORE modules only ────────────────────────────────────
    await moduleManager.initializeCoreModules();

    // ── 4. Start ETW (core security event stream) ───────────────────────────
    EtwConsumer.start();

    // ── 5. Register Performance IPC ────────────────────────────────────────
    registerPerformanceIpc();

    // ── 6. Set up Electron app lifecycle ───────────────────────────────────
    this.setupAppLifecycle();

    log.info('LSIP V3.0 bootstrap complete. 24 lazy modules ready for on-demand init.');
  }

  private setupAppLifecycle() {
    app.whenReady().then(() => {
      this.createWindow();
      this.registerGlobalIpc();
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });

    app.on('before-quit', async (e) => {
      if (this.isQuitting) return;
      e.preventDefault();
      this.isQuitting = true;
      log.info('Gracefully shutting down services...');

      try {
        EtwConsumer.stop();
        eventBus.publish('app:shutdown', {});
        await moduleManager.shutdownAll();
        const pool = container.get<WorkerPool>('workerPool');
        pool.shutdown();
        await databaseManager.closeAll();
        connectivityManager.shutdown();
      } catch (err: any) {
        log.error('Error during shutdown sequence', { error: err.message });
      }

      app.quit();
    });
  }

  private createWindow() {
    const isDev = process.env.NODE_ENV === 'development';

    this.mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 1000,
      minHeight: 600,
      title: 'Local Security Intelligence Platform (LSIP)',
      backgroundColor: '#0a0e17',
      show: false,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    this.mainWindow.removeMenu();

    const entryUrl = isDev ? 'http://localhost:5173/' : pathToFileURL(path.join(__dirname, '..', 'renderer', 'index.html')).href;
    trustRenderer(this.mainWindow.webContents, entryUrl);
    this.mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
    this.mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    this.mainWindow.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));

    if (isDev) {
      this.mainWindow.loadURL('http://localhost:5173');
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
    }

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
      log.info('Main window displayed.');
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  private registerGlobalIpc() {
    registerBackupIpc();
    safeIpcHandle('app:collector-health', async () => getCollectorHealth());
    safeIpcHandle('app:get-status', async () => {
      return {
        version: app.getVersion(),
        environment: process.env.NODE_ENV || 'production',
        uptime: process.uptime(),
        modules: moduleManager.getModulesList(),
        memoryUsage: process.memoryUsage(),
      };
    });

    safeIpcHandle('app:is-admin', async () => {
      return new Promise((resolve) => {
        require('child_process').exec('net session', (err: any) => {
          resolve(err ? false : true);
        });
      });
    });

    safeIpcHandle('app:toggle-module', async (_event, { moduleName, enable }) => {
      if (enable) {
        return await moduleManager.enableModule(moduleName);
      } else {
        return await moduleManager.disableModule(moduleName);
      }
    });

    safeIpcHandle('app:get-config', async () => {
      return configManager.getPublic();
    });

    safeIpcHandle('app:save-config', async (_event, newConfig) => {
      configManager.setPublic(newConfig);
      return true;
    });

    // ── Lazy Module Activation — called by renderer on first tab navigation ──
    safeIpcHandle('module-manager:activate', async (_event, tabId: string) => {
      const moduleName = TAB_TO_MODULE_MAP[tabId];
      if (!moduleName) {
        log.warn(`No module mapping found for tab: ${tabId}`);
        return { success: false, reason: 'NO_MAPPING' };
      }

      const success = await moduleManager.initializeOnDemand(moduleName);
      if(moduleName==='ioc' && !(await moduleManager.initializeOnDemand('fim')))return {success:false,reason:'DEPENDENCY_FAILED',moduleName:'fim',tabId};
      if (tabId === 'topology' && !(await moduleManager.initializeOnDemand('assets'))) {
        return { success: false, reason: 'DEPENDENCY_FAILED', moduleName: 'assets', tabId };
      }
      if (moduleName === 'internet' || moduleName === 'reputation') {
        await moduleManager.initializeOnDemand('correlation');
      }
      return { success, moduleName, tabId };
    });

    safeIpcHandle('module-manager:get-status', async () => {
      return moduleManager.getFullStatus();
    });
  }
}
