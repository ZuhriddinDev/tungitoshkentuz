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
const FALLBACK_ENGINE_SRC = 'audio/engines/gentra_i4.mp3';

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
  w12_tt: {
    src: 'audio/engines/w12.mp3',
    baseFreq: 38,
    pitchMul: 0.94,
    gainMul: 1.18,
    turbo: true,
    burble: 0.85,
    filterBase: 240,
    filterMax: 3900,
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
    this.dynamicFilter.frequency.value = 650;
    this.dynamicFilter.Q.value = 0.85;

    // Haqiqiy inomarka glushitel issiqligi: Sub-Bass Shelf + Soft Saturation (Tube Warmth)
    this.subBass = ctx.createBiquadFilter();
    this.subBass.type = 'lowshelf';
    this.subBass.frequency.value = 105;
    this.subBass.gain.value = 4.5;

    this.warmth = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 128) - 1;
      curve[i] = Math.tanh(x * 1.45);
    }
    this.warmth.curve = curve;
    this.warmth.oversample = '2x';

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

    this.idleFilter.connect(this.idleGain).connect(this.subBass);
    this.midFilter.connect(this.midGain).connect(this.subBass);
    this.highFilter.connect(this.highGain).connect(this.subBass);

    this.subBass.connect(this.dynamicFilter);
    this.dynamicFilter.connect(this.warmth);
    this.warmth.connect(this.engineGain);
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
        // Full-range real sample to'g'ridan-to'g'ri Sub-Bass + Dynamic EQ ga ulanadi (bo'g'ilib qolmaydi!)
        this.source.connect(this.subBass);
        this.source.connect(this.idleFilter);
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

    // ICE / Hybrid Combustion Layer — tabiiy pitch diapazoni (0.72..1.78, chiyillashsiz!)
    const baseP = (prof.pitchMul || 1.0) / Math.max(0.75, Math.min(1.25, pitchMul || 1.0));
    const playbackRate = THREE.MathUtils.clamp(baseP * (0.72 + revNorm * 0.92), 0.65, 1.82);
    if (this.source && this.source.playbackRate) {
      this.source.playbackRate.setTargetAtTime(playbackRate, t, 0.045);
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

    // 1. Realistik Idle (to'xtab turganda sokin, chuqur inomarka g'o'ldirashi)
    const cyl = spec?.cylinderCount || 4;
    const isStandstill = kmh < 3.5 && throttle < 0.08;
    const lopeHz = cyl >= 8 ? 10.5 : cyl >= 6 ? 13.5 : 16.0;
    const lopeDepth = isStandstill ? (cyl >= 8 ? 0.08 : 0.04) : 0;
    const idlePulse = 1 + Math.sin(t * lopeHz) * lopeDepth;

    // 2. Launch Torque Growl (joyidan qo'zg'alganda chuqur tortish)
    const launchBoost = kmh < 42 && throttle > 0.2 ? (1 - kmh / 42) * throttle * 0.38 : 0;

    // 3. Engine Braking (gazni qo'yib yuborganda silliq tushish)
    const decelOverrun = throttle < 0.05 && kmh > 18 ? Math.min(0.20, (kmh / 200) * (braking ? 1.1 : 0.65)) : 0;

    const idleFactor = Math.max(0, 1 - kmh / 20) * (1 - throttle * 0.7);
    this.idleGain.gain.setTargetAtTime((0.35 + idleFactor * 0.45 + launchBoost * 0.4) * idlePulse, t, 0.05);
    this.midGain.gain.setTargetAtTime(0, t, 0.05);
    this.highGain.gain.setTargetAtTime(0, t, 0.05);

    // Sub-bass: gaz bosganda va past tezlikda chuqur glushitel bassi
    const bassDb = 3.5 + currentLoad * 4.2 + launchBoost * 3.5 + (cyl >= 8 ? 1.8 : 0);
    this.subBass.gain.setTargetAtTime(bassDb, t, 0.06);

    // Dynamic lowpass: pastda bo'g'ilmaydi (460Hz+), gazda to'liq ochiladi (5600Hz gacha)
    const minHz = Math.max(460, prof.filterBase * 1.9);
    const maxHz = Math.min(6200, prof.filterMax * 1.45);
    const filterHz = THREE.MathUtils.clamp(
      minHz + currentRpm * (maxHz - minHz) * (0.35 + 0.65 * currentLoad) + launchBoost * 650,
      minHz,
      maxHz
    );
    this.dynamicFilter.frequency.setTargetAtTime(filterHz, t, 0.05);

    const hybridIceAtten = isHybrid && kmh < 22 && throttle < 0.3 ? 0.5 : 1.0;
    const baseVol =
      (0.068 + currentLoad * 0.14 + currentRpm * 0.055 + launchBoost * 0.05 + decelOverrun * 0.025) *
      idlePulse *
      (prof.gainMul || 1.0) *
      hybridIceAtten;
    this.engineGain.gain.setTargetAtTime(baseVol, t, 0.05);

    this.intakeFilter.frequency.setTargetAtTime(340 + currentRpm * 1650, t, 0.05);
    this.intakeGain.gain.setTargetAtTime(currentLoad * currentRpm * 0.028, t, 0.05);
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

function triggerPop(intensity = 0.5) {
  const popFiles = ['audio/common/pop_1.wav', 'audio/common/pop_2.wav', 'audio/common/pop_3.wav'];
  const chosen = popFiles[Math.floor(Math.random() * popFiles.length)];
  playOneShot(chosen, Math.min(0.11, 0.08 * intensity), 0.92 + Math.random() * 0.16);
}

function triggerBlowOff(intensity = 0.5) {
  playOneShot('audio/common/blowoff.wav', Math.min(0.11, 0.09 * intensity), 1.0 + Math.random() * 0.12);
}

function triggerShiftSound() {
  playOneShot('audio/common/shift.wav', 0.08, 0.96 + Math.random() * 0.08);
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
  skidBp.frequency.value = 1150;
  skidBp.Q.value = 2.4;
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
  const soundKey = (opts.soundOverride && SOUND_PROFILES[opts.soundOverride])
    ? opts.soundOverride
    : (spec && spec.audioProfile && SOUND_PROFILES[spec.audioProfile])
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

  // Mechanical gear shift only for ICE/Hybrid vehicles (paqillashsiz, silliq DCT/ZF8 uzatma)
  if (!isEV && gear !== lastGear && kmh > 18) {
    triggerShiftSound();
    if (gear > lastGear && throttle > 0.3) {
      currentRpm = Math.max(0.24, currentRpm - 0.14);
    } else if (gear < lastGear && braking) {
      currentRpm = Math.min(0.88, currentRpm + 0.11);
    }
    lastGear = gear;
  }

  // Turbo blow-off & kamdan-kam yumshoq sport burble (faqat juda yuqori tezlik/RPM da, asabga tegmaydi!)
  popCooldown = Math.max(0, popCooldown - dt);
  if (!isEV && lastThrottle > 0.65 && throttle === 0 && popCooldown <= 0) {
    if (prof.turbo && kmh > 70 && currentRpm > 0.68) {
      triggerBlowOff(0.5);
      popCooldown = 1.8;
    } else if (prof.burble >= 0.82 && kmh > 110 && currentRpm > 0.82) {
      triggerPop(0.5);
      popCooldown = 3.2;
    }
  }
  lastThrottle = throttle;

  if (localVoice) {
    localVoice.update(rpm, throttle, pitch, kmh, isInterior, prof, spec, braking, dt);
  }

  // Road rolling + wind rush (yumshoq, motor ovozini bosib ketmaydi)
  if (roadGain && roadFilter) {
    const roadVol = kmh > 15 ? Math.min(0.032, ((kmh - 15) / 280) * 0.032) : 0;
    const roadHz = 180 + Math.min(1200, kmh * 4.5);
    roadFilter.frequency.setTargetAtTime(roadHz, ctx.currentTime, 0.08);
    roadGain.gain.setTargetAtTime(roadVol, ctx.currentTime, 0.08);
  }

  // Shina sirpanishi: oddiy tormozda (ABS) shovqin chiqmaydi, faqat kuchli driftda eshitiladi
  if (skidGain) {
    const driftScrub = slip > 0.42 && kmh > 35 ? Math.min(0.14, (slip - 0.42) * 0.25) : 0;
    skidGain.gain.setTargetAtTime(driftScrub, ctx.currentTime, 0.06);
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
    // Spark kabi sintez profillarida (src: null) masofadan jim qolmaslik uchun eng yaqin yozuv ishlatiladi
    const buf = await getAudioBuffer(prof.src || FALLBACK_ENGINE_SRC);
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

// ============================================================================
// AI TRAFIK MASHINALARI (NPC) DVIGATEL OVOZI
// Faqat eng yaqin MAX_TRAFFIC_VOICES ta mashinaga ovoz beriladi (havuz — qayta ishlatiladi).
// Engil 'equalpower' panner, bitta filtr va umumiy dekodlangan bufer: CPU/xotira yuki minimal.
// ============================================================================
const TRAFFIC_GEARS = [0, 26, 56, 92, 136, 188, 420];
const MAX_TRAFFIC_VOICES = 4;
const TRAFFIC_HEAR_DIST = 75;

class TrafficAudioVoice {
  constructor() {
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 6000;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.panner = ctx.createPanner();
    this.panner.panningModel = 'equalpower';
    this.panner.distanceModel = 'inverse';
    this.panner.refDistance = 7;
    this.panner.maxDistance = 90;
    this.panner.rolloffFactor = 1.35;
    this.filter.connect(this.gain);
    this.gain.connect(this.panner);
    this.panner.connect(masterGain);

    this.owner = null;
    this.key = '';
    this.prof = SOUND_PROFILES.gentra_i4;
    this.source = null;
    this.token = 0;
    this.smoothRpm = 0.2;
    this.thr = 0;
    this.lastV = 0;
    this.lastDist = 0;
  }

  _stopSource() {
    if (this.source) {
      try { this.source.stop(); } catch (_) {}
      try { this.source.disconnect(); } catch (_) {}
      this.source = null;
    }
  }

  async _setProfile(key) {
    if (this.key === key && this.source) return;
    this.key = key;
    const token = ++this.token;
    this._stopSource();
    this.prof = SOUND_PROFILES[key] || SOUND_PROFILES.gentra_i4;
    const buf = await getAudioBuffer(this.prof.src || FALLBACK_ENGINE_SRC);
    // Kutish paytida voice boshqa mashinaga berilgan yoki bo'shatilgan bo'lishi mumkin
    if (!buf || !ctx || token !== this.token || !this.owner) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(this.filter);
    src.start();
    this.source = src;
  }

  assign(car, key, x, z) {
    this.owner = car;
    this.smoothRpm = 0.2;
    this.thr = 0;
    this.lastV = Math.abs(car.v || 0);
    this.lastDist = 0;
    const t = ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setValueAtTime(0, t);
    this.panner.positionX.setValueAtTime(x, t);
    this.panner.positionY.setValueAtTime(0.6, t);
    this.panner.positionZ.setValueAtTime(z, t);
    this._setProfile(key);
  }

  release() {
    this.owner = null;
    this.token++;
    this.key = '';
    const t = ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setTargetAtTime(0, t, 0.04);
    // Qisqa fade-outdan keyin manbani to'xtatamiz (CPU tejash)
    const old = this.source;
    this.source = null;
    if (old) {
      setTimeout(() => {
        try { old.stop(); } catch (_) {}
        try { old.disconnect(); } catch (_) {}
      }, 200);
    }
  }

  update(car, dist, dt) {
    if (!this.source) return;
    const t = ctx.currentTime;
    const prof = this.prof;
    const speed = Math.abs(car.v || 0);
    const kmh = speed * 3.6;

    // Tezlanishdan gaz bosilishi miqdori (AI mashinalarda gaz pedali yo'q)
    const accel = (speed - this.lastV) / Math.max(dt, 0.001);
    this.lastV = speed;
    const thrTarget = Math.max(0, Math.min(1, accel / 2.6));
    this.thr += (thrTarget - this.thr) * Math.min(1, dt * 6);

    // Vites asosida RPM (o'yinchi fizikasi bilan bir xil vites chegaralari)
    let g = 1;
    for (let i = 1; i < TRAFFIC_GEARS.length; i++) {
      if (kmh <= TRAFFIC_GEARS[i]) { g = i; break; }
    }
    const gLo = TRAFFIC_GEARS[g - 1] * 0.78;
    const gHi = Math.min(TRAFFIC_GEARS[g], (car.cfg?.maxSpeed || 200) * 1.05);
    const ratio = Math.max(0, Math.min(1, (kmh - gLo) / Math.max(8, gHi - gLo)));
    const targetRpm = kmh < 2 ? 0.18 : Math.max(0.16, Math.min(1, 0.22 + ratio * 0.68 + this.thr * 0.12));
    this.smoothRpm += (targetRpm - this.smoothRpm) * Math.min(1, dt * 9);

    // Doppler (kuzatuvchiga yaqinlashish/uzoqlashish)
    let doppler = 1.0;
    if (this.lastDist > 0 && dt > 0.001) {
      const vRadial = (dist - this.lastDist) / dt;
      doppler = THREE.MathUtils.clamp(1.0 - vRadial / 343.0, 0.84, 1.22);
    }
    this.lastDist = dist;

    const isEV = !!prof.isElectric;
    const rate = isEV
      ? THREE.MathUtils.clamp((0.24 + (kmh / 220) * 1.7) * doppler, 0.2, 2.3)
      : THREE.MathUtils.clamp((prof.pitchMul || 1.0) * (0.64 + this.smoothRpm * 0.98) * doppler, 0.45, 2.25);
    this.source.playbackRate.setTargetAtTime(rate, t, 0.06);

    let vol;
    if (isEV) {
      vol = kmh < 1 ? 0 : 0.05 + Math.min(0.1, kmh / 900);
    } else {
      const hybridAtten = prof.isHybrid && kmh < 20 && this.thr < 0.3 ? 0.55 : 1.0;
      vol = (0.065 + this.thr * 0.07 + this.smoothRpm * 0.05) * (prof.gainMul || 1.0) * hybridAtten;
    }
    // Uzoqda qo'shimcha so'nish (havo yutilishi): yuqori chastotalar kamayadi
    const fade = Math.max(0, 1 - dist / TRAFFIC_HEAR_DIST);
    this.gain.gain.setTargetAtTime(Math.min(0.2, vol) * fade, t, 0.07);
    this.filter.frequency.setTargetAtTime(THREE.MathUtils.clamp(9000 - dist * 95, 900, 9000), t, 0.1);

    this.panner.positionX.setTargetAtTime(car.x || 0, t, 0.05);
    this.panner.positionZ.setTargetAtTime(car.z || 0, t, 0.05);
  }
}

export class TrafficAudioManager {
  constructor() {
    this.voices = [];
    this._cand = [];
    this._top = [];
  }

  _ensureVoices() {
    if (this.voices.length > 0 || !ctx || !masterGain) return;
    for (let i = 0; i < MAX_TRAFFIC_VOICES; i++) this.voices.push(new TrafficAudioVoice());
  }

  // cars === null — barcha ovozlarni o'chirish (masalan klub ichida)
  update(cars, listenerPos, dt, camera = null) {
    if (!ctx || !isStarted || !masterGain) return;
    this._ensureVoices();
    const voices = this.voices;

    if (!cars || !isEngineRunning) {
      for (let i = 0; i < voices.length; i++) if (voices[i].owner) voices[i].release();
      return;
    }

    remoteAudio.updateListener(camera, listenerPos);

    const cand = this._cand;
    cand.length = 0;
    const lx = listenerPos.x || 0;
    const lz = listenerPos.z || 0;
    const maxD2 = TRAFFIC_HEAR_DIST * TRAFFIC_HEAR_DIST;
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      if (!c || !c.model || !c.model.group.visible) continue;
      const dx = c.x - lx;
      const dz = c.z - lz;
      const d2 = dx * dx + dz * dz;
      if (d2 > maxD2) continue;
      c._audDist = Math.sqrt(d2);
      cand.push(c);
    }
    cand.sort((a, b) => a._audDist - b._audDist);

    const top = this._top;
    top.length = 0;
    const n = Math.min(MAX_TRAFFIC_VOICES, cand.length);
    for (let i = 0; i < n; i++) top.push(cand[i]);

    // 1) Endi eng yaqin ro'yxatda yo'q mashinalarning ovozini bo'shatish
    for (let i = 0; i < voices.length; i++) {
      const v = voices[i];
      if (v.owner && top.indexOf(v.owner) === -1) v.release();
    }
    // 2) Yangi yaqinlashgan mashinalarga bo'sh ovoz berish va barchasini yangilash
    for (let i = 0; i < top.length; i++) {
      const car = top[i];
      let v = null;
      for (let j = 0; j < voices.length; j++) {
        if (voices[j].owner === car) { v = voices[j]; break; }
      }
      if (!v) {
        for (let j = 0; j < voices.length; j++) {
          if (!voices[j].owner) { v = voices[j]; break; }
        }
        if (!v) continue;
        const spec = getEngineSpec(car.cfg?.id);
        const key = (spec && spec.audioProfile && SOUND_PROFILES[spec.audioProfile]) ? spec.audioProfile : 'gentra_i4';
        v.assign(car, key, car.x, car.z);
      }
      v.update(car, car._audDist, dt);
    }
  }

  disposeAll() {
    for (const v of this.voices) {
      v.owner = null;
      v.token++;
      v._stopSource();
      try { v.panner.disconnect(); } catch (_) {}
    }
    this.voices.length = 0;
  }
}

export const trafficAudio = new TrafficAudioManager();
