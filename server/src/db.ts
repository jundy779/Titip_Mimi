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
  // 2: Telegram. Tautan satu Telegram ke satu pemilik, kode tautan sekali pakai (hash saja),
  // deduplikasi update, file milik pemilik, peta pesan/album ke titipan, dan catatan pengiriman.
  `ALTER TABLE users ADD COLUMN quiet_start INTEGER DEFAULT 1320;
   ALTER TABLE users ADD COLUMN quiet_end INTEGER DEFAULT 360;
   CREATE TABLE telegram_links (
     owner_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
     tg_user_id INTEGER NOT NULL UNIQUE,
     chat_id INTEGER NOT NULL,
     username TEXT NOT NULL DEFAULT '',
     linked_at INTEGER NOT NULL
   );
   CREATE TABLE telegram_link_codes (
     code_hash TEXT PRIMARY KEY,
     owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     expires_at INTEGER NOT NULL,
     used_at INTEGER
   );
   CREATE INDEX telegram_link_codes_owner ON telegram_link_codes(owner_id);
   CREATE TABLE telegram_updates (update_id INTEGER PRIMARY KEY, received_at INTEGER NOT NULL);
   CREATE TABLE telegram_files (
     owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     unique_id TEXT NOT NULL,
     file_id TEXT NOT NULL,
     kind TEXT NOT NULL CHECK (kind IN ('photo','video','document')),
     mime TEXT NOT NULL DEFAULT '',
     name TEXT NOT NULL DEFAULT '',
     size INTEGER NOT NULL DEFAULT 0,
     created_at INTEGER NOT NULL,
     PRIMARY KEY (owner_id, unique_id)
   );
   CREATE TABLE telegram_threads (
     owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     key TEXT NOT NULL,
     client_id TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     PRIMARY KEY (owner_id, key)
   );
   CREATE TABLE reminder_deliveries (
     owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     client_id TEXT NOT NULL,
     occurrence TEXT NOT NULL,
     status TEXT NOT NULL CHECK (status IN ('pending','sending','sent','retry','failed','skipped')),
     attempts INTEGER NOT NULL DEFAULT 0,
     next_try INTEGER NOT NULL,
     lease_until INTEGER NOT NULL DEFAULT 0,
     sent_at INTEGER,
     message_id INTEGER,
     error TEXT NOT NULL DEFAULT '',
     PRIMARY KEY (owner_id, client_id, occurrence)
   );
   CREATE INDEX reminder_due ON reminder_deliveries(status, next_try);`,
  // 3: pengaturan server yang bisa diubah dari Profil (token bot Telegram). Tidak pernah dikirim ke browser.
  `CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL);`,
  // 4: pasangan. Dua baris per pasangan (satu per orang), kode undangan sekali pakai (hash saja),
  // surat antarpasangan, dan rencana berdua yang terikat ke pasangan (pair_id = hash dua id terurut).
  `CREATE TABLE partners (
     user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
     partner_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
     pair_id TEXT NOT NULL,
     since INTEGER NOT NULL
   );
   CREATE TABLE partner_codes (
     code_hash TEXT PRIMARY KEY,
     owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     expires_at INTEGER NOT NULL
   );
   CREATE TABLE letters (
     id TEXT PRIMARY KEY,
     from_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     to_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     body TEXT NOT NULL,
     sticker TEXT NOT NULL DEFAULT '',
     created_at INTEGER NOT NULL,
     read_at INTEGER,
     hidden_from INTEGER NOT NULL DEFAULT 0,
     hidden_to INTEGER NOT NULL DEFAULT 0
   );
   CREATE INDEX letters_to ON letters(to_id, created_at);
   CREATE INDEX letters_from ON letters(from_id, created_at);
   CREATE TABLE plans (
     id TEXT PRIMARY KEY,
     pair_id TEXT NOT NULL,
     created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     title TEXT NOT NULL,
     note TEXT NOT NULL DEFAULT '',
     place TEXT NOT NULL DEFAULT '',
     time TEXT NOT NULL DEFAULT '',
     done INTEGER NOT NULL DEFAULT 0,
     deleted INTEGER NOT NULL DEFAULT 0,
     updated_at INTEGER NOT NULL,
     updated_by TEXT NOT NULL
   );
   CREATE INDEX plans_pair ON plans(pair_id, updated_at);`,
];

export type Db = Database.Database;

export const SCHEMA_VERSION = migrations.length;

// upTo hanya untuk uji: membuka database pada versi lama untuk menguji jalur upgrade.
export function openDatabase(path: string, upTo = migrations.length): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
  const row = db.prepare('SELECT version FROM schema_version').get() as { version: number } | undefined;
  let version = row?.version ?? 0;
  if (!row) db.prepare('INSERT INTO schema_version VALUES (0)').run();
  for (; version < upTo; version++) {
    db.transaction(() => {
      db.exec(migrations[version]);
      db.prepare('UPDATE schema_version SET version = ?').run(version + 1);
    })();
  }
  return db;
}

export const DB = Symbol('DB');
