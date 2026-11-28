import { Inject, Injectable, Optional } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { CONFIG, Config } from '../config';
import { DB, Db } from '../db';
import { Attachment, ItemData, Items } from '../items';
import { TELEGRAM_API, TelegramApi, TelegramError, TgCallback, TgMessage, TgUpdate } from './api';
import { hhmm, humanTime, minuteOfDay, nextOccurrence, parseDump, parseLocal, parseWhen, stamp, toEpoch, wallNow } from './time';

// Pesan keluar dikumpulkan dulu, lalu dikirim setelah transaksi database selesai.
// Kalau Telegram gagal, titipan tetap tersimpan; balasan yang gagal hanya dicatat kodenya.
export interface Outgoing { method: string; params: Record<string, unknown>; ownerId?: string; remember?: string }
type Link = { owner_id: string; tg_user_id: number; chat_id: number; username: string };
type Button = { text: string; callback_data: string };

const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const newId = () => 'tg-' + randomBytes(9).toString('base64url');
const CODE_MS = 10 * 60000;
const SNOOZE = [10, 60];
export const LINK_HELP = 'Hai, aku Mimi ♡ Supaya kirimanmu masuk ke Ruang Iqlima, buka Profil > Koneksi Mimi > Hubungkan Telegram, lalu ketuk tautannya.';
const HELP = [
  'Kirim apa saja ke Mimi: teks, foto nota, video, atau dokumen. Satu kiriman jadi satu titipan ♡',
  'Tulis waktunya biar Mimi bisa ingetin, misalnya "ambil jahitan jumat jam 4 sore".',
  '',
  '/cari kata  cari titipan',
  '/tenang 22-6  atur jam tenang (atau /tenang mati)',
  '/stop  putuskan Telegram dari Ruang Iqlima',
].join('\n');

@Injectable()
export class TelegramBot {
  constructor(
    @Inject(DB) private db: Db,
    @Inject(CONFIG) private config: Config,
    private items: Items,
    @Optional() @Inject(TELEGRAM_API) private api: TelegramApi | null,
  ) {}

  get enabled() { return Boolean(this.api && this.config.telegram.username); }

  // ---------- Dari web (pemilik sudah diverifikasi lewat sesi) ----------
  createLink(ownerId: string, now = Date.now()) {
    const code = randomBytes(18).toString('base64url');
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM telegram_link_codes WHERE owner_id = ? OR expires_at < ?').run(ownerId, now);
      this.db.prepare('INSERT INTO telegram_link_codes (code_hash, owner_id, expires_at) VALUES (?, ?, ?)').run(hash(code), ownerId, now + CODE_MS);
    })();
    return { url: `https://t.me/${this.config.telegram.username}?start=${code}`, expiresAt: now + CODE_MS };
  }
  status(ownerId: string) {
    const link = this.db.prepare('SELECT username, linked_at FROM telegram_links WHERE owner_id = ?').get(ownerId) as { username: string; linked_at: number } | undefined;
    const user = this.db.prepare('SELECT timezone, quiet_start, quiet_end FROM users WHERE id = ?').get(ownerId) as { timezone: string; quiet_start: number | null; quiet_end: number | null };
    return { enabled: this.enabled, linked: Boolean(link), username: link?.username || '', linkedAt: link?.linked_at || null, timezone: user.timezone, quietStart: user.quiet_start, quietEnd: user.quiet_end };
  }
  setQuiet(ownerId: string, start: number | null, end: number | null) {
    this.db.prepare('UPDATE users SET quiet_start = ?, quiet_end = ? WHERE id = ?').run(start, end, ownerId);
  }
  unlink(ownerId: string) {
    this.db.prepare('DELETE FROM telegram_links WHERE owner_id = ?').run(ownerId);
    this.db.prepare("UPDATE reminder_deliveries SET status = 'skipped' WHERE owner_id = ? AND status IN ('pending','retry','sending')").run(ownerId);
  }

  // ---------- Dari Telegram ----------
  // Satu update diproses tepat sekali: update_id dicatat dalam transaksi yang sama dengan
  // perubahan titipannya. Kalau gagal di tengah, semuanya batal dan Telegram mengirim ulang.
  async handle(update: TgUpdate, now = Date.now()) {
    if (!Number.isSafeInteger(update?.update_id)) return;
    const out = this.db.transaction(() => {
      const fresh = this.db.prepare('INSERT OR IGNORE INTO telegram_updates (update_id, received_at) VALUES (?, ?)').run(update.update_id, now).changes === 1;
      if (!fresh) return [] as Outgoing[];
      if (update.update_id % 200 === 0) this.db.prepare('DELETE FROM telegram_updates WHERE received_at < ?').run(now - 7 * 86400000);
      if (update.message) return this.onMessage(update.message, now);
      if (update.callback_query) return this.onCallback(update.callback_query, now);
      return [];
    })();
    await this.send(out);
  }

  async send(out: Outgoing[]) {
    if (!this.api) return;
    for (const o of out) {
      try {
        const result = await this.api.call<{ message_id?: number }>(o.method, o.params);
        if (o.remember && o.ownerId && result?.message_id) {
          this.db.prepare('INSERT OR REPLACE INTO telegram_threads (owner_id, key, client_id, created_at) VALUES (?, ?, ?, ?)').run(o.ownerId, 'msg:' + result.message_id, o.remember, Date.now());
        }
      } catch (error) {
        const e = error instanceof TelegramError ? error : new TelegramError(0, 'unknown');
        console.warn(JSON.stringify({ telegram: o.method, code: e.code }));
        if (e.gone && o.ownerId) this.unlink(o.ownerId);
      }
    }
  }

  private linkOf(tgUserId: number) {
    return this.db.prepare('SELECT owner_id, tg_user_id, chat_id, username FROM telegram_links WHERE tg_user_id = ?').get(tgUserId) as Link | undefined;
  }
  private zone(ownerId: string) {
    return (this.db.prepare('SELECT timezone FROM users WHERE id = ?').get(ownerId) as { timezone: string } | undefined)?.timezone || 'Asia/Jakarta';
  }
  private say(chatId: number, text: string, extra: Record<string, unknown> = {}, ownerId?: string, remember?: string): Outgoing {
    return { method: 'sendMessage', params: { chat_id: chatId, text: text.slice(0, 4000), ...extra }, ownerId, remember };
  }
  private keyboard(rows: Button[][]) { return { reply_markup: { inline_keyboard: rows } }; }

  private onMessage(msg: TgMessage, now: number): Outgoing[] {
    // Hanya obrolan pribadi. Grup diabaikan supaya titipan tidak tercampur dengan orang lain.
    if (msg.chat?.type !== 'private' || !msg.from || msg.from.is_bot) return [];
    const chat = msg.chat.id;
    const text = (msg.text || '').trim();
    const command = /^\/([a-z_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/i.exec(text);
    const link = this.linkOf(msg.from.id);

    if (command?.[1].toLowerCase() === 'start') {
      const code = (command[2] || '').trim();
      if (code) return [this.link(code, msg, now)];
      return [this.say(chat, link ? 'Kita udah nyambung kok ♡\n\n' + HELP : LINK_HELP)];
    }
    if (!link) return [this.say(chat, LINK_HELP)];
    const owner = link.owner_id;
    if (link.chat_id !== chat) this.db.prepare('UPDATE telegram_links SET chat_id = ? WHERE owner_id = ?').run(chat, owner);

    if (command) {
      const name = command[1].toLowerCase(), arg = (command[2] || '').trim();
      if (name === 'stop') { this.unlink(owner); return [this.say(chat, 'Sambungan Telegram sudah Mimi putus. Titipanmu tetap aman di Ruang Iqlima. Kapan pun mau nyambung lagi, buka Profil ya ♡')]; }
      if (name === 'cari') return [this.search(owner, chat, arg)];
      if (name === 'tenang') return [this.quiet(owner, chat, arg)];
      return [this.say(chat, HELP, {}, owner)];
    }

    const tz = this.zone(owner);
    const wall = wallNow(now, tz);
    // Balasan ke pertanyaan Mimi "kapan diingatkan?" dianggap konfirmasi waktu.
    const replyTo = msg.reply_to_message?.message_id;
    if (replyTo && text) {
      const thread = this.db.prepare('SELECT client_id FROM telegram_threads WHERE owner_id = ? AND key = ?').get(owner, 'msg:' + replyTo) as { client_id: string } | undefined;
      const item = thread && this.items.get(owner, thread.client_id);
      if (item) {
        const time = parseWhen(text, wall);
        if (!time) return [this.say(chat, 'Mimi belum nangkep waktunya. Coba tulis kayak "besok jam 9 pagi" atau "jumat jam 16.00", ya.', {}, owner)];
        this.schedule(owner, item, time, now);
        return [this.say(chat, `Siap, Mimi ingetin ${humanTime(time)} ♡`, {}, owner)];
      }
    }

    const file = attachmentOf(msg);
    if (file) return this.saveMedia(owner, chat, msg, file, wall, now);
    if (!text) return [this.say(chat, 'Mimi baru bisa simpan teks, foto, video, dan dokumen. Yang ini belum bisa, maaf ya ♡', {}, owner)];
    return this.saveText(owner, chat, text, wall, now);
  }

  private link(code: string, msg: TgMessage, now: number): Outgoing {
    const chat = msg.chat.id, from = msg.from!;
    if (!/^[\w-]{10,64}$/.test(code)) return this.say(chat, 'Tautannya kurang lengkap. Buka lagi dari Profil di Ruang Iqlima, ya.');
    const row = this.db.prepare('SELECT owner_id FROM telegram_link_codes WHERE code_hash = ? AND used_at IS NULL AND expires_at > ?').get(hash(code), now) as { owner_id: string } | undefined;
    if (!row) return this.say(chat, 'Tautan ini sudah kedaluwarsa atau sudah pernah dipakai. Buat yang baru dari Profil, ya ♡');
    const existing = this.linkOf(from.id);
    if (existing && existing.owner_id !== row.owner_id) {
      return this.say(chat, 'Telegram ini sudah tersambung ke akun Titip Mimi lain. Ketik /stop dulu, lalu buka tautan dari Profil lagi.');
    }
    this.db.prepare('DELETE FROM telegram_links WHERE owner_id = ?').run(row.owner_id);
    this.db.prepare('INSERT INTO telegram_links (owner_id, tg_user_id, chat_id, username, linked_at) VALUES (?, ?, ?, ?, ?)').run(row.owner_id, from.id, chat, (from.username || '').slice(0, 64), now);
    this.db.prepare('UPDATE telegram_link_codes SET used_at = ? WHERE code_hash = ?').run(now, hash(code));
    const name = (this.db.prepare('SELECT name FROM users WHERE id = ?').get(row.owner_id) as { name: string }).name;
    return this.say(chat, `Yeay, nyambung ${name ? name + ' ' : ''}♡\n\n${HELP}`, {}, row.owner_id);
  }

  private saveText(owner: string, chat: number, text: string, wall: Date, now: number): Outgoing[] {
    const [first, ...rest] = text.split('\n');
    const parsed = parseDump(first, wall)[0] || { title: first.trim(), time: '' };
    const clientId = newId();
    const item = this.items.put(owner, { clientId, kind: 'note', title: (parsed.title || first).slice(0, 100), note: rest.join('\n').trim().slice(0, 4000), time: '', done: false, source: 'telegram' }, now);
    return [this.ask(owner, chat, item, parsed.time, wall)];
  }

  private saveMedia(owner: string, chat: number, msg: TgMessage, file: Attachment & { fileId: string }, wall: Date, now: number): Outgoing[] {
    this.db.prepare('INSERT OR REPLACE INTO telegram_files (owner_id, unique_id, file_id, kind, mime, name, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(owner, file.id, file.fileId, file.kind, file.mime || '', file.name || '', file.size || 0, now);
    const { fileId, ...attachment } = file;
    // Album (beberapa foto sekaligus) datang sebagai beberapa update: digabung jadi satu titipan.
    if (msg.media_group_id) {
      const key = 'group:' + msg.media_group_id;
      const thread = this.db.prepare('SELECT client_id FROM telegram_threads WHERE owner_id = ? AND key = ?').get(owner, key) as { client_id: string } | undefined;
      const existing = thread && this.items.get(owner, thread.client_id);
      if (existing) {
        const list = (existing.attachments || []).filter(a => a.id !== attachment.id);
        const caption = (msg.caption || '').trim();
        this.items.put(owner, { ...existing, attachments: [...list, attachment].slice(0, 10), note: existing.note || caption.slice(0, 4000) }, now);
        return [];
      }
    }
    const caption = (msg.caption || '').trim();
    const [first, ...rest] = caption.split('\n');
    const parsed = first ? parseDump(first, wall)[0] : undefined;
    const fallback = { photo: 'Foto dari Telegram', video: 'Video dari Telegram', document: file.name || 'Dokumen dari Telegram' }[file.kind];
    const clientId = newId();
    const item = this.items.put(owner, {
      clientId, kind: 'note', title: (parsed?.title || fallback).slice(0, 100), note: rest.join('\n').trim().slice(0, 4000),
      time: '', done: false, attachments: [attachment], source: 'telegram',
    }, now);
    if (msg.media_group_id) this.db.prepare('INSERT OR IGNORE INTO telegram_threads (owner_id, key, client_id, created_at) VALUES (?, ?, ?, ?)').run(owner, 'group:' + msg.media_group_id, clientId, now);
    return [this.ask(owner, chat, item, parsed?.time || '', wall)];
  }

  // Titipan langsung tersimpan tanpa jadwal. Pengingat baru aktif setelah Iqlima memilih waktunya.
  private ask(owner: string, chat: number, item: ItemData, proposed: string, wall: Date): Outgoing {
    const code = (t: string) => `t:${item.clientId}:${t.replace(/\D/g, '')}`;
    if (proposed) {
      return this.say(chat, `Mimi simpan ♡ ${item.title}\nMau Mimi ingetin ${humanTime(proposed)}?`, this.keyboard([
        [{ text: 'Iya, ingetin ♡', callback_data: code(proposed) }],
        [{ text: 'Simpan aja, tanpa jadwal', callback_data: 'n:' + item.clientId }],
      ]), owner, item.clientId);
    }
    const options: Button[] = [];
    if (wall.getHours() < 18) options.push({ text: 'Nanti malam 19.00', callback_data: code(stamp(new Date(wall.getFullYear(), wall.getMonth(), wall.getDate(), 19, 0))) });
    options.push({ text: 'Besok pagi 08.00', callback_data: code(stamp(new Date(wall.getFullYear(), wall.getMonth(), wall.getDate() + 1, 8, 0))) });
    return this.say(chat, `Mimi simpan ♡ ${item.title}\nMau diingetin kapan? Pilih di bawah, atau balas pesan ini dengan waktunya.`, this.keyboard([
      options, [{ text: 'Tanpa jadwal', callback_data: 'n:' + item.clientId }],
    ]), owner, item.clientId);
  }

  private schedule(owner: string, item: ItemData, time: string, now: number) {
    const { snoozeUntil, ...rest } = item as ItemData & { updatedAt?: number };
    delete (rest as { updatedAt?: number }).updatedAt;
    this.items.put(owner, { ...rest, kind: 'agenda', time, done: false }, now);
  }

  private search(owner: string, chat: number, q: string): Outgoing {
    if (!q) return this.say(chat, 'Mau cari apa? Contoh: /cari nota jahit', {}, owner);
    const found = this.items.search(owner, q.slice(0, 100)).filter((i: ItemData) => !i.done).slice(0, 5) as ItemData[];
    if (!found.length) return this.say(chat, `Mimi belum nemu titipan soal "${q.slice(0, 60)}". Coba kata lain, ya.`, {}, owner);
    const lines = found.map(i => '• ' + i.title + (i.time ? ` (${humanTime(i.time)})` : '') + (i.attachments?.length ? ' 📎' : ''));
    const buttons = found.filter(i => i.attachments?.length).map(i => [{ text: '📎 ' + i.title.slice(0, 40), callback_data: 'f:' + i.clientId }]);
    return this.say(chat, 'Ini yang Mimi temukan:\n' + lines.join('\n'), buttons.length ? this.keyboard(buttons) : {}, owner);
  }

  private quiet(owner: string, chat: number, arg: string): Outgoing {
    if (/^(mati|off|nonaktif)$/i.test(arg)) { this.setQuiet(owner, null, null); return this.say(chat, 'Jam tenang dimatikan. Mimi boleh ingetin kapan saja, ya.', {}, owner); }
    const m = /^(\d{1,2})(?:[.:](\d{2}))?\s*-\s*(\d{1,2})(?:[.:](\d{2}))?$/.exec(arg);
    if (m) {
      const start = +m[1] * 60 + +(m[2] || 0), end = +m[3] * 60 + +(m[4] || 0);
      if (+m[1] < 24 && +m[3] < 24 && +(m[2] || 0) < 60 && +(m[4] || 0) < 60) {
        this.setQuiet(owner, start, end);
        return this.say(chat, `Oke, jam tenang ${hhmm(start)} sampai ${hhmm(end)}. Pengingat di jam itu Mimi tahan dulu sampai jam tenang selesai ♡`, {}, owner);
      }
    }
    const s = this.status(owner);
    const now = s.quietStart != null && s.quietEnd != null && s.quietStart !== s.quietEnd ? `${hhmm(s.quietStart)} sampai ${hhmm(s.quietEnd)}` : 'mati';
    return this.say(chat, `Jam tenang sekarang: ${now}.\nUbah dengan /tenang 22-6 atau /tenang mati.`, {}, owner);
  }

  private onCallback(cb: TgCallback, now: number): Outgoing[] {
    const answer = (text: string): Outgoing => ({ method: 'answerCallbackQuery', params: { callback_query_id: cb.id, text } });
    const link = this.linkOf(cb.from.id);
    if (!link) return [answer('Telegram ini belum tersambung ke Ruang Iqlima.')];
    const owner = link.owner_id;
    const m = /^([tndsf]):([\w-]{8,64})(?::(\d{1,12}))?$/.exec(cb.data || '');
    if (!m) return [answer('Tombol ini sudah tidak berlaku.')];
    const [, action, clientId, arg] = m;
    // Selalu dicari dalam titipan milik pengirim tombol, jadi tombol orang lain tidak bisa dipakai.
    const item = this.items.get(owner, clientId);
    if (!item) return [answer('Titipan ini sudah dihapus.')];
    const clear: Outgoing[] = cb.message ? [{ method: 'editMessageReplyMarkup', params: { chat_id: cb.message.chat.id, message_id: cb.message.message_id, reply_markup: { inline_keyboard: [] } }, ownerId: owner }] : [];
    const chat = cb.message?.chat.id ?? link.chat_id;

    if (action === 't') {
      const time = arg && arg.length === 12 ? `${arg.slice(0, 4)}-${arg.slice(4, 6)}-${arg.slice(6, 8)}T${arg.slice(8, 10)}:${arg.slice(10, 12)}` : '';
      const epoch = parseLocal(time) && toEpoch(time, this.zone(owner));
      if (!epoch) return [answer('Tombol ini sudah tidak berlaku.')];
      if (epoch <= now) return [answer('Waktunya sudah lewat. Balas pesan Mimi dengan waktu baru, ya.')];
      this.schedule(owner, item, time, now);
      return [answer('Siap ♡'), ...clear, this.say(chat, `Mimi ingetin ${humanTime(time)} ♡`, {}, owner)];
    }
    if (action === 'n') return [answer('Oke, disimpan tanpa jadwal ♡'), ...clear];
    if (action === 'd') {
      if (item.done) return [answer('Sudah selesai kok ♡'), ...clear];
      const next = this.finish(owner, item, now);
      return [answer('Selesai ♡ Mimi bangga'), ...clear, ...(next ? [this.say(chat, `Mimi sudah siapkan jadwal berikutnya: ${humanTime(next)} ♡`, {}, owner)] : [])];
    }
    if (action === 's') {
      const minutes = Number(arg);
      if (!SNOOZE.includes(minutes)) return [answer('Tombol ini sudah tidak berlaku.')];
      const until = now + minutes * 60000;
      const { updatedAt, ...rest } = item;
      this.items.put(owner, { ...rest, snoozeUntil: until }, now);
      return [answer(`Oke, Mimi ingetin lagi jam ${hhmm(minuteOfDay(until, this.zone(owner)))} ♡`), ...clear];
    }
    // f: kirim ulang lampiran
    return [answer('Ini lampirannya ♡'), ...this.resend(owner, chat, item, item.title)];
  }

  // Tandai selesai persis seperti web: rutinitas berulang menjadi riwayat dan jadwal berikutnya dibuat.
  finish(owner: string, item: ItemData & { updatedAt?: number }, now: number): string | null {
    const { updatedAt, snoozeUntil, ...rest } = item;
    const following = item.repeat ? nextOccurrence(item, wallNow(now, this.zone(owner))) : null;
    this.items.put(owner, following ? { ...rest, done: true, repeat: undefined, repeatDay: undefined, repeated: item.repeat } : { ...rest, done: true }, now);
    if (!following) return null;
    this.items.put(owner, {
      clientId: newId(), kind: 'agenda', title: item.title, note: item.note || '', time: following.time, done: false,
      repeat: item.repeat, ...(following.repeatDay ? { repeatDay: following.repeatDay } : {}), ...(item.attachments ? { attachments: item.attachments } : {}),
    }, now);
    return following.time;
  }

  // Lampiran dikirim ulang memakai file_id yang tersimpan di server (tanpa unduh ulang).
  resend(owner: string, chat: number, item: ItemData, caption: string, extra: Record<string, unknown> = {}): Outgoing[] {
    const ids = (item.attachments || []).map(a => a.id);
    const files = ids.map(id => this.db.prepare('SELECT unique_id, file_id, kind FROM telegram_files WHERE owner_id = ? AND unique_id = ?').get(owner, id) as { file_id: string; kind: string } | undefined).filter(Boolean) as { file_id: string; kind: string }[];
    const method = { photo: 'sendPhoto', video: 'sendVideo', document: 'sendDocument' } as Record<string, string>;
    return files.map((f, i) => ({
      method: method[f.kind], ownerId: owner,
      params: { chat_id: chat, [f.kind]: f.file_id, ...(i === files.length - 1 ? { caption: caption.slice(0, 1000), ...extra } : {}) },
    }));
  }
}

export function attachmentOf(msg: TgMessage): (Attachment & { fileId: string }) | null {
  if (msg.photo?.length) {
    const big = [...msg.photo].sort((a, b) => (b.file_size || b.width * b.height) - (a.file_size || a.width * a.height))[0];
    return { kind: 'photo', id: big.file_unique_id, fileId: big.file_id, mime: 'image/jpeg', ...(big.file_size ? { size: big.file_size } : {}) };
  }
  const f = msg.video ? { kind: 'video' as const, file: msg.video } : msg.document ? { kind: 'document' as const, file: msg.document } : null;
  if (!f || !/^[\w-]{1,100}$/.test(f.file.file_unique_id)) return null;
  return {
    kind: f.kind, id: f.file.file_unique_id, fileId: f.file.file_id,
    ...(f.file.file_name ? { name: f.file.file_name.slice(0, 120) } : {}),
    ...(f.file.mime_type && /^[\w.+-]+\/[\w.+-]+$/.test(f.file.mime_type) ? { mime: f.file.mime_type.slice(0, 80) } : {}),
    ...(f.file.file_size ? { size: f.file.file_size } : {}),
  };
}
