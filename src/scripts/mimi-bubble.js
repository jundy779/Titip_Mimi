// Gelembung Mimi: pose kecil + satu kalimat. Status penting tetap juga ditulis di #notice,
// jadi gelembung ini hanya pemanis dan aman bila Mimi manja dimatikan.
import { reaction, readState } from './mimi-manja.mjs';

let timer, bubble;

function node() {
  if (bubble?.isConnected) return bubble;
  bubble = document.createElement('div');
  bubble.className = 'mimi-bubble';
  bubble.hidden = true;
  bubble.setAttribute('aria-hidden', 'true');
  const img = new Image(64, 64);
  img.alt = '';
  const text = document.createElement('p');
  bubble.append(img, text);
  document.body.append(bubble);
  return bubble;
}

export function manjaOn() {
  return readState(globalThis.localStorage).enabled;
}

export function mimiSay(kind, salt = 0) {
  if (!manjaOn()) return null;
  const said = reaction(kind, new Date(), salt);
  const box = node();
  box.querySelector('img').src = '/mimi/' + said.pose + '.webp';
  box.querySelector('p').textContent = said.text;
  box.hidden = false;
  box.classList.remove('pop');
  void box.offsetWidth;
  box.classList.add('pop');
  clearTimeout(timer);
  timer = setTimeout(() => { box.hidden = true; }, 3600);
  return said;
}

export function floatHearts(anchor, count = 3) {
  if (!anchor || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const rect = anchor.getBoundingClientRect();
  for (let i = 0; i < count; i++) {
    const heart = document.createElement('span');
    heart.className = 'mimi-heart';
    heart.textContent = '♡';
    heart.setAttribute('aria-hidden', 'true');
    heart.style.left = rect.left + rect.width * (0.3 + 0.2 * i) + 'px';
    heart.style.top = rect.top + rect.height * 0.25 + 'px';
    heart.style.animationDelay = i * 120 + 'ms';
    document.body.append(heart);
    heart.addEventListener('animationend', () => heart.remove());
  }
}

export function hideBubble() {
  clearTimeout(timer);
  if (bubble) bubble.hidden = true;
}
