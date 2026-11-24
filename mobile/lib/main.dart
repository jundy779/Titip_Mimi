import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'entry.dart';
import 'daily_list.dart';
import 'editor.dart';
import 'journal.dart';

final prefsProvider = Provider<SharedPreferences>(
  (ref) => throw StateError('Penyimpanan belum siap'),
);
final themeProvider = StateProvider<ThemeMode>((ref) {
  final key = ref.watch(prefsProvider).getString('theme');
  return key == 'dark' ? ThemeMode.dark : ThemeMode.light;
});
final entriesProvider = StateNotifierProvider<Entries, List<Entry>>(
  (ref) => Entries(ref.watch(prefsProvider)),
);

class Entries extends StateNotifier<List<Entry>> {
  Entries(this.prefs)
    : super(
        (jsonDecode(prefs.getString('entries') ?? '[]') as List)
            .map((j) => Entry.fromJson(j))
            .toList(),
      );
  final SharedPreferences prefs;
  Future<void> _tail = Future.value();
  Future<void> put(Entry item) =>
      _write(() => [item, ...state.where((e) => e.id != item.id)]);
  Future<void> remove(String id) =>
      _write(() => state.where((e) => e.id != id).toList());
  Future<void> _write(List<Entry> Function() change) {
    final operation = _tail.then((_) async {
      final next = change();
      if (!await prefs.setString(
        'entries',
        jsonEncode(next.map((e) => e.toJson()).toList()),
      )) {
        throw StateError('Gagal menyimpan');
      }
      state = next;
    });
    _tail = operation.catchError((Object _) {});
    return operation;
  }
}

const pages = ['Hari Ini', 'Koleksi', 'Agenda', 'Profil'];
const paths = ['/', '/koleksi', '/agenda', '/profil'];
const icons = [
  Icons.wb_sunny_outlined,
  Icons.collections_bookmark_outlined,
  Icons.calendar_month_outlined,
  Icons.person_outline,
];
final router = GoRouter(
  routes: [
    for (var i = 0; i < paths.length; i++)
      GoRoute(
        path: paths[i],
        pageBuilder: (context, state) => CustomTransitionPage<void>(
          key: state.pageKey,
          transitionDuration: MediaQuery.disableAnimationsOf(context)
              ? Duration.zero
              : const Duration(milliseconds: 180),
          reverseTransitionDuration: Duration.zero,
          transitionsBuilder: (context, animation, secondary, child) =>
              FadeTransition(opacity: animation, child: child),
          child: Room(index: paths.indexOf(state.uri.path)),
        ),
      ),
  ],
);
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  runApp(
    ProviderScope(
      overrides: [prefsProvider.overrideWithValue(prefs)],
      child: const MimiApp(),
    ),
  );
}

class MimiApp extends ConsumerWidget {
  const MimiApp({super.key});
  ThemeData theme(Brightness b) {
    final dark = b == Brightness.dark;
    final colors =
        ColorScheme.fromSeed(
          seedColor: const Color(0xffaa3865),
          brightness: b,
        ).copyWith(
          primary: Color(dark ? 0xffffa9c8 : 0xffaa3865),
          surface: Color(dark ? 0xff221820 : 0xfffff4f7),
        );
    return ThemeData(
      useMaterial3: true,
      colorScheme: colors,
      scaffoldBackgroundColor: Color(dark ? 0xff221820 : 0xfffffbf5),
      cardTheme: CardThemeData(
        color: Color(dark ? 0xff30232c : 0xfffffbf5),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: colors.outlineVariant),
        ),
      ),
      inputDecorationTheme: const InputDecorationTheme(
        border: OutlineInputBorder(),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) => MaterialApp.router(
    title: 'Titip Mimi',
    debugShowCheckedModeBanner: false,
    locale: const Locale('id'),
    supportedLocales: const [Locale('id')],
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    theme: theme(Brightness.light),
    darkTheme: theme(Brightness.dark),
    themeMode: ref.watch(themeProvider),
    routerConfig: router,
  );
}

class Room extends ConsumerStatefulWidget {
  const Room({super.key, required this.index});
  final int index;
  @override
  ConsumerState<Room> createState() => _RoomState();
}

class _RoomState extends ConsumerState<Room> {
  Timer? timer;
  final searchField = TextEditingController();
  String query = '', filter = 'Semua';
  @override
  void initState() {
    super.initState();
    timer = Timer.periodic(const Duration(seconds: 5), (_) => setState(() {}));
  }

  @override
  void dispose() {
    searchField.dispose();
    timer?.cancel();
    super.dispose();
  }

  void edit([Entry? e, String? kind]) {
    Navigator.push(
      context,
      MaterialPageRoute<void>(
        builder: (_) => EntryEditor(
          entry: e,
          initialKind: kind ?? (widget.index == 2 ? 'Agenda' : 'Catatan'),
          save: ref.read(entriesProvider.notifier).put,
        ),
      ),
    );
  }

  Future<void> update(Entry e, {bool snooze = false}) async {
    final data = e.toJson();
    data['done'] = snooze ? false : !e.done;
    data['snooze'] = snooze
        ? DateTime.now().add(const Duration(minutes: 10)).toIso8601String()
        : null;
    try {
      await ref.read(entriesProvider.notifier).put(Entry.fromJson(data));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Perubahan belum tersimpan. Coba lagi, ya.'),
          ),
        );
      }
    }
  }

  Future<bool> confirmAccount(String title, String body, String action) async {
    return await showDialog<bool>(
          context: context,
          builder: (dialog) => AlertDialog(
            icon: JournalStyle.account.sticker(40),
            title: Text(title),
            content: Text(body),
            actions: [
              TextButton(
                autofocus: true,
                onPressed: () => Navigator.pop(dialog, false),
                child: const Text('Batal'),
              ),
              TextButton(
                onPressed: () => Navigator.pop(dialog, true),
                child: Text(action),
              ),
            ],
          ),
        ) ??
        false;
  }

  Future<void> accountAction(
    BuildContext sheet,
    Entry entry, {
    required bool remove,
  }) async {
    final identity = '${entry.title} · ${entry.body}';
    if (!await confirmAccount(
          remove ? 'Hapus kartu akun ini?' : 'Catat perubahan sandi?',
          identity,
          remove ? 'Lanjutkan' : 'Catat',
        ) ||
        !mounted ||
        !sheet.mounted) {
      return;
    }
    if (remove &&
        !await confirmAccount(
          'Yakin hapus dari Mimi?',
          '$identity. Kartu dan riwayatnya akan dihapus. Akun di layanan asal tetap aktif.',
          'Ya, hapus kartu',
        )) {
      return;
    }
    if (!mounted || !sheet.mounted) return;
    final store = ref.read(entriesProvider.notifier);
    final updated = remove ? null : entry.record('Ganti sandi dicatat');
    try {
      if (updated == null) {
        await store.remove(entry.id);
      } else {
        await store.put(updated);
      }
      if (!mounted || !sheet.mounted) return;
      Navigator.pop(sheet);
      if (updated != null) {
        detail(updated);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Kartu akun sudah dihapus dari Mimi.')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Perubahan belum tersimpan. Coba lagi, ya.'),
          ),
        );
      }
    }
  }

  void detail(Entry e) {
    showModalBottomSheet<void>(
      context: context,
      useSafeArea: true,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheet) => SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            JournalHeading(e.kind, JournalStyle.forKind(e.kind)),
            Text(e.title, style: Theme.of(context).textTheme.headlineSmall),
            SelectableText(e.body),
            if (e.kind == 'Akun') ...[
              Text('Cara masuk: ${e.method}'),
              Text(
                'Riwayat akun',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              if (!e.history.any(
                (event) => ['Ditambahkan', 'Diimpor'].contains(event['label']),
              ))
                const Text('Tanggal ditambahkan belum tercatat.'),
              for (final event in e.history.reversed)
                Text(
                  "${event['label']} · ${historyStamp(context, DateTime.parse(event['at']!).toLocal())}",
                ),
              Wrap(
                children: [
                  OutlinedButton(
                    onPressed: () => accountAction(sheet, e, remove: false),
                    child: const Text('Aku baru ganti sandi'),
                  ),
                  TextButton(
                    onPressed: () => accountAction(sheet, e, remove: true),
                    child: const Text('Hapus kartu akun'),
                  ),
                ],
              ),
            ],
            if (e.time != null) Text(stamp(context, e.time!)),
            Wrap(
              spacing: 8,
              children: [
                FilledButton.tonal(
                  onPressed: () {
                    Navigator.pop(sheet);
                    edit(e);
                  },
                  child: const Text('Ubah'),
                ),
                if (e.time != null)
                  TextButton(
                    onPressed: () {
                      Navigator.pop(sheet);
                      update(e);
                    },
                    child: Text(e.done ? 'Batalkan selesai' : 'Sudah selesai'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget row(Entry e) => Card(
    child: ListTile(
      leading: e.done
          ? const Icon(Icons.check_circle_outline)
          : JournalStyle.forKind(e.kind).sticker(44),
      title: Text(e.title),
      subtitle: Text(
        [
          e.kind,
          if (e.kind == 'Akun' || (widget.index == 1 && e.body.isNotEmpty))
            e.body,
          if (e.time != null) stamp(context, e.time!),
          if (e.done) 'Selesai',
        ].join(' · '),
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
      ),
      onTap: () => detail(e),
    ),
  );
  Iterable<Widget> agendaSections(Iterable<Entry> entries, DateTime now) sync* {
    final today = DateUtils.dateOnly(now);
    final tomorrow = DateTime(now.year, now.month, now.day + 1);
    final groups = {
      for (final name in [
        'Terlewat',
        'Hari ini',
        'Besok',
        'Berikutnya',
        'Selesai',
      ])
        name: <Entry>[],
    };
    for (final entry in entries) {
      final date = DateUtils.dateOnly(entry.time!);
      final name = entry.done
          ? 'Selesai'
          : date.isBefore(today)
          ? 'Terlewat'
          : date == today
          ? 'Hari ini'
          : date == tomorrow
          ? 'Besok'
          : 'Berikutnya';
      groups[name]!.add(entry);
    }
    for (final group in groups.entries) {
      if (group.value.isEmpty) continue;
      if (group.key == 'Selesai') {
        yield ExpansionTile(
          title: Text('Selesai (${group.value.length})'),
          children: group.value.map(row).toList(),
        );
      } else {
        yield Padding(
          padding: const EdgeInsets.fromLTRB(4, 16, 4, 8),
          child: Text(
            group.key,
            style: Theme.of(context).textTheme.titleMedium,
          ),
        );
        yield* group.value.map(row);
      }
    }
  }

  Widget profile() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const Text(
        'Titipanmu tersimpan di perangkat ini. Pengingat muncul saat aplikasi terbuka.',
      ),
      const SizedBox(height: 16),
      SwitchListTile(
        title: const Text('Mode gelap'),
        value: ref.watch(themeProvider) == ThemeMode.dark,
        onChanged: (enabled) async {
          final mode = enabled ? ThemeMode.dark : ThemeMode.light;
          if (await ref.read(prefsProvider).setString('theme', mode.name) &&
              mounted) {
            ref.read(themeProvider.notifier).state = mode;
          }
        },
      ),
      const ListTile(
        title: Text('Google Kalender'),
        subtitle: Text(
          'Belum terhubung. Impor dan kirim manual tersedia di web.',
        ),
      ),
      const ListTile(
        title: Text('Telegram'),
        subtitle: Text('Penautan akun belum tersedia.'),
      ),
    ],
  );
  @override
  Widget build(BuildContext context) {
    final entries = ref.watch(entriesProvider), now = DateTime.now();
    final due = entries.where((e) => e.isDue(now)).toList()
      ..sort((a, b) => a.due!.compareTo(b.due!));
    final agenda = entries.where((e) => e.time != null).toList()
      ..sort((a, b) => a.time!.compareTo(b.time!));
    final rows = switch (widget.index) {
      0 => agenda.where((e) => !e.done && DateUtils.isSameDay(e.time, now)),
      1 => entries.where(
        (e) =>
            (filter == 'Semua' || filter == e.kind) &&
            [
              e.title,
              e.body,
              e.method,
            ].join(' ').toLowerCase().contains(query.trim().toLowerCase()),
      ),
      _ => agenda,
    };
    final width = MediaQuery.sizeOf(context).width;
    final wide = width >= 720;
    return Scaffold(
      appBar: AppBar(title: const Text('Ruang Iqlima')),
      bottomNavigationBar: wide
          ? null
          : SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(8, 0, 8, 6),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(26),
                  child: NavigationBar(
                    selectedIndex: widget.index,
                    onDestinationSelected: (i) => context.go(paths[i]),
                    destinations: [
                      for (var i = 0; i < pages.length; i++)
                        NavigationDestination(
                          icon: Icon(icons[i]),
                          label: pages[i],
                        ),
                    ],
                  ),
                ),
              ),
            ),
      floatingActionButton: widget.index == 3
          ? null
          : FloatingActionButton.extended(
              onPressed: () => edit(),
              icon: const Icon(Icons.add),
              label: const Text('Titip sesuatu'),
            ),
      body: JournalPaper(
        child: SafeArea(
          child: Row(
            children: [
              if (wide)
                NavigationRail(
                  selectedIndex: widget.index,
                  extended: width >= 1100,
                  labelType: width >= 1100
                      ? NavigationRailLabelType.none
                      : NavigationRailLabelType.all,
                  onDestinationSelected: (i) => context.go(paths[i]),
                  destinations: [
                    for (var i = 0; i < pages.length; i++)
                      NavigationRailDestination(
                        icon: Icon(icons[i]),
                        label: Text(pages[i]),
                      ),
                  ],
                ),
              if (wide) const VerticalDivider(width: 1),
              Expanded(
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 800),
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(18, 8, 18, 100),
                      children: [
                        JournalHeading(
                          [
                            'Hai, Iqlima\u00a0♡',
                            'Koleksi',
                            'Agenda',
                            'Profil Iqlima',
                          ][widget.index],
                          [
                            JournalStyle.home,
                            JournalStyle.collection,
                            JournalStyle.agenda,
                            JournalStyle.profile,
                          ][widget.index],
                        ),
                        if (due.isNotEmpty)
                          Card(
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('Mimi mau ingetin ♡'),
                                  Text(
                                    due.first.title,
                                    style: Theme.of(
                                      context,
                                    ).textTheme.titleLarge,
                                  ),
                                  Wrap(
                                    spacing: 8,
                                    children: [
                                      TextButton(
                                        onPressed: () => detail(due.first),
                                        child: const Text('Lihat titipan'),
                                      ),
                                      OutlinedButton(
                                        onPressed: () =>
                                            update(due.first, snooze: true),
                                        child: const Text('Tunda 10 menit'),
                                      ),
                                      FilledButton(
                                        onPressed: () => update(due.first),
                                        child: const Text('Sudah selesai'),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ),
                        if (widget.index == 3)
                          Card(
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: profile(),
                            ),
                          )
                        else ...[
                          if (widget.index == 0) ...[
                            DailyList(prefs: ref.read(prefsProvider)),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                for (final (kind, label) in const [
                                  ('Catatan', 'Tulis catatan'),
                                  ('Agenda', 'Buat agenda'),
                                  ('Akun', 'Simpan akun'),
                                ])
                                  ActionChip(
                                    avatar: JournalStyle.forKind(
                                      kind,
                                    ).sticker(24),
                                    label: Text(label),
                                    backgroundColor: JournalStyle.forKind(
                                      kind,
                                    ).color(context),
                                    onPressed: () => edit(null, kind),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            const Text('Agenda hari ini'),
                          ],
                          if (widget.index == 1) ...[
                            TextField(
                              controller: searchField,
                              decoration: const InputDecoration(
                                labelText: 'Cari titipan',
                                hintText: 'Judul, catatan, atau akun',
                                prefixIcon: Icon(Icons.search),
                              ),
                              onChanged: (v) => setState(() => query = v),
                            ),
                            Wrap(
                              spacing: 6,
                              children: [
                                for (final k in [
                                  'Semua',
                                  'Catatan',
                                  'Akun',
                                  'Agenda',
                                ])
                                  ChoiceChip(
                                    label: Text(k),
                                    selected: filter == k,
                                    onSelected: (_) =>
                                        setState(() => filter = k),
                                  ),
                              ],
                            ),
                          ],
                          if (widget.index == 1)
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  '${rows.length} titipan',
                                  style: Theme.of(context).textTheme.labelLarge,
                                ),
                                if (query.isNotEmpty || filter != 'Semua')
                                  TextButton(
                                    onPressed: () {
                                      searchField.clear();
                                      setState(() {
                                        query = '';
                                        filter = 'Semua';
                                      });
                                    },
                                    child: const Text('Atur ulang'),
                                  ),
                              ],
                            ),
                          if (widget.index == 1 && rows.isEmpty)
                            Image.asset(
                              'assets/mimi/v1/search.webp',
                              height: 96,
                              excludeFromSemantics: true,
                            ),
                          if (rows.isEmpty)
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 24),
                              child: Text(
                                widget.index == 1
                                    ? entries.isEmpty
                                          ? 'Koleksimu masih kosong. Mau titip sesuatu?'
                                          : 'Belum ketemu. Coba kata lain atau pilih Semua.'
                                    : 'Belum ada agenda di sini ♡',
                              ),
                            ),
                          if (widget.index == 2)
                            ...agendaSections(rows, now)
                          else
                            ...rows.map(row),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
