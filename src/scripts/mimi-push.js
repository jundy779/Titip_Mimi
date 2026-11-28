// Notifikasi walau web ditutup (Web Push). Butuh akun Mimi: server yang mengirim pengingat
// ke layanan push browser, jadi agenda dan jaga diri tetap sampai saat tab sudah ditutup.
import { worker } from './system-reminders.js';
import { defaultCare } from './iqlima.mjs';

const careKey = 'mimi-selfcare-v1';
const make = (tag, text = '', cls = '') => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n; };
const careSettings = () => { try { return { ...defaultCare, ...(JSON.parse(localStorage.getItem(careKey) || '{}').settings || {}) }; } catch { return { ...defaultCare }; } };
export const pushSupported = () => Boolean(globalThis.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in globalThis && 'Notification' in globalThis);
const keyBytes = b64 => Uint8Array.from(atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - b64.length % 4) % 4)), c => c.charCodeAt(0));
function deviceLabel() {
  const ua = navigator.userAgent;
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : 'Perangkat';
  const br = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return `${br} di ${os}`;
}

export function createPush({ sync, notify }) {
  const views = new Set();
  let info = null, busy = false, note = '';
  const signedIn = () => Boolean(sync.enabled && sync.state.user);

  async function current() {
    if (!pushSupported()) return null;
    try { return await (await worker()).pushManager.getSubscription(); } catch { return null; }
  }
  async function refresh() {
    if (!signedIn()) { info = null; render(); return; }
    try { info = { ...(await sync.call('/v1/push')), here: Boolean(await current()) }; } catch { info = info || null; }
    render();
  }
  // Pengaturan jaga diri ikut ke server, supaya pengingat minum dan makan bisa dikirim dari sana.
  async function pushCare() {
    if (!signedIn() || !info?.here) return;
    try { await sync.call('/v1/push/care', careSettings()); } catch {}
  }
  async function enable() {
    if (Notification.permission === 'denied') { note = 'Izin notifikasi diblokir. Buka pengaturan situs di browser, izinkan notifikasi, lalu coba lagi.'; render(); return; }
    if (await Notification.requestPermission() !== 'granted') { note = 'Izin notifikasi belum diberikan.'; render(); return; }
    const reg = await worker();
    const key = info?.publicKey || (await sync.call('/v1/push')).publicKey;
    let sub = await reg.pushManager.getSubscription();
    // Kunci server berubah (misalnya server baru): daftar ulang.
    if (sub && sub.options?.applicationServerKey) {
      const have = btoa(String.fromCharCode(...new Uint8Array(sub.options.applicationServerKey))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      if (have !== key) { await sub.unsubscribe(); sub = null; }
    }
    sub ||= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
    await sync.call('/v1/push/subscribe', { subscription: sub.toJSON(), label: deviceLabel() });
    try { localStorage.setItem('mimi-system-reminders-v1', 'on'); } catch {}
    info = { ...(await sync.call('/v1/push')), here: true };
    await pushCare();
    note = 'Siap ♡ Pengingat agenda dan jaga diri sampai walau web ditutup.';
  }
  async function disable() {
    const sub = await current();
    if (sub) { try { await sync.call('/v1/push/unsubscribe', { endpoint: sub.endpoint }); } catch {} await sub.unsubscribe().catch(() => {}); }
    info = info ? { ...info, here: false, devices: Math.max(0, (info.devices || 1) - 1) } : null;
    note = 'Notifikasi di perangkat ini dimatikan.';
  }
  async function act(fn) {
    if (busy) return;
    busy = true; render();
    try { await fn(); } catch (e) { note = e?.message && e.message !== 'Gagal' ? e.message : 'Belum berhasil. Coba lagi, ya.'; }
    busy = false; render();
  }

  function render() {
    for (const box of views) {
      if (!box.isConnected) { views.delete(box); continue; }
      const [text, toggle, test, out] = ['[data-push-status]', '[data-push-toggle]', '[data-push-test]', '[data-push-note]'].map(s => box.querySelector(s));
      toggle.hidden = test.hidden = true;
      out.textContent = note;
      if (!pushSupported()) { text.textContent = 'Browser ini belum bisa menerima notifikasi saat web ditutup. Di iPhone, tambahkan Ruang Iqlima ke Layar Utama dulu, lalu buka dari sana.'; continue; }
      if (!sync.enabled) { text.textContent = 'Butuh server Mimi. Sementara itu, pengingat muncul selama web terbuka, atau lewat Telegram.'; continue; }
      if (!signedIn()) { text.textContent = 'Masuk dengan Google dulu (di Profil). Setelah itu pengingat bisa sampai walau web ditutup.'; continue; }
      if (!info) { text.textContent = 'Memuat…'; continue; }
      const others = (info.devices || 0) - (info.here ? 1 : 0);
      text.textContent = (info.here ? 'Aktif di perangkat ini.' : 'Belum aktif di perangkat ini.') + (others > 0 ? ` Juga aktif di ${others} perangkat lain.` : '');
      toggle.hidden = false; toggle.disabled = busy;
      toggle.textContent = info.here ? 'Matikan di perangkat ini' : 'Aktifkan walau web ditutup';
      toggle.className = info.here ? 'quiet' : 'primary';
      test.hidden = !info.here; test.disabled = busy;
    }
  }

  function mount(box) {
    box.replaceChildren(
      make('h3', 'Walau web ditutup'),
      Object.assign(make('p', '', 'push-status'), { role: 'status' }),
      make('div', '', 'push-actions'),
      Object.assign(make('p', '', 'muted push-note'), { role: 'status' }),
    );
    const [status, actions, out] = [box.children[1], box.children[2], box.children[3]];
    status.dataset.pushStatus = ''; out.dataset.pushNote = '';
    const toggle = make('button'); toggle.type = 'button'; toggle.dataset.pushToggle = '';
    const test = make('button', 'Kirim tes', 'quiet'); test.type = 'button'; test.dataset.pushTest = '';
    actions.append(toggle, test);
    toggle.onclick = () => act(() => info?.here ? disable() : enable());
    test.onclick = () => act(async () => { await sync.call('/v1/push/test', {}); note = 'Tes dikirim. Coba tutup web, notifikasinya tetap datang ♡'; });
    views.add(box);
    render();
    void refresh();
  }

  document.addEventListener('mimi-care-changed', () => { void pushCare(); });
  // Keluar dari akun: perangkat ini berhenti menerima pengingat akun itu.
  sync.onLogout?.(async () => { if (info?.here) await disable(); info = null; note = ''; });
  // Pesan dari service worker: tombol di notifikasi sudah mengubah agenda, ambil perubahan dari server.
  navigator.serviceWorker?.addEventListener?.('message', e => { if (e.data?.type === 'mimi-push-acted') { notify(e.data.message || 'Siap ♡'); void sync.sync(); } });
  return { mount, refresh };
}
