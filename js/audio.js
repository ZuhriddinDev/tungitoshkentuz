// Realistik ko'p qatlamli motor ovozi tizimi (WebAudio API sintezi):
// - Har bir mashina klassi uchun alohida dvigatel tembri (I4, Malibu Turbo, BMW I6/V8, AMG V8, Lambo V12)
// - Sokin salt yurish (Idle), gaz bosilganda yuklama va filtr ochilishi, 6 pog'onali uzatma almashuvi,
//   gazdan oyoq olinganda pasayish + glushitel otishi (burble/pop) va turbo ovozi, tormoz va drift chiyillashi.

let ctx, master, eng, skid, started = false;
let curLoad = 0, curRpm = 0.18, lastGear = 1, lastThr = 0, popCooldown = 0;

const PROFILES = {
  i4:     { base: 34, h2: 2.0,  h3: 0.5,  sub: 0.35, drive: 1.4, idleChop: 0.06, turbo: 0,    burble: 0,    filterMax: 1800, gainMul: 0.85 },
  turbo4: { base: 31, h2: 2.0,  h3: 0.5,  sub: 0.55, drive: 1.8, idleChop: 0.08, turbo: 0.04, burble: 0.15, filterMax: 2100, gainMul: 0.95 },
  bmwi6:  { base: 38, h2: 1.5,  h3: 3.0,  sub: 0.60, drive: 2.4, idleChop: 0.10, turbo: 0.03, burble: 0.65, filterMax: 2700, gainMul: 1.05 },
  bmwv8:  { base: 29, h2: 1.5,  h3: 2.02, sub: 0.85, drive: 2.8, idleChop: 0.16, turbo: 0.03, burble: 0.75, filterMax: 2500, gainMul: 1.12 },
  amgv8:  { base: 24, h2: 0.51, h3: 1.5,  sub: 1.15, drive: 3.2, idleChop: 0.24, turbo: 0.02, burble: 0.85, filterMax: 2200, gainMul: 1.20 },
  v12:    { base: 44, h2: 1.5,  h3: 3.0,  sub: 0.50, drive: 2.6, idleChop: 0.08, turbo: 0,    burble: 0.70, filterMax: 3500, gainMul: 1.10 },
};

function makeDistortionCurve(amount = 2) {
  const n = 256, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = Math.tanh(x * amount);
  }
  return curve;
}

export function initAudio(volume = 0.6) {
  if (started) {
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return;
  }
  started = true;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);

  // Dvigatel rezonatori (glushitel bass + yuqori filtr)
  const bassBoost = ctx.createBiquadFilter();
  bassBoost.type = 'peaking';
  bassBoost.frequency.value = 95;
  bassBoost.Q.value = 1.4;
  bassBoost.gain.value = 6;

  const shaper = ctx.createWaveShaper();
  shaper.curve = makeDistortionCurve(2.2);
  shaper.oversample = '2x';

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 320;
  filter.Q.value = 2.6;

  const gain = ctx.createGain();
  gain.gain.value = 0;

  // 4 ta ossillyator: asosiy silindr sikli, garmonika, V8/I6 tembr va sub-bass
  const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
  const o2 = ctx.createOscillator(); o2.type = 'triangle';
  const o3 = ctx.createOscillator(); o3.type = 'sawtooth';
  const oSub = ctx.createOscillator(); oSub.type = 'sine';

  const g1 = ctx.createGain(); g1.gain.value = 0.55;
  const g2 = ctx.createGain(); g2.gain.value = 0.40;
  const g3 = ctx.createGain(); g3.gain.value = 0.28;
  const gSub = ctx.createGain(); gSub.gain.value = 0.65;

  // Salt yurish (Idle) ritmik pulsatsiyasi (turganda sokin "buq-buq" ishlashi)
  const idleLfo = ctx.createOscillator();
  idleLfo.type = 'sine';
  idleLfo.frequency.value = 7;
  const idleDepth = ctx.createGain();
  idleDepth.gain.value = 0.015;
  idleLfo.connect(idleDepth).connect(gain.gain);

  // Havo tortish (Intake roar) va Turbo hushtagi
  const intakeSrc = ctx.createBufferSource();
  intakeSrc.buffer = noiseBuf();
  intakeSrc.loop = true;
  const intakeFilter = ctx.createBiquadFilter();
  intakeFilter.type = 'bandpass';
  intakeFilter.frequency.value = 450;
  intakeFilter.Q.value = 1.8;
  const intakeGain = ctx.createGain();
  intakeGain.gain.value = 0;
  intakeSrc.connect(intakeFilter).connect(intakeGain).connect(master);

  const turboOsc = ctx.createOscillator();
  turboOsc.type = 'sine';
  turboOsc.frequency.value = 1800;
  const turboGain = ctx.createGain();
  turboGain.gain.value = 0;
  turboOsc.connect(turboGain).connect(master);

  o1.connect(g1).connect(shaper);
  o2.connect(g2).connect(shaper);
  o3.connect(g3).connect(shaper);
  oSub.connect(gSub).connect(bassBoost);
  shaper.connect(bassBoost);
  bassBoost.connect(filter).connect(gain).connect(master);

  [o1, o2, o3, oSub, idleLfo, intakeSrc, turboOsc].forEach((o) => o.start());
  eng = { o1, o2, o3, oSub, g2, g3, gSub, shaper, filter, gain, idleLfo, idleDepth, intakeFilter, intakeGain, turboOsc, turboGain, curProfile: '' };

  // Shina chiyillashi (Drift va keskin tormoz)
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf();
  noise.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1650;
  bp.Q.value = 3.2;
  const sg = ctx.createGain();
  sg.gain.value = 0;
  noise.connect(bp).connect(sg).connect(master);
  noise.start();
  skid = sg;
}

function noiseBuf() {
  const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

export function setVolume(v) {
  if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
}
export function suspend(on) {
  if (ctx) on ? ctx.suspend() : ctx.resume();
}

// Glushitel otishi (Exhaust pop / burble) — gazdan oyoq olinganda yoki uzatma almashganda
function triggerExhaustPop(intensity = 0.5, lowPitch = 90) {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(lowPitch + Math.random() * 45, t);
  o.frequency.exponentialRampToValueAtTime(28, t + 0.09);
  g.gain.setValueAtTime(0.08 * intensity, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.095);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.1);
}

// Turbo Blow-off ("pshhh") — Malibu / Turbo mashinalarda gaz qo'yib yuborilganda
function triggerBlowOff(intensity = 0.4) {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf();
  const flt = ctx.createBiquadFilter();
  flt.type = 'bandpass';
  flt.frequency.setValueAtTime(3400, t);
  flt.frequency.exponentialRampToValueAtTime(1200, t + 0.18);
  flt.Q.value = 2.5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.05 * intensity, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  src.connect(flt).connect(g).connect(master);
  src.start(t);
  src.stop(t + 0.22);
}

// Har kadrda chaqiriladi:
// rpm (0..1), throttle (0..1), pitch (cfg.pitch), slip, kmh, opts = { sound, braking, gear, dt }
export function updateEngine(rpm, throttle, pitch = 1, slip = 0, kmh = 0, opts = {}) {
  if (!eng || !ctx) return;
  if (ctx.state === 'suspended' && throttle > 0) ctx.resume();

  const dt = opts.dt || 0.016;
  const soundKey = opts.sound || 'i4';
  const prof = PROFILES[soundKey] || PROFILES.i4;
  const braking = !!opts.braking;
  const gear = opts.gear || 1;

  if (eng.curProfile !== soundKey) {
    eng.curProfile = soundKey;
    eng.shaper.curve = makeDistortionCurve(prof.drive);
    eng.gSub.gain.value = prof.sub;
  }

  // Gaz bosilishi (yuklama) va RPM silliqlash
  const loadTarget = throttle > 0 ? 0.35 + throttle * 0.65 : braking && kmh > 10 ? 0.18 : 0.0;
  curLoad += (loadTarget - curLoad) * Math.min(1, dt * (throttle > curLoad ? 9 : 5.5));
  curRpm += (rpm - curRpm) * Math.min(1, dt * 12);

  // Uzatma almashishi (Gear shift) effekti
  if (gear !== lastGear && kmh > 15) {
    if (gear > lastGear && throttle > 0.3) {
      // Yuqori uzatmaga o'tganda qisqa ovoz uzilishi va glushitel zarbi
      curRpm = Math.max(0.22, curRpm - 0.18);
      if (prof.burble > 0.3) triggerExhaustPop(prof.burble * 0.7, prof.base * 2.5);
    } else if (gear < lastGear && braking) {
      // Tormozda pastki uzatmaga tushganda (Downshift rev-match)
      curRpm = Math.min(0.88, curRpm + 0.12);
    }
    lastGear = gear;
  }

  // Gazdan oyoq olinganda: Turbo blow-off yoki sport glushitel "pop-pop" ovozi
  popCooldown = Math.max(0, popCooldown - dt);
  if (lastThr > 0.5 && throttle === 0 && kmh > 35) {
    if (prof.turbo >= 0.03) triggerBlowOff(curRpm);
    if (prof.burble > 0 && popCooldown <= 0) {
      triggerExhaustPop(prof.burble, prof.base * 2.4);
      popCooldown = 0.14;
    }
  } else if (throttle === 0 && kmh > 45 && curRpm > 0.42 && prof.burble > 0.5 && popCooldown <= 0 && Math.random() < 0.25) {
    triggerExhaustPop(prof.burble * 0.6, prof.base * 2.1);
    popCooldown = 0.18 + Math.random() * 0.15;
  }
  lastThr = throttle;

  const t = ctx.currentTime;
  const idleFactor = Math.max(0, 1 - kmh / 18) * (1 - throttle * 0.8);

  // Asosiy chastota: turganda past sokin (~28-40 Hz), tezlik/RPM oshganda ko'tariladi
  const baseHz = ((prof.base + curRpm * 115 + curLoad * 14) / Math.max(0.55, pitch));
  eng.o1.frequency.setTargetAtTime(baseHz, t, 0.035);
  eng.o2.frequency.setTargetAtTime(baseHz * prof.h2, t, 0.035);
  eng.o3.frequency.setTargetAtTime(baseHz * prof.h3, t, 0.035);
  eng.oSub.frequency.setTargetAtTime(baseHz * 0.5, t, 0.04);

  // Salt yurish (Idle) pulsatsiyasi: turganda sokin bilinar-bilinmas ishlaydi
  eng.idleLfo.frequency.setTargetAtTime(5.5 + curRpm * 14, t, 0.05);
  eng.idleDepth.gain.setTargetAtTime(idleFactor * prof.idleChop * 0.04, t, 0.06);

  // Filtr: turganda bo'g'iq va sokin (220 Hz), gaz bosilganda va RPM oshganda ochiladi
  const filterHz = 210 + curRpm * (prof.filterMax - 210) * (0.45 + 0.55 * curLoad) + (braking ? 180 : 0);
  eng.filter.frequency.setTargetAtTime(filterHz, t, 0.045);

  // Ovoz balandligi:
  // - Mashina turganda (Idle): past, sokin (0.038)
  // - Gaz bosilganda: balandlashadi
  // - Gazdan oyoq olinganda: silliq pasayadi
  const baseVol = (0.038 + curLoad * 0.125 + curRpm * 0.055 + (braking && kmh > 10 ? 0.02 : 0)) * prof.gainMul;
  eng.gain.gain.setTargetAtTime(baseVol, t, 0.05);

  // Havo tortish (intake) va Turbo hushtagi
  eng.intakeFilter.frequency.setTargetAtTime(350 + curRpm * 1600, t, 0.05);
  eng.intakeGain.gain.setTargetAtTime(curLoad * curRpm * 0.045, t, 0.05);
  eng.turboOsc.frequency.setTargetAtTime(1500 + curRpm * 2800 + curLoad * 600, t, 0.06);
  eng.turboGain.gain.setTargetAtTime(prof.turbo * curLoad * Math.max(0, curRpm - 0.25), t, 0.06);

  // Shina chiyillashi (drift yoki kuchli tormozda)
  const brakeScrub = braking && kmh > 55 ? 0.06 : 0;
  const driftScrub = slip > 0.17 && kmh > 22 ? Math.min(0.32, slip * 0.55) : 0;
  skid.gain.setTargetAtTime(Math.max(brakeScrub, driftScrub), t, 0.05);
}

export function engineOff() {
  if (eng && ctx) {
    eng.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    eng.intakeGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    eng.turboGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    skid.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
  }
}

export function thump(strength) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
  o.type = 'triangle';
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(38, t + 0.25);
  g.gain.setValueAtTime(Math.min(0.75, strength * 0.055), t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.35);
}

export function horn(dur = 0.4) {
  if (!ctx) return;
  const t = ctx.currentTime;
  for (const f of [415, 523]) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.055, t);
    g.gain.setValueAtTime(0.055, t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.1);
  }
}

export function beep(type = 'ok') {
  if (!ctx) return;
  const t = ctx.currentTime;
  const notes = { ok: [660, 880], cash: [880, 1175, 1568], err: [300, 200], go: [523, 784] }[type] || [660];
  notes.forEach((f, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t + i * 0.08);
    g.gain.linearRampToValueAtTime(0.11, t + i * 0.08 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.18);
    o.connect(g).connect(master);
    o.start(t + i * 0.08);
    o.stop(t + i * 0.08 + 0.2);
  });
}
