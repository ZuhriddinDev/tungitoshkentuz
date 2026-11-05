// Arkada-realistik avtomobil fizikasi: silliq rul, tabiiy gaz/tormoz, yo'ldan chiqqanda barqarorlik,
// aqlli shahar chegarasi (YPX Posti) va kolliziyalar
import { queryColliders, onRoad, HALF } from './world/layout.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ENGINE_MUL = [1, 1.1, 1.2, 1.32];

export class Vehicle {
  constructor(cfg, inst) {
    this.cfg = cfg;
    this.inst = inst;
    this.x = 0;
    this.z = 0;
    this.heading = 0;
    this.v = 0;
    this.lat = 0;
    this.yawRate = 0;
    this.steer = 0;
    this.rpm = 0.18;
    this.gear = 1;
    this.drifting = false;
    this.slip = 0;
    this.braking = false;
    this.impact = 0;
    this.odo = 0;
    this.thr = 0;
    this.brk = 0;
    this.offRoad = false;
    this.nearBorder = false;
    this.borderMsg = '';
  }
  get kmh() { return Math.abs(this.v) * 3.6; }
  get fwdX() { return Math.sin(this.heading); }
  get fwdZ() { return Math.cos(this.heading); }

  // input: { throttle 0..1, reverse 0..1, steer -1..1, boost bool, handbrake bool }
  step(dt, input, others = []) {
    const c = this.cfg, inst = this.inst;
    const fuelOk = inst.fuelL > 0;
    const wrongFuel = inst.fuelType && inst.fuelType !== c.fuel ? 0.88 : 1;
    const power = ENGINE_MUL[inst.engine || 0] * wrongFuel * (1 - inst.damage / 260) * (fuelOk ? 1 : 0);
    const boost = input.boost && fuelOk ? 1.32 : 1;
    const vmaxRoad = (c.maxSpeed / 3.6) * (0.9 + 0.1 * ENGINE_MUL[inst.engine || 0]) * (input.boost ? 1.08 : 1);

    // Yo'ldan chiqqanda (trotuar, maysazor) boshqaruv buzilmasligi va barqaror yurishi
    this.offRoad = !onRoad(this.x, this.z);
    const surfaceGrip = this.offRoad ? 0.94 : 1.0;
    const vmax = this.offRoad ? Math.min(vmaxRoad, 130 / 3.6) : vmaxRoad;
    const vrev = 32 / 3.6;

    // Gaz va tormoz pedali silliq ishlaydi (keskin siltanishsiz)
    this.thr += (input.throttle - this.thr) * Math.min(1, dt * 8.5);
    this.brk += (input.reverse - this.brk) * Math.min(1, dt * 10);
    const traction = 10.2 * c.grip * surfaceGrip;

    let a = 0;
    this.braking = false;
    if (input.throttle > 0) {
      if (this.v < -0.4) {
        a = Math.min(c.brake * 1.15, traction * 1.2);
        this.braking = true;
      } else {
        const speedRatio = Math.max(0, this.v) / vmax;
        const torqueCurve = Math.max(0.18, 1 - speedRatio ** 1.85);
        a = Math.min(c.accel * power * boost * this.thr, traction * 1.1) * torqueCurve;
      }
    } else if (input.reverse > 0) {
      if (this.v > 0.4) {
        a = -Math.min(c.brake * 1.15, traction * 1.2) * (0.35 + 0.65 * this.brk);
        this.braking = true;
      } else {
        a = -Math.min(c.accel * 0.52 * power, traction) * input.reverse * (1 - (Math.abs(this.v) / vrev) ** 1.8);
      }
    } else {
      // Gazdan oyoq olinganda: tabiiy dvigatel tormozi + dumalash qarshiligi
      const offRoadDrag = this.offRoad ? 1.4 : 0.55;
      a = -Math.sign(this.v) * (offRoadDrag + 0.015 * Math.abs(this.v) + 0.0011 * this.v * this.v);
      if (Math.abs(this.v) < 0.25) { this.v = 0; a = 0; }
    }

    if (input.handbrake) {
      a -= Math.sign(this.v) * c.brake * 0.52;
      this.braking = true;
    }
    this.v = clamp(this.v + a * dt, -vrev, vmax);

    // Silliq rul boshqaruvi: past tezlikda manevrli, yuqori tezlikda barqaror va aniq
    const speed = Math.abs(this.v);
    const maxSteer = 0.56 / (1 + speed * 0.052);
    const steerTarget = input.steer * maxSteer;
    const steerRate = Math.abs(steerTarget) < Math.abs(this.steer) ? 13 : 8.2;
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * steerRate);

    const wheelBase = c.len * 0.62;
    const hb = input.handbrake && speed > 5.5;
    const grip = c.grip * surfaceGrip * (hb ? 0.38 : 1);

    const desiredYaw = (this.v / wheelBase) * Math.tan(this.steer) * (hb ? 1.45 : 1);
    const maxYaw = (traction * (hb ? 0.62 : 1.05)) / Math.max(speed, 2.2);
    const targetYaw = clamp(desiredYaw, -maxYaw, maxYaw);
    this.yawRate += (targetYaw - this.yawRate) * Math.min(1, dt * (6.5 + grip * 5.5));
    this.heading += this.yawRate * dt;

    // Yon sirpanish: yo'ldan chiqqanda anti-spin stabilizator mashinani aylanib ketishdan saqlaydi
    const latKick = hb ? 0.52 : this.offRoad ? 0.06 : 0.10;
    this.lat += -this.yawRate * this.v * dt * latKick;
    const latDamp = hb ? 1.35 : this.offRoad ? 9.5 : 6.8;
    this.lat *= Math.exp(-dt * grip * latDamp);
    this.lat = clamp(this.lat, -speed * 0.55, speed * 0.55);

    this.slip = Math.atan2(Math.abs(this.lat), Math.max(1.2, speed));
    this.drifting = (this.slip > 0.17 || (hb && Math.abs(this.steer) > 0.08)) && speed > 7.5;
    if (this.drifting) this.v -= Math.sign(this.v) * this.slip * 1.9 * dt;

    const rx = Math.cos(this.heading), rz = -Math.sin(this.heading);
    const dx = (this.fwdX * this.v + rx * this.lat) * dt;
    const dz = (this.fwdZ * this.v + rz * this.lat) * dt;
    this.x += dx;
    this.z += dz;
    const dist = Math.hypot(dx, dz);
    this.odo += dist;

    // Aqlli shahar chegarasi (YPX posti ogohlantirishi va yumshoq qaytarish)
    this.checkBorder(dt);

    // Benzin sarfi (l/100km)
    const use = c.fuelUse * (dist / 100000) * (0.6 + 0.6 * this.thr + (input.boost ? 0.5 : 0)) + 0.00002 * dt;
    inst.fuelL = Math.max(0, inst.fuelL - use);

    // 6 pog'onali uzatma va realistik RPM hisoblash
    const kmh = this.kmh;
    const gears = [0, 26, 56, 92, 136, 188, 420];
    let gIdx = 1;
    for (let i = 1; i < gears.length; i++) {
      if (kmh <= gears[i]) { gIdx = i; break; }
    }
    this.gear = gIdx;
    const gLo = gears[gIdx - 1] * 0.78;
    const gHi = Math.min(gears[gIdx], c.maxSpeed * 1.05);
    const gearRatio = clamp((kmh - gLo) / Math.max(8, gHi - gLo), 0, 1);
    const targetRpm = kmh < 2
      ? 0.16 + this.thr * 0.52
      : clamp(0.22 + gearRatio * 0.68 + this.thr * 0.12 - (this.braking ? 0.06 : 0), 0.16, 1);
    this.rpm += (targetRpm - this.rpm) * Math.min(1, dt * 10);

    this.impact = 0;
    this.collide(others);
    return dist;
  }

  checkBorder(dt) {
    const warnEdge = HALF - 18;
    const hardEdge = HALF + 14;
    const ax = Math.abs(this.x), az = Math.abs(this.z);
    if (ax > warnEdge || az > warnEdge) {
      this.nearBorder = true;
      if (this.z < -warnEdge) {
        this.borderMsg = "🚧 YPX Posti (Yunusobod · Katta halqa yo'li): Shahar tashqarisida yo'l yopiq — markazga qayting!";
      } else if (this.z > warnEdge) {
        this.borderMsg = "🚧 YPX Posti (Chilonzor / Sergeli yo'nalishi): Tashqi magistralda ta'mirlash ishlari — orqaga buriling!";
      } else if (this.x < -warnEdge) {
        this.borderMsg = "🚧 YPX Posti (G'arbiy halqa yo'li): Shahar chegarasiga yetdingiz — Toshkent markaziga qayting!";
      } else {
        this.borderMsg = "🚧 YPX Posti (Sharqiy halqa yo'li): Bu yo'nalish vaqtincha yopiq — shahar ichiga qayting!";
      }
      // Chegaradan tashqariga chiqsa, zararsiz yumshoq sekinlashtiramiz va ichkariga qaytaramiz
      if (ax > hardEdge || az > hardEdge) {
        this.v *= Math.pow(0.25, dt);
        this.x = clamp(this.x, -hardEdge, hardEdge);
        this.z = clamp(this.z, -hardEdge, hardEdge);
      }
    } else {
      this.nearBorder = false;
      this.borderMsg = '';
    }
  }

  collide(others) {
    const c = this.cfg, r = c.wid * 0.5;
    for (const off of [c.len * 0.33, 0, -c.len * 0.33]) {
      let px = this.x + this.fwdX * off, pz = this.z + this.fwdZ * off;
      for (const b of queryColliders(px, pz, r + 1)) {
        const cx = clamp(px, b.minX, b.maxX), cz = clamp(pz, b.minZ, b.maxZ);
        let nx = px - cx, nz = pz - cz, d = Math.hypot(nx, nz);
        if (d >= r) continue;
        if (d < 1e-4) { nx = Math.sign(px - (b.minX + b.maxX) / 2) || 1; nz = 0; d = 0; }
        else { nx /= d; nz /= d; }
        const push = r - d;
        this.x += nx * push; this.z += nz * push; px += nx * push; pz += nz * push;
        this.hit(nx, nz, b.tag);
      }
    }
    for (const o of others) {
      const dx = this.x - o.x, dz = this.z - o.z, d = Math.hypot(dx, dz), min = (c.len + (o.len || 4.4)) * 0.4;
      if (d >= min || d < 1e-4) continue;
      const nx = dx / d, nz = dz / d;
      this.x += nx * (min - d) * 0.7; this.z += nz * (min - d) * 0.7;
      if (o.onHit) o.onHit(-nx, -nz, this.kmh);
      this.hit(nx, nz, 'car');
    }
  }

  hit(nx, nz, tag) {
    const vx = this.fwdX * this.v, vz = this.fwdZ * this.v;
    const into = -(vx * nx + vz * nz);
    if (into <= 0) return;
    const nvx = vx + nx * into * 1.25, nvz = vz + nz * into * 1.25;
    this.v = (nvx * this.fwdX + nvz * this.fwdZ) * 0.86;
    this.lat *= 0.45;
    if (tag === 'border') return; // shahar chegarasida mashinaga zarar yetmaydi
    this.impact = Math.max(this.impact, into);
    if (into > 4.5) this.inst.damage = Math.min(100, this.inst.damage + into * 0.55);
  }

  place(x, z, heading) {
    this.x = x; this.z = z; this.heading = heading;
    this.v = 0; this.lat = 0; this.yawRate = 0; this.thr = 0; this.brk = 0;
  }
}
