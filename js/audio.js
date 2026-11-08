// ============================================================================
// TUNGI TOSHKENT V15 — AUTHENTIC REAL-WORLD CAR ENGINE AUDIO SYSTEM
// ============================================================================
// Ushbu audio tizimi haqiqiy avtomobillarning yozib olingan professional
// ovozlaridan foydalanadi (BMW V8/I6, Mercedes-AMG V8, Chevrolet Malibu Turbo,
// Kia T-GDI, Chevrolet Gentra 4-silindr, Spark 3-silindr, Ferrari V12,
// Lambo V12, Porsche Flat-6, Tesla EV).
//
// 10 ta to'liq qatlam (Layers):
// 1. Dvigatel o't oldirish (Startup) va o'chirish (Shutdown)
// 2. Salt ishlash (Idle engine sound)
// 3. Past aylanishlar (Low RPM 1000 - 3000)
// 4. O'rta aylanishlar (Medium RPM 3000 - 5500)
// 5. Yuqori aylanishlar (High RPM 5500 - 8500+)
// 6. Tezlanish va yuklama rezonansi (Throttle response & acceleration)
// 7. Sekinlashish va tormozlanish (Engine braking & deceleration burble)
// 8. Uzatma almashishi (Mechanical gear shift clunk & transmission click)
// 9. Glushitel otishi va Turbo blow-off (Exhaust pops & BOV release)
// 10. Salon va tashqi akustik perspektivalar (Interior cabin damping vs Exterior open exhaust)
//
// Shuningdek:
// - Ko'p o'yinchili 3D fazoviy audio (Multiplayer 3D positional audio + Doppler effect)

import * as THREE from 'three';

let ctx = null;
let masterGain = null;
let interiorFilter = null;
let exteriorBus = null;
let skidGain = null;

let isStarted = false;
let isEngineRunning = true;
let currentCarSound = '';
let currentRpm = 0.18;
let currentLoad = 0;
let lastGear = 1;
let lastThrottle = 0;
let popCooldown = 0;
let masterVolume = 0.6;

// Audio fayllar keshi (AudioBuffer)
const bufferCache = new Map();
const pendingLoads = new Map();

// Avtomobil ovoz profillari va audio yo'llari
export const SOUND_PROFILES = {
  // Chevrolet Spark 1.0L 3-silindr (120° burchakli o'ziga xos 3-silindr pulsatsiyasi)
  spark_i3: {
    src: null, // Sintetik + garmonik 3-silindr modeli
    is3Cyl: true,
    baseFreq: 42,
    pitchMul: 1.15,
    gainMul: 0.90,
    turbo: false,
    burble: 0.20,
    filterBase: 260,
    filterMax: 2400,
  },
  // Chevrolet Gentra 1.5L 4-silindr atmosfera
  gentra_i4: {
    src: 'audio/engines/gentra_i4.mp3',
    baseFreq: 33,
    pitchMul: 1.0,
    gainMul: 0.92,
    turbo: false,
    burble: 0.35,
    filterBase: 240,
    filterMax: 2600,
  },
  // Chevrolet Malibu Premier 2.0L Turbo 4-silindr
  malibu_turbo: {
    src: 'audio/engines/malibu_turbo.mp3',
    baseFreq: 31,
    pitchMul: 0.94,
    gainMul: 0.98,
    turbo: true,
    burble: 0.55,
    filterBase: 230,
    filterMax: 2900,
  },
  // Kia K5 Optima 2.0L / 1.6L T-GDI Turbo 4-silindr
  kia_turbo: {
    src: 'audio/engines/kia_turbo.mp3',
    baseFreq: 32,
    pitchMul: 0.96,
    gainMul: 0.96,
    turbo: true,
    burble: 0.65,
    filterBase: 240,
    filterMax: 3000,
  },
  // Mercedes-AMG V8 (Gelik G63, E55 AMG, Maybach GLS 600)
  amg_v8: {
    src: 'audio/engines/amg_v8.mp3',
    baseFreq: 24,
    pitchMul: 0.82,
    gainMul: 1.15,
    turbo: true,
    burble: 0.88,
    filterBase: 190,
    filterMax: 3200,
  },
  // Dodge HEMI V8 (Challenger R/T 6.2L / 5.7L)
  hemi_v8: {
    src: 'audio/engines/hemi_v8.mp3',
    baseFreq: 26,
    pitchMul: 0.84,
    gainMul: 1.12,
    turbo: false,
    burble: 0.85,
    filterBase: 200,
    filterMax: 3100,
  },
  // BMW Twin-Turbo Inline-6 (M4 GTS, M4 Comp, X7, Supra MK4)
  bmw_i6: {
    src: 'audio/engines/bmw_i6.mp3',
    baseFreq: 36,
    pitchMul: 0.92,
    gainMul: 1.08,
    turbo: true,
    burble: 0.78,
    filterBase: 230,
    filterMax: 3400,
  },
  // BMW S63 Twin-Turbo V8 (M5 CS, M5 F90, M8 Coupe, M8 Widebody)
  bmw_v8: {
    src: 'audio/engines/bmw_v8.mp3',
    baseFreq: 28,
    pitchMul: 0.86,
    gainMul: 1.14,
    turbo: true,
    burble: 0.82,
    filterBase: 210,
    filterMax: 3300,
  },
  // Ferrari 599 GTB Fiorano / SF90 (V12 / Flat-Plane V8)
  ferrari_v12: {
    src: 'audio/engines/ferrari_v12.mp3',
    baseFreq: 46,
    pitchMul: 1.05,
    gainMul: 1.16,
    turbo: false,
    burble: 0.75,
    filterBase: 280,
    filterMax: 4200,
  },
  // Lamborghini Aventador 6.5L V12 Screamer
  lambo_v12: {
    src: 'audio/engines/lambo_v12.mp3',
    baseFreq: 48,
    pitchMul: 1.08,
    gainMul: 1.20,
    turbo: false,
    burble: 0.85,
    filterBase: 290,
    filterMax: 4400,
  },
  // Porsche 911 GT3 RS Flat-6 Boxer
  porsche_f6: {
    src: 'audio/engines/porsche_f6.mp3',
    baseFreq: 40,
    pitchMul: 1.02,
    gainMul: 1.10,
    turbo: false,
    burble: 0.80,
    filterBase: 250,
    filterMax: 3800,
  },
  // Tesla Roadster 2020 Electric Tri-Motor
  tesla_ev: {
    src: 'audio/engines/tesla_ev.mp3',
    isElectric: true,
    baseFreq: 80,
    pitchMul: 1.0,
    gainMul: 0.85,
    turbo: false,
    burble: 0,
    filterBase: 400,
    filterMax: 4800,
  },
};

// Eski kalitlar bilan moslik (backward compatibility)
SOUND_PROFILES.i4 = SOUND_PROFILES.gentra_i4;
SOUND_PROFILES.turbo4 = SOUND_PROFILES.malibu_turbo;
SOUND_PROFILES.bmwi6 = SOUND_PROFILES.bmw_i6;
SOUND_PROFILES.bmwv8 = SOUND_PROFILES.bmw_v8;
SOUND_PROFILES.amgv8 = SOUND_PROFILES.amg_v8;
SOUND_PROFILES.v12 = SOUND_PROFILES.lambo_v12;

// Audio faylni AudioBuffer ga yuklash (kesh bilan)
async function getAudioBuffer(url) {
  if (!url) return null;
  if (bufferCache.has(url)) return bufferCache.get(url);
  if (pendingLoads.has(url)) return pendingLoads.get(url);

  const promise = (async () => {
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const arrayBuf = await resp.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuf);
      bufferCache.set(url, decoded);
      pendingLoads.delete(url);
      return decoded;
    } catch (err) {
      console.warn(`[Audio] Failed to load "${url}":`, err.message);
      pendingLoads.delete(url);
      return null;
    }
  })();

  pendingLoads.set(url, promise);
  return promise;
}

// Oq shovqin buferi (shinalar sirpanishi va havo kirishi uchun)
function createNoiseBuffer() {
  if (!ctx) return null;
  const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

// Bosh o'yinchi mashinasining ovoz zanjiri
let localVoice = null;

class LocalCarVoice {
  constructor() {
    this.key = '';
    this.source = null;
    this.buffer = null;
    this.isPlaying = false;

    // 3 pog'onali chastotali krossover (RPM qatlamlari):
    // 1. Idle & Sub-bass band (< 200 Hz)
    this.idleFilter = ctx.createBiquadFilter();
    this.idleFilter.type = 'lowpass';
    this.idleFilter.frequency.value = 180;
    this.idleGain = ctx.createGain();
    this.idleGain.gain.value = 0.5;

    // 2. Mid body band (200 - 2200 Hz)
    this.midFilter = ctx.createBiquadFilter();
    this.midFilter.type = 'bandpass';
    this.midFilter.frequency.value = 750;
    this.midFilter.Q.value = 1.2;
    this.midGain = ctx.createGain();
    this.midGain.gain.value = 0.6;

    // 3. High & Exhaust scream band (> 2000 Hz)
    this.highFilter = ctx.createBiquadFilter();
    this.highFilter.type = 'highpass';
    this.highFilter.frequency.value = 2100;
    this.highGain = ctx.createGain();
    this.highGain.gain.value = 0.4;

    // Dinamik rezonator va asosiy dvigatel filtri
    this.dynamicFilter = ctx.createBiquadFilter();
    this.dynamicFilter.type = 'lowpass';
    this.dynamicFilter.frequency.value = 350;
    this.dynamicFilter.Q.value = 2.0;

    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;

    // Spark 3-silindr uchun maxsus akustik ossillyatorlar
    this.sparkOsc1 = ctx.createOscillator();
    this.sparkOsc1.type = 'sawtooth';
    this.sparkOsc2 = ctx.createOscillator();
    this.sparkOsc2.type = 'triangle';
    this.sparkOsc3 = ctx.createOscillator();
    this.sparkOsc3.type = 'sawtooth';
    this.sparkGain = ctx.createGain();
    this.sparkGain.gain.value = 0;

    this.sparkOsc1.connect(this.sparkGain);
    this.sparkOsc2.connect(this.sparkGain);
    this.sparkOsc3.connect(this.sparkGain);
    this.sparkGain.connect(this.dynamicFilter);

    this.sparkOsc1.start();
    this.sparkOsc2.start();
    this.sparkOsc3.start();

    // Havo tortish (Intake)
    this.intakeSource = ctx.createBufferSource();
    this.intakeSource.buffer = createNoiseBuffer();
    this.intakeSource.loop = true;
    this.intakeFilter = ctx.createBiquadFilter();
    this.intakeFilter.type = 'bandpass';
    this.intakeFilter.frequency.value = 450;
    this.intakeFilter.Q.value = 1.6;
    this.intakeGain = ctx.createGain();
    this.intakeGain.gain.value = 0;
    this.intakeSource.connect(this.intakeFilter).connect(this.intakeGain).connect(this.dynamicFilter);
    this.intakeSource.start();

    // Akustik krossoverni birlashtirish
    this.idleFilter.connect(this.idleGain).connect(this.dynamicFilter);
    this.midFilter.connect(this.midGain).connect(this.dynamicFilter);
    this.highFilter.connect(this.highGain).connect(this.dynamicFilter);

    // Dvigatel chiqishini salon/tashqi akustik kommutatorga ulash
    this.dynamicFilter.connect(this.engineGain);
    this.engineGain.connect(interiorFilter);
    this.engineGain.connect(exteriorBus);
  }

  async setSoundProfile(key) {
    if (this.key === key && this.isPlaying) return;
    this.key = key;
    const prof = SOUND_PROFILES[key] || SOUND_PROFILES.gentra_i4;

    if (this.source) {
      try { this.source.stop(); } catch (_) {}
      this.source.disconnect();
      this.source = null;
    }

    if (prof.is3Cyl) {
      // Spark 3-silindr maxsus modeli faollashtiriladi
      this.isPlaying = true;
      return;
    }

    if (prof.src) {
      const buf = await getAudioBuffer(prof.src);
      if (buf && this.key === key) {
        this.buffer = buf;
        this.source = ctx.createBufferSource();
        this.source.buffer = buf;
        this.source.loop = true;

        this.source.connect(this.idleFilter);
        this.source.connect(this.midFilter);
        this.source.connect(this.highFilter);

        this.source.start();
        this.isPlaying = true;
      }
    }
  }

  update(rpm, throttle, pitchMul, kmh, isInterior, prof, dt) {
    if (!ctx) return;
    const t = ctx.currentTime;

    // 1. Akustik perspektiva: Salon (Cockpit/Hood) vs Tashqi (Chase)
    if (isInterior) {
      // Salon ichida past chastotali kabina rezonansi, yuqori shamol va shina ovozi so'ndiriladi
      interiorFilter.frequency.setTargetAtTime(1100, t, 0.05);
      interiorFilter.Q.setTargetAtTime(1.8, t, 0.05);
      exteriorBus.gain.setTargetAtTime(0.0, t, 0.05);
    } else {
      // Tashqarida erkin glushitel va ochiq rezonans
      interiorFilter.frequency.setTargetAtTime(20000, t, 0.05);
      interiorFilter.Q.setTargetAtTime(0.7, t, 0.05);
      exteriorBus.gain.setTargetAtTime(1.0, t, 0.05);
    }

    if (!isEngineRunning) {
      this.engineGain.gain.setTargetAtTime(0, t, 0.1);
      this.sparkGain.gain.setTargetAtTime(0, t, 0.1);
      this.intakeGain.gain.setTargetAtTime(0, t, 0.1);
      return;
    }

    // 2. RPM va yuklama (Load) silliqlash
    const loadTarget = throttle > 0 ? 0.35 + throttle * 0.65 : kmh > 12 ? 0.08 : 0.0;
    currentLoad += (loadTarget - currentLoad) * Math.min(1, dt * (throttle > currentLoad ? 10 : 6));
    currentRpm += (rpm - currentRpm) * Math.min(1, dt * 14);

    // 3. Tezlik va RPMga bog'liq Playback Rate (Pitch)
    const baseP = (prof.pitchMul || 1.0) / Math.max(0.6, pitchMul || 1.0);
    const playbackRate = prof.isElectric
      ? THREE.MathUtils.clamp(0.2 + (kmh / 180) * 1.6, 0.2, 2.2)
      : THREE.MathUtils.clamp(baseP * (0.64 + currentRpm * 0.98), 0.45, 2.4);

    if (this.source && this.source.playbackRate) {
      this.source.playbackRate.setTargetAtTime(playbackRate, t, 0.035);
    }

    // 4. Spark 3-silindr maxsus ossillyatorlarini boshqarish
    if (prof.is3Cyl) {
      const baseHz = (prof.baseFreq + currentRpm * 135 + currentLoad * 18);
      // 3-silindr 120° burchakli toq garmonikalari
      this.sparkOsc1.frequency.setTargetAtTime(baseHz, t, 0.035);
      this.sparkOsc2.frequency.setTargetAtTime(baseHz * 1.5, t, 0.035); // 3-silindr xos xarakteri
      this.sparkOsc3.frequency.setTargetAtTime(baseHz * 3.0, t, 0.035);

      const sparkVol = (0.045 + currentLoad * 0.13 + currentRpm * 0.06) * prof.gainMul;
      this.sparkGain.gain.setTargetAtTime(sparkVol, t, 0.04);
    } else {
      this.sparkGain.gain.setTargetAtTime(0, t, 0.05);
    }

    // 5. RPM qatlamlari krossoverini balanslash:
    // - Salt ishlashda (Idle < 15 km/h, past RPM): Idle va pastki bas rezonansi ustun
    const idleFactor = Math.max(0, 1 - kmh / 18) * (1 - throttle * 0.7);
    this.idleGain.gain.setTargetAtTime(0.45 + idleFactor * 0.45, t, 0.05);

    // - O'rta aylanishlarda: korpus va klapanlar ovozi
    const midFactor = Math.sin(Math.min(Math.PI, currentRpm * Math.PI));
    this.midGain.gain.setTargetAtTime(0.35 + midFactor * 0.55, t, 0.05);

    // - Yuqori aylanishlarda va gaz bosilganda: ochiq glushitel qichqirishi
    const highFactor = Math.max(0, currentRpm - 0.35) * (0.3 + 0.7 * currentLoad);
    this.highGain.gain.setTargetAtTime(highFactor * 0.75, t, 0.05);

    // 6. Dinamik filtr ochilishi (RPM va gaz bosilganda rezonans kengayishi)
    const filterHz = THREE.MathUtils.clamp(
      prof.filterBase + currentRpm * (prof.filterMax - prof.filterBase) * (0.4 + 0.6 * currentLoad),
      180,
      prof.filterMax
    );
    this.dynamicFilter.frequency.setTargetAtTime(filterHz, t, 0.045);

    // 7. Umumiy ovoz balandligi
    const baseVol = (0.042 + currentLoad * 0.14 + currentRpm * 0.06) * (prof.gainMul || 1.0);
    this.engineGain.gain.setTargetAtTime(baseVol, t, 0.045);

    // 8. Havo tortish (Intake)
    this.intakeFilter.frequency.setTargetAtTime(320 + currentRpm * 1700, t, 0.05);
    this.intakeGain.gain.setTargetAtTime(currentLoad * currentRpm * 0.045, t, 0.05);
  }
}

// Bir martalik audio effekti (One-shot sound trigger)
async function playOneShot(url, volume = 0.5, pitch = 1.0) {
  if (!ctx || !masterGain) return;
  const buf = await getAudioBuffer(url);
  if (!buf) return;

  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = pitch;

  const g = ctx.createGain();
  g.gain.setValueAtTime(volume, ctx.currentTime);

  src.connect(g).connect(masterGain);
  src.start();
}

// Glushitel otishi (Exhaust Pop / Burble)
function triggerPop(intensity = 0.7) {
  const popFiles = ['audio/common/pop_1.wav', 'audio/common/pop_2.wav', 'audio/common/pop_3.wav'];
  const chosen = popFiles[Math.floor(Math.random() * popFiles.length)];
  const pitch = 0.88 + Math.random() * 0.28;
  playOneShot(chosen, Math.min(0.85, 0.18 * intensity), pitch);
}

// Turbo Blow-Off ("psshhh")
function triggerBlowOff(intensity = 0.6) {
  playOneShot('audio/common/blowoff.wav', Math.min(0.65, 0.16 * intensity), 1.0 + Math.random() * 0.15);
}

// Uzatma almashishi mexanik zarbi (Shift clunk)
function triggerShiftSound() {
  playOneShot('audio/common/shift.wav', 0.22, 0.95 + Math.random() * 0.1);
}

// Audio tizimini initsializatsiya qilish
export function initAudio(volume = 0.6) {
  masterVolume = volume;
  if (isStarted) {
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return;
  }

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    ctx = new AudioCtx();
  } catch (e) {
    console.warn('[Audio] WebAudio not supported:', e);
    return;
  }

  isStarted = true;

  // Asosiy master miksher
  masterGain = ctx.createGain();
  masterGain.gain.value = masterVolume;
  masterGain.connect(ctx.destination);

  // Salon akustik filtri (Interior cabin lowpass filter)
  interiorFilter = ctx.createBiquadFilter();
  interiorFilter.type = 'lowpass';
  interiorFilter.frequency.value = 20000; // Standartda ochiq
  interiorFilter.Q.value = 0.7;
  interiorFilter.connect(masterGain);

  // Tashqi to'g'ridan-to'g'ri shina
  exteriorBus = ctx.createGain();
  exteriorBus.gain.value = 1.0;
  exteriorBus.connect(masterGain);

  // Shinalar chiyillashi (Drift va keskin tormoz)
  const skidSrc = ctx.createBufferSource();
  skidSrc.buffer = createNoiseBuffer();
  skidSrc.loop = true;
  const skidBp = ctx.createBiquadFilter();
  skidBp.type = 'bandpass';
  skidBp.frequency.value = 1650;
  skidBp.Q.value = 3.2;
  skidGain = ctx.createGain();
  skidGain.gain.value = 0;
  skidSrc.connect(skidBp).connect(skidGain).connect(masterGain);
  skidSrc.start();

  // Bosh o'yinchi mashina ovozi
  localVoice = new LocalCarVoice();

  // Muhim audio fayllarni oldindan fon rejimida yuklash (Preload)
  const preloadList = [
    'audio/common/startup.wav',
    'audio/common/shutdown.wav',
    'audio/common/shift.wav',
    'audio/common/blowoff.wav',
    'audio/common/pop_1.wav',
    'audio/common/pop_2.wav',
    'audio/common/pop_3.wav',
  ];
  preloadList.forEach((url) => getAudioBuffer(url));
}

export function setVolume(v) {
  masterVolume = v;
  if (masterGain && ctx) {
    masterGain.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
  }
}

export function suspend(on) {
  if (ctx) on ? ctx.suspend() : ctx.resume();
}

// Dvigatelni o't oldirish (Startup sequence)
export function engineStart() {
  if (!ctx) return;
  isEngineRunning = true;
  playOneShot('audio/common/startup.wav', 0.45, 1.0);
}

// Dvigatelni o'chirish (Shutdown sequence)
export function engineOff() {
  if (!ctx) return;
  isEngineRunning = false;
  playOneShot('audio/common/shutdown.wav', 0.40, 1.0);
  if (skidGain) skidGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
}

// Har kadrda chaqiriladigan dvigatel ovozi yangilanishi
export function updateEngine(rpm, throttle, pitch = 1, slip = 0, kmh = 0, opts = {}) {
  if (!ctx || !isStarted) return;
  if (ctx.state === 'suspended' && throttle > 0) ctx.resume();

  const dt = opts.dt || 0.016;
  const soundKey = opts.sound || 'gentra_i4';
  const braking = !!opts.braking;
  const gear = opts.gear || 1;
  const isInterior = !!opts.isInterior;
  const prof = SOUND_PROFILES[soundKey] || SOUND_PROFILES.gentra_i4;

  if (currentCarSound !== soundKey && localVoice) {
    currentCarSound = soundKey;
    localVoice.setSoundProfile(soundKey);
  }

  // Uzatma almashishi (Mechanical gear change transition)
  if (gear !== lastGear && kmh > 15) {
    triggerShiftSound();
    if (gear > lastGear && throttle > 0.3) {
      currentRpm = Math.max(0.22, currentRpm - 0.16);
      if (prof.burble > 0.3) triggerPop(prof.burble * 0.8);
    } else if (gear < lastGear && braking) {
      currentRpm = Math.min(0.92, currentRpm + 0.14);
    }
    lastGear = gear;
  }

  // Gaz qo'yib yuborilganda: Turbo blow-off va glushitel otishi
  popCooldown = Math.max(0, popCooldown - dt);
  if (lastThrottle > 0.45 && throttle === 0 && kmh > 30) {
    if (prof.turbo) triggerBlowOff(currentRpm);
    if (prof.burble > 0 && popCooldown <= 0) {
      triggerPop(prof.burble);
      popCooldown = 0.15;
    }
  } else if (throttle === 0 && kmh > 42 && currentRpm > 0.42 && prof.burble > 0.5 && popCooldown <= 0 && Math.random() < 0.22) {
    triggerPop(prof.burble * 0.7);
    popCooldown = 0.18 + Math.random() * 0.14;
  }
  lastThrottle = throttle;

  // Bosh o'yinchi mashina ovozini yangilash
  if (localVoice) {
    localVoice.update(rpm, throttle, pitch, kmh, isInterior, prof, dt);
  }

  // Shina chiyillashi (Drift va kuchli tormoz)
  if (skidGain) {
    const brakeScrub = braking && kmh > 50 ? 0.07 : 0;
    const driftScrub = slip > 0.16 && kmh > 20 ? Math.min(0.35, slip * 0.6) : 0;
    skidGain.gain.setTargetAtTime(Math.max(brakeScrub, driftScrub), ctx.currentTime, 0.05);
  }
}

// To'qnashuv va zarba ovozi (Thump)
export function thump(strength) {
  if (!ctx || !masterGain) return;
  const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
  o.type = 'triangle';
  o.frequency.setValueAtTime(125, t);
  o.frequency.exponentialRampToValueAtTime(36, t + 0.26);
  g.gain.setValueAtTime(Math.min(0.75, (strength || 1) * 0.055), t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
  o.connect(g).connect(masterGain);
  o.start(t);
  o.stop(t + 0.35);
}

// Signal (Horn)
export function horn(dur = 0.4) {
  if (!ctx || !masterGain) return;
  const t = ctx.currentTime;
  for (const f of [420, 525]) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.06, t);
    g.gain.setValueAtTime(0.06, t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
    o.connect(g).connect(masterGain);
    o.start(t);
    o.stop(t + dur + 0.1);
  }
}

// UI signal tovushi (Beep)
export function beep(type = 'ok') {
  if (!ctx || !masterGain) return;
  const t = ctx.currentTime;
  const notes = { ok: [660, 880], cash: [880, 1175, 1568], err: [300, 200], go: [523, 784] }[type] || [660];
  notes.forEach((f, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t + i * 0.08);
    g.gain.linearRampToValueAtTime(0.10, t + i * 0.08 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.18);
    o.connect(g).connect(masterGain);
    o.start(t + i * 0.08);
    o.stop(t + i * 0.08 + 0.2);
  });
}

// ============================================================================
// KO'P O'YINCHILI 3D FAZOVIY AUDIO VA DOPPLER EFFEKTI (Multiplayer 3D Audio)
// ============================================================================

export class RemoteAudioVoice {
  constructor(soundKey, pannerNode) {
    this.key = soundKey;
    this.panner = pannerNode;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.source = null;
    this.isPlaying = false;
    this.lastDist = 0;

    this.gain.connect(this.panner);
    this.initBuffer();
  }

  async initBuffer() {
    const prof = SOUND_PROFILES[this.key] || SOUND_PROFILES.gentra_i4;
    if (!prof.src) return;
    const buf = await getAudioBuffer(prof.src);
    if (!buf || !ctx) return;

    this.source = ctx.createBufferSource();
    this.source.buffer = buf;
    this.source.loop = true;
    this.source.connect(this.gain);
    this.source.start();
    this.isPlaying = true;
  }

  update(dist, speedKmh, dt, basePitch = 1.0) {
    if (!ctx || !this.isPlaying || !this.source) return;
    const t = ctx.currentTime;

    // Doppler effekti: nisbiy radial tezlikni hisoblash
    // vRad > 0 bo'lsa uzoqlashmoqda (past pitch), vRad < 0 bo'lsa yaqinlashmoqda (yuqori pitch)
    let doppler = 1.0;
    if (this.lastDist > 0 && dt > 0.001) {
      const vRadial = (dist - this.lastDist) / dt; // m/s
      // c = 343 m/s (tovush tezligi)
      doppler = THREE.MathUtils.clamp(1.0 - (vRadial / 343.0), 0.82, 1.25);
    }
    this.lastDist = dist;

    // Masofaviy o'yinchining RPM qiymati tezligidan hosil qilinadi
    const rpmFactor = THREE.MathUtils.clamp(speedKmh / 160, 0.15, 0.95);
    const targetPitch = THREE.MathUtils.clamp(basePitch * (0.65 + rpmFactor * 0.95) * doppler, 0.45, 2.2);
    this.source.playbackRate.setTargetAtTime(targetPitch, t, 0.06);

    // Ovoz balandligi: turganda past (0.12), tezlikda balandroq (0.35)
    const targetVol = THREE.MathUtils.clamp(0.12 + (speedKmh / 140) * 0.28, 0.1, 0.45);
    this.gain.gain.setTargetAtTime(targetVol, t, 0.06);
  }

  dispose() {
    if (this.source) {
      try { this.source.stop(); } catch (_) {}
      this.source.disconnect();
    }
    this.gain.disconnect();
    this.panner.disconnect();
  }
}

// Barcha masofaviy o'yinchilarning 3D ovozlarini boshqaruvchi tizim
export class RemoteAudioManager {
  constructor() {
    this.voices = new Map(); // id -> RemoteAudioVoice
  }

  update(remoteCars, listenerPos, dt) {
    if (!ctx || !isStarted || !masterGain) return;

    const activeIds = new Set();

    for (const r of remoteCars) {
      if (!r || !r.id) continue;
      const dist = Math.hypot(r.x - listenerPos.x, r.z - listenerPos.z);

      // 120 metrdan uzoqdagi o'yinchilar ovozi hisoblanmaydi (Optimallashtirish)
      if (dist > 120) {
        if (this.voices.has(r.id)) {
          this.voices.get(r.id).dispose();
          this.voices.delete(r.id);
        }
        continue;
      }

      activeIds.add(r.id);
      let v = this.voices.get(r.id);

      if (!v || v.key !== r.carId) {
        if (v) v.dispose();

        // 3D PannerNode yaratish
        const panner = ctx.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 6;
        panner.maxDistance = 120;
        panner.rolloffFactor = 1.25;
        panner.connect(masterGain);

        v = new RemoteAudioVoice(r.carId, panner);
        this.voices.set(r.id, v);
      }

      // 3D pozitsiyani yangilash
      v.panner.positionX.setTargetAtTime(r.x, ctx.currentTime, 0.04);
      v.panner.positionY.setTargetAtTime(r.y || 0, ctx.currentTime, 0.04);
      v.panner.positionZ.setTargetAtTime(r.z, ctx.currentTime, 0.04);

      const speedKmh = Math.abs(r.v || 0) * 3.6;
      v.update(dist, speedKmh, dt, 1.0);
    }

    // Ketgan o'yinchilarni tozalash
    for (const [id, voice] of this.voices) {
      if (!activeIds.has(id)) {
        voice.dispose();
        this.voices.delete(id);
      }
    }
  }

  disposeAll() {
    for (const voice of this.voices.values()) voice.dispose();
    this.voices.clear();
  }
}

export const remoteAudio = new RemoteAudioManager();
