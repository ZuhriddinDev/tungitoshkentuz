// HUD: neon spidometr (PC + mobil ekranida Drift tugmasi tepasidagi spidometr), benzin, masofa, pul, soat, ko'cha nomi
import { carById, fmt } from './config.js';
import { state, canClaimDaily } from './state.js';
import { hourLabel } from './world/sky.js';
import { streetAt } from './map.js';

const $ = (s) => document.getElementById(s);
const sp = $('speedo');
if (sp) sp.width = sp.height = 440;
const g = sp ? sp.getContext('2d') : null;

let bgCanvas = null;
let bgMaxSpeed = -1;

function getSpeedoBg(S, max) {
  if (bgCanvas && bgMaxSpeed === max) return bgCanvas;
  bgCanvas = document.createElement('canvas');
  bgCanvas.width = bgCanvas.height = S;
  const bg = bgCanvas.getContext('2d');
  const c = S / 2, r = S * 0.42, a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;

  bg.lineCap = 'round';
  bg.fillStyle = 'rgba(8,10,24,0.72)';
  bg.beginPath();
  bg.arc(c, c, S * 0.49, 0, Math.PI * 2);
  bg.fill();

  bg.lineWidth = 22;
  bg.strokeStyle = 'rgba(255,255,255,0.07)';
  bg.beginPath();
  bg.arc(c, c, r, a0, a1);
  bg.stroke();

  bg.lineWidth = 3;
  bg.strokeStyle = 'rgba(255,255,255,0.45)';
  bg.fillStyle = 'rgba(255,255,255,0.65)';
  bg.font = `600 ${S * 0.05}px Segoe UI, Arial`;
  bg.textAlign = 'center';
  bg.textBaseline = 'middle';

  const step = max > 260 ? 40 : 20;
  for (let s = 0; s <= max; s += step) {
    const a = a0 + (a1 - a0) * (s / max), cs = Math.cos(a), sn = Math.sin(a);
    bg.beginPath();
    bg.moveTo(c + cs * (r - 20), c + sn * (r - 20));
    bg.lineTo(c + cs * (r - 34), c + sn * (r - 34));
    bg.stroke();
    bg.fillText(s, c + cs * (r - 58), c + sn * (r - 58));
  }
  bgMaxSpeed = max;
  return bgCanvas;
}

export function drawSpeedo(kmh, maxSpeed, rpm) {
  // Agar spidometr ekranda yashirin bo'lsa (masalan mobil telefonda) 2D Canvas renderini to'liq o'tkazib yuboramiz
  if (!sp || !g || sp.offsetParent === null) return;
  const S = sp.width, c = S / 2, r = S * 0.42, a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
  const max = Math.ceil(maxSpeed / 20) * 20 + 20, f = Math.min(1, kmh / max);

  g.clearRect(0, 0, S, S);
  const bg = getSpeedoBg(S, max);
  g.drawImage(bg, 0, 0);

  g.lineCap = 'round';
  const grad = g.createLinearGradient(0, S, S, 0);
  grad.addColorStop(0, '#00e5ff');
  grad.addColorStop(1, '#ff2bd6');
  g.strokeStyle = grad;
  g.lineWidth = 22;
  g.beginPath();
  g.arc(c, c, r, a0, a0 + (a1 - a0) * Math.max(0.002, f));
  g.stroke();

  g.lineWidth = 8;
  g.strokeStyle = rpm > 0.92 ? '#ff1744' : '#ffd740';
  g.beginPath();
  g.arc(c, c, r * 0.52, a0 + 0.3, a0 + 0.3 + (Math.PI * 0.9) * rpm);
  g.stroke();
}

let lastMoney = -1;
export function updateHud(v, hour, waypoint, fps) {
  const inst = v.inst, cfg = carById(inst.id);
  if (state.money !== lastMoney) {
    const el = $('hudMoney');
    if (el) {
      el.textContent = '💰 ' + fmt(state.money);
      if (lastMoney >= 0) { el.classList.add('bump'); setTimeout(() => el.classList.remove('bump'), 200); }
    }
    lastMoney = state.money;
  }

  const dailyBtn = $('hudDailyBtn');
  if (dailyBtn) {
    dailyBtn.classList.toggle('ready-pulse', canClaimDaily());
  }

  if ($('hudTime')) $('hudTime').textContent = hourLabel(hour);
  if ($('hudStreet')) {
    $('hudStreet').textContent = waypoint
      ? `📍 GPS: ${Math.round(Math.hypot(waypoint.x - v.x, waypoint.z - v.z))} m`
      : streetAt(v.x, v.z);
  }

  const speedInt = Math.round(v.kmh || 0);
  if ($('hudSpeed')) $('hudSpeed').textContent = speedInt;
  if ($('mobHudSpeed')) $('mobHudSpeed').textContent = speedInt;

  let gearTxt = `D${v.gear || 1}`;
  if (v.v < -0.5) gearTxt = 'R';
  else if (v.kmh < 1.5 && v.braking) gearTxt = 'P';
  else if (v.kmh < 1.5) gearTxt = 'N';

  if ($('hudGear')) $('hudGear').textContent = gearTxt;
  if ($('mobHudGear')) $('mobHudGear').textContent = gearTxt;

  const mobFill = $('mobSpeedoFill');
  if (mobFill) {
    const pct = Math.min(100, Math.max(2, (speedInt / (cfg.maxSpeed || 240)) * 100));
    mobFill.style.width = pct.toFixed(1) + '%';
  }

  const fp = inst.fuelL / cfg.tank;
  if ($('hudFuel')) {
    $('hudFuel').style.width = (fp * 100).toFixed(1) + '%';
    $('hudFuel').classList.toggle('low', fp < 0.15);
  }
  if ($('hudFuelText')) $('hudFuelText').textContent = inst.fuelL.toFixed(1) + ' l';
  if ($('hudFuelType')) $('hudFuelType').textContent = inst.fuelType;
  if ($('hudKm')) $('hudKm').textContent = state.totalKm.toFixed(1);
  if ($('hudNextBonus')) $('hudNextBonus').textContent = (10 - (state.totalKm % 10)).toFixed(1);
  if ($('hudFps')) {
    $('hudFps').textContent = fps + ' FPS';
    $('hudFps').style.display = state.settings?.showFps === false ? 'none' : '';
  }
}

let promptHtml = '';
export function setPrompt(html) {
  if (html === promptHtml) return;
  promptHtml = html;
  const p = $('prompt');
  if (p) { p.innerHTML = html; p.classList.toggle('hidden', !html); }
}
let missionHtml = null;
export function setMissionHud(html) {
  if (html === missionHtml) return;
  missionHtml = html;
  const m = $('missionHud');
  if (m) { m.innerHTML = html; m.classList.toggle('hidden', !html); }
}
