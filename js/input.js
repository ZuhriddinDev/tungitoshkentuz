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

let gameCanvas = null;
let cursorHideTimer = 0;

function showCanvasCursor() {
  if (!gameCanvas) return;
  gameCanvas.style.cursor = '';
  clearTimeout(cursorHideTimer);
  if (enabled && !isTouch() && document.pointerLockElement !== gameCanvas) {
    cursorHideTimer = setTimeout(() => {
      if (enabled && !isTouch() && document.pointerLockElement !== gameCanvas) {
        gameCanvas.style.cursor = 'none';
      }
    }, 1800);
  }
}

export function onKey(code, fn) { hot.set(code, fn); }
export function setEnabled(v) {
  enabled = v;
  if (!v) {
    keys.clear();
    for (const k of Object.keys(touch)) touch[k] = 0;
    document.querySelectorAll('[data-touch].on').forEach((b) => b.classList.remove('on'));
    clearTimeout(cursorHideTimer);
    if (gameCanvas) gameCanvas.style.cursor = '';
    if (document.pointerLockElement) {
      try { document.exitPointerLock(); } catch { /* */ }
    }
  } else {
    showCanvasCursor();
  }
}

export function initInput(canvas) {
  gameCanvas = canvas;
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      if (e.code === 'Escape') e.target.blur?.();
      return;
    }
    if (enabled && !isTouch() && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      if (gameCanvas && document.pointerLockElement !== gameCanvas) {
        clearTimeout(cursorHideTimer);
        gameCanvas.style.cursor = 'none';
      }
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
  const activePointers = new Map(); // pointerId -> { k, el }
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

  // Sichqoncha / barmoq:
  // - PC da canvas ustiga bosilganda Pointer Lock yoqiladi (mishka ekranda xalaqit bermaydi, erkin 360° kamera)
  // - Agar haydovchi klaviaturada haydasa va mishkaga tegmasa, kursor avtomatik yashiriladi
  // - Mobil/touch va drag rejimida esa barmoq bilan sudrab aylantirish ishlaydi
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
      document.activeElement.blur?.();
    }
    if (enabled && !isTouch() && e.pointerType === 'mouse' && document.pointerLockElement !== canvas) {
      const hud = document.getElementById('hud');
      if (hud && !hud.classList.contains('hidden')) {
        try { canvas.requestPointerLock?.(); } catch { /* */ }
      }
    }
    if (drag) return;
    const pt = getLandscapePointerXY(e);
    drag = { x: pt.x, y: pt.y, id: e.pointerId };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (document.pointerLockElement === canvas && enabled) {
      const s = (window.__sens || 1) * 0.0032;
      cam.yaw -= (e.movementX || 0) * s;
      cam.pitch = Math.max(-0.05, Math.min(1.2, cam.pitch + (e.movementY || 0) * s));
      cam.lastMove = performance.now();
      return;
    }
    if (!isTouch() && e.pointerType === 'mouse') {
      showCanvasCursor();
    }
    if (!drag || drag.id !== e.pointerId) return;
    const pt = getLandscapePointerXY(e);
    const s = (window.__sens || 1) * 0.005;
    cam.yaw -= (pt.x - drag.x) * s;
    cam.pitch = Math.max(-0.05, Math.min(1.2, cam.pitch + (pt.y - drag.y) * s));
    drag.x = pt.x;
    drag.y = pt.y;
    cam.lastMove = performance.now();
  });
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvas) {
      clearTimeout(cursorHideTimer);
      canvas.style.cursor = 'none';
    } else {
      showCanvasCursor();
    }
  });
  const end = (e) => { if (drag && drag.id === e.pointerId) drag = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', (e) => { cam.dist = Math.max(5, Math.min(22, cam.dist + e.deltaY * 0.01)); }, { passive: true });

  // Sensorli pedallar va tugmalar (Gaz, Tormoz, Drift) — multi-touch qo'llab-quvvatlanadi
  document.querySelectorAll('[data-touch]').forEach((b) => {
    const k = b.dataset.touch;
    if (k === 'left' || k === 'right') return; // Rul tugmalari steerPad orqali mustaqil boshqariladi

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
      activePointers.delete(e.pointerId);
      const stillHeld = [...activePointers.values()].some((x) => x.k === k);
      if (!stillHeld) {
        touch[k] = 0;
        b.classList.remove('on');
      }
    };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('lostpointercapture', off);
  });

  // Chap/O'ng Rul Boshqaruvi (V14 — Bir zumda sezuvchi, barmoqni uzmasdan surish va qotib qolmaydigan sensor)
  const steerPad = document.getElementById('steerPad');
  if (steerPad) {
    const leftBtn = steerPad.querySelector('[data-touch="left"]');
    const rightBtn = steerPad.querySelector('[data-touch="right"]');

    const updateSteerFromCoord = (clientX, clientY) => {
      if (!leftBtn || !rightBtn) return;
      const lr = leftBtn.getBoundingClientRect();
      const rr = rightBtn.getBoundingClientRect();
      const dL = Math.hypot(clientX - (lr.left + lr.width / 2), clientY - (lr.top + lr.height / 2));
      const dR = Math.hypot(clientX - (rr.left + rr.width / 2), clientY - (rr.top + rr.height / 2));
      const wantLeft = dL <= dR;

      touch.left = wantLeft ? 1 : 0;
      touch.right = wantLeft ? 0 : 1;
      leftBtn.classList.toggle('on', wantLeft);
      rightBtn.classList.toggle('on', !wantLeft);
    };

    let steerPointerId = null;

    const onSteerDown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      steerPointerId = e.pointerId;
      try { steerPad.setPointerCapture(e.pointerId); } catch { /* */ }
      updateSteerFromCoord(e.clientX, e.clientY);
    };

    const onSteerMove = (e) => {
      if (steerPointerId === null || steerPointerId !== e.pointerId) return;
      e.preventDefault();
      updateSteerFromCoord(e.clientX, e.clientY);
    };

    const onSteerUp = (e) => {
      if (steerPointerId === e.pointerId || steerPointerId === null) {
        steerPointerId = null;
        touch.left = 0;
        touch.right = 0;
        leftBtn?.classList.remove('on');
        rightBtn?.classList.remove('on');
      }
    };

    steerPad.addEventListener('pointerdown', onSteerDown);
    steerPad.addEventListener('pointermove', onSteerMove);
    steerPad.addEventListener('pointerup', onSteerUp);
    steerPad.addEventListener('pointercancel', onSteerUp);
    steerPad.addEventListener('lostpointercapture', onSteerUp);

    // iOS Safari va eski WebKit uchun to'g'ridan-to'g'ri Touch Eventlar
    steerPad.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const t = e.targetTouches[0];
      if (t) updateSteerFromCoord(t.clientX, t.clientY);
    }, { passive: false });

    steerPad.addEventListener('touchmove', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const t = e.targetTouches[0];
      if (t) updateSteerFromCoord(t.clientX, t.clientY);
    }, { passive: false });

    const endTouch = (e) => {
      e.preventDefault();
      touch.left = 0;
      touch.right = 0;
      leftBtn?.classList.remove('on');
      rightBtn?.classList.remove('on');
    };
    steerPad.addEventListener('touchend', endTouch, { passive: false });
    steerPad.addEventListener('touchcancel', endTouch, { passive: false });
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
  // Three.js koordinata tizimida: steer > 0 Chapga (+X), steer < 0 O'ngga (-X)
  const steer = (left ? 1 : 0) - (right ? 1 : 0);
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
  const phone = mode === 'phone' ? true : mode === 'pc' ? false : isTouch();
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
