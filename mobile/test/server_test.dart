import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:titip_mimi/entry.dart';
import 'package:titip_mimi/server.dart';

// Server palsu dengan aturan yang sama seperti server Mimi: last-write-wins per titipan,
// cursor naik setiap penulisan, dan token wajib. Dua akun fiktif.
class FakeServer {
  final items = <String, Map<String, Map<String, dynamic>>>{'iqlima': {}, 'lain': {}};
  final tokens = <String, String>{'tok-iqlima': 'iqlima', 'tok-lain': 'lain'};
  final codes = <String, String>{'ABCD2345': 'iqlima'};
  int seq = 0;
  int calls = 0;
  bool down = false;
  late final client = MockClient((req) async {
    calls++;
    if (down) throw http.ClientException('offline');
    final body = req.body.isEmpty ? <String, dynamic>{} : jsonDecode(req.body) as Map<String, dynamic>;
    if (req.url.path == '/v1/auth/device-code/redeem') {
      final owner = codes.remove((body['code'] as String).toUpperCase().replaceAll(RegExp('[^A-Z0-9]'), ''));
      if (owner == null) return http.Response(jsonEncode({'code': 'bad_code', 'message': 'Kodenya salah atau sudah kedaluwarsa.'}), 400);
      return http.Response(jsonEncode({'token': 'tok-$owner', 'user': {'id': owner, 'name': 'Uji', 'email': '$owner.uji@contoh.id'}}), 200);
    }
    final owner = tokens[(req.headers['Authorization'] ?? '').replaceFirst('Bearer ', '')];
    if (owner == null) return http.Response(jsonEncode({'code': 'session_expired', 'message': 'Sesi berakhir.'}), 401);
    if (req.url.path == '/v1/auth/logout') return http.Response('', 204);
    if (req.url.path == '/v1/sync') {
      final mine = items[owner]!;
      final results = [];
      for (final c in (body['changes'] as List).cast<Map<String, dynamic>>()) {
        final id = c['clientId'] as String;
        final old = mine[id];
        if (old != null && (old['updatedAt'] as int) > (c['updatedAt'] as int)) { results.add({'clientId': id, 'status': 'stale'}); continue; }
        mine[id] = {...c, 'deleted': c['deleted'] == true, 'seq': ++seq};
        results.add({'clientId': id, 'status': 'saved'});
      }
      final since = body['since'] as int;
      return http.Response(jsonEncode({'results': results, 'items': mine.values.where((i) => (i['seq'] as int) > since).toList(), 'cursor': seq, 'more': false}), 200);
    }
    return http.Response('{}', 404);
  });
}

Entry note(String id, String title, {int updatedAt = 0}) => Entry(id: id, kind: 'Catatan', title: title, body: 'isi', updatedAt: updatedAt);

void main() {
  late SharedPreferences prefs;
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    prefs = await SharedPreferences.getInstance();
  });

  // Penyimpanan titipan sederhana seperti Entries di main.dart.
  ({MimiSync sync, List<Entry> Function() read, Future<void> Function(List<Entry>) write}) device(FakeServer server, [List<Entry> start = const []]) {
    var list = [...start];
    final sync = MimiSync(prefs, client: server.client);
    sync.attach(read: () => list, writeQuiet: (next) async { list = next; });
    Future<void> write(List<Entry> next) async { list = sync.stamp(list, next); }
    return (sync: sync, read: () => list, write: write);
  }

  test('bentuk titipan HP dan web bolak-balik tanpa kehilangan kolom web', () {
    final fromWeb = {
      'clientId': 'nota-0001', 'kind': 'agenda', 'title': 'Ambil jahitan', 'note': 'bawa nota', 'time': '2026-12-01T16:00',
      'done': false, 'snoozeUntil': DateTime(2026, 12, 1, 16, 10).millisecondsSinceEpoch, 'updatedAt': 1764316800000,
      'repeat': 'weekly', 'reminderId': 'r-1', 'place': 'Gedung Melati', 'source': 'telegram',
      'attachments': [{'kind': 'photo', 'id': 'AQADb2xy', 'mime': 'image/jpeg', 'size': 1737}], 'seq': 4, 'deleted': false,
    };
    final e = itemToEntry(fromWeb);
    expect(e.kind, 'Agenda');
    expect(e.body, 'bawa nota');
    expect(e.time, DateTime(2026, 12, 1, 16, 0));
    expect(e.snooze, DateTime(2026, 12, 1, 16, 10));
    expect(e.place, 'Gedung Melati');
    expect(e.fromTelegram, isTrue);
    expect(e.attachments.single['id'], 'AQADb2xy');
    final back = entryToItem(e);
    for (final k in ['clientId', 'kind', 'title', 'note', 'time', 'snoozeUntil', 'updatedAt', 'repeat', 'reminderId', 'place', 'source', 'attachments']) {
      expect(back[k], fromWeb[k], reason: k);
    }
    expect(back.containsKey('seq'), isFalse);
    // Kartu akun: identity di web = body di HP. Riwayat ikut.
    final card = itemToEntry({'clientId': 'akun-0001', 'kind': 'account', 'title': 'Shopee', 'identity': 'iqlima.uji@contoh.id', 'method': 'Google', 'vault': 'google',
      'history': [{'label': 'Ditambahkan', 'at': '2026-11-28T02:00:00.000Z'}], 'time': '', 'done': false, 'updatedAt': 5});
    expect(card.body, 'iqlima.uji@contoh.id');
    expect(entryToItem(card)['identity'], 'iqlima.uji@contoh.id');
    expect(entryToItem(card)['vault'], 'google');
    expect(entryToItem(card)['history'], [{'label': 'Ditambahkan', 'at': '2026-11-28T02:00:00.000Z'}]);
    // Disimpan di HP lalu dibaca lagi: tetap sama.
    expect(entryToItem(Entry.fromJson(jsonDecode(jsonEncode(e.toJson())) as Map<String, dynamic>)), back);
  });

  test('gabung dari server: versi HP yang lebih baru tidak ditimpa, hapus dari server menghapus', () {
    final dirty = <String>{'a1234567'};
    final local = [note('a1234567', 'versi HP', updatedAt: 20), note('b1234567', 'lama', updatedAt: 5)];
    final r = mergeRemote(local, [
      {'clientId': 'a1234567', 'kind': 'note', 'title': 'versi web', 'note': '', 'time': '', 'done': false, 'updatedAt': 10},
      {'clientId': 'b1234567', 'deleted': true, 'updatedAt': 9},
      {'clientId': 'c1234567', 'kind': 'note', 'title': 'baru dari web', 'note': '', 'time': '', 'done': false, 'updatedAt': 11},
    ], dirty);
    expect(r.changed, isTrue);
    expect(r.entries.map((e) => e.title), ['baru dari web', 'versi HP']);
    expect(dirty, {'a1234567'});
  });

  test('alamat server: https wajib kecuali jaringan lokal', () {
    expect(cleanServer('https://mimi.contoh.id/'), 'https://mimi.contoh.id');
    expect(cleanServer('https://mimi.contoh.id:8443/x?y=1'), 'https://mimi.contoh.id:8443');
    expect(cleanServer('http://mimi.contoh.id'), isNull);
    expect(cleanServer('http://192.168.1.5:3000'), 'http://192.168.1.5:3000');
    expect(cleanServer('bukan alamat'), isNull);
  });

  test('sambungkan dengan kode, pindahkan titipan HP atas persetujuan, lalu sinkron dua arah', () async {
    final server = FakeServer();
    final hp = device(server, [note('hp000001', 'catatan lama di HP')]);
    await expectLater(hp.sync.connect('https://mimi.contoh.id', 'salah123'), throwsA(isA<ApiError>()));
    await hp.sync.connect('https://mimi.contoh.id', 'abcd-2345');
    expect(hp.sync.signedIn, isTrue);
    expect(hp.sync.user!['email'], 'iqlima.uji@contoh.id');
    // Punya titipan lama: belum dikirim sebelum Iqlima setuju.
    expect(hp.sync.migrated, isFalse);
    expect(server.items['iqlima'], isEmpty);
    await hp.sync.migrate();
    expect(server.items['iqlima']!.keys, ['hp000001']);
    expect(hp.read().single.updatedAt, 1);
    // Ubah di HP: terkirim dengan updatedAt baru.
    await hp.write([note('hp000001', 'diubah di HP'), note('hp000002', 'baru di HP')]);
    await hp.sync.sync();
    expect(server.items['iqlima']!['hp000001']!['title'], 'diubah di HP');
    expect(server.items['iqlima']!['hp000002'], isNotNull);
    expect(hp.sync.dirty, isEmpty);
    // Perubahan dari web masuk ke HP.
    server.items['iqlima']!['web00001'] = {'clientId': 'web00001', 'kind': 'agenda', 'title': 'Dari web', 'note': '', 'time': '2026-12-01T10:00', 'done': false, 'updatedAt': DateTime.now().millisecondsSinceEpoch, 'deleted': false, 'seq': ++server.seq};
    await hp.sync.sync();
    expect(hp.read().first.title, 'Dari web');
    // Hapus di HP: dikirim sebagai tombstone.
    await hp.write(hp.read().where((e) => e.id != 'hp000002').toList());
    await hp.sync.sync();
    expect(server.items['iqlima']!['hp000002']!['deleted'], isTrue);
    expect(hp.sync.tombstones, isEmpty);
    // Akun lain tidak melihat apa pun.
    expect(server.items['lain'], isEmpty);
  });

  test('HP tanpa titipan langsung ikut akun; offline tidak menghapus apa pun; sesi berakhir keluar dengan rapi', () async {
    final server = FakeServer();
    server.items['iqlima']!['web00001'] = {'clientId': 'web00001', 'kind': 'note', 'title': 'Dari web', 'note': '', 'time': '', 'done': false, 'updatedAt': 3, 'deleted': false, 'seq': ++server.seq};
    final hp = device(server);
    await hp.sync.connect('https://mimi.contoh.id', 'ABCD2345');
    expect(hp.sync.migrated, isTrue);
    expect(hp.read().single.title, 'Dari web');
    server.down = true;
    await hp.write([...hp.read(), note('hp000009', 'ditulis saat offline')]);
    await hp.sync.sync();
    expect(hp.sync.status, contains('offline'));
    expect(hp.sync.dirty, contains('hp000009'));
    server.down = false;
    await hp.sync.sync();
    expect(server.items['iqlima']!['hp000009']!['title'], 'ditulis saat offline');
    server.tokens.clear();
    await hp.sync.sync();
    expect(hp.sync.signedIn, isFalse);
    expect(hp.sync.status, contains('Sesi berakhir'));
    expect(hp.read().length, 2, reason: 'titipan di HP tetap ada');
  });

  test('perubahan bersamaan di dua HP: yang terakhir diubah menang di keduanya', () async {
    final server = FakeServer();
    server.codes['EFGH2345'] = 'iqlima';
    final a = device(server);
    await a.sync.connect('https://mimi.contoh.id', 'ABCD2345');
    await a.write([note('sama0001', 'awal')]);
    await a.sync.sync();
    SharedPreferences.setMockInitialValues({});
    prefs = await SharedPreferences.getInstance();
    final b = device(server);
    await b.sync.connect('https://mimi.contoh.id', 'EFGH2345');
    expect(b.read().single.title, 'awal');
    await a.write([note('sama0001', 'dari HP A')]);
    await Future<void>.delayed(const Duration(milliseconds: 5));
    await b.write([note('sama0001', 'dari HP B')]);
    await b.sync.sync();
    await a.sync.sync();
    await b.sync.sync();
    expect(a.read().single.title, 'dari HP B');
    expect(b.read().single.title, 'dari HP B');
    expect(server.items['iqlima']!['sama0001']!['title'], 'dari HP B');
  });
}
