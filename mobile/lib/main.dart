import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'entry.dart';
import 'device_reminders.dart';
import 'daily_list.dart';
import 'editor.dart';
import 'journal.dart';
import 'mimi_manja.dart';

final prefsProvider = Provider<SharedPreferences>(
  (ref) => throw StateError('Penyimpanan belum siap'),
);
final themeProvider = StateProvider<ThemeMode>((ref) {
  final key = ref.watch(prefsProvider).getString('theme');
  return key == 'dark' ? ThemeMode.dark : ThemeMode.light;
});
final manjaProvider = StateProvider<bool>(
  (ref) => ref.watch(prefsProvider).getBool(manjaKey) ?? true,
);
// Dihitung sekali per peluncuran: berapa hari sejak kunjungan terakhir,
// lalu catat hari ini sebagai kunjungan terbaru.
final daysAwayProvider = Provider<int>((ref) {
  final prefs = ref.watch(prefsProvider);
  final now = DateTime.now();
  final away = mimiDaysAway(prefs.getString(manjaLastVisitKey), now);
  prefs.setString(manjaLastVisitKey, mimiDayKey(now));
  return away;
});
final entriesProvider = StateNotifierProvider<Entries, List<Entry>>(
  (ref) => Entries(ref.watch(prefsProvider)),
);

class Entries extends StateNotifier<List<Entry>> {
  Entries(this.prefs) : super(readStored(prefs));
  static List<Entry> readStored(SharedPreferences prefs) =>
    (jsonDecode(prefs.getString('entries') ?? '[]') as List)
      .map((j) => Entry.fromJson(j)).toList();
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
      if (prefs.getBool(reminderPreference) == true) await syncDeviceReminders(prefs, next);
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
          child: Room(index: paths.indexOf(state.uri.path),
              reminder: state.uri.queryParameters['reminder']),
        ),
      ),
  ],
);
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  Future<void> openPending() async {
    final id = await reminderChannel.invokeMethod<String>('take');
    if (id != null) router.go(Uri(path: '/agenda', queryParameters: {'reminder': id}).toString());
  }
  reminderChannel.setMethodCallHandler((call) async {
    if (call.method == 'available') await openPending();
  });
  WidgetsBinding.instance.addPostFrameCallback((_) async {
    try { await openPending(); } on Exception { /* Unsupported host. */ }
    if (prefs.getBool(reminderPreference) == true) {
      await syncDeviceReminders(prefs, Entries.readStored(prefs));
    }
  });
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
          seedColor: const Color(0xff96395f),
          brightness: b,
        ).copyWith(
          primary: Color(dark ? 0xffffa9c8 : 0xff96395f),
          surface: Color(dark ? 0xff302730 : 0xfffffcf8),
          onSurface: Color(dark ? 0xfffaecf2 : 0xff402e39),
          onSurfaceVariant: Color(dark ? 0xffd7c2ce : 0xff705965),
          outlineVariant: Color(dark ? 0xff574650 : 0xffe9d5da),
        );
    return ThemeData(
      useMaterial3: true,
      colorScheme: colors,
      scaffoldBackgroundColor: Color(dark ? 0xff241c23 : 0xfffbf3f4),
      cardTheme: CardThemeData(
        color: colors.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: colors.outlineVariant),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: colors.surface,
        indicatorColor: Color(dark ? 0xff593348 : 0xfff8dfe8),
        elevation: 0,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: colors.surface,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
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
  const Room({super.key, required this.index, this.reminder});
  final String? reminder;
  final int index;
  @override
  ConsumerState<Room> createState() => _RoomState();
}

class _RoomState extends ConsumerState<Room> {
  Timer? timer, bubbleTimer;
  MimiSaid? bubble;
  final searchField = TextEditingController();
  String query = '', filter = 'Semua';
  @override
  void initState() {
    super.initState();
    openReminder();
    timer = Timer.periodic(const Duration(seconds: 5), (_) => setState(() {}));
  }

  @override
  void didUpdateWidget(Room oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.reminder != oldWidget.reminder) openReminder();
  }

  void openReminder() {
    final id = widget.reminder;
    if (id == null) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final matches = ref.read(entriesProvider).where((e) => e.id == id);
      router.go('/agenda');
      if (matches.isNotEmpty) {
        detail(matches.first);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:
          Text(id == '__test__' ? 'Tes pengingat Mimi sampai ♡' : 'Agenda ini sudah tidak ada.')));
      }
    });
  }

  @override
  void dispose() {
    searchField.dispose();
    timer?.cancel();
    bubbleTimer?.cancel();
    super.dispose();
  }

  // Gelembung Mimi manja. Pemanis saja: kabar penting tetap lewat teks lain.
  void say(String kind, [int salt = 0]) {
    if (!mounted || !ref.read(manjaProvider)) return;
    bubbleTimer?.cancel();
    setState(() => bubble = mimiReaction(kind, DateTime.now(), salt));
    bubbleTimer = Timer(const Duration(milliseconds: 3600), () {
      if (mounted) setState(() => bubble = null);
    });
  }

  void cheer(Entry finished) {
    final now = DateTime.now();
    final today = ref
        .read(entriesProvider)
        .where((e) => e.time != null && DateUtils.isSameDay(e.time, now))
        .toList();
    final allDone = DateUtils.isSameDay(finished.time, now) &&
        today.length > 1 &&
        today.every((e) => e.done);
    say(allDone ? 'allDone' : 'done');
  }

  Future<void> pet() async {
    final prefs = ref.read(prefsProvider);
    final pets = (prefs.getInt(manjaPetsKey) ?? 0) + 1;
    await prefs.setInt(manjaPetsKey, pets);
    if (!mounted) return;
    if (ref.read(manjaProvider)) {
      say('pet', pets);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Mimi senang dielus.')),
      );
    }
  }

  void edit([Entry? e, String? kind]) {
    Navigator.push(
      context,
      MaterialPageRoute<void>(
        builder: (_) => EntryEditor(
          entry: e,
          initialKind: kind ?? (widget.index == 2 ? 'Agenda' : 'Catatan'),
          save: (entry) async {
            await ref.read(entriesProvider.notifier).put(entry);
            say(entry.kind == 'Akun'
                ? 'account'
                : entry.time != null
                ? 'agenda'
                : 'saved');
          },
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
      final next = Entry.fromJson(data);
      await ref.read(entriesProvider.notifier).put(next);
      if (snooze) {
        say('snooze');
      } else if (next.done) {
        cheer(next);
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
        say('password');
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
                if (e.isDue(DateTime.now()))
                  TextButton(onPressed: () {
                    Navigator.pop(sheet);
                    update(e, snooze: true);
                  }, child: const Text('Tunda 10 menit')),
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
      SwitchListTile(
        title: const Text('Mimi manja'),
        subtitle: const Text(
          'Mimi nyapa sesuai jam, ikut seneng, dan minta dielus. Kalau dimatikan, kabar simpan dan pengingat tetap ada.',
        ),
        value: ref.watch(manjaProvider),
        onChanged: (enabled) async {
          if (await ref.read(prefsProvider).setBool(manjaKey, enabled) &&
              mounted) {
            ref.read(manjaProvider.notifier).state = enabled;
            if (enabled) {
              say('pet');
            } else {
              bubbleTimer?.cancel();
              setState(() => bubble = null);
            }
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
    final hinge = verticalHinge(context);
    final wide = width >= 720 || hinge != null;
    Widget rail(bool extended) => NavigationRail(
          selectedIndex: widget.index,
          extended: extended,
          labelType: extended
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
        );
    final manja = ref.watch(manjaProvider);
    final hello = mimiGreeting(now, daysAway: ref.watch(daysAwayProvider));
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
      body: Stack(
        children: [
          Positioned.fill(child: JournalPaper(
        child: SafeArea(
          child: Row(
            children: [
              // Layar ganda (engsel di tengah): menu dan Mimi di layar kiri,
              // isi di layar kanan, tidak ada yang jatuh tepat di engsel.
              if (hinge != null) ...[
                SizedBox(
                  width: hinge.left - MediaQuery.paddingOf(context).left,
                  child: Column(
                    children: [
                      Expanded(child: rail(true)),
                      Padding(
                        padding: const EdgeInsets.all(24),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(28),
                          child: Image.asset(
                            'assets/mimi/v1/welcome.webp',
                            height: 180,
                            semanticLabel: 'Mimi melambai',
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                SizedBox(width: hinge.width),
              ] else if (wide) ...[
                rail(width >= 1100),
                const VerticalDivider(width: 1),
              ],
              Expanded(
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 800),
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(18, 8, 18, 100),
                      children: [
                        JournalHeading(
                          [
                            manja ? hello.title : 'Hai, Iqlima\u00a0♡',
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
                        if (widget.index == 0)
                          MimiHello(
                            line: manja ? hello.line : null,
                            pose: manja ? hello.pose : 'welcome',
                            onPet: pet,
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
                          if (widget.index == 2)
                            DeviceReminderSettings(prefs: ref.read(prefsProvider), entries: entries),
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
      )),
          if (bubble != null)
            Positioned(
              left: 16,
              right: 16,
              bottom: widget.index == 3 ? 16 : 88,
              child: IgnorePointer(child: MimiBubble(said: bubble!)),
            ),
        ],
      ),
    );
  }
}

class MimiHello extends StatelessWidget {
  const MimiHello({required this.line, required this.pose, required this.onPet, super.key});
  final String? line;
  final String pose;
  final VoidCallback onPet;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: Row(
      children: [
        Semantics(
          button: true,
          label: 'Elus Mimi',
          child: InkResponse(
            onTap: onPet,
            radius: 40,
            child: Padding(
              padding: const EdgeInsets.all(4),
              child: Image.asset(
                'assets/mimi/v1/$pose.webp',
                width: 64,
                height: 64,
                excludeFromSemantics: true,
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            line ?? 'Ketuk Mimi kalau mau elus.',
            style: Theme.of(context).textTheme.bodyLarge,
          ),
        ),
      ],
    ),
  );
}

class MimiBubble extends StatelessWidget {
  const MimiBubble({required this.said, super.key});
  final MimiSaid said;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Semantics(
      liveRegion: true,
      child: Material(
        color: colors.primaryContainer,
        elevation: 3,
        borderRadius: BorderRadius.circular(999),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(6, 6, 16, 6),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircleAvatar(
                radius: 24,
                backgroundColor: colors.surface,
                child: Image.asset(
                  'assets/mimi/v1/${said.pose}.webp',
                  width: 44,
                  height: 44,
                  excludeFromSemantics: true,
                ),
              ),
              const SizedBox(width: 10),
              Flexible(
                child: Text(
                  said.text,
                  style: TextStyle(
                    color: colors.onPrimaryContainer,
                    fontWeight: FontWeight.w600,
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

/// Engsel tegak yang benar-benar memisahkan dua layar (misalnya Surface Duo).
/// Lipatan mulus seperti Galaxy Z Fold atau iPhone Fold lebarnya nol, jadi
/// layarnya tetap dianggap satu dan tata letak biasa yang dipakai.
Rect? verticalHinge(BuildContext context) {
  final height = MediaQuery.sizeOf(context).height;
  for (final feature in MediaQuery.displayFeaturesOf(context)) {
    final b = feature.bounds;
    if (b.width > 0 && b.left > 0 && b.height >= height * .9) return b;
  }
  return null;
}
