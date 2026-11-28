import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Injectable, Post, Query, Req, UseGuards } from '@nestjs/common';
import { DB, Db } from './db';
import { AuthGuard, AuthedRequest } from './auth';

// Bentuk satu titipan sama dengan yang disimpan web di localStorage.
// Hanya kolom yang dikenal yang disimpan; kolom lain dibuang.
export interface ItemData {
  clientId: string; kind: 'note' | 'account' | 'agenda'; title: string; note: string; time: string; done: boolean;
  identity?: string; method?: string; history?: { label: string; at: string }[];
  icsId?: string; allDay?: boolean; endDay?: string; startUTC?: string; endUTC?: string;
  reminderId?: string; snoozeUntil?: number; extensionId?: string;
}
export interface Change extends Partial<ItemData> { clientId: string; updatedAt: number; deleted?: boolean }
export type Status = 'saved' | 'stale' | 'invalid';

const MAX_CHANGES = 500;
const str = (v: unknown, max: number) => typeof v === 'string' ? v.slice(0, max) : undefined;
const isIso = (v: unknown) => typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v));

export function clean(raw: Record<string, unknown>): ItemData | string {
  const clientId = raw.clientId;
  if (typeof clientId !== 'string' || !/^[\w-]{8,64}$/.test(clientId)) return 'clientId tidak valid';
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title || title.length > 100) return 'judul wajib 1–100 karakter';
  const time = typeof raw.time === 'string' ? raw.time : '';
  if (time && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(time)) return 'format waktu harus YYYY-MM-DDTHH:MM';
  const note = typeof raw.note === 'string' ? raw.note : '';
  if (note.length > 4000) return 'catatan maksimal 4000 karakter';
  const kind = raw.kind === 'account' ? 'account' : raw.kind === 'agenda' || (raw.kind !== 'note' && time) ? 'agenda' : 'note';
  const item: ItemData = { clientId, kind, title, note, time, done: raw.done === true };
  if (kind === 'account') {
    const identity = str(raw.identity, 160)?.trim();
    if (!identity) return 'kartu akun butuh email atau label';
    item.identity = identity;
    item.method = str(raw.method, 40) || 'Belum diisi';
  }
  if (Array.isArray(raw.history)) {
    item.history = raw.history.slice(-200)
      .filter((e): e is { label: string; at: string } => !!e && typeof (e as any).label === 'string' && isIso((e as any).at))
      .map(e => ({ label: e.label.slice(0, 60), at: e.at }));
  }
  for (const [k, max] of [['icsId', 300], ['endDay', 20], ['reminderId', 64], ['extensionId', 64]] as const) {
    const v = str(raw[k], max); if (v) item[k] = v;
  }
  for (const k of ['startUTC', 'endUTC'] as const) if (isIso(raw[k])) item[k] = raw[k] as string;
  if (raw.allDay === true) item.allDay = true;
  if (typeof raw.snoozeUntil === 'number' && Number.isFinite(raw.snoozeUntil) && raw.snoozeUntil > 0) item.snoozeUntil = raw.snoozeUntil;
  return item;
}

const searchText = (i: ItemData) => [i.title, i.note, i.identity, i.method].filter(Boolean).join(' ').toLocaleLowerCase('id');

interface Row { client_id: string; kind: string; data: string; deleted: number; updated_at: number; seq: number }
const toWire = (r: Row) => ({ ...JSON.parse(r.data), clientId: r.client_id, updatedAt: r.updated_at, deleted: r.deleted === 1, seq: r.seq });

@Injectable()
export class Items {
  constructor(@Inject(DB) private db: Db) {}

  private nextSeq(): number {
    return (this.db.prepare("UPDATE counters SET value = value + 1 WHERE name = 'seq' RETURNING value").get() as { value: number }).value;
  }

  // Sinkron dua arah. Setiap titipan menang berdasarkan updatedAt terbaru (last-write-wins).
  // Seri diputus secara deterministik dengan isi data, jadi semua perangkat berakhir sama.
  sync(ownerId: string, changes: unknown, since: unknown, now = Date.now()) {
    if (!Array.isArray(changes) || changes.length > MAX_CHANGES) throw new BadRequestException({ code: 'bad_changes', message: `Kirim paling banyak ${MAX_CHANGES} perubahan.` });
    const cursor = Number.isSafeInteger(since) && (since as number) >= 0 ? (since as number) : 0;
    const results: { clientId: string; status: Status; error?: string }[] = [];
    const find = this.db.prepare('SELECT client_id, kind, data, deleted, updated_at, seq FROM items WHERE owner_id = ? AND client_id = ?');
    const insert = this.db.prepare('INSERT INTO items (owner_id, client_id, kind, search, data, deleted, updated_at, seq) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const update = this.db.prepare('UPDATE items SET kind = ?, search = ?, data = ?, deleted = ?, updated_at = ?, seq = ? WHERE owner_id = ? AND client_id = ?');
    this.db.transaction(() => {
      for (const raw of changes) {
        const clientId = typeof raw?.clientId === 'string' ? raw.clientId : '';
        const updatedAt = Math.min(Number(raw?.updatedAt) || 0, now + 5 * 60000);
        if (!updatedAt || updatedAt < 0) { results.push({ clientId, status: 'invalid', error: 'updatedAt wajib' }); continue; }
        const deleted = raw?.deleted === true;
        const item = deleted ? (/^[\w-]{8,64}$/.test(clientId) ? { clientId, kind: 'note', title: '', note: '', time: '', done: false } as ItemData : 'clientId tidak valid') : clean(raw);
        if (typeof item === 'string') { results.push({ clientId, status: 'invalid', error: item }); continue; }
        const data = deleted ? '{}' : JSON.stringify(item);
        const existing = find.get(ownerId, clientId) as Row | undefined;
        if (existing) {
          const newer = updatedAt > existing.updated_at || (updatedAt === existing.updated_at && (deleted ? 1 : 0) + data > existing.deleted + existing.data);
          if (!newer) { results.push({ clientId, status: 'stale' }); continue; }
          update.run(deleted ? existing.kind : item.kind, deleted ? '' : searchText(item), data, deleted ? 1 : 0, updatedAt, this.nextSeq(), ownerId, clientId);
        } else {
          insert.run(ownerId, clientId, item.kind, deleted ? '' : searchText(item), data, deleted ? 1 : 0, updatedAt, this.nextSeq());
        }
        results.push({ clientId, status: 'saved' });
      }
    })();
    const rows = this.db.prepare('SELECT client_id, kind, data, deleted, updated_at, seq FROM items WHERE owner_id = ? AND seq > ? ORDER BY seq LIMIT 2000').all(ownerId, cursor) as Row[];
    const max = rows.length ? rows[rows.length - 1].seq : cursor;
    return { results, items: rows.map(toWire), cursor: max, more: rows.length === 2000 };
  }

  search(ownerId: string, q: string) {
    const term = '%' + q.toLocaleLowerCase('id').replace(/[\\%_]/g, m => '\\' + m) + '%';
    const rows = this.db.prepare("SELECT client_id, kind, data, deleted, updated_at, seq FROM items WHERE owner_id = ? AND deleted = 0 AND search LIKE ? ESCAPE '\\' ORDER BY updated_at DESC LIMIT 100").all(ownerId, term) as Row[];
    return rows.map(toWire);
  }
}

@Controller('v1')
@UseGuards(AuthGuard)
export class ItemsController {
  constructor(private items: Items) {}

  @Post('sync')
  @HttpCode(200)
  sync(@Req() req: AuthedRequest, @Body() body: { changes?: unknown; since?: unknown }) {
    return this.items.sync(req.user.id, body?.changes ?? [], body?.since);
  }

  @Get('items')
  search(@Req() req: AuthedRequest, @Query('q') q = '') {
    if (typeof q !== 'string' || q.length > 100) throw new BadRequestException({ code: 'bad_query', message: 'Kata pencarian terlalu panjang.' });
    return { items: this.items.search(req.user.id, q.trim()) };
  }
}
