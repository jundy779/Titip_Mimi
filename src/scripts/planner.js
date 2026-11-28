import { downloadAlarm } from './calendar-alarm.mjs';
import { mountSystemSettings, notifyDue } from './system-reminders.js';
import { mountDailyList } from './daily-list.js';
import { accountCards } from './account-import.mjs';
import { calendarButton, readCalendar } from './calendar.js';
import { nextReminder } from './reminders.mjs';
import { localDay } from './day.ts';
import { mimiSay, floatHearts, manjaOn, hideBubble } from './mimi-bubble.js';
import { greeting, readState, visit, writeState } from './mimi-manja.mjs';
import { mergeInbox, inboxMessage } from './extension-inbox.mjs';
import { createSync } from './mimi-sync.js';
import { mountToday, mountProfile as mountCare, openHelp, careTick, logWin, unlogWin, applySetupLink } from './iqlima-ui.js';
import { nextOccurrence, repeats } from './iqlima.mjs';
function addImport(card){
  const input=document.createElement('input');
  input.type='file';input.accept='.ics,text/calendar';input.hidden=true;
  const button=make('button','Ambil dari Google Kalender');
  const hint=make('p','Pilih file .ics hasil ekspor Google Kalender. Mimi bisa mengambil acara satu kali dan acara seharian.');
  card.append(hint,button,input);
  button.onclick=()=>input.click();
  input.onchange=async()=>{
    try {
      const {entries,skipped}=readCalendar(await input.files[0].text());
      const seen=new Set(items.map(x=>x.icsId));
      const fresh=entries.filter(x=>{if(seen.has(x.icsId))return false;seen.add(x.icsId);return true});
      if(fresh.length && !save([...fresh,...items]))return;
      render();
      el('notice').textContent=fresh.length+' agenda ditambahkan. '+(entries.length-fresh.length)+' sudah ada. '+skipped+' acara dilewati.';
    } catch {el('notice').textContent='File belum bisa dibaca. Pilih file .ics yang sudah dikeluarkan dari ZIP, ya.'}
    input.value='';
  };
}

const el=id=>document.getElementById(id);

const key='ruang-iqlima-demo-v1';
let tab='Hari Ini',items=[];
let today=new Date(), day=localDay(today);
let visitState={enabled:true,lastVisit:'',pets:0};
try{visitState=visit(localStorage).state}catch{}
try{items=JSON.parse(localStorage.getItem(key)||'null')||[{title:'Ambil jahitan',note:'Bawa nota waktu mengambil pesanan.',time:day+'T16:00',done:false,demo:true},{title:'Undangan syukuran',note:'Contoh undangan di koleksi Iqlima.',time:'',done:false,demo:true}]}catch{items=[]}
function make(tag,txt){const n=document.createElement(tag);n.textContent=txt;return n}
function identifyReminders(entries) {
  return entries.map(entry => entry.time && !entry.reminderId ?
    {...entry, reminderId: globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2)} : entry);
}
let sync=null;
function save(next){try{next=identifyReminders(next);if(sync)next=sync.stamp(items,next);localStorage.setItem(key,JSON.stringify(next));items=next;sync?.schedule();return true}catch{alert('Titipannya belum tersimpan. Penyimpanan browser mungkin penuh atau dibatasi.');return false}}
if(items.some(item=>item.time && !item.reminderId))save(items);
let ready=false;
// Data dari server ditulis langsung tanpa ditandai sebagai perubahan lokal.
sync=createSync({
  getItems:()=>items,
  setItems:(next,quiet)=>{try{localStorage.setItem(key,JSON.stringify(next));items=next}catch{return}if(!quiet&&ready&&!document.querySelector('dialog[open]'))render()},
  notify:text=>{el('notice').textContent=text},
});
const kinds = {note:'Catatan',account:'Akun',agenda:'Agenda'};
const kindOf = item => item.kind || (item.time ? 'agenda' : 'note');
let selectedKind = '', search = '', editing = null;
function configureForm(){
  const kind = el('jenis').value;
  const account = kind === 'account';
  el('account-fields').hidden = !account;
  el('identity').required = account;
  el('note-field').hidden = account;
  el('date-field').hidden = account;
  el('quick-days').hidden = account;
  el('repeat-field').hidden = kind !== 'agenda';
  el('waktu').required = kind === 'agenda';
  el('title-label').textContent = account ? 'Nama layanan' : kind === 'agenda' ? 'Nama agenda' : 'Judul catatan';
  el('date-label').textContent = kind === 'agenda' ? 'Tanggal dan jam' : 'Masuk agenda kapan? (boleh kosong)';
}
function capture(kind, item = null){
  editing = item;
  el('form').reset();
  el('capture-title').textContent = item ? 'Ubah titipan' : 'Titip ke Mimi ♡';
  el('jenis').value = kind;
  el('jenis').disabled = Boolean(item);
  configureForm();
  el('judul').value = item?.title || '';
  el('isi').value = item?.note || '';
  el('identity').value = item?.identity || '';
  el('method').value = item?.method || 'Google';
  el('waktu').value = item?.time || '';
  el('ulang').value = item?.repeat || '';
  el('box').showModal();
}
el('jenis').onchange = configureForm;
function dateOffset(offset, now=new Date()){
  return new Date(now.getFullYear(),now.getMonth(),now.getDate()+offset);
}
Array.from(el('quick-days').children).forEach((button,offset)=>{
  button.onclick=()=>{
    const field=el('waktu');
    const clock=field.value.slice(11,16) || new Date().toTimeString().slice(0,5);
    field.value=localDay(dateOffset(offset))+'T'+clock;
    field.focus();
  };
});
function agendaList(target,rows){
  const now=new Date();
  const todayKey=localDay(now), tomorrowKey=localDay(dateOffset(1,now));
  const sections=new Map(['Terlewat','Hari ini','Besok','Berikutnya','Selesai'].map(name=>[name,[]]));
  for(const item of rows){
    const date=item.time.slice(0,10);
    let group='Berikutnya';
    if(item.done)group='Selesai';
    else if(date<todayKey)group='Terlewat';
    else if(date===todayKey)group='Hari ini';
    else if(date===tomorrowKey)group='Besok';
    sections.get(group).push(item);
  }
  if(!rows.length){
    const empty=make('div','');empty.className='collection-empty';
    const mascot=new Image(96,96);mascot.src='remind.webp';mascot.alt='';
    empty.append(mascot,make('h2','Belum ada agenda'),make('p','Pilih Tambah agenda untuk menentukan hari dan jamnya.'));
    target.append(empty);
  }
  for(const [name,entries] of sections){
    if(!entries.length)continue;
    const completed=name==='Selesai';
    const section=make(completed?'details':'section','');
    section.className='agenda-group';
    section.append(make(completed?'summary':'h3',completed?'Selesai ('+entries.length+')':name));
    for(const item of entries){
      const article=make('article','');article.className='entry';
      const at=new Date(item.time);
      const time=at.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})+' · '+(item.allDay?'Seharian':at.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}))+(item.repeat?' · ↻ '+repeats[item.repeat]:'');
      const open=make('button',item.title);open.className='agenda-title';open.onclick=()=>detail(item);
      const toggle=make('button',item.done?'Batalkan selesai':'Tandai selesai');
      toggle.onclick=()=>{if(setDone(item,!item.done))render()};
      const actions=make('div','');actions.className='agenda-actions';
      actions.append(toggle,calendarButton(item));
      article.append(make('small',time),open,actions);
      section.append(article);
    }
    target.append(section);
  }
}
function render(){refreshReminder();document.body.dataset.page=tab;const nav=document.querySelector('nav');
for(const button of nav.children){
  const name=button.dataset.section;
  button.onclick=()=>{if(tab!==name){tab=name;el('notice').textContent='';render()}};
  const active=name===tab;
  button.classList.toggle('active',active);
  if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
}
const p=el('page');p.replaceChildren();if(tab==='Profil'){
  p.append(el('profile-template').content.cloneNode(true));
  document.dispatchEvent(new Event('mimi-theme-mounted'));
  p.querySelector('[data-test-popup]').onclick=()=>{
    previewReminder=true;
    refreshReminder();
    el('due-close').focus();
  };
  p.querySelector('[data-open-agenda]').onclick=()=>{tab='Agenda';render()};
  sync.mountProfile(p.querySelector('[data-account]'));
  sync.mountTelegram(p.querySelector('[data-telegram]'));
  mountCare(p.querySelector('[data-care-section]'),iqlimaApi);
  const manja=p.querySelector('[data-manja-switch]');
  manja.checked=readState(localStorage).enabled;
  manja.onchange=()=>{
    if(!writeState(localStorage,{...readState(localStorage),enabled:manja.checked})){manja.checked=!manja.checked;el('notice').textContent='Pilihan belum tersimpan. Coba lagi, ya.';return}
    el('notice').textContent=manja.checked?'Mimi manja nyala lagi ♡':'Mimi manja dimatikan. Mimi tetap ngabarin dengan kalimat biasa.';
    if(manja.checked)mimiSay('pet');else hideBubble();
  };
  return;
}
if(tab==='Hari Ini'){home(p);return}
if(tab==='Koleksi'){collection(p);return}
p.append(el('agenda-template').content.cloneNode(true));
mountSystemSettings(p.querySelector('[data-system-settings]'));
addImport(p.querySelector('[data-calendar-import]'));
p.querySelector('[data-add]').onclick=()=>capture('agenda');
agendaList(p.querySelector('[data-schedule]'),items.filter(item=>item.time).sort((a,b)=>a.time.localeCompare(b.time)));
}

function collection(page){
  page.append(el('collection-template').content.cloneNode(true));
  const field=page.querySelector('input');
  const filters=page.querySelector('.chips');
  const summary=page.querySelector('.collection-summary [role=status]');
  const reset=page.querySelector('[data-reset]');
  const results=page.querySelector('.collection-results');
  field.value=search;
  page.querySelector('[data-add]').onclick=()=>capture(selectedKind || 'note');
  for(const [kind,label] of Object.entries({'':'Semua',...kinds})){
    const chip=make('button',label);
    chip.className='chip';
    chip.dataset.kind=kind;
    chip.onclick=()=>{selectedKind=kind;refresh()};
    filters.append(chip);
  }
  const importer=page.querySelector('[data-import]');
  const picker=importer.querySelector('input');
  const preview=importer.querySelector('[data-preview]');
  const message=importer.querySelector('[data-import-message]');
  const confirm=importer.querySelector('[data-confirm]');
  let candidates=[], version=0;
  function clearPreview(){
    version++; candidates=[];picker.value='';preview.replaceChildren();message.textContent='';confirm.hidden=true;
  }
  importer.ontoggle=()=>{if(!importer.open)clearPreview()};
  picker.onchange=async()=>{
    const file=picker.files[0];
    clearPreview();
    const request=version;
    if(!file)return;
    if(file.size>5*1024*1024){message.textContent='Pilih CSV di bawah 5 MB, ya.';return}
    try{
      const cards=accountCards(await file.text(),items);
      if(request!==version || !importer.isConnected)return;
      candidates=cards;
      message.textContent=cards.length?'Centang akun yang mau dititipkan.':'Tidak ada kartu baru dengan nama layanan dan username.';
      cards.forEach((card,index)=>{
        const label=make('label','');
        const check=document.createElement('input');check.type='checkbox';check.value=String(index);
        label.append(check,document.createTextNode(card.title+' · '+card.identity));preview.append(label);
      });
      confirm.hidden=!cards.length;confirm.disabled=true;
    }catch{if(request===version)message.textContent='File belum bisa dibaca. Pilih CSV dengan kolom username dan name atau url.'}
  };
  preview.onchange=()=>{confirm.disabled=!preview.querySelector(':checked')};
  confirm.onclick=()=>{
    const chosen=Array.from(preview.querySelectorAll(':checked'),check=>candidates[Number(check.value)]);
    if(!chosen.length || !save([...chosen.map(card=>recordEvent(card,'Diimpor')),...items]))return;
    clearPreview();importer.open=false;field.value='';refresh();
    el('notice').textContent=chosen.length+' kartu akun sudah Mimi simpan.';
  };
  function refresh(){
    importer.hidden=selectedKind!=='account';
    if(importer.hidden && importer.open){importer.open=false;clearPreview()}
    search=field.value;
    const query=search.trim().toLocaleLowerCase('id');
    const rows=items.filter(item=>(!selectedKind || kindOf(item)===selectedKind)
      && [item.title,item.note,item.identity,item.method].join(' ').toLocaleLowerCase('id').includes(query));
    for(const chip of filters.children)chip.setAttribute('aria-pressed',String(chip.dataset.kind===selectedKind));
    reset.hidden=!search && !selectedKind;
    summary.textContent=rows.length+' titipan';
    results.replaceChildren();
    if(!rows.length){
      const empty=make('div','');
      empty.className='collection-empty';
      const mimi=new Image();
      mimi.src='/mimi-search.webp';mimi.alt='';mimi.width=96;mimi.height=96;
      empty.append(mimi,make('p',items.length?'Belum ketemu. Coba kata lain atau pilih Semua.':'Koleksimu masih kosong. Mau titip sesuatu?'));
      results.append(empty);
    }
    for(const item of rows){
      const button=make('button','');
      button.className='collection-item';button.dataset.kind=kindOf(item);
      const thumbnail=art(item);
      if(thumbnail){
        const img=new Image();img.src=thumbnail;img.alt='';img.loading='lazy';img.width=72;img.height=72;
        button.append(img);
      }
      const copy=make('div','');
      copy.append(make('small',kinds[kindOf(item)]+(item.attachments?.length?' · 📎 '+item.attachments.length+' lampiran':'')+(item.source==='telegram'?' · dari Telegram':'')),make('b',item.title));
      const preview=kindOf(item)==='account'?[item.identity,item.method].filter(Boolean).join(' · '):item.note;
      if(preview)copy.append(make('span',preview));
      button.append(copy);
      button.onclick=()=>detail(item);
      results.append(button);
    }
  }
  field.oninput=refresh;
  reset.onclick=()=>{selectedKind='';field.value='';refresh();field.focus()};
  refresh();
}
function art(x){
 if(x.title==='Ambil jahitan')return 'receipt.webp';
 if(x.title==='Undangan syukuran')return 'invite.webp';
 return '';
}
function recordEvent(card, label){
  return {...card,history:[...(card.history || []),{label,at:new Date().toISOString()}]};
}
function cheer(next, item){
  const scheduled=next.filter(entry=>entry.time?.startsWith(day));
  const finishedToday=item.time?.startsWith(day) && scheduled.length>1 && scheduled.every(entry=>entry.done);
  mimiSay(finishedToday?'allDone':'done');
}
function setDone(item, done, patch={}){
  const ref=item.clientId||item.title+'|'+item.time;
  const following=done&&item.repeat?nextOccurrence(item):null;
  let next=items.map(x=>x===item?{...x,done,...patch,...(following?{repeat:undefined,repeatDay:undefined,repeated:item.repeat}:{})}:x);
  // Rutinitas: yang selesai jadi catatan riwayat, jadwal berikutnya dibuat otomatis.
  if(following)next=[{kind:'agenda',title:item.title,note:item.note||'',time:following.time,done:false,repeat:item.repeat,...(following.repeatDay?{repeatDay:following.repeatDay}:{})},...next];
  if(!save(next))return false;
  if(done){logWin({kind:'done',ref,text:item.title});cheer(next,item)}else unlogWin(ref);
  if(following)el('notice').textContent='Selesai ♡ Mimi sudah siapkan jadwal berikutnya: '+new Date(following.time).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'})+'.';
  return true;
}
function ask(title, description, action){
  return new Promise(resolve=>{
    const box=document.createElement('dialog');
    box.setAttribute('aria-label',title);
    const cancel=make('button','Batal');
    cancel.autofocus=true;
    cancel.onclick=()=>box.close();
    const accept=make('button',action);
    accept.onclick=()=>box.close('yes');
    box.append(make('h2',title),make('p',description),cancel,accept);
    document.body.append(box);
    box.onclose=()=>{box.remove();resolve(box.returnValue==='yes')};
    box.showModal();
  });
}
function accountActions(dlg,card){
  const history=card.history || [];
  dlg.append(make('h3','Riwayat akun'));
  if(!history.some(event=>['Ditambahkan','Diimpor'].includes(event.label))){
    dlg.append(make('p','Tanggal ditambahkan belum tercatat.'));
  }
  for(const event of history.slice().reverse()){
    const date=new Date(event.at).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'});
    dlg.append(make('p',event.label+' · '+date));
  }
  const identity=card.title+' · '+card.identity;
  const changed=make('button','Aku baru ganti sandi');
  changed.onclick=async()=>{
    if(!await ask('Catat perubahan sandi?',identity,'Catat'))return;
    const updated=recordEvent(card,'Ganti sandi dicatat');
    if(save(items.map(item=>item===card?updated:item))){dlg.close();render();detail(updated);mimiSay('password')}
  };
  const remove=make('button','Hapus kartu akun');
  remove.onclick=async()=>{
    if(!await ask('Hapus kartu akun ini?',identity,'Lanjutkan'))return;
    if(!await ask('Yakin hapus dari Mimi?',identity+'. Kartu dan riwayatnya akan dihapus. Akun di layanan asal tetap aktif.','Ya, hapus kartu'))return;
    if(save(items.filter(item=>item!==card))){dlg.close();render();el('notice').textContent='Kartu akun sudah dihapus dari Mimi.'}
  };
  dlg.append(changed,remove);
}
// Foto, video, dan dokumen yang dikirim lewat Telegram. Dimuat lewat server (token bot tidak pernah ke browser).
function attachmentsOf(x){
 const box=make('div','');box.className='attachments';
 for(const a of x.attachments){
  const slot=make('div','');slot.className='attachment attachment-'+a.kind;
  const wait=make('p',a.kind==='photo'?'Memuat foto…':a.kind==='video'?'Memuat video…':'Menyiapkan dokumen…');wait.className='muted';
  slot.append(wait);box.append(slot);
  sync.media(a.id).then(url=>{
   let node;
   if(a.kind==='photo'){node=new Image();node.src=url;node.alt='Foto: '+x.title;node.loading='lazy';node.className='full'}
   else if(a.kind==='video'){node=document.createElement('video');node.src=url;node.controls=true;node.preload='metadata';node.className='full'}
   else{node=document.createElement('a');node.href=url;node.textContent='📎 '+(a.name||'Buka dokumen');node.className='button quiet';node.rel='noopener';if(url.startsWith('blob:'))node.download=a.name||'dokumen'}
   node.addEventListener('error',()=>{wait.textContent='Lampiran belum bisa dibuka. Coba lagi nanti, atau buka dari Telegram.';node.replaceWith(wait)});
   wait.replaceWith(node);
  }).catch(e=>{wait.textContent=e.message||'Lampiran ini ada di Telegram. Masuk dulu untuk membukanya.'});
 }
 return box;
}
function detail(x){
 const dlg=document.createElement('dialog');
 dlg.className='item-detail';dlg.dataset.kind=kindOf(x);
 const title=make('h2',x.title);
 dlg.append(title);
 if(art(x)){const img=new Image();img.src=art(x);img.alt=x.title;img.className='full';dlg.append(img)}
 dlg.setAttribute('aria-label',x.title);
 if(kindOf(x)==='account'){dlg.append(make('p',x.identity),make('p','Cara masuk: '+x.method));accountActions(dlg,x)}
 else {const note=make('p',x.note);note.className='note-body';dlg.append(note)}
 if(x.attachments?.length)dlg.append(attachmentsOf(x));
 if(x.repeat)dlg.append(make('p','↻ '+repeats[x.repeat]));
 if(x.helpAskedAt)dlg.append(make('p','Udah minta tolong Jundy · '+new Date(x.helpAskedAt).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'})));
 if(!x.icsId){const edit=make('button','Ubah');edit.onclick=()=>{dlg.close();capture(kindOf(x),x)};dlg.append(edit)}
 if(kindOf(x)!=='account'){const help=make('button','Minta tolong Jundy');help.onclick=()=>{dlg.close();openHelp(x,()=>{if(save(items.map(i=>i===x?{...i,helpAskedAt:new Date().toISOString()}:i))){render();el('notice').textContent='Pesan untuk Jundy siap. Kamu nggak sendirian ♡'}})};dlg.append(help)}
 if(x.time){dlg.append(make('p',new Date(x.time).toLocaleString('id-ID')));
 const toggle=make('button',x.done?'Batalkan selesai':'Tandai selesai');
 toggle.onclick=()=>{if(setDone(x,!x.done)){dlg.close();render()}};dlg.append(toggle,calendarButton(x));
 if(!x.done && x.reminderId && (x.snoozeUntil || Date.parse(x.time))>Date.now()){
   const alarm=make('button','Ingatkan lewat kalender HP');
   alarm.onclick=()=>downloadAlarm(x);
   dlg.append(alarm,make('p','Buka file .ics di kalender HP, cek pengingatnya, lalu simpan. Kalau jadwal berubah, ubah juga di kalendermu.'));
 }
 if(!x.done && nextReminder([x])){const later=make('button','Tunda 10 menit');later.onclick=()=>{
   if(save(items.map(i=>i===x?{...i,snoozeUntil:Date.now()+600000}:i))){dlg.close();render();el('notice').textContent='Mimi ingetin lagi 10 menit dari sekarang.';mimiSay('snooze')}
 };dlg.append(later)}}
 const close=make('button','Tutup');close.className='quiet';close.onclick=()=>dlg.close();dlg.append(close);document.body.append(dlg);dlg.onclose=()=>dlg.remove();dlg.showModal()
}
function gallery(node,rows){
 node.replaceChildren();node.className='tiles';
 if(!rows.length)node.append(make('p','Belum ada titipan yang cocok.'));
 for(const x of rows){const tile=make('button','');tile.className='tile';if(art(x)){const im=new Image();im.src=art(x);im.alt='';tile.append(im)}else{tile.append(make('span',kinds[kindOf(x)]))}tile.append(make('b',x.title));if(x.identity)tile.append(make('small',x.identity));tile.onclick=()=>detail(x);node.append(tile)}
}
const iqlimaApi={
  addItems:fresh=>{if(!save([...fresh,...items]))return false;render();return true},
  notice:text=>{el('notice').textContent=text},
  say:kind=>mimiSay(kind),
};
function mountGreeting(p){
  const title=p.querySelector('.greeting h1'), line=p.querySelector('.mimi-line');
  const pet=p.querySelector('.welcome-pet'), status=p.querySelector('#pet-status');
  if(manjaOn()){
    const hello=greeting(new Date(),visitState);
    title.textContent=hello.title;
    line.textContent=hello.line;line.hidden=false;
  }
  pet.onclick=()=>{
    const state=readState(localStorage);
    const pets=state.pets+1;
    writeState(localStorage,{...state,pets});
    if(!state.enabled){status.textContent='Mimi senang dielus.';return}
    pet.classList.remove('petted');void pet.offsetWidth;pet.classList.add('petted');
    floatHearts(pet);
    status.textContent=mimiSay('pet',pets)?.text||'';
  };
}
function home(p){
 p.replaceChildren(document.querySelector('#today-template').content.cloneNode(true));
 mountDailyList(p.querySelector('.mimi-list'), day);
 p.querySelector('.date').textContent=today.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long'});
 mountGreeting(p);
 mountToday(p,iqlimaApi);
 p.querySelector('.quick').onclick=()=>capture(tab==='Agenda'?'agenda':tab==='Koleksi'&&selectedKind?selectedKind:'note');
 for(const shortcut of p.querySelectorAll('[data-capture-kind]')){
   shortcut.onclick=()=>capture(shortcut.dataset.captureKind);
 }
 const scheduled=items.filter(item=>item.time?.startsWith(day));
 const progress=p.querySelector('.day-progress');
 if(scheduled.length){
   const completed=scheduled.filter(item=>item.done).length;
   progress.hidden=false;
   progress.querySelector('p').textContent=completed+' dari '+scheduled.length+' selesai';
   const bar=progress.querySelector('progress');
   bar.max=scheduled.length;bar.value=completed;
 }
 const first=scheduled.filter(x=>!x.done).sort((a,b)=>a.time.localeCompare(b.time))[0];
 const next=p.querySelector('.next');
 if(first){const info=make('div','');info.append(make('small',first.allDay?'Seharian':first.time.slice(11,16)),make('h3',first.title));next.append(info);
 const open=make('button',art(first)?'Lihat nota':'Lihat agenda');if(art(first)){const img=new Image();img.src=art(first);img.alt='';open.prepend(img)}open.onclick=()=>detail(first);next.append(open)}else next.append(make('p',scheduled.length?'Semua agenda hari ini sudah beres ♡':'Belum ada agenda hari ini.'));
 p.querySelector('.all').onclick=()=>{tab='Koleksi';selectedKind='';search='';render()};
 gallery(p.querySelector('.previews'),items.slice(0,2).reverse())
}

el('cancel').onclick=()=>el('box').close();
el('form').onsubmit = event => {
  event.preventDefault();
  const title = el('judul').value.trim();
  if(!title){el('judul').focus();return}
  const kind = el('jenis').value;
  const account = kind === 'account';
  const identity = el('identity').value.trim();
  if(account && !identity){el('identity').focus();return}
  let entry = {...editing,kind,title,note:account?'':el('isi').value.trim(),
    time:account?'':el('waktu').value,done:editing?.done || false};
  if(editing && editing.time !== entry.time)delete entry.snoozeUntil;
  if(account)Object.assign(entry,{identity,method:el('method').value});
  delete entry.repeat;delete entry.repeatDay;
  if(kind==='agenda'&&el('ulang').value&&entry.time){entry.repeat=el('ulang').value;if(entry.repeat==='monthly')entry.repeatDay=Number(entry.time.slice(8,10))}
  if(account){
    if(!editing)entry=recordEvent(entry,'Ditambahkan');
    else if(['title','identity','method'].some(k=>entry[k]!==editing[k]))entry=recordEvent(entry,'Diedit');
  }
  if(!save(editing ? items.map(item=>item===editing?entry:item) : [entry,...items]))return;
  el('box').close();
  tab=kind==='agenda'?'Agenda':'Koleksi';selectedKind=kind;search='';render();
  el('notice').textContent=entry.time?'Udah Mimi catat buat '+new Date(entry.time).toLocaleString('id-ID',{dateStyle:'full',timeStyle:'short'})+' ♡':'Udah Mimi simpan di Koleksi ♡';
  mimiSay(account?'account':entry.time?'agenda':'saved');
};
let shown;
let previewReminder=false;
let floatingReminder=false;
function refreshReminder(){
  void notifyDue(items);
  const due=nextReminder(items);
  if(due!==shown){
    shown=due;
    floatingReminder=Boolean(due);
  }
  const floating=previewReminder || floatingReminder;
  el('reminder').classList.toggle('floating-reminder',floating);
  el('reminder').hidden=!due && !previewReminder;
  const title=previewReminder?'Contoh pengingat: waktunya istirahat sebentar.':due?.title || '';
  if(el('due-title').textContent!==title)el('due-title').textContent=title;
  el('due-actions').hidden=previewReminder;
  el('due-close').hidden=!floating;
}
function respond(patch){
  if(!shown)return;
  const ok=patch.done?setDone(shown,true,patch):save(items.map(item=>item===shown?{...item,...patch}:item));
  if(ok){
    render();
    el('notice').textContent=patch.done?'Agenda ditandai selesai.':'Mimi ingetin lagi 10 menit dari sekarang.';
    if(!patch.done)mimiSay('snooze');
  }
}
el('due-close').onclick=()=>{
  const wasPreview=previewReminder;
  previewReminder=false;
  floatingReminder=false;
  refreshReminder();
  if(wasPreview)document.querySelector('[data-test-popup]')?.focus();
  else el('due-open').focus();
};
el('due-open').onclick=()=>{if(shown)detail(shown)};
el('due-snooze').onclick=()=>respond({snoozeUntil:Date.now()+600000});
el('due-done').onclick=()=>respond({done:true,snoozeUntil:0});
function updateClock(){
  const now=new Date();
  if(localDay(now)!==day){
    today=now;day=localDay(now);
    if(tab==='Hari Ini'||tab==='Agenda'){render();return}
  }
  refreshReminder();
  careTick(iqlimaApi,now);
}
setInterval(updateClock,5000);
document.addEventListener('visibilitychange',updateClock);
render();ready=true;
applySetupLink(iqlimaApi);

function openReminder(id) {
  el('box').open && el('box').close();
  document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
  tab='Agenda';render();
  if(id==='test'){document.querySelector('[data-system-settings]').open=true;return}
  const item=items.find(entry=>entry.reminderId===id);
  if(item)detail(item);
  else el('notice').textContent='Agenda ini sudah tidak ada di perangkat ini.';
}
navigator.serviceWorker?.addEventListener('message', event=>{
  if(event.data?.type==='mimi-open-agenda')openReminder(event.data.id);
});
const fromAlert=new URL(location.href);
if(fromAlert.searchParams.has('agenda')){
  openReminder(fromAlert.searchParams.get('agenda'));
  fromAlert.searchParams.delete('agenda');history.replaceState(null,'',fromAlert);
}

// Akun yang Iqlima titipkan lewat extension browser masuk ke sini.
window.addEventListener('message', event=>{
  if(event.source!==window || event.origin!==location.origin)return;
  const cards=inboxMessage(event.data);
  if(!cards)return;
  const {added,accepted,next}=mergeInbox(cards,items);
  if(added.length && !save(next))return;
  window.postMessage({type:'titip-mimi-inbox-ack',ids:accepted},location.origin);
  if(!added.length)return;
  render();
  el('notice').textContent=added.length+' kartu akun dari browser sudah Mimi simpan di Koleksi ♡';
  mimiSay('inbox');
});
window.postMessage({type:'titip-mimi-inbox-ready'},location.origin);
