class Entry {
  const Entry({
    required this.id,
    required this.kind,
    required this.title,
    this.body = '',
    this.method = 'Google',
    this.time,
    this.snooze,
    this.done = false,
    this.history = const [],
    this.updatedAt = 0,
    this.attachments = const [],
    this.extra = const {},
  });
  final String id, kind, title, body, method;
  final DateTime? time, snooze;
  final bool done;
  final List<Map<String, String>> history;
  /// Milidetik perubahan terakhir. Dipakai sinkron: yang lebih baru menang, sama seperti web.
  final int updatedAt;
  /// Lampiran dari Telegram: {kind, id, name?, mime?, size?}. File diambil lewat /v1/media/<id>.
  final List<Map<String, dynamic>> attachments;
  /// Kolom dari web yang belum ditampilkan di HP (misalnya repeat, place, vault, reminderId).
  /// Disimpan apa adanya supaya tidak hilang saat titipan diubah di HP.
  final Map<String, dynamic> extra;
  Entry record(String label) => Entry.fromJson({
    ...toJson(),
    'history': [
      ...history,
      {'label': label, 'at': DateTime.now().toUtc().toIso8601String()},
    ],
  });
  DateTime? get due => snooze ?? time;
  bool isDue(DateTime now) => !done && due != null && !due!.isAfter(now);
  String? get place => extra['place'] is String ? extra['place'] as String : null;
  bool get fromTelegram => extra['source'] == 'telegram';
  Map<String, dynamic> toJson() => {
    'id': id,
    'kind': kind,
    'title': title,
    'body': body,
    'method': method,
    'time': time?.toIso8601String(),
    'snooze': snooze?.toIso8601String(),
    'done': done,
    if (kind == 'Akun') 'history': history,
    if (updatedAt > 0) 'updatedAt': updatedAt,
    if (attachments.isNotEmpty) 'attachments': attachments,
    if (extra.isNotEmpty) 'extra': extra,
  };
  factory Entry.fromJson(Map<String, dynamic> j) => Entry(
    id: j['id'],
    kind: j['kind'],
    title: j['title'],
    body: j['body'] ?? '',
    method: j['method'] ?? 'Google',
    time: DateTime.tryParse(j['time'] ?? ''),
    snooze: DateTime.tryParse(j['snooze'] ?? ''),
    done: j['done'] ?? false,
    history: (j['history'] as List? ?? [])
        .map((event) => Map<String, String>.from(event))
        .toList(),
    updatedAt: (j['updatedAt'] as num?)?.toInt() ?? 0,
    attachments: (j['attachments'] as List? ?? [])
        .map((a) => Map<String, dynamic>.from(a as Map))
        .toList(),
    extra: Map<String, dynamic>.from(j['extra'] as Map? ?? const {}),
  );
}
