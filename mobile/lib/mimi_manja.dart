// Suara Mimi yang manja, disalin dari src/scripts/mimi-manja.mjs di web.
// Aturan: Mimi senang ditemani dan memuji usaha kecil. Tidak pernah membuat
// Iqlima merasa bersalah karena sibuk, lupa, atau lama tidak membuka aplikasi.

class MimiMoment {
  const MimiMoment(this.id, this.from, this.to, this.pose, this.hello);
  final String id, pose, hello;
  final int from, to;
}

class MimiSaid {
  const MimiSaid(this.text, this.pose);
  final String text, pose;
}

class MimiGreeting {
  const MimiGreeting(this.title, this.line, this.pose);
  final String title, line, pose;
}

const mimiMoments = [
  MimiMoment('larut', 0, 4, 'sleep', 'Udah larut, Iqlima'),
  MimiMoment('pagi', 4, 11, 'welcome', 'Selamat pagi, Iqlima'),
  MimiMoment('siang', 11, 15, 'peek', 'Siang, Iqlima'),
  MimiMoment('sore', 15, 18, 'planner', 'Sore, Iqlima'),
  MimiMoment('malam', 18, 22, 'letter', 'Malam, Iqlima'),
  MimiMoment('larut', 22, 24, 'sleep', 'Udah larut, Iqlima'),
];

const mimiLines = <String, List<String>>{
  'pagi': [
    'Mimi udah bangun dari tadi, nungguin kamu.',
    'Pagi ini Mimi duduk di dekat agenda, siap nemenin.',
    'Sarapan dulu, ya. Titipanmu aman sama Mimi.',
  ],
  'siang': [
    'Jangan lupa makan siang, ya. Mimi jagain titipanmu.',
    'Mimi ngintip dari balik buku, kangen dikit.',
    'Kalau ada yang mau dititip, Mimi di sini.',
  ],
  'sore': [
    'Sini duduk bentar sama Mimi.',
    'Hari ini kamu udah ngurus banyak hal. Mimi bangga.',
    'Mimi siap dengar apa aja yang mau kamu titip.',
  ],
  'malam': [
    'Hari ini kamu udah hebat. Mimi bangga sama kamu.',
    'Mimi udah rapiin titipanmu. Istirahat yang enak, ya.',
    'Mimi nemenin sampai kamu ngantuk.',
  ],
  'larut': [
    'Mimi temenin, tapi istirahat juga, ya.',
    'Titip aja yang kepikiran, biar kamu bisa tidur tenang.',
    'Mimi pelan-pelan aja, biar kamu nggak kebangun.',
  ],
};

const mimiWelcomeBack = 'Yeay, kamu mampir lagi. Mimi seneng banget ♡';

const mimiReactions = <String, List<String>>{
  'saved': ['Udah Mimi simpan baik-baik ♡', 'Aman di Koleksi, Mimi jagain ♡', 'Mimi peluk titipanmu ♡'],
  'account': ['Petunjuk akunnya Mimi simpan ♡', 'Sekarang Mimi ikut inget akun ini ♡'],
  'agenda': ['Mimi catat jadwalnya ♡', 'Nanti Mimi colek kalau udah waktunya ♡'],
  'done': ['Yeay, satu beres! ♡', 'Hebat! Mimi kasih tos ♡', 'Mimi ikut lega ♡'],
  'allDone': ['Agenda hari ini beres semua. Mimi bangga banget ♡'],
  'snooze': ['Oke, Mimi colek lagi 10 menit lagi ♡'],
  'password': ['Mimi catat tanggal ganti sandinya ♡'],
  'pet': ['Prrr… Mimi suka dielus ♡', 'Hehe, geli ♡', 'Mimi mau dielus lagi ♡', 'Mimi sayang Iqlima ♡'],
};

const mimiReactionPoses = <String, String>{
  'saved': 'saved', 'account': 'privacy', 'agenda': 'planner', 'done': 'done',
  'allDone': 'celebrate', 'snooze': 'snooze', 'password': 'privacy', 'pet': 'welcome',
};

const manjaKey = 'manja';
const manjaLastVisitKey = 'manja_last_visit';
const manjaPetsKey = 'manja_pets';

MimiMoment mimiMomentOf(DateTime now) =>
    mimiMoments.firstWhere((m) => now.hour >= m.from && now.hour < m.to);

int _daySeed(DateTime d) => d.year * 400 + (d.month - 1) * 32 + d.day;

String mimiDayKey(DateTime d) => '${d.year}-${d.month}-${d.day}';

int mimiDaysAway(String? lastVisit, DateTime now) {
  if (lastVisit == null || lastVisit.isEmpty) return 0;
  final parts = lastVisit.split('-').map(int.tryParse).toList();
  if (parts.length != 3 || parts.any((p) => p == null)) return 0;
  final from = DateTime(parts[0]!, parts[1]!, parts[2]!);
  final to = DateTime(now.year, now.month, now.day);
  return (to.difference(from).inHours / 24).round();
}

MimiGreeting mimiGreeting(DateTime now, {int daysAway = 0}) {
  final moment = mimiMomentOf(now);
  if (daysAway >= 2) {
    return MimiGreeting('${moment.hello} ♡', mimiWelcomeBack, 'celebrate');
  }
  final list = mimiLines[moment.id]!;
  final line = list[(_daySeed(now) + moment.from) % list.length];
  return MimiGreeting('${moment.hello} ♡', line, moment.pose);
}

MimiSaid mimiReaction(String kind, DateTime now, [int salt = 0]) {
  final list = mimiReactions[kind] ?? mimiReactions['saved']!;
  return MimiSaid(
    list[(now.second + salt) % list.length],
    mimiReactionPoses[kind] ?? 'saved',
  );
}
