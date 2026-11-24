import 'package:flutter/services.dart';
import 'entry.dart';

const reminderChannel = MethodChannel('id.fusionify.titip_mimi/reminders');

List<Map<String, Object>> pendingReminders(List<Entry> entries, DateTime now) {
  final pending = entries.where((entry) =>
      !entry.done && entry.due?.isAfter(now) == true).toList()
    ..sort((a, b) => a.due!.compareTo(b.due!));
  return [
    for (final entry in pending)
      {'id': entry.id, 'at': entry.due!.millisecondsSinceEpoch},
  ];
}
