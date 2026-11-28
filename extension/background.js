// Angka kecil di ikon Mimi = jumlah akun yang menunggu dibawa ke Titip Mimi.
import { queueKey } from './lib.js';

async function badge() {
  const { [queueKey]: queue = [] } = await chrome.storage.local.get(queueKey);
  await chrome.action.setBadgeBackgroundColor({ color: '#96395F' });
  await chrome.action.setBadgeText({ text: queue.length ? String(queue.length) : '' });
}
chrome.runtime.onInstalled.addListener(badge);
chrome.runtime.onStartup.addListener(badge);
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && queueKey in changes) badge(); });
