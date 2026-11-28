// Sifat Mimi: mood, kebiasaan saat dibiarkan, tidur mengikuti jam, dan ingatan kecil.
// Aturan suara sama dengan Mimi manja: Mimi senang ditemani dan tidak pernah menyalahkan
// Iqlima karena sibuk atau lama tidak datang.

export const lifeKey = 'mimi-life-v1';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const HOUR = 3600000;

export const moods = {
  kangen: { label: 'Seneng kamu datang', icon: '♡' },
  ceria: { label: 'Ceria', icon: '☀' },
  manja: { label: 'Lagi manja', icon: '♡' },
  ngantuk: { label: 'Ngantuk', icon: '☾' },
  kenyang: { label: 'Kenyang', icon: '🐟' },
  semangat: { label: 'Semangat main', icon: '🧶' },
};

export const favoriteLines = {
  play: 'Main benang lagi, yuk? Itu kesukaan kita ♡',
  feed: 'Mimi inget, kamu suka nyuapin Mimi ♡',
  wash: 'Mau main busa lagi? Mimi udah siap wangi ♡',
  chat: 'Mimi kangen dengerin ceritamu ♡',
  pet: 'Sini, kepala Mimi siap dielus ♡',
};
const activityOf = { play: 'play', feed: 'feed', wash: 'wash', chat: 'chat', pet: 'pet', highfive: 'play', peek: 'play' };
const bondGain = { play: 4, feed: 2, wash: 3, chat: 4, pet: 3, highfive: 2, peek: 2 };
const energyGain = { play: -6, feed: 8, wash: -2, chat: 0, pet: 1, highfive: -1, peek: -1 };

export function readLife(storage, now = Date.now()) {
  let raw = {};
  try { raw = JSON.parse(storage?.getItem(lifeKey) || '{}') || {}; } catch { raw = {}; }
  const num = (v, d) => Number.isFinite(v) ? v : d;
  const counts = {};
  for (const k of Object.keys(favoriteLines)) counts[k] = Math.max(0, num(raw.counts?.[k], 0));
  return {
    affection: clamp(num(raw.affection, 60), 0, 100),
    energy: clamp(num(raw.energy, 80), 0, 100),
    lastSeen: num(raw.lastSeen, 0),
    lastPlay: num(raw.lastPlay, 0),
    lastFed: num(raw.lastFed, 0),
    counts,
  };
}

export function writeLife(storage, life) {
  try { storage?.setItem(lifeKey, JSON.stringify(life)); return true; } catch { return false; }
}

// Waktu berlalu saat Iqlima tidak membuka Kamar Mimi: Mimi beristirahat dan jadi pengen dimanja.
export function arrive(life, now = Date.now()) {
  const away = life.lastSeen ? Math.max(0, (now - life.lastSeen) / HOUR) : 0;
  return {
    ...life,
    energy: clamp(life.energy + away * 10, 0, 100),
    affection: clamp(life.affection - away * 2, 35, 100),
    lastSeen: now,
    welcomeBack: life.lastSeen > 0 && away >= 24,
  };
}

export function favorite(life) {
  const [best, n] = Object.entries(life.counts).sort((a, b) => b[1] - a[1])[0] || [];
  return n >= 3 ? best : null;
}

export function moodOf(life, date = new Date(), { welcome = false, full = false } = {}) {
  if (welcome) return 'kangen';
  const h = date.getHours();
  if (h >= 22 || h < 5 || life.energy < 25) return 'ngantuk';
  if (full) return 'kenyang';
  if (life.affection < 55) return 'manja';
  if (life.energy > 70 && date.getTime() - life.lastPlay > 20 * 60000) return 'semangat';
  return 'ceria';
}

export function greetingOf(life, mood) {
  if (mood === 'kangen') return 'Yeay, kamu datang! Mimi lompat-lompat seneng ♡';
  if (mood === 'ngantuk') return 'Mimi udah ngantuk, tapi seneng kamu nemenin ♡';
  const fav = favorite(life);
  if (fav) return favoriteLines[fav];
  if (mood === 'manja') return 'Mimi ndusel-ndusel, pengen dielus ♡';
  if (mood === 'semangat') return 'Mimi lagi semangat. Main benang, yuk!';
  return 'Psst, sini duduk sama Mimi ♡';
}

// Bobot kebiasaan per mood. Jalan-jalan hanya saat mode main.
const habits = {
  ngantuk: { sleep: 6, yawn: 2.5, groom: 1.5 },
  manja: { ask: 3.5, look: 2, groom: 2, stretch: 1 },
  semangat: { wander: 4.5, stretch: 2, look: 2, groom: 1.5 },
  kenyang: { groom: 4, yawn: 2, sleep: 1.5, look: 2 },
  ceria: { groom: 3, look: 3, wander: 2.5, stretch: 1.5, yawn: 1 },
  kangen: { ask: 3, look: 2, wander: 2 },
};
export const durations = { groom: 3.4, stretch: 2.4, yawn: 1.7, look: 3.2, ask: 2.6, sleep: 45, wander: 6 };
export const idleLines = {
  ask: 'Mimi ndusel… elus dong ♡',
  sleep: 'Mimi ketiduran… zzz',
  wake: 'Mimi bangun, ngucek mata ♡',
};

export function pickHabit(mood, { canWander = false, random = Math.random } = {}) {
  const entries = Object.entries(habits[mood] || habits.ceria).filter(([k]) => canWander || k !== 'wander');
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = random() * total;
  for (const [k, w] of entries) { if ((r -= w) <= 0) return k; }
  return entries.at(-1)[0];
}

export function createLife(storage = globalThis.localStorage, now = Date.now(), random = Math.random) {
  let life = arrive(readLife(storage, now), now);
  const welcome = life.welcomeBack;
  delete life.welcomeBack;
  let welcomeUntil = welcome ? now + 20000 : 0;
  let full = false, lastInput = now, idleAt = 5 + random() * 4, idle = 0;
  let habit = null, habitT = 0, habitDur = 0, wanderTo = 0, lastAsk = -Infinity, lastSaved = now;
  writeLife(storage, life);
  const save = (t) => { life.lastSeen = t; writeLife(storage, life); lastSaved = t; };

  function mood(t = Date.now()) {
    return moodOf(life, new Date(t), { welcome: t < welcomeUntil, full });
  }

  return {
    get life() { return life; },
    get habit() { return habit; },
    mood,
    greeting(t = Date.now()) { return greetingOf(life, mood(t)); },
    setFull(v) { full = Boolean(v); },
    // Interaksi yang membuat Mimi makin dekat.
    bond(kind, t = Date.now()) {
      life.affection = clamp(life.affection + (bondGain[kind] || 1), 0, 100);
      life.energy = clamp(life.energy + (energyGain[kind] || 0), 0, 100);
      const a = activityOf[kind];
      if (a) life.counts[a] = (life.counts[a] || 0) + 1;
      if (a === 'play') life.lastPlay = t;
      if (kind === 'feed') life.lastFed = t;
      save(t);
    },
    // Untuk uji dan pratinjau: mulai satu kebiasaan sekarang.
    force(name) { habit = name; habitT = 0; habitDur = durations[name]; idle = 0; if (name === 'wander') wanderTo = 1; },
    // Sentuhan apa pun menghentikan kebiasaan. Mengembalikan 'wake' bila Mimi dibangunkan.
    poke(t = Date.now()) {
      lastInput = t; idle = 0; idleAt = 5 + random() * 4;
      const was = habit;
      habit = null; habitT = 0;
      return was === 'sleep' ? 'wake' : was;
    },
    // Dipanggil tiap frame. Mengisi s.habit, s.habitT, s.lookAt, dan menggerakkan Mimi saat jalan-jalan.
    update(dt, s, t = Date.now()) {
      const busy = s.drag || s.gesture !== 'idle' || (s.mode === 'play' && s.motion !== 'rest');
      if (busy) { if (habit) this.poke(t); }
      else idle += dt;
      if (!habit && !busy && idle > idleAt) {
        const m = mood(t);
        const canWander = s.mode === 'play';
        habit = pickHabit(m, { canWander, random });
        if (habit === 'ask' && t - lastAsk < 45000) habit = 'look';
        habitT = 0; habitDur = durations[habit];
        if (habit === 'wander') {
          const options = [-1, -.45, .45, 1].filter(x => Math.abs(x - s.catX) > .5 && Math.abs(x - (s.ballX ?? 9)) > .5);
          wanderTo = options[Math.floor(random() * options.length)] ?? 0;
        }
        if (habit === 'ask') lastAsk = t;
        this.started = habit;
      } else this.started = null;
      s.lookAt = null;
      if (habit) {
        habitT += dt;
        if (habit === 'look') { s.lookAt = Math.sin(habitT / habitDur * Math.PI * 2) * .85; }
        if (habit === 'ask') { s.lookAt = 0; }
        if (habit === 'wander') {
          const gap = wanderTo - s.catX;
          s.running = Math.abs(gap) > .04;
          if (s.running) { s.catX += Math.sign(gap) * Math.min(Math.abs(gap), dt * .55); s.face += (Math.sign(gap) * .55 - s.face) * Math.min(1, 6 * dt); }
          else s.face += (0 - s.face) * Math.min(1, 4 * dt);
          if (!s.running && habitT > 1) habitT = Math.max(habitT, habitDur);
        }
        if (habitT >= habitDur) {
          const ended = habit;
          habit = null; idle = 0; idleAt = 6 + random() * 6; s.running = false;
          if (ended === 'sleep') { habit = 'yawn'; habitT = 0; habitDur = durations.yawn; }
        }
      } else if (s.mode === 'play' && s.motion === 'rest' && !s.drag) {
        s.face += (0 - s.face) * Math.min(1, 3 * dt);
      }
      s.habit = habit;
      s.habitT = habit ? clamp(habitT / habitDur, 0, 1) : 0;
      if (t - lastSaved > 30000) save(t);
    },
  };
}
