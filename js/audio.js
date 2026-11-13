// ============================================================================
// TUNGI TOSHKENT V16 — AUTOMATIC REALISTIC ENGINE & DRIVETRAIN AUDIO SYSTEM
// ============================================================================
// Layers:
// 1. Engine Startup & Shutdown (ICE crank vs EV chime)
// 2. Idle, Low, Mid, High RPM multi-band crossover
// 3. Throttle load & intake resonance
// 4. Deceleration engine braking, exhaust burble/pops & Turbo Blow-Off
// 5. Mechanical Gearbox shift clunk (ICE/Hybrid only)
// 6. Dedicated Electric Drivetrain (Inverter whine, AVAS low-speed hum, Regen)
// 7. Hybrid EV <-> ICE seamless blending
// 8. Road surface, wind rush & tire skid audio
// 9. Interior Cabin vs Exterior Chase acoustic perspective
// 10. Multiplayer 3D HRTF Positional Audio + Doppler + Nearest-6 Voice Culling

import * as THREE from 'three';
import { getEngineSpec } from './engineDb.js';

let ctx = null;
let masterGain = null;
let interiorFilter = null;
let exteriorBus = null;
let skidGain = null;
let roadGain = null;
let roadFilter = null;

let isStarted = false;
let isEngineRunning = true;
let currentCarSound = '';
let currentCarId = '';
let currentRpm = 0.18;
let currentLoad = 0;
let lastGear = 1;
let lastThrottle = 0;
let popCooldown = 0;
let masterVolume = 0.6;

const bufferCache = new Map();
const pendingLoads = new Map();
const failedUrls = new Set();

export const SOUND_PROFILES = {
  spark_i3: {
    src: null,
    is3Cyl: true,
    baseFreq: 42,
    pitchMul: 1.15,
    gainMul: 0.90,
    turbo: false,
    burble: 0.20,
    filterBase: 260,
    filterMax: 2400,
  },
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
  byd_han_phev: {
    src: 'audio/engines/kia_turbo.mp3',
    evSrc: 'audio/engines/tesla_ev.mp3',
    isHybrid: true,
    baseFreq: 34,
    pitchMul: 0.95,
    gainMul: 0.92,
    turbo: true,
    burble: 0.15,
    filterBase: 260,
    filterMax: 2800,
  },
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
  v6_tt: {
    src: 'audio/engines/bmw_i6.mp3',
    baseFreq: 30,
    pitchMul: 0.84,
    gainMul: 1.04,
    turbo: true,
    burble: 0.30,
    filterBase: 210,
    filterMax: 2900,
  },
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
  mclaren_v8_tt: {
    src: 'audio/engines/bmw_v8.mp3',
    baseFreq: 34,
    pitchMul: 1.02,
    gainMul: 1.16,
    turbo: true,
    burble: 0.86,
    filterBase: 250,
    filterMax: 4100,
  },
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
  sf90_hybrid: {
    src: 'audio/engines/ferrari_v12.mp3',
    evSrc: 'audio/engines/tesla_ev.mp3',
    isHybrid: true,
    baseFreq: 44,
    pitchMul: 1.04,
    gainMul: 1.15,
    turbo: true,
    burble: 0.78,
    filterBase: 270,
    filterMax: 4300,
  },
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
  lambo_hybrid: {
    src: 'audio/engines/lambo_v12.mp3',
    evSrc: 'audio/engines/tesla_ev.mp3',
    isHybrid: true,
    baseFreq: 49,
    pitchMul: 1.10,
    gainMul: 1.20,
    turbo: false,
    burble: 0.86,
    filterBase: 300,
    filterMax: 4500,
  },
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
  tesla_ev: {
    src: 'audio/engines/tesla_ev.mp3',
    isElectric: true,
    baseFreq: 95,
    pitchMul: 1.0,
    gainMul: 0.88,
    turbo: false,
    burble: 0,
    filterBase: 420,
    filterMax: 5200,
  },
  unknown_neutral: {
    src: null,
    isUnknown: true,
    is3Cyl: false,
    baseFreq: 38,
    pitchMul: 0.95,
    gainMul: 0.55,
    turbo: false,
    burble: 0,
    filterBase: 220,
    filterMax: 2000,
  },
};

SOUND_PROFILES.i4 = SOUND_PROFILES.gentra_i4;
SOUND_PROFILES.turbo4 = SOUND_PROFILES.malibu_turbo;
SOUND_PROFILES.bmwi6 = SOUND_PROFILES.bmw_i6;
SOUND_PROFILES.bmwv8 = SOUND_PROFILES.bmw_v8;
SOUND_PROFILES.amgv8 = SOUND_PROFILES.amg_v8;
SOUND_PROFILES.v12 = SOUND_PROFILES.lambo_v12;

export function getAudioStatus() {
  return {
    started: isStarted,
    ctxState: ctx ? ctx.state : 'uninitialized',
    currentCarId,
    currentCarSound,
    currentRpm: Number(currentRpm.toFixed(3)),
    cachedBuffers: [...bufferCache.keys()],
    failedUrls: [...failedUrls],
    activeRemoteVoices: remoteAudio ? remoteAudio.voices.size : 0,
  };
}

async function getAudioBuffer(url) {
  if (!url || !ctx) return null;
  if (bufferCache.has(url)) return bufferCache.get(url);
  if (pendingLoads.has(url)) return pendingLoads.get(url);

  const promise = (async () => {
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const arrayBuf = await resp.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuf);
      bufferCache.set(url, decoded);
      failedUrls.delete(url);
      pendingLoads.delete(url);
      return decoded;
    } catch (err) {
      console.warn(`[Audio] Failed to load "${url}":`, err.message);
      failedUrls.add(url);
      pendingLoads.delete(url);
      return null;
    }
  })();

  pendingLoads.set(url, promise);
  return promise;
}

function createNoiseBuffer() {
  if (!ctx) return null;
  const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

let localVoice = null;

class LocalCarVoice {
  constructor() {
    this.key = '';
    this.source = null;
    this.evSource = null;
    this.buffer = null;
    this.isPlaying = false;

    this.idleFilter = ctx.createBiquadFilter();
    this.idleFilter.type = 'lowpass';
    this.idleFilter.frequency.value = 180;
    this.idleGain = ctx.createGain();
    this.idleGain.gain.value = 0.5;

    this.midFilter = ctx.createBiquadFilter();
    this.midFilter.type = 'bandpass';
    this.midFilter.frequency.value = 750;
    this.midFilter.Q.value = 1.2;
    this.midGain = ctx.createGain();
    this.midGain.gain.value = 0.6;

    this.highFilter = ctx.createBiquadFilter();
    this.highFilter.type = 'highpass';
    this.highFilter.frequency.value = 2100;
    this.highGain = ctx.createGain();
    this.highGain.gain.value = 0.4;

    this.dynamicFilter = ctx.createBiquadFilter();
    this.dynamicFilter.type = 'lowpass';
    this.dynamicFilter.frequency.value = 350;
    this.dynamicFilter.Q.value = 2.0;

    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;

    // 3-cyl / fallback oscillator bank
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

    // Dedicated EV Inverter Whine + AVAS hum layer (used by EV & Hybrid cars)
    this.evOsc1 = ctx.createOscillator();
    this.evOsc1.type = 'sine';
    this.evOsc2 = ctx.createOscillator();
    this.evOsc2.type = 'triangle';
    this.evSynthGain = ctx.createGain();
    this.evSynthGain.gain.value = 0;
    this.evSampleGain = ctx.createGain();
    this.evSampleGain.gain.value = 0;
    this.evOsc1.connect(this.evSynthGain);
    this.evOsc2.connect(this.evSynthGain);
    this.evSynthGain.connect(interiorFilter);
    this.evSynthGain.connect(exteriorBus);
    this.evSampleGain.connect(interiorFilter);
    this.evSampleGain.connect(exteriorBus);
    this.evOsc1.start();
    this.evOsc2.start();

    // Intake air rush
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

    this.idleFilter.connect(this.idleGain).connect(this.dynamicFilter);
    this.midFilter.connect(this.midGain).connect(this.dynamicFilter);
    this.highFilter.connect(this.highGain).connect(this.dynamicFilter);

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
    if (this.evSource) {
      try { this.evSource.stop(); } catch (_) {}
      this.evSource.disconnect();
      this.evSource = null;
    }

    if (prof.is3Cyl || prof.isUnknown) {
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

    if (prof.evSrc) {
      const evBuf = await getAudioBuffer(prof.evSrc);
      if (evBuf && this.key === key) {
        this.evSource = ctx.createBufferSource();
        this.evSource.buffer = evBuf;
        this.evSource.loop = true;
        this.evSource.connect(this.evSampleGain);
        this.evSource.start();
      }
    }
  }

  update(rpm, throttle, pitchMul, kmh, isInterior, prof, spec, braking, dt) {
    if (!ctx) return;
    const t = ctx.currentTime;

    if (isInterior) {
      interiorFilter.frequency.setTargetAtTime(980, t, 0.05);
      interiorFilter.Q.setTargetAtTime(1.6, t, 0.05);
      exteriorBus.gain.setTargetAtTime(0.0, t, 0.05);
    } else {
      interiorFilter.frequency.setTargetAtTime(20000, t, 0.05);
      interiorFilter.Q.setTargetAtTime(0.7, t, 0.05);
      exteriorBus.gain.setTargetAtTime(1.0, t, 0.05);
    }

    if (!isEngineRunning) {
      this.engineGain.gain.setTargetAtTime(0, t, 0.08);
      this.sparkGain.gain.setTargetAtTime(0, t, 0.08);
      this.intakeGain.gain.setTargetAtTime(0, t, 0.08);
      this.evSynthGain.gain.setTargetAtTime(0, t, 0.08);
      this.evSampleGain.gain.setTargetAtTime(0, t, 0.08);
      return;
    }

    const loadTarget = throttle > 0 ? 0.35 + throttle * 0.65 : kmh > 12 ? 0.08 : 0.0;
    currentLoad += (loadTarget - currentLoad) * Math.min(1, dt * (throttle > currentLoad ? 10 : 6));
    currentRpm += (rpm - currentRpm) * Math.min(1, dt * 14);

    // Physical RPM range scaling from engineDb
    const idleRpm = spec?.idleRPM ?? 750;
    const redlineRpm = spec?.redlineRPM ?? 6800;
    const actualRpm = idleRpm + currentRpm * Math.max(2000, redlineRpm - idleRpm);
    const revNorm = THREE.MathUtils.clamp((actualRpm - 700) / 7800, 0, 1.15);

    const isEV = !!prof.isElectric || spec?.powertrain === 'electric';
    const isHybrid = !!prof.isHybrid || spec?.powertrain === 'hybrid';

    if (isEV) {
      // Pure EV: silent at standstill, smooth motor whine + AVAS (<28 km/h) + regen braking whine
      const speedNorm = THREE.MathUtils.clamp(kmh / 240, 0, 1.3);
      const regenActive = braking && kmh > 8 ? 0.45 : 0;
      const avasVol = kmh > 1 && kmh < 28 ? 0.018 * (1 - kmh / 28) : 0;

      if (this.source && this.source.playbackRate) {
        const evRate = THREE.MathUtils.clamp(0.24 + speedNorm * 1.85 + regenActive * 0.15, 0.22, 2.3);
        this.source.playbackRate.setTargetAtTime(evRate, t, 0.04);
      }

      const evHz = 110 + speedNorm * 720 + currentLoad * 75 + regenActive * 90;
      this.evOsc1.frequency.setTargetAtTime(evHz, t, 0.035);
      this.evOsc2.frequency.setTargetAtTime(evHz * 2.02, t, 0.035);
      const evSynthVol = kmh < 0.8 && throttle === 0 ? 0 : (0.012 + speedNorm * 0.038 + currentLoad * 0.025 + regenActive * 0.03 + avasVol);
      this.evSynthGain.gain.setTargetAtTime(evSynthVol, t, 0.045);

      const sampleVol = kmh < 0.8 && throttle === 0 ? 0 : (0.025 + speedNorm * 0.12 + currentLoad * 0.07 + regenActive * 0.06) * (prof.gainMul || 0.88);
      this.engineGain.gain.setTargetAtTime(sampleVol, t, 0.045);
      this.dynamicFilter.frequency.setTargetAtTime(550 + speedNorm * 4200, t, 0.045);
      this.sparkGain.gain.setTargetAtTime(0, t, 0.05);
      this.intakeGain.gain.setTargetAtTime(0, t, 0.05);
      this.evSampleGain.gain.setTargetAtTime(0, t, 0.05);
      return;
    }

    // ICE / Hybrid Combustion Layer
    const baseP = (prof.pitchMul || 1.0) / Math.max(0.6, pitchMul || 1.0);
    const playbackRate = THREE.MathUtils.clamp(baseP * (0.62 + revNorm * 1.04), 0.45, 2.45);
    if (this.source && this.source.playbackRate) {
      this.source.playbackRate.setTargetAtTime(playbackRate, t, 0.035);
    }

    if (prof.is3Cyl || prof.isUnknown) {
      const baseHz = prof.baseFreq + currentRpm * 135 + currentLoad * 18;
      this.sparkOsc1.frequency.setTargetAtTime(baseHz, t, 0.035);
      this.sparkOsc2.frequency.setTargetAtTime(baseHz * (prof.is3Cyl ? 1.5 : 2.0), t, 0.035);
      this.sparkOsc3.frequency.setTargetAtTime(baseHz * (prof.is3Cyl ? 3.0 : 2.5), t, 0.035);
      const sparkVol = (0.045 + currentLoad * 0.13 + currentRpm * 0.06) * prof.gainMul;
      this.sparkGain.gain.setTargetAtTime(sparkVol, t, 0.04);
    } else {
      this.sparkGain.gain.setTargetAtTime(0, t, 0.05);
    }

    // Hybrid electric assist blend at low speed / launch / regen
    if (isHybrid) {
      const speedNorm = THREE.MathUtils.clamp(kmh / 180, 0, 1.2);
      const evBlend = kmh < 35 && throttle < 0.45 ? 0.85 : 0.35;
      const regen = braking && kmh > 10 ? 0.35 : 0;
      const evHz = 130 + speedNorm * 650 + regen * 80;
      this.evOsc1.frequency.setTargetAtTime(evHz, t, 0.04);
      this.evOsc2.frequency.setTargetAtTime(evHz * 2.0, t, 0.04);
      this.evSynthGain.gain.setTargetAtTime((0.015 + speedNorm * 0.025 + regen * 0.03) * evBlend, t, 0.05);
      if (this.evSource && this.evSource.playbackRate) {
        this.evSource.playbackRate.setTargetAtTime(THREE.MathUtils.clamp(0.3 + speedNorm * 1.5, 0.25, 2.0), t, 0.04);
      }
      this.evSampleGain.gain.setTargetAtTime((0.02 + speedNorm * 0.05 + regen * 0.04) * evBlend, t, 0.05);
    } else {
      this.evSynthGain.gain.setTargetAtTime(0, t, 0.05);
      this.evSampleGain.gain.setTargetAtTime(0, t, 0.05);
    }

    const idleFactor = Math.max(0, 1 - kmh / 18) * (1 - throttle * 0.7);
    this.idleGain.gain.setTargetAtTime(0.45 + idleFactor * 0.45, t, 0.05);

    const midFactor = Math.sin(Math.min(Math.PI, currentRpm * Math.PI));
    this.midGain.gain.setTargetAtTime(0.35 + midFactor * 0.55, t, 0.05);

    const highFactor = Math.max(0, currentRpm - 0.35) * (0.3 + 0.7 * currentLoad);
    this.highGain.gain.setTargetAtTime(highFactor * 0.75, t, 0.05);

    const filterHz = THREE.MathUtils.clamp(
      prof.filterBase + currentRpm * (prof.filterMax - prof.filterBase) * (0.4 + 0.6 * currentLoad),
      180,
      prof.filterMax
    );
    this.dynamicFilter.frequency.setTargetAtTime(filterHz, t, 0.045);

    const hybridIceAtten = isHybrid && kmh < 22 && throttle < 0.3 ? 0.55 : 1.0;
    const baseVol = (0.042 + currentLoad * 0.14 + currentRpm * 0.06) * (prof.gainMul || 1.0) * hybridIceAtten;
    this.engineGain.gain.setTargetAtTime(baseVol, t, 0.045);

    this.intakeFilter.frequency.setTargetAtTime(320 + currentRpm * 1700, t, 0.05);
    this.intakeGain.gain.setTargetAtTime(currentLoad * currentRpm * 0.045, t, 0.05);
  }
}

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

function triggerPop(intensity = 0.7) {
  const popFiles = ['audio/common/pop_1.wav', 'audio/common/pop_2.wav', 'audio/common/pop_3.wav'];
  const chosen = popFiles[Math.floor(Math.random() * popFiles.length)];
  playOneShot(chosen, Math.min(0.85, 0.18 * intensity), 0.88 + Math.random() * 0.28);
}

function triggerBlowOff(intensity = 0.6) {
  playOneShot('audio/common/blowoff.wav', Math.min(0.65, 0.16 * intensity), 1.0 + Math.random() * 0.15);
}

function triggerShiftSound() {
  playOneShot('audio/common/shift.wav', 0.22, 0.95 + Math.random() * 0.1);
}

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

  masterGain = ctx.createGain();
  masterGain.gain.value = masterVolume;
  masterGain.connect(ctx.destination);

  interiorFilter = ctx.createBiquadFilter();
  interiorFilter.type = 'lowpass';
  interiorFilter.frequency.value = 20000;
  interiorFilter.Q.value = 0.7;
  interiorFilter.connect(masterGain);

  exteriorBus = ctx.createGain();
  exteriorBus.gain.value = 1.0;
  exteriorBus.connect(masterGain);

  const noiseBuf = createNoiseBuffer();

  // Tire skid & brake scrub
  const skidSrc = ctx.createBufferSource();
  skidSrc.buffer = noiseBuf;
  skidSrc.loop = true;
  const skidBp = ctx.createBiquadFilter();
  skidBp.type = 'bandpass';
  skidBp.frequency.value = 1650;
  skidBp.Q.value = 3.2;
  skidGain = ctx.createGain();
  skidGain.gain.value = 0;
  skidSrc.connect(skidBp).connect(skidGain).connect(masterGain);
  skidSrc.start();

  // Tire rolling + wind rush layer (routed through interior/exterior buses)
  const roadSrc = ctx.createBufferSource();
  roadSrc.buffer = noiseBuf;
  roadSrc.loop = true;
  roadFilter = ctx.createBiquadFilter();
  roadFilter.type = 'bandpass';
  roadFilter.frequency.value = 260;
  roadFilter.Q.value = 0.8;
  roadGain = ctx.createGain();
  roadGain.gain.value = 0;
  roadSrc.connect(roadFilter).connect(roadGain);
  roadGain.connect(interiorFilter);
  roadGain.connect(exteriorBus);
  roadSrc.start();

  localVoice = new LocalCarVoice();

  const preloadList = [
    'audio/common/startup.wav',
    'audio/common/shutdown.wav',
    'audio/common/shift.wav',
    'audio/common/blowoff.wav',
    'audio/common/pop_1.wav',
    'audio/common/pop_2.wav',
    'audio/common/pop_3.wav',
    'audio/engines/tesla_ev.mp3',
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

export function engineStart() {
  if (!ctx) return;
  isEngineRunning = true;
  const spec = currentCarId ? getEngineSpec(currentCarId) : null;
  if (spec?.powertrain === 'electric') {
    beep('ok');
    return;
  }
  playOneShot('audio/common/startup.wav', 0.45, 1.0);
}

export function engineOff() {
  if (!ctx) return;
  isEngineRunning = false;
  const spec = currentCarId ? getEngineSpec(currentCarId) : null;
  if (spec?.powertrain !== 'electric') {
    playOneShot('audio/common/shutdown.wav', 0.40, 1.0);
  }
  if (skidGain) skidGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
  if (roadGain) roadGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
}

export function updateEngine(rpm, throttle, pitch = 1, slip = 0, kmh = 0, opts = {}) {
  if (!ctx || !isStarted) return;
  if (ctx.state === 'suspended' && (throttle > 0 || kmh > 0.5)) ctx.resume();

  const dt = opts.dt || 0.016;
  const carId = opts.carId || '';
  if (carId) currentCarId = carId;
  const spec = carId ? getEngineSpec(carId) : null;
  const soundKey = (spec && spec.audioProfile && SOUND_PROFILES[spec.audioProfile])
    ? spec.audioProfile
    : (opts.sound || 'gentra_i4');
  const braking = !!opts.braking;
  const gear = opts.gear || 1;
  const isInterior = !!opts.isInterior;
  const prof = SOUND_PROFILES[soundKey] || SOUND_PROFILES.gentra_i4;
  const isEV = !!prof.isElectric || spec?.powertrain === 'electric';

  if (currentCarSound !== soundKey && localVoice) {
    currentCarSound = soundKey;
    localVoice.setSoundProfile(soundKey);
  }

  // Mechanical gear shift only for ICE/Hybrid vehicles
  if (!isEV && gear !== lastGear && kmh > 15) {
    triggerShiftSound();
    if (gear > lastGear && throttle > 0.3) {
      currentRpm = Math.max(0.22, currentRpm - 0.16);
      if (prof.burble > 0.3) triggerPop(prof.burble * 0.8);
    } else if (gear < lastGear && braking) {
      currentRpm = Math.min(0.92, currentRpm + 0.14);
    }
    lastGear = gear;
  }

  // Turbo blow-off and exhaust pops (ICE/Hybrid only)
  popCooldown = Math.max(0, popCooldown - dt);
  if (!isEV) {
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
  }
  lastThrottle = throttle;

  if (localVoice) {
    localVoice.update(rpm, throttle, pitch, kmh, isInterior, prof, spec, braking, dt);
  }

  // Road rolling + wind rush
  if (roadGain && roadFilter) {
    const roadVol = kmh > 5 ? Math.min(0.065, (kmh / 260) * 0.055) : 0;
    const roadHz = 180 + Math.min(1800, kmh * 6.5);
    roadFilter.frequency.setTargetAtTime(roadHz, ctx.currentTime, 0.08);
    roadGain.gain.setTargetAtTime(roadVol, ctx.currentTime, 0.08);
  }

  // Tire skid & hard brake scrub
  if (skidGain) {
    const brakeScrub = braking && kmh > 45 ? 0.07 : 0;
    const driftScrub = slip > 0.16 && kmh > 20 ? Math.min(0.35, slip * 0.6) : 0;
    skidGain.gain.setTargetAtTime(Math.max(brakeScrub, driftScrub), ctx.currentTime, 0.05);
  }
}

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
// MULTIPLAYER 3D POSITIONAL AUDIO + DOPPLER + NEAREST-6 VOICE CULLING
// ============================================================================
const _camFwd = new THREE.Vector3();

export class RemoteAudioVoice {
  constructor(carId, soundKey, pannerNode) {
    this.carId = carId;
    this.key = soundKey;
    this.panner = pannerNode;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.source = null;
    this.isPlaying = false;
    this.lastDist = 0;
    this.smoothRpm = 0.18;
    this.disposed = false;

    this.gain.connect(this.panner);
    this.initBuffer();
  }

  async initBuffer() {
    const prof = SOUND_PROFILES[this.key] || SOUND_PROFILES.gentra_i4;
    if (!prof.src) return;
    const buf = await getAudioBuffer(prof.src);
    if (!buf || !ctx || this.disposed) return;

    this.source = ctx.createBufferSource();
    this.source.buffer = buf;
    this.source.loop = true;
    this.source.connect(this.gain);
    this.source.start();
    this.isPlaying = true;
  }

  update(dist, speedKmh, dt, remoteRpm = null, remoteThr = 0) {
    if (!ctx || !this.isPlaying || !this.source || this.disposed) return;
    const t = ctx.currentTime;
    const prof = SOUND_PROFILES[this.key] || SOUND_PROFILES.gentra_i4;

    let doppler = 1.0;
    if (this.lastDist > 0 && dt > 0.001) {
      const vRadial = (dist - this.lastDist) / dt;
      doppler = THREE.MathUtils.clamp(1.0 - vRadial / 343.0, 0.82, 1.25);
    }
    this.lastDist = dist;

    const targetRpm = typeof remoteRpm === 'number'
      ? THREE.MathUtils.clamp(remoteRpm, 0.14, 1.0)
      : THREE.MathUtils.clamp(speedKmh / 160, 0.15, 0.95);
    this.smoothRpm += (targetRpm - this.smoothRpm) * Math.min(1, dt * 10);

    const basePitch = prof.pitchMul || 1.0;
    const targetPitch = prof.isElectric
      ? THREE.MathUtils.clamp((0.24 + (speedKmh / 220) * 1.7) * doppler, 0.2, 2.3)
      : THREE.MathUtils.clamp(basePitch * (0.64 + this.smoothRpm * 0.98) * doppler, 0.45, 2.25);
    this.source.playbackRate.setTargetAtTime(targetPitch, t, 0.06);

    const loadBoost = Math.max(0, Math.min(0.12, remoteThr * 0.12));
    const targetVol = prof.isElectric && speedKmh < 1
      ? 0
      : THREE.MathUtils.clamp((0.10 + (speedKmh / 140) * 0.25 + loadBoost) * (prof.gainMul || 1.0), 0.06, 0.42);
    this.gain.gain.setTargetAtTime(targetVol, t, 0.06);
  }

  dispose() {
    this.disposed = true;
    if (this.source) {
      try { this.source.stop(); } catch (_) {}
      this.source.disconnect();
      this.source = null;
    }
    this.gain.disconnect();
    this.panner.disconnect();
  }
}

export class RemoteAudioManager {
  constructor() {
    this.voices = new Map();
    this.maxVoices = 6;
  }

  updateListener(camera, fallbackPos) {
    if (!ctx || !ctx.listener) return;
    const L = ctx.listener;
    const pos = camera ? camera.position : fallbackPos;
    if (!pos) return;
    const t = ctx.currentTime;

    if (L.positionX) {
      L.positionX.setTargetAtTime(pos.x || 0, t, 0.04);
      L.positionY.setTargetAtTime(pos.y || 1.5, t, 0.04);
      L.positionZ.setTargetAtTime(pos.z || 0, t, 0.04);
    }
    if (camera && L.forwardX) {
      camera.getWorldDirection(_camFwd);
      L.forwardX.setTargetAtTime(_camFwd.x, t, 0.04);
      L.forwardY.setTargetAtTime(_camFwd.y, t, 0.04);
      L.forwardZ.setTargetAtTime(_camFwd.z, t, 0.04);
      L.upX.setTargetAtTime(0, t, 0.04);
      L.upY.setTargetAtTime(1, t, 0.04);
      L.upZ.setTargetAtTime(0, t, 0.04);
    }
  }

  update(remoteCars, listenerPos, dt, camera = null) {
    if (!ctx || !isStarted || !masterGain) return;
    this.updateListener(camera, listenerPos);

    // Rank nearby remote vehicles within 120m and cap to nearest 6
    const candidates = [];
    for (const r of remoteCars) {
      if (!r || !r.id || r.inClub) continue;
      const dist = Math.hypot((r.x || 0) - (listenerPos.x || 0), (r.z || 0) - (listenerPos.z || 0));
      if (dist <= 120) candidates.push({ r, dist });
    }
    candidates.sort((a, b) => a.dist - b.dist);
    const active = candidates.slice(0, this.maxVoices);
    const activeIds = new Set();

    for (const { r, dist } of active) {
      activeIds.add(r.id);
      const spec = getEngineSpec(r.carId);
      const soundKey = (spec && SOUND_PROFILES[spec.audioProfile]) ? spec.audioProfile : 'gentra_i4';

      let v = this.voices.get(r.id);
      if (!v || v.carId !== r.carId || v.key !== soundKey) {
        if (v) v.dispose();
        const panner = ctx.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 6;
        panner.maxDistance = 120;
        panner.rolloffFactor = 1.25;
        panner.connect(masterGain);

        v = new RemoteAudioVoice(r.carId, soundKey, panner);
        this.voices.set(r.id, v);
      }

      v.panner.positionX.setTargetAtTime(r.x || 0, ctx.currentTime, 0.04);
      v.panner.positionY.setTargetAtTime(r.y || 0, ctx.currentTime, 0.04);
      v.panner.positionZ.setTargetAtTime(r.z || 0, ctx.currentTime, 0.04);

      const speedKmh = Math.abs(r.v || 0) * 3.6;
      v.update(dist, speedKmh, dt, r.rpm, r.thr || 0);
    }

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
