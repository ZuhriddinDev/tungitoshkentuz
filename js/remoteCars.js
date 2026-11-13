// ============================================================================
// TUNGI TOSHKENT V12 — MULTIPLAYER PERFORMANCE & SMOOTH INTERPOLATION ENGINE
// ============================================================================
// Ushbu modul masofaviy o'yinchilar harakatini professional Snapshot Interpolation
// orqali silliqlaydi (mashinalar sakrab yurishi, qotib qolishi va lagni yo'qotadi).
// Shuningdek, 25 km² bo'ylab fazoviy optimallashtirish (Spatial Interest Culling)
// va keshli yorliqlar orqali 60 FPS tezlikni ta'minlaydi.

import * as THREE from 'three';
import { CARS } from './config.js';
import { buildCar, disposeCarGroup } from './carModel.js';
import { buildCharacterModel } from './character.js';
import { sendOnlineEvent } from './online.js';

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

// Yorliq teksturalari keshi (GC va xotira oqishining oldini olish uchun)
const labelCache = new Map();

function getOrCreateLabelSprite(name, id, chat = '', subBadge = '') {
  const key = `${name}|${id}|${chat}|${subBadge}`;
  if (labelCache.has(key)) {
    const cached = labelCache.get(key);
    const sprite = new THREE.Sprite(cached.material);
    sprite.scale.set(4.3, chat ? 1.66 : 1.16, 1);
    sprite.renderOrder = 35;
    return sprite;
  }

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

  g.fillStyle = 'rgba(6, 10, 26, 0.88)';
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
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
  mat.userData.cachedLabel = true;

  if (labelCache.size >= 120) {
    const oldestKey = labelCache.keys().next().value;
    const oldest = labelCache.get(oldestKey);
    if (oldest) {
      oldest.texture?.dispose?.();
      oldest.material?.dispose?.();
    }
    labelCache.delete(oldestKey);
  }
  labelCache.set(key, { texture: tex, material: mat });
  const s = new THREE.Sprite(mat);
  s.scale.set(4.3, chat ? 1.66 : 1.16, 1);
  s.renderOrder = 35;
  return s;
}

const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// Tarmoqdagi kechikishni yumshatuvchi bufer (100 millisekund)
const INTERP_DELAY_MS = 100;

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
      if (!p || !p.id) continue;
      seen.add(p.id);

      let r = this.map.get(p.id);
      const cfg = CARS.find((c) => c.id === p.car) || CARS[0];
      const chatText = p.chat || '';
      const subBadge = `🟢 TT-${p.id}`;
      const labelKey = `${p.name}|${p.id}|${chatText}|${subBadge}`;
      const tuneKey = [
        p.color || '#f5f5f5',
        p.paintType || 'metallic',
        p.rims || 'std',
        p.rimColor || '',
        p.spoiler || 'none',
        p.bodykit || 'std',
        p.tint || 'none',
        p.headlightColor || '#fff3d0',
        p.neon || 'none',
      ].join('|');

      // Yangi o'yinchi mashinasini yaratish
      if (!r || r.carId !== cfg.id) {
        if (r) this.dispose(r);

        const look = {
          color: p.color || '#f5f5f5',
          paintType: p.paintType || 'metallic',
          rims: p.rims || 'std',
          rimColor: p.rimColor || '',
          spoiler: p.spoiler || 'none',
          bodykit: p.bodykit || 'std',
          tint: p.tint || 'none',
          headlightColor: p.headlightColor || '#fff3d0',
          neon: p.neon || 'none',
        };

        const model = buildCar(cfg, look, { beam: true, priority: true });
        model.group.rotation.order = 'YXZ';

        const label = getOrCreateLabelSprite(p.name || 'Haydovchi', p.id, chatText, subBadge);
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
          labelKey,
          tuneKey,
          x: p.x || 0,
          y: p.y || 0,
          z: p.z || 0,
          h: p.h || 0,
          v: p.v || 0,
          steer: p.steer || 0,
          roll: 0,
          pitch: 0,
          id: p.id,
          len: cfg.len,
          mass: cfg.body === 'suv' ? 2350 : cfg.body === 'super' ? 1580 : 1480,
          snapshots: [], // [ { t, x, y, z, h, v, steer, roll, pitch, braking } ]
          lastPacketTime: now,
          onHit(nx, nz, kmh) {
            const push = Math.min(1.4, Math.max(0.25, (kmh || 20) * 0.02));
            r.x += nx * push;
            r.z += nz * push;
            sendOnlineEvent({
              type: 'car_hit',
              toId: p.id,
              nx,
              nz,
              force: Math.max(4, (kmh || 20) * 0.25),
            });
          },
        };

        // Boshlang'ich snapshot
        r.snapshots.push({
          t: now,
          x: p.x || 0,
          y: p.y || 0,
          z: p.z || 0,
          h: p.h || 0,
          v: p.v || 0,
          steer: p.steer || 0,
          braking: !!p.braking,
        });

        this.map.set(p.id, r);
      } else {
        // Yangi snapshot qabul qilish
        const lastSnap = r.snapshots[r.snapshots.length - 1];
        if (!lastSnap || Math.abs(p.x - lastSnap.x) > 0.01 || Math.abs(p.z - lastSnap.z) > 0.01 || Math.abs(p.h - lastSnap.h) > 0.01) {
          r.snapshots.push({
            t: now,
            x: p.x || 0,
            y: p.y || 0,
            z: p.z || 0,
            h: p.h || 0,
            v: p.v || 0,
            steer: p.steer || 0,
            braking: !!p.braking,
          });
          r.lastPacketTime = now;
          if (r.snapshots.length > 8) r.snapshots.shift();
        }

        // Yorliq va tyuning yangilanishi
        if (r.labelKey !== labelKey) {
          r.labelKey = labelKey;
          if (r.label.parent) r.label.parent.remove(r.label);
          r.label = getOrCreateLabelSprite(p.name || 'Haydovchi', p.id, chatText, subBadge);
          r.model.group.add(r.label);
        }

        if (r.tuneKey !== tuneKey) {
          r.tuneKey = tuneKey;
          r.model.setTuning?.({
            color: p.color || '#f5f5f5',
            paintType: p.paintType || 'metallic',
            rims: p.rims || 'std',
            rimColor: p.rimColor || '',
            spoiler: p.spoiler || 'none',
            bodykit: p.bodykit || 'std',
            tint: p.tint || 'none',
            headlightColor: p.headlightColor || '#fff3d0',
            neon: p.neon || 'none',
          });
        }
      }

      // ========================================================================
      // SNAPSHOT INTERPOLATION (Har bir millisekund uchun 100% ravon harakat)
      // ========================================================================
      const renderTime = now - INTERP_DELAY_MS;
      const snaps = r.snapshots;

      let targetX = p.x || 0, targetY = p.y || 0, targetZ = p.z || 0;
      let targetH = p.h || 0, targetV = p.v || 0, targetSteer = p.steer || 0;

      if (snaps.length >= 2) {
        let s0 = null, s1 = null;
        for (let i = snaps.length - 1; i >= 1; i--) {
          if (snaps[i - 1].t <= renderTime && snaps[i].t >= renderTime) {
            s0 = snaps[i - 1];
            s1 = snaps[i];
            break;
          }
        }

        if (s0 && s1 && s1.t > s0.t) {
          const alpha = (renderTime - s0.t) / (s1.t - s0.t);
          targetX = s0.x + (s1.x - s0.x) * alpha;
          targetY = s0.y + (s1.y - s0.y) * alpha;
          targetZ = s0.z + (s1.z - s0.z) * alpha;
          targetH = s0.h + angDiff(s1.h, s0.h) * alpha;
          targetV = s0.v + (s1.v - s0.v) * alpha;
          targetSteer = s0.steer + (s1.steer - s0.steer) * alpha;
        } else {
          // Eng so'nggi ma'lumotlar bilan tekis ekstrapolyatsiya (maksimal 120ms)
          const latest = snaps[snaps.length - 1];
          const dtSnap = Math.min(0.12, (now - latest.t) / 1000);
          targetX = latest.x + Math.sin(latest.h) * latest.v * dtSnap;
          targetZ = latest.z + Math.cos(latest.h) * latest.v * dtSnap;
          targetY = latest.y;
          targetH = latest.h;
          targetV = latest.v;
          targetSteer = latest.steer;
        }
      }

      // Agar o'yinchi 35 metrdan ko'p masofaga tushgan bo'lsa (teleport / spawn) darhol ko'chiramiz
      const jumpDist = Math.hypot(targetX - r.x, targetZ - r.z);
      if (jumpDist > 35) {
        r.x = targetX;
        r.z = targetZ;
        r.y = targetY;
        r.h = targetH;
      } else {
        const smoothK = Math.min(1.0, dt * 18);
        r.x += (targetX - r.x) * smoothK;
        r.z += (targetZ - r.z) * smoothK;
        r.y += (targetY - r.y) * Math.min(1.0, dt * 12);
        r.h += angDiff(targetH, r.h) * smoothK;
      }

      r.v = targetV;
      r.steer = targetSteer;
      if (typeof p.rpm === 'number') r.rpm = p.rpm;
      if (typeof p.thr === 'number') r.thr = p.thr;
      if (typeof p.gear === 'number') r.gear = p.gear;

      // Kuzov egilishi (roll & pitch)
      const dh = angDiff(targetH, r.h);
      const targetRoll = THREE.MathUtils.clamp(-dh * targetV * 0.005, -0.06, 0.06);
      const targetPitch = p.braking && Math.abs(targetV) > 2 ? 0.028 : 0;
      r.roll += (targetRoll - r.roll) * Math.min(1.0, dt * 8);
      r.pitch += (targetPitch - r.pitch) * Math.min(1.0, dt * 8);

      // ========================================================================
      // SPATIAL INTEREST CULLING & LOD (Uzoqdagi o'yinchilarni optimallashtirish)
      // ========================================================================
      const distToMe = Math.hypot(r.x - me.x, r.z - me.z);
      const isFar = distToMe > 1200;
      const g = r.model.group;
      const sameZone = !!me?.inClub === !!p.inClub;

      if (!sameZone) {
        g.visible = false;
        if (r.charModel) r.charModel.group.visible = false;
        continue;
      }

      if (p.inClub) {
        g.visible = false;
        if (!r.charModel) {
          r.charModel = buildCharacterModel(p.color || '#00e5ff');
          this.scene.add(r.charModel.group);
        }
        r.charModel.group.visible = true;
        r.charModel.group.position.set(r.x, r.y, r.z);
        r.charModel.group.rotation.set(0, r.h, 0);
        r.charModel.animate(dt, r.v, p.anim || (Math.abs(r.v) > 0.2 ? 'walk' : 'idle'));
        if (r.label.parent !== r.charModel.group) r.charModel.group.add(r.label);
        r.label.scale.set(2.4, chatText ? 0.92 : 0.65, 1);
        r.label.position.set(0, 2.25, 0);
        r.label.visible = true;
        r.beacon.visible = false;
        continue;
      }

      if (r.charModel) r.charModel.group.visible = false;
      g.visible = !isFar;
      g.position.set(r.x, r.y, r.z);
      g.rotation.set(r.pitch, r.h, r.roll, 'YXZ');

      if (!isFar) {
        // Masofaviy LOD: 420m dan uzoqda og'ir GLB kuzovni yashirib, yengil beacon va label ko'rsatamiz
        const showFullCar = distToMe < 420;
        if (r.model.chassisTilt) {
          r.model.chassisTilt.visible = showFullCar;
        }

        if (showFullCar) {
          const isNearby = distToMe < 120;
          const stepDist = isNearby && Math.abs(targetV) > 0.1 ? targetV * dt : 0;
          r.model.update(stepDist, isNearby ? r.steer : 0);
          r.model.setLights?.(isNearby ? (p.lights !== undefined ? p.lights : night > 0.35) : false);
          r.model.setBrake?.(!!p.braking);
        }
      }

      if (r.label.parent !== g) g.add(r.label);
      const lblScale = THREE.MathUtils.clamp(1 + (distToMe - 25) * 0.012, 1.0, 4.0);
      r.label.scale.set(4.3 * lblScale, (chatText ? 1.66 : 1.16) * lblScale, 1);
      r.label.position.set(0, cfg.hei + (chatText ? 1.35 : 1.05) + (lblScale - 1) * 0.55, 0);
      r.label.visible = !isFar;
      r.beacon.visible = distToMe > 45 && !isFar;
    }

    // Chiqib ketgan o'yinchilarni tozalash
    for (const [id, r] of this.map) {
      if (!seen.has(id)) {
        this.dispose(r);
        this.map.delete(id);
      }
    }
    this.cars = [...this.map.values()];
  }

  dispose(r) {
    if (!r) return;
    disposeCarGroup(r.model.group);
    this.scene.remove(r.model.group);
    if (r.charModel) {
      disposeCarGroup(r.charModel.group);
      this.scene.remove(r.charModel.group);
    }
  }
}
