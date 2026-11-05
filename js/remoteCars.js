// Online o'yinchilarning mashinalari: silliq harakat, ism + 3D suhbat yorlig'i, to'qnashuv uchun fizik ob'ekt
import * as THREE from 'three';
import { CARS } from './config.js';
import { buildCar } from './carModel.js';

function makeLabel(name, id, chat = '') {
  const c = document.createElement('canvas'); c.width = 360; c.height = chat ? 140 : 96;
  const g = c.getContext('2d');
  const y0 = chat ? 44 : 0;
  if (chat) {
    g.fillStyle = 'rgba(255, 215, 64, 0.94)';
    g.beginPath(); g.roundRect(10, 4, 340, 36, 14); g.fill();
    g.fillStyle = '#111'; g.font = 'bold 21px "Segoe UI", Arial, sans-serif';
    g.textAlign = 'center';
    g.fillText(chat.slice(0, 26), 180, 29);
  }
  g.fillStyle = 'rgba(6,8,22,0.82)'; g.beginPath(); g.roundRect(14, y0 + 4, 332, 88, 20); g.fill();
  g.strokeStyle = '#00e5ff'; g.lineWidth = 3; g.stroke();
  g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = 'bold 36px "Segoe UI", Arial, sans-serif';
  g.fillText(name.slice(0, 14), 180, y0 + 45);
  g.fillStyle = '#00e5ff'; g.font = '600 22px "Segoe UI", Arial, sans-serif';
  g.fillText('TT-' + id, 180, y0 + 78);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  s.scale.set(4.0, chat ? 1.55 : 1.08, 1); s.renderOrder = 20;
  return s;
}

const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export class RemoteCars {
  constructor(scene) { this.scene = scene; this.map = new Map(); this.cars = []; }

  update(dt, players, me, night = 0) {
    const now = performance.now(), seen = new Set();
    for (const p of players) {
      seen.add(p.id);
      let r = this.map.get(p.id);
      const cfg = CARS.find((c) => c.id === p.car) || CARS[0];
      const chatText = p.chat || '';
      if (!r || r.carId !== cfg.id || r.name !== p.name) {
        if (r) this.dispose(r);
        const model = buildCar(cfg, { color: p.color || '#f5f5f5' }, { beam: false });
        model.group.rotation.order = 'YXZ';
        const label = makeLabel(p.name || 'Haydovchi', p.id, chatText);
        label.position.set(0, cfg.hei + (chatText ? 1.25 : 1.0), 0);
        model.group.add(label);
        this.scene.add(model.group);
        r = { model, label, carId: cfg.id, name: p.name, chat: chatText, color: p.color, x: p.x, z: p.z, y: 0, h: p.h, id: p.id,
          len: cfg.len, onHit() {} };
        this.map.set(p.id, r);
      } else if (r.chat !== chatText) {
        r.chat = chatText;
        r.model.group.remove(r.label);
        r.label.material.map.dispose(); r.label.material.dispose();
        r.label = makeLabel(p.name || 'Haydovchi', p.id, chatText);
        r.label.position.set(0, cfg.hei + (chatText ? 1.25 : 1.0), 0);
        r.model.group.add(r.label);
      }
      if (p.color && p.color !== r.color) { r.color = p.color; r.model.setColor?.(p.color); }
      // Kutilgan holatni oldinga taxmin qilib, silliq yaqinlashtiramiz
      const age = Math.min(0.25, (now - (p.t || now)) / 1000);
      const tx = p.x + Math.sin(p.h) * p.v * age, tz = p.z + Math.cos(p.h) * p.v * age;
      if (Math.hypot(tx - r.x, tz - r.z) > 40) { r.x = tx; r.z = tz; r.h = p.h; }
      const k = Math.min(1, dt * 9), ox = r.x, oz = r.z;
      r.x += (tx - r.x) * k; r.z += (tz - r.z) * k;
      r.h += angDiff(p.h, r.h) * k;
      r.y += ((p.y || 0) - r.y) * Math.min(1, dt * 10);
      const g = r.model.group, far = Math.hypot(r.x - me.x, r.z - me.z) > 380;
      g.visible = !far;
      g.position.set(r.x, r.y, r.z); g.rotation.set(0, r.h, 0);
      if (!far) {
        r.model.update(Math.hypot(r.x - ox, r.z - oz) * Math.sign(p.v || 1), p.steer || 0);
        r.model.setLights?.(night > 0.4);
      }
    }
    for (const [id, r] of this.map) if (!seen.has(id)) { this.dispose(r); this.map.delete(id); }
    this.cars = [...this.map.values()];
  }

  dispose(r) {
    this.scene.remove(r.model.group);
    r.label.material.map.dispose(); r.label.material.dispose();
  }
}
