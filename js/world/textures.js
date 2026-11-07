// Canvas orqali yaratiladigan teksturalar (tashqi fayllarsiz, tez yuklanadi)
import * as THREE from 'three';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }

// Bino fasadi: rang xaritasi + tunda yonadigan derazalar (emissive)
export function facadeTextures(base, frame, glass, style = 'grid') {
  const S = 512, cols = 8, rows = 16;
  const [c, g] = canvas(S, S);
  const [e, ge] = canvas(S, S);
  const [r, gr] = canvas(S, S);
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, S, S);
  gr.fillStyle = style === 'glass' ? '#404040' : '#d8d8d8'; gr.fillRect(0, 0, S, S);

  // Fasad ustida tabiiy travertin / beton mikro-faktura
  for (let i = 0; i < 1800; i++) {
    g.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.035)';
    g.fillRect(Math.random() * S, Math.random() * S, 3, 2);
  }

  const cw = S / cols, ch = S / rows;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const wx = x * cw, wy = y * ch;
    if (style === 'glass') {
      g.fillStyle = glass; g.fillRect(wx + 2, wy + 2, cw - 4, ch - 3);
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(wx + 3, wy + 3, (cw - 6) * 0.45, ch - 6);
      gr.fillStyle = '#181818'; gr.fillRect(wx + 2, wy + 2, cw - 4, ch - 3);
    } else {
      // Deraza chuqurchasi va romi (mullions + sill)
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(wx + cw * 0.15, wy + ch * 0.17, cw * 0.70, ch * 0.66);
      g.fillStyle = frame; g.fillRect(wx + cw * 0.18, wy + ch * 0.2, cw * 0.64, ch * 0.62);
      g.fillStyle = glass; g.fillRect(wx + cw * 0.22, wy + ch * 0.25, cw * 0.56, ch * 0.52);
      // Deraza o'rtasidagi vertikal va gorizontal bo'linma (frame mullion)
      g.fillStyle = frame;
      g.fillRect(wx + cw * 0.49, wy + ch * 0.24, cw * 0.03, ch * 0.54);
      g.fillRect(wx + cw * 0.21, wy + ch * 0.44, cw * 0.58, ch * 0.03);
      // Tokcha (window sill)
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(wx + cw * 0.16, wy + ch * 0.80, cw * 0.68, ch * 0.05);
      // Oyna yuzasi silliq (past roughness)
      gr.fillStyle = '#1f1f1f';
      gr.fillRect(wx + cw * 0.22, wy + ch * 0.25, cw * 0.56, ch * 0.52);
      if (style === 'panel') {
        g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(wx, wy + ch - 2, cw, 2);
        g.fillRect(wx + cw - 1.5, wy, 1.5, ch);
      }
    }
    if (Math.random() < 0.32) {
      const warm = ['#ffd27a', '#ffe9b0', '#fff4d6', '#cfe8ff', '#ffb36b', '#a5f3fc'][Math.floor(Math.random() * 6)];
      ge.fillStyle = warm;
      ge.globalAlpha = 0.5 + Math.random() * 0.42;
      if (style === 'glass') ge.fillRect(wx + 3, wy + 3, cw - 6, ch - 6);
      else ge.fillRect(wx + cw * 0.23, wy + ch * 0.26, cw * 0.54, ch * 0.50);
      ge.globalAlpha = 1;
    }
  }
  // Pastki o'ng burchak — tom uchun (qorong'i)
  g.fillStyle = '#252830'; g.fillRect(S - 8, S - 8, 8, 8);
  ge.fillStyle = '#000'; ge.fillRect(S - 8, S - 8, 8, 8);
  gr.fillStyle = '#e0e0e0'; gr.fillRect(S - 8, S - 8, 8, 8);
  const map = new THREE.CanvasTexture(c);
  const emissiveMap = new THREE.CanvasTexture(e);
  const roughnessMap = new THREE.CanvasTexture(r);
  for (const t of [map, emissiveMap, roughnessMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
  }
  map.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  return { map, emissiveMap, roughnessMap };
}

export function asphaltTexture() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#1e2026'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5500; i++) {
    const v = 22 + Math.random() * 28;
    g.fillStyle = `rgb(${v},${v + 1},${v + 5})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
  }
  // Nozik shina izlari va mikro-yoriqlar
  g.strokeStyle = 'rgba(10,12,16,0.35)';
  g.lineWidth = 1;
  for (let k = 0; k < 12; k++) {
    g.beginPath();
    const x0 = Math.random() * 256, y0 = Math.random() * 256;
    g.moveTo(x0, y0);
    g.lineTo(x0 + (Math.random() - 0.5) * 35, y0 + (Math.random() - 0.5) * 35);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
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

