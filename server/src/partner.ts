import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, HttpCode, HttpException, Inject, Injectable, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { AuthGuard, AuthedRequest } from './auth';
import { DB, Db } from './db';
import { TelegramRuntime } from './telegram/runtime';
import { inQuiet } from './telegram/time';

// Pasangan: dua akun yang saling setuju tersambung. Yang dibagi HANYA surat dan rencana berdua.
// Koleksi, agenda pribadi, akun digital, dan ruang lega tetap milik masing-masing.
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const pairOf = (a: string, b: string) => hash([a, b].sort().join(':'));
const CODE_MS = 24 * 3600000;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const STICKERS = ['♡', '🌸', '☕', '🌙', '🧸', '✨'];
const LETTERS_PER_DAY = 50;
const str = (v: unknown, max: number) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const isTime = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v);

interface PlanRow { id: string; created_by: string; title: string; note: string; place: string; time: string; done: number; deleted: number; updated_at: number; updated_by: string }

@Injectable()
export class Partner {
  constructor(@Inject(DB) private db: Db, private rt: TelegramRuntime) {}

  private link(userId: string) {
    return this.db.prepare('SELECT partner_id, pair_id, since FROM partners WHERE user_id = ?').get(userId) as { partner_id: string; pair_id: string; since: number } | undefined;
  }
  private need(userId: string) {
    const l = this.link(userId);
    if (!l) throw new ConflictException({ code: 'not_paired', message: 'Belum tersambung dengan pasangan.' });
    return l;
  }
  private nameOf(id: string) { return (this.db.prepare('SELECT name, email FROM users WHERE id = ?').get(id) as { name: string; email: string } | undefined)?.name || 'Pasanganmu'; }

  status(userId: string) {
    const l = this.link(userId);
    const unread = l ? (this.db.prepare('SELECT COUNT(*) n FROM letters WHERE to_id = ? AND read_at IS NULL AND hidden_to = 0').get(userId) as { n: number }).n : 0;
    return { paired: Boolean(l), partner: l ? { name: this.nameOf(l.partner_id) } : null, since: l?.since ?? null, unread, me: { name: this.nameOf(userId) } };
  }

  // Kode 8 huruf, mudah dibacakan atau diketik, sekali pakai, berlaku 24 jam. Hanya hash yang disimpan.
  invite(userId: string, now = Date.now()) {
    if (this.link(userId)) throw new ConflictException({ code: 'already_paired', message: 'Kamu sudah tersambung dengan pasangan.' });
    const code = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM partner_codes WHERE owner_id = ? OR expires_at < ?').run(userId, now);
      this.db.prepare('INSERT INTO partner_codes (code_hash, owner_id, expires_at) VALUES (?, ?, ?)').run(hash(code), userId, now + CODE_MS);
    })();
    return { code, expiresAt: now + CODE_MS };
  }

  accept(userId: string, raw: unknown, now = Date.now()) {
    const code = typeof raw === 'string' ? raw.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
    if (code.length !== 8) throw new BadRequestException({ code: 'bad_code', message: 'Kodenya 8 huruf. Cek lagi, ya.' });
    return this.db.transaction(() => {
      const row = this.db.prepare('SELECT owner_id FROM partner_codes WHERE code_hash = ? AND expires_at > ?').get(hash(code), now) as { owner_id: string } | undefined;
      if (!row) throw new BadRequestException({ code: 'bad_code', message: 'Kode ini tidak dikenal atau sudah kedaluwarsa. Minta kode baru, ya.' });
      if (row.owner_id === userId) throw new BadRequestException({ code: 'own_code', message: 'Itu kodemu sendiri. Kirim ke pasanganmu untuk dimasukkan di Profilnya.' });
      if (this.link(userId) || this.link(row.owner_id)) throw new ConflictException({ code: 'already_paired', message: 'Salah satu akun sudah tersambung dengan orang lain.' });
      const pair = pairOf(userId, row.owner_id);
      const add = this.db.prepare('INSERT INTO partners (user_id, partner_id, pair_id, since) VALUES (?, ?, ?, ?)');
      add.run(userId, row.owner_id, pair, now);
      add.run(row.owner_id, userId, pair, now);
      this.db.prepare('DELETE FROM partner_codes WHERE owner_id IN (?, ?)').run(userId, row.owner_id);
      return this.status(userId);
    })();
  }

  // Putus: keduanya langsung tidak saling melihat surat dan rencana. Datanya tidak dihapus,
  // jadi kalau tersambung lagi dengan orang yang sama, semuanya kembali.
  leave(userId: string) {
    const l = this.link(userId);
    if (!l) return;
    this.db.prepare('DELETE FROM partners WHERE pair_id = ?').run(l.pair_id);
  }

  letters(userId: string) {
    const l = this.link(userId);
    if (!l) return { received: [], sent: [], unread: 0 };
    const pick = (sql: string) => (this.db.prepare(sql).all(userId, l.partner_id) as { id: string; body: string; sticker: string; created_at: number; read_at: number | null }[])
      .map(r => ({ id: r.id, body: r.body, sticker: r.sticker, at: new Date(r.created_at).toISOString(), read: r.read_at != null }));
    const received = pick('SELECT id, body, sticker, created_at, read_at FROM letters WHERE to_id = ? AND from_id = ? AND hidden_to = 0 ORDER BY created_at DESC LIMIT 50');
    const sent = pick('SELECT id, body, sticker, created_at, read_at FROM letters WHERE from_id = ? AND to_id = ? AND hidden_from = 0 ORDER BY created_at DESC LIMIT 20');
    return { received, sent, unread: received.filter(r => !r.read).length, from: this.nameOf(l.partner_id) };
  }

  send(userId: string, body: { body?: unknown; sticker?: unknown }, now = Date.now()) {
    const l = this.need(userId);
    const text = str(body?.body, 1000);
    if (!text) throw new BadRequestException({ code: 'empty_letter', message: 'Suratnya masih kosong.' });
    const today = (this.db.prepare('SELECT COUNT(*) n FROM letters WHERE from_id = ? AND created_at > ?').get(userId, now - 86400000) as { n: number }).n;
    if (today >= LETTERS_PER_DAY) throw new HttpException({ code: 'too_many', message: 'Hari ini sudah banyak sekali surat. Besok lagi, ya ♡' }, 429);
    const sticker = STICKERS.includes(body?.sticker as string) ? body.sticker as string : '♡';
    const id = randomUUID();
    this.db.prepare('INSERT INTO letters (id, from_id, to_id, body, sticker, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, userId, l.partner_id, text, sticker, now);
    void this.ping(l.partner_id, `💌 Surat dari ${this.nameOf(userId)} ${sticker}\n\n${text}`, now);
    return { id, body: text, sticker, at: new Date(now).toISOString(), read: false };
  }

  // Hanya penerima yang bisa menandai dibaca; masing-masing bisa menyembunyikan dari tampilannya sendiri.
  markRead(userId: string, id: string, now = Date.now()) {
    const n = this.db.prepare('UPDATE letters SET read_at = COALESCE(read_at, ?) WHERE id = ? AND to_id = ?').run(now, id, userId).changes;
    if (!n) throw new NotFoundException({ code: 'not_found', message: 'Surat tidak ditemukan.' });
  }
  hide(userId: string, id: string) {
    const a = this.db.prepare('UPDATE letters SET hidden_to = 1 WHERE id = ? AND to_id = ?').run(id, userId).changes;
    const b = this.db.prepare('UPDATE letters SET hidden_from = 1 WHERE id = ? AND from_id = ?').run(id, userId).changes;
    if (!a && !b) throw new NotFoundException({ code: 'not_found', message: 'Surat tidak ditemukan.' });
  }

  plans(userId: string) {
    const l = this.link(userId);
    if (!l) return { plans: [] };
    const rows = this.db.prepare('SELECT * FROM plans WHERE pair_id = ? AND deleted = 0 ORDER BY CASE WHEN time = \'\' THEN 1 ELSE 0 END, time, updated_at DESC LIMIT 200').all(l.pair_id) as PlanRow[];
    return { plans: rows.map(r => this.wire(r, userId)) };
  }
  private wire(r: PlanRow, userId: string) {
    return { id: r.id, title: r.title, note: r.note, place: r.place, time: r.time, done: r.done === 1, updatedAt: r.updated_at, byMe: r.created_by === userId, by: this.nameOf(r.created_by) };
  }

  // Buat atau ubah. Perubahan bersamaan dari dua HP: yang updatedAt-nya lebih baru menang.
  savePlan(userId: string, body: Record<string, unknown>, now = Date.now()) {
    const l = this.need(userId);
    const title = str(body?.title, 100);
    if (!title) throw new BadRequestException({ code: 'bad_plan', message: 'Rencananya butuh judul.' });
    const time = isTime(body?.time) ? body.time as string : '';
    const updatedAt = Math.min(Number(body?.updatedAt) || now, now + 5 * 60000);
    const id = typeof body?.id === 'string' && /^[\w-]{8,64}$/.test(body.id) ? body.id : randomUUID();
    return this.db.transaction(() => {
      const existing = this.db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as (PlanRow & { pair_id: string }) | undefined;
      if (existing && existing.pair_id !== l.pair_id) throw new NotFoundException({ code: 'not_found', message: 'Rencana tidak ditemukan.' });
      if (existing && existing.updated_at > updatedAt) return { plan: this.wire(existing, userId), status: 'stale' as const };
      const fields = [title, str(body?.note, 500), str(body?.place, 160), time, body?.done === true ? 1 : 0, updatedAt, userId];
      if (existing) this.db.prepare('UPDATE plans SET title = ?, note = ?, place = ?, time = ?, done = ?, deleted = 0, updated_at = ?, updated_by = ? WHERE id = ?').run(...fields, id);
      else {
        this.db.prepare('INSERT INTO plans (id, pair_id, created_by, title, note, place, time, done, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, l.pair_id, userId, ...fields);
        void this.ping(l.partner_id, `🗓 ${this.nameOf(userId)} ngajak: ${title}${time ? '\n' + time.replace('T', ' ') : ''}\n\nLihat di Ruang Iqlima > Agenda > Rencana berdua ♡`, now);
      }
      return { plan: this.wire(this.db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as PlanRow, userId), status: 'saved' as const };
    })();
  }
  removePlan(userId: string, id: string, now = Date.now()) {
    const l = this.need(userId);
    const n = this.db.prepare('UPDATE plans SET deleted = 1, updated_at = ?, updated_by = ? WHERE id = ? AND pair_id = ?').run(now, userId, id, l.pair_id).changes;
    if (!n) throw new NotFoundException({ code: 'not_found', message: 'Rencana tidak ditemukan.' });
  }

  // Kabar ke Telegram pasangan bila tersambung dan bukan jam tenang. Gagal tidak apa-apa: suratnya tetap ada di web.
  private async ping(toId: string, text: string, now: number) {
    const api = this.rt.api;
    if (!api) return;
    const row = this.db.prepare('SELECT l.chat_id, u.timezone, u.quiet_start, u.quiet_end FROM telegram_links l JOIN users u ON u.id = l.owner_id WHERE l.owner_id = ?').get(toId) as { chat_id: number; timezone: string; quiet_start: number | null; quiet_end: number | null } | undefined;
    if (!row || inQuiet(now, row.timezone, row.quiet_start, row.quiet_end)) return;
    try { await api.call('sendMessage', { chat_id: row.chat_id, text: text.slice(0, 4000) }); } catch { console.warn(JSON.stringify({ partner: 'ping', ok: false })); }
  }
}

@Controller('v1/partner')
@UseGuards(AuthGuard)
export class PartnerController {
  constructor(private partner: Partner) {}

  @Get() status(@Req() req: AuthedRequest) { return this.partner.status(req.user.id); }
  @Post('invite') @HttpCode(200) invite(@Req() req: AuthedRequest) { return this.partner.invite(req.user.id); }
  @Post('accept') @HttpCode(200) accept(@Req() req: AuthedRequest, @Body() body: { code?: unknown }) { return this.partner.accept(req.user.id, body?.code); }
  @Post('leave') @HttpCode(204) leave(@Req() req: AuthedRequest) { this.partner.leave(req.user.id); }

  @Get('letters') letters(@Req() req: AuthedRequest) { return this.partner.letters(req.user.id); }
  @Post('letters') @HttpCode(201) send(@Req() req: AuthedRequest, @Body() body: { body?: unknown; sticker?: unknown }) { return this.partner.send(req.user.id, body); }
  @Post('letters/:id/read') @HttpCode(204) read(@Req() req: AuthedRequest, @Param('id') id: string) { this.partner.markRead(req.user.id, id); }
  @Post('letters/:id/hide') @HttpCode(204) hide(@Req() req: AuthedRequest, @Param('id') id: string) { this.partner.hide(req.user.id, id); }

  @Get('plans') plans(@Req() req: AuthedRequest) { return this.partner.plans(req.user.id); }
  @Post('plans') @HttpCode(200) save(@Req() req: AuthedRequest, @Body() body: Record<string, unknown>) { return this.partner.savePlan(req.user.id, body || {}); }
  @Post('plans/:id/remove') @HttpCode(204) remove(@Req() req: AuthedRequest, @Param('id') id: string) { this.partner.removePlan(req.user.id, id); }
}
