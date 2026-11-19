// Toshkentning haqiqiy geografiyasiga (OpenStreetMap) asoslangan shahar rejasi:
// Shimol = -Z (Yunusobod / Teleminora), Janub = +Z (Chilonzor / Yakkasaroy),
// G'arb = -X (Eski shahar / Chorsu / Shayxontohur), Sharq = +X (Amir Temur xiyoboni / Yashnobod)
import { CITY } from '../config.js';
import { TASHKENT_DISTRICTS_OSM, OSM_ATTRIBUTION, districtAt, pointInPolygon } from './tashkentOsmData.js';

export { TASHKENT_DISTRICTS_OSM, OSM_ATTRIBUTION, districtAt, pointInPolygon };

const { N, BLOCK, ROAD, CELL, HALF } = CITY;

export const roadC = (i) => -HALF + ROAD / 2 + i * CELL;            // i = 0..N
export const blockC = (j) => -HALF + ROAD + BLOCK / 2 + j * CELL;     // j = 0..N-1
export const nearestRoad = (v) => Math.max(0, Math.min(N, Math.round((v + HALF - ROAD / 2) / CELL)));

// Haqiqiy Toshkent ko'chalari: G'arbdan-Sharqqa (Z o'zgarmas, X bo'ylab) — Shimoldan Janubga tartibda (0..20)
export const STREETS_X = [
  "Toshkent halqa yo'li (Shimol)",
  "Ahmad Donish ko'chasi",
  "Bog'ishamol ko'chasi",
  "Kichik halqa yo'li (Shimol)",
  "Osiyo ko'chasi",
  "Abdulla Qodiriy ko'chasi",
  "Zulfiyaxonim ko'chasi",
  "Alisher Navoiy shoh ko'chasi",
  "Islom Karimov shoh ko'chasi",
  "Mustaqillik shoh ko'chasi",
  "O'zbekiston ovozi ko'chasi",
  "Afrosiyob ko'chasi",
  "Oybek ko'chasi",
  "Bobur shoh ko'chasi",
  "Muqimiy ko'chasi",
  "Chilonzor ko'chasi",
  "Bunyodkor halqasi",
  "Gavhar ko'chasi",
  "Farg'ona yo'li (Janub)",
  "Kichik halqa yo'li (Janub)",
  "Toshkent halqa yo'li (Janub)",
];

// Shimoldan-Janubga (X o'zgarmas, Z bo'ylab) — G'arbdan Sharqqa tartibda (0..20)
export const STREETS_Z = [
  "Toshkent halqa yo'li (G'arb)",
  "Kichik halqa yo'li (G'arb)",
  "Beruniy shoh ko'chasi",
  "Qoratosh ko'chasi",
  "Bunyodkor shoh ko'chasi",
  "Furqat ko'chasi",
  "Sebzor / Labzak ko'chasi",
  "Sharof Rashidov shoh ko'chasi",
  "Amir Temur shoh ko'chasi",
  "Shahrisabz ko'chasi",
  "Shota Rustaveli ko'chasi",
  "Nukus ko'chasi",
  "Movarounnahr ko'chasi",
  "Mirzo Ulug'bek shoh ko'chasi",
  "Buyuk Ipak Yo'li",
  "Parkent ko'chasi",
  "Farg'ona yo'li",
  "Temur Malik ko'chasi",
  "Ohangaron shoh ko'chasi",
  "Kichik halqa yo'li (Sharq)",
  "Toshkent halqa yo'li (Sharq)",
];

// Magistral shoh ko'chalar indekslari (kengroq chiziqlar va ko'proq yoritish uchun)
export const MAIN_ROADS_X = new Set([2, 4, 6, 7, 8, 11, 12]);
export const MAIN_ROADS_Z = new Set([1, 3, 4, 6, 7, 8, 9, 10]);

// Haqiqiy Toshkent 6 tumani (OpenStreetMap ODbL chegaralari asosida)
export const DISTRICTS = TASHKENT_DISTRICTS_OSM.map((d) => ({
  id: d.id,
  name: d.name,
  uz: d.uz,
  color: d.color,
  cx: d.cx,
  cz: d.cz,
  j: Math.max(0, Math.min(N - 1, Math.round((d.cx + HALF - ROAD - BLOCK / 2) / CELL))),
  k: Math.max(0, Math.min(N - 1, Math.round((d.cz + HALF - ROAD - BLOCK / 2) / CELL))),
}));

export const CANAL_COL = 6; // Anhor kanali: Minor masjidi, Mustaqillik maydoni va Tashkent City orasidan oqib o'tadi

// Toshkentning diqqatga sazovor joylari — haqiqiy nisbiy geografik joylashuvda:
// - Teleminora va Yapon bog'i shimolda (Yunusobod, k=1..2)
// - Minor masjidi Anhor kanali bo'yida shimolroqda (j=7, k=4)
// - Chorsu bozori va Ko'kaldosh g'arbda — Eski shaharda (j=2, k=5)
// - Tashkent City (Nest One, Hilton, Congress Hall, Park) markazdan g'arbda (j=4..5, k=7..8)
// - Mustaqillik maydoni (Ezgulik arkasi, Senat) markazda, Anhor sharqida (j=7, k=7)
// - Amir Temur xiyoboni (Skver, Kurantlar, Uzbekistan mehmonxonasi) markazdan sharqda (j=9, k=7)
// - Magic City va Milliy bog' janubiy-g'arbda (j=4, k=10..11)
const SPECIAL = {
  '8,1':  { type: 'tvtower',   name: 'Toshkent Teleminorasi (375m)' },
  '9,2':  { type: 'park',      name: "Yapon bog'i (Yunusobod)" },
  '7,4':  { type: 'minor',     name: 'Minor masjidi (Oq masjid)' },
  '2,5':  { type: 'chorsu',    name: 'Chorsu bozori (Eski shahar)' },
  '4,7':  { type: 'citytower', name: 'Tashkent City · Nest One' },
  '5,7':  { type: 'citytower', name: 'Tashkent City · Hilton & Park' },
  '5,8':  { type: 'park',      name: 'Tashkent City Bog\'i' },
  '7,7':  { type: 'park',      name: 'Mustaqillik maydoni' },
  '9,7':  { type: 'square',    name: 'Amir Temur xiyoboni (Skver)' },
  '10,7': { type: 'uzhotel',   name: '"O\'zbekiston" mehmonxonasi' },
  '4,10': { type: 'magiccity', name: 'Magic City & Milliy bog\'' },
  '3,10': { type: 'park',      name: 'Alisher Navoiy Milliy bog\'i' },
  '8,7':  { type: 'kokobango', name: 'KOKOBANGO CLUB' },
  // Zapravkalar va Markaziy Avtosalon/Garaj
  '8,6':  { type: 'garage',    name: 'Markaziy Avtosalon va Tuning' },
  '11,3': { type: 'gas',       name: 'Zapravka — Yunusobod' },
  '1,4':  { type: 'gas',       name: 'Zapravka — Olmazor / Chorsu' },
  '3,12': { type: 'gas',       name: 'Zapravka — Chilonzor' },
  '10,11':{ type: 'gas',       name: 'Zapravka — Mirobod' },
  '7,9':  { type: 'gas',       name: 'Zapravka — Markaz' },
};

export function blockInfo(j, k) {
  if (j === CANAL_COL) return { type: 'canal', name: 'Anhor kanali' };
  return SPECIAL[`${j},${k}`] || { type: 'city' };
}

// Interaktiv nuqtalar (zapravka, garaj)
export const POIS = [];
for (const [key, v] of Object.entries(SPECIAL)) {
  if (v.type !== 'gas' && v.type !== 'garage') continue;
  const [j, k] = key.split(',').map(Number);
  POIS.push({ ...v, j, k, x: blockC(j), z: blockC(k) + BLOCK / 2 - 12, r: 17 });
}

export const LANDMARKS = Object.entries(SPECIAL)
  .filter(([, v]) => !['gas', 'garage', 'city'].includes(v.type))
  .map(([key, v]) => {
    const [j, k] = key.split(',').map(Number);
    return { ...v, j, k, x: blockC(j), z: blockC(k) };
  });

export const RACES = [
  { name: 'Amir Temur Sprinti', prize: 15_000_000, wps: [[8, 7], [8, 2]] },
  { name: 'Tashkent City Halqasi', prize: 25_000_000, wps: [[4, 7], [6, 9]] },
  { name: 'Kichik Halqa Tungi Drift', prize: 35_000_000, wps: [[2, 2], [12, 12]] },
  { name: 'Chorsu — Magic City Ekspress', prize: 20_000_000, wps: [[3, 5], [4, 10]] },
];

// O'yinchi Amir Temur shoh ko'chasi va Islom Karimov ko'chasi chorrahasi yaqinida, Markaziy Avtosalon oldida boshlaydi
export const SPAWN = { x: blockC(8) - 18, z: roadC(7), heading: Math.PI / 2 };

// ---- Kolliziyalar: AABB lar uchun fazoviy to'r ----
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

// Yo'l ustidami?
export function onRoad(x, z) {
  const fx = ((x + HALF) % CELL + CELL) % CELL, fz = ((z + HALF) % CELL + CELL) % CELL;
  return fx < ROAD || fz < ROAD;
}
export const inCity = (x, z) => Math.abs(x) < HALF && Math.abs(z) < HALF;
export { N, BLOCK, ROAD, CELL, HALF };
