// Toshkent 3D shahar geometriyasi: magistral va ichki yo'llar, trotuarlar, bordyurlar,
// turli balandlik va shakldagi binolar (ko'p qavatli uylar, ofislar, do'konlar, hovlilar),
// Anhor kanali va sektorlar bo'yicha bosqichma-bosqich ko'rinish (LOD / Frustum Culling)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { N, BLOCK, ROAD, CELL, HALF, roadC, blockC, blockInfo, addCollider, CANAL_COL, MAIN_ROADS_X, MAIN_ROADS_Z } from './layout.js';
import { facadeTextures, asphaltTexture, tileTexture, grassTexture } from './textures.js';

export const nightMats = []; // { mat, base, day } — tunda yorug'ligi oshadigan materiallar
export const citySectors = []; // { group, cx, cz } — masofa bo'yicha LOD va frustum culling uchun

// Deterministik psevdo-tasodifiy generator (barcha 10 ta online o'yinchida shahar 100% bir xil chiqishi uchun!)
let seed = 20260511;
function sRnd() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
const rnd = (a, b) => a + sRnd() * (b - a);

// 6 xil me'moriy uslub (takrorlanmas rang va deraza tuzilishi)
const STYLES = [
  { base: '#b8a686', frame: '#6e5c44', glass: '#24303c', style: 'grid',  w: 1.0 }, // 0: Milliy travertin / g'isht
  { base: '#c2bfb8', frame: '#7d7b76', glass: '#1f2a36', style: 'grid',  w: 1.0 }, // 1: Oq marmar / zamonaviy turar-joy
  { base: '#7e8790', frame: '#535a60', glass: '#26303a', style: 'panel', w: 1.25 },// 2: Chilonzor / Yunusobod panel uylari
  { base: '#356291', frame: '#234264', glass: '#5282b8', style: 'glass', w: 0.75 },// 3: Zamonaviy ko'k oyna biznes-markaz
  { base: '#2c4c46', frame: '#1b332e', glass: '#43756b', style: 'glass', w: 0.8 }, // 4: Zumrad (Emerald) ofis minorasi
  { base: '#9e826c', frame: '#594435', glass: '#2d2622', style: 'panel', w: 1.1 }, // 5: Savdo markazi / do'kon va kafelar
];

function buildingGeo(w, h, d, x, z, y0 = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const faceDims = [[d, h], [d, h], null, null, [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v, fd = faceDims[f];
    if (!fd) uv.setXY(i, 0.995, 0.005);
    else uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(fd[0] / 3.2)) / 8, uv.getY(i) * Math.max(1, Math.round(fd[1] / 3.2)) / 16);
  }
  g.translate(x, y0 + h / 2, z);
  return g;
}

export function buildCity(scene, quality) {
  seed = 20260511; // har doim bir xil shahar generatsiyasi
  citySectors.length = 0;
  const group = new THREE.Group();
  scene.add(group);

  // Shahar tashqarisidagi yer
  const outer = new THREE.Mesh(
    new THREE.PlaneGeometry(10000, 10000),
    new THREE.MeshStandardMaterial({ color: 0x33352b, roughness: 1 })
  );
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.05;
  outer.receiveShadow = true;
  group.add(outer);

  // Yo'llar (tungi yomg'irdan keyingi yarim-yaltiroq asfalt reflekslari bilan)
  const asph = asphaltTexture();
  const roadMat = new THREE.MeshStandardMaterial({ map: asph, roughness: 0.46, metalness: 0.22, envMapIntensity: 1.35 });
  const roadGeos = [];
  for (let i = 0; i <= N; i++) {
    const a = new THREE.PlaneGeometry(HALF * 2, ROAD).rotateX(-Math.PI / 2).translate(0, 0.02, roadC(i));
    const b = new THREE.PlaneGeometry(ROAD, HALF * 2).rotateX(-Math.PI / 2).translate(roadC(i), 0.021, 0);
    scaleUV(a, (HALF * 2) / 10, ROAD / 10);
    scaleUV(b, ROAD / 10, (HALF * 2) / 10);
    roadGeos.push(a, b);
  }
  const roads = new THREE.Mesh(mergeGeometries(roadGeos), roadMat);
  roads.receiveShadow = true;
  group.add(roads);

  // Yo'l chiziqlari: magistral yo'llarda qo'sh chiziq + bo'lak punktirlari + piyodalar o'tish joylari (zebra)
  const marks = [];
  for (let i = 0; i <= N; i++) {
    const isMainX = MAIN_ROADS_X.has(i);
    const isMainZ = MAIN_ROADS_Z.has(i);
    for (let s = -HALF; s < HALF; s += 8) {
      const f = ((s + HALF) % CELL + CELL) % CELL;
      if (f < ROAD + 4 || f > CELL - 3) continue;
      // X bo'ylab yo'l (Z = roadC(i))
      marks.push([s, roadC(i), 4.2, isMainX ? 0.36 : 0.22]);
      if (isMainX) {
        marks.push([s, roadC(i) - 5.2, 2.6, 0.16], [s, roadC(i) + 5.2, 2.6, 0.16]);
      }
      // Z bo'ylab yo'l (X = roadC(i))
      marks.push([roadC(i), s, isMainZ ? 0.36 : 0.22, 4.2]);
      if (isMainZ) {
        marks.push([roadC(i) - 5.2, s, 0.16, 2.6], [roadC(i) + 5.2, s, 0.16, 2.6]);
      }
    }
  }
  for (let i = 0; i <= N; i++) for (let k = 0; k <= N; k++) for (let q = -4; q <= 4; q++) {
    const cx = roadC(i), cz = roadC(k), o = q * 2.1;
    marks.push(
      [cx + o, cz + ROAD / 2 + 2.2, 1.0, 3.2],
      [cx + o, cz - ROAD / 2 - 2.2, 1.0, 3.2],
      [cx + ROAD / 2 + 2.2, cz + o, 3.2, 1.0],
      [cx - ROAD / 2 - 2.2, cz + o, 3.2, 1.0]
    );
  }
  const markMesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xeaeaea }),
    marks.length
  );
  const m4 = new THREE.Matrix4();
  marks.forEach(([x, z, sx, sz], idx) =>
    markMesh.setMatrixAt(idx, m4.makeScale(sx, 1, sz).setPosition(x, 0.035, z))
  );
  markMesh.geometry.computeBoundingSphere();
  group.add(markMesh);

  // Trotuarlar, bordyurlar va yashil maydonlar
  const walk = tileTexture();
  const walkMat = new THREE.MeshStandardMaterial({ map: walk, roughness: 0.9 });
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x96938c, roughness: 0.85 });
  const grass = grassTexture();
  const grassMat = new THREE.MeshStandardMaterial({ map: grass, roughness: 1 });
  const shopWindowMat = new THREE.MeshStandardMaterial({
    color: 0xfff3d1,
    emissive: 0xffd280,
    emissiveIntensity: 0.25,
    roughness: 0.3,
  });
  nightMats.push({ mat: shopWindowMat, base: 1.15, day: 0.2 });

  const walkGeos = [], curbGeos = [], grassGeos = [];
  const styleMats = STYLES.map((s) => {
    const { map, emissiveMap, roughnessMap } = facadeTextures(s.base, s.frame, s.glass, s.style);
    const mat = new THREE.MeshStandardMaterial({
      map,
      emissiveMap,
      roughnessMap,
      emissive: 0xffffff,
      emissiveIntensity: 0,
      roughness: s.style === 'glass' ? 0.22 : 0.85,
      metalness: s.style === 'glass' ? 0.68 : 0.14,
      envMapIntensity: s.style === 'glass' ? 1.55 : 0.9,
    });
    nightMats.push({ mat, base: 0.62 });
    return mat;
  });

  // Shaharni 2x2 kvartalli (10x10 bo'linish) yengil sektorlarga bo'lib yuklaymiz
  const SEC_DIV = 10;
  const secSize = Math.ceil(N / SEC_DIV);
  const sectorBins = new Map(); // "sx,sz" -> { bGeos: STYLES.map(()=>[]), shopGeos: [], cx, cz }

  const getSector = (j, k) => {
    const sx = Math.floor(j / secSize), sz = Math.floor(k / secSize);
    const key = `${sx},${sz}`;
    if (!sectorBins.has(key)) {
      const j0 = sx * secSize, k0 = sz * secSize;
      const j1 = Math.min(N - 1, j0 + secSize - 1), k1 = Math.min(N - 1, k0 + secSize - 1);
      const cx = (blockC(j0) + blockC(j1)) / 2;
      const cz = (blockC(k0) + blockC(k1)) / 2;
      sectorBins.set(key, { bGeos: STYLES.map(() => []), shopGeos: [], cx, cz });
    }
    return sectorBins.get(key);
  };

  for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
    const bx = blockC(j), bz = blockC(k), info = blockInfo(j, k);
    if (info.type === 'canal') continue;

    // Trotuar va bordyur hoshiyasi
    const wg = new THREE.BoxGeometry(BLOCK, 0.22, BLOCK).translate(bx, 0.11, bz);
    scaleUV(wg, BLOCK / 4, BLOCK / 4);
    walkGeos.push(wg);
    curbGeos.push(
      new THREE.BoxGeometry(BLOCK + 0.5, 0.26, 0.45).translate(bx, 0.13, bz - BLOCK / 2),
      new THREE.BoxGeometry(BLOCK + 0.5, 0.26, 0.45).translate(bx, 0.13, bz + BLOCK / 2),
      new THREE.BoxGeometry(0.45, 0.26, BLOCK).translate(bx - BLOCK / 2, 0.13, bz),
      new THREE.BoxGeometry(0.45, 0.26, BLOCK).translate(bx + BLOCK / 2, 0.13, bz)
    );

    if (info.type === 'park' || info.type === 'square' || info.type === 'minor' || info.type === 'magiccity') {
      const gg = new THREE.BoxGeometry(BLOCK - 10, 0.3, BLOCK - 10).translate(bx, 0.15, bz);
      scaleUV(gg, 10, 10);
      grassGeos.push(gg);
    }
    if (info.type !== 'city') continue;

    const sec = getSector(j, k);
    const center = 1 - Math.min(1, Math.hypot(bx, bz) / (HALF * 0.85));

    // Kvartal ichida: hovlili ko'p qavatli mavze, biznes-markaz yoki savdo do'konlari
    const blockArchetype = sRnd();

    if (blockArchetype < 0.28 && center < 0.65) {
      // 1) Toshkent mahalla / ko'p qavatli hovli ("Dom" + yashil ichki hovli)
      const h1 = rnd(16, 30), h2 = rnd(16, 30);
      const si = sRnd() < 0.6 ? 2 : 0;
      // Shimoliy va janubiy uzun korpuslar
      const wLong = BLOCK - 22, dLong = 14;
      sec.bGeos[si].push(buildingGeo(wLong, h1, dLong, bx, bz - BLOCK / 2 + 14));
      addCollider(bx - wLong / 2, bz - BLOCK / 2 + 14 - dLong / 2, bx + wLong / 2, bz - BLOCK / 2 + 14 + dLong / 2, 'building');

      sec.bGeos[si].push(buildingGeo(wLong, h2, dLong, bx, bz + BLOCK / 2 - 14));
      addCollider(bx - wLong / 2, bz + BLOCK / 2 - 14 - dLong / 2, bx + wLong / 2, bz + BLOCK / 2 - 14 + dLong / 2, 'building');

      // Ichki yashil hovli maysazori
      const courtGrass = new THREE.BoxGeometry(BLOCK - 36, 0.28, BLOCK - 44).translate(bx, 0.14, bz);
      scaleUV(courtGrass, 5, 5);
      grassGeos.push(courtGrass);

      // Yon do'kon / dorixona / minimarket
      const sw = 12, sd = 24, sh = 5.5;
      sec.bGeos[5].push(buildingGeo(sw, sh, sd, bx - BLOCK / 2 + 13, bz));
      sec.shopGeos.push(new THREE.BoxGeometry(0.4, 2.8, sd - 3).translate(bx - BLOCK / 2 + 13 - sw / 2 - 0.1, 1.8, bz));
      addCollider(bx - BLOCK / 2 + 13 - sw / 2, bz - sd / 2, bx - BLOCK / 2 + 13 + sw / 2, bz + sd / 2, 'building');
    } else {
      // 2) Aralash shahar kvartali: ofislar, podiumli minoralar, do'konlar va uylar
      const lots = sRnd() < 0.48 ? 2 : 3;
      const lot = (BLOCK - 12) / lots;
      for (let a = 0; a < lots; a++) for (let b = 0; b < lots; b++) {
        if (sRnd() > 0.88) continue;
        const isTower = sRnd() < 0.22 + center * 0.42;
        const si = isTower ? (sRnd() < 0.55 ? 3 : 4) : Math.floor(sRnd() * 3);
        const w = rnd(lot * 0.58, lot * 0.86) * STYLES[si].w ** 0.1;
        const d = rnd(lot * 0.58, lot * 0.86);
        const h = isTower
          ? rnd(34, 65 + center * 85)
          : si === 2
          ? rnd(16, 34)
          : rnd(9, 22 + center * 26);
        const x = bx - BLOCK / 2 + 6 + lot * (a + 0.5);
        const z = bz - BLOCK / 2 + 6 + lot * (b + 0.5);

        if (isTower && h > 48 && sRnd() < 0.65) {
          // Pog'onali zamonaviy osmono'par bino (podium + minora)
          const podH = rnd(8, 13);
          sec.bGeos[1].push(buildingGeo(w * 1.15, podH, d * 1.15, x, z));
          sec.bGeos[si].push(buildingGeo(w * 0.78, h - podH, d * 0.78, x, z, podH));
          addCollider(x - (w * 1.15) / 2, z - (d * 1.15) / 2, x + (w * 1.15) / 2, z + (d * 1.15) / 2, 'building');
        } else {
          sec.bGeos[si].push(buildingGeo(w, h, d, x, z));
          addCollider(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 'building');
        }

        // Birinchi qavatda yorug' do'kon vitrinasi (ko'cha yuzida)
        if (!isTower && sRnd() < 0.45) {
          sec.shopGeos.push(new THREE.BoxGeometry(w * 0.75, 2.6, d + 0.3).translate(x, 1.6, z));
        }
      }
    }
  }

  group.add(new THREE.Mesh(mergeGeometries(walkGeos), walkMat));
  group.add(new THREE.Mesh(mergeGeometries(curbGeos), curbMat));
  if (grassGeos.length) group.add(new THREE.Mesh(mergeGeometries(grassGeos), grassMat));

  // Har bir sektorni alohida guruh sifatida sahnaga qo'shamiz (Frustum Culling + masofa optimizatsiyasi)
  const secHalfDiagonal = Math.hypot(secSize * CELL, secSize * CELL) / 2;
  for (const sec of sectorBins.values()) {
    const secGroup = new THREE.Group();
    let hasGeometry = false;
    sec.bGeos.forEach((geos, idx) => {
      if (!geos.length) return;
      hasGeometry = true;
      const merged = mergeGeometries(geos);
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, styleMats[idx]);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      secGroup.add(mesh);
    });
    if (sec.shopGeos.length) {
      hasGeometry = true;
      const sm = new THREE.Mesh(mergeGeometries(sec.shopGeos), shopWindowMat);
      secGroup.add(sm);
    }
    if (hasGeometry) {
      group.add(secGroup);
      citySectors.push({ group: secGroup, cx: sec.cx, cz: sec.cz, radius: secHalfDiagonal });
    }
  }

  buildCanal(group);

  // Shahar tashqi chegarasi (yumshoq chegara nazorati physics.js da ishlaydi, bu esa oxirgi himoya)
  const E = HALF + 35;
  addCollider(-E - 5, -E - 5, E + 5, -E, 'border');
  addCollider(-E - 5, E, E + 5, E + 5, 'border');
  addCollider(-E - 5, -E, -E, E, 'border');
  addCollider(E, -E, E + 5, E, 'border');
  return group;
}

// Uzoqdagi sektorlarni avtomatik yashirish (radiusi hisobga olingan holda hech qachon binolar ko'rinmay qolmaydi)
export function updateCitySectors(px, pz, maxDist = 950) {
  for (let i = 0; i < citySectors.length; i++) {
    const s = citySectors[i];
    const d = Math.hypot(s.cx - px, s.cz - pz);
    s.group.visible = (d - s.radius) < maxDist;
  }
}

function scaleUV(g, su, sv) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
}

// Anhor kanali: suv, granit qirg'oqlar, yashil sayilgoh va ko'prik panjaralari
export let waterMat;
function buildCanal(group) {
  const cx = blockC(CANAL_COL), W = 32;
  waterMat = new THREE.MeshStandardMaterial({ color: 0x0b3a52, roughness: 0.08, metalness: 0.7, emissive: 0x02121c });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(W, HALF * 2), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(cx, -0.02, 0);
  group.add(water);

  const bankMat = new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 });
  const stone = new THREE.MeshStandardMaterial({ color: 0xb8b2a4, roughness: 0.9 });
  const banks = [], walls = [], rails = [];
  for (let k = 0; k < N; k++) {
    const z = blockC(k);
    for (const s of [-1, 1]) {
      const bw = (BLOCK - W) / 2, bxp = cx + s * (W / 2 + bw / 2);
      const g = new THREE.BoxGeometry(bw, 0.3, BLOCK).translate(bxp, 0.15, z);
      scaleUV(g, 4, 10);
      banks.push(g);
      walls.push(new THREE.BoxGeometry(0.65, 0.95, BLOCK).translate(cx + s * (W / 2 + 0.32), 0.45, z));
    }
    addCollider(cx - W / 2 - 0.6, z - BLOCK / 2, cx + W / 2 + 0.6, z + BLOCK / 2, 'water');
  }
  for (let i = 0; i <= N; i++)
    for (const s of [-1, 1])
      rails.push(new THREE.BoxGeometry(W + 4, 1.15, 0.4).translate(cx, 0.58, roadC(i) + s * (ROAD / 2 - 0.2)));
  group.add(new THREE.Mesh(mergeGeometries(banks), bankMat));
  group.add(new THREE.Mesh(mergeGeometries([...walls, ...rails]), stone));
}
