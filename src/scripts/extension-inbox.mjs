// Menerima kartu akun dari extension "Titip ke Mimi" lewat window.postMessage.
// Extension hanya mengirim petunjuk masuk: nama layanan, email/label, dan cara masuk.
// Semua isian diperiksa ulang di sini karena pesan datang dari luar kode halaman.

export const methods = ['Google', 'Email dan kata sandi', 'Apple', 'Nomor HP', 'Lainnya', 'Belum diisi'];
const maxCards = 50;

const text = (value, max) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';

export function inboxMessage(data) {
  if (!data || data.type !== 'titip-mimi-inbox' || !Array.isArray(data.cards)) return null;
  return data.cards.slice(0, maxCards);
}

export function cleanCard(raw, now = new Date()) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id, 64);
  const title = text(raw.title, 100);
  const identity = text(raw.identity, 160);
  if (!/^[\w-]{8,64}$/.test(id) || !title || !identity) return null;
  const method = methods.includes(raw.method) ? raw.method : 'Belum diisi';
  const at = typeof raw.savedAt === 'string' && !Number.isNaN(Date.parse(raw.savedAt)) && Date.parse(raw.savedAt) <= now.getTime()
    ? new Date(raw.savedAt).toISOString() : now.toISOString();
  const site = text(raw.site, 120);
  return {
    kind: 'account', title, identity, method, note: site ? 'Dititip dari ' + site : '', time: '', done: false,
    extensionId: id, history: [{ label: 'Dititip dari browser', at }],
  };
}

const key = card => JSON.stringify([card.title.trim().toLowerCase(), (card.identity || '').trim()]);

// accepted: ID yang boleh dihapus dari antrean extension (baru maupun duplikat).
export function mergeInbox(rawCards, items, now = new Date()) {
  const accounts = items.filter(item => item.kind === 'account');
  const seenIds = new Set(accounts.map(item => item.extensionId).filter(Boolean));
  const seenKeys = new Set(accounts.map(key));
  const added = [], accepted = [];
  for (const raw of rawCards) {
    const card = cleanCard(raw, now);
    if (!card) continue;
    accepted.push(card.extensionId);
    if (seenIds.has(card.extensionId) || seenKeys.has(key(card))) continue;
    seenIds.add(card.extensionId); seenKeys.add(key(card));
    added.push(card);
  }
  return { added, accepted, next: added.length ? [...added, ...items] : items };
}
