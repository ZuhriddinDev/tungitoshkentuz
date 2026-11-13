// ============================================================================
// KOKOBANGO CLUB — GTA V USLUBIDAGI HASHAMATLI TUNGI KLUB (EKSTERYER, INTERYER,
// NPC RAQQOSALAR / DJ / XAVFSIZLIK / BARMENLAR VA JONLI DJ MUSIQA TIZIMI)
// ============================================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { BLOCK, blockC, addCollider } from './layout.js';
import { buildCar } from '../carModel.js';
import { CARS } from '../config.js';
import {
  createMarblePBR,
  createQuiltedVelvetTex,
  createDetailedSofa,
  createDetailedBarStool,
  createSpeakerStack,
  createDetailedVipTable,
} from './kokobangoAssets.js';

const clubDraco = new DRACOLoader();
clubDraco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/draco/gltf/');
const clubGlbLoader = new GLTFLoader();
clubGlbLoader.setDRACOLoader(clubDraco);
clubGlbLoader.setMeshoptDecoder(MeshoptDecoder);

const CLUB_BLOCK_J = 8;
const CLUB_BLOCK_K = 7;
const INTERIOR_Y = -120;

// Web Audio 126 BPM Club Beat Synthesizer (tashqi faylsiz, 0 kechikish, real-vaqt ritm)
class ClubMusicEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.playing = false;
    this.bpm = 126;
    this.stepDur = 60 / this.bpm / 4; // 16-talik nota
    this.nextStepTime = 0;
    this.step = 0;
    this.beatPulse = 0;
    this.lastBeatTime = 0;
    this.timer = null;
    this.volume = 0.75;
    this.targetVol = 0.75;
    this.muted = false;
    this.crowdSrc = null;
    this.zone = 'main';
  }

  setZone(z) {
    if (this.zone === z) return;
    this.zone = z;
    this.stepDur = z === 'rooftop' ? 0.144 : z === 'vip' ? 0.127 : 0.117;
  }

  toggleMute() {
    this.muted = !this.muted;
    this.setVolume(this.volume);
    return this.muted;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.volume > 0) this.targetVol = this.volume;
    const zoneGain = this.zone === 'rooftop' ? 0.42 : this.zone === 'vip' ? 0.52 : 0.65;
    const eff = this.muted ? 0.0001 : this.volume * zoneGain;
    if (this.master && this.ctx && this.playing) {
      this.master.gain.setTargetAtTime(eff, this.ctx.currentTime, 0.08);
    }
  }

  start() {
    if (this.playing) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!this.ctx) {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.0001;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    this.playing = true;
    this.step = 0;
    this.nextStepTime = this.ctx.currentTime + 0.05;
    this.master.gain.setTargetAtTime(this.volume * 0.65, this.ctx.currentTime, 0.25);

    this.timer = setInterval(() => this._schedule(), 40);
  }

  stop() {
    if (!this.playing) return;
    this.playing = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.15);
    }
    this.beatPulse = 0;
  }

  _schedule() {
    if (!this.playing || !this.ctx) return;
    const lookAhead = 0.14;
    while (this.nextStepTime < this.ctx.currentTime + lookAhead) {
      this._triggerStep(this.step, this.nextStepTime);
      this.nextStepTime += this.stepDur;
      this.step = (this.step + 1) % 64;
    }
  }

  _triggerStep(s, t) {
    const ctx = this.ctx;
    const stepInBar = s % 16;

    // 1. 4-on-the-floor Kick (0, 4, 8, 12)
    if (stepInBar % 4 === 0) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(135, t);
      osc.frequency.exponentialRampToValueAtTime(42, t + 0.11);
      g.gain.setValueAtTime(0.95, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.3);
      this.lastBeatTime = performance.now();
    }

    // 2. Clap (4, 12)
    if (stepInBar === 4 || stepInBar === 12) {
      const len = Math.floor(ctx.sampleRate * 0.14);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.25));
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1400;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.38, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.master);
      src.start(t);
    }

    // 3. Off-beat Hi-Hat (2, 6, 10, 14) + 16th ghost hats
    if (stepInBar % 2 === 0) {
      const open = stepInBar % 4 === 2;
      const len = Math.floor(ctx.sampleRate * (open ? 0.09 : 0.035));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.35));
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 6500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(open ? 0.22 : 0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.09 : 0.035));
      src.connect(hp);
      hp.connect(g);
      g.connect(this.master);
      src.start(t);
    }

    // 4. Rolling Club Sub-Bassline (F#m -> D -> E -> C#m)
    const bassNotes = [46.25, 46.25, 36.71, 41.20]; // F#1, F#1, D1, E1
    const bar = Math.floor(s / 16);
    if (stepInBar % 2 === 1 || stepInBar === 0) {
      const f = bassNotes[bar] * (stepInBar === 14 ? 1.5 : 1.0);
      const osc = ctx.createOscillator();
      const flt = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t);
      flt.type = 'lowpass';
      flt.frequency.setValueAtTime(380, t);
      flt.frequency.exponentialRampToValueAtTime(110, t + 0.12);
      g.gain.setValueAtTime(stepInBar % 4 === 0 ? 0.16 : 0.34, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(flt);
      flt.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.15);
    }

    // 5. Atmospheric Club Synth Pluck / Arpeggio
    if (stepInBar === 0 || stepInBar === 3 || stepInBar === 6 || stepInBar === 10 || stepInBar === 12) {
      const arpScale = [
        [185.0, 220.0, 277.18, 369.99],
        [185.0, 220.0, 277.18, 329.63],
        [146.83, 185.0, 220.0, 293.66],
        [164.81, 207.65, 246.94, 329.63],
      ];
      const chord = arpScale[bar];
      const freq = chord[(stepInBar + bar) % chord.length];
      const osc = ctx.createOscillator();
      const flt = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      flt.type = 'lowpass';
      flt.frequency.setValueAtTime(1900, t);
      flt.frequency.exponentialRampToValueAtTime(420, t + 0.24);
      g.gain.setValueAtTime(0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      osc.connect(flt);
      flt.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.27);
    }
  }

  getBeatPulse() {
    if (!this.playing) return 0;
    const elapsed = (performance.now() - this.lastBeatTime) / 1000;
    this.beatPulse = Math.max(0, 1 - elapsed * 3.2);
    return this.beatPulse;
  }
}

// Neon yorliq teksturasi (KOKOBANGO CLUB, EXIT, WC)
function makeSignTexture(text, sub = '', bg = '#090616', fg = '#e879f9', accent = '#00e5ff', w = 1024, h = 256) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);

  // Ramka neon chizig'i
  g.strokeStyle = accent;
  g.lineWidth = 10;
  g.strokeRect(12, 12, w - 24, h - 24);
  g.strokeStyle = fg;
  g.lineWidth = 4;
  g.strokeRect(24, 24, w - 48, h - 48);

  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = fg;
  g.shadowBlur = 24;
  g.fillStyle = '#ffffff';
  g.font = `900 ${sub ? Math.round(h * 0.36) : Math.round(h * 0.45)}px "Segoe UI", Arial, sans-serif`;
  g.fillText(text, w / 2, sub ? h * 0.40 : h * 0.5);

  if (sub) {
    g.shadowColor = accent;
    g.shadowBlur = 14;
    g.fillStyle = accent;
    g.font = `700 ${Math.round(h * 0.16)}px "Segoe UI", Arial, sans-serif`;
    g.fillText(sub, w / 2, h * 0.74);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Kichik bo'g'imli 3D NPC odamcha yaratuvchi (Raqqosalar, DJ, Qo'riqchi, Barmen, Mehmonlar)
function createClubNpc(opts = {}) {
  const {
    shirt = '#1e1b4b',
    pants = '#0f172a',
    skin = '#e2b49a',
    hair = '#18181b',
    female = false,
    dress = false,
    glasses = false,
    headphones = false,
    sitting = false,
    heels = female,
    hairStyle = 'long', // 'long' | 'bob' | 'updo' | 'ponytail'
    hasGlass = false,
    danceStyle = 0,
    role = 'visitor', // 'dancer' | 'dj' | 'guard' | 'bartender' | 'visitor' | 'walker' | 'hostess'
    phase = Math.random() * Math.PI * 2,
  } = opts;

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const mSkin = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.54 });
  const mShirt = new THREE.MeshStandardMaterial({
    color: shirt,
    roughness: dress ? 0.24 : 0.62,
    metalness: dress ? 0.42 : 0.08,
  });
  const mPants = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.68 });
  const mHair = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.48, metalness: 0.12 });
  const mShoe = new THREE.MeshStandardMaterial({ color: heels ? 0x09090f : 0x111116, roughness: 0.25, metalness: 0.45 });
  const mGoldAcc = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.88, roughness: 0.2 });

  const hips = new THREE.Group();
  hips.position.y = sitting ? 0.52 : (heels ? 0.96 : 0.92);
  body.add(hips);

  // Gavda (Torso) — katta yoshli tabiiy proporsiyalar
  const torsoW = female ? 0.28 : 0.38;
  const torso = new THREE.Mesh(
    female ? new THREE.CylinderGeometry(0.145, 0.115, 0.48, 12) : new THREE.BoxGeometry(torsoW, 0.52, 0.20),
    mShirt
  );
  torso.position.y = 0.28;
  if (female) torso.scale.set(1.08, 1, 0.78);
  hips.add(torso);

  if (dress) {
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.215, 0.36, 14), mShirt);
    skirt.position.y = -0.06;
    skirt.scale.set(1.02, 1, 0.85);
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.122, 0.015, 6, 16), mGoldAcc);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.08;
    hips.add(skirt, belt);
  }

  // Bosh va yuz detallari
  const head = new THREE.Group();
  head.position.y = 0.61;
  hips.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.122, 14, 12), mSkin);
  skull.scale.set(0.90, 1.05, 0.94);
  head.add(skull);

  if (female) {
    const lip = new THREE.Mesh(
      new THREE.BoxGeometry(0.042, 0.014, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xbe123c, roughness: 0.3 })
    );
    lip.position.set(0, -0.045, 0.108);
    head.add(lip);
  }

  // Soch turlari
  const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), mHair);
  hairTop.position.y = 0.02;
  head.add(hairTop);
  if (female) {
    if (hairStyle === 'long') {
      const hairBack = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.135, 0.34, 10), mHair);
      hairBack.position.set(0, -0.09, -0.075);
      hairBack.scale.set(1.0, 1, 0.58);
      head.add(hairBack);
    } else if (hairStyle === 'bob') {
      const hairBob = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.135, 0.18, 10), mHair);
      hairBob.position.set(0, -0.03, -0.03);
      hairBob.scale.set(1.05, 1, 0.85);
      head.add(hairBob);
    } else if (hairStyle === 'updo') {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), mHair);
      bun.position.set(0, 0.12, -0.07);
      head.add(bun);
    } else if (hairStyle === 'ponytail') {
      const pony = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.022, 0.28, 8), mHair);
      pony.position.set(0, 0.01, -0.14);
      pony.rotation.x = 0.35;
      head.add(pony);
    }
  }
  if (glasses) {
    const gl = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.045, 0.05), new THREE.MeshStandardMaterial({ color: 0x050508, metalness: 0.9, roughness: 0.1 }));
    gl.position.set(0, 0.015, 0.11);
    head.add(gl);
  }
  if (headphones) {
    const mHp = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 0.6, metalness: 0.8 });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.018, 6, 14, Math.PI), mHp);
    band.position.y = 0.02;
    head.add(band);
    for (const sx of [-1, 1]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.035, 10), mHp);
      cup.rotation.z = Math.PI / 2;
      cup.position.set(sx * 0.14, 0, 0);
      head.add(cup);
    }
  }

  // Qo'llar
  const makeArm = (sx) => {
    const sh = new THREE.Group();
    sh.position.set(sx * (torsoW / 2 + 0.06), 0.50, 0);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.22, 4, 8), mShirt);
    upper.position.y = -0.14;
    sh.add(upper);
    const el = new THREE.Group();
    el.position.y = -0.26;
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.20, 4, 8), mSkin);
    fore.position.y = -0.12;
    el.add(fore);
    sh.add(el);
    hips.add(sh);
    return { sh, el };
  };
  const armL = makeArm(-1);
  const armR = makeArm(1);

  if (hasGlass) {
    const glassStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.015, 0.11, 8),
      new THREE.MeshStandardMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.72, roughness: 0.1 })
    );
    glassStem.position.set(0, -0.24, 0.04);
    armR.el.add(glassStem);
  }

  // Oyoqlar va poshnali oyoq kiyim
  const makeLeg = (sx) => {
    const hip = new THREE.Group();
    hip.position.set(sx * 0.088, -0.02, 0);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(female ? 0.056 : 0.06, 0.32, 4, 8), dress ? mSkin : mPants);
    thigh.position.y = -0.20;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.40;
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(female ? 0.044 : 0.05, 0.32, 4, 8), dress ? mSkin : mPants);
    shin.position.y = -0.20;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.055, 0.18), mShoe);
    shoe.position.set(0, -0.42, 0.04);
    knee.add(shin, shoe);
    if (heels) {
      const heelSpike = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.006, 0.08, 6), mShoe);
      heelSpike.position.set(0, -0.46, -0.03);
      knee.add(heelSpike);
    }
    hip.add(knee);
    hips.add(hip);
    return { hip, knee };
  };
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  if (sitting) {
    legL.hip.rotation.x = -1.35;
    legR.hip.rotation.x = -1.35;
    legL.knee.rotation.x = 1.35;
    legR.knee.rotation.x = 1.35;
  }

  return {
    root,
    body,
    hips,
    head,
    armL,
    armR,
    legL,
    legR,
    role,
    phase,
    sitting,
    danceStyle,
    aiState: role === 'walker' ? 'WALKING' : role.toUpperCase(),
    walkSpeed: role === 'walker' ? 1.45 : 0,
    wpIdx: 0,
    update(dt, t, beatPulse = 0) {
      const p = t * 4.2 + this.phase;
      const baseH = this.sitting ? 0.52 : (heels ? 0.96 : 0.92);
      const isDancingNow = this.role === 'dancer' || (this.role === 'walker' && this.aiState === 'DANCING');
      const isTalkingNow = this.role === 'walker' && this.aiState === 'TALKING';
      if (isDancingNow) {
        const b = Math.sin(t * 6.6 + this.phase);
        const b2 = Math.cos(t * 3.3 + this.phase);
        const style = this.danceStyle % 3;
        this.hips.position.y = baseH - 0.02 + Math.abs(b) * 0.048 + beatPulse * 0.03;
        this.hips.rotation.y = b2 * (style === 1 ? 0.36 : 0.22);
        this.hips.rotation.z = b * (style === 2 ? 0.11 : 0.07);
        this.head.rotation.x = Math.sin(t * 6.6 + this.phase) * 0.14;
        if (style === 0) {
          this.armL.sh.rotation.x = -0.95 + b * 0.55;
          this.armL.sh.rotation.z = -0.42 + b2 * 0.25;
          this.armL.el.rotation.x = -0.75 + Math.cos(t * 6.6) * 0.35;
          this.armR.sh.rotation.x = -0.95 + Math.cos(t * 6.6 + this.phase) * 0.55;
          this.armR.sh.rotation.z = 0.42 - b2 * 0.25;
          this.armR.el.rotation.x = -0.75 + b * 0.35;
        } else if (style === 1) {
          this.armL.sh.rotation.x = -2.1 + b * 0.35;
          this.armL.sh.rotation.z = -0.3;
          this.armL.el.rotation.x = -0.4 + b2 * 0.25;
          this.armR.sh.rotation.x = -0.6 + b2 * 0.4;
          this.armR.el.rotation.x = -0.95;
        } else {
          this.armL.sh.rotation.x = -0.55 + b2 * 0.3;
          this.armL.el.rotation.x = -1.05;
          this.armR.sh.rotation.x = -1.85 + b * 0.45;
          this.armR.el.rotation.x = -0.55;
        }
        this.legL.hip.rotation.x = b * 0.18;
        this.legR.hip.rotation.x = -b * 0.18;
        this.legL.knee.rotation.x = Math.max(0, -b * 0.28);
        this.legR.knee.rotation.x = Math.max(0, b * 0.28);
      } else if (isTalkingNow) {
        this.hips.position.y = baseH + Math.sin(t * 2.2 + this.phase) * 0.015;
        this.head.rotation.y = Math.sin(t * 1.4 + this.phase) * 0.28;
        this.head.rotation.x = Math.sin(t * 2.8 + this.phase) * 0.08;
        this.armR.sh.rotation.x = -0.55 + Math.sin(t * 3.1 + this.phase) * 0.24;
        this.armR.el.rotation.x = -0.82;
        this.armL.sh.rotation.x = -0.25 + Math.cos(t * 2.1 + this.phase) * 0.12;
        this.legL.hip.rotation.x = 0;
        this.legR.hip.rotation.x = 0;
      } else if (this.role === 'hostess') {
        this.hips.position.y = baseH + Math.sin(t * 2.0 + this.phase) * 0.012;
        this.head.rotation.y = Math.sin(t * 0.8 + this.phase) * 0.25;
        this.armR.sh.rotation.x = -0.45 + Math.sin(t * 1.6 + this.phase) * 0.18;
        this.armR.el.rotation.x = -0.65;
        this.armL.sh.rotation.x = -0.22;
      } else if (this.role === 'dj') {
        const b = Math.sin(t * 6.6);
        this.hips.position.y = 0.92 + Math.abs(b) * 0.03 + beatPulse * 0.02;
        this.head.rotation.x = b * 0.18;
        this.head.rotation.y = Math.sin(t * 1.4) * 0.22;
        // Bir qo'l mikserda, ikkinchi qo'l ritm bilan ko'tariladi
        const hype = Math.sin(t * 0.7) > 0.45;
        this.armL.sh.rotation.x = hype ? -2.4 + Math.sin(t * 6.6) * 0.25 : -0.85;
        this.armL.el.rotation.x = hype ? -0.35 : -0.65 + Math.sin(t * 8) * 0.15;
        this.armR.sh.rotation.x = -0.85;
        this.armR.el.rotation.x = -0.65 + Math.cos(t * 9) * 0.18;
      } else if (this.role === 'bartender') {
        this.hips.position.y = 0.92 + Math.sin(p * 0.5) * 0.01;
        this.armL.sh.rotation.x = -0.65 + Math.sin(t * 3.5 + this.phase) * 0.22;
        this.armL.el.rotation.x = -0.65;
        this.armR.sh.rotation.x = -0.85 + Math.cos(t * 5.2 + this.phase) * 0.25;
        this.armR.el.rotation.x = -0.85 + Math.sin(t * 7.5) * 0.2;
        this.head.rotation.y = Math.sin(t * 0.9 + this.phase) * 0.25;
      } else if (this.role === 'guard') {
        this.hips.position.y = 0.92 + Math.sin(t * 1.6 + this.phase) * 0.008;
        this.head.rotation.y = Math.sin(t * 0.55 + this.phase) * 0.28;
        this.armL.sh.rotation.x = -0.25;
        this.armL.sh.rotation.z = 0.15;
        this.armL.el.rotation.x = -0.55;
        this.armR.sh.rotation.x = -0.25;
        this.armR.sh.rotation.z = -0.15;
        this.armR.el.rotation.x = -0.55;
      } else if (this.sitting) {
        this.head.rotation.y = Math.sin(t * 0.9 + this.phase) * 0.22;
        this.head.rotation.x = Math.sin(t * 2.1 + this.phase) * 0.06;
        this.armR.sh.rotation.x = -0.55 + Math.sin(t * 1.8 + this.phase) * 0.15;
        this.armR.el.rotation.x = -0.85;
        this.armL.sh.rotation.x = -0.25;
        this.armL.el.rotation.x = -0.55;
      } else if (this.role === 'walker') {
        const w = t * 5.2 + this.phase;
        this.hips.position.y = 0.92 + Math.abs(Math.sin(w)) * 0.03;
        this.legL.hip.rotation.x = Math.sin(w) * 0.42;
        this.legR.hip.rotation.x = -Math.sin(w) * 0.42;
        this.legL.knee.rotation.x = Math.max(0, -Math.cos(w) * 0.4);
        this.legR.knee.rotation.x = Math.max(0, Math.cos(w) * 0.4);
        this.armL.sh.rotation.x = -Math.sin(w) * 0.35;
        this.armR.sh.rotation.x = Math.sin(w) * 0.35;
      } else {
        // Standing & talking visitor
        this.hips.position.y = 0.92 + Math.sin(t * 2.2 + this.phase) * 0.015;
        this.head.rotation.y = Math.sin(t * 1.1 + this.phase) * 0.25;
        this.armR.sh.rotation.x = -0.45 + Math.sin(t * 2.6 + this.phase) * 0.22;
        this.armR.el.rotation.x = -0.75;
        this.armL.sh.rotation.x = -0.15;
      }
    },
  };
}

export function buildKokobangoClub(scene) {
  const cx = blockC(CLUB_BLOCK_J);
  const cz = blockC(CLUB_BLOCK_K);

  const exteriorGroup = new THREE.Group();
  exteriorGroup.name = 'KokobangoExterior';
  scene.add(exteriorGroup);

  const interiorGroup = new THREE.Group();
  interiorGroup.name = 'KokobangoInterior';
  interiorGroup.visible = false;
  scene.add(interiorGroup);

  const music = new ClubMusicEngine();

  // ========================================================================
  // 1. EKSTERYER — HASHAMATLI TUNGI KLUB BINOSI, VIP PARKOVKA VA MASHINALAR
  // ========================================================================
  const mDarkWall = new THREE.MeshStandardMaterial({ color: 0x101320, roughness: 0.42, metalness: 0.45 });
  const mObsidian = new THREE.MeshStandardMaterial({ color: 0x070912, roughness: 0.28, metalness: 0.65 });
  const mGlass = new THREE.MeshStandardMaterial({ color: 0x16223d, roughness: 0.08, metalness: 0.92, transparent: true, opacity: 0.72 });
  const mGold = new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.25, metalness: 0.9 });
  const mMarble = new THREE.MeshStandardMaterial({ color: 0x1b1d28, roughness: 0.25, metalness: 0.35 });
  const mCarpet = new THREE.MeshStandardMaterial({ color: 0x6d1148, roughness: 0.85 });
  const mNeonPurple = new THREE.MeshStandardMaterial({ color: 0xd946ef, emissive: 0xd946ef, emissiveIntensity: 2.8, roughness: 0.2 });
  const mNeonCyan = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 2.6, roughness: 0.2 });
  const mNeonPink = new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xf43f5e, emissiveIntensity: 2.8, roughness: 0.2 });

  // Asosiy bino korpusi (76m kenglik x 60m chuqurlik x 18m balandlik, z = cz - 24 .. cz + 36)
  const bCenterZ = cz + 6;
  const mainBody = new THREE.Mesh(new THREE.BoxGeometry(76, 18, 60), mDarkWall);
  mainBody.position.set(cx, 9, bCenterZ);
  mainBody.castShadow = true;
  mainBody.receiveShadow = true;
  exteriorGroup.add(mainBody);
  addCollider(cx - 38, bCenterZ - 30, cx + 38, bCenterZ + 30, 'building');

  // Yuqori me'moriy qavat / Toj (crown)
  const roofTier = new THREE.Mesh(new THREE.BoxGeometry(64, 4.5, 48), mObsidian);
  roofTier.position.set(cx, 20.25, bCenterZ);
  exteriorGroup.add(roofTier);

  // Old fasad bo'ylab vertikal bezak ustunlari va neon chiziqlar
  for (let x = -34; x <= 34; x += 6.8) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.9, 18.2, 1.4), mObsidian);
    fin.position.set(cx + x, 9.1, cz - 24.4);
    exteriorGroup.add(fin);
    if (Math.abs(x) > 8) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 16.5, 0.25), Math.abs(x) % 2 < 1 ? mNeonPurple : mNeonCyan);
      strip.position.set(cx + x, 9.2, cz - 25.15);
      exteriorGroup.add(strip);
    }
  }

  // Gorizontal neon karniz chiziqlari
  const topTrim = new THREE.Mesh(new THREE.BoxGeometry(76.6, 0.45, 60.6), mNeonCyan);
  topTrim.position.set(cx, 18.1, bCenterZ);
  exteriorGroup.add(topTrim);
  const midTrim = new THREE.Mesh(new THREE.BoxGeometry(76.4, 0.32, 60.4), mNeonPurple);
  midTrim.position.set(cx, 11.5, bCenterZ);
  exteriorGroup.add(midTrim);

  // Katta yorug' "KOKOBANGO CLUB" fasad peshtaxtasi
  const marqueeTex = makeSignTexture('KOKOBANGO CLUB', 'EXCLUSIVE NIGHTLIFE · TASHKENT', '#0a0518', '#e879f9', '#00e5ff', 1024, 256);
  const marqueeMat = new THREE.MeshBasicMaterial({ map: marqueeTex });
  const marqueeBox = new THREE.Mesh(new THREE.BoxGeometry(28, 6.2, 1.4), mObsidian);
  marqueeBox.position.set(cx, 14.5, cz - 25.0);
  exteriorGroup.add(marqueeBox);
  const marqueeFace = new THREE.Mesh(new THREE.PlaneGeometry(27.2, 5.6), marqueeMat);
  marqueeFace.position.set(cx, 14.5, cz - 25.75);
  marqueeFace.rotation.y = Math.PI; // -Z shimolga qaraydi
  exteriorGroup.add(marqueeFace);

  // 2 ta tashqi LED ekran (kirish eshiklarining ikki yonida)
  const extLedCanvas = document.createElement('canvas');
  extLedCanvas.width = 512;
  extLedCanvas.height = 256;
  const extLedCtx = extLedCanvas.getContext('2d');
  const extLedTex = new THREE.CanvasTexture(extLedCanvas);
  extLedTex.colorSpace = THREE.SRGBColorSpace;
  const extLedMat = new THREE.MeshBasicMaterial({ map: extLedTex });
  for (const sx of [-1, 1]) {
    const scrFrame = new THREE.Mesh(new THREE.BoxGeometry(11.6, 5.8, 0.6), mObsidian);
    scrFrame.position.set(cx + sx * 19, 6.5, cz - 24.5);
    exteriorGroup.add(scrFrame);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(11.0, 5.2), extLedMat);
    scr.position.set(cx + sx * 19, 6.5, cz - 24.85);
    scr.rotation.y = Math.PI;
    exteriorGroup.add(scr);
  }

  // Kirish shisha eshiklari va keng marmar zinapoya / platforma
  const platform = new THREE.Mesh(new THREE.BoxGeometry(18, 0.72, 9), mMarble);
  platform.position.set(cx, 0.36, cz - 28.5);
  exteriorGroup.add(platform);
  for (let st = 0; st < 3; st++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(16 + st * 1.2, 0.24, 1.4), mMarble);
    step.position.set(cx, 0.12 + (2 - st) * 0.24, cz - 33.4 - st * 1.1);
    exteriorGroup.add(step);
  }
  const carpet = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.04, 11.5), mCarpet);
  carpet.position.set(cx, 0.74, cz - 30.2);
  exteriorGroup.add(carpet);

  // Shisha kirish portali, soyabon (Canopy) va animatsiyali surilma eshiklar
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(15.2, 0.65, 7.2), mObsidian);
  canopy.position.set(cx, 5.4, cz - 27.4);
  exteriorGroup.add(canopy);
  const canopyNeon = new THREE.Mesh(new THREE.BoxGeometry(15.4, 0.18, 7.4), mNeonPurple);
  canopyNeon.position.set(cx, 5.15, cz - 27.4);
  exteriorGroup.add(canopyNeon);

  // Kirish soyaboni ostidagi me'moriy oltin boshliqli ustunlar
  for (const sx of [-1, 1]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 5.2, 16), mMarble);
    col.position.set(cx + sx * 6.4, 2.95, cz - 29.8);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.4, 0.35, 16), mGold);
    cap.position.set(cx + sx * 6.4, 5.15, cz - 29.8);
    exteriorGroup.add(col, cap);
  }

  // Ko'p qavatli shisha fasad va ichki yorug'lik chuqurligi
  for (const sx of [-1, 1]) {
    const glassBay = new THREE.Mesh(new THREE.BoxGeometry(11.4, 7.5, 0.35), mGlass);
    glassBay.position.set(cx + sx * 19, 12.6, cz - 24.1);
    const innerGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(10.6, 6.8),
      new THREE.MeshBasicMaterial({ color: sx < 0 ? 0x3b0764 : 0x083344 })
    );
    innerGlow.position.set(cx + sx * 19, 12.6, cz - 23.85);
    innerGlow.rotation.y = Math.PI;
    exteriorGroup.add(glassBay, innerGlow);
  }

  const glassPortal = new THREE.Mesh(new THREE.BoxGeometry(10.4, 4.6, 0.3), mGlass);
  glassPortal.position.set(cx, 2.9, cz - 24.2);
  exteriorGroup.add(glassPortal);
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(5.6, 3.8, 0.35), mNeonCyan);
  doorFrame.position.set(cx, 2.5, cz - 24.3);
  exteriorGroup.add(doorFrame);

  const doorLeft = new THREE.Mesh(new THREE.BoxGeometry(2.3, 3.4, 0.38), mGlass);
  doorLeft.position.set(cx - 1.15, 2.4, cz - 24.35);
  const doorRight = new THREE.Mesh(new THREE.BoxGeometry(2.3, 3.4, 0.38), mGlass);
  doorRight.position.set(cx + 1.15, 2.4, cz - 24.35);
  exteriorGroup.add(doorLeft, doorRight);

  // Obodonlashtirish: ko'cha daraxtlari, gulzorlar va zamonaviy skameykalar
  const mTrunk = new THREE.MeshStandardMaterial({ color: 0x3b2a1e, roughness: 0.9 });
  const mLeaves = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.78 });
  for (const sx of [-1, 1]) {
    for (const tx of [12, 26]) {
      const px = cx + sx * tx;
      const pz = cz - 33.5;
      const planter = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.55, 2.4), mMarble);
      planter.position.set(px, 0.52, pz);
      const pRing = new THREE.Mesh(new THREE.BoxGeometry(2.46, 0.08, 2.46), mNeonCyan);
      pRing.position.set(px, 0.82, pz);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 2.6, 8), mTrunk);
      trunk.position.set(px, 1.9, pz);
      const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(1.35, 1), mLeaves);
      crown.position.set(px, 3.5, pz);
      exteriorGroup.add(planter, pRing, trunk, crown);
    }
    const bench = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.45, 0.9), mObsidian);
    bench.position.set(cx + sx * 19, 0.48, cz - 34.0);
    const benchGlow = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.06, 0.8), mNeonPurple);
    benchGlow.position.set(cx + sx * 19, 0.26, cz - 34.0);
    exteriorGroup.add(bench, benchGlow);
  }

  // Qizil/binafsha VIP to'siq ustunchalari (Velvet ropes)
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 1.0, 10), mGold);
      post.position.set(cx + sx * 2.8, 1.2, cz - 26.5 - k * 2.8);
      exteriorGroup.add(post);
    }
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 5.6, 8), mCarpet);
    rope.rotation.x = Math.PI / 2;
    rope.position.set(cx + sx * 2.8, 1.5, cz - 29.3);
    exteriorGroup.add(rope);
  }

  // VIP Parkovka maydoni (shimol tomonda, roadC(7) ga qaragan)
  const parkingAsphalt = new THREE.Mesh(
    new THREE.BoxGeometry(92, 0.08, 56),
    new THREE.MeshStandardMaterial({ color: 0x161822, roughness: 0.55, metalness: 0.18 })
  );
  parkingAsphalt.position.set(cx, 0.24, cz - 66);
  parkingAsphalt.receiveShadow = true;
  exteriorGroup.add(parkingAsphalt);

  // Parkovka chiziqlari va yorug' ustunchalar
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xd946ef });
  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue;
    const lx = cx + i * 11;
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 7.5), lineMat);
    line.position.set(lx, 0.29, cz - 55);
    exteriorGroup.add(line);
  }
  for (const sx of [-1, 1]) {
    for (let b = 0; b < 5; b++) {
      const bx = cx + sx * (10 + b * 8);
      const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.95, 8), mObsidian);
      bollard.position.set(bx, 0.7, cz - 38);
      exteriorGroup.add(bollard);
      const bGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.2, 8), mNeonCyan);
      bGlow.position.set(bx, 1.05, cz - 38);
      exteriorGroup.add(bGlow);
    }
  }

  // Klub oldida turgan 6 ta hashamatli VIP superkar + Valet zona
  const parkedSpecs = [
    { id: 'lambo',      x: cx - 28, z: cz - 55, h: 0.22,  color: '#9333ea' },
    { id: 'bmwm8wb',    x: cx - 18, z: cz - 55, h: 0.12,  color: '#111827' },
    { id: 'porsche911', x: cx - 9,  z: cz - 55, h: 0.04,  color: '#f8fafc' },
    { id: 'sf90',       x: cx + 9,  z: cz - 55, h: -0.04, color: '#dc2626' },
    { id: 'mercedes',   x: cx + 18, z: cz - 55, h: -0.12, color: '#0f172a' },
    { id: 'maybach',    x: cx + 28, z: cz - 55, h: -0.22, color: '#1e1b4b' },
  ];
  const parkedCarsGroup = new THREE.Group();
  exteriorGroup.add(parkedCarsGroup);
  const parkedSupercars = [];
  for (const ps of parkedSpecs) {
    const cfg = CARS.find((c) => c.id === ps.id) || CARS[0];
    const car = buildCar(cfg, { color: ps.color, paintType: 'metallic', tint: 'dark', neon: '#d946ef' }, { beam: false });
    car.group.position.set(ps.x, 0.28, ps.z);
    car.group.rotation.set(0, ps.h, 0);
    car.setLights(true);
    parkedCarsGroup.add(car.group);
    addCollider(ps.x - 1.4, ps.z - 2.6, ps.x + 1.4, ps.z + 2.6, 'building');
    parkedSupercars.push({ x: ps.x, z: ps.z, name: cfg.name, tier: cfg.tier, maxSpeed: cfg.maxSpeed });
  }

  // Valet Parking stendi va Valet NPC
  const valetDesk = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.15, 0.8), mObsidian);
  valetDesk.position.set(cx - 5.2, 0.85, cz - 37.5);
  const valetSign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 0.4),
    new THREE.MeshBasicMaterial({ map: makeSignTexture('VALET', 'VIP PARKING', '#0a0518', '#ffd166', '#00e5ff', 256, 96) })
  );
  valetSign.position.set(cx - 5.2, 1.1, cz - 37.92);
  valetSign.rotation.y = Math.PI;
  exteriorGroup.add(valetDesk, valetSign);

  // Tashqi qo'riqchilar, valet va mehmonlar
  const exteriorNpcs = [];
  const valetNpc = createClubNpc({ role: 'guard', shirt: '#7c2d12', pants: '#09090b', glasses: false, phase: 0.7 });
  valetNpc.root.position.set(cx - 4.1, 0.28, cz - 37.2);
  valetNpc.root.rotation.y = Math.PI;
  exteriorGroup.add(valetNpc.root);
  exteriorNpcs.push(valetNpc);
  for (const sx of [-1, 1]) {
    const guard = createClubNpc({ role: 'guard', shirt: '#09090b', pants: '#09090b', glasses: true, phase: sx });
    guard.root.position.set(cx + sx * 3.5, 0.72, cz - 26.2);
    guard.root.rotation.y = Math.PI;
    exteriorGroup.add(guard.root);
    exteriorNpcs.push(guard);
  }
  const extVisitorPos = [
    [cx - 6.5, 0.25, cz - 38, Math.PI * 0.7],
    [cx - 5.2, 0.25, cz - 37.2, -Math.PI * 0.4],
    [cx + 6.2, 0.25, cz - 39, -Math.PI * 0.8],
    [cx + 7.4, 0.25, cz - 38.1, Math.PI * 0.3],
  ];
  extVisitorPos.forEach(([vx, vy, vz, vh], i) => {
    const vis = createClubNpc({
      role: 'visitor',
      female: i % 2 === 1,
      dress: i % 2 === 1,
      shirt: ['#db2777', '#2563eb', '#7c3aed', '#0891b2'][i],
      hair: ['#18181b', '#78350f', '#09090b', '#facc15'][i],
      phase: i * 1.4,
    });
    vis.root.position.set(vx, vy, vz);
    vis.root.rotation.y = vh;
    exteriorGroup.add(vis.root);
    exteriorNpcs.push(vis);
  });

  // Osmon nurlari (Tungi klub tomida aylanuvchi 2 ta projektor)
  const skyBeams = [];
  const skyBeamGeo = new THREE.ConeGeometry(4.5, 95, 14, 1, true);
  skyBeamGeo.translate(0, 47.5, 0);
  const skyBeamMat = new THREE.MeshBasicMaterial({
    color: 0xd946ef,
    transparent: true,
    opacity: 0.10,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  for (const sx of [-1, 1]) {
    const bm = new THREE.Mesh(skyBeamGeo, skyBeamMat);
    bm.position.set(cx + sx * 18, 22, bCenterZ);
    exteriorGroup.add(bm);
    skyBeams.push(bm);
  }

  // Kirish chirog'i (PointLight)
  const extLight = new THREE.PointLight(0xd946ef, 3.2, 36);
  extLight.position.set(cx, 6.2, cz - 29);
  exteriorGroup.add(extLight);

  // ========================================================================
  // 2. INTERYER — GTA V STYLE TUNGI KLUB (Y = -120)
  // ========================================================================
  const iy = INTERIOR_Y;
  const iW = 56;
  const iD = 46;
  const iH = 11.5;

  const interiorColliders = [];
  const addIntCol = (minX, minZ, maxX, maxZ) => interiorColliders.push({ minX, minZ, maxX, maxZ, tag: 'wall' });

  // Tashqi devorlar chegarasi (o'yinchi hech qachon devordan o'ta olmaydi)
  addIntCol(cx - iW / 2 - 2, cz - iD / 2 - 2, cx + iW / 2 + 2, cz - iD / 2 + 0.5); // Shimoliy devor
  addIntCol(cx - iW / 2 - 2, cz + iD / 2 - 0.5, cx + iW / 2 + 2, cz + iD / 2 + 2); // Janubiy devor
  addIntCol(cx - iW / 2 - 2, cz - iD / 2, cx - iW / 2 + 0.5, cz + iD / 2); // G'arbiy devor
  addIntCol(cx + iW / 2 - 0.5, cz - iD / 2, cx + iW / 2 + 2, cz + iD / 2); // Sharqiy devor

  // Pol, Shift va Devorlar (PBR Marmar + Shift to'sinlari + Akustik devor panellari)
  const marbleTex = createMarblePBR();
  const velvetTex = createQuiltedVelvetTex('#3b0764', '#160329');
  const mQuiltedVelvet = new THREE.MeshStandardMaterial({ map: velvetTex, roughness: 0.52, metalness: 0.12 });
  const mChrome = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.92, roughness: 0.14 });
  const mSpeakerCab = new THREE.MeshStandardMaterial({ color: 0x0f111a, roughness: 0.6, metalness: 0.25 });
  const mSpeakerCone = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.4 });

  const floorMat = new THREE.MeshStandardMaterial({ map: marbleTex, color: 0xcbd5e1, roughness: 0.22, metalness: 0.48 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(iW, iD), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, iy, cz);
  interiorGroup.add(floor);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(iW, iD), new THREE.MeshStandardMaterial({ color: 0x05050a, roughness: 0.9 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(cx, iy + iH, cz);
  interiorGroup.add(ceil);

  // InstancedMesh shift arxitektura to'sinlari (Ceiling I-Beams)
  const ceilBeamGeo = new THREE.BoxGeometry(iW - 2, 0.42, 0.48);
  const beamInst = new THREE.InstancedMesh(ceilBeamGeo, mObsidian, 7);
  const dummy = new THREE.Object3D();
  for (let b = 0; b < 7; b++) {
    dummy.position.set(cx, iy + iH - 0.22, cz - 18 + b * 6);
    dummy.updateMatrix();
    beamInst.setMatrixAt(b, dummy.matrix);
  }
  beamInst.instanceMatrix.needsUpdate = true;
  interiorGroup.add(beamInst);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x111324, roughness: 0.5, metalness: 0.35 });
  const wallsSpec = [
    [iW, iH, 0.8, cx, iy + iH / 2, cz - iD / 2],
    [iW, iH, 0.8, cx, iy + iH / 2, cz + iD / 2],
    [0.8, iH, iD, cx - iW / 2, iy + iH / 2, cz],
    [0.8, iH, iD, cx + iW / 2, iy + iH / 2, cz],
  ];
  for (const [w, h, d, wx, wy, wz] of wallsSpec) {
    const wm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    wm.position.set(wx, wy, wz);
    interiorGroup.add(wm);
  }

  // Devor akustik panellari va neon chiziqlar (3D chuqurlik)
  const slatGeo = new THREE.BoxGeometry(0.16, 6.8, 0.75);
  const slatInst = new THREE.InstancedMesh(slatGeo, mSpeakerCab, 16);
  let sIdx = 0;
  for (const sx of [-1, 1]) {
    for (let z = -18; z <= 18; z += 5.1) {
      if (sIdx < 16) {
        dummy.position.set(cx + sx * (iW / 2 - 0.45), iy + 4.4, cz + z);
        dummy.updateMatrix();
        slatInst.setMatrixAt(sIdx++, dummy.matrix);
      }
    }
    for (let z = -16; z <= 16; z += 8) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 7.5, 0.25), Math.abs(z) % 16 === 0 ? mNeonPurple : mNeonCyan);
      strip.position.set(cx + sx * (iW / 2 - 0.5), iy + 4.8, cz + z);
      interiorGroup.add(strip);
    }
  }
  slatInst.count = sIdx;
  slatInst.instanceMatrix.needsUpdate = true;
  interiorGroup.add(slatInst);

  // DJ Sahnasining chap va o'ng tomonida Line-Array dinamik minoralari
  for (const sx of [-1, 1]) {
    const spk = createSpeakerStack({
      cabinetMat: mSpeakerCab,
      coneMat: mSpeakerCone,
      chromeMat: mChrome,
      neonMat: sx < 0 ? mNeonCyan : mNeonPurple,
    });
    spk.position.set(cx + sx * 12.2, iy + 0.02, cz - 13.0);
    spk.rotation.y = -sx * 0.28;
    interiorGroup.add(spk);
    addIntCol(cx + sx * 12.2 - 0.9, cz - 13.9, cx + sx * 12.2 + 0.9, cz - 12.1);
  }

  // 2.1 ASOSIY RAQS MAYDONI (8x8 animatsiyali LED plitkalar)
  const danceTiles = [];
  const tileGeo = new THREE.PlaneGeometry(2.15, 2.15);
  for (let tx = -3.5; tx <= 3.5; tx += 1) {
    for (let tz = -3.5; tz <= 3.5; tz += 1) {
      const tm = new THREE.MeshBasicMaterial({ color: 0x2e1065 });
      const tile = new THREE.Mesh(tileGeo, tm);
      tile.rotation.x = -Math.PI / 2;
      tile.position.set(cx + tx * 2.3, iy + 0.02, cz + 1.5 + tz * 2.3);
      interiorGroup.add(tile);
      danceTiles.push({ mesh: tile, mat: tm, ix: tx + 3.5, iz: tz + 3.5 });
    }
  }

  // 2.2 PROFESSIONAL DJ SAHNASI (Shimol tarafda, z = cz - 16)
  const stage = new THREE.Mesh(new THREE.BoxGeometry(20, 1.3, 8), mObsidian);
  stage.position.set(cx, iy + 0.65, cz - 15.5);
  interiorGroup.add(stage);
  addIntCol(cx - 10, cz - 19.5, cx + 10, cz - 11.5);

  const stageTrim = new THREE.Mesh(new THREE.BoxGeometry(20.2, 0.16, 8.2), mNeonCyan);
  stageTrim.position.set(cx, iy + 1.32, cz - 15.5);
  interiorGroup.add(stageTrim);

  // DJ Stoli va uskunalar (Turntables, Mixer, KOKOBANGO old paneli)
  const djBooth = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.15, 1.4), mDarkWall);
  djBooth.position.set(cx, iy + 1.88, cz - 13.8);
  interiorGroup.add(djBooth);
  const djLogoTex = makeSignTexture('KOKOBANGO', 'DJ LIVE SET', '#080414', '#00e5ff', '#d946ef', 512, 128);
  const djLogoPanel = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.95), new THREE.MeshBasicMaterial({ map: djLogoTex }));
  djLogoPanel.position.set(cx, iy + 1.88, cz - 13.08);
  interiorGroup.add(djLogoPanel);

  // Turntable disklar va mikser
  for (const sx of [-1.2, 1.2]) {
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 16), mNeonCyan);
    deck.position.set(cx + sx, iy + 2.48, cz - 13.8);
    interiorGroup.add(deck);
  }
  const mixer = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.65), mNeonPurple);
  mixer.position.set(cx, iy + 2.48, cz - 13.8);
  interiorGroup.add(mixer);

  // 2.2b SAHNA PODIUMLARI VA XROM RAQS USTUNLARI (Athletic Stage Performers)
  const stagePoleMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.92, roughness: 0.14 });
  for (const sx of [-7.8, 7.8]) {
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.65, 0.28, 24), mObsidian);
    pod.position.set(cx + sx, iy + 1.44, cz - 13.5);
    const podRing = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.045, 8, 28), mNeonPink);
    podRing.rotation.x = Math.PI / 2;
    podRing.position.set(cx + sx, iy + 1.59, cz - 13.5);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 5.2, 12), stagePoleMat);
    pole.position.set(cx + sx, iy + 4.15, cz - 13.5);
    interiorGroup.add(pod, podRing, pole);
  }

  // Raqs maydoni uchun atmosfera tutuni (Haze / Smoke qatlami — yengil 4 ta tekislik)
  const hazeTex = new THREE.CanvasTexture((() => {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grd.addColorStop(0, 'rgba(216, 180, 254, 0.35)');
    grd.addColorStop(0.5, 'rgba(34, 211, 238, 0.16)');
    grd.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return c;
  })());
  const stageHazeMats = [];
  for (let hi = 0; hi < 4; hi++) {
    const hm = new THREE.MeshBasicMaterial({
      map: hazeTex,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const hp = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), hm);
    hp.rotation.x = -Math.PI / 2;
    hp.position.set(cx + (hi % 2 === 0 ? -4 : 4), iy + 0.18 + hi * 0.06, cz - 4 + Math.floor(hi / 2) * 7);
    interiorGroup.add(hp);
    stageHazeMats.push(hm);
  }

  // 2.3 ULKAN ANIMATSIYALI LED VIDEO DEVOR (DJ orqasida — 1024x512 yuqori aniqlik)
  const ledCanvas = document.createElement('canvas');
  ledCanvas.width = 1024;
  ledCanvas.height = 512;
  const ledCtx = ledCanvas.getContext('2d');
  const ledTex = new THREE.CanvasTexture(ledCanvas);
  ledTex.colorSpace = THREE.SRGBColorSpace;
  ledTex.anisotropy = 4;
  const ledWall = new THREE.Mesh(new THREE.PlaneGeometry(21, 7.6), new THREE.MeshBasicMaterial({ map: ledTex }));
  ledWall.position.set(cx, iy + 5.8, cz - 22.1);
  interiorGroup.add(ledWall);

  // 2.3b RAQAMLI DEVOR PANELLARI (Stylish Digital Wall Panels — 512x256)
  const panelCanvas = document.createElement('canvas');
  panelCanvas.width = 512;
  panelCanvas.height = 256;
  const panelCtx = panelCanvas.getContext('2d');
  const panelTex = new THREE.CanvasTexture(panelCanvas);
  panelTex.colorSpace = THREE.SRGBColorSpace;
  panelTex.anisotropy = 4;
  const panelMat = new THREE.MeshBasicMaterial({ map: panelTex });
  const digitalPanelSpecs = [
    { x: cx - iW / 2 + 0.56, y: iy + 3.8, z: cz - 12.0, ry: Math.PI / 2, w: 4.8, h: 2.4 },
    { x: cx - iW / 2 + 0.56, y: iy + 3.8, z: cz + 14.0, ry: Math.PI / 2, w: 4.8, h: 2.4 },
    { x: cx + iW / 2 - 0.56, y: iy + 3.8, z: cz - 6.0, ry: -Math.PI / 2, w: 4.8, h: 2.4 },
    { x: cx + 14.22, y: iy + 3.2, z: cz + 6.5, ry: -Math.PI / 2, w: 3.6, h: 1.8 },
  ];
  for (const dp of digitalPanelSpecs) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(dp.w + 0.22, dp.h + 0.22, 0.08), mGold);
    frame.position.set(dp.x, dp.y, dp.z);
    frame.rotation.y = dp.ry;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(dp.w, dp.h), panelMat);
    scr.position.set(0, 0, 0.05);
    frame.add(scr);
    interiorGroup.add(frame);
  }

  // 2.3c 21+ GLAMOUR ART POSTERLAR VA VIP FOTOGRAFIYA (Yuqori sifatli PBR ramkalarda)
  function makeGlamourPosterTexture(variant) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 768;
    const g = c.getContext('2d');

    const palettes = [
      { bg1: '#1a0414', bg2: '#3b0724', accent: '#f43f5e', gold: '#fbbf24', title: 'MIDNIGHT VELVET', sub: '21+ EXCLUSIVE LOUNGE' },
      { bg1: '#130524', bg2: '#2e084d', accent: '#e879f9', gold: '#fde047', title: 'KOKOBANGO GLAMOUR', sub: 'ADULTS ONLY · 21+' },
      { bg1: '#1f0806', bg2: '#450a18', accent: '#fb7185', gold: '#f59e0b', title: 'CRIMSON NOIR', sub: 'VIP NIGHTLIFE EDITION' },
      { bg1: '#0f051c', bg2: '#310a3d', accent: '#c084fc', gold: '#fbbf24', title: 'GOLD & SILK', sub: 'PRIVATE VIP SUITE · 21+' },
    ];
    const p = palettes[variant % palettes.length];
    const grad = g.createLinearGradient(0, 0, 512, 768);
    grad.addColorStop(0, p.bg1);
    grad.addColorStop(0.55, p.bg2);
    grad.addColorStop(1, '#07020b');
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 768);

    // Warm spotlight halo
    const halo = g.createRadialGradient(256, 300, 20, 256, 300, 260);
    halo.addColorStop(0, `${p.accent}66`);
    halo.addColorStop(0.55, `${p.gold}22`);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, 512, 768);

    // Bokeh highlights
    for (let i = 0; i < 22; i++) {
      const bx = ((i * 97 + variant * 53) % 440) + 36;
      const by = ((i * 131 + variant * 29) % 520) + 60;
      const br = 8 + (i % 5) * 6;
      g.fillStyle = i % 2 === 0 ? 'rgba(251, 191, 36, 0.16)' : 'rgba(244, 63, 94, 0.16)';
      g.beginPath();
      g.arc(bx, by, br, 0, Math.PI * 2);
      g.fill();
    }

    // Tasteful editorial evening-gown silhouette (21+ adult fashion motif)
    g.save();
    g.translate(256, 390);
    g.fillStyle = '#09030d';
    // Head & updo hairstyle
    g.beginPath();
    g.arc(0, -185, 30, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(16, -206, 15, 0, Math.PI * 2);
    g.fill();
    // Neck & shoulders
    g.beginPath();
    g.moveTo(-10, -158);
    g.lineTo(10, -158);
    g.lineTo(44, -124);
    g.lineTo(24, -40);
    g.lineTo(36, 18);
    // Flowing evening gown skirt
    g.quadraticCurveTo(75, 130, 96, 230);
    g.lineTo(-82, 230);
    g.quadraticCurveTo(-55, 120, -32, 18);
    g.lineTo(-22, -40);
    g.lineTo(-42, -124);
    g.closePath();
    g.fill();
    // Golden rim-light contour on silhouette
    g.strokeStyle = p.gold;
    g.lineWidth = 2.5;
    g.stroke();
    g.restore();

    // Fine gold gallery border
    g.strokeStyle = p.gold;
    g.lineWidth = 4;
    g.strokeRect(22, 22, 468, 724);
    g.strokeStyle = 'rgba(255,255,255,0.22)';
    g.lineWidth = 1;
    g.strokeRect(32, 32, 448, 704);

    // Typography
    g.textAlign = 'center';
    g.fillStyle = p.gold;
    g.font = '700 20px "Segoe UI", Arial, sans-serif';
    g.fillText('KOKOBANGO EXCLUSIVE · 21+', 256, 74);

    g.fillStyle = '#ffffff';
    g.shadowColor = p.accent;
    g.shadowBlur = 14;
    g.font = '900 34px "Segoe UI", Arial, sans-serif';
    g.fillText(p.title, 256, 668);
    g.shadowBlur = 0;

    g.fillStyle = p.accent;
    g.font = '700 18px "Segoe UI", Arial, sans-serif';
    g.fillText(p.sub, 256, 704);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  const posterTextures = [0, 1, 2, 3].map((v) => makeGlamourPosterTexture(v));
  const posterGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.14,
    roughness: 0.05,
    metalness: 0.1,
    clearcoat: 1.0,
  });

  const posterTexLoader = new THREE.TextureLoader();
  const CLUB_POSTER_URLS = [
    './Kokobango/depositphotos_72619833-stock-photo-elegant-brunette-lady-in-lingerie.jpg',
    './Kokobango/Hazel-robe-campaign4.webp',
    './Kokobango/June_2023_Desktop_Instagram_Post_Square_2000x.webp',
    './Kokobango/LINGERIE_-_MOBILE_6e493ed3-9a3a-4fd2-8838-1cbdd654da8b.webp',
    './Kokobango/0253707-Black_media-2.webp',
    './Kokobango/images%20(4).jpg',
    './Kokobango/images%20(5).jpg',
    './Kokobango/images%20(6).jpg',
    './Kokobango/istockphoto-2149007404-640x640.jpg',
    './Kokobango/images%20(7).jpg',
    './Kokobango/images%20(8).jpg',
    './Kokobango/b201cc79fa915d85d8dee700cb9955dd.jpg',
    './Kokobango/519O45dMQoL.jpg',
  ];

  function addFramedGlamourArt(x, y, z, ry, w, h, variant) {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    grp.rotation.y = ry;
    const outer = new THREE.Mesh(new THREE.BoxGeometry(w + 0.24, h + 0.24, 0.09), mGold);
    const backing = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.1), mObsidian);
    const artMat = new THREE.MeshBasicMaterial({ map: posterTextures[variant % posterTextures.length] });
    const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), artMat);
    art.position.z = 0.055;
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), posterGlassMat);
    glass.position.z = 0.062;
    grp.add(outer, backing, art, glass);
    interiorGroup.add(grp);

    const url = CLUB_POSTER_URLS[variant % CLUB_POSTER_URLS.length];
    if (url) {
      posterTexLoader.load(
        url,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = 4;
          if (tex.image && tex.image.width && tex.image.height) {
            const imgAspect = tex.image.width / tex.image.height;
            const frameAspect = w / h;
            if (imgAspect > frameAspect) {
              const rx = frameAspect / imgAspect;
              tex.repeat.set(rx, 1);
              tex.offset.set((1 - rx) * 0.5, 0);
            } else {
              const ryRatio = imgAspect / frameAspect;
              tex.repeat.set(1, ryRatio);
              tex.offset.set(0, (1 - ryRatio) * 0.5);
            }
          }
          artMat.map = tex;
          artMat.needsUpdate = true;
        },
        undefined,
        () => {}
      );
    }
  }

  // Asosiy zal devorlaridagi Glamour 21+ posterlar (6 ta oltin ramka)
  addFramedGlamourArt(cx - iW / 2 + 0.56, iy + 3.6, cz - 4.0, Math.PI / 2, 2.2, 3.3, 0);
  addFramedGlamourArt(cx - iW / 2 + 0.56, iy + 3.6, cz + 6.0, Math.PI / 2, 2.2, 3.3, 1);
  addFramedGlamourArt(cx - 10.5, iy + 3.6, cz + iD / 2 - 0.56, Math.PI, 2.2, 3.3, 2);
  addFramedGlamourArt(cx + 10.5, iy + 3.6, cz + iD / 2 - 0.56, Math.PI, 2.2, 3.3, 3);
  addFramedGlamourArt(cx + iW / 2 - 0.56, iy + 3.6, cz - 14.5, -Math.PI / 2, 2.2, 3.3, 8);
  addFramedGlamourArt(cx - 15.5, iy + 4.2, cz - iD / 2 + 0.56, 0, 2.2, 3.3, 9);

  // Dekorativ oltin geometrik devor installyatsiyalari
  for (const [rx, ryPos, rz, rRot] of [
    [cx - 14.5, iy + 6.4, cz - 21.9, 0],
    [cx + 14.5, iy + 6.4, cz - 21.9, 0],
  ]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.07, 10, 32), mGold);
    ring.position.set(rx, ryPos, rz);
    ring.rotation.y = rRot;
    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.05, 10, 28), mNeonPurple);
    innerRing.position.set(rx, ryPos, rz + 0.04);
    interiorGroup.add(ring, innerRing);
  }

  // 2.4 SHIFT PROJEKTORLARI (8 ta harakatlanuvchi Spotlight + Lazer nurlari)
  const trussMat = new THREE.MeshStandardMaterial({ color: 0x262936, metalness: 0.8, roughness: 0.3 });
  const truss1 = new THREE.Mesh(new THREE.BoxGeometry(30, 0.35, 0.35), trussMat);
  truss1.position.set(cx, iy + 10.2, cz - 6);
  const truss2 = new THREE.Mesh(new THREE.BoxGeometry(30, 0.35, 0.35), trussMat);
  truss2.position.set(cx, iy + 10.2, cz + 6);
  interiorGroup.add(truss1, truss2);

  const spotlights = [];
  const beamGeo = new THREE.ConeGeometry(2.6, 11.5, 12, 1, true);
  beamGeo.translate(0, -5.75, 0);
  const spotColors = [0xd946ef, 0x00e5ff, 0x3b82f6, 0xf43f5e];
  for (let i = 0; i < 8; i++) {
    const sx = cx - 12 + (i % 4) * 8;
    const sz = i < 4 ? cz - 6 : cz + 6;
    const head = new THREE.Group();
    head.position.set(sx, iy + 10.0, sz);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), trussMat);
    const beamMat = new THREE.MeshBasicMaterial({
      color: spotColors[i % spotColors.length],
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const cone = new THREE.Mesh(beamGeo, beamMat);
    head.add(housing, cone);
    interiorGroup.add(head);
    spotlights.push({ head, mat: beamMat, phase: i * 0.85 });
  }

  // Lazer nurlari (10 ta kesishuvchi rangli lazer)
  const lasers = [];
  const laserGeo = new THREE.CylinderGeometry(0.02, 0.02, 28, 6);
  laserGeo.translate(0, -14, 0);
  for (let i = 0; i < 10; i++) {
    const lMat = new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? 0x00e5ff : 0xf43f5e,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const lPivot = new THREE.Group();
    lPivot.position.set(cx - 9 + i * 2, iy + 9.8, cz - 14);
    const beam = new THREE.Mesh(laserGeo, lMat);
    beam.rotation.x = Math.PI / 2.6;
    lPivot.add(beam);
    interiorGroup.add(lPivot);
    lasers.push({ pivot: lPivot, mat: lMat, phase: i * 0.65 });
  }

  // 2.5 ASOSIY BAR VA LOUNGE (G'arb / Chap tarafda, x = cx - 27 .. cx - 16)
  const barCounter = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 16), mObsidian);
  barCounter.position.set(cx - 18.5, iy + 0.6, cz + 1);
  interiorGroup.add(barCounter);
  addIntCol(cx - 26.5, cz - 7.2, cx - 17.6, cz + 9.2);

  const barTop = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 16.4), mMarble);
  barTop.position.set(cx - 18.5, iy + 1.22, cz + 1);
  const barGlow = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 16.1), mNeonCyan);
  barGlow.position.set(cx - 18.4, iy + 0.12, cz + 1);
  interiorGroup.add(barTop, barGlow);

  const barSignTex = makeSignTexture('KOKOBANGO BAR', 'COCKTAILS & LOUNGE', '#090915', '#22d3ee', '#e879f9', 512, 128);
  const barSign = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.3), new THREE.MeshBasicMaterial({ map: barSignTex }));
  barSign.position.set(cx - 26.2, iy + 4.8, cz + 1);
  barSign.rotation.y = Math.PI / 2;
  interiorGroup.add(barSign);

  // Bar ortidagi javon va InstancedMesh bezak shishalar (1 draw call)
  const barShelf = new THREE.Mesh(new THREE.BoxGeometry(0.9, 4.2, 14), mDarkWall);
  barShelf.position.set(cx - 26.8, iy + 2.1, cz + 1);
  interiorGroup.add(barShelf);
  const bottleCols = [0x00e5ff, 0xd946ef, 0xfacc15, 0x38bdf8, 0xf43f5e, 0xa855f7];
  const bottleGeo = new THREE.CylinderGeometry(0.06, 0.09, 0.36, 8);
  const bottleMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.38,
    roughness: 0.15,
    metalness: 0.25,
  });
  const bottleInst = new THREE.InstancedMesh(bottleGeo, bottleMat, 27);
  const bColor = new THREE.Color();
  for (let b = 0; b < 27; b++) {
    dummy.position.set(cx - 26.2, iy + 1.55 + (b % 3) * 0.95, cz - 5 + Math.floor(b / 3) * 1.45);
    dummy.updateMatrix();
    bottleInst.setMatrixAt(b, dummy.matrix);
    bColor.setHex(bottleCols[b % bottleCols.length]);
    bottleInst.setColorAt(b, bColor);
  }
  bottleInst.instanceMatrix.needsUpdate = true;
  if (bottleInst.instanceColor) bottleInst.instanceColor.needsUpdate = true;
  interiorGroup.add(bottleInst);

  const mLeather = new THREE.MeshStandardMaterial({ color: 0x3b0764, roughness: 0.42, metalness: 0.15 });
  for (let st = 0; st < 6; st++) {
    const stool = createDetailedBarStool({ chromeMat: mChrome, velvetMat: mQuiltedVelvet });
    stool.position.set(cx - 16.8, iy, cz - 5 + st * 2.4);
    interiorGroup.add(stool);
  }

  // 2.6 ALOHIDA VIP ZONA XONASI (Kirishda O'NG TOMONDA: x = cx + 14.5 .. cx + 27.6, z = cz - 2 .. cz + 22)
  const VIP_Y = iy + 0.12;
  const vipFloorMat = new THREE.MeshStandardMaterial({ color: 0x240a3d, roughness: 0.25, metalness: 0.45 });
  const vipFloor = new THREE.Mesh(new THREE.BoxGeometry(13.2, 0.12, 24.2), vipFloorMat);
  vipFloor.position.set(cx + 21.1, iy + 0.06, cz + 10.0);
  interiorGroup.add(vipFloor);
  const vipEdgeGlow = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 24.2), mGold);
  vipEdgeGlow.position.set(cx + 14.55, iy + 0.07, cz + 10.0);
  interiorGroup.add(vipEdgeGlow);

  // VIP xonani oddiy zaldan ajratuvchi yopiq (shaffof bo'lmagan) obsidian va oltin devorlar (ichkarisi tashqaridan ko'rinmaydi)
  const vipWallNorth = new THREE.Mesh(new THREE.BoxGeometry(13.2, 5.2, 0.35), mObsidian);
  vipWallNorth.position.set(cx + 21.1, iy + 2.6, cz - 2.0);
  const vipWallNorthPanel = new THREE.Mesh(new THREE.BoxGeometry(12.6, 3.4, 0.38), mQuiltedVelvet);
  vipWallNorthPanel.position.set(cx + 21.1, iy + 2.6, cz - 2.0);
  const vipWallNorthNeon = new THREE.Mesh(new THREE.BoxGeometry(13.2, 0.14, 0.42), mNeonPurple);
  vipWallNorthNeon.position.set(cx + 21.1, iy + 5.2, cz - 2.0);
  interiorGroup.add(vipWallNorth, vipWallNorthPanel, vipWallNorthNeon);
  addIntCol(cx + 14.4, cz - 2.3, cx + 27.8, cz - 1.7);

  // G'arbiy yopiq maxfiylik devori (2 qism — o'rtada VIP kirish eshigi yopiq turadi)
  const vipWestSeg1 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 4.8, 12.2), mObsidian);
  vipWestSeg1.position.set(cx + 14.5, iy + 2.4, cz + 4.1);
  const vipWestTrim1 = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 12.2), mGold);
  vipWestTrim1.position.set(cx + 14.5, iy + 4.85, cz + 4.1);
  const vipWestBase1 = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.9, 12.2), mQuiltedVelvet);
  vipWestBase1.position.set(cx + 14.5, iy + 0.45, cz + 4.1);

  const vipWestSeg2 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 4.8, 8.2), mObsidian);
  vipWestSeg2.position.set(cx + 14.5, iy + 2.4, cz + 17.9);
  const vipWestTrim2 = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 8.2), mGold);
  vipWestTrim2.position.set(cx + 14.5, iy + 4.85, cz + 17.9);
  const vipWestBase2 = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.9, 8.2), mQuiltedVelvet);
  vipWestBase2.position.set(cx + 14.5, iy + 0.45, cz + 17.9);
  interiorGroup.add(vipWestSeg1, vipWestTrim1, vipWestBase1, vipWestSeg2, vipWestTrim2, vipWestBase2);
  addIntCol(cx + 14.2, cz - 2.0, cx + 14.8, cz + 10.1);
  addIntCol(cx + 14.2, cz + 13.9, cx + 14.8, cz + 22.5);

  // Yopiq VIP eshik paneli (25 mln so'm to'lanmaguncha ichkarini to'sib turadi)
  const vipPrivacyDoor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.8, 3.65), mQuiltedVelvet);
  vipPrivacyDoor.position.set(cx + 14.5, iy + 1.9, cz + 12.0);
  const vipDoorCrest = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 1.1),
    new THREE.MeshBasicMaterial({ map: makeSignTexture('VIP 21+', '25 000 000 SO‘M', '#1f0518', '#fde047', '#fb7185', 256, 128) })
  );
  vipDoorCrest.position.set(-0.16, 0.25, 0);
  vipDoorCrest.rotation.y = -Math.PI / 2;
  vipPrivacyDoor.add(vipDoorCrest);
  interiorGroup.add(vipPrivacyDoor);
  const vipDoorCollider = { minX: cx + 14.2, minZ: cz + 10.1, maxX: cx + 14.8, maxZ: cz + 13.9, tag: 'vip_door' };
  interiorColliders.push(vipDoorCollider);

  // VIP ROOM neon yozuvli kirish arkasi
  const vipDoorTop = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.4, 4.0), mObsidian);
  vipDoorTop.position.set(cx + 14.5, iy + 4.3, cz + 12.0);
  const vipSignTex = makeSignTexture('VIP ROOM', 'EXCLUSIVE LOUNGE', '#1a0633', '#facc15', '#e879f9', 512, 128);
  const vipSign = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 0.95), new THREE.MeshBasicMaterial({ map: vipSignTex }));
  vipSign.position.set(cx + 14.22, iy + 4.3, cz + 12.0);
  vipSign.rotation.y = -Math.PI / 2;
  const vipDoorGlowL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.8, 0.16), mNeonPurple);
  vipDoorGlowL.position.set(cx + 14.5, iy + 1.9, cz + 10.15);
  const vipDoorGlowR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.8, 0.16), mNeonPurple);
  vipDoorGlowR.position.set(cx + 14.5, iy + 1.9, cz + 13.85);
  interiorGroup.add(vipDoorTop, vipSign, vipDoorGlowL, vipDoorGlowR);

  // VIP xona ichidagi hashamatli 3D divanlar, stollar, shampan idishlari va bokallar
  for (const vz of [cz + 3.5, cz + 17.5]) {
    const sofa = createDetailedSofa(5.2, { velvetMat: mQuiltedVelvet, goldMat: mGold, trimMat: mNeonPurple });
    sofa.position.set(cx + 25.1, VIP_Y, vz);
    sofa.rotation.y = Math.PI; // Zalga qarab
    const vTable = createDetailedVipTable({
      obsidianMat: mObsidian,
      goldMat: mGold,
      glassMat: mGlass,
      neonMat: mNeonCyan,
    });
    vTable.position.set(cx + 22.3, VIP_Y, vz);
    interiorGroup.add(sofa, vTable);
    addIntCol(cx + 24.0, vz - 2.6, cx + 26.6, vz + 2.6);
    addIntCol(cx + 21.5, vz - 1.4, cx + 23.2, vz + 1.4);
  }
  // VIP xona ichidagi shaxsiy mini-bar (shimoliy devor bo'ylab)
  const vipMiniBar = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.1, 1.1), mObsidian);
  vipMiniBar.position.set(cx + 21.0, VIP_Y + 0.55, cz - 0.6);
  const vipMiniBarTop = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.1, 1.25), mGold);
  vipMiniBarTop.position.set(cx + 21.0, VIP_Y + 1.12, cz - 0.6);
  interiorGroup.add(vipMiniBar, vipMiniBarTop);
  addIntCol(cx + 18.1, cz - 1.25, cx + 23.9, cz + 0.05);

  // VIP Lounge ichidagi eksklyuziv 21+ Glamour fotografiyalar (6 ta hashamatli oltin ramka)
  addFramedGlamourArt(cx + iW / 2 - 0.56, VIP_Y + 3.4, cz + 3.5, -Math.PI / 2, 2.1, 3.15, 4);
  addFramedGlamourArt(cx + iW / 2 - 0.56, VIP_Y + 3.4, cz + 10.5, -Math.PI / 2, 2.1, 3.15, 5);
  addFramedGlamourArt(cx + iW / 2 - 0.56, VIP_Y + 3.4, cz + 17.5, -Math.PI / 2, 2.1, 3.15, 6);
  addFramedGlamourArt(cx + 18.2, VIP_Y + 3.4, cz + iD / 2 - 0.56, Math.PI, 2.0, 3.0, 7);
  addFramedGlamourArt(cx + 23.8, VIP_Y + 3.4, cz + iD / 2 - 0.56, Math.PI, 2.0, 3.0, 10);
  addFramedGlamourArt(cx + 21.0, VIP_Y + 3.5, cz - 1.75, 0, 2.4, 3.2, 11);

  // VIP Lounge ichidagi shaxsiy VIP Podium va xrom ustun
  const vipStagePod = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.5, 0.22, 24), mObsidian);
  vipStagePod.position.set(cx + 18.0, VIP_Y + 0.11, cz + 10.5);
  const vipStageRing = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.04, 8, 28), mGold);
  vipStageRing.rotation.x = Math.PI / 2;
  vipStageRing.position.set(cx + 18.0, VIP_Y + 0.23, cz + 10.5);
  const vipStagePole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 4.8, 12), stagePoleMat);
  vipStagePole.position.set(cx + 18.0, VIP_Y + 2.6, cz + 10.5);
  interiorGroup.add(vipStagePod, vipStageRing, vipStagePole);

  // 2.7 HOJATXONA VA KORIDOR (WC / RESTROOMS — Shimoli-Sharqiy burchak)
  const wcWallFront = new THREE.Mesh(new THREE.BoxGeometry(10, 5.5, 0.4), wallMat);
  wcWallFront.position.set(cx + 22.5, iy + 2.75, cz - 10);
  const wcWallSide = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.5, 8.5), wallMat);
  wcWallSide.position.set(cx + 17.5, iy + 2.75, cz - 14.5);
  interiorGroup.add(wcWallFront, wcWallSide);
  addIntCol(cx + 17.3, cz - 10.3, cx + 27.5, cz - 9.7);
  addIntCol(cx + 17.2, cz - 18.8, cx + 17.8, cz - 10.2);

  const wcSignTex = makeSignTexture('WC · RESTROOMS', '', '#090915', '#00e5ff', '#d946ef', 512, 128);
  const wcSign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: wcSignTex }));
  wcSign.position.set(cx + 17.25, iy + 4.2, cz - 19.8);
  wcSign.rotation.y = -Math.PI / 2;
  interiorGroup.add(wcSign);

  // Lavabo va ko'zgu
  const sinkCounter = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.9, 0.9), mMarble);
  sinkCounter.position.set(cx + 22.5, iy + 0.45, cz - 11.2);
  const mirror = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.5, 0.1), mGlass);
  mirror.position.set(cx + 22.5, iy + 1.8, cz - 10.3);
  interiorGroup.add(sinkCounter, mirror);

  // 2.8 KIRISH / CHIQISH RECEPTION & EXIT ESHIGI (Janub taraf, z = cz + 22.2)
  const exitSignTex = makeSignTexture('EXIT · CHIQISH', '[X] TASHQARIGA CHIQISH', '#04120b', '#4ade80', '#00e5ff', 512, 128);
  const exitSign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), new THREE.MeshBasicMaterial({ map: exitSignTex }));
  exitSign.position.set(cx, iy + 4.3, cz + 22.45);
  exitSign.rotation.y = Math.PI;
  interiorGroup.add(exitSign);

  const exitDoor = new THREE.Mesh(new THREE.BoxGeometry(4.6, 3.4, 0.35), mGlass);
  exitDoor.position.set(cx, iy + 1.7, cz + 22.4);
  const exitFrame = new THREE.Mesh(new THREE.BoxGeometry(5.0, 3.6, 0.25), mNeonCyan);
  exitFrame.position.set(cx, iy + 1.8, cz + 22.45);
  interiorGroup.add(exitFrame, exitDoor);

  // Reception desk
  const recDesk = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.1, 1.2), mObsidian);
  recDesk.position.set(cx - 6.5, iy + 0.55, cz + 17.5);
  const recTrim = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.1, 1.3), mNeonPurple);
  recTrim.position.set(cx - 6.5, iy + 1.12, cz + 17.5);
  interiorGroup.add(recDesk, recTrim);
  addIntCol(cx - 9.0, cz + 16.8, cx - 4.0, cz + 18.2);

  // Interyer yoritish (qizil, binafsha va iliq oltin/amber 21+ glamour muhiti)
  const intHemi = new THREE.HemisphereLight(0xf0abfc, 0x2a0818, 1.45);
  intHemi.position.set(cx, iy + 9.5, cz);
  const intAmbient = new THREE.PointLight(0xa855f7, 40, 62, 1.25);
  intAmbient.position.set(cx, iy + 8.5, cz);
  const intStageLight = new THREE.PointLight(0xe11d48, 70, 40, 1.3);
  intStageLight.position.set(cx, iy + 6.5, cz - 14);
  const intBarLight = new THREE.PointLight(0xd946ef, 48, 32, 1.3);
  intBarLight.position.set(cx - 21, iy + 5.5, cz + 1);
  const intVipLight = new THREE.PointLight(0xf59e0b, 46, 26, 1.3);
  intVipLight.position.set(cx + 21, iy + 5.5, cz + 10);
  const intVipPurple = new THREE.PointLight(0xbe185d, 40, 24, 1.3);
  intVipPurple.position.set(cx + 21, iy + 5.0, cz + 16);
  const intEntranceLight = new THREE.PointLight(0xfbbf24, 34, 28, 1.3);
  intEntranceLight.position.set(cx, iy + 6.0, cz + 15);
  interiorGroup.add(intHemi, intAmbient, intStageLight, intBarLight, intVipLight, intVipPurple, intEntranceLight);

  // Aylanuvchi Disko Shari (Mirror Disco Ball)
  const discoGroup = new THREE.Group();
  discoGroup.position.set(cx, iy + 8.4, cz - 1.5);
  const discoRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 1.6, 8),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.2 })
  );
  discoRod.position.y = 0.8;
  const discoBall = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.95, 2),
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      emissive: 0x3b0764,
      emissiveIntensity: 0.45,
      metalness: 0.96,
      roughness: 0.08,
      flatShading: true,
    })
  );
  const discoRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.35, 0.04, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.75 })
  );
  discoRing.rotation.x = Math.PI * 0.42;
  discoGroup.add(discoRod, discoBall, discoRing);
  interiorGroup.add(discoGroup);

  // Sahna yonidagi LED Ekvalayzer ustunlari
  const eqBars = [];
  const eqXs = [-11.5, -10.2, -8.9, 8.9, 10.2, 11.5];
  for (let i = 0; i < eqXs.length; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? 0xe879f9 : 0x22d3ee,
      transparent: true,
      opacity: 0.9,
    });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.0, 0.65), mat);
    bar.position.set(cx + eqXs[i], iy + 1.4, cz - 15.5);
    interiorGroup.add(bar);
    eqBars.push({ mesh: bar, phase: i * 0.9 });
  }

  // VIP kirish qizil/binafsha baxmal arqon ustunlari
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xd946ef, roughness: 0.4, emissive: 0x701a75, emissiveIntensity: 0.45 });
  for (const rz of [-4.2, 2.2]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.05, 10), mGold);
    post.position.set(cx - 15.6, iy + 0.525, cz + rz);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), mGold);
    knob.position.set(cx - 15.6, iy + 1.08, cz + rz);
    interiorGroup.add(post, knob);
  }
  const vipRope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 6.2, 8), ropeMat);
  vipRope.rotation.x = Math.PI / 2;
  vipRope.position.set(cx - 15.6, iy + 0.85, cz - 1.0);
  interiorGroup.add(vipRope);

  // Hashamatli marmar kolonnalar va neon chiziqlar (6 ta ustun)
  const pillarCoords = [
    [-14.5, -14.0], [14.5, -14.0],
    [-14.5, 13.5], [14.5, 13.5],
    [-14.5, 0.0], [14.5, 19.5],
  ];
  for (let i = 0; i < pillarCoords.length; i++) {
    const [pxOff, pzOff] = pillarCoords[i];
    const pil = new THREE.Mesh(new THREE.BoxGeometry(1.1, iH, 1.1), mObsidian);
    pil.position.set(cx + pxOff, iy + iH / 2, cz + pzOff);
    const pilTrim = new THREE.Mesh(
      new THREE.BoxGeometry(1.18, iH - 1.0, 0.16),
      i % 2 === 0 ? mNeonPurple : mNeonCyan
    );
    pilTrim.position.set(cx + pxOff, iy + iH / 2, cz + pzOff);
    const pilRing = new THREE.Mesh(
      new THREE.BoxGeometry(1.26, 0.18, 1.26),
      mGold
    );
    pilRing.position.set(cx + pxOff, iy + 0.12, cz + pzOff);
    interiorGroup.add(pil, pilTrim, pilRing);
    addIntCol(cx + pxOff - 0.65, cz + pzOff - 0.65, cx + pxOff + 0.65, cz + pzOff + 0.65);
  }

  // Shiftdagi neon halqalar (Ceiling Halo Rings)
  const ceilRings = [];
  for (let i = 0; i < 3; i++) {
    const crMat = new THREE.MeshBasicMaterial({
      color: i === 1 ? 0x22d3ee : 0xe879f9,
      transparent: true,
      opacity: 0.72,
    });
    const cr = new THREE.Mesh(new THREE.TorusGeometry(4.2 + i * 2.6, 0.09, 10, 48), crMat);
    cr.rotation.x = Math.PI / 2;
    cr.position.set(cx, iy + 10.6 - i * 0.25, cz - 1.5);
    interiorGroup.add(cr);
    ceilRings.push({ mesh: cr, mat: crMat, baseY: iy + 10.6 - i * 0.25, phase: i * 1.1 });
  }

  // Sahna CO2 tutun/lazer ustunlari (Beat-synced Smoke Plumes)
  const co2Jets = [];
  const co2Mat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  for (const sx of [-6.8, 6.8]) {
    const jet = new THREE.Mesh(new THREE.ConeGeometry(1.15, 5.5, 14, 1, true), co2Mat);
    jet.rotation.x = Math.PI;
    jet.position.set(cx + sx, iy + 4.1, cz - 13.5);
    interiorGroup.add(jet);
    co2Jets.push(jet);
  }

  // VIP Lounge shift neon qandili (VIP Chandelier) va VIP podiumlar
  const vipChandelier = new THREE.Mesh(
    new THREE.TorusGeometry(2.8, 0.08, 10, 36),
    new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.82 })
  );
  vipChandelier.rotation.x = Math.PI / 2;
  vipChandelier.position.set(cx + 21.0, VIP_Y + 5.4, cz + 10.5);
  interiorGroup.add(vipChandelier);

  // 18.glb (skeletsiz haykal/model) sirpanuvchi karobkaga o'xshab yurmasligi uchun VIP Podiumlarga chiroyli joylashtiriladi
  const vipPodiums = [];
  const podiumSpots = [
    [cx + 17.6, VIP_Y, cz + 2.2, 0.35],
    [cx + 23.6, VIP_Y, cz + 10.8, -Math.PI / 2],
  ];
  for (const [px, py, pz, ph] of podiumSpots) {
    const pod = new THREE.Group();
    pod.position.set(px, py, pz);
    const baseCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.98, 0.22, 24), mObsidian);
    baseCyl.position.y = 0.11;
    const goldRim = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.035, 8, 28), mGold);
    goldRim.rotation.x = Math.PI / 2;
    goldRim.position.y = 0.22;
    const neonDisk = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.82, 28), new THREE.MeshBasicMaterial({ color: 0xe879f9, side: THREE.DoubleSide }));
    neonDisk.rotation.x = -Math.PI / 2;
    neonDisk.position.y = 0.23;
    pod.add(baseCyl, goldRim, neonDisk);
    interiorGroup.add(pod);
    addIntCol(px - 0.9, pz - 0.9, px + 0.9, pz + 0.9);
    vipPodiums.push({ group: pod, baseY: py + 0.23, holder: new THREE.Group(), baseRot: ph });
    pod.add(vipPodiums[vipPodiums.length - 1].holder);
    vipPodiums[vipPodiums.length - 1].holder.position.y = 0.23;
    vipPodiums[vipPodiums.length - 1].holder.rotation.y = ph;
  }

  // Kokobango papkasidagi 7 ta YANGI Bip01 skeletli GLB modellar (VIP Lounge + Main Floor)
  const SKELETAL_GLB_SPECS = [
    // VIP Lounge (o'ng tomondagi alohida xona)
    {
      file: './Kokobango/Female_Party_01.glb', zone: 'vip', targetH: 1.74, color: 0xe879f9, speed: 1.35,
      pos: [18.5, 10.5], wps: [[18.5, 10.5], [20.4, 6.2], [19.5, 14.8], [16.8, 12.2]],
    },
    {
      file: './Kokobango/Female_Party_02.glb', zone: 'vip', targetH: 1.73, color: 0x22d3ee, speed: 1.30,
      pos: [20.6, 5.2], wps: [[20.6, 5.2], [18.2, 8.2], [20.8, 15.2], [17.4, 5.8]],
    },
    {
      file: './Kokobango/Female_Adult_17.glb', zone: 'vip', targetH: 1.75, color: 0xfacc15, speed: 1.25,
      pos: [17.4, 15.2], wps: [[17.4, 15.2], [20.4, 18.2], [20.2, 12.6], [16.8, 14.0]],
    },
    {
      file: './Kokobango/Male_Adult_09.glb', zone: 'vip', targetH: 1.82, color: 0x38bdf8, speed: 1.40,
      pos: [19.8, 13.5], wps: [[19.8, 13.5], [21.2, 8.0], [17.2, 10.5], [19.2, 17.5]],
    },
    // Main Floor (asosiy raqs maydoni va bar)
    {
      file: './Kokobango/Female_Adult_04.glb', zone: 'main', targetH: 1.74, color: 0xf472b6, speed: 1.45,
      pos: [-2.2, 3.2], wps: [[-2.2, 3.2], [3.8, 2.8], [3.2, -3.5], [-3.8, -3.2]],
    },
    {
      file: './Kokobango/Female_Adult_08.glb', zone: 'main', targetH: 1.73, color: 0xc084fc, speed: 1.40,
      pos: [4.5, -1.8], wps: [[4.5, -1.8], [7.2, 4.2], [1.2, 6.8], [-4.2, 1.5]],
    },
    {
      file: './Kokobango/Female_Adult_13.glb', zone: 'main', targetH: 1.75, color: 0x22d3ee, speed: 1.35,
      pos: [-11.5, 2.5], wps: [[-11.5, 2.5], [-14.2, -2.5], [-13.8, 7.2], [-6.8, 5.2]],
    },
  ];

  function collectBip01Rig(root) {
    root.updateMatrixWorld(true);
    const rootQuatInv = new THREE.Quaternion();
    root.getWorldQuaternion(rootQuatInv).invert();

    // GLTFLoader PropertyBinding.sanitizeNodeName() bo'shliqlarni '_' ga almashtiradi
    // (masalan 'Bip01 L UpperArm' -> 'Bip01_L_UpperArm'), shuning uchun ikkala formatni ham qidiramiz
    const byNorm = new Map();
    root.traverse((obj) => {
      if (obj.name) {
        const norm = obj.name.replace(/\s+/g, '_');
        if (!byNorm.has(norm)) byNorm.set(norm, obj);
      }
      if (obj.isSkinnedMesh && obj.skeleton) {
        for (const b of obj.skeleton.bones) {
          if (b && b.name) {
            const norm = b.name.replace(/\s+/g, '_');
            if (!byNorm.has(norm)) byNorm.set(norm, b);
          }
        }
      }
    });
    const find = (name) => byNorm.get(name.replace(/\s+/g, '_')) || root.getObjectByName(name) || null;
    const raw = {
      pelvis: find('Bip01 Pelvis'),
      spine: find('Bip01 Spine1') || find('Bip01 Spine'),
      head: find('Bip01 Head'),
      lArm: find('Bip01 L UpperArm'),
      lFore: find('Bip01 L Forearm'),
      rArm: find('Bip01 R UpperArm'),
      rFore: find('Bip01 R Forearm'),
      lThigh: find('Bip01 L Thigh'),
      lCalf: find('Bip01 L Calf'),
      rThigh: find('Bip01 R Thigh'),
      rCalf: find('Bip01 R Calf'),
    };
    const rig = {};
    for (const [k, bone] of Object.entries(raw)) {
      if (!bone) continue;
      const parentWorld = new THREE.Quaternion();
      if (bone.parent) {
        bone.parent.getWorldQuaternion(parentWorld);
        parentWorld.premultiply(rootQuatInv);
      }
      const parentInv = parentWorld.clone().invert();
      rig[k] = {
        bone,
        base: bone.quaternion.clone(),
        parentWorld,
        parentInv,
      };
    }
    return rig;
  }

  const _animEuler = new THREE.Euler();
  const _modelQuat = new THREE.Quaternion();
  const _targetQuat = new THREE.Quaternion();
  function poseBone(entry, rx, ry, rz, blend = 1.0) {
    if (!entry) return;
    _animEuler.set(rx, ry, rz, 'XYZ');
    _modelQuat.setFromEuler(_animEuler);
    // Q_local = parentInv * Q_model * parentWorld * base
    _targetQuat
      .copy(entry.parentInv)
      .multiply(_modelQuat)
      .multiply(entry.parentWorld)
      .multiply(entry.base);
    if (blend >= 0.99) entry.bone.quaternion.copy(_targetQuat);
    else entry.bone.quaternion.slerp(_targetQuat, blend);
  }

  function applyRelaxedPose(rig) {
    if (!rig) return;
    poseBone(rig.lArm, -0.05, 0, -0.78, 1.0);
    poseBone(rig.rArm, -0.05, 0, 0.78, 1.0);
    poseBone(rig.lFore, -0.22, 0, 0, 1.0);
    poseBone(rig.rFore, -0.22, 0, 0, 1.0);
  }

  const vipSeats = [
    { x: cx + 24.4, z: cz + 2.4, yaw: -Math.PI / 2, occupiedBy: -1 },
    { x: cx + 24.4, z: cz + 18.4, yaw: -Math.PI / 2, occupiedBy: -1 },
  ];

  const glbAgents = SKELETAL_GLB_SPECS.map((cfg, idx) => {
    const baseY = cfg.zone === 'vip' ? VIP_Y : iy;
    const root = new THREE.Group();
    root.position.set(cx + cfg.pos[0], baseY, cz + cfg.pos[1]);
    interiorGroup.add(root);

    const auraRing = new THREE.Mesh(
      new THREE.RingGeometry(0.46, 0.64, 24),
      new THREE.MeshBasicMaterial({ color: cfg.color, side: THREE.DoubleSide, transparent: true, opacity: 0.62 })
    );
    auraRing.rotation.x = -Math.PI / 2;
    auraRing.position.y = 0.025;
    root.add(auraRing);

    return {
      idx,
      cfg,
      baseY,
      curY: baseY,
      root,
      auraRing,
      inner: null,
      rig: null,
      loaded: false,
      vx: 0,
      vz: 0,
      yaw: (idx * Math.PI) / 3,
      wpIdx: 0,
      aiState: 'DANCING', // 'IDLE' | 'WALKING' | 'DANCING' | 'TALKING' | 'SITTING' | 'STANDING_UP'
      stateTimer: 1.5 + idx * 0.65,
      seatIdx: -1,
      speed: cfg.speed,
      wps: cfg.wps.map(([wx, wz]) => [cx + wx, cz + wz]),
      phase: idx * 1.25,
    };
  });

  // VIP xona va raqs maydoni spotlightlari
  const glbSpotA = new THREE.PointLight(0xf5d0fe, 30, 18, 1.35);
  glbSpotA.position.set(cx + 19.5, VIP_Y + 4.8, cz + 6.5);
  const glbSpotB = new THREE.PointLight(0xfde047, 24, 18, 1.35);
  glbSpotB.position.set(cx + 19.5, VIP_Y + 4.8, cz + 15.5);
  interiorGroup.add(glbSpotA, glbSpotB);

  let glbBaseLoaded = false;
  let glbBaseLoading = false;

  function normalizeGlbScene(model, targetH) {
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const sc = targetH / Math.max(0.01, size.y);
    model.scale.setScalar(sc);
    model.position.set(-center.x * sc, -box.min.y * sc, -center.z * sc);
    model.traverse((obj) => {
      if (obj.isMesh) {
        obj.frustumCulled = obj.isSkinnedMesh ? false : true;
        obj.castShadow = false;
        obj.receiveShadow = false;
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) {
            m.side = THREE.DoubleSide;
            if (typeof m.metalness === 'number' && m.metalness > 0.45) m.metalness = 0.22;
            if (typeof m.roughness === 'number' && m.roughness < 0.35) m.roughness = 0.48;
            m.needsUpdate = true;
          }
        }
      }
    });
  }

  function ensureGlbModelLoaded() {
    if (glbBaseLoaded || glbBaseLoading) return;
    glbBaseLoading = true;
    glbBaseLoaded = true;

    const startLoads = () => {
      // 1) 7 ta yangi Bip01 skeletli GLB modellarni yuklash
      for (const ag of glbAgents) {
        clubGlbLoader.load(
          ag.cfg.file,
          (gltf) => {
            const model = gltf.scene;
            normalizeGlbScene(model, ag.cfg.targetH);
            ag.rig = collectBip01Rig(model);
            if (Object.keys(ag.rig).length < 10) {
              console.warn('[KOKOBANGO] Rig bones missing for', ag.cfg.file, Object.keys(ag.rig));
            }
            applyRelaxedPose(ag.rig);
            ag.inner = model;
            ag.root.add(model);
            ag.loaded = true;
          },
          undefined,
          (err) => {
            console.warn('[KOKOBANGO] GLB load failed:', ag.cfg.file, err);
          }
        );
      }

      // 2) 18.glb haykalini faqat 2 ta VIP Podium ustiga qo'yish
      clubGlbLoader.load(
        './Kokobango/18.glb',
        (gltf) => {
          const baseModel = gltf.scene;
          normalizeGlbScene(baseModel, 1.82);
          vipPodiums.forEach((pd, idx) => {
            const clone = idx === 0 ? baseModel : baseModel.clone(true);
            pd.holder.add(clone);
          });
        },
        undefined,
        (err) => {
          console.warn('[KOKOBANGO] 18.glb load failed:', err);
        }
      );
    };

    if (MeshoptDecoder && MeshoptDecoder.ready && typeof MeshoptDecoder.ready.then === 'function') {
      MeshoptDecoder.ready.then(startLoads, startLoads);
    } else {
      startLoads();
    }
  }

  // O'yin yuklangandan so'ng fon rejimida oldindan yuklab qo'yish
  setTimeout(ensureGlbModelLoaded, 2600);

  // ========================================================================
  // 3. INTERYER NPC LAR — 6 RAQQOSA, 1 DJ, 2 BARMEN, 2 QO'RIQCHI, 7 MEHMON
  // ========================================================================
  const interiorNpcs = [];

  // 1) DJ NPC
  const djNpc = createClubNpc({
    role: 'dj',
    shirt: '#1e1b4b',
    pants: '#09090b',
    headphones: true,
    glasses: true,
    hair: '#09090b',
  });
  djNpc.root.position.set(cx, iy + 1.32, cz - 15.2);
  interiorGroup.add(djNpc.root);
  interiorNpcs.push(djNpc);

  // 2) 6 ta Katta Yoshli Ayol Raqqosa NPC (turli soch turmagi, libos va raqs uslublari)
  const dancerConfigs = [
    { x: cx - 3.6, y: iy + 0.02, z: cz - 3.2, shirt: '#db2777', hair: '#18181b', h: 0, hs: 'long', ds: 0 },
    { x: cx + 3.6, y: iy + 0.02, z: cz - 3.2, shirt: '#7c3aed', hair: '#facc15', h: 0, hs: 'ponytail', ds: 1 },
    { x: cx - 5.2, y: iy + 0.02, z: cz + 1.8, shirt: '#06b6d4', hair: '#78350f', h: 0.4, hs: 'bob', ds: 2 },
    { x: cx + 5.2, y: iy + 0.02, z: cz + 1.8, shirt: '#e11d48', hair: '#09090b', h: -0.4, hs: 'updo', ds: 0 },
    { x: cx - 7.8, y: iy + 1.58, z: cz - 13.0, shirt: '#c026d3', hair: '#18181b', h: 0.2, hs: 'long', ds: 1 }, // Sahnada
    { x: cx + 7.8, y: iy + 1.58, z: cz - 13.0, shirt: '#2563eb', hair: '#f59e0b', h: -0.2, hs: 'ponytail', ds: 2 }, // Sahnada
  ];
  dancerConfigs.forEach((dc, idx) => {
    const npc = createClubNpc({
      role: 'dancer',
      female: true,
      dress: true,
      heels: true,
      hairStyle: dc.hs,
      danceStyle: dc.ds,
      shirt: dc.shirt,
      hair: dc.hair,
      phase: idx * 1.1,
    });
    npc.root.position.set(dc.x, dc.y, dc.z);
    npc.root.rotation.y = dc.h;
    interiorGroup.add(npc.root);
    interiorNpcs.push(npc);
  });

  // 3) 2 ta Barmen NPC (G'arbiy asosiy barda)
  for (const bz of [cz - 2, cz + 4]) {
    const barNpc = createClubNpc({
      role: 'bartender',
      shirt: '#18181b',
      pants: '#09090b',
      hair: '#1c1917',
      phase: bz,
    });
    barNpc.root.position.set(cx - 21.2, iy, bz);
    barNpc.root.rotation.y = Math.PI / 2;
    interiorGroup.add(barNpc.root);
    interiorNpcs.push(barNpc);
  }

  // 4) 2 ta Ichki Qo'riqchi + 1 ta VIP Hostess (VIP eshik oldida kutib oluvchi)
  const intGuards = [
    [cx - 3.2, iy, cz + 19.5, Math.PI * 0.85],
    [cx + 13.7, iy, cz + 14.2, -Math.PI / 2],
  ];
  intGuards.forEach(([gx, gy, gz, gh], i) => {
    const gNpc = createClubNpc({ role: 'guard', shirt: '#09090b', pants: '#09090b', glasses: true, phase: i * 2 });
    gNpc.root.position.set(gx, gy, gz);
    gNpc.root.rotation.y = gh;
    interiorGroup.add(gNpc.root);
    interiorNpcs.push(gNpc);
  });

  const vipHostess = createClubNpc({
    role: 'hostess',
    female: true,
    dress: true,
    heels: true,
    hairStyle: 'updo',
    shirt: '#eab308',
    hair: '#1c1917',
    phase: 0.7,
  });
  vipHostess.root.position.set(cx + 13.7, iy, cz + 9.9);
  vipHostess.root.rotation.y = -Math.PI / 2;
  interiorGroup.add(vipHostess.root);
  interiorNpcs.push(vipHostess);

  // 5) VIP Xona divanlarida o'tirgan mehmonlar (bokallar bilan) va Asosiy zal bar mehmonlari
  const seatedGuests = [
    [cx + 24.8, VIP_Y + 0.08, cz + 2.3, -Math.PI / 2, true, '#ec4899', 'long', '#18181b'],
    [cx + 24.8, VIP_Y + 0.08, cz + 4.7, -Math.PI / 2, true, '#a855f7', 'bob', '#facc15'],
    [cx + 24.8, VIP_Y + 0.08, cz + 16.5, -Math.PI / 2, true, '#e11d48', 'updo', '#78350f'],
  ];
  seatedGuests.forEach(([sx, sy, sz, sh, fem, col, hs, hr], i) => {
    const sg = createClubNpc({
      role: 'visitor',
      sitting: true,
      female: fem,
      dress: fem,
      heels: fem,
      hairStyle: hs,
      hair: hr,
      hasGlass: true,
      shirt: col,
      phase: i * 1.4,
    });
    sg.root.position.set(sx, sy, sz);
    sg.root.rotation.y = sh;
    interiorGroup.add(sg.root);
    interiorNpcs.push(sg);
  });

  const standingGuests = [
    [cx - 15.8, iy, cz - 1.4, -Math.PI / 2, false, '#2563eb', 'long', '#09090b', false],
    [cx - 15.8, iy, cz + 0.4, -Math.PI / 2, true, '#e11d48', 'ponytail', '#78350f', true],
  ];
  standingGuests.forEach(([sx, sy, sz, sh, fem, col, hs, hr, gl], i) => {
    const sg = createClubNpc({
      role: 'visitor',
      female: fem,
      dress: fem,
      heels: fem,
      hairStyle: hs,
      hair: hr,
      hasGlass: gl,
      shirt: col,
      phase: i + 1,
    });
    sg.root.position.set(sx, sy, sz);
    sg.root.rotation.y = sh;
    interiorGroup.add(sg.root);
    interiorNpcs.push(sg);
  });

  // Raqs maydoni atrofida yuruvchi 2 ta mehmon
  const walkLoop = [
    [cx - 11, cz - 8],
    [cx + 11, cz - 8],
    [cx + 11, cz + 12],
    [cx - 11, cz + 12],
  ];
  for (let w = 0; w < 2; w++) {
    const wn = createClubNpc({
      role: 'walker',
      female: w === 1,
      dress: w === 1,
      shirt: w === 0 ? '#0284c7' : '#d946ef',
      phase: w * 3.1,
    });
    wn.wpIdx = w * 2;
    wn.root.position.set(walkLoop[wn.wpIdx][0], iy, walkLoop[wn.wpIdx][1]);
    interiorGroup.add(wn.root);
    interiorNpcs.push(wn);
  }

  // LED Ekran chizish yordamchisi
  let lastLedDraw = 0;
  function drawLedScreens(t, beat, isInside) {
    if (t - lastLedDraw < 0.045) return; // ~22 FPS silliq yangilanish
    lastLedDraw = t;

    if (!isInside) {
      const g = extLedCtx;
      g.fillStyle = '#070312';
      g.fillRect(0, 0, 512, 256);
      const bars = 24;
      for (let i = 0; i < bars; i++) {
        const h = 30 + Math.abs(Math.sin(t * 4.5 + i * 0.45)) * 130;
        g.fillStyle = i % 2 === 0 ? '#e879f9' : '#00e5ff';
        g.fillRect(16 + i * 20, 240 - h, 14, h);
      }
      g.fillStyle = '#ffffff';
      g.font = '900 42px "Segoe UI", Arial, sans-serif';
      g.textAlign = 'center';
      g.fillText('KOKOBANGO CLUB', 256, 58);
      extLedTex.needsUpdate = true;
    } else {
      const g = ledCtx;
      const grad = g.createLinearGradient(0, 0, 1024, 512);
      grad.addColorStop(0, '#180312');
      grad.addColorStop(0.5, `hsl(${(320 + Math.sin(t * 0.4) * 28) % 360}, 75%, 16%)`);
      grad.addColorStop(1, '#09020f');
      g.fillStyle = grad;
      g.fillRect(0, 0, 1024, 512);

      // Warm golden & crimson spotlight cones
      for (let s = 0; s < 3; s++) {
        const sx = 220 + s * 292 + Math.sin(t * 1.1 + s * 2) * 55;
        const sg = g.createRadialGradient(sx, 250, 10, sx, 250, 220);
        sg.addColorStop(0, s === 1 ? 'rgba(251, 191, 36, 0.34)' : 'rgba(244, 63, 94, 0.32)');
        sg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = sg;
        g.fillRect(0, 0, 1024, 512);
      }

      // Elegant animated adult dancer silhouettes (non-explicit fashion motif)
      for (let d = 0; d < 2; d++) {
        const dx = d === 0 ? 190 : 834;
        const sway = Math.sin(t * 2.4 + d * Math.PI) * 10;
        g.save();
        g.translate(dx + sway, 325);
        g.fillStyle = 'rgba(12, 3, 18, 0.88)';
        g.strokeStyle = 'rgba(251, 191, 36, 0.65)';
        g.lineWidth = 3;
        g.beginPath();
        g.arc(0, -108, 18, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.moveTo(-24, -72);
        g.lineTo(24, -72);
        g.lineTo(14, -12);
        g.quadraticCurveTo(42, 72, 54, 155);
        g.lineTo(-48, 155);
        g.quadraticCurveTo(-36, 72, -14, -12);
        g.closePath();
        g.fill();
        g.stroke();
        g.restore();
      }

      // Pulsing rings
      g.strokeStyle = `rgba(251, 191, 36, ${0.35 + beat * 0.5})`;
      g.lineWidth = 6 + beat * 6;
      g.beginPath();
      g.arc(512, 256, 85 + beat * 65, 0, Math.PI * 2);
      g.stroke();

      // Equalizer bars
      for (let i = 0; i < 48; i++) {
        const h = (32 + Math.abs(Math.sin(t * 7 + i * 0.35)) * 175) * (0.65 + beat * 0.55);
        g.fillStyle = `hsl(${(310 + i * 2.5 + t * 35) % 360}, 90%, 58%)`;
        g.fillRect(24 + i * 20.5, 502 - h, 13, h);
      }

      g.fillStyle = '#ffffff';
      g.font = '900 74px "Segoe UI", Arial, sans-serif';
      g.textAlign = 'center';
      g.shadowColor = '#f43f5e';
      g.shadowBlur = 24;
      g.fillText('KOKOBANGO 21+', 512, 240);
      g.font = '700 28px "Segoe UI", Arial, sans-serif';
      g.fillStyle = '#fde047';
      g.shadowColor = '#f59e0b';
      g.fillText('GLAMOUR NIGHTS · VIP LOUNGE', 512, 288);
      g.shadowBlur = 0;
      ledTex.needsUpdate = true;

      // Digital Wall Panels (512x256)
      const pg = panelCtx;
      const pGrad = pg.createLinearGradient(0, 0, 512, 256);
      pGrad.addColorStop(0, '#16041b');
      pGrad.addColorStop(1, '#31071e');
      pg.fillStyle = pGrad;
      pg.fillRect(0, 0, 512, 256);
      pg.strokeStyle = 'rgba(251, 191, 36, 0.45)';
      pg.lineWidth = 3;
      for (let w = 0; w < 4; w++) {
        pg.beginPath();
        for (let x = 0; x <= 512; x += 16) {
          const y = 128 + Math.sin(x * 0.02 + t * 2.2 + w * 0.9) * (34 + beat * 28);
          if (x === 0) pg.moveTo(x, y);
          else pg.lineTo(x, y);
        }
        pg.stroke();
      }
      pg.fillStyle = '#fde047';
      pg.font = '800 32px "Segoe UI", Arial, sans-serif';
      pg.textAlign = 'center';
      pg.fillText('KOKOBANGO · 21+', 256, 138);
      panelTex.needsUpdate = true;
    }
  }

  // ========================================================================
  // 4. HOJATXONA (WC) VA ROOFTOP TERRACE (OCHIQ OSMON OSTIDAGI LOUNGE)
  // ========================================================================
  const ROOF_Y = iy + 11.0;
  const rooftopColliders = [];
  const addRoofCol = (x0, z0, x1, z1) => {
    rooftopColliders.push({ minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1) });
  };

  // Asosiy zal chap-orqa burchakdagi Hojatxona (WC) zonasi
  const wcAlcoveFrame = new THREE.Mesh(new THREE.BoxGeometry(5.6, 3.8, 0.35), mObsidian);
  wcAlcoveFrame.position.set(cx - 21.5, iy + 1.9, cz - 14.8);
  const wcAlcoveSign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 0.8),
    new THREE.MeshBasicMaterial({ map: makeSignTexture('WC · RESTROOMS', 'GENTLEMEN & LADIES', '#090915', '#00e5ff', '#e879f9', 256, 96) })
  );
  wcAlcoveSign.position.set(cx - 21.5, iy + 3.4, cz - 14.6);
  const wcAlcoveVanity = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.95, 0.8), mMarble);
  wcAlcoveVanity.position.set(cx - 21.5, iy + 0.48, cz - 16.4);
  const wcAlcoveMirror = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.5, 0.08), mGlass);
  wcAlcoveMirror.position.set(cx - 21.5, iy + 1.9, cz - 16.75);
  interiorGroup.add(wcAlcoveFrame, wcAlcoveSign, wcAlcoveVanity, wcAlcoveMirror);
  addIntCol(cx - 23.6, cz - 16.9, cx - 19.4, cz - 15.9);

  // Asosiy zaldagi Rooftop Terrace shisha lifti portali (cx - 19.5, cz + 14.5)
  const elevBox = new THREE.Mesh(new THREE.BoxGeometry(3.4, 4.2, 3.4), mGlass);
  elevBox.position.set(cx - 19.5, iy + 2.1, cz + 14.5);
  const elevTrim = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.2, 3.6), mNeonCyan);
  elevTrim.position.set(cx - 19.5, iy + 4.25, cz + 14.5);
  const elevSign = new THREE.Mesh(
    new THREE.PlaneGeometry(3.0, 0.9),
    new THREE.MeshBasicMaterial({ map: makeSignTexture('ROOFTOP TERRACE', 'SKY LOUNGE · [E]', '#070b18', '#00e5ff', '#f0abfc', 256, 96) })
  );
  elevSign.position.set(cx - 19.5, iy + 3.5, cz + 12.74);
  elevSign.rotation.y = Math.PI;
  interiorGroup.add(elevBox, elevTrim, elevSign);

  // ROOFTOP TERRACE — Ochiq osmon ostidagi hashamatli terasa (38m x 28m)
  const roofFloor = new THREE.Mesh(
    new THREE.BoxGeometry(38, 0.4, 28),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.42, metalness: 0.25 })
  );
  roofFloor.position.set(cx, ROOF_Y - 0.2, cz);
  interiorGroup.add(roofFloor);

  // Rooftop atrofida shisha to'siqlar va neon tutqichlar
  const railSpecs = [
    [cx, ROOF_Y + 0.65, cz - 13.9, 38, 1.3, 0.2],
    [cx, ROOF_Y + 0.65, cz + 13.9, 38, 1.3, 0.2],
    [cx - 18.9, ROOF_Y + 0.65, cz, 0.2, 1.3, 28],
    [cx + 18.9, ROOF_Y + 0.65, cz, 0.2, 1.3, 28],
  ];
  for (const [rx, ry, rz, rw, rh, rd] of railSpecs) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, rd), mGlass);
    rail.position.set(rx, ry, rz);
    interiorGroup.add(rail);
  }
  addRoofCol(cx - 20, cz - 15, cx + 20, cz - 13.7);
  addRoofCol(cx - 20, cz + 13.7, cx + 20, cz + 15);
  addRoofCol(cx - 20, cz - 15, cx - 18.7, cz + 15);
  addRoofCol(cx + 18.7, cz - 15, cx + 20, cz + 15);

  // Rooftop Pergola ustunlari va neon nurlar
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pCol = new THREE.Mesh(new THREE.BoxGeometry(0.45, 4.2, 0.45), mObsidian);
      pCol.position.set(cx + sx * 12, ROOF_Y + 2.1, cz + sz * 9);
      interiorGroup.add(pCol);
    }
  }
  for (let bz = -8; bz <= 8; bz += 4) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(24.5, 0.16, 0.22), mNeonPurple);
    beam.position.set(cx, ROOF_Y + 4.2, cz + bz);
    interiorGroup.add(beam);
  }
  const roofLightA = new THREE.PointLight(0xe879f9, 26, 28, 1.4);
  roofLightA.position.set(cx - 6, ROOF_Y + 4.0, cz);
  const roofLightB = new THREE.PointLight(0x00e5ff, 26, 28, 1.4);
  roofLightB.position.set(cx + 6, ROOF_Y + 4.0, cz);
  interiorGroup.add(roofLightA, roofLightB);

  // Tungi Toshkent osmono'par binolari silueti (Rooftop atrofi manzarasi)
  const skyTowerMat = new THREE.MeshStandardMaterial({ color: 0x090d1a, emissive: 0x1e1b4b, emissiveIntensity: 0.45, roughness: 0.6 });
  for (let ti = 0; ti < 14; ti++) {
    const ang = (ti / 14) * Math.PI * 2;
    const dist = 46 + (ti % 3) * 14;
    const th = 22 + (ti % 4) * 11;
    const tw = 6 + (ti % 3) * 3;
    const tower = new THREE.Mesh(new THREE.BoxGeometry(tw, th, tw), skyTowerMat);
    tower.position.set(cx + Math.cos(ang) * dist, ROOF_Y - 12 + th * 0.5, cz + Math.sin(ang) * dist);
    const crown = new THREE.Mesh(new THREE.BoxGeometry(tw + 0.3, 0.4, tw + 0.3), ti % 2 === 0 ? mNeonCyan : mNeonPurple);
    crown.position.set(tower.position.x, ROOF_Y - 12 + th + 0.2, tower.position.z);
    interiorGroup.add(tower, crown);
  }

  // Rooftop Bar va Barmen
  const roofBar = new THREE.Mesh(new THREE.BoxGeometry(7.2, 1.15, 1.4), mObsidian);
  roofBar.position.set(cx, ROOF_Y + 0.58, cz - 9.5);
  const roofBarTop = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.12, 1.6), mNeonCyan);
  roofBarTop.position.set(cx, ROOF_Y + 1.18, cz - 9.5);
  interiorGroup.add(roofBar, roofBarTop);
  addRoofCol(cx - 3.8, cz - 10.4, cx + 3.8, cz - 8.6);

  const roofBartender = createClubNpc({ role: 'bartender', shirt: '#18181b', pants: '#09090b', phase: 1.9 });
  roofBartender.root.position.set(cx, ROOF_Y, cz - 11.2);
  interiorGroup.add(roofBartender.root);

  // Rooftop Lounge Divanlari va Stollari
  for (const sx of [-1, 1]) {
    const rSofa = createDetailedSofa(3.8, 0x312e81, 0x00e5ff);
    rSofa.position.set(cx + sx * 10.5, ROOF_Y, cz);
    rSofa.rotation.y = sx < 0 ? Math.PI / 2 : -Math.PI / 2;
    const rTable = createDetailedVipTable(0x00e5ff);
    rTable.position.set(cx + sx * 7.8, ROOF_Y, cz);
    interiorGroup.add(rSofa, rTable);
    addRoofCol(cx + sx * 10.5 - 1.1, cz - 2.0, cx + sx * 10.5 + 1.1, cz + 2.0);
    addRoofCol(cx + sx * 7.8 - 0.8, cz - 0.8, cx + sx * 7.8 + 0.8, cz + 0.8);
  }

  // Rooftop Liftdan pastga tushish portali (cx - 14.5, ROOF_Y, cz + 10.5)
  const roofElev = new THREE.Mesh(new THREE.BoxGeometry(3.0, 3.6, 3.0), mGlass);
  roofElev.position.set(cx - 14.5, ROOF_Y + 1.8, cz + 10.5);
  const roofElevSign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 0.8),
    new THREE.MeshBasicMaterial({ map: makeSignTexture('MAIN CLUB', 'DOWN · [E]', '#070b18', '#e879f9', '#00e5ff', 256, 96) })
  );
  roofElevSign.position.set(cx - 14.5, ROOF_Y + 3.0, cz + 8.95);
  roofElevSign.rotation.y = Math.PI;
  interiorGroup.add(roofElev, roofElevSign);

  // Rooftop ijtimoiy NPC mehmonlari
  const rooftopNpcs = [roofBartender];
  const roofGuestSpecs = [
    { x: cx - 5.5, z: cz + 2.5, h: 0.9, dress: '#a855f7', role: 'guest' },
    { x: cx - 4.4, z: cz + 3.2, h: -2.1, dress: '#0284c7', role: 'guest' },
    { x: cx + 5.8, z: cz - 1.8, h: -1.1, dress: '#ec4899', role: 'dancer' },
  ];
  roofGuestSpecs.forEach((rg, idx) => {
    const npc = createClubNpc({ role: rg.role, shirt: rg.dress, pants: '#0f172a', phase: idx * 1.4 });
    npc.root.position.set(rg.x, ROOF_Y, rg.z);
    npc.root.rotation.y = rg.h;
    interiorGroup.add(npc.root);
    rooftopNpcs.push(npc);
  });

  // Kirish va Chiqish koordinatalari
  const entrancePos = { x: cx, y: 0.72, z: cz - 31.5, r: 6.5 };
  const parkDropOff = { x: cx, z: cz - 42.5, heading: Math.PI };
  const insideSpawn = { x: cx, y: iy, z: cz + 19.0, heading: Math.PI };
  const exitPos = { x: cx, y: iy, z: cz + 21.5, r: 3.8 };

  let vipUnlocked = false;
  const NPC_DIALOGUES = [
    '💬 Mehmon (21+): "KOKOBANGO CLUB muhiti va musiqasi bugun juda zo‘r!"',
    '💬 Mehmon (21+): "DJ sahnadagi lazer shou haqiqiy Toshkent tungi hayoti!"',
    '💬 VIP Styuardessa (21+): "VIP Lounge zonasida maxsus alkogolsiz kokteyllar va qulay divanlar bor."',
    '💬 Mehmon (21+): "Sahnadagi raqs ijrolari juda professional chiqibdi!"',
    '💬 Mehmon (21+): "Rooftop terrasadan tungi shahar manzarasi ajoyib ko‘rinadi."',
  ];

  return {
    cx,
    cz,
    interiorY: iy,
    rooftopY: ROOF_Y,
    entrancePos,
    parkDropOff,
    insideSpawn,
    exitPos,
    interiorColliders,
    rooftopColliders,
    exteriorGroup,
    interiorGroup,
    music,

    setVipUnlocked(v) {
      vipUnlocked = !!v;
      vipPrivacyDoor.visible = !vipUnlocked;
      if (vipUnlocked) {
        vipDoorCollider.minX = -99999;
        vipDoorCollider.maxX = -99999;
      } else {
        vipDoorCollider.minX = cx + 14.2;
        vipDoorCollider.maxX = cx + 14.8;
      }
    },

    isVipUnlocked() {
      return vipUnlocked;
    },

    setInside(inside) {
      interiorGroup.visible = inside;
      exteriorGroup.visible = !inside;
      if (inside) {
        ensureGlbModelLoaded();
        music.start();
      } else {
        music.stop();
      }
    },

    nearEntrance(px, pz) {
      return Math.hypot(px - entrancePos.x, pz - entrancePos.z) < entrancePos.r;
    },

    nearExit(px, pz, py = iy) {
      if (py > iy + 5.0) return false;
      return Math.hypot(px - exitPos.x, pz - exitPos.z) < exitPos.r;
    },

    getCollidersAt(py = iy) {
      return py > iy + 5.0 ? rooftopColliders : interiorColliders;
    },

    getFloorY(px, pz, curY = iy) {
      if (curY > iy + 5.0) return ROOF_Y;
      if (px >= cx + 14.5 && px <= cx + 27.6 && pz >= cz - 2.0 && pz <= cz + 22.5) {
        return VIP_Y;
      }
      return iy;
    },

    getZoneInfo(px, py, pz) {
      if (py > iy + 5.0) return { label: '🌃 Rooftop Terrace', musicZone: 'rooftop' };
      if (px >= cx + 14.5 && px <= cx + 27.6 && pz >= cz - 2.0 && pz <= cz + 22.5) {
        return { label: '👑 VIP Lounge (21+)', musicZone: 'vip' };
      }
      if (Math.hypot(px - (cx - 16.5), pz - (cz + 1.0)) < 5.0) {
        return { label: '🍹 KOKOBANGO BAR', musicZone: 'main' };
      }
      if (Math.hypot(px - cx, pz - (cz - 10.8)) < 5.0) {
        return { label: '🎧 DJ Sahna', musicZone: 'main' };
      }
      return { label: '🪩 Main Dance Floor', musicZone: 'main' };
    },

    getNearbySupercar(px, pz) {
      for (const sc of parkedSupercars) {
        if (Math.hypot(px - sc.x, pz - sc.z) < 5.2) return sc;
      }
      return null;
    },

    getInteractable(px, pz, py = iy) {
      if (py > iy + 5.0) {
        if (Math.hypot(px - (cx - 14.5), pz - (cz + 10.5)) < 3.4) {
          return {
            id: 'rooftop_down',
            label: '[E] Asosiy klub zaliga tushish',
            teleport: { x: cx - 19.5, y: iy, z: cz + 11.2, h: Math.PI, msg: '🪩 Asosiy zalga tushdingiz' },
          };
        }
        if (Math.hypot(px - cx, pz - (cz - 8.2)) < 3.6) {
          return { id: 'rooftop_bar', label: '[E] ROOFTOP BAR — Kokteyl buyurtma berish' };
        }
        if (Math.hypot(px - (cx - 9.2), pz - cz) < 2.8) {
          return { id: 'roof_sofa_1', label: "[E] Rooftop Divanga o'tirish", seat: { x: cx - 10.4, y: ROOF_Y + 0.18, z: cz, h: Math.PI / 2 } };
        }
        if (Math.hypot(px - (cx + 9.2), pz - cz) < 2.8) {
          return { id: 'roof_sofa_2', label: "[E] Rooftop Divanga o'tirish", seat: { x: cx + 10.4, y: ROOF_Y + 0.18, z: cz, h: -Math.PI / 2 } };
        }
        return null;
      }
      if (Math.hypot(px - (cx - 19.5), pz - (cz + 14.5)) < 3.5) {
        return {
          id: 'rooftop_up',
          label: '[E] ROOFTOP TERRACE (Sky Lounge) ga chiqish',
          teleport: { x: cx - 14.5, y: ROOF_Y, z: cz + 7.2, h: Math.PI, msg: '🌃 Rooftop Terrace ga chiqdingiz!' },
        };
      }
      if (Math.hypot(px - (cx - 16.5), pz - (cz + 1.0)) < 3.6) {
        return { id: 'bar', label: '[E] KOKOBANGO BAR — Kokteyl buyurtma berish' };
      }
      if (Math.hypot(px - cx, pz - (cz - 10.8)) < 3.4) {
        return { id: 'dj', label: '[E] DJ SAHNASI — Lazer shou / Beat Drop' };
      }
      if (Math.hypot(px - (cx + 23.8), pz - (cz + 3.5)) < 2.8) {
        return { id: 'vip_sofa_1', label: "[E] VIP Divanga o'tirish", seat: { x: cx + 24.5, y: VIP_Y + 0.18, z: cz + 3.5, h: -Math.PI / 2 } };
      }
      if (Math.hypot(px - (cx + 23.8), pz - (cz + 17.5)) < 2.8) {
        return { id: 'vip_sofa_2', label: "[E] VIP Divanga o'tirish", seat: { x: cx + 24.5, y: VIP_Y + 0.18, z: cz + 17.5, h: -Math.PI / 2 } };
      }
      if (Math.hypot(px - (cx + 13.8), pz - (cz + 12.0)) < 2.8) {
        if (!vipUnlocked) {
          return {
            id: 'vip_unlock',
            cost: 25_000_000,
            label: '[E] 👑 VIP LOUNGE (21+) — Batafsil va kirish (25 000 000 so‘m)',
          };
        }
        return { id: 'vip_door', label: '👑 VIP LOUNGE (21+) — Kirish ochiq' };
      }
      if (vipUnlocked && Math.hypot(px - (cx + 21.0), pz - (cz + 0.5)) < 2.6) {
        return { id: 'vip_service', label: '[E] 🥂 VIP Lounge maxsus xizmat va shampan (1 500 000 so‘m)' };
      }
      // Yaqin atrofdagi katta yoshli NPC mehmonlar / raqqosalar bilan suhbat
      let nearNpcIdx = -1;
      let nearNpcDist = 2.6;
      for (let i = 0; i < glbAgents.length; i++) {
        const ag = glbAgents[i];
        const d = Math.hypot(px - ag.root.position.x, pz - ag.root.position.z);
        if (d < nearNpcDist) { nearNpcDist = d; nearNpcIdx = i; }
      }
      if (nearNpcIdx >= 0) {
        return {
          id: 'npc',
          label: '[E] 💬 Mehmon bilan suhbatlashish',
          reply: NPC_DIALOGUES[nearNpcIdx % NPC_DIALOGUES.length],
        };
      }
      for (let i = 0; i < interiorNpcs.length; i++) {
        const n = interiorNpcs[i];
        if (n.role === 'guard' || n.role === 'dj' || n.role === 'bartender') continue;
        const d = Math.hypot(px - n.root.position.x, pz - n.root.position.z);
        if (d < 2.4) {
          return {
            id: 'npc',
            label: '[E] 💬 Suhbatlashish',
            reply: NPC_DIALOGUES[i % NPC_DIALOGUES.length],
          };
        }
      }
      return null;
    },

    beatDropBoost: 0,
    triggerBeatDrop() {
      this.beatDropBoost = 3.5;
    },

    update(dt, t, isInside, playerDistSq = 0) {
      const beat = music.getBeatPulse();
      if (!isInside) {
        parkedCarsGroup.visible = playerDistSq < 240 * 240;
        // Osmon projektori va tashqi LED ekran faqat yaqin bo'lsa yangilanadi
        if (playerDistSq < 600 * 600) {
          skyBeams[0].rotation.z = Math.sin(t * 0.65) * 0.38;
          skyBeams[0].rotation.x = Math.cos(t * 0.5) * 0.25;
          skyBeams[1].rotation.z = -Math.sin(t * 0.65) * 0.38;
          skyBeams[1].rotation.x = -Math.cos(t * 0.5) * 0.25;
          extLight.intensity = 2.6 + Math.sin(t * 4) * 0.8;
        }
        if (playerDistSq < 180 * 180) {
          drawLedScreens(t, 0.5, false);
          for (const npc of exteriorNpcs) npc.update(dt, t, 0);
          const doorOpen = playerDistSq < 55 * 55 ? 1.85 : 0;
          doorLeft.position.x += ((cx - 1.15 - doorOpen) - doorLeft.position.x) * Math.min(1, dt * 6);
          doorRight.position.x += ((cx + 1.15 + doorOpen) - doorRight.position.x) * Math.min(1, dt * 6);
        }
        return;
      }

      // Interyer animatsiyalari (beat-synced)
      drawLedScreens(t, beat, true);

      // Raqs maydoni plitkalari
      const c1 = new THREE.Color().setHSL((t * 0.15) % 1, 0.85, 0.28 + beat * 0.28);
      const c2 = new THREE.Color().setHSL((t * 0.15 + 0.35) % 1, 0.9, 0.22 + beat * 0.25);
      for (const tile of danceTiles) {
        const checker = (Math.floor(tile.ix) + Math.floor(tile.iz)) % 2 === 0;
        tile.mat.color.copy(checker ? c1 : c2);
      }

      // Shift projektorlari va lazerlar
      for (const sp of spotlights) {
        sp.head.rotation.x = Math.sin(t * 1.4 + sp.phase) * 0.52;
        sp.head.rotation.z = Math.cos(t * 1.1 + sp.phase) * 0.58;
        sp.mat.opacity = 0.09 + beat * 0.14;
      }
      for (let hi = 0; hi < stageHazeMats.length; hi++) {
        stageHazeMats[hi].opacity = 0.06 + beat * 0.09 + Math.sin(t * 1.2 + hi) * 0.02;
      }
      for (const ls of lasers) {
        ls.pivot.rotation.y = Math.sin(t * 2.2 + ls.phase) * 0.45;
        ls.pivot.rotation.x = Math.cos(t * 1.8 + ls.phase) * 0.18;
        ls.mat.opacity = 0.32 + beat * 0.55;
      }
      intStageLight.intensity = 52 + beat * 38;
      discoGroup.rotation.y += dt * 0.9;
      discoRing.rotation.z += dt * 1.4;
      for (const eq of eqBars) {
        const h = 1.2 + (0.5 + 0.5 * Math.sin(t * 7.5 + eq.phase)) * (1.8 + beat * 3.4);
        eq.mesh.scale.y = h;
        eq.mesh.position.y = iy + 0.9 + h * 0.5;
      }

      // Shiftdagi neon halqalar va CO2 sahna tutuni (beat-synced)
      for (const cr of ceilRings) {
        cr.mesh.position.y = cr.baseY + Math.sin(t * 2.4 + cr.phase) * 0.25;
        cr.mesh.scale.setScalar(1 + beat * 0.08);
        cr.mat.opacity = 0.52 + beat * 0.42;
      }
      co2Mat.opacity = beat > 0.62 ? (beat - 0.62) * 1.4 : Math.max(0, co2Mat.opacity - dt * 1.5);
      for (const jet of co2Jets) {
        jet.scale.set(1 + beat * 0.3, 0.7 + beat * 0.7, 1 + beat * 0.3);
      }

      // VIP podiumlardagi 18.glb haykallari mayin aylanadi
      vipChandelier.rotation.z += dt * 0.6;
      for (let pi = 0; pi < vipPodiums.length; pi++) {
        vipPodiums[pi].holder.rotation.y = vipPodiums[pi].baseRot + Math.sin(t * 0.55 + pi * 1.5) * 0.35;
      }

      // 7 ta Bip01 skeletli GLB modellar — haqiqiy oyoq/qo'l/bel animatsiyasi, blending va AI holatlari
      glbSpotA.intensity = 24 + beat * 14;
      glbSpotB.intensity = 22 + beat * 12;
      const radius = 0.44;
      const animBlend = Math.min(1, dt * 8.5);
      for (let i = 0; i < glbAgents.length; i++) {
        const ag = glbAgents[i];
        if (!ag.loaded) continue;
        ag.auraRing.scale.setScalar(1 + beat * 0.20);
        ag.stateTimer -= dt;

        let wantVx = 0;
        let wantVz = 0;

        if (ag.aiState === 'SITTING') {
          if (ag.stateTimer <= 0) {
            ag.aiState = 'STANDING_UP';
            ag.stateTimer = 0.65;
          }
        } else if (ag.aiState === 'STANDING_UP') {
          if (ag.stateTimer <= 0) {
            if (ag.seatIdx >= 0 && vipSeats[ag.seatIdx]) {
              vipSeats[ag.seatIdx].occupiedBy = -1;
              ag.seatIdx = -1;
            }
            ag.aiState = 'WALKING';
            ag.wpIdx = (ag.wpIdx + 1) % ag.wps.length;
            ag.stateTimer = 5.0;
          }
        } else if (ag.aiState === 'WALKING') {
          const targetPt = ag.seatIdx >= 0 ? [vipSeats[ag.seatIdx].x - 0.65, vipSeats[ag.seatIdx].z] : ag.wps[ag.wpIdx];
          const dx = targetPt[0] - ag.root.position.x;
          const dz = targetPt[1] - ag.root.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.65 || ag.stateTimer <= 0) {
            if (ag.seatIdx >= 0) {
              ag.aiState = 'SITTING';
              ag.stateTimer = 5.5 + (i % 2) * 2.5;
            } else {
              ag.wpIdx = (ag.wpIdx + 1) % ag.wps.length;
              const roll = (i + ag.wpIdx) % 4;
              ag.aiState = roll === 0 ? 'IDLE' : roll === 1 ? 'TALKING' : 'DANCING';
              ag.stateTimer = 3.2 + (i % 3) * 1.1;
            }
          } else {
            const slowFactor = dist < 1.5 ? Math.max(0.45, dist / 1.5) : 1.0;
            wantVx = (dx / dist) * ag.speed * slowFactor;
            wantVz = (dz / dist) * ag.speed * slowFactor;
          }
        } else if (ag.stateTimer <= 0) {
          // IDLE, DANCING yoki TALKING dan keyin yurishga yoki VIP divanga o'tish
          if (ag.cfg.zone === 'vip' && (i + Math.floor(t)) % 3 === 0) {
            const freeIdx = vipSeats.findIndex((s) => s.occupiedBy === -1);
            if (freeIdx >= 0) {
              vipSeats[freeIdx].occupiedBy = i;
              ag.seatIdx = freeIdx;
            }
          }
          ag.aiState = 'WALKING';
          ag.stateTimer = 8.0;
        }

        // Boshqa GLB modellardan masofa saqlash (SITTING holatidan tashqari)
        if (ag.aiState !== 'SITTING' && ag.aiState !== 'STANDING_UP') {
          for (let j = 0; j < glbAgents.length; j++) {
            if (i === j || !glbAgents[j].loaded) continue;
            const other = glbAgents[j];
            const sx = ag.root.position.x - other.root.position.x;
            const sz = ag.root.position.z - other.root.position.z;
            const sd = Math.hypot(sx, sz);
            if (sd > 0.001 && sd < 1.32) {
              const push = ((1.32 - sd) / 1.32) * 2.3;
              wantVx += (sx / sd) * push;
              wantVz += (sz / sd) * push;
            }
          }
        }

        const accel = Math.min(1, dt * 7.5);
        ag.vx += (wantVx - ag.vx) * accel;
        ag.vz += (wantVz - ag.vz) * accel;

        const curSpd = Math.hypot(ag.vx, ag.vz);
        const minX = ag.cfg.zone === 'vip' ? cx + 15.2 : cx - 15.5;
        const maxX = ag.cfg.zone === 'vip' ? cx + 26.2 : cx + 13.0;
        const minZ = ag.cfg.zone === 'vip' ? cz + 0.5 : cz - 10.5;
        const maxZ = ag.cfg.zone === 'vip' ? cz + 20.8 : cz + 18.5;

        let nx = Math.max(minX, Math.min(maxX, ag.root.position.x + ag.vx * dt));
        let nz = Math.max(minZ, Math.min(maxZ, ag.root.position.z + ag.vz * dt));

        if (ag.aiState !== 'SITTING') {
          for (const c of interiorColliders) {
            if (nx > c.minX - radius && nx < c.maxX + radius && nz > c.minZ - radius && nz < c.maxZ + radius) {
              const dl = Math.abs(nx - (c.minX - radius));
              const dr = Math.abs((c.maxX + radius) - nx);
              const dtMin = Math.abs(nz - (c.minZ - radius));
              const db = Math.abs((c.maxZ + radius) - nz);
              const m = Math.min(dl, dr, dtMin, db);
              if (m === dl) { nx = c.minX - radius; ag.vx = Math.min(0, ag.vx); }
              else if (m === dr) { nx = c.maxX + radius; ag.vx = Math.max(0, ag.vx); }
              else if (m === dtMin) { nz = c.minZ - radius; ag.vz = Math.min(0, ag.vz); }
              else { nz = c.maxZ + radius; ag.vz = Math.max(0, ag.vz); }
            }
          }
        }

        if (ag.aiState === 'SITTING' && ag.seatIdx >= 0) {
          const seat = vipSeats[ag.seatIdx];
          nx += (seat.x - nx) * Math.min(1, dt * 6);
          nz += (seat.z - nz) * Math.min(1, dt * 6);
        }

        ag.root.position.x = nx;
        ag.root.position.z = nz;
        const targetY = ag.aiState === 'SITTING' ? ag.baseY - 0.36 : ag.baseY;
        ag.curY += (targetY - ag.curY) * Math.min(1, dt * 7);
        ag.root.position.y = ag.curY;

        if (ag.aiState === 'SITTING' && ag.seatIdx >= 0) {
          const seatYaw = vipSeats[ag.seatIdx].yaw;
          let dy = seatYaw - ag.yaw;
          dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          ag.yaw += dy * Math.min(1, dt * 6);
          ag.root.rotation.y = ag.yaw;
          if (ag.rig) {
            poseBone(ag.rig.pelvis, 0, 0, 0, animBlend);
            poseBone(ag.rig.spine, 0.06, Math.sin(t * 1.2 + ag.phase) * 0.06, 0, animBlend);
            poseBone(ag.rig.head, Math.sin(t * 1.8 + ag.phase) * 0.06, Math.sin(t * 0.9 + ag.phase) * 0.16, 0, animBlend);
            poseBone(ag.rig.lThigh, -1.42, 0.08, 0, animBlend);
            poseBone(ag.rig.rThigh, -1.42, -0.08, 0, animBlend);
            poseBone(ag.rig.lCalf, 1.42, 0, 0, animBlend);
            poseBone(ag.rig.rCalf, 1.42, 0, 0, animBlend);
            poseBone(ag.rig.lArm, -0.18, 0, -0.72, animBlend);
            poseBone(ag.rig.rArm, -0.22 + Math.sin(t * 2.1 + ag.phase) * 0.08, 0, 0.72, animBlend);
            poseBone(ag.rig.lFore, -0.45, 0, 0, animBlend);
            poseBone(ag.rig.rFore, -0.65, 0, 0, animBlend);
          }
        } else if (curSpd > 0.18 && ag.aiState === 'WALKING') {
          const targetYaw = Math.atan2(ag.vx, ag.vz);
          let dy = targetYaw - ag.yaw;
          dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          ag.yaw += dy * Math.min(1, dt * 8.0);
          ag.root.rotation.y = ag.yaw;

          const w = t * 5.8 + ag.phase;
          const amp = Math.min(1, curSpd / ag.speed);
          if (ag.rig) {
            const s = Math.sin(w);
            const c = Math.cos(w);
            poseBone(ag.rig.pelvis, 0, s * 0.06 * amp, c * 0.025 * amp, animBlend);
            poseBone(ag.rig.spine, 0.04 * amp, -s * 0.06 * amp, 0, animBlend);
            poseBone(ag.rig.head, 0, s * 0.04, 0, animBlend);
            poseBone(ag.rig.lThigh, -s * 0.44 * amp, 0, 0, animBlend);
            poseBone(ag.rig.rThigh, s * 0.44 * amp, 0, 0, animBlend);
            poseBone(ag.rig.lCalf, Math.max(0, c) * 0.55 * amp, 0, 0, animBlend);
            poseBone(ag.rig.rCalf, Math.max(0, -c) * 0.55 * amp, 0, 0, animBlend);
            poseBone(ag.rig.lArm, s * 0.34 * amp, 0, -0.78, animBlend);
            poseBone(ag.rig.rArm, -s * 0.34 * amp, 0, 0.78, animBlend);
            poseBone(ag.rig.lFore, -0.28 - Math.max(0, -s) * 0.25 * amp, 0, 0, animBlend);
            poseBone(ag.rig.rFore, -0.28 - Math.max(0, s) * 0.25 * amp, 0, 0, animBlend);
          }
        } else if (ag.aiState === 'IDLE' || ag.aiState === 'STANDING_UP') {
          const breath = Math.sin(t * 2.1 + ag.phase);
          if (ag.rig) {
            poseBone(ag.rig.pelvis, 0, 0, 0, animBlend);
            poseBone(ag.rig.spine, breath * 0.025, Math.sin(t * 0.7 + ag.phase) * 0.04, 0, animBlend);
            poseBone(ag.rig.head, breath * 0.03, Math.sin(t * 0.9 + ag.phase) * 0.14, 0, animBlend);
            poseBone(ag.rig.lThigh, 0, 0, 0, animBlend);
            poseBone(ag.rig.rThigh, 0, 0, 0, animBlend);
            poseBone(ag.rig.lCalf, 0, 0, 0, animBlend);
            poseBone(ag.rig.rCalf, 0, 0, 0, animBlend);
            poseBone(ag.rig.lArm, -0.05, 0, -0.78, animBlend);
            poseBone(ag.rig.rArm, -0.05, 0, 0.78, animBlend);
            poseBone(ag.rig.lFore, -0.22, 0, 0, animBlend);
            poseBone(ag.rig.rFore, -0.22, 0, 0, animBlend);
          }
        } else if (ag.aiState === 'TALKING') {
          const talk = Math.sin(t * 3.4 + ag.phase);
          if (ag.rig) {
            poseBone(ag.rig.pelvis, 0, Math.sin(t * 1.1 + ag.phase) * 0.05, 0, animBlend);
            poseBone(ag.rig.spine, talk * 0.03, Math.cos(t * 1.5 + ag.phase) * 0.06, 0, animBlend);
            poseBone(ag.rig.head, talk * 0.08, Math.sin(t * 1.9 + ag.phase) * 0.22, 0, animBlend);
            poseBone(ag.rig.lThigh, 0, 0, 0, animBlend);
            poseBone(ag.rig.rThigh, 0, 0, 0, animBlend);
            poseBone(ag.rig.lCalf, 0, 0, 0, animBlend);
            poseBone(ag.rig.rCalf, 0, 0, 0, animBlend);
            poseBone(ag.rig.lArm, -0.15 + talk * 0.12, 0, -0.74, animBlend);
            poseBone(ag.rig.rArm, -0.35 - talk * 0.18, 0, 0.70, animBlend);
            poseBone(ag.rig.lFore, -0.45, 0, 0, animBlend);
            poseBone(ag.rig.rFore, -0.85 + talk * 0.22, 0, 0, animBlend);
          }
        } else {
          // DANCING (har bir NPC uchun turlicha raqs uslublari)
          const lookYaw = ag.cfg.zone === 'vip'
            ? Math.atan2(cx + 18.0 - nx, cz + 10.5 - nz)
            : Math.atan2(cx - nx, cz - 14.0 - nz);
          let dy = lookYaw - ag.yaw;
          dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          ag.yaw += dy * Math.min(1, dt * 3.0);
          ag.root.rotation.y = ag.yaw;

          const d = t * 6.4 + ag.phase;
          const style = i % 3;
          if (ag.rig) {
            const s = Math.sin(d);
            const c = Math.cos(d);
            poseBone(ag.rig.pelvis, 0, Math.sin(d * 0.5) * 0.15, s * 0.06, animBlend);
            poseBone(ag.rig.spine, s * 0.06, c * 0.10, s * 0.04, animBlend);
            poseBone(ag.rig.head, s * 0.10, Math.sin(d * 0.25) * 0.18, 0, animBlend);
            poseBone(ag.rig.lThigh, -Math.max(0, s) * 0.16, 0, 0, animBlend);
            poseBone(ag.rig.rThigh, -Math.max(0, -s) * 0.16, 0, 0, animBlend);
            poseBone(ag.rig.lCalf, Math.max(0, s) * 0.28, 0, 0, animBlend);
            poseBone(ag.rig.rCalf, Math.max(0, -s) * 0.28, 0, 0, animBlend);
            if (style === 0) {
              poseBone(ag.rig.lArm, -0.65 + s * 0.35, 0, -0.58 + c * 0.18, animBlend);
              poseBone(ag.rig.rArm, -0.65 + c * 0.35, 0, 0.58 - s * 0.18, animBlend);
              poseBone(ag.rig.lFore, -0.95 + c * 0.25, 0, 0, animBlend);
              poseBone(ag.rig.rFore, -0.95 + s * 0.25, 0, 0, animBlend);
            } else if (style === 1) {
              poseBone(ag.rig.lArm, -1.25 + s * 0.25, 0, -0.45, animBlend);
              poseBone(ag.rig.rArm, -0.35 + c * 0.25, 0, 0.72, animBlend);
              poseBone(ag.rig.lFore, -0.55 + c * 0.2, 0, 0, animBlend);
              poseBone(ag.rig.rFore, -0.85, 0, 0, animBlend);
            } else {
              poseBone(ag.rig.lArm, -0.35 + c * 0.25, 0, -0.72, animBlend);
              poseBone(ag.rig.rArm, -1.25 + s * 0.25, 0, 0.45, animBlend);
              poseBone(ag.rig.lFore, -0.85, 0, 0, animBlend);
              poseBone(ag.rig.rFore, -0.55 + s * 0.2, 0, 0, animBlend);
            }
          }
        }
      }

      // Ichki NPC xulq-atvor holatlari (WALKING / TALKING / DANCING / IDLE) va kolliziya fizikasi
      if (this.beatDropBoost > 0) this.beatDropBoost = Math.max(0, this.beatDropBoost - dt);
      const effectiveBeat = Math.min(1.0, beat + (this.beatDropBoost > 0 ? 0.35 : 0));
      for (let ni = 0; ni < interiorNpcs.length; ni++) {
        const npc = interiorNpcs[ni];
        if (npc.role === 'walker') {
          npc.stateTimer = (npc.stateTimer || 0) - dt;
          if (!npc.aiState) npc.aiState = 'WALKING';

          if (npc.aiState === 'WALKING') {
            const wp = walkLoop[npc.wpIdx];
            const dx = wp[0] - npc.root.position.x;
            const dz = wp[1] - npc.root.position.z;
            const d = Math.hypot(dx, dz);
            if (d < 0.65) {
              npc.wpIdx = (npc.wpIdx + 1) % walkLoop.length;
              npc.aiState = (npc.wpIdx % 2 === 0) ? 'DANCING' : 'TALKING';
              npc.stateTimer = 2.5 + (ni % 3) * 1.1;
            } else {
              let nx = npc.root.position.x + (dx / d) * npc.walkSpeed * dt;
              let nz = npc.root.position.z + (dz / d) * npc.walkSpeed * dt;
              // Devor va mebel kolliziyasi
              const nr = 0.38;
              for (const c of interiorColliders) {
                if (nx + nr > c.minX && nx - nr < c.maxX && nz + nr > c.minZ && nz - nr < c.maxZ) {
                  const cxB = Math.max(c.minX, Math.min(nx, c.maxX));
                  const czB = Math.max(c.minZ, Math.min(nz, c.maxZ));
                  const pdx = nx - cxB;
                  const pdz = nz - czB;
                  const pd = Math.hypot(pdx, pdz);
                  if (pd > 0.001 && pd < nr) {
                    nx += (pdx / pd) * (nr - pd);
                    nz += (pdz / pd) * (nr - pd);
                  }
                }
              }
              npc.root.position.x = nx;
              npc.root.position.z = nz;
              const targetH = Math.atan2(dx, dz);
              let dh = targetH - npc.root.rotation.y;
              dh = Math.atan2(Math.sin(dh), Math.cos(dh));
              npc.root.rotation.y += dh * Math.min(1, dt * 6);
            }
          } else if (npc.stateTimer <= 0) {
            npc.aiState = 'WALKING';
          }
        }
        npc.update(dt, t, effectiveBeat);
      }
      for (const rnpc of rooftopNpcs) {
        rnpc.update(dt, t, effectiveBeat * 0.5);
      }
    },
  };
}
