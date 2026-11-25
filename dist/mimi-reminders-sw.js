self.addEventListener('notificationclick', event => {
  event.notification.close();
  const id = event.notification.data?.id;
  if (typeof id !== 'string') return;
  const url = new URL('./', self.registration.scope);
  url.searchParams.set('agenda', id);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
    for (const client of windows) {
      const open = new URL(client.url);
      if (open.origin === url.origin && open.pathname === url.pathname) {
        await client.focus();
        client.postMessage({type: 'mimi-open-agenda', id});
        return;
      }
    }
    await self.clients.openWindow(url.href);
  })());
});
