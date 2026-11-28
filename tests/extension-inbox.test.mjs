import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanCard, inboxMessage, mergeInbox } from '../src/scripts/extension-inbox.mjs';

const now = new Date('2026-11-28T10:00:00Z');
const card = (over = {}) => ({ id: 'card-0001-abcd', title: 'Canva', identity: 'akun kampus', method: 'Google', site: 'www.canva.com', savedAt: '2026-11-28T09:00:00Z', ...over });

test('hanya pesan berbentuk antrean Mimi yang diterima', () => {
  assert.equal(inboxMessage(null), null);
  assert.equal(inboxMessage({ type: 'lain', cards: [] }), null);
  assert.equal(inboxMessage({ type: 'titip-mimi-inbox', cards: 'x' }), null);
  assert.equal(inboxMessage({ type: 'titip-mimi-inbox', cards: Array(80).fill(card()) }).length, 50);
});

test('kartu dibersihkan: panjang dibatasi, cara masuk asing jadi Belum diisi, tanpa kata sandi', () => {
  const clean = cleanCard(card({ title: '  Canva\n\n Pro  ', identity: 'x'.repeat(300), method: '<script>', password: 'rahasia', savedAt: '2099-01-01' }), now);
  assert.equal(clean.title, 'Canva Pro');
  assert.equal(clean.identity.length, 160);
  assert.equal(clean.method, 'Belum diisi');
  assert.equal('password' in clean, false);
  assert.ok(!JSON.stringify(clean).includes('rahasia'));
  assert.equal(clean.history[0].at, now.toISOString());
  assert.equal(clean.history[0].label, 'Dititip dari browser');
});

test('kartu tanpa ID, nama layanan, atau email/label ditolak', () => {
  assert.equal(cleanCard(card({ id: 'x' }), now), null);
  assert.equal(cleanCard(card({ id: '../../etc' }), now), null);
  assert.equal(cleanCard(card({ title: ' ' }), now), null);
  assert.equal(cleanCard(card({ identity: 5 }), now), null);
  assert.equal(cleanCard('kartu', now), null);
});

test('kiriman ulang dan akun yang sudah ada tidak menggandakan kartu', () => {
  const existing = [{ kind: 'account', title: 'canva', identity: 'akun pribadi' }, { kind: 'note', title: 'Canva', identity: 'akun kampus' }];
  const first = mergeInbox([card(), card({ id: 'card-0002-abcd', identity: 'akun pribadi' }), card({ id: 'card-0003-abcd' })], existing, now);
  assert.equal(first.added.length, 1);
  assert.deepEqual(first.accepted, ['card-0001-abcd', 'card-0002-abcd', 'card-0003-abcd']);
  assert.equal(first.next.length, 3);
  const again = mergeInbox([card()], first.next, now);
  assert.equal(again.added.length, 0);
  assert.deepEqual(again.accepted, ['card-0001-abcd']);
  assert.equal(again.next, first.next);
});

test('dua akun dari layanan yang sama tetap terpisah', () => {
  const both = mergeInbox([card(), card({ id: 'card-0009-abcd', identity: 'akun pribadi' })], [], now);
  assert.equal(both.added.length, 2);
});
