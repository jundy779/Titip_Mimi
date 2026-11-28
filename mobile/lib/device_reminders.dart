import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'entry.dart';
import 'iqlima.dart';

const reminderChannel = MethodChannel('id.fusionify.titip_mimi/reminders');
const reminderPreference = 'device_reminders';
final reminderProblem = ValueNotifier<String?>(null);
Future<void> _pending = Future.value();

Future<void> syncDeviceReminders(SharedPreferences prefs, List<Entry> entries) {
  final operation = _pending.then((_) async {
    final enabled = prefs.getBool(reminderPreference) ?? false;
    final now = DateTime.now();
    // Agenda dan jaga diri (minum, makan, istirahat, tidur) dititipkan ke HP bersama,
    // diurutkan menurut waktu. iOS hanya menyimpan 64 notifikasi tertunda, jadi Mimi titip 60.
    final due = <String, DateTime>{
      if (enabled)
        for (final e in entries)
          if (!e.done && e.due?.isAfter(now) == true) e.id: e.due!,
      if (enabled) ...careSchedule(readCareSettings(prefs.getString(careSettingsKey)), now),
    };
    final soonest = due.entries.toList()..sort((a, b) => a.value.compareTo(b.value));
    await reminderChannel.invokeMethod<void>(enabled ? 'sync' : 'disable', {
      for (final e in soonest.take(60)) e.key: e.value.millisecondsSinceEpoch,
    });
    reminderProblem.value = null;
  });
  _pending = operation.catchError((Object _) {
    reminderProblem.value = 'Agenda tersimpan. Jadwal notifikasi belum diperbarui.';
  });
  return _pending;
}

class DeviceReminderSettings extends StatefulWidget {
  const DeviceReminderSettings({super.key, required this.prefs, required this.entries});
  final SharedPreferences prefs;
  final List<Entry> entries;
  @override
  State<DeviceReminderSettings> createState() => _DeviceReminderSettingsState();
}

class _DeviceReminderSettingsState extends State<DeviceReminderSettings> {
  String message = '';
  bool busy = false;
  Future<void> change({bool test = false}) async {
    setState(() => busy = true);
    try {
      final enabled = widget.prefs.getBool(reminderPreference) ?? false;
      if (test) {
        await reminderChannel.invokeMethod<void>('test');
        message = 'Kunci layar. Tes dijadwalkan sekitar satu menit lagi.';
      } else if (!enabled && await reminderChannel.invokeMethod<bool>('allow') != true) {
        message = 'Izin belum aktif. Cek pengaturan notifikasi Titip Mimi di HP.';
      } else {
        if (!await widget.prefs.setBool(reminderPreference, !enabled)) {
          throw StateError('Gagal menyimpan');
        }
        await syncDeviceReminders(widget.prefs, widget.entries);
        message = enabled ? 'Pengingat HP dimatikan.' : 'Pengingat HP diaktifkan.';
      }
    } catch (_) { message = 'Pengingat HP belum siap. Periksa izin notifikasi dan coba lagi.'; }
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.prefs.getBool(reminderPreference) ?? false;
    return Card(child: ExpansionTile(
      title: const Text('Atur pengingat'),
      childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      expandedCrossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Mimi menitipkan hingga 60 pengingat terdekat (agenda dan jaga diri) ke HP, jadi tetap muncul walau aplikasi ditutup.'),
        Wrap(spacing: 8, children: [
          TextButton(onPressed: busy ? null : () => change(),
            child: Text(enabled ? 'Matikan pengingat HP' : 'Aktifkan pengingat HP')),
          TextButton(onPressed: busy || !enabled ? null : () => change(test: true),
            child: const Text('Coba notifikasi')),
        ]),
        ValueListenableBuilder<String?>(valueListenable: reminderProblem,
          builder: (_, problem, child) => Text(problem ?? message)),
      ],
    ));
  }
}
