import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class DailyList extends StatefulWidget {
  const DailyList({super.key, required this.prefs});
  final SharedPreferences prefs;

  @override
  State<DailyList> createState() => _DailyListState();
}

class _DailyListState extends State<DailyList> {
  static const groups = ['Tugasku', 'Target', 'Rawat diri'];
  final fields = {for (final key in [...groups, 'Catatan', 'Pengingat']) key: TextEditingController()};
  DateTime day = DateUtils.dateOnly(DateTime.now());
  Map<String, dynamic> data = {};
  String get key => 'mimi-daily-list:${day.toIso8601String().split('T').first}';
  Future<void> writes = Future.value();
  String message = '';

  @override
  void initState() {
    super.initState();
    load();
  }

  void load() {
    data = jsonDecode(widget.prefs.getString(key) ?? '{}') as Map<String, dynamic>;
    for (final field in fields.entries) {
      field.value.text = data[field.key] is String ? data[field.key] as String : '';
    }
    message = '';
  }

  void save() {
    final recordKey = key;
    final snapshot = jsonEncode(data);
    writes = writes.then((_) async {
      try {
        if (!await widget.prefs.setString(recordKey, snapshot)) throw StateError('save');
        if (mounted && key == recordKey && message.isNotEmpty) setState(() => message = '');
      } catch (_) {
        if (mounted && key == recordKey) setState(() => message = 'Belum tersimpan. Coba lagi, ya.');
      }
    });
  }

  Future<void> chooseDay() async {
    final picked = await showDatePicker(context: context, initialDate: day,
        firstDate: DateTime(1900), lastDate: DateTime(2200));
    await writes;
    if (mounted && picked != null && picked != day && message.isEmpty) {
      setState(() { day = picked; load(); });
    }
  }

  void add(String group) {
    final title = fields[group]!.text.trim();
    if (title.isEmpty) return;
    setState(() {
      (data[group] ??= []).add({'title': title, 'done': false});
      fields[group]!.clear();
    });
    save();
  }

  @override
  void dispose() {
    for (final field in fields.values) { field.dispose(); }
    super.dispose();
  }

  List<Widget> groupFields(String group) => [
        for (final row in data[group] ?? [])
          CheckboxListTile(contentPadding: EdgeInsets.zero, controlAffinity: ListTileControlAffinity.leading,
            title: Text(row['title'] as String), value: row['done'] == true,
            onChanged: (checked) { setState(() => row['done'] = checked == true); save(); }),
        Row(children: [
          Expanded(child: TextField(controller: fields[group], maxLength: 240,
            decoration: InputDecoration(labelText: 'Tambah ke $group', counterText: ''),
            onSubmitted: (_) => add(group))),
          IconButton(tooltip: 'Tambah ke $group', onPressed: () => add(group), icon: const Icon(Icons.add)),
        ]),
        const SizedBox(height: 12),
  ];

  @override
  Widget build(BuildContext context) => Card(child: Padding(
    padding: const EdgeInsets.all(16),
    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text('To-Do List', style: Theme.of(context).textTheme.titleLarge),
      Wrap(spacing: 12, crossAxisAlignment: WrapCrossAlignment.center, children: [
        TextButton.icon(onPressed: chooseDay, icon: const Icon(Icons.calendar_month_outlined),
          label: Text(MaterialLocalizations.of(context).formatCompactDate(day))),
        DropdownButton<String>(
          hint: const Text('Prioritas'), value: data['priority'] as String?,
          items: ['Santai', 'Penting', 'Utama'].map((p) => DropdownMenuItem(value:p, child:Text(p))).toList(),
          onChanged: (value) { setState(() => data['priority'] = value); save(); }),
      ]),
      Text('Tugasku', style: Theme.of(context).textTheme.titleMedium),
      ...groupFields('Tugasku'),
      for (final group in groups.skip(1))
        ExpansionTile(title: Text(group), tilePadding: EdgeInsets.zero,
          children: groupFields(group)),
      for (final name in ['Catatan','Pengingat']) ExpansionTile(
        tilePadding: EdgeInsets.zero, title: Text(name), children: [Padding(
        padding: const EdgeInsets.only(top: 8),
        child: TextField(controller: fields[name], minLines: 1, maxLines: 3, maxLength: 2000,
          decoration: InputDecoration(labelText: name, counterText: ''),
          onChanged: (value) { data[name] = value; save(); }))]),
      if (message.isNotEmpty) TextButton(onPressed: save, child: Text(message)),
    ]),
  ));
}
