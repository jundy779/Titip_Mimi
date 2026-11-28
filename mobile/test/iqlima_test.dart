import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:titip_mimi/iqlima.dart';

// Acuan dibuat dari versi web (tool/make_fixtures.mjs). Kalau tes ini gagal, web dan HP
// memberi hasil berbeda untuk masukan yang sama.
void main() {
  final cases = jsonDecode(File('test/fixtures/iqlima_cases.json').readAsStringSync()) as Map<String, dynamic>;
  DateTime at(String s) => parseLocalTime(s)!;

  test('tumpahkan pikiran: setiap baris jadi titipan yang sama dengan web', () {
    for (final c in cases['dumps'] as List) {
      final got = parseDump(c['text'] as String, at(cases['now'] as String)).map((r) => r.toJson()).toList();
      expect(got, c['rows'], reason: c['text'] as String);
    }
  });

  test('jaga diri: jendela 45 menit dan kalimat sama dengan web', () {
    for (final c in cases['care'] as List) {
      expect(dueCare(defaultCare, at(c['now'] as String))?.toJson(), c['due'], reason: c['now'] as String);
    }
    final shown = cases['careShown'] as Map<String, dynamic>;
    expect(dueCare(defaultCare, at(shown['now'] as String), Map<String, String>.from(shown['shown'] as Map))?.toJson(), shown['due']);
  });

  test('daftar jaga diri sama dengan web', () {
    final web = cases['careKinds'] as Map<String, dynamic>;
    expect(careKinds.keys.toList(), web.keys.toList());
    for (final k in careKinds.keys) {
      expect(careKinds[k]!.label, web[k]['label']);
      expect(careKinds[k]!.slots, web[k]['slots']);
      expect(careKinds[k]!.lines, web[k]['lines']);
    }
  });

  test('jadwal jaga diri untuk pengingat HP hanya yang akan datang dan sesuai pilihan', () {
    final s = careSchedule({'water': true, 'meal': false, 'rest': false, 'sleep': true}, at('2026-11-28T18:00'));
    expect(s.keys, containsAll(['care:water-19:00:2026-11-28', 'care:sleep-22:30:2026-11-28', 'care:water-09:00:2026-11-29']));
    expect(s.keys.where((k) => k.contains('meal')), isEmpty);
    expect(s.keys.where((k) => k.contains('water-17:00:2026-11-28')), isEmpty);
    expect(s['care:sleep-22:30:2026-11-29'], DateTime(2026, 11, 29, 22, 30));
  });

  test('ulang tahun dan musim Leo sama dengan web', () {
    for (final c in cases['birthdays'] as List) {
      final got = birthdayInfo(c['mmdd'] as String, at(c['now'] as String));
      final want = c['info'] as Map<String, dynamic>?;
      expect(got == null ? null : {'today': got.today, 'daysLeft': got.daysLeft}, want, reason: c['mmdd'] as String);
    }
    for (final c in cases['leo'] as List) {
      expect(isLeoSeason(at(c['now'] as String)), c['leo'], reason: c['now'] as String);
    }
    expect(celebrateLine('11-28', at('2026-11-28T10:00')), startsWith('🎂'));
    expect(celebrateLine('12-03', at('2026-11-28T10:00')), '🎀 5 hari lagi ulang tahunmu ♡');
    expect(celebrateLine('12-03', at('2026-08-01T10:00')), startsWith('♌'));
    expect(celebrateLine(null, at('2026-11-28T10:00')), '');
  });

  test('pesan minta tolong, WhatsApp, dan Instagram sama dengan web', () {
    for (final c in cases['help'] as List) {
      expect(helpMessage(title: c['title'] as String, time: c['time'] as String, note: c['note'] as String), c['text']);
    }
    for (final c in cases['phones'] as List) {
      expect(cleanPhone(c['v'] as String), c['clean'], reason: c['v'] as String);
      expect(waLink(c['v'] as String, 'halo ♡ & tolong'), c['wa'], reason: c['v'] as String);
    }
    for (final c in cases['igs'] as List) {
      expect(cleanIg(c['v'] as String), c['clean']);
      expect(igLink(c['v'] as String), c['link']);
    }
  });

  test('kalimat mengkhawatirkan dikenali sama seperti web', () {
    for (final c in cases['crisis'] as List) {
      expect(needsSupport(c['v'] as String), c['support'], reason: c['v'] as String);
    }
  });
}
