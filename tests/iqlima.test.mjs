import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDump, nextOccurrence, weekStats, praise, helpMessage, waLink, needsSupport, support, dueCare, defaultCare, isLeoSeason, birthdayInfo, feelings, careKinds, firstbornLine } from '../src/scripts/iqlima.mjs';

// Sabtu 28 Nov 2026 pukul 10.00 waktu lokal.
const now = new Date(2026, 10, 28, 10, 0);

test('tumpahkan pikiran: satu baris satu titipan, tanggal dan jam bahasa sehari-hari', () => {
  const r = parseDump(`- bayar kos besok
• jemput adik jam 4 sore
1. beli kado ibu tgl 5
telepon bank senin jam 9
jangan lupa minum vitamin
rapat 13.30`, now);
  assert.deepEqual(r.map(x => [x.title, x.time]), [
    ['Bayar kos', '2026-11-29T09:00'],
    ['Jemput adik', '2026-11-28T16:00'],
    ['Beli kado ibu', '2026-12-05T09:00'],
    ['Telepon bank', '2026-11-30T09:00'],
    ['Minum vitamin', ''],
    ['Rapat', '2026-11-28T13:30'],
  ]);
  assert.equal(r[4].kind, 'note');
  assert.equal(r[0].kind, 'agenda');
});

test('jam yang sudah lewat pindah ke besok; malam dan siang dikonversi', () => {
  assert.equal(parseDump('cuci baju jam 8', now)[0].time, '2026-11-29T08:00');
  assert.equal(parseDump('nonton jam 8 malam', now)[0].time, '2026-11-28T20:00');
  assert.equal(parseDump('makan jam 1 siang', now)[0].time, '2026-11-28T13:00');
  assert.equal(parseDump('arisan sabtu jam 9', now)[0].time, '2026-12-05T09:00', 'hari yang sama tapi lewat pindah minggu depan');
  assert.equal(parseDump('kondangan 12 des', now)[0].time, '2026-12-12T09:00');
  assert.equal(parseDump('', now).length, 0);
  assert.equal(parseDump('a\n\n\n', now).length, 0);
});

test('rutinitas: harian, mingguan, bulanan dengan tanggal akhir bulan yang tetap', () => {
  assert.equal(nextOccurrence({ time: '2026-11-28T08:00', repeat: 'daily' }, now).time, '2026-11-29T08:00');
  assert.equal(nextOccurrence({ time: '2026-11-25T08:00', repeat: 'daily' }, now).time, '2026-11-29T08:00', 'terlambat tetap lompat ke depan');
  assert.equal(nextOccurrence({ time: '2026-11-28T19:00', repeat: 'weekly' }, now).time, '2026-12-05T19:00');
  const jan = nextOccurrence({ time: '2027-01-31T09:00', repeat: 'monthly' }, new Date(2027, 0, 31, 12));
  assert.deepEqual(jan, { time: '2027-02-28T09:00', repeatDay: 31 });
  assert.equal(nextOccurrence({ time: jan.time, repeat: 'monthly', repeatDay: 31 }, new Date(2027, 1, 28, 12)).time, '2027-03-31T09:00');
  assert.equal(nextOccurrence({ time: '2026-11-28T08:00' }, now), null);
});

test('dinding bangga menghitung minggu ini mulai Senin', () => {
  const wins = [
    { kind: 'done', at: new Date(2026, 10, 23, 9).toISOString() },
    { kind: 'task', at: new Date(2026, 10, 27, 9).toISOString() },
    { kind: 'win', text: 'Berani presentasi', at: new Date(2026, 10, 28, 9).toISOString() },
    { kind: 'done', at: new Date(2026, 10, 22, 9).toISOString() },
  ];
  const s = weekStats(wins, now);
  assert.deepEqual([s.total, s.done, s.task, s.manual], [3, 1, 1, 1]);
  assert.deepEqual(s.highlights, ['Berani presentasi']);
  assert.match(praise(s), /Mimi/);
  assert.match(praise(weekStats([], now)), /langkah kecil/);
});

test('minta tolong Jundy: pesan jelas dan tautan WhatsApp aman', () => {
  const text = helpMessage({ title: 'Ambil jahitan', time: '2026-11-28T16:00', note: 'Notanya di laci' });
  assert.match(text, /^Jundy, aku minta tolong ya: Ambil jahitan \(/);
  assert.match(text, /Notanya di laci/);
  assert.equal(waLink('0812-3456-7890', 'hai & yuk'), 'https://wa.me/6281234567890?text=hai%20%26%20yuk');
  assert.equal(waLink('', 'hai'), 'https://wa.me/?text=hai');
});

test('ruang lega mengenali kalimat yang mengkhawatirkan dan memberi nomor resmi', () => {
  assert.equal(needsSupport('aku capek banget hari ini'), false);
  assert.equal(needsSupport('rasanya pengen mati aja'), true);
  assert.equal(needsSupport('kepikiran bunuh diri'), true);
  assert.match(support.text, /119 ekstensi 8/);
  assert.match(firstbornLine, /anak pertama/);
  for (const f of Object.values(feelings)) assert.ok(!/harusnya|jangan lebay|kurang bersyukur/.test(f.reply));
});

test('jaga diri: muncul sekali per jadwal dalam 45 menit dan bisa dimatikan', () => {
  const nine = new Date(2026, 10, 28, 9, 10);
  const r = dueCare(defaultCare, nine, {});
  assert.equal(r.id, 'water-09:00');
  assert.equal(dueCare(defaultCare, nine, { 'water-09:00': '2026-11-28' }), null);
  assert.equal(dueCare({ ...defaultCare, water: false }, nine, {}), null);
  assert.equal(dueCare(defaultCare, new Date(2026, 10, 28, 9, 50), {}), null);
  for (const k of Object.values(careKinds)) for (const l of k.lines) assert.ok(!/kok belum|lupa lagi|harus/.test(l), l);
});

test('musim Leo dan ulang tahun', () => {
  assert.equal(isLeoSeason(new Date(2026, 6, 23)), true);
  assert.equal(isLeoSeason(new Date(2026, 7, 22)), true);
  assert.equal(isLeoSeason(new Date(2026, 7, 23)), false);
  assert.equal(isLeoSeason(now), false);
  assert.deepEqual(birthdayInfo('11-28', now), { today: true, daysLeft: 0 });
  assert.equal(birthdayInfo('08-05', now).daysLeft > 200, true);
  assert.equal(birthdayInfo('bukan', now), null);
});

test('kontak Jundy (data fiktif): nomor dan username dibersihkan, tautan atur sekali', async () => {
  const { cleanIg, igLink, cleanPhone, parseSetupHash } = await import('../src/scripts/iqlima.mjs');
  assert.equal(cleanIg('@contoh_pacar'), 'contoh_pacar');
  assert.equal(cleanIg('https://instagram.com/contoh_pacar/'), 'contoh_pacar');
  assert.equal(cleanIg('<script>'), '');
  assert.equal(igLink('contoh_pacar'), 'https://ig.me/m/contoh_pacar');
  assert.equal(cleanPhone('0812-0000-0000'), '6281200000000');
  assert.equal(cleanPhone('12'), '');
  assert.deepEqual(parseSetupHash('#atur?wa=6281200000000&ig=contoh_pacar'), { waPhone: '6281200000000', igUser: 'contoh_pacar' });
  assert.equal(parseSetupHash('#atur?wa=abc'), null);
  assert.equal(parseSetupHash('#lain'), null);
});
