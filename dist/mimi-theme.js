  (() => {
    const key = 'titip-mimi-theme';
    const root = document.documentElement;
    let mode = 'light';
    function apply(value) {
      mode = value === 'dark' ? 'dark' : 'light';
      root.dataset.theme = mode;
      document.querySelectorAll('[data-dark-switch]').forEach(field => field.checked = mode === 'dark');
    }
    try { apply(localStorage.getItem(key)); } catch { apply('light'); }
    window.addEventListener('pageshow', () => {
      try { apply(localStorage.getItem(key)); } catch {}
    });
    window.addEventListener('storage', event => { if (event.key === key || event.key === null) apply(event.newValue); });
    document.addEventListener('change', event => {
      const field = event.target;
      if (!field.matches('[data-dark-switch]')) return;
      apply(field.checked ? 'dark' : 'light');
      try { localStorage.setItem(key, mode); } catch {}
    });
    document.addEventListener('mimi-theme-mounted', () => apply(mode));
    document.addEventListener('DOMContentLoaded', () => apply(mode));
  })();
