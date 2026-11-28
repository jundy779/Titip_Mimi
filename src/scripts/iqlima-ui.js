// Antarmuka fitur Iqlima di Hari Ini dan Profil. Logika murni ada di iqlima.mjs.
import { cleanIg, igLink, cleanPhone, parseSetupHash, parseDump, weekStats, praise, helpMessage, waLink, needsSupport, support, feelings, firstbornLine, careKinds, defaultCare, dueCare, isLeoSeason, birthdayInfo, dayKey } from './iqlima.mjs';

const keys = { wins: 'mimi-wins-v1', out: 'mimi-out-v1', lega: 'mimi-lega-v1', care: 'mimi-selfcare-v1', me: 'mimi-iqlima-v1' };
const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const make = (tag, text = '', cls = '') => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n; };
const button = (text, cls = '', type = 'button') => { const b = make('button', text, cls); b.type = type; return b; };

// ---------- Dinding bangga ----------
export function logWin(entry) {
  const wins = read(keys.wins, []);
  if (entry.ref && wins.some(w => w.ref === entry.ref)) return;
  wins.push({ ...entry, at: new Date().toISOString() });
  write(keys.wins, wins.slice(-500));
}
export function unlogWin(ref) {
  write(keys.wins, read(keys.wins, []).filter(w => w.ref !== ref));
}

function dialog(title, cls = '') {
  const box = make('dialog', '', 'iqlima-dialog ' + cls);
  box.setAttribute('aria-label', title);
  box.append(make('h2', title));
  document.body.append(box);
  box.addEventListener('close', () => box.remove());
  return box;
}

// ---------- Tumpahkan pikiran ----------
function openDump(api) {
  const box = dialog('Tumpahkan pikiran ♡', 'dump');
  const head = make('div', '', 'dump-head');
  const art = new Image(64, 64); art.src = '/mimi/letter.webp'; art.alt = '';
  head.append(art, make('p', 'Tulis semua yang lagi kepikiran, satu baris satu hal. Mimi yang rapikan jadi titipan.'));
  const area = make('textarea'); area.rows = 4; area.setAttribute('aria-label', 'Isi pikiran');
  area.placeholder = 'bayar kos besok\njemput adik jam 4 sore\nbeli kado ibu tgl 5';
  const preview = make('div', '', 'dump-preview'); preview.setAttribute('aria-live', 'polite');
  const save = button('Titip', 'primary'); save.disabled = true;
  const cancel = button('Batal', 'quiet');
  let rows = [], skip = new Set(), timer = 0;
  function count() {
    const n = rows.length - skip.size;
    save.disabled = n === 0;
    save.textContent = n ? 'Titip ' + n + ' titipan' : 'Titip';
  }
  function render() {
    rows = parseDump(area.value);
    skip = new Set([...skip].filter(i => i < rows.length));
    preview.replaceChildren();
    if (rows.length) preview.append(make('p', 'Mimi pecah jadi ' + rows.length + ' titipan. Ketuk untuk melewatkan yang nggak perlu.', 'dump-summary'));
    rows.forEach((r, i) => {
      const label = make('label', '', 'dump-row');
      const check = document.createElement('input'); check.type = 'checkbox'; check.checked = !skip.has(i);
      check.onchange = () => { if (check.checked) skip.delete(i); else skip.add(i); label.classList.toggle('skipped', !check.checked); count(); };
      const text = make('span', '', 'dump-text');
      const when = r.time ? new Date(r.time).toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(' pukul ', ' · ') : 'Catatan tanpa jadwal';
      text.append(make('b', r.title), make('small', (r.time ? '🗓 ' : '📝 ') + when, r.time ? 'dump-when is-scheduled' : 'dump-when'));
      label.append(check, text);
      label.classList.toggle('skipped', skip.has(i));
      preview.append(label);
    });
    count();
  }
  area.oninput = () => { clearTimeout(timer); timer = setTimeout(render, 250); };
  save.onclick = () => {
    const chosen = rows.filter((_, i) => !skip.has(i));
    if (!chosen.length) return;
    const fresh = chosen.map(r => ({ kind: r.kind, title: r.title, note: '', time: r.time, done: false }));
    if (!api.addItems(fresh)) return;
    box.close();
    api.notice(chosen.length + ' titipan sudah Mimi simpan. Pikiranmu boleh lebih ringan sekarang ♡');
    api.say('saved');
  };
  cancel.onclick = () => box.close();
  const actions = make('div', '', 'row dump-actions'); actions.append(cancel, save);
  box.append(head, area, preview, actions);
  box.showModal(); area.focus();
}

// ---------- Cek sebelum keluar ----------
const defaultOut = ['Dompet', 'HP', 'Kunci', 'Charger'];
function mountOut(card, api) {
  const state = read(keys.out, { items: defaultOut, day: '', checked: [] });
  const today = dayKey(new Date());
  if (state.day !== today) { state.day = today; state.checked = []; }
  const list = card.querySelector('[data-out-list]'), status = card.querySelector('[data-out-status]');
  const form = card.querySelector('form'), input = form.querySelector('input');
  function render() {
    list.replaceChildren();
    for (const name of state.items) {
      const row = make('label', '', 'out-row');
      const check = document.createElement('input'); check.type = 'checkbox'; check.checked = state.checked.includes(name);
      check.onchange = () => {
        state.checked = check.checked ? [...new Set([...state.checked, name])] : state.checked.filter(n => n !== name);
        write(keys.out, state); summary(true);
      };
      const remove = button('×', 'list-remove'); remove.setAttribute('aria-label', 'Hapus ' + name + ' dari daftar');
      remove.onclick = e => { e.preventDefault(); state.items = state.items.filter(n => n !== name); state.checked = state.checked.filter(n => n !== name); write(keys.out, state); render(); };
      row.append(check, make('span', name), remove);
      list.append(row);
    }
    summary(false);
  }
  function summary(changed) {
    const all = state.items.length && state.items.every(n => state.checked.includes(n));
    status.textContent = all ? 'Semua sudah dibawa. Hati-hati di jalan ♡' : state.checked.length + ' dari ' + state.items.length + ' sudah dibawa';
    if (all && changed) api.say('task');
  }
  form.onsubmit = e => {
    e.preventDefault();
    const name = input.value.trim().slice(0, 40);
    if (!name || state.items.includes(name)) { input.value = ''; return; }
    state.items = [...state.items, name].slice(0, 20); write(keys.out, state); input.value = ''; render();
  };
  write(keys.out, state);
  render();
}

// ---------- Dinding bangga ----------
function mountProud(card, api) {
  const stats = card.querySelector('[data-proud-stats]'), note = card.querySelector('[data-proud-praise]'), list = card.querySelector('[data-proud-list]');
  const form = card.querySelector('form'), input = form.querySelector('input');
  if (isLeoSeason()) card.classList.add('leo');
  function render() {
    const s = weekStats(read(keys.wins, []));
    stats.textContent = 'Minggu ini: ' + (s.done + s.task) + ' hal beres' + (s.manual ? ' · ' + s.manual + ' kemenangan kecil' : '') + (s.care ? ' · ' + s.care + ' kali jaga diri' : '');
    note.textContent = praise(s);
    list.replaceChildren(...s.highlights.map(t => make('li', t)));
  }
  form.onsubmit = e => {
    e.preventDefault();
    const text = input.value.trim().slice(0, 120);
    if (!text) return;
    logWin({ kind: 'win', text });
    input.value = '';
    render();
    api.say('allDone');
  };
  render();
  return render;
}

// ---------- Ruang lega ----------
function openLega(api) {
  const box = dialog('Ruang lega', 'lega');
  box.append(make('p', firstbornLine, 'lega-intro'), make('p', 'Tulisan di sini hanya tersimpan di perangkat ini dan tidak ikut sinkron.', 'muted'));
  let feeling = '';
  const chips = make('div', '', 'chips'); chips.setAttribute('role', 'group'); chips.setAttribute('aria-label', 'Perasaan sekarang');
  for (const [id, f] of Object.entries(feelings)) {
    const chip = button(f.label, 'chip'); chip.setAttribute('aria-pressed', 'false');
    chip.onclick = () => { feeling = id; chips.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === chip))); };
    chips.append(chip);
  }
  const area = make('textarea'); area.rows = 5; area.placeholder = 'Lagi kepikiran apa? Tulis aja, ini cuma buat kamu.'; area.setAttribute('aria-label', 'Isi ruang lega');
  const reply = make('div', '', 'lega-reply'); reply.setAttribute('role', 'status');
  const save = button('Simpan untukku', 'primary'), close = button('Tutup', 'quiet');
  const past = make('details', '', 'lega-past');
  function renderPast() {
    const entries = read(keys.lega, []);
    past.replaceChildren(make('summary', 'Catatan sebelumnya (' + entries.length + ')'));
    for (const entry of entries.slice(-10).reverse()) {
      const row = make('div', '', 'lega-entry');
      const when = new Date(entry.at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
      row.append(make('small', when + (entry.feeling ? ' · ' + feelings[entry.feeling]?.label : '')), make('p', entry.text));
      const del = button('Hapus', 'quiet');
      del.onclick = () => { if (confirm('Hapus catatan ini dari perangkat?')) { write(keys.lega, read(keys.lega, []).filter(e => e.at !== entry.at)); renderPast(); } };
      row.append(del); past.append(row);
    }
  }
  save.onclick = () => {
    const text = area.value.trim().slice(0, 4000);
    if (!text && !feeling) { area.focus(); return; }
    const entry = { at: new Date().toISOString(), feeling, text };
    write(keys.lega, [...read(keys.lega, []), entry].slice(-300));
    reply.replaceChildren();
    if (needsSupport(text)) {
      reply.classList.add('urgent');
      const call = make('a', 'Telepon 119 ekstensi 8'); call.href = support.phone;
      const chat = make('a', 'Chat di healing119.id'); chat.href = support.chat; chat.target = '_blank'; chat.rel = 'noopener';
      reply.append(make('p', support.text), call, chat);
    } else {
      reply.classList.remove('urgent');
      reply.append(make('p', (feelings[feeling] || feelings.lega).reply));
    }
    const share = make('a', 'Ceritakan ke Jundy lewat WhatsApp', 'share-link');
    share.href = waLink(read(keys.me, {}).waPhone, 'Jundy, aku lagi pengen cerita' + (text ? ':\n' + text : '.'));
    share.target = '_blank'; share.rel = 'noopener';
    reply.append(share);
    const ig = igLink(read(keys.me, {}).igUser);
    if (ig) { const dm = make('a', 'Atau lewat DM Instagram', 'share-link'); dm.href = ig; dm.target = '_blank'; dm.rel = 'noopener'; dm.onclick = () => { navigator.clipboard?.writeText(text).catch(() => {}); }; reply.append(dm); }
    area.value = ''; renderPast();
    api.say(feeling === 'senang' || feeling === 'lega' ? 'done' : 'pet');
  };
  close.onclick = () => box.close();
  const actions = make('div', '', 'row'); actions.append(close, save);
  renderPast();
  box.append(chips, area, actions, reply, past);
  box.showModal(); area.focus();
}

// ---------- Minta tolong Jundy ----------
export function openHelp(item, onSent) {
  const box = dialog('Minta tolong Jundy', 'help');
  box.append(make('p', 'Kamu nggak harus ngerjain semuanya sendiri. Cek pesannya, lalu kirim lewat WhatsApp.'));
  const area = make('textarea'); area.rows = 5; area.value = helpMessage(item); area.setAttribute('aria-label', 'Pesan untuk Jundy');
  const send = make('a', 'Kirim lewat WhatsApp', 'button primary'); send.target = '_blank'; send.rel = 'noopener';
  const update = () => { send.href = waLink(read(keys.me, {}).waPhone, area.value); };
  area.oninput = update; update();
  send.onclick = () => { onSent?.(); setTimeout(() => box.close(), 100); };
  const copy = button('Salin pesan', 'quiet');
  copy.onclick = async () => { try { await navigator.clipboard.writeText(area.value); copy.textContent = 'Tersalin ♡'; onSent?.(); } catch { area.select(); } };
  const close = button('Tutup', 'quiet'); close.onclick = () => box.close();
  const actions = make('div', '', 'row'); actions.append(close, copy);
  const ig = igLink(read(keys.me, {}).igUser);
  const hint = make('p', '', 'muted'); hint.setAttribute('role', 'status');
  if (ig) {
    const dm = make('a', 'Kirim lewat Instagram', 'button quiet-link'); dm.href = ig; dm.target = '_blank'; dm.rel = 'noopener';
    dm.onclick = async () => { try { await navigator.clipboard.writeText(area.value); hint.textContent = 'Pesan sudah disalin. Tinggal tempel di DM Instagram Jundy ♡'; } catch { hint.textContent = 'Salin pesannya dulu, lalu tempel di DM Instagram.'; } onSent?.(); };
    actions.append(dm);
  }
  actions.append(send);
  if (!read(keys.me, {}).waPhone) box.append(make('p', 'Tip: isi nomor WhatsApp Jundy di Profil supaya langsung terbuka ke chatnya.', 'muted'));
  box.append(area, actions, hint);
  box.showModal();
}

// ---------- Jaga diri ----------
let careBox = null;
export function careTick(api, now = new Date()) {
  const settings = { ...defaultCare, ...read(keys.care, {}).settings };
  const shown = read(keys.care, {}).shown || {};
  const due = dueCare(settings, now, shown);
  if (!due || careBox?.isConnected) return;
  write(keys.care, { ...read(keys.care, {}), shown: { ...shown, [due.id]: dayKey(now) } });
  careBox = make('aside', '', 'care-toast'); careBox.setAttribute('role', 'status');
  const img = new Image(56, 56); img.src = '/mimi/' + (due.kind === 'sleep' ? 'sleep' : due.kind === 'rest' ? 'peek' : 'welcome') + '.webp'; img.alt = '';
  const text = make('div'); text.append(make('b', due.label), make('p', due.text));
  const done = button('Udah ♡', 'primary'), later = button('Nanti', 'quiet');
  done.onclick = () => { logWin({ kind: 'care', text: due.label }); careBox.remove(); api.say('done'); };
  later.onclick = () => careBox.remove();
  const actions = make('div', '', 'row'); actions.append(later, done);
  careBox.append(img, text, actions);
  document.body.append(careBox);
  if (document.hidden && 'Notification' in globalThis && Notification.permission === 'granted') {
    try { new Notification(due.label + ' ♡', { body: due.text, icon: '/favicon.png', tag: due.id }); } catch {}
  }
}

// ---------- Mount ----------
export function mountToday(page, api) {
  page.querySelector('[data-dump]')?.addEventListener('click', () => openDump(api));
  const out = page.querySelector('[data-out]'); if (out) mountOut(out, api);
  const proud = page.querySelector('[data-proud]'); if (proud) mountProud(proud, api);
  page.querySelector('[data-lega]')?.addEventListener('click', () => openLega(api));
  // Musim Leo dan ulang tahun.
  const badge = page.querySelector('[data-celebrate]');
  const me = read(keys.me, {});
  const bday = birthdayInfo(me.birthday);
  if (badge) {
    if (bday?.today) { badge.textContent = '🎂 Selamat ulang tahun, Iqlima! Hari ini semua tentang kamu ♡'; badge.hidden = false; }
    else if (isLeoSeason()) { badge.textContent = '♌ Musim Leo, musimnya kamu bersinar ☀'; badge.hidden = false; }
    else if (bday && bday.daysLeft <= 7) { badge.textContent = '🎀 ' + bday.daysLeft + ' hari lagi ulang tahunmu ♡'; badge.hidden = false; }
  }
  if (bday?.today && me.celebrated !== dayKey(new Date())) { write(keys.me, { ...me, celebrated: dayKey(new Date()) }); setTimeout(() => api.say('allDone'), 600); }
}

export function mountProfile(section, api) {
  const care = { ...defaultCare, ...read(keys.care, {}).settings };
  const box = section.querySelector('[data-care-list]');
  box.replaceChildren();
  for (const [kind, def] of Object.entries(careKinds)) {
    const label = make('label', '', 'theme-row');
    const input = document.createElement('input'); input.type = 'checkbox'; input.setAttribute('role', 'switch'); input.dataset.careSwitch = ''; input.checked = care[kind];
    input.onchange = () => { const all = read(keys.care, {}); write(keys.care, { ...all, settings: { ...defaultCare, ...all.settings, [kind]: input.checked } }); api.notice(def.label + (input.checked ? ' dinyalakan ♡' : ' dimatikan.')); };
    label.append(document.createTextNode(def.label + ' · ' + def.slots.join(', ')), input);
    box.append(label);
  }
  const me = read(keys.me, {});
  const phone = section.querySelector('[data-wa]'), birthday = section.querySelector('[data-birthday]'), ig = section.querySelector('[data-ig]');
  phone.value = me.waPhone || '';
  ig.value = me.igUser ? '@' + me.igUser : '';
  ig.onchange = () => { const user = cleanIg(ig.value); write(keys.me, { ...read(keys.me, {}), igUser: user }); ig.value = user ? '@' + user : ''; api.notice(user ? 'Instagram Jundy tersimpan di perangkat ini.' : 'Username Instagram belum valid.'); };
  birthday.value = me.birthday ? '2000-' + me.birthday : '';
  phone.onchange = () => { const wa = cleanPhone(phone.value); write(keys.me, { ...read(keys.me, {}), waPhone: wa }); phone.value = wa; api.notice(wa ? 'Nomor WhatsApp Jundy tersimpan di perangkat ini.' : 'Nomor belum valid. Contoh: 0812 3456 7890'); };
  birthday.onchange = () => { write(keys.me, { ...read(keys.me, {}), birthday: birthday.value ? birthday.value.slice(5) : '' }); api.notice('Tanggal ulang tahun tersimpan. Mimi bakal inget ♡'); };
}

// Tautan atur sekali dari Jundy: simpan kontak di perangkat ini lalu hapus dari alamat.
export function applySetupLink(api) {
  const setup = parseSetupHash(location.hash);
  if (!setup) return false;
  write(keys.me, { ...read(keys.me, {}), ...setup });
  history.replaceState(null, '', location.pathname + location.search);
  api.notice('Kontak Jundy sudah tersimpan di perangkat ini ♡ Tombol Minta tolong Jundy siap dipakai.');
  return true;
}
