function calendarDraft(item) {
  const compact = date => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const start = item.startUTC ? new Date(item.startUTC) : new Date(item.time);
  const end = item.endUTC ? new Date(item.endUTC) : new Date(+start + 30 * 60000);
  const dates = item.allDay ? item.time.slice(0,10).replaceAll('-','') + '/' + item.endDay : compact(start) + '/' + compact(end);
  const link = new URL('https://calendar.google.com/calendar/render');
  link.search = new URLSearchParams({action:'TEMPLATE', text:item.title, details:item.note, dates});
  return link.href;
}
function calendarButton(item) {
  const link = document.createElement('a');
  link.href = calendarDraft(item);
  link.textContent = 'Kirim ke Google Kalender';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = 'calendar-link';
  return link;
}
function readCalendar(source) {
  const unfolded = source.replace(/\r\n?/g,'\n').replace(/\n[ \t]/g,'');
  if (!/^BEGIN:VCALENDAR$/m.test(unfolded)) throw Error('Pilih file kalender berakhiran .ics, ya.');
  const entries = [];
  let skipped = 0;
  const decode = value => value.replace(/\\([nN,;\\])/g, (_,c) => c.toLowerCase()==='n'?'\n':c);
  const local = date => new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
  function stamp(field) {
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(field.value);
    if (!m) throw Error();
    const day = m[1]+'-'+m[2]+'-'+m[3];
    if (!m[4]) return {day};
    const wall = day+'T'+m[4]+':'+m[5]+':'+m[6];
    const zone = /;TZID="?([^";:]+)"?/i.exec(field.key)?.[1];
    let date = new Date(wall+(m[7]?'Z':''));
    if (zone && !m[7]) {
      const fmt = new Intl.DateTimeFormat('sv-SE',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
      date = new Date(wall+'Z');
      for(let i=0;i<3;i++){
        const seen=fmt.format(date).replace(' ','T');
        if(seen===wall)break;
        date=new Date(+date+Date.parse(wall+'Z')-Date.parse(seen+'Z'));
      }
      if(fmt.format(date).replace(' ','T')!==wall)throw Error();
    }
    return {date};
  }
  for (const match of unfolded.matchAll(/^BEGIN:VEVENT\n([\s\S]*?)^END:VEVENT$/gm)) {
    const fields = {};
    for (const line of match[1].replace(/^BEGIN:VALARM\n[\s\S]*?^END:VALARM$/gm,'').split('\n')) {
      const colon = line.indexOf(':');
      if(colon<1)continue;
      const key=line.slice(0,colon);
      fields[key.split(';')[0]]={key,value:line.slice(colon+1)};
    }
    try {
      if (!fields.UID || fields.RRULE || fields.RDATE || fields['RECURRENCE-ID'] || fields.STATUS?.value==='CANCELLED' || fields.DURATION) throw Error();
      const start=stamp(fields.DTSTART), end=fields.DTEND && stamp(fields.DTEND);
      const x={icsId:fields.UID.value,title:decode(fields.SUMMARY?.value||'Agenda'),note:decode(fields.DESCRIPTION?.value||''),done:false};
      if(start.day){
        x.allDay=true;x.time=start.day+'T00:00';
        const tomorrow=new Date(Date.parse(start.day+'T00:00:00Z')+86400000);
        x.endDay=(end?.day||tomorrow.toISOString().slice(0,10)).replaceAll('-','');
      } else {
        x.time=local(start.date);x.startUTC=start.date.toISOString();x.endUTC=(end?.date||new Date(+start.date+1800000)).toISOString();
      }
      entries.push(x);
    } catch {skipped++}
  }
  return {entries,skipped};
}
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
