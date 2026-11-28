// Notifikasi walau web ditutup (Web Push, RFC 8030/8291/8292).
// Browser mendaftar ke layanan push miliknya (Google, Mozilla, Apple, Microsoft); server hanya
// mengirim pesan terenkripsi ke alamat itu. Pengingat agenda dan jaga diri dikirim dari sini,
// dengan aturan yang sama seperti Telegram: periksa ulang pemilik, selesai, jadwal, dan jam tenang
// tepat sebelum mengirim, satu kejadian tidak pernah dikirim dua kali.
import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Injectable, NotFoundException, OnModuleDestroy, Post, Req, UseGuards } from '@nestjs/common';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import webpush from 'web-push';
import { AuthGuard, AuthedRequest } from './auth';
import { CONFIG, Config } from './config';
import { DB, Db } from './db';
import { ItemData, Items } from './items';
import { TelegramBot } from './telegram/bot';
import { humanTime, inQuiet, quietEnds, wallNow } from './telegram/time';
import { occurrenceOf } from './telegram/reminders';

export interface PushSubscriptionData { endpoint: string; keys: { p256dh: string; auth: string } }
export interface PushMessage {
  type: 'agenda' | 'care' | 'test'; title: string; body: string; tag: string;
  id?: string; kind?: string; actions?: { action: string; title: string }[]; t?: string;
}
// Hasil satu kiriman: status HTTP dari layanan push (201 = diterima). 0 = jaringan gagal.
export interface PushSender { send(sub: PushSubscriptionData, payload: string, vapid: Vapid, ttl: number): Promise<number> }
export interface Vapid { subject: string; publicKey: string; privateKey: string }
export const PUSH_SENDER = Symbol('PUSH_SENDER');

export const webPushSender: PushSender = {
  async send(sub, payload, vapid, ttl) {
    try {
      const res = await webpush.sendNotification(sub, payload, { vapidDetails: vapid, TTL: ttl, urgency: 'high', timeout: 15000 });
      return res.statusCode;
    } catch (e) {
      // Pesan error web-push memuat alamat endpoint; yang dicatat hanya kode status.
      return (e as { statusCode?: number }).statusCode || 0;
    }
  },
};

// Hanya layanan push resmi browser. Endpoint datang dari browser, jadi tanpa daftar ini server
// bisa disuruh mengirim permintaan ke alamat sembarang (SSRF).
const PUSH_HOSTS = /^(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|web\.push\.apple\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*notify\.windows\.com)$/;
const b64len = (v: unknown, bytes: number) => typeof v === 'string' && /^[A-Za-z0-9_-]+={0,2}$/.test(v) && Buffer.from(v, 'base64url').length === bytes;
export function cleanSubscription(raw: unknown): PushSubscriptionData | string {
  const s = raw as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
  if (!s || typeof s.endpoint !== 'string' || s.endpoint.length > 1000) return 'endpoint tidak valid';
  let url: URL;
  try { url = new URL(s.endpoint); } catch { return 'endpoint tidak valid'; }
  if (url.protocol !== 'https:' || url.port || url.username || url.password || !PUSH_HOSTS.test(url.hostname)) return 'layanan push tidak dikenal';
  if (!b64len(s.keys?.p256dh, 65) || !b64len(s.keys?.auth, 16)) return 'kunci langganan tidak valid';
  return { endpoint: url.href, keys: { p256dh: s.keys!.p256dh as string, auth: s.keys!.auth as string } };
}

// Jadwal jaga diri. Salinan careKinds di src/scripts/iqlima.mjs; tes membandingkan keduanya.
export const careKinds: Record<string, { label: string; slots: string[]; lines: string[] }> = {
  water: { label: 'Minum air', slots: ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00'], lines: ['Minum dulu, yuk. Mimi juga lagi minum susu ♡', 'Segelas air buat kamu yang lagi sibuk ♡'] },
  meal: { label: 'Makan', slots: ['07:30', '12:30', '19:00'], lines: ['Udah waktunya makan. Kamu juga butuh diurus ♡', 'Isi perut dulu, kerjaannya bisa nunggu sebentar ♡'] },
  rest: { label: 'Istirahat sebentar', slots: ['10:30', '15:30'], lines: ['Regangkan badan sebentar, yuk. Mimi ikut menggeliat ♡', 'Lima menit buat diri sendiri dulu ♡'] },
  sleep: { label: 'Waktunya tidur', slots: ['22:30'], lines: ['Udah malam. Titip sisa pikiran ke Mimi, terus istirahat ya ♡'] },
};
const CARE_WINDOW = 45 * 60000;
const CATCH_UP_MS = 6 * 3600000;
const LEASE_MS = 2 * 60000;
const BACKOFF = [60000, 5 * 60000, 15 * 60000, 60 * 60000];
const MAX_ATTEMPTS = 5;
const MAX_DEVICES = 10;
const ACTION_MS = 48 * 3600000;
const pad = (n: number) => String(n).padStart(2, '0');
const day = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

interface Claimed { owner_id: string; key: string; attempts: number }
interface SubRow { id: string; endpoint: string; p256dh: string; auth: string }

@Injectable()
export class Push implements OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  private vapidCache?: Vapid;
  private secretCache?: Buffer;
  constructor(
    @Inject(DB) private db: Db,
    @Inject(CONFIG) private config: Config,
    @Inject(PUSH_SENDER) private sender: PushSender,
    private items: Items,
    private bot: TelegramBot,
  ) {}

  // Kunci VAPID dari environment, atau dibuat sekali lalu disimpan di tabel settings.
  vapid(): Vapid {
    if (this.vapidCache) return this.vapidCache;
    const p = this.config.push;
    let publicKey = p.vapidPublicKey, privateKey = p.vapidPrivateKey;
    if (!publicKey || !privateKey) {
      const get = (k: string) => (this.db.prepare('SELECT value FROM settings WHERE key = ?').get(k) as { value: string } | undefined)?.value;
      publicKey = get('push.vapid_public') || ''; privateKey = get('push.vapid_private') || '';
      if (!publicKey || !privateKey) {
        const keys = webpush.generateVAPIDKeys();
        publicKey = keys.publicKey; privateKey = keys.privateKey;
        const put = this.db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO NOTHING');
        this.db.transaction(() => { put.run('push.vapid_public', publicKey, Date.now()); put.run('push.vapid_private', privateKey, Date.now()); })();
        // Proses lain mungkin lebih dulu menyimpan: selalu pakai yang tersimpan.
        publicKey = get('push.vapid_public')!; privateKey = get('push.vapid_private')!;
      }
    }
    return (this.vapidCache = { subject: p.subject, publicKey, privateKey });
  }
  private secret(): Buffer {
    if (this.secretCache) return this.secretCache;
    const get = () => (this.db.prepare("SELECT value FROM settings WHERE key = 'push.action_secret'").get() as { value: string } | undefined)?.value;
    if (!get()) this.db.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('push.action_secret', ?, ?) ON CONFLICT(key) DO NOTHING").run(randomBytes(32).toString('base64url'), Date.now());
    return (this.secretCache = Buffer.from(get()!, 'base64url'));
  }

  // ---------- Langganan ----------
  status(owner: string) {
    const devices = (this.db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions WHERE owner_id = ?').get(owner) as { n: number }).n;
    return { publicKey: this.vapid().publicKey, devices, care: this.care(owner) };
  }
  subscribe(owner: string, body: { subscription?: unknown; label?: unknown }, now = Date.now()) {
    const sub = cleanSubscription(body?.subscription);
    if (typeof sub === 'string') throw new BadRequestException({ code: 'bad_subscription', message: 'Langganan notifikasi tidak valid. Coba aktifkan ulang.' });
    const id = createHash('sha256').update(sub.endpoint).digest('base64url');
    const label = typeof body?.label === 'string' ? body.label.slice(0, 60) : '';
    this.db.transaction(() => {
      // Satu browser milik akun yang terakhir mendaftarkannya.
      this.db.prepare(`INSERT INTO push_subscriptions (id, owner_id, endpoint, p256dh, auth, label, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET owner_id = excluded.owner_id, p256dh = excluded.p256dh, auth = excluded.auth, label = excluded.label, failures = 0`)
        .run(id, owner, sub.endpoint, sub.keys.p256dh, sub.keys.auth, label, now);
      const extra = this.db.prepare('SELECT id FROM push_subscriptions WHERE owner_id = ? ORDER BY created_at DESC LIMIT -1 OFFSET ?').all(owner, MAX_DEVICES) as { id: string }[];
      for (const e of extra) this.db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(e.id);
    })();
    return this.status(owner);
  }
  unsubscribe(owner: string, endpoint: unknown) {
    if (typeof endpoint !== 'string') return;
    let href = endpoint;
    try { href = new URL(endpoint).href; } catch { return; }
    const id = createHash('sha256').update(href).digest('base64url');
    this.db.prepare('DELETE FROM push_subscriptions WHERE id = ? AND owner_id = ?').run(id, owner);
  }
  care(owner: string): Record<string, boolean> | null {
    const row = this.db.prepare('SELECT data FROM care_settings WHERE owner_id = ?').get(owner) as { data: string } | undefined;
    return row ? JSON.parse(row.data) : null;
  }
  saveCare(owner: string, body: Record<string, unknown>, now = Date.now()) {
    const data: Record<string, boolean> = {};
    for (const k of Object.keys(careKinds)) data[k] = body?.[k] === true;
    this.db.prepare('INSERT INTO care_settings (owner_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(owner_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at').run(owner, JSON.stringify(data), now);
    return data;
  }

  // ---------- Tombol di notifikasi ----------
  // Service worker tidak punya sesi, jadi setiap notifikasi membawa token bertanda tangan
  // yang hanya berlaku untuk satu titipan, satu kejadian, dan 48 jam.
  actionToken(owner: string, clientId: string, occurrence: string, now: number) {
    const body = Buffer.from(JSON.stringify({ o: owner, c: clientId, k: occurrence, e: now + ACTION_MS })).toString('base64url');
    return body + '.' + createHmac('sha256', this.secret()).update(body).digest('base64url');
  }
  act(token: unknown, action: unknown, now = Date.now()) {
    const [body, mac] = typeof token === 'string' ? token.split('.') : [];
    const want = body ? createHmac('sha256', this.secret()).update(body).digest() : null;
    const got = mac ? Buffer.from(mac, 'base64url') : null;
    if (!want || !got || got.length !== want.length || !timingSafeEqual(got, want)) throw new NotFoundException({ code: 'not_found', message: 'Tombol ini sudah tidak berlaku.' });
    const t = JSON.parse(Buffer.from(body, 'base64url').toString()) as { o: string; c: string; k: string; e: number };
    if (t.e < now) throw new NotFoundException({ code: 'expired', message: 'Tombol ini sudah tidak berlaku.' });
    const item = this.items.get(t.o, t.c);
    if (!item || item.kind !== 'agenda') throw new NotFoundException({ code: 'not_found', message: 'Agenda tidak ditemukan.' });
    if (action === 'done') {
      if (!item.done) this.bot.finish(t.o, item, now);
      return { ok: true, message: 'Selesai ♡ Mimi bangga' };
    }
    if (action === 'snooze') {
      const tz = this.zone(t.o);
      // Hanya kejadian yang sedang diingatkan yang boleh ditunda; jadwal yang sudah diubah tidak tersentuh.
      if (item.done || occurrenceOf(item, tz)?.key !== t.k) return { ok: true, message: 'Jadwalnya sudah berubah.' };
      const { updatedAt, ...rest } = item;
      this.items.put(t.o, { ...rest, snoozeUntil: now + 10 * 60000 }, now);
      return { ok: true, message: 'Oke, Mimi ingetin lagi 10 menit lagi ♡' };
    }
    throw new BadRequestException({ code: 'bad_action', message: 'Aksi tidak dikenal.' });
  }
  private zone(owner: string) { return (this.db.prepare('SELECT timezone FROM users WHERE id = ?').get(owner) as { timezone: string } | undefined)?.timezone || 'Asia/Jakarta'; }

  // ---------- Penjadwal ----------
  start(everyMs: number) {
    if (this.timer) return;
    this.timer = setInterval(() => { this.tick().catch(e => console.error('push gagal', e instanceof Error ? e.message : e)); }, everyMs);
    this.timer.unref?.();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async tick(now = Date.now()) {
    if (this.running) return { queued: 0, sent: 0, deferred: 0, skipped: 0, retry: 0, failed: 0 };
    this.running = true;
    try { const queued = this.queue(now); return { queued, ...(await this.deliver(now)) }; }
    finally { this.running = false; }
  }

  // Hanya pemilik yang punya perangkat terdaftar. INSERT OR IGNORE membuatnya aman diulang.
  queue(now: number) {
    const insert = this.db.prepare("INSERT OR IGNORE INTO push_deliveries (owner_id, key, status, next_try) VALUES (?, ?, 'pending', ?)");
    let queued = 0;
    const agenda = this.db.prepare(`SELECT i.owner_id, i.client_id, i.data, u.timezone FROM items i JOIN users u ON u.id = i.owner_id
      WHERE i.kind = 'agenda' AND i.deleted = 0 AND EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.owner_id = i.owner_id)`).all() as { owner_id: string; client_id: string; data: string; timezone: string }[];
    const care = this.db.prepare(`SELECT c.owner_id, c.data, u.timezone FROM care_settings c JOIN users u ON u.id = c.owner_id
      WHERE EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.owner_id = c.owner_id)`).all() as { owner_id: string; data: string; timezone: string }[];
    this.db.transaction(() => {
      for (const r of agenda) {
        const item = JSON.parse(r.data) as ItemData;
        if (item.done || !item.time) continue;
        const occ = occurrenceOf(item, r.timezone);
        if (!occ || occ.dueAt > now || occ.dueAt < now - CATCH_UP_MS) continue;
        queued += insert.run(r.owner_id, `agenda|${r.client_id}|${occ.key}`, occ.dueAt).changes;
      }
      for (const r of care) {
        const settings = JSON.parse(r.data) as Record<string, boolean>;
        const wall = wallNow(now, r.timezone);
        for (const [kind, def] of Object.entries(careKinds)) {
          if (!settings[kind]) continue;
          for (const slot of def.slots) {
            const [h, m] = slot.split(':').map(Number);
            const start = new Date(wall.getFullYear(), wall.getMonth(), wall.getDate(), h, m);
            const since = wall.getTime() - start.getTime();
            if (since >= 0 && since < CARE_WINDOW) queued += insert.run(r.owner_id, `care|${kind}-${slot}|${day(wall)}`, now).changes;
          }
        }
      }
    })();
    return queued;
  }

  async deliver(now: number) {
    const tally = { sent: 0, deferred: 0, skipped: 0, retry: 0, failed: 0 };
    const claimed = this.db.prepare(`UPDATE push_deliveries SET status = 'sending', lease_until = ?, attempts = attempts + 1
      WHERE (status IN ('pending','retry') AND next_try <= ?) OR (status = 'sending' AND lease_until < ?)
      RETURNING owner_id, key, attempts`).all(now + LEASE_MS, now, now) as Claimed[];
    const set = (c: Claimed, fields: string, ...values: unknown[]) =>
      this.db.prepare(`UPDATE push_deliveries SET ${fields} WHERE owner_id = ? AND key = ?`).run(...values, c.owner_id, c.key);

    for (const c of claimed) {
      const user = this.db.prepare('SELECT timezone, quiet_start, quiet_end FROM users WHERE id = ?').get(c.owner_id) as { timezone: string; quiet_start: number | null; quiet_end: number | null } | undefined;
      const msg = user ? this.message(c, user.timezone, now) : null;
      const subs = this.db.prepare('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE owner_id = ?').all(c.owner_id) as SubRow[];
      if (!user || !msg || !subs.length) { set(c, "status = 'skipped'"); tally.skipped++; continue; }
      if (inQuiet(now, user.timezone, user.quiet_start, user.quiet_end)) {
        // Agenda menunggu jam tenang selesai. Jaga diri yang lewat waktunya tidak ada gunanya dikirim belakangan.
        if (msg.type === 'care') { set(c, "status = 'skipped', error = 'quiet'"); tally.skipped++; }
        else { set(c, "status = 'pending', next_try = ?, attempts = attempts - 1", quietEnds(now, user.timezone, user.quiet_end!)); tally.deferred++; }
        continue;
      }
      const result = await this.sendAll(subs, msg, now);
      if (result.ok) { set(c, "status = 'sent', sent_at = ?, error = ''", now); tally.sent++; }
      else if (result.gone === subs.length) { set(c, "status = 'failed', error = 'gone'"); tally.failed++; }
      else if (c.attempts >= MAX_ATTEMPTS) { set(c, "status = 'failed', error = ?", String(result.code)); tally.failed++; }
      else { set(c, "status = 'retry', next_try = ?, error = ?", now + BACKOFF[Math.min(c.attempts - 1, BACKOFF.length - 1)], String(result.code)); tally.retry++; }
    }
    return tally;
  }

  // Periksa ulang tepat sebelum mengirim: titipan masih ada, belum selesai, jadwalnya masih sama.
  private message(c: Claimed, tz: string, now: number): PushMessage | null {
    const [type, a] = c.key.split('|');
    const occurrence = c.key.slice(`${type}|${a}|`.length);
    if (type === 'care') {
      const [kind] = a.split('-');
      const def = careKinds[kind];
      if (!def || !this.care(c.owner_id)?.[kind]) return null;
      const wall = wallNow(now, tz);
      return { type: 'care', kind, title: def.label + ' ♡', body: def.lines[(wall.getDate() + Number(a.split('-')[1].slice(0, 2))) % def.lines.length], tag: a };
    }
    if (type !== 'agenda') return null;
    const item = this.items.get(c.owner_id, a);
    if (!item || item.done || item.kind !== 'agenda' || occurrenceOf(item, tz)?.key !== occurrence) return null;
    return {
      type: 'agenda', title: 'Mimi mau ingetin ♡', body: [item.title, '🗓 ' + humanTime(item.time), item.note ? item.note.slice(0, 200) : ''].filter(Boolean).join('\n'),
      tag: 'mimi-' + (item.reminderId || item.clientId), id: item.reminderId || item.clientId,
      actions: [{ action: 'done', title: '✓ Sudah selesai' }, { action: 'snooze', title: 'Tunda 10 menit' }],
      t: this.actionToken(c.owner_id, item.clientId, occurrence, now),
    };
  }

  // Kirim ke semua perangkat pemilik. Alamat yang sudah tidak berlaku (404/410) dihapus.
  private async sendAll(subs: SubRow[], msg: PushMessage, now: number) {
    const payload = JSON.stringify(msg);
    const vapid = this.vapid();
    let ok = false, gone = 0, code = 0;
    for (const s of subs) {
      const status = await this.sender.send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, vapid, msg.type === 'care' ? 1800 : 6 * 3600);
      if (status >= 200 && status < 300) { ok = true; this.db.prepare('UPDATE push_subscriptions SET last_ok = ?, failures = 0 WHERE id = ?').run(now, s.id); continue; }
      code = status;
      console.warn(JSON.stringify({ push: 'send', status }));
      if (status === 404 || status === 410) { gone++; this.db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(s.id); }
      else this.db.prepare('UPDATE push_subscriptions SET failures = failures + 1 WHERE id = ?').run(s.id);
    }
    return { ok, gone, code };
  }

  // Tes dari Profil: langsung ke semua perangkat, tanpa antrean.
  async test(owner: string, now = Date.now()) {
    const subs = this.db.prepare('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE owner_id = ?').all(owner) as SubRow[];
    if (!subs.length) throw new NotFoundException({ code: 'no_device', message: 'Belum ada perangkat yang terdaftar.' });
    const r = await this.sendAll(subs, { type: 'test', title: 'Tes dari Mimi ♡', body: 'Notifikasi sampai walau web ditutup. Mimi siap ngingetin.', tag: 'mimi-test' }, now);
    return { ok: r.ok, devices: subs.length - r.gone };
  }
}

@Controller('v1/push')
export class PushController {
  constructor(private push: Push) {}
  @Get() @UseGuards(AuthGuard) status(@Req() req: AuthedRequest) { return this.push.status(req.user.id); }
  @Post('subscribe') @HttpCode(200) @UseGuards(AuthGuard) subscribe(@Req() req: AuthedRequest, @Body() body: { subscription?: unknown; label?: unknown }) { return this.push.subscribe(req.user.id, body); }
  @Post('unsubscribe') @HttpCode(204) @UseGuards(AuthGuard) unsubscribe(@Req() req: AuthedRequest, @Body() body: { endpoint?: unknown }) { this.push.unsubscribe(req.user.id, body?.endpoint); }
  @Post('care') @HttpCode(200) @UseGuards(AuthGuard) care(@Req() req: AuthedRequest, @Body() body: Record<string, unknown>) { return this.push.saveCare(req.user.id, body || {}); }
  @Post('test') @HttpCode(200) @UseGuards(AuthGuard) test(@Req() req: AuthedRequest) { return this.push.test(req.user.id); }
  // Dari tombol notifikasi (service worker). Tanpa sesi: token di notifikasi yang membuktikan pemiliknya.
  @Post('action') @HttpCode(200) action(@Body() body: { t?: unknown; action?: unknown }) { return this.push.act(body?.t, body?.action); }
}
