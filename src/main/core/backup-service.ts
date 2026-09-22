import { app, safeStorage, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import sqlite3 from 'sqlite3';
import { databaseManager } from './database-manager';
import { safeIpcHandle, withIpcMaintenance } from './security';
const f = fs.promises;
export const storageKeys = ['lsip_case_workspace_v1','lsip_v3_cases','lsip_v3_iocs','lsip_v3_evidence','lsip_theme','lsip_language'];
const databaseNames = ['assets','events','network','process','reputation','ioc','config','dfir','redteam'];
const uuid = /^[a-f0-9-]{36}$/;
interface Entry { path: string; blob: string; iv: string; tag: string; sha256: string; }
interface Manifest { mac?: string; version: 1; id: string; salt: string; owner: string; entries: Entry[]; }
function derive(password: string, salt: Buffer): Promise<Buffer> {
  if (typeof password !== 'string' || password.length < 12 || password.length > 256) throw new Error('Backup password must contain 12 to 256 characters');
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, 32, (error, key) => error ? reject(error) : resolve(key)));
}
function allowed(name: string): boolean {
  return databaseNames.some(db => name === 'databases/' + db + '.db') || name === 'config/config.json' || name === 'restore-state/storage.json' || name === 'evidence-vault/vault.key' || /^evidence-vault\/EV-[a-f0-9-]+\.aes$/i.test(name);
}
function validateStorage(value: any): Record<string, string | null> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid workspace backup');
  if (JSON.stringify(value).length > 10 * 1024 * 1024) throw new Error('Workspace backup is too large');
  for (const [key, item] of Object.entries(value)) if (!storageKeys.includes(key) || (typeof item !== 'string' && item !== null)) throw new Error('Invalid workspace backup');
  return Object.fromEntries(storageKeys.map(key => [key, value[key] ?? null]));
}
async function hashFile(file: string) {
  const hash = crypto.createHash('sha256'); for await (const chunk of fs.createReadStream(file)) hash.update(chunk); return hash.digest('hex');
}
async function removeWork(root: string, directory: string) {
  const relative = path.relative(path.resolve(root), path.resolve(directory));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid temporary directory');
  await f.rm(directory, { recursive: true, force: true });
}
async function regularFiles(directory: string, prefix: string): Promise<string[]> {
  try {
    if ((await f.lstat(directory)).isSymbolicLink()) throw new Error('Backup source cannot be a link');
    const rows = await f.readdir(directory, { withFileTypes: true });
    return rows.filter(row => row.isFile() && !row.isSymbolicLink() && allowed(prefix + '/' + row.name)).map(row => prefix + '/' + row.name);
  } catch (error: any) { if (error.code === 'ENOENT') return []; throw error; }
}
export async function createBackup(destination: string, password: string, storage: Record<string, string | null>) {
  storage = validateStorage(storage);
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows key protection is unavailable');
  const userData = app.getPath('userData');
  const relative = path.relative(userData, path.resolve(destination));
  if (!relative || (!relative.startsWith('..') && !path.isAbsolute(relative))) throw new Error('Choose a backup directory outside application data');
  const id = crypto.randomUUID(), salt = crypto.randomBytes(16), key = await derive(password, salt);
  const workRoot = path.join(userData, '.backup-work'), work = path.join(workRoot, id);
  const target = path.join(destination, 'LSIP-backup-' + id);
  try {
    await f.mkdir(target, { recursive: false });
    await databaseManager.snapshotTo(path.join(work, 'databases'), async () => {
      const files = [...await regularFiles(path.join(userData, 'config'), 'config'), ...await regularFiles(path.join(userData, 'evidence-vault'), 'evidence-vault')];
      for (const name of files) { const to = path.join(work, name); await f.mkdir(path.dirname(to), { recursive: true }); await f.copyFile(path.join(userData, name), to); }
      await f.mkdir(path.join(work, 'restore-state'), { recursive: true });
      await f.writeFile(path.join(work, 'restore-state/storage.json'), JSON.stringify(storage));
    });
    const names = [...databaseNames.map(db => 'databases/' + db + '.db'), ...await regularFiles(path.join(work, 'config'), 'config'), ...await regularFiles(path.join(work, 'evidence-vault'), 'evidence-vault'), 'restore-state/storage.json'];
    const manifest: Manifest = { version: 1, id, salt: salt.toString('hex'), owner: safeStorage.encryptString('LSIP:' + id).toString('base64'), entries: [] };
    for (const name of names) {
      const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key, iv); cipher.setAAD(Buffer.from(name));
      const blob = manifest.entries.length + '.bin', destinationFile = path.join(target, blob);
      await pipeline(fs.createReadStream(path.join(work, name)), cipher, fs.createWriteStream(destinationFile, { flags: 'wx' }));
      manifest.entries.push({ path: name, blob, iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), sha256: await hashFile(destinationFile) });
    }
    manifest.mac = crypto.createHmac('sha256', key).update(JSON.stringify(manifest)).digest('hex');
    await f.writeFile(path.join(target, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' });
    return { directory: target, files: manifest.entries.length };
  } finally { key.fill(0); await removeWork(workRoot, work); }
}
async function checkDatabase(file: string) {
  const db = await new Promise<sqlite3.Database>((resolve,reject) => { const connection = new sqlite3.Database(file, sqlite3.OPEN_READONLY, error => error ? reject(error) : resolve(connection)); });
  try {
    const rows = await new Promise<any[]>((resolve,reject) => db.all('PRAGMA quick_check', (error, rows) => error ? reject(error) : resolve(rows)));
    if (rows.length !== 1 || Object.values(rows[0])[0] !== 'ok') throw new Error('Backup database integrity check failed');
  } finally { await new Promise<void>((resolve,reject) => db.close(error => error ? reject(error) : resolve())); }
}
export async function stageRestore(directory: string, password: string) {
  const userData = app.getPath('userData'), marker = path.join(userData, 'pending-restore.json');
  if (fs.existsSync(marker)) throw new Error('A restore is already pending');
  if ((await f.stat(path.join(directory, 'manifest.json'))).size > 4 * 1024 * 1024) throw new Error('Backup manifest is too large');
  const manifest: Manifest = JSON.parse(await f.readFile(path.join(directory, 'manifest.json'), 'utf8'));
  if (manifest.version !== 1 || !uuid.test(manifest.id) || !/^[a-f0-9]{32}$/.test(manifest.salt) || !Array.isArray(manifest.entries) || manifest.entries.length > 10000) throw new Error('Invalid backup manifest');
  if (safeStorage.decryptString(Buffer.from(manifest.owner, 'base64')) !== 'LSIP:' + manifest.id) throw new Error('Backup belongs to another Windows account or machine');
  const paths = new Set<string>(), blobs = new Set<string>();
  for (const entry of manifest.entries) {
    if (!allowed(entry.path) || paths.has(entry.path) || blobs.has(entry.blob) || !/^\d+\.bin$/.test(entry.blob) || !/^[a-f0-9]{24}$/.test(entry.iv) || !/^[a-f0-9]{32}$/.test(entry.tag) || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error('Invalid backup entry');
    paths.add(entry.path); blobs.add(entry.blob);
  }
  if (!databaseNames.every(db => paths.has('databases/' + db + '.db')) || !paths.has('restore-state/storage.json')) throw new Error('Backup is incomplete');
  const id = crypto.randomUUID(), stageRoot = path.join(userData, '.restore'), stage = path.join(stageRoot, id), key = await derive(password, Buffer.from(manifest.salt, 'hex'));
  let staged = false;
  try {
    const { mac, ...signed } = manifest;
    const expected = crypto.createHmac('sha256', key).update(JSON.stringify(signed)).digest();
    if (!mac || !/^[a-f0-9]{64}$/.test(mac) || !crypto.timingSafeEqual(expected, Buffer.from(mac, 'hex'))) throw new Error('Backup authentication failed');
    for (const entry of manifest.entries) {
      const blob = path.join(directory, entry.blob), stat = await f.lstat(blob);
      if (!stat.isFile() || stat.isSymbolicLink() || await hashFile(blob) !== entry.sha256) throw new Error('Backup content is missing or corrupted');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(entry.iv, 'hex')); decipher.setAAD(Buffer.from(entry.path)); decipher.setAuthTag(Buffer.from(entry.tag, 'hex'));
      const target = path.join(stage, entry.path); await f.mkdir(path.dirname(target), { recursive: true });
      await pipeline(fs.createReadStream(blob), decipher, fs.createWriteStream(target, { flags: 'wx' }));
    }
    validateStorage(JSON.parse(await f.readFile(path.join(stage, 'restore-state/storage.json'), 'utf8')));
    if (paths.has('config/config.json')) { const config = JSON.parse(await f.readFile(path.join(stage, 'config/config.json'), 'utf8')); if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Invalid configuration backup'); }
    if (paths.has('evidence-vault/vault.key')) safeStorage.decryptString(await f.readFile(path.join(stage, 'evidence-vault/vault.key')));
    for (const name of databaseNames) await checkDatabase(path.join(stage, 'databases', name + '.db'));
    for (const name of ['config','evidence-vault']) await f.mkdir(path.join(stage, name), { recursive: true });
    await f.writeFile(marker, JSON.stringify({ id, phase: 'pending' }), { flag: 'wx' }); staged = true;
    return { restartRequired: true };
  } finally { key.fill(0); if (!staged) await removeWork(stageRoot, stage); }
}
export function registerBackupIpc() {
  safeIpcHandle('backup:create', async (event, input) => {
    const selected = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    if (selected.canceled) return { canceled: true };
    return withIpcMaintenance(async () => {
      const storage = await event.sender.executeJavaScript('Object.fromEntries(' + JSON.stringify(storageKeys) + '.map(key => [key, localStorage.getItem(key)]))');
      return createBackup(selected.filePaths[0], input.password, storage);
    });
  });
  safeIpcHandle('backup:restore', async (_event, input) => {
    const selected = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (selected.canceled) return { canceled: true };
    return withIpcMaintenance(() => stageRestore(selected.filePaths[0], input.password));
  });
  safeIpcHandle('backup:pending-storage', async () => {
    const file = path.join(app.getPath('userData'), 'restore-state/storage.json');
    return fs.existsSync(file) ? validateStorage(JSON.parse(await f.readFile(file, 'utf8'))) : null;
  });
  safeIpcHandle('backup:ack-storage', async () => { await f.rename(path.join(app.getPath('userData'), 'restore-state/storage.json'), path.join(app.getPath('userData'), 'restore-state/storage.applied.json')); return true; });
  safeIpcHandle('backup:restart', async () => { app.relaunch(); app.quit(); return true; });
}
