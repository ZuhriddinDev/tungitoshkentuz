// ============================================================================
// TUNGI TOSHKENT V11 — CHUNK STREAMING SYSTEM (250m x 250m · 20x20 = 400 Chunks)
// ============================================================================
// Ushbu modul 5x5 km (25 km²) xaritani 250 x 250 metrli mustaqil hududlarga bo'lib,
// o'yinchi yaqinlashganda asinxron yuklaydi, uzoqlashganda LOD bilan soddalashtiradi
// va ortiqcha modellarni xotiradan tozalab, 60+ FPS barqarorlikni ta'minlaydi.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  WORLD_SIZE,
  WORLD_HALF,
  CHUNK_SIZE,
  CHUNK_MIN,
  CHUNK_MAX,
  getChunkCoord,
  getChunkCenter,
  getChunkKey,
  ROAD_SEGMENTS,
  ANHOR_PATH,
  DISTRICTS_V11,
} from './openWorld5k.js';
import { facadeTextures, asphaltTexture, tileTexture, grassTexture } from './textures.js';
import { addCollider } from './layout.js';

// Materiallar va teksturalar keshlanadi (har bir chunk qayta yuklamaydi)
let materialsInitialized = false;
let roadMat, walkMat, curbMat, grassMat, waterMat, shopWindowMat;
let styleMats = [];
export const nightMats = [];

// 6 xil Toshkent arxitektura uslubi
const ARCH_STYLES = [
  { base: '#c9baa7', frame: '#73614d', glass: '#24303c', style: 'grid',  rough: 0.85, metal: 0.12 }, // 0: Travertin / milliy g'isht
  { base: '#d8d7d3', frame: '#8c8b87', glass: '#1f2a36', style: 'grid',  rough: 0.82, metal: 0.15 }, // 1: Oq marmar / yangi uy
  { base: '#7c8691', frame: '#4f565e', glass: '#26303a', style: 'panel', rough: 0.88, metal: 0.10 }, // 2: 9 qavatli panel uy
  { base: '#2b5884', frame: '#1b3b5c', glass: '#5487c2', style: 'glass', rough: 0.20, metal: 0.72 }, // 3: Ko'k oyna osmono'par
  { base: '#22423c', frame: '#142925', glass: '#3d7066', style: 'glass', rough: 0.22, metal: 0.70 }, // 4: Zumrad biznes-markaz
  { base: '#a88c78', frame: '#5e4838', glass: '#2f2824', style: 'panel', rough: 0.86, metal: 0.14 }, // 5: Savdo markazi / kafe
];

function initMaterials() {
  if (materialsInitialized) return;
  materialsInitialized = true;

  const asph = asphaltTexture();
  roadMat = new THREE.MeshStandardMaterial({
    map: asph,
    roughness: 0.44,
    metalness: 0.24,
    envMapIntensity: 1.3,
  });

  walkMat = new THREE.MeshStandardMaterial({ map: tileTexture(), roughness: 0.9 });
  curbMat = new THREE.MeshStandardMaterial({ color: 0x94918a, roughness: 0.85 });
  grassMat = new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1.0 });

  waterMat = new THREE.MeshStandardMaterial({
    color: 0x0a354c,
    roughness: 0.08,
    metalness: 0.75,
    emissive: 0x021522,
  });
  nightMats.push({ mat: waterMat, base: 0.25, day: 0.1 });

  shopWindowMat = new THREE.MeshStandardMaterial({
    color: 0xfff0c8,
    emissive: 0xffd070,
    emissiveIntensity: 0.35,
    roughness: 0.3,
  });
  nightMats.push({ mat: shopWindowMat, base: 1.25, day: 0.2 });

  styleMats = ARCH_STYLES.map((s) => {
    const { map, emissiveMap, roughnessMap } = facadeTextures(s.base, s.frame, s.glass, s.style);
    const m = new THREE.MeshStandardMaterial({
      map,
      emissiveMap,
      roughnessMap,
      emissive: 0xffffff,
      emissiveIntensity: 0,
      roughness: s.rough,
      metalness: s.metal,
      envMapIntensity: s.style === 'glass' ? 1.6 : 0.9,
    });
    nightMats.push({ mat: m, base: 0.65 });
    return m;
  });
}

function scaleUV(g, su, sv) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
}

function buildingGeo(w, h, d, x, z, y0 = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const faceDims = [[d, h], [d, h], null, null, [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v, fd = faceDims[f];
      if (!fd) {
        uv.setXY(i, 0.995, 0.005);
      } else {
        uv.setXY(
          i,
          (uv.getX(i) * Math.max(1, Math.round(fd[0] / 3.4))) / 8,
          (uv.getY(i) * Math.max(1, Math.round(fd[1] / 3.4))) / 16
        );
      }
    }
  }
  g.translate(x, y0 + h / 2, z);
  return g;
}

// Psevdo-tasodifiy son (har bir chunk har safar 100% bir xil barqaror chiqadi)
function chunkHash(cx, cz, s = 1) {
  const n = Math.sin(cx * 137.3 + cz * 269.7 + s * 83.1) * 43758.5453;
  return n - Math.floor(n);
}

// Bitta Chunk klassi
export class CityChunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.key = getChunkKey(cx, cz);
    const center = getChunkCenter(cx, cz);
    this.x = center.x;
    this.z = center.z;

    this.group = new THREE.Group();
    this.group.name = `chunk_${this.key}`;
    this.group.visible = false;

    this.loaded = false;
    this.lastAccess = 0;
    this.distance = Infinity;
    this.isNearCanal = false;
    this.district = this.findDistrict();
  }

  findDistrict() {
    let closest = DISTRICTS_V11[0];
    let minD = Infinity;
    for (const d of DISTRICTS_V11) {
      const dist = Math.hypot(d.x - this.x, d.z - this.z);
      if (dist < minD) {
        minD = dist;
        closest = d;
      }
    }
    return closest;
  }

  build() {
    if (this.loaded) return;
    initMaterials();

    const minX = this.x - CHUNK_SIZE / 2;
    const maxX = this.x + CHUNK_SIZE / 2;
    const minZ = this.z - CHUNK_SIZE / 2;
    const maxZ = this.z + CHUNK_SIZE / 2;

    const bGeos = ARCH_STYLES.map(() => []);
    const shopGeos = [];
    const roadGeos = [];
    const walkGeos = [];
    const curbGeos = [];
    const grassGeos = [];

    // 1. Zamin bazasi (tuproq / asfalt asosi)
    const basePlate = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE)
      .rotateX(-Math.PI / 2)
      .translate(this.x, 0.01, this.z);
    scaleUV(basePlate, CHUNK_SIZE / 12, CHUNK_SIZE / 12);
    roadGeos.push(basePlate);

    // 2. Anhor kanali ushbu chunkdan o'tadimi?
    for (let i = 0; i < ANHOR_PATH.length - 1; i++) {
      const p1 = ANHOR_PATH[i], p2 = ANHOR_PATH[i + 1];
      const midX = (p1.x + p2.x) / 2, midZ = (p1.z + p2.z) / 2;
      if (Math.hypot(midX - this.x, midZ - this.z) < CHUNK_SIZE * 0.75) {
        this.isNearCanal = true;
        const canalWidth = 34;
        const waterMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(canalWidth, CHUNK_SIZE * 1.1).rotateX(-Math.PI / 2),
          waterMat
        );
        waterMesh.position.set(midX, -0.05, this.z);
        this.group.add(waterMesh);
        addCollider(midX - canalWidth / 2, minZ, midX + canalWidth / 2, maxZ, 'water');
        break;
      }
    }

    // 3. Ushbu chunkdagi magistral yo'llar
    for (const r of ROAD_SEGMENTS) {
      const inX = (r.x1 >= minX && r.x1 <= maxX) || (r.x2 >= minX && r.x2 <= maxX) || (minX >= Math.min(r.x1, r.x2) && maxX <= Math.max(r.x1, r.x2));
      const inZ = (r.z1 >= minZ && r.z1 <= maxZ) || (r.z2 >= minZ && r.z2 <= maxZ) || (minZ >= Math.min(r.z1, r.z2) && maxZ <= Math.max(r.z1, r.z2));

      if (inX && inZ) {
        // Yo'l geometriyasi
        const isXAxis = Math.abs(r.z1 - r.z2) < 20; // Sharq-G'arb
        const isZAxis = Math.abs(r.x1 - r.x2) < 20; // Shimol-Janub

        if (isXAxis) {
          const rz = (r.z1 + r.z2) / 2;
          const rg = new THREE.PlaneGeometry(CHUNK_SIZE, r.width).rotateX(-Math.PI / 2).translate(this.x, 0.025, rz);
          scaleUV(rg, CHUNK_SIZE / 10, r.width / 10);
          roadGeos.push(rg);
        } else if (isZAxis) {
          const rx = (r.x1 + r.x2) / 2;
          const rg = new THREE.PlaneGeometry(r.width, CHUNK_SIZE).rotateX(-Math.PI / 2).translate(rx, 0.026, this.z);
          scaleUV(rg, r.width / 10, CHUNK_SIZE / 10);
          roadGeos.push(rg);
        }
      }
    }

    // 4. Chunk ichidagi binolar va kvartallar (Kvartal to'ri: 2x2 = 4 ta kvartal)
    const SUB_SIZE = CHUNK_SIZE / 2; // 125 metr
    const ROAD_W = 20;
    const BLK_W = SUB_SIZE - ROAD_W; // 105 metr

    const distFromCenter = Math.hypot(this.x, this.z);
    const isTashkentCity = this.district.name === 'Tashkent City';
    const isCenter = distFromCenter < 1000;

    for (let sx = 0; sx < 2; sx++) {
      for (let sz = 0; sz < 2; sz++) {
        const bx = minX + sx * SUB_SIZE + SUB_SIZE / 2;
        const bz = minZ + sz * SUB_SIZE + SUB_SIZE / 2;

        if (this.isNearCanal && Math.abs(bx - this.x) < 40) continue;

        // Trotuar
        const tw = new THREE.BoxGeometry(BLK_W, 0.22, BLK_W).translate(bx, 0.11, bz);
        scaleUV(tw, BLK_W / 4, BLK_W / 4);
        walkGeos.push(tw);

        // Yashil maydon (ichki hovli)
        const gw = new THREE.BoxGeometry(BLK_W - 12, 0.26, BLK_W - 12).translate(bx, 0.13, bz);
        scaleUV(gw, 8, 8);
        grassGeos.push(gw);

        // Kvartal arxitekturasi va balandligi
        const hVal = chunkHash(this.cx * 2 + sx, this.cz * 2 + sz);

        if (isTashkentCity) {
          // Osmono'par minoralar (60m - 160m)
          const h = 60 + hVal * 100;
          const styleIdx = hVal < 0.5 ? 3 : 4; // Ko'k yoki zumrad oyna
          const bw = BLK_W - 28, bd = BLK_W - 28;
          bGeos[styleIdx].push(buildingGeo(bw, h, bd, bx, bz));
          addCollider(bx - bw / 2, bz - bd / 2, bx + bw / 2, bz + bd / 2, 'building');

          // 1-qavat zamonaviy shisha do'kon/restoran
          shopGeos.push(buildingGeo(bw + 2, 4.5, bd + 2, bx, bz));
        } else if (isCenter) {
          // Markaziy zamonaviy ofis va turar-joylar (24m - 55m)
          const h = 24 + hVal * 32;
          const styleIdx = Math.floor(hVal * 6) % 6;
          const bw = BLK_W - 22, bd = BLK_W - 22;
          bGeos[styleIdx].push(buildingGeo(bw, h, bd, bx, bz));
          addCollider(bx - bw / 2, bz - bd / 2, bx + bw / 2, bz + bd / 2, 'building');
          shopGeos.push(buildingGeo(bw + 1.5, 4.2, bd + 1.5, bx, bz));
        } else {
          // Toshkent mavzelari: 4 va 9 qavatli uylar yoki hovlili uylar
          if (hVal < 0.6) {
            // 9 qavatli panel / g'ishtli korpuslar
            const h = 18 + hVal * 22;
            const styleIdx = hVal < 0.3 ? 2 : 0;
            const w1 = BLK_W - 20, d1 = 16;
            bGeos[styleIdx].push(buildingGeo(w1, h, d1, bx, bz - 22));
            addCollider(bx - w1 / 2, bz - 22 - d1 / 2, bx + w1 / 2, bz - 22 + d1 / 2, 'building');

            const w2 = BLK_W - 20, d2 = 16;
            bGeos[styleIdx].push(buildingGeo(w2, h, d2, bx, bz + 22));
            addCollider(bx - w2 / 2, bz + 22 - d2 / 2, bx + w2 / 2, bz + 22 + d2 / 2, 'building');
          } else {
            // Savdo markazi, do'kon va servis
            const h = 12 + hVal * 14;
            const bw = BLK_W - 26, bd = BLK_W - 26;
            bGeos[5].push(buildingGeo(bw, h, bd, bx, bz));
            addCollider(bx - bw / 2, bz - bd / 2, bx + bw / 2, bz + bd / 2, 'building');
            shopGeos.push(buildingGeo(bw + 2, 4.2, bd + 2, bx, bz));
          }
        }
      }
    }

    // 5. Barcha geometriyani birlashtirib, draw calllarni minimal (2-4 tagacha) kamaytiramiz
    if (roadGeos.length) {
      const rm = new THREE.Mesh(mergeGeometries(roadGeos), roadMat);
      rm.receiveShadow = true;
      this.group.add(rm);
    }
    if (walkGeos.length) {
      const wm = new THREE.Mesh(mergeGeometries(walkGeos), walkMat);
      wm.receiveShadow = true;
      this.group.add(wm);
    }
    if (grassGeos.length) {
      const gm = new THREE.Mesh(mergeGeometries(grassGeos), grassMat);
      gm.receiveShadow = true;
      this.group.add(gm);
    }
    if (shopGeos.length) {
      const sm = new THREE.Mesh(mergeGeometries(shopGeos), shopWindowMat);
      this.group.add(sm);
    }

    bGeos.forEach((geos, idx) => {
      if (geos.length) {
        const bm = new THREE.Mesh(mergeGeometries(geos), styleMats[idx]);
        bm.castShadow = true;
        bm.receiveShadow = true;
        this.group.add(bm);
      }
    });

    this.loaded = true;
    this.lastAccess = Date.now();
  }

  dispose() {
    if (!this.loaded) return;
    this.group.traverse((obj) => {
      if (obj.isMesh) {
        if (obj.geometry) obj.geometry.dispose();
      }
    });
    // Farzandlarni tozalash
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
    this.loaded = false;
  }
}

// 400 ta Chunkni boshqaruvchi World Streamer
export class ChunkStreamer {
  constructor(scene) {
    this.scene = scene;
    this.chunks = new Map(); // key -> CityChunk
    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'OpenWorld_5x5km';
    this.scene.add(this.rootGroup);

    // Katta ufq foni (16x16 km — o'yin keskin uzilib qolmasligi uchun)
    this.buildHorizon();

    // 400 ta chunk instansiyasini tayyorlash
    for (let cx = CHUNK_MIN; cx <= CHUNK_MAX; cx++) {
      for (let cz = CHUNK_MIN; cz <= CHUNK_MAX; cz++) {
        const c = new CityChunk(cx, cz);
        this.chunks.set(c.key, c);
        this.rootGroup.add(c.group);
      }
    }
  }

  buildHorizon() {
    const horGeo = new THREE.PlaneGeometry(16000, 16000).rotateX(-Math.PI / 2);
    const horMat = new THREE.MeshStandardMaterial({
      color: 0x181c1c,
      roughness: 0.98,
      metalness: 0.05,
    });
    const horMesh = new THREE.Mesh(horGeo, horMat);
    horMesh.position.y = -0.15;
    horMesh.receiveShadow = true;
    this.rootGroup.add(horMesh);
  }

  update(playerX, playerZ, options = {}) {
    const now = Date.now();
    const activeRadius = options.activeRadius || 650;  // High detail radius (~2.5 chunks)
    const lodRadius = options.lodRadius || 1350;       // Mid detail radius (~5.4 chunks)
    const unloadRadius = 1650;                        // Uzoq chunklarni xotiradan tozalash

    let activeCount = 0;
    let loadedCount = 0;

    for (const chunk of this.chunks.values()) {
      const dist = Math.hypot(chunk.x - playerX, chunk.z - playerZ);
      chunk.distance = dist;

      if (dist < activeRadius) {
        // 1. Yaqin hudud: to'liq 3D modellar faol
        if (!chunk.loaded) chunk.build();
        chunk.group.visible = true;
        chunk.lastAccess = now;
        activeCount++;
        loadedCount++;
      } else if (dist < lodRadius) {
        // 2. O'rta masofa: ko'rinadi
        if (!chunk.loaded) chunk.build();
        chunk.group.visible = true;
        chunk.lastAccess = now;
        loadedCount++;
      } else {
        // 3. Uzoq masofa: yashiriladi
        chunk.group.visible = false;
        // 4. Juda uzoq va 30 soniyadan ortiq ishlatilmagan chunklarni xotiradan bo'shatish
        if (chunk.loaded && dist > unloadRadius && now - chunk.lastAccess > 25000) {
          chunk.dispose();
        }
      }
    }

    return { activeCount, loadedCount, total: this.chunks.size };
  }
}
