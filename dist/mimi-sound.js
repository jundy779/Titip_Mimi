// Suara Mimi disintesis langsung dengan Web Audio: tanpa file rekaman.
// Baru berbunyi setelah sentuhan pertama (aturan autoplay browser) dan bisa dimatikan.
export const soundKey = 'mimi-sound-v1';

export function makeVoice(storage = globalThis.localStorage) {
  let enabled = true;
  try { enabled = storage?.getItem(soundKey) !== 'off'; } catch {}
  let ctx = null, master = null, purrNode = null, lastMeow = -Infinity;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;

  function audio() {
    if (!enabled || !AC) return null;
    try {
      if (!ctx) {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = .55;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch { return null; }
  }
  function noiseBuffer(a, seconds, brown = false) {
    const buf = a.createBuffer(1, Math.floor(a.sampleRate * seconds), a.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      if (brown) { last = (last + .02 * white) / 1.02; data[i] = last * 3.5; } else data[i] = white;
    }
    return buf;
  }

  // Meong anak kucing: nada naik lalu turun, disaring dua formant.
  function meow(kind = 'soft') {
    const a = audio();
    if (!a) return;
    const now = a.currentTime;
    if (now - lastMeow < .9) return;
    lastMeow = now;
    const shape = {
      soft: [560, 820, 520, .5, .1], happy: [680, 1050, 760, .38, .13],
      sleepy: [460, 600, 380, .85, .08], ask: [600, 900, 700, .55, .11],
    }[kind] || [560, 820, 520, .5, .1];
    const [f0, peak, end, len, vol] = shape;
    const osc = a.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0, now);
    osc.frequency.exponentialRampToValueAtTime(peak, now + len * .3);
    osc.frequency.exponentialRampToValueAtTime(end, now + len);
    const vib = a.createOscillator(), vibGain = a.createGain();
    vib.frequency.value = 7; vibGain.gain.value = 12;
    vib.connect(vibGain).connect(osc.frequency);
    const env = a.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(vol, now + .05);
    env.gain.setValueAtTime(vol, now + len * .6);
    env.gain.exponentialRampToValueAtTime(.0005, now + len);
    const out = a.createGain(); out.gain.value = 1;
    for (const [f, q, g] of [[1100, 5, 1], [2600, 7, .6], [4200, 9, .25]]) {
      const bp = a.createBiquadFilter();
      bp.type = 'bandpass'; bp.Q.value = q;
      bp.frequency.setValueAtTime(f * .8, now);
      bp.frequency.linearRampToValueAtTime(f, now + len * .35);
      const gain = a.createGain(); gain.gain.value = g;
      osc.connect(bp).connect(gain).connect(env);
    }
    env.connect(out).connect(master);
    osc.start(now); vib.start(now);
    osc.stop(now + len + .05); vib.stop(now + len + .05);
  }

  // Dengkur: derau cokelat yang denyutnya sekitar 25 kali per detik.
  function purr(on) {
    const a = on ? audio() : ctx;
    if (!a) return;
    const now = a.currentTime;
    if (on && !purrNode) {
      const src = a.createBufferSource();
      src.buffer = noiseBuffer(a, 2, true); src.loop = true;
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
      const pulse = a.createGain(); pulse.gain.value = .5;
      const lfo = a.createOscillator(), depth = a.createGain();
      lfo.frequency.value = 25; depth.gain.value = .5;
      lfo.connect(depth).connect(pulse.gain);
      const vol = a.createGain(); vol.gain.setValueAtTime(0, now); vol.gain.linearRampToValueAtTime(.32, now + .35);
      src.connect(lp).connect(pulse).connect(vol).connect(master);
      src.start(now); lfo.start(now);
      purrNode = { src, lfo, vol };
    } else if (!on && purrNode) {
      const node = purrNode; purrNode = null;
      node.vol.gain.cancelScheduledValues(now);
      node.vol.gain.setValueAtTime(node.vol.gain.value, now);
      node.vol.gain.linearRampToValueAtTime(0, now + .4);
      node.src.stop(now + .45); node.lfo.stop(now + .45);
    }
  }

  function burstNoise(times, freq, vol, len) {
    const a = audio();
    if (!a) return;
    const now = a.currentTime, buf = noiseBuffer(a, len);
    times.forEach(offset => {
      const src = a.createBufferSource(); src.buffer = buf;
      const hp = a.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = freq; hp.Q.value = 1.2;
      const g = a.createGain();
      g.gain.setValueAtTime(vol, now + offset); g.gain.exponentialRampToValueAtTime(.0005, now + offset + len);
      src.connect(hp).connect(g).connect(master);
      src.start(now + offset); src.stop(now + offset + len + .02);
    });
  }
  function tone(from, to, len, vol, type = 'sine', at = 0) {
    const a = audio();
    if (!a) return;
    const now = a.currentTime + at, osc = a.createOscillator(), g = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, now); osc.frequency.exponentialRampToValueAtTime(to, now + len);
    g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(.0005, now + len);
    osc.connect(g).connect(master); osc.start(now); osc.stop(now + len + .02);
  }

  return {
    get enabled() { return enabled; },
    setEnabled(on) {
      enabled = Boolean(on);
      try { storage?.setItem(soundKey, enabled ? 'on' : 'off'); } catch {}
      if (!enabled) purr(false);
      else audio();
    },
    meow, purr,
    crunch: () => burstNoise([0, .12, .24], 2400, .22, .06),
    pop: () => tone(900, 240, .09, .12),
    chirp: () => { tone(1300, 1900, .1, .08, 'triangle'); tone(1500, 2200, .1, .07, 'triangle', .13); },
    sparkle: () => { tone(1800, 2600, .18, .05); tone(2400, 3200, .2, .04, 'sine', .08); },
  };
}
