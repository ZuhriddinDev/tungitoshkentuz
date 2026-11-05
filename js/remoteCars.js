// Online o'yinchilarning 3D mashinalari va 3D Personajlari:
// real vaqtda silliq harakat, mashinadan tushib yurish, yo'lovchi bo'lib o'tirish va 3D suhbat yorlig'i
import * as THREE from 'three';
import { CARS } from './config.js';
import { buildCar } from './carModel.js';
import { buildCharacterModel } from './character.js';

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

function makeLabel(name, id, chat = '', subBadge = '') {
  const c = document.createElement('canvas');
  c.width = 400;
  c.height = chat ? 154 : 108;
  const g = c.getContext('2d');
  const y0 = chat ? 46 : 0;

  if (chat) {
    g.fillStyle = 'rgba(255, 215, 64, 0.96)';
    g.beginPath();
    g.roundRect(10, 4, 380, 38, 14);
    g.fill();
    g.fillStyle = '#111';
    g.font = 'bold 22px "Segoe UI", Arial, sans-serif';
    g.textAlign = 'center';
    g.fillText(chat.slice(0, 30), 200, 30);
  }

  g.fillStyle = 'rgba(6, 10, 26, 0.86)';
  g.beginPath();
  g.roundRect(14, y0 + 6, 372, 94, 22);
  g.fill();
  g.strokeStyle = '#00e5ff';
  g.lineWidth = 3.5;
  g.stroke();

  g.textAlign = 'center';
  g.fillStyle = '#ffffff';
  g.font = 'bold 34px "Segoe UI", Arial, sans-serif';
  g.fillText((name || 'Haydovchi').slice(0, 15), 200, y0 + 48);

  g.fillStyle = subBadge ? '#ffd740' : '#00e5ff';
  g.font = '700 21px "Segoe UI", Arial, sans-serif';
  g.fillText(subBadge || ('🟢 TT-' + id), 200, y0 + 82);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, fog: false })
  );
  s.scale.set(4.3, chat ? 1.66 : 1.16, 1);
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

    // Qaysi mashinada kim yo'lovchi bo'lib o'tirganini aniqlash
    const passengersByHost = new Map();
    for (const p of players) {
      if (p.ridingWith) {
        const arr = passengersByHost.get(p.ridingWith) || [];
        arr.push(p.name || 'Do\'st');
        passengersByHost.set(p.ridingWith, arr);
      }
    }

    for (const p of players) {
      seen.add(p.id);
      let r = this.map.get(p.id);
      const cfg = CARS.find((c) => c.id === p.car) || CARS[0];
      const chatText = p.chat || '';
      const passList = passengersByHost.get(p.id);
      const subBadge = p.onFoot
        ? `🚶 Piyoda · TT-${p.id}`
        : passList?.length
          ? `💺 +${passList.join(', ')}`
          : `🟢 TT-${p.id}`;
      const labelKey = `${p.name}|${chatText}|${subBadge}`;
      const tuneKey = `${p.color || '#f5f5f5'}|${p.rims || 'std'}|${p.spoiler || 'none'}|${p.neon || 'none'}|${p.charPreset || 'temur'}|${p.charOutfit || ''}|${p.charColor || ''}|${p.charHair || ''}|${p.charGlasses || ''}`;

      if (!r || r.carId !== cfg.id) {
        if (r) this.dispose(r);
        const look = {
          color: p.color || '#f5f5f5',
          rims: p.rims || 'std',
          spoiler: p.spoiler || 'none',
          neon: p.neon || 'none',
        };
        const model = buildCar(cfg, look, { beam: true, priority: true });
        model.group.rotation.order = 'YXZ';

        const charModel = buildCharacterModel(p.color || '#00e5ff');
        charModel.setConfig?.({
          preset: p.charPreset || 'temur',
          outfit: p.charOutfit || undefined,
          color: p.charColor || undefined,
          hair: p.charHair || undefined,
          glasses: p.charGlasses || undefined,
        });
        charModel.group.visible = false;
        this.scene.add(charModel.group);

        const label = makeLabel(p.name || 'Haydovchi', p.id, chatText, subBadge);
        label.position.set(0, cfg.hei + (chatText ? 1.35 : 1.05), 0);
        model.group.add(label);

        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.visible = false;
        model.group.add(beacon);

        this.scene.add(model.group);
        r = {
          model,
          charModel,
          label,
          beacon,
          carId: cfg.id,
          name: p.name,
          labelKey,
          tuneKey,
          x: p.x || 0,
          z: p.z || 0,
          y: p.y || 0,
          h: p.h || 0,
          v: p.v || 0,
          px: p.px || p.x || 0,
          pz: p.pz || p.z || 0,
          py: p.py || 0,
          ph: p.ph || 0,
          roll: 0,
          pitch: 0,
          id: p.id,
          len: cfg.len,
          onHit() {},
        };
        this.map.set(p.id, r);
      } else if (r.labelKey !== labelKey) {
        r.labelKey = labelKey;
        if (r.label.parent) r.label.parent.remove(r.label);
        r.label.material.map.dispose();
        r.label.material.dispose();
        r.label = makeLabel(p.name || 'Haydovchi', p.id, chatText, subBadge);
      }

      if (r.tuneKey !== tuneKey) {
        r.tuneKey = tuneKey;
        r.model.setTuning?.({
          color: p.color || '#f5f5f5',
          rims: p.rims || 'std',
          spoiler: p.spoiler || 'none',
          neon: p.neon || 'none',
        });
        r.charModel.setColor(p.color || '#00e5ff');
        r.charModel.setConfig?.({
          preset: p.charPreset || 'temur',
          outfit: p.charOutfit || undefined,
          color: p.charColor || undefined,
          hair: p.charHair || undefined,
          glasses: p.charGlasses || undefined,
        });
      }

      // 1. Mashina harakatini silliq yangilash
      const age = Math.min(0.22, (now - (p.t || now)) / 1000);
      const predH = (p.h || 0) + (p.yawRate || 0) * age * 0.6;
      const pv = p.onFoot ? 0 : (p.v || 0);
      const tx = (p.x || 0) + Math.sin(predH) * pv * age;
      const tz = (p.z || 0) + Math.cos(predH) * pv * age;

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
        const stepDist = Math.hypot(r.x - ox, r.z - oz) * Math.sign(pv || 1);
        r.model.update(stepDist, p.steer || 0);
        r.model.setLights?.(p.lights !== undefined ? p.lights : night > 0.35);
        r.model.setBrake?.(!!p.braking);
      }

      // 2. Agar o'yinchi mashinadan tushib yurgan bo'lsa (p.onFoot && !p.ridingWith), 3D Personajini ko'rsatamiz
      const showChar = (!!p.onFoot || p.animState === 'enterCar' || p.animState === 'exitCar') && !p.ridingWith && !far;
      r.charModel.group.visible = showChar;
      if (showChar) {
        const tpx = (p.px || r.x) + Math.sin(p.ph || 0) * (p.pv || 0) * age;
        const tpz = (p.pz || r.z) + Math.cos(p.ph || 0) * (p.pv || 0) * age;
        if (Math.hypot(tpx - r.px, tpz - r.pz) > 30) {
          r.px = tpx;
          r.pz = tpz;
          r.ph = p.ph || 0;
        }
        r.px += (tpx - r.px) * k;
        r.pz += (tpz - r.pz) * k;
        r.ph += angDiff(p.ph || 0, r.ph) * k;
        r.py += ((p.py || 0) - r.py) * Math.min(1, dt * 16);

        r.charModel.group.position.set(r.px, r.py, r.pz);
        r.charModel.group.rotation.set(0, r.ph, 0);
        const remAnim = p.emote || p.animState || '';
        r.charModel.animate(dt, p.pv || 0, remAnim, 0.5);

        if (r.label.parent !== r.charModel.group) {
          r.charModel.group.add(r.label);
        }
        const charDist = Math.hypot(r.px - me.x, r.pz - me.z);
        const lblScale = THREE.MathUtils.clamp(1 + (charDist - 25) * 0.014, 1, 4.5);
        r.label.scale.set(4.3 * lblScale, (chatText ? 1.66 : 1.16) * lblScale, 1);
        r.label.position.set(0, 2.25 + (lblScale - 1) * 0.5, 0);
        r.beacon.visible = charDist > 55;
      } else {
        if (!p.ridingWith) {
          if (r.label.parent !== g) g.add(r.label);
          const lblScale = THREE.MathUtils.clamp(1 + (distToMe - 25) * 0.014, 1, 4.5);
          r.label.scale.set(4.3 * lblScale, (chatText ? 1.66 : 1.16) * lblScale, 1);
          r.label.position.set(0, cfg.hei + (chatText ? 1.35 : 1.05) + (lblScale - 1) * 0.65, 0);
          r.label.visible = true;
          r.beacon.visible = distToMe > 55;
        } else {
          // Do'stining mashinasida o'tirgan o'yinchining yorlig'i o'sha mashinada ko'rinadi
          r.label.visible = false;
          r.beacon.visible = false;
        }
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
    this.scene.remove(r.charModel.group);
    r.label.material.map.dispose();
    r.label.material.dispose();
  }
}
