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
  }
  get kmh() { return Math.abs(this.v) * 3.6; }
  get fwdX() { return Math.sin(this.heading); }
  get fwdZ() { return Math.cos(this.heading); }

  // input: { throttle 0..1, reverse 0..1, steer -1..1, boost bool, handbrake bool }
  step(dt, input, others = []) {
    // Frame-rate mustaqil fizika (past FPS da ham sakramasligi uchun)
    dt = Math.min(dt, 0.05);
    const c = this.cfg, inst = this.inst;
    const fuelOk = inst.fuelL > 0;
    const wrongFuel = inst.fuelType && inst.fuelType !== c.fuel ? 0.88 : 1;
    const power = ENGINE_MUL[inst.engine || 0] * wrongFuel * (1 - inst.damage / 260) * (fuelOk ? 1 : 0);
    const boost = input.boost && fuelOk ? 1.35 : 1;
    const vmaxRoad = (c.maxSpeed / 3.6) * (0.92 + 0.1 * ENGINE_MUL[inst.engine || 0]) * (input.boost ? 1.08 : 1);

    // Yo'ldan chiqqanda (trotuar, maysazor) boshqaruv buzilmasligi va barqaror yurishi
    this.offRoad = !onRoad(this.x, this.z);
    const surfaceGrip = this.offRoad ? 0.95 : 1.0;
    const vmax = this.offRoad ? Math.min(vmaxRoad, 138 / 3.6) : vmaxRoad;
    const vrev = 36 / 3.6;

    // Gaz va tormoz pedali sezgir va silliq ishlaydi
    this.thr += (input.throttle - this.thr) * Math.min(1, dt * 14);
    this.brk += (input.reverse - this.brk) * Math.min(1, dt * 16);
    const traction = 11.8 * c.grip * surfaceGrip;

    let a = 0;
    this.braking = false;
    if (input.throttle > 0) {
      if (this.v < -0.35) {
        // Orqaga ketayotganda W bosilsa — kuchli tormoz
        a = Math.min(c.brake * 1.35, traction * 1.35);
        this.braking = true;
      } else {
        const speedRatio = Math.max(0, this.v) / Math.max(1, vmax);
        const lowEndBoost = speedRatio < 0.25 ? 1.16 : 1.0;
        const torqueCurve = Math.max(0.22, 1 - speedRatio ** 1.9) * lowEndBoost;
        a = Math.min(c.accel * 1.08 * power * boost * this.thr, traction * 1.18) * torqueCurve;
      }
    } else if (input.reverse > 0) {
      if (this.v > 0.35) {
        // Oldinga ketayotganda S bosilsa — aniq va kuchli tormoz
        a = -Math.min(c.brake * 1.32, traction * 1.32) * (0.45 + 0.55 * this.brk);
        this.braking = true;
      } else {
        // To'xtagandan keyin orqaga yurish (Reverse)
        const revRatio = Math.abs(this.v) / vrev;
        a = -Math.min(c.accel * 0.58 * power, traction) * input.reverse * Math.max(0.2, 1 - revRatio ** 1.7);
      }
    } else {
      // Gazdan oyoq olinganda: tabiiy dvigatel tormozi + dumalash qarshiligi
      const offRoadDrag = this.offRoad ? 1.25 : 0.48;
      a = -Math.sign(this.v) * (offRoadDrag + 0.014 * Math.abs(this.v) + 0.001 * this.v * this.v);
      if (Math.abs(this.v) < 0.22) { this.v = 0; a = 0; }
    }

    if (input.handbrake) {
      a -= Math.sign(this.v) * c.brake * 0.58;
      this.braking = true;
    }
    this.v = clamp(this.v + a * dt, -vrev, vmax);

    // ========================================================================
    // GTA 5 / Forza Horizon Arcade Rul & Burilish Tizimi
    // ========================================================================
    const speed = Math.abs(this.v);
    // Past tezlikda rul burchagi katta (manevrli), yuqori tezlikda barqaror
    const maxSteer = clamp(0.62 / (1 + speed * 0.041), 0.16, 0.62);
    const steerInput = clamp(input.steer || 0, -1, 1);
    const steerTarget = steerInput * maxSteer;

    // A/D bosilganda darhol javob beradi, qo'yib yuborilganda markazga tez qaytadi
    const isCentering = Math.abs(steerInput) < 0.02;
    const isCounterSteer = !isCentering && (steerInput * this.steer < -0.001);
    const steerRate = isCentering ? 22.0 : isCounterSteer ? 26.0 : 18.5;
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * steerRate);
    if (isCentering && Math.abs(this.steer) < 0.002) this.steer = 0;

    // Handbrake Drift holati va silliq grip tiklanishi
    const hb = Boolean(input.handbrake && speed > 4.2);
    const targetDrift = hb ? 1.0 : 0.0;
    this.driftFactor += (targetDrift - this.driftFactor) * Math.min(1, dt * (hb ? 8.0 : 5.5));
    if (!hb && this.driftFactor < 0.01) this.driftFactor = 0;

    const wheelBase = Math.max(2.1, c.len * 0.56);
    const grip = c.grip * surfaceGrip;

    if (speed < 0.15) {
      // To'xtab turganda rul g'ildiraklarni buradi, lekin mashina joyida aylanib ketmaydi
      this.yawRate = 0;
      this.lat = 0;
    } else {
      // Ackermann burilish: this.v oldinga (+) va orqaga (-) yurishda yo'nalishni tabiiy to'g'ri oladi
      const lowSpeedTurnBoost = speed < 8 ? 1.18 : 1.05;
      const driftYawMul = 1.0 + this.driftFactor * 0.48;
      const desiredYaw = (this.v / wheelBase) * Math.tan(this.steer) * lowSpeedTurnBoost * driftYawMul;
      const maxLatAccel = traction * (1.28 - this.driftFactor * 0.25);
      const maxYaw = maxLatAccel / Math.max(speed, 1.8);
      const targetYaw = clamp(desiredYaw, -maxYaw, maxYaw);

      // Yuqori sezgirlik: mashinaning burni darhol rul burilgan tomonga qaraydi
      const yawResponse = 24.0 - this.driftFactor * 9.0;
      this.yawRate += (targetYaw - this.yawRate) * Math.min(1, dt * yawResponse);
      this.heading += this.yawRate * dt;
    }

    // Tire Grip (Shina tishlashishi):
    // Oddiy haydashda yonlama quti kabi sirpanish (box sliding) 0 ga teng!
    // Faqat Handbrake (Space) bosilganda orqa g'ildiraklar boshqariladigan driftga kiradi.
    const latKick = this.driftFactor * 0.46;
    this.lat += -this.yawRate * this.v * dt * latKick;
    const latDamp = (22.0 * (1 - this.driftFactor * 0.88) + 1.8) * grip;
    this.lat *= Math.exp(-dt * latDamp);
    this.lat = clamp(this.lat, -speed * 0.52, speed * 0.52);
    if (Math.abs(this.lat) < 0.005) this.lat = 0;

    this.slip = speed > 1.0 ? Math.atan2(Math.abs(this.lat), Math.max(1.2, speed)) : 0;
    this.drifting = (this.slip > 0.14 || (hb && Math.abs(this.steer) > 0.07)) && speed > 6.0;
    if (this.drifting) this.v -= Math.sign(this.v) * this.slip * 1.45 * dt;

    // Kuzov dinamikasi: burilishda yon tomonga yengil og'ish (roll), gaz/tormozda pitch
    const latG = this.yawRate * this.v;
    const targetRoll = clamp(latG * 0.0035 + this.steer * Math.min(1, speed / 22) * 0.022, -0.065, 0.065);
    const targetPitch = clamp(-a * 0.0034, -0.042, 0.045);
    this.roll += (targetRoll - this.roll) * Math.min(1, dt * 12);
    this.pitch += (targetPitch - this.pitch) * Math.min(1, dt * 10);

    // Harakat vektori: old yo'nalish (fwdX, fwdZ) + faqat driftdagi lateral siljish
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
