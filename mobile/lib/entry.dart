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
  });
  final String id, kind, title, body, method;
  final DateTime? time, snooze;
  final bool done;
  DateTime? get due => snooze ?? time;
  bool isDue(DateTime now) => !done && due != null && !due!.isAfter(now);
  Map<String, dynamic> toJson() => {
    'id': id,
    'kind': kind,
    'title': title,
    'body': body,
    'method': method,
    'time': time?.toIso8601String(),
    'snooze': snooze?.toIso8601String(),
    'done': done,
  };
  factory Entry.fromJson(Map<String, dynamic> j) => Entry(
    id: j['id'],
    kind: j['kind'],
    title: j['title'],
    body: j['body'],
    method: j['method'],
    time: DateTime.tryParse(j['time'] ?? ''),
    snooze: DateTime.tryParse(j['snooze'] ?? ''),
    done: j['done'],
  );
}
