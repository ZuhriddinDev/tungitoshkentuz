// HUD: neon spidometr, benzin, holat, masofa, pul, soat, ko'cha nomi
import { carById, fmt } from './config.js';
import { state } from './state.js';
import { hourLabel } from './world/sky.js';
import { streetAt } from './map.js';

const $ = (s) => document.getElementById(s);
const sp = $('speedo'); sp.width = sp.height = 440;
const g = sp.getContext('2d');

export function drawSpeedo(kmh, maxSpeed, rpm) {
  const S = sp.width, c = S / 2, r = S * 0.42, a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
  const max = Math.ceil(maxSpeed / 20) * 20 + 20, f = Math.min(1, kmh / max);
  const arc = (rad, from, to) => { g.beginPath(); g.arc(c, c, rad, from, to); g.stroke(); };
  g.clearRect(0, 0, S, S);
  g.lineCap = 'round';
  g.fillStyle = 'rgba(8,10,24,0.72)'; g.beginPath(); g.arc(c, c, S * 0.49, 0, Math.PI * 2); g.fill();
  g.lineWidth = 22; g.strokeStyle = 'rgba(255,255,255,0.07)'; arc(r, a0, a1);
  const grad = g.createLinearGradient(0, S, S, 0); grad.addColorStop(0, '#00e5ff'); grad.addColorStop(1, '#ff2bd6');
  g.strokeStyle = grad; g.shadowColor = '#ff2bd6'; g.shadowBlur = 24; arc(r, a0, a0 + (a1 - a0) * Math.max(0.002, f)); g.shadowBlur = 0;
  g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.45)'; g.fillStyle = 'rgba(255,255,255,0.65)';
  g.font = `600 ${S * 0.05}px Segoe UI, Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const step = max > 260 ? 40 : 20;
  for (let s = 0; s <= max; s += step) {
    const a = a0 + (a1 - a0) * (s / max), cs = Math.cos(a), sn = Math.sin(a);
    g.beginPath(); g.moveTo(c + cs * (r - 20), c + sn * (r - 20)); g.lineTo(c + cs * (r - 34), c + sn * (r - 34)); g.stroke();
    g.fillText(s, c + cs * (r - 58), c + sn * (r - 58));
  }
  g.lineWidth = 8; g.strokeStyle = rpm > 0.92 ? '#ff1744' : '#ffd740';
  arc(r * 0.52, a0 + 0.3, a0 + 0.3 + (Math.PI * 0.9) * rpm);
}

let lastMoney = -1;
export function updateHud(v, hour, waypoint, fps) {
  const inst = v.inst, cfg = carById(inst.id);
  if (state.money !== lastMoney) {
    const el = $('hudMoney'); el.textContent = fmt(state.money);
    if (lastMoney >= 0) { el.classList.add('bump'); setTimeout(() => el.classList.remove('bump'), 200); }
    lastMoney = state.money;
  }
  $('hudTime').textContent = hourLabel(hour);
  $('hudStreet').textContent = waypoint ? `📍 GPS: ${Math.round(Math.hypot(waypoint.x - v.x, waypoint.z - v.z))} m` : streetAt(v.x, v.z);
  $('hudSpeed').textContent = Math.round(v.kmh);
  const fp = inst.fuelL / cfg.tank;
  $('hudFuel').style.width = (fp * 100).toFixed(1) + '%';
  $('hudFuel').classList.toggle('low', fp < 0.15);
  $('hudFuelText').textContent = inst.fuelL.toFixed(1) + ' l';
  $('hudFuelType').textContent = inst.fuelType;
  $('hudDmg').style.width = (100 - inst.damage) + '%';
  $('hudDmgText').textContent = Math.round(100 - inst.damage) + '%';
  $('hudKm').textContent = state.totalKm.toFixed(1);
  $('hudNextBonus').textContent = (10 - (state.totalKm % 10)).toFixed(1);
  $('hudFps').textContent = fps + ' FPS';
}

let promptHtml = '';
export function setPrompt(html) {
  if (html === promptHtml) return;
  promptHtml = html;
  $('prompt').innerHTML = html; $('prompt').classList.toggle('hidden', !html);
}
let missionHtml = null;
export function setMissionHud(html) {
  if (html === missionHtml) return;
  missionHtml = html;
  $('missionHud').innerHTML = html; $('missionHud').classList.toggle('hidden', !html);
}
