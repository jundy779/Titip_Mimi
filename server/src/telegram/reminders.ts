import { Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { DB, Db } from '../db';
import { ItemData, Items } from '../items';
import { TELEGRAM_API, TelegramApi, TelegramError } from './api';
import { TelegramBot } from './bot';
import { humanTime, inQuiet, quietEnds, toEpoch } from './time';

// Pengingat terlambat lebih dari ini (misalnya server mati semalaman) tidak dikirim lagi,
// supaya Iqlima tidak diserbu pengingat lama sekaligus.
const CATCH_UP_MS = 6 * 3600000;
const LEASE_MS = 2 * 60000;
const BACKOFF = [60000, 5 * 60000, 15 * 60000, 60 * 60000];
const MAX_ATTEMPTS = 5;

// Satu kejadian = jadwal + tunda. Mengubah jam atau menunda membuat kejadian baru;
// kejadian yang sama tidak pernah dikirim dua kali (kunci utama di reminder_deliveries).
export function occurrenceOf(item: Pick<ItemData, 'time' | 'snoozeUntil'>, tz: string) {
  const at = toEpoch(item.time, tz);
  if (at == null) return null;
  const snooze = item.snoozeUntil && item.snoozeUntil > at ? item.snoozeUntil : 0;
  return { key: `${item.time}|${snooze}`, dueAt: snooze || at };
}

interface Claimed { owner_id: string; client_id: string; occurrence: string; attempts: number }

@Injectable()
export class Reminders implements OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(
    @Inject(DB) private db: Db,
    private items: Items,
    private bot: TelegramBot,
    @Optional() @Inject(TELEGRAM_API) private api: TelegramApi | null,
  ) {}

  start(everyMs: number) {
    if (!this.api || this.timer) return;
    this.timer = setInterval(() => { this.tick().catch(e => console.error('pengingat gagal', e instanceof Error ? e.message : e)); }, everyMs);
    this.timer.unref?.();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async tick(now = Date.now()) {
    if (!this.api || this.running) return { queued: 0, sent: 0, deferred: 0, skipped: 0, retry: 0, failed: 0 };
    this.running = true;
    try { const queued = this.queue(now); return { queued, ...(await this.deliver(now)) }; }
    finally { this.running = false; }
  }

  // Catat kejadian yang sudah jatuh tempo. INSERT OR IGNORE membuatnya aman dijalankan berulang.
  queue(now: number) {
    const rows = this.db.prepare(`SELECT i.owner_id, i.client_id, i.data, u.timezone FROM items i
      JOIN telegram_links l ON l.owner_id = i.owner_id JOIN users u ON u.id = i.owner_id
      WHERE i.kind = 'agenda' AND i.deleted = 0`).all() as { owner_id: string; client_id: string; data: string; timezone: string }[];
    const insert = this.db.prepare("INSERT OR IGNORE INTO reminder_deliveries (owner_id, client_id, occurrence, status, next_try) VALUES (?, ?, ?, 'pending', ?)");
    let queued = 0;
    this.db.transaction(() => {
      for (const r of rows) {
        const item = JSON.parse(r.data) as ItemData;
        if (item.done || !item.time) continue;
        const occ = occurrenceOf(item, r.timezone);
        if (!occ || occ.dueAt > now || occ.dueAt < now - CATCH_UP_MS) continue;
        queued += insert.run(r.owner_id, r.client_id, occ.key, occ.dueAt).changes;
      }
    })();
    return queued;
  }

  async deliver(now: number) {
    const tally = { sent: 0, deferred: 0, skipped: 0, retry: 0, failed: 0 };
    // Klaim atomik: dua putaran (atau dua proses) tidak bisa mengambil kejadian yang sama.
    const claimed = this.db.prepare(`UPDATE reminder_deliveries SET status = 'sending', lease_until = ?, attempts = attempts + 1
      WHERE (status IN ('pending','retry') AND next_try <= ?) OR (status = 'sending' AND lease_until < ?)
      RETURNING owner_id, client_id, occurrence, attempts`).all(now + LEASE_MS, now, now) as Claimed[];
    const set = (c: Claimed, fields: string, ...values: unknown[]) =>
      this.db.prepare(`UPDATE reminder_deliveries SET ${fields} WHERE owner_id = ? AND client_id = ? AND occurrence = ?`).run(...values, c.owner_id, c.client_id, c.occurrence);

    for (const c of claimed) {
      // Periksa ulang tepat sebelum mengirim: sambungan, pemilik, status selesai, jadwal, jam tenang.
      const link = this.db.prepare('SELECT chat_id FROM telegram_links WHERE owner_id = ?').get(c.owner_id) as { chat_id: number } | undefined;
      const user = this.db.prepare('SELECT timezone, quiet_start, quiet_end FROM users WHERE id = ?').get(c.owner_id) as { timezone: string; quiet_start: number | null; quiet_end: number | null } | undefined;
      const item = this.items.get(c.owner_id, c.client_id);
      const occ = item && user ? occurrenceOf(item, user.timezone) : null;
      if (!link || !user || !item || item.done || item.kind !== 'agenda' || occ?.key !== c.occurrence) {
        set(c, "status = 'skipped'"); tally.skipped++; continue;
      }
      if (inQuiet(now, user.timezone, user.quiet_start, user.quiet_end)) {
        set(c, "status = 'pending', next_try = ?, attempts = attempts - 1", quietEnds(now, user.timezone, user.quiet_end!)); tally.deferred++; continue;
      }
      try {
        const messageId = await this.send(c.owner_id, link.chat_id, item);
        set(c, "status = 'sent', sent_at = ?, message_id = ?, error = ''", now, messageId); tally.sent++;
      } catch (error) {
        const e = error instanceof TelegramError ? error : new TelegramError(0, 'unknown');
        console.warn(JSON.stringify({ reminder: 'send', code: e.code, attempt: c.attempts }));
        if (e.gone) { this.bot.unlink(c.owner_id); set(c, "status = 'failed', error = 'gone'"); tally.failed++; }
        else if (c.attempts >= MAX_ATTEMPTS) { set(c, "status = 'failed', error = ?", String(e.code)); tally.failed++; }
        else {
          const wait = e.retryAfter ? e.retryAfter * 1000 : BACKOFF[Math.min(c.attempts - 1, BACKOFF.length - 1)];
          set(c, "status = 'retry', next_try = ?, error = ?", now + wait, String(e.code)); tally.retry++;
        }
      }
    }
    return tally;
  }

  // Satu panggilan API per pengingat (atomik): lampiran pertama ikut sebagai foto/video/dokumen.
  private async send(owner: string, chat: number, item: ItemData): Promise<number | null> {
    const text = ['Mimi mau ingetin ♡', item.title, '🗓 ' + humanTime(item.time), item.note ? '\n' + item.note.slice(0, 500) : ''].filter(Boolean).join('\n');
    const rows = [
      [{ text: '✓ Sudah selesai', callback_data: 'd:' + item.clientId }],
      [{ text: 'Tunda 10 menit', callback_data: `s:${item.clientId}:10` }, { text: 'Tunda 1 jam', callback_data: `s:${item.clientId}:60` }],
      ...((item.attachments?.length || 0) > 1 ? [[{ text: `📎 Semua lampiran (${item.attachments!.length})`, callback_data: 'f:' + item.clientId }]] : []),
    ];
    const markup = { reply_markup: { inline_keyboard: rows } };
    const first = item.attachments?.length ? this.bot.resend(owner, chat, { ...item, attachments: item.attachments.slice(0, 1) }, text, markup)[0] : undefined;
    const call = first || { method: 'sendMessage', params: { chat_id: chat, text, ...markup } };
    const result = await this.api!.call<{ message_id?: number }>(call.method, call.params);
    return result?.message_id ?? null;
  }
}
