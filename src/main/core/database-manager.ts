import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { createModuleLogger } from './logger';

const log = createModuleLogger('database-manager');

// Enable verbose logging in development
if (process.env.NODE_ENV === 'development') {
  sqlite3.verbose();
}

export class DatabaseManager {
  private dbInstances = new Map<string, sqlite3.Database>();
  private dataDir: string;
  private operations = new Set<Promise<any>>();
  private frozen: Promise<void> | null = null;
  private releaseFreeze: (() => void) | null = null;
  private async operation<T>(fn: () => Promise<T>): Promise<T> {
    while (this.frozen) await this.frozen;
    const pending = fn(); this.operations.add(pending);
    try { return await pending; } finally { this.operations.delete(pending); }
  }
  public async snapshotTo(directory: string, extra: () => Promise<void>): Promise<void> {
    if (this.frozen) throw new Error('Database maintenance is already running');
    this.frozen = new Promise<void>(resolve => { this.releaseFreeze = resolve; });
    try {
      await Promise.allSettled([...this.operations]);
      await fs.promises.mkdir(directory, { recursive: true });
      for (const [name, db] of this.dbInstances) {
        // VACUUM INTO includes committed WAL data in a standalone database file.
        await new Promise<void>((resolve, reject) => db.run('VACUUM INTO ?', [path.join(directory, name + '.db')], error => error ? reject(error) : resolve()));
      }
      await extra();
    } finally { const release = this.releaseFreeze; this.frozen = null; this.releaseFreeze = null; release?.(); }
  }

  public readonly ready: Promise<void>;

  constructor() {
    let userDataDir = '';
    try {
      userDataDir = app.getPath('userData');
    } catch {
      userDataDir = path.join(process.cwd(), 'data');
    }
    this.dataDir = path.join(userDataDir, 'databases');

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    log.info(`Database manager initialized. Path: ${this.dataDir}`);
    this.ready = this.initializeAll();
  }

  public getDb(name: string): sqlite3.Database {
    const db = this.dbInstances.get(name);
    if (!db) {
      log.error(`Database '${name}' not found.`);
      throw new Error(`Database connection not open: ${name}`);
    }
    return db;
  }

  public async closeAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const [name, db] of this.dbInstances.entries()) {
      promises.push(
        new Promise<void>((resolve) => {
          try {
            db.close((err) => {
              if (err) {
                log.error(`Failed to close database: ${name}`, { error: err.message });
              } else {
                log.info(`Closed database: ${name}`);
              }
              resolve();
            });
          } catch (err: any) {
            log.error(`Failed to close database: ${name}`, { error: err.message });
            resolve();
          }
        })
      );
    }
    await Promise.all(promises);
    this.dbInstances.clear();
  }

  // Promise wrappers for convenient async/await queries
  public queryAll<T = any>(dbName: string, sql: string, params: any[] = []): Promise<T[]> {
    return this.operation(() => new Promise((resolve, reject) => {
      const db = this.getDb(dbName);
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    }));
  }

  public queryGet<T = any>(dbName: string, sql: string, params: any[] = []): Promise<T | undefined> {
    return this.operation(() => new Promise((resolve, reject) => {
      const db = this.getDb(dbName);
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T | undefined);
      });
    }));
  }

  public queryRun(dbName: string, sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
    return this.operation(() => new Promise((resolve, reject) => {
      const db = this.getDb(dbName);
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    }));
  }

  public queryExec(dbName: string, sql: string): Promise<void> {
    return this.operation(() => new Promise((resolve, reject) => {
      const db = this.getDb(dbName);
      db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    }));
  }

  /** Dedicated connection prevents unrelated writers joining this transaction. */
  public atomicBatch(dbName: string, statements: Array<{ sql: string; params: any[] }>): Promise<void> {
    return this.operation(() => this.atomicBatchInternal(dbName, statements));
  }
  private async atomicBatchInternal(dbName: string, statements: Array<{ sql: string; params: any[] }>): Promise<void> {
    this.getDb(dbName);
    const connection = await new Promise<sqlite3.Database>((resolve, reject) => {
      const db = new sqlite3.Database(path.join(this.dataDir, dbName + '.db'), error => error ? reject(error) : resolve(db));
    });
    const exec = (sql: string) => new Promise<void>((resolve, reject) => connection.exec(sql, error => error ? reject(error) : resolve()));
    try {
      await exec('PRAGMA busy_timeout = 10000; BEGIN IMMEDIATE');
      for (const statement of statements) await new Promise<void>((resolve, reject) => connection.run(statement.sql, statement.params, error => error ? reject(error) : resolve()));
      await exec('COMMIT');
    } catch (error) { await exec('ROLLBACK').catch(() => undefined); throw error; }
    finally { await new Promise<void>((resolve, reject) => connection.close(error => error ? reject(error) : resolve())); }
  }

  private async initializeAll(): Promise<void> {
    const dbNames = ['assets', 'events', 'network', 'process', 'reputation', 'ioc', 'config', 'dfir', 'redteam'];
    for (const name of dbNames) {
      const dbPath = path.join(this.dataDir, `${name}.db`);
      try {
        const db = new sqlite3.Database(dbPath, (err) => {
          if (err) {
            log.error(`Failed to open database: ${name}`, { error: err.message, path: dbPath });
            // Note: Do not throw inside callback — it becomes an uncaughtException.
            // The outer try/catch handles construction errors synchronously.
          }
        });
        this.applyPragmas(db);
        this.dbInstances.set(name, db);
        log.info(`Successfully opened database: ${name}`);
      } catch (err: any) {
        log.error(`Database startup error: ${name}`, { error: err.message });
        throw err;
      }
    }

    // Initialize individual schemas
    await this.initSchemas();
  }

  private applyPragmas(db: sqlite3.Database) {
    db.serialize(() => {
      db.run('PRAGMA journal_mode = WAL');
      db.run('PRAGMA synchronous = NORMAL');
      db.run('PRAGMA cache_size = -64000'); // 64MB
      db.run('PRAGMA temp_store = MEMORY');
      db.run('PRAGMA busy_timeout = 5000');
    });
  }

  private async initSchemas() {
    try {
      await this.initAssetsSchema();
      await this.initEventsSchema();
      await this.initNetworkSchema();
      await this.initProcessSchema();
      await this.initReputationSchema();
      await this.initIocSchema();
      await this.initConfigSchema();
      await this.initDfirSchema();
      await this.initRedteamSchema();
    } catch (err: any) {
      log.error('Failed to initialize database schemas.', { error: err.message });
      throw err;
    }
  }

  private async initAssetsSchema() {
    await this.queryExec('assets', `
      CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY,
        ip_address TEXT NOT NULL,
        mac_address TEXT,
        hostname TEXT,
        vendor TEXT,
        os_guess TEXT,
        device_type TEXT,
        first_seen INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        is_online INTEGER DEFAULT 0,
        ping_latency_ms REAL,
        risk_score REAL DEFAULT 0,
        fingerprint TEXT,
        metadata TEXT
      );
    `);
    await this.queryExec('assets', 'CREATE INDEX IF NOT EXISTS idx_assets_ip ON assets(ip_address);');
    await this.queryExec('assets', 'CREATE INDEX IF NOT EXISTS idx_assets_hostname ON assets(hostname);');
    await this.queryExec('assets', 'CREATE INDEX IF NOT EXISTS idx_assets_last_seen ON assets(last_seen);');

    await this.queryExec('assets', `
      CREATE TABLE IF NOT EXISTS asset_ports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id TEXT NOT NULL,
        port INTEGER NOT NULL,
        protocol TEXT NOT NULL,
        state TEXT NOT NULL,
        service TEXT,
        banner TEXT,
        tls_info TEXT,
        last_seen INTEGER NOT NULL,
        UNIQUE(asset_id, port, protocol),
        FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE
      );
    `);
    await this.queryExec('assets', 'CREATE INDEX IF NOT EXISTS idx_ports_asset ON asset_ports(asset_id);');
    await this.queryExec('assets', 'CREATE INDEX IF NOT EXISTS idx_ports_port ON asset_ports(port);');
  }

  private async initEventsSchema() {
    await this.queryExec('events', `
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        source TEXT NOT NULL,
        level INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        computer TEXT,
        user_sid TEXT,
        user_name TEXT,
        message TEXT,
        xml_data TEXT,
        parsed_data TEXT,
        event_key TEXT,
        is_bookmarked INTEGER DEFAULT 0
      );
    `);
    await this.queryExec('events', 'CREATE INDEX IF NOT EXISTS idx_events_eventid ON events(event_id);');
    await this.queryExec('events', 'CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);');
    await this.queryExec('events', 'CREATE INDEX IF NOT EXISTS idx_events_source ON events(source);');
    const columns = await this.queryAll<{ name: string }>('events', 'PRAGMA table_info(events)');
    if (!columns.some(column => column.name === 'event_key')) await this.queryExec('events', 'ALTER TABLE events ADD COLUMN event_key TEXT');
    await this.queryExec('events', 'CREATE UNIQUE INDEX IF NOT EXISTS idx_events_identity ON events(event_key) WHERE event_key IS NOT NULL');

    await this.queryExec('events', `
      CREATE TABLE IF NOT EXISTS event_retention (
        max_age_days INTEGER DEFAULT 90,
        max_rows INTEGER DEFAULT 1000000
      );
    `);
  }

  private async initNetworkSchema() {
    await this.queryExec('network', `
      CREATE TABLE IF NOT EXISTS connections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        local_address TEXT NOT NULL,
        local_port INTEGER NOT NULL,
        remote_address TEXT NOT NULL,
        remote_port INTEGER NOT NULL,
        protocol TEXT NOT NULL,
        state TEXT,
        pid INTEGER,
        process_name TEXT,
        first_seen INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        bytes_sent INTEGER DEFAULT 0,
        bytes_received INTEGER DEFAULT 0
      );
    `);
    await this.queryExec('network', 'CREATE INDEX IF NOT EXISTS idx_conn_remote ON connections(remote_address);');
    await this.queryExec('network', 'CREATE INDEX IF NOT EXISTS idx_conn_pid ON connections(pid);');

    await this.queryExec('network', `
      CREATE TABLE IF NOT EXISTS dns_queries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        query_name TEXT NOT NULL,
        query_type TEXT,
        response TEXT,
        source_ip TEXT,
        pid INTEGER,
        process_name TEXT,
        is_rare INTEGER DEFAULT 0
      );
    `);
    await this.queryExec('network', 'CREATE INDEX IF NOT EXISTS idx_dns_name ON dns_queries(query_name);');
    await this.queryExec('network', 'CREATE INDEX IF NOT EXISTS idx_dns_timestamp ON dns_queries(timestamp);');
  }

  private async initProcessSchema() {
    await this.queryExec('process', `
      CREATE TABLE IF NOT EXISTS processes (
        pid INTEGER PRIMARY KEY,
        ppid INTEGER,
        name TEXT NOT NULL,
        path TEXT,
        command_line TEXT,
        user TEXT,
        integrity_level TEXT,
        token_elevation INTEGER,
        is_signed INTEGER DEFAULT 0,
        signature_status TEXT,
        first_seen INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        is_running INTEGER DEFAULT 1
      );
    `);
    await this.queryExec('process', 'CREATE INDEX IF NOT EXISTS idx_proc_name ON processes(name);');
    const processColumns = await this.queryAll<{ name: string }>('process', 'PRAGMA table_info(processes)');
    if (!processColumns.some(column => column.name === 'creation_time')) {
      await this.queryExec('process', 'ALTER TABLE processes ADD COLUMN creation_time INTEGER');
    }

    await this.queryExec('process', `
      CREATE TABLE IF NOT EXISTS process_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pid INTEGER NOT NULL,
        ppid INTEGER,
        name TEXT NOT NULL,
        action TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        user TEXT,
        command_line TEXT
      );
    `);
    await this.queryExec('process', 'CREATE INDEX IF NOT EXISTS idx_history_timestamp ON process_history(timestamp);');
  }

  private async initReputationSchema() {
    await this.queryExec('reputation', `
      CREATE TABLE IF NOT EXISTS host_reputation (
        host_id TEXT PRIMARY KEY,
        risk_score REAL DEFAULT 0,
        confidence REAL DEFAULT 0,
        last_calculated INTEGER,
        factors TEXT,
        recommendations TEXT
      );
    `);

    await this.queryExec('reputation', `
      CREATE TABLE IF NOT EXISTS score_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        host_id TEXT NOT NULL,
        score REAL NOT NULL,
        timestamp INTEGER NOT NULL,
        delta REAL
      );
    `);
    await this.queryExec('reputation', 'CREATE INDEX IF NOT EXISTS idx_score_host ON score_history(host_id);');
    await this.queryExec('reputation', 'CREATE INDEX IF NOT EXISTS idx_score_time ON score_history(timestamp);');

    await this.queryExec('reputation', `
      CREATE TABLE IF NOT EXISTS baselines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        metric TEXT NOT NULL,
        mean REAL,
        stddev REAL,
        min_val REAL,
        max_val REAL,
        sample_count INTEGER,
        last_updated INTEGER
      );
    `);
  }

  private async initIocSchema() {
    await this.queryExec('ioc', `
      CREATE TABLE IF NOT EXISTS ioc_entries (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        value TEXT NOT NULL,
        description TEXT,
        severity TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    await this.queryExec('ioc', 'CREATE INDEX IF NOT EXISTS idx_ioc_value ON ioc_entries(value);');
    
    await this.queryExec('ioc', `
      CREATE TABLE IF NOT EXISTS fim_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        change_type TEXT NOT NULL,
        previous_hash TEXT,
        current_hash TEXT,
        previous_size INTEGER,
        current_size INTEGER,
        severity TEXT DEFAULT 'info'
      );
    `);
  }

  private async initConfigSchema() {
    await this.queryExec('config', `
      CREATE TABLE IF NOT EXISTS bookmarks (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
    await this.queryExec('config', `
      CREATE TABLE IF NOT EXISTS saved_filters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        module TEXT NOT NULL,
        filter_query TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
  }

  private async initDfirSchema() {
    await this.queryExec('dfir', `
      CREATE TABLE IF NOT EXISTS dfir_evidence (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        source_path TEXT,
        file_hash TEXT,
        file_size INTEGER,
        status TEXT DEFAULT 'parsed',
        added_at INTEGER NOT NULL,
        metadata TEXT
      );
    `);
    await this.queryExec('dfir', `
      CREATE TABLE IF NOT EXISTS dfir_registry_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hive TEXT NOT NULL,
        key_path TEXT NOT NULL,
        value_name TEXT,
        value_type TEXT,
        value_data TEXT,
        last_written INTEGER,
        risk_level TEXT DEFAULT 'info'
      );
    `);
    await this.queryExec('dfir', `
      CREATE TABLE IF NOT EXISTS dfir_prefetch (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        executable TEXT NOT NULL,
        run_count INTEGER DEFAULT 1,
        last_run_time INTEGER NOT NULL,
        prefetch_hash TEXT,
        volume_path TEXT,
        referenced_files TEXT
      );
    `);
    await this.queryExec('dfir', `
      CREATE TABLE IF NOT EXISTS dfir_amcache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL,
        sha1 TEXT,
        file_description TEXT,
        publisher TEXT,
        install_date INTEGER
      );
    `);
    await this.queryExec('dfir', `
      CREATE TABLE IF NOT EXISTS dfir_shimcache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_index INTEGER,
        path TEXT NOT NULL,
        last_modified INTEGER,
        executed INTEGER DEFAULT 0
      );
    `);
    await this.queryExec('dfir', `
      CREATE TABLE IF NOT EXISTS dfir_jumplists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_id TEXT,
        target_path TEXT NOT NULL,
        access_time INTEGER,
        lnk_size INTEGER
      );
    `);
    await this.queryExec('dfir', `
      CREATE TABLE IF NOT EXISTS dfir_srum (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_name TEXT NOT NULL,
        user_sid TEXT,
        bytes_sent INTEGER,
        bytes_received INTEGER,
        execution_time INTEGER
      );
    `);
    await this.queryExec('dfir', `
      CREATE TABLE IF NOT EXISTS dfir_usn_journal (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usn INTEGER,
        file_name TEXT NOT NULL,
        file_reference TEXT,
        parent_reference TEXT,
        reason TEXT,
        timestamp INTEGER NOT NULL
      );
    `);
    await this.queryExec('dfir', `
      CREATE TABLE IF NOT EXISTS dfir_recycle_bin (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_path TEXT NOT NULL,
        deleted_time INTEGER NOT NULL,
        file_size INTEGER,
        deleted_by TEXT
      );
    `);
    await this.queryExec('dfir', `
      CREATE TABLE IF NOT EXISTS dfir_chain_of_custody (
        id TEXT PRIMARY KEY,
        evidence_id TEXT NOT NULL,
        action TEXT NOT NULL,
        performed_by TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        notes TEXT,
        hash_verification TEXT
      );
    `);
  }

  private async initRedteamSchema() {
    await this.queryExec('redteam', `
      CREATE TABLE IF NOT EXISTS redteam_scans (
        id TEXT PRIMARY KEY,
        target TEXT NOT NULL,
        scan_type TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        completed_at INTEGER,
        summary TEXT
      );
    `);
    await this.queryExec('redteam', `
      CREATE TABLE IF NOT EXISTS redteam_ports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scan_id TEXT NOT NULL,
        ip TEXT NOT NULL,
        port INTEGER NOT NULL,
        protocol TEXT NOT NULL,
        state TEXT NOT NULL,
        service TEXT,
        banner TEXT,
        latency_ms REAL,
        tls_info TEXT
      );
    `);
    await this.queryExec('redteam', `
      CREATE TABLE IF NOT EXISTS redteam_http_analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scan_id TEXT NOT NULL,
        target_url TEXT NOT NULL,
        status_code INTEGER,
        server TEXT,
        powered_by TEXT,
        hsts INTEGER DEFAULT 0,
        csp INTEGER DEFAULT 0,
        cors TEXT,
        xfo TEXT,
        headers_json TEXT
      );
    `);
    await this.queryExec('redteam', `
      CREATE TABLE IF NOT EXISTS redteam_ssl_inspection (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scan_id TEXT NOT NULL,
        target_host TEXT NOT NULL,
        issuer TEXT,
        subject TEXT,
        san_list TEXT,
        cipher TEXT,
        tls_version TEXT,
        key_size INTEGER,
        valid_from INTEGER,
        valid_to INTEGER,
        is_expired INTEGER DEFAULT 0
      );
    `);
    await this.queryExec('redteam', `
      CREATE TABLE IF NOT EXISTS redteam_dns_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scan_id TEXT NOT NULL,
        domain TEXT NOT NULL,
        record_type TEXT NOT NULL,
        value TEXT NOT NULL,
        ttl INTEGER
      );
    `);
    await this.queryExec('redteam', `
      CREATE TABLE IF NOT EXISTS redteam_misconfigs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scan_id TEXT NOT NULL,
        target TEXT NOT NULL,
        title TEXT NOT NULL,
        severity TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        recommendation TEXT
      );
    `);
    await this.queryExec('redteam', `
      CREATE TABLE IF NOT EXISTS redteam_cve_matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scan_id TEXT NOT NULL,
        software TEXT NOT NULL,
        version TEXT NOT NULL,
        cve_id TEXT NOT NULL,
        cvss_score REAL,
        summary TEXT
      );
    `);
  }
}
export const databaseManager = new DatabaseManager();
