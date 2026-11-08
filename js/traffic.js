// Shahar transporti (3D GLB modelli AI mashinalar) va 3D animatsiyali NPC piyodalar
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CARS } from './config.js';
import { buildCar } from './carModel.js';
import { N, BLOCK, ROAD, roadC, blockC, blockInfo } from './world/layout.js';
import { signalFor } from './world/props.js';

const LANE = 4.6;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
// Faqat /car/ papkasidagi haqiqiy 3D GLB modellar
// Trafikda faqat yengil (kam poligonli) modellar ishlatiladi — o'yin qotmasligi uchun
const TRAFFIC_POOL = ['m4gts', 'mercedes', 'm4comp', 'mercedes', 'm4gts', 'm4comp', 'lambo', 'mercedes'];
const CULL_DIST = 170; // shundan uzoqdagi mashinalar chizilmaydi
const TAXI_COLOR = '#f9d71c';
const PALETTE = ['#f5f5f5', '#f5f5f5', '#111111', '#9e9e9e', '#c0c0c0', '#1565c0', '#c62828', TAXI_COLOR, '#2e3b4e'];

export class Traffic {
  constructor(scene, count) {
    this.scene = scene;
    this.cars = [];
    for (let n = 0; n < count; n++) {
      const cfg = CARS.find((c) => c.id === TRAFFIC_POOL[n % TRAFFIC_POOL.length]) || CARS[0];
      const model = buildCar(cfg, { color: PALETTE[Math.floor(Math.random() * PALETTE.length)] }, { beam: false });
      scene.add(model.group);
      const car = { model, cfg, len: cfg.len, mass: cfg.body === 'suv' ? 2350 : 1520, x: 0, z: 0, heading: 0, v: 0, cruise: 9 + Math.random() * 5, stun: 0, honk: 0 };
      car.onHit = (nx, nz, kmh) => {
        car.stun = 2.6;
        const pushSpd = Math.min(8, Math.max(1.5, (kmh || 20) * 0.12));
        car.x += nx * 0.45;
        car.z += nz * 0.45;
        car.v = (nx * Math.sin(car.heading) + nz * Math.cos(car.heading)) * pushSpd;
        car.honk = kmh > 10 ? 1 : 0;
        car.model.setBlinker?.('hazard', performance.now() / 1000);
      };
      this.respawn(car, 0, 0, true);
      this.cars.push(car);
    }
  }

  respawn(car, px, pz, anywhere = false) {
    for (let tries = 0; tries < 30; tries++) {
      const i = Math.floor(Math.random() * (N + 1)), k = Math.floor(Math.random() * (N + 1));
      const d = Math.hypot(roadC(i) - px, roadC(k) - pz);
      if (!anywhere && (d < 160 || d > 420)) continue;
      const opts = DIRS.filter(([dx, dz]) => valid(i + dx, k + dz));
      const [dx, dz] = opts[Math.floor(Math.random() * opts.length)];
      Object.assign(car, { ni: i + dx, nk: k + dz, dx, dz, v: car.cruise, stun: 0 });
      car.x = roadC(i) - dz * LANE;
      car.z = roadC(k) + dx * LANE;
      car.heading = Math.atan2(dx, dz);
      return;
    }
  }

  update(dt, t, player) {
    const night = this.night || 0;
    this.tickCount = (this.tickCount || 0) + 1;
    const px = player.x, pz = player.z;

    for (let idx = 0; idx < this.cars.length; idx++) {
      const car = this.cars[idx];
      const distSq = (car.x - px) * (car.x - px) + (car.z - pz) * (car.z - pz);
      if (distSq > 480 * 480) {
        this.respawn(car, px, pz);
        continue;
      }

      const isFar = distSq > CULL_DIST * CULL_DIST;
      const g = car.model.group;

      // Uzoqdagi AI transport: soddalashtirilgan harakat (CPU va drawcall tejami)
      if (isFar) {
        g.visible = false;
        // Uzoq mashinalarni faqat har 2-kadrda hisoblash (time-slicing)
        if ((this.tickCount + idx) % 2 === 0) {
          const step = car.v * dt * 2;
          car.x += Math.sin(car.heading) * step;
          car.z += Math.cos(car.heading) * step;
          g.position.set(car.x, 0, car.z);
        }
        continue;
      }

      g.visible = true;
      const tx = roadC(car.ni) - car.dz * LANE, tz = roadC(car.nk) + car.dx * LANE;
      const toT = Math.hypot(tx - car.x, tz - car.z);
      if (toT < 4) this.nextNode(car);

      let want = car.cruise;
      const interior = car.ni > 0 && car.nk > 0 && car.ni < N && car.nk < N;
      const stopD = toT - ROAD / 2 - 2;
      if (interior && signalFor(car.dx ? 'x' : 'z', t) !== 'g' && stopD > -1 && stopD < 14) {
        want = stopD < 1 ? 0 : Math.min(want, stopD * 0.7);
      }

      // To'siqlar va mashinalar bilan to'qnashuvni tekshirish (GC xotira ajratishsiz)
      const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      for (let j = 0; j < this.cars.length; j++) {
        if (j === idx) continue;
        const o = this.cars[j];
        const ox = o.x - car.x, oz = o.z - car.z;
        const ahead = ox * fx + oz * fz;
        if (ahead > 0 && ahead < 14) {
          const side = Math.abs(ox * fz - oz * fx);
          if (side < 2.6) want = Math.min(want, Math.max(0, (ahead - 6) * 0.8));
        }
      }
      // O'yinchi mashinasini tekshirish
      const pox = px - car.x, poz = pz - car.z;
      const pAhead = pox * fx + poz * fz;
      if (pAhead > 0 && pAhead < 14) {
        const pSide = Math.abs(pox * fz - poz * fx);
        if (pSide < 2.6) want = Math.min(want, Math.max(0, (pAhead - 6) * 0.8));
      }

      if (car.stun > 0) { car.stun -= dt; want = 0; }
      { // Burchakda sekinlash
        const dh0 = Math.atan2(Math.sin(Math.atan2(tx - car.x, tz - car.z) - car.heading), Math.cos(Math.atan2(tx - car.x, tz - car.z) - car.heading));
        if (Math.abs(dh0) > 0.35) want = Math.min(want, 5.5);
        else if (toT < 22 && car.turning) want = Math.min(want, 7);
      }
      car.v += THREE.MathUtils.clamp(want - car.v, -8 * dt, 3 * dt);

      const desired = Math.atan2(tx - car.x, tz - car.z);
      let dh = desired - car.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      car.heading += THREE.MathUtils.clamp(dh, -2.2 * dt, 2.2 * dt);
      const step = car.v * dt;
      car.x += Math.sin(car.heading) * step; car.z += Math.cos(car.heading) * step;

      car.roll = (car.roll || 0) + ((-dh * car.v * 0.012) - (car.roll || 0)) * Math.min(1, dt * 5);
      car.pitch = (car.pitch || 0) + ((want < car.v - 0.5 ? 0.02 : 0) - (car.pitch || 0)) * Math.min(1, dt * 6);
      g.position.set(car.x, 0, car.z);
      g.rotation.set(car.pitch, car.heading, THREE.MathUtils.clamp(car.roll, -0.05, 0.05), 'YXZ');

      const isNearby = distSq < 90 * 90;
      if (isNearby) {
        car.model.update(step, THREE.MathUtils.clamp(dh * 2, -0.5, 0.5));
      }
      car.model.setLights(night > 0.4);
      car.model.setBrake(want < car.v - 0.5 || car.stun > 0);
      if (car.stun > 0) car.model.setBlinker?.('hazard', t);
      else if (car.turning && toT < 24) {
        const turnSign = Math.sin(Math.atan2(tx - car.x, tz - car.z) - car.heading);
        car.model.setBlinker?.(turnSign > 0.08 ? 'left' : turnSign < -0.08 ? 'right' : 'off', t);
      } else {
        car.model.setBlinker?.('off', t);
      }
    }
  }

  nextNode(car) {
    const i = car.ni, k = car.nk;
    let opts = DIRS.filter(([dx, dz]) => !(dx === -car.dx && dz === -car.dz) && valid(i + dx, k + dz));
    if (!opts.length) opts = [[-car.dx, -car.dz]];
    if (opts.some(([dx, dz]) => dx === car.dx && dz === car.dz) && Math.random() < 0.55) opts = [[car.dx, car.dz]];
    const [dx, dz] = opts[Math.floor(Math.random() * opts.length)];
    car.turning = !(dx === car.dx && dz === car.dz);
    Object.assign(car, { dx, dz, ni: i + dx, nk: k + dz });
  }

  setNight(n) { this.night = n; }
}
const valid = (i, k) => i >= 0 && k >= 0 && i <= N && k <= N;

// ---- 3D NPC Piyodalar: bosh, soch/kepka, gavda, harakatlanuvchi qo'llar va oyoqlar ----
export class Pedestrians {
  constructor(scene, count) {
    this.count = count;
    this.list = [];

    // 1. Gavda (kurtka/ko'ylak + yelkalar + yoqa)
    const chest = new THREE.CapsuleGeometry(0.19, 0.36, 6, 12);
    chest.scale(1.15, 1, 0.72);
    chest.translate(0, 1.16, 0);
    const collar = new THREE.CylinderGeometry(0.11, 0.14, 0.1, 10);
    collar.translate(0, 1.46, 0);
    const torsoGeo = mergeGeometries([chest, collar]);

    // 2. Bosh + bo'yin + burun (3D odam boshi)
    const skull = new THREE.SphereGeometry(0.155, 14, 12);
    skull.scale(0.92, 1.05, 0.96);
    skull.translate(0, 1.66, 0);
    const neck = new THREE.CylinderGeometry(0.065, 0.075, 0.12, 8);
    neck.translate(0, 1.50, 0);
    const nose = new THREE.ConeGeometry(0.025, 0.06, 6);
    nose.rotateX(Math.PI / 2);
    nose.translate(0, 1.65, 0.155);
    const headGeo = mergeGeometries([skull, neck, nose]);

    // 3. Soch / Bosh kiyim (3D)
    const hairTop = new THREE.SphereGeometry(0.162, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.58);
    hairTop.scale(0.94, 1.02, 1.0);
    hairTop.translate(0, 1.67, -0.01);
    const hairBack = new THREE.BoxGeometry(0.24, 0.14, 0.12);
    hairBack.translate(0, 1.64, -0.09);
    const hairGeo = mergeGeometries([hairTop, hairBack]);

    // 4. Qo'l (yelka bo'g'imidan osilgan 3D qo'l, yeng va kaft bilan)
    const upperArm = new THREE.CapsuleGeometry(0.058, 0.42, 4, 8);
    upperArm.translate(0, -0.24, 0);
    const hand = new THREE.SphereGeometry(0.052, 8, 8);
    hand.translate(0, -0.49, 0);
    const armGeo = mergeGeometries([upperArm, hand]);

    // 5. Oyoq (son bo'g'imidan osilgan 3D shim)
    const legCyl = new THREE.CapsuleGeometry(0.078, 0.56, 4, 8);
    legCyl.translate(0, -0.34, 0);

    // 6. Oyoq kiyim (3D krossovka/tufli, oyoq uchida)
    const shoeBox = new THREE.BoxGeometry(0.13, 0.09, 0.24);
    shoeBox.translate(0, -0.69, 0.04);

    const cap = new THREE.SphereGeometry(0.165, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
    cap.scale(0.98, 0.7, 1.0);
    cap.translate(0, 1.72, 0);
    const capGeo = cap;

    const shirtMat = new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0.05 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe0ac7e, roughness: 0.6 });
    const hairMat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
    const pantsMat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.5 });

    const capMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.7 });
    this.cap = new THREE.InstancedMesh(capGeo, capMat, count);
    this.torso = new THREE.InstancedMesh(torsoGeo, shirtMat, count);
    this.head = new THREE.InstancedMesh(headGeo, skinMat, count);
    this.hair = new THREE.InstancedMesh(hairGeo, hairMat, count);
    this.armL = new THREE.InstancedMesh(armGeo, shirtMat, count);
    this.armR = new THREE.InstancedMesh(armGeo, shirtMat, count);
    this.legL = new THREE.InstancedMesh(legCyl, pantsMat, count);
    this.legR = new THREE.InstancedMesh(legCyl, pantsMat, count);
    this.shoeL = new THREE.InstancedMesh(shoeBox, shoeMat, count);
    this.shoeR = new THREE.InstancedMesh(shoeBox, shoeMat, count);

    const shirtCols = ['#c62828', '#1565c0', '#2e7d32', '#f9a825', '#f0f2f5', '#6a1b9a', '#37474f', '#ef6c00', '#00838f', '#ad1457'];
    const pantsCols = ['#1e2430', '#2b2d38', '#1a334d', '#3e352f', '#212121', '#37474f'];
    const hairCols = ['#181412', '#2c1d14', '#4a3222', '#111111', '#3b2818', '#0d1b2a'];

    const cTmp = new THREE.Color();
    for (let n = 0; n < count; n++) {
      cTmp.set(shirtCols[n % shirtCols.length]);
      this.torso.setColorAt(n, cTmp);
      this.armL.setColorAt(n, cTmp);
      this.armR.setColorAt(n, cTmp);

      cTmp.set(pantsCols[n % pantsCols.length]);
      this.legL.setColorAt(n, cTmp);
      this.legR.setColorAt(n, cTmp);

      cTmp.set(hairCols[n % hairCols.length]);
      this.hair.setColorAt(n, cTmp);

      const scaleH = 0.92 + (n % 5) * 0.04;
      const p = {
        t: Math.random() * 4,
        speed: (1.05 + Math.random() * 0.55) * (Math.random() < 0.5 ? 1 : -1),
        phase: Math.random() * Math.PI * 2,
        dodge: 0,
        scaleH,
        cap: n % 4 === 1,
        pause: 0,
        wait: 4 + Math.random() * 10,
      };
      this.place(p, 0, 0, true);
      this.list.push(p);
    }

    const meshes = [this.cap, this.torso, this.head, this.hair, this.armL, this.armR, this.legL, this.legR, this.shoeL, this.shoeR];
    for (const im of meshes) {
      im.castShadow = true;
      scene.add(im);
    }

    this.m = new THREE.Matrix4();
    this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
    this.qRoot = new THREE.Quaternion();
    this.qSwing = new THREE.Quaternion();
    this.qLimb = new THREE.Quaternion();
    this.s = new THREE.Vector3(1, 1, 1);
    this.v = new THREE.Vector3();
    this.up = new THREE.Vector3(0, 1, 0);
    this.rightAxis = new THREE.Vector3(1, 0, 0);
  }

  place(p, px, pz, any) {
    for (let tries = 0; tries < 30; tries++) {
      const j = Math.floor(Math.random() * N), k = Math.floor(Math.random() * N);
      const info = blockInfo(j, k);
      if (info.type === 'canal' || info.type === 'gas' || info.type === 'garage') continue;
      if (!any && Math.hypot(blockC(j) - px, blockC(k) - pz) > 300) continue;
      p.j = j; p.k = k; return;
    }
  }

  pos(p) {
    const h = BLOCK / 2 - 2.2, side = Math.floor(((p.t % 4) + 4) % 4), f = (((p.t % 1) + 1) % 1) * 2 - 1;
    const cx = blockC(p.j), cz = blockC(p.k);
    const pts = [[cx + f * h, cz - h], [cx + h, cz + f * h], [cx - f * h, cz + h], [cx - h, cz - f * h]];
    return pts[side];
  }

  update(dt, t, player) {
    const { m, qRoot, qSwing, qLimb, s, v, up, rightAxis } = this;
    const px = player.x, pz = player.z;
    const cullDist = 160;

    this.list.forEach((p, n) => {
      const distToBlock = Math.hypot(blockC(p.j) - px, blockC(p.k) - pz);
      if (distToBlock > 360) this.place(p, px, pz);
      if (distToBlock > cullDist) {
        if (!p.culled) {
          p.culled = true;
          this.torso.setMatrixAt(n, this.zero);
          this.head.setMatrixAt(n, this.zero);
          this.hair.setMatrixAt(n, this.zero);
          this.cap.setMatrixAt(n, this.zero);
          this.armL.setMatrixAt(n, this.zero);
          this.armR.setMatrixAt(n, this.zero);
          this.legL.setMatrixAt(n, this.zero);
          this.legR.setMatrixAt(n, this.zero);
          this.shoeL.setMatrixAt(n, this.zero);
          this.shoeR.setMatrixAt(n, this.zero);
        }
        return;
      }
      p.culled = false;
      const [x0, z0] = this.pos(p);
      // Burchakka (chorrahaga) yaqinlashganda qizil chiroqda kutish yoki telefon ko'rish
      const frac = ((p.t % 1) + 1) % 1;
      const nearCorner = frac < 0.04 || frac > 0.96;
      const side = Math.floor(((p.t % 4) + 4) % 4);
      const axis = side % 2 === 0 ? 'x' : 'z';
      const redLight = nearCorner && signalFor(axis, t) !== 'g';

      p.wait -= dt;
      if (p.wait <= 0 && p.pause <= 0) {
        p.pause = 2.2 + Math.random() * 4.2;
        p.wait = 9 + Math.random() * 14;
        p.pose = Math.random() < 0.55 ? 'phone' : 'talk';
      }
      if (p.pause > 0) p.pause -= dt;
      const stopped = p.pause > 0 || redLight;
      p.mv = (p.mv ?? 1) + ((stopped ? 0 : 1) - (p.mv ?? 1)) * Math.min(1, dt * 5);
      p.t += (p.speed * p.mv / (BLOCK - 4.4)) * dt;
      const [x, z] = this.pos(p);

      // O'yinchi mashinasidan uzoqlashish va chetga qochish (Car avoidance)
      const dp = Math.hypot(player.x - x, player.z - z);
      const scare = dp < 8.5 && player.kmh > 8 ? 2.1 : 0;
      p.dodge += (scare - p.dodge) * Math.min(1, dt * 7);
      const ang = Math.atan2(x - x0, z - z0) || 0;
      const rx = Math.cos(ang), rz = -Math.sin(ang);
      const bx = x - rx * p.dodge, bz = z - rz * p.dodge;

      const walkFreq = Math.abs(p.speed) * (scare > 0.5 ? 9.5 : 6.2);
      p.ph = (p.ph ?? p.phase) + dt * walkFreq * Math.max(p.mv, scare > 0.5 ? 1 : 0);
      const phase = p.ph;
      const swing = Math.sin(phase) * 0.52 * p.mv;
      const bob = Math.abs(Math.cos(phase)) * 0.045 * p.mv;
      const sh = p.scaleH;
      const y0 = 0.22;

      qRoot.setFromAxisAngle(up, ang + (stopped && p.pose === 'talk' ? Math.sin(t * 1.8 + n) * 0.22 : 0));
      s.set(1, sh, 1);

      // Gavda, bosh va soch
      m.compose(v.set(bx, y0 + bob, bz), qRoot, s);
      this.torso.setMatrixAt(n, m);
      this.head.setMatrixAt(n, m);
      this.hair.setMatrixAt(n, m);
      if (p.cap) this.cap.setMatrixAt(n, m); else this.cap.setMatrixAt(n, this.zero);

      // Chap qo'l (oldinga-orqaga silkinish)
      qSwing.setFromAxisAngle(rightAxis, swing * 0.85);
      qLimb.multiplyQuaternions(qRoot, qSwing);
      m.compose(v.set(bx - rx * 0.24, y0 + bob + 1.38 * sh, bz - rz * 0.24), qLimb, s);
      this.armL.setMatrixAt(n, m);

      // O'ng qo'l (to'xtab turganda telefon ko'rish yoki suhbat ishorasi)
      const rightArmAng = stopped && p.pose === 'phone'
        ? -1.05
        : stopped && p.pose === 'talk'
          ? -0.45 + Math.sin(t * 4.5 + n) * 0.25
          : -swing * 0.85;
      qSwing.setFromAxisAngle(rightAxis, rightArmAng);
      qLimb.multiplyQuaternions(qRoot, qSwing);
      m.compose(v.set(bx + rx * 0.24, y0 + bob + 1.38 * sh, bz + rz * 0.24), qLimb, s);
      this.armR.setMatrixAt(n, m);

      // Chap oyoq va oyoq kiyim
      qSwing.setFromAxisAngle(rightAxis, -swing);
      qLimb.multiplyQuaternions(qRoot, qSwing);
      m.compose(v.set(bx - rx * 0.10, y0 + bob + 0.74 * sh, bz - rz * 0.10), qLimb, s);
      this.legL.setMatrixAt(n, m);
      this.shoeL.setMatrixAt(n, m);

      // O'ng oyoq va oyoq kiyim
      qSwing.setFromAxisAngle(rightAxis, swing);
      qLimb.multiplyQuaternions(qRoot, qSwing);
      m.compose(v.set(bx + rx * 0.10, y0 + bob + 0.74 * sh, bz + rz * 0.10), qLimb, s);
      this.legR.setMatrixAt(n, m);
      this.shoeR.setMatrixAt(n, m);
    });

    this.cap.instanceMatrix.needsUpdate = true;
    this.torso.instanceMatrix.needsUpdate = true;
    this.head.instanceMatrix.needsUpdate = true;
    this.hair.instanceMatrix.needsUpdate = true;
    this.armL.instanceMatrix.needsUpdate = true;
    this.armR.instanceMatrix.needsUpdate = true;
    this.legL.instanceMatrix.needsUpdate = true;
    this.legR.instanceMatrix.needsUpdate = true;
    this.shoeL.instanceMatrix.needsUpdate = true;
    this.shoeR.instanceMatrix.needsUpdate = true;
  }
}


