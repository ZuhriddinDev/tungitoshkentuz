// Missiyalar: ko'cha poygasi, 1v1 tungi poyga, yetkazib berish, taksi, drift musobaqasi
import * as THREE from 'three';
import { CARS, fmt } from './config.js';
import { buildCar, disposeCarGroup } from './carModel.js';
import { N, ROAD, roadC, nearestRoad } from './world/layout.js';
import { addMoney, spend, bumpStat } from './state.js';
import { beep } from './audio.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
let ctx; // { scene, player, toast, hud }
export const mission = { active: null };

export function initMissions(c) { ctx = c; marker.visible = false; c.scene.add(marker); }

// Nazorat nuqtasi: yorug' ustun + halqa
const marker = new THREE.Group();
{
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 60, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd740, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  beam.position.y = 30;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5, 0.35, 8, 32).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd740 }));
  ring.position.y = 0.5;
  marker.add(beam, ring); marker.userData = { beam, ring };
}
function showMarker(p, color) {
  marker.visible = !!p; if (!p) return;
  marker.position.set(p.x, 0, p.z);
  marker.userData.beam.material.color.set(color); marker.userData.ring.material.color.set(color);
}

// Yo'l tarmog'i bo'ylab tasodifiy marshrut (chorrahalar orqali)
function route(fromX, fromZ, hops, minLen = 0, attempt = 0) {
  let i = nearestRoad(fromX), k = nearestRoad(fromZ), last = null;
  const pts = [];
  for (let n = 0; n < hops; n++) {
    const opts = DIRS.filter(([dx, dz]) => (!last || dx !== -last[0] || dz !== -last[1]) && i + dx >= 0 && k + dz >= 0 && i + dx <= N && k + dz <= N);
    const [dx, dz] = (last && Math.random() < 0.5 && opts.find((d) => d[0] === last[0] && d[1] === last[1])) || opts[Math.floor(Math.random() * opts.length)];
    const steps = 1 + Math.floor(Math.random() * 3);
    for (let s = 0; s < steps && i + dx >= 0 && k + dz >= 0 && i + dx <= N && k + dz <= N; s++) { i += dx; k += dz; }
    last = [dx, dz]; pts.push({ x: roadC(i), z: roadC(k) });
  }
  if (minLen && attempt < 12 && Math.hypot(pts.at(-1).x - fromX, pts.at(-1).z - fromZ) < minLen) return route(fromX, fromZ, hops, minLen, attempt + 1);
  return pts;
}
const randomRoadPoint = (x, z, minD, maxD) => {
  let best = { x: roadC(Math.floor(N / 2)), z: roadC(Math.floor(N / 2)) };
  for (let tries = 0; tries < 60; tries++) {
    const i = 1 + Math.floor(Math.random() * (N - 1)), k = 1 + Math.floor(Math.random() * (N - 1));
    const offset = (Math.random() < 0.5 ? 1 : -1) * ROAD * 1.4;
    const p = Math.random() < 0.5 ? { x: roadC(i) + offset, z: roadC(k) } : { x: roadC(i), z: roadC(k) + offset };
    best = p;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d > minD && d < maxD) return p;
  }
  return best;
};

export const MISSIONS = {
  // 6 ta Poyga turi
  race:       { name: "Ko'cha poygasi", desc: '3 ta raqib bilan 8 nazorat nuqtali poyga. G\'olibga 40 mln so\'m.', fee: 2_000_000, cat: 'race' },
  duel:       { name: '1 ga 1 tungi poyga', desc: 'Noqonuniy tungi poyga. Garov 20 mln — g\'olib 40 mln oladi. Faqat 20:00–05:00.', fee: 20_000_000, night: true, cat: 'race' },
  drift:      { name: 'Drift musobaqasi', desc: '60 soniyada eng ko\'p drift ochkosi to\'plang. Har 1000 ochko = 2 mln.', fee: 1_000_000, cat: 'race' },
  drag:       { name: 'Drag Poyga (400m)', desc: 'To\'g\'ri shoh ko\'chada 1v1 sprint! G\'olibga 18 mln so\'m.', fee: 3_000_000, cat: 'race' },
  circuit:    { name: 'Halqa Poyga (3 Aylana)', desc: 'Markaziy kvartal atrofida 3 aylana halqa poyga. G\'olibga 50 mln so\'m.', fee: 5_000_000, cat: 'race' },
  time_trial: { name: 'Vaqt Sinovi (Time Trial)', desc: '6 ta nazorat nuqtasidan belgilangan vaqt ichida o\'ting (+22 mln so\'m).', fee: 1_000_000, cat: 'race' },

  // 9 ta Kasb va Ish tizimi
  taxi:          { name: '🚕 Taksi xizmati', desc: 'Yo\'lovchini olib, manzilga xavfsiz yetkazing.', fee: 0, cat: 'job', rate: 5500, base: 3_000_000, pickLbl: "Yo'lovchi" },
  food_delivery: { name: '🍔 Ovqat yetkazish', desc: 'Issiq taomni restorandan olib, mijozga sovumasdan yetkazing!', fee: 0, cat: 'job', rate: 5200, base: 3_500_000, pickLbl: 'Restoran', timed: true },
  delivery:      { name: '📦 Posilka kuryeri', desc: 'Tezkor posilkani olib, manzilga vaqtida yetkazing.', fee: 0, cat: 'job', rate: 4800, base: 3_200_000, pickLbl: 'Ombor', timed: true },
  cargo:         { name: '🚛 Yuk tashish', desc: 'Og\'ir tijorat yukini Chorsu va Sergeli yo\'nalishida yetkazing.', fee: 0, cat: 'job', rate: 7500, base: 6_000_000, pickLbl: 'Yuk terminali', timed: true },
  tow_truck:     { name: '🪝 Evakuator xizmati', desc: 'Yo\'lda buzilib qolgan mashinani Avtoservisga evakuatsiya qiling.', fee: 0, cat: 'job', rate: 8200, base: 7_500_000, pickLbl: 'Nosoz mashina' },
  vip_driver:    { name: '🕴️ Shaxsiy VIP haydovchi', desc: 'Tashkent City mehmonini yuqori qulaylikda vaqtida olib boring.', fee: 0, cat: 'job', rate: 11000, base: 10_000_000, pickLbl: 'VIP Mehmon', timed: true },
  mechanic:      { name: '🔧 Avtomexanik sinovi', desc: 'Ta\'mirlangan mashinani ustaxonadan olib, sinov haydovini yakunlang.', fee: 0, cat: 'job', rate: 6800, base: 5_500_000, pickLbl: 'Avtoservis' },
  car_transport: { name: '🚘 Avtotransport eltish', desc: 'Yangi salon avtomobilini mijozning uyiga shikastsiz eltib bering.', fee: 0, cat: 'job', rate: 9500, base: 8_500_000, pickLbl: 'Avtosalon', timed: true },
  timed_spec:    { name: '⏱️ Maxsus tezkor buyurtma', desc: 'Favqulodda muhim hujjatlarni qisqa vaqt ichida yetkazing!', fee: 0, cat: 'job', rate: 12500, base: 12_000_000, pickLbl: 'Maxsus paket', timed: true },
};

const JOB_TYPES = new Set(['taxi', 'food_delivery', 'delivery', 'cargo', 'tow_truck', 'vip_driver', 'mechanic', 'car_transport', 'timed_spec']);

export function startCustomMission(spec) {
  if (!ctx) return false;
  if (mission.active) cancelMission(true);
  const m = {
    type: 'story',
    name: spec.name,
    t: 0,
    fee: 0,
    cps: spec.points,
    cp: 0,
    limit: spec.limit || 180,
    reward: spec.reward || 15_000_000,
    onComplete: spec.onComplete || null,
    dialogue: spec.dialogue || '',
  };
  mission.active = m;
  beep('go');
  ctx.toast(`📖 ${spec.name} boshlandi!`, 'ok');
  return true;
}

export function startMission(type, hour) {
  const def = MISSIONS[type], p = ctx.player;
  if (!def) return false;
  if (mission.active) cancelMission(true);
  if (def.night && !(hour >= 20 || hour < 5)) { ctx.toast('Tungi poyga faqat 20:00 dan 05:00 gacha', 'err'); return false; }
  if (def.fee && !spend(def.fee, `${def.name}: ishtirok to'lovi`)) { ctx.toast("Mablag' yetarli emas", 'err'); return false; }
  const m = { type, name: def.name, t: 0, fee: def.fee, def };
  if (type === 'race' || type === 'duel') {
    m.cps = route(p.x, p.z, type === 'duel' ? 6 : 8, 300); m.cp = 0;
    m.rivals = makeRivals(type === 'duel' ? 1 : 3, p);
    m.countdown = 3;
  } else if (type === 'drag') {
    const i = nearestRoad(p.x);
    const z0 = roadC(Math.max(2, Math.min(N - 4, nearestRoad(p.z))));
    m.cps = [{ x: roadC(i), z: z0 + 220 }, { x: roadC(i), z: z0 + 440 }];
    m.cp = 0;
    m.rivals = makeRivals(1, p);
    m.countdown = 3;
  } else if (type === 'circuit') {
    const i = Math.max(2, Math.min(N - 2, nearestRoad(p.x)));
    const k = Math.max(2, Math.min(N - 2, nearestRoad(p.z)));
    const lapPts = [
      { x: roadC(i + 1), z: roadC(k) },
      { x: roadC(i + 1), z: roadC(k + 1) },
      { x: roadC(i), z: roadC(k + 1) },
      { x: roadC(i), z: roadC(k) },
    ];
    m.cps = [...lapPts, ...lapPts, ...lapPts];
    m.cp = 0;
    m.rivals = makeRivals(2, p);
    m.countdown = 3;
  } else if (type === 'time_trial') {
    m.cps = route(p.x, p.z, 6, 320);
    m.cp = 0;
    m.limit = 75;
  } else if (JOB_TYPES.has(type)) {
    m.stage = 'pickup';
    m.pick = randomRoadPoint(p.x, p.z, 65, 320);
    m.drop = randomRoadPoint(m.pick.x, m.pick.z, 320, 960);
    const d = Math.hypot(m.drop.x - m.pick.x, m.drop.z - m.pick.z);
    m.limit = def.timed ? (28 + d / (type === 'timed_spec' ? 12 : 8.5)) : 0;
    m.dmg0 = 0;
  } else if (type === 'drift') {
    m.score = 0; m.combo = 0; m.idle = 0; m.limit = 60;
  }
  mission.active = m; beep('go');
  ctx.toast(`${def.name} boshlandi!`, 'ok');
  return true;
}

function makeRivals(n, p) {
  const fast = CARS.filter((c) => c.maxSpeed >= p.cfg.maxSpeed - 30 && c.maxSpeed <= p.cfg.maxSpeed + 30);
  return Array.from({ length: n }, (_, i) => {
    const cfg = fast[Math.floor(Math.random() * fast.length)] || p.cfg;
    const model = buildCar(cfg, { color: ['#ff1744', '#00e676', '#2979ff', '#ffea00'][i], neon: ['#ff00d4', '#00e5ff', '#76ff03'][i % 3] });
    ctx.scene.add(model.group);
    const side = (i + 1) * 3.2 * (i % 2 ? 1 : -1);
    const r = { model, cfg, len: cfg.len, x: p.x + Math.cos(p.heading) * side, z: p.z - Math.sin(p.heading) * side, heading: p.heading, v: 0, cp: 0, done: false, skill: 0.86 + Math.random() * 0.1 };
    r.onHit = () => { r.v *= 0.7; };
    return r;
  });
}

export function cancelMission(silent) {
  const m = mission.active; if (!m) return;
  m.rivals?.forEach((r) => {
    disposeCarGroup(r.model.group);
    ctx.scene.remove(r.model.group);
  });
  mission.active = null; mission.target = null; showMarker(null); ctx.hud('');
  ctx.player.locked = false;
  if (!silent) ctx.toast('Missiya bekor qilindi', 'err');
}

function finish(ok, reward, reason, msg) {
  if (reward > 0) { addMoney(reward, reason); beep('cash'); }
  ctx.toast(msg, ok ? 'ok' : 'err');
  cancelMission(true);
}

const near = (p, q, r) => Math.hypot(p.x - q.x, p.z - q.z) < r;

export function updateMission(dt) {
  const m = mission.active; if (!m) return;
  const p = ctx.player; m.t += dt;
  let target = null, hud = '';

  if (m.type === 'race' || m.type === 'duel' || m.type === 'drag' || m.type === 'circuit') {
    if (m.countdown > 0) {
      m.countdown -= dt; p.locked = true;
      hud = `<b>${m.name}</b><div class="big">${Math.ceil(m.countdown)}</div>`;
      if (m.countdown <= 0) { p.locked = false; beep('go'); }
    }
    const cp = m.cps[m.cp];
    if (m.countdown <= 0 && near(p, cp, 13)) { m.cp++; beep('ok'); }
    for (const r of m.rivals) driveRival(r, m, dt);
    const ahead = m.rivals.filter((r) => r.cp > m.cp || (r.cp === m.cp && dist(r, m.cps[Math.min(r.cp, m.cps.length - 1)]) < dist(p, cp))).length;
    if (m.cp >= m.cps.length) {
      const place = 1 + m.rivals.filter((r) => r.done).length;
      const topPrize = m.type === 'circuit' ? 50_000_000 : m.type === 'drag' ? 18_000_000 : 40_000_000;
      const prize = (m.type === 'duel' || m.type === 'drag') ? (place === 1 ? topPrize : 0) : [topPrize, 12_000_000, 4_000_000, 0][place - 1];
      if (place === 1) bumpStat('raceWins');
      return finish(place === 1, prize, `${m.name}: ${place}-o'rin`, place === 1 ? `🏆 G'alaba! +${fmt(prize)}` : `${place}-o'rin. ${prize ? '+' + fmt(prize) : 'Keyingi safar omad!'}`);
    }
    if (m.t > 300) return finish(false, 0, '', 'Vaqt tugadi');
    target = { ...m.cps[m.cp], color: '#ffd740', label: 'CP' };
    if (m.countdown <= 0) hud = `<b>${m.name}</b><div>Nazorat nuqtasi: ${m.cp + 1}/${m.cps.length}</div><div>O'rin: ${ahead + 1}/${m.rivals.length + 1}</div><div>Vaqt: ${m.t.toFixed(1)} s</div>`;
  } else if (m.type === 'time_trial' || m.type === 'story') {
    const cp = m.cps[m.cp];
    if (near(p, cp, 13)) { m.cp++; beep('ok'); }
    const left = (m.limit || 120) - m.t;
    if (left <= 0) return finish(false, 0, '', '⏱️ Vaqt tugadi! Qayta urinib ko\'ring.');
    if (m.cp >= m.cps.length) {
      const prize = m.reward || 22_000_000;
      if (m.onComplete) m.onComplete();
      return finish(true, prize, m.name, `🏆 ${m.name} bajarildi! +${fmt(prize)}`);
    }
    target = { ...m.cps[m.cp], color: '#38bdf8', label: cp.label || 'Manzil' };
    hud = `<b>${m.name}</b>${m.dialogue ? `<div style="color:#fde047;font-size:11.5px">${m.dialogue}</div>` : ''}<div>Bosqich: ${m.cp + 1}/${m.cps.length} (${Math.round(dist(p, cp))} m)</div><div>Qolgan vaqt: ${Math.max(0, left).toFixed(0)} s</div>`;
  } else if (JOB_TYPES.has(m.type)) {
    const def = m.def || MISSIONS[m.type] || MISSIONS.delivery;
    const isTaxi = m.type === 'taxi' || m.type === 'vip_driver';
    if (m.stage === 'pickup') {
      target = { ...m.pick, color: '#00e5ff', label: def.pickLbl || 'Olish' };
      hud = `<b>${m.name}</b><div>${def.pickLbl || 'Buyurtma'}ga boring (${Math.round(dist(p, m.pick))} m)</div>`;
      if (near(p, m.pick, 10) && p.kmh < 28) {
        m.stage = 'drop';
        m.t = 0;
        m.dmg0 = p.inst.damage;
        beep('ok');
        ctx.toast(`${def.pickLbl || 'Buyurtma'} qabul qilindi! Manzilga yetkazing.`, 'ok');
      }
    } else {
      target = { ...m.drop, color: '#00e676', label: 'Manzil' };
      const left = m.limit ? m.limit - m.t : null;
      const calcPay = () => Math.round((def.base || 3_500_000) + Math.hypot(m.drop.x - m.pick.x, m.drop.z - m.pick.z) * (def.rate || 5000));
      hud =
        `<b>${m.name}</b><div>Manzil: ${Math.round(dist(p, m.drop))} m</div>` +
        (left !== null
          ? `<div>Qolgan vaqt: <span class="${left < 10 ? 'warn' : ''}">${Math.max(0, left).toFixed(0)} s</span></div>`
          : `<div>To'lov: ${fmt(calcPay())}</div>`);
      if (left !== null && left < -15) {
        return finish(false, 0, '', '⏱️ Buyurtma vaqti o\'tib ketdi!');
      }
      if (near(p, m.drop, 10) && p.kmh < 28) {
        const onTimeMul = left === null || left >= 0 ? 1.0 : 0.5;
        const pay = Math.round(calcPay() * onTimeMul);
        if (isTaxi) bumpStat('taxi');
        else bumpStat('deliveries');
        return finish(true, pay, m.name, `✔ ${m.name} yakunlandi: +${fmt(pay)}`);
      }
    }
  } else if (m.type === 'drift') {
    const left = m.limit - m.t, v = p.vehicle;
    if (v.drifting) { m.combo = Math.min(5, m.combo + dt * 0.5); m.score += v.slip * v.kmh * dt * 4 * (1 + m.combo); m.idle = 0; }
    else if ((m.idle += dt) > 1.5) m.combo = 0;
    if (p.vehicle.impact > 3) m.combo = 0;
    hud = `<b>${m.name}</b><div class="big">${Math.round(m.score)}</div><div>Kombo: x${(1 + m.combo).toFixed(1)}</div><div>Vaqt: ${Math.max(0, left).toFixed(0)} s</div><small>Space + rul bilan sirpaning</small>`;
    if (left <= 0) {
      const s = Math.round(m.score), pay = Math.floor(s / 1000) * 2_000_000;
      bumpStat('driftBest', s, true);
      return finish(pay > 0, pay, `Drift musobaqasi: ${s} ochko`, `Drift tugadi: ${s} ochko. ${pay ? '+' + fmt(pay) : ''}`);
    }
  }
  mission.target = target; showMarker(target, target?.color);
  if (target) marker.userData.ring.rotation.y += dt;
  ctx.hud(hud);
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const fare = (m) => Math.round(15_000 * m.t + Math.hypot(m.drop.x - m.pick.x, m.drop.z - m.pick.z) * 5000);

// Raqib AI: nazorat nuqtalari bo'ylab yo'l o'rtasidan haydaydi
function driveRival(r, m, dt) {
  if (r.done) return;
  const vmax = (r.cfg.maxSpeed / 3.6) * r.skill * 0.62;
  if (m.countdown <= 0) {
    const cp = m.cps[r.cp];
    const desired = Math.atan2(cp.x - r.x, cp.z - r.z);
    let dh = desired - r.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    r.heading += THREE.MathUtils.clamp(dh, -1.8 * dt, 1.8 * dt);
    const want = vmax * (1 - Math.min(0.75, Math.abs(dh) * 0.9));
    r.v += THREE.MathUtils.clamp(want - r.v, -r.cfg.brake * dt, r.cfg.accel * 0.8 * dt);
    r.x += Math.sin(r.heading) * r.v * dt; r.z += Math.cos(r.heading) * r.v * dt;
    if (dist(r, cp) < 9) { r.cp++; if (r.cp >= m.cps.length) { r.done = true; r.v = 0; } }
  }
  r.model.group.position.set(r.x, 0, r.z); r.model.group.rotation.y = r.heading;
  r.model.update(r.v * dt, 0); r.model.setLights(true); r.model.setBrake(false);
}
export const rivals = () => mission.active?.rivals || [];
