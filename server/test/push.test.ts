import test from 'node:test';
import assert from 'node:assert/strict';
import { createECDH, randomBytes } from 'node:crypto';
import request from 'supertest';
import webpush from 'web-push';
import type { INestApplication } from '@nestjs/common';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { openDatabase, Db } from '../src/db';
import { GoogleVerifier } from '../src/google';
import { careKinds as serverCare, Push, PushSender } from '../src/push';
import { Sessions } from '../src/sessions';

// Dua akun fiktif; layanan push palsu yang mencatat kiriman dan bisa disuruh gagal.
const people: Record<string, { sub: string; email: string; emailVerified: boolean; name: string }> = {
  'cred-a': { sub: 'g-111', email: 'iqlima.uji@contoh.id', emailVerified: true, name: 'Iqlima Uji' },
  'cred-b': { sub: 'g-222', email: 'jundy.uji@contoh.id', emailVerified: true, name: 'Jundy Uji' },
};
const google: GoogleVerifier = { async verify(c) { if (!people[c]) throw new Error('x'); return people[c]; } };
const sent: { endpoint: string; msg: any; ttl: number }[] = [];
let answer: (endpoint: string) => number | Promise<number> = () => 201;
const sender: PushSender = { async send(sub, payload, _vapid, ttl) { sent.push({ endpoint: sub.endpoint, msg: JSON.parse(payload), ttl }); return answer(sub.endpoint); } };
const device = (name: string) => {
  const ecdh = createECDH('prime256v1'); ecdh.generateKeys();
  return { endpoint: 'https://fcm.googleapis.com/fcm/send/uji-' + name, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') } };
};
// 1 Desember 2026, jam dinding WIB (UTC+7).
const wib = (hhmm: string, d = '2026-12-01') => Date.parse(`${d}T${hhmm}:00+07:00`);

let ctx: { app: INestApplication; db: Db; http: ReturnType<typeof request>; a: string; b: string; ids: Record<string, string>; push: Push };
async function boot(db = openDatabase(':memory:')) {
  sent.length = 0; answer = () => 201;
  const config = loadConfig({ ALLOWED_EMAILS: Object.values(people).map(p => p.email).join(','), STATIC_DIR: '' } as NodeJS.ProcessEnv);
  const app = await createApp(config, db, google, false, null, null, sender);
  await app.init();
  const http = request(app.getHttpServer());
  const ids: Record<string, string> = {};
  const login = async (cred: string) => { const r = await http.post('/v1/auth/google').set('X-Mimi', '1').set('X-Mimi-Client', 'token').send({ credential: cred }); ids[cred] = r.body.user.id; return r.body.token as string; };
  ctx = { app, db, http, a: await login('cred-a'), b: await login('cred-b'), ids, push: app.get(Push) };
}
test.beforeEach(() => boot());
test.afterEach(async () => { await ctx.app.close(); });
const as = (t: string) => ({ Authorization: 'Bearer ' + t });
const agenda = (token: string, clientId: string, time: string, extra: Record<string, unknown> = {}) =>
  ctx.http.post('/v1/sync').set(as(token)).send({ changes: [{ clientId, kind: 'agenda', title: 'Ambil jahitan', note: 'bawa nota', time, done: false, updatedAt: Date.now(), reminderId: 'r-' + clientId, ...extra }], since: 0 });
const item = async (token: string, clientId: string) => (await ctx.http.post('/v1/sync').set(as(token)).send({ changes: [], since: 0 })).body.items.find((i: any) => i.clientId === clientId);

test('jadwal jaga diri di server sama persis dengan web', async () => {
  // Dari dist/test, sama seperti tes pengurai waktu di telegram.test.ts.
  const web = await import(['..', '..', '..', 'src', 'scripts', 'iqlima.mjs'].join('/'));
  assert.deepEqual(serverCare, web.careKinds);
});

test('langganan: hanya layanan push resmi, kunci harus valid, satu browser satu pemilik', async () => {
  const bad = [
    { ...device('x'), endpoint: 'http://fcm.googleapis.com/fcm/send/x' },
    { ...device('x'), endpoint: 'https://127.0.0.1/fcm/send/x' },
    { ...device('x'), endpoint: 'https://fcm.googleapis.com.jahat.id/x' },
    { ...device('x'), endpoint: 'https://fcm.googleapis.com:8443/x' },
    { ...device('x'), endpoint: 'https://user:pw@fcm.googleapis.com/x' },
    { ...device('x'), keys: { p256dh: 'abc', auth: randomBytes(16).toString('base64url') } },
    { ...device('x'), keys: { p256dh: device('y').keys.p256dh, auth: randomBytes(8).toString('base64url') } },
  ];
  for (const sub of bad) assert.equal((await ctx.http.post('/v1/push/subscribe').set(as(ctx.a)).send({ subscription: sub })).body.code, 'bad_subscription', sub.endpoint);
  for (const host of ['updates.push.services.mozilla.com', 'web.push.apple.com', 'wns2-sg2p.notify.windows.com']) {
    assert.equal((await ctx.http.post('/v1/push/subscribe').set(as(ctx.a)).send({ subscription: { ...device('z'), endpoint: `https://${host}/abc` } })).status, 200, host);
  }
  const phone = device('hp');
  const r = await ctx.http.post('/v1/push/subscribe').set(as(ctx.a)).send({ subscription: phone, label: 'HP Iqlima' });
  assert.equal(r.status, 200); assert.equal(r.body.devices, 4); assert.match(r.body.publicKey, /^[A-Za-z0-9_-]{87}$/);
  // Tanpa sesi ditolak.
  assert.equal((await ctx.http.post('/v1/push/subscribe').set('X-Mimi', '1').send({ subscription: phone })).status, 401);
  // Akun lain tidak bisa mencabut perangkat milik Iqlima.
  await ctx.http.post('/v1/push/unsubscribe').set(as(ctx.b)).send({ endpoint: phone.endpoint });
  assert.equal((await ctx.http.get('/v1/push').set(as(ctx.a))).body.devices, 4);
  // Browser yang sama didaftarkan akun lain: pindah pemilik, tidak ganda.
  await ctx.http.post('/v1/push/subscribe').set(as(ctx.b)).send({ subscription: phone });
  assert.equal((await ctx.http.get('/v1/push').set(as(ctx.a))).body.devices, 3);
  assert.equal((await ctx.http.get('/v1/push').set(as(ctx.b))).body.devices, 1);
  await ctx.http.post('/v1/push/unsubscribe').set(as(ctx.b)).send({ endpoint: phone.endpoint });
  assert.equal((await ctx.http.get('/v1/push').set(as(ctx.b))).body.devices, 0);
});

test('pengingat agenda hanya ke perangkat pemiliknya, sekali per kejadian, juga saat dua putaran bersamaan', async () => {
  const hpA = device('a'), hpB = device('b');
  await ctx.http.post('/v1/push/subscribe').set(as(ctx.a)).send({ subscription: hpA });
  await ctx.http.post('/v1/push/subscribe').set(as(ctx.b)).send({ subscription: hpB });
  await agenda(ctx.a, 'nota-0001', '2026-12-01T10:00');
  assert.deepEqual(await ctx.push.tick(wib('09:59')), { queued: 0, sent: 0, deferred: 0, skipped: 0, retry: 0, failed: 0 });
  // Dua putaran paralel: klaim atomik, hanya satu yang mengirim.
  const [x, y] = await Promise.all([ctx.push.tick(wib('10:00')), ctx.push.deliver(wib('10:00'))]);
  assert.equal(x.sent + y.sent, 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].endpoint, hpA.endpoint);
  assert.equal(sent[0].msg.type, 'agenda');
  assert.match(sent[0].msg.body, /Ambil jahitan/);
  assert.equal(sent[0].msg.tag, 'mimi-r-nota-0001');
  assert.equal(sent[0].msg.id, 'r-nota-0001');
  // Diulang lagi tidak mengirim ulang.
  await ctx.push.tick(wib('10:01')); await ctx.push.tick(wib('10:05'));
  assert.equal(sent.length, 1);
});

test('periksa ulang sebelum kirim: selesai atau jadwal berubah berarti dilewati, jadwal baru diingatkan', async () => {
  await ctx.http.post('/v1/push/subscribe').set(as(ctx.a)).send({ subscription: device('a') });
  await agenda(ctx.a, 'nota-0002', '2026-12-01T10:00');
  ctx.push.queue(wib('10:00'));
  await agenda(ctx.a, 'nota-0002', '2026-12-01T11:00');
  assert.equal((await ctx.push.deliver(wib('10:00'))).skipped, 1);
  await ctx.push.tick(wib('11:00'));
  assert.equal(sent.length, 1);
  await agenda(ctx.a, 'nota-0003', '2026-12-01T12:00');
  ctx.push.queue(wib('12:00'));
  await agenda(ctx.a, 'nota-0003', '2026-12-01T12:00', { done: true });
  assert.equal((await ctx.push.deliver(wib('12:00'))).skipped, 1);
  assert.equal(sent.length, 1);
});

test('jam tenang: agenda ditunda sampai pagi, jaga diri dilewati', async () => {
  await ctx.http.post('/v1/push/subscribe').set(as(ctx.a)).send({ subscription: device('a') });
  await agenda(ctx.a, 'malam-0001', '2026-12-01T23:00');
  assert.equal((await ctx.push.tick(wib('23:00'))).deferred, 1);
  assert.equal((await ctx.push.tick(wib('05:59', '2026-12-02'))).sent, 0);
  assert.equal((await ctx.push.tick(wib('06:00', '2026-12-02'))).sent, 1);
  await ctx.http.post('/v1/push/care').set(as(ctx.a)).send({ water: false, meal: false, rest: false, sleep: true });
  const r = await ctx.push.tick(wib('22:30'));
  assert.equal(r.skipped, 1);
  assert.equal(sent.length, 1);
});

test('jaga diri: sesuai pilihan, jendela 45 menit, sekali sehari', async () => {
  await ctx.http.post('/v1/push/subscribe').set(as(ctx.a)).send({ subscription: device('a') });
  // Belum pernah diatur dari web: tidak ada pengingat jaga diri.
  assert.equal((await ctx.push.tick(wib('09:00'))).sent, 0);
  const saved = await ctx.http.post('/v1/push/care').set(as(ctx.a)).send({ water: true, meal: 'ya', rest: false, sleep: false, aneh: true });
  assert.deepEqual(saved.body, { water: true, meal: false, rest: false, sleep: false });
  assert.deepEqual((await ctx.http.get('/v1/push').set(as(ctx.a))).body.care, saved.body);
  await ctx.push.tick(wib('09:20'));
  await ctx.push.tick(wib('09:40'));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].msg.type, 'care'); assert.equal(sent[0].msg.tag, 'water-09:00'); assert.equal(sent[0].msg.title, 'Minum air ♡');
  assert.equal(sent[0].ttl, 1800);
  assert.equal((await ctx.push.tick(wib('09:50'))).sent, 0);
  assert.equal((await ctx.push.tick(wib('12:30'))).sent, 0);
  assert.equal((await ctx.push.tick(wib('09:05', '2026-12-02'))).sent, 1);
});

test('kegagalan layanan push: coba lagi bertahap, alamat mati dihapus, berhenti setelah 5 kali', async () => {
  const hp = device('a'), laptop = device('l');
  await ctx.http.post('/v1/push/subscribe').set(as(ctx.a)).send({ subscription: hp });
  await ctx.http.post('/v1/push/subscribe').set(as(ctx.a)).send({ subscription: laptop });
  await agenda(ctx.a, 'gagal-0001', '2026-12-01T10:00');
  // HP sudah mencabut izin (410), laptop sedang gangguan (503).
  answer = e => e === hp.endpoint ? 410 : 503;
  assert.equal((await ctx.push.tick(wib('10:00'))).retry, 1);
  assert.equal((await ctx.http.get('/v1/push').set(as(ctx.a))).body.devices, 1);
  assert.equal((await ctx.push.tick(wib('10:00') + 30000)).sent, 0, 'belum waktunya coba lagi');
  answer = () => 201;
  assert.equal((await ctx.push.tick(wib('10:01'))).sent, 1);
  // Semua gagal terus: berhenti setelah 5 percobaan.
  await agenda(ctx.a, 'gagal-0002', '2026-12-01T13:00');
  answer = () => 0;
  let t = wib('13:00'), last;
  for (let i = 0; i < 6; i++) { last = await ctx.push.tick(t); t += 61 * 60000; }
  const row = ctx.db.prepare("SELECT status, attempts FROM push_deliveries WHERE key LIKE 'agenda|gagal-0002|%'").get() as any;
  assert.equal(row.status, 'failed'); assert.equal(row.attempts, 5);
  // Satu-satunya alamat mati: gagal permanen tanpa mencoba lagi.
  await agenda(ctx.a, 'gagal-0003', '2026-12-01T15:00');
  answer = () => 404;
  assert.equal((await ctx.push.tick(wib('15:00'))).failed, 1);
  assert.equal((await ctx.http.get('/v1/push').set(as(ctx.a))).body.devices, 0);
});

test('tombol notifikasi: selesai dan tunda lewat token, token palsu atau kedaluwarsa ditolak', async () => {
  await ctx.http.post('/v1/push/subscribe').set(as(ctx.a)).send({ subscription: device('a') });
  // Jam sungguhan bisa jatuh di jam tenang; matikan supaya tes tidak bergantung jam.
  ctx.db.prepare('UPDATE users SET quiet_start = NULL, quiet_end = NULL').run();
  // Tombol dipakai dengan jam sungguhan, jadi agendanya jatuh tempo semenit lalu (WIB).
  const nowWib = new Date(Date.now() + 7 * 3600000 - 60000).toISOString().slice(0, 16);
  await agenda(ctx.a, 'tombol-001', nowWib, { repeat: 'daily' });
  await ctx.push.tick(Date.now());
  const t = sent[0].msg.t as string;
  assert.ok(t);
  // Tanpa X-Mimi ditolak (CSRF), dengan token palsu 404.
  assert.equal((await ctx.http.post('/v1/push/action').send({ t, action: 'snooze' })).status, 403);
  const forged = t.slice(0, -3) + (t.endsWith('AAA') ? 'BBB' : 'AAA');
  assert.equal((await ctx.http.post('/v1/push/action').set('X-Mimi', '1').send({ t: forged, action: 'done' })).status, 404);
  const snooze = await ctx.http.post('/v1/push/action').set('X-Mimi', '1').send({ t, action: 'snooze' });
  assert.equal(snooze.status, 200, JSON.stringify(snooze.body));
  assert.ok((await item(ctx.a, 'tombol-001')).snoozeUntil > Date.now());
  // Token lama setelah ditunda: kejadiannya sudah berganti, tidak menunda lagi.
  assert.match((await ctx.http.post('/v1/push/action').set('X-Mimi', '1').send({ t, action: 'snooze' })).body.message, /berubah/);
  const done = await ctx.http.post('/v1/push/action').set('X-Mimi', '1').send({ t, action: 'done' });
  assert.equal(done.status, 200);
  assert.equal((await item(ctx.a, 'tombol-001')).done, true);
  // Rutinitas harian: jadwal berikutnya dibuat, sama seperti di web dan Telegram.
  const all = (await ctx.http.post('/v1/sync').set(as(ctx.a)).send({ changes: [], since: 0 })).body.items;
  assert.ok(all.some((i: any) => i.clientId !== 'tombol-001' && i.title === 'Ambil jahitan' && i.repeat === 'daily' && !i.done));
  // Token bukan milik akun lain: B tidak punya titipan itu.
  assert.equal((await item(ctx.b, 'tombol-001')), undefined);
  const old = ctx.push.actionToken(ctx.ids['cred-a'], 'tombol-001', 'x', Date.now() - 49 * 3600000);
  assert.equal((await ctx.http.post('/v1/push/action').set('X-Mimi', '1').send({ t: old, action: 'done' })).body.code, 'expired');
});

test('tes dari Profil, kunci VAPID tetap sama setelah server dinyalakan ulang, pesan bisa dienkripsi', async () => {
  assert.equal((await ctx.http.post('/v1/push/test').set(as(ctx.a))).body.code, 'no_device');
  const hp = device('a');
  await ctx.http.post('/v1/push/subscribe').set(as(ctx.a)).send({ subscription: hp });
  const r = await ctx.http.post('/v1/push/test').set(as(ctx.a));
  assert.deepEqual(r.body, { ok: true, devices: 1 });
  assert.equal(sent[0].msg.type, 'test');
  const key = (await ctx.http.get('/v1/push').set(as(ctx.a))).body.publicKey;
  const db = ctx.db;
  await ctx.app.close();
  await boot(db);
  assert.equal((await ctx.http.get('/v1/push').set(as(ctx.a))).body.publicKey, key);
  // Enkripsi sungguhan (aes128gcm) dengan kunci tersimpan, tanpa mengirim ke internet.
  const v = ctx.push.vapid();
  const req = webpush.generateRequestDetails(hp, JSON.stringify(sent[0]?.msg || { type: 'test' }), { vapidDetails: v, TTL: 60 });
  assert.equal(req.endpoint, hp.endpoint);
  assert.equal(req.headers['Content-Encoding'], 'aes128gcm');
  assert.match(String(req.headers.Authorization), /^vapid t=.+, k=/);
  assert.ok((req.body as Buffer).length > 100);
  assert.ok(!(req.body as Buffer).toString().includes('Tes dari Mimi'), 'isi terenkripsi');
});

test('sambungkan aplikasi HP: kode sekali pakai dari web ditukar jadi sesi, kedaluwarsa 10 menit', async () => {
  assert.equal((await ctx.http.post('/v1/auth/device-code').set('X-Mimi', '1')).status, 401);
  const made = await ctx.http.post('/v1/auth/device-code').set(as(ctx.a));
  assert.match(made.body.code, /^[A-HJ-NP-Z2-9]{8}$/);
  assert.equal((ctx.db.prepare('SELECT COUNT(*) n FROM device_codes WHERE code_hash = ?').get(made.body.code) as any).n, 0, 'kode mentah tidak disimpan');
  // Dua tukar bersamaan: hanya satu yang berhasil.
  const pretty = made.body.code.toLowerCase().replace(/(....)/, '$1-');
  const [x, y] = await Promise.all([1, 2].map(() => ctx.http.post('/v1/auth/device-code/redeem').set('X-Mimi', '1').send({ code: pretty })));
  assert.deepEqual([x.status, y.status].sort(), [200, 400]);
  const ok = x.status === 200 ? x : y;
  assert.equal(ok.body.user.email, 'iqlima.uji@contoh.id');
  // Token baru bisa dipakai, dan hanya melihat data pemiliknya.
  const saved = await agenda(ctx.a, 'hp-000001', '2026-12-01T10:00');
  assert.equal(saved.body.results?.[0]?.status, 'saved', JSON.stringify(saved.body));
  const viaPhone = await ctx.http.post('/v1/sync').set(as(ok.body.token)).send({ changes: [], since: 0 });
  assert.ok(viaPhone.body.items?.some((i: any) => i.clientId === 'hp-000001'), JSON.stringify({ status: viaPhone.status, body: viaPhone.body, ok: ok.body }));
  assert.equal(await item(ctx.b, 'hp-000001'), undefined);
  // Kode baru membatalkan kode lama; kode kedaluwarsa ditolak.
  const sessions = ctx.app.get(Sessions);
  const old = sessions.createDeviceCode(ctx.ids['cred-a'], Date.now() - 11 * 60000);
  assert.equal((await ctx.http.post('/v1/auth/device-code/redeem').set('X-Mimi', '1').send({ code: old.code })).body.code, 'bad_code');
  const first = (await ctx.http.post('/v1/auth/device-code').set(as(ctx.a))).body.code;
  await ctx.http.post('/v1/auth/device-code').set(as(ctx.a));
  assert.equal((await ctx.http.post('/v1/auth/device-code/redeem').set('X-Mimi', '1').send({ code: first })).body.code, 'bad_code');
  // Tebakan beruntun dibatasi.
  let limited = false;
  for (let i = 0; i < 12; i++) if ((await ctx.http.post('/v1/auth/device-code/redeem').set('X-Mimi', '1').send({ code: 'AAAAAAAA' })).status === 429) limited = true;
  assert.ok(limited);
});
