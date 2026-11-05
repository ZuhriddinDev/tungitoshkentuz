// Canvas orqali yaratiladigan teksturalar (tashqi fayllarsiz, tez yuklanadi)
import * as THREE from 'three';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }

// Bino fasadi: rang xaritasi + tunda yonadigan derazalar (emissive)
export function facadeTextures(base, frame, glass, style = 'grid') {
  const S = 512, cols = 8, rows = 16;
  const [c, g] = canvas(S, S);
  const [e, ge] = canvas(S, S);
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, S, S);
  const cw = S / cols, ch = S / rows;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const wx = x * cw, wy = y * ch;
    if (style === 'glass') {
      g.fillStyle = glass; g.fillRect(wx + 1, wy + 1, cw - 2, ch - 2);
    } else {
      g.fillStyle = frame; g.fillRect(wx + cw * 0.18, wy + ch * 0.2, cw * 0.64, ch * 0.62);
      g.fillStyle = glass; g.fillRect(wx + cw * 0.22, wy + ch * 0.25, cw * 0.56, ch * 0.52);
      if (style === 'panel') { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(wx, wy + ch - 2, cw, 2); }
    }
    if (Math.random() < 0.26) {
      const warm = ['#ffd27a', '#ffe9b0', '#fff4d6', '#cfe8ff', '#ffb36b'][Math.floor(Math.random() * 5)];
      ge.fillStyle = warm;
      ge.globalAlpha = 0.45 + Math.random() * 0.4;
      if (style === 'glass') ge.fillRect(wx + 2, wy + 2, cw - 4, ch - 4);
      else ge.fillRect(wx + cw * 0.22, wy + ch * 0.25, cw * 0.56, ch * 0.52);
      ge.globalAlpha = 1;
    }
  }
  // Pastki o'ng burchak — tom uchun (qorong'i)
  g.fillStyle = '#2b2b2b'; g.fillRect(S - 8, S - 8, 8, 8);
  ge.fillStyle = '#000'; ge.fillRect(S - 8, S - 8, 8, 8);
  const map = new THREE.CanvasTexture(c), emissiveMap = new THREE.CanvasTexture(e);
  for (const t of [map, emissiveMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; }
  return { map, emissiveMap };
}

export function asphaltTexture() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#2a2b2e'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) {
    const v = 30 + Math.random() * 30;
    g.fillStyle = `rgb(${v},${v},${v + 3})`; g.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function tileTexture(a = '#8d8a83', b = '#7c7972') {
  const [c, g] = canvas(128, 128);
  g.fillStyle = a; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = b; g.lineWidth = 2;
  for (let i = 0; i <= 128; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function grassTexture() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#2f5a24'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1500; i++) { g.fillStyle = Math.random() < 0.5 ? '#3a6d2c' : '#27491e'; g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Reklama ekranlari va peshlavhalar uchun matnli tekstura
export function signTexture(lines, { bg = '#0b0f2a', fg = '#ffffff', accent = '#00e5ff', w = 512, h = 256 } = {}) {
  const [c, g] = canvas(w, h);
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, bg); grad.addColorStop(1, '#000');
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  g.strokeStyle = accent; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((ln, i) => {
    const size = i === 0 ? h * 0.26 : h * 0.14;
    g.font = `bold ${size}px "Segoe UI", Arial, sans-serif`;
    g.fillStyle = i === 0 ? fg : accent;
    g.shadowColor = accent; g.shadowBlur = 18;
    g.fillText(ln, w / 2, h * (lines.length === 1 ? 0.5 : 0.36 + i * 0.3));
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const ADS = [
  [['UZCARD', 'Har bir to\'lov — bonus'], '#0d47a1', '#4fc3f7'],
  [['CLICK', 'Bir tugma bilan to\'lang'], '#004d40', '#64ffda'],
  [['TOSHKENT SITI', 'Kelajak shahri'], '#1a0033', '#e040fb'],
  [['UZAUTO MOTORS', 'Malibu Premier — salonlarda'], '#0b0f2a', '#ffd740'],
  [['MILLIY TAOM', 'Osh markazi 24/7'], '#3e1a00', '#ffab40'],
  [['BEELINE', '5G Toshkentda'], '#1c1c00', '#ffeb3b'],
  [['UCELL', 'Cheksiz internet'], '#2a0036', '#ce93d8'],
  [['PAYME', 'Tez. Oson. Xavfsiz'], '#002a33', '#26c6da'],
  [['MAGIC CITY', 'Oilaviy dam olish'], '#33001a', '#ff4081'],
  [['KORZINKA', 'Har kuni arzon'], '#3b0000', '#ff5252'],
];

