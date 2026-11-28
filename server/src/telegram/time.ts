// Waktu dalam zona pengguna. Titipan menyimpan waktu dinding ("YYYY-MM-DDTHH:MM") tanpa zona,
// persis seperti web. Server menerjemahkannya ke epoch memakai zona di profil pengguna.
// Pengurai bahasa Indonesia di bawah adalah salinan src/scripts/iqlima.mjs (parseDump dan
// nextOccurrence); tes membandingkan keduanya supaya bot dan web selalu sepakat.

const pad = (n: number) => String(n).padStart(2, '0');
export const stamp = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const at = (base: Date, days: number, h: number, m: number) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + days, h, m);
export function parseLocal(time: string | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(time || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null;
}

// ---------- Zona waktu ----------
const formatters = new Map<string, Intl.DateTimeFormat>();
function parts(epoch: number, tz: string) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    formatters.set(tz, f);
  }
  const o: Record<string, number> = {};
  for (const p of f.formatToParts(new Date(epoch))) if (p.type !== 'literal') o[p.type] = Number(p.value);
  return o as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}
export function validZone(tz: string) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}
// Date yang komponen lokalnya sama dengan jam dinding di zona pengguna, agar pengurai di bawah
// (yang bekerja dengan jam lokal) memberi hasil dalam zona pengguna.
export function wallNow(epoch: number, tz: string): Date {
  const p = parts(epoch, tz);
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}
const offsetAt = (epoch: number, tz: string) => {
  const p = parts(epoch, tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(epoch / 1000) * 1000;
};
export function toEpoch(time: string, tz: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(time || '');
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const first = guess - offsetAt(guess, tz);
  return guess - offsetAt(first, tz);
}
export function minuteOfDay(epoch: number, tz: string) { const p = parts(epoch, tz); return p.hour * 60 + p.minute; }

// Jam tenang dalam menit sejak tengah malam. Mulai == selesai berarti mati.
export function inQuiet(epoch: number, tz: string, start: number | null, end: number | null) {
  if (start == null || end == null || start === end) return false;
  const m = minuteOfDay(epoch, tz);
  return start < end ? m >= start && m < end : m >= start || m < end;
}
export function quietEnds(epoch: number, tz: string, end: number): number {
  const wall = wallNow(epoch, tz);
  let target = new Date(wall.getFullYear(), wall.getMonth(), wall.getDate(), Math.floor(end / 60), end % 60);
  if (target <= wall) target = at(target, 1, target.getHours(), target.getMinutes());
  return toEpoch(stamp(target), tz) ?? epoch + 3600000;
}

const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
// "Minggu, 29 Nov, 16.00", sama dengan cara web menulis jadwal.
export function humanTime(time: string) {
  const d = parseLocal(time);
  return d ? `${dayNames[d.getDay()]}, ${d.getDate()} ${monthNames[d.getMonth()]}, ${pad(d.getHours())}.${pad(d.getMinutes())}` : '';
}
export const hhmm = (min: number) => `${pad(Math.floor(min / 60))}.${pad(min % 60)}`;

// ---------- Pengurai waktu bahasa Indonesia (salinan iqlima.mjs) ----------
const days = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
const months = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des'];

function readTime(text: string) {
  const t = text.toLowerCase();
  const m = /(?:jam|pukul|pkl\.?)\s*(\d{1,2})(?:[.:](\d{2}))?\s*(pagi|siang|sore|malam)?/.exec(t)
    || /\b(\d{1,2})[.:](\d{2})\b\s*(pagi|siang|sore|malam)?/.exec(t);
  if (!m) return null;
  let h = +m[1];
  const min = +(m[2] || 0);
  const part = m[3];
  if (part === 'siang' && h < 11) h += 12;
  if ((part === 'sore' || part === 'malam') && h < 12) h += 12;
  if (part === 'malam' && h === 24) h = 0;
  if (h > 23 || min > 59) return null;
  return { h, min, match: m[0] };
}

function readDate(text: string, now: Date): { date: Date; match: string; sameWeekday?: boolean } | null {
  const t = text.toLowerCase();
  const rules: [RegExp, () => number | 'month'][] = [
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
    const word = m[2];
    const mi = word ? months.findIndex(p => word.startsWith(p) || (p === 'agu' && word === 'ags')) : -1;
    if (day >= 1 && day <= 31) {
      let date = new Date(now.getFullYear(), mi >= 0 ? mi : now.getMonth(), day);
      if (date < at(now, 0, 0, 0)) date = mi >= 0 ? new Date(now.getFullYear() + 1, mi, day) : new Date(now.getFullYear(), now.getMonth() + 1, day);
      return { date, match: m[0] };
    }
  }
  m = /\b(?:hari\s+)?(senin|selasa|rabu|kamis|jum'?at|sabtu|minggu)\b/.exec(t);
  if (m) {
    const target = days.indexOf(m[1].replace("'", ''));
    const diff = (target - now.getDay() + 7) % 7;
    return { date: at(now, diff, 0, 0), match: m[0], sameWeekday: diff === 0 };
  }
  return null;
}

function tidy(title: string, found: (string | undefined)[]) {
  let s = title;
  for (const p of found) if (p) s = s.replace(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' ');
  s = s.replace(/\s+(pada|di|ke|untuk)\s*$/i, '').replace(/^\s*(jangan lupa|inget|ingat)\s+/i, '').replace(/\s{2,}/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

export interface Parsed { title: string; kind: 'agenda' | 'note'; time: string; source: string }
export function parseDump(text: string, now = new Date()): Parsed[] {
  return String(text || '').split(/\n|;/)
    .map(line => line.replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, '').trim())
    .filter(line => line.length > 1)
    .slice(0, 30)
    .map(line => {
      const time = readTime(line), date = readDate(line, now);
      let when: Date | null = null;
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
// Satu ungkapan waktu saja ("besok jam 9", "Jumat jam empat sore" ditulis angka): dipakai saat
// Iqlima membalas pertanyaan Mimi soal kapan diingatkan.
export function parseWhen(text: string, now: Date): string {
  const t = text.toLowerCase();
  if (!readTime(t) && !readDate(t, now)) return '';
  return parseDump(text.replace(/\n/g, ' '), now)[0]?.time || '';
}

export type Repeat = 'daily' | 'weekly' | 'monthly';
export function nextOccurrence(item: { time: string; repeat?: string; repeatDay?: number }, now = new Date()) {
  const start = parseLocal(item.time);
  if (!start || !['daily', 'weekly', 'monthly'].includes(item.repeat || '')) return null;
  const want = item.repeatDay || start.getDate();
  let next = start;
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
