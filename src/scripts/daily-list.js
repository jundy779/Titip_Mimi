import { mimiSay } from './mimi-bubble.js';
import { logWin, unlogWin } from './iqlima-ui.js';
export function mountDailyList(sheet, today) {
  const date = sheet.querySelector('[data-list-date]');
  const priority = sheet.querySelector('select');
  const status = sheet.querySelector('[role=status]');
  date.value = today;
  let key;
  let page;
  function summarize() {
    for (const badge of sheet.querySelectorAll('[data-summary]')) {
      const value = page[badge.dataset.summary];
      badge.textContent = Array.isArray(value) && value.length
        ? value.filter(item => item.done).length + '/' + value.length
        : typeof value === 'string' && value.trim() ? 'Terisi' : '';
    }
  }
  function write(change) {
    try {
      const latest = JSON.parse(localStorage.getItem(key) || '{}');
      change(latest);
      localStorage.setItem(key, JSON.stringify(latest));
      page = latest;
      summarize();
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
        else if (check.checked) { mimiSay('task'); logWin({ kind: 'task', ref: 'todo-' + item.id, text: item.title }); }
        else unlogWin('todo-' + item.id);
      };
      line.append(check, document.createTextNode(item.title));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'list-remove';
      remove.textContent = 'Hapus';
      remove.setAttribute('aria-label', 'Hapus ' + item.title);
      remove.onclick = () => {
        if (!write(data => {
          const index = data[name]?.findIndex(row => row.id === item.id) ?? -1;
          if (index < 0) return;
          const [removed] = data[name].splice(index, 1);
          (data.deleted ||= {})[name] = {item: removed, index};
        })) return;
        rows(group);
        container.querySelector('.list-undo button')?.focus();
      };
      const wrapper = document.createElement('div');
      wrapper.className = 'list-task-row';
      wrapper.append(line, remove);
      container.append(wrapper);
    }
    const deleted = page.deleted?.[name];
    if (deleted) {
      const notice = document.createElement('div');
      notice.className = 'list-undo';
      const undo = document.createElement('button');
      undo.type = 'button';
      undo.textContent = 'Urungkan';
      undo.onclick = () => {
        if (!write(data => {
          const last = data.deleted?.[name];
          if (last?.item.id !== deleted.item.id) return;
          const items = data[name] ||= [];
          if (!items.some(row => row.id === last.item.id)) items.splice(last.index, 0, last.item);
          delete data.deleted[name];
        })) return;
        rows(group);
        const controls = container.querySelectorAll('.list-remove');
        controls[Math.min(deleted.index, controls.length - 1)]?.focus();
      };
      const purge = document.createElement('button');
      purge.type = 'button';
      purge.textContent = 'Hapus permanen';
      purge.onclick = () => {
        if (!window.confirm('Hapus “' + deleted.item.title + '” secara permanen? Tugas ini tidak bisa dikembalikan.')) return;
        if (!write(data => {
          if (data.deleted?.[name]?.item.id === deleted.item.id) delete data.deleted[name];
        })) return;
        rows(group);
        group.querySelector('form input').focus();
      };
      notice.append(document.createTextNode('“' + deleted.item.title + '” dihapus.'), undo, purge);
      container.append(notice);
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
    summarize();
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
