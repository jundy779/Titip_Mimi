// Berjalan hanya di halaman Titip Mimi. Menyerahkan antrean kartu akun ke halaman,
// lalu menghapus kartu yang sudah dikonfirmasi halaman (ack).
(() => {
  const key = 'mimiQueue';
  const origin = location.origin;
  async function send() {
    const { [key]: queue = [] } = await chrome.storage.local.get(key);
    if (queue.length) window.postMessage({ type: 'titip-mimi-inbox', cards: queue }, origin);
  }
  window.addEventListener('message', async event => {
    if (event.source !== window || event.origin !== origin) return;
    const data = event.data;
    if (data?.type === 'titip-mimi-inbox-ready') return send();
    if (data?.type !== 'titip-mimi-inbox-ack' || !Array.isArray(data.ids)) return;
    const done = new Set(data.ids.filter(id => typeof id === 'string'));
    const { [key]: queue = [] } = await chrome.storage.local.get(key);
    const rest = queue.filter(card => !done.has(card.id));
    if (rest.length !== queue.length) await chrome.storage.local.set({ [key]: rest });
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[key]?.newValue?.length > (changes[key]?.oldValue?.length || 0)) send();
  });
  send();
})();
