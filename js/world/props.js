// Ko'cha jihozlari: chiroqlar, svetoforlar, daraxtlar, reklama, zapravka, garaj
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { N, BLOCK, ROAD, CELL, HALF, roadC, blockC, blockInfo, POIS, addCollider } from './layout.js';
import { signTexture, ADS } from './textures.js';
import { GLOW_TEX } from '../carModel.js';
import { nightMats } from './city.js';
import { loadBuildingGlb } from './landmarks.js';

const box = new THREE.BoxGeometry(1, 1, 1);
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
function inst(geo, mat, items, scene) {
  const im = new THREE.InstancedMesh(geo, mat, items.length);
  items.forEach((t, i) => { q.setFromAxisAngle(up, t.r || 0); im.setMatrixAt(i, m4.compose(v3.set(t.x, t.y, t.z), q, new THREE.Vector3(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1))); });
  scene.add(im); return im;
}

export const lights = { phase: 0, poolMat: null, lampMat: null, signs: [] };

export function buildProps(scene, quality) {
  const poles = [], heads = [], pools = [], trunks = [], crowns = [];
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3d42, metalness: 0.6, roughness: 0.5 });

  // Ko'cha chiroqlari — har bir yo'l bo'ylab ikki tomonda
  const step = quality === 'low' ? 55 : 36;
  for (let i = 0; i <= N; i++) for (let s = -HALF + ROAD + 15; s < HALF - 10; s += step) {
    const f = ((s + HALF) % CELL + CELL) % CELL;
    if (f < ROAD + 6) continue;
    for (const side of [-1, 1]) {
      const off = side * (ROAD / 2 + 1.2), c = roadC(i);
      // [ustun x, z, chiroq boshining yo'l tomonga siljishi dx, dz]
      for (const [x, z, dx, dz] of [[s, c + off, 0, -side * 1.5], [c + off, s, -side * 1.5, 0]]) {
        poles.push({ x, y: 4, z, sx: 0.18, sy: 8, sz: 0.18 });
        heads.push({ x: x + dx, y: 7.9, z: z + dz, sx: dx ? 1.6 : 0.5, sy: 0.18, sz: dz ? 1.6 : 0.5 });
        pools.push({ x: x + dx * 2.5, y: 0.06, z: z + dz * 2.5, sx: 13, sy: 1, sz: 13 });
      }
    }
  }
  inst(box, poleMat, poles, scene);
  lights.lampMat = new THREE.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffc56b, emissiveIntensity: 0 });
  inst(box, lights.lampMat, heads, scene);
  lights.poolMat = new THREE.MeshBasicMaterial({ map: GLOW_TEX, color: 0xffb25a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  inst(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), lights.poolMat, pools, scene);

  // Svetoforlar — har bir chorrahada
  const tPoles = [], lamps = { xr: [], xy: [], xg: [], zr: [], zy: [], zg: [] };
  for (let i = 0; i <= N; i++) for (let k = 0; k <= N; k++) {
    if (i === 0 || k === 0 || i === N || k === N) continue;
    const cx = roadC(i), cz = roadC(k), o = ROAD / 2 + 0.8;
    for (const [px, pz, axis, face] of [[cx + o, cz + o, 'z', 0], [cx - o, cz - o, 'z', Math.PI], [cx - o, cz + o, 'x', -Math.PI / 2], [cx + o, cz - o, 'x', Math.PI / 2]]) {
      tPoles.push({ x: px, y: 2.2, z: pz, sx: 0.2, sy: 4.4, sz: 0.2 });
      tPoles.push({ x: px, y: 4.9, z: pz, sx: 0.5, sy: 1.5, sz: 0.5, r: face });
      ['r', 'y', 'g'].forEach((c, n) => lamps[axis + c].push({ x: px + Math.sin(face) * 0.27, y: 5.35 - n * 0.45, z: pz + Math.cos(face) * 0.27, sx: 0.32, sy: 0.32, sz: 0.06, r: face }));
    }
  }
  inst(box, new THREE.MeshStandardMaterial({ color: 0x1b1d20 }), tPoles, scene);
  const col = { r: 0xff2020, y: 0xffb300, g: 0x20ff60 };
  lights.tl = {};
  for (const key of Object.keys(lamps)) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: col[key[1]], emissiveIntensity: 0 });
    lights.tl[key] = mat; inst(box, mat, lamps[key], scene);
  }

  // Daraxtlar (tabiiy ko'p qatlamli Toshkent chinorlari va bog' daraxtlari) — trotuar chetlari va bog'larda
  for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
    const info = blockInfo(j, k), bx = blockC(j), bz = blockC(k);
    const add = (x, z, s = 1) => {
      const rRot = Math.random() * 6.28;
      trunks.push({ x, y: 1.65 * s, z, sx: 0.34 * s, sy: 3.3 * s, sz: 0.34 * s, r: rRot });
      crowns.push({ x, y: 4.55 * s, z, sx: 2.45 * s, sy: 2.35 * s, sz: 2.45 * s, r: rRot });
    };
    if (info.type === 'park') for (let t = 0; t < (quality === 'low' ? 14 : 30); t++) add(bx + (Math.random() - 0.5) * (BLOCK - 16), bz + (Math.random() - 0.5) * (BLOCK - 16), 0.8 + Math.random() * 0.6);
    else if (info.type === 'city') for (let t = -BLOCK / 2 + 8; t < BLOCK / 2 - 4; t += quality === 'low' ? 24 : 14) {
      add(bx + t, bz - BLOCK / 2 + 2, 0.88 + ((Math.abs(j * 7 + t) % 5) * 0.08));
      add(bx + t, bz + BLOCK / 2 - 2, 0.92 + ((Math.abs(k * 5 + t) % 5) * 0.07));
      add(bx - BLOCK / 2 + 2, bz + t, 0.86 + ((Math.abs(j + k + t) % 5) * 0.08));
      add(bx + BLOCK / 2 - 2, bz + t, 0.90 + ((Math.abs(j * 3 + t) % 5) * 0.08));
    } else if (info.type === 'canal') for (let t = -BLOCK / 2 + 6; t < BLOCK / 2 - 4; t += 12) {
      add(bx - 24, bz + t, 1.08); add(bx + 24, bz + t, 1.05); // Anhor bo'yidagi chinor va tollar
    }
  }
  const richTrunkGeo = new THREE.CylinderGeometry(0.32, 0.52, 1, 5);
  inst(richTrunkGeo, new THREE.MeshStandardMaterial({ color: 0x4e3928, roughness: 0.92 }), trunks, scene);

  // Daraxt shoxlari: 36 poligonli toza past-poligonli daraxt toji (2 mln ortiqcha vertikal poligonlarni yo'qotadi)
  const richCrownGeo = new THREE.DodecahedronGeometry(1.55, 0);
  const crownIm = inst(richCrownGeo, new THREE.MeshStandardMaterial({ color: 0x2d6e2e, roughness: 0.86 }), crowns, scene);
  const leafPalette = ['#2b6e2c', '#357a32', '#265d28', '#3e8438', '#2f7336'];
  const cTmp = new THREE.Color();
  for (let i = 0; i < crowns.length; i++) {
    cTmp.set(leafPalette[i % leafPalette.length]);
    crownIm.setColorAt(i, cTmp);
  }
  if (crownIm.instanceColor) crownIm.instanceColor.needsUpdate = true;

  // Yo'l belgilari (Tezlik 60/70 va Piyodalar o'tish joyi) — InstancedMesh
  const signPoles = [], signDiscs = [];
  for (let i = 1; i < N; i += 2) for (let k = 1; k < N; k += 2) {
    const cx = roadC(i), cz = roadC(k), o = ROAD / 2 + 1.4;
    signPoles.push({ x: cx + o, y: 1.5, z: cz - o - 3, sx: 0.08, sy: 3.0, sz: 0.08 });
    signDiscs.push({ x: cx + o, y: 3.1, z: cz - o - 3, sx: 0.65, sy: 0.65, sz: 0.08 });
    signPoles.push({ x: cx - o - 3, y: 1.5, z: cz + o, sx: 0.08, sy: 3.0, sz: 0.08 });
    signDiscs.push({ x: cx - o - 3, y: 3.1, z: cz + o, sx: 0.65, sy: 0.65, sz: 0.08, r: Math.PI / 2 });
  }
  inst(box, poleMat, signPoles, scene);
  inst(box, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff2222, emissiveIntensity: 0.35 }), signDiscs, scene);

  buildPOIs(scene);
}

function buildBillboards(scene) {
  let n = 0;
  for (let i = 1; i < N; i += 2) for (let k = 1; k < N; k += 3) {
    const [lines, bg, accent] = ADS[n++ % ADS.length];
    const tex = signTexture(lines, { bg, accent });
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.4 });
    nightMats.push({ mat, base: 1.6, day: 0.4 });
    const x = roadC(i) + ROAD / 2 + 6, z = blockC(k) + (n % 2 ? 20 : -20);
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = Math.PI / 2;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), mat); screen.position.y = 9;
    const back = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0x222222 })); back.scale.set(12.4, 6.4, 0.4); back.position.set(0, 9, -0.25);
    const pole = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0x333333 })); pole.scale.set(0.6, 6, 0.6); pole.position.y = 3;
    g.add(screen, back, pole); scene.add(g);
    lights.signs.push({ tex, lines, bg, accent, mat });
  }
}

function buildPOIs(scene) {
  for (const p of POIS) {
    const g = new THREE.Group(); g.position.set(p.x, 0, p.z); scene.add(g);
    // Mashina kirishi uchun kvartal ichida tekis asfalt maydon
    const pad = new THREE.Mesh(new THREE.BoxGeometry(BLOCK - 6, 0.25, 34), new THREE.MeshStandardMaterial({ color: 0x2c2d31, roughness: 0.8 }));
    pad.position.set(0, 0.12, -5); g.add(pad);
    if (p.type === 'gas') {
      const procGas = new THREE.Group();
      g.add(procGas);
      const roof = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0xf5f5f5, emissive: 0xffffff, emissiveIntensity: 0.15 }));
      roof.scale.set(26, 0.8, 14); roof.position.set(0, 6, -6); procGas.add(roof);
      const stripe = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0x00a651, emissive: 0x00ff7a, emissiveIntensity: 0.6 }));
      stripe.scale.set(26.2, 0.3, 14.2); stripe.position.set(0, 5.6, -6); procGas.add(stripe);
      for (const px of [-8, 0, 8]) {
        const pump = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0x1565c0 })); pump.scale.set(1.2, 1.8, 0.8); pump.position.set(px, 1.1, -6); procGas.add(pump);
        const col = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0xdddddd })); col.scale.set(0.4, 5.6, 0.4); col.position.set(px, 3, -6); procGas.add(col);
        addCollider(p.x + px - 0.8, p.z - 6.6, p.x + px + 0.8, p.z - 5.4, 'pump');
      }
      const shopMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0 }); const shop = new THREE.Mesh(box, shopMat); shop.scale.set(20, 5, 10); shop.position.set(0, 2.5, -30); procGas.add(shop);
      addCollider(p.x - 10, p.z - 35, p.x + 10, p.z - 25);
      addSign(g, ['UZ-OIL', 'AI-92 · AI-95 · AI-100'], '#003b1f', '#00ff7a', 0, 9, 4);

      // /binolar/gas-station.glb 3D modelini asinxron yuklash va o'rnatish
      loadBuildingGlb('/binolar/gas-station.glb', { targetWidth: 32 }).then((glb) => {
        if (!glb) return;
        procGas.visible = false;
        glb.position.set(0, 0.15, -14);
        g.add(glb);
      });
    } else {
      const hall = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0x1d2433, metalness: 0.7, roughness: 0.2, emissive: 0x0b3d91, emissiveIntensity: 0.3 }));
      hall.scale.set(60, 12, 30); hall.position.set(0, 6, -38); g.add(hall);
      addCollider(p.x - 30, p.z - 53, p.x + 30, p.z - 23);
      addSign(g, ['AVTOSALON', 'Garaj · Tuning · Savdo'], '#0b0f2a', '#ffd740', 0, 14, -22.5);
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(p.r - 1.2, p.r, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: p.type === 'gas' ? 0x00ff7a : 0xffd740, transparent: true, opacity: 0.55, depthWrite: false }));
    ring.position.y = 0.3; g.add(ring); p.ring = ring;
  }
}

function addSign(g, lines, bg, accent, x, y, z) {
  const tex = signTexture(lines, { bg, accent });
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.5 });
  nightMats.push({ mat, base: 1.8, day: 0.5 });
  const s = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), mat); s.position.set(x, y, z); g.add(s);
}

// Svetofor fazasi: 0..1 orasidagi vaqt. Qaysi o'q uchun yashil?
export const TL_CYCLE = 24;
export function signalFor(axis, t) {
  const p = (t % TL_CYCLE) / TL_CYCLE;
  const xs = p < 0.42 ? 'g' : p < 0.5 ? 'y' : 'r';
  const zs = p >= 0.5 && p < 0.92 ? 'g' : p >= 0.92 ? 'y' : 'r';
  return axis === 'x' ? xs : zs;
}

export function updateProps(t, night) {
  for (const a of ['x', 'z']) {
    const s = signalFor(a, t);
    for (const c of ['r', 'y', 'g']) lights.tl[a + c].emissiveIntensity = s === c ? 3.5 : 0.05;
  }
  lights.lampMat.emissiveIntensity = night * 4;
  lights.poolMat.opacity = night * 0.55;
  for (const p of POIS) if (p.ring) p.ring.material.opacity = 0.35 + Math.sin(t * 3) * 0.2;
}
