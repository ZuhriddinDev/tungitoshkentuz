// Online o'yinchilarning 3D mashinalari: real vaqtda silliq harakat, uzoqdan ko'rinuvchi neon ustun,
// to'liq tuning (rang, diska, spoyler, neon, fara, tormoz) va 3D suhbat yorlig'i
import * as THREE from 'three';
import { CARS } from './config.js';
import { buildCar } from './carModel.js';

const beaconGeo = new THREE.CylinderGeometry(0.18, 0.65, 55, 12, 1, true);
beaconGeo.translate(0, 28, 0);
const beaconMat = new THREE.MeshBasicMaterial({
  color: 0x00e5ff,
  transparent: true,
  opacity: 0.24,
  side: THREE.DoubleSide,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

function makeLabel(name, id, chat = '') {
  const c = document.createElement('canvas');
  c.width = 380;
  c.height = chat ? 148 : 104;
  const g = c.getContext('2d');
  const y0 = chat ? 46 : 0;

  if (chat) {
    g.fillStyle = 'rgba(255, 215, 64, 0.96)';
    g.beginPath();
    g.roundRect(10, 4, 360, 38, 14);
    g.fill();
    g.fillStyle = '#111';
    g.font = 'bold 22px "Segoe UI", Arial, sans-serif';
    g.textAlign = 'center';
    g.fillText(chat.slice(0, 28), 190, 30);
  }

  g.fillStyle = 'rgba(6, 10, 26, 0.86)';
  g.beginPath();
  g.roundRect(14, y0 + 6, 352, 92, 22);
  g.fill();
  g.strokeStyle = '#00e5ff';
  g.lineWidth = 3.5;
  g.stroke();

  g.textAlign = 'center';
  g.fillStyle = '#ffffff';
  g.font = 'bold 36px "Segoe UI", Arial, sans-serif';
  g.fillText((name || 'Haydovchi').slice(0, 15), 190, y0 + 48);

  g.fillStyle = '#00e5ff';
  g.font = '700 22px "Segoe UI", Arial, sans-serif';
  g.fillText('🟢 TT-' + id, 190, y0 + 82);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, fog: false })
  );
  s.scale.set(4.2, chat ? 1.64 : 1.15, 1);
  s.renderOrder = 35;
  return s;
}

const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export class RemoteCars {
  constructor(scene) {
    this.scene = scene;
    this.map = new Map();
    this.cars = [];
  }

  update(dt, players, me, night = 0) {
    const now = performance.now();
    const seen = new Set();

    for (const p of players) {
      seen.add(p.id);
      let r = this.map.get(p.id);
      const cfg = CARS.find((c) => c.id === p.car) || CARS[0];
      const chatText = p.chat || '';
      const tuneKey = `${p.color || '#f5f5f5'}|${p.rims || 'std'}|${p.spoiler || 'none'}|${p.neon || 'none'}`;

      if (!r || r.carId !== cfg.id || r.name !== p.name) {
        if (r) this.dispose(r);
        const look = {
          color: p.color || '#f5f5f5',
          rims: p.rims || 'std',
          spoiler: p.spoiler || 'none',
          neon: p.neon || 'none',
        };
        const model = buildCar(cfg, look, { beam: true, priority: true });
        model.group.rotation.order = 'YXZ';
        const label = makeLabel(p.name || 'Haydovchi', p.id, chatText);
        label.position.set(0, cfg.hei + (chatText ? 1.35 : 1.05), 0);
        model.group.add(label);

        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.visible = false;
        model.group.add(beacon);

        this.scene.add(model.group);
        r = {
          model,
          label,
          beacon,
          carId: cfg.id,
          name: p.name,
          chat: chatText,
          tuneKey,
          x: p.x,
          z: p.z,
          y: p.y || 0,
          h: p.h || 0,
          v: p.v || 0,
          roll: 0,
          pitch: 0,
          id: p.id,
          len: cfg.len,
          onHit() {},
        };
        this.map.set(p.id, r);
      } else if (r.chat !== chatText) {
        r.chat = chatText;
        r.model.group.remove(r.label);
        r.label.material.map.dispose();
        r.label.material.dispose();
        r.label = makeLabel(p.name || 'Haydovchi', p.id, chatText);
        r.label.position.set(0, cfg.hei + (chatText ? 1.35 : 1.05), 0);
        r.model.group.add(r.label);
      }

      if (r.tuneKey !== tuneKey) {
        r.tuneKey = tuneKey;
        r.model.setTuning?.({
          color: p.color || '#f5f5f5',
          rims: p.rims || 'std',
          spoiler: p.spoiler || 'none',
          neon: p.neon || 'none',
        });
      }

      // Real-vaqt dead-reckoning (tezlik va burilish tezligi bilan oldindan bashorat)
      const age = Math.min(0.22, (now - (p.t || now)) / 1000);
      const predH = (p.h || 0) + (p.yawRate || 0) * age * 0.6;
      const pv = p.v || 0;
      const tx = p.x + Math.sin(predH) * pv * age;
      const tz = p.z + Math.cos(predH) * pv * age;

      if (Math.hypot(tx - r.x, tz - r.z) > 45) {
        r.x = tx;
        r.z = tz;
        r.h = predH;
      }

      const k = Math.min(1, dt * 14);
      const ox = r.x, oz = r.z;
      r.x += (tx - r.x) * k;
      r.z += (tz - r.z) * k;
      const dh = angDiff(predH, r.h);
      r.h += dh * k;
      r.y += ((p.y || 0) - r.y) * Math.min(1, dt * 12);

      // Kuzovning burilish va tormozdagi tabiiy og'ishi
      const targetRoll = THREE.MathUtils.clamp(-(p.yawRate || dh * 8) * pv * 0.0035, -0.055, 0.055);
      const targetPitch = p.braking && Math.abs(pv) > 2 ? 0.025 : 0;
      r.roll += (targetRoll - r.roll) * Math.min(1, dt * 8);
      r.pitch += (targetPitch - r.pitch) * Math.min(1, dt * 8);

      const distToMe = Math.hypot(r.x - me.x, r.z - me.z);
      const far = distToMe > 1400;
      const g = r.model.group;
      g.visible = !far;
      g.position.set(r.x, r.y, r.z);
      g.rotation.set(r.pitch, r.h, r.roll, 'YXZ');

      if (!far) {
        // Uzoqdagi do'stlar ham aniq ko'rinib turishi uchun yorliq o'lchamini masofaga moslaymiz
        const lblScale = THREE.MathUtils.clamp(1 + (distToMe - 25) * 0.014, 1, 4.5);
        r.label.scale.set(4.2 * lblScale, (r.chat ? 1.64 : 1.15) * lblScale, 1);
        r.label.position.y = cfg.hei + (r.chat ? 1.35 : 1.05) + (lblScale - 1) * 0.65;
        r.beacon.visible = distToMe > 55;

        const stepDist = Math.hypot(r.x - ox, r.z - oz) * Math.sign(pv || 1);
        r.model.update(stepDist, p.steer || 0);
        r.model.setLights?.(p.lights !== undefined ? p.lights : night > 0.35);
        r.model.setBrake?.(!!p.braking);
      }
    }

    for (const [id, r] of this.map) {
      if (!seen.has(id)) {
        this.dispose(r);
        this.map.delete(id);
      }
    }
    this.cars = [...this.map.values()];
  }

  dispose(r) {
    this.scene.remove(r.model.group);
    r.label.material.map.dispose();
    r.label.material.dispose();
  }
}
