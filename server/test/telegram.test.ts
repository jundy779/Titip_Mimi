import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { openDatabase, Db } from '../src/db';
import { GoogleVerifier } from '../src/google';
import { Items } from '../src/items';
import { TelegramApi, TelegramError, TgUpdate } from '../src/telegram/api';
import { TelegramBot } from '../src/telegram/bot';
import { Reminders } from '../src/telegram/reminders';
import { TelegramPoller } from '../src/telegram/poller';
import { nextOccurrence, parseDump, toEpoch } from '../src/telegram/time';

// Dua akun fiktif dan dua pengguna Telegram fiktif. Tidak ada panggilan ke internet.
const people: Record<string, { sub: string; email: string; emailVerified: boolean; name: string }> = {
  'cred-a': { sub: 'g-111', email: 'iqlima.uji@contoh.id', emailVerified: true, name: 'Uji A' },
  'cred-b': { sub: 'g-222', email: 'jundy.uji@contoh.id', emailVerified: true, name: 'Uji B' },
};
const google: GoogleVerifier = { async verify(c) { if (!people[c]) throw new Error('x'); return people[c]; } };
const TG_A = 7001, TG_B = 7002;
const SECRET = 'rahasia-uji-0123456789';
// Sabtu 28 November 2026, 09.05 WIB.
const NOW = Date.UTC(2026, 10, 28, 2, 5);
const MIN = 60000;

class FakeTelegram implements TelegramApi {
  calls: { method: string; params: any; result?: any }[] = [];
  fail: ((method: string, params: any) => TelegramError | null) | null = null;
  updates: TgUpdate[] = [];
  private id = 500;
  async call(method: string, params: any = {}): Promise<any> {
    const call: { method: string; params: any; result?: any } = { method, params };
    this.calls.push(call);
    const e = this.fail?.(method, params);
    if (e) throw e;
    if (method === 'getFile') return { file_path: 'photos/file_1.jpg', file_size: 3 };
    if (method === 'getUpdates') return this.updates.splice(0);
    if (method === 'deleteWebhook') return true;
    return (call.result = { message_id: this.id++ });
  }
  async download() { return { body: Readable.toWeb(Readable.from([Buffer.from('JPG')])) as any, type: 'image/jpeg', length: 3 }; }
  sent(method = 'sendMessage') { return this.calls.filter(c => c.method === method); }
  last(method = 'sendMessage') { return this.sent(method).at(-1)?.params; }
  clear() { this.calls = []; }
}

let ctx: { app: INestApplication; db: Db; http: ReturnType<typeof request>; tg: FakeTelegram; bot: TelegramBot; reminders: Reminders; items: Items; a: string; b: string; ownerA: string; ownerB: string };
let updateId = 1;

async function setup() {
  const config = loadConfig({ ALLOWED_EMAILS: 'iqlima.uji@contoh.id,jundy.uji@contoh.id', STATIC_DIR: '', TELEGRAM_BOT_TOKEN: '123:uji', TELEGRAM_BOT_USERNAME: 'TitipMimiBot', TELEGRAM_WEBHOOK_SECRET: SECRET } as NodeJS.ProcessEnv);
  const db = openDatabase(':memory:');
  const tg = new FakeTelegram();
  const app = await createApp(config, db, google, false, tg);
  await app.init();
  const http = request(app.getHttpServer());
  const login = async (cred: string) => (await http.post('/v1/auth/google').set('X-Mimi', '1').set('X-Mimi-Client', 'token').send({ credential: cred })).body;
  const A = await login('cred-a'), B = await login('cred-b');
  return { app, db, http, tg, bot: app.get(TelegramBot), reminders: app.get(Reminders), items: app.get(Items), a: A.token as string, b: B.token as string, ownerA: A.user.id as string, ownerB: B.user.id as string };
}
test.beforeEach(async () => { ctx = await setup(); });
test.afterEach(async () => { await ctx.app.close(); });

const auth = (token: string) => ({ Authorization: 'Bearer ' + token });
const msg = (from: number, extra: Record<string, unknown>): TgUpdate =>
  ({ update_id: updateId++, message: { message_id: updateId, date: 0, chat: { id: from, type: 'private' }, from: { id: from, first_name: 'Uji', username: 'uji' + from }, ...extra } } as TgUpdate);
const text = (from: number, t: string, extra: Record<string, unknown> = {}) => msg(from, { text: t, ...extra });
const press = (from: number, data: string, messageId = 1): TgUpdate =>
  ({ update_id: updateId++, callback_query: { id: 'cb' + updateId, from: { id: from }, data, message: { message_id: messageId, chat: { id: from, type: 'private' } } } });
async function linkCode(token: string) {
  const res = await ctx.http.post('/v1/telegram/link').set(auth(token));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.match(res.body.url, /^https:\/\/t\.me\/TitipMimiBot\?start=[\w-]+$/);
  return new URL(res.body.url).searchParams.get('start')!;
}
async function linkBoth() {
  await ctx.bot.handle(text(TG_A, '/start ' + await linkCode(ctx.a)), Date.now());
  await ctx.bot.handle(text(TG_B, '/start ' + await linkCode(ctx.b)), Date.now());
  ctx.tg.clear();
}
const pull = async (token: string) => (await ctx.http.post('/v1/sync').set(auth(token)).send({ changes: [], since: 0 })).body.items as any[];
const buttons = (params: any) => (params?.reply_markup?.inline_keyboard || []).flat() as { text: string; callback_data: string }[];
const delivery = (clientId: string) => ctx.db.prepare('SELECT status, attempts, next_try, error FROM reminder_deliveries WHERE client_id = ? ORDER BY rowid DESC').get(clientId) as any;

test('webhook tanpa secret yang benar dijawab 404 dan tidak menyentuh data', async () => {
  const update = text(TG_A, 'halo');
  assert.equal((await ctx.http.post('/v1/telegram/webhook').send(update)).status, 404);
  assert.equal((await ctx.http.post('/v1/telegram/webhook').set('X-Telegram-Bot-Api-Secret-Token', 'salah-salah-salah-1').send(update)).status, 404);
  assert.equal(ctx.tg.calls.length, 0);
  const ok = await ctx.http.post('/v1/telegram/webhook').set('X-Telegram-Bot-Api-Secret-Token', SECRET).send(update);
  assert.equal(ok.status, 200);
  assert.match(ctx.tg.last().text, /Hubungkan Telegram/);
  assert.equal((ctx.db.prepare('SELECT COUNT(*) n FROM items').get() as any).n, 0);
});

test('tautan sekali pakai: kedaluwarsa, dipakai ulang, dan Telegram milik akun lain ditolak', async () => {
  const code = await linkCode(ctx.a);
  await ctx.bot.handle(text(TG_A, '/start ' + code), Date.now() + 11 * MIN);
  assert.match(ctx.tg.last().text, /kedaluwarsa/);
  await ctx.bot.handle(text(TG_A, '/start ' + code), Date.now());
  assert.match(ctx.tg.last().text, /nyambung Uji A/);
  await ctx.bot.handle(text(TG_A, '/start ' + code), Date.now());
  assert.match(ctx.tg.last().text, /sudah pernah dipakai/);
  const codeB = await linkCode(ctx.b);
  await ctx.bot.handle(text(TG_A, '/start ' + codeB), Date.now());
  assert.match(ctx.tg.last().text, /akun Titip Mimi lain/);
  assert.equal((await ctx.http.get('/v1/telegram').set(auth(ctx.b))).body.linked, false);
  const a = (await ctx.http.get('/v1/telegram').set(auth(ctx.a))).body;
  assert.equal(a.linked, true);
  assert.equal(a.username, 'uji7001');
  assert.equal(a.quietStart, 1320);
  // Kode hanya tersimpan sebagai hash.
  assert.equal((ctx.db.prepare('SELECT COUNT(*) n FROM telegram_link_codes WHERE code_hash = ?').get(code) as any).n, 0);
});

test('pengguna Telegram yang belum tersambung hanya diberi petunjuk', async () => {
  await ctx.bot.handle(text(9999, 'beli kado ibu'), NOW);
  assert.match(ctx.tg.last().text, /Hubungkan Telegram/);
  assert.equal((ctx.db.prepare('SELECT COUNT(*) n FROM items').get() as any).n, 0);
  await ctx.bot.handle(msg(9999, { chat: { id: -5, type: 'group' }, text: 'halo grup' }), NOW);
  assert.equal(ctx.tg.sent().length, 1, 'pesan grup diabaikan tanpa balasan');
});

test('teks jadi satu titipan; jadwal aktif setelah dikonfirmasi dan hanya milik pengirimnya', async () => {
  await linkBoth();
  await ctx.bot.handle(text(TG_A, 'ambil jahitan jumat jam 4 sore\nnota di dompet'), NOW);
  const reply = ctx.tg.last();
  assert.match(reply.text, /Mimi simpan ♡ Ambil jahitan/);
  assert.match(reply.text, /Jumat, 4 Des, 16\.00/);
  let [item] = await pull(ctx.a);
  assert.equal(item.kind, 'note', 'belum ada jadwal sebelum dikonfirmasi');
  assert.equal(item.note, 'nota di dompet');
  assert.equal(item.source, 'telegram');
  assert.deepEqual(await pull(ctx.b), []);
  // Tombol milik A dipencet dari Telegram B: tidak menyentuh titipan A.
  const yes = buttons(reply).find(b => b.text.startsWith('Iya'))!;
  await ctx.bot.handle(press(TG_B, yes.callback_data), NOW);
  assert.equal(ctx.tg.last('answerCallbackQuery').text, 'Titipan ini sudah dihapus.');
  assert.equal((await pull(ctx.a))[0].kind, 'note');
  await ctx.bot.handle(press(TG_A, yes.callback_data), NOW);
  [item] = await pull(ctx.a);
  assert.equal(item.kind, 'agenda');
  assert.equal(item.time, '2026-12-04T16:00');
  assert.ok(ctx.tg.sent('editMessageReplyMarkup').length >= 1, 'tombol dibersihkan');
});

test('update yang dikirim ulang Telegram tidak membuat titipan dobel', async () => {
  await linkBoth();
  const update = text(TG_A, 'bayar kos');
  await ctx.bot.handle(update, NOW);
  await ctx.bot.handle(update, NOW);
  await ctx.http.post('/v1/telegram/webhook').set('X-Telegram-Bot-Api-Secret-Token', SECRET).send(update);
  assert.equal((await pull(ctx.a)).length, 1);
  assert.equal(ctx.tg.sent().length, 1);
});

test('balas pertanyaan Mimi dengan waktu, atau pilih tombol cepat', async () => {
  await linkBoth();
  await ctx.bot.handle(text(TG_A, 'telepon dokter gigi'), NOW);
  const ask = ctx.tg.last();
  assert.deepEqual(buttons(ask).map(b => b.text), ['Nanti malam 19.00', 'Besok pagi 08.00', 'Tanpa jadwal']);
  const promptId = ctx.tg.sent().at(-1)!.result.message_id;
  await ctx.bot.handle(text(TG_A, 'gimana ya'), NOW); // bukan balasan: jadi titipan baru
  await ctx.bot.handle(text(TG_A, 'hmm kapan aja', { reply_to_message: { message_id: promptId } }), NOW);
  assert.match(ctx.tg.last().text, /belum nangkep waktunya/);
  await ctx.bot.handle(text(TG_A, 'besok jam 9 pagi', { reply_to_message: { message_id: promptId } }), NOW);
  assert.match(ctx.tg.last().text, /Minggu, 29 Nov, 09\.00/);
  const dokter = (await pull(ctx.a)).find(i => i.title === 'Telepon dokter gigi');
  assert.equal(dokter.time, '2026-11-29T09:00');
});

test('album foto jadi satu titipan, dan foto hanya bisa dibuka pemiliknya', async () => {
  await linkBoth();
  const photo = (id: string) => [{ file_id: 'small-' + id, file_unique_id: 's' + id, width: 90, height: 90, file_size: 900 }, { file_id: 'big-' + id, file_unique_id: 'b' + id, width: 1280, height: 960, file_size: 99000 }];
  await ctx.bot.handle(msg(TG_A, { photo: photo('1'), media_group_id: 'album-1', caption: 'nota jahit besok jam 10' }), NOW);
  await ctx.bot.handle(msg(TG_A, { photo: photo('2'), media_group_id: 'album-1' }), NOW);
  const items = await pull(ctx.a);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Nota jahit');
  assert.deepEqual(items[0].attachments.map((a: any) => a.id), ['b1', 'b2']);
  assert.ok(!JSON.stringify(items[0]).includes('big-1'), 'file_id Telegram tidak dikirim ke browser');
  assert.equal(ctx.tg.sent().length, 1, 'satu balasan untuk satu album');
  const mine = await ctx.http.get('/v1/media/b1').set(auth(ctx.a));
  assert.equal(mine.status, 200);
  assert.equal(mine.headers['content-type'], 'image/jpeg');
  assert.match(mine.headers['content-security-policy'], /sandbox/);
  assert.equal(String(mine.body), 'JPG');
  assert.equal(ctx.tg.last('getFile').file_id, 'big-1');
  assert.equal((await ctx.http.get('/v1/media/b1').set(auth(ctx.b))).status, 404);
  assert.equal((await ctx.http.get('/v1/media/b1')).status, 401);
  // B tidak bisa "mengklaim" foto A dengan menyalin id lampirannya lewat sinkron.
  await ctx.http.post('/v1/sync').set(auth(ctx.b)).send({ changes: [{ clientId: 'curian-0001', kind: 'note', title: 'curian', note: '', time: '', done: false, updatedAt: Date.now(), attachments: [{ kind: 'photo', id: 'b1' }] }] });
  assert.equal((await ctx.http.get('/v1/media/b1').set(auth(ctx.b))).status, 404);
});

test('dokumen berbahaya diunduh sebagai file, tidak ditampilkan', async () => {
  await linkBoth();
  await ctx.bot.handle(msg(TG_A, { document: { file_id: 'doc-1', file_unique_id: 'd1', file_name: 'jebakan.html', mime_type: 'text/html', file_size: 10 } }), NOW);
  const [item] = await pull(ctx.a);
  assert.equal(item.title, 'jebakan.html');
  const res = await ctx.http.get('/v1/media/d1').set(auth(ctx.a));
  assert.equal(res.headers['content-type'], 'application/octet-stream');
  assert.match(res.headers['content-disposition'], /^attachment/);
  await ctx.bot.handle(msg(TG_A, { document: { file_id: 'doc-2', file_unique_id: 'd2', file_name: 'besar.zip', file_size: 30 * 1024 * 1024 } }), NOW);
  assert.equal((await ctx.http.get('/v1/media/d2').set(auth(ctx.a))).status, 413);
  ctx.tg.fail = m => m === 'getFile' ? new TelegramError(0, 'network') : null;
  assert.equal((await ctx.http.get('/v1/media/d1').set(auth(ctx.a))).status, 502);
});

async function scheduled(title: string, time: string, extra: Record<string, unknown> = {}) {
  const clientId = 'uji-' + title.toLowerCase().replace(/\W+/g, '-').slice(0, 20) + '-' + updateId++;
  ctx.items.put(ctx.ownerA, { clientId, kind: 'agenda', title, note: '', time, done: false, ...extra }, NOW - 60 * MIN);
  return clientId;
}

test('pengingat dikirim tepat sekali, membawa foto, dan bisa ditandai selesai dari Telegram', async () => {
  await linkBoth();
  await ctx.bot.handle(msg(TG_A, { photo: [{ file_id: 'big-9', file_unique_id: 'b9', width: 800, height: 600, file_size: 5000 }], caption: 'ambil jahitan jam 10' }), NOW);
  const item = (await pull(ctx.a))[0];
  await ctx.bot.handle(press(TG_A, buttons(ctx.tg.last()).find(b => b.text.startsWith('Iya'))!.callback_data), NOW);
  ctx.tg.clear();
  const due = toEpoch('2026-11-28T10:00', 'Asia/Jakarta')!;
  assert.equal((await ctx.reminders.tick(due - MIN)).sent, 0, 'belum waktunya');
  const first = await ctx.reminders.tick(due + 5000);
  assert.equal(first.sent, 1);
  const sent = ctx.tg.last('sendPhoto');
  assert.equal(sent.photo, 'big-9');
  assert.match(sent.caption, /Mimi mau ingetin ♡\nAmbil jahitan\n🗓 Sabtu, 28 Nov, 10\.00/);
  assert.equal((await ctx.reminders.tick(due + 60000)).sent, 0, 'tidak dikirim dua kali');
  const done = buttons(sent).find(b => b.text.includes('selesai'))!;
  await ctx.bot.handle(press(TG_A, done.callback_data), due + 2 * MIN);
  assert.equal((await pull(ctx.a)).find(i => i.clientId === item.clientId).done, true);
  await ctx.bot.handle(press(TG_A, done.callback_data), due + 3 * MIN);
  assert.equal(ctx.tg.last('answerCallbackQuery').text, 'Sudah selesai kok ♡');
});

test('tunda dari Telegram membuat kejadian baru; titipan selesai atau dijadwal ulang tidak dikirim', async () => {
  await linkBoth();
  const id = await scheduled('Minum vitamin', '2026-11-28T09:00');
  await ctx.reminders.tick(NOW);
  const snooze = buttons(ctx.tg.last()).find(b => b.text === 'Tunda 10 menit')!;
  await ctx.bot.handle(press(TG_A, snooze.callback_data), NOW + MIN);
  assert.match(ctx.tg.last('answerCallbackQuery').text, /09\.16/);
  assert.equal((await ctx.reminders.tick(NOW + 5 * MIN)).sent, 0);
  assert.equal((await ctx.reminders.tick(NOW + 12 * MIN)).sent, 1);

  // Masuk antrean, lalu web menandai selesai sebelum terkirim: dilewati.
  const doneId = await scheduled('Bayar listrik', '2026-11-28T09:00');
  ctx.reminders.queue(NOW);
  const cur = ctx.items.get(ctx.ownerA, doneId)!;
  ctx.items.put(ctx.ownerA, { ...cur, done: true }, NOW);
  // Dijadwal ulang dari web setelah masuk antrean: kejadian lama dilewati.
  const movedId = await scheduled('Jemput adik', '2026-11-28T09:00');
  ctx.reminders.queue(NOW);
  ctx.items.put(ctx.ownerA, { ...ctx.items.get(ctx.ownerA, movedId)!, time: '2026-11-28T16:00' }, NOW);
  const tally = await ctx.reminders.deliver(NOW);
  assert.equal(tally.skipped, 2);
  assert.equal(delivery(doneId).status, 'skipped');
  // Pengingat yang sudah lewat lebih dari 6 jam tidak dikirim (misalnya setelah server mati).
  await scheduled('Kemarin', '2026-11-27T20:00');
  assert.equal((await ctx.reminders.tick(NOW + 13 * MIN)).sent, 0);
});

test('jam tenang menahan pengingat sampai pagi, dan bisa diatur atau dimatikan', async () => {
  await linkBoth();
  const id = await scheduled('Siapkan baju kerja', '2026-11-28T23:00');
  const late = toEpoch('2026-11-28T23:00', 'Asia/Jakarta')!;
  const r = await ctx.reminders.tick(late + 1000);
  assert.equal(r.deferred, 1);
  assert.equal(delivery(id).next_try, toEpoch('2026-11-29T06:00', 'Asia/Jakarta'));
  assert.equal(delivery(id).attempts, 0, 'ditahan bukan berarti gagal');
  assert.equal((await ctx.reminders.tick(toEpoch('2026-11-29T05:59', 'Asia/Jakarta')!)).sent, 0);
  assert.equal((await ctx.reminders.tick(toEpoch('2026-11-29T06:00', 'Asia/Jakarta')!)).sent, 1);
  // Lewat Telegram
  await ctx.bot.handle(text(TG_A, '/tenang 21.30-7'), NOW);
  assert.match(ctx.tg.last().text, /21\.30 sampai 07\.00/);
  await ctx.bot.handle(text(TG_A, '/tenang mati'), NOW);
  assert.equal((await ctx.http.get('/v1/telegram').set(auth(ctx.a))).body.quietStart, null);
  // Lewat web, dengan validasi
  assert.equal((await ctx.http.post('/v1/telegram/settings').set(auth(ctx.a)).send({ quietStart: 1500, quietEnd: 60 })).status, 400);
  assert.equal((await ctx.http.post('/v1/telegram/settings').set(auth(ctx.a)).send({ quietStart: 1320, quietEnd: null })).status, 400);
  const ok = await ctx.http.post('/v1/telegram/settings').set(auth(ctx.a)).send({ quietStart: 1380, quietEnd: 360 });
  assert.equal(ok.body.quietStart, 1380);
});

test('Telegram gagal: coba ulang dengan jeda, hormati retry_after, berhenti setelah 5 kali', async () => {
  await linkBoth();
  const id = await scheduled('Kirim berkas', '2026-11-28T09:00');
  ctx.tg.fail = () => new TelegramError(502, 'Bad Gateway');
  assert.equal((await ctx.reminders.tick(NOW)).retry, 1);
  assert.equal(delivery(id).next_try, NOW + MIN);
  assert.equal((await ctx.reminders.tick(NOW + 30000)).retry, 0, 'belum waktunya coba lagi');
  ctx.tg.fail = () => new TelegramError(429, 'Too Many Requests', 42);
  await ctx.reminders.tick(NOW + MIN);
  assert.equal(delivery(id).next_try, NOW + MIN + 42000);
  ctx.tg.fail = null;
  assert.equal((await ctx.reminders.tick(NOW + MIN + 42000)).sent, 1);
  assert.equal(delivery(id).status, 'sent');

  const stuck = await scheduled('Selalu gagal', '2026-11-28T09:00');
  ctx.tg.fail = () => new TelegramError(0, 'network');
  let t = NOW;
  for (let i = 0; i < 6; i++) { await ctx.reminders.tick(t); t += 2 * 3600000; }
  assert.equal(delivery(stuck).status, 'failed');
  assert.equal(delivery(stuck).attempts, 5);
});

test('bot diblokir: sambungan diputus otomatis dan tidak ada kiriman lagi', async () => {
  await linkBoth();
  await scheduled('Satu', '2026-11-28T09:00');
  ctx.tg.fail = () => new TelegramError(403, 'Forbidden: bot was blocked by the user');
  assert.equal((await ctx.reminders.tick(NOW)).failed, 1);
  assert.equal((await ctx.http.get('/v1/telegram').set(auth(ctx.a))).body.linked, false);
  ctx.tg.fail = null; ctx.tg.clear();
  await scheduled('Dua', '2026-11-28T09:01');
  await ctx.reminders.tick(NOW + MIN);
  assert.equal(ctx.tg.calls.length, 0);
});

test('dua proses pengingat bersamaan tetap mengirim satu kali', async () => {
  await linkBoth();
  await scheduled('Rapat RT', '2026-11-28T09:00');
  const twin = new Reminders(ctx.db, ctx.items, ctx.bot, ctx.tg);
  const [x, y] = await Promise.all([ctx.reminders.tick(NOW), twin.tick(NOW)]);
  assert.equal(x.sent + y.sent, 1);
  assert.equal(ctx.tg.sent().length, 1);
});

test('rutinitas harian selesai dari Telegram menyiapkan jadwal berikutnya', async () => {
  await linkBoth();
  const id = await scheduled('Siram tanaman', '2026-11-28T09:00', { repeat: 'daily' });
  await ctx.reminders.tick(NOW);
  await ctx.bot.handle(press(TG_A, 'd:' + id), NOW + MIN);
  assert.match(ctx.tg.last().text, /Minggu, 29 Nov, 09\.00/);
  const items = await pull(ctx.a);
  const old = items.find(i => i.clientId === id), next = items.find(i => i.clientId !== id);
  assert.equal(old.done, true);
  assert.equal(old.repeated, 'daily');
  assert.equal(old.repeat, undefined);
  assert.equal(next.time, '2026-11-29T09:00');
  assert.equal(next.repeat, 'daily');
});

test('putuskan dari web atau /stop menghentikan pengingat yang menunggu', async () => {
  await linkBoth();
  const id = await scheduled('Tunggu', '2026-11-28T09:00');
  ctx.reminders.queue(NOW);
  assert.equal((await ctx.http.post('/v1/telegram/unlink').set(auth(ctx.a))).status, 204);
  assert.equal(delivery(id).status, 'skipped');
  assert.equal((await ctx.reminders.deliver(NOW)).sent, 0);
  await ctx.bot.handle(text(TG_B, '/stop'), NOW);
  assert.equal((await ctx.http.get('/v1/telegram').set(auth(ctx.b))).body.linked, false);
  await ctx.bot.handle(text(TG_B, 'masih bisa?'), NOW);
  assert.match(ctx.tg.last().text, /Hubungkan Telegram/);
});

test('/cari hanya mencari titipan sendiri dan bisa mengirim ulang lampiran', async () => {
  await linkBoth();
  await ctx.bot.handle(msg(TG_A, { photo: [{ file_id: 'big-n', file_unique_id: 'bn', width: 10, height: 10 }], caption: 'nota jahit' }), NOW);
  ctx.items.put(ctx.ownerB, { clientId: 'milik-b-0001', kind: 'note', title: 'Nota rahasia B', note: '', time: '', done: false }, NOW);
  await ctx.bot.handle(text(TG_A, '/cari nota'), NOW);
  const found = ctx.tg.last();
  assert.match(found.text, /Nota jahit 📎/);
  assert.doesNotMatch(found.text, /rahasia/);
  await ctx.bot.handle(press(TG_A, buttons(found)[0].callback_data), NOW);
  assert.equal(ctx.tg.last('sendPhoto').photo, 'big-n');
});

test('polling memproses antrean dan tidak dobel dengan webhook', async () => {
  await linkBoth();
  const update = text(TG_A, 'catat nomor resi');
  ctx.tg.updates = [update, text(TG_A, 'beli gas')];
  const poller = new TelegramPoller(ctx.tg, ctx.bot, async () => {});
  assert.equal(await poller.once(0), 2);
  ctx.tg.updates = [update];
  await poller.once(0);
  assert.equal(ctx.tg.last('getUpdates').offset, update.update_id + 2);
  assert.equal((await pull(ctx.a)).length, 2);
  ctx.tg.fail = m => m === 'getUpdates' ? new TelegramError(502, 'down') : null;
  assert.equal(await poller.once(0), 0, 'Telegram mati tidak membuat poller berhenti');
});

test('pengurai waktu server sama dengan web (iqlima.mjs)', async () => {
  const web = await import(['..', '..', '..', 'src', 'scripts', 'iqlima.mjs'].join('/'));
  const now = new Date(2026, 10, 28, 9, 5);
  const lines = ['ambil jahitan jumat jam 4 sore', 'bayar kos besok', 'jemput adik jam 16.30', 'kado ibu tgl 5', 'arisan 12 des jam 19:00', 'senin pagi rapat jam 8', 'nanti malam jam 9 malam', 'beli sabun', 'lusa jam 7 pagi', 'sabtu jam 8'];
  assert.deepEqual(parseDump(lines.join('\n'), now).map(p => [p.title, p.time]), web.parseDump(lines.join('\n'), now).map((p: any) => [p.title, p.time]));
  for (const item of [{ time: '2026-01-31T08:00', repeat: 'monthly' }, { time: '2026-11-27T09:00', repeat: 'daily' }, { time: '2026-11-21T09:00', repeat: 'weekly' }]) {
    assert.deepEqual(nextOccurrence(item, now), web.nextOccurrence(item, now));
  }
  assert.equal(toEpoch('2026-11-28T09:05', 'Asia/Jakarta'), NOW);
  assert.equal(toEpoch('2026-03-08T03:30', 'America/New_York'), Date.UTC(2026, 2, 8, 7, 30));
});
