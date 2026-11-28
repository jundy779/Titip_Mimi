// Sinkron Titip Mimi: login Google, pindahkan titipan browser atas persetujuan, lalu sinkron otomatis.
// Titipan tetap tersimpan di browser (bisa dipakai offline); server menjadi salinan bersama antarperangkat.
// Tanpa konfigurasi PUBLIC_GOOGLE_CLIENT_ID, semua fungsi ini diam dan web berjalan lokal seperti biasa.

const stateKey = 'titip-mimi-sync-v1';
const tokenKey = 'titip-mimi-session';
const apiBase = (import.meta.env.PUBLIC_MIMI_API || '').replace(/\/$/, '');
const googleClientId = import.meta.env.PUBLIC_GOOGLE_CLIENT_ID || '';
const crossOrigin = Boolean(apiBase) && new URL(apiBase, location.href).origin !== location.origin;
const uuid = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
const strip = ({ seq, deleted, ...item }) => item;

function readState() {
  try {
    const s = JSON.parse(localStorage.getItem(stateKey) || '{}');
    return { user: s.user || null, cursor: s.cursor || 0, migrated: Boolean(s.migrated), dirty: Array.isArray(s.dirty) ? s.dirty : [], tombstones: Array.isArray(s.tombstones) ? s.tombstones : [], lastSync: s.lastSync || 0 };
  } catch { return { user: null, cursor: 0, migrated: false, dirty: [], tombstones: [], lastSync: 0 }; }
}

export function createSync({ getItems, setItems, notify = () => {} }) {
  let state = readState();
  let status = '', timer = 0, running = null, again = false, profile = null;
  const enabled = Boolean(googleClientId);
  const persist = () => { try { localStorage.setItem(stateKey, JSON.stringify(state)); } catch {} };
  const token = () => { try { return localStorage.getItem(tokenKey) || ''; } catch { return ''; } };

  async function api(path, body) {
    const headers = { 'Content-Type': 'application/json', 'X-Mimi': '1' };
    if (crossOrigin) { headers['X-Mimi-Client'] = 'token'; if (token()) headers.Authorization = 'Bearer ' + token(); }
    const res = await fetch(apiBase + path, {
      method: body === undefined ? 'GET' : 'POST', headers, credentials: crossOrigin ? 'omit' : 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
    if (!res.ok) { const error = new Error(data.message || 'Gagal'); error.status = res.status; error.code = data.code; throw error; }
    return data;
  }

  // Dipanggil sebelum titipan disimpan di browser: beri ID, tandai yang berubah, catat yang dihapus.
  function stamp(prev, next) {
    const now = Date.now();
    const before = new Map(prev.filter(i => i.clientId).map(i => [i.clientId, i]));
    const dirty = new Set(state.dirty);
    const out = next.map(item => {
      const id = item.clientId || uuid();
      const old = before.get(id);
      before.delete(id);
      const { updatedAt, ...rest } = item;
      if (old && JSON.stringify({ ...strip(old), updatedAt: 0 }) === JSON.stringify({ ...rest, clientId: id, updatedAt: 0 })) return { ...item, clientId: id };
      if (!old && item.demo) return { ...item, clientId: id };
      // Contoh bawaan yang diubah Iqlima menjadi titipan sungguhan.
      delete rest.demo;
      dirty.add(id);
      return { ...rest, clientId: id, updatedAt: now };
    });
    for (const [id, old] of before) {
      if (old.demo) continue;
      state.tombstones.push({ clientId: id, deleted: true, updatedAt: now });
      dirty.delete(id);
    }
    state.dirty = [...dirty];
    persist();
    return out;
  }

  function ready() { return enabled && state.user && state.migrated; }
  const realItems = () => getItems().filter(i => !i.demo);

  function schedule(delay = 800) {
    if (!ready()) return;
    clearTimeout(timer);
    timer = setTimeout(() => { void sync(); }, delay);
  }

  function setStatus(text) { status = text; renderProfile(); }

  // Gabungkan data server ke browser: versi yang lebih baru menang, sama seperti di server.
  function merge(remote) {
    if (!remote.length) return;
    const local = getItems();
    const byId = new Map(local.map((item, index) => [item.clientId, index]));
    const next = local.slice();
    const removed = new Set();
    let changed = false;
    for (const r of remote) {
      const index = byId.get(r.clientId);
      const mine = index === undefined ? null : next[index];
      if (mine && (mine.updatedAt || 0) > r.updatedAt) continue;
      if (r.deleted) { if (mine) { removed.add(r.clientId); changed = true; } continue; }
      const item = strip(r);
      if (mine && mine.updatedAt === r.updatedAt && JSON.stringify(mine) === JSON.stringify(item)) continue;
      if (mine) next[index] = item; else next.unshift(item);
      state.dirty = state.dirty.filter(id => id !== r.clientId);
      changed = true;
    }
    if (changed) setItems(next.filter(item => !removed.has(item.clientId)));
  }

  async function sync() {
    if (!ready()) return;
    if (running) { again = true; return running; }
    running = (async () => {
      setStatus('Menyinkronkan…');
      try {
        do {
          again = false;
          const dirty = new Set(state.dirty);
          const tombs = state.tombstones.slice();
          const changes = [...getItems().filter(i => dirty.has(i.clientId)), ...tombs].slice(0, 500);
          const sentAt = new Map(changes.map(c => [c.clientId, c.updatedAt]));
          const res = await api('/v1/sync', { changes, since: state.cursor });
          // Hanya hapus tanda "belum terkirim" bila titipan tidak berubah lagi selama permintaan berjalan.
          const done = new Set(res.results.filter(r => r.status !== 'invalid').map(r => r.clientId));
          const current = new Map(getItems().map(i => [i.clientId, i.updatedAt]));
          state.dirty = state.dirty.filter(id => !(done.has(id) && current.get(id) === sentAt.get(id)));
          state.tombstones = state.tombstones.filter(t => !(tombs.includes(t) && done.has(t.clientId)));
          merge(res.items);
          state.cursor = res.cursor;
          state.lastSync = Date.now();
          persist();
          if (res.more || state.dirty.length > 0 && changes.length === 500) again = true;
        } while (again);
        setStatus('');
      } catch (error) {
        if (error.status === 401) { signedOut('Sesi berakhir. Masuk lagi, ya.'); }
        else setStatus(navigator.onLine === false ? 'Sedang offline. Titipan aman di browser, nanti Mimi coba lagi.' : 'Belum bisa sinkron. Mimi coba lagi sebentar lagi.');
      } finally { running = null; }
    })();
    return running;
  }

  async function login(credential) {
    try {
      setStatus('Memeriksa akun Google…');
      const res = await api('/v1/auth/google', { credential });
      if (res.token) try { localStorage.setItem(tokenKey, res.token); } catch {}
      const switched = state.user && state.user.id !== res.user.id;
      state = { ...state, user: res.user, ...(switched ? { cursor: 0, migrated: false } : {}) };
      // Browser tanpa titipan sungguhan tidak perlu ditanya: contoh bawaan dibuang, lalu langsung tersambung.
      if (!realItems().length) { if (getItems().length) setItems([]); state.migrated = true; }
      persist();
      setStatus('');
      notify(state.migrated ? 'Akun tersambung. Mimi ambil titipanmu dari akun ♡' : 'Akun tersambung ♡');
      if (state.migrated) await sync();
    } catch (error) {
      setStatus(error.message || 'Belum bisa masuk. Coba lagi, ya.');
    }
  }

  function signedOut(message = '') {
    state = { ...state, user: null };
    try { localStorage.removeItem(tokenKey); } catch {}
    persist();
    setStatus(message);
  }

  async function logout() {
    try { await api('/v1/auth/logout', {}); } catch {}
    signedOut('Sudah keluar. Titipan di browser ini tetap ada.');
  }

  async function migrate() {
    const items = realItems();
    if (items.length !== getItems().length) setItems(items);
    state.dirty = [...new Set([...state.dirty, ...items.map(i => i.clientId)])];
    state.migrated = true;
    persist();
    setStatus('Memindahkan ' + items.length + ' titipan…');
    await sync();
    if (!status) notify(items.length + ' titipan sudah tersimpan di akunmu ♡');
  }

  // ---------- Bagian Akun di Profil ----------
  let gisLoading = null;
  function loadGoogle() {
    if (globalThis.google?.accounts?.id) return Promise.resolve();
    gisLoading ||= new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true; script.onload = resolve; script.onerror = reject;
      document.head.append(script);
    });
    return gisLoading;
  }
  function renderProfile() {
    if (!profile?.isConnected) return;
    const $ = sel => profile.querySelector(sel);
    const text = $('[data-account-status]'), button = $('[data-google-button]'), ask = $('[data-migrate]'), out = $('[data-logout]');
    if (!enabled) {
      text.textContent = 'Login Google belum diaktifkan. Titipanmu tersimpan di browser ini.';
      button.hidden = ask.hidden = out.hidden = true;
      return;
    }
    const count = realItems().length;
    const when = state.lastSync ? new Date(state.lastSync).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';
    text.textContent = status || (state.user
      ? (state.migrated ? 'Masuk sebagai ' + state.user.email + '.' + (when ? ' Tersinkron ' + when + '.' : '') : 'Masuk sebagai ' + state.user.email + '.')
      : 'Masuk dengan Google supaya titipan muncul di HP dan laptop.');
    out.hidden = !state.user;
    ask.hidden = !state.user || state.migrated;
    $('[data-migrate-text]').textContent = 'Pindahkan ' + count + ' titipan dari browser ini ke akunmu? Titipan di browser tetap ada.';
    button.hidden = Boolean(state.user);
    if (!state.user && !button.dataset.ready) {
      button.dataset.ready = 'loading';
      loadGoogle().then(() => {
        google.accounts.id.initialize({ client_id: googleClientId, callback: r => login(r.credential), auto_select: false });
        google.accounts.id.renderButton(button, { theme: 'outline', shape: 'pill', text: 'signin_with', locale: 'id' });
        button.dataset.ready = 'yes';
      }).catch(() => { button.dataset.ready = ''; text.textContent = (status ? status + ' ' : '') + 'Tombol Google belum bisa dimuat. Cek koneksi atau pemblokir iklan, lalu buka Profil lagi.'; });
    }
  }
  function mountProfile(el) {
    profile = el;
    el.querySelector('[data-migrate-yes]').onclick = () => migrate();
    el.querySelector('[data-migrate-later]').onclick = () => { el.querySelector('[data-migrate]').hidden = true; notify('Oke, titipan tetap di browser ini dulu. Tawaran ini ada di Profil kapan saja.'); };
    el.querySelector('[data-logout]').onclick = () => logout();
    renderProfile();
  }

  // Titipan lama belum punya ID sinkron: beri ID tanpa mengubah waktu perubahan.
  const items = getItems();
  if (items.some(i => !i.clientId)) setItems(items.map(i => i.clientId ? i : { ...i, clientId: uuid(), updatedAt: i.updatedAt || 1 }), true);

  if (enabled) {
    setInterval(() => { if (!document.hidden) void sync(); }, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) void sync(); });
    addEventListener('online', () => void sync());
    if (ready()) void sync();
    if (location.search.includes('mimi-debug')) globalThis.__mimiLogin = login;
  }
  return { stamp, schedule, sync, mountProfile, get state() { return state; }, enabled };
}
