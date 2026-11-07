// Klaviatura, sichqoncha (360° kamera) va iPhone/Android uchun zamonaviy tugmali sensorli boshqaruv (V9)
const keys = new Set();
const touch = { up: 0, down: 0, left: 0, right: 0, boost: 0, brake: 0, drift: 0 };
const hot = new Map();
export const cam = { yaw: 0, pitch: 0.25, dist: 9, lastMove: 0 };
let enabled = true;

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
    if (enabled) keys.add(e.code);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => {
    keys.clear();
    for (const k of Object.keys(touch)) touch[k] = 0;
    document.querySelectorAll('[data-touch].on').forEach((b) => b.classList.remove('on'));
  });

  // Sichqoncha / barmoq: bo'sh joyni bosib sudrash — kamerani 360° aylantirish
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (drag) return;
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const s = (window.__sens || 1) * 0.005;
    cam.yaw -= (e.clientX - drag.x) * s;
    cam.pitch = Math.max(-0.05, Math.min(1.2, cam.pitch + (e.clientY - drag.y) * s));
    drag.x = e.clientX; drag.y = e.clientY; cam.lastMove = performance.now();
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
  });

  // Chap/O'ng tugmalarda barmoqni uzmasdan surish (Slide-to-steer)
  const steerPad = document.getElementById('steerPad');
  if (steerPad) {
    const leftBtn = steerPad.querySelector('[data-touch="left"]');
    const rightBtn = steerPad.querySelector('[data-touch="right"]');
    steerPad.addEventListener('pointermove', (e) => {
      const entry = activePointers.get(e.pointerId);
      if (!entry || (entry.k !== 'left' && entry.k !== 'right')) return;
      const rect = steerPad.getBoundingClientRect();
      const mid = rect.left + rect.width / 2;
      const wantKey = e.clientX < mid ? 'left' : 'right';
      if (wantKey !== entry.k && leftBtn && rightBtn) {
        touch[entry.k] = 0;
        entry.el.classList.remove('on');
        entry.k = wantKey;
        entry.el = wantKey === 'left' ? leftBtn : rightBtn;
        touch[wantKey] = 1;
        entry.el.classList.add('on');
      }
    });
  }

  // Portret eslatmasini yopish
  const closeRotate = document.getElementById('closeRotateHint');
  if (closeRotate) {
    closeRotate.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('rotateHint')?.classList.add('dismissed');
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
  const k = (c) => keys.has(c);
  const up = k('KeyW') || k('ArrowUp') || touch.up;
  const down = k('KeyS') || k('ArrowDown') || touch.down;
  const left = k('KeyA') || k('ArrowLeft') || touch.left;
  const right = k('KeyD') || k('ArrowRight') || touch.right;
  const steer = (left ? 1 : 0) - (right ? 1 : 0);
  return {
    throttle: up ? 1 : 0,
    reverse: down ? 1 : 0,
    steer,
    boost: !!(k('ShiftLeft') || k('ShiftRight') || touch.boost),
    handbrake: !!(k('Space') || touch.brake),
    drift: !!(k('KeyQ') || k('ControlLeft') || touch.drift),
  };
}

export const isTouch = () =>
  matchMedia('(pointer: coarse)').matches ||
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 0 && Math.min(innerWidth, innerHeight) < 950);

// Boshqaruv turi va mobil tugma o'lchami sozlamalarini qo'llash (V9: doimo tugmali boshqaruv)
export function applyControl(mode = 'auto', _steerType = 'buttons', touchScale = 'normal') {
  const phone = mode === 'phone' || (mode === 'auto' && isTouch());
  const isPortrait = innerHeight > innerWidth;
  document.body.classList.toggle('phone', phone);
  document.body.classList.toggle('pc', !phone);
  document.body.classList.toggle('is-portrait', isPortrait);
  document.body.classList.toggle('is-landscape', !isPortrait);
  document.body.classList.remove('steer-wheel');
  document.body.classList.add('steer-buttons');
  document.body.classList.toggle('scale-large', touchScale === 'large');
  return phone ? 'phone' : 'pc';
}
