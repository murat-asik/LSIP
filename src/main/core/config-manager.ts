import { integer } from './security';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { createModuleLogger } from './logger';

const log = createModuleLogger('config-manager');

export interface AppConfig {
  database: {
    retentionDays: number;
    maxEventRows: number;
  };
  scanning: {
    subnetScope: string; // e.g. "192.168.1.0/24"
    ports: number[];
    scanSpeed: 'slow' | 'medium' | 'fast';
  };
  modules: {
    [key: string]: {
      enabled: boolean;
      [configKey: string]: any;
    };
  };
  ui: {
    refreshIntervalMs: number;
    savedLayouts: any;
  };
}

const DEFAULT_CONFIG: AppConfig = {
  database: {
    retentionDays: 90,
    maxEventRows: 1000000,
  },
  scanning: {
    subnetScope: '', // empty means auto-detect
    ports: [21, 22, 23, 25, 53, 80, 110, 135, 139, 443, 445, 1433, 3306, 3389, 8080],
    scanSpeed: 'medium',
  },
  modules: {},
  ui: {
    refreshIntervalMs: 2000,
    savedLayouts: {},
  },
};

export class ConfigManager {
  private configPath: string;
  private currentConfig: AppConfig;

  constructor() {
    this.configPath = this.resolveConfigPath();
    this.currentConfig = { ...DEFAULT_CONFIG };
    this.load();
  }

  private resolveConfigPath(): string {
    let userDataDir = '';
    try {
      if (app && typeof app.getPath === 'function') {
        userDataDir = app.getPath('userData');
      }
    } catch (err) {
      // Fallback
    }

    if (!userDataDir || userDataDir.trim() === '') {
      userDataDir = path.join(process.cwd(), 'data');
    }

    return path.join(userDataDir, 'config', 'config.json');
  }

  public get(): AppConfig {
    return this.currentConfig;
  }

  public getPublic(): AppConfig {
    const redact = (value: any): any => {
      if (Array.isArray(value)) return value.map(redact);
      if (!value || typeof value !== 'object') return value;
      return Object.fromEntries(Object.entries(value).filter(([k]) => !/key|token|secret|password/i.test(k)).map(([k,v]) => [k,redact(v)]));
    };
    return redact(this.currentConfig);
  }
  public setPublic(value: Partial<AppConfig>) {
    if (!value || typeof value !== 'object') throw new Error('Geçersiz ayarlar');
    if (value.database) {
      integer(value.database.retentionDays, 'Saklama günü', 3650);
      integer(value.database.maxEventRows, 'Kayıt sınırı', 10000000);
    }
    if (value.ui) integer(value.ui.refreshIntervalMs, 'Yenileme süresi', 3600000, 500);
    if (value.scanning) {
      const scan = value.scanning;
      if (typeof scan.subnetScope !== 'string' || scan.subnetScope.length > 253 || /[\x00-\x1f]/.test(scan.subnetScope)) throw new Error('Geçersiz alt ağ');
      if (!['slow', 'medium', 'fast'].includes(scan.scanSpeed)) throw new Error('Geçersiz tarama hızı');
      if (!Array.isArray(scan.ports) || scan.ports.length > 1024) throw new Error('Geçersiz port listesi');
      scan.ports.forEach(port => integer(port, 'Port', 65535));
    }
    this.set({ database: value.database || this.currentConfig.database, ui: value.ui || this.currentConfig.ui,
      scanning: value.scanning || this.currentConfig.scanning });
  }
  public set(newConfig: Partial<AppConfig>) {
    this.currentConfig = {
      ...this.currentConfig,
      ...newConfig,
    };
    this.save();
  }

  public getModuleConfig(moduleName: string): { enabled: boolean; [key: string]: any } {
    if (!this.currentConfig.modules[moduleName]) {
      this.currentConfig.modules[moduleName] = { enabled: true };
    }
    return this.currentConfig.modules[moduleName];
  }

  public setModuleConfig(moduleName: string, config: any) {
    this.currentConfig.modules[moduleName] = {
      ...this.getModuleConfig(moduleName),
      ...config,
    };
    this.save();
  }

  private load() {
    try {
      if (fs.existsSync(this.configPath)) {
        const fileContent = fs.readFileSync(this.configPath, 'utf8');
        const parsed = JSON.parse(fileContent);
        // Deep merge or overwrite
        this.currentConfig = {
          ...DEFAULT_CONFIG,
          ...parsed,
          database: { ...DEFAULT_CONFIG.database, ...parsed.database },
          scanning: { ...DEFAULT_CONFIG.scanning, ...parsed.scanning },
          ui: { ...DEFAULT_CONFIG.ui, ...parsed.ui },
          modules: { ...DEFAULT_CONFIG.modules, ...parsed.modules },
        };
        log.info('Configuration loaded successfully.');
      } else {
        log.info('Configuration file not found. Creating default configuration.');
        this.save();
      }
    } catch (err: any) {
      log.error('Failed to load configuration. Using defaults.', { error: err.message });
      this.currentConfig = { ...DEFAULT_CONFIG };
    }
  }

  private save() {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.currentConfig, null, 2), 'utf8');
      log.info('Configuration saved successfully.');
    } catch (err: any) {
      log.error('Failed to save configuration.', { error: err.message });
    }
  }
}
export const configManager = new ConfigManager();
