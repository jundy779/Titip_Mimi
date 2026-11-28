import { addToQueue, guessMethod, guessService, looksLikeSecret, mimiUrl, newCard, queueKey, readPage, removeFromQueue } from './lib.js';

const $ = id => document.getElementById(id);
let site = '', warnedSecret = false;

function say(text, kind = '') {
  $('message').textContent = text;
  $('message').className = kind;
}

async function queue() {
  const { [queueKey]: list = [] } = await chrome.storage.local.get(queueKey);
  return list;
}

async function showQueue() {
  const list = await queue();
  $('queue').hidden = !list.length;
  $('queue-title').textContent = list.length + ' akun nunggu dibawa ke Mimi';
  $('queue-list').replaceChildren(...list.map(card => {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = card.title + ' · ' + card.identity;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', 'Batal titip ' + card.title + ' ' + card.identity);
    remove.onclick = async () => {
      await chrome.storage.local.set({ [queueKey]: removeFromQueue(await queue(), [card.id]) });
      say('Kartu ' + card.title + ' batal dititip.');
      showQueue();
    };
    li.append(label, remove);
    return li;
  }));
}

async function prefill() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:/.test(tab.url || '')) return;
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readPage });
    if (!result) return;
    site = result.host;
    $('title').value = guessService(result);
    $('identity').value = result.identity;
    $('method').value = guessMethod(result);
    $('site').textContent = 'Dari ' + result.host + '. Cek lagi sebelum dititip, ya.';
  } catch {
    $('site').textContent = 'Mimi nggak bisa baca halaman ini. Isi sendiri aja, ya.';
  }
}

$('identity').addEventListener('input', () => { warnedSecret = false; });

$('form').addEventListener('submit', async event => {
  event.preventDefault();
  const identity = $('identity').value;
  if (looksLikeSecret(identity) && !warnedSecret) {
    warnedSecret = true;
    say('Ini kelihatan kayak kata sandi. Mimi cuma butuh email atau label akun. Kalau yakin bukan sandi, tekan Titip lagi.', 'error');
    $('identity').focus();
    return;
  }
  try {
    const card = newCard({ title: $('title').value, identity, method: $('method').value, site }, crypto.randomUUID());
    const { queue: next, duplicate } = addToQueue(await queue(), card);
    if (duplicate) { say('Akun ini sudah nunggu di antrean Mimi ♡', 'ok'); return; }
    await chrome.storage.local.set({ [queueKey]: next });
    $('pose').src = 'img/saved.webp';
    say('Udah Mimi pegang ♡ Nanti Mimi bawa ke Koleksi.', 'ok');
    $('identity').value = '';
    warnedSecret = false;
    showQueue();
  } catch (error) {
    say(error.message || 'Belum bisa dititip. Coba lagi, ya.', 'error');
  }
});

$('open').onclick = () => chrome.tabs.create({ url: mimiUrl });

prefill();
showQueue();
