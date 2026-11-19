// Yuqori sifatli protseduraviy PBR teksturalar (map + bumpMap + roughnessMap + emissiveMap)
import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

// Bino fasadi: rang + tungi deraza emissive + roughness + me'moriy relyef (bumpMap)
export function facadeTextures(base, frame, glass, style = 'grid') {
  const S = 512, cols = 8, rows = 16;
  const [c, g] = canvas(S, S);
  const [e, ge] = canvas(S, S);
  const [r, gr] = canvas(S, S);
  const [b, gb] = canvas(S, S);

  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  ge.fillStyle = '#000';
  ge.fillRect(0, 0, S, S);
  gr.fillStyle = style === 'glass' ? '#363636' : '#d2d2d2';
  gr.fillRect(0, 0, S, S);
  gb.fillStyle = '#909090';
  gb.fillRect(0, 0, S, S);

  // Tabiiy travertin / marmar / beton mikro-faktura
  for (let i = 0; i < 2400; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    g.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.04)';
    g.fillRect(x, y, 3, 2);
    gb.fillStyle = i % 2 === 0 ? '#a4a4a4' : '#7a7a7a';
    gb.fillRect(x, y, 2, 2);
  }

  const cw = S / cols, ch = S / rows;
  for (let y = 0; y < rows; y++) {
    // Har qavat orasidagi me'moriy gorizontal karniz (slab edge)
    const fy = y * ch;
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(0, fy, S, 2.5);
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.fillRect(0, fy + 2.5, S, 1.5);
    gb.fillStyle = '#c8c8c8';
    gb.fillRect(0, fy, S, 3);

    for (let x = 0; x < cols; x++) {
      const wx = x * cw, wy = fy;
      if (style === 'glass') {
        // Zamonaviy ko'p qavatli oyna fasad (curtain wall) + diagonal osmon refleksi
        const grad = g.createLinearGradient(wx, wy, wx + cw, wy + ch);
        grad.addColorStop(0, glass);
        grad.addColorStop(0.55, '#1b3554');
        grad.addColorStop(1, '#0e1d30');
        g.fillStyle = grad;
        g.fillRect(wx + 2, wy + 2, cw - 4, ch - 3);
        g.fillStyle = 'rgba(210,235,255,0.13)';
        g.beginPath();
        g.moveTo(wx + 3, wy + 3);
        g.lineTo(wx + cw * 0.58, wy + 3);
        g.lineTo(wx + cw * 0.25, wy + ch - 3);
        g.lineTo(wx + 3, wy + ch - 3);
        g.closePath();
        g.fill();
        // Alyuminiy mullion romi
        g.fillStyle = frame;
        g.fillRect(wx, wy, cw, 2.2);
        g.fillRect(wx, wy, 2.2, ch);
        gr.fillStyle = '#121212';
        gr.fillRect(wx + 2, wy + 2, cw - 4, ch - 3);
        gb.fillStyle = '#404040';
        gb.fillRect(wx + 2, wy + 2, cw - 4, ch - 3);
      } else {
        // Chuqur deraza o'rni, rom, tokcha va ichki xona chuqurligi
        g.fillStyle = 'rgba(0,0,0,0.34)';
        g.fillRect(wx + cw * 0.14, wy + ch * 0.16, cw * 0.72, ch * 0.68);
        g.fillStyle = frame;
        g.fillRect(wx + cw * 0.17, wy + ch * 0.19, cw * 0.66, ch * 0.62);
        const wGrad = g.createLinearGradient(wx, wy + ch * 0.24, wx, wy + ch * 0.76);
        wGrad.addColorStop(0, '#0f1722');
        wGrad.addColorStop(0.5, glass);
        wGrad.addColorStop(1, '#1e2c3a');
        g.fillStyle = wGrad;
        g.fillRect(wx + cw * 0.21, wy + ch * 0.24, cw * 0.58, ch * 0.52);

        // Deraza bo'linmasi (mullions)
        g.fillStyle = frame;
        g.fillRect(wx + cw * 0.49, wy + ch * 0.23, cw * 0.035, ch * 0.54);
        g.fillRect(wx + cw * 0.20, wy + ch * 0.44, cw * 0.60, ch * 0.035);

        // Deraza tokchasi (window sill highlight)
        g.fillStyle = 'rgba(255,255,255,0.22)';
        g.fillRect(wx + cw * 0.15, wy + ch * 0.80, cw * 0.70, ch * 0.055);

        gr.fillStyle = '#181818';
        gr.fillRect(wx + cw * 0.21, wy + ch * 0.24, cw * 0.58, ch * 0.52);
        gb.fillStyle = '#303030';
        gb.fillRect(wx + cw * 0.17, wy + ch * 0.19, cw * 0.66, ch * 0.62);
        gb.fillStyle = '#e0e0e0';
        gb.fillRect(wx + cw * 0.15, wy + ch * 0.80, cw * 0.70, ch * 0.06);

        if (style === 'panel') {
          g.fillStyle = 'rgba(0,0,0,0.18)';
          g.fillRect(wx, wy + ch - 2, cw, 2);
          g.fillRect(wx + cw - 1.5, wy, 1.5, ch);
          gb.fillStyle = '#555555';
          gb.fillRect(wx, wy + ch - 2, cw, 2);
        }
      }

      // Tunda jonli yonadigan derazalar (issiq uy nuri, ofis oq/moviy nuri, parda soyasi)
      if (Math.random() < 0.36) {
        const warm = ['#ffd479', '#ffebb3', '#fff5dc', '#cbe8ff', '#ffb066', '#9eefff'][Math.floor(Math.random() * 6)];
        const ex = style === 'glass' ? wx + 3 : wx + cw * 0.22;
        const ey = style === 'glass' ? wy + 3 : wy + ch * 0.25;
        const ew = style === 'glass' ? cw - 6 : cw * 0.56;
        const eh = style === 'glass' ? ch - 6 : ch * 0.50;
        const eg = ge.createLinearGradient(ex, ey, ex, ey + eh);
        eg.addColorStop(0, warm);
        eg.addColorStop(1, '#3b2410');
        ge.fillStyle = eg;
        ge.globalAlpha = 0.58 + Math.random() * 0.40;
        ge.fillRect(ex, ey, ew, eh);
        ge.globalAlpha = 1;
      }
    }
  }

  // Tom uchun qorong'i burchak
  g.fillStyle = '#20242c';
  g.fillRect(S - 8, S - 8, 8, 8);
  ge.fillStyle = '#000';
  ge.fillRect(S - 8, S - 8, 8, 8);
  gr.fillStyle = '#e6e6e6';
  gr.fillRect(S - 8, S - 8, 8, 8);
  gb.fillStyle = '#808080';
  gb.fillRect(S - 8, S - 8, 8, 8);

  const map = new THREE.CanvasTexture(c);
  const emissiveMap = new THREE.CanvasTexture(e);
  const roughnessMap = new THREE.CanvasTexture(r);
  const bumpMap = new THREE.CanvasTexture(b);
  for (const t of [map, emissiveMap, roughnessMap, bumpMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
  }
  map.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  return { map, emissiveMap, roughnessMap, bumpMap };
}

export function asphaltPBR() {
  const S = 512;
  const [c, g] = canvas(S, S);
  const [r, gr] = canvas(S, S);
  const [b, gb] = canvas(S, S);

  g.fillStyle = '#1b1d24';
  g.fillRect(0, 0, S, S);
  gr.fillStyle = '#989898';
  gr.fillRect(0, 0, S, S);
  gb.fillStyle = '#808080';
  gb.fillRect(0, 0, S, S);

  // Zich asfalt donachalari (mineral aggregate)
  for (let i = 0; i < 14000; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const v = 20 + Math.random() * 32;
    g.fillStyle = `rgb(${v},${v + 1},${v + 5})`;
    g.fillRect(x, y, 1.8, 1.8);
    const bv = 95 + Math.floor(Math.random() * 65);
    gb.fillStyle = `rgb(${bv},${bv},${bv})`;
    gb.fillRect(x, y, 1.8, 1.8);
  }

  // Yarim-nam asfalt dog'lari (puddle roughness variation — ko'cha chiroqlarini aks ettiradi)
  for (let p = 0; p < 16; p++) {
    const px = Math.random() * S;
    const py = Math.random() * S;
    const rad = 28 + Math.random() * 58;
    const rg = gr.createRadialGradient(px, py, 4, px, py, rad);
    rg.addColorStop(0, 'rgba(28, 28, 28, 0.85)');
    rg.addColorStop(0.65, 'rgba(65, 65, 65, 0.45)');
    rg.addColorStop(1, 'rgba(150, 150, 150, 0)');
    gr.fillStyle = rg;
    gr.beginPath();
    gr.arc(px, py, rad, 0, Math.PI * 2);
    gr.fill();
  }

  // Nozik asfalt yoriqlari va g'ildirak izlari
  g.strokeStyle = 'rgba(8,10,14,0.42)';
  g.lineWidth = 1.2;
  for (let k = 0; k < 18; k++) {
    g.beginPath();
    const x0 = Math.random() * S, y0 = Math.random() * S;
    g.moveTo(x0, y0);
    g.lineTo(x0 + (Math.random() - 0.5) * 65, y0 + (Math.random() - 0.5) * 65);
    g.stroke();
  }

  const map = new THREE.CanvasTexture(c);
  const roughnessMap = new THREE.CanvasTexture(r);
  const bumpMap = new THREE.CanvasTexture(b);
  for (const t of [map, roughnessMap, bumpMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
  }
  map.colorSpace = THREE.SRGBColorSpace;
  return { map, roughnessMap, bumpMap };
}

export function asphaltTexture() {
  return asphaltPBR().map;
}

export function tileTexture(a = '#8b8a85', b = '#6e6d68') {
  const S = 256;
  const [c, g] = canvas(S, S);
  g.fillStyle = a;
  g.fillRect(0, 0, S, S);
  const step = 32;
  for (let y = 0; y < S; y += step) {
    const off = ((y / step) % 2) * (step / 2);
    for (let x = -step; x < S + step; x += step) {
      const shade = 122 + (((x * 7 + y * 13) & 15) - 7);
      g.fillStyle = `rgb(${shade},${shade - 1},${shade - 5})`;
      g.fillRect(x + off + 1, y + 1, step - 2, step - 2);
    }
  }
  g.strokeStyle = b;
  g.lineWidth = 1.5;
  for (let y = 0; y <= S; y += step) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(S, y);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function grassTexture() {
  const S = 256;
  const [c, g] = canvas(S, S);
  g.fillStyle = '#295220';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 4200; i++) {
    const r = Math.random();
    g.fillStyle = r < 0.35 ? '#356928' : r < 0.7 ? '#21421a' : '#3d742d';
    g.fillRect(Math.random() * S, Math.random() * S, 2, 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function waterBumpTexture() {
  const S = 256;
  const [c, g] = canvas(S, S);
  g.fillStyle = '#808080';
  g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 6) {
    for (let x = 0; x < S; x += 24) {
      const wave = 110 + Math.floor(Math.sin(x * 0.14 + y * 0.22) * 32);
      g.fillStyle = `rgb(${wave},${wave},${wave})`;
      g.fillRect(x, y, 18, 3);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 60);
  return t;
}

// Reklama ekranlari va peshlavhalar uchun matnli tekstura
export function signTexture(lines, { bg = '#0b0f2a', fg = '#ffffff', accent = '#00e5ff', w = 512, h = 256 } = {}) {
  const [c, g] = canvas(w, h);
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, bg);
  grad.addColorStop(1, '#000');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = accent;
  g.lineWidth = 8;
  g.strokeRect(6, 6, w - 12, h - 12);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  lines.forEach((ln, i) => {
    const size = i === 0 ? h * 0.26 : h * 0.14;
    g.font = `bold ${size}px "Segoe UI", Arial, sans-serif`;
    g.fillStyle = i === 0 ? fg : accent;
    g.shadowColor = accent;
    g.shadowBlur = 18;
    g.fillText(ln, w / 2, h * (lines.length === 1 ? 0.5 : 0.36 + i * 0.3));
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
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
