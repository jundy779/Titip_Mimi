import test from 'node:test';
import assert from 'node:assert/strict';
import { arrive, createLife, favorite, favoriteLines, greetingOf, idleLines, moodOf, pickHabit, readLife } from '../public/mimi-life.js';

const H = 3600000;
const at = (h) => new Date(2026, 10, 28, h, 0, 0);
function memory(init = {}) { const d = { ...init }; return { getItem: k => d[k] ?? null, setItem: (k, v) => { d[k] = String(v); }, d }; }
const base = { affection: 70, energy: 80, lastSeen: 0, lastPlay: 0, lastFed: 0, counts: { play: 0, feed: 0, wash: 0, chat: 0, pet: 0 } };

test('mood mengikuti jam, energi, kenyang, dan kedekatan', () => {
  assert.equal(moodOf(base, at(23)), 'ngantuk');
  assert.equal(moodOf(base, at(3)), 'ngantuk');
  assert.equal(moodOf({ ...base, energy: 10 }, at(14)), 'ngantuk');
  assert.equal(moodOf(base, at(14), { full: true }), 'kenyang');
  assert.equal(moodOf({ ...base, affection: 40 }, at(14)), 'manja');
  assert.equal(moodOf(base, at(14)), 'semangat');
  assert.equal(moodOf({ ...base, energy: 60 }, at(14)), 'ceria');
  assert.equal(moodOf(base, at(14), { welcome: true }), 'kangen');
});

test('lama tidak datang: Mimi istirahat, jadi manja, dan menyambut gembira', () => {
  const now = at(14).getTime();
  const back = arrive({ ...base, energy: 20, lastSeen: now - 30 * H }, now);
  assert.equal(back.energy, 100);
  assert.equal(back.affection, 35);
  assert.equal(back.welcomeBack, true);
  assert.equal(arrive({ ...base, lastSeen: now - H }, now).welcomeBack, false);
  assert.match(greetingOf(back, 'kangen'), /seneng/);
});

test('Mimi mengingat kegiatan favorit setelah beberapa kali', () => {
  assert.equal(favorite(base), null);
  const fan = { ...base, counts: { ...base.counts, feed: 5, play: 2 } };
  assert.equal(favorite(fan), 'feed');
  assert.equal(greetingOf(fan, 'ceria'), favoriteLines.feed);
});

test('kebiasaan dipilih sesuai mood, jalan-jalan hanya di mode main', () => {
  const seq = [0, .2, .4, .6, .8, .99];
  for (const r of seq) assert.notEqual(pickHabit('semangat', { canWander: false, random: () => r }), 'wander');
  assert.equal(pickHabit('ngantuk', { random: () => 0 }), 'sleep');
  assert.equal(pickHabit('semangat', { canWander: true, random: () => 0 }), 'wander');
});

test('tidak ada kalimat menyalahkan', () => {
  const all = [...Object.values(favoriteLines), ...Object.values(idleLines), ...['kangen', 'ngantuk', 'manja', 'semangat', 'ceria'].map(m => greetingOf(base, m))].join(' ').toLowerCase();
  for (const w of ['kok lama', 'ke mana aja', 'kemana aja', 'ditinggal', 'kecewa', 'sedih']) assert.ok(!all.includes(w), w);
});

test('saat dibiarkan Mimi mulai kebiasaan, sentuhan menghentikannya, dan tidur dibangunkan', () => {
  const store = memory();
  let t = at(23).getTime();
  const life = createLife(store, t, () => 0);
  const s = { mode: 'play', motion: 'rest', gesture: 'idle', catX: 0, face: 0 };
  for (let i = 0; i < 70; i++) { t += 100; life.update(.1, s, t); }
  assert.equal(s.habit, 'sleep');
  assert.ok(s.habitT > 0);
  assert.equal(life.poke(t), 'wake');
  life.update(.1, s, t);
  assert.equal(s.habit, null);
  s.gesture = 'pet';
  life.force('groom'); life.update(.1, s, t);
  assert.equal(s.habit, null, 'gestur menghentikan kebiasaan');
});

test('jalan-jalan menggerakkan Mimi lalu berhenti', () => {
  let t = at(14).getTime();
  const life = createLife(memory(), t, () => .5);
  const s = { mode: 'play', motion: 'rest', gesture: 'idle', catX: 0, face: 0 };
  life.force('wander');
  for (let i = 0; i < 80 && s.habit !== null; i++) { t += 100; life.update(.1, s, t); }
  assert.ok(Math.abs(s.catX - 1) < .05, String(s.catX));
  assert.equal(s.habit, null);
});

test('ikatan bertambah dan tersimpan; data rusak tetap aman', () => {
  const store = memory();
  const life = createLife(store, at(14).getTime());
  const before = life.life.affection;
  life.bond('pet', at(14).getTime());
  assert.equal(readLife(store).affection, before + 3);
  assert.equal(readLife(store).counts.pet, 1);
  assert.equal(readLife(memory({ 'mimi-life-v1': '{rusak' })).affection, 60);
});
