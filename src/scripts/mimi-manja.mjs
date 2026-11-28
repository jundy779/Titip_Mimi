// Suara Mimi yang manja. Fungsi murni agar sama di web, tes, dan mudah disalin ke Flutter.
// Aturan suara: Mimi senang ditemani, memuji usaha kecil, dan tidak pernah membuat
// Iqlima merasa bersalah karena sibuk, lupa, atau lama tidak membuka aplikasi.

export const prefKey = 'titip-mimi-manja-v1';

const moments = [
  { id: 'larut', from: 0, to: 4, pose: 'sleep', hello: 'Udah larut, Iqlima' },
  { id: 'pagi', from: 4, to: 11, pose: 'welcome', hello: 'Selamat pagi, Iqlima' },
  { id: 'siang', from: 11, to: 15, pose: 'peek', hello: 'Siang, Iqlima' },
  { id: 'sore', from: 15, to: 18, pose: 'planner', hello: 'Sore, Iqlima' },
  { id: 'malam', from: 18, to: 22, pose: 'letter', hello: 'Malam, Iqlima' },
  { id: 'larut', from: 22, to: 24, pose: 'sleep', hello: 'Udah larut, Iqlima' },
];

export const lines = {
  pagi: [
    'Mimi udah bangun dari tadi, nungguin kamu.',
    'Pagi ini Mimi duduk di dekat agenda, siap nemenin.',
    'Sarapan dulu, ya. Titipanmu aman sama Mimi.',
  ],
  siang: [
    'Jangan lupa makan siang, ya. Mimi jagain titipanmu.',
    'Mimi ngintip dari balik buku, kangen dikit.',
    'Kalau ada yang mau dititip, Mimi di sini.',
  ],
  sore: [
    'Sini duduk bentar sama Mimi.',
    'Hari ini kamu udah ngurus banyak hal. Mimi bangga.',
    'Mimi siap dengar apa aja yang mau kamu titip.',
  ],
  malam: [
    'Hari ini kamu udah hebat. Mimi bangga sama kamu.',
    'Mimi udah rapiin titipanmu. Istirahat yang enak, ya.',
    'Mimi nemenin sampai kamu ngantuk.',
  ],
  larut: [
    'Mimi temenin, tapi istirahat juga, ya.',
    'Titip aja yang kepikiran, biar kamu bisa tidur tenang.',
    'Mimi pelan-pelan aja, biar kamu nggak kebangun.',
  ],
};

export const welcomeBack = 'Yeay, kamu mampir lagi. Mimi seneng banget ♡';

export const reactions = {
  saved: ['Udah Mimi simpan baik-baik ♡', 'Aman di Koleksi, Mimi jagain ♡', 'Mimi peluk titipanmu ♡'],
  account: ['Petunjuk akunnya Mimi simpan ♡', 'Sekarang Mimi ikut inget akun ini ♡'],
  agenda: ['Mimi catat jadwalnya ♡', 'Nanti Mimi colek kalau udah waktunya ♡'],
  done: ['Yeay, satu beres! ♡', 'Hebat! Mimi kasih tos ♡', 'Mimi ikut lega ♡'],
  allDone: ['Agenda hari ini beres semua. Mimi bangga banget ♡'],
  snooze: ['Oke, Mimi colek lagi 10 menit lagi ♡'],
  password: ['Mimi catat tanggal ganti sandinya ♡'],
  pet: ['Prrr… Mimi suka dielus ♡', 'Hehe, geli ♡', 'Mimi mau dielus lagi ♡', 'Mimi sayang Iqlima ♡'],
  task: ['Centang! Mimi tepuk tangan ♡', 'Satu lagi beres ♡'],
  inbox: ['Mimi bawa akun dari browser ♡'],
};

export const poses = {
  saved: 'saved', account: 'privacy', agenda: 'planner', done: 'done', allDone: 'celebrate',
  snooze: 'snooze', password: 'privacy', pet: 'welcome', task: 'done', inbox: 'linked',
};

// Kata yang tidak boleh muncul di suara Mimi karena bisa terdengar menyalahkan.
export const blockedWords = ['kok lama', 'lupa ya', 'kemana aja', 'ke mana aja', 'ditinggal', 'nggak peduli', 'kecewa', 'sedih kamu'];

export function momentOf(date = new Date()) {
  const hour = date.getHours();
  return moments.find(m => hour >= m.from && hour < m.to);
}

function daySeed(date) {
  return date.getFullYear() * 400 + date.getMonth() * 32 + date.getDate();
}

// Satu kalimat tetap per hari dan momen supaya teks tidak berganti tiap render.
export function pick(list, date = new Date(), salt = 0) {
  return list[(daySeed(date) + salt) % list.length];
}

const dayKey = date => [date.getFullYear(), date.getMonth() + 1, date.getDate()].join('-');

export function daysBetween(fromKey, now = new Date()) {
  if (!fromKey) return 0;
  const [y, m, d] = fromKey.split('-').map(Number);
  if (![y, m, d].every(Number.isFinite)) return 0;
  const from = new Date(y, m - 1, d);
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((to - from) / 86400000);
}

export function greeting(now = new Date(), state = {}) {
  const moment = momentOf(now);
  const away = daysBetween(state.lastVisit, now);
  const line = away >= 2 ? welcomeBack : pick(lines[moment.id], now, moment.from);
  return { title: moment.hello + ' ♡', line, pose: away >= 2 ? 'celebrate' : moment.pose, moment: moment.id };
}

export function reaction(kind, now = new Date(), salt = 0) {
  const list = reactions[kind] || reactions.saved;
  return { text: list[(now.getSeconds() + salt) % list.length], pose: poses[kind] || 'saved' };
}

export function readState(storage) {
  try {
    const raw = JSON.parse(storage?.getItem(prefKey) || '{}');
    return { enabled: raw.enabled !== false, lastVisit: typeof raw.lastVisit === 'string' ? raw.lastVisit : '', pets: Math.max(0, Number(raw.pets) || 0) };
  } catch {
    return { enabled: true, lastVisit: '', pets: 0 };
  }
}

export function writeState(storage, state) {
  try { storage?.setItem(prefKey, JSON.stringify(state)); return true; } catch { return false; }
}

// Dipanggil sekali saat halaman dibuka. Mengembalikan sapaan berdasarkan kunjungan sebelumnya
// lalu mencatat kunjungan hari ini.
export function visit(storage, now = new Date()) {
  const state = readState(storage);
  const hello = greeting(now, state);
  writeState(storage, { ...state, lastVisit: dayKey(now) });
  return { state, hello };
}
