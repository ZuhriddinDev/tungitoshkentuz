// Ko'cha jihozlari: chiroqlar, svetoforlar, daraxtlar, reklama, zapravka, garaj
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { N, BLOCK, ROAD, CELL, HALF, roadC, blockC, blockInfo, POIS, addCollider } from './layout.js';
import { signTexture, ADS } from './textures.js';
import { GLOW_TEX } from '../carModel.js';
import { nightMats } from './city.js';

const box = new THREE.BoxGeometry(1, 1, 1);
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
const s3 = new THREE.Vector3();
function inst(geo, mat, items, parent, colors = null) {
  if (!items.length) return null;
  const im = new THREE.InstancedMesh(geo, mat, items.length);
  const cTmp = colors ? new THREE.Color() : null;
  items.forEach((t, i) => {
    q.setFromAxisAngle(up, t.r || 0);
    im.setMatrixAt(i, m4.compose(v3.set(t.x, t.y, t.z), q, s3.set(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1)));
    if (colors) {
      cTmp.set(colors[t.ci % colors.length]);
      im.setColorAt(i, cTmp);
    }
  });
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.geometry.computeBoundingSphere();
  parent.add(im);
  return im;
}

export const lights = { phase: 0, poolMat: null, lampMat: null, signs: [], chunks: [] };

export function buildProps(scene, quality) {
  lights.chunks = [];
  const CHUNK_DIV = 5;
  const CHUNK_SIZE = (HALF * 2) / CHUNK_DIV; // 1000m x 1000m
  const CHUNK_RADIUS = Math.hypot(CHUNK_SIZE, CHUNK_SIZE) / 2;
  const chunkBins = new Map();
  const getChunk = (x, z) => {
    const cx = Math.max(0, Math.min(CHUNK_DIV - 1, Math.floor((x + HALF) / CHUNK_SIZE)));
    const cz = Math.max(0, Math.min(CHUNK_DIV - 1, Math.floor((z + HALF) / CHUNK_SIZE)));
    const key = `${cx},${cz}`;
    if (!chunkBins.has(key)) {
      const g = new THREE.Group();
      scene.add(g);
      const bin = {
        group: g,
        cx: -HALF + (cx + 0.5) * CHUNK_SIZE,
        cz: -HALF + (cz + 0.5) * CHUNK_SIZE,
        radius: CHUNK_RADIUS,
        poles: [], heads: [], pools: [], trunks: [], crowns: [], signPoles: [], signDiscs: [],
      };
      chunkBins.set(key, bin);
      lights.chunks.push(bin);
    }
    return chunkBins.get(key);
  };

  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3d42, metalness: 0.6, roughness: 0.5 });

  // Ko'cha chiroqlari — har bir yo'l bo'ylab ikki tomonda (5x5 sektorlarda)
  const step = quality === 'low' ? 55 : 36;
  for (let i = 0; i <= N; i++) for (let s = -HALF + ROAD + 15; s < HALF - 10; s += step) {
    const f = ((s + HALF) % CELL + CELL) % CELL;
    if (f < ROAD + 6) continue;
    for (const side of [-1, 1]) {
      const off = side * (ROAD / 2 + 1.2), c = roadC(i);
      for (const [x, z, dx, dz] of [[s, c + off, 0, -side * 1.5], [c + off, s, -side * 1.5, 0]]) {
        const ch = getChunk(x, z);
        ch.poles.push({ x, y: 4, z, sx: 0.18, sy: 8, sz: 0.18 });
        ch.heads.push({ x: x + dx, y: 7.9, z: z + dz, sx: dx ? 1.6 : 0.5, sy: 0.18, sz: dz ? 1.6 : 0.5 });
        ch.pools.push({ x: x + dx * 2.5, y: 0.06, z: z + dz * 2.5, sx: 13, sy: 1, sz: 13 });
      }
    }
  }
  lights.lampMat = new THREE.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffc56b, emissiveIntensity: 0 });
  lights.poolMat = new THREE.MeshBasicMaterial({ map: GLOW_TEX, color: 0xffb25a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });

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

  // Daraxtlar (tabiiy Toshkent chinorlari va bog' daraxtlari) — 5x5 sektorlarda
  let treeIdx = 0;
  for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
    const info = blockInfo(j, k), bx = blockC(j), bz = blockC(k);
    const add = (x, z, s = 1) => {
      const ch = getChunk(x, z);
      const rRot = (treeIdx * 1.618) % 6.28;
      ch.trunks.push({ x, y: 1.65 * s, z, sx: 0.34 * s, sy: 3.3 * s, sz: 0.34 * s, r: rRot });
      ch.crowns.push({ x, y: 4.55 * s, z, sx: 2.45 * s, sy: 2.35 * s, sz: 2.45 * s, r: rRot, ci: treeIdx++ });
    };
    if (info.type === 'park') for (let t = 0; t < (quality === 'low' ? 14 : 30); t++) add(bx + (Math.random() - 0.5) * (BLOCK - 16), bz + (Math.random() - 0.5) * (BLOCK - 16), 0.8 + Math.random() * 0.6);
    else if (info.type === 'city') for (let t = -BLOCK / 2 + 8; t < BLOCK / 2 - 4; t += quality === 'low' ? 24 : 14) {
      add(bx + t, bz - BLOCK / 2 + 2, 0.88 + ((Math.abs(j * 7 + t) % 5) * 0.08));
      add(bx + t, bz + BLOCK / 2 - 2, 0.92 + ((Math.abs(k * 5 + t) % 5) * 0.07));
      add(bx - BLOCK / 2 + 2, bz + t, 0.86 + ((Math.abs(j + k + t) % 5) * 0.08));
      add(bx + BLOCK / 2 - 2, bz + t, 0.90 + ((Math.abs(j * 3 + t) % 5) * 0.08));
    } else if (info.type === 'canal') for (let t = -BLOCK / 2 + 6; t < BLOCK / 2 - 4; t += 12) {
      add(bx - 24, bz + t, 1.08); add(bx + 24, bz + t, 1.05);
    }
  }

  // Yo'l belgilari (Tezlik 60/70 va Piyodalar o'tish joyi)
  for (let i = 1; i < N; i += 2) for (let k = 1; k < N; k += 2) {
    const cx = roadC(i), cz = roadC(k), o = ROAD / 2 + 1.4;
    const ch1 = getChunk(cx + o, cz - o - 3);
    ch1.signPoles.push({ x: cx + o, y: 1.5, z: cz - o - 3, sx: 0.08, sy: 3.0, sz: 0.08 });
    ch1.signDiscs.push({ x: cx + o, y: 3.1, z: cz - o - 3, sx: 0.65, sy: 0.65, sz: 0.08 });
    const ch2 = getChunk(cx - o - 3, cz + o);
    ch2.signPoles.push({ x: cx - o - 3, y: 1.5, z: cz + o, sx: 0.08, sy: 3.0, sz: 0.08 });
    ch2.signDiscs.push({ x: cx - o - 3, y: 3.1, z: cz + o, sx: 0.65, sy: 0.65, sz: 0.08, r: Math.PI / 2 });
  }

  const poolPlane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4e3928, roughness: 0.92 });
  const richTrunkGeo = new THREE.CylinderGeometry(0.32, 0.52, 1, 5);
  const richCrownGeo = new THREE.DodecahedronGeometry(1.55, 0);
  const crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86 });
  const leafPalette = ['#2b6e2c', '#357a32', '#265d28', '#3e8438', '#2f7336'];
  const signDiscMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff2222, emissiveIntensity: 0.35 });

  for (const ch of lights.chunks) {
    inst(box, poleMat, ch.poles, ch.group);
    inst(box, lights.lampMat, ch.heads, ch.group);
    inst(poolPlane, lights.poolMat, ch.pools, ch.group);
    inst(richTrunkGeo, trunkMat, ch.trunks, ch.group);
    inst(richCrownGeo, crownMat, ch.crowns, ch.group, leafPalette);
    inst(box, poleMat, ch.signPoles, ch.group);
    inst(box, signDiscMat, ch.signDiscs, ch.group);
  }

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

      // Asphalt forecourt pad + lane markings
      const padMat = new THREE.MeshStandardMaterial({ color: 0x1e232d, roughness: 0.88, metalness: 0.05 });
      const pad = new THREE.Mesh(box, padMat);
      pad.scale.set(30, 0.08, 36);
      pad.position.set(0, 0.04, -14);
      procGas.add(pad);

      const lineMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xf59e0b, emissiveIntensity: 0.18, roughness: 0.6 });
      for (const lx of [-11.5, -4, 4, 11.5]) {
        const lane = new THREE.Mesh(box, lineMat);
        lane.scale.set(0.18, 0.09, 13);
        lane.position.set(lx, 0.05, -6);
        procGas.add(lane);
      }

      // Modern dark graphite canopy with emerald/amber LED fascia
      const canopyMat = new THREE.MeshStandardMaterial({ color: 0x1c2432, roughness: 0.35, metalness: 0.55 });
      const roof = new THREE.Mesh(box, canopyMat);
      roof.scale.set(27, 0.95, 14.5);
      roof.position.set(0, 6.1, -6);
      procGas.add(roof);

      const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x263042, roughness: 0.5, metalness: 0.25 });
      const ceiling = new THREE.Mesh(box, ceilingMat);
      ceiling.scale.set(25.8, 0.12, 13.4);
      ceiling.position.set(0, 5.58, -6);
      procGas.add(ceiling);

      const stripe = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0x00c853, emissive: 0x00ff7a, emissiveIntensity: 0.75, roughness: 0.25 }));
      stripe.scale.set(27.2, 0.28, 14.7);
      stripe.position.set(0, 5.75, -6);
      procGas.add(stripe);

      const goldTrim = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xfbbf24, emissiveIntensity: 0.45, roughness: 0.3 }));
      goldTrim.scale.set(27.15, 0.1, 14.65);
      goldTrim.position.set(0, 6.52, -6);
      procGas.add(goldTrim);

      // Recessed LED canopy downlights + 3D fuel islands & dispensers
      const ledMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe6f7ff, emissiveIntensity: 1.4, roughness: 0.2 });
      const curbMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.75, metalness: 0.1 });
      const colMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.32, metalness: 0.72 });
      const pumpBodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.45 });
      const pumpAccentMat = new THREE.MeshStandardMaterial({ color: 0x00a651, roughness: 0.35, metalness: 0.25 });
      const screenMat = new THREE.MeshStandardMaterial({ color: 0x064e3b, emissive: 0x34d399, emissiveIntensity: 1.1, roughness: 0.2 });
      const hoseMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });

      for (const px of [-8, 0, 8]) {
        // Canopy LED panels
        for (const lz of [-9.5, -2.5]) {
          const led = new THREE.Mesh(box, ledMat);
          led.scale.set(2.4, 0.08, 1.2);
          led.position.set(px, 5.52, lz);
          procGas.add(led);
        }

        // Raised safety curb island
        const island = new THREE.Mesh(box, curbMat);
        island.scale.set(2.3, 0.24, 5.2);
        island.position.set(px, 0.14, -6);
        procGas.add(island);

        // Brushed steel canopy columns
        for (const cz of [-8.0, -4.0]) {
          const col = new THREE.Mesh(box, colMat);
          col.scale.set(0.36, 5.4, 0.36);
          col.position.set(px, 2.9, cz);
          procGas.add(col);
        }

        // 3D fuel dispenser with digital screens & hoses
        const pump = new THREE.Mesh(box, pumpBodyMat);
        pump.scale.set(1.15, 1.85, 0.76);
        pump.position.set(px, 1.15, -6);
        procGas.add(pump);

        const pumpTop = new THREE.Mesh(box, pumpAccentMat);
        pumpTop.scale.set(1.22, 0.28, 0.82);
        pumpTop.position.set(px, 2.12, -6);
        procGas.add(pumpTop);

        for (const side of [-1, 1]) {
          const scr = new THREE.Mesh(box, screenMat);
          scr.scale.set(0.68, 0.38, 0.05);
          scr.position.set(px, 1.52, -6 + side * 0.39);
          procGas.add(scr);

          const hose = new THREE.Mesh(box, hoseMat);
          hose.scale.set(0.08, 1.05, 0.08);
          hose.position.set(px + side * 0.62, 1.18, -6);
          procGas.add(hose);
        }

        addCollider(p.x + px - 1.15, p.z - 8.6, p.x + px + 1.15, p.z - 3.4, 'pump');
      }

      // Modern convenience store ("UZ-OIL MART") with glass facade & warm lit interior
      const shopBodyMat = new THREE.MeshStandardMaterial({ color: 0x222938, roughness: 0.45, metalness: 0.35 });
      const shop = new THREE.Mesh(box, shopBodyMat);
      shop.scale.set(20, 5.2, 10);
      shop.position.set(0, 2.6, -30);
      procGas.add(shop);

      const shopRoofTrim = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0x00a651, emissive: 0x00e676, emissiveIntensity: 0.55, roughness: 0.3 }));
      shopRoofTrim.scale.set(20.4, 0.32, 10.4);
      shopRoofTrim.position.set(0, 5.25, -30);
      procGas.add(shopRoofTrim);

      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x16324a,
        emissive: 0xffd599,
        emissiveIntensity: 0.32,
        roughness: 0.12,
        metalness: 0.65,
      });
      const storefront = new THREE.Mesh(box, glassMat);
      storefront.scale.set(16.4, 3.3, 0.18);
      storefront.position.set(0, 1.85, -24.92);
      procGas.add(storefront);

      const doorGlow = new THREE.Mesh(box, new THREE.MeshStandardMaterial({
        color: 0x1d4ed8,
        emissive: 0xfff3d6,
        emissiveIntensity: 0.65,
        roughness: 0.15,
      }));
      doorGlow.scale.set(3.2, 2.8, 0.22);
      doorGlow.position.set(0, 1.5, -24.88);
      procGas.add(doorGlow);

      addCollider(p.x - 10, p.z - 35, p.x + 10, p.z - 25);
      addSign(g, ['UZ-OIL', 'AI-92 · AI-95 · AI-100'], '#062c1c', '#00ff7a', 0, 9.2, 4);
      addSign(g, ['UZ-OIL 24/7', '10 500 · 12 800 · 16 500'], '#0b192c', '#fbbf24', 14.5, 4.6, 5.5);
    } else {
      buildModernAvtosalon(g, p);
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(p.r - 1.2, p.r, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: p.type === 'gas' ? 0x00ff7a : 0xffd740, transparent: true, opacity: 0.55, depthWrite: false }));
    ring.position.y = 0.3; g.add(ring); p.ring = ring;
  }
}

function addSign(g, lines, bg, accent, x, y, z, w = 14, h = 7) {
  const tex = signTexture(lines, { bg, accent });
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.5 });
  nightMats.push({ mat, base: 1.8, day: 0.5 });
  const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); s.position.set(x, y, z); g.add(s);
}

// ============================================================================
// ZAMONAVIY FLAGSHIP AVTOSALON VA TUNING MARKAZI (3D ME'MORIY MAJMUASI)
// ============================================================================
function buildModernAvtosalon(g, p) {
  const mDarkAlu = new THREE.MeshStandardMaterial({ color: 0x111520, roughness: 0.32, metalness: 0.75 });
  const mWhiteClad = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.28, metalness: 0.35 });
  const mGraphite = new THREE.MeshStandardMaterial({ color: 0x1e2432, roughness: 0.42, metalness: 0.55 });
  const mChrome = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.14, metalness: 0.94 });
  const mGold = new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.22, metalness: 0.90 });
  const mGlass = new THREE.MeshStandardMaterial({
    color: 0x172b45,
    roughness: 0.08,
    metalness: 0.88,
    transparent: true,
    opacity: 0.58,
  });
  const mInteriorGlow = new THREE.MeshStandardMaterial({
    color: 0xfff8e7,
    emissive: 0xffe4b5,
    emissiveIntensity: 0.85,
    roughness: 0.2,
  });
  const mNeonCyan = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x00e5ff,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });
  const mNeonGold = new THREE.MeshStandardMaterial({
    color: 0xfde047,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.3,
    roughness: 0.2,
  });
  nightMats.push({ mat: mInteriorGlow, base: 1.65, day: 0.55 });
  nightMats.push({ mat: mNeonCyan, base: 2.2, day: 0.45 });
  nightMats.push({ mat: mNeonGold, base: 2.0, day: 0.45 });

  const addBox = (sx, sy, sz, x, y, z, mat) => {
    const m = new THREE.Mesh(box, mat);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };

  // 1. Asosiy bino orqa korpusi va 2-qavat konsol (cantilever) arxitekturasi (z = -53 .. -23)
  addBox(60, 12.2, 22, 0, 6.1, -42, mDarkAlu);
  // Ikkinchi qavat oldinga chiqib turgan zamonaviy oq-alyuminiy rom
  addBox(61.2, 1.1, 31.4, 0, 12.6, -37.8, mWhiteClad);
  addBox(61.6, 0.26, 31.8, 0, 13.25, -37.8, mNeonCyan);
  // 1-qavat va 2-qavat orasidagi oltin me'moriy belbog'
  addBox(60.6, 0.55, 30.6, 0, 6.4, -38.0, mGraphite);
  addBox(60.8, 0.16, 30.8, 0, 6.72, -38.0, mNeonGold);

  // Yon tomondagi qiya/diagonal dizayn qanotlari
  for (const sx of [-1, 1]) {
    addBox(1.8, 12.8, 30.8, sx * 29.6, 6.4, -38.0, mWhiteClad);
    addBox(0.24, 12.2, 0.35, sx * 30.55, 6.4, -22.8, mNeonCyan);
  }

  // 2. Old panoramik shisha vitrina (Showroom Curtain Wall, z = -23.1)
  addBox(56.4, 11.4, 0.3, 0, 6.0, -23.1, mGlass);
  // Vertikal alyuminiy mullion ustunlar
  for (let mx = -24; mx <= 24; mx += 6) {
    addBox(0.26, 11.8, 0.55, mx, 6.0, -22.95, mChrome);
  }

  // 3. Ichki Showroom yoritilgan shifti va 3 ta ko'rgazma podiumi (oynadan ko'rinib turadi)
  addBox(54, 0.25, 9.5, 0, 5.7, -27.8, mInteriorGlow);
  addBox(54, 0.25, 9.5, 0, 11.5, -27.8, mInteriorGlow);
  addBox(56, 0.28, 11, 0, 0.14, -28.0, mGraphite);

  const podGeo = new THREE.CylinderGeometry(3.4, 3.8, 0.36, 24);
  const podRingGeo = new THREE.TorusGeometry(3.65, 0.08, 8, 28);
  podRingGeo.rotateX(Math.PI / 2);
  for (const px of [-16, 0, 16]) {
    const pod = new THREE.Mesh(podGeo, mDarkAlu);
    pod.position.set(px, 0.34, -27.5);
    const pRing = new THREE.Mesh(podRingGeo, px === 0 ? mNeonGold : mNeonCyan);
    pRing.position.set(px, 0.54, -27.5);
    g.add(pod, pRing);
  }

  // 4. Markaziy VIP Kirish Soyaboni (Canopy) va Shisha Portal (z = -22.5 .. -15.5)
  addBox(16.8, 0.72, 7.6, 0, 5.5, -19.2, mDarkAlu);
  addBox(17.1, 0.18, 7.9, 0, 5.12, -19.2, mNeonGold);
  for (const sx of [-1, 1]) {
    addBox(0.55, 5.3, 0.55, sx * 7.6, 2.75, -15.8, mChrome);
    addBox(0.75, 0.22, 0.75, sx * 7.6, 5.25, -15.8, mGold);
  }
  // Kirish shisha darvozasi va oltin romi
  addBox(6.8, 4.1, 0.38, 0, 2.15, -22.8, mGold);
  addBox(6.2, 3.8, 0.44, 0, 2.05, -22.78, mGlass);

  // 5. O'ng qanotda zamonaviy Tuning & Service boks darvozalari (x = 16..27)
  for (const bx of [17.5, 24.0]) {
    addBox(4.8, 3.8, 0.4, bx, 2.0, -22.85, mGraphite);
    addBox(4.4, 0.14, 0.46, bx, 3.95, -22.82, mNeonCyan);
    for (let gy = 0.9; gy <= 3.1; gy += 0.7) {
      addBox(4.3, 0.18, 0.45, bx, gy, -22.82, mGlass);
    }
  }

  // 6. Tashqi Granit Plaza, VIP Ko'rgazma Podiumlari va 15m Totem Stele
  addBox(64, 0.14, 18, 0, 0.08, -14.2, mGraphite);
  for (const sx of [-1, 1]) {
    const outPod = new THREE.Mesh(podGeo, mWhiteClad);
    outPod.position.set(sx * 20.5, 0.26, -14.5);
    const outRing = new THREE.Mesh(podRingGeo, mNeonCyan);
    outRing.position.set(sx * 20.5, 0.46, -14.5);
    g.add(outPod, outRing);

    // Dekorativ zamonaviy gulzor + daraxt
    const plx = sx * 12.2;
    addBox(2.6, 0.65, 2.6, plx, 0.42, -13.5, mDarkAlu);
    addBox(2.7, 0.08, 2.7, plx, 0.78, -13.5, mGold);
    const tree = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.15, 1),
      new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.75 })
    );
    tree.position.set(plx, 2.05, -13.5);
    g.add(tree);
  }

  // Baland Avtosalon Totem Ustuni (chap old burchakda)
  addBox(2.8, 14.5, 1.2, -29.2, 7.25, -12.5, mDarkAlu);
  addBox(0.22, 14.2, 1.28, -27.75, 7.25, -12.5, mNeonGold);
  addBox(0.22, 14.2, 1.28, -30.65, 7.25, -12.5, mNeonCyan);
  addSign(g, ['TASHKENT', 'MOTORS'], '#070b18', '#00e5ff', -29.2, 11.5, -11.82, 2.5, 3.6);

  // 7. Fasad Katta Yorug' Peshlavhalari va Collider (mavjud chegaraga 100% mos)
  addCollider(p.x - 30, p.z - 53, p.x + 30, p.z - 23);
  addSign(g, ['AVTOSALON', 'Premium Motors · Tuning · Savdo'], '#080c1c', '#ffd740', 0, 15.8, -22.2, 22, 5.2);
  addSign(g, ['TUNING & SERVICE', 'Stage 1-3 · Disk · Neon'], '#071526', '#00e5ff', 20.8, 9.2, -22.4, 11.5, 3.0);
}

// Svetofor fazasi: 0..1 orasidagi vaqt. Qaysi o'q uchun yashil?
export const TL_CYCLE = 24;
export function signalFor(axis, t) {
  const p = (t % TL_CYCLE) / TL_CYCLE;
  const xs = p < 0.42 ? 'g' : p < 0.5 ? 'y' : 'r';
  const zs = p >= 0.5 && p < 0.92 ? 'g' : p >= 0.92 ? 'y' : 'r';
  return axis === 'x' ? xs : zs;
}

export function updateProps(t, night, px = 0, pz = 0, cullDist = 900) {
  for (const a of ['x', 'z']) {
    const s = signalFor(a, t);
    for (const c of ['r', 'y', 'g']) lights.tl[a + c].emissiveIntensity = s === c ? 3.5 : 0.05;
  }
  lights.lampMat.emissiveIntensity = night * 4;
  lights.poolMat.opacity = night * 0.55;
  for (const p of POIS) if (p.ring) p.ring.material.opacity = 0.35 + Math.sin(t * 3) * 0.2;
  if (lights.chunks && lights.chunks.length) {
    for (let i = 0; i < lights.chunks.length; i++) {
      const ch = lights.chunks[i];
      ch.group.visible = (Math.hypot(ch.cx - px, ch.cz - pz) - ch.radius) < cullDist;
    }
  }
}
