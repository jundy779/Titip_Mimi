import 'dart:convert';

// Salinan Dart dari src/scripts/iqlima.mjs (web): tumpahkan pikiran, minta tolong,
// jaga diri, ulang tahun, musim Leo, kontak Jundy. Semua fungsi murni.
// test/iqlima_test.dart membandingkan hasilnya dengan test/fixtures/iqlima_cases.json
// yang dibuat dari versi web (tool/make_fixtures.mjs), jadi web dan HP selalu sepakat.

String _pad(int n) => n.toString().padLeft(2, '0');
String stampOf(DateTime d) => '${d.year}-${_pad(d.month)}-${_pad(d.day)}T${_pad(d.hour)}:${_pad(d.minute)}';
String dayKeyOf(DateTime d) => '${d.year}-${_pad(d.month)}-${_pad(d.day)}';
DateTime _at(DateTime base, int days, int h, int m) => DateTime(base.year, base.month, base.day + days, h, m);
DateTime? parseLocalTime(String? time) {
  final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$').firstMatch(time ?? '');
  if (m == null) return null;
  int g(int i) => int.parse(m.group(i)!);
  return DateTime(g(1), g(2), g(3), g(4), g(5));
}

// ---------- Tumpahkan pikiran ----------
const _days = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
const _months = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des'];

class _Time { const _Time(this.h, this.min, this.match); final int h, min; final String match; }
class _Date { const _Date(this.date, this.match, [this.sameWeekday = false]); final DateTime date; final String match; final bool sameWeekday; }

_Time? _readTime(String text) {
  final t = text.toLowerCase();
  final m = RegExp(r'(?:jam|pukul|pkl\.?)\s*(\d{1,2})(?:[.:](\d{2}))?\s*(pagi|siang|sore|malam)?').firstMatch(t) ??
      RegExp(r'\b(\d{1,2})[.:](\d{2})\b\s*(pagi|siang|sore|malam)?').firstMatch(t);
  if (m == null) return null;
  var h = int.parse(m.group(1)!), min = int.parse(m.group(2) ?? '0');
  final part = m.group(3);
  if (part == 'siang' && h < 11) h += 12;
  if ((part == 'sore' || part == 'malam') && h < 12) h += 12;
  if (part == 'malam' && h == 24) h = 0;
  if (h > 23 || min > 59) return null;
  return _Time(h, min, m.group(0)!);
}

_Date? _readDate(String text, DateTime now) {
  final t = text.toLowerCase();
  final rules = <(RegExp, Object)>[
    (RegExp(r'\bhari ini\b|\bnanti\b'), 0),
    (RegExp(r'\bbesok\b'), 1),
    (RegExp(r'\blusa\b'), 2),
    (RegExp(r'\bminggu depan\b'), 7),
    (RegExp(r'\bbulan depan\b'), 'month'),
  ];
  for (final rule in rules) {
    final re = rule.$1;
    final v = rule.$2;
    final m = re.firstMatch(t);
    if (m != null) {
      return v == 'month' ? _Date(DateTime(now.year, now.month + 1, 1), m.group(0)!) : _Date(_at(now, v as int, 0, 0), m.group(0)!);
    }
  }
  var m = RegExp(r'\b(?:tgl\.?|tanggal)\s*(\d{1,2})(?:\s+([a-z]+))?').firstMatch(t) ??
      RegExp(r'\b(\d{1,2})\s+(jan\w*|feb\w*|mar\w*|apr\w*|mei|jun\w*|jul\w*|agu\w*|ags|sep\w*|okt\w*|nov\w*|des\w*)\b').firstMatch(t);
  if (m != null) {
    final day = int.parse(m.group(1)!);
    final word = m.group(2);
    final mi = word == null ? -1 : _months.indexWhere((p) => word.startsWith(p) || (p == 'agu' && word == 'ags'));
    if (day >= 1 && day <= 31) {
      var date = DateTime(now.year, mi >= 0 ? mi + 1 : now.month, day);
      if (date.isBefore(_at(now, 0, 0, 0))) {
        date = mi >= 0 ? DateTime(now.year + 1, mi + 1, day) : DateTime(now.year, now.month + 1, day);
      }
      return _Date(date, m.group(0)!);
    }
  }
  m = RegExp(r"\b(?:hari\s+)?(senin|selasa|rabu|kamis|jum'?at|sabtu|minggu)\b").firstMatch(t);
  if (m != null) {
    final target = _days.indexOf(m.group(1)!.replaceAll("'", ''));
    final diff = (target - (now.weekday % 7) + 7) % 7;
    return _Date(_at(now, diff, 0, 0), m.group(0)!, diff == 0);
  }
  return null;
}

String _tidy(String title, List<String?> parts) {
  var s = title;
  for (final p in parts) {
    if (p != null && p.isNotEmpty) s = s.replaceFirst(RegExp(RegExp.escape(p), caseSensitive: false), ' ');
  }
  s = s
      .replaceFirst(RegExp(r'\s+(pada|di|ke|untuk)\s*$', caseSensitive: false), '')
      .replaceFirst(RegExp(r'^\s*(jangan lupa|inget|ingat)\s+', caseSensitive: false), '')
      .replaceAll(RegExp(r'\s{2,}'), ' ')
      .trim();
  return s.isEmpty ? '' : s[0].toUpperCase() + s.substring(1);
}

class DumpRow {
  const DumpRow({required this.title, required this.kind, required this.time, required this.source});
  final String title, kind, time, source;
  Map<String, String> toJson() => {'title': title, 'kind': kind, 'time': time, 'source': source};
}

List<DumpRow> parseDump(String? text, DateTime now) {
  final lines = (text ?? '')
      .split(RegExp(r'\n|;'))
      .map((l) => l.replaceFirst(RegExp(r'^\s*(?:[-*•·]|\d+[.)])\s*'), '').trim())
      .where((l) => l.length > 1)
      .take(30);
  return [
    for (final line in lines)
      () {
        final time = _readTime(line), date = _readDate(line, now);
        DateTime? when;
        if (date != null) {
          when = DateTime(date.date.year, date.date.month, date.date.day, time?.h ?? 9, time?.min ?? 0);
          if (date.sameWeekday && !when.isAfter(now)) when = _at(when, 7, when.hour, when.minute);
        } else if (time != null) {
          when = _at(now, 0, time.h, time.min);
          if (!when.isAfter(now)) when = _at(now, 1, time.h, time.min);
        }
        var title = _tidy(line, [date?.match, time?.match]);
        if (title.isEmpty) title = line;
        if (title.length > 100) title = title.substring(0, 100);
        return DumpRow(title: title, kind: when != null ? 'agenda' : 'note', time: when == null ? '' : stampOf(when), source: line);
      }(),
  ];
}

// ---------- Minta tolong Jundy ----------
const _weekdays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const _monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
/// "Selasa, 1 Desember pukul 16.00", sama dengan toLocaleString('id-ID') di web.
String longWhen(DateTime d) => '${_weekdays[d.weekday - 1]}, ${d.day} ${_monthNames[d.month - 1]} pukul ${_pad(d.hour)}.${_pad(d.minute)}';

String helpMessage({required String title, String time = '', String note = ''}) {
  final when = parseLocalTime(time);
  final lines = ['Jundy, aku minta tolong ya: $title${when == null ? '' : ' (${longWhen(when)})'}'];
  if (note.isNotEmpty) lines.add(note);
  lines.addAll(['', 'Dikirim dari Titip Mimi ♡']);
  return lines.join('\n');
}

String waLink(String? phone, String text) {
  var digits = (phone ?? '').replaceAll(RegExp(r'\D'), '');
  if (digits.startsWith('0')) digits = '62${digits.substring(1)}';
  return 'https://wa.me/${digits.length >= 9 ? digits : ''}?text=${Uri.encodeComponent(text)}';
}

String cleanIg(String? value) {
  final user = (value ?? '')
      .trim()
      .replaceFirst(RegExp(r'^@'), '')
      .replaceFirst(RegExp(r'^https?://(www\.)?instagram\.com/', caseSensitive: false), '')
      .replaceFirst(RegExp(r'/.*$'), '');
  return RegExp(r'^[A-Za-z0-9._]{1,30}$').hasMatch(user) ? user : '';
}
String igLink(String? user) { final u = cleanIg(user); return u.isEmpty ? '' : 'https://ig.me/m/$u'; }
String cleanPhone(String? value) {
  var d = (value ?? '').replaceAll(RegExp(r'\D'), '');
  if (d.startsWith('0')) d = '62${d.substring(1)}';
  return d.length >= 9 && d.length <= 15 ? d : '';
}

// ---------- Kalimat yang mengkhawatirkan ----------
final _crisis = RegExp(
  r'bunuh\s*diri|ingin\s+mati|pengen\s+mati|pingin\s+mati|mau\s+mati\s+aja|mengakhiri\s+hidup|akhiri\s+hidup|menyakiti\s+diri|nyakitin\s+diri|self[\s-]?harm|gak\s+mau\s+hidup|nggak\s+mau\s+hidup|tidak\s+ingin\s+hidup',
  caseSensitive: false,
);
bool needsSupport(String? text) => _crisis.hasMatch(text ?? '');
const supportText = 'Mimi khawatir sama kamu. Kamu nggak sendirian. Coba hubungi orang yang kamu percaya sekarang, atau bicara dengan konselor Healing119 Kemenkes lewat telepon 119 ekstensi 8 (24 jam) atau chat di healing119.id.';
const supportPhone = 'tel:119';
const supportChat = 'https://healing119.id';

// ---------- Jaga diri ----------
class CareKind {
  const CareKind(this.label, this.slots, this.lines);
  final String label;
  final List<String> slots, lines;
}
const careKinds = <String, CareKind>{
  'water': CareKind('Minum air', ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00'], ['Minum dulu, yuk. Mimi juga lagi minum susu ♡', 'Segelas air buat kamu yang lagi sibuk ♡']),
  'meal': CareKind('Makan', ['07:30', '12:30', '19:00'], ['Udah waktunya makan. Kamu juga butuh diurus ♡', 'Isi perut dulu, kerjaannya bisa nunggu sebentar ♡']),
  'rest': CareKind('Istirahat sebentar', ['10:30', '15:30'], ['Regangkan badan sebentar, yuk. Mimi ikut menggeliat ♡', 'Lima menit buat diri sendiri dulu ♡']),
  'sleep': CareKind('Waktunya tidur', ['22:30'], ['Udah malam. Titip sisa pikiran ke Mimi, terus istirahat ya ♡']),
};
const defaultCare = {'water': true, 'meal': true, 'rest': true, 'sleep': true};
const careSettingsKey = 'care_settings';
/// Pengaturan jaga diri tersimpan sebagai JSON; yang belum pernah diatur ikut bawaan (nyala).
Map<String, bool> readCareSettings(String? json) {
  final out = {...defaultCare};
  if (json == null) return out;
  try {
    final m = jsonDecode(json);
    if (m is Map) {
      for (final k in defaultCare.keys) {
        if (m[k] is bool) out[k] = m[k] as bool;
      }
    }
  } on FormatException {
    // Rusak: kembali ke bawaan.
  }
  return out;
}

class CareDue {
  const CareDue(this.id, this.kind, this.label, this.text);
  final String id, kind, label, text;
  Map<String, String> toJson() => {'id': id, 'kind': kind, 'label': label, 'text': text};
}

/// Satu pengingat jaga diri yang sedang berlaku (jendela 45 menit) dan belum tampil hari ini.
CareDue? dueCare(Map<String, bool> settings, DateTime now, [Map<String, String> shown = const {}]) {
  final today = dayKeyOf(now);
  for (final kind in careKinds.keys) {
    final def = careKinds[kind]!;
    if (settings[kind] != true) continue;
    for (final slot in def.slots) {
      final p = slot.split(':').map(int.parse).toList();
      final start = _at(now, 0, p[0], p[1]), id = '$kind-$slot';
      final since = now.difference(start);
      if (!since.isNegative && since < const Duration(minutes: 45) && shown[id] != today) {
        return CareDue(id, kind, def.label, def.lines[(now.day + p[0]) % def.lines.length]);
      }
    }
  }
  return null;
}

/// Jadwal jaga diri berikutnya untuk pengingat HP (dititipkan ke sistem seperti agenda).
Map<String, DateTime> careSchedule(Map<String, bool> settings, DateTime now, {int days = 2}) {
  final out = <String, DateTime>{};
  for (var d = 0; d < days; d++) {
    for (final kind in careKinds.keys) {
      final def = careKinds[kind]!;
      if (settings[kind] != true) continue;
      for (final slot in def.slots) {
        final p = slot.split(':').map(int.parse).toList();
        final at = _at(now, d, p[0], p[1]);
        if (at.isAfter(now)) out['care:$kind-$slot:${dayKeyOf(at)}'] = at;
      }
    }
  }
  return out;
}

// ---------- Leo dan ulang tahun ----------
bool isLeoSeason(DateTime now) { final md = now.month * 100 + now.day; return md >= 723 && md <= 822; }
({bool today, int daysLeft})? birthdayInfo(String? mmdd, DateTime now) {
  final m = RegExp(r'^(\d{2})-(\d{2})$').firstMatch(mmdd ?? '');
  if (m == null) return null;
  final month = int.parse(m.group(1)!), day = int.parse(m.group(2)!);
  final start = DateTime(now.year, now.month, now.day);
  var next = DateTime(now.year, month, day);
  if (next.isBefore(start)) next = DateTime(now.year + 1, month, day);
  // Hari kalender, bukan 24 jam: aman saat ada pergantian jam musim panas.
  final daysLeft = DateTime.utc(next.year, next.month, next.day).difference(DateTime.utc(start.year, start.month, start.day)).inDays;
  return (today: daysLeft == 0, daysLeft: daysLeft);
}
/// Lencana di Hari Ini, urutannya sama dengan web: ulang tahun, musim Leo, lalu hitung mundur 7 hari.
String celebrateLine(String? birthday, DateTime now) {
  final b = birthdayInfo(birthday, now);
  if (b != null && b.today) return '🎂 Selamat ulang tahun, Iqlima! Hari ini semua tentang kamu ♡';
  if (isLeoSeason(now)) return '♌ Musim Leo, musimnya kamu bersinar ☀';
  if (b != null && b.daysLeft <= 7) return '🎀 ${b.daysLeft} hari lagi ulang tahunmu ♡';
  return '';
}
