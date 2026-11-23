import { calendarButton, readCalendar } from './calendar.js';
import { nextReminder } from './reminders.mjs';
import { localDay } from './day.ts';
function addImport(card){
  const input=document.createElement('input');
  input.type='file';input.accept='.ics,text/calendar';input.hidden=true;
  const button=make('button','Ambil dari Google Kalender');
  const hint=make('p','Pilih file .ics hasil ekspor Google Kalender. Mimi bisa mengambil acara satu kali dan acara seharian.');
  card.append(button,hint,input);
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
const names=['Hari Ini','Koleksi','Agenda','Profil'];
const key='ruang-iqlima-demo-v1';
let tab=names[0],items=[];
let today=new Date(), day=localDay(today);
try{items=JSON.parse(localStorage.getItem(key)||'null')||[{title:'Ambil jahitan',note:'Bawa nota waktu mengambil pesanan.',time:day+'T16:00',done:false},{title:'Undangan syukuran',note:'Contoh undangan di koleksi Iqlima.',time:'',done:false}]}catch{items=[]}
function make(tag,txt){const n=document.createElement(tag);n.textContent=txt;return n}
function save(next){try{localStorage.setItem(key,JSON.stringify(next));items=next;return true}catch{alert('Titipannya belum tersimpan. Penyimpanan browser mungkin penuh atau dibatasi.');return false}}
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
  if(!rows.length)target.append(make('p','Belum ada agenda di sini ♡'));
  for(const [name,entries] of sections){
    if(!entries.length)continue;
    const completed=name==='Selesai';
    const section=make(completed?'details':'section','');
    section.className='agenda-group';
    section.append(make(completed?'summary':'h3',completed?'Selesai ('+entries.length+')':name));
    for(const item of entries){
      const article=make('article','');article.className='entry';
      const at=new Date(item.time);
      const time=at.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})+' · '+(item.allDay?'Seharian':at.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}));
      const open=make('button',item.title);open.className='agenda-title';open.onclick=()=>detail(item);
      const toggle=make('button',item.done?'Batalkan selesai':'Tandai selesai');
      toggle.onclick=()=>{if(save(items.map(x=>x===item?{...x,done:!x.done}:x)))render()};
      article.append(make('small',time),open,toggle,calendarButton(item));
      section.append(article);
    }
    target.append(section);
  }
}
function render(){refreshReminder();document.body.dataset.page=tab;const nav=document.querySelector('nav');
if(!nav.children.length){
  for(const name of names){
    const button=make('button',name);
    button.onclick=()=>{if(tab!==name){tab=name;el('notice').textContent='';render()}};
    nav.append(button);
  }
}
for(const button of nav.children){
  const active=button.textContent===tab;
  button.classList.toggle('active',active);
  if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
}
const p=el('page');p.replaceChildren();if(tab==='Profil'){p.innerHTML='<section class="card"><h2>Profil Iqlima</h2><p>Ini ruang coba Iqlima. Titipan disimpan di browser ini.</p><p>Pengingat muncul selama halaman ini terbuka.</p></section>';
 const choice = document.querySelector('#theme-choice').content.cloneNode(true);
 choice.querySelector('select').value = document.documentElement.dataset.preference || 'system';
 p.querySelector('.card').append(choice);
 const links=make('section','');links.className='card';
 links.append(make('h2','Koneksi Mimi'),make('h3','Google Kalender · Manual'),make('p','Ambil file kalender atau kirim agenda dari menu Agenda. Sinkronisasi otomatis belum aktif.'));
 const go=make('button','Buka Agenda');go.onclick=()=>{tab='Agenda';render()};
 links.append(go,make('h3','Telegram · Belum terhubung'),make('p','Penautan Telegram dan kiriman foto akan tersedia saat layanan akun aktif.'));
 p.append(links);
 return}
if(tab==='Hari Ini'){home(p);return}
if(tab==='Koleksi'){collection(p);return}
const card=make('section','');
card.className='card';
card.append(make('h2','Agenda'));
p.append(card);
addImport(card);
const add=make('button','Titip sesuatu');
add.className='primary';
add.onclick=()=>capture('agenda');
const results=make('div','');
card.append(add,results);
agendaList(results,items.filter(item=>item.time).sort((a,b)=>a.time.localeCompare(b.time)));
}

function collection(page){
  page.append(el('collection-template').content.cloneNode(true));
  const field=page.querySelector('input');
  const filters=page.querySelector('.chips');
  const summary=page.querySelector('[role=status]');
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
  function refresh(){
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
      button.className='collection-item';
      const thumbnail=art(item);
      if(thumbnail){
        const img=new Image();img.src=thumbnail;img.alt='';img.loading='lazy';img.width=72;img.height=72;
        button.append(img);
      }
      const copy=make('div','');
      copy.append(make('small',kinds[kindOf(item)]),make('b',item.title));
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
function detail(x){
 const dlg=document.createElement('dialog');
 dlg.className='item-detail';
 const title=make('h2',x.title);
 dlg.append(title);
 if(art(x)){const img=new Image();img.src=art(x);img.alt=x.title;img.className='full';dlg.append(img)}
 dlg.setAttribute('aria-label',x.title);
 if(kindOf(x)==='account')dlg.append(make('p',x.identity),make('p','Cara masuk: '+x.method));
 else {const note=make('p',x.note);note.className='note-body';dlg.append(note)}
 if(!x.icsId){const edit=make('button','Ubah');edit.onclick=()=>{dlg.close();capture(kindOf(x),x)};dlg.append(edit)}
 if(x.time){dlg.append(make('p',new Date(x.time).toLocaleString('id-ID')));
 const toggle=make('button',x.done?'Batalkan selesai':'Tandai selesai');
 toggle.onclick=()=>{if(save(items.map(i=>i===x?{...i,done:!i.done}:i))){dlg.close();render()}};dlg.append(toggle,calendarButton(x))}
 const close=make('button','Tutup');close.className='quiet';close.onclick=()=>dlg.close();dlg.append(close);document.body.append(dlg);dlg.onclose=()=>dlg.remove();dlg.showModal()
}
function gallery(node,rows){
 node.replaceChildren();node.className='tiles';
 if(!rows.length)node.append(make('p','Belum ada titipan yang cocok.'));
 for(const x of rows){const tile=make('button','');tile.className='tile';if(art(x)){const im=new Image();im.src=art(x);im.alt='';tile.append(im)}else{tile.append(make('span',kinds[kindOf(x)]))}tile.append(make('b',x.title));if(x.identity)tile.append(make('small',x.identity));tile.onclick=()=>detail(x);node.append(tile)}
}
function home(p){
 p.replaceChildren(document.querySelector('#today-template').content.cloneNode(true));
 p.querySelector('.date').textContent=today.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long'});
 p.querySelector('.quick').onclick=()=>capture(tab==='Agenda'?'agenda':tab==='Koleksi'&&selectedKind?selectedKind:'note');
 const first=items.filter(x=>x.time.startsWith(day)&&!x.done).sort((a,b)=>a.time.localeCompare(b.time))[0];
 const next=p.querySelector('.next');
 if(first){const info=make('div','');info.append(make('small',first.allDay?'Seharian':first.time.slice(11,16)),make('h3',first.title));next.append(info);
 const open=make('button',art(first)?'Lihat nota':'Lihat agenda');if(art(first)){const img=new Image();img.src=art(first);img.alt='';open.prepend(img)}open.onclick=()=>detail(first);next.append(open)}else next.append(make('p','Semua agenda hari ini sudah beres ♡'));
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
  const entry = {...editing,kind,title,note:account?'':el('isi').value.trim(),
    time:account?'':el('waktu').value,done:editing?.done || false};
  if(editing && editing.time !== entry.time)delete entry.snoozeUntil;
  if(account)Object.assign(entry,{identity,method:el('method').value});
  if(!save(editing ? items.map(item=>item===editing?entry:item) : [entry,...items]))return;
  el('box').close();
  tab=kind==='agenda'?'Agenda':'Koleksi';selectedKind=kind;search='';render();
  el('notice').textContent=entry.time?'Udah Mimi catat buat '+new Date(entry.time).toLocaleString('id-ID',{dateStyle:'full',timeStyle:'short'})+' ♡':'Udah Mimi simpan di Koleksi ♡';
};
let shown;
function refreshReminder(){
  const due=nextReminder(items);
  if(due!==shown){
    shown=due;
    el('due-title').textContent=due?.title || '';
  }
  el('reminder').hidden=!due;
}
function respond(patch){
  if(shown && save(items.map(item=>item===shown?{...item,...patch}:item))){
    render();
    el('notice').textContent=patch.done?'Agenda ditandai selesai.':'Mimi ingetin lagi 10 menit dari sekarang.';
  }
}
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
}
setInterval(updateClock,5000);
document.addEventListener('visibilitychange',updateClock);
render();
