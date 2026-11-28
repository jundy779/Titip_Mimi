import test from 'node:test';
import assert from 'node:assert/strict';
import { addToQueue, baseDomain, guessMethod, guessService, looksLikeSecret, maxQueue, newCard, removeFromQueue } from '../extension/lib.js';

test('nama layanan ditebak dari domain', () => {
  assert.equal(guessService({ host: 'www.canva.com' }), 'Canva');
  assert.equal(guessService({ host: 'accounts.google.com' }), 'Google');
  assert.equal(guessService({ host: 'github.com', siteName: 'GitHub' }), 'GitHub');
  assert.equal(guessService({ host: 'siakad.unesa.ac.id' }), 'Unesa');
  assert.equal(guessService({ host: 'shopee.co.id', siteName: 'Shopee Indonesia' }), 'Shopee Indonesia');
  assert.equal(baseDomain('login.tokopedia.com'), 'tokopedia.com');
  assert.equal(guessService({}), '');
});

test('cara masuk ditebak dari halaman', () => {
  assert.equal(guessMethod({ google: true }), 'Google');
  assert.equal(guessMethod({ google: true, hasPassword: true }), 'Email dan kata sandi');
  assert.equal(guessMethod({ apple: true }), 'Apple');
  assert.equal(guessMethod({ hasPhone: true }), 'Nomor HP');
  assert.equal(guessMethod({}), 'Belum diisi');
});

test('isian mirip kata sandi diberi peringatan, email dan label biasa tidak', () => {
  assert.equal(looksLikeSecret('Iql!ma2026'), true);
  assert.equal(looksLikeSecret('iqlima@contoh.id'), false);
  assert.equal(looksLikeSecret('akun kampus'), false);
  assert.equal(looksLikeSecret('iqlima_99'), false);
});

test('kartu baru dibersihkan dan wajib berisi nama serta email/label', () => {
  const card = newCard({ title: ' Canva ', identity: 'akun   kampus', method: 'aneh', site: 'www.canva.com' }, 'card-0001-abcd', new Date('2026-11-28T00:00:00Z'));
  assert.deepEqual(card, { id: 'card-0001-abcd', title: 'Canva', identity: 'akun kampus', method: 'Belum diisi', site: 'www.canva.com', savedAt: '2026-11-28T00:00:00.000Z' });
  assert.throws(() => newCard({ title: '', identity: 'x' }, 'id'), /nama layanan/);
  assert.throws(() => newCard({ title: 'Canva', identity: ' ' }, 'id'), /email atau label/);
});

test('antrean menolak ganda, punya batas, dan bisa dibatalkan per kartu', () => {
  const a = { id: 'a', title: 'Canva', identity: 'kampus' };
  const first = addToQueue([], a);
  assert.equal(first.queue.length, 1);
  assert.equal(addToQueue(first.queue, { ...a, id: 'b', title: 'canva' }).duplicate, true);
  const full = Array.from({ length: maxQueue }, (_, i) => ({ id: 'x' + i, title: 'S' + i, identity: 'u' }));
  assert.throws(() => addToQueue(full, a), /penuh/);
  assert.deepEqual(removeFromQueue(first.queue, ['a']), []);
  assert.deepEqual(removeFromQueue(undefined, ['a']), []);
});
