import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Migrasi berurutan. Setiap langkah berjalan dalam transaksi dan dicatat di schema_version.
const migrations: string[] = [
  `CREATE TABLE users (
     id TEXT PRIMARY KEY,
     google_sub TEXT NOT NULL UNIQUE,
     email TEXT NOT NULL,
     name TEXT NOT NULL DEFAULT '',
     timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
     created_at INTEGER NOT NULL
   );
   CREATE TABLE sessions (
     token_hash TEXT PRIMARY KEY,
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     created_at INTEGER NOT NULL,
     expires_at INTEGER NOT NULL
   );
   CREATE INDEX sessions_user ON sessions(user_id);
   CREATE TABLE items (
     owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     client_id TEXT NOT NULL,
     kind TEXT NOT NULL CHECK (kind IN ('note','account','agenda')),
     search TEXT NOT NULL DEFAULT '',
     data TEXT NOT NULL,
     deleted INTEGER NOT NULL DEFAULT 0,
     updated_at INTEGER NOT NULL,
     seq INTEGER NOT NULL,
     PRIMARY KEY (owner_id, client_id)
   );
   CREATE INDEX items_owner_seq ON items(owner_id, seq);
   CREATE TABLE counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL);
   INSERT INTO counters VALUES ('seq', 0);`,
];

export type Db = Database.Database;

export function openDatabase(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
  const row = db.prepare('SELECT version FROM schema_version').get() as { version: number } | undefined;
  let version = row?.version ?? 0;
  if (!row) db.prepare('INSERT INTO schema_version VALUES (0)').run();
  for (; version < migrations.length; version++) {
    db.transaction(() => {
      db.exec(migrations[version]);
      db.prepare('UPDATE schema_version SET version = ?').run(version + 1);
    })();
  }
  return db;
}

export const DB = Symbol('DB');
