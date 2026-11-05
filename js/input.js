// Klaviatura, sichqoncha (360° kamera), aylanuvchi rul (Steering Wheel) va qulay mobil sensorli boshqaruv
const keys = new Set();
const touch = { up: 0, down: 0, left: 0, right: 0, boost: 0, brake: 0 };
const hot = new Map();
export const cam = { yaw: 0, pitch: 0.25, dist: 9, lastMove: 0 };
let enabled = true;

// Aylanuvchi rul (Steering Wheel) holati: -1 (o'ng) .. +1 (chap)
let wheelSteer = 0;
let wheelDeg = 0;
let wheelPointerId = null;

export function onKey(code, fn) { hot.set(code, fn); }
export function setEnabled(v) {
  enabled = v;
  if (!v) {
    keys.clear();
    for (const k of Object.keys(touch)) touch[k] = 0;
    wheelSteer = 0;
    wheelDeg = 0;
    wheelPointerId = null;
    const disc = document.getElementById('wheelDisc');
    if (disc) disc.style.transform = 'rotate(0deg)';
    document.getElementById('wheelPad')?.classList.remove('active');
    document.querySelectorAll('[data-touch].on').forEach((b) => b.classList.remove('on'));
  }
}

export function initInput(canvas, onSteerToggle) {
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (hot.has(e.code) && !e.repeat) { e.preventDefault(); hot.get(e.code)(); return; }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (enabled) keys.add(e.code);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => {
    keys.clear();
    for (const k of Object.keys(touch)) touch[k] = 0;
    wheelSteer = 0;
    wheelDeg = 0;
    wheelPointerId = null;
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

  // Sensorli tugmalar (multi-touch qo'llab-quvvatlanadi)
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

  // Klassik tugmalarda barmoqni uzmasdan chapga-o'ngga surish (Slide-to-steer)
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

  // Aylanuvchi Rul (Steering Wheel) — silliq analog boshqaruv
  const wheelPad = document.getElementById('wheelPad');
  const wheelDisc = document.getElementById('wheelDisc');
  if (wheelPad && wheelDisc) {
    let startX = 0;
    let startAngle = 0;

    const updateWheelFromEvent = (e, isStart = false) => {
      const rect = wheelPad.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const radius = Math.max(24, rect.width * 0.42);

      if (isStart) {
        startX = e.clientX;
        startAngle = Math.atan2(dx, -dy) * (180 / Math.PI);
      }

      // Gorizontal siljish va burchak aylanishini tabiiy uyg'unlashtiramiz
      const horizNorm = Math.max(-1, Math.min(1, dx / radius));
      const curAngle = Math.atan2(dx, -dy) * (180 / Math.PI);
      let deltaAngle = curAngle - startAngle;
      if (deltaAngle > 180) deltaAngle -= 360;
      if (deltaAngle < -180) deltaAngle += 360;

      const slideNorm = Math.max(-1, Math.min(1, (e.clientX - startX) / (radius * 0.85)));
      // Bosh barmoq bilan ham aylantirish, ham chap-o'ngga surish ishlaydi
      const combined = Math.max(-1, Math.min(1, horizNorm * 0.65 + slideNorm * 0.35));
      wheelDeg = combined * 108; // ±108° gacha vizual burilish
      // physics.js da steer > 0 chapga, steer < 0 o'ngga
      wheelSteer = -combined;
      wheelDisc.style.transform = `rotate(${wheelDeg.toFixed(1)}deg)`;
    };

    wheelPad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      wheelPointerId = e.pointerId;
      try { wheelPad.setPointerCapture(e.pointerId); } catch { /* */ }
      wheelPad.classList.add('active');
      updateWheelFromEvent(e, true);
    });

    wheelPad.addEventListener('pointermove', (e) => {
      if (wheelPointerId !== e.pointerId) return;
      e.preventDefault();
      updateWheelFromEvent(e, false);
    });

    const releaseWheel = (e) => {
      if (wheelPointerId !== e.pointerId) return;
      wheelPointerId = null;
      wheelSteer = 0;
      wheelDeg = 0;
      wheelPad.classList.remove('active');
      wheelDisc.style.transform = 'rotate(0deg)';
    };

    wheelPad.addEventListener('pointerup', releaseWheel);
    wheelPad.addEventListener('pointercancel', releaseWheel);
    wheelPad.addEventListener('lostpointercapture', releaseWheel);
  }

  // Rul / Tugmalar tezkor almashtirgichi
  const toggleSteerBtn = document.getElementById('toggleSteerBtn');
  if (toggleSteerBtn) {
    toggleSteerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onSteerToggle?.();
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

  // Minimap bosilganda katta xaritani ochish (telefonda juda qulay)
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
  if (!enabled) return { throttle: 0, reverse: 0, steer: 0, boost: false, handbrake: false };
  const k = (c) => keys.has(c);
  const up = k('KeyW') || k('ArrowUp') || touch.up;
  const down = k('KeyS') || k('ArrowDown') || touch.down;
  const left = k('KeyA') || k('ArrowLeft') || touch.left;
  const right = k('KeyD') || k('ArrowRight') || touch.right;
  const digitalSteer = (left ? 1 : 0) - (right ? 1 : 0);
  const steer = Math.abs(wheelSteer) > 0.02 ? wheelSteer : digitalSteer;
  return {
    throttle: up ? 1 : 0,
    reverse: down ? 1 : 0,
    steer,
    boost: !!(k('ShiftLeft') || k('ShiftRight') || touch.boost),
    handbrake: !!(k('Space') || touch.brake),
  };
}

export const isTouch = () => matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && innerWidth < 950);

// Boshqaruv turi va mobil rul/tugma sozlamalarini qo'llash
export function applyControl(mode = 'auto', steerType = 'wheel', touchScale = 'normal') {
  const phone = mode === 'phone' || (mode === 'auto' && isTouch());
  document.body.classList.toggle('phone', phone);
  document.body.classList.toggle('pc', !phone);
  document.body.classList.toggle('steer-wheel', steerType !== 'buttons');
  document.body.classList.toggle('steer-buttons', steerType === 'buttons');
  document.body.classList.toggle('scale-large', touchScale === 'large');
  return phone ? 'phone' : 'pc';
}
