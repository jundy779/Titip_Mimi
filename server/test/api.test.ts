import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { openDatabase, Db, SCHEMA_VERSION } from '../src/db';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GoogleVerifier, OAuthGoogleVerifier } from '../src/google';

// Akun uji fiktif. Verifier palsu menggantikan Google agar tes tidak butuh internet.
const people: Record<string, { sub: string; email: string; emailVerified: boolean; name: string }> = {
  'cred-a': { sub: 'g-111', email: 'iqlima.uji@contoh.id', emailVerified: true, name: 'Uji A' },
  'cred-b': { sub: 'g-222', email: 'jundy.uji@contoh.id', emailVerified: true, name: 'Uji B' },
  'cred-c': { sub: 'g-333', email: 'orang.lain@contoh.id', emailVerified: true, name: 'Uji C' },
  'cred-unverified': { sub: 'g-444', email: 'belum@contoh.id', emailVerified: false, name: 'Uji D' },
};
const fake: GoogleVerifier = {
  async verify(credential) {
    if (credential === 'cred-down') throw new Error('network down');
    const p = people[credential];
    if (!p) throw new Error('invalid token');
    return p;
  },
};

async function setup(env: Record<string, string> = {}, verifier: GoogleVerifier = fake) {
  const config = loadConfig({ ALLOWED_EMAILS: 'iqlima.uji@contoh.id,jundy.uji@contoh.id', STATIC_DIR: '', ...env } as NodeJS.ProcessEnv);
  const db = openDatabase(':memory:');
  const app = await createApp(config, db, verifier, false);
  await app.init();
  return { app, db, http: request(app.getHttpServer()) };
}
async function login(http: ReturnType<typeof request>, cred: string) {
  const res = await http.post('/v1/auth/google').set('X-Mimi', '1').set('X-Mimi-Client', 'token').send({ credential: cred });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.token as string;
}
const sync = (http: ReturnType<typeof request>, token: string, changes: unknown[], since = 0) =>
  http.post('/v1/sync').set('Authorization', 'Bearer ' + token).send({ changes, since });
const note = (clientId: string, title: string, updatedAt: number, extra: Record<string, unknown> = {}) =>
  ({ clientId, kind: 'note', title, note: '', time: '', done: false, updatedAt, ...extra });

let ctx: { app: INestApplication; db: Db; http: ReturnType<typeof request> };
test.beforeEach(async () => { ctx = await setup(); });
test.afterEach(async () => { await ctx.app.close(); });

test('login memasang cookie HttpOnly dan hanya memberi token bila diminta', async () => {
  const res = await ctx.http.post('/v1/auth/google').set('X-Mimi', '1').send({ credential: 'cred-a' });
  assert.equal(res.status, 200);
  assert.equal(res.body.token, undefined);
  const cookie = String(res.headers['set-cookie']);
  assert.match(cookie, /mimi_session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  const me = await ctx.http.get('/v1/me').set('Cookie', cookie.split(';')[0]);
  assert.equal(me.body.email, 'iqlima.uji@contoh.id');
  const token = await login(ctx.http, 'cred-a');
  assert.equal((await ctx.http.get('/v1/me').set('Authorization', 'Bearer ' + token)).body.name, 'Uji A');
});

test('database hanya menyimpan hash token', async () => {
  const token = await login(ctx.http, 'cred-a');
  const rows = ctx.db.prepare('SELECT token_hash FROM sessions').all() as { token_hash: string }[];
  assert.ok(rows.length >= 1);
  assert.ok(rows.every(r => r.token_hash !== token && r.token_hash.length === 64));
});

test('akun di luar undangan, email belum terverifikasi, dan token palsu ditolak', async () => {
  const post = (credential: string) => ctx.http.post('/v1/auth/google').set('X-Mimi', '1').send({ credential });
  assert.equal((await post('cred-c')).status, 403);
  assert.equal((await post('cred-unverified')).status, 401);
  assert.equal((await post('palsu')).status, 401);
  assert.equal((await post('cred-down')).status, 401, 'Google tidak terjangkau tidak membuat sesi');
  assert.equal((await ctx.http.post('/v1/auth/google').set('X-Mimi', '1').send({ credential: 5 })).status, 400);
  assert.equal((ctx.db.prepare('SELECT COUNT(*) n FROM sessions').get() as { n: number }).n, 0);
});

test('tanpa GOOGLE_CLIENT_ID login dimatikan dengan jelas', async () => {
  const off = await setup({}, new OAuthGoogleVerifier([]));
  const res = await off.http.post('/v1/auth/google').set('X-Mimi', '1').send({ credential: 'apa saja' });
  assert.equal(res.status, 503);
  assert.equal(res.body.code, 'login_disabled');
  await off.app.close();
});

test('perubahan lewat cookie tanpa header X-Mimi ditolak (CSRF)', async () => {
  const res = await ctx.http.post('/v1/auth/google').set('X-Mimi', '1').send({ credential: 'cred-a' });
  const cookie = String(res.headers['set-cookie']).split(';')[0];
  assert.equal((await ctx.http.post('/v1/sync').set('Cookie', cookie).send({ changes: [] })).status, 403);
  assert.equal((await ctx.http.post('/v1/sync').set('Cookie', cookie).set('X-Mimi', '1').send({ changes: [] })).status, 200);
});

test('dua pemilik terisolasi saat baca, cari, dan tulis', async () => {
  const a = await login(ctx.http, 'cred-a'), b = await login(ctx.http, 'cred-b');
  await sync(ctx.http, a, [note('canva-kampus-1', 'Canva kampus', 1000)]);
  const bView = await sync(ctx.http, b, [], 0);
  assert.deepEqual(bView.body.items, []);
  assert.deepEqual((await ctx.http.get('/v1/items?q=canva').set('Authorization', 'Bearer ' + b)).body.items, []);
  await sync(ctx.http, b, [note('canva-kampus-1', 'Milik B', 2000)]);
  const aView = await sync(ctx.http, a, [], 0);
  assert.equal(aView.body.items.length, 1);
  assert.equal(aView.body.items[0].title, 'Canva kampus');
  assert.equal((await ctx.http.get('/v1/items?q=milik').set('Authorization', 'Bearer ' + a)).body.items.length, 0);
});

test('migrasi diulang setelah koneksi putus tidak menggandakan titipan', async () => {
  const a = await login(ctx.http, 'cred-a');
  const batch = [note('lama-0001', 'Ambil jahitan', 500, { time: '2026-11-28T16:00', kind: 'agenda' }), note('lama-0002', 'Undangan syukuran', 500)];
  const first = await sync(ctx.http, a, batch);
  assert.deepEqual(first.body.results.map((r: { status: string }) => r.status), ['saved', 'saved']);
  const retry = await sync(ctx.http, a, batch);
  assert.deepEqual(retry.body.results.map((r: { status: string }) => r.status), ['stale', 'stale']);
  assert.equal((ctx.db.prepare('SELECT COUNT(*) n FROM items').get() as { n: number }).n, 2);
  const delta = await sync(ctx.http, a, [], first.body.cursor);
  assert.deepEqual(delta.body.items, [], 'cursor hanya mengirim yang baru');
});

test('perubahan bersamaan: yang terbaru menang dan semua urutan berakhir sama', async () => {
  const a = await login(ctx.http, 'cred-a');
  await sync(ctx.http, a, [note('nota-0001', 'Versi HP', 100)]);
  await sync(ctx.http, a, [note('nota-0001', 'Versi laptop', 200)]);
  const late = await sync(ctx.http, a, [note('nota-0001', 'Versi HP telat', 150)]);
  assert.equal(late.body.results[0].status, 'stale');
  const final = (await sync(ctx.http, a, [], 0)).body.items[0];
  assert.equal(final.title, 'Versi laptop');
  // Seri waktu sama: hasil tidak bergantung pada urutan kedatangan.
  const x = note('seri-0001', 'Alfa', 300), y = note('seri-0001', 'Beta', 300);
  const other = await setup();
  const b = await login(other.http, 'cred-a');
  await sync(ctx.http, a, [x]); await sync(ctx.http, a, [y]);
  await sync(other.http, b, [y]); await sync(other.http, b, [x]);
  const t1 = (await sync(ctx.http, a, [], 0)).body.items.find((i: { clientId: string }) => i.clientId === 'seri-0001').title;
  const t2 = (await sync(other.http, b, [], 0)).body.items.find((i: { clientId: string }) => i.clientId === 'seri-0001').title;
  assert.equal(t1, t2);
  await other.app.close();
});

test('sinkron paralel dari dua perangkat tetap konsisten', async () => {
  const a = await login(ctx.http, 'cred-a');
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) => sync(ctx.http, a, [note('par-000' + i + 'x', 'Paralel ' + i, 1000 + i)])));
  assert.ok(results.every(r => r.status === 200));
  const seqs = (await sync(ctx.http, a, [], 0)).body.items.map((i: { seq: number }) => i.seq);
  assert.equal(new Set(seqs).size, 8);
});

test('hapus menyebar sebagai tombstone dan tidak hidup lagi oleh edit lama', async () => {
  const a = await login(ctx.http, 'cred-a');
  await sync(ctx.http, a, [note('hapus-001', 'Kartu lama', 100)]);
  await sync(ctx.http, a, [{ clientId: 'hapus-001', deleted: true, updatedAt: 300 }]);
  await sync(ctx.http, a, [note('hapus-001', 'Edit lama', 200)]);
  const item = (await sync(ctx.http, a, [], 0)).body.items[0];
  assert.equal(item.deleted, true);
  assert.equal((await ctx.http.get('/v1/items?q=kartu').set('Authorization', 'Bearer ' + a)).body.items.length, 0);
});

test('validasi per titipan, kolom asing dibuang, dan kata sandi tidak tersimpan', async () => {
  const a = await login(ctx.http, 'cred-a');
  const res = await sync(ctx.http, a, [
    { clientId: 'akun-0001', kind: 'account', title: 'Canva', identity: 'akun kampus', method: 'Google', password: 'rahasia123', updatedAt: 10 },
    { clientId: 'akun-0002', kind: 'account', title: 'Canva', updatedAt: 10 },
    { clientId: 'x', title: 'ID pendek', updatedAt: 10 },
    note('waktu-001', 'Waktu salah', 10, { time: 'besok' }),
    note('kosong-01', '', 10),
  ]);
  assert.deepEqual(res.body.results.map((r: { status: string }) => r.status), ['saved', 'invalid', 'invalid', 'invalid', 'invalid']);
  const raw = ctx.db.prepare('SELECT data FROM items').get() as { data: string };
  assert.ok(!raw.data.includes('rahasia'));
  assert.equal((await sync(ctx.http, a, Array(501).fill(note('banyak-01', 'x', 1)))).status, 400);
});

test('sesi kedaluwarsa dan sesi yang sudah keluar ditolak', async () => {
  const a = await login(ctx.http, 'cred-a');
  assert.equal((await ctx.http.post('/v1/auth/logout').set('Authorization', 'Bearer ' + a)).status, 204);
  assert.equal((await ctx.http.get('/v1/me').set('Authorization', 'Bearer ' + a)).status, 401);
  const b = await login(ctx.http, 'cred-a');
  ctx.db.prepare('UPDATE sessions SET expires_at = 1').run();
  const res = await ctx.http.get('/v1/me').set('Authorization', 'Bearer ' + b);
  assert.equal(res.status, 401);
  assert.equal(res.body.code, 'session_expired');
});

test('pencarian aman dari karakter khusus LIKE', async () => {
  const a = await login(ctx.http, 'cred-a');
  await sync(ctx.http, a, [note('cari-0001', 'Diskon 50% semua', 1), note('cari-0002', 'Biasa saja', 1)]);
  const q = (s: string) => ctx.http.get('/v1/items?q=' + encodeURIComponent(s)).set('Authorization', 'Bearer ' + a);
  assert.equal((await q('50%')).body.items.length, 1);
  assert.equal((await q('%')).body.items.length, 1);
  assert.equal((await q('_')).body.items.length, 0);
});

test('migrasi database tercatat dan bisa dibuka ulang', () => {
  const v = ctx.db.prepare('SELECT version FROM schema_version').get() as { version: number };
  assert.equal(v.version, SCHEMA_VERSION);
  assert.equal(SCHEMA_VERSION, 5);
});

test('database versi 1 berisi data naik ke versi terbaru tanpa kehilangan apa pun', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mimi-mig-'));
  const path = join(dir, 'lama.sqlite');
  const old = openDatabase(path, 1);
  old.prepare("INSERT INTO users (id, google_sub, email, name, created_at) VALUES ('u1', 'g-1', 'iqlima.uji@contoh.id', 'Uji A', 1)").run();
  old.prepare("INSERT INTO items (owner_id, client_id, kind, search, data, updated_at, seq) VALUES ('u1', 'lama-0001', 'note', 'nota', '{\"title\":\"nota\"}', 5, 1)").run();
  old.close();
  const upgraded = openDatabase(path);
  assert.equal((upgraded.prepare('SELECT version FROM schema_version').get() as any).version, SCHEMA_VERSION);
  assert.equal((upgraded.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name = 'settings'").get() as any).n, 1);
  assert.deepEqual(upgraded.prepare('SELECT quiet_start, quiet_end FROM users').get(), { quiet_start: 1320, quiet_end: 360 });
  assert.equal((upgraded.prepare("SELECT data FROM items WHERE client_id = 'lama-0001'").get() as any).data, '{"title":"nota"}');
  assert.equal((upgraded.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name LIKE 'telegram_%' AND type = 'table'").get() as any).n, 5);
  upgraded.close();
  // Dibuka lagi: tidak menjalankan migrasi dua kali.
  assert.equal((openDatabase(path).prepare('SELECT version FROM schema_version').get() as any).version, SCHEMA_VERSION);
  rmSync(dir, { recursive: true, force: true });
});

test('login dibatasi 10 kali per menit per alamat', async () => {
  const codes = [];
  for (let i = 0; i < 12; i++) codes.push((await ctx.http.post('/v1/auth/google').set('X-Mimi', '1').send({ credential: 'palsu' })).status);
  assert.deepEqual(codes.slice(0, 10), Array(10).fill(401));
  assert.deepEqual(codes.slice(10), [429, 429]);
});

test('kolom rutinitas dan minta tolong ikut tersimpan dan divalidasi', async () => {
  const a = await login(ctx.http, 'cred-a');
  await sync(ctx.http, a, [
    note('kos-00001', 'Bayar kos', 5, { kind: 'agenda', time: '2026-12-01T09:00', repeat: 'monthly', repeatDay: 31, helpAskedAt: '2026-11-28T03:00:00.000Z' }),
    note('aneh-0001', 'Ulang aneh', 5, { kind: 'agenda', time: '2026-12-01T09:00', repeat: 'tiap detik', repeatDay: 99 }),
  ]);
  const items = (await sync(ctx.http, a, [], 0)).body.items;
  const kos = items.find((i: { clientId: string }) => i.clientId === 'kos-00001');
  assert.equal(kos.repeat, 'monthly'); assert.equal(kos.repeatDay, 31); assert.equal(kos.helpAskedAt, '2026-11-28T03:00:00.000Z');
  const aneh = items.find((i: { clientId: string }) => i.clientId === 'aneh-0001');
  assert.equal(aneh.repeat, undefined); assert.equal(aneh.repeatDay, undefined);
});
