// Drift / qo'l tormozi tutuni: orqa g'ildiraklardan chiqadigan yumshoq zarrachalar (sprite pool)
import * as THREE from 'three';

function puffTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class TireSmoke {
  constructor(scene, max = 90) {
    const tex = puffTexture();
    this.pool = [];
    this.cursor = 0;
    this.acc = 0;
    for (let i = 0; i < max; i++) {
      const mat = new THREE.SpriteMaterial({ map: tex, color: 0xdadde4, transparent: true, opacity: 0, depthWrite: false, fog: true });
      const s = new THREE.Sprite(mat);
      s.visible = false; s.renderOrder = 5;
      scene.add(s);
      this.pool.push({ s, life: 0, max: 1, vx: 0, vy: 0, vz: 0, size: 1, grow: 1 });
    }
  }

  emit(x, y, z, vx, vz, size, strength) {
    const p = this.pool[this.cursor]; this.cursor = (this.cursor + 1) % this.pool.length;
    p.life = p.max = 0.9 + Math.random() * 0.9;
    p.size = size * (0.7 + Math.random() * 0.6); p.grow = 1.6 + Math.random() * 1.4;
    p.vx = vx + (Math.random() - 0.5) * 0.8; p.vz = vz + (Math.random() - 0.5) * 0.8; p.vy = 0.5 + Math.random() * 0.7;
    p.str = strength;
    p.s.position.set(x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3);
    p.s.material.rotation = Math.random() * 6.28;
    p.s.visible = true;
  }

  // vehicle: Vehicle obyekti, enabled: sozlamadan, dt: kadr vaqti
  update(dt, vehicle, enabled = true, groundY = 0) {
    const speed = Math.abs(vehicle.v);
    const active = enabled && speed > 4 && (vehicle.drifting || (vehicle.slip > 0.1 && speed > 8) || (vehicle.braking && vehicle.kmh > 70 && vehicle.slip > 0.05));
    if (active) {
      const intensity = Math.min(1, 0.35 + vehicle.slip * 2.5);
      this.acc += dt * (22 + 60 * intensity);
      const c = vehicle.cfg, fx = vehicle.fwdX, fz = vehicle.fwdZ, rx = Math.cos(vehicle.heading), rz = -Math.sin(vehicle.heading);
      while (this.acc >= 1) {
        this.acc -= 1;
        const side = Math.random() < 0.5 ? -1 : 1;
        const back = c.len * 0.32, half = c.wid * 0.42;
        this.emit(
          vehicle.x - fx * back + rx * half * side, groundY + 0.15, vehicle.z - fz * back + rz * half * side,
          fx * vehicle.v * 0.15, fz * vehicle.v * 0.15, 1.1 + intensity * 1.3, intensity,
        );
      }
    } else this.acc = 0;

    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.s.visible = false; continue; }
      const k = 1 - p.life / p.max;
      p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt * (1 - k); p.s.position.z += p.vz * dt;
      p.vx *= 1 - dt * 0.8; p.vz *= 1 - dt * 0.8;
      const sz = p.size * (1 + k * p.grow);
      p.s.scale.set(sz, sz, 1);
      p.s.material.opacity = Math.sin(Math.min(1, k * 4) * Math.PI / 2) * (1 - k) * 0.55 * p.str;
    }
  }
}

