// ============================================================================
// KOKOBANGO CLUB — GTA V USLUBIDAGI HASHAMATLI TUNGI KLUB (EKSTERYER, INTERYER,
// NPC RAQQOSALAR / DJ / XAVFSIZLIK / BARMENLAR VA JONLI DJ MUSIQA TIZIMI)
// ============================================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { BLOCK, blockC, addCollider } from './layout.js';
import { buildCar } from '../carModel.js';
import { CARS } from '../config.js';

const clubDraco = new DRACOLoader();
clubDraco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/draco/gltf/');
const clubGlbLoader = new GLTFLoader();
clubGlbLoader.setDRACOLoader(clubDraco);

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
    this.volume = 0.55;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx && this.playing) {
      this.master.gain.setTargetAtTime(this.volume * 0.65, this.ctx.currentTime, 0.08);
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
    role = 'visitor', // 'dancer' | 'dj' | 'guard' | 'bartender' | 'visitor' | 'walker'
    phase = Math.random() * Math.PI * 2,
  } = opts;

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const mSkin = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.6 });
  const mShirt = new THREE.MeshStandardMaterial({ color: shirt, roughness: dress ? 0.3 : 0.65, metalness: dress ? 0.45 : 0.08 });
  const mPants = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.7 });
  const mHair = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.6 });
  const mShoe = new THREE.MeshStandardMaterial({ color: 0x111116, roughness: 0.4, metalness: 0.3 });

  const hips = new THREE.Group();
  hips.position.y = sitting ? 0.52 : 0.92;
  body.add(hips);

  // Gavda (Torso)
  const torsoW = female ? 0.30 : 0.38;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(torsoW, 0.52, 0.20), mShirt);
  torso.position.y = 0.28;
  hips.add(torso);

  if (dress) {
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.21, 0.32, 10), mShirt);
    skirt.position.y = -0.06;
    hips.add(skirt);
  }

  // Bosh
  const head = new THREE.Group();
  head.position.y = 0.62;
  hips.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.125, 12, 10), mSkin);
  skull.scale.set(0.92, 1.05, 0.95);
  head.add(skull);

  // Soch
  const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.132, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), mHair);
  hairTop.position.y = 0.02;
  head.add(hairTop);
  if (female) {
    const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.26, 0.10), mHair);
    hairBack.position.set(0, -0.06, -0.09);
    head.add(hairBack);
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

  // Oyoqlar
  const makeLeg = (sx) => {
    const hip = new THREE.Group();
    hip.position.set(sx * 0.095, -0.02, 0);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.32, 4, 8), dress ? mSkin : mPants);
    thigh.position.y = -0.20;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.40;
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.32, 4, 8), dress ? mSkin : mPants);
    shin.position.y = -0.20;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.19), mShoe);
    shoe.position.set(0, -0.42, 0.04);
    knee.add(shin, shoe);
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
    walkSpeed: role === 'walker' ? 1.45 : 0,
    wpIdx: 0,
    update(dt, t, beatPulse = 0) {
      const p = t * 4.2 + this.phase;
      if (this.role === 'dancer') {
        const b = Math.sin(t * 6.6 + this.phase);
        const b2 = Math.cos(t * 3.3 + this.phase);
        this.hips.position.y = 0.90 + Math.abs(b) * 0.045 + beatPulse * 0.03;
        this.hips.rotation.y = b2 * 0.25;
        this.hips.rotation.z = b * 0.08;
        this.head.rotation.x = Math.sin(t * 6.6 + this.phase) * 0.14;
        this.armL.sh.rotation.x = -0.9 + Math.sin(t * 6.6 + this.phase) * 0.55;
        this.armL.sh.rotation.z = -0.45 + b2 * 0.25;
        this.armL.el.rotation.x = -0.75 + Math.cos(t * 6.6) * 0.35;
        this.armR.sh.rotation.x = -0.9 + Math.cos(t * 6.6 + this.phase) * 0.55;
        this.armR.sh.rotation.z = 0.45 - b2 * 0.25;
        this.armR.el.rotation.x = -0.75 + Math.sin(t * 6.6) * 0.35;
        this.legL.hip.rotation.x = b * 0.18;
        this.legR.hip.rotation.x = -b * 0.18;
        this.legL.knee.rotation.x = Math.max(0, -b * 0.28);
        this.legR.knee.rotation.x = Math.max(0, b * 0.28);
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

  // Shisha kirish portali va soyabon (Canopy)
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(14, 0.6, 6.5), mObsidian);
  canopy.position.set(cx, 5.4, cz - 27.2);
  exteriorGroup.add(canopy);
  const canopyNeon = new THREE.Mesh(new THREE.BoxGeometry(14.2, 0.18, 6.7), mNeonPurple);
  canopyNeon.position.set(cx, 5.15, cz - 27.2);
  exteriorGroup.add(canopyNeon);

  const glassPortal = new THREE.Mesh(new THREE.BoxGeometry(9.6, 4.4, 0.3), mGlass);
  glassPortal.position.set(cx, 2.9, cz - 24.2);
  exteriorGroup.add(glassPortal);
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.6, 0.35), mNeonCyan);
  doorFrame.position.set(cx, 2.5, cz - 24.3);
  exteriorGroup.add(doorFrame);
  const doorInner = new THREE.Mesh(new THREE.BoxGeometry(4.6, 3.3, 0.4), mGlass);
  doorInner.position.set(cx, 2.4, cz - 24.35);
  exteriorGroup.add(doorInner);

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

  // Klub oldida turgan 4 ta hashamatli VIP avtomobil
  const parkedSpecs = [
    { id: 'lambo', x: cx - 22, z: cz - 55, h: 0.15, color: '#9333ea' },
    { id: 'bmwm8wb', x: cx - 11, z: cz - 55, h: 0.05, color: '#111827' },
    { id: 'mercedes', x: cx + 11, z: cz - 55, h: -0.08, color: '#0f172a' },
    { id: 'sf90', x: cx + 22, z: cz - 55, h: -0.15, color: '#dc2626' },
  ];
  for (const ps of parkedSpecs) {
    const cfg = CARS.find((c) => c.id === ps.id) || CARS[0];
    const car = buildCar(cfg, { color: ps.color, paintType: 'metallic', tint: 'dark', neon: '#d946ef' }, { beam: false });
    car.group.position.set(ps.x, 0.28, ps.z);
    car.group.rotation.set(0, ps.h, 0);
    car.setLights(true);
    exteriorGroup.add(car.group);
    addCollider(ps.x - 1.4, ps.z - 2.6, ps.x + 1.4, ps.z + 2.6, 'building');
  }

  // Tashqi qo'riqchilar va mehmonlar
  const exteriorNpcs = [];
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

  // Pol, Shift va Devorlar
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x0b0c14, roughness: 0.18, metalness: 0.65 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(iW, iD), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, iy, cz);
  interiorGroup.add(floor);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(iW, iD), new THREE.MeshStandardMaterial({ color: 0x05050a, roughness: 0.9 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(cx, iy + iH, cz);
  interiorGroup.add(ceil);

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

  // Devor neon bezaklari
  for (const sx of [-1, 1]) {
    for (let z = -16; z <= 16; z += 8) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 7.5, 0.25), Math.abs(z) % 16 === 0 ? mNeonPurple : mNeonCyan);
      strip.position.set(cx + sx * (iW / 2 - 0.5), iy + 4.8, cz + z);
      interiorGroup.add(strip);
    }
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

  // 2.3 ULKAN ANIMATSIYALI LED VIDEO DEVOR (DJ orqasida)
  const ledCanvas = document.createElement('canvas');
  ledCanvas.width = 512;
  ledCanvas.height = 256;
  const ledCtx = ledCanvas.getContext('2d');
  const ledTex = new THREE.CanvasTexture(ledCanvas);
  ledTex.colorSpace = THREE.SRGBColorSpace;
  const ledWall = new THREE.Mesh(new THREE.PlaneGeometry(21, 7.6), new THREE.MeshBasicMaterial({ map: ledTex }));
  ledWall.position.set(cx, iy + 5.8, cz - 22.1);
  interiorGroup.add(ledWall);

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

  // 2.5 VIP LOUNGE HUDUDI (G'arb tarafda, ko'tarilgan platforma, divanlar va stollar)
  const vipDeck = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.65, 24), mMarble);
  vipDeck.position.set(cx - 21.5, iy + 0.325, cz - 1);
  interiorGroup.add(vipDeck);
  const vipTrim = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.12, 24.1), mNeonPurple);
  vipTrim.position.set(cx - 21.5, iy + 0.65, cz - 1);
  interiorGroup.add(vipTrim);

  // Shisha panjara (zinapoya qoldirilgan)
  for (const gz of [-9, 7]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.0, 8), mGlass);
    rail.position.set(cx - 15.8, iy + 1.15, cz + gz);
    interiorGroup.add(rail);
  }
  addIntCol(cx - 27.5, cz - 13, cx - 15.8, cz - 5);
  addIntCol(cx - 27.5, cz + 3, cx - 15.8, cz + 11);

  // VIP Divanlar va Stollar
  const mLeather = new THREE.MeshStandardMaterial({ color: 0x3b0764, roughness: 0.42, metalness: 0.15 });
  for (const vz of [cz - 8, cz + 6]) {
    const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.05, 5.4), mLeather);
    sofaBack.position.set(cx - 25.2, iy + 1.15, vz);
    const sofaSeat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 5.4), mLeather);
    sofaSeat.position.set(cx - 24.4, iy + 0.85, vz);
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.55, 2.8), mObsidian);
    table.position.set(cx - 22.0, iy + 0.92, vz);
    const tableGlow = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.08, 2.84), mNeonCyan);
    tableGlow.position.set(cx - 22.0, iy + 1.18, vz);
    // Bezak ichimlik butilkalari va bokallar (alkogolsiz mocktail)
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.3, 10), mGold);
    bucket.position.set(cx - 22.0, iy + 1.35, vz);
    interiorGroup.add(sofaBack, sofaSeat, table, tableGlow, bucket);
  }

  // 2.6 BAR PESHTAXTASI (Sharq tarafda, x = cx + 17 .. cx + 26)
  const barCounter = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 16), mObsidian);
  barCounter.position.set(cx + 18.5, iy + 0.6, cz + 2);
  interiorGroup.add(barCounter);
  addIntCol(cx + 17.6, cz - 6.2, cx + 26.5, cz + 10.2);

  const barTop = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 16.4), mMarble);
  barTop.position.set(cx + 18.5, iy + 1.22, cz + 2);
  const barGlow = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 16.1), mNeonCyan);
  barGlow.position.set(cx + 18.4, iy + 0.12, cz + 2);
  interiorGroup.add(barTop, barGlow);

  // Bar ortidagi javon va rang-barang bezak shishalar
  const barShelf = new THREE.Mesh(new THREE.BoxGeometry(0.9, 4.2, 14), mDarkWall);
  barShelf.position.set(cx + 26.8, iy + 2.1, cz + 2);
  interiorGroup.add(barShelf);
  const bottleCols = [0x00e5ff, 0xd946ef, 0xfacc15, 0x38bdf8, 0xf43f5e, 0xa855f7];
  for (let b = 0; b < 18; b++) {
    const bMat = new THREE.MeshStandardMaterial({
      color: bottleCols[b % bottleCols.length],
      emissive: bottleCols[b % bottleCols.length],
      emissiveIntensity: 0.7,
      roughness: 0.15,
    });
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.36, 8), bMat);
    bottle.position.set(cx + 26.2, iy + 1.8 + (b % 2) * 1.1, cz - 4 + Math.floor(b / 2) * 1.45);
    interiorGroup.add(bottle);
  }
  // Bar stullari
  for (let st = 0; st < 6; st++) {
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.12, 0.75, 10), mLeather);
    stool.position.set(cx + 16.8, iy + 0.38, cz - 4 + st * 2.4);
    interiorGroup.add(stool);
  }

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

  // Interyer yoritish (yorqin va jonli tungi klub muhiti)
  const intHemi = new THREE.HemisphereLight(0xd8b4fe, 0x1e1038, 1.55);
  intHemi.position.set(cx, iy + 9.5, cz);
  const intAmbient = new THREE.PointLight(0x8b5cf6, 42, 60, 1.25);
  intAmbient.position.set(cx, iy + 8.5, cz);
  const intStageLight = new THREE.PointLight(0x00e5ff, 68, 38, 1.3);
  intStageLight.position.set(cx, iy + 6.5, cz - 14);
  const intBarLight = new THREE.PointLight(0xd946ef, 48, 32, 1.3);
  intBarLight.position.set(cx + 18, iy + 5.5, cz + 2);
  const intVipLight = new THREE.PointLight(0xa855f7, 46, 32, 1.3);
  intVipLight.position.set(cx - 21, iy + 5.5, cz);
  const intEntranceLight = new THREE.PointLight(0x38bdf8, 38, 28, 1.3);
  intEntranceLight.position.set(cx, iy + 6.0, cz + 15);
  interiorGroup.add(intHemi, intAmbient, intStageLight, intBarLight, intVipLight, intEntranceLight);

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

  // Kokobango/18.glb — Klub ichida 6 ta jonli harakatlanuvchi va raqsga tushuvchi 3D model
  const GLB_CONFIGS = [
    {
      pos: [0, 2.2], color: 0xe879f9, speed: 1.75,
      wps: [[0, 2.2], [4.8, 3.2], [5.2, -3.0], [-4.8, -3.2], [-4.2, 4.8], [0, 8.5]],
    },
    {
      pos: [-5.5, -1.5], color: 0x22d3ee, speed: 1.6,
      wps: [[-5.5, -1.5], [-1.8, -5.8], [3.5, -5.2], [1.2, 1.5], [-6.2, 3.5]],
    },
    {
      pos: [5.5, -2.0], color: 0xa855f7, speed: 1.85,
      wps: [[5.5, -2.0], [7.8, 4.5], [2.5, 7.2], [-2.5, 4.0], [2.2, -5.8]],
    },
    {
      pos: [10.5, 3.5], color: 0xf472b6, speed: 1.5,
      wps: [[10.5, 3.5], [13.5, -2.5], [13.5, 8.0], [7.2, 9.5], [6.5, 1.0]],
    },
    {
      pos: [-10.5, 2.5], color: 0x38bdf8, speed: 1.55,
      wps: [[-10.5, 2.5], [-12.2, -4.5], [-8.5, -7.5], [-4.5, -1.5], [-9.2, 8.2]],
    },
    {
      pos: [-2.0, 12.0], color: 0xc084fc, speed: 1.7,
      wps: [[-2.0, 12.0], [4.5, 12.5], [8.5, 7.0], [0.5, 5.2], [-6.5, 10.5]],
    },
  ];

  const glbAgents = GLB_CONFIGS.map((cfg, idx) => {
    const root = new THREE.Group();
    root.position.set(cx + cfg.pos[0], iy, cz + cfg.pos[1]);
    interiorGroup.add(root);

    const auraRing = new THREE.Mesh(
      new THREE.RingGeometry(0.52, 0.74, 28),
      new THREE.MeshBasicMaterial({ color: cfg.color, side: THREE.DoubleSide, transparent: true, opacity: 0.72 })
    );
    auraRing.rotation.x = -Math.PI / 2;
    auraRing.position.y = 0.03;
    root.add(auraRing);

    return {
      idx,
      root,
      auraRing,
      inner: null,
      mixer: null,
      vx: 0,
      vz: 0,
      yaw: (idx * Math.PI) / 3,
      wpIdx: 0,
      pauseTimer: 0.6 + idx * 0.45,
      speed: cfg.speed,
      wps: cfg.wps.map(([wx, wz]) => [cx + wx, cz + wz]),
      phase: idx * 1.15,
    };
  });

  // Raqs maydonini yorituvchi 2 ta jonli spotlight
  const glbSpotA = new THREE.PointLight(0xf5d0fe, 28, 16, 1.35);
  glbSpotA.position.set(cx - 3.5, iy + 4.8, cz + 1.5);
  const glbSpotB = new THREE.PointLight(0x67e8f9, 24, 16, 1.35);
  glbSpotB.position.set(cx + 3.5, iy + 4.8, cz + 1.5);
  interiorGroup.add(glbSpotA, glbSpotB);

  let glbBaseLoaded = false;
  let glbBaseLoading = false;

  function ensureGlbModelLoaded() {
    if (glbBaseLoaded || glbBaseLoading) return;
    glbBaseLoading = true;
    clubGlbLoader.load(
      './Kokobango/18.glb',
      (gltf) => {
        const baseModel = gltf.scene;
        baseModel.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(baseModel);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        const targetH = 1.82;
        const sc = targetH / Math.max(0.01, size.y);
        baseModel.scale.setScalar(sc);
        baseModel.position.set(-center.x * sc, -box.min.y * sc, -center.z * sc);

        baseModel.traverse((obj) => {
          if (obj.isMesh) {
            obj.frustumCulled = true;
            obj.castShadow = false;
            obj.receiveShadow = false;
            if (obj.material) {
              const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
              for (const m of mats) {
                m.side = THREE.DoubleSide;
                if (typeof m.metalness === 'number' && m.metalness > 0.45) m.metalness = 0.25;
                if (typeof m.roughness === 'number' && m.roughness < 0.35) m.roughness = 0.5;
                m.needsUpdate = true;
              }
            }
          }
        });

        const hasAnims = gltf.animations && gltf.animations.length > 0;
        const walkClip = hasAnims
          ? gltf.animations.find((a) => /walk|run|move|dance/i.test(a.name)) || gltf.animations[0]
          : null;

        for (let i = 0; i < glbAgents.length; i++) {
          const ag = glbAgents[i];
          const clone = i === 0 ? baseModel : baseModel.clone(true);
          ag.inner = clone;
          ag.root.add(clone);
          if (walkClip) {
            ag.mixer = new THREE.AnimationMixer(clone);
            const action = ag.mixer.clipAction(walkClip);
            action.time = i * 0.4;
            action.play();
          }
        }

        glbBaseLoaded = true;
        glbBaseLoading = false;
      },
      undefined,
      () => {
        glbBaseLoading = false;
      }
    );
  }

  // O'yin yuklangandan so'ng fon rejimida oldindan yuklab qo'yish (klubga kirganda darhol ko'rinishi uchun)
  setTimeout(ensureGlbModelLoaded, 2800);

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

  // 2) 6 ta Ayol Raqqosa NPC (zamonaviy klub kiyimlarida)
  const dancerConfigs = [
    { x: cx - 3.6, y: iy + 0.02, z: cz - 3.2, shirt: '#db2777', hair: '#18181b', h: 0 },
    { x: cx + 3.6, y: iy + 0.02, z: cz - 3.2, shirt: '#7c3aed', hair: '#facc15', h: 0 },
    { x: cx - 5.2, y: iy + 0.02, z: cz + 1.8, shirt: '#06b6d4', hair: '#78350f', h: 0.4 },
    { x: cx + 5.2, y: iy + 0.02, z: cz + 1.8, shirt: '#e11d48', hair: '#09090b', h: -0.4 },
    { x: cx - 7.8, y: iy + 1.32, z: cz - 13.5, shirt: '#c026d3', hair: '#18181b', h: 0.2 }, // Sahnada
    { x: cx + 7.8, y: iy + 1.32, z: cz - 13.5, shirt: '#2563eb', hair: '#f59e0b', h: -0.2 }, // Sahnada
  ];
  dancerConfigs.forEach((dc, idx) => {
    const npc = createClubNpc({
      role: 'dancer',
      female: true,
      dress: true,
      shirt: dc.shirt,
      hair: dc.hair,
      phase: idx * 1.1,
    });
    npc.root.position.set(dc.x, dc.y, dc.z);
    npc.root.rotation.y = dc.h;
    interiorGroup.add(npc.root);
    interiorNpcs.push(npc);
  });

  // 3) 2 ta Barmen NPC
  for (const bz of [cz - 1, cz + 5]) {
    const barNpc = createClubNpc({
      role: 'bartender',
      shirt: '#18181b',
      pants: '#09090b',
      hair: '#1c1917',
      phase: bz,
    });
    barNpc.root.position.set(cx + 21.2, iy, bz);
    barNpc.root.rotation.y = -Math.PI / 2;
    interiorGroup.add(barNpc.root);
    interiorNpcs.push(barNpc);
  }

  // 4) 2 ta Ichki Qo'riqchi NPC
  const intGuards = [
    [cx - 3.2, iy, cz + 19.5, Math.PI * 0.85],
    [cx - 14.5, iy, cz - 1.0, Math.PI / 2],
  ];
  intGuards.forEach(([gx, gy, gz, gh], i) => {
    const gNpc = createClubNpc({ role: 'guard', shirt: '#09090b', pants: '#09090b', glasses: true, phase: i * 2 });
    gNpc.root.position.set(gx, gy, gz);
    gNpc.root.rotation.y = gh;
    interiorGroup.add(gNpc.root);
    interiorNpcs.push(gNpc);
  });

  // 5) VIP divanlarda o'tirgan mehmonlar + Bar yonida suhbatlashayotganlar + Yuruvchi mehmonlar
  const seatedGuests = [
    [cx - 24.0, iy + 0.65, cz - 9.2, Math.PI / 2, true, '#ec4899'],
    [cx - 24.0, iy + 0.65, cz - 6.8, Math.PI / 2, false, '#3b82f6'],
    [cx - 24.0, iy + 0.65, cz + 6.0, Math.PI / 2, true, '#a855f7'],
  ];
  seatedGuests.forEach(([sx, sy, sz, sh, fem, col], i) => {
    const sg = createClubNpc({ role: 'visitor', sitting: true, female: fem, dress: fem, shirt: col, phase: i });
    sg.root.position.set(sx, sy, sz);
    sg.root.rotation.y = sh;
    interiorGroup.add(sg.root);
    interiorNpcs.push(sg);
  });

  const standingGuests = [
    [cx + 15.2, iy, cz + 1.0, Math.PI / 2, false, '#2563eb'],
    [cx + 15.2, iy, cz + 2.4, Math.PI / 2, true, '#e11d48'],
  ];
  standingGuests.forEach(([sx, sy, sz, sh, fem, col], i) => {
    const sg = createClubNpc({ role: 'visitor', female: fem, dress: fem, shirt: col, phase: i + 1 });
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
      const grad = g.createLinearGradient(0, 0, 512, 256);
      grad.addColorStop(0, `hsl(${(t * 35) % 360}, 70%, 10%)`);
      grad.addColorStop(1, '#05020e');
      g.fillStyle = grad;
      g.fillRect(0, 0, 512, 256);

      // Pulsing rings
      g.strokeStyle = `rgba(0, 229, 255, ${0.35 + beat * 0.5})`;
      g.lineWidth = 4 + beat * 4;
      g.beginPath();
      g.arc(256, 128, 45 + beat * 40, 0, Math.PI * 2);
      g.stroke();

      // Equalizer bars
      for (let i = 0; i < 32; i++) {
        const h = (25 + Math.abs(Math.sin(t * 7 + i * 0.4)) * 125) * (0.65 + beat * 0.55);
        g.fillStyle = `hsl(${(280 + i * 4 + t * 40) % 360}, 95%, 60%)`;
        g.fillRect(12 + i * 15.5, 250 - h, 10, h);
      }

      g.fillStyle = '#ffffff';
      g.font = '900 46px "Segoe UI", Arial, sans-serif';
      g.textAlign = 'center';
      g.shadowColor = '#e879f9';
      g.shadowBlur = 18;
      g.fillText('KOKOBANGO', 256, 118);
      g.shadowBlur = 0;
      ledTex.needsUpdate = true;
    }
  }

  // Kirish va Chiqish koordinatalari
  const entrancePos = { x: cx, y: 0.72, z: cz - 31.5, r: 6.5 };
  const parkDropOff = { x: cx, z: cz - 42.5, heading: Math.PI };
  const insideSpawn = { x: cx, y: iy, z: cz + 19.0, heading: Math.PI };
  const exitPos = { x: cx, y: iy, z: cz + 21.5, r: 3.8 };

  return {
    cx,
    cz,
    interiorY: iy,
    entrancePos,
    parkDropOff,
    insideSpawn,
    exitPos,
    interiorColliders,
    exteriorGroup,
    interiorGroup,
    music,

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

    nearExit(px, pz) {
      return Math.hypot(px - exitPos.x, pz - exitPos.z) < exitPos.r;
    },

    update(dt, t, isInside, playerDistSq = 0) {
      const beat = music.getBeatPulse();
      if (!isInside) {
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

      // 6 ta Kokobango/18.glb modeli — mukammal fizika, to'qnashuvdan qochish va raqs
      glbSpotA.intensity = 22 + beat * 14;
      glbSpotB.intensity = 20 + beat * 12;
      if (glbBaseLoaded) {
        const radius = 0.55;
        for (let i = 0; i < glbAgents.length; i++) {
          const ag = glbAgents[i];
          ag.auraRing.scale.setScalar(1 + beat * 0.22);
          if (ag.mixer) ag.mixer.update(dt);

          let wantVx = 0;
          let wantVz = 0;
          let moving = false;

          if (ag.pauseTimer > 0) {
            ag.pauseTimer -= dt;
          } else {
            const wp = ag.wps[ag.wpIdx];
            const dx = wp[0] - ag.root.position.x;
            const dz = wp[1] - ag.root.position.z;
            const dist = Math.hypot(dx, dz);
            if (dist < 0.75) {
              ag.wpIdx = (ag.wpIdx + 1) % ag.wps.length;
              ag.pauseTimer = 1.8 + (i % 3) * 0.7;
            } else {
              moving = true;
              const slowFactor = dist < 1.8 ? Math.max(0.45, dist / 1.8) : 1.0;
              wantVx = (dx / dist) * ag.speed * slowFactor;
              wantVz = (dz / dist) * ag.speed * slowFactor;
            }
          }

          // Boshqa GLB modellardan masofa saqlash (Agent separation physics)
          for (let j = 0; j < glbAgents.length; j++) {
            if (i === j) continue;
            const other = glbAgents[j];
            const sx = ag.root.position.x - other.root.position.x;
            const sz = ag.root.position.z - other.root.position.z;
            const sd = Math.hypot(sx, sz);
            if (sd > 0.001 && sd < 1.35) {
              const push = ((1.35 - sd) / 1.35) * 2.4;
              wantVx += (sx / sd) * push;
              wantVz += (sz / sd) * push;
            }
          }

          // Silliq tezlanish va tormozlanish (Inertia damping)
          const accel = Math.min(1, dt * 7.5);
          ag.vx += (wantVx - ag.vx) * accel;
          ag.vz += (wantVz - ag.vz) * accel;

          const curSpd = Math.hypot(ag.vx, ag.vz);
          let nx = Math.max(cx - 24.5, Math.min(cx + 24.5, ag.root.position.x + ag.vx * dt));
          let nz = Math.max(cz - 19.5, Math.min(cz + 19.5, ag.root.position.z + ag.vz * dt));

          // Klub devorlari va mebellari bilan AABB kolliziya (sirpanish fizikasi)
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

          ag.root.position.x = nx;
          ag.root.position.z = nz;

          // Silliq burilish va yurish/raqs animatsiyasi
          if (curSpd > 0.15) {
            const targetYaw = Math.atan2(ag.vx, ag.vz);
            let dy = targetYaw - ag.yaw;
            dy = Math.atan2(Math.sin(dy), Math.cos(dy));
            ag.yaw += dy * Math.min(1, dt * 8.0);
            ag.root.rotation.y = ag.yaw;

            if (!ag.mixer && ag.inner) {
              const stride = t * 7.6 + ag.phase;
              ag.root.position.y = iy + Math.abs(Math.sin(stride)) * 0.052;
              ag.inner.rotation.z = Math.sin(stride * 0.5) * 0.042;
              ag.inner.rotation.x = Math.min(0.06, curSpd * 0.022);
            }
          } else {
            // To'xtaganda musiqa ritmiga mos raqs/tebranish
            const lookCenterYaw = Math.atan2(cx - nx, cz - 14 - nz);
            let dy = lookCenterYaw - ag.yaw;
            dy = Math.atan2(Math.sin(dy), Math.cos(dy));
            ag.yaw += dy * Math.min(1, dt * 3.0);
            ag.root.rotation.y = ag.yaw;

            if (!ag.mixer && ag.inner) {
              ag.root.position.y = iy + beat * 0.065;
              ag.inner.rotation.z = Math.sin(t * 5.2 + ag.phase) * 0.055;
              ag.inner.rotation.x = Math.cos(t * 2.6 + ag.phase) * 0.032;
            }
          }
        }
      }

      // Ichki NPC animatsiyalari va yurish
      for (const npc of interiorNpcs) {
        if (npc.role === 'walker') {
          const wp = walkLoop[npc.wpIdx];
          const dx = wp[0] - npc.root.position.x;
          const dz = wp[1] - npc.root.position.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.6) {
            npc.wpIdx = (npc.wpIdx + 1) % walkLoop.length;
          } else {
            npc.root.position.x += (dx / d) * npc.walkSpeed * dt;
            npc.root.position.z += (dz / d) * npc.walkSpeed * dt;
            npc.root.rotation.y = Math.atan2(dx, dz);
          }
        }
        npc.update(dt, t, beat);
      }
    },
  };
}
