// Akun dan sinkron dengan server Mimi, aturannya sama dengan web (src/scripts/mimi-sync.js):
// titipan yang updatedAt-nya lebih baru menang, hapus dikirim sebagai tombstone, dan titipan
// lama di HP baru dikirim setelah Iqlima menekan "Pindahkan". HP masuk dengan kode sekali pakai
// yang dibuat di Profil web, jadi tidak perlu login Google di HP.
import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'entry.dart';
import 'iqlima.dart' show parseLocalTime, stampOf;

const _toServer = {'Catatan': 'note', 'Akun': 'account', 'Agenda': 'agenda'};
const _fromServer = {'note': 'Catatan', 'account': 'Akun', 'agenda': 'Agenda'};
const _known = {
  'clientId', 'kind', 'title', 'note', 'identity', 'method', 'time', 'done', 'snoozeUntil',
  'history', 'attachments', 'updatedAt', 'deleted', 'seq',
};

/// Titipan HP → bentuk titipan web/server.
Map<String, dynamic> entryToItem(Entry e) {
  final account = e.kind == 'Akun';
  return {
    ...e.extra,
    'clientId': e.id,
    'kind': _toServer[e.kind] ?? 'note',
    'title': e.title,
    'note': account ? '' : e.body,
    if (account) 'identity': e.body,
    if (account) 'method': e.method,
    'time': account || e.time == null ? '' : stampOf(e.time!),
    'done': e.done,
    if (e.snooze != null) 'snoozeUntil': e.snooze!.millisecondsSinceEpoch,
    if (account && e.history.isNotEmpty) 'history': e.history,
    if (e.attachments.isNotEmpty) 'attachments': e.attachments,
    'updatedAt': e.updatedAt,
  };
}

/// Titipan dari server → titipan HP. Kolom yang belum dikenal HP disimpan di [Entry.extra].
Entry itemToEntry(Map<String, dynamic> r) {
  final kind = _fromServer[r['kind']] ?? 'Catatan';
  final account = kind == 'Akun';
  final snooze = r['snoozeUntil'];
  return Entry(
    id: r['clientId'] as String,
    kind: kind,
    title: (r['title'] ?? '') as String,
    body: (account ? r['identity'] ?? '' : r['note'] ?? '') as String,
    method: (r['method'] ?? 'Google') as String,
    time: parseLocalTime(r['time'] as String?),
    snooze: snooze is num ? DateTime.fromMillisecondsSinceEpoch(snooze.toInt()) : null,
    done: r['done'] == true,
    history: (r['history'] as List? ?? [])
        .whereType<Map>()
        .map((e) => {'label': '${e['label']}', 'at': '${e['at']}'})
        .toList(),
    updatedAt: (r['updatedAt'] as num?)?.toInt() ?? 0,
    attachments: (r['attachments'] as List? ?? []).whereType<Map>().map((a) => Map<String, dynamic>.from(a)).toList(),
    extra: {for (final e in r.entries) if (!_known.contains(e.key)) e.key: e.value},
  );
}

Entry withUpdatedAt(Entry e, int at) => Entry.fromJson({...e.toJson(), 'updatedAt': at});
String _sameContent(Entry e) => jsonEncode({...e.toJson(), 'updatedAt': 0});

/// Gabungkan perubahan dari server. Versi lokal yang lebih baru tidak ditimpa.
({List<Entry> entries, bool changed}) mergeRemote(List<Entry> local, List<Map<String, dynamic>> remote, Set<String> dirty) {
  final next = [...local];
  var changed = false;
  for (final r in remote) {
    final id = r['clientId'];
    if (id is! String) continue;
    final index = next.indexWhere((e) => e.id == id);
    final mine = index < 0 ? null : next[index];
    final theirs = (r['updatedAt'] as num?)?.toInt() ?? 0;
    if (mine != null && mine.updatedAt > theirs) continue;
    if (r['deleted'] == true) {
      if (index >= 0) { next.removeAt(index); changed = true; }
      dirty.remove(id);
      continue;
    }
    final item = itemToEntry(r);
    if (mine != null && mine.updatedAt == item.updatedAt && _sameContent(mine) == _sameContent(item)) continue;
    if (index >= 0) { next[index] = item; } else { next.insert(0, item); }
    dirty.remove(id);
    changed = true;
  }
  return (entries: next, changed: changed);
}

class ApiError implements Exception {
  ApiError(this.status, this.message, [this.code = '']);
  final int status;
  final String message, code;
  @override
  String toString() => message;
}

/// Alamat server: https, atau http hanya untuk uji di jaringan lokal.
String? cleanServer(String raw) {
  final uri = Uri.tryParse(raw.trim().replaceFirst(RegExp(r'/+$'), ''));
  if (uri == null || !uri.hasAuthority || uri.host.isEmpty) return null;
  final local = uri.host == 'localhost' || uri.host == '10.0.2.2' || uri.host.startsWith('192.168.') || uri.host == '127.0.0.1';
  if (uri.scheme != 'https' && !(uri.scheme == 'http' && local)) return null;
  return Uri(scheme: uri.scheme, host: uri.host, port: uri.hasPort ? uri.port : null).toString();
}

class MimiSync extends ChangeNotifier {
  MimiSync(this.prefs, {http.Client? client}) : _client = client ?? http.Client() {
    _load();
  }
  final SharedPreferences prefs;
  final http.Client _client;
  String server = '', _token = '', status = '';
  Map<String, dynamic>? user;
  int cursor = 0, lastSync = 0;
  bool migrated = false;
  Set<String> dirty = {};
  List<Map<String, dynamic>> tombstones = [];
  List<Entry> Function() _read = () => const [];
  Future<void> Function(List<Entry>) _writeQuiet = (_) async {};
  Timer? _timer, _debounce;
  Future<void>? _running;
  bool _again = false;

  bool get signedIn => user != null && _token.isNotEmpty;
  bool get ready => signedIn && migrated;
  Map<String, String> get authHeaders => {'Authorization': 'Bearer $_token', 'X-Mimi-Client': 'token'};
  Uri mediaUrl(String id) => Uri.parse('$server/v1/media/${Uri.encodeComponent(id)}');
  Uri webUrl(String path) => Uri.parse('$server/$path');

  void _load() {
    server = prefs.getString('mimi_server') ?? const String.fromEnvironment('MIMI_API');
    _token = prefs.getString('mimi_token') ?? '';
    final u = prefs.getString('mimi_user');
    user = u == null ? null : Map<String, dynamic>.from(jsonDecode(u) as Map);
    cursor = prefs.getInt('mimi_cursor') ?? 0;
    lastSync = prefs.getInt('mimi_last_sync') ?? 0;
    migrated = prefs.getBool('mimi_migrated') ?? false;
    dirty = (prefs.getStringList('mimi_dirty') ?? const []).toSet();
    tombstones = ((jsonDecode(prefs.getString('mimi_tombs') ?? '[]') as List).whereType<Map>().map((t) => Map<String, dynamic>.from(t))).toList();
  }

  Future<void> _persist() async {
    await prefs.setString('mimi_server', server);
    if (_token.isEmpty) { await prefs.remove('mimi_token'); } else { await prefs.setString('mimi_token', _token); }
    if (user == null) { await prefs.remove('mimi_user'); } else { await prefs.setString('mimi_user', jsonEncode(user)); }
    await prefs.setInt('mimi_cursor', cursor);
    await prefs.setInt('mimi_last_sync', lastSync);
    await prefs.setBool('mimi_migrated', migrated);
    await prefs.setStringList('mimi_dirty', dirty.toList());
    await prefs.setString('mimi_tombs', jsonEncode(tombstones));
  }

  /// Dipanggil sekali oleh penyimpanan titipan.
  void attach({required List<Entry> Function() read, required Future<void> Function(List<Entry>) writeQuiet}) {
    _read = read;
    _writeQuiet = writeQuiet;
    _timer ??= Timer.periodic(const Duration(seconds: 60), (_) { if (ready) unawaited(sync()); });
    if (ready) schedule(const Duration(milliseconds: 300));
  }

  /// Sebelum titipan disimpan: beri updatedAt pada yang berubah dan catat yang dihapus.
  List<Entry> stamp(List<Entry> prev, List<Entry> next) {
    if (!ready) return next;
    final now = DateTime.now().millisecondsSinceEpoch;
    final before = {for (final e in prev) e.id: e};
    final out = <Entry>[];
    for (final e in next) {
      final old = before[e.id];
      if (old != null && _sameContent(old) == _sameContent(e)) {
        out.add(e);
      } else {
        dirty.add(e.id);
        out.add(withUpdatedAt(e, now));
      }
    }
    final kept = next.map((e) => e.id).toSet();
    for (final old in prev) {
      if (kept.contains(old.id)) continue;
      dirty.remove(old.id);
      tombstones.add({'clientId': old.id, 'deleted': true, 'updatedAt': now});
    }
    unawaited(_persist());
    return out;
  }

  void schedule([Duration delay = const Duration(milliseconds: 800)]) {
    if (!ready) return;
    _debounce?.cancel();
    _debounce = Timer(delay, () => unawaited(sync()));
  }

  Future<Map<String, dynamic>> _call(String path, [Map<String, dynamic>? body]) async {
    final uri = Uri.parse('$server$path');
    final headers = {...authHeaders, 'X-Mimi': '1', if (body != null) 'Content-Type': 'application/json'};
    final http.Response res;
    try {
      res = body == null
          ? await _client.get(uri, headers: headers).timeout(const Duration(seconds: 20))
          : await _client.post(uri, headers: headers, body: jsonEncode(body)).timeout(const Duration(seconds: 20));
    } on Exception {
      throw ApiError(0, 'Server Mimi belum terjangkau. Cek internet, ya.');
    }
    final data = res.body.isEmpty ? <String, dynamic>{} : (jsonDecode(res.body) as Map).cast<String, dynamic>();
    if (res.statusCode >= 400) throw ApiError(res.statusCode, (data['message'] ?? 'Gagal') as String, (data['code'] ?? '') as String);
    return data;
  }

  /// Tukar kode dari Profil web menjadi sesi di HP ini.
  Future<void> connect(String rawServer, String code) async {
    final base = cleanServer(rawServer);
    if (base == null) throw ApiError(400, 'Alamat server harus diawali https://');
    server = base;
    _token = '';
    final res = await _call('/v1/auth/device-code/redeem', {'code': code});
    _token = res['token'] as String;
    user = Map<String, dynamic>.from(res['user'] as Map);
    cursor = 0;
    dirty = {};
    tombstones = [];
    // Seperti web: kalau HP ini belum punya titipan, langsung ikut akun. Kalau punya, tanya dulu.
    migrated = _read().isEmpty;
    status = '';
    await _persist();
    notifyListeners();
    if (migrated) await sync();
  }

  /// Kirim titipan yang sudah ada di HP ke akun (atas persetujuan Iqlima). Aman diulang.
  Future<void> migrate() async {
    if (!signedIn) return;
    final entries = _read();
    final stamped = [for (final e in entries) e.updatedAt > 0 ? e : withUpdatedAt(e, 1)];
    dirty.addAll(entries.map((e) => e.id));
    migrated = true;
    await _writeQuiet(stamped);
    await _persist();
    notifyListeners();
    await sync();
  }

  Future<void> sync() {
    if (!ready) return Future.value();
    if (_running != null) { _again = true; return _running!; }
    final run = _syncLoop();
    _running = run;
    return run.whenComplete(() => _running = null);
  }

  Future<void> _syncLoop() async {
    status = 'Menyinkronkan…';
    notifyListeners();
    try {
      do {
        _again = false;
        final changes = [
          ..._read().where((e) => dirty.contains(e.id)).map(entryToItem),
          ...tombstones,
        ].take(500).toList();
        final sentAt = {for (final c in changes) c['clientId'] as String: c['updatedAt']};
        final sentTombs = [...tombstones];
        final res = await _call('/v1/sync', {'changes': changes, 'since': cursor});
        final done = (res['results'] as List).whereType<Map>().where((r) => r['status'] != 'invalid').map((r) => r['clientId'] as String).toSet();
        final current = {for (final e in _read()) e.id: e.updatedAt};
        // Tanda "belum terkirim" hanya dihapus bila titipan tidak berubah lagi selama permintaan berjalan.
        dirty.removeWhere((id) => done.contains(id) && current[id] == sentAt[id]);
        tombstones.removeWhere((t) => sentTombs.contains(t) && done.contains(t['clientId']));
        final merged = mergeRemote(_read(), (res['items'] as List).whereType<Map>().map((i) => Map<String, dynamic>.from(i)).toList(), dirty);
        if (merged.changed) await _writeQuiet(merged.entries);
        cursor = (res['cursor'] as num).toInt();
        lastSync = DateTime.now().millisecondsSinceEpoch;
        await _persist();
        if (res['more'] == true || (dirty.isNotEmpty && changes.length == 500)) _again = true;
      } while (_again);
      status = '';
    } on ApiError catch (e) {
      if (e.status == 401) {
        await _signedOut('Sesi berakhir. Sambungkan lagi dari Profil, ya.');
        return;
      }
      status = e.status == 0 ? 'Sedang offline. Titipan aman di HP, nanti Mimi coba lagi.' : 'Belum bisa sinkron. Mimi coba lagi sebentar lagi.';
    }
    notifyListeners();
  }

  Future<void> _signedOut(String message) async {
    _token = '';
    user = null;
    migrated = false;
    cursor = 0;
    dirty = {};
    tombstones = [];
    status = message;
    await _persist();
    notifyListeners();
  }

  Future<void> logout() async {
    try { await _call('/v1/auth/logout', {}); } on ApiError { /* sesi di server berakhir sendiri */ }
    await _signedOut('Sudah keluar. Titipan di HP ini tetap ada.');
  }

  @override
  void dispose() {
    _timer?.cancel();
    _debounce?.cancel();
    super.dispose();
  }
}
