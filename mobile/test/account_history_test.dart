import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:titip_mimi/main.dart';

void main() {
  testWidgets('Kartu lama tetap ada sampai dua konfirmasi hapus disetujui', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({
      'entries': jsonEncode([
        {
          'id': '1',
          'kind': 'Akun',
          'title': 'Canva',
          'body': 'Kampus',
          'method': 'Google',
          'done': false,
        },
      ]),
    });
    final prefs = await SharedPreferences.getInstance();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [prefsProvider.overrideWithValue(prefs)],
        child: const MaterialApp(home: Room(index: 1)),
      ),
    );
    Future<void> tap(String text) async {
      await tester.tap(find.text(text).last);
      await tester.pumpAndSettle();
    }

    await tap('Canva');
    expect(find.text('Tanggal ditambahkan belum tercatat.'), findsOneWidget);
    await tap('Aku baru ganti sandi');
    await tap('Catat');
    expect(
      Entries(prefs).state.single.history.single['label'],
      'Ganti sandi dicatat',
    );
    await tap('Hapus kartu akun');
    await tap('Batal');
    await tap('Hapus kartu akun');
    await tap('Lanjutkan');
    await tap('Batal');
    expect(Entries(prefs).state.length, 1);
    await tap('Hapus kartu akun');
    await tap('Lanjutkan');
    await tap('Ya, hapus kartu');
    expect(Entries(prefs).state, isEmpty);
    await tester.pumpWidget(const SizedBox());
  });
}
