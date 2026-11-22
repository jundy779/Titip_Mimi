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
const today=new Date(), day=localDay(today);
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
function list(target,rows){target.replaceChildren();if(!rows.length)target.append(make('p',tab==='Koleksi'?'Belum ada titipan yang cocok.':'Belum ada agenda di sini ♡'));for(const x of rows){const a=make('article','');a.className='entry';a.append(make('b',x.title),make('p',x.note));if(x.time){a.append(make('p',x.allDay?x.time.slice(0,10)+' · Seharian':new Date(x.time).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'})));const b=make('button',x.done?'Sudah selesai · Batalkan':'Tandai selesai');b.onclick=()=>{if(save(items.map(i=>i===x?{...i,done:!i.done}:i)))render()};a.append(b,calendarButton(x))}target.append(a)}}
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
const card=make('section','');card.className='card';card.append(make('h2',tab==='Hari Ini'?'Agenda hari ini':tab));p.append(card);if(tab==="Agenda")addImport(card);let filter;if(tab==='Koleksi'){filter=document.createElement('input');filter.type='search';filter.placeholder='Cari titipan';filter.setAttribute('aria-label','Cari titipan');filter.value=search;card.append(filter);
 const chips=make('div','');chips.className='chips';chips.setAttribute('role','group');chips.setAttribute('aria-label','Jenis titipan');
 for(const [value,label] of Object.entries({'':'Semua',...kinds})){
   const chip=make('button',label);chip.className='chip';chip.setAttribute('aria-pressed',String(value===selectedKind));
   chip.onclick=()=>{selectedKind=value;for(const other of chips.children)other.setAttribute('aria-pressed',String(other===chip));refresh()};chips.append(chip)
 }card.append(chips)}
if(tab!=='Hari Ini'){const b=make('button','Titip sesuatu');b.className='add primary';card.append(b)}const results=make('div','');card.append(results);function refresh(){let rows=items;if(tab==='Koleksi'){const q=filter.value.toLowerCase();search=filter.value;rows=items.filter(i=>(!selectedKind||kindOf(i)===selectedKind)&&[i.title,i.note,i.identity,i.method].join(' ').toLowerCase().includes(q))}else{rows=items.filter(i=>i.time&&(tab==='Agenda'||i.time.startsWith(day))).sort((a,b)=>a.time.localeCompare(b.time))}if(filter)gallery(results,rows);else list(results,rows)}if(filter)filter.oninput=refresh;refresh();p.querySelector('.add').onclick=()=>capture(tab==='Agenda'?'agenda':tab==='Koleksi'&&selectedKind?selectedKind:'note')}
function art(x){
 if(x.title==='Ambil jahitan')return 'receipt.webp';
 if(x.title==='Undangan syukuran')return 'invite.webp';
 return '';
}
function detail(x){
 const dlg=document.createElement('dialog');
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
  tab='Koleksi';selectedKind=kind;search='';render();
  el('notice').textContent='Udah Mimi simpan di Koleksi ♡';
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
setInterval(refreshReminder,5000);
document.addEventListener('visibilitychange',refreshReminder);
render();
