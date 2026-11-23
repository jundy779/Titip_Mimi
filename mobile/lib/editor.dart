import 'journal.dart';
import 'package:flutter/material.dart';
import 'entry.dart';

class EntryEditor extends StatefulWidget {
  const EntryEditor({
    super.key,
    this.entry,
    required this.initialKind,
    required this.save,
  });
  final Entry? entry;
  final String initialKind;
  final Future<void> Function(Entry) save;
  @override
  State<EntryEditor> createState() => _EditorState();
}

class _EditorState extends State<EntryEditor> {
  final form = GlobalKey<FormState>();
  late final title = TextEditingController(text: widget.entry?.title);
  late final body = TextEditingController(text: widget.entry?.body);
  late String kind = widget.entry?.kind ?? widget.initialKind;
  late String method = widget.entry?.method ?? 'Google';
  late DateTime? time = widget.entry?.time;
  String? error;
  bool saving = false;
  @override
  void dispose() {
    title.dispose();
    body.dispose();
    super.dispose();
  }

  Future<void> selectTime([DateTime? shortcut]) async {
    final initial = time ?? DateTime.now();
    final date =
        shortcut ??
        await showDatePicker(
          context: context,
          initialDate: initial,
          firstDate: DateTime(2000),
          lastDate: DateTime(2150),
        );
    if (date == null || !mounted) return;
    final hour = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(initial),
    );
    if (hour != null && mounted) {
      setState(() {
        time = DateTime(
          date.year,
          date.month,
          date.day,
          hour.hour,
          hour.minute,
        );
        error = null;
      });
    }
  }

  Future<void> submit() async {
    if (!form.currentState!.validate()) return;
    if (kind == 'Agenda' && time == null) {
      setState(() => error = 'Pilih tanggal dan jam dulu, ya.');
      return;
    }
    setState(() {
      saving = true;
      error = null;
    });
    final old = widget.entry;
    try {
      var entry = Entry(
        id: old?.id ?? DateTime.now().microsecondsSinceEpoch.toString(),
        kind: kind,
        title: title.text.trim(),
        body: body.text.trim(),
        method: method,
        time: kind == 'Akun' ? null : time,
        snooze: old?.time == time ? old?.snooze : null,
        done: old?.done ?? false,
        history: old?.history ?? const [],
      );
      if (kind == 'Akun') {
        if (old == null) {
          entry = entry.record('Ditambahkan');
        } else if (old.title != entry.title ||
            old.body != entry.body ||
            old.method != entry.method) {
          entry = entry.record('Diedit');
        }
      }
      await widget.save(entry);
      if (mounted) {
        if (time != null && kind != 'Akun') {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Udah Mimi catat buat ${stamp(context, time!)} ♡'),
            ),
          );
        }
        Navigator.pop(context);
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          saving = false;
          error = 'Belum tersimpan. Coba lagi, ya.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(widget.entry == null ? 'Titip ke Mimi ♡' : 'Ubah titipan'),
    ),
    body: SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 600),
          child: Form(
            key: form,
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                JournalHeading(kind, JournalStyle.forKind(kind)),
                DropdownButtonFormField<String>(
                  initialValue: kind,
                  decoration: const InputDecoration(labelText: 'Jenis titipan'),
                  items: ['Catatan', 'Akun', 'Agenda']
                      .map((k) => DropdownMenuItem(value: k, child: Text(k)))
                      .toList(),
                  onChanged: widget.entry != null
                      ? null
                      : (k) => setState(() {
                          kind = k!;
                          error = null;
                          body.clear();
                        }),
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: title,
                  maxLength: 100,
                  decoration: InputDecoration(
                    labelText: kind == 'Akun'
                        ? 'Nama layanan'
                        : 'Judul titipan',
                  ),
                  validator: (v) =>
                      (v ?? '').trim().isEmpty ? 'Isi judul dulu, ya.' : null,
                ),
                TextFormField(
                  controller: body,
                  minLines: 1,
                  maxLines: kind == 'Akun' ? 1 : 5,
                  decoration: InputDecoration(
                    labelText: kind == 'Akun'
                        ? 'Email atau label akun'
                        : 'Catatan',
                  ),
                  validator: (v) => kind == 'Akun' && (v ?? '').trim().isEmpty
                      ? 'Isi email atau label akun.'
                      : null,
                ),
                if (kind == 'Akun') ...[
                  DropdownButtonFormField<String>(
                    initialValue: method,
                    decoration: const InputDecoration(labelText: 'Cara masuk'),
                    items:
                        [
                              'Google',
                              'Email dan kata sandi',
                              'Apple',
                              'Nomor HP',
                              'Lainnya',
                            ]
                            .map(
                              (m) => DropdownMenuItem(value: m, child: Text(m)),
                            )
                            .toList(),
                    onChanged: (m) => setState(() => method = m!),
                  ),
                  const Text(
                    'Simpan kata sandi dan PIN di pengelola kata sandimu.',
                  ),
                ] else ...[
                  Wrap(
                    spacing: 8,
                    children: [
                      for (final offset in [0, 1])
                        ActionChip(
                          label: Text(offset == 0 ? 'Hari ini' : 'Besok'),
                          onPressed: () {
                            final now = DateTime.now();
                            selectTime(
                              DateTime(now.year, now.month, now.day + offset),
                            );
                          },
                        ),
                    ],
                  ),
                  OutlinedButton.icon(
                    onPressed: () => selectTime(),
                    icon: const Icon(Icons.schedule),
                    label: Text(
                      time == null
                          ? 'Pilih tanggal dan jam'
                          : stamp(context, time!),
                    ),
                  ),
                  if (time != null && kind == 'Catatan')
                    TextButton(
                      onPressed: () => setState(() => time = null),
                      child: const Text('Lepas jadwal'),
                    ),
                ],
                if (error != null)
                  Text(
                    error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: saving ? null : submit,
                  child: const Text('Simpan titipan'),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

String stamp(BuildContext context, DateTime date) {
  final local = MaterialLocalizations.of(context);
  return '${local.formatMediumDate(date)} · ${local.formatTimeOfDay(TimeOfDay.fromDateTime(date), alwaysUse24HourFormat: true)}';
}

String historyStamp(BuildContext context, DateTime date) {
  final local = MaterialLocalizations.of(context);
  return '${local.formatFullDate(date)} · ${local.formatTimeOfDay(TimeOfDay.fromDateTime(date), alwaysUse24HourFormat: true)}';
}
