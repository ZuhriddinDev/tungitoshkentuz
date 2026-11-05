// Kuzatuvchi kamera: mashina orqasidan silliq ergashadi, sichqoncha bilan 360° aylanadi,
// binolar orqasida qolmaslik uchun yaqinlashadi, tezlikda FOV kengayadi, zarbada silkinadi
import * as THREE from 'three';
import { cam } from './input.js';
import { queryColliders } from './world/layout.js';

const tmp = new THREE.Vector3(), look = new THREE.Vector3();
let followH = null, fov = 62, shake = 0, curDist = 9;
export const camState = { mode: 0 }; // 0 — yaqin, 1 — uzoq, 2 — kapotdan
export const addShake = (s) => { shake = Math.max(shake, s); };

function blocked(x, z) {
  for (const c of queryColliders(x, z, 0.5))
    if (c.tag !== 'water' && x > c.minX - 0.4 && x < c.maxX + 0.4 && z > c.minZ - 0.4 && z < c.maxZ + 0.4) return true;
  return false;
}

export function updateCamera(camera, v, boost, dt) {
  const cfg = v.cfg;
  if (followH === null) followH = v.heading;
  let dh = v.heading - followH; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
  followH += dh * Math.min(1, dt * 4);

  const targetFov = camState.mode === 2 ? 72 : 60 + Math.min(16, v.kmh * 0.07) + (boost && v.kmh > 20 ? 6 : 0);
  fov += (targetFov - fov) * Math.min(1, dt * 3);
  camera.fov = fov; camera.updateProjectionMatrix();

  if (camState.mode === 2) {
    camera.position.set(v.x + v.fwdX * 0.3, cfg.hei + 0.15, v.z + v.fwdZ * 0.3);
    camera.lookAt(v.x + v.fwdX * 30, cfg.hei * 0.6, v.z + v.fwdZ * 30);
    return;
  }
  // Sichqoncha qo'yib yuborilgach, kamera asta-sekin orqaga qaytadi
  if (performance.now() - cam.lastMove > 2500) cam.yaw *= Math.pow(0.05, dt);

  let dist = cam.dist * (camState.mode === 1 ? 1.7 : 1) * Math.sqrt(cfg.len / 4.5) + v.kmh * 0.012;
  const yaw = followH + Math.PI + cam.yaw, horiz = Math.cos(cam.pitch);
  const dx = Math.sin(yaw) * horiz, dz = Math.cos(yaw) * horiz;
  for (const t of [0.35, 0.6, 0.85, 1]) if (blocked(v.x + dx * dist * t, v.z + dz * dist * t)) { dist *= Math.max(0.3, t - 0.2); break; }
  curDist += (dist - curDist) * Math.min(1, dt * (dist < curDist ? 20 : 3));

  tmp.set(v.x + dx * curDist, Math.max(0.6, 1.3 + Math.sin(cam.pitch) * curDist), v.z + dz * curDist);
  if (shake > 0.01) { tmp.x += (Math.random() - 0.5) * shake; tmp.y += (Math.random() - 0.5) * shake; shake *= Math.pow(0.02, dt); }
  camera.position.copy(tmp);
  look.set(v.x + v.fwdX * 2, 1.1, v.z + v.fwdZ * 2);
  camera.lookAt(look);
}

// Personaj (piyoda) rejimida 3-shaxs kamerasi
export function updateCharCamera(camera, ch, dt) {
  if (followH === null) followH = ch.heading;
  let dh = ch.heading - followH;
  dh = Math.atan2(Math.sin(dh), Math.cos(dh));
  followH += dh * Math.min(1, dt * 6);

  fov += (60 - fov) * Math.min(1, dt * 4);
  camera.fov = fov;
  camera.updateProjectionMatrix();

  if (performance.now() - cam.lastMove > 2200) cam.yaw *= Math.pow(0.05, dt);

  let dist = 4.2;
  const yaw = followH + Math.PI + cam.yaw;
  const pitch = Math.max(0.08, Math.min(0.85, cam.pitch));
  const horiz = Math.cos(pitch);
  const dx = Math.sin(yaw) * horiz, dz = Math.cos(yaw) * horiz;
  for (const t of [0.4, 0.7, 1]) {
    if (blocked(ch.x + dx * dist * t, ch.z + dz * dist * t)) {
      dist *= Math.max(0.35, t - 0.15);
      break;
    }
  }
  curDist += (dist - curDist) * Math.min(1, dt * 10);
  camera.position.set(
    ch.x + dx * curDist,
    ch.y + 1.35 + Math.sin(pitch) * curDist,
    ch.z + dz * curDist
  );
  look.set(ch.x, ch.y + 1.45, ch.z);
  camera.lookAt(look);
}

// Bosh menyu fonida AAA o'yinlar uslubidagi kinematik 3D kamera
export function menuCamera(camera, v, t) {
  const targetFov = 50;
  fov += (targetFov - fov) * 0.08;
  camera.fov = fov;
  camera.updateProjectionMatrix();

  const ang = v.heading + 0.65 + Math.sin(t * 0.32) * 0.75 + t * 0.14;
  const dist = 6.2 + Math.sin(t * 0.45) * 0.7;
  const h = 1.45 + Math.sin(t * 0.38) * 0.38;
  camera.position.set(
    v.x + Math.sin(ang) * dist,
    h,
    v.z + Math.cos(ang) * dist
  );
  // Mashina ekran markazida/chaprog'ida yirik va salobatli ko'rinishi uchun
  const rightX = Math.cos(ang), rightZ = -Math.sin(ang);
  const offset = innerWidth > 820 ? 1.15 : 0;
  camera.lookAt(v.x + rightX * offset, 0.85, v.z + rightZ * offset);
}
