import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'entry.dart';
import 'editor.dart';

final prefsProvider = Provider<SharedPreferences>(
  (ref) => throw StateError('Penyimpanan belum siap'),
);
final themeProvider = StateProvider<ThemeMode>((ref) {
  final key = ref.watch(prefsProvider).getString('theme');
  return ThemeMode.values.firstWhere(
    (v) => v.name == key,
    orElse: () => ThemeMode.system,
  );
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
  Future<void> put(Entry item) {
    final operation = _tail.then((_) async {
      final next = [item, ...state.where((e) => e.id != item.id)];
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
  String query = '', filter = 'Semua';
  @override
  void initState() {
    super.initState();
    timer = Timer.periodic(const Duration(seconds: 5), (_) => setState(() {}));
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  void edit([Entry? e]) {
    Navigator.push(
      context,
      MaterialPageRoute<void>(
        builder: (_) => EntryEditor(
          entry: e,
          initialKind: widget.index == 2 ? 'Agenda' : 'Catatan',
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
            Text(e.kind),
            Text(e.title, style: Theme.of(context).textTheme.headlineSmall),
            SelectableText(e.body),
            if (e.kind == 'Akun') Text('Cara masuk: ${e.method}'),
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
      leading: Icon(
        e.done
            ? Icons.check_circle_outline
            : switch (e.kind) {
                'Agenda' => Icons.event_outlined,
                'Akun' => Icons.person_outline,
                _ => Icons.edit_note_outlined,
              },
      ),
      title: Text(e.title),
      subtitle: Text(
        [
          e.kind,
          if (e.kind == 'Akun') e.body,
          if (e.time != null) stamp(context, e.time!),
          if (e.done) 'Selesai',
        ].join(' · '),
      ),
      onTap: () => detail(e),
    ),
  );
  Widget profile() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const Text(
        'Titipanmu tersimpan di perangkat ini. Pengingat muncul saat aplikasi terbuka.',
      ),
      const SizedBox(height: 16),
      DropdownButtonFormField<ThemeMode>(
        initialValue: ref.watch(themeProvider),
        decoration: const InputDecoration(labelText: 'Tampilan Mimi'),
        items: const [
          DropdownMenuItem(
            value: ThemeMode.system,
            child: Text('Ikuti perangkat'),
          ),
          DropdownMenuItem(value: ThemeMode.light, child: Text('Terang')),
          DropdownMenuItem(value: ThemeMode.dark, child: Text('Gelap')),
        ],
        onChanged: (v) async {
          if (v != null &&
              await ref.read(prefsProvider).setString('theme', v.name) &&
              mounted) {
            ref.read(themeProvider.notifier).state = v;
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
            ].join(' ').toLowerCase().contains(query.toLowerCase()),
      ),
      _ => agenda,
    };
    final width = MediaQuery.sizeOf(context).width;
    final wide = width >= 720;
    return Scaffold(
      appBar: AppBar(title: Text(pages[widget.index])),
      bottomNavigationBar: wide
          ? null
          : NavigationBar(
              selectedIndex: widget.index,
              onDestinationSelected: (i) => context.go(paths[i]),
              destinations: [
                for (var i = 0; i < pages.length; i++)
                  NavigationDestination(icon: Icon(icons[i]), label: pages[i]),
              ],
            ),
      floatingActionButton: widget.index == 3
          ? null
          : FloatingActionButton.extended(
              onPressed: () => edit(),
              icon: const Icon(Icons.add),
              label: const Text('Titip sesuatu'),
            ),
      body: SafeArea(
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
                                  style: Theme.of(context).textTheme.titleLarge,
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
                        profile()
                      else ...[
                        if (widget.index == 0) ...[
                          Image.asset(
                            'assets/mimi/v1/planner.webp',
                            height: 164,
                            excludeFromSemantics: true,
                          ),
                          Text(
                            'Hai, Iqlima ♡',
                            style: Theme.of(context).textTheme.headlineMedium,
                          ),
                          const Text('Agenda hari ini'),
                        ],
                        if (widget.index == 1) ...[
                          TextField(
                            decoration: const InputDecoration(
                              labelText: 'Cari titipan',
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
                                  onSelected: (_) => setState(() => filter = k),
                                ),
                            ],
                          ),
                        ],
                        if (rows.isEmpty)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 24),
                            child: Text(
                              widget.index == 1
                                  ? 'Belum ada titipan yang cocok.'
                                  : 'Belum ada agenda di sini ♡',
                            ),
                          ),
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
    );
  }
}
