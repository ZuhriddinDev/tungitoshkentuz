// Klaviatura, sichqoncha (360° kamera) va iPhone/Android uchun avtomatik gorizontal (landscape) tugmali boshqaruv (V9)
const keys = new Set();
const touch = { up: 0, down: 0, left: 0, right: 0, boost: 0, brake: 0, drift: 0 };
const hot = new Map();
export const cam = { yaw: 0, pitch: 0.25, dist: 9, lastMove: 0 };
let enabled = true;

// Telefon avtomatik 90° gorizontal rejimda (auto-landscape-rot) bo'lganda barmoq koordinatalarini o'girish
export function getLandscapePointerXY(e) {
  if (document.body.classList.contains('auto-landscape-rot')) {
    const vw = window.visualViewport?.width || window.innerWidth;
    return {
      x: e.clientY,
      y: vw - e.clientX,
    };
  }
  return {
    x: e.clientX,
    y: e.clientY,
  };
}

export function onKey(code, fn) { hot.set(code, fn); }
export function setEnabled(v) {
  enabled = v;
  if (!v) {
    keys.clear();
    for (const k of Object.keys(touch)) touch[k] = 0;
    document.querySelectorAll('[data-touch].on').forEach((b) => b.classList.remove('on'));
  }
}

export function initInput(canvas) {
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      if (e.code === 'Escape') e.target.blur?.();
      return;
    }
    if (hot.has(e.code) && !e.repeat) { e.preventDefault(); hot.get(e.code)(); return; }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (enabled) {
      keys.add(e.code);
      if (e.key) keys.add(e.key.toLowerCase());
    }
  });
  addEventListener('keyup', (e) => {
    keys.delete(e.code);
    if (e.key) keys.delete(e.key.toLowerCase());
  });
  const clearAllInputs = () => {
    keys.clear();
    for (const k of Object.keys(touch)) touch[k] = 0;
    activePointers.clear();
    document.querySelectorAll('[data-touch].on').forEach((b) => b.classList.remove('on'));
  };
  addEventListener('blur', clearAllInputs);
  addEventListener('visibilitychange', () => {
    if (document.hidden) clearAllInputs();
  });

  // Sichqoncha / barmoq: bo'sh joyni bosib sudrash — kamerani 360° aylantirish (avtomatik gorizontal rejimga mos)
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
      document.activeElement.blur?.();
    }
    if (drag) return;
    const pt = getLandscapePointerXY(e);
    drag = { x: pt.x, y: pt.y, id: e.pointerId };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const pt = getLandscapePointerXY(e);
    const s = (window.__sens || 1) * 0.005;
    cam.yaw -= (pt.x - drag.x) * s;
    cam.pitch = Math.max(-0.05, Math.min(1.2, cam.pitch + (pt.y - drag.y) * s));
    drag.x = pt.x;
    drag.y = pt.y;
    cam.lastMove = performance.now();
  });
  const end = (e) => { if (drag && drag.id === e.pointerId) drag = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', (e) => { cam.dist = Math.max(5, Math.min(22, cam.dist + e.deltaY * 0.01)); }, { passive: true });

  // Sensorli tugmalar (multi-touch qo'llab-quvvatlanadi: Gaz + Chap/O'ng + Drift/Nitro bir vaqtda ishlaydi)
  const activePointers = new Map(); // pointerId -> { k, el }
  document.querySelectorAll('[data-touch]').forEach((b) => {
    const k = b.dataset.touch;
    const on = (e) => {
      e.preventDefault();
      e.stopPropagation();
      try { b.setPointerCapture(e.pointerId); } catch { /* */ }
      activePointers.set(e.pointerId, { k, el: b });
      touch[k] = 1;
      b.classList.add('on');
    };
    const off = (e) => {
      e.preventDefault();
      const prev = activePointers.get(e.pointerId);
      if (prev) {
        activePointers.delete(e.pointerId);
        const stillHeld = [...activePointers.values()].some((x) => x.k === prev.k);
        if (!stillHeld) {
          touch[prev.k] = 0;
          prev.el.classList.remove('on');
        }
      } else {
        touch[k] = 0;
        b.classList.remove('on');
      }
    };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('lostpointercapture', off);
    b.addEventListener('pointerleave', (e) => {
      if (!b.hasPointerCapture?.(e.pointerId)) off(e);
    });
  });

  // Chap/O'ng tugmalarda barmoqni uzmasdan surish (Slide-to-steer — har qanday orientatsiyada aniq ishlaydi)
  const steerPad = document.getElementById('steerPad');
  if (steerPad) {
    const leftBtn = steerPad.querySelector('[data-touch="left"]');
    const rightBtn = steerPad.querySelector('[data-touch="right"]');
    steerPad.addEventListener('pointermove', (e) => {
      const entry = activePointers.get(e.pointerId);
      if (!entry || (entry.k !== 'left' && entry.k !== 'right') || !leftBtn || !rightBtn) return;
      const lr = leftBtn.getBoundingClientRect();
      const rr = rightBtn.getBoundingClientRect();
      const dLeft = Math.hypot(e.clientX - (lr.left + lr.width / 2), e.clientY - (lr.top + lr.height / 2));
      const dRight = Math.hypot(e.clientX - (rr.left + rr.width / 2), e.clientY - (rr.top + rr.height / 2));
      const wantKey = dLeft <= dRight ? 'left' : 'right';
      if (wantKey !== entry.k) {
        touch[entry.k] = 0;
        entry.el.classList.remove('on');
        entry.k = wantKey;
        entry.el = wantKey === 'left' ? leftBtn : rightBtn;
        touch[wantKey] = 1;
        entry.el.classList.add('on');
      }
    });
  }

  document.querySelectorAll('[data-hotkey]').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      hot.get(b.dataset.hotkey)?.();
    })
  );

  // Minimap bosilganda katta xaritani ochish
  const mm = document.getElementById('minimap');
  if (mm) {
    mm.style.pointerEvents = 'auto';
    mm.style.cursor = 'pointer';
    mm.addEventListener('click', () => hot.get('KeyM')?.());
  }

  // To'liq ekran va gorizontal (landscape) aylantirish tugmasi
  document.querySelectorAll('[data-fullscreen]').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().then(() => {
          screen.orientation?.lock?.('landscape').catch(() => {});
        }).catch(() => {});
        screen.orientation?.lock?.('landscape').catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    })
  );
}

export function readDrive() {
  if (!enabled) return { throttle: 0, reverse: 0, steer: 0, boost: false, handbrake: false, drift: false };
  const k = (...codes) => codes.some((c) => keys.has(c));
  const up = k('KeyW', 'ArrowUp', 'w', 'ц') || touch.up;
  const down = k('KeyS', 'ArrowDown', 's', 'ы') || touch.down;
  const left = k('KeyA', 'ArrowLeft', 'a', 'ф') || touch.left;
  const right = k('KeyD', 'ArrowRight', 'd', 'в') || touch.right;
  // O'ngga burilish: steer > 0 (+X), Chapga burilish: steer < 0 (-X)
  const steer = (right ? 1 : 0) - (left ? 1 : 0);
  return {
    throttle: up ? 1 : 0,
    reverse: down ? 1 : 0,
    steer,
    boost: !!(k('ShiftLeft', 'ShiftRight') || touch.boost),
    handbrake: !!(k('Space') || touch.brake),
    drift: !!(k('KeyQ', 'ControlLeft', 'ControlRight', 'q', 'й') || touch.drift),
  };
}

export const isTouch = () =>
  matchMedia('(pointer: coarse)').matches ||
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 0 && Math.min(innerWidth, innerHeight) < 950);

// Boshqaruv turi va telefon uchun avtomatik gorizontal (landscape) rejimni qo'llash
export function applyControl(mode = 'auto', _steerType = 'buttons', touchScale = 'normal') {
  const phone = mode === 'phone' || (mode === 'auto' && isTouch()) || isTouch();
  const vv = window.visualViewport;
  const rawW = vv && vv.width > 0 ? vv.width : (document.documentElement.clientWidth || window.innerWidth);
  const rawH = vv && vv.height > 0 ? vv.height : (document.documentElement.clientHeight || window.innerHeight);
  const autoRotateToLandscape = phone && rawH > rawW;

  const w = Math.max(240, Math.round(autoRotateToLandscape ? rawH : rawW));
  const h = Math.max(180, Math.round(autoRotateToLandscape ? rawW : rawH));
  document.documentElement.style.setProperty('--app-w', `${w}px`);
  document.documentElement.style.setProperty('--app-h', `${h}px`);

  document.body.classList.toggle('phone', phone);
  document.body.classList.toggle('pc', !phone);
  document.body.classList.toggle('auto-landscape-rot', autoRotateToLandscape);
  document.body.classList.remove('is-portrait');
  document.body.classList.add('is-landscape');
  document.body.classList.remove('steer-wheel');
  document.body.classList.add('steer-buttons');
  document.body.classList.toggle('scale-large', touchScale === 'large');
  return phone ? 'phone' : 'pc';
}
