import { calendarButton, readCalendar } from './calendar.js';
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
function list(target,rows){target.replaceChildren();if(!rows.length)target.append(make('p',tab==='Koleksi'?'Belum ada titipan yang cocok.':'Belum ada agenda di sini ♡'));for(const x of rows){const a=make('article','');a.className='entry';a.append(make('b',x.title),make('p',x.note));if(x.time){a.append(make('p',x.allDay?x.time.slice(0,10)+' · Seharian':new Date(x.time).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'})));const b=make('button',x.done?'Sudah selesai · Batalkan':'Tandai selesai');b.onclick=()=>{if(save(items.map(i=>i===x?{...i,done:!i.done}:i)))render()};a.append(b,calendarButton(x))}target.append(a)}}
function render(){document.body.dataset.page=tab;const nav=document.querySelector('nav');nav.replaceChildren();for(const name of names){const b=make('button',name);if(name===tab)b.className='active';b.onclick=()=>{tab=name;el('notice').textContent='';render()};nav.append(b)}
const p=el('page');p.replaceChildren();if(tab==='Profil'){p.innerHTML='<section class="card"><h2>Profil Iqlima</h2><p>Ini ruang coba Iqlima. Titipan disimpan di browser ini.</p><p>Di versi lengkap, kamu bisa masuk dengan Google dan menghubungkan Telegram di sini.</p></section>';return}
if(tab==='Hari Ini'){home(p);return}
const card=make('section','');card.className='card';card.append(make('h2',tab==='Hari Ini'?'Agenda hari ini':tab));p.append(card);if(tab==="Agenda")addImport(card);let filter;if(tab==='Koleksi'){filter=document.createElement('input');filter.type='search';filter.placeholder='Cari titipan';filter.setAttribute('aria-label','Cari titipan');card.append(filter)}
if(tab!=='Hari Ini'){const b=make('button','Titip sesuatu');b.className='add';card.append(b)}const results=make('div','');card.append(results);function refresh(){let rows=items;if(tab==='Koleksi'){const q=filter.value.toLowerCase();rows=items.filter(i=>(i.title+' '+i.note).toLowerCase().includes(q))}else{rows=items.filter(i=>i.time&&(tab==='Agenda'||i.time.startsWith(day))).sort((a,b)=>a.time.localeCompare(b.time))}if(filter)gallery(results,rows);else list(results,rows)}if(filter)filter.oninput=refresh;refresh();p.querySelector('.add').onclick=()=>el('box').showModal()}
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
 dlg.append(make('p',x.note));
 if(x.time){dlg.append(make('p',new Date(x.time).toLocaleString('id-ID')));
 const toggle=make('button',x.done?'Batalkan selesai':'Tandai selesai');
 toggle.onclick=()=>{if(save(items.map(i=>i===x?{...i,done:!i.done}:i))){dlg.close();render()}};dlg.append(toggle,calendarButton(x))}
 const close=make('button','Tutup');close.onclick=()=>dlg.close();dlg.append(close);document.body.append(dlg);dlg.onclose=()=>dlg.remove();dlg.showModal()
}
function gallery(node,rows){
 node.replaceChildren();node.className='tiles';
 if(!rows.length)node.append(make('p','Belum ada titipan yang cocok.'));
 for(const x of rows){const tile=make('button','');tile.className='tile';if(art(x)){const im=new Image();im.src=art(x);im.alt='';tile.append(im)}else{tile.append(make('span','✎'))}tile.append(make('b',x.title));tile.onclick=()=>detail(x);node.append(tile)}
}
function home(p){
 p.replaceChildren(document.querySelector('#today-template').content.cloneNode(true));
 p.querySelector('.date').textContent=today.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long'});
 p.querySelector('.quick').onclick=()=>el('box').showModal();
 const first=items.filter(x=>x.time.startsWith(day)&&!x.done).sort((a,b)=>a.time.localeCompare(b.time))[0];
 const next=p.querySelector('.next');
 if(first){const info=make('div','');info.append(make('small',first.allDay?'Seharian':first.time.slice(11,16)),make('h3',first.title));next.append(info);
 const open=make('button',art(first)?'Lihat nota':'Lihat agenda');if(art(first)){const img=new Image();img.src=art(first);img.alt='';open.prepend(img)}open.onclick=()=>detail(first);next.append(open)}else next.append(make('p','Semua agenda hari ini sudah beres ♡'));
 p.querySelector('.all').onclick=()=>{tab='Koleksi';render()};
 gallery(p.querySelector('.previews'),items.slice(0,2).reverse())
}

el('cancel').onclick=()=>el('box').close();el('form').onsubmit=e=>{e.preventDefault();const title=el('judul').value.trim();if(!title){el('judul').focus();return}if(!save([{title,note:el('isi').value.trim(),time:el('waktu').value,done:false},...items]))return;el('form').reset();el('box').close();tab='Koleksi';render();el('notice').textContent='Udah Mimi simpan di Koleksi ♡'};render()
