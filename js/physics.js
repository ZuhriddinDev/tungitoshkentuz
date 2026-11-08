// Arkada-realistik avtomobil fizikasi: silliq rul, tabiiy gaz/tormoz, drift va qo'l tormozi,
// to'liq motor/turbo/tormoz/podveska tuningi hamda shikastlanishsiz barqaror kolliziya
import { queryColliders, onRoad, HALF } from './world/layout.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ENGINE_MUL = [1, 1.10, 1.20, 1.32];
const TURBO_MUL  = [1, 1.12, 1.25];
const ACCEL_MUL  = [1, 1.12, 1.24];
const BRAKE_MUL  = [1, 1.18, 1.35];
const GRIP_MUL   = [1, 1.12, 1.25];

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
    this.roll = 0;
    this.pitch = 0;
    this.driftFactor = 0;
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
    this.mass = cfg.body === 'suv' ? 2350 : cfg.body === 'super' ? 1580 : 1480;
    this.hitCooldowns = new Map();
    inst.damage = 0;
  }
  get kmh() { return Math.abs(this.v) * 3.6; }
  get fwdX() { return Math.sin(this.heading); }
  get fwdZ() { return Math.cos(this.heading); }

  // input: { throttle 0..1, reverse 0..1, steer -1..1, boost bool, handbrake bool, drift bool }
  step(dt, input, others = []) {
    dt = Math.min(dt, 0.05);
    const c = this.cfg, inst = this.inst;
    inst.damage = 0; // Avariya va shikastlanish o'chirilgan
    const fuelOk = inst.fuelL > 0;
    const wrongFuel = inst.fuelType && inst.fuelType !== c.fuel ? 0.90 : 1;

    const engMul = ENGINE_MUL[inst.engine || 0] || 1;
    const trbMul = TURBO_MUL[inst.turbo || 0] || 1;
    const accMul = ACCEL_MUL[inst.accelTune || 0] || 1;
    const brkMul = BRAKE_MUL[inst.brakeTune || 0] || 1;
    const grpMul = GRIP_MUL[inst.handlingTune || 0] || 1;

    const power = engMul * trbMul * accMul * wrongFuel * (fuelOk ? 1 : 0);
    const boost = input.boost && fuelOk ? 1.38 : 1;
    const topBoost = (engMul - 1) * 0.45 + (trbMul - 1) * 0.55;
    const vmaxRoad = (c.maxSpeed / 3.6) * (1.0 + topBoost) * (input.boost ? 1.10 : 1);

    this.offRoad = !onRoad(this.x, this.z);
    const surfaceGrip = this.offRoad ? 0.96 : 1.0;
    const vmax = this.offRoad ? Math.min(vmaxRoad, 148 / 3.6) : vmaxRoad;
    const vrev = 38 / 3.6;

    this.thr += (input.throttle - this.thr) * Math.min(1, dt * 14);
    this.brk += (input.reverse - this.brk) * Math.min(1, dt * 16);
    const grip = c.grip * grpMul * surfaceGrip;
    const traction = 12.0 * grip;
    const brakePower = c.brake * brkMul;

    let a = 0;
    this.braking = false;
    if (input.throttle > 0) {
      if (this.v < -0.35) {
        a = Math.min(brakePower * 1.38, traction * 1.38);
        this.braking = true;
      } else {
        const speedRatio = Math.max(0, this.v) / Math.max(1, vmax);
        const lowEndBoost = speedRatio < 0.28 ? 1.18 : 1.0;
        const torqueCurve = Math.max(0.24, 1 - speedRatio ** 1.9) * lowEndBoost;
        a = Math.min(c.accel * 1.08 * power * boost * this.thr, traction * 1.22) * torqueCurve;
      }
    } else if (input.reverse > 0) {
      if (this.v > 0.35) {
        a = -Math.min(brakePower * 1.35, traction * 1.35) * (0.45 + 0.55 * this.brk);
        this.braking = true;
      } else {
        const revRatio = Math.abs(this.v) / vrev;
        a = -Math.min(c.accel * 0.58 * power, traction) * input.reverse * Math.max(0.2, 1 - revRatio ** 1.7);
      }
    } else {
      const offRoadDrag = this.offRoad ? 1.15 : 0.45;
      a = -Math.sign(this.v) * (offRoadDrag + 0.014 * Math.abs(this.v) + 0.001 * this.v * this.v);
      if (Math.abs(this.v) < 0.22) { this.v = 0; a = 0; }
    }

    if (input.handbrake) {
      a -= Math.sign(this.v) * brakePower * 0.62;
      this.braking = true;
    }
    this.v = clamp(this.v + a * dt, -vrev, vmax);

    // Rul va Burilish Tizimi (V14 — Yuqori sezgirlik, tabiiy Akerman fizikasi va tezkor kontr-rul)
    const speed = Math.abs(this.v);
    const speedKmh = speed * 3.6;
    const steerSens = clamp((typeof window !== 'undefined' && window.__steerSens) || 1.0, 0.6, 2.0);

    // Tezlikka bog'liq burilish burchagi (Speed-sensitive steering limit):
    // Past tezlikda (0 - 25 km/h) shahar burilishlari va U-turn uchun keng 38° (0.66 rad) burchak
    // O'rta tezlikda (40 - 80 km/h) shahar ko'chalarida tezkor burilish uchun 24° - 28° burchak
    // Yuqori tezlikda (100 - 250 km/h) barqaror magistral boshqaruvi uchun 13° - 16° burchak
    const speedSteerFalloff = 1 / (1 + Math.max(0, speedKmh - 16) * 0.015);
    const maxSteer = clamp(0.66 * speedSteerFalloff * steerSens, 0.22, 0.72);
    const steerInput = clamp(input.steer || 0, -1, 1);
    const steerTarget = steerInput * maxSteer;

    const isCentering = Math.abs(steerInput) < 0.02;
    const isCounterSteer = !isCentering && (steerInput * this.steer < -0.001);
    // Tezkor rul reaktsiyasi (kechikishsiz darhol burilish):
    // Burilishga kirish: 34 rad/s (~0.07 soniyada to'liq burchak)
    // Kontr-rul (slaydni ushlash): 48 rad/s (bir zumda qarama-qarshi tomonga qaytish)
    // Markazga qaytish: 38 rad/s
    const steerRate = (isCentering ? 38.0 : isCounterSteer ? 48.0 : 34.0) * Math.sqrt(steerSens);
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * steerRate);
    if (isCentering && Math.abs(this.steer) < 0.002) this.steer = 0;

    // Drift va Qo'l tormozi holati
    const wantDrift = Boolean((input.drift || input.handbrake) && speed > 3.5);
    const targetDrift = wantDrift ? 1.0 : 0.0;
    this.driftFactor += (targetDrift - this.driftFactor) * Math.min(1, dt * (wantDrift ? 9.5 : 7.0));
    if (!wantDrift && this.driftFactor < 0.01) this.driftFactor = 0;

    const wheelBase = Math.max(2.1, c.len * 0.56);

    if (speed < 0.10 && !input.throttle && !input.reverse) {
      this.yawRate = 0;
      this.lat = 0;
    } else {
      // Akerman kinematiyasi: w = (v / L) * tan(steer)
      // Tormozlanganda old aksga og'irlik ko'chishi (weight transfer) burilishni o'tkirroq qiladi
      const brakeTurnIn = this.braking && speed > 4 ? 1.14 : 1.0;
      const lowSpeedTurnBoost = speed < 14 ? 1.25 - (speed / 14) * 0.15 : 1.0;
      const kinYaw = (this.v / wheelBase) * Math.tan(this.steer) * lowSpeedTurnBoost * brakeTurnIn;

      // Dinamik lateral shina tutashuvi (Tire lateral grip limit):
      // Past va shahar tezliklarida (0 - 60 km/h) minimal 3.4 rad/s (195°/s) burchak tezligi beriladi,
      // bu orqali mashina har qanday Toshkent chorrahasida bir zumda, kechikishsiz buriladi.
      const aeroDownforce = Math.min(1.0, speed / 36) * 0.45;
      const maxLatAccel = traction * (1.65 + aeroDownforce + (this.driftFactor ? 0.65 : 0));
      const lowSpeedFloor = Math.max(0, 3.4 * (1 - speed / 24));
      const maxYaw = Math.max(lowSpeedFloor, maxLatAccel / Math.max(speed, 1.4));
      const targetYaw = clamp(kinYaw * (1 + this.driftFactor * 0.55), -maxYaw, maxYaw);

      // Korpus aylanma tezligi (yaw rate): kontr-rulda 46 rad/s, burilishda 34 rad/s
      const isCounteringYaw = (this.yawRate * targetYaw < -0.01);
      const yawResponse = isCounteringYaw ? 46.0 : (34.0 - this.driftFactor * 6.0);
      this.yawRate += (targetYaw - this.yawRate) * Math.min(1, dt * yawResponse);
      this.heading += this.yawRate * dt;
    }

    // Yon sirpanish (lateral velocity) va kontr-rul barqarorlashuvi
    const isCounter = Math.sign(this.steer) !== Math.sign(this.yawRate) && Math.abs(this.steer) > 0.03;
    const latKick = this.driftFactor * 0.52;
    this.lat += -this.yawRate * this.v * dt * latKick;
    const latDamp = (25.0 * (1 - this.driftFactor * 0.82) + 2.0) * grip * (isCounter ? 1.85 : 1.0);
    this.lat *= Math.exp(-dt * latDamp);
    this.lat = clamp(this.lat, -speed * 0.55, speed * 0.55);
    if (Math.abs(this.lat) < 0.005) this.lat = 0;

    this.slip = speed > 1.0 ? Math.atan2(Math.abs(this.lat), Math.max(1.2, speed)) : 0;
    this.drifting = (this.slip > 0.13 || (wantDrift && Math.abs(this.steer) > 0.06)) && speed > 5.5;
    if (this.drifting && !input.drift) this.v -= Math.sign(this.v) * this.slip * 1.15 * dt;

    const latG = this.yawRate * this.v;
    const targetRoll = clamp(latG * 0.0032 + this.steer * Math.min(1, speed / 22) * 0.02, -0.055, 0.055);
    const targetPitch = clamp(-a * 0.0032, -0.038, 0.042);
    this.roll += (targetRoll - this.roll) * Math.min(1, dt * 12);
    this.pitch += (targetPitch - this.pitch) * Math.min(1, dt * 10);

    const rx = Math.cos(this.heading), rz = -Math.sin(this.heading);
    const dx = (this.fwdX * this.v + rx * this.lat) * dt;
    const dz = (this.fwdZ * this.v + rz * this.lat) * dt;
    this.x += dx;
    this.z += dz;
    const dist = Math.hypot(dx, dz);
    this.odo += dist;

    this.checkBorder(dt);

    const use = c.fuelUse * (dist / 100000) * (0.6 + 0.6 * this.thr + (input.boost ? 0.5 : 0)) + 0.00002 * dt;
    inst.fuelL = Math.max(0, inst.fuelL - use);

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

  // Barqaror va qotib qolmaydigan kolliziya (mashina boshqaruvdan chiqib ketmaydi va shikastlanmaydi)
  collide(others) {
    const c = this.cfg, r = c.wid * 0.48;
    const offFwd = c.len * 0.34;
    for (let i = 0; i < 3; i++) {
      const off = i === 0 ? offFwd : i === 1 ? 0 : -offFwd;
      let px = this.x + this.fwdX * off, pz = this.z + this.fwdZ * off;
      for (const b of queryColliders(px, pz, r + 1.0)) {
        const cx = clamp(px, b.minX, b.maxX), cz = clamp(pz, b.minZ, b.maxZ);
        let nx = px - cx, nz = pz - cz, d = Math.hypot(nx, nz);
        if (d >= r) continue;
        if (d < 1e-4) { nx = Math.sign(px - (b.minX + b.maxX) / 2) || 1; nz = 0; d = 0; }
        else { nx /= d; nz /= d; }
        const push = r - d;
        this.x += nx * push;
        this.z += nz * push;
        px += nx * push;
        pz += nz * push;
        this.hit(nx, nz);
      }
    }
    const maxRadius = (c.len + 5.5) * 0.38;
    for (let j = 0; j < others.length; j++) {
      const o = others[j];
      if (!o || typeof o.x !== 'number' || typeof o.z !== 'number') continue;
      const dx = this.x - o.x;
      if (dx > maxRadius || dx < -maxRadius) continue;
      const dz = this.z - o.z;
      if (dz > maxRadius || dz < -maxRadius) continue;

      const d = Math.hypot(dx, dz);
      const min = (c.len + (o.len || 4.4)) * 0.38;
      if (d >= min || d < 1e-4) continue;
      const nx = dx / d, nz = dz / d;
      const overlap = min - d;
      // Silliq masofa saqlash (mashinalar bir-biriga yopishib yoki qotib qolmaydi)
      this.x += nx * overlap * 0.65;
      this.z += nz * overlap * 0.65;
      if (!o.isStatic) {
        o.x -= nx * overlap * 0.35;
        o.z -= nz * overlap * 0.35;
      }
      this.hit(nx, nz);
    }
  }

  applyExternalImpulse(nx, nz) {
    this.x += nx * 0.25;
    this.z += nz * 0.25;
  }

  hit(nx, nz) {
    const vx = this.fwdX * this.v, vz = this.fwdZ * this.v;
    const into = -(vx * nx + vz * nz);
    if (into <= 0) return;
    const nvx = vx + nx * into * 1.05;
    const nvz = vz + nz * into * 1.05;
    this.v = (nvx * this.fwdX + nvz * this.fwdZ) * 0.85;
    this.lat *= 0.4;
    this.yawRate *= 0.5;
  }

  place(x, z, heading) {
    this.x = x; this.z = z; this.heading = heading;
    this.v = 0; this.lat = 0; this.yawRate = 0; this.thr = 0; this.brk = 0;
  }
}
