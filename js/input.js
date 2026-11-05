// Klaviatura, sichqoncha (360° kamera) va sensorli ekran boshqaruvi
const keys = new Set();
const touch = { up: 0, down: 0, left: 0, right: 0, boost: 0, brake: 0 };
const hot = new Map();
export const cam = { yaw: 0, pitch: 0.25, dist: 9, lastMove: 0 };
let enabled = true;

export function onKey(code, fn) { hot.set(code, fn); }
export function setEnabled(v) { enabled = v; if (!v) keys.clear(); }

export function initInput(canvas) {
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (hot.has(e.code) && !e.repeat) { e.preventDefault(); hot.get(e.code)(); return; }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (enabled) keys.add(e.code);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  // Sichqoncha: bosib turib sudrash — kamerani 360° aylantirish, g'ildirak — masofa
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const s = (window.__sens || 1) * 0.005;
    cam.yaw -= (e.clientX - drag.x) * s;
    cam.pitch = Math.max(-0.05, Math.min(1.2, cam.pitch + (e.clientY - drag.y) * s));
    drag.x = e.clientX; drag.y = e.clientY; cam.lastMove = performance.now();
  });
  const end = () => { drag = null; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', (e) => { cam.dist = Math.max(5, Math.min(22, cam.dist + e.deltaY * 0.01)); }, { passive: true });

  // Sensorli tugmalar
  document.querySelectorAll('[data-touch]').forEach((b) => {
    const k = b.dataset.touch;
    const on = (e) => { e.preventDefault(); touch[k] = 1; b.classList.add('on'); };
    const off = (e) => { e.preventDefault(); touch[k] = 0; b.classList.remove('on'); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off);
    b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
  });
  document.querySelectorAll('[data-hotkey]').forEach((b) => b.addEventListener('click', () => hot.get(b.dataset.hotkey)?.()));
}

export function readDrive() {
  if (!enabled) return { throttle: 0, reverse: 0, steer: 0, boost: false, handbrake: false };
  const k = (c) => keys.has(c);
  const up = k('KeyW') || k('ArrowUp') || touch.up, down = k('KeyS') || k('ArrowDown') || touch.down;
  const left = k('KeyA') || k('ArrowLeft') || touch.left, right = k('KeyD') || k('ArrowRight') || touch.right;
  return {
    throttle: up ? 1 : 0, reverse: down ? 1 : 0,
    steer: (left ? 1 : 0) - (right ? 1 : 0), // musbat = chapga (heading oshadi)
    boost: !!(k('ShiftLeft') || k('ShiftRight') || touch.boost),
    handbrake: !!(k('Space') || touch.brake),
  };
}
export const isTouch = () => matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && innerWidth < 900);

// Boshqaruv turi: 'auto' (qurilmani o'zi aniqlaydi) | 'pc' (klaviatura) | 'phone' (sensorli tugmalar)
export function applyControl(mode = 'auto') {
  const phone = mode === 'phone' || (mode === 'auto' && isTouch());
  document.body.classList.toggle('phone', phone);
  document.body.classList.toggle('pc', !phone);
  return phone ? 'phone' : 'pc';
}

