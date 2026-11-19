// TUNGI TOSHKENT — OpenStreetMap & GTA Online uslubidagi Professional GPS Xarita Tizimi
// HUD Minimap va Katta Interaktiv Xarita (Zoom, Pan, Kategoriya filtri, GPS marshrut va POI tanlash)
import { N, BLOCK, ROAD, HALF, roadC, blockC, blockInfo, nearestRoad, POIS, LANDMARKS, DISTRICTS, TASHKENT_DISTRICTS_OSM, OSM_ATTRIBUTION, districtAt, STREETS_X, STREETS_Z, RACES } from './world/layout.js';
import { OSM_ROADS, OSM_WATERWAYS, OSM_LAKES, OSM_PARKS, OSM_BUILDINGS, TASHKENT_GIS_META, worldToLatLon } from './world/tashkentRealGis.js';

export { TASHKENT_DISTRICTS_OSM, districtAt, TASHKENT_GIS_META, worldToLatLon };

export function nearestOsmRoadName(wx, wz) {
  let bestName = '';
  let bestD2 = 160 * 160;
  for (let i = 0; i < OSM_ROADS.length; i++) {
    const r = OSM_ROADS[i];
    if (!r.name) continue;
    const pts = r.pts;
    for (let p = 0; p < pts.length; p++) {
      const dx = pts[p][0] - wx;
      const dz = pts[p][1] - wz;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        bestName = r.name;
      }
    }
  }
  return bestName;
}

const IS_MOB = typeof navigator !== 'undefined' && (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900));
const BASE_SIZE = IS_MOB ? 1024 : 1280;
let baseCanvas = null;

// Katta xarita holati (Zoom, Pan, Filter, Tanlangan obyekt)
export const mapState = {
  zoom: 1.0,
  panX: 0, // dunyo koordinatasida markaz siljishi
  panZ: 0,
  filter: 'all', // 'all' | 'gas' | 'garage' | 'service' | 'race' | 'job' | 'park' | 'landmark'
  selectedPoi: null,
  selectedDistrict: null,
};

export function selectDistrictAt(wx, wz) {
  const d = districtAt(wx, wz);
  mapState.selectedDistrict = d ? d.id : null;
  return d;
}

export function selectDistrictById(id) {
  const d = TASHKENT_DISTRICTS_OSM.find((x) => x.id === id) || null;
  mapState.selectedDistrict = d ? d.id : null;
  if (d) {
    mapState.panX = d.cx;
    mapState.panZ = d.cz;
    mapState.zoom = Math.max(1.35, mapState.zoom || 1.0);
  }
  return d;
}

export const MAP_CATEGORIES = [
  { id: 'all', label: 'Barchasi', icon: '🗺️' },
  { id: 'gas', label: 'Zapravkalar', icon: '⛽' },
  { id: 'garage', label: 'Garajlar', icon: '🚘' },
  { id: 'service', label: 'Servislar', icon: '🔧' },
  { id: 'race', label: 'Poygalar', icon: '🏁' },
  { id: 'job', label: 'Ishlar', icon: '📦' },
  { id: 'park', label: 'Parklar', icon: '🌳' },
  { id: 'landmark', label: 'Muhim joylar', icon: '⭐' },
];

// Barcha xarita nuqtalarini yagona ro'yxat sifatida olish
export function getAllMapPOIs() {
  const items = [];

  // 1. Zapravka va Garajlar (POIS)
  for (const p of POIS) {
    if (p.type === 'gas') {
      items.push({
        id: `gas_${p.x}_${p.z}`,
        category: 'gas',
        icon: '⛽',
        color: '#00e676',
        title: p.name || 'UZ-OIL Zapravka',
        sub: 'AI-80 · AI-92 · AI-95 · AI-100 yoqilg\'i quyish shoxobchasi',
        x: p.x,
        z: p.z,
        priority: 3,
      });
    } else {
      items.push({
        id: `gar_${p.x}_${p.z}`,
        category: 'garage',
        icon: '🚘',
        color: '#ffd740',
        title: p.name || 'Avtosalon & Garaj',
        sub: 'Mashina sotib olish, sotish va shaxsiy garaj',
        x: p.x,
        z: p.z,
        priority: 3,
      });
      // Har bir garaj yonida Avtoservis / Tyuning ustaxonasi
      items.push({
        id: `srv_${p.x}_${p.z}`,
        category: 'service',
        icon: '🔧',
        color: '#38bdf8',
        title: (p.name || 'Toshkent') + ' Avtoservis',
        sub: 'Kuzov ta\'mirlash, Dvigatel Stage 1-3, Diskalar, Spoyler va Neon',
        x: p.x + 22,
        z: p.z - 18,
        priority: 2,
      });
    }
  }

  // 2. Poyga nuqtalari (RACES)
  for (let i = 0; i < RACES.length; i++) {
    const r = RACES[i];
    const [jx, kz] = r.wps[0];
    const rx = roadC(jx);
    const rz = roadC(kz);
    items.push({
      id: `race_${i}`,
      category: 'race',
      icon: '🏁',
      color: '#ff4081',
      title: `Poyga: ${r.name}`,
      sub: `Mukofot: ${(r.prize / 1_000_000).toFixed(0)} mln so'm · Start nuqtasi`,
      x: rx,
      z: rz,
      priority: 2,
    });
  }

  // 3. Ish joylari (Taksi va Kuryer markazlari)
  const jobCenters = [
    { name: 'Chorsu Kuryer Markazi', sub: 'Tezkor yetkazib berish xizmati', j: 2, k: 3 },
    { name: 'Tashkent City VIP Taksi', sub: 'Biznes-klass yo\'lovchi tashish', j: 4, k: 7 },
    { name: 'Amir Temur Taksi Parki', sub: 'Shahar markazi taksi buyurtmalari', j: 8, k: 7 },
    { name: 'Chilonzor Logistika Xabi', sub: 'Shahar bo\'ylab kuryerlik xizmati', j: 3, k: 11 },
  ];
  for (const jb of jobCenters) {
    items.push({
      id: `job_${jb.j}_${jb.k}`,
      category: 'job',
      icon: '📦',
      color: '#fb923c',
      title: jb.name,
      sub: jb.sub,
      x: blockC(jb.j) + 28,
      z: blockC(jb.k) + 28,
      priority: 1,
    });
  }

  // 4. Muhim joylar va Parklar (LANDMARKS)
  for (const l of LANDMARKS) {
    const isPark = l.type === 'park' || l.type === 'magiccity';
    const isClub = l.type === 'kokobango';
    items.push({
      id: `lm_${l.x}_${l.z}`,
      category: isPark ? 'park' : 'landmark',
      icon: isClub ? '🎧' : isPark ? '🌳' : '⭐',
      color: isClub ? '#e879f9' : isPark ? '#4ade80' : '#a78bfa',
      title: isClub ? 'KOKOBANGO' : l.name,
      sub: isClub ? '🎧 Tungi Klub & VIP Lounge · [X] bilan kirish (PC)' : isPark ? 'Dam olish maskani va yashil bog\' hududi' : 'Toshkentning diqqatga sazovor markaziy maskani',
      x: l.x,
      z: l.z,
      priority: isClub ? 5 : 3,
      isClub,
    });
  }

  return items;
}

export function findNearestPOI(px, pz, category = 'gas') {
  const all = getAllMapPOIs().filter((item) => item.category === category);
  let best = null;
  let bestD = Infinity;
  for (const item of all) {
    const d = Math.hypot(item.x - px, item.z - pz);
    if (d < bestD) {
      bestD = d;
      best = item;
    }
  }
  return best;
}

export function findMapItemAt(wx, wz, maxRadius = 46) {
  const all = getAllMapPOIs();
  let best = null;
  let bestD = maxRadius;
  for (const item of all) {
    if (mapState.filter !== 'all' && item.category !== mapState.filter) continue;
    const d = Math.hypot(item.x - wx, item.z - wz);
    if (d < bestD) {
      bestD = d;
      best = item;
    }
  }
  return best;
}

// Deterministik psevdo-tasodifiy son (binolar xaritada bir xil chiroyli turishi uchun)
function hash2(j, k, s = 1) {
  const n = Math.sin(j * 127.1 + k * 311.7 + s * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

// ============================================================================
// GTA 5 (LOS SANTOS / TASHKENT SATELLITE & TOPOGRAPHIC) USLUBIDAGI XARITA QATLAMI
// ============================================================================
function drawBase() {
  const S = BASE_SIZE;
  const k = S / (HALF * 2);
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');

  // 1. Tashqi tabiiy fon: Janubda Chirchiq daryosi / Toshkent dengizi, Shimolda Chimyon tog' relefi
  const bgGrad = g.createLinearGradient(0, 0, S, S);
  bgGrad.addColorStop(0, '#0c1922');
  bgGrad.addColorStop(0.55, '#0e1726');
  bgGrad.addColorStop(1, '#062034');
  g.fillStyle = bgGrad;
  g.fillRect(0, 0, S, S);

  // Shimoliy-Sharq va G'arbda GTA 5 uslubidagi tog' va tepalik topografik kontur chiziqlari
  g.save();
  const topoCenters = [
    [S * 0.88, S * 0.10, S * 0.34, S * 0.22, -0.35],
    [S * 0.56, S * 0.04, S * 0.38, S * 0.16, 0.12],
    [S * 0.14, S * 0.08, S * 0.28, S * 0.18, 0.28],
    [S * 0.94, S * 0.42, S * 0.22, S * 0.30, -0.45],
  ];
  for (const [cx, cy, rx, ry, rot] of topoCenters) {
    for (let ring = 6; ring >= 1; ring--) {
      const f = ring / 6;
      g.fillStyle = ring % 2 === 0 ? 'rgba(22, 46, 38, 0.28)' : 'rgba(18, 38, 34, 0.24)';
      g.strokeStyle = 'rgba(74, 222, 128, 0.11)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.ellipse(cx, cy, rx * f, ry * f, rot, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  }

  // Janub va Janubiy-Sharqda Chirchiq Daryosi vodiysi va Toshkent Dengizi (Rohat) qirg'oq chizig'i
  g.fillStyle = '#072b45';
  g.strokeStyle = 'rgba(56, 189, 248, 0.38)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, S * 0.90);
  g.bezierCurveTo(S * 0.22, S * 0.87, S * 0.44, S * 0.95, S * 0.68, S * 0.91);
  g.bezierCurveTo(S * 0.84, S * 0.88, S * 0.92, S * 0.74, S, S * 0.66);
  g.lineTo(S, S);
  g.lineTo(0, S);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();

  // 2. Toshkent 6 tumanining organik poligonlari (4 burchakli quti EMAS — haqiqiy OSM geografik shakli!)
  g.save();
  for (const d of TASHKENT_DISTRICTS_OSM) {
    if (!d.polygon || d.polygon.length < 3) continue;
    g.beginPath();
    d.polygon.forEach(([wx, wz], idx) => {
      const px = (wx + HALF) * k;
      const py = (wz + HALF) * k;
      if (idx === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    });
    g.closePath();
    g.fillStyle = '#151f2e';
    g.fill();
  }
  g.restore();

  // 3. Organik parklar, diqqatga sazovor maskanlar va bino siluetlari (HECH QANDAY 4-BURCHAKLI KVARTAL RAMKASI YO'Q!)
  // 3A. Haqiqiy OpenStreetMap (ODbL) Park Poligonlari (30 ta haqiqiy bog')
  g.save();
  for (const pk of OSM_PARKS) {
    if (!pk.pts || pk.pts.length < 3) continue;
    g.beginPath();
    pk.pts.forEach(([wx, wz], idx) => {
      const px = (wx + HALF) * k;
      const py = (wz + HALF) * k;
      if (idx === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    });
    g.closePath();
    g.fillStyle = 'rgba(19, 62, 42, 0.72)';
    g.strokeStyle = 'rgba(74, 222, 128, 0.25)';
    g.lineWidth = 1.2;
    g.fill();
    g.stroke();
  }
  g.restore();

  for (let j = 0; j < N; j++) {
    for (let kk = 0; kk < N; kk++) {
      const info = blockInfo(j, kk);
      const bx = (blockC(j) - BLOCK / 2 + HALF) * k;
      const by = (blockC(kk) - BLOCK / 2 + HALF) * k;
      const bw = BLOCK * k;
      const isEdge = j === 0 || j === N - 1 || kk === 0 || kk === N - 1;

      if (info.type === 'park' || info.type === 'magiccity' || info.type === 'square' || info.type === 'minor') {
        // GTA 5 uslubidagi egri qirrali yashil bog' va xiyobonlar
        g.fillStyle = info.type === 'park' || info.type === 'magiccity' ? '#133826' : '#18303b';
        g.beginPath();
        g.ellipse(bx + bw * 0.5, by + bw * 0.5, bw * 0.48, bw * 0.45, (hash2(j, kk, 1) - 0.5) * 0.5, 0, Math.PI * 2);
        g.fill();

        g.fillStyle = '#1c5236';
        for (let t = 0; t < 8; t++) {
          const tx = bx + (0.16 + 0.68 * hash2(j, kk, t + 1)) * bw;
          const ty = by + (0.16 + 0.68 * hash2(j, kk, t + 11)) * bw;
          g.beginPath();
          g.arc(tx, ty, 4 + (t % 3) * 2.2, 0, Math.PI * 2);
          g.fill();
        }
      } else if (info.type === 'chorsu') {
        g.fillStyle = '#0ea5e9';
        g.beginPath();
        g.arc(bx + bw * 0.5, by + bw * 0.5, bw * 0.28, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#38bdf8';
        g.lineWidth = 2.2;
        g.stroke();
      } else if (info.type === 'citytower') {
        g.fillStyle = '#253b5e';
        g.strokeStyle = '#38bdf8';
        g.lineWidth = 1.6;
        g.fillRect(bx + bw * 0.16, by + bw * 0.16, bw * 0.28, bw * 0.28);
        g.strokeRect(bx + bw * 0.16, by + bw * 0.16, bw * 0.28, bw * 0.28);
        g.fillRect(bx + bw * 0.54, by + bw * 0.22, bw * 0.26, bw * 0.24);
        g.fillRect(bx + bw * 0.24, by + bw * 0.56, bw * 0.48, bw * 0.24);
      } else if (info.type === 'kokobango') {
        g.fillStyle = '#281145';
        g.strokeStyle = '#e879f9';
        g.lineWidth = 2.2;
        g.beginPath();
        g.roundRect(bx + bw * 0.14, by + bw * 0.18, bw * 0.72, bw * 0.56, 8);
        g.fill();
        g.stroke();
      } else if (info.type === 'garage') {
        g.fillStyle = '#263450';
        g.strokeStyle = '#ffd740';
        g.lineWidth = 2.2;
        g.beginPath();
        g.roundRect(bx + bw * 0.12, by + bw * 0.14, bw * 0.76, bw * 0.44, 8);
        g.fill();
        g.stroke();
      } else if (isEdge) {
        // Shahar chekkasida tabiiy yashil tepalik va daraxtzorlar
        g.fillStyle = 'rgba(22, 68, 46, 0.45)';
        for (let t = 0; t < 4; t++) {
          const tx = bx + (0.2 + 0.6 * hash2(j, kk, t + 5)) * bw;
          const ty = by + (0.2 + 0.6 * hash2(j, kk, t + 15)) * bw;
          g.beginPath();
          g.arc(tx, ty, 8 + (t % 3) * 4, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  }

  // 4. Anhor, Bo'zsuv va Qorasuv kanallari — tabiiy egri daryo tarmoqlari
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const canalX = (blockC(6) + HALF) * k;
  g.strokeStyle = 'rgba(56, 189, 248, 0.28)';
  g.lineWidth = 34;
  g.beginPath();
  g.moveTo(canalX - 24, 0);
  g.bezierCurveTo(canalX + 34, S * 0.3, canalX - 32, S * 0.65, canalX + 18, S);
  g.stroke();

  g.strokeStyle = '#0a5e8c';
  g.lineWidth = 20;
  g.beginPath();
  g.moveTo(canalX - 24, 0);
  g.bezierCurveTo(canalX + 34, S * 0.3, canalX - 32, S * 0.65, canalX + 18, S);
  g.stroke();

  g.strokeStyle = 'rgba(125, 211, 252, 0.42)';
  g.lineWidth = 4.5;
  g.beginPath();
  g.moveTo(canalX - 24, 0);
  g.bezierCurveTo(canalX + 34, S * 0.3, canalX - 32, S * 0.65, canalX + 18, S);
  g.stroke();

  // Bo'zsuv (g'arbiy daryo tarmog'i) va Salor (sharqiy daryo tarmog'i)
  g.strokeStyle = '#0a5e8c';
  g.lineWidth = 13;
  g.beginPath();
  g.moveTo(canalX + 4, S * 0.22);
  g.quadraticCurveTo(S * 0.22, S * 0.36, 0, S * 0.52);
  g.moveTo(canalX - 6, S * 0.44);
  g.bezierCurveTo(S * 0.55, S * 0.52, S * 0.75, S * 0.72, S * 0.88, S * 0.92);
  g.stroke();
  g.restore();

  // 5. GTA 5 Yo'l Tarmog'i: Egri burchakli Halqa Magistrali + Shoh ko'chalar (chekka to'rtburchaksiz!)
  const majorRows = new Set([2, 4, 6, 7, 8, 11, 13, 16]);
  const majorCols = new Set([2, 4, 6, 7, 8, 9, 10, 12, 15]);
  const rMin = (roadC(1) + HALF) * k;
  const rMax = (roadC(N - 1) + HALF) * k;

  // Ichki va shoh ko'chalar (faqat halqa yo'li ichida chiziladi — xarita cheti 4-burchak bo'lib qolmaydi!)
  for (let i = 2; i <= N - 2; i++) {
    const ry = (roadC(i) + HALF) * k;
    const isMaj = majorRows.has(i);
    g.fillStyle = isMaj ? '#3b4a61' : '#253142';
    g.fillRect(rMin, ry - (ROAD * k) * (isMaj ? 0.48 : 0.34), rMax - rMin, ROAD * k * (isMaj ? 0.96 : 0.68));
  }
  for (let i = 2; i <= N - 2; i++) {
    const rx = (roadC(i) + HALF) * k;
    const isMaj = majorCols.has(i);
    g.fillStyle = isMaj ? '#3b4a61' : '#253142';
    g.fillRect(rx - (ROAD * k) * (isMaj ? 0.48 : 0.34), rMin, ROAD * k * (isMaj ? 0.96 : 0.68), rMax - rMin);
  }

  // Shoh ko'cha markaziy chiziqlari
  g.save();
  for (let i = 2; i <= N - 2; i++) {
    const ry = (roadC(i) + HALF) * k;
    const rx = (roadC(i) + HALF) * k;
    if (majorRows.has(i)) {
      g.strokeStyle = 'rgba(251, 191, 36, 0.48)';
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(rMin, ry);
      g.lineTo(rMax, ry);
      g.stroke();
    }
    if (majorCols.has(i)) {
      g.strokeStyle = 'rgba(251, 191, 36, 0.48)';
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(rx, rMin);
      g.lineTo(rx, rMax);
      g.stroke();
    }
  }

  // Kichik Halqa va Tashqi Halqa Magistrali — GTA 5 uslubida silliq yumaloq burchakli avtomagistral!
  const ringCornerR = 115;
  g.strokeStyle = '#0b111d';
  g.lineWidth = ROAD * k * 1.35;
  g.beginPath();
  g.roundRect(rMin, rMin, rMax - rMin, rMax - rMin, ringCornerR);
  g.stroke();

  g.strokeStyle = '#475569';
  g.lineWidth = ROAD * k * 0.95;
  g.beginPath();
  g.roundRect(rMin, rMin, rMax - rMin, rMax - rMin, ringCornerR);
  g.stroke();

  g.strokeStyle = 'rgba(250, 204, 21, 0.68)';
  g.lineWidth = 2.4;
  g.beginPath();
  g.roundRect(rMin, rMin, rMax - rMin, rMax - rMin, ringCornerR);
  g.stroke();

  // Ichki Kichik Halqa (yumaloq burchakli)
  const inMin = (roadC(3) + HALF) * k;
  const inMax = (roadC(N - 3) + HALF) * k;
  g.strokeStyle = 'rgba(250, 204, 21, 0.35)';
  g.lineWidth = 2.8;
  g.beginPath();
  g.roundRect(inMin, inMin, inMax - inMin, inMax - inMin, 85);
  g.stroke();

  // Asosiy chorrahalarda GTA 5 uslubidagi aylana ko'prik / razvyazka halqalari
  const interchanges = [
    [9, 7],  // Amir Temur Xiyoboni
    [4, 7],  // Tashkent City
    [8, 1],  // Teleminora
    [2, 5],  // Chorsu
    [4, 10], // Magic City
  ];
  for (const [ij, ik] of interchanges) {
    const ix = (blockC(ij) + HALF) * k;
    const iy = (blockC(ik) + HALF) * k;
    g.fillStyle = 'rgba(22, 101, 52, 0.42)';
    g.strokeStyle = '#38bdf8';
    g.lineWidth = 2.4;
    g.beginPath();
    g.arc(ix, iy, BLOCK * k * 0.36, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }

  // 6. HAQIQIY OPENSTREETMAP (ODbL) DARYO, KANAL VA KO'LLAR GEOMETRIYASI (139 ta kanal + 11 ta ko'l)
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const ww of OSM_WATERWAYS) {
    if (!ww.pts || ww.pts.length < 2) continue;
    g.strokeStyle = ww.type === 'river' ? '#09527a' : '#0c6899';
    g.lineWidth = ww.type === 'river' ? 9 : 4.5;
    g.beginPath();
    ww.pts.forEach(([wx, wz], idx) => {
      const px = (wx + HALF) * k;
      const py = (wz + HALF) * k;
      if (idx === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    });
    g.stroke();
  }
  for (const lk of OSM_LAKES) {
    if (!lk.pts || lk.pts.length < 3) continue;
    g.fillStyle = '#095985';
    g.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    g.lineWidth = 1.4;
    g.beginPath();
    lk.pts.forEach(([wx, wz], idx) => {
      const px = (wx + HALF) * k;
      const py = (wz + HALF) * k;
      if (idx === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    });
    g.closePath();
    g.fill();
    g.stroke();
  }

  // 7. HAQIQIY OPENSTREETMAP (ODbL) YO'L GEOMETRIYASI (567 ta egri ko'cha segmenti · 54.0 km!)
  for (const rd of OSM_ROADS) {
    if (!rd.pts || rd.pts.length < 2) continue;
    const isMajorOsm = rd.type === 'trunk' || rd.type === 'primary';
    const isSecOsm = rd.type === 'secondary';
    g.strokeStyle = isMajorOsm
      ? 'rgba(251, 191, 36, 0.62)'
      : isSecOsm
        ? 'rgba(148, 163, 184, 0.48)'
        : 'rgba(100, 116, 139, 0.34)';
    g.lineWidth = isMajorOsm ? 4.2 : isSecOsm ? 2.8 : 1.8;
    g.beginPath();
    rd.pts.forEach(([wx, wz], idx) => {
      const px = (wx + HALF) * k;
      const py = (wz + HALF) * k;
      if (idx === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    });
    g.stroke();
  }

  // 8. HAQIQIY OPENSTREETMAP (ODbL) BINO KONTURLARI (695 ta haqiqiy Toshkent binosi poligonlari!)
  for (const b of OSM_BUILDINGS) {
    if (!b.pts || b.pts.length < 3) continue;
    g.fillStyle = b.h >= 35 ? '#2c476e' : '#24354f';
    g.strokeStyle = b.name ? 'rgba(56, 189, 248, 0.55)' : 'rgba(148, 163, 184, 0.32)';
    g.lineWidth = b.name ? 1.3 : 0.9;
    g.beginPath();
    b.pts.forEach(([wx, wz], idx) => {
      const px = (wx + HALF) * k;
      const py = (wz + HALF) * k;
      if (idx === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    });
    g.closePath();
    g.fill();
    g.stroke();
  }
  g.restore();

  baseCanvas = c;
}

const toMap = (x, z, S, cx, cz, scale) => [
  S / 2 + (x - cx) * scale,
  S / 2 + (z - cz) * scale,
];

// ============================================================================
// YO'LLAR BO'YLAB AQLLI GPS MARSHRUT CHIZISH (Manhattan Road-Snap + Distance)
// ============================================================================
function computeRoadPath(px, pz, tx, tz) {
  const rX1 = roadC(nearestRoad(px));
  const rZ1 = roadC(nearestRoad(pz));
  const rX2 = roadC(nearestRoad(tx));
  const rZ2 = roadC(nearestRoad(tz));

  return [
    [px, pz],
    [px, rZ1],
    [rX2, rZ1],
    [rX2, tz],
    [tx, tz],
  ];
}

function drawGpsRoute(g, S, cx, cz, scale, player, dest, isMini = false) {
  if (!dest) return 0;
  const pts = computeRoadPath(player.x, player.z, dest.x, dest.z);
  const distMeters = Math.hypot(dest.x - player.x, dest.z - player.z);

  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';

  // Tashqi neon nur
  g.strokeStyle = 'rgba(0, 229, 255, 0.32)';
  g.lineWidth = isMini ? 8 : 10;
  g.beginPath();
  pts.forEach(([wx, wz], idx) => {
    const [mx, my] = toMap(wx, wz, S, cx, cz, scale);
    if (idx === 0) g.moveTo(mx, my);
    else g.lineTo(mx, my);
  });
  g.stroke();

  // Asosiy yorqin moviy GPS chizig'i
  g.strokeStyle = '#00e5ff';
  g.lineWidth = isMini ? 4 : 4.5;
  g.beginPath();
  pts.forEach(([wx, wz], idx) => {
    const [mx, my] = toMap(wx, wz, S, cx, cz, scale);
    if (idx === 0) g.moveTo(mx, my);
    else g.lineTo(mx, my);
  });
  g.stroke();

  // Harakatlanuvchi oq yo'nalish chiziqchalari
  g.strokeStyle = '#ffffff';
  g.lineWidth = 2;
  g.setLineDash([8, 10]);
  g.lineDashOffset = -((performance.now() * 0.03) % 18);
  g.stroke();
  g.restore();

  return distMeters;
}

// ============================================================================
// HUD MINI-XARITA (O'yin paytida burchakda aylanuvchi GPS radar)
// ============================================================================
function drawClubBadge(g, px, py, r, isSelected = false) {
  g.save();
  // Tashqi neon shula
  const glow = g.createRadialGradient(px, py, r * 0.4, px, py, r * 2.1);
  glow.addColorStop(0, 'rgba(232, 121, 249, 0.55)');
  glow.addColorStop(0.55, 'rgba(56, 189, 248, 0.22)');
  glow.addColorStop(1, 'rgba(232, 121, 249, 0)');
  g.fillStyle = glow;
  g.beginPath();
  g.arc(px, py, r * 2.1, 0, Math.PI * 2);
  g.fill();

  // Asosiy qora-binafsha doira
  g.fillStyle = '#140626';
  g.beginPath();
  g.arc(px, py, r, 0, Math.PI * 2);
  g.fill();

  // Ikki rangli neon halqa (magenta + cyan)
  g.strokeStyle = isSelected ? '#00e5ff' : '#e879f9';
  g.lineWidth = isSelected ? 3.2 : 2.5;
  g.beginPath();
  g.arc(px, py, r, 0, Math.PI * 2);
  g.stroke();

  g.strokeStyle = '#22d3ee';
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(px, py, r + 3.2, -Math.PI * 0.75, Math.PI * 0.25);
  g.stroke();

  // Ichki ekvalayzer ustunlari (tungi klub logosi)
  const bars = [0.42, 0.78, 0.56, 0.86, 0.48];
  const barW = Math.max(1.6, r * 0.14);
  const gap = barW * 1.45;
  const startX = px - ((bars.length - 1) * gap) / 2;
  for (let i = 0; i < bars.length; i++) {
    const bh = r * bars[i] * 0.88;
    const bx = startX + i * gap - barW / 2;
    const by = py + r * 0.36 - bh;
    g.fillStyle = i % 2 === 0 ? '#f0abfc' : '#38bdf8';
    g.fillRect(bx, by, barW, bh);
  }

  // Yuqori qismda quloqchin yoyi
  g.strokeStyle = '#ffffff';
  g.lineWidth = Math.max(1.5, r * 0.13);
  g.beginPath();
  g.arc(px, py - r * 0.05, r * 0.56, Math.PI * 1.12, Math.PI * 1.88);
  g.stroke();
  g.restore();
}

export function drawMinimap(canvas, player, extra = {}) {
  if (!baseCanvas) drawBase();
  const g = canvas.getContext('2d');
  const S = canvas.width;
  const viewSpan = 380; // 380m qamrov
  const scale = S / viewSpan;

  g.save();
  g.clearRect(0, 0, S, S);
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
  g.clip();

  g.fillStyle = '#0b121e';
  g.fillRect(0, 0, S, S);

  g.translate(S / 2, S / 2);
  g.rotate(player.heading + Math.PI);
  g.translate(-S / 2, -S / 2);

  const bk = baseCanvas.width / (HALF * 2);
  g.drawImage(
    baseCanvas,
    (player.x - viewSpan / 2 + HALF) * bk,
    (player.z - viewSpan / 2 + HALF) * bk,
    viewSpan * bk,
    viewSpan * bk,
    0,
    0,
    S,
    S
  );

  // GPS Marshrut chizig'i (Minimapda ham aniq ko'rinadi)
  const activeDest = extra.waypoint || extra.target;
  if (activeDest) {
    drawGpsRoute(g, S, player.x, player.z, scale, player, activeDest, true);
  }

  // Minimapdagi belgilar
  for (const p of POIS) {
    const [px, py] = toMap(p.x, p.z, S, player.x, player.z, scale);
    if (px < -12 || px > S + 12 || py < -12 || py > S + 12) continue;
    g.fillStyle = p.type === 'gas' ? '#00e676' : '#ffd740';
    g.beginPath();
    g.arc(px, py, 5.5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#090d16';
    g.lineWidth = 1.5;
    g.stroke();
  }

  for (const l of LANDMARKS) {
    if (l.type !== 'kokobango') continue;
    const [px, py] = toMap(l.x, l.z, S, player.x, player.z, scale);
    if (px < -18 || px > S + 18 || py < -18 || py > S + 18) continue;
    drawClubBadge(g, px, py, 9, false);
    g.font = '800 8px "Segoe UI", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#f5d0fe';
    g.fillText('KOKOBANGO', px, py - 14);
  }

  for (const r of extra.remotes || []) {
    const [px, py] = toMap(r.x, r.z, S, player.x, player.z, scale);
    g.fillStyle = '#ff4081';
    g.beginPath();
    g.arc(px, py, 5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 1.2;
    g.stroke();
  }

  if (extra.target) {
    const [px, py] = toMap(extra.target.x, extra.target.z, S, player.x, player.z, scale);
    g.fillStyle = extra.target.color || '#ff1744';
    g.beginPath();
    g.arc(px, py, 6.5, 0, Math.PI * 2);
    g.fill();
  }
  if (extra.waypoint) {
    const [px, py] = toMap(extra.waypoint.x, extra.waypoint.z, S, player.x, player.z, scale);
    g.fillStyle = '#00e5ff';
    g.beginPath();
    g.arc(px, py, 6.5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2;
    g.stroke();
  }

  g.restore();

  // O'yinchi markaziy strelkasi
  g.save();
  g.translate(S / 2, S / 2);
  g.fillStyle = '#00e5ff';
  g.strokeStyle = '#06101e';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, -10);
  g.lineTo(-7, 8);
  g.lineTo(0, 4);
  g.lineTo(7, 8);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();

  // Shimol (N) ko'rsatkichi
  const nAng = player.heading + Math.PI - Math.PI / 2;
  const nr = S / 2 - 11;
  const nx = S / 2 + Math.cos(nAng) * nr;
  const ny = S / 2 + Math.sin(nAng) * nr;
  g.fillStyle = '#0f172a';
  g.beginPath();
  g.arc(nx, ny, 8, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#f43f5e';
  g.font = '900 10px "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('N', nx, ny);

  // Joriy tuman nomi (Minimap pastki qismida)
  const curDist = districtAt(player.x, player.z);
  if (curDist) {
    g.fillStyle = 'rgba(8, 13, 26, 0.84)';
    g.beginPath();
    g.roundRect(S * 0.16, S - 24, S * 0.68, 17, 8);
    g.fill();
    g.strokeStyle = curDist.color || '#38bdf8';
    g.lineWidth = 1;
    g.stroke();
    g.fillStyle = '#f8fafc';
    g.font = '700 9.5px "Segoe UI", sans-serif';
    g.fillText(curDist.uz, S / 2, S - 15.5);
  }

  // Tashqi radar gardishi
  g.strokeStyle = 'rgba(0, 229, 255, 0.68)';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
  g.stroke();
}

// ============================================================================
// KATTA INTERAKTIV TOSHKENT GPS XARITASI (Zoom, Pan, Filter, Non-Overlapping Labels)
// ============================================================================
export function drawBigMap(canvas, player, extra = {}) {
  if (!baseCanvas) drawBase();
  const g = canvas.getContext('2d');
  const S = canvas.width;
  const zoom = Math.max(1.0, Math.min(3.6, mapState.zoom || 1.0));
  const worldSpan = (HALF * 2) / zoom;
  const scale = S / worldSpan;

  // Pan chegarasini xarita doirasida ushlash
  const maxPan = Math.max(0, HALF - worldSpan / 2);
  mapState.panX = Math.max(-maxPan, Math.min(maxPan, mapState.panX || 0));
  mapState.panZ = Math.max(-maxPan, Math.min(maxPan, mapState.panZ || 0));
  const cx = mapState.panX;
  const cz = mapState.panZ;

  g.save();
  g.clearRect(0, 0, S, S);
  g.fillStyle = '#0b121e';
  g.fillRect(0, 0, S, S);

  const bk = baseCanvas.width / (HALF * 2);
  g.drawImage(
    baseCanvas,
    (cx - worldSpan / 2 + HALF) * bk,
    (cz - worldSpan / 2 + HALF) * bk,
    worldSpan * bk,
    worldSpan * bk,
    0,
    0,
    S,
    S
  );

  // Yozuvlar ustma-ust tushmasligi uchun band qilingan to'rtburchaklar ro'yxati
  const placedBoxes = [];
  const canPlaceLabel = (x, y, w, h) => {
    const x1 = x - w / 2 - 4, x2 = x + w / 2 + 4;
    const y1 = y - h / 2 - 3, y2 = y + h / 2 + 3;
    if (x1 < 8 || x2 > S - 8 || y1 < 8 || y2 > S - 28) return false;
    for (const b of placedBoxes) {
      if (x1 < b.x2 && x2 > b.x1 && y1 < b.y2 && y2 > b.y1) return false;
    }
    placedBoxes.push({ x1, y1, x2, y2 });
    return true;
  };

  // 1. 6 ta Toshkent tumanining haqiqiy OpenStreetMap chegaralari va nomlari
  for (const d of TASHKENT_DISTRICTS_OSM) {
    const isSel = mapState.selectedDistrict === d.id;
    g.save();
    g.beginPath();
    d.polygon.forEach(([px, pz], idx) => {
      const [mx, my] = toMap(px, pz, S, cx, cz, scale);
      if (idx === 0) g.moveTo(mx, my);
      else g.lineTo(mx, my);
    });
    g.closePath();
    g.fillStyle = isSel ? `${d.color}36` : `${d.color}14`;
    g.fill();
    g.strokeStyle = d.color;
    g.lineWidth = isSel ? 2.8 : 1.5;
    if (!isSel) g.setLineDash([6, 4]);
    g.stroke();
    g.restore();

    const [dx, dy] = toMap(d.cx, d.cz, S, cx, cz, scale);
    if (dx >= 24 && dx <= S - 24 && dy >= 24 && dy <= S - 36) {
      const label = d.uz.toUpperCase();
      g.font = `900 ${Math.round((isSel ? 13 : 11) * Math.sqrt(zoom))}px "Segoe UI", sans-serif`;
      const tw = g.measureText(label).width;
      if (canPlaceLabel(dx, dy, tw + 14, 20)) {
        g.fillStyle = isSel ? 'rgba(15, 23, 42, 0.88)' : 'rgba(9, 14, 26, 0.68)';
        g.beginPath();
        g.roundRect(dx - tw / 2 - 7, dy - 10, tw + 14, 20, 6);
        g.fill();
        g.strokeStyle = isSel ? d.color : `${d.color}88`;
        g.lineWidth = isSel ? 1.5 : 1;
        g.stroke();
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = isSel ? '#ffffff' : '#e2e8f0';
        g.fillText(label, dx, dy);
      }
    }
  }

  // 2. Asosiy ko'cha nomlari (Zoom darajasiga qarab toza ko'rinadi)
  g.font = '700 10px "Segoe UI", sans-serif';
  const streetStep = zoom > 1.6 ? 1 : 2;
  for (let i = 1; i < N; i += streetStep) {
    const [, ry] = toMap(0, roadC(i), S, cx, cz, scale);
    const name = STREETS_X[i];
    if (name && ry > 30 && ry < S - 40) {
      const tw = g.measureText(name).width;
      if (canPlaceLabel(S * 0.24, ry - 8, tw, 12)) {
        g.fillStyle = 'rgba(203, 213, 225, 0.65)';
        g.fillText(name, S * 0.24, ry - 8);
      }
    }
  }

  // 3. GPS Marshrut chizig'i va masofa yorlig'i
  const activeDest = extra.waypoint || extra.target;
  let routeDistM = 0;
  if (activeDest) {
    routeDistM = drawGpsRoute(g, S, cx, cz, scale, player, activeDest, false);
  }

  // 4. Barcha POI va Muhim joylar (Kategoriya filtriga mos)
  const allPois = getAllMapPOIs().filter(
    (item) => mapState.filter === 'all' || item.category === mapState.filter
  );
  // Muhim obyektlar birinchi chizilib, yozuv joyini band qiladi
  allPois.sort((a, b) => (b.priority || 1) - (a.priority || 1));

  for (const item of allPois) {
    const [px, py] = toMap(item.x, item.z, S, cx, cz, scale);
    if (px < -20 || px > S + 20 || py < -20 || py > S + 20) continue;

    const isSelected = mapState.selectedPoi && mapState.selectedPoi.id === item.id;
    const r = item.isClub ? (isSelected ? 16 : 14) : isSelected ? 13 : item.priority >= 3 ? 10.5 : 8.5;

    // Tanlangan obyekt atrofidagi puls halqa
    if (isSelected) {
      g.strokeStyle = '#00e5ff';
      g.lineWidth = 2.5;
      g.beginPath();
      g.arc(px, py, r + 5, 0, Math.PI * 2);
      g.stroke();
    }

    if (item.isClub) {
      drawClubBadge(g, px, py, r, isSelected);
    } else {
      // Doira belgisi
      g.fillStyle = '#0f172a';
      g.beginPath();
      g.arc(px, py, r, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = item.color;
      g.lineWidth = isSelected ? 3 : 2;
      g.stroke();

      // Ikonka
      g.font = `${Math.round(r * 1.15)}px "Segoe UI Emoji", "Segoe UI", sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(item.icon, px, py + 0.5);
    }

    // Obyekt nomi (faqat boshqa yozuv ustiga tushmasa ko'rsatiladi — 0% ustma-ust tushish!)
    const showLabel = isSelected || item.isClub || zoom >= 1.35 || item.priority >= 3 || mapState.filter !== 'all';
    if (showLabel) {
      if (item.isClub) {
        g.font = '800 12px "Segoe UI", sans-serif';
        const titleTxt = '🎧 KOKOBANGO';
        const subTxt = 'TUNGI KLUB';
        const tw = Math.max(g.measureText(titleTxt).width, 76) + 16;
        const bh = 30;
        const ly = py - r - 20;
        canPlaceLabel(px, ly, tw, bh);
        g.fillStyle = 'rgba(20, 6, 38, 0.94)';
        g.beginPath();
        g.roundRect(px - tw / 2, ly - bh / 2, tw, bh, 7);
        g.fill();
        g.strokeStyle = isSelected ? '#00e5ff' : '#e879f9';
        g.lineWidth = 1.6;
        g.stroke();
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = '#fdf4ff';
        g.fillText(titleTxt, px, ly - 6);
        g.font = '800 9px "Segoe UI", sans-serif';
        g.fillStyle = '#38bdf8';
        g.fillText(subTxt, px, ly + 7);
      } else {
        g.font = '700 11px "Segoe UI", sans-serif';
        const labelText = item.title;
        const tw = g.measureText(labelText).width + 12;
        const ly = py - r - 11;
        if (isSelected || canPlaceLabel(px, ly, tw, 18)) {
          g.fillStyle = 'rgba(9, 14, 26, 0.86)';
          g.beginPath();
          g.roundRect(px - tw / 2, ly - 9, tw, 18, 5);
          g.fill();
          g.strokeStyle = isSelected ? '#00e5ff' : 'rgba(255,255,255,0.16)';
          g.lineWidth = 1;
          g.stroke();
          g.fillStyle = isSelected ? '#00e5ff' : '#f8fafc';
          g.fillText(labelText, px, ly);
        }
      }
    }
  }

  // 5. Online o'yinchilar (Do'stlar va boshqa haydovchilar)
  for (const l of LANDMARKS) {
    if (l.type !== 'kokobango') continue;
    const [px, py] = toMap(l.x, l.z, S, player.x, player.z, scale);
    if (px < -18 || px > S + 18 || py < -18 || py > S + 18) continue;
    drawClubBadge(g, px, py, 9, false);
    g.font = '800 8px "Segoe UI", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#f5d0fe';
    g.fillText('KOKOBANGO', px, py - 14);
  }

  for (const r of extra.remotes || []) {
    const [px, py] = toMap(r.x, r.z, S, cx, cz, scale);
    g.fillStyle = '#ff4081';
    g.beginPath();
    g.arc(px, py, 7, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2;
    g.stroke();
    if (r.name) {
      g.font = '700 11px "Segoe UI", sans-serif';
      g.fillStyle = '#ff80ab';
      g.fillText('👤 ' + r.name, px, py - 12);
    }
  }

  // 6. Aktiv GPS Waypoint nishoni
  if (extra.waypoint) {
    const [wx, wy] = toMap(extra.waypoint.x, extra.waypoint.z, S, cx, cz, scale);
    g.strokeStyle = '#00e5ff';
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(wx, wy, 12, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#00e5ff';
    g.beginPath();
    g.arc(wx, wy, 5, 0, Math.PI * 2);
    g.fill();

    const distKm = (routeDistM / 1000).toFixed(2);
    const badge = `📍 GPS: ${distKm} km`;
    g.font = '800 11px "Segoe UI", sans-serif';
    const bw = g.measureText(badge).width + 14;
    g.fillStyle = 'rgba(0, 229, 255, 0.92)';
    g.beginPath();
    g.roundRect(wx - bw / 2, wy + 14, bw, 20, 6);
    g.fill();
    g.fillStyle = '#04121f';
    g.fillText(badge, wx, wy + 24);
  }

  // 7. O'yinchi (Sizning joylashuvingiz va yo'nalishingiz)
  const [px, py] = toMap(player.x, player.z, S, cx, cz, scale);
  g.save();
  g.translate(px, py);
  g.rotate(-player.heading + Math.PI);
  // Nurlanuvchi doira
  g.fillStyle = 'rgba(0, 229, 255, 0.25)';
  g.beginPath();
  g.arc(0, 0, 16, 0, Math.PI * 2);
  g.fill();
  // O'yinchi strelkasi
  g.fillStyle = '#00e5ff';
  g.strokeStyle = '#04101e';
  g.lineWidth = 2.2;
  g.beginPath();
  g.moveTo(0, -13);
  g.lineTo(-9, 10);
  g.lineTo(0, 5);
  g.lineTo(9, 10);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();

  // 8. OpenStreetMap Attribution (ODbL) + O'yinchining Real WGS84 Geografik Koordinatasi
  const ll = worldToLatLon(player.x, player.z);
  const osmBadge = `${OSM_ATTRIBUTION} · 📍 ${ll.lat}° N, ${ll.lon}° E · ${TASHKENT_GIS_META.totalRoadKm} km OSM yo'l`;
  g.fillStyle = 'rgba(9, 14, 26, 0.86)';
  g.fillRect(S - 460, S - 24, 452, 18);
  g.fillStyle = 'rgba(148, 163, 184, 0.94)';
  g.font = '600 10px "Segoe UI", sans-serif';
  g.textAlign = 'right';
  g.fillText(osmBadge, S - 12, S - 11);

  g.restore();
}

export function bigMapToWorld(mx, mz, S) {
  const zoom = Math.max(1.0, Math.min(3.6, mapState.zoom || 1.0));
  const worldSpan = (HALF * 2) / zoom;
  const wx = (mapState.panX || 0) + ((mx / S) - 0.5) * worldSpan;
  const wz = (mapState.panZ || 0) + ((mz / S) - 0.5) * worldSpan;
  return [wx, wz];
}

export function streetAt(x, z) {
  const osmStreet = nearestOsmRoadName(x, z);
  const ix = nearestRoad(x), iz = nearestRoad(z);
  const dx = Math.abs(x - roadC(ix)), dz = Math.abs(z - roadC(iz));
  const dist = districtAt(x, z);
  const dName = dist ? dist.name : 'Toshkent';
  if (osmStreet) return `${osmStreet} · ${dName}`;
  if (dx < ROAD && dx <= dz && STREETS_X[ix]) return `${STREETS_X[ix]} · ${dName}`;
  if (dz < ROAD && STREETS_Z[iz]) return `${STREETS_Z[iz]} · ${dName}`;
  return dist ? dist.uz : dName;
}
