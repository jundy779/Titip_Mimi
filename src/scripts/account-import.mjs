// Read only the allowlisted columns after the header. Skip free-form notes and secrets.
export function accountCards(source, existing = []) {
  const csv = source.replace(/^\uFEFF/, '');
  const cards = [];
  const key = (title, identity) => JSON.stringify([title.trim().toLowerCase(), identity.trim()]);
  const seen = new Set(existing.filter(i => i.kind === 'account').map(i => key(i.title, i.identity)));
  let header = null, values = [], field = '', column = 0, quoted = false, closed = false;
  let keep = true, started = false;
  function finishField() {
    if (keep) values[column] = field.trim();
    column++; field = ''; closed = false; started = false;
    keep = !header || ['name','url','username'].includes(header[column]);
  }
  function finishRow() {
    finishField();
    if (!header) {
      header = values.map(v => v.toLowerCase());
      if (!header.includes('username') || !header.some(v => v === 'name' || v === 'url') || new Set(header).size !== header.length) throw Error('header');
    } else {
      if(column !== header.length) throw Error('row');
      let title = values[header.indexOf('name')];
      if (!title) {
        try { title = new URL(values[header.indexOf('url')]).hostname; } catch { title = ''; }
      }
      const identity = values[header.indexOf('username')];
      if (title && identity && !seen.has(key(title,identity))) {
        seen.add(key(title,identity));
        cards.push({kind:'account',title,identity,method:'Belum diisi',note:'',time:'',done:false});
      }
    }
    values = []; column = 0; keep = ['name','url','username'].includes(header[0]);
  }
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (quoted) {
      if (c === '"' && csv[i+1] === '"') { if (keep) field += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else if (keep) field += c;
    } else if (c === ',') finishField();
    else if (c === '\r' || c === '\n') {
      if (started || column) finishRow();
      if (c === '\r' && csv[i+1] === '\n') i++;
    } else if (closed || (started && c === '"')) throw Error('csv');
    else if (c === '"') { quoted = true; started = true; }
    else { started = true; if (keep) field += c; }
  }
  if (quoted) throw Error('csv');
  if (column || started) finishRow();
  if (!header) throw Error('header');
  return cards;
}
