export function mountDailyList(sheet, today) {
  const date = sheet.querySelector('[data-list-date]');
  const priority = sheet.querySelector('select');
  const status = sheet.querySelector('[role=status]');
  date.value = today;
  let key;
  let page;
  function write(change) {
    try {
      const latest = JSON.parse(localStorage.getItem(key) || '{}');
      change(latest);
      localStorage.setItem(key, JSON.stringify(latest));
      page = latest;
      status.textContent = 'Tersimpan di perangkat ini.';
      return true;
    } catch {
      status.textContent = 'Belum tersimpan. Coba lagi, ya.';
      return false;
    }
  }
  function rows(group) {
    const name = group.dataset.listGroup;
    const container = group.querySelector('[data-rows]');
    container.replaceChildren();
    for (const item of page[name] || []) {
      const line = document.createElement('label');
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = item.done;
      check.onchange = () => {
        if (!write(data => {
          const row = data[name]?.find(row => row.id === item.id);
          if (row) row.done = check.checked;
        })) check.checked = !check.checked;
      };
      line.append(check, document.createTextNode(item.title));
      container.append(line);
    }
  }
  function open() {
    key = 'mimi-daily-list:' + date.value;
    try {
      page = JSON.parse(localStorage.getItem(key) || '{}');
      status.textContent = '';
    } catch {
      page = {};
      status.textContent = 'Daftarnya belum bisa dibaca.';
    }
    priority.value = page.priority || '';
    for (const memo of sheet.querySelectorAll('textarea')) {
      memo.value = page[memo.dataset.memo] || '';
      memo.oninput = () => write(data => { data[memo.dataset.memo] = memo.value; });
    }
    for (const group of sheet.querySelectorAll('[data-list-group]')) {
      rows(group);
      const form = group.querySelector('form');
      form.reset();
      form.onsubmit = event => {
        event.preventDefault();
        const field = form.querySelector('input');
        const title = field.value.trim();
        if (!title) return field.focus();
        const name = group.dataset.listGroup;
        if (write(data => {
          (data[name] ||= []).push({id:crypto.randomUUID(), title, done:false});
        })) {
          rows(group);
          form.reset();
          field.focus();
        }
      };
    }
  }
  priority.onchange = () => { if (!write(data => { data.priority = priority.value; })) priority.value = page.priority || ''; };
  date.onchange = () => { if (!date.value) date.value = today; open(); };
  open();
}
