// WebAudio sintezi: dvigatel (har bir mashina uchun alohida tembr), shina chiyillashi, zarba, signal
let ctx, master, eng, skid, started = false;

export function initAudio(volume = 0.6) {
  if (started) return; started = true;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = volume; master.connect(ctx.destination);

  const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 900; filter.Q.value = 4;
  const gain = ctx.createGain(); gain.gain.value = 0;
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator();
  o1.type = 'sawtooth'; o2.type = 'square'; o3.type = 'sine';
  const g2 = ctx.createGain(); g2.gain.value = 0.35; const g3 = ctx.createGain(); g3.gain.value = 0.8;
  o1.connect(filter); o2.connect(g2).connect(filter); o3.connect(g3).connect(filter);
  filter.connect(gain).connect(master);
  [o1, o2, o3].forEach((o) => o.start());
  eng = { o1, o2, o3, filter, gain };

  const noise = ctx.createBufferSource(); noise.buffer = noiseBuf(); noise.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 3;
  const sg = ctx.createGain(); sg.gain.value = 0;
  noise.connect(bp).connect(sg).connect(master); noise.start();
  skid = sg;
}

function noiseBuf() {
  const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

export function setVolume(v) { if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05); }
export function suspend(on) { if (ctx) on ? ctx.suspend() : ctx.resume(); }

// rpm 0..1, pitch — mashina xarakteri (Spark baland, Lamborghini past va kuchli)
let gearRpm = 0;
export function updateEngine(rpm, throttle, pitch, slip, kmh) {
  if (!eng) return;
  // 6 pog'onali uzatmalar qutisi effekti
  const gears = [0, 20, 45, 75, 110, 150, 999], g = gears.findIndex((s) => kmh < s) - 1;
  const lo = gears[Math.max(0, g)], hi = Math.min(gears[g + 1], 330);
  gearRpm = 0.25 + 0.75 * Math.min(1, (kmh - lo) / Math.max(1, hi - lo));
  if (kmh < 3) gearRpm = 0.2 + throttle * 0.3;
  const base = (38 + gearRpm * 110) / pitch * 1.2, t = ctx.currentTime;
  eng.o1.frequency.setTargetAtTime(base, t, 0.04);
  eng.o2.frequency.setTargetAtTime(base * 0.5, t, 0.04);
  eng.o3.frequency.setTargetAtTime(base * 0.25, t, 0.04);
  eng.filter.frequency.setTargetAtTime(400 + gearRpm * 1400 + throttle * 900, t, 0.05);
  eng.gain.gain.setTargetAtTime(0.09 + throttle * 0.12 + rpm * 0.05, t, 0.05);
  skid.gain.setTargetAtTime(Math.min(0.35, slip > 0.18 && kmh > 25 ? slip * 0.6 : 0), t, 0.05);
}

export function engineOff() { if (eng) { eng.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1); skid.gain.setTargetAtTime(0, ctx.currentTime, 0.1); } }

export function thump(strength) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
  o.type = 'triangle'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
  g.gain.setValueAtTime(Math.min(0.8, strength * 0.06), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  o.connect(g).connect(master); o.start(t); o.stop(t + 0.35);
}

export function horn(dur = 0.4) {
  if (!ctx) return;
  const t = ctx.currentTime;
  for (const f of [415, 523]) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = f;
    g.gain.setValueAtTime(0.06, t); g.gain.setValueAtTime(0.06, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.1);
  }
}

export function beep(type = 'ok') {
  if (!ctx) return;
  const t = ctx.currentTime, notes = { ok: [660, 880], cash: [880, 1175, 1568], err: [300, 200], go: [523, 784] }[type] || [660];
  notes.forEach((f, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t + i * 0.08); g.gain.linearRampToValueAtTime(0.12, t + i * 0.08 + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.18);
    o.connect(g).connect(master); o.start(t + i * 0.08); o.stop(t + i * 0.08 + 0.2);
  });
}
