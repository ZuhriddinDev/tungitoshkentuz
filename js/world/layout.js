// Shahar rejasi: yo'llar, kvartallar, diqqatga sazovor joylar va kolliziya to'ri
import { CITY } from '../config.js';

const { N, BLOCK, ROAD, CELL, HALF } = CITY;

export const roadC = (i) => -HALF + ROAD / 2 + i * CELL;            // i = 0..N
export const blockC = (j) => -HALF + ROAD + BLOCK / 2 + j * CELL;     // j = 0..N-1
export const nearestRoad = (v) => Math.max(0, Math.min(N, Math.round((v + HALF - ROAD / 2) / CELL)));

// X o'qi bo'ylab (gorizontal) va Z o'qi bo'ylab (vertikal) yo'llar nomlari
export const STREETS_X = ['Labzak ko\'chasi', 'Beruniy ko\'chasi', 'Furqat ko\'chasi', 'Nukus ko\'chasi', 'Shevchenko ko\'chasi', 'Afrosiyob ko\'chasi', 'Amir Temur shoh ko\'chasi', 'Navoiy ko\'chasi', 'Shahrisabz ko\'chasi', 'Mustaqillik shoh ko\'chasi', 'Bobur ko\'chasi', 'Rustaveli ko\'chasi', 'Islom Karimov ko\'chasi'];
export const STREETS_Z = ['Kichik halqa yo\'li', 'Olmazor ko\'chasi', 'Chilonzor ko\'chasi', 'Qatortol ko\'chasi', 'Bunyodkor shoh ko\'chasi', 'Farg\'ona yo\'li', 'Sharof Rashidov ko\'chasi', 'O\'zbekiston ovozi', 'Oybek ko\'chasi', 'Mirobod ko\'chasi', 'Yunusobod ko\'chasi', 'Bog\'ishamol ko\'chasi', 'Sebzor ko\'chasi'];

export const DISTRICTS = [
  { name: 'Chilonzor', j: 1, k: 9 }, { name: 'Olmazor', j: 1, k: 2 }, { name: 'Shayxontohur', j: 5, k: 2 },
  { name: 'Yunusobod', j: 9, k: 1 }, { name: 'Mirobod', j: 9, k: 9 }, { name: 'Yakkasaroy', j: 5, k: 10 },
];

export const CANAL_COL = 4; // Anhor kanali shu ustundagi kvartallar orqali oqadi

// Maxsus kvartallar: [j (x), k (z)] => tur
const SPECIAL = {
  '6,6': { type: 'square', name: 'Amir Temur xiyoboni' },
  '7,5': { type: 'citytower', name: 'Toshkent Siti' },
  '8,5': { type: 'citytower', name: 'Toshkent Siti' },
  '2,8': { type: 'tvtower', name: 'Toshkent teleminorasi' },
  '5,3': { type: 'chorsu', name: 'Chorsu bozori' },
  '6,7': { type: 'park', name: 'Mustaqillik maydoni' },
  '9,6': { type: 'park', name: 'Yapon bog\'i' },
  '3,10': { type: 'park', name: 'Milliy bog\'' },
  '10,3': { type: 'gas', name: 'Zapravka — Yunusobod' },
  '1,5': { type: 'gas', name: 'Zapravka — Olmazor' },
  '7,10': { type: 'gas', name: 'Zapravka — Mirobod' },
  '5,8': { type: 'gas', name: 'Zapravka — Markaz' },
  '6,5': { type: 'garage', name: 'Garaj va Avtosalon' },
};

export function blockInfo(j, k) {
  if (j === CANAL_COL) return { type: 'canal', name: 'Anhor kanali' };
  return SPECIAL[`${j},${k}`] || { type: 'city' };
}

// Interaktiv nuqtalar (zapravka, garaj) — kvartal oldidagi yo'l chetida
export const POIS = [];
for (const [key, v] of Object.entries(SPECIAL)) {
  if (v.type !== 'gas' && v.type !== 'garage') continue;
  const [j, k] = key.split(',').map(Number);
  // Kvartalning janubiy (z+) chetida, yo'l yoniga yaqin joyda
  POIS.push({ ...v, j, k, x: blockC(j), z: blockC(k) + BLOCK / 2 - 12, r: 16 });
}
export const LANDMARKS = Object.entries(SPECIAL).filter(([, v]) => !['gas', 'garage', 'city'].includes(v.type))
  .map(([key, v]) => { const [j, k] = key.split(',').map(Number); return { ...v, x: blockC(j), z: blockC(k) }; });

export const SPAWN = { x: blockC(6) - 20, z: roadC(6), heading: Math.PI / 2 }; // garaj oldida, Amir Temur ko'chasida

// ---- Kolliziyalar: AABB lar uchun oddiy fazoviy to'r ----
const GRID = 40;
const grid = new Map();
export const colliders = [];
export function addCollider(minX, minZ, maxX, maxZ, tag = 'wall') {
  const c = { minX, minZ, maxX, maxZ, tag };
  colliders.push(c);
  for (let gx = Math.floor(minX / GRID); gx <= Math.floor(maxX / GRID); gx++)
    for (let gz = Math.floor(minZ / GRID); gz <= Math.floor(maxZ / GRID); gz++) {
      const k = gx * 10007 + gz;
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(c);
    }
}
export function queryColliders(x, z, r) {
  const out = new Set();
  for (let gx = Math.floor((x - r) / GRID); gx <= Math.floor((x + r) / GRID); gx++)
    for (let gz = Math.floor((z - r) / GRID); gz <= Math.floor((z + r) / GRID); gz++) {
      const arr = grid.get(gx * 10007 + gz);
      if (arr) for (const c of arr) out.add(c);
    }
  return out;
}

// Yo'l ustidami? (svetofor, transport va xarita uchun)
export function onRoad(x, z) {
  const fx = ((x + HALF) % CELL + CELL) % CELL, fz = ((z + HALF) % CELL + CELL) % CELL;
  return fx < ROAD || fz < ROAD;
}
export const inCity = (x, z) => Math.abs(x) < HALF && Math.abs(z) < HALF;
export { N, BLOCK, ROAD, CELL, HALF };
