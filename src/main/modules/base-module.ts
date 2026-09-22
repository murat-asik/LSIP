import { safeIpcHandle } from './../core/security';
import { EventEmitter } from 'events';
import { createModuleLogger } from '../core/logger';
import { ipcMain } from 'electron';
import { IpcResponse } from '../../shared/types/ipc.types';

// ---------------------------------------------------------------------------
// Module Lifecycle State Machine
// ---------------------------------------------------------------------------
export type ModuleLifecycleState =
  | 'CREATED'
  | 'INITIALIZED'
  | 'ACTIVE'
  | 'IDLE'
  | 'SLEEPING'
  | 'DISPOSED';

export abstract class BaseModule extends EventEmitter {
  public abstract readonly name: string;
  public abstract readonly displayName: string;

  protected logger: ReturnType<typeof createModuleLogger>;
  private activeIpcHandlers: string[] = [];

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  private _lifecycleState: ModuleLifecycleState = 'CREATED';
  private _lastActivityAt: number = Date.now();
  private _activeTimers: Array<NodeJS.Timeout> = [];
  private _activeIntervals: Array<NodeJS.Timeout> = [];
  private intervalDefinitions = new Map<NodeJS.Timeout, { ms: number; fn: () => void }>();
  private suspendedIntervals: Array<{ ms: number; fn: () => void }> = [];
  private waking: Promise<void> | null = null;

  constructor() {
    super();
    this.logger = createModuleLogger('base-module');
  }

  public initLogger() {
    this.logger = createModuleLogger(this.name);
  }

  // ── Lifecycle Accessors ───────────────────────────────────────────────────
  public get lifecycleState(): ModuleLifecycleState {
    return this._lifecycleState;
  }

  public get lastActivityAt(): number {
    return this._lastActivityAt;
  }

  public get ipcHandlerCount(): number {
    return this.activeIpcHandlers.length;
  }

  public get timerCount(): number {
    return this._activeTimers.length + this._activeIntervals.length;
  }

  /**
   * Record activity — resets idle/sleep timer.
   */
  public recordActivity(): void {
    this._lastActivityAt = Date.now();
    if (this._lifecycleState === 'IDLE' || this._lifecycleState === 'SLEEPING') {
      this._lifecycleState = 'ACTIVE';
    }
  }

  // ── Abstract Interface ────────────────────────────────────────────────────
  public abstract initialize(): Promise<void>;
  public abstract shutdown(): Promise<void>;

  // ── Lifecycle Methods ─────────────────────────────────────────────────────
  /**
   * Called by module-manager after initialize() completes.
   */
  public setInitialized(): void {
    this._lifecycleState = 'INITIALIZED';
    this._lastActivityAt = Date.now();
  }

  /**
   * Called when module is being actively used.
   */
  public setActive(): void {
    this._lifecycleState = 'ACTIVE';
    this._lastActivityAt = Date.now();
  }

  public resetAfterShutdown(): void { this._lifecycleState = 'CREATED'; }

  /** Raw response modules still participate in handler cleanup and wake tracking. */
  protected registerRawIpcHandler(channel: string, handler: (event: any, ...args: any[]) => any): void {
    if (this.activeIpcHandlers.includes(channel)) ipcMain.removeHandler(channel);
    else this.activeIpcHandlers.push(channel);
    safeIpcHandle(channel, async (event, ...args) => {
      if (this._lifecycleState === 'SLEEPING') await this.wake();
      this.recordActivity();
      return handler(event, ...args);
    });
  }

  /**
   * Put this module into sleeping state.
   * Stops tracked timers/intervals to free CPU.
   * Subclasses can override `onSleep()` for additional cleanup.
   */
  public async sleep(): Promise<void> {
    if (this._lifecycleState === 'SLEEPING' || this._lifecycleState === 'DISPOSED') return;
    this.logger.info(`Module entering SLEEP state.`);

    // Stop all tracked intervals
    this.suspendedIntervals = [...this.intervalDefinitions.values()];
    this.intervalDefinitions.clear();
    for (const id of this._activeIntervals) {
      clearInterval(id);
    }
    this._activeIntervals = [];

    // Stop all tracked timers
    for (const id of this._activeTimers) {
      clearTimeout(id);
    }
    this._activeTimers = [];

    await this.onSleep();
    this._lifecycleState = 'SLEEPING';
  }

  /**
   * Wake this module from sleeping state.
   * Subclasses can override `onWake()` to restart required resources.
   */
  public async wake(): Promise<void> {
    if (this.waking) return this.waking;
    if (this._lifecycleState !== 'SLEEPING') return;
    this.waking = (async () => {
      await this.onWake();
      for (const interval of this.suspendedIntervals) this.registerInterval(interval.ms, interval.fn);
      this.suspendedIntervals = [];
      this._lastActivityAt = Date.now();
      this._lifecycleState = 'ACTIVE';
    })();
    try { await this.waking; } finally { this.waking = null; }
  }

  /**
   * Fully dispose this module. Cannot be reused after this.
   */
  public async dispose(): Promise<void> {
    await this.sleep();
    await this.shutdown();
    this.unregisterIpcHandlers();
    this.removeAllListeners();
    this._lifecycleState = 'DISPOSED';
    this.logger.info(`Module DISPOSED.`);
  }

  /**
   * Override in subclasses for custom sleep behavior.
   */
  protected async onSleep(): Promise<void> {
    // Default: no-op
  }

  /**
   * Override in subclasses for custom wake behavior.
   */
  protected async onWake(): Promise<void> {
    // Default: no-op
  }

  // ── Timer Management ──────────────────────────────────────────────────────
  /**
   * Register a managed interval — automatically cleared on sleep().
   */
  protected registerInterval(ms: number, fn: () => void): NodeJS.Timeout {
    const id = setInterval(fn, ms);
    this._activeIntervals.push(id);
    this.intervalDefinitions.set(id, { ms, fn });
    return id;
  }

  /**
   * Register a managed timeout — automatically cleared on sleep().
   */
  protected registerTimeout(ms: number, fn: () => void): NodeJS.Timeout {
    const id = setTimeout(() => {
      this._activeTimers = this._activeTimers.filter(t => t !== id);
      fn();
    }, ms);
    this._activeTimers.push(id);
    return id;
  }

  /**
   * Remove a specific interval from tracking.
   */
  protected clearManagedInterval(id: NodeJS.Timeout): void {
    clearInterval(id);
    this.intervalDefinitions.delete(id);
    this._activeIntervals = this._activeIntervals.filter(i => i !== id);
  }

  /**
   * Remove a specific timeout from tracking.
   */
  protected clearManagedTimeout(id: NodeJS.Timeout): void {
    clearTimeout(id);
    this._activeTimers = this._activeTimers.filter(t => t !== id);
  }

  // ── IPC Management ────────────────────────────────────────────────────────
  /**
   * Register a standard Electron IPC invoke handler.
   * Auto-formats response matching IpcResponse structure and wraps exceptions.
   */
  protected registerIpcHandler<TReq = any, TRes = any>(
    action: string,
    handler: (payload: TReq) => Promise<TRes>
  ) {
    const channel = `${this.name}:${action}`;
    console.log('[REGISTERING IPC]', channel);
    if (this.activeIpcHandlers.includes(channel)) {
      this.logger.warn(`IPC handler for ${channel} is already registered. Overwriting.`);
      ipcMain.removeHandler(channel);
    }

    safeIpcHandle(channel, async (_event, payload: TReq): Promise<IpcResponse<TRes>> => {
      const startTime = Date.now();
      try {
        if (this._lifecycleState === 'SLEEPING') await this.wake();
        this.recordActivity();
        const result = await handler(payload);
        return {
          id: Math.random().toString(36).substring(7),
          success: true,
          data: result,
          duration: Date.now() - startTime,
        };
      } catch (err: any) {
        this.logger.error(`IPC Handler Error on channel ${channel}`, { error: err.message, stack: err.stack });
        return {
          id: Math.random().toString(36).substring(7),
          success: false,
          error: {
            code: 'IPC_HANDLER_ERROR',
            message: err.message || 'An unknown error occurred inside the module backend.',
          },
          duration: Date.now() - startTime,
        };
      }
    });

    this.activeIpcHandlers.push(channel);
    this.logger.debug(`Registered IPC channel: ${channel}`);
  }

  /**
   * Cleans up registered IPC handlers for this module.
   */
  protected unregisterIpcHandlers() {
    for (const id of this._activeIntervals) clearInterval(id);
    for (const id of this._activeTimers) clearTimeout(id);
    this._activeIntervals = [];
    this._activeTimers = [];
    this.intervalDefinitions.clear();
    this.suspendedIntervals = [];
    for (const channel of this.activeIpcHandlers) {
      ipcMain.removeHandler(channel);
      this.logger.debug(`Unregistered IPC channel: ${channel}`);
    }
    this.activeIpcHandlers = [];
  }

  /**
   * Emits stream/push events from main process directly to a renderer window.
   */
  protected emitRenderer(window: Electron.WebContents, action: string, payload: any) {
    const channel = `${this.name}:${action}`;
    window.send(channel, {
      channel,
      type: 'data',
      payload,
      timestamp: Date.now(),
    });
  }
}
