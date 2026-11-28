// Buat test/fixtures/iqlima_cases.json dari logika web (src/scripts/iqlima.mjs).
// Flutter (test/iqlima_test.dart) harus memberi hasil yang sama persis.
// Jalankan: node mobile/tool/make_fixtures.mjs   (tests/flutter-fixtures.test.mjs memastikan berkasnya tidak basi)
import { writeFileSync } from 'node:fs';
import * as web from '../../src/scripts/iqlima.mjs';

const at = s => { const [d, t] = s.split('T'); const [y, mo, da] = d.split('-').map(Number); const [h, mi] = t.split(':').map(Number); return new Date(y, mo - 1, da, h, mi); };
// Sabtu 28 November 2026 09.05, sama dengan uji web.
const now = '2026-11-28T09:05';
const dumps = [
  'bayar kos besok\njemput adik jam 4 sore\nbeli kado ibu tgl 5',
  '- jangan lupa telpon dokter senin jam 10 pagi',
  '1) rapat jumat 14:30; 2) setor tugas lusa',
  'kirim berkas 7 desember jam 8 malam',
  'makan siang jam 12 siang',
  'nonton bareng sabtu jam 7 malam',
  'arisan sabtu',
  'cuci baju nanti jam 9',
  'bayar listrik bulan depan',
  'beli obat tanggal 30',
  'servis motor minggu depan pukul 13.15',
  'jam 25 rusak',
  'a\n\n   \nhalo',
  'Bayar BPJS pada',
];
const cares = ['2026-11-28T09:00', '2026-11-28T09:44', '2026-11-28T09:45', '2026-11-28T12:40', '2026-11-28T22:30', '2026-11-28T07:29', '2026-11-29T10:31'];
const birthdays = [['08-15', '2026-11-28T10:00'], ['11-28', '2026-11-28T10:00'], ['12-03', '2026-11-28T10:00'], ['11-27', '2026-11-28T10:00'], ['02-29', '2026-03-01T10:00'], ['rusak', '2026-11-28T10:00']];
const out = {
  now,
  dumps: dumps.map(text => ({ text, rows: web.parseDump(text, at(now)).map(({ title, kind, time, source }) => ({ title, kind, time, source })) })),
  care: cares.map(t => ({ now: t, due: web.dueCare(web.defaultCare, at(t), {}) })),
  careShown: { now: '2026-11-28T09:10', shown: { 'water-09:00': '2026-11-28' }, due: web.dueCare(web.defaultCare, at('2026-11-28T09:10'), { 'water-09:00': '2026-11-28' }) },
  birthdays: birthdays.map(([mmdd, t]) => ({ mmdd, now: t, info: web.birthdayInfo(mmdd, at(t)) })),
  leo: ['2026-07-22T10:00', '2026-07-23T10:00', '2026-08-22T10:00', '2026-08-23T10:00'].map(t => ({ now: t, leo: web.isLeoSeason(at(t)) })),
  help: [
    { title: 'Ambil jahitan', time: '2026-12-01T16:00', note: 'bawa nota' },
    { title: 'Bayar kos', time: '', note: '' },
    { title: 'Jemput adik', time: '2026-12-06T09:05', note: '' },
  ].map(item => ({ ...item, text: web.helpMessage(item) })),
  phones: ['0812-3456-7890', '+62 812 3456 7890', '123', '62812345678901234'].map(v => ({ v, clean: web.cleanPhone(v), wa: web.waLink(v, 'halo ♡ & tolong') })),
  igs: ['@jundy.uji', 'https://www.instagram.com/jundy.uji/', 'nama dengan spasi', ''].map(v => ({ v, clean: web.cleanIg(v), link: web.igLink(v) })),
  crisis: ['aku capek banget', 'rasanya pengen mati aja', 'Self-harm lagi', 'mati lampu'].map(v => ({ v, support: web.needsSupport(v) })),
  careKinds: web.careKinds,
};
const path = new URL('../test/fixtures/iqlima_cases.json', import.meta.url);
const json = JSON.stringify(out, null, 1) + '\n';
if (process.argv.includes('--check')) process.stdout.write(json);
else { writeFileSync(path, json); console.log('ditulis', path.pathname); }
