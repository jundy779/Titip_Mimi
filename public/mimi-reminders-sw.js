// Service worker Mimi: menampilkan notifikasi (dari halaman atau dari server lewat Web Push)
// dan menangani ketukan pada notifikasi.
const api = new URL(self.location.href).searchParams.get('api') || '';
const home = () => new URL('./', self.registration.scope);

async function windows() { return self.clients.matchAll({ type: 'window', includeUncontrolled: true }); }

self.addEventListener('push', event => {
  let msg = {};
  try { msg = event.data ? event.data.json() : {}; } catch { msg = { title: 'Mimi ♡', body: event.data ? event.data.text() : '' }; }
  event.waitUntil((async () => {
    // Ruang Iqlima sedang dibuka dan dilihat: halaman sudah menampilkan pengingatnya sendiri.
    if (msg.type !== 'test' && (await windows()).some(c => c.focused && c.visibilityState === 'visible')) return;
    const actions = Array.isArray(msg.actions) && msg.t ? msg.actions.slice(0, 2) : [];
    await self.registration.showNotification(String(msg.title || 'Mimi ♡').slice(0, 80), {
      body: String(msg.body || '').slice(0, 300),
      icon: './remind.webp',
      badge: './favicon.png',
      // Tag sama dengan notifikasi dari halaman, jadi yang datang dua kali saling menggantikan.
      tag: String(msg.tag || 'mimi'),
      renotify: msg.type === 'agenda',
      data: { id: msg.type === 'agenda' ? msg.id : msg.type === 'test' ? 'test' : '', type: msg.type || '', t: msg.t || '' },
      actions,
    });
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};
  // Tombol Sudah selesai / Tunda: dikerjakan di server tanpa membuka web.
  if ((event.action === 'done' || event.action === 'snooze') && data.t) {
    event.waitUntil((async () => {
      let message = 'Belum berhasil. Buka Ruang Iqlima, ya.';
      try {
        const res = await fetch(api + '/v1/push/action', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Mimi': '1' }, body: JSON.stringify({ t: data.t, action: event.action }), credentials: 'omit' });
        const body = await res.json().catch(() => ({}));
        message = body.message || (res.ok ? 'Siap ♡' : message);
      } catch {}
      for (const c of await windows()) c.postMessage({ type: 'mimi-push-acted', message });
      if (!(await windows()).length) await self.registration.showNotification(message, { icon: './remind.webp', tag: 'mimi-ok', silent: true });
    })());
    return;
  }
  const id = typeof data.id === 'string' ? data.id : '';
  const url = home();
  if (id) url.searchParams.set('agenda', id);
  event.waitUntil((async () => {
    for (const client of await windows()) {
      const open = new URL(client.url);
      if (open.origin === url.origin && open.pathname === url.pathname) {
        await client.focus();
        if (id) client.postMessage({ type: 'mimi-open-agenda', id });
        return;
      }
    }
    await self.clients.openWindow(url.href);
  })());
});

// Browser mengganti langganan push (jarang): daftarkan ulang memakai sesi cookie bila ada.
self.addEventListener('pushsubscriptionchange', event => {
  const options = event.oldSubscription?.options;
  if (!options) return;
  event.waitUntil((async () => {
    try {
      const sub = await self.registration.pushManager.subscribe(options);
      await fetch(api + '/v1/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Mimi': '1' }, credentials: api ? 'omit' : 'same-origin', body: JSON.stringify({ subscription: sub.toJSON() }) });
    } catch {}
  })());
});
