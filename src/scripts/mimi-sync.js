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

  // Fitur lain bisa membereskan diri sebelum sesi berakhir (misalnya mencabut notifikasi perangkat ini).
  const logoutHooks = [];
  async function logout() {
    for (const fn of logoutHooks) { try { await fn(); } catch {} }
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
    $('[data-app-link]').hidden = !state.user;
    ask.hidden = !state.user || state.migrated;
    $('[data-migrate-text]').textContent = 'Pindahkan ' + count + ' titipan dari browser ini ke akunmu? Titipan di browser tetap ada.';
    button.hidden = Boolean(state.user);
    if (tgBox?.isConnected && Boolean(tg) !== Boolean(state.user)) void refreshTelegram();
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
    // Aplikasi HP masuk dengan kode sekali pakai dari sini, tanpa login Google di HP.
    el.querySelector('[data-app-code]').onclick = async () => {
      const box = el.querySelector('[data-app-out]');
      try {
        const { code } = await call('/v1/auth/device-code', {});
        const server = apiBase || location.origin;
        box.hidden = false;
        box.replaceChildren('Di aplikasi Titip Mimi, buka Profil lalu isi bagian Akun Titip Mimi:', document.createElement('br'),
          'Alamat server: ', Object.assign(document.createElement('b'), { textContent: server }), document.createElement('br'),
          'Kode: ', Object.assign(document.createElement('b'), { className: 'app-code', textContent: code.slice(0, 4) + '-' + code.slice(4) }), ' (10 menit, sekali pakai)');
      } catch (e) { notify(e.message || 'Kode belum bisa dibuat.'); }
    };
    renderProfile();
  }

  // ---------- Telegram di Profil ----------
  // Status diambil dari server. Tautan "Hubungkan" sekali pakai dan berlaku 10 menit.
  let tg = null, tgBox = null, tgNote = '', tgPoll = 0, tgReplacing = false;
  const clock = m => m == null ? '' : String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  const minutes = v => { const m = /^(\d{2}):(\d{2})$/.exec(v || ''); return m ? +m[1] * 60 + +m[2] : null; };
  async function refreshTelegram() {
    if (!enabled || !state.user) { tg = null; renderTelegram(); return; }
    try { tg = await api('/v1/telegram'); } catch (error) { tg = null; tgNote = error.status === 503 || error.status === 404 ? '' : 'Status Telegram belum bisa dimuat.'; }
    renderTelegram();
  }
  function renderTelegram() {
    if (!tgBox?.isConnected) return;
    const $ = sel => tgBox.querySelector(sel);
    const text = $('[data-telegram-status]'), linkBtn = $('[data-telegram-link]'), quiet = $('[data-telegram-quiet]'), cut = $('[data-telegram-unlink]');
    const form = $('[data-bot-form]'), line = $('[data-bot-line]'), manage = $('[data-bot-manage]');
    linkBtn.hidden = quiet.hidden = cut.hidden = line.hidden = manage.hidden = true;
    form.hidden = !tgReplacing;
    if (!enabled || !state.user) { form.hidden = true; text.textContent = 'Masuk dengan akun Google dulu. Setelah itu Telegram bisa dihubungkan, dan foto nota yang kamu kirim ke Mimi muncul di sini.'; return; }
    if (!tg) { text.textContent = tgNote || 'Memuat status Telegram…'; return; }
    const bot = tg.bot || {};
    if (!tg.enabled) {
      form.hidden = !bot.canInstall;
      $('[data-bot-save]').textContent = 'Pasang bot';
      text.textContent = tgNote || (bot.canInstall ? 'Mimi belum punya bot Telegram. Bikin dulu di BotFather (sekitar 5 menit, ada panduannya di bawah), lalu tempel tokennya di sini.' : 'Bot Telegram belum dipasang. Minta yang punya akses server untuk memasangnya.');
      return;
    }
    if (bot.username) {
      line.hidden = false;
      line.replaceChildren('Bot Mimi: ', Object.assign(document.createElement('a'), { href: 'https://t.me/' + bot.username, textContent: '@' + bot.username, target: '_blank', rel: 'noopener' }));
    }
    manage.hidden = !(bot.mine && bot.source === 'profil');
    if (tgReplacing) $('[data-bot-save]').textContent = 'Simpan token baru';
    if (!tg.linked) {
      text.textContent = tgNote || 'Belum terhubung. Setelah terhubung, kirim teks, foto nota, video, atau dokumen ke Mimi di Telegram, dan pengingat datang lewat Telegram juga.';
      linkBtn.hidden = false;
      return;
    }
    clearInterval(tgPoll); tgNote = '';
    text.textContent = 'Tersambung' + (tg.username ? ' ke @' + tg.username : '') + ' ♡ Kirim apa saja ke Mimi di Telegram, nanti muncul di Koleksi.';
    quiet.hidden = cut.hidden = false;
    const off = tg.quietStart == null || tg.quietStart === tg.quietEnd;
    $('[data-quiet-off]').checked = off;
    $('[data-quiet-start]').value = clock(off ? 1320 : tg.quietStart);
    $('[data-quiet-end]').value = clock(off ? 360 : tg.quietEnd);
    $('[data-quiet-start]').disabled = $('[data-quiet-end]').disabled = off;
  }
  async function linkTelegram() {
    const pending = window.open('', '_blank');
    try {
      const { url } = await api('/v1/telegram/link', {});
      if (pending) pending.location.href = url; else location.href = url;
      tgNote = 'Telegram terbuka. Ketuk Mulai (Start) di sana, lalu kembali ke sini ♡';
      renderTelegram();
      clearInterval(tgPoll);
      const until = Date.now() + 10 * 60000;
      tgPoll = setInterval(() => { if (Date.now() > until || tg?.linked) clearInterval(tgPoll); else if (!document.hidden) void refreshTelegram(); }, 3000);
    } catch (error) {
      pending?.close();
      tgNote = error.message || 'Belum bisa membuat tautan Telegram.'; renderTelegram();
    }
  }
  async function saveQuiet() {
    const $ = sel => tgBox.querySelector(sel);
    const off = $('[data-quiet-off]').checked;
    const body = off ? { quietStart: null, quietEnd: null } : { quietStart: minutes($('[data-quiet-start]').value), quietEnd: minutes($('[data-quiet-end]').value) };
    if (!off && (body.quietStart == null || body.quietEnd == null)) return;
    try { tg = await api('/v1/telegram/settings', body); notify(off ? 'Jam tenang dimatikan.' : 'Jam tenang ' + clock(body.quietStart) + ' sampai ' + clock(body.quietEnd) + ' ♡'); }
    catch (error) { notify(error.message || 'Jam tenang belum tersimpan.'); }
    renderTelegram();
  }
  async function unlinkTelegram() {
    try { await api('/v1/telegram/unlink', {}); notify('Telegram sudah diputus. Titipanmu tetap aman.'); } catch (error) { notify(error.message || 'Belum bisa memutus Telegram.'); }
    await refreshTelegram();
  }
  async function installBot(event) {
    event.preventDefault();
    const input = tgBox.querySelector('[data-bot-token]'), save = tgBox.querySelector('[data-bot-save]');
    if (!input.value.trim()) { input.focus(); return; }
    save.disabled = true; tgNote = 'Mimi lagi kenalan sama botnya…'; renderTelegram();
    try {
      tg = await api('/v1/telegram/bot', { token: input.value });
      input.value = ''; tgReplacing = false; tgNote = '';
      notify('Bot @' + tg.bot.username + ' terpasang ♡ Sekarang tekan Hubungkan Telegram.');
    } catch (error) { tgNote = error.message || 'Bot belum bisa dipasang. Coba lagi, ya.'; }
    save.disabled = false;
    renderTelegram();
  }
  async function removeBot() {
    if (!confirm('Lepas bot @' + (tg?.bot?.username || '') + '? Sambungan Telegram diputus, titipan tetap aman.')) return;
    try { await api('/v1/telegram/bot/remove', {}); notify('Bot dilepas. Titipanmu tetap aman ♡'); } catch (error) { notify(error.message || 'Bot belum bisa dilepas.'); }
    tgReplacing = false; tgNote = '';
    await refreshTelegram();
  }
  function mountTelegram(el) {
    tgBox = el;
    el.querySelector('[data-bot-form]').onsubmit = installBot;
    el.querySelector('[data-bot-peek]').onclick = e => {
      const input = el.querySelector('[data-bot-token]'), show = input.type === 'password';
      input.type = show ? 'text' : 'password'; e.target.textContent = show ? 'Tutup' : 'Lihat'; e.target.setAttribute('aria-pressed', String(show));
    };
    el.querySelector('[data-bot-replace]').onclick = () => { tgReplacing = true; tgNote = 'Tempel token baru dari BotFather.'; renderTelegram(); el.querySelector('[data-bot-token]').focus(); };
    el.querySelector('[data-bot-remove]').onclick = () => removeBot();
    el.querySelector('[data-telegram-link]').onclick = () => linkTelegram();
    el.querySelector('[data-telegram-unlink]').onclick = () => unlinkTelegram();
    for (const sel of ['[data-quiet-start]', '[data-quiet-end]', '[data-quiet-off]']) el.querySelector(sel).onchange = () => saveQuiet();
    renderTelegram();
    void refreshTelegram();
  }

  // Lampiran dari Telegram. Satu domain: cookie sesi cukup. Beda domain: ambil dengan token lalu jadikan blob.
  const mediaCache = new Map();
  function media(id) {
    if (!enabled || !state.user || !/^[\w-]{1,100}$/.test(id)) return Promise.reject(new Error('Masuk dulu untuk membuka lampiran.'));
    if (!crossOrigin) return Promise.resolve(apiBase + '/v1/media/' + id);
    if (!mediaCache.has(id)) {
      mediaCache.set(id, fetch(apiBase + '/v1/media/' + id, { headers: token() ? { Authorization: 'Bearer ' + token() } : {} })
        .then(r => { if (!r.ok) throw new Error(r.status === 413 ? 'File ini lebih dari 20 MB. Buka dari Telegram, ya.' : 'Lampiran belum bisa dibuka.'); return r.blob(); })
        .then(b => URL.createObjectURL(b))
        .catch(e => { mediaCache.delete(id); throw e; }));
    }
    return mediaCache.get(id);
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
  // Panggilan API untuk fitur lain (pasangan, surat, rencana). Sesi habis berarti keluar dengan rapi.
  async function call(path, body) {
    if (!enabled || !state.user) throw new Error('Masuk dulu, ya.');
    try { return await api(path, body); }
    catch (error) { if (error.status === 401) signedOut('Sesi berakhir. Masuk lagi, ya.'); throw error; }
  }

  return { stamp, schedule, sync, call, apiBase, onLogout: fn => logoutHooks.push(fn), mountProfile, mountTelegram, media, get state() { return state; }, enabled };
}
