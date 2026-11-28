// Bantuan di form titipan: baca undangan dari foto (OCR di HP sendiri) dan dikte suara.
// Keduanya berjalan di browser. Foto tidak diunggah ke server Mimi.

// Tesseract dimuat hanya saat dipakai, karena ukurannya beberapa MB.
// Bisa di-host sendiri: <meta name="mimi-ocr-base" content="/ocr/"> dengan isi
// tesseract.min.js, worker.min.js, core/ (tesseract.js-core) dan lang/ind.traineddata.gz.
const cdn = {
  script: 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js',
  worker: 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js',
  core: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0',
  lang: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/ind@1.0.0/4.0.0_best_int',
};
function ocrPaths() {
  const base = document.querySelector('meta[name="mimi-ocr-base"]')?.content;
  if (!base) return cdn;
  const b = new URL(base, location.href).href.replace(/\/?$/, '/');
  return { script: b + 'tesseract.min.js', worker: b + 'worker.min.js', core: b + 'core', lang: b + 'lang' };
}
let loading = null;
function loadTesseract(src) {
  if (globalThis.Tesseract) return Promise.resolve(globalThis.Tesseract);
  loading ||= new Promise((resolve, reject) => {
    const s = Object.assign(document.createElement('script'), { src, async: true, crossOrigin: 'anonymous' });
    s.onload = () => globalThis.Tesseract ? resolve(globalThis.Tesseract) : reject(new Error('OCR tidak termuat'));
    s.onerror = () => { loading = null; reject(new Error('OCR tidak termuat')); };
    document.head.append(s);
  });
  return loading;
}

// Perkecil foto besar dulu: lebih cepat dibaca dan hemat memori HP.
async function shrink(file, max = 1800) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close?.();
    return c;
  } catch { return file; }
}

export async function readImageText(file, onProgress = () => {}) {
  const paths = ocrPaths();
  onProgress('Menyiapkan pembaca foto…');
  const T = await loadTesseract(paths.script);
  const worker = await T.createWorker('ind', 1, {
    workerPath: paths.worker, corePath: paths.core, langPath: paths.lang,
    logger: m => { if (m.status === 'recognizing text') onProgress(`Membaca undangan… ${Math.round((m.progress || 0) * 100)}%`); else if (/load|initializ/.test(m.status)) onProgress('Menyiapkan pembaca foto…'); },
  });
  try {
    const { data } = await worker.recognize(await shrink(file));
    return data.text || '';
  } finally { await worker.terminate().catch(() => {}); }
}

// ---------- Dikte suara ----------
export const speechSupported = () => Boolean(globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition);

// Tombol mikrofon untuk satu kolom teks. Teks hasil dikte ditambahkan di akhir, tidak menimpa.
// lines: setiap jeda bicara jadi baris baru (untuk Tumpahkan pikiran: satu baris satu titipan).
export function mountMic(button, field, notify = () => {}, { lines = false } = {}) {
  const Rec = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  if (!Rec || !button || !field) { if (button) button.hidden = true; return () => {}; }
  button.hidden = false;
  let rec = null, base = '';
  const label = button.getAttribute('aria-label') || 'Dikte suara';
  const set = on => { button.setAttribute('aria-pressed', String(on)); button.classList.toggle('listening', on); button.setAttribute('aria-label', on ? 'Berhenti mendengarkan' : label); };
  const stop = () => { try { rec?.stop(); } catch {} };
  button.onclick = () => {
    if (rec) { stop(); return; }
    rec = new Rec();
    rec.lang = 'id-ID'; rec.interimResults = true; rec.continuous = true;
    base = field.value ? field.value.replace(/\s*$/, lines ? '\n' : ' ') : '';
    rec.onresult = e => {
      const parts = [];
      for (let i = 0; i < e.results.length; i++) parts.push(e.results[i][0].transcript.trim());
      const text = parts.filter(Boolean).join(lines ? '\n' : ' ');
      field.value = (base + text).slice(0, field.maxLength > 0 ? field.maxLength : 5000);
      field.dispatchEvent(new Event('input', { bubbles: true }));
    };
    rec.onerror = e => {
      const why = { 'not-allowed': 'Izin mikrofon belum diberikan. Cek ikon gembok di alamat web, ya.', 'service-not-allowed': 'Izin mikrofon belum diberikan. Cek ikon gembok di alamat web, ya.', 'no-speech': 'Mimi belum dengar suara. Coba lagi lebih dekat ke HP.', network: 'Dikte butuh internet. Coba lagi saat sinyal bagus.' }[e.error];
      if (why) notify(why);
    };
    rec.onend = () => { rec = null; set(false); };
    try { rec.start(); set(true); field.focus(); } catch { rec = null; set(false); notify('Dikte belum bisa dimulai. Coba lagi, ya.'); }
  };
  return stop;
}
