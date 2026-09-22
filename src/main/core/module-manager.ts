import { BaseModule } from '../modules/base-module';
import { createModuleLogger } from './logger';
import { configManager } from './config-manager';
import { eventBus } from './event-bus';

const log = createModuleLogger('module-manager');

// ---------------------------------------------------------------------------
// Category A: Always initialized at startup (Core foundations & intelligence)
// ---------------------------------------------------------------------------
const CORE_MODULE_NAMES = new Set<string>(['dashboard', 'internet', 'correlation']);

// Auto-sleep timeout — modules idle longer than this are put to sleep
const DEFAULT_SUSPEND_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export interface ModuleStatus {
  name: string;
  displayName: string;
  enabled: boolean;
  lifecycleState: string;
  lastActivityAt: number;
  ipcHandlerCount: number;
  timerCount: number;
}

export class ModuleManager {
  private modules = new Map<string, BaseModule>();
  private initialized = false;
  private initializing = new Map<string, Promise<boolean>>();
  private suspendTimeoutMs: number = DEFAULT_SUSPEND_TIMEOUT_MS;
  private autoSuspendTimer: NodeJS.Timeout | null = null;

  // ── Registration ──────────────────────────────────────────────────────────
  public registerModule(module: BaseModule) {
    if (this.modules.has(module.name)) {
      throw new Error(`Module with name '${module.name}' is already registered.`);
    }
    module.initLogger();
    this.modules.set(module.name, module);
    log.info(`Registered module: ${module.displayName} (${module.name}) [Category: ${CORE_MODULE_NAMES.has(module.name) ? 'A-CORE' : 'B-LAZY'}]`);
  }

  // ── Startup ───────────────────────────────────────────────────────────────
  /**
   * Initialize only Category A (core) modules at startup.
   * Category B modules initialize on-demand via initializeOnDemand().
   */
  public async initializeCoreModules(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    log.info('Initializing CORE (Category A) modules...');
    for (const [name, module] of this.modules.entries()) {
      if (!CORE_MODULE_NAMES.has(name)) continue;

      const modConfig = configManager.getModuleConfig(name);
      if (modConfig.enabled !== false) {
        try {
          log.info(`Initializing CORE module: ${module.displayName}...`);
          await module.initialize();
          module.setInitialized();
          module.setActive();
          log.info(`CORE module ${module.displayName} initialized.`);
        } catch (err: any) {
          log.error(`Failed to initialize CORE module: ${module.displayName}`, { error: err.message });
        }
      }
    }

    // Start auto-suspend background checker
    this.startAutoSuspendChecker();
    log.info('Core module initialization complete. Lazy modules will initialize on first access.');
  }

  /**
   * @deprecated Use initializeCoreModules() for V3 lazy loading.
   * Kept for backward compatibility — calls initializeCoreModules.
   */
  public async initializeAll(): Promise<void> {
    return this.initializeCoreModules();
  }

  // ── On-Demand Module Initialization ──────────────────────────────────────
  /**
   * Initialize a Category B (lazy) module on first user navigation.
   * Safe to call multiple times — guards against double-init.
   */
  public async initializeOnDemand(name: string): Promise<boolean> {
    const pending = this.initializing.get(name);
    if (pending) return pending;
    const work = this.initializeModule(name);
    this.initializing.set(name, work);
    try { return await work; } finally { this.initializing.delete(name); }
  }

  private async initializeModule(name: string): Promise<boolean> {
    console.log('[ModuleManager] initializeOnDemand called for:', name);
    const module = this.modules.get(name);
    if (!module) {
      log.warn(`Module '${name}' not found for on-demand initialization.`);
      return false;
    }

    const state = module.lifecycleState;
    if(configManager.getModuleConfig(name).enabled===false)return false;

    // Already initialized (or sleeping — just wake it)
    if (state === 'INITIALIZED' || state === 'ACTIVE' || state === 'IDLE') {
      module.recordActivity();
      return true;
    }

    if (state === 'SLEEPING') {
      log.info(`Waking sleeping module: ${module.displayName}`);
      await module.wake();
      eventBus.publish('module:waking', { moduleName: name });
      return true;
    }

    if (state === 'DISPOSED') {
      log.warn(`Module '${name}' is DISPOSED and cannot be reactivated.`);
      return false;
    }

    // CREATED → initialize now
    const modConfig = configManager.getModuleConfig(name);
    if (modConfig.enabled === false) {
      log.info(`Module ${module.displayName} is disabled via configuration.`);
      return false;
    }

    try {
      log.info(`Lazy-initializing module on demand: ${module.displayName}...`);
      await module.initialize();
      module.setInitialized();
      module.setActive();
      eventBus.publish('module:initialized', { moduleName: name });
      log.info(`Module ${module.displayName} lazy-initialized successfully.`);
      return true;
    } catch (err: any) {
      log.error(`Failed to lazy-initialize module: ${module.displayName}`, { error: err.message });
      return false;
    }
  }

  // ── Auto-Suspend ──────────────────────────────────────────────────────────
  private startAutoSuspendChecker(): void {
    if (this.autoSuspendTimer) return;

    this.autoSuspendTimer = setInterval(async () => {
      const now = Date.now();
      for (const [name, module] of this.modules.entries()) {
        // Skip core modules — they stay alive
        if (CORE_MODULE_NAMES.has(name)) continue;
        // Only suspend ACTIVE or IDLE modules
        if (module.lifecycleState !== 'ACTIVE' && module.lifecycleState !== 'IDLE' && module.lifecycleState !== 'INITIALIZED') continue;
        // Check inactivity
        const idleFor = now - module.lastActivityAt;
        if (idleFor >= this.suspendTimeoutMs) {
          log.info(`Auto-suspending idle module: ${module.displayName} (idle ${Math.round(idleFor / 1000)}s)`);
          try {
            await module.sleep();
            eventBus.publish('module:sleeping', { moduleName: name });
          } catch (err: any) {
            log.error(`Failed to auto-suspend module: ${module.displayName}`, { error: err.message });
          }
        }
      }
    }, 60_000); // Check every 60 seconds
  }

  public setSuspendTimeout(ms: number): void {
    this.suspendTimeoutMs = ms;
    log.info(`Auto-suspend timeout set to ${ms}ms.`);
  }

  // ── Shutdown ──────────────────────────────────────────────────────────────
  public async shutdownAll(): Promise<void> {
    log.info('Shutting down all security modules...');

    if (this.autoSuspendTimer) {
      clearInterval(this.autoSuspendTimer);
      this.autoSuspendTimer = null;
    }

    for (const [name, module] of this.modules.entries()) {
      try {
        log.info(`Shutting down module: ${module.displayName}...`);
        await module.shutdown();
        log.info(`Module ${module.displayName} shut down.`);
      } catch (err: any) {
        log.error(`Failed to shutdown module: ${module.displayName}`, { error: err.message });
      }
    }
    this.modules.clear();
    this.initialized = false;
  }

  // ── Query Methods ─────────────────────────────────────────────────────────
  public getModule<T extends BaseModule>(name: string): T {
    const module = this.modules.get(name);
    if (!module) {
      throw new Error(`Module '${name}' not found.`);
    }
    return module as T;
  }

  public getModulesList() {
    return Array.from(this.modules.values()).map(m => ({
      name: m.name,
      displayName: m.displayName,
      enabled: configManager.getModuleConfig(m.name).enabled !== false,
    }));
  }

  public getFullStatus(): ModuleStatus[] {
    return Array.from(this.modules.values()).map(m => ({
      name: m.name,
      displayName: m.displayName,
      enabled: configManager.getModuleConfig(m.name).enabled !== false,
      lifecycleState: m.lifecycleState,
      lastActivityAt: m.lastActivityAt,
      ipcHandlerCount: m.ipcHandlerCount,
      timerCount: m.timerCount,
    }));
  }

  public async enableModule(name: string): Promise<boolean> {
    const module = this.modules.get(name);
    if (!module) return false;

    configManager.setModuleConfig(name, { enabled: true });
    return this.initializeOnDemand(name);
  }

  public async disableModule(name: string): Promise<boolean> {
    const module = this.modules.get(name);
    if (!module) return false;

    configManager.setModuleConfig(name, { enabled: false });
    try {
      await this.initializing.get(name);
      await module.shutdown();
      module.resetAfterShutdown();
      log.info(`Module ${module.displayName} disabled and shut down.`);
      return true;
    } catch (err: any) {
      log.error(`Failed to disable module: ${module.displayName}`, { error: err.message });
      return false;
    }
  }
}

export const moduleManager = new ModuleManager();
