// TUNGI TOSHKENT — OpenStreetMap & GTA Online uslubidagi Professional GPS Xarita Tizimi
// HUD Minimap va Katta Interaktiv Xarita (Zoom, Pan, Kategoriya filtri, GPS marshrut va POI tanlash)
import { N, BLOCK, ROAD, HALF, roadC, blockC, blockInfo, nearestRoad, POIS, LANDMARKS, DISTRICTS, STREETS_X, STREETS_Z, RACES } from './world/layout.js';

const IS_MOB = typeof navigator !== 'undefined' && (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900));
const BASE_SIZE = IS_MOB ? 1024 : 1536;
let baseCanvas = null;

// Katta xarita holati (Zoom, Pan, Filter, Tanlangan obyekt)
export const mapState = {
  zoom: 1.0,
  panX: 0, // dunyo koordinatasida markaz siljishi
  panZ: 0,
  filter: 'all', // 'all' | 'gas' | 'garage' | 'service' | 'race' | 'job' | 'park' | 'landmark'
  selectedPoi: null,
};

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
// OPENSTREETMAP DARK VECTOR USLUBIDAGI ASOSIY XARITA QATLAMI (2048x2048)
// ============================================================================
function drawBase() {
  const S = BASE_SIZE;
  const k = S / (HALF * 2);
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');

  // 1. Asosiy tungi shahar zamini (OSM Carto Dark / GTA Radar fon)
  g.fillStyle = '#0f1724';
  g.fillRect(0, 0, S, S);

  // Kvartallar, parklar va binolar izlari (Building footprints)
  for (let j = 0; j < N; j++) {
    for (let kk = 0; kk < N; kk++) {
      const info = blockInfo(j, kk);
      const bx = (blockC(j) - BLOCK / 2 + HALF) * k;
      const by = (blockC(kk) - BLOCK / 2 + HALF) * k;
      const bw = BLOCK * k;

      // Kvartal trotuar / hovli asosi
      if (info.type === 'park' || info.type === 'magiccity') {
        g.fillStyle = '#123123';
      } else if (info.type === 'square' || info.type === 'minor') {
        g.fillStyle = '#182b34';
      } else if (info.type === 'chorsu') {
        g.fillStyle = '#1b283b';
      } else if (info.type === 'citytower') {
        g.fillStyle = '#16243b';
      } else if (info.type === 'kokobango') {
        g.fillStyle = '#1c0f30';
      } else {
        g.fillStyle = '#162030';
      }

      // Yumaloq burchakli kvartal bloki
      g.beginPath();
      g.roundRect(bx + 2, by + 2, bw - 4, bw - 4, 8);
      g.fill();
      g.strokeStyle = 'rgba(148, 163, 184, 0.14)';
      g.lineWidth = 1.2;
      g.stroke();

      // Parklarda daraxtlar va xiyobon yo'laklari
      if (info.type === 'park' || info.type === 'magiccity' || info.type === 'square') {
        g.strokeStyle = 'rgba(74, 222, 128, 0.18)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(bx + 10, by + bw / 2);
        g.lineTo(bx + bw - 10, by + bw / 2);
        g.moveTo(bx + bw / 2, by + 10);
        g.lineTo(bx + bw / 2, by + bw - 10);
        g.stroke();

        g.fillStyle = '#194932';
        for (let t = 0; t < 7; t++) {
          const tx = bx + (0.18 + 0.64 * hash2(j, kk, t + 1)) * bw;
          const ty = by + (0.18 + 0.64 * hash2(j, kk, t + 11)) * bw;
          g.beginPath();
          g.arc(tx, ty, 5 + (t % 3) * 2, 0, Math.PI * 2);
          g.fill();
        }
      }

      // Chorsu gumbazlari
      if (info.type === 'chorsu') {
        g.fillStyle = '#0ea5e9';
        g.beginPath();
        g.arc(bx + bw * 0.5, by + bw * 0.5, bw * 0.24, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#38bdf8';
        g.lineWidth = 2;
        g.stroke();
      } else if (info.type === 'citytower') {
        // Tashkent City osmono'par binolarining chizmasi
        g.fillStyle = '#253b5e';
        g.strokeStyle = '#38bdf8';
        g.lineWidth = 1.5;
        g.fillRect(bx + bw * 0.16, by + bw * 0.16, bw * 0.28, bw * 0.28);
        g.strokeRect(bx + bw * 0.16, by + bw * 0.16, bw * 0.28, bw * 0.28);
        g.fillRect(bx + bw * 0.54, by + bw * 0.22, bw * 0.26, bw * 0.24);
        g.fillRect(bx + bw * 0.24, by + bw * 0.56, bw * 0.48, bw * 0.24);
      } else if (info.type === 'kokobango') {
        // KOKOBANGO tungi klubi konturi va neon VIP maydoni
        g.fillStyle = '#281145';
        g.strokeStyle = '#e879f9';
        g.lineWidth = 2.2;
        g.beginPath();
        g.roundRect(bx + bw * 0.14, by + bw * 0.18, bw * 0.72, bw * 0.56, 6);
        g.fill();
        g.stroke();
        g.strokeStyle = '#22d3ee';
        g.lineWidth = 1.4;
        g.strokeRect(bx + bw * 0.22, by + bw * 0.26, bw * 0.56, bw * 0.36);
      } else if (info.type === 'city') {
        // Oddiy shahar kvartallarida OpenStreetMap uslubida 3-4 ta ko'p qavatli bino konturi
        g.fillStyle = '#212f45';
        g.strokeStyle = 'rgba(148, 163, 184, 0.22)';
        g.lineWidth = 1;
        const pad = bw * 0.12;
        const w1 = bw * (0.26 + 0.08 * hash2(j, kk, 2));
        const h1 = bw * (0.28 + 0.08 * hash2(j, kk, 3));
        g.fillRect(bx + pad, by + pad, w1, h1);
        g.strokeRect(bx + pad, by + pad, w1, h1);

        const w2 = bw * (0.28 + 0.06 * hash2(j, kk, 4));
        const h2 = bw * (0.24 + 0.08 * hash2(j, kk, 5));
        g.fillRect(bx + bw - pad - w2, by + pad, w2, h2);
        g.strokeRect(bx + bw - pad - w2, by + pad, w2, h2);

        const w3 = bw * (0.62 + 0.1 * hash2(j, kk, 6));
        const h3 = bw * 0.22;
        g.fillRect(bx + pad, by + bw - pad - h3, w3, h3);
        g.strokeRect(bx + pad, by + bw - pad - h3, w3, h3);
      }
    }
  }

  // 2. Anhor va Bo'zsuv kanali — tabiiy egri oqim
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const canalX = (blockC(6) + HALF) * k;
  g.strokeStyle = 'rgba(56, 189, 248, 0.22)';
  g.lineWidth = 28;
  g.beginPath();
  g.moveTo(canalX - 18, 0);
  g.bezierCurveTo(canalX + 26, S * 0.3, canalX - 28, S * 0.65, canalX + 12, S);
  g.stroke();

  g.strokeStyle = '#09527a';
  g.lineWidth = 18;
  g.beginPath();
  g.moveTo(canalX - 18, 0);
  g.bezierCurveTo(canalX + 26, S * 0.3, canalX - 28, S * 0.65, canalX + 12, S);
  g.stroke();

  // Bo'zsuv (shimoliy-g'arbiy tarmoq)
  g.lineWidth = 12;
  g.beginPath();
  g.moveTo(canalX + 4, S * 0.22);
  g.quadraticCurveTo(S * 0.24, S * 0.34, 0, S * 0.48);
  g.stroke();
  g.restore();

  // 3. Yo'l iyerarxiyasi (Katta shoh ko'chalar va ichki ko'chalar)
  const majorRows = new Set([0, 4, 6, 7, 9, 11, 14]);
  const majorCols = new Set([0, 3, 5, 8, 10, 14]);

  for (let i = 0; i <= N; i++) {
    const ry = (roadC(i) + HALF) * k;
    const isMaj = majorRows.has(i);
    // Yo'l cheti (casing)
    g.fillStyle = '#0b111d';
    g.fillRect(0, ry - (ROAD * k) * 0.54, S, ROAD * k * 1.08);
    // Yo'l qoplamasi
    g.fillStyle = isMaj ? '#334155' : '#263244';
    g.fillRect(0, ry - (ROAD * k) * 0.45, S, ROAD * k * 0.9);
  }

  for (let i = 0; i <= N; i++) {
    const rx = (roadC(i) + HALF) * k;
    const isMaj = majorCols.has(i);
    g.fillStyle = isMaj ? '#334155' : '#263244';
    g.fillRect(rx - (ROAD * k) * 0.45, 0, ROAD * k * 0.9, S);
  }

  // Markaziy yo'l chiziqlari (Shoh ko'chalarda sariq ikki chiziq, oddiy ko'chalarda oq uzuq chiziq)
  for (let i = 0; i <= N; i++) {
    const ry = (roadC(i) + HALF) * k;
    const rx = (roadC(i) + HALF) * k;

    g.save();
    if (majorRows.has(i)) {
      g.strokeStyle = 'rgba(251, 191, 36, 0.42)';
      g.lineWidth = 1.6;
      g.setLineDash([]);
    } else {
      g.strokeStyle = 'rgba(226, 232, 240, 0.22)';
      g.lineWidth = 1.1;
      g.setLineDash([8, 8]);
    }
    g.beginPath();
    g.moveTo(0, ry);
    g.lineTo(S, ry);
    g.stroke();

    if (majorCols.has(i)) {
      g.strokeStyle = 'rgba(251, 191, 36, 0.42)';
      g.lineWidth = 1.6;
      g.setLineDash([]);
    } else {
      g.strokeStyle = 'rgba(226, 232, 240, 0.22)';
      g.lineWidth = 1.1;
      g.setLineDash([8, 8]);
    }
    g.beginPath();
    g.moveTo(rx, 0);
    g.lineTo(rx, S);
    g.stroke();
    g.restore();
  }

  // Amir Temur xiyoboni doiraviy halqasi
  const skverX = (blockC(8) + HALF) * k;
  const skverY = (blockC(7) + HALF) * k;
  g.strokeStyle = '#38bdf8';
  g.lineWidth = 2.5;
  g.beginPath();
  g.arc(skverX, skverY, BLOCK * k * 0.36, 0, Math.PI * 2);
  g.stroke();

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

  // 1. Tuman nomlari (Yirik, yarim shaffof fon yozuvlari)
  g.font = `900 ${Math.round(13 * Math.sqrt(zoom))}px "Segoe UI", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const d of DISTRICTS) {
    const [dx, dy] = toMap(blockC(d.j), blockC(d.k), S, cx, cz, scale);
    if (dx < 20 || dx > S - 20 || dy < 20 || dy > S - 20) continue;
    g.fillStyle = 'rgba(148, 163, 184, 0.24)';
    g.fillText(d.name.toUpperCase(), dx, dy);
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

  // 8. OpenStreetMap Attribution & Masshtab chizg'ichi
  g.fillStyle = 'rgba(9, 14, 26, 0.78)';
  g.fillRect(S - 275, S - 24, 268, 18);
  g.fillStyle = 'rgba(148, 163, 184, 0.85)';
  g.font = '600 10px "Segoe UI", sans-serif';
  g.textAlign = 'right';
  g.fillText('© OpenStreetMap contributors · Toshkent GPS', S - 12, S - 11);

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
  const ix = nearestRoad(x), iz = nearestRoad(z);
  const dx = Math.abs(x - roadC(ix)), dz = Math.abs(z - roadC(iz));
  if (dx < ROAD && dx <= dz) return STREETS_X[ix] || '';
  if (dz < ROAD) return STREETS_Z[iz] || '';
  const d = DISTRICTS.reduce((a, b) =>
    Math.hypot(blockC(b.j) - x, blockC(b.k) - z) < Math.hypot(blockC(a.j) - x, blockC(a.k) - z) ? b : a
  );
  return d.name;
}
