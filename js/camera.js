// Kuzatuvchi kamera: mashina orqasidan silliq ergashadi, sichqoncha bilan 360° aylanadi,
// binolar orqasida qolmaslik uchun yaqinlashadi, tezlikda FOV kengayadi, zarbada silkinadi
import * as THREE from 'three';
import { cam } from './input.js';
import { queryColliders } from './world/layout.js';

const tmp = new THREE.Vector3(), look = new THREE.Vector3();
let followH = null, fov = 62, shake = 0, curDist = 9;
export const camState = { mode: 0 }; // 0 — yaqin, 1 — uzoq, 2 — kapotdan
export const addShake = (s) => { shake = Math.max(shake, s); };

const CHAR_ZOOM_MODES = [
  { dist: 4.2, label: 'Standart' },
  { dist: 2.35, label: 'Yaqin' },
  { dist: 1.45, label: 'Juda yaqin' },
  { dist: 6.2, label: 'Keng' },
];
let charZoomIdx = 0;

export function cycleCharZoom() {
  charZoomIdx = (charZoomIdx + 1) % CHAR_ZOOM_MODES.length;
  return CHAR_ZOOM_MODES[charZoomIdx];
}

export function resetCharCamera(heading = 0) {
  followH = Number.isFinite(heading) ? heading : 0;
  curDist = CHAR_ZOOM_MODES[charZoomIdx].dist;
  cam.yaw = 0;
}

function blocked(x, z) {
  for (const c of queryColliders(x, z, 0.5))
    if (c.tag !== 'water' && x > c.minX - 0.4 && x < c.maxX + 0.4 && z > c.minZ - 0.4 && z < c.maxZ + 0.4) return true;
  return false;
}

export function updateCamera(camera, v, boost, dt) {
  const cfg = v.cfg;
  if (followH === null) followH = v.heading;
  let dh = v.heading - followH; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
  // Tezlik va rul burilishiga mos sezgir kamera ergashishi (ortiqcha kechikishsiz)
  const followSpeed = 7.5 + Math.min(4.5, Math.abs(v.steer || 0) * 6);
  followH += dh * Math.min(1, dt * followSpeed);

  const targetFov = camState.mode === 2 ? 72 : 60 + Math.min(16, v.kmh * 0.07) + (boost && v.kmh > 20 ? 6 : 0);
  fov += (targetFov - fov) * Math.min(1, dt * 4);
  camera.fov = fov; camera.updateProjectionMatrix();

  if (camState.mode === 2) {
    camera.position.set(v.x + v.fwdX * 0.3, cfg.hei + 0.15, v.z + v.fwdZ * 0.3);
    camera.lookAt(v.x + v.fwdX * 30, cfg.hei * 0.6, v.z + v.fwdZ * 30);
    return;
  }
  // Sichqoncha qo'yib yuborilgach, kamera asta-sekin orqaga qaytadi
  if (performance.now() - cam.lastMove > 2200) cam.yaw *= Math.pow(0.04, dt);

  let dist = cam.dist * (camState.mode === 1 ? 1.65 : 0.96) * Math.sqrt(cfg.len / 4.5) + v.kmh * 0.011;
  const yaw = followH + Math.PI + cam.yaw, horiz = Math.cos(cam.pitch);
  const dx = Math.sin(yaw) * horiz, dz = Math.cos(yaw) * horiz;
  for (const t of [0.35, 0.6, 0.85, 1]) if (blocked(v.x + dx * dist * t, v.z + dz * dist * t)) { dist *= Math.max(0.3, t - 0.2); break; }
  curDist += (dist - curDist) * Math.min(1, dt * (dist < curDist ? 22 : 5));

  tmp.set(v.x + dx * curDist, Math.max(0.6, 1.32 + Math.sin(cam.pitch) * curDist), v.z + dz * curDist);
  if (shake > 0.01) { tmp.x += (Math.random() - 0.5) * shake; tmp.y += (Math.random() - 0.5) * shake; shake *= Math.pow(0.02, dt); }
  camera.position.copy(tmp);
  look.set(v.x + v.fwdX * 2.4, 1.08, v.z + v.fwdZ * 2.4);
  camera.lookAt(look);
}

// Personaj (piyoda) rejimida 3-shaxs kamerasi
export function updateCharCamera(camera, ch, dt) {
  const chHeading = Number.isFinite(ch.heading) ? ch.heading : 0;
  if (!Number.isFinite(followH)) followH = chHeading;
  let dh = chHeading - followH;
  dh = Math.atan2(Math.sin(dh), Math.cos(dh));
  followH += dh * Math.min(1, dt * 6);

  fov += (60 - fov) * Math.min(1, dt * 4);
  camera.fov = fov;
  camera.updateProjectionMatrix();

  if (performance.now() - cam.lastMove > 2200) cam.yaw *= Math.pow(0.05, dt);

  let dist = CHAR_ZOOM_MODES[charZoomIdx].dist;
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
  if (!Number.isFinite(curDist)) curDist = dist;
  curDist += (dist - curDist) * Math.min(1, dt * 10);
  const eyeH = dist < 2.0 ? 1.52 : 1.35;
  camera.position.set(
    ch.x + dx * curDist,
    ch.y + eyeH + Math.sin(pitch) * curDist,
    ch.z + dz * curDist
  );
  look.set(ch.x, ch.y + 1.45, ch.z);
  camera.lookAt(look);
}

// Bosh menyu (Malibu Hero Banner) fonida kirishbanner rasmiga mos pastki 3/4 burchakli cinematic kamera
let lobbyAutoAngle = 0.56;
export function menuCamera(camera, v, t, dt = 0.016) {
  const targetFov = 40;
  fov += (targetFov - fov) * 0.08;
  camera.fov = fov;
  camera.updateProjectionMatrix();

  const userDragging = performance.now() - cam.lastMove < 4500;
  if (!userDragging) {
    // Chevrolet Malibu Premier avtomobilini kirishbanner dagi kabi old-chap 3/4 burchakdan ulug'vor ko'rsatish
    lobbyAutoAngle = 0.56 + Math.sin(t * 0.22) * 0.12;
    cam.yaw *= Math.pow(0.08, dt);
  }
  const ang = v.heading + lobbyAutoAngle + cam.yaw;
  const dist = userDragging
    ? Math.max(4.4, Math.min(8.2, cam.dist * 0.62))
    : 5.05 + Math.sin(t * 0.28) * 0.14;
  const pitchOffset = userDragging ? Math.max(-0.08, Math.min(0.45, cam.pitch - 0.15)) : 0;
  const h = 1.04 + Math.sin(t * 0.25) * 0.06 + pitchOffset * 2.2;

  camera.position.set(
    v.x + Math.sin(ang) * dist,
    Math.max(0.68, h),
    v.z + Math.cos(ang) * dist
  );
  // Malibu markazda kirishbanner rasmidek joylashishi uchun
  camera.lookAt(v.x, 0.72, v.z);
}
