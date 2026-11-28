import { BadRequestException, ConflictException, ForbiddenException, HttpException, Inject, Injectable, Optional } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { CONFIG, Config } from '../config';
import { DB, Db } from '../db';
import { HttpTelegramApi, TELEGRAM_API, TelegramApi, TelegramError } from './api';

export type ApiFactory = (token: string) => TelegramApi;
export const TELEGRAM_FACTORY = Symbol('TELEGRAM_FACTORY');

// Teks profil bot. Dipasang otomatis saat bot dipasang, jadi Iqlima tidak perlu mengetiknya di BotFather.
export const BOT_PROFILE = {
  short: 'Kucing kecil penjaga titipan Iqlima. Kirim foto nota, catatan, atau jadwal, nanti Mimi ingetin ♡',
  description: [
    'Halo, aku Mimi ♡',
    '',
    'Kirim apa saja ke aku: teks, foto nota, video, atau dokumen. Aku simpan di Ruang Iqlima, lalu aku ingetin tepat waktu, lengkap dengan fotonya.',
    '',
    'Belum tersambung? Buka Ruang Iqlima > Profil > Hubungkan Telegram, lalu tekan Mulai di sini.',
  ].join('\n'),
  commands: [
    { command: 'hariini', description: 'Agenda hari ini' },
    { command: 'besok', description: 'Agenda besok' },
    { command: 'cari', description: 'Cari titipan, misalnya /cari nota' },
    { command: 'tenang', description: 'Atur jam tenang, misalnya /tenang 22-6' },
    { command: 'id', description: 'Lihat ID Telegram kamu' },
    { command: 'bantuan', description: 'Cara pakai Mimi' },
    { command: 'stop', description: 'Putuskan Telegram dari Ruang Iqlima' },
  ],
};

const TOKEN = /^\d{5,15}:[A-Za-z0-9_-]{20,80}$/;

// Bot yang sedang aktif. Sumbernya environment server (diutamakan) atau token yang ditempel
// di Profil. Token Profil tersimpan di tabel settings dan tidak pernah dikirim balik ke browser.
@Injectable()
export class TelegramRuntime {
  api: TelegramApi | null = null;
  username = '';
  source: 'env' | 'profil' | null = null;
  secret = '';
  owner: string | null = null;
  receiving: 'webhook' | 'polling' | null = null;
  private factory: ApiFactory;

  constructor(
    @Inject(CONFIG) private config: Config,
    @Inject(DB) private db: Db,
    @Optional() @Inject(TELEGRAM_API) injected: TelegramApi | null,
    @Optional() @Inject(TELEGRAM_FACTORY) factory: ApiFactory | null,
  ) {
    this.factory = factory || (token => new HttpTelegramApi(token));
    const env = config.telegram;
    if (env.token) {
      Object.assign(this, { api: injected || this.factory(env.token), username: env.username, source: 'env', secret: env.webhookSecret });
    } else {
      const s = this.saved();
      if (s.token) Object.assign(this, { api: this.factory(s.token), username: s.username, source: 'profil', secret: s.secret, owner: s.owner || null });
    }
  }

  get mode(): 'webhook' | 'polling' | null {
    if (!this.api) return null;
    if (this.source === 'env') return this.config.telegram.mode === 'polling' ? 'polling' : 'webhook';
    return /^https:\/\//.test(this.config.telegram.publicUrl) ? 'webhook' : 'polling';
  }
  get webhookUrl() { return this.config.telegram.publicUrl + '/v1/telegram/webhook'; }

  private saved() {
    const rows = this.db.prepare("SELECT key, value FROM settings WHERE key LIKE 'telegram.%'").all() as { key: string; value: string }[];
    const get = (k: string) => rows.find(r => r.key === 'telegram.' + k)?.value || '';
    return { token: get('token'), username: get('username'), secret: get('secret'), owner: get('owner') };
  }

  // Bila username belum diisi di environment, ambil dari Telegram sendiri.
  async ensureUsername() {
    if (!this.api || this.username) return;
    try { this.username = (await this.api.call<{ username?: string }>('getMe')).username || ''; } catch {}
  }

  // Pasang deskripsi dan menu perintah. Gagal di sini tidak menggagalkan pemasangan.
  async describe(api = this.api) {
    if (!api) return;
    for (const [method, params] of [
      ['setMyShortDescription', { short_description: BOT_PROFILE.short }],
      ['setMyDescription', { description: BOT_PROFILE.description }],
      ['setMyCommands', { commands: BOT_PROFILE.commands }],
    ] as const) await api.call(method, params).catch(() => {});
  }

  async install(ownerId: string, raw: unknown) {
    if (this.source === 'env') throw new ConflictException({ code: 'managed_by_server', message: 'Bot sudah dipasang lewat pengaturan server.' });
    if (this.owner && this.owner !== ownerId) throw new ForbiddenException({ code: 'not_bot_owner', message: 'Bot ini dipasang dari akun lain. Minta dia melepasnya dulu, ya.' });
    const token = typeof raw === 'string' ? raw.trim() : '';
    if (!TOKEN.test(token)) throw new BadRequestException({ code: 'bad_token', message: 'Token kelihatannya belum lengkap. Salin lagi dari BotFather: angka, titik dua, lalu deretan huruf.' });
    const api = this.factory(token);
    let me: { is_bot?: boolean; username?: string };
    try { me = await api.call('getMe'); }
    catch (error) {
      if (error instanceof TelegramError && (error.code === 401 || error.code === 404)) throw new BadRequestException({ code: 'token_rejected', message: 'Telegram tidak mengenali token ini. Mungkin sudah diganti. Ambil token terbaru dari BotFather, ya.' });
      throw new HttpException({ code: 'telegram_unavailable', message: 'Telegram sedang tidak bisa dihubungi. Coba lagi sebentar, ya.' }, 502);
    }
    if (!me?.is_bot || !me.username) throw new BadRequestException({ code: 'token_rejected', message: 'Token ini bukan milik bot.' });
    const secret = randomBytes(24).toString('base64url');
    const changed = this.username && this.username !== me.username;
    const now = Date.now();
    this.db.transaction(() => {
      const put = this.db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at');
      put.run('telegram.token', token, now);
      put.run('telegram.username', me.username!, now);
      put.run('telegram.secret', secret, now);
      put.run('telegram.owner', ownerId, now);
      // Bot lain = obrolan lain. Sambungan lama tidak berlaku lagi dan harus dihubungkan ulang.
      if (changed) this.forgetLinks();
    })();
    Object.assign(this, { api, username: me.username, source: 'profil', secret, owner: ownerId });
    await this.describe(api);
    return { username: me.username };
  }

  async remove(ownerId: string) {
    if (this.source === 'env') throw new ConflictException({ code: 'managed_by_server', message: 'Bot dipasang lewat pengaturan server.' });
    if (!this.api) return;
    if (this.owner && this.owner !== ownerId) throw new ForbiddenException({ code: 'not_bot_owner', message: 'Bot ini dipasang dari akun lain.' });
    const api = this.api;
    this.db.transaction(() => {
      this.db.prepare("DELETE FROM settings WHERE key LIKE 'telegram.%'").run();
      this.forgetLinks();
    })();
    Object.assign(this, { api: null, username: '', source: null, secret: '', owner: null });
    await api.call('deleteWebhook', { drop_pending_updates: false }).catch(() => {});
  }

  private forgetLinks() {
    this.db.prepare('DELETE FROM telegram_links').run();
    this.db.prepare('DELETE FROM telegram_link_codes').run();
    this.db.prepare("DELETE FROM telegram_threads WHERE key LIKE 'msg:%'").run();
    this.db.prepare("UPDATE reminder_deliveries SET status = 'skipped' WHERE status IN ('pending','retry','sending')").run();
  }
}
