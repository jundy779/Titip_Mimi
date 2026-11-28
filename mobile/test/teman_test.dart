import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:titip_mimi/entry.dart';
import 'package:titip_mimi/iqlima.dart';
import 'package:titip_mimi/main.dart';
import 'package:titip_mimi/teman.dart';

// Fitur yang dikejar dari web: tumpahkan pikiran, minta tolong, jaga diri,
// ulang tahun, akun, dan lampiran Telegram. Data uji fiktif.
void main() {
  Future<SharedPreferences> boot(WidgetTester tester, {List<Entry> entries = const [], Map<String, Object> extra = const {}}) async {
    SharedPreferences.setMockInitialValues({
      'entries': jsonEncode(entries.map((e) => e.toJson()).toList()),
      ...extra,
    });
    final prefs = await SharedPreferences.getInstance();
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(900, 3200);
    addTearDown(tester.view.reset);
    await tester.pumpWidget(ProviderScope(overrides: [prefsProvider.overrideWithValue(prefs)], child: const MimiApp()));
    await tester.pumpAndSettle();
    return prefs;
  }

  testWidgets('tumpahkan pikiran: dua baris jadi dua titipan, satu terjadwal', (tester) async {
    final prefs = await boot(tester);
    await tester.tap(find.text('Tumpahkan pikiran'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).last, 'bayar kos besok\nbeli kado ibu');
    await tester.pumpAndSettle();
    expect(find.text('Titip 2 titipan'), findsOneWidget);
    await tester.tap(find.text('Titip 2 titipan'));
    await tester.pumpAndSettle();
    final saved = Entries(prefs).current;
    expect(saved.map((e) => e.title), containsAll(['Bayar kos', 'Beli kado ibu']));
    expect(saved.firstWhere((e) => e.title == 'Bayar kos').kind, 'Agenda');
    expect(saved.firstWhere((e) => e.title == 'Beli kado ibu').kind, 'Catatan');
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('detail: tempat dengan peta, lampiran Telegram, dan minta tolong Jundy', (tester) async {
    final when = DateTime.now().add(const Duration(days: 2));
    await boot(tester, entries: [
      Entry(
        id: '1764316800000001', kind: 'Agenda', title: 'Resepsi Rina', body: 'bawa kado', time: DateTime(when.year, when.month, when.day, 10),
        attachments: const [{'kind': 'photo', 'id': 'AQADb2xy', 'mime': 'image/jpeg'}],
        extra: const {'place': 'Gedung Melati', 'source': 'telegram', 'repeat': 'weekly'},
      ),
    ], extra: {'jundy_wa': '6281234567890'});
    await tester.tap(find.byIcon(Icons.collections_bookmark_outlined).first);
    await tester.pumpAndSettle();
    expect(find.textContaining('📎 1 lampiran · dari Telegram'), findsOneWidget);
    await tester.tap(find.text('Resepsi Rina'));
    await tester.pumpAndSettle();
    expect(find.text('📍 Gedung Melati'), findsOneWidget);
    expect(find.text('Buka peta'), findsOneWidget);
    expect(find.text('Sambungkan akun di Profil untuk melihat lampiran.'), findsOneWidget);
    await tester.tap(find.text('Minta tolong Jundy'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Jundy, aku minta tolong ya: Resepsi Rina'), findsOneWidget);
    expect(find.text('Kirim lewat WhatsApp'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('Profil: akun, jaga diri, ulang tahun, dan kontak Jundy', (tester) async {
    final prefs = await boot(tester);
    await tester.tap(find.byIcon(Icons.person_outline).first);
    await tester.pumpAndSettle();
    expect(find.text('Akun Titip Mimi'), findsOneWidget);
    expect(find.text('Sambungkan'), findsOneWidget);
    expect(find.text('Jaga diri'), findsOneWidget);
    await tester.tap(find.text('Minum air'));
    await tester.pumpAndSettle();
    expect(readCareSettings(prefs.getString(careSettingsKey))['water'], isFalse);
    expect(find.text('Ulang tahunmu'), findsOneWidget);
    await tester.enterText(find.widgetWithText(TextField, 'Nomor WhatsApp Jundy'), '0812-3456-7890');
    await tester.tap(find.text('Simpan kontak'));
    await tester.pumpAndSettle();
    expect(prefs.getString(jundyWaKey), '6281234567890');
    // Alamat server tanpa https ditolak sebelum menghubungi apa pun.
    await tester.enterText(find.widgetWithText(TextField, 'Alamat server'), 'http://mimi.contoh.id');
    await tester.enterText(find.widgetWithText(TextField, 'Kode dari web'), 'ABCD2345');
    await tester.tap(find.text('Sambungkan'));
    await tester.pumpAndSettle();
    expect(find.text('Alamat server harus diawali https://'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('Hari Ini: lencana ulang tahun dan kartu jaga diri bisa ditutup', (tester) async {
    final now = DateTime.now();
    final mmdd = '${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    await boot(tester, extra: {birthdayKey: mmdd});
    expect(find.textContaining('Selamat ulang tahun, Iqlima'), findsOneWidget);
    // Kartu jaga diri bergantung jam; diuji langsung dengan jam tetap.
    final prefs = await SharedPreferences.getInstance();
    var changed = 0;
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: CareBanner(prefs: prefs, now: DateTime(2026, 11, 28, 9, 10), changed: () => changed++))));
    expect(find.text('Minum air'), findsOneWidget);
    await tester.tap(find.text('Udah ♡'));
    await tester.pumpAndSettle();
    expect(changed, 1);
    expect(jsonDecode(prefs.getString(careShownKey)!)['water-09:00'], '2026-11-28');
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: CareBanner(prefs: prefs, now: DateTime(2026, 11, 28, 9, 20), changed: () {}))));
    expect(find.text('Minum air'), findsNothing);
    await tester.pumpWidget(const SizedBox());
  });
}
