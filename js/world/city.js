// Shahar geometriyasi: yer, yo'llar, trotuarlar, binolar, Anhor kanali va ko'priklar
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { N, BLOCK, ROAD, CELL, HALF, roadC, blockC, blockInfo, addCollider, CANAL_COL } from './layout.js';
import { facadeTextures, asphaltTexture, tileTexture, grassTexture } from './textures.js';

export const nightMats = []; // { mat, base } — tunda yorug'ligi oshadigan materiallar
const rnd = (a, b) => a + Math.random() * (b - a);

const STYLES = [
  { base: '#b5a584', frame: '#6e5c44', glass: '#2a3540', style: 'grid', w: 1 },   // och jigarrang g'isht
  { base: '#bdbab2', frame: '#7d7b76', glass: '#1f2a36', style: 'grid', w: 1 },   // oq beton
  { base: '#7d858c', frame: '#555c62', glass: '#28323c', style: 'panel', w: 1.3 }, // sovet panel uylari
  { base: '#3d6fa3', frame: '#2b4f75', glass: '#5c8fc4', style: 'glass', w: 0.7 }, // ko'k shisha
];

function buildingGeo(w, h, d, x, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const faceDims = [[d, h], [d, h], null, null, [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v, fd = faceDims[f];
    if (!fd) uv.setXY(i, 0.995, 0.005);
    else uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(fd[0] / 3)) / 8, uv.getY(i) * Math.max(1, Math.round(fd[1] / 3)) / 16);
  }
  g.translate(x, h / 2, z);
  return g;
}

export function buildCity(scene, quality) {
  const group = new THREE.Group(); scene.add(group);

  // Shahar tashqarisidagi yer
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshStandardMaterial({ color: 0x3b3a2e, roughness: 1 }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.05; outer.receiveShadow = true; group.add(outer);

  // Yo'llar
  const asph = asphaltTexture();
  const roadMat = new THREE.MeshStandardMaterial({ map: asph, roughness: 0.85, metalness: 0.05 });
  const roadGeos = [];
  for (let i = 0; i <= N; i++) {
    const a = new THREE.PlaneGeometry(HALF * 2, ROAD).rotateX(-Math.PI / 2).translate(0, 0.02, roadC(i));
    const b = new THREE.PlaneGeometry(ROAD, HALF * 2).rotateX(-Math.PI / 2).translate(roadC(i), 0.021, 0);
    scaleUV(a, HALF * 2 / 10, ROAD / 10); scaleUV(b, ROAD / 10, HALF * 2 / 10);
    roadGeos.push(a, b);
  }
  const roads = new THREE.Mesh(mergeGeometries(roadGeos), roadMat); roads.receiveShadow = true; group.add(roads);

  // Yo'l chiziqlari: markaziy punktir va piyodalar o'tish joylari
  const marks = [];
  for (let i = 0; i <= N; i++) for (let s = -HALF; s < HALF; s += 8) {
    const fz = ((s + HALF) % CELL + CELL) % CELL;
    if (fz < ROAD + 4 || fz > CELL - 3) continue;
    marks.push([s, roadC(i), 4, 0.25], [roadC(i), s, 0.25, 4]);
  }
  for (let i = 0; i <= N; i++) for (let k = 0; k <= N; k++) for (let q = -4; q <= 4; q++) {
    const cx = roadC(i), cz = roadC(k), o = q * 2;
    marks.push([cx + o, cz + ROAD / 2 + 2, 1, 3], [cx + o, cz - ROAD / 2 - 2, 1, 3], [cx + ROAD / 2 + 2, cz + o, 3, 1], [cx - ROAD / 2 - 2, cz + o, 3, 1]);
  }
  const markMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.6 }), marks.length);
  const m4 = new THREE.Matrix4();
  marks.forEach(([x, z, sx, sz], idx) => markMesh.setMatrixAt(idx, m4.makeScale(sx, 1, sz).setPosition(x, 0.035, z)));
  group.add(markMesh);

  // Kvartallar (trotuar) va binolar
  const walk = tileTexture(); const walkMat = new THREE.MeshStandardMaterial({ map: walk, roughness: 0.9 });
  const grass = grassTexture(); const grassMat = new THREE.MeshStandardMaterial({ map: grass, roughness: 1 });
  const walkGeos = [], grassGeos = [], bGeos = STYLES.map(() => []);
  const dense = quality === 'low' ? 0.6 : 1;

  for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
    const bx = blockC(j), bz = blockC(k), info = blockInfo(j, k);
    if (info.type === 'canal') continue;
    const wg = new THREE.BoxGeometry(BLOCK, 0.22, BLOCK).translate(bx, 0.11, bz); scaleUV(wg, BLOCK / 4, BLOCK / 4); walkGeos.push(wg);
    if (info.type === 'park' || info.type === 'square') {
      const gg = new THREE.BoxGeometry(BLOCK - 10, 0.3, BLOCK - 10).translate(bx, 0.15, bz); scaleUV(gg, 10, 10); grassGeos.push(gg);
    }
    if (info.type !== 'city') continue;
    const center = 1 - Math.min(1, Math.hypot(bx, bz) / HALF);
    const lots = Math.random() < 0.5 ? 2 : 3, lot = (BLOCK - 10) / lots;
    for (let a = 0; a < lots; a++) for (let b = 0; b < lots; b++) {
      if (Math.random() > 0.85 * dense + 0.1) continue;
      const si = Math.random() < 0.25 + center * 0.4 ? 3 : Math.floor(Math.random() * 3);
      const w = rnd(lot * 0.6, lot * 0.9) * STYLES[si].w ** 0.1, d = rnd(lot * 0.6, lot * 0.9);
      const h = si === 3 ? rnd(30, 60 + center * 90) : si === 2 ? rnd(15, 36) : rnd(9, 22 + center * 30);
      const x = bx - BLOCK / 2 + 5 + lot * (a + 0.5), z = bz - BLOCK / 2 + 5 + lot * (b + 0.5);
      bGeos[si].push(buildingGeo(w, h, d, x, z));
      addCollider(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 'building');
    }
  }
  group.add(new THREE.Mesh(mergeGeometries(walkGeos), walkMat));
  if (grassGeos.length) group.add(new THREE.Mesh(mergeGeometries(grassGeos), grassMat));

  STYLES.forEach((s, i) => {
    if (!bGeos[i].length) return;
    const { map, emissiveMap } = facadeTextures(s.base, s.frame, s.glass, s.style);
    const mat = new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 0, roughness: s.style === 'glass' ? 0.15 : 0.8, metalness: s.style === 'glass' ? 0.6 : 0.05 });
    nightMats.push({ mat, base: 0.5 });
    const mesh = new THREE.Mesh(mergeGeometries(bGeos[i]), mat);
    mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
  });

  buildCanal(group);

  // Shahar chegarasi
  const E = HALF + 25;
  addCollider(-E - 5, -E - 5, E + 5, -E); addCollider(-E - 5, E, E + 5, E + 5);
  addCollider(-E - 5, -E, -E, E); addCollider(E, -E, E + 5, E);
  return group;
}

function scaleUV(g, su, sv) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); }

// Anhor kanali: suv, parapetlar, qirg'oqdagi yashil maydonlar va ko'prik panjaralari
export let waterMat;
function buildCanal(group) {
  const cx = blockC(CANAL_COL), W = 30;
  waterMat = new THREE.MeshStandardMaterial({ color: 0x0b3a52, roughness: 0.08, metalness: 0.7, emissive: 0x02121c });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(W, HALF * 2), waterMat);
  water.rotation.x = -Math.PI / 2; water.position.set(cx, -0.02, 0); group.add(water);

  const bankMat = new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 });
  const stone = new THREE.MeshStandardMaterial({ color: 0xb8b2a4, roughness: 0.9 });
  const banks = [], walls = [], rails = [];
  for (let k = 0; k < N; k++) {
    const z = blockC(k);
    for (const s of [-1, 1]) {
      const bw = (BLOCK - W) / 2, bxp = cx + s * (W / 2 + bw / 2);
      const g = new THREE.BoxGeometry(bw, 0.3, BLOCK).translate(bxp, 0.15, z); scaleUV(g, 4, 10); banks.push(g);
      walls.push(new THREE.BoxGeometry(0.6, 0.9, BLOCK).translate(cx + s * (W / 2 + 0.3), 0.45, z));
    }
    addCollider(cx - W / 2 - 0.6, z - BLOCK / 2, cx + W / 2 + 0.6, z + BLOCK / 2, 'water');
  }
  for (let i = 0; i <= N; i++) for (const s of [-1, 1])
    rails.push(new THREE.BoxGeometry(W + 2, 1.1, 0.35).translate(cx, 0.55, roadC(i) + s * (ROAD / 2 - 0.2)));
  group.add(new THREE.Mesh(mergeGeometries(banks), bankMat));
  group.add(new THREE.Mesh(mergeGeometries([...walls, ...rails]), stone));
}

