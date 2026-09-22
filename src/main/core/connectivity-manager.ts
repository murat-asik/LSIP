import { safeIpcHandle } from './security';
import { createModuleLogger } from './logger';
import { ipcMain } from 'electron';
import { eventBus } from './event-bus';
import os from 'os';
import dns from 'dns';

const log = createModuleLogger('connectivity-manager');

export type ConnectivityStatus = 'OFFLINE' | 'ONLINE' | 'LIMITED' | 'NO INTERNET' | 'PROVIDER ERROR';

export interface ConnectivityState {
  status: ConnectivityStatus;
  isOnlineMode: boolean;
  networkInterfaceDetected: boolean;
  dnsAvailable: boolean;
  proxyDetected: boolean;
  vpnDetected: boolean;
  tlsValid: boolean;
  lastCheckTimestamp: number;
}

export class ConnectivityManager {
  private isOnlineMode = false;
  private status: ConnectivityStatus = 'OFFLINE';
  private lastCheckTimestamp = Date.now();
  private networkInterfaceDetected = false;
  private dnsAvailable = false;
  private proxyDetected = false;
  private vpnDetected = false;
  private tlsValid = true;
  private previousStatus: ConnectivityStatus = 'OFFLINE';

  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.detectNetworkInterfaces();
  }

  public initialize(): void {
    if (this.checkInterval) return; // Guard against double-init

    this.registerIpcHandlers();
    this.detectNetworkInterfaces();

    // Application MUST ALWAYS start OFFLINE by default.
    // Cloud providers only activate when the user explicitly clicks "Connect".
    this.isOnlineMode = false;
    this.status = 'OFFLINE';
    log.info('ConnectivityManager initialized in OFFLINE mode (Application default startup).');

    // Background check — only runs every 30s (reduced from 10s)
    this.checkInterval = setInterval(() => {
      this.testConnectivity().catch(err => {
        log.error('Background connectivity check failed', { error: err.message });
      });
    }, 30_000); // 30 seconds
  }

  public shutdown(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      log.info('ConnectivityManager background checker stopped.');
    }
  }

  public getState(): ConnectivityState {
    return {
      status: this.status,
      isOnlineMode: this.isOnlineMode,
      networkInterfaceDetected: this.networkInterfaceDetected,
      dnsAvailable: this.dnsAvailable,
      proxyDetected: this.proxyDetected,
      vpnDetected: this.vpnDetected,
      tlsValid: this.tlsValid,
      lastCheckTimestamp: this.lastCheckTimestamp,
    };
  }

  public async connect(): Promise<ConnectivityState> {
    log.info('User initiated connection sequence...');
    this.detectNetworkInterfaces();

    if (!this.networkInterfaceDetected) {
      this.updateStatus('NO INTERNET', false);
      return this.getState();
    }

    const isDnsOk = await this.checkDns();
    this.dnsAvailable = isDnsOk;

    if (!isDnsOk) {
      this.updateStatus('LIMITED', true);
    } else {
      this.updateStatus('ONLINE', true);
    }

    try {
      const { secureConfigManager } = require('../modules/internet-intelligence/secure-config');
      secureConfigManager.saveGlobalConfig({ offlineMode: false });
    } catch (e) {
      // ignore if module not loaded yet
    }

    this.lastCheckTimestamp = Date.now();
    log.info(`Connection established. Status: ${this.status}`);
    return this.getState();
  }

  public disconnect(): ConnectivityState {
    log.info('User initiated disconnect. Returning to OFFLINE mode.');
    this.updateStatus('OFFLINE', false);

    try {
      const { secureConfigManager } = require('../modules/internet-intelligence/secure-config');
      secureConfigManager.saveGlobalConfig({ offlineMode: true });
    } catch (e) {
      // ignore if module not loaded yet
    }

    this.lastCheckTimestamp = Date.now();
    return this.getState();
  }

  public async testConnectivity(): Promise<ConnectivityState> {
    this.detectNetworkInterfaces();
    if (!this.isOnlineMode) return this.getState();
    this.dnsAvailable = await this.checkDns();
    this.lastCheckTimestamp = Date.now();

    let newStatus: ConnectivityStatus;
    if (!this.isOnlineMode) {
      newStatus = 'OFFLINE';
    } else if (!this.networkInterfaceDetected) {
      newStatus = 'NO INTERNET';
    } else if (!this.dnsAvailable) {
      newStatus = 'LIMITED';
    } else {
      newStatus = 'ONLINE';
    }

    this.updateStatus(newStatus, this.isOnlineMode);
    return this.getState();
  }

  private updateStatus(newStatus: ConnectivityStatus, isOnlineMode: boolean): void {
    const changed = newStatus !== this.previousStatus || isOnlineMode !== this.isOnlineMode;
    this.status = newStatus;
    this.isOnlineMode = isOnlineMode;
    this.previousStatus = newStatus;

    // Only publish event bus notification when state actually changes
    if (changed) {
      eventBus.publish('connectivity:changed', { status: newStatus, isOnlineMode });
      log.info(`Connectivity status changed → ${newStatus} (online mode: ${isOnlineMode})`);
    }
  }

  private detectNetworkInterfaces(): void {
    const interfaces = os.networkInterfaces();
    let foundNonInternal = false;
    let foundVpn = false;

    for (const name of Object.keys(interfaces)) {
      const ifaceList = interfaces[name];
      if (!ifaceList) continue;

      for (const iface of ifaceList) {
        if (!iface.internal && iface.family === 'IPv4') {
          foundNonInternal = true;
          if (
            name.toLowerCase().includes('tun') ||
            name.toLowerCase().includes('tap') ||
            name.toLowerCase().includes('vpn') ||
            name.toLowerCase().includes('wg')
          ) {
            foundVpn = true;
          }
        }
      }
    }

    this.networkInterfaceDetected = foundNonInternal;
    this.vpnDetected = foundVpn;
    this.proxyDetected = !!(
      process.env.HTTP_PROXY ||
      process.env.HTTPS_PROXY ||
      process.env.http_proxy ||
      process.env.https_proxy
    );
  }

  private async checkDns(): Promise<boolean> {
    return new Promise((resolve) => {
      dns.resolve('cloudflare-dns.com', (err) => {
        if (err) {
          dns.resolve('google.com', (err2) => {
            resolve(!err2);
          });
        } else {
          resolve(true);
        }
      });
    });
  }

  private registerIpcHandlers(): void {
    safeIpcHandle('connectivity:get-state', async () => this.getState());
    safeIpcHandle('connectivity:connect', async () => this.connect());
    safeIpcHandle('connectivity:disconnect', async () => this.disconnect());
    safeIpcHandle('connectivity:test', async () => this.testConnectivity());
  }
}

export const connectivityManager = new ConnectivityManager();
