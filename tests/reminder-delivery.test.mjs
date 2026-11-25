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

test('notification tap focuses an existing planner or opens the original agenda URL', async () => {
  let handler, windows=[], result;
  const clients={matchAll:async()=>windows,openWindow:async url=>{result=url}};
  vm.runInNewContext(readFileSync(new URL('../public/mimi-reminders-sw.js',import.meta.url),'utf8'),
    {URL,self:{clients,registration:{scope:'https://example.test/'},addEventListener:(_,cb)=>handler=cb}});
  const tap=async()=>{let work; handler({notification:{close(){},data:{id:'sample'}},waitUntil:p=>{work=p}});await work};
  await tap(); assert.equal(result,'https://example.test/?agenda=sample');
  windows=[{url:'https://example.test/',focus:async()=>{},postMessage:message=>{result=message.id}}];
  await tap(); assert.equal(result,'sample');
});
