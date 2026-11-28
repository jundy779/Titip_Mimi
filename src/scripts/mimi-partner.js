// Surat dari Jundy dan rencana berdua.
// Dengan akun (server): pasangan tersambung lewat kode undangan, surat dan rencana tersinkron.
// Tanpa akun: surat dan ajakan dikirim sebagai tautan (#surat?d=… / #rencana?d=…) lewat WhatsApp.
// Yang dibagi hanya surat dan rencana. Koleksi, akun digital, dan ruang lega tetap pribadi.
import { encodeShare, decodeShare, stickers, waLink, cleanPhone } from './iqlima.mjs';

const localKey = 'mimi-letters-v1';
const meKey = 'mimi-iqlima-v1';
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const make = (tag, text = '', cls = '') => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n; };
const dayTime = iso => new Date(iso).toLocaleString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const planTime = t => t ? new Date(t).toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Belum ada tanggal';
const shareUrl = hash => location.origin + location.pathname + hash;

function dialog(title, cls = '') {
  const box = make('dialog', '', 'iqlima-dialog ' + cls);
  box.setAttribute('aria-label', title);
  box.append(make('h2', title));
  box.addEventListener('close', () => box.remove());
  document.body.append(box);
  return box;
}
function button(text, cls = '') { const b = make('button', text, cls); b.type = 'button'; return b; }

export function createPartner({ sync, notify, addItems }) {
  let status = null, letters = { received: [], sent: [], unread: 0 }, plans = [], loading = null;
  const views = { today: null, profile: null, agenda: null };
  const online = () => Boolean(sync.enabled && sync.state.user);
  const paired = () => Boolean(online() && status?.paired);
  const partnerName = () => status?.partner?.name?.split(' ')[0] || 'pasanganmu';
  const local = () => read(localKey, []);

  async function refresh() {
    if (!online()) { status = null; renderAll(); return; }
    if (loading) return loading;
    loading = (async () => {
      try {
        status = await sync.call('/v1/partner');
        if (status.paired) [letters, { plans }] = await Promise.all([sync.call('/v1/partner/letters'), sync.call('/v1/partner/plans')]);
        else { letters = { received: [], sent: [], unread: 0 }; plans = []; }
      } catch { /* server tidak terjangkau: tampilkan yang ada */ }
      loading = null;
      renderAll();
    })();
    return loading;
  }
  function renderAll() { renderToday(); renderProfile(); renderAgenda(); }

  // ---------- Surat ----------
  function allLetters() {
    const fromServer = letters.received.map(l => ({ ...l, from: letters.from || partnerName(), server: true }));
    const fromLinks = local().map(l => ({ ...l, id: 'local-' + l.at, read: Boolean(l.read) }));
    return [...fromServer, ...fromLinks].sort((a, b) => b.at.localeCompare(a.at));
  }
  function renderToday() {
    const el = views.today;
    if (!el?.isConnected) return;
    const list = allLetters();
    const unread = list.filter(l => !l.read);
    const latest = unread[0] || list[0];
    const line = el.querySelector('[data-letter-status]'), quote = el.querySelector('[data-letter-latest]');
    line.textContent = unread.length ? `Ada ${unread.length} surat baru untukmu ♡` : list.length ? `Surat terakhir dari ${latest.from}, ${dayTime(latest.at)}.` : 'Belum ada surat. Mau kirim duluan?';
    quote.hidden = !latest;
    if (latest) { quote.replaceChildren(make('span', latest.sticker + ' ', 'letter-sticker'), document.createTextNode(latest.body.length > 140 ? latest.body.slice(0, 140) + '…' : latest.body)); }
    el.querySelector('[data-letter-open]').hidden = !list.length;
    el.classList.toggle('has-new', unread.length > 0);
  }
  async function openLetters() {
    const box = dialog('Surat untukmu ♡', 'letters');
    const list = allLetters();
    const ul = make('ul', '', 'letter-list');
    if (!list.length) ul.append(make('li', 'Belum ada surat.'));
    for (const l of list) {
      const li = make('li', '', 'letter' + (l.read ? '' : ' unread'));
      const head = make('p', '', 'letter-head');
      head.append(make('b', l.sticker + ' ' + l.from), make('small', ' · ' + dayTime(l.at)));
      const body = make('p', l.body, 'letter-body');
      const hide = button('Sembunyikan', 'quiet');
      hide.onclick = async () => {
        if (l.server) { try { await sync.call(`/v1/partner/letters/${l.id}/hide`, {}); } catch { notify('Belum bisa disembunyikan. Coba lagi, ya.'); return; } }
        else write(localKey, local().filter(x => x.at !== l.at));
        li.remove(); void refresh(); renderToday();
      };
      li.append(head, body, hide);
      ul.append(li);
    }
    const reply = button('Balas surat', 'primary'), close = button('Tutup', 'quiet');
    reply.onclick = () => { box.close(); openWrite(); };
    close.onclick = () => box.close();
    const actions = make('div', '', 'row');
    actions.append(close, reply);
    box.append(ul, actions);
    box.showModal();
    // Tandai dibaca setelah dibuka.
    write(localKey, local().map(x => ({ ...x, read: true })));
    await Promise.all(list.filter(l => l.server && !l.read).map(l => sync.call(`/v1/partner/letters/${l.id}/read`, {}).catch(() => {})));
    void refresh();
  }
  function openWrite() {
    const box = dialog(paired() ? `Surat untuk ${partnerName()} ♡` : 'Tulis surat ♡', 'letter-write');
    const me = read(meKey, {});
    const area = make('textarea'); area.rows = 5; area.maxLength = 1000; area.placeholder = 'Tulis apa saja. Yang manis, yang lucu, atau sekadar "semangat ya".';
    const counter = make('small', '0/1000', 'muted');
    area.oninput = () => { counter.textContent = area.value.length + '/1000'; };
    const label = make('label', 'Isi surat'); label.append(area);
    const pick = make('div', '', 'sticker-pick'); pick.setAttribute('role', 'radiogroup'); pick.setAttribute('aria-label', 'Stiker');
    let sticker = stickers[0];
    for (const s of stickers) {
      const b = button(s); b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(s === sticker));
      b.onclick = () => { sticker = s; for (const x of pick.children) x.setAttribute('aria-checked', String(x === b)); };
      pick.append(b);
    }
    const from = make('input'); from.maxLength = 40; from.value = me.letterName || sync.state.user?.name?.split(' ')[0] || ''; from.placeholder = 'Namamu';
    const fromLabel = make('label', 'Dari'); fromLabel.append(from);
    const hint = make('p', paired() ? `Surat masuk ke Ruang Iqlima milik ${partnerName()}, dan dikabari lewat Telegram kalau Telegram-nya tersambung.` : 'Belum tersambung dengan pasangan lewat akun. Suratnya dikirim sebagai tautan: pasanganmu tinggal membukanya.', 'muted');
    const send = button(paired() ? 'Kirim surat' : 'Kirim lewat WhatsApp', 'primary'), cancel = button('Batal', 'quiet');
    const copy = button('Salin tautan', 'quiet'); copy.hidden = paired();
    const out = make('p', '', 'muted'); out.setAttribute('role', 'status');
    function payload() { return { from: from.value.trim() || 'Aku', body: area.value, sticker, at: new Date().toISOString() }; }
    async function viaLink(useWa) {
      if (!area.value.trim()) { area.focus(); return; }
      write(meKey, { ...read(meKey, {}), letterName: from.value.trim() });
      const url = shareUrl(encodeShare('surat', payload()));
      const text = `💌 Ada surat untukmu dari ${from.value.trim() || 'aku'}. Buka di Ruang Iqlima ya: ${url}`;
      if (useWa) {
        const phone = cleanPhone(me.waPhone);
        const wa = phone ? waLink(phone, text) : 'https://wa.me/?text=' + encodeURIComponent(text);
        const a = Object.assign(document.createElement('a'), { href: wa, target: '_blank', rel: 'noopener' });
        document.body.append(a); a.click(); a.remove();
        box.close(); notify('WhatsApp dibuka. Tinggal tekan kirim ♡');
      } else {
        try { await navigator.clipboard.writeText(text); out.textContent = 'Tautan tersalin ♡ Tempel di chat.'; }
        catch { out.textContent = text; }
      }
    }
    send.onclick = async () => {
      if (!paired()) return viaLink(true);
      if (!area.value.trim()) { area.focus(); return; }
      send.disabled = true;
      try { await sync.call('/v1/partner/letters', { body: area.value, sticker }); box.close(); notify(`Surat terkirim ke ${partnerName()} ♡`); void refresh(); }
      catch (e) { out.textContent = e.message || 'Suratnya belum terkirim. Coba lagi, ya.'; send.disabled = false; }
    };
    copy.onclick = () => viaLink(false);
    cancel.onclick = () => box.close();
    const actions = make('div', '', 'row');
    actions.append(cancel, copy, send);
    box.append(label, counter, pick);
    if (!paired()) box.append(fromLabel);
    box.append(hint, out, actions);
    box.showModal();
    area.focus();
  }
  function mountToday(el) {
    views.today = el;
    el.querySelector('[data-letter-open]').onclick = () => openLetters();
    el.querySelector('[data-letter-write]').onclick = () => openWrite();
    renderToday();
    void refresh();
  }

  // ---------- Pasangan di Profil ----------
  let leaving = false;
  function renderProfile() {
    const el = views.profile;
    if (!el?.isConnected) return;
    const $ = s => el.querySelector(s);
    const text = $('[data-partner-status]'), invite = $('[data-partner-invite]'), leave = $('[data-partner-leave]');
    invite.hidden = leave.hidden = true;
    if (!online()) { text.textContent = 'Masuk dengan Google dulu untuk menyambungkan pasangan. Tanpa itu, surat dan ajakan tetap bisa dikirim lewat tautan WhatsApp.'; return; }
    if (!status) { text.textContent = 'Memuat…'; return; }
    if (status.paired) {
      text.textContent = `Tersambung dengan ${status.partner.name} ♡ Kalian bisa saling kirim surat dan menyusun rencana berdua.`;
      leave.hidden = false; leave.textContent = leaving ? 'Yakin putuskan? Ketuk lagi' : 'Putuskan pasangan';
      return;
    }
    text.textContent = 'Belum tersambung. Buat kode lalu kirim ke pasanganmu, atau masukkan kode darinya.';
    invite.hidden = false;
  }
  function mountProfile(el) {
    views.profile = el;
    const $ = s => el.querySelector(s);
    $('[data-partner-make]').onclick = async () => {
      try {
        const { code } = await sync.call('/v1/partner/invite', {});
        const pretty = code.slice(0, 4) + '-' + code.slice(4);
        const out = $('[data-partner-code]');
        out.hidden = false;
        out.replaceChildren(make('span', 'Kodemu: '), make('b', pretty), make('small', ' (berlaku 24 jam, sekali pakai)'));
        const text = `Kode pasangan Ruang Iqlima: ${pretty}. Buka Profil > Pasangan, lalu masukkan kodenya ♡`;
        const phone = cleanPhone(read(meKey, {}).waPhone);
        const wa = Object.assign(document.createElement('a'), { href: phone ? waLink(phone, text) : 'https://wa.me/?text=' + encodeURIComponent(text), target: '_blank', rel: 'noopener', textContent: 'Kirim lewat WhatsApp', className: 'button quiet' });
        out.append(document.createElement('br'), wa);
      } catch (e) { notify(e.message || 'Kode belum bisa dibuat.'); }
    };
    $('[data-partner-accept]').onsubmit = async e => {
      e.preventDefault();
      const input = $('[data-partner-accept] input');
      try { status = await sync.call('/v1/partner/accept', { code: input.value }); input.value = ''; notify(`Tersambung dengan ${status.partner.name} ♡`); await refresh(); }
      catch (err) { notify(err.message || 'Kode belum bisa dipakai.'); }
    };
    $('[data-partner-leave]').onclick = async () => {
      if (!leaving) { leaving = true; renderProfile(); setTimeout(() => { leaving = false; renderProfile(); }, 4000); return; }
      leaving = false;
      try { await sync.call('/v1/partner/leave', {}); notify('Sambungan pasangan diputus. Surat dan rencana disimpan, muncul lagi kalau tersambung lagi.'); } catch (e) { notify(e.message || 'Belum bisa diputus.'); }
      await refresh();
    };
    renderProfile();
    void refresh();
  }

  // ---------- Rencana berdua di Agenda ----------
  function renderAgenda() {
    const el = views.agenda;
    if (!el?.isConnected) return;
    const text = el.querySelector('[data-plan-status]'), ul = el.querySelector('[data-plan-list]');
    ul.replaceChildren();
    if (!paired()) {
      text.textContent = online() ? 'Sambungkan pasangan di Profil supaya rencana kalian muncul di HP masing-masing. Sementara itu, ajakan bisa dikirim lewat WhatsApp.' : 'Ajak pasanganmu lewat WhatsApp. Ajakan yang diterima masuk ke agenda dengan satu ketukan.';
      return;
    }
    const open = plans.filter(p => !p.done), done = plans.filter(p => p.done);
    text.textContent = plans.length ? `${open.length} rencana menunggu${done.length ? `, ${done.length} sudah terlaksana` : ''} ♡` : `Belum ada rencana dengan ${partnerName()}. Mulai dari yang kecil, misalnya jalan sore.`;
    for (const p of [...open, ...done]) {
      const li = make('li', '', 'plan' + (p.done ? ' done' : ''));
      const check = document.createElement('input'); check.type = 'checkbox'; check.checked = p.done; check.setAttribute('aria-label', 'Sudah terlaksana: ' + p.title);
      check.onchange = () => savePlan({ ...p, done: check.checked, updatedAt: Date.now() });
      const copy = make('div', '', 'plan-copy');
      copy.append(make('b', p.title), make('small', planTime(p.time) + (p.place ? ' · ' + p.place : '') + ' · ' + (p.byMe ? 'ajakanmu' : 'dari ' + p.by.split(' ')[0])));
      if (p.note) copy.append(make('span', p.note));
      const mine = button('Ke agendaku', 'quiet'); mine.hidden = !p.time || p.done;
      mine.onclick = () => { if (addItems([{ kind: 'agenda', title: p.title, note: [p.place && '📍 ' + p.place, p.note, 'Rencana berdua ♡'].filter(Boolean).join('\n'), time: p.time, done: false, ...(p.place ? { place: p.place } : {}) }])) notify('Masuk agendamu. Mimi ingetin nanti ♡'); };
      const remove = button('Hapus', 'quiet');
      remove.onclick = async () => { try { await sync.call(`/v1/partner/plans/${p.id}/remove`, {}); } catch { notify('Belum bisa dihapus.'); } void refresh(); };
      const acts = make('div', '', 'plan-actions'); acts.append(mine, remove);
      li.append(check, copy, acts);
      ul.append(li);
    }
  }
  async function savePlan(p) {
    try { await sync.call('/v1/partner/plans', p); } catch (e) { notify(e.message || 'Rencana belum tersimpan.'); }
    await refresh();
  }
  function openPlan() {
    const box = dialog(paired() ? `Rencana bareng ${partnerName()} ♡` : 'Ajak pasangan ♡', 'plan-form');
    const field = (label, el) => { const l = make('label', label); l.append(el); return l; };
    const title = make('input'); title.maxLength = 100; title.required = true; title.placeholder = 'Misalnya, jalan sore di taman';
    const when = make('input'); when.type = 'datetime-local';
    const place = make('input'); place.maxLength = 160; place.placeholder = 'Boleh kosong';
    const note = make('textarea'); note.rows = 2; note.maxLength = 500; note.placeholder = 'Boleh kosong';
    const out = make('p', '', 'muted'); out.setAttribute('role', 'status');
    const save = button(paired() ? 'Simpan rencana' : 'Ajak lewat WhatsApp', 'primary'), cancel = button('Batal', 'quiet');
    save.onclick = async () => {
      if (!title.value.trim()) { title.focus(); return; }
      const data = { title: title.value, time: when.value, place: place.value, note: note.value };
      if (paired()) { box.close(); await savePlan(data); notify(`Rencana tersimpan. ${partnerName()} bisa melihatnya ♡`); return; }
      const me = read(meKey, {});
      const url = shareUrl(encodeShare('rencana', { ...data, from: me.letterName || sync.state.user?.name?.split(' ')[0] || 'Aku' }));
      const text = `🗓 Aku ngajak: ${title.value.trim()}${when.value ? ' (' + planTime(when.value) + ')' : ''}. Buka untuk masukkan ke agendamu: ${url}`;
      const phone = cleanPhone(me.waPhone);
      const a = Object.assign(document.createElement('a'), { href: phone ? waLink(phone, text) : 'https://wa.me/?text=' + encodeURIComponent(text), target: '_blank', rel: 'noopener' });
      document.body.append(a); a.click(); a.remove();
      box.close(); notify('WhatsApp dibuka. Tinggal tekan kirim ♡');
    };
    cancel.onclick = () => box.close();
    const actions = make('div', '', 'row'); actions.append(cancel, save);
    box.append(field('Mau ngapain?', title), field('Kapan', when), field('Di mana', place), field('Catatan', note), out, actions);
    box.showModal(); title.focus();
  }
  function mountAgenda(el) {
    views.agenda = el;
    el.querySelector('[data-plan-add]').onclick = () => openPlan();
    renderAgenda();
    void refresh();
  }

  // ---------- Tautan masuk (#surat / #rencana) ----------
  function handleHash() {
    const got = decodeShare(location.hash);
    if (!got) return false;
    history.replaceState(null, '', location.pathname + location.search);
    if (got.kind === 'surat') {
      const list = local();
      if (!list.some(l => l.at === got.data.at && l.body === got.data.body)) write(localKey, [{ ...got.data, read: false }, ...list].slice(0, 100));
      setTimeout(() => openLetters(), 200);
      return true;
    }
    const p = got.data;
    const box = dialog(`${p.from} ngajak kamu ♡`, 'plan-invite');
    box.append(make('p', p.title, 'plan-title'), make('p', planTime(p.time) + (p.place ? ' · ' + p.place : '')));
    if (p.note) box.append(make('p', p.note, 'muted'));
    const yes = button(p.time ? 'Masukkan ke agendaku' : 'Simpan sebagai catatan', 'primary'), later = button('Nanti dulu', 'quiet');
    yes.onclick = () => {
      if (addItems([{ kind: p.time ? 'agenda' : 'note', title: p.title, note: [p.place && '📍 ' + p.place, p.note, `Rencana berdua dengan ${p.from} ♡`].filter(Boolean).join('\n'), time: p.time, done: false, ...(p.place ? { place: p.place } : {}) }])) notify(p.time ? 'Masuk agenda. Mimi ingetin nanti ♡' : 'Tersimpan di Koleksi ♡');
      box.close();
    };
    later.onclick = () => box.close();
    const actions = make('div', '', 'row'); actions.append(later, yes);
    box.append(actions);
    setTimeout(() => box.showModal(), 200);
    return true;
  }

  // Tautan dibuka saat Ruang Iqlima sudah terbuka di tab yang sama.
  window.addEventListener('hashchange', () => { handleHash(); });
  if (sync.enabled) {
    setInterval(() => { if (!document.hidden && online()) void refresh(); }, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && online()) void refresh(); });
  }
  return { mountToday, mountProfile, mountAgenda, handleHash, refresh };
}
