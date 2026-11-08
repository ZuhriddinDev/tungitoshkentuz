// Toshkentning haqiqiy geografiyasiga (OpenStreetMap) asoslangan 5x5 km shahar rejasi:
// Shimol = -Z (Yunusobod / Teleminora), Janub = +Z (Chilonzor / Yakkasaroy / Sergeli),
// G'arb = -X (Eski shahar / Chorsu / Shayxontohur), Sharq = +X (Amir Temur xiyoboni / Yashnobod)
import { CITY } from '../config.js';
import { REAL_LANDMARKS, DISTRICTS_V11, ROAD_SEGMENTS, WORLD_HALF } from './openWorld5k.js';

// V11: 5000 x 5000 metr (25 km²) to'liq shahar o'lchami
export const HALF = 2500;
export const N = 20;
export const BLOCK = 220;
export const ROAD = 30;
export const CELL = 250;

export const roadC = (i) => -HALF + ROAD / 2 + i * CELL;
export const blockC = (j) => -HALF + ROAD + BLOCK / 2 + j * CELL;
export const nearestRoad = (v) => Math.max(0, Math.min(N, Math.round((v + HALF - ROAD / 2) / CELL)));

// Haqiqiy Toshkent ko'chalari: G'arbdan-Sharqqa (Z o'zgarmas, X bo'ylab)
export const STREETS_X = [
  "Katta halqa yo'li (Shimol)",
  "Kichik halqa yo'li (Shimol)",
  "Osiyo ko'chasi (Yunusobod)",
  "Abdulla Qodiriy ko'chasi",
  "Zulfiyaxonim ko'chasi",
  "Alisher Navoiy shoh ko'chasi",
  "Mustaqillik shoh ko'chasi",
  "Islom Karimov shoh ko'chasi",
  "O'zbekiston ovozi ko'chasi",
  "Afrosiyob ko'chasi",
  "Oybek ko'chasi",
  "Bobur shoh ko'chasi",
  "Muqimiy ko'chasi",
  "Kichik halqa yo'li (Janub)",
  "Katta halqa yo'li (Janub)",
];

// Shimoldan-Janubga (X o'zgarmas, Z bo'ylab)
export const STREETS_Z = [
  "Katta halqa yo'li (G'arb)",
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
  "Farg'ona yo'li",
  "Ohangaron shoh ko'chasi",
  "Katta halqa yo'li (Sharq)",
];

export const MAIN_ROADS_X = new Set([1, 3, 5, 6, 7, 11, 12, 13]);
export const MAIN_ROADS_Z = new Set([1, 2, 4, 7, 8, 10, 11]);

export const DISTRICTS = DISTRICTS_V11.map((d, idx) => ({
  ...d,
  j: idx,
  k: idx,
}));

export const CANAL_COL = 8;

// OpenStreetMap asosidagi diqqatga sazovor joylar (Real Coordinates)
export const LANDMARKS = REAL_LANDMARKS.map((lm) => ({
  ...lm,
  j: Math.round((lm.x + HALF) / CELL),
  k: Math.round((lm.z + HALF) / CELL),
}));

// Zapravkalar va Markaziy Garajlar
export const POIS = [
  {
    type: 'garage',
    name: 'Markaziy Toshkent Avtosalon va Tuning',
    x: 480,
    z: 140,
    r: 22,
  },
  {
    type: 'gas',
    name: 'Zapravka — Amir Temur / Skver',
    x: 520,
    z: -320,
    r: 20,
  },
  {
    type: 'gas',
    name: 'Zapravka — Yunusobod / Teleminora',
    x: 420,
    z: -1750,
    r: 20,
  },
  {
    type: 'gas',
    name: 'Zapravka — Tashkent City',
    x: -950,
    z: 320,
    r: 20,
  },
  {
    type: 'gas',
    name: 'Zapravka — Chorsu / Eski shahar',
    x: -1520,
    z: -380,
    r: 20,
  },
  {
    type: 'gas',
    name: 'Zapravka — Chilonzor / Bunyodkor',
    x: -1150,
    z: 1550,
    r: 20,
  },
  {
    type: 'gas',
    name: 'Zapravka — Mirobod / Nukus',
    x: 750,
    z: 850,
    r: 20,
  },
  {
    type: 'gas',
    name: 'Zapravka — Kichik Halqa (Shimol)',
    x: -350,
    z: -1350,
    r: 20,
  },
  {
    type: 'gas',
    name: 'Zapravka — Kichik Halqa (Janub)',
    x: 350,
    z: 2150,
    r: 20,
  },
];

export function blockInfo(j, k) {
  const wx = blockC(j), wz = blockC(k);
  const nearLm = LANDMARKS.find((lm) => Math.hypot(lm.x - wx, lm.z - wz) < 180);
  if (nearLm) return { type: nearLm.type, name: nearLm.name };
  if (Math.abs(wx + 100) < 60) return { type: 'canal', name: 'Anhor kanali' };
  return { type: 'city' };
}

// 5x5 KM Real Poygalar
export const RACES = [
  { name: 'Tashkent City — Amir Temur Sprinti', prize: 35_000_000, wps: [[-610, 220], [440, -85]] },
  { name: 'Yunusobod — Teleminora Poygasi', prize: 45_000_000, wps: [[-80, -1080], [280, -1820]] },
  { name: 'Chorsu — Magic City Tungi Ekspress', prize: 50_000_000, wps: [[-1620, -480], [-730, 1240]] },
  { name: 'Kichik Halqa 5KM Katta Drift', prize: 75_000_000, wps: [[-1400, -1400], [1400, 2200]] },
];

// O'yinchi Amir Temur shoh ko'chasida, Markaziy Avtosalon oldida boshlaydi
export const SPAWN = { x: 440, z: 120, heading: -Math.PI / 2 };

// ---- Kolliziyalar: Fazoviy xeshlash (Spatial Hash Grid) ----
const GRID = 50;
const grid = new Map();
export const colliders = [];

export function addCollider(minX, minZ, maxX, maxZ, tag = 'wall') {
  const c = { minX, minZ, maxX, maxZ, tag };
  colliders.push(c);
  const gMinX = Math.floor(minX / GRID);
  const gMaxX = Math.floor(maxX / GRID);
  const gMinZ = Math.floor(minZ / GRID);
  const gMaxZ = Math.floor(maxZ / GRID);

  for (let gx = gMinX; gx <= gMaxX; gx++) {
    for (let gz = gMinZ; gz <= gMaxZ; gz++) {
      const key = `${gx},${gz}`;
      let arr = grid.get(key);
      if (!arr) {
        arr = [];
        grid.set(key, arr);
      }
      arr.push(c);
    }
  }
}

export function queryColliders(x, z, r) {
  const out = new Set();
  const gMinX = Math.floor((x - r) / GRID);
  const gMaxX = Math.floor((x + r) / GRID);
  const gMinZ = Math.floor((z - r) / GRID);
  const gMaxZ = Math.floor((z + r) / GRID);

  for (let gx = gMinX; gx <= gMaxX; gx++) {
    for (let gz = gMinZ; gz <= gMaxZ; gz++) {
      const key = `${gx},${gz}`;
      const arr = grid.get(key);
      if (arr) {
        for (let i = 0; i < arr.length; i++) out.add(arr[i]);
      }
    }
  }
  return out;
}

// Yo'l ustidami? (OpenStreetMap magistrallari yoki mahalliy ko'chalar)
export function onRoad(x, z) {
  for (let i = 0; i < ROAD_SEGMENTS.length; i++) {
    const s = ROAD_SEGMENTS[i];
    const hw = s.width / 2 + 1.5;
    const minX = Math.min(s.x1, s.x2) - hw;
    const maxX = Math.max(s.x1, s.x2) + hw;
    const minZ = Math.min(s.z1, s.z2) - hw;
    const maxZ = Math.max(s.z1, s.z2) + hw;
    if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) return true;
  }
  const modX = ((x % 125) + 125) % 125;
  const modZ = ((z % 125) + 125) % 125;
  return modX < 20 || modZ < 20;
}

export const inCity = (x, z) => Math.abs(x) < HALF && Math.abs(z) < HALF;

