import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:titip_mimi/main.dart';
import 'package:titip_mimi/entry.dart';

void main() {
  testWidgets('Titip, temukan, dan buka catatan', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [prefsProvider.overrideWithValue(prefs)],
        child: const MimiApp(),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Titip sesuatu'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).first, 'Bawa buku');
    await tester.tap(find.text('Simpan titipan'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Koleksi'));
    await tester.pumpAndSettle();
    expect(find.text('Bawa buku'), findsOneWidget);
    await tester.tap(find.text('Bawa buku'));
    await tester.pumpAndSettle();
    expect(find.text('Ubah'), findsOneWidget);
    expect(Entries(prefs).state.single.title, 'Bawa buku');
    await tester.pumpWidget(const SizedBox());
  });
  test('Tunda tidak mengubah waktu agenda', () {
    final now = DateTime(2026, 11, 22, 16);
    final item = Entry(
      id: '1',
      kind: 'Agenda',
      title: 'Ambil nota',
      time: now,
      snooze: now.add(const Duration(minutes: 10)),
    );
    expect(item.isDue(now), false);
    expect(
      Entry.fromJson(item.toJson()).isDue(now.add(const Duration(minutes: 10))),
      true,
    );
    expect(item.time, now);
  });
}
