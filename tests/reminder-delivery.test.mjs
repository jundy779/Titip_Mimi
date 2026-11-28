import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { calendarAlarm } from '../src/scripts/calendar-alarm.mjs';
import { readCalendar } from '../src/scripts/calendar.js';
import { mountSystemSettings, notifyDue } from '../src/scripts/system-reminders.js';

test('calendar alarm preserves Unicode, WIB, escaping and the agenda link', () => {
  const title = 'Ambil nota, pita; 🎀'.repeat(8) + '\r\nEND:VEVENT';
  const entry = {title, reminderId:'sample', time:'2026-11-24T11:00:00+07:00'};
  const alarm = calendarAlarm(entry, 'https://example.test/');
  assert.ok(alarm.split('\r\n').every(line=>Buffer.byteLength(line)<=75));
  assert.match(alarm, /DTSTART:20261124T040000Z/);
  assert.match(alarm, /TRIGGER:PT0M/);
  assert.match(alarm, /URL:https:\/\/example.test\/\?agenda=sample/);
  assert.equal(readCalendar(alarm).entries[0].title, title.replace('\r\n','\n'));
  assert.match(calendarAlarm({...entry, snoozeUntil: Date.parse(entry.time)+600000}, 'https://example.test/'), /DTSTART:20261124T041000Z/);
});

test('permission, opt in, test alert, due, snooze, done and opt out', async () => {
  globalThis.window = globalThis;
  globalThis.isSecureContext = true;
  const values = new Map();
  globalThis.localStorage = {getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
  globalThis.Notification = {permission:'default', requestPermission:async()=>Notification.permission};
  const sent = [];
  const registration = { showNotification: async (title, options)=>sent.push(options) };
  Object.defineProperty(navigator,'serviceWorker',{value:{register:async()=>registration, ready:Promise.resolve(registration)}});
  const controls = {'[role=status]':{}, '[data-enable]':{}, '[data-test]':{}};
  const mount = () => mountSystemSettings({querySelector:key=>controls[key]});
  const toggle=controls['[data-enable]'], trial=controls['[data-test]'];
  mount(); assert.ok(trial.disabled);
  Notification.permission='denied'; await toggle.onclick(); assert.ok(toggle.disabled);
  Notification.permission='granted'; mount(); await toggle.onclick();
  assert.equal(trial.disabled,false); await trial.onclick(); assert.equal(sent[0].data.id,'test');
  const now=Date.now(), entry={reminderId:'123',time:new Date(now).toISOString()};
  await notifyDue([entry],now); await notifyDue([entry],now);
  assert.equal(sent.length,2); assert.equal(sent[1].data.id,'123');
  const later={...entry,snoozeUntil:now+600000};
  await notifyDue([later],now); await notifyDue([later],now+600000);
  assert.equal(sent.length,3);
  await notifyDue([{...entry,done:true,reminderId:'done'}],now);
  await toggle.onclick(); await notifyDue([{...entry,reminderId:'off'}],now);
  assert.equal(sent.length,3);
});

function loadWorker({ windows = [], api = '' } = {}) {
  const handlers = {}, shown = [], fetched = [], state = { windows, opened: null };
  const clients = { matchAll: async () => state.windows, openWindow: async url => { state.opened = url; } };
  const registration = { scope: 'https://example.test/', showNotification: async (title, options) => { shown.push({ title, ...options }); } };
  const fetchStub = async (url, init) => { fetched.push({ url, init }); return { ok: true, json: async () => ({ message: 'Selesai ♡ Mimi bangga' }) }; };
  vm.runInNewContext(readFileSync(new URL('../public/mimi-reminders-sw.js', import.meta.url), 'utf8'),
    { URL, JSON, String, Array, fetch: fetchStub, self: { location: { href: 'https://example.test/mimi-reminders-sw.js' + (api ? '?api=' + encodeURIComponent(api) : '') }, clients, registration, addEventListener: (name, cb) => { handlers[name] = cb; } } });
  const fire = async (name, event) => { let work; handlers[name]({ ...event, waitUntil: p => { work = p; } }); await work; };
  return { fire, shown, fetched, state };
}

test('notification tap focuses an existing planner or opens the original agenda URL', async () => {
  const w = loadWorker();
  const tap = () => w.fire('notificationclick', { notification: { close() {}, data: { id: 'sample' } } });
  await tap(); assert.equal(w.state.opened, 'https://example.test/?agenda=sample');
  let got;
  w.state.windows = [{ url: 'https://example.test/', focus: async () => {}, postMessage: message => { got = message.id; } }];
  await tap(); assert.equal(got, 'sample');
});

test('push dari server tampil dengan tombol, kecuali saat web sedang dilihat', async () => {
  const msg = { type: 'agenda', title: 'Mimi mau ingetin ♡', body: 'Ambil jahitan', tag: 'mimi-r1', id: 'r1', t: 'tok', actions: [{ action: 'done', title: 'Selesai' }, { action: 'snooze', title: 'Tunda' }, { action: 'x', title: 'x' }] };
  const w = loadWorker();
  await w.fire('push', { data: { json: () => msg } });
  assert.equal(w.shown.length, 1);
  assert.equal(w.shown[0].tag, 'mimi-r1');
  assert.deepEqual(w.shown[0].actions.map(a => a.action), ['done', 'snooze']);
  assert.deepEqual({ ...w.shown[0].data }, { id: 'r1', type: 'agenda', t: 'tok' });
  w.state.windows = [{ focused: true, visibilityState: 'visible', url: 'https://example.test/' }];
  await w.fire('push', { data: { json: () => msg } });
  assert.equal(w.shown.length, 1, 'tidak digandakan saat web dilihat');
  await w.fire('push', { data: { json: () => ({ type: 'test', title: 'Tes', body: '', tag: 'mimi-test' }) } });
  assert.equal(w.shown.length, 2, 'tes tetap tampil');
});

test('tombol di notifikasi mengirim token ke server tanpa membuka web', async () => {
  const w = loadWorker({ api: 'https://api.contoh.id' });
  await w.fire('notificationclick', { action: 'snooze', notification: { close() {}, data: { id: 'r1', t: 'tok' } } });
  assert.equal(w.fetched.length, 1);
  assert.equal(w.fetched[0].url, 'https://api.contoh.id/v1/push/action');
  assert.equal(w.fetched[0].init.headers['X-Mimi'], '1');
  assert.deepEqual(JSON.parse(w.fetched[0].init.body), { t: 'tok', action: 'snooze' });
  assert.equal(w.state.opened, null);
  assert.equal(w.shown[0].title, 'Selesai ♡ Mimi bangga');
});
