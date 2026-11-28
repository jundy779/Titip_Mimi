import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { CONFIG, Config } from './config';
import { DB, Db } from './db';
import { GoogleIdentity } from './google';

export interface User { id: string; email: string; name: string; timezone: string }
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

// Token sesi acak 256 bit. Database hanya menyimpan hash-nya.
@Injectable()
export class Sessions {
  constructor(@Inject(DB) private db: Db, @Inject(CONFIG) private config: Config) {}

  upsertUser(id: GoogleIdentity, now = Date.now()): User {
    const existing = this.db.prepare('SELECT id FROM users WHERE google_sub = ?').get(id.sub) as { id: string } | undefined;
    if (existing) {
      this.db.prepare('UPDATE users SET email = ?, name = ? WHERE id = ?').run(id.email, id.name, existing.id);
      return this.user(existing.id)!;
    }
    const userId = randomUUID();
    this.db.prepare('INSERT INTO users (id, google_sub, email, name, created_at) VALUES (?, ?, ?, ?, ?)').run(userId, id.sub, id.email, id.name, now);
    return this.user(userId)!;
  }

  user(id: string): User | undefined {
    return this.db.prepare('SELECT id, email, name, timezone FROM users WHERE id = ?').get(id) as User | undefined;
  }

  create(userId: string, now = Date.now()) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = now + this.config.sessionDays * 86400000;
    this.db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(hash(token), userId, now, expiresAt);
    this.db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
    return { token, expiresAt };
  }

  find(token: string | undefined, now = Date.now()): User | undefined {
    if (!token || token.length > 100) return undefined;
    const row = this.db.prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?').get(hash(token)) as { user_id: string; expires_at: number } | undefined;
    if (!row || row.expires_at < now) return undefined;
    return this.user(row.user_id);
  }

  revoke(token: string | undefined) {
    if (token) this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash(token));
  }
}
