import test from 'node:test';
import assert from 'node:assert/strict';
import { blockedWords, greeting, lines, momentOf, reaction, reactions, readState, visit, welcomeBack, daysBetween } from '../src/scripts/mimi-manja.mjs';

const at = (h, d = 28) => new Date(2026, 10, d, h, 5, 0);
function memory(initial = {}) {
  const data = { ...initial };
  return { getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, data };
}

test('setiap jam punya momen dan sapaan', () => {
  for (let h = 0; h < 24; h++) {
    const g = greeting(at(h));
    assert.ok(g.title.includes('Iqlima'), 'jam ' + h);
    assert.ok(g.line.length > 0);
  }
  assert.equal(momentOf(at(7)).id, 'pagi');
  assert.equal(momentOf(at(12)).id, 'siang');
  assert.equal(momentOf(at(16)).id, 'sore');
  assert.equal(momentOf(at(20)).id, 'malam');
  assert.equal(momentOf(at(23)).id, 'larut');
  assert.equal(momentOf(at(2)).id, 'larut');
  assert.equal(greeting(at(23)).pose, 'sleep');
});

test('kalimat tetap sepanjang hari yang sama dan berganti di hari lain', () => {
  assert.equal(greeting(at(8)).line, greeting(at(9)).line);
  const week = new Set(Array.from({ length: 7 }, (_, i) => greeting(at(8, 20 + i)).line));
  assert.ok(week.size > 1);
});

test('suara Mimi tidak memakai kata yang menyalahkan', () => {
  const all = [...Object.values(lines).flat(), ...Object.values(reactions).flat(), welcomeBack].join(' ').toLowerCase();
  for (const word of blockedWords) assert.ok(!all.includes(word), word);
});

test('kembali setelah dua hari disambut gembira, bukan ditanya ke mana', () => {
  const store = memory({ 'titip-mimi-manja-v1': JSON.stringify({ lastVisit: '2026-11-25' }) });
  const { hello } = visit(store, at(10));
  assert.equal(hello.line, welcomeBack);
  assert.equal(hello.pose, 'celebrate');
  assert.equal(readState(store).lastVisit, '2026-11-28');
  assert.notEqual(visit(store, at(11)).hello.line, welcomeBack);
});

test('penyimpanan rusak atau diblokir tetap memberi bawaan aman', () => {
  assert.deepEqual(readState(memory({ 'titip-mimi-manja-v1': '{rusak' })), { enabled: true, lastVisit: '', pets: 0 });
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(visit(blocked, at(9)).hello.moment, 'pagi');
  assert.equal(readState(memory({ 'titip-mimi-manja-v1': JSON.stringify({ enabled: false }) })).enabled, false);
  assert.equal(daysBetween('bukan-tanggal', at(9)), 0);
});

test('reaksi selalu punya pose dan teks', () => {
  for (const kind of Object.keys(reactions)) {
    const r = reaction(kind, at(10));
    assert.ok(r.text && r.pose, kind);
  }
  assert.equal(reaction('tidak-ada', at(10)).pose, 'saved');
});
