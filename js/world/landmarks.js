// Toshkentning taniqli joylari: teleminora, Chorsu, Amir Temur xiyoboni, Toshkent Siti
import * as THREE from 'three';
import { LANDMARKS, addCollider } from './layout.js';
import { nightMats } from './city.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
export const animated = [];

export function buildLandmarks(scene) {
  for (const l of LANDMARKS) {
    const g = new THREE.Group(); g.position.set(l.x, 0, l.z); scene.add(g);
    const f = BUILDERS[l.type]; if (f) f(g, l);
  }
}

const BUILDERS = {
  tvtower(g, l) {
    const steel = std(0xcfd4da, { metalness: 0.7, roughness: 0.3 });
    for (let a = 0; a < 3; a++) { // uchta tayanch oyoq
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.6, 60, 6), steel);
      const ang = a * Math.PI * 2 / 3; leg.position.set(Math.cos(ang) * 9, 28, Math.sin(ang) * 9);
      leg.rotation.set(Math.sin(ang) * 0.15, 0, -Math.cos(ang) * 0.15); g.add(leg);
    }
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 3.5, 230, 12), steel); shaft.position.y = 115; g.add(shaft);
    const podMat = std(0x2a3a55, { metalness: 0.6, emissive: 0x3070ff, emissiveIntensity: 0.2 });
    nightMats.push({ mat: podMat, base: 1.2, day: 0.15 });
    for (const [y, r] of [[100, 9], [170, 6]]) { const pod = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, 6, 20), podMat); pod.position.y = y; g.add(pod); }
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 1, 60, 6), std(0xff3030, { emissive: 0xff0000, emissiveIntensity: 1 })); tip.position.y = 258; g.add(tip);
    addCollider(l.x - 12, l.z - 12, l.x + 12, l.z + 12);
  },
  chorsu(g, l) {
    const tile = std(0x1e6fb8, { metalness: 0.3, roughness: 0.3 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(28, 28, 10, 32), std(0xd9c9a3)); base.position.y = 5; g.add(base);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(26, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), tile); dome.position.y = 10; g.add(dome);
    for (let a = 0; a < 8; a++) { // atrofidagi kichik gumbazlar
      const ang = a * Math.PI / 4, d = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), tile);
      d.position.set(Math.cos(ang) * 34, 4, Math.sin(ang) * 34); g.add(d);
      const p = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 4, 12), std(0xd9c9a3)); p.position.set(Math.cos(ang) * 34, 2, Math.sin(ang) * 34); g.add(p);
    }
    addCollider(l.x - 39, l.z - 39, l.x + 39, l.z + 39);
  },
  square(g, l) {
    const ped = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 9), std(0x6b6b6b)); ped.position.y = 2.5; g.add(ped);
    const bronze = std(0x6b4a24, { metalness: 0.8, roughness: 0.35 });
    const horse = new THREE.Mesh(new THREE.BoxGeometry(2, 2.4, 5), bronze); horse.position.y = 6.8; g.add(horse);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(1, 2.4, 1.2), bronze); neck.position.set(0, 8.6, 2.4); neck.rotation.x = -0.4; g.add(neck);
    const rider = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 3, 8), bronze); rider.position.set(0, 9.4, -0.3); g.add(rider);
    for (const z of [-1.5, 1.5]) for (const x of [-0.7, 0.7]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.2, 0.4), bronze); leg.position.set(x, 4.9 + (z > 0 ? 0.6 : 0), z); g.add(leg); }
    // Kurantlar (soat minorasi)
    const clock = new THREE.Mesh(new THREE.BoxGeometry(5, 26, 5), std(0xe8e0cc)); clock.position.set(30, 13, -30); g.add(clock);
    const face = new THREE.Mesh(new THREE.CircleGeometry(1.8, 24), std(0xffffff, { emissive: 0xfff0c0, emissiveIntensity: 0.5 })); face.position.set(30, 22, -27.4); g.add(face);
    nightMats.push({ mat: face.material, base: 2, day: 0.3 });
    addCollider(l.x - 4, l.z - 5.5, l.x + 4, l.z + 5.5); addCollider(l.x + 27, l.z - 33, l.x + 33, l.z - 27);
    fountain(g, -26, 26);
  },
  citytower(g, l) {
    const glass = std(0x4a7fb5, { metalness: 0.9, roughness: 0.08, emissive: 0x2050a0, emissiveIntensity: 0.1 });
    nightMats.push({ mat: glass, base: 0.9, day: 0.1 });
    const hs = [150, 110, 80];
    hs.forEach((h, i) => {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(9 - i, 11 - i, h, 6), glass);
      const x = (i - 1) * 26, z = i === 1 ? 18 : -14; t.position.set(x, h / 2, z); g.add(t);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(8 - i, 18, 6), std(0xffffff, { emissive: 0x88ccff, emissiveIntensity: 1 })); crown.position.set(x, h + 9, z); g.add(crown);
      addCollider(l.x + x - 11, l.z + z - 11, l.x + x + 11, l.z + z + 11);
    });
  },
  park(g, l) {
    if (l.name.startsWith('Mustaqillik')) { // Ezgulik ravog'i
      const white = std(0xf0ece2);
      for (const x of [-20, -10, 0, 10, 20]) { const c = new THREE.Mesh(new THREE.BoxGeometry(1.4, 14, 1.4), white); c.position.set(x, 7, -30); g.add(c); addCollider(l.x + x - 1, l.z - 31, l.x + x + 1, l.z - 29); }
      const top = new THREE.Mesh(new THREE.BoxGeometry(44, 2, 3), white); top.position.set(0, 15, -30); g.add(top);
      for (const x of [-15, -5, 5, 15]) { const bird = new THREE.Mesh(new THREE.ConeGeometry(0.8, 3, 6), std(0xd4af37, { metalness: 0.8 })); bird.position.set(x, 17.5, -30); g.add(bird); }
    }
    fountain(g, 0, 0);
  },
};

function fountain(g, x, z) {
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.5, 1, 24), std(0xcfc7b5)); bowl.position.set(x, 0.5, z); g.add(bowl);
  const water = new THREE.Mesh(new THREE.CircleGeometry(6.5, 24).rotateX(-Math.PI / 2), std(0x3fa9d9, { metalness: 0.5, roughness: 0.1, emissive: 0x0a4060, emissiveIntensity: 0.5 }));
  water.position.set(x, 1.05, z); g.add(water);
  const jet = new THREE.Mesh(new THREE.ConeGeometry(1.2, 5, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.5, depthWrite: false }));
  jet.position.set(x, 3.5, z); g.add(jet); animated.push((t) => { jet.scale.y = 1 + Math.sin(t * 4) * 0.15; });
  const wp = g.position; addCollider(wp.x + x - 7.5, wp.z + z - 7.5, wp.x + x + 7.5, wp.z + z + 7.5);
}
