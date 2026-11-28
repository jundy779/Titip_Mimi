// Backup konsisten SQLite (aman saat server berjalan) lalu verifikasi salinannya.
// Pakai: node dist/src/backup.js <database> <folder-backup>
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export async function backup(source: string, folder: string, now = new Date()) {
  mkdirSync(folder, { recursive: true });
  const target = join(folder, 'mimi-' + now.toISOString().replace(/[:.]/g, '-') + '.sqlite');
  const db = new Database(source, { readonly: true });
  await db.backup(target);
  const counts = (d: Database.Database) => d.prepare("SELECT (SELECT COUNT(*) FROM users) users, (SELECT COUNT(*) FROM items) items, (SELECT COUNT(*) FROM items WHERE deleted = 0) live").get() as Record<string, number>;
  const original = counts(db);
  db.close();
  const copy = new Database(target, { readonly: true });
  const integrity = (copy.prepare('PRAGMA integrity_check').get() as { integrity_check: string }).integrity_check;
  const restored = counts(copy);
  copy.close();
  const ok = integrity === 'ok' && JSON.stringify(original) === JSON.stringify(restored);
  return { target, ok, integrity, original, restored };
}

if (require.main === module) {
  const [source, folder] = process.argv.slice(2);
  if (!source || !folder) { console.error('Pakai: node dist/src/backup.js <database> <folder-backup>'); process.exit(2); }
  backup(source, folder).then(r => { console.log(JSON.stringify(r)); process.exit(r.ok ? 0 : 1); });
}
