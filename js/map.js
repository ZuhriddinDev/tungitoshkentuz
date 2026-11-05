// Mini-xarita (aylanuvchi radar) va katta xarita (M) — GPS nuqta qo'yish mumkin
import { N, BLOCK, ROAD, HALF, roadC, blockC, blockInfo, nearestRoad, POIS, LANDMARKS, DISTRICTS, STREETS_X, STREETS_Z } from './world/layout.js';

const COLORS = { city: '#2b3245', park: '#1f4d2a', square: '#25543a', canal: '#0f4a6b', gas: '#0d5c36', garage: '#5c4a0d', tvtower: '#3a3a5a', chorsu: '#1b4f8a', citytower: '#2c4a80' };
let base; // oldindan chizilgan shahar rasmi

function drawBase() {
  const S = 1024, k = S / (HALF * 2);
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#4a4d55'; g.fillRect(0, 0, S, S);
  for (let j = 0; j < N; j++) for (let kk = 0; kk < N; kk++) {
    const info = blockInfo(j, kk);
    g.fillStyle = COLORS[info.type] || COLORS.city;
    const x = (blockC(j) - BLOCK / 2 + HALF) * k, y = (blockC(kk) - BLOCK / 2 + HALF) * k;
    g.fillRect(x, y, BLOCK * k, BLOCK * k);
    if (info.type === 'canal') { g.fillStyle = '#1e7fb0'; g.fillRect(x + BLOCK * k * 0.33, y - ROAD * k, BLOCK * k * 0.34, (BLOCK + ROAD * 2) * k); }
  }
  g.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i <= N; i++) { g.fillRect(0, (roadC(i) + HALF) * k - 0.5, S, 1); g.fillRect((roadC(i) + HALF) * k - 0.5, 0, 1, S); }
  base = c;
}

const toMap = (x, z, S, cx, cz, scale) => [S / 2 + (x - cx) * scale, S / 2 + (z - cz) * scale];

export function drawMinimap(canvas, player, extra) {
  if (!base) drawBase();
  const g = canvas.getContext('2d'), S = canvas.width, scale = S / 360;
  g.save(); g.clearRect(0, 0, S, S);
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); g.clip();
  g.translate(S / 2, S / 2); g.rotate(player.heading + Math.PI); g.translate(-S / 2, -S / 2);
  const bk = base.width / (HALF * 2);
  g.fillStyle = '#3b3a2e'; g.fillRect(0, 0, S, S);
  g.drawImage(base, (player.x - 180 + HALF) * bk, (player.z - 180 + HALF) * bk, 360 * bk, 360 * bk, 0, 0, S, S);
  drawMarkers(g, S, player.x, player.z, scale, extra, true);
  g.restore();
  // O'yinchi strelkasi (doim yuqoriga qaragan)
  g.fillStyle = '#00e5ff'; g.beginPath(); g.moveTo(S / 2, S / 2 - 9); g.lineTo(S / 2 - 6, S / 2 + 7); g.lineTo(S / 2 + 6, S / 2 + 7); g.fill();
  g.strokeStyle = 'rgba(0,229,255,0.6)'; g.lineWidth = 3; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); g.stroke();
}

function drawMarkers(g, S, cx, cz, scale, extra, mini) {
  const dot = (x, z, color, r = 5, label) => {
    const [px, py] = toMap(x, z, S, cx, cz, scale);
    g.fillStyle = color; g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#000'; g.lineWidth = 1.5; g.stroke();
    if (label && !mini) { g.fillStyle = '#fff'; g.font = 'bold 12px Segoe UI'; g.textAlign = 'center'; g.fillText(label, px, py - r - 4); }
  };
  for (const p of POIS) dot(p.x, p.z, p.type === 'gas' ? '#00ff7a' : '#ffd740', mini ? 5 : 7, p.type === 'gas' ? '⛽' : 'Garaj');
  for (const r of extra.remotes) dot(r.x, r.z, '#ff4081', mini ? 4 : 6, r.name);
  for (const c of extra.traffic || []) dot(c.x, c.z, '#9aa3b5', mini ? 1.8 : 2);
  if (extra.target) dot(extra.target.x, extra.target.z, extra.target.color || '#ff1744', mini ? 6 : 9, extra.target.label);
  if (extra.waypoint) dot(extra.waypoint.x, extra.waypoint.z, '#e040fb', mini ? 5 : 8, 'GPS');
}

// Katta xarita
export function drawBigMap(canvas, player, extra) {
  if (!base) drawBase();
  const g = canvas.getContext('2d'), S = canvas.width, scale = S / (HALF * 2);
  g.clearRect(0, 0, S, S); g.drawImage(base, 0, 0, S, S);
  g.font = 'bold 16px Segoe UI'; g.textAlign = 'center';
  for (const d of DISTRICTS) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillText(d.name.toUpperCase(), (blockC(d.j) + HALF) * scale, (blockC(d.k) + HALF) * scale); }
  g.font = '11px Segoe UI';
  for (const l of LANDMARKS) { g.fillStyle = '#ffe082'; g.fillText('★ ' + l.name, (l.x + HALF) * scale, (l.z + HALF) * scale); }
  g.save(); g.fillStyle = 'rgba(200,220,255,0.55)'; g.font = '10px Segoe UI';
  for (let i = 1; i < N; i += 2) { g.fillText(STREETS_X[i], S * 0.5, (roadC(i) + HALF) * scale - 3); }
  g.restore();
  drawMarkers(g, S, 0, 0, scale, extra, false);
  const [px, py] = toMap(player.x, player.z, S, 0, 0, scale);
  g.save(); g.translate(px, py); g.rotate(-player.heading + Math.PI);
  g.fillStyle = '#00e5ff'; g.beginPath(); g.moveTo(0, -12); g.lineTo(-8, 9); g.lineTo(8, 9); g.fill(); g.restore();
}

export const bigMapToWorld = (mx, mz, S) => [mx / S * HALF * 2 - HALF, mz / S * HALF * 2 - HALF];
export function streetAt(x, z) {
  const ix = nearestRoad(x), iz = nearestRoad(z);
  const dx = Math.abs(x - roadC(ix)), dz = Math.abs(z - roadC(iz));
  if (dx < ROAD && dx <= dz) return STREETS_X[ix] || '';
  if (dz < ROAD) return STREETS_Z[iz] || '';
  const d = DISTRICTS.reduce((a, b) => (Math.hypot(blockC(b.j) - x, blockC(b.k) - z) < Math.hypot(blockC(a.j) - x, blockC(a.k) - z) ? b : a));
  return d.name;
}
