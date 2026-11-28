import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { openDatabase, Db } from '../src/db';
import { GoogleVerifier } from '../src/google';
import { Partner } from '../src/partner';
import { TelegramApi } from '../src/telegram/api';

// Tiga akun fiktif: dua yang berpasangan, satu orang lain yang tidak boleh melihat apa pun.
const people: Record<string, { sub: string; email: string; emailVerified: boolean; name: string }> = {
  'cred-a': { sub: 'g-111', email: 'iqlima.uji@contoh.id', emailVerified: true, name: 'Iqlima Uji' },
  'cred-b': { sub: 'g-222', email: 'jundy.uji@contoh.id', emailVerified: true, name: 'Jundy Uji' },
  'cred-c': { sub: 'g-333', email: 'orang.lain@contoh.id', emailVerified: true, name: 'Orang Lain' },
};
const google: GoogleVerifier = { async verify(c) { if (!people[c]) throw new Error('x'); return people[c]; } };
const sent: { method: string; params: any }[] = [];
const telegram: TelegramApi = { async call(method, params = {}) { sent.push({ method, params }); return { message_id: 1 } as any; }, async download() { throw new Error('no'); } };

let ctx: { app: INestApplication; db: Db; http: ReturnType<typeof request>; a: string; b: string; c: string; ids: Record<string, string> };
test.beforeEach(async () => {
  sent.length = 0;
  const config = loadConfig({ ALLOWED_EMAILS: Object.values(people).map(p => p.email).join(','), STATIC_DIR: '', TELEGRAM_BOT_TOKEN: '1:uji', TELEGRAM_BOT_USERNAME: 'MimiUjiBot' } as NodeJS.ProcessEnv);
  const db = openDatabase(':memory:');
  const app = await createApp(config, db, google, false, telegram);
  await app.init();
  const http = request(app.getHttpServer());
  const ids: Record<string, string> = {};
  const login = async (cred: string) => { const r = await http.post('/v1/auth/google').set('X-Mimi', '1').set('X-Mimi-Client', 'token').send({ credential: cred }); ids[cred] = r.body.user.id; return r.body.token as string; };
  ctx = { app, db, http, a: await login('cred-a'), b: await login('cred-b'), c: await login('cred-c'), ids };
});
test.afterEach(async () => { await ctx.app.close(); });
const as = (t: string) => ({ Authorization: 'Bearer ' + t });
async function pair() {
  const inv = await ctx.http.post('/v1/partner/invite').set(as(ctx.a));
  const acc = await ctx.http.post('/v1/partner/accept').set(as(ctx.b)).send({ code: inv.body.code });
  assert.equal(acc.status, 200, JSON.stringify(acc.body));
  return inv.body.code as string;
}

test('undangan pasangan: kode 8 huruf sekali pakai, tidak bisa dipakai sendiri, hanya hash yang disimpan', async () => {
  const inv = await ctx.http.post('/v1/partner/invite').set(as(ctx.a));
  assert.match(inv.body.code, /^[A-HJ-NP-Z2-9]{8}$/);
  assert.equal((ctx.db.prepare('SELECT COUNT(*) n FROM partner_codes WHERE code_hash = ?').get(inv.body.code) as any).n, 0);
  const own = await ctx.http.post('/v1/partner/accept').set(as(ctx.a)).send({ code: inv.body.code });
  assert.equal(own.body.code, 'own_code');
  assert.equal((await ctx.http.post('/v1/partner/accept').set(as(ctx.b)).send({ code: 'salah' })).body.code, 'bad_code');
  // Huruf kecil dan spasi tetap diterima.
  const ok = await ctx.http.post('/v1/partner/accept').set(as(ctx.b)).send({ code: inv.body.code.toLowerCase().replace(/(....)/, '$1 ') });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body.partner, { name: 'Iqlima Uji' });
  assert.equal((await ctx.http.get('/v1/partner').set(as(ctx.a))).body.partner.name, 'Jundy Uji');
  // Kode yang sama tidak bisa dipakai orang ketiga.
  assert.equal((await ctx.http.post('/v1/partner/accept').set(as(ctx.c)).send({ code: inv.body.code })).body.code, 'bad_code');
  // Yang sudah berpasangan tidak bisa membuat undangan atau menerima yang lain.
  assert.equal((await ctx.http.post('/v1/partner/invite').set(as(ctx.a))).body.code, 'already_paired');
  const cInv = await ctx.http.post('/v1/partner/invite').set(as(ctx.c));
  assert.equal((await ctx.http.post('/v1/partner/accept').set(as(ctx.b)).send({ code: cInv.body.code })).body.code, 'already_paired');
});

test('kode undangan kedaluwarsa setelah 24 jam', async () => {
  const partner = ctx.app.get(Partner);
  const { code } = partner.invite(ctx.ids['cred-a'], Date.now() - 25 * 3600000);
  assert.equal((await ctx.http.post('/v1/partner/accept').set(as(ctx.b)).send({ code })).body.code, 'bad_code');
});

test('surat: hanya pasangan yang membaca, ditandai dibaca oleh penerima, disembunyikan per orang', async () => {
  assert.equal((await ctx.http.post('/v1/partner/letters').set(as(ctx.a)).send({ body: 'halo' })).body.code, 'not_paired');
  await pair();
  const s = await ctx.http.post('/v1/partner/letters').set(as(ctx.b)).send({ body: '  Semangat ujiannya, aku bangga ♡  ', sticker: '🌸' });
  assert.equal(s.status, 201);
  assert.equal(s.body.body, 'Semangat ujiannya, aku bangga ♡');
  assert.equal((await ctx.http.post('/v1/partner/letters').set(as(ctx.b)).send({ body: 'x', sticker: '<img>' })).body.sticker, '♡');
  assert.equal((await ctx.http.post('/v1/partner/letters').set(as(ctx.b)).send({ body: '   ' })).body.code, 'empty_letter');
  let inbox = (await ctx.http.get('/v1/partner/letters').set(as(ctx.a))).body;
  assert.equal(inbox.unread, 2); assert.equal(inbox.from, 'Jundy Uji');
  assert.equal(inbox.received[1].body, 'Semangat ujiannya, aku bangga ♡');
  assert.equal((await ctx.http.get('/v1/partner').set(as(ctx.a))).body.unread, 2);
  // Orang ketiga tidak melihat apa pun dan tidak bisa menandai atau menyembunyikan.
  assert.deepEqual((await ctx.http.get('/v1/partner/letters').set(as(ctx.c))).body, { received: [], sent: [], unread: 0 });
  assert.equal((await ctx.http.post(`/v1/partner/letters/${s.body.id}/read`).set(as(ctx.c))).status, 404);
  assert.equal((await ctx.http.post(`/v1/partner/letters/${s.body.id}/hide`).set(as(ctx.c))).status, 404);
  // Pengirim tidak bisa menandai suratnya sendiri dibaca.
  assert.equal((await ctx.http.post(`/v1/partner/letters/${s.body.id}/read`).set(as(ctx.b))).status, 404);
  assert.equal((await ctx.http.post(`/v1/partner/letters/${s.body.id}/read`).set(as(ctx.a))).status, 204);
  assert.equal((await ctx.http.get('/v1/partner/letters').set(as(ctx.b))).body.sent.find((l: any) => l.id === s.body.id).read, true);
  await ctx.http.post(`/v1/partner/letters/${s.body.id}/hide`).set(as(ctx.a));
  inbox = (await ctx.http.get('/v1/partner/letters').set(as(ctx.a))).body;
  assert.equal(inbox.received.length, 1);
  assert.equal((await ctx.http.get('/v1/partner/letters').set(as(ctx.b))).body.sent.length, 2, 'pengirim masih melihat suratnya');
});

test('batas surat per hari mencegah banjir', async () => {
  await pair();
  const partner = ctx.app.get(Partner);
  for (let i = 0; i < 50; i++) partner.send(ctx.ids['cred-b'], { body: 'surat ' + i });
  assert.equal((await ctx.http.post('/v1/partner/letters').set(as(ctx.b)).send({ body: 'lagi' })).status, 429);
});

test('rencana berdua: dibagi ke pasangan saja, perubahan bersamaan dimenangkan yang terbaru', async () => {
  await pair();
  const made = await ctx.http.post('/v1/partner/plans').set(as(ctx.b)).send({ title: 'Nonton bareng', time: '2026-12-05T19:00', place: 'Margo City', updatedAt: 1000 });
  assert.equal(made.body.status, 'saved');
  const id = made.body.plan.id;
  let mine = (await ctx.http.get('/v1/partner/plans').set(as(ctx.a))).body.plans;
  assert.equal(mine.length, 1); assert.equal(mine[0].by, 'Jundy Uji'); assert.equal(mine[0].byMe, false);
  assert.deepEqual((await ctx.http.get('/v1/partner/plans').set(as(ctx.c))).body.plans, []);
  // C tidak bisa menimpa rencana dengan menebak id.
  assert.equal((await ctx.http.post('/v1/partner/plans').set(as(ctx.c)).send({ id, title: 'dibajak' })).status, 409);
  // HP A (lebih baru) dan HP B (lebih lama) mengubah bersamaan.
  const [x, y] = await Promise.all([
    ctx.http.post('/v1/partner/plans').set(as(ctx.a)).send({ id, title: 'Nonton bareng', done: true, updatedAt: 3000 }),
    ctx.http.post('/v1/partner/plans').set(as(ctx.b)).send({ id, title: 'Nonton jam 8', updatedAt: 2000 }),
  ]);
  const final = (await ctx.http.get('/v1/partner/plans').set(as(ctx.b))).body.plans[0];
  assert.equal(final.done, true); assert.equal(final.title, 'Nonton bareng');
  assert.ok([x.body.status, y.body.status].includes('saved'));
  assert.equal((await ctx.http.post('/v1/partner/plans').set(as(ctx.a)).send({ title: '' })).body.code, 'bad_plan');
  assert.equal((await ctx.http.post(`/v1/partner/plans/${id}/remove`).set(as(ctx.c))).status, 409);
  assert.equal((await ctx.http.post(`/v1/partner/plans/${id}/remove`).set(as(ctx.a))).status, 204);
  assert.deepEqual((await ctx.http.get('/v1/partner/plans').set(as(ctx.b))).body.plans, []);
});

test('putus lalu sambung lagi: surat dan rencana tersembunyi lalu kembali; koleksi tidak pernah terbagi', async () => {
  await pair();
  await ctx.http.post('/v1/partner/plans').set(as(ctx.a)).send({ title: 'Makan malam' });
  await ctx.http.post('/v1/partner/letters').set(as(ctx.a)).send({ body: 'makasih ya' });
  await ctx.http.post('/v1/sync').set(as(ctx.a)).send({ changes: [{ clientId: 'rahasia-a-0001', kind: 'note', title: 'Catatan pribadi A', note: '', time: '', done: false, updatedAt: Date.now() }] });
  const bSees = await ctx.http.post('/v1/sync').set(as(ctx.b)).send({ changes: [], since: 0 });
  assert.deepEqual(bSees.body.items, [], 'pasangan tidak melihat koleksi');
  assert.equal((await ctx.http.post('/v1/partner/leave').set(as(ctx.b))).status, 204);
  assert.equal((await ctx.http.get('/v1/partner').set(as(ctx.a))).body.paired, false);
  assert.deepEqual((await ctx.http.get('/v1/partner/plans').set(as(ctx.a))).body.plans, []);
  assert.deepEqual((await ctx.http.get('/v1/partner/letters').set(as(ctx.b))).body.received, []);
  await pair();
  assert.equal((await ctx.http.get('/v1/partner/plans').set(as(ctx.b))).body.plans[0].title, 'Makan malam');
  assert.equal((await ctx.http.get('/v1/partner/letters').set(as(ctx.b))).body.received[0].body, 'makasih ya');
});

test('surat dan ajakan dikabarkan ke Telegram pasangan, kecuali saat jam tenang', async () => {
  await pair();
  ctx.db.prepare("INSERT INTO telegram_links (owner_id, tg_user_id, chat_id, username, linked_at) VALUES (?, 7001, 7001, 'iq', 0)").run(ctx.ids['cred-a']);
  const partner = ctx.app.get(Partner);
  const noon = Date.UTC(2026, 10, 28, 5, 0); // 12.00 WIB
  partner.send(ctx.ids['cred-b'], { body: 'Jangan lupa makan siang ♡', sticker: '☕' }, noon);
  await new Promise(r => setTimeout(r, 20));
  assert.equal(sent.at(-1)!.params.chat_id, 7001);
  assert.match(sent.at(-1)!.params.text, /^💌 Surat dari Jundy Uji ☕\n\nJangan lupa makan siang ♡$/);
  partner.savePlan(ctx.ids['cred-b'], { title: 'Piknik' }, noon);
  await new Promise(r => setTimeout(r, 20));
  assert.match(sent.at(-1)!.params.text, /Jundy Uji ngajak: Piknik/);
  const count = sent.length;
  partner.send(ctx.ids['cred-b'], { body: 'selamat tidur' }, Date.UTC(2026, 10, 28, 16, 0)); // 23.00 WIB
  await new Promise(r => setTimeout(r, 20));
  assert.equal(sent.length, count, 'jam tenang: tidak dikirim ke Telegram, tetap ada di web');
  // B belum menghubungkan Telegram: surat A tetap tersimpan tanpa error.
  partner.send(ctx.ids['cred-a'], { body: 'sama-sama' }, noon);
  assert.equal((await ctx.http.get('/v1/partner/letters').set(as(ctx.b))).body.received[0].body, 'sama-sama');
});

test('kartu akun menyimpan tempat kata sandi (bukan kata sandinya) dan tempat acara ikut sinkron', async () => {
  const res = await ctx.http.post('/v1/sync').set(as(ctx.a)).send({ changes: [
    { clientId: 'akun-canva-0001', kind: 'account', title: 'Canva', identity: 'iqlima.uji@contoh.id', method: 'Google', vault: 'bitwarden', updatedAt: 5, note: '', time: '', done: false },
    { clientId: 'akun-salah-0002', kind: 'account', title: 'Shopee', identity: 'iq', method: 'Google', vault: '<script>', updatedAt: 5, note: '', time: '', done: false },
    { clientId: 'undangan-0003', kind: 'agenda', title: 'Resepsi', place: 'Gedung Melati', time: '2026-12-13T11:00', updatedAt: 5, note: '', done: false },
  ] });
  const byId = Object.fromEntries(res.body.items.map((i: any) => [i.clientId, i]));
  assert.equal(byId['akun-canva-0001'].vault, 'bitwarden');
  assert.equal(byId['akun-salah-0002'].vault, undefined);
  assert.equal(byId['undangan-0003'].place, 'Gedung Melati');
  assert.equal((await ctx.http.get('/v1/items?q=melati').set(as(ctx.a))).body.items.length, 1);
});
