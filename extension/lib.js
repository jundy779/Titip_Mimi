// Logika murni extension Titip ke Mimi. Tidak menyentuh API chrome agar bisa dites di Node.

export const mimiUrl = 'https://ruang-iqlima-mimi.oakrose8.chatgpt.site/';
export const queueKey = 'mimiQueue';
export const maxQueue = 50;
export const methods = ['Google', 'Email dan kata sandi', 'Apple', 'Nomor HP', 'Lainnya', 'Belum diisi'];

// Dijalankan di tab aktif hanya saat Iqlima membuka popup (izin activeTab).
// Harus berdiri sendiri karena dikirim lewat chrome.scripting.executeScript.
// Tidak pernah membaca isi kolom kata sandi.
export function readPage() {
  const visible = el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  };
  const meta = name => document.querySelector(`meta[property="${name}"],meta[name="${name}"]`)?.content?.trim() || '';
  const fields = Array.from(document.querySelectorAll('input')).filter(visible);
  const identityField = fields.find(f => f.type === 'email' && f.value)
    || fields.find(f => f.type !== 'password' && /email|user|login|akun/i.test([f.name, f.id, f.autocomplete, f.placeholder].join(' ')) && f.value);
  const text = Array.from(document.querySelectorAll('button,a,[role=button]')).filter(visible)
    .map(b => (b.textContent || '') + ' ' + (b.getAttribute('aria-label') || '')).join(' ').toLowerCase();
  return {
    host: location.hostname,
    siteName: meta('og:site_name') || meta('application-name'),
    title: document.title.slice(0, 120),
    identity: identityField ? String(identityField.value).slice(0, 160) : '',
    hasPassword: fields.some(f => f.type === 'password'),
    hasPhone: fields.some(f => f.type === 'tel'),
    google: /(google)/.test(text),
    apple: /(apple)/.test(text),
  };
}

const known = {
  'google.com': 'Google', 'youtube.com': 'YouTube', 'github.com': 'GitHub', 'gitlab.com': 'GitLab',
  'linkedin.com': 'LinkedIn', 'tiktok.com': 'TikTok', 'paypal.com': 'PayPal', 'whatsapp.com': 'WhatsApp',
  'live.com': 'Microsoft', 'microsoft.com': 'Microsoft', 'office.com': 'Microsoft 365', 'icloud.com': 'iCloud',
  'x.com': 'X', 'twitter.com': 'X', 'chatgpt.com': 'ChatGPT', 'openai.com': 'OpenAI', 'claude.ai': 'Claude',
};
const twoPartTld = /\.(co|ac|or|go|my|web|sch|net|com|org|gov|edu)\.[a-z]{2}$/;

export function baseDomain(host = '') {
  const clean = host.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  const parts = clean.split('.');
  return parts.slice(twoPartTld.test(clean) ? -3 : -2).join('.');
}

export function guessService(page = {}) {
  const domain = baseDomain(page.host || '');
  if (known[domain]) return known[domain];
  const site = (page.siteName || '').trim();
  if (site && site.length <= 40) return site;
  const name = domain.split('.')[0] || '';
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : '';
}

export function guessMethod(page = {}) {
  if (page.google && !page.hasPassword) return 'Google';
  if (page.apple && !page.hasPassword) return 'Apple';
  if (page.hasPassword) return 'Email dan kata sandi';
  if (page.hasPhone) return 'Nomor HP';
  if (page.google) return 'Google';
  return 'Belum diisi';
}

// Email/label akun yang terlihat seperti kata sandi (angka + simbol, tanpa spasi atau @).
export function looksLikeSecret(value = '') {
  const v = value.trim();
  if (v.includes('@') || /\s/.test(v)) return false;
  return v.length >= 8 && /\d/.test(v) && /[^\w.@-]/.test(v);
}

export function newCard({ title, identity, method, site }, uuid, now = new Date()) {
  const clean = (value, max) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  const card = {
    id: uuid, title: clean(title, 100), identity: clean(identity, 160),
    method: methods.includes(method) ? method : 'Belum diisi', site: clean(site, 120), savedAt: now.toISOString(),
  };
  if (!card.title) throw new Error('Isi nama layanan dulu, ya.');
  if (!card.identity) throw new Error('Isi email atau label akun dulu, ya.');
  return card;
}

export function addToQueue(queue, card) {
  const list = Array.isArray(queue) ? queue : [];
  const same = list.find(c => c.title.toLowerCase() === card.title.toLowerCase() && c.identity === card.identity);
  if (same) return { queue: list, duplicate: true };
  if (list.length >= maxQueue) throw new Error('Antrean Mimi penuh. Buka Titip Mimi dulu supaya kartunya dibawa, ya.');
  return { queue: [...list, card], duplicate: false };
}

export function removeFromQueue(queue, ids) {
  const drop = new Set(ids);
  return (Array.isArray(queue) ? queue : []).filter(card => !drop.has(card.id));
}
