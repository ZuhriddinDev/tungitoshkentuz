// Kuzatuvchi kamera: mashina orqasidan silliq ergashadi, sichqoncha bilan 360° aylanadi,
// binolar orqasida qolmaslik uchun yaqinlashadi, tezlikda FOV kengayadi, zarbada silkinadi
import * as THREE from 'three';
import { cam } from './input.js';
import { queryColliders } from './world/layout.js';

const tmp = new THREE.Vector3(), look = new THREE.Vector3();
let followH = null, fov = 62, shake = 0, curDist = 9, cinPhase = 0, smoothSteer = 0;
export const CAM_MODE_NAMES = [
  'Orqa kamera (Chase)',
  'Keng sport kamera (Far)',
  'Kapot kamerasi (Hood)',
  'Salon kamerasi (Cockpit)',
  'Kinematografik (Cinematic)',
];
export const camState = { mode: 0 }; // 0..4
export const addShake = (s) => { shake = Math.max(shake, s); };

const CHAR_ZOOM_MODES = [
  { dist: 4.2, label: 'Standart' },
  { dist: 2.35, label: 'Yaqin' },
  { dist: 0, label: '1-shaxs (FPS)' },
  { dist: 6.2, label: 'Keng' },
];
let charZoomIdx = 0;

export function isCharFirstPerson() {
  return CHAR_ZOOM_MODES[charZoomIdx].dist === 0;
}

export function cycleCharZoom() {
  charZoomIdx = (charZoomIdx + 1) % CHAR_ZOOM_MODES.length;
  return CHAR_ZOOM_MODES[charZoomIdx];
}

export function resetCharCamera(heading = 0) {
  followH = Number.isFinite(heading) ? heading : 0;
  curDist = CHAR_ZOOM_MODES[charZoomIdx].dist;
  cam.yaw = 0;
}

function blocked(x, z, extraColliders = null) {
  if (extraColliders) {
    for (let i = 0; i < extraColliders.length; i++) {
      const c = extraColliders[i];
      if (x > c.minX - 0.35 && x < c.maxX + 0.35 && z > c.minZ - 0.35 && z < c.maxZ + 0.35) return true;
    }
    return false;
  }
  for (const c of queryColliders(x, z, 0.5))
    if (c.tag !== 'water' && x > c.minX - 0.4 && x < c.maxX + 0.4 && z > c.minZ - 0.4 && z < c.maxZ + 0.4) return true;
  return false;
}

export function updateCamera(camera, v, boost, dt) {
  const cfg = v.cfg;
  if (followH === null) followH = v.heading;
  let dh = v.heading - followH;
  dh = Math.atan2(Math.sin(dh), Math.cos(dh));
  const followRate = 8.5 + Math.min(4.5, Math.abs(v.steer || 0) * 6.0);
  followH += dh * (1 - Math.exp(-followRate * dt));
  smoothSteer += ((v.steer || 0) - smoothSteer) * (1 - Math.exp(-10 * dt));

  const baseFov = camState.mode === 3 ? 68 : camState.mode === 4 ? 48 : camState.mode === 1 ? 64 : 60;
  const targetFov = baseFov + Math.min(14, v.kmh * 0.065) + (boost && v.kmh > 20 ? 5 : 0);
  fov += (targetFov - fov) * (1 - Math.exp(-5 * dt));
  camera.fov = fov;
  camera.updateProjectionMatrix();

  if (performance.now() - cam.lastMove > 2200) cam.yaw *= Math.pow(0.04, dt);

  const shakeAmp = shake > 0.01 ? shake : 0;
  if (shake > 0.01) shake *= Math.pow(0.02, dt);

  if (camState.mode === 2 || camState.mode === 3) {
    const isCockpit = camState.mode === 3;
    const eyeY = isCockpit
      ? Math.max(0.84, (cfg.hei || 1.45) * 0.72)
      : Math.max(0.92, (cfg.hei || 1.45) * 0.80);
    const fwdOff = isCockpit ? -(cfg.len || 4.5) * 0.04 : (cfg.len || 4.5) * 0.19;
    const sideOff = isCockpit ? -(cfg.wid || 1.85) * 0.19 : 0;
    const rightX = Math.cos(v.heading), rightZ = -Math.sin(v.heading);

    tmp.set(
      v.x + v.fwdX * fwdOff + rightX * sideOff,
      eyeY,
      v.z + v.fwdZ * fwdOff + rightZ * sideOff
    );
    if (shakeAmp) { tmp.x += (Math.random() - 0.5) * shakeAmp * 0.4; tmp.y += (Math.random() - 0.5) * shakeAmp * 0.4; }
    camera.position.copy(tmp);
    const lookYaw = v.heading + cam.yaw + smoothSteer * (isCockpit ? 0.14 : 0.08);
    look.set(v.x + Math.sin(lookYaw) * 20, eyeY - (isCockpit ? 0.08 : 0.14), v.z + Math.cos(lookYaw) * 20);
    camera.lookAt(look);
    return;
  }

  if (camState.mode === 4) {
    cinPhase += dt * 0.35;
    const sideSign = Math.sin(cinPhase) >= 0 ? 1 : -1;
    const cinAngle = followH + Math.PI + sideSign * (0.42 + Math.sin(cinPhase * 1.4) * 0.18) + cam.yaw;
    let dist = 7.4 * Math.sqrt(cfg.len / 4.5) + v.kmh * 0.008;
    const dx = Math.sin(cinAngle), dz = Math.cos(cinAngle);
    for (const t of [0.4, 0.75, 1]) if (blocked(v.x + dx * dist * t, v.z + dz * dist * t)) { dist *= Math.max(0.35, t - 0.18); break; }
    curDist += (dist - curDist) * (1 - Math.exp(-8 * dt));
    camera.position.set(v.x + dx * curDist, 1.38 + Math.sin(cinPhase * 0.9) * 0.22, v.z + dz * curDist);
    look.set(v.x + v.fwdX * 2.8, 0.92, v.z + v.fwdZ * 2.8);
    camera.lookAt(look);
    return;
  }

  // 0: Yaqin (Chase) | 1: Keng sport (Far Chase) — Mashinaga qattiq bog'langan (0 rubberbanding jitter!)
  const isFar = camState.mode === 1;
  let dist = cam.dist * (isFar ? 1.52 : 0.94) * Math.sqrt(cfg.len / 4.5) + v.kmh * 0.011;
  const yaw = followH + Math.PI + cam.yaw - smoothSteer * 0.10;
  const horiz = Math.cos(cam.pitch);
  const dx = Math.sin(yaw) * horiz, dz = Math.cos(yaw) * horiz;
  for (const t of [0.35, 0.6, 0.85, 1]) if (blocked(v.x + dx * dist * t, v.z + dz * dist * t)) { dist *= Math.max(0.3, t - 0.2); break; }
  const distRate = dist < curDist ? 22 : 7;
  curDist += (dist - curDist) * (1 - Math.exp(-distRate * dt));

  tmp.set(v.x + dx * curDist, Math.max(0.65, (isFar ? 1.52 : 1.30) + Math.sin(cam.pitch) * curDist), v.z + dz * curDist);
  if (shakeAmp) { tmp.x += (Math.random() - 0.5) * shakeAmp; tmp.y += (Math.random() - 0.5) * shakeAmp; }
  camera.position.copy(tmp);

  const rightX = Math.cos(v.heading), rightZ = -Math.sin(v.heading);
  const lookSide = smoothSteer * 0.85;
  look.set(v.x + v.fwdX * 2.5 + rightX * lookSide, 1.06, v.z + v.fwdZ * 2.5 + rightZ * lookSide);
  camera.lookAt(look);
}

// Foto Rejim (Photo Mode) uchun 360° erkin orbit kamera
export function updatePhotoCamera(camera, target, ps, dt = 0.016) {
  const targetFov = ps.fov || 46;
  fov += (targetFov - fov) * Math.min(1, dt * 8);
  camera.fov = fov;
  camera.updateProjectionMatrix();

  const dist = THREE.MathUtils.clamp(ps.dist || 6.0, 2.6, 18.0);
  const pitch = THREE.MathUtils.clamp(ps.pitch || 0.22, -0.05, 1.15);
  const yaw = ps.yaw || 0;
  const horiz = Math.cos(pitch);
  tmp.set(
    target.x + Math.sin(yaw) * horiz * dist,
    Math.max(0.42, (target.y || 0) + 1.05 + Math.sin(pitch) * dist),
    target.z + Math.cos(yaw) * horiz * dist
  );
  camera.position.lerp(tmp, Math.min(1, dt * 12));
  look.set(target.x, (target.y || 0) + 0.95, target.z);
  camera.lookAt(look);
}

// Personaj (piyoda) rejimida 3-shaxs va ixtiyoriy 1-shaxs (FPS) kamerasi
export function updateCharCamera(camera, ch, dt, extraColliders = null) {
  const chHeading = Number.isFinite(ch.heading) ? ch.heading : 0;
  if (!Number.isFinite(followH)) followH = chHeading;
  let dh = chHeading - followH;
  dh = Math.atan2(Math.sin(dh), Math.cos(dh));
  followH += dh * Math.min(1, dt * 6);

  const mode = CHAR_ZOOM_MODES[charZoomIdx];
  const targetFov = mode.dist === 0 ? 70 : 60;
  fov += (targetFov - fov) * Math.min(1, dt * 6);
  camera.fov = fov;
  camera.updateProjectionMatrix();

  if (mode.dist === 0) {
    // 1-shaxs (First-Person) kamera: personaj o'z ko'rinishini to'smasligi uchun lokal yashiriladi
    if (ch.model?.group) ch.model.group.visible = false;
    const eyeY = ch.y + 1.62;
    const lookYaw = chHeading + cam.yaw;
    const lookPitch = Math.max(-0.55, Math.min(0.45, -(cam.pitch - 0.25)));
    camera.position.set(ch.x, eyeY, ch.z);
    look.set(
      ch.x + Math.sin(lookYaw) * Math.cos(lookPitch) * 12,
      eyeY + Math.sin(lookPitch) * 12,
      ch.z + Math.cos(lookYaw) * Math.cos(lookPitch) * 12
    );
    camera.lookAt(look);
    return;
  }

  if (ch.model?.group && ch.active) ch.model.group.visible = true;
  if (performance.now() - cam.lastMove > 2200) cam.yaw *= Math.pow(0.05, dt);

  let dist = mode.dist;
  const yaw = followH + Math.PI + cam.yaw;
  const pitch = Math.max(0.08, Math.min(0.85, cam.pitch));
  const horiz = Math.cos(pitch);
  const dx = Math.sin(yaw) * horiz, dz = Math.cos(yaw) * horiz;
  for (const t of [0.35, 0.65, 1]) {
    if (blocked(ch.x + dx * dist * t, ch.z + dz * dist * t, extraColliders)) {
      dist *= Math.max(0.32, t - 0.16);
      break;
    }
  }
  if (!Number.isFinite(curDist)) curDist = dist;
  curDist += (dist - curDist) * Math.min(1, dt * 10);
  const eyeH = dist < 2.6 ? 1.52 : 1.38;
  camera.position.set(
    ch.x + dx * curDist,
    ch.y + eyeH + Math.sin(pitch) * curDist,
    ch.z + dz * curDist
  );
  look.set(ch.x, ch.y + 1.48, ch.z);
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
