// Arkada-realistik avtomobil fizikasi: tezlanish, tormoz, yon sirpanish (drift), kolliziya, benzin
import { queryColliders } from './world/layout.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ENGINE_MUL = [1, 1.1, 1.2, 1.32];

export class Vehicle {
  constructor(cfg, inst) {
    this.cfg = cfg; this.inst = inst;
    this.x = 0; this.z = 0; this.heading = 0;
    this.v = 0; this.lat = 0; this.yawRate = 0; this.steer = 0;
    this.rpm = 0; this.drifting = false; this.slip = 0; this.braking = false;
    this.impact = 0; this.odo = 0; this.thr = 0;
  }
  get kmh() { return Math.abs(this.v) * 3.6; }
  get fwdX() { return Math.sin(this.heading); }
  get fwdZ() { return Math.cos(this.heading); }

  // input: { throttle 0..1, reverse 0..1, steer -1..1, boost bool, handbrake bool }
  step(dt, input, others = []) {
    const c = this.cfg, inst = this.inst;
    const fuelOk = inst.fuelL > 0;
    const wrongFuel = inst.fuelType && inst.fuelType !== c.fuel ? 0.88 : 1;
    const power = ENGINE_MUL[inst.engine || 0] * wrongFuel * (1 - inst.damage / 250) * (fuelOk ? 1 : 0);
    const boost = input.boost && fuelOk ? 1.35 : 1;
    const vmax = (c.maxSpeed / 3.6) * (0.9 + 0.1 * ENGINE_MUL[inst.engine || 0]) * (input.boost ? 1.08 : 1);
    const vrev = 30 / 3.6;

    // Gaz pedali yumshoq (keskin siltanish yo'q)
    this.thr += (input.throttle - this.thr) * Math.min(1, dt * 7);
    const traction = 9.5 * c.grip; // g'ildirak ilashishi chegarasi (m/s^2)

    let a = 0;
    this.braking = false;
    if (input.throttle > 0) {
      if (this.v < -0.5) { a = Math.min(c.brake, traction); this.braking = true; }
      else a = Math.min(c.accel * power * boost * this.thr, traction) * (1 - (Math.max(0, this.v) / vmax) ** 2);
    } else if (input.reverse > 0) {
      if (this.v > 0.5) { a = -Math.min(c.brake, traction * 1.05) * input.reverse; this.braking = true; }
      else a = -Math.min(c.accel * 0.5 * power, traction) * input.reverse * (1 - (Math.abs(this.v) / vrev) ** 2);
    } else {
      a = -Math.sign(this.v) * (0.5 + 0.012 * Math.abs(this.v) + 0.0012 * this.v * this.v); // dvigatel tormozi + dumalash + havo
      if (Math.abs(this.v) < 0.3) { this.v = 0; a = 0; }
    }
    if (input.handbrake) { a -= Math.sign(this.v) * c.brake * 0.45; this.braking = true; }
    this.v = clamp(this.v + a * dt, -vrev, vmax);

    // Rul: tezlik oshgani sari burilish burchagi kamayadi, markazga qaytish tezroq
    const speed = Math.abs(this.v);
    const maxSteer = 0.58 / (1 + speed * 0.055);
    const steerTarget = input.steer * maxSteer;
    const steerRate = Math.abs(steerTarget) < Math.abs(this.steer) ? 11 : 7;
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * steerRate);
    const wheelBase = c.len * 0.62;
    const hb = input.handbrake && speed > 6;
    const grip = c.grip * (input.handbrake ? 0.35 : 1);

    // Velosiped modeli: yon tezlanish chegarasidan oshsa — understeer (old g'ildirak sirpanadi)
    const desiredYaw = (this.v / wheelBase) * Math.tan(this.steer) * (hb ? 1.5 : 1);
    const maxYaw = (traction * (input.handbrake ? 0.55 : 1)) / Math.max(speed, 2);
    const targetYaw = clamp(desiredYaw, -maxYaw, maxYaw);
    const excess = desiredYaw - targetYaw;
    this.yawRate += (targetYaw - this.yawRate) * Math.min(1, dt * (5 + grip * 5));
    this.heading += this.yawRate * dt;

    // Yon sirpanish: markazdan qochma kuch + qo'l tormozida orqa qism chiqib ketadi
    this.lat += -this.yawRate * this.v * dt * (input.handbrake ? 0.55 : 0.12) - excess * speed * 0.12 * dt;
    this.lat *= Math.exp(-dt * grip * (input.handbrake ? 1.2 : 6));
    this.lat = clamp(this.lat, -speed * 0.6, speed * 0.6);
    this.slip = Math.atan2(Math.abs(this.lat), Math.max(1, speed));
    this.drifting = this.slip > 0.18 && speed > 8;
    if (this.drifting) this.v -= Math.sign(this.v) * this.slip * 2.2 * dt;
    const rx = Math.cos(this.heading), rz = -Math.sin(this.heading);
    const dx = (this.fwdX * this.v + rx * this.lat) * dt, dz = (this.fwdZ * this.v + rz * this.lat) * dt;
    this.x += dx; this.z += dz;
    const dist = Math.hypot(dx, dz);
    this.odo += dist;

    // Benzin sarfi (l/100km), salt rejimda ham ozgina
    const use = c.fuelUse * (dist / 100000) * (0.6 + 0.6 * input.throttle + (input.boost ? 0.5 : 0)) + 0.00002 * dt;
    inst.fuelL = Math.max(0, inst.fuelL - use);

    this.rpm = clamp(0.15 + (speed / vmax) * 0.85 + input.throttle * 0.1, 0, 1);
    this.impact = 0;
    this.collide(others);
    return dist;
  }

  collide(others) {
    const c = this.cfg, r = c.wid * 0.5;
    for (const off of [c.len * 0.33, 0, -c.len * 0.33]) {
      let px = this.x + this.fwdX * off, pz = this.z + this.fwdZ * off;
      for (const b of queryColliders(px, pz, r + 1)) {
        const cx = clamp(px, b.minX, b.maxX), cz = clamp(pz, b.minZ, b.maxZ);
        let nx = px - cx, nz = pz - cz, d = Math.hypot(nx, nz);
        if (d >= r) continue;
        if (d < 1e-4) { nx = Math.sign(px - (b.minX + b.maxX) / 2) || 1; nz = 0; d = 0; } else { nx /= d; nz /= d; }
        const push = r - d;
        this.x += nx * push; this.z += nz * push; px += nx * push; pz += nz * push;
        this.hit(nx, nz);
      }
    }
    for (const o of others) {
      const dx = this.x - o.x, dz = this.z - o.z, d = Math.hypot(dx, dz), min = (c.len + (o.len || 4.4)) * 0.4;
      if (d >= min || d < 1e-4) continue;
      const nx = dx / d, nz = dz / d;
      this.x += nx * (min - d) * 0.7; this.z += nz * (min - d) * 0.7;
      if (o.onHit) o.onHit(-nx, -nz, this.kmh);
      this.hit(nx, nz);
    }
  }

  hit(nx, nz) {
    const vx = this.fwdX * this.v, vz = this.fwdZ * this.v;
    const into = -(vx * nx + vz * nz);
    if (into <= 0) return;
    const nvx = vx + nx * into * 1.3, nvz = vz + nz * into * 1.3;
    this.v = (nvx * this.fwdX + nvz * this.fwdZ) * 0.85;
    this.lat *= 0.5;
    this.impact = Math.max(this.impact, into);
    if (into > 4) this.inst.damage = Math.min(100, this.inst.damage + into * 0.6);
  }

  place(x, z, heading) { this.x = x; this.z = z; this.heading = heading; this.v = 0; this.lat = 0; this.yawRate = 0; }
}

