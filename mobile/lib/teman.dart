// Teman harian Iqlima di HP, sama dengan web: Tumpahkan pikiran, Minta tolong Jundy,
// Jaga diri, ulang tahun, Kamar Mimi, akun Mimi, dan lampiran dari Telegram.
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import 'entry.dart';
import 'iqlima.dart';
import 'server.dart';

const careShownKey = 'care_shown';
const birthdayKey = 'birthday';
const jundyWaKey = 'jundy_wa';
const jundyIgKey = 'jundy_ig';

void _say(BuildContext context, String text) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
}

/// Buka tautan di aplikasi lain (WhatsApp, Instagram, browser, telepon).
Future<void> openLink(BuildContext context, String url) async {
  var ok = false;
  try {
    ok = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  } on PlatformException {
    ok = false;
  }
  if (!ok && context.mounted) _say(context, 'Belum bisa dibuka di HP ini.');
}

// ---------- Tumpahkan pikiran ----------
class DumpSheet extends StatefulWidget {
  const DumpSheet({super.key, required this.save});
  final Future<void> Function(List<Entry>) save;
  @override
  State<DumpSheet> createState() => _DumpSheetState();
}

class _DumpSheetState extends State<DumpSheet> {
  final text = TextEditingController();
  final skip = <int>{};
  bool saving = false;
  @override
  void dispose() { text.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final rows = parseDump(text.text, now);
    final chosen = [for (var i = 0; i < rows.length; i++) if (!skip.contains(i)) rows[i]];
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 8, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Tumpahkan pikiran', style: Theme.of(context).textTheme.titleLarge),
        const Text('Tulis semua yang lagi kepikiran, satu baris satu hal. Mimi yang rapikan jadi titipan.'),
        const SizedBox(height: 12),
        TextField(
          controller: text,
          autofocus: true,
          minLines: 3,
          maxLines: 8,
          decoration: const InputDecoration(hintText: 'bayar kos besok\njemput adik jam 4 sore\nbeli kado ibu tgl 5'),
          onChanged: (_) => setState(skip.clear),
        ),
        if (rows.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text('Mimi pecah jadi ${rows.length} titipan. Ketuk untuk melewatkan yang nggak perlu.'),
          ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 260),
            child: ListView(shrinkWrap: true, children: [
              for (var i = 0; i < rows.length; i++)
                CheckboxListTile(
                  value: !skip.contains(i),
                  onChanged: (on) => setState(() => on == true ? skip.remove(i) : skip.add(i)),
                  title: Text(rows[i].title),
                  subtitle: Text(rows[i].time.isEmpty ? '📝 Catatan' : '🗓 ${longWhen(parseLocalTime(rows[i].time)!)}'),
                ),
            ]),
          ),
        ],
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerRight,
          child: FilledButton(
            onPressed: chosen.isEmpty || saving ? null : () async {
              setState(() => saving = true);
              final base = DateTime.now().microsecondsSinceEpoch;
              final entries = [
                for (var i = 0; i < chosen.length; i++)
                  Entry(
                    id: '${base + i}',
                    kind: chosen[i].kind == 'agenda' ? 'Agenda' : 'Catatan',
                    title: chosen[i].title,
                    time: parseLocalTime(chosen[i].time),
                  ),
              ];
              try {
                await widget.save(entries);
                if (context.mounted) Navigator.pop(context);
              } catch (_) {
                if (mounted) setState(() => saving = false);
                if (context.mounted) _say(context, 'Belum tersimpan. Coba lagi, ya.');
              }
            },
            child: Text('Titip ${chosen.length} titipan'),
          ),
        ),
      ]),
    );
  }
}

// ---------- Minta tolong Jundy ----------
class HelpSheet extends StatelessWidget {
  const HelpSheet({super.key, required this.entry, required this.prefs, required this.asked});
  final Entry entry;
  final SharedPreferences prefs;
  final Future<void> Function() asked;
  @override
  Widget build(BuildContext context) {
    final message = helpMessage(title: entry.title, time: entry.time == null ? '' : stampOf(entry.time!), note: entry.body);
    final wa = prefs.getString(jundyWaKey) ?? '', ig = prefs.getString(jundyIgKey) ?? '';
    Future<void> send(String url, {bool copy = false}) async {
      if (copy) await Clipboard.setData(ClipboardData(text: message));
      await asked();
      if (!context.mounted) return;
      await openLink(context, url);
      if (context.mounted) Navigator.pop(context);
    }
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Minta tolong Jundy', style: Theme.of(context).textTheme.titleLarge),
        const Text('Kamu nggak harus nanggung semuanya sendirian ♡'),
        const SizedBox(height: 12),
        Card(child: Padding(padding: const EdgeInsets.all(12), child: SelectableText(message))),
        Wrap(spacing: 8, runSpacing: 8, children: [
          FilledButton(onPressed: () => send(waLink(wa, message)), child: const Text('Kirim lewat WhatsApp')),
          if (igLink(ig).isNotEmpty)
            OutlinedButton(onPressed: () => send(igLink(ig), copy: true), child: const Text('Salin lalu buka Instagram')),
        ]),
        if (cleanPhone(wa).isEmpty)
          const Padding(
            padding: EdgeInsets.only(top: 8),
            child: Text('Nomor Jundy belum diisi, jadi WhatsApp akan minta pilih kontak. Isi di Profil supaya langsung ke Jundy.'),
          ),
      ]),
    );
  }
}

// ---------- Jaga diri ----------
Map<String, String> _shown(SharedPreferences p) {
  try { return Map<String, String>.from(jsonDecode(p.getString(careShownKey) ?? '{}') as Map); } on Object { return {}; }
}

class CareBanner extends StatelessWidget {
  const CareBanner({super.key, required this.prefs, required this.now, required this.changed});
  final SharedPreferences prefs;
  final DateTime now;
  final VoidCallback changed;
  @override
  Widget build(BuildContext context) {
    final shown = _shown(prefs);
    final due = dueCare(readCareSettings(prefs.getString(careSettingsKey)), now, shown);
    if (due == null) return const SizedBox.shrink();
    Future<void> close() async {
      await prefs.setString(careShownKey, jsonEncode({...shown, due.id: dayKeyOf(now)}));
      changed();
    }
    final pose = due.kind == 'sleep' ? 'sleep' : due.kind == 'rest' ? 'peek' : 'welcome';
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Image.asset('assets/mimi/v1/$pose.webp', width: 48, height: 48, excludeFromSemantics: true),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(due.label, style: Theme.of(context).textTheme.titleMedium),
                Text(due.text),
              ]),
            ),
          ]),
          Align(
            alignment: Alignment.centerRight,
            child: Wrap(spacing: 8, children: [
              TextButton(onPressed: close, child: const Text('Nanti')),
              FilledButton(onPressed: close, child: const Text('Udah ♡')),
            ]),
          ),
        ]),
      ),
    );
  }
}

class CareSettings extends StatefulWidget {
  const CareSettings({super.key, required this.prefs, required this.changed});
  final SharedPreferences prefs;
  final VoidCallback changed;
  @override
  State<CareSettings> createState() => _CareSettingsState();
}

class _CareSettingsState extends State<CareSettings> {
  @override
  Widget build(BuildContext context) {
    final care = readCareSettings(widget.prefs.getString(careSettingsKey));
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Jaga diri', style: Theme.of(context).textTheme.titleMedium),
      const Text('Mimi ingetin minum, makan, istirahat, dan tidur. Kalau pengingat HP aktif, tetap muncul walau aplikasi ditutup.'),
      for (final kind in careKinds.keys)
        SwitchListTile(
          title: Text(careKinds[kind]!.label),
          subtitle: Text(careKinds[kind]!.slots.map((s) => s.replaceAll(':', '.')).join(', ')),
          value: care[kind] == true,
          onChanged: (on) async {
            await widget.prefs.setString(careSettingsKey, jsonEncode({...care, kind: on}));
            if (mounted) setState(() {});
            widget.changed();
          },
        ),
    ]);
  }
}

// ---------- Ulang tahun dan kontak Jundy ----------
class PersonalSettings extends StatefulWidget {
  const PersonalSettings({super.key, required this.prefs});
  final SharedPreferences prefs;
  @override
  State<PersonalSettings> createState() => _PersonalSettingsState();
}

class _PersonalSettingsState extends State<PersonalSettings> {
  late final wa = TextEditingController(text: widget.prefs.getString(jundyWaKey));
  late final ig = TextEditingController(text: widget.prefs.getString(jundyIgKey));
  @override
  void dispose() { wa.dispose(); ig.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final bday = widget.prefs.getString(birthdayKey);
    final parsed = bday == null ? null : RegExp(r'^(\d{2})-(\d{2})$').firstMatch(bday);
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      ListTile(
        contentPadding: EdgeInsets.zero,
        title: const Text('Ulang tahunmu'),
        subtitle: Text(parsed == null ? 'Belum diisi. Mimi mau ikut merayakan ♡' : '${int.parse(parsed.group(2)!)} ${months[int.parse(parsed.group(1)!) - 1]}'),
        trailing: TextButton(
          onPressed: () async {
            final now = DateTime.now();
            final picked = await showDatePicker(context: context, initialDate: DateTime(2000, now.month, now.day), firstDate: DateTime(2000), lastDate: DateTime(2000, 12, 31), helpText: 'Tanggal ulang tahun');
            if (picked == null) return;
            final mmdd = '${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
            await widget.prefs.setString(birthdayKey, mmdd);
            if (mounted) setState(() {});
          },
          child: const Text('Pilih'),
        ),
      ),
      Text('Kontak Jundy', style: Theme.of(context).textTheme.titleMedium),
      const Text('Hanya tersimpan di HP ini, dipakai tombol Minta tolong Jundy.'),
      const SizedBox(height: 8),
      TextField(controller: wa, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Nomor WhatsApp Jundy', hintText: '08…')),
      const SizedBox(height: 8),
      TextField(controller: ig, decoration: const InputDecoration(labelText: 'Username Instagram Jundy', hintText: '@…')),
      Align(
        alignment: Alignment.centerRight,
        child: TextButton(
          onPressed: () async {
            final phone = cleanPhone(wa.text), user = cleanIg(ig.text);
            if (wa.text.trim().isNotEmpty && phone.isEmpty) { _say(context, 'Nomornya belum dikenali. Coba tulis lengkap, misal 0812…'); return; }
            await widget.prefs.setString(jundyWaKey, phone);
            await widget.prefs.setString(jundyIgKey, user);
            if (context.mounted) _say(context, 'Kontak Jundy tersimpan di HP ini ♡');
          },
          child: const Text('Simpan kontak'),
        ),
      ),
    ]);
  }
}

// ---------- Akun Mimi (sinkron dengan web) ----------
class AccountCard extends StatefulWidget {
  const AccountCard({super.key, required this.sync, required this.localCount});
  final MimiSync sync;
  final int localCount;
  @override
  State<AccountCard> createState() => _AccountCardState();
}

class _AccountCardState extends State<AccountCard> {
  late final server = TextEditingController(text: widget.sync.server);
  final code = TextEditingController();
  bool busy = false;
  String note = '';
  @override
  void dispose() { server.dispose(); code.dispose(); super.dispose(); }

  Future<void> run(Future<void> Function() work) async {
    setState(() { busy = true; note = ''; });
    try { await work(); } on ApiError catch (e) { note = e.message; }
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.sync,
    builder: (context, _) {
      final s = widget.sync;
      final when = s.lastSync == 0 ? '' : TimeOfDay.fromDateTime(DateTime.fromMillisecondsSinceEpoch(s.lastSync)).format(context);
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Akun Titip Mimi', style: Theme.of(context).textTheme.titleMedium),
        if (!s.signedIn) ...[
          const Text('Sambungkan supaya titipan sama dengan web, foto nota dari Telegram ikut muncul, dan pengingat sampai di semua perangkat.'),
          const Text('Di web: Profil > Sambungkan aplikasi HP. Salin alamat server dan kodenya ke sini.'),
          const SizedBox(height: 8),
          TextField(controller: server, keyboardType: TextInputType.url, decoration: const InputDecoration(labelText: 'Alamat server', hintText: 'https://…')),
          const SizedBox(height: 8),
          TextField(controller: code, textCapitalization: TextCapitalization.characters, decoration: const InputDecoration(labelText: 'Kode dari web', hintText: 'ABCD-2345')),
          Align(
            alignment: Alignment.centerRight,
            child: FilledButton(
              onPressed: busy ? null : () => run(() async {
                await s.connect(server.text, code.text);
                code.clear();
                note = 'Tersambung ♡';
              }),
              child: const Text('Sambungkan'),
            ),
          ),
        ] else ...[
          Text('Masuk sebagai ${s.user?['email'] ?? ''}.${when.isEmpty ? '' : ' Tersinkron $when.'}'),
          if (!s.migrated) ...[
            Text('Pindahkan ${widget.localCount} titipan dari HP ini ke akunmu? Titipan di HP tetap ada.'),
            FilledButton(onPressed: busy ? null : () => run(s.migrate), child: const Text('Pindahkan titipan')),
          ],
          Wrap(spacing: 8, children: [
            if (s.migrated) TextButton(onPressed: busy ? null : () => run(s.sync), child: const Text('Sinkron sekarang')),
            TextButton(onPressed: busy ? null : () => run(s.logout), child: const Text('Keluar')),
          ]),
        ],
        if (s.status.isNotEmpty || note.isNotEmpty) Text(s.status.isNotEmpty ? s.status : note),
      ]);
    },
  );
}

// ---------- Lampiran dari Telegram ----------
class AttachmentList extends StatelessWidget {
  const AttachmentList({super.key, required this.entry, required this.sync});
  final Entry entry;
  final MimiSync sync;
  @override
  Widget build(BuildContext context) {
    if (entry.attachments.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('📎 ${entry.attachments.length} lampiran${entry.fromTelegram ? ' · dari Telegram' : ''}'),
      for (final a in entry.attachments)
        if (a['kind'] == 'photo' && sync.signedIn && a['id'] is String)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.network(
                sync.mediaUrl(a['id'] as String).toString(),
                headers: sync.authHeaders,
                fit: BoxFit.contain,
                semanticLabel: 'Foto lampiran ${entry.title}',
                errorBuilder: (_, __, ___) => const Text('Fotonya belum bisa dimuat. Cek internet, atau buka dari Telegram.'),
              ),
            ),
          )
        else
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(a['kind'] == 'video' ? Icons.movie_outlined : a['kind'] == 'photo' ? Icons.photo_outlined : Icons.description_outlined),
            title: Text('${a['name'] ?? (a['kind'] == 'video' ? 'Video' : a['kind'] == 'photo' ? 'Foto' : 'Dokumen')}'),
            subtitle: Text(sync.signedIn ? 'Buka dari Telegram atau web.' : 'Sambungkan akun di Profil untuk melihat lampiran.'),
          ),
    ]);
  }
}

/// Kamar Mimi (3D) dibuka dari web yang sama dengan server.
Future<void> openKamar(BuildContext context, MimiSync sync) async {
  if (sync.server.isEmpty) {
    _say(context, 'Kamar Mimi ada di web. Sambungkan akun di Profil dulu supaya alamatnya diketahui.');
    return;
  }
  await openLink(context, sync.webUrl('kamar-mimi.html').toString());
}

/// Kalimat mengkhawatirkan di catatan: tawarkan bantuan, tanpa menghakimi.
Future<void> showSupport(BuildContext context) => showDialog<void>(
  context: context,
  builder: (dialog) => AlertDialog(
    title: const Text('Mimi di sini ♡'),
    content: const Text(supportText),
    actions: [
      TextButton(onPressed: () => openLink(context, supportPhone), child: const Text('Telepon 119')),
      TextButton(onPressed: () => openLink(context, supportChat), child: const Text('Chat Healing119')),
      FilledButton(onPressed: () => Navigator.pop(dialog), child: const Text('Tutup')),
    ],
  ),
);
