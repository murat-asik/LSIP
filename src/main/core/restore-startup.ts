import { app } from 'electron';
import fs from 'fs';
import path from 'path';
/** Runs before database/config modules are imported. Existing data remains in rollback. */
export function applyPendingRestore() {
  const root = path.resolve(app.getPath('userData')), marker = path.join(root, 'pending-restore.json');
  if (!fs.existsSync(marker)) return;
  const job = JSON.parse(fs.readFileSync(marker, 'utf8'));
  if (!/^[a-f0-9-]{36}$/.test(job.id)) throw new Error('Invalid pending restore');
  const stage = path.join(root, '.restore', job.id), rollback = path.join(root, '.restore-rollback', job.id);
  const names = ['databases','config','evidence-vault','restore-state'];
  const update = () => { fs.writeFileSync(marker + '.tmp', JSON.stringify(job)); fs.renameSync(marker + '.tmp', marker); };
  const removeNew = (target: string) => {
    if (!names.some(name => target === path.join(root, name))) throw new Error('Invalid restore target');
    fs.rmSync(target, { recursive: true, force: true });
  };
  const undo = () => {
    for (const name of names) {
      const old = path.join(rollback, name), current = path.join(root, name);
      if (fs.existsSync(old)) { removeNew(current); fs.renameSync(old, current); }
      else if (job.absent?.includes(name) && !fs.existsSync(path.join(stage, name))) removeNew(current);
    }
    fs.renameSync(marker, path.join(rollback, 'failed-restore.json'));
  };
  if (job.phase === 'applying') { undo(); return; }
  if (job.phase === 'done') { fs.renameSync(marker, path.join(rollback, 'completed-restore.json')); return; }
  if (job.phase !== 'pending') throw new Error('Invalid restore phase');
  for (const name of names) if (!fs.statSync(path.join(stage,name)).isDirectory()) throw new Error('Restore staging is incomplete');
  fs.mkdirSync(rollback, { recursive: true });
  job.absent = names.filter(name => !fs.existsSync(path.join(root,name))); job.phase = 'applying'; update();
  try {
    for (const name of names) {
      const current = path.join(root,name);
      if (fs.existsSync(current)) fs.renameSync(current, path.join(rollback,name));
      fs.renameSync(path.join(stage,name),current);
    }
    job.phase = 'done'; update();
    fs.renameSync(marker, path.join(rollback, 'completed-restore.json'));
  } catch (error) { undo(); throw error; }
}
