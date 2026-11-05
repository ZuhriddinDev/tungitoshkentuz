// 3D O'yinchi Personaji (Character): mashinadan tushib yurish, yugurish, salomlashish/raqs va do'st mashinasiga o'tirish
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HALF, queryColliders } from './world/layout.js';

let charGeos = null;

function getCharGeos() {
  if (charGeos) return charGeos;

  // 1. Kurtka va gavda
  const chest = new THREE.CapsuleGeometry(0.20, 0.38, 8, 14);
  chest.scale(1.18, 1, 0.74);
  chest.translate(0, 1.17, 0);
  const collar = new THREE.CylinderGeometry(0.12, 0.15, 0.11, 12);
  collar.translate(0, 1.47, 0);
  const torso = mergeGeometries([chest, collar]);

  // 2. Bosh + bo'yin + quyosh ko'zoynagi
  const skull = new THREE.SphereGeometry(0.16, 16, 14);
  skull.scale(0.94, 1.05, 0.96);
  skull.translate(0, 1.67, 0);
  const neck = new THREE.CylinderGeometry(0.068, 0.078, 0.12, 10);
  neck.translate(0, 1.51, 0);
  const nose = new THREE.ConeGeometry(0.026, 0.06, 6);
  nose.rotateX(Math.PI / 2);
  nose.translate(0, 1.66, 0.16);
  const head = mergeGeometries([skull, neck, nose]);

  // Ko'zoynak (sport visor)
  const glasses = new THREE.BoxGeometry(0.24, 0.055, 0.08);
  glasses.translate(0, 1.68, 0.13);

  // 3. Zamonaviy soch / kepka
  const hairTop = new THREE.SphereGeometry(0.168, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58);
  hairTop.scale(0.96, 1.04, 1.02);
  hairTop.translate(0, 1.68, -0.01);
  const visor = new THREE.BoxGeometry(0.22, 0.025, 0.14);
  visor.translate(0, 1.73, 0.14);
  const hair = mergeGeometries([hairTop, visor]);

  // 4. Qo'l (yelka bo'g'imidan)
  const upperArm = new THREE.CapsuleGeometry(0.062, 0.43, 6, 10);
  upperArm.translate(0, -0.24, 0);
  const hand = new THREE.SphereGeometry(0.055, 10, 10);
  hand.translate(0, -0.49, 0);
  const arm = mergeGeometries([upperArm, hand]);

  // 5. Oyoq va krossovka
  const leg = new THREE.CapsuleGeometry(0.082, 0.56, 6, 10);
  leg.translate(0, -0.34, 0);
  const shoe = new THREE.BoxGeometry(0.14, 0.095, 0.25);
  shoe.translate(0, -0.69, 0.045);

  charGeos = { torso, head, glasses, hair, arm, leg, shoe };
  return charGeos;
}

export function buildCharacterModel(jacketColor = '#00e5ff') {
  const G = getCharGeos();
  const group = new THREE.Group();
  group.rotation.order = 'YXZ';

  const jacketMat = new THREE.MeshStandardMaterial({ color: jacketColor, roughness: 0.45, metalness: 0.15 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xe2ae82, roughness: 0.55 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x151924, roughness: 0.7 });
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 0.5, roughness: 0.2, metalness: 0.8 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0xf5f7ff, roughness: 0.4 });

  const bodyGroup = new THREE.Group();
  const torsoMesh = new THREE.Mesh(G.torso, jacketMat);
  const headMesh = new THREE.Mesh(G.head, skinMat);
  const glassesMesh = new THREE.Mesh(G.glasses, visorMat);
  const hairMesh = new THREE.Mesh(G.hair, darkMat);
  torsoMesh.castShadow = true;
  headMesh.castShadow = true;
  bodyGroup.add(torsoMesh, headMesh, glassesMesh, hairMesh);

  const armL = new THREE.Mesh(G.arm, jacketMat);
  armL.position.set(-0.25, 1.39, 0);
  armL.castShadow = true;

  const armR = new THREE.Mesh(G.arm, jacketMat);
  armR.position.set(0.25, 1.39, 0);
  armR.castShadow = true;

  const legL = new THREE.Group();
  legL.position.set(-0.105, 0.74, 0);
  legL.add(new THREE.Mesh(G.leg, darkMat), new THREE.Mesh(G.shoe, shoeMat));

  const legR = new THREE.Group();
  legR.position.set(0.105, 0.74, 0);
  legR.add(new THREE.Mesh(G.leg, darkMat), new THREE.Mesh(G.shoe, shoeMat));

  bodyGroup.add(armL, armR, legL, legR);
  group.add(bodyGroup);

  // Personaj ostidagi neon doira (o'yinchini tunda aniq ko'rsatadi)
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.44, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.65, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.position.y = 0.03;
  group.add(ring);

  let phase = 0;
  return {
    group,
    setColor(c) {
      if (c) jacketMat.color.set(c);
    },
    animate(dt, speed, emote = '') {
      const moving = Math.abs(speed) > 0.15;
      if (moving) {
        phase += dt * Math.min(18, Math.max(6, Math.abs(speed) * 2.1));
        const swing = Math.sin(phase) * Math.min(0.85, 0.35 + Math.abs(speed) * 0.06);
        const bob = Math.abs(Math.cos(phase)) * 0.045;
        bodyGroup.position.y = bob;
        bodyGroup.rotation.z = 0;
        armL.rotation.set(swing * 0.9, 0, 0);
        armR.rotation.set(-swing * 0.9, 0, 0);
        legL.rotation.set(-swing, 0, 0);
        legR.rotation.set(swing, 0, 0);
      } else if (emote === 'wave') {
        phase += dt * 9;
        bodyGroup.position.y = 0;
        armR.rotation.set(-2.5, 0, Math.sin(phase) * 0.45 - 0.3);
        armL.rotation.set(0, 0, 0);
        legL.rotation.set(0, 0, 0);
        legR.rotation.set(0, 0, 0);
      } else if (emote === 'dance') {
        phase += dt * 8;
        bodyGroup.position.y = Math.abs(Math.sin(phase * 2)) * 0.08;
        bodyGroup.rotation.z = Math.sin(phase) * 0.12;
        armL.rotation.set(-2.2 + Math.sin(phase) * 0.5, 0, 0.3);
        armR.rotation.set(-2.2 - Math.sin(phase) * 0.5, 0, -0.3);
        legL.rotation.set(Math.max(0, Math.sin(phase)) * 0.5, 0, 0);
        legR.rotation.set(Math.max(0, -Math.sin(phase)) * 0.5, 0, 0);
      } else {
        // Nafas olish (idle)
        phase += dt * 2.5;
        bodyGroup.position.y = Math.sin(phase) * 0.012;
        bodyGroup.rotation.z = 0;
        armL.rotation.set(0, 0, 0.04);
        armR.rotation.set(0, 0, -0.04);
        legL.rotation.set(0, 0, 0);
        legR.rotation.set(0, 0, 0);
      }
    },
  };
}

export class PlayerCharacter {
  constructor(scene, color = '#00e5ff') {
    this.scene = scene;
    this.model = buildCharacterModel(color);
    this.model.group.visible = false;
    scene.add(this.model.group);
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.heading = 0;
    this.v = 0;
    this.emote = '';
    this.emoteTimer = 0;
    this.active = false;
  }

  spawnAt(x, z, heading, groundY = 0) {
    this.x = x;
    this.z = z;
    this.y = groundY;
    this.heading = heading;
    this.v = 0;
    this.active = true;
    this.model.group.visible = true;
    this.model.group.position.set(this.x, this.y, this.z);
    this.model.group.rotation.set(0, this.heading, 0);
  }

  setColor(c) {
    this.model.setColor(c);
  }

  hide() {
    this.active = false;
    this.v = 0;
    this.emote = '';
    this.model.group.visible = false;
  }

  triggerEmote(type = 'wave') {
    this.emote = type;
    this.emoteTimer = 4.0;
  }

  step(dt, input, groundY = 0) {
    if (!this.active) return;

    const turnRate = 3.2;
    if (Math.abs(input.steer) > 0.02) {
      this.heading += input.steer * turnRate * dt;
    }

    const runMult = input.boost ? 9.5 : 5.4; // Yugurish 9.5 m/s, yurish 5.4 m/s
    const targetV = (input.throttle - input.reverse * 0.65) * runMult;
    this.v += (targetV - this.v) * Math.min(1, dt * 10);

    if (Math.abs(this.v) > 0.15) {
      this.emote = '';
      this.emoteTimer = 0;
    } else if (this.emoteTimer > 0) {
      this.emoteTimer -= dt;
      if (this.emoteTimer <= 0) this.emote = '';
    }

    const nx = this.x + Math.sin(this.heading) * this.v * dt;
    const nz = this.z + Math.cos(this.heading) * this.v * dt;

    // Binolar va kanal bilan to'qnashuvni tekshirish
    const r = 0.45;
    let blocked = false;
    for (const b of queryColliders(nx, nz, r + 1.5)) {
      if (nx + r > b.minX && nx - r < b.maxX && nz + r > b.minZ && nz - r < b.maxZ) {
        blocked = true;
        break;
      }
    }
    if (!blocked) {
      this.x = Math.max(-HALF + 5, Math.min(HALF - 5, nx));
      this.z = Math.max(-HALF + 5, Math.min(HALF - 5, nz));
    } else {
      this.v = 0;
    }

    this.y += (groundY - this.y) * Math.min(1, dt * 14);
    this.model.group.position.set(this.x, this.y, this.z);
    this.model.group.rotation.set(0, this.heading, 0);
    this.model.animate(dt, this.v, this.emote);
  }
}
