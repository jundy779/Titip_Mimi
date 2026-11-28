import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInvitation, encodeShare, decodeShare, cleanLetter, vaults, looksSecret } from '../src/scripts/iqlima.mjs';

const now = new Date(2026, 10, 28, 21, 0);

test('undangan pernikahan: nama, tanggal, jam, dan tempat dari teks OCR yang berantakan', () => {
  const ocr = `THE WEDDING OF\n\nRaka & Salsa\n\nResepsi Pernikahan\nMinggu, 13 Desember 2026\nPukul 11.00 - 13.00 WIB\nBertempat di\nGedung Serbaguna Melati\nJl. Kenanga No. 5, Depok`;
  const r = parseInvitation(ocr, now);
  assert.equal(r.title, 'Resepsi pernikahan Raka & Salsa');
  assert.equal(r.time, '2026-12-13T11:00');
  assert.equal(r.place, 'Gedung Serbaguna Melati, Jl. Kenanga No. 5, Depok');
  assert.ok(r.dateFound && r.timeFound);
});

test('undangan tanpa tahun dan tanpa jam: tahun terdekat ke depan, jam 09.00 ditandai tebakan', () => {
  const r = parseInvitation('Undangan Syukuran\nAqiqah ananda Arsyila\nSabtu, 5 des\ntempat: kediaman Bpk. Hasan', now);
  assert.equal(r.kind, 'Aqiqah');
  assert.equal(r.title, 'Aqiqah ananda Arsyila');
  assert.equal(r.time, '2026-12-05T09:00');
  assert.equal(r.timeFound, false);
  assert.equal(r.place, 'kediaman Bpk. Hasan');
  const lewat = parseInvitation('Arisan RT\n3 Januari jam 16:00', new Date(2026, 1, 1));
  assert.equal(lewat.time, '2027-01-03T16:00');
});

test('tanggal angka dan teks tanpa acara tetap menghasilkan judul yang masuk akal', () => {
  const r = parseInvitation('Rapat Pengurus Kos\n12/12/2026\njam 19.30', now);
  assert.equal(r.title, 'Rapat Pengurus Kos');
  assert.equal(r.time, '2026-12-12T19:30');
  const kosong = parseInvitation('', now);
  assert.equal(kosong.time, ''); assert.equal(kosong.dateFound, false); assert.equal(kosong.title, 'Undangan');
});

test('tautan surat dan ajakan: bolak-balik utuh, isi dibersihkan, tautan rusak ditolak', () => {
  const hash = encodeShare('surat', { from: 'Jundy', body: 'Semangat ujiannya ya, aku bangga ♡', sticker: '🌸', at: '2026-11-28T14:00:00.000Z' });
  assert.match(hash, /^#surat\?d=[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeShare(hash), { kind: 'surat', data: { from: 'Jundy', body: 'Semangat ujiannya ya, aku bangga ♡', sticker: '🌸', at: '2026-11-28T14:00:00.000Z' } });
  const plan = decodeShare(encodeShare('rencana', { from: 'Jundy', title: 'Nonton bareng', time: '2026-12-05T19:00', place: 'Margo City', note: 'aku jemput' }));
  assert.equal(plan.kind, 'rencana'); assert.equal(plan.data.time, '2026-12-05T19:00');
  assert.equal(decodeShare('#surat?d=@@@'), null);
  assert.equal(decodeShare('#surat?d=' + btoa('{"body":""}')), null);
  assert.equal(decodeShare('#lain?d=abcd'), null);
  assert.equal(cleanLetter({ body: 'x'.repeat(2000), sticker: '<script>' }).body.length, 1000);
  assert.equal(cleanLetter({ body: 'hai', sticker: '<script>' }).sticker, '♡');
  assert.equal(encodeShare('rencana', { title: '' }), '');
});

test('pengelola kata sandi dan pengingat jangan menulis kata sandi', () => {
  assert.equal(vaults.google.url, 'https://passwords.google.com');
  assert.equal(vaults.bitwarden.url, 'https://vault.bitwarden.com');
  assert.equal(vaults.onepassword.url, 'https://my.1password.com');
  assert.ok(Object.values(vaults).every(v => !v.url || v.url.startsWith('https://')));
  assert.ok(looksSecret('password: rahasia123'));
  assert.ok(looksSecret('pin 482913'));
  assert.ok(looksSecret('kode pemulihan ABCD-EFGH'));
  assert.ok(!looksSecret('ganti password tiap 3 bulan'.replace('password', 'kata kunci')));
  assert.ok(!looksSecret('masuk pakai Google'));
});
