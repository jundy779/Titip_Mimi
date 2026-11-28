// Fitur untuk Iqlima: anti lupa, bagi beban, dinding bangga, dan jaga diri sendiri.
// Semua fungsi di sini murni (tanpa DOM) supaya bisa dites dan disalin ke Flutter.
// Suara: hangat, tidak menuntut, tidak menyalahkan.

const pad = n => String(n).padStart(2, '0');
export const stamp = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const at = (base, days, h, m) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + days, h, m);
function parseLocal(time) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(time || '');
  return m ? new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5]) : null;
}

// ---------- Tumpahkan pikiran ----------
const days = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
const months = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des'];

function readTime(text) {
  const t = text.toLowerCase();
  let m = /(?:jam|pukul|pkl\.?)\s*(\d{1,2})(?:[.:](\d{2}))?\s*(pagi|siang|sore|malam)?/.exec(t)
    || /\b(\d{1,2})[.:](\d{2})\b\s*(pagi|siang|sore|malam)?/.exec(t);
  if (!m) return null;
  let h = +m[1], min = +(m[2] || 0);
  const part = m[3];
  if (part === 'siang' && h < 11) h += 12;
  if ((part === 'sore' || part === 'malam') && h < 12) h += 12;
  if (part === 'malam' && h === 24) h = 0;
  if (h > 23 || min > 59) return null;
  return { h, min, match: m[0] };
}

function readDate(text, now) {
  const t = text.toLowerCase();
  const rules = [
    [/\bhari ini\b|\bnanti\b/, () => 0],
    [/\bbesok\b/, () => 1],
    [/\blusa\b/, () => 2],
    [/\bminggu depan\b/, () => 7],
    [/\bbulan depan\b/, () => 'month'],
  ];
  for (const [re, f] of rules) {
    const m = re.exec(t);
    if (m) { const v = f(); return v === 'month' ? { date: new Date(now.getFullYear(), now.getMonth() + 1, 1), match: m[0] } : { date: at(now, v, 0, 0), match: m[0] }; }
  }
  let m = /\b(?:tgl\.?|tanggal)\s*(\d{1,2})(?:\s+([a-z]+))?/.exec(t) || /\b(\d{1,2})\s+(jan\w*|feb\w*|mar\w*|apr\w*|mei|jun\w*|jul\w*|agu\w*|ags|sep\w*|okt\w*|nov\w*|des\w*)\b/.exec(t);
  if (m) {
    const day = +m[1];
    const mi = m[2] ? months.findIndex(p => m[2].startsWith(p) || (p === 'agu' && m[2] === 'ags')) : -1;
    if (day >= 1 && day <= 31) {
      let date = new Date(now.getFullYear(), mi >= 0 ? mi : now.getMonth(), day);
      if (date < at(now, 0, 0, 0)) date = mi >= 0 ? new Date(now.getFullYear() + 1, mi, day) : new Date(now.getFullYear(), now.getMonth() + 1, day);
      return { date, match: m[0] };
    }
  }
  m = /\b(?:hari\s+)?(senin|selasa|rabu|kamis|jum'?at|sabtu|minggu)\b/.exec(t);
  if (m) {
    const target = days.indexOf(m[1].replace("'", ''));
    let diff = (target - now.getDay() + 7) % 7;
    return { date: at(now, diff, 0, 0), match: m[0], sameWeekday: diff === 0 };
  }
  return null;
}

function tidy(title, parts) {
  let s = title;
  for (const p of parts) if (p) s = s.replace(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' ');
  s = s.replace(/\s+(pada|di|ke|untuk)\s*$/i, '').replace(/^\s*(jangan lupa|inget|ingat)\s+/i, '').replace(/\s{2,}/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

export function parseDump(text, now = new Date()) {
  return String(text || '').split(/\n|;/)
    .map(line => line.replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, '').trim())
    .filter(line => line.length > 1)
    .slice(0, 30)
    .map(line => {
      const time = readTime(line), date = readDate(line, now);
      let when = null;
      if (date) {
        when = new Date(date.date.getFullYear(), date.date.getMonth(), date.date.getDate(), time ? time.h : 9, time ? time.min : 0);
        if (date.sameWeekday && when <= now) when = at(when, 7, when.getHours(), when.getMinutes());
      } else if (time) {
        when = at(now, 0, time.h, time.min);
        if (when <= now) when = at(now, 1, time.h, time.min);
      }
      const title = (tidy(line, [date?.match, time?.match]) || line).slice(0, 100);
      return { title, kind: when ? 'agenda' : 'note', time: when ? stamp(when) : '', source: line };
    });
}

// ---------- Rutinitas berulang ----------
export const repeats = { daily: 'Setiap hari', weekly: 'Setiap minggu', monthly: 'Setiap bulan' };
export function nextOccurrence(item, now = new Date()) {
  const start = parseLocal(item.time);
  if (!start || !repeats[item.repeat]) return null;
  const want = item.repeatDay || start.getDate();
  let next = start;
  // Selalu maju minimal satu periode (selesai lebih awal), lalu lewati periode yang sudah lewat.
  for (let i = 0; i < 400 && (i === 0 || next <= now); i++) {
    if (item.repeat === 'daily') next = at(next, 1, next.getHours(), next.getMinutes());
    else if (item.repeat === 'weekly') next = at(next, 7, next.getHours(), next.getMinutes());
    else {
      const y = next.getFullYear(), mo = next.getMonth() + 1;
      const last = new Date(y, mo + 1, 0).getDate();
      next = new Date(y, mo, Math.min(want, last), next.getHours(), next.getMinutes());
    }
  }
  if (next <= now) return null;
  return { time: stamp(next), repeatDay: item.repeat === 'monthly' ? want : undefined };
}

// ---------- Dinding bangga ----------
export function weekStart(now = new Date()) {
  const back = (now.getDay() + 6) % 7;
  return at(now, -back, 0, 0);
}
export function weekStats(wins, now = new Date()) {
  const from = weekStart(now).getTime();
  const week = (wins || []).filter(w => Date.parse(w.at) >= from && Date.parse(w.at) <= now.getTime());
  const count = kind => week.filter(w => w.kind === kind).length;
  return {
    total: week.length, done: count('done'), task: count('task'), manual: count('win'), care: count('care'),
    highlights: week.filter(w => w.kind === 'win').slice(-3).reverse().map(w => w.text),
  };
}
export function praise(stats) {
  if (!stats.total) return 'Minggu ini baru mulai. Satu langkah kecil juga dihitung, ya ♡';
  if (stats.total >= 15) return 'Kamu luar biasa minggu ini. Raja hutan pun bangga sama kamu ♡';
  if (stats.total >= 5) return 'Lihat deh, udah banyak yang kamu selesaikan. Mimi bangga ♡';
  return 'Pelan-pelan juga tetap maju. Mimi lihat usahamu ♡';
}

// ---------- Bagi beban ----------
export function helpMessage(item) {
  const when = parseLocal(item.time);
  const lines = ['Jundy, aku minta tolong ya: ' + item.title];
  if (when) lines[0] += ' (' + when.toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) + ')';
  if (item.note) lines.push(item.note);
  lines.push('', 'Dikirim dari Titip Mimi ♡');
  return lines.join('\n');
}
export function waLink(phone, text) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  return 'https://wa.me/' + (digits.length >= 9 ? digits : '') + '?text=' + encodeURIComponent(text);
}

// ---------- Ruang lega ----------
export const feelings = {
  capek: { label: 'Capek', reply: 'Kamu udah nanggung banyak hari ini. Boleh kok berhenti sebentar dan napas dulu ♡' },
  sedih: { label: 'Sedih', reply: 'Mimi duduk di sini nemenin. Kamu nggak harus kuat terus, apalagi sendirian ♡' },
  kesal: { label: 'Kesal', reply: 'Wajar banget kesal. Tulis aja semuanya di sini, Mimi dengerin tanpa nilai apa-apa ♡' },
  cemas: { label: 'Cemas', reply: 'Satu-satu, ya. Coba pilih satu hal kecil yang bisa dikerjakan sekarang, sisanya titip ke Mimi ♡' },
  lega: { label: 'Lega', reply: 'Seneng dengernya. Simpan rasa lega ini baik-baik ya ♡' },
  senang: { label: 'Senang', reply: 'Yeay! Mimi ikut loncat-loncat. Mau dicatat di Dinding bangga juga? ♡' },
};
export const firstbornLine = 'Sebagai anak pertama kamu sering jadi tempat bersandar. Di sini, gantian kamu yang boleh bersandar ♡';
const crisis = /bunuh\s*diri|ingin\s+mati|pengen\s+mati|pingin\s+mati|mau\s+mati\s+aja|mengakhiri\s+hidup|akhiri\s+hidup|menyakiti\s+diri|nyakitin\s+diri|self[\s-]?harm|gak\s+mau\s+hidup|nggak\s+mau\s+hidup|tidak\s+ingin\s+hidup/i;
export function needsSupport(text) { return crisis.test(String(text || '')); }
export const support = {
  text: 'Mimi khawatir sama kamu. Kamu nggak sendirian. Coba hubungi orang yang kamu percaya sekarang, atau bicara dengan konselor Healing119 Kemenkes lewat telepon 119 ekstensi 8 (24 jam) atau chat di healing119.id.',
  phone: 'tel:119',
  chat: 'https://healing119.id',
};

// ---------- Jaga diri sendiri ----------
export const careKinds = {
  water: { label: 'Minum air', slots: ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00'], lines: ['Minum dulu, yuk. Mimi juga lagi minum susu ♡', 'Segelas air buat kamu yang lagi sibuk ♡'] },
  meal: { label: 'Makan', slots: ['07:30', '12:30', '19:00'], lines: ['Udah waktunya makan. Kamu juga butuh diurus ♡', 'Isi perut dulu, kerjaannya bisa nunggu sebentar ♡'] },
  rest: { label: 'Istirahat sebentar', slots: ['10:30', '15:30'], lines: ['Regangkan badan sebentar, yuk. Mimi ikut menggeliat ♡', 'Lima menit buat diri sendiri dulu ♡'] },
  sleep: { label: 'Waktunya tidur', slots: ['22:30'], lines: ['Udah malam. Titip sisa pikiran ke Mimi, terus istirahat ya ♡'] },
};
export const defaultCare = { water: true, meal: true, rest: true, sleep: true };
// Kembalikan satu pengingat yang sedang berlaku (jendela 45 menit) dan belum ditampilkan hari ini.
export function dueCare(settings, now = new Date(), shown = {}) {
  const today = dayKey(now);
  for (const [kind, def] of Object.entries(careKinds)) {
    if (!settings?.[kind]) continue;
    for (const slot of def.slots) {
      const [h, m] = slot.split(':').map(Number);
      const start = at(now, 0, h, m), id = kind + '-' + slot;
      if (now >= start && now - start < 45 * 60000 && shown[id] !== today) {
        return { id, kind, label: def.label, text: def.lines[(now.getDate() + h) % def.lines.length] };
      }
    }
  }
  return null;
}

// ---------- Leo dan ulang tahun ----------
export function isLeoSeason(now = new Date()) {
  const md = (now.getMonth() + 1) * 100 + now.getDate();
  return md >= 723 && md <= 822;
}
export function birthdayInfo(mmdd, now = new Date()) {
  const m = /^(\d{2})-(\d{2})$/.exec(mmdd || '');
  if (!m) return null;
  let next = new Date(now.getFullYear(), +m[1] - 1, +m[2]);
  if (next < at(now, 0, 0, 0)) next = new Date(now.getFullYear() + 1, +m[1] - 1, +m[2]);
  const daysLeft = Math.round((next - at(now, 0, 0, 0)) / 86400000);
  return { today: daysLeft === 0, daysLeft };
}
