// Toshkent 3D shahar geometriyasi: magistral va ichki yo'llar, trotuarlar, bordyurlar,
// turli balandlik va shakldagi binolar (ko'p qavatli uylar, ofislar, do'konlar, hovlilar),
// Anhor kanali va sektorlar bo'yicha bosqichma-bosqich ko'rinish (LOD / Frustum Culling)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { N, BLOCK, ROAD, CELL, HALF, roadC, blockC, blockInfo, addCollider, CANAL_COL, MAIN_ROADS_X, MAIN_ROADS_Z, onRoad } from './layout.js';
import { facadeTextures, asphaltPBR, tileTexture, grassTexture, waterBumpTexture } from './textures.js';
import { OSM_ROADS, OSM_WATERWAYS, OSM_LAKES, OSM_PARKS, OSM_BUILDINGS } from './tashkentRealGis.js';

export const nightMats = []; // { mat, base, day } — tunda yorug'ligi oshadigan materiallar
export const citySectors = []; // { group, detailGroup, cx, cz, radius } — masofa bo'yicha 2-bosqichli LOD
export let roadMat = null;

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

function buildingGeo(w, h, d, x, z, y0 = 0, rotY = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const faceDims = [[d, h], [d, h], null, null, [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v, fd = faceDims[f];
    if (!fd) uv.setXY(i, 0.995, 0.005);
    else uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(fd[0] / 3.2)) / 8, uv.getY(i) * Math.max(1, Math.round(fd[1] / 3.2)) / 16);
  }
  if (rotY) g.rotateY(rotY);
  g.translate(x, y0 + h / 2, z);
  return g;
}

// Haqiqiy OpenStreetMap (OSM) ko'pburchakli bino konturini (pts) 3D ga ekstrud qilish (kub EMAS — real L-shakl, burchakli, egri fasad!)
function extrudeOsmPolygonGeo(rawPts, h, y0 = 0, scale = 1.0, cx = 0, cz = 0) {
  if (!rawPts || rawPts.length < 3) return null;
  const pts = [];
  for (let i = 0; i < rawPts.length; i++) {
    const px = scale === 1.0 ? rawPts[i][0] : cx + (rawPts[i][0] - cx) * scale;
    const pz = scale === 1.0 ? rawPts[i][1] : cz + (rawPts[i][1] - cz) * scale;
    if (pts.length === 0 || Math.hypot(px - pts[pts.length - 1][0], pz - pts[pts.length - 1][1]) > 0.4) {
      pts.push([px, pz]);
    }
  }
  if (pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 0.4) {
    pts.pop();
  }
  if (pts.length < 3) return null;

  // Maydon ishorasini tekshirish (tashqi normal to'g'ri chiqishi uchun)
  let area2 = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    area2 += a[0] * b[1] - b[0] * a[1];
  }
  if (area2 < 0) pts.reverse();

  const positions = [];
  const normals = [];
  const uvs = [];
  const yBot = y0;
  const yTop = y0 + h;
  const vTop = Math.max(1, Math.round(h / 3.2)) / 16;

  let distAcc = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[(i + 1) % pts.length];
    const dx = x1 - x0;
    const dz = z1 - z0;
    const segLen = Math.hypot(dx, dz);
    if (segLen < 0.2) continue;
    const nx = dz / segLen;
    const nz = -dx / segLen;
    const u0 = Math.round(distAcc / 3.2) / 8;
    const u1 = u0 + Math.max(1, Math.round(segLen / 3.2)) / 8;
    distAcc += segLen;

    // 2 ta uchburchak (devor kvadrati)
    positions.push(
      x0, yBot, z0,  x1, yBot, z1,  x1, yTop, z1,
      x0, yBot, z0,  x1, yTop, z1,  x0, yTop, z0
    );
    for (let k = 0; k < 6; k++) normals.push(nx, 0, nz);
    uvs.push(
      u0, 0,    u1, 0,    u1, vTop,
      u0, 0,    u1, vTop, u0, vTop
    );
  }

  // Tom qopqog'i (Ear-clipping / ShapeUtils triangulyatsiyasi)
  const contour = pts.map(([px, pz]) => new THREE.Vector2(px, pz));
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  for (let t = 0; t < tris.length; t++) {
    const [i0, i1, i2] = tris[t];
    const p0 = pts[i0], p1 = pts[i1], p2 = pts[i2];
    positions.push(p0[0], yTop, p0[1], p2[0], yTop, p2[1], p1[0], yTop, p1[1]);
    normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    uvs.push(0.995, 0.005, 0.995, 0.005, 0.995, 0.005);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geom;
}

// 3D Egri OpenStreetMap yo'llari va kanallari uchun lenta (Ribbon) geometriyasi
function buildRibbonGeo(pts, width, y = 0.24) {
  if (!pts || pts.length < 2) return null;
  const hw = width * 0.5;
  const positions = [];
  const normals = [];
  const uvs = [];
  let dist = 0;

  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[i + 1];
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    if (len < 0.5) continue;
    const nx = -dz / len;
    const nz = dx / len;

    const axL = x0 + nx * hw, azL = z0 + nz * hw;
    const axR = x0 - nx * hw, azR = z0 - nz * hw;
    const bxL = x1 + nx * hw, bzL = z1 + nz * hw;
    const bxR = x1 - nx * hw, bzR = z1 - nz * hw;
    const v0 = dist / 10;
    const v1 = (dist + len) / 10;
    dist += len;

    positions.push(
      axL, y, azL,  axR, y, azR,  bxR, y, bzR,
      axL, y, azL,  bxR, y, bzR,  bxL, y, bzL
    );
    for (let k = 0; k < 6; k++) normals.push(0, 1, 0);
    uvs.push(
      0, v0,  width / 10, v0,  width / 10, v1,
      0, v0,  width / 10, v1,  0, v1
    );
  }
  if (!positions.length) return null;
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geom;
}

// Nuqtaning (x, z) haqiqiy OpenStreetMap yo'li yoki kanaliga yaqinligini tekshirish (yo'l ustiga bino tushmasligi uchun!)
function pointToSegDistSq(px, pz, x0, z0, x1, z1) {
  const dx = x1 - x0, dz = z1 - z0;
  const l2 = dx * dx + dz * dz;
  if (l2 < 1e-4) return (px - x0) * (px - x0) + (pz - z0) * (pz - z0);
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (pz - z0) * dz) / l2));
  const qx = x0 + t * dx, qz = z0 + t * dz;
  return (px - qx) * (px - qx) + (pz - qz) * (pz - qz);
}

export function isNearOsmRoad(px, pz, pad = 12) {
  for (let i = 0; i < OSM_ROADS.length; i++) {
    const rd = OSM_ROADS[i];
    const hw = (rd.type === 'trunk' || rd.type === 'primary' ? 11 : rd.type === 'secondary' ? 8 : 5.5) + pad;
    const hw2 = hw * hw;
    const pts = rd.pts;
    for (let p = 0; p < pts.length - 1; p++) {
      if (pointToSegDistSq(px, pz, pts[p][0], pts[p][1], pts[p + 1][0], pts[p + 1][1]) < hw2) {
        return true;
      }
    }
  }
  return false;
}

export function buildCity(scene, quality) {
  seed = 20260511; // har doim bir xil shahar generatsiyasi
  citySectors.length = 0;
  const group = new THREE.Group();
  scene.add(group);

  // Shahar asosiy zamini (yaxlit, 400 ta to'rtburchak quti va bordyur to'siqlarsiz!)
  const outer = new THREE.Mesh(
    new THREE.PlaneGeometry(10000, 10000),
    new THREE.MeshStandardMaterial({ color: 0x181e26, roughness: 0.94 })
  );
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.01;
  outer.receiveShadow = true;
  group.add(outer);

  // Yo'llar (tezkor PBR asfalt: map + ho'l dog'li roughnessMap)
  const asph = asphaltPBR();
  roadMat = new THREE.MeshStandardMaterial({
    map: asph.map,
    roughnessMap: asph.roughnessMap,
    roughness: 0.44,
    metalness: 0.28,
    envMapIntensity: 1.65,
  });
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
      roughness: s.style === 'glass' ? 0.16 : 0.82,
      metalness: s.style === 'glass' ? 0.78 : 0.18,
      envMapIntensity: s.style === 'glass' ? 2.0 : 1.05,
    });
    nightMats.push({ mat, base: s.style === 'glass' ? 0.92 : 0.82 });
    return mat;
  });

  const roofDetailMat = new THREE.MeshStandardMaterial({ color: 0x454b54, roughness: 0.72, metalness: 0.35 });
  const balconyMat = new THREE.MeshStandardMaterial({ color: 0x8e959e, roughness: 0.65, metalness: 0.25 });

  // Shaharni 2x2 kvartalli (10x10 bo'linish) yengil sektorlarga bo'lib yuklaymiz
  const SEC_DIV = 10;
  const secSize = Math.ceil(N / SEC_DIV);
  const sectorBins = new Map(); // "sx,sz" -> { bGeos: STYLES.map(()=>[]), shopGeos: [], roofGeos: [], balconyGeos: [], cx, cz }

  const getSector = (j, k) => {
    const sx = Math.floor(j / secSize), sz = Math.floor(k / secSize);
    const key = `${sx},${sz}`;
    if (!sectorBins.has(key)) {
      const j0 = sx * secSize, k0 = sz * secSize;
      const j1 = Math.min(N - 1, j0 + secSize - 1), k1 = Math.min(N - 1, k0 + secSize - 1);
      const cx = (blockC(j0) + blockC(j1)) / 2;
      const cz = (blockC(k0) + blockC(k1)) / 2;
      sectorBins.set(key, { bGeos: STYLES.map(() => []), shopGeos: [], roofGeos: [], balconyGeos: [], cx, cz });
    }
    return sectorBins.get(key);
  };

  function addRoofDetail(sec, x, z, w, h, d, isTower) {
    // Tom parapeti (korniz)
    sec.roofGeos.push(new THREE.BoxGeometry(w + 0.6, 0.55, d + 0.6).translate(x, h + 0.25, z));
    if (isTower && h > 45) {
      // Zamonaviy osmono'par tom texnik qavati va shpil
      sec.roofGeos.push(new THREE.BoxGeometry(w * 0.48, 3.2, d * 0.48).translate(x, h + 1.8, z));
      sec.roofGeos.push(new THREE.CylinderGeometry(0.14, 0.32, 9.5, 6).translate(x, h + 8.0, z));
    } else if (w > 10 && d > 10) {
      // Konditsioner va ventilyatsiya bloklari (HVAC)
      sec.roofGeos.push(new THREE.BoxGeometry(2.2, 1.1, 1.8).translate(x - w * 0.2, h + 0.85, z + d * 0.15));
      sec.roofGeos.push(new THREE.BoxGeometry(1.6, 0.9, 1.4).translate(x + w * 0.18, h + 0.75, z - d * 0.18));
    }
  }

  function addBalconies(sec, x, z, w, h, d) {
    if (h < 12) return;
    const floors = Math.min(8, Math.floor((h - 4) / 3.4));
    for (let fl = 1; fl <= floors; fl += 2) {
      const fy = fl * 3.4 + 1.2;
      sec.balconyGeos.push(new THREE.BoxGeometry(w * 0.55, 0.95, 1.15).translate(x, fy, z + d / 2 + 0.55));
      sec.balconyGeos.push(new THREE.BoxGeometry(w * 0.55, 0.95, 1.15).translate(x, fy, z - d / 2 - 0.55));
    }
  }

  // 1) 704 ta Haqiqiy OpenStreetMap (ODbL) Egri Yo'llari (66.7 km), 139 ta Kanal, 12 ta Ko'l va 33 ta Parkni 3D Sahnada Qurish!
  const osmRoadGeos = [];
  const osmLineGeos = [];
  for (let rIdx = 0; rIdx < OSM_ROADS.length; rIdx++) {
    const rd = OSM_ROADS[rIdx];
    const isMajor = rd.type === 'trunk' || rd.type === 'primary';
    const isSec = rd.type === 'secondary';
    const rWidth = isMajor ? 22 : isSec ? 15 : 10;
    const rg = buildRibbonGeo(rd.pts, rWidth, 0.026);
    if (rg) osmRoadGeos.push(rg);
    if (isMajor || isSec) {
      const lg = buildRibbonGeo(rd.pts, isMajor ? 0.45 : 0.28, 0.036);
      if (lg) osmLineGeos.push(lg);
    }
  }
  if (osmRoadGeos.length) {
    const osmRoadMesh = new THREE.Mesh(mergeGeometries(osmRoadGeos), roadMat);
    osmRoadMesh.receiveShadow = true;
    group.add(osmRoadMesh);
  }
  if (osmLineGeos.length) {
    const osmLineMesh = new THREE.Mesh(
      mergeGeometries(osmLineGeos),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    group.add(osmLineMesh);
  }

  // Haqiqiy OpenStreetMap 33 ta Park poligonlarini 3D maysazor sifatida qurish
  for (let pIdx = 0; pIdx < OSM_PARKS.length; pIdx++) {
    const pk = OSM_PARKS[pIdx];
    const pg = extrudeOsmPolygonGeo(pk.pts, 0.04, 0.012);
    if (pg) grassGeos.push(pg);
  }

  // Real OpenStreetMap (ODbL) 1793 ta Toshkent binolarini haqiqiy poligon konturlari (pts) bilan 3D sahnada qurish!
  const osmCountByBlock = new Map();
  for (let bIdx = 0; bIdx < OSM_BUILDINGS.length; bIdx++) {
    const ob = OSM_BUILDINGS[bIdx];
    const bj = Math.max(0, Math.min(N - 1, Math.round((ob.cx + HALF - ROAD - BLOCK / 2) / CELL)));
    const bk = Math.max(0, Math.min(N - 1, Math.round((ob.cz + HALF - ROAD - BLOCK / 2) / CELL)));
    const info = blockInfo(bj, bk);
    if (info.type !== 'city') continue;

    const w = Math.max(10, Math.min(140, ob.w || 22));
    const d = Math.max(10, Math.min(140, ob.d || 20));
    const rad = Math.min(w, d) * 0.32;
    // Asosiy shoh ko'chalar ustiga tushib qolmasligini tekshirish
    if (onRoad(ob.cx, ob.cz) || onRoad(ob.cx - rad, ob.cz - rad) || onRoad(ob.cx + rad, ob.cz + rad)) continue;

    const bKey = `${bj},${bk}`;
    const curCount = osmCountByBlock.get(bKey) || 0;
    osmCountByBlock.set(bKey, curCount + 1);

    const sec = getSector(bj, bk);
    const h = Math.max(10, Math.min(135, ob.h || (ob.lvl ? ob.lvl * 3.5 : 14 + ((bIdx * 7) % 5) * 4.5)));
    const kind = String(ob.kind || '').toLowerCase();
    const isGlass = /office|commercial|hotel|bank|civic|university/.test(kind) || h >= 36;
    const isPanel = /apartments|residential|dormitory/.test(kind);
    const isShop = /retail|supermarket|mall|marketplace|shop/.test(kind);
    const si = isGlass ? (bIdx % 2 === 0 ? 3 : 4) : isPanel ? 2 : isShop ? 5 : bIdx % 2;

    // 1. Binoning o'z poligon trotuar poydevori + haqiqiy OpenStreetMap ko'pburchakli (polygon) konturi
    const padGeo = extrudeOsmPolygonGeo(ob.pts, 0.18, 0.01, 1.12, ob.cx, ob.cz);
    if (padGeo) walkGeos.push(padGeo);

    const polyGeo = extrudeOsmPolygonGeo(ob.pts, h, 0.18);
    if (polyGeo) {
      sec.bGeos[si].push(polyGeo);
      const parapetGeo = extrudeOsmPolygonGeo(ob.pts, 0.75, h + 0.18, 1.02, ob.cx, ob.cz);
      if (parapetGeo) sec.roofGeos.push(parapetGeo);
      if (h >= 18) {
        const tierH = Math.min(6.5, h * 0.22);
        const upperTier = extrudeOsmPolygonGeo(ob.pts, tierH, h + 0.18, 0.72, ob.cx, ob.cz);
        if (upperTier) sec.bGeos[isGlass ? 3 : 1].push(upperTier);
        const upperRoof = extrudeOsmPolygonGeo(ob.pts, 0.55, h + tierH + 0.18, 0.75, ob.cx, ob.cz);
        if (upperRoof) sec.roofGeos.push(upperRoof);
      }
      if (isShop || (!isGlass && bIdx % 2 === 0)) {
        const plinth = extrudeOsmPolygonGeo(ob.pts, 3.4, 0.18, 1.03, ob.cx, ob.cz);
        if (plinth) sec.shopGeos.push(plinth);
      }
    } else {
      sec.bGeos[si].push(buildingGeo(w, h, d, ob.cx, ob.cz));
      addRoofDetail(sec, ob.cx, ob.cz, w, h, d, isGlass);
    }
    addCollider(ob.cx - w * 0.44, ob.cz - d * 0.44, ob.cx + w * 0.44, ob.cz + d * 0.44, 'building');
  }

  for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
    const bx = blockC(j), bz = blockC(k), info = blockInfo(j, k);
    if (info.type === 'canal') continue;

    if (info.type === 'park' || info.type === 'square' || info.type === 'minor' || info.type === 'magiccity') {
      const gg = new THREE.BoxGeometry(BLOCK - 14, 0.08, BLOCK - 14).translate(bx, 0.02, bz);
      scaleUV(gg, 10, 10);
      grassGeos.push(gg);
    }
    if (info.type !== 'city') continue;

    // Agar bu kvartalda haqiqiy OSM binolari mavjud bo'lsa, eski to'rtburchak kvartal binolarini umuman qo'shmaymiz!
    if ((osmCountByBlock.get(`${j},${k}`) || 0) >= 1) continue;

    const sec = getSector(j, k);
    const center = 1 - Math.min(1, Math.hypot(bx, bz) / (HALF * 0.85));

    // OSM qamrovidan tashqaridagi chekka kvartallarda: L-shakldagi va pog'onali Toshkent binolari (bino ostidagina trotuar bilan)
    const lots = 2;
    const lot = (BLOCK - 24) / lots;
    for (let a = 0; a < lots; a++) for (let b = 0; b < lots; b++) {
      const x = bx - BLOCK / 2 + 12 + lot * (a + 0.5);
      const z = bz - BLOCK / 2 + 12 + lot * (b + 0.5);
      if (isNearOsmRoad(x, z, 20)) continue;

      const isTower = sRnd() < 0.25 + center * 0.35;
      const si = isTower ? (sRnd() < 0.55 ? 3 : 4) : Math.floor(sRnd() * 3);
      const w = rnd(32, 48);
      const d = rnd(18, 28);
      const h = isTower ? rnd(36, 68 + center * 55) : rnd(18, 32);
      const wingW = rnd(16, 24);
      const wingD = rnd(24, 38);
      const rotY = ((j * 7 + k * 13 + a * 3 + b) % 5 === 0) ? ((a - b) * 0.22) : 0;

      const pad = new THREE.BoxGeometry(w + 10, 0.16, d + 10);
      if (rotY) pad.rotateY(rotY);
      pad.translate(x, 0.08, z);
      walkGeos.push(pad);

      const podH = 4.2;
      sec.bGeos[5].push(buildingGeo(w + 2.4, podH, d + 2.4, x, z, 0.16, rotY));
      sec.bGeos[si].push(buildingGeo(w, h - podH, d, x, z, podH + 0.16, rotY));
      const wxOff = x + (a === 0 ? w * 0.32 : -w * 0.32);
      const wzOff = z + (b === 0 ? d * 0.38 : -d * 0.38);
      const wingH = (h - podH) * 0.8;
      sec.bGeos[si].push(buildingGeo(wingW, wingH, wingD, wxOff, wzOff, podH + 0.16, rotY));

      const pentH = Math.max(4.5, h * 0.16);
      sec.bGeos[isTower ? 3 : 1].push(buildingGeo(w * 0.66, pentH, d * 0.66, x, z, h + 0.16, rotY));
      addRoofDetail(sec, x, z, w * 0.66, h + pentH, d * 0.66, isTower);
      if (!isTower && !rotY) addBalconies(sec, x, z, w * 0.62, h, d);

      addCollider(x - w * 0.48, z - d * 0.48, x + w * 0.48, z + d * 0.48, 'building');
    }
  }

  if (walkGeos.length) group.add(new THREE.Mesh(mergeGeometries(walkGeos), walkMat));
  if (curbGeos.length) group.add(new THREE.Mesh(mergeGeometries(curbGeos), curbMat));
  if (grassGeos.length) group.add(new THREE.Mesh(mergeGeometries(grassGeos), grassMat));

  // Har bir sektorni alohida guruh sifatida sahnaga qo'shamiz (2-bosqichli LOD + masofa optimizatsiyasi)
  const secHalfDiagonal = Math.hypot(secSize * CELL, secSize * CELL) / 2;
  for (const sec of sectorBins.values()) {
    const secGroup = new THREE.Group();
    const detailGroup = new THREE.Group();
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
      detailGroup.add(sm);
    }
    if (sec.roofGeos.length) {
      hasGeometry = true;
      const rm = new THREE.Mesh(mergeGeometries(sec.roofGeos), roofDetailMat);
      detailGroup.add(rm);
    }
    if (sec.balconyGeos.length) {
      hasGeometry = true;
      const bm = new THREE.Mesh(mergeGeometries(sec.balconyGeos), balconyMat);
      detailGroup.add(bm);
    }
    if (hasGeometry) {
      secGroup.add(detailGroup);
      group.add(secGroup);
      citySectors.push({ group: secGroup, detailGroup, cx: sec.cx, cz: sec.cz, radius: secHalfDiagonal });
    }
  }

  buildCanal(group);
  buildGtaNaturalSurroundings(group);

  // Shahar tashqi chegarasi (yumshoq chegara nazorati physics.js da ishlaydi, bu esa oxirgi himoya)
  const E = HALF + 35;
  addCollider(-E - 5, -E - 5, E + 5, -E, 'border');
  addCollider(-E - 5, E, E + 5, E + 5, 'border');
  addCollider(-E - 5, -E, -E, E, 'border');
  addCollider(E, -E, E + 5, E, 'border');
  return group;
}

// Uzoqdagi sektorlarni avtomatik yashirish (2-bosqichli LOD: yaqinda balkon/tom/vitrina, uzoqda asosiy bino)
export function updateCitySectors(px, pz, maxDist = 950) {
  const detailDist = Math.min(maxDist, 520);
  for (let i = 0; i < citySectors.length; i++) {
    const s = citySectors[i];
    const edgeDist = Math.hypot(s.cx - px, s.cz - pz) - s.radius;
    const vis = edgeDist < maxDist;
    s.group.visible = vis;
    if (vis && s.detailGroup) {
      s.detailGroup.visible = edgeDist < detailDist;
    }
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
  waterMat = new THREE.MeshStandardMaterial({
    color: 0x07344d,
    roughness: 0.07,
    metalness: 0.82,
    envMapIntensity: 2.1,
    emissive: 0x021826,
  });
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

  // Haqiqiy OpenStreetMap (ODbL) 12 ta Ko'l va 139 ta Kanal o'zanlarini 3D sahnada suv qatlami sifatida qurish
  const osmWaterGeos = [];
  for (let i = 0; i < OSM_LAKES.length; i++) {
    const lk = OSM_LAKES[i];
    const lg = extrudeOsmPolygonGeo(lk.pts, 0.04, 0.232);
    if (lg) osmWaterGeos.push(lg);
  }
  for (let i = 0; i < OSM_WATERWAYS.length; i++) {
    const ww = OSM_WATERWAYS[i];
    const wg = buildRibbonGeo(ww.pts, ww.type === 'river' ? 16 : 9, 0.231);
    if (wg) osmWaterGeos.push(wg);
  }
  if (osmWaterGeos.length) {
    group.add(new THREE.Mesh(mergeGeometries(osmWaterGeos), waterMat));
  }
}

// GTA 5 uslubidagi tabiiy Toshkent relefi: Chimyon/Tyan-Shan tog' tizmasi, Chirchiq daryosi va Toshkent dengizi qirg'og'i
function buildGtaNaturalSurroundings(group) {
  const mtnGeos = [];
  const snowGeos = [];
  const mtnMat = new THREE.MeshStandardMaterial({ color: 0x1e2836, roughness: 0.92, metalness: 0.08 });
  const snowMat = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    roughness: 0.55,
    metalness: 0.15,
    emissive: 0x1e3a8a,
    emissiveIntensity: 0.18,
  });

  // Shimol, Shimoliy-Sharq va Sharq ufqida Chimyon / Chorvoq tog' tizmalari (360 daraja tabiiy siluet)
  const peaks = [
    [-2200, -3100, 620, 420], [-1450, -3250, 780, 560], [-650, -3180, 710, 490],
    [150, -3300, 880, 640],   [980, -3220, 820, 590],   [1820, -3150, 940, 710],
    [2680, -2950, 1050, 790], [3220, -2150, 920, 680],  [3300, -1250, 860, 610],
    [3250, -350, 760, 520],   [3180, 520, 680, 440],    [-2950, -2400, 580, 360],
    [-3150, -1400, 520, 310], [-3100, 1600, 540, 320],
  ];
  for (let i = 0; i < peaks.length; i++) {
    const [px, pz, r, h] = peaks[i];
    const cone = new THREE.ConeGeometry(r, h, 7);
    cone.rotateY((i * 1.17) % Math.PI);
    cone.translate(px, h * 0.45 - 12, pz);
    mtnGeos.push(cone);

    if (h > 460) {
      const capH = h * 0.34;
      const capR = r * 0.36;
      const cap = new THREE.ConeGeometry(capR, capH, 7);
      cap.rotateY((i * 1.17) % Math.PI);
      cap.translate(px, h * 0.9 - capH * 0.48 - 12, pz);
      snowGeos.push(cap);
    }
  }
  if (mtnGeos.length) group.add(new THREE.Mesh(mergeGeometries(mtnGeos), mtnMat));
  if (snowGeos.length) group.add(new THREE.Mesh(mergeGeometries(snowGeos), snowMat));

  // Janub va Janubiy-Sharqda Chirchiq daryosi va Rohat / Toshkent Dengizi ko'rfazi
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(6800, 1800).rotateX(-Math.PI / 2), waterMat);
  sea.position.set(600, -0.015, HALF + 920);
  group.add(sea);
}
