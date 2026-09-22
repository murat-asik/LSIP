import { randomUUID } from 'crypto';
import { databaseManager as db } from '../../core/database-manager';
import { text } from '../../core/security';

const kinds = ['Sigma', 'YARA', 'IOC', 'Hunt'];
function kind(value: unknown): string {
  if (typeof value !== 'string' || !kinds.includes(value)) throw new Error('Invalid rule kind');
  return value;
}
export async function initializeRuleLibrary(): Promise<void> {
  await db.queryExec('config', `CREATE TABLE IF NOT EXISTS rule_library (
    id TEXT NOT NULL, revision INTEGER NOT NULL, kind TEXT NOT NULL,
    title TEXT NOT NULL, content TEXT NOT NULL, created_at INTEGER NOT NULL,
    PRIMARY KEY(id, revision))`);
}
export async function listRules(input: {kind: string}) {
  return db.queryAll('config', 'SELECT * FROM rule_library WHERE kind = ? ORDER BY created_at DESC, revision DESC LIMIT 200', [kind(input?.kind)]);
}
export async function saveRule(input: {id?: string; expectedRevision?: number; kind: string; title: string; content: string}) {
  const ruleKind = kind(input?.kind);
  const title = text(input?.title, 'Rule title', 200).trim();
  const content = input?.content;
  if (typeof content !== 'string' || content.length > 100000 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(content)) throw new Error('Invalid rule content');
  if (!title || !content.trim()) throw new Error('Rule title and content are required');
  const id = input.id || randomUUID();
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error('Invalid rule identifier');
  const latest = await db.queryGet<{revision: number; kind: string}>('config', 'SELECT revision, kind FROM rule_library WHERE id = ? ORDER BY revision DESC LIMIT 1', [id]);
  if (input.id && !latest) throw new Error('Rule does not exist');
  if (latest && (latest.kind !== ruleKind || input.expectedRevision !== latest.revision)) throw new Error('Rule revision changed; reload the latest revision');
  const result = {id, revision: (latest?.revision || 0) + 1, kind: ruleKind, title, content, created_at: Date.now()};
  // The composite primary key also rejects two concurrent saves of the same revision.
  await db.queryRun('config', 'INSERT INTO rule_library(id,revision,kind,title,content,created_at) VALUES(?,?,?,?,?,?)', Object.values(result));
  return result;
}
