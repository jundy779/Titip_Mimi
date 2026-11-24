import 'package:flutter_test/flutter_test.dart';
import 'package:titip_mimi/entry.dart';
import 'package:titip_mimi/reminders.dart';

void main() {
  test('hanya waktu aktif dan ID yang dikirim ke sistem, terurut', () {
    final now = DateTime(2026, 11, 24, 12);
    final soon = now.add(const Duration(minutes: 5));
    final later = now.add(const Duration(minutes: 10));
    Entry item(String id, {DateTime? time, DateTime? snooze, bool done = false}) =>
        Entry(id: id, title: 'Judul pribadi', kind: 'Agenda',
            time: time, snooze: snooze, done: done);

    expect(pendingReminders([
      item('ditunda', time: now, snooze: later),
      item('selesai', time: soon, done: true),
      item('belum ada waktu'),
      item('lewat', time: now),
      item('baru', time: soon),
    ], now), [
      {'id': 'baru', 'at': soon.millisecondsSinceEpoch},
      {'id': 'ditunda', 'at': later.millisecondsSinceEpoch},
    ]);
  });
}
