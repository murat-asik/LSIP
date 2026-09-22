import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { integer, text } from '../../core/security';
import { FimEntry, FimWatchPath } from '../../../shared/types/fim.types';

const DEFAULT_WATCH_PATHS: FimWatchPath[] = [
  { path: 'C:\\Windows\\System32\\drivers', recursive: false, patterns: ['*.sys'], label: 'System Drivers' },
  { path: 'C:\\Windows\\System32', recursive: false, patterns: ['*.exe', '*.dll'], label: 'System32 Executables' },
  { path: 'C:\\Windows', recursive: false, patterns: ['*.exe', '*.ini'], label: 'Windows Root' },
];

function patternRegex(pattern: string): RegExp {
  text(pattern, 'Desen', 255);
  const expression = pattern.split('').map(c => c === '*' ? '.*' : c === '?' ? '.' : '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
  return new RegExp('^' + expression + '$', 'i');
}

export class FimScanner {
  private static async scan(watch: FimWatchPath, maximum: number, hashFiles: boolean): Promise<FimEntry[]> {
    text(watch?.path, 'Yol'); integer(maximum, 'Dosya sınırı', 1000);
    if (!Array.isArray(watch.patterns) || !watch.patterns.length || watch.patterns.length > 20) throw new Error('Geçersiz dosya deseni');
    const patterns = watch.patterns.map(patternRegex);
    const root = path.resolve(watch.path);
    const queue = [root]; const entries: FimEntry[] = [];
    let visited = 0;
    const deadline = Date.now() + 30000;
    while (queue.length && entries.length < maximum) {
      const directory = queue.shift()!;
      const listing = await fs.opendir(directory);
      for await (const item of listing) {
        if (++visited > 10000 || Date.now() > deadline) throw new Error('FIM tarama sınırı aşıldı. Daha dar bir dizin seçin.');
        // Do not follow junctions/symlinks into an unexpected directory tree.
        if (item.isSymbolicLink()) continue;
        const filePath = path.join(directory, item.name);
        if (item.isDirectory() && watch.recursive) { queue.push(filePath); continue; }
        if (!item.isFile() || !patterns.some(p => p.test(item.name))) continue;
        const file = await fs.open(filePath, 'r');
        try {
          const stat = await file.stat();
          if (!stat.isFile()) continue;
          let hash = '';
          if (hashFiles) {
            const digest = crypto.createHash('sha256');
            const stream = file.createReadStream({ autoClose: false });
            const timer = setTimeout(() => stream.destroy(new Error('FIM dosya okuma zaman aşımı')), Math.max(1, deadline - Date.now()));
            try { for await (const chunk of stream) digest.update(chunk); }
            finally { clearTimeout(timer); }
            const after = await file.stat();
            if (after.size !== stat.size || after.mtimeMs !== stat.mtimeMs || after.ctimeMs !== stat.ctimeMs) throw new Error('Dosya tarama sırasında değişti. Yeniden deneyin.');
            hash = digest.digest('hex').toUpperCase();
          }
          entries.push({ id: entries.length, filePath, fileName: item.name, directory,
            hashSha256: hash, fileSize: stat.size, lastModified: stat.mtimeMs,
            lastChecked: Date.now(), status: 'unchanged' });
        } finally { await file.close(); }
        if (entries.length >= maximum) break;
      }
    }
    return entries;
  }
  public static scanDirectory(watchPath: FimWatchPath, maxFiles = 100): Promise<FimEntry[]> {
    return this.scan(watchPath, maxFiles, true);
  }
  public static quickScan(directory: string, pattern = '*.*', maxFiles = 200): Promise<FimEntry[]> {
    return this.scan({ path: directory, patterns: [pattern], recursive: false, label: 'Custom Scan' }, maxFiles, false);
  }
  public static getDefaultWatchPaths(): FimWatchPath[] { return DEFAULT_WATCH_PATHS.map(p => ({ ...p, patterns: [...p.patterns] })); }
}
