import 'package:flutter_test/flutter_test.dart';
import 'package:titip_mimi/mimi_manja.dart';

void main() {
  DateTime at(int hour, [int day = 28]) => DateTime(2026, 11, day, hour, 5);

  test('setiap jam punya sapaan untuk Iqlima', () {
    for (var h = 0; h < 24; h++) {
      final g = mimiGreeting(at(h));
      expect(g.title, contains('Iqlima'));
      expect(g.line, isNotEmpty);
    }
    expect(mimiMomentOf(at(7)).id, 'pagi');
    expect(mimiMomentOf(at(23)).pose, 'sleep');
  });

  test('kalimat sama dengan versi web untuk tanggal yang sama', () {
    // Nilai acuan dari tests/mimi-manja.test.mjs: 28 Nov 2026 jam 08.00.
    expect(mimiGreeting(at(8)).line, 'Sarapan dulu, ya. Titipanmu aman sama Mimi.');
  });

  test('kembali setelah dua hari disambut gembira', () {
    expect(mimiDaysAway('2026-11-25', at(10)), 3);
    expect(mimiGreeting(at(10), daysAway: 3).line, mimiWelcomeBack);
    expect(mimiDaysAway('rusak', at(10)), 0);
    expect(mimiDaysAway(null, at(10)), 0);
  });

  test('suara Mimi tidak menyalahkan', () {
    final all = [
      ...mimiLines.values.expand((l) => l),
      ...mimiReactions.values.expand((l) => l),
      mimiWelcomeBack,
    ].join(' ').toLowerCase();
    for (final word in ['kok lama', 'ke mana aja', 'kemana aja', 'ditinggal', 'kecewa']) {
      expect(all.contains(word), isFalse, reason: word);
    }
  });

  test('setiap reaksi punya pose', () {
    for (final kind in mimiReactions.keys) {
      expect(mimiReactionPoses[kind], isNotNull, reason: kind);
    }
    expect(mimiReaction('tidak-ada', at(9)).pose, 'saved');
  });
}
