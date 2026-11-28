const preference = 'mimi-system-reminders-v1';
const supported = () => window.isSecureContext && 'Notification' in window && 'serviceWorker' in navigator;
function enabled() {
  try { return supported() && Notification.permission === 'granted' && localStorage.getItem(preference) === 'on'; }
  catch { return false; }
}
let registration, workerApi = '';
// Alamat API ikut di URL service worker supaya tombol di notifikasi push tahu ke mana mengirim.
export function setWorkerApi(api) { workerApi = api || ''; }
export async function worker() {
  if (!registration) registration = navigator.serviceWorker.register('./mimi-reminders-sw.js' + (workerApi ? '?api=' + encodeURIComponent(workerApi) : ''))
    .then(() => navigator.serviceWorker.ready).catch(error => { registration = null; throw error; });
  return registration;
}
async function notify(id, test) {
  const sw = await worker();
  await sw.showNotification(test ? 'Tes pengingat Mimi' : 'Mimi mau ingetin ♡', {
    body: test ? 'Notifikasi percobaan sampai. Ketuk untuk membuka Agenda.' : 'Ada agenda yang sudah waktunya. Ketuk untuk melihat.',
    icon: './remind.webp', tag: 'mimi-' + id, data: {id}
  });
}
export function mountSystemSettings(panel) {
  const toggle = panel.querySelector('[data-enable]');
  const test = panel.querySelector('[data-test]');
  const status = panel.querySelector('[role=status]');
  function display() {
    const available = supported();
    const active = enabled();
    const denied = available && Notification.permission === 'denied';
    toggle.disabled = !available || denied;
    toggle.textContent = active ? 'Matikan notifikasi browser' : 'Aktifkan notifikasi browser';
    test.disabled = !active;
    status.textContent = !available ? 'Browser ini belum mendukung notifikasi Mimi.' : denied ?
      'Izin diblokir. Kamu bisa mengubahnya di pengaturan situs pada browser.' :
      active ? 'Notifikasi browser aktif di perangkat ini.' : 'Notifikasi browser belum aktif.';
  }
  toggle.onclick = async () => {
    toggle.disabled = true;
    try {
      const next = !enabled();
      if (next && await Notification.requestPermission() !== 'granted') { display(); return; }
      if (next) await worker();
      localStorage.setItem(preference, next ? 'on' : 'off');
      display();
    } catch { display(); status.textContent = 'Pengaturan belum tersimpan. Coba lagi, ya.'; }
  };
  test.onclick = async () => {
    try { await notify('test', true); status.textContent = 'Tes dikirim. Cek pusat notifikasi perangkatmu.'; }
    catch { display(); status.textContent = 'Tes belum terkirim. Periksa izin notifikasi perangkatmu.'; }
  };
  display();
}
const pending = new Set();
export async function notifyDue(entries, now = Date.now()) {
  if (!enabled()) return;
  for (const entry of entries) {
    const at = entry.snoozeUntil || Date.parse(entry.time);
    if (entry.done || !entry.reminderId || !(at <= now) || now - at > 300000) continue;
    const key = 'mimi-notified-' + entry.reminderId;
    if (pending.has(key)) continue;
    pending.add(key);
    try {
      if (localStorage.getItem(key) !== String(at)) {
        await notify(entry.reminderId, false);
        localStorage.setItem(key, String(at));
      }
    } catch { /* The in-page reminder remains available. */ }
    finally { pending.delete(key); }
  }
}
