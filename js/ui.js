// Interfeys: modal oynalar, xabarlar, zapravka, xizmat paneli, xarita, poyga, ishlar, pauza, sozlamalar
import { FUELS, carById, fmt, CARS } from './config.js';
import { state, activeCar, spend, touch, claimDaily, canClaimDaily, dailyTasks, resetSave, setName } from './state.js';
import { MISSIONS, mission, startMission, cancelMission } from './missions.js';
import { drawBigMap, bigMapToWorld, mapState, MAP_CATEGORIES, findNearestPOI, findMapItemAt } from './map.js';
import { beep, setVolume } from './audio.js';
import { openGarage } from './ui-garage.js';
import { stopGarage } from './garage3d.js';
import { applyControl } from './input.js';
import { goOnline, joinFriend, createPrivateRoom, joinRoomByCode, joinPublicServer, leave, info as onlineInfo, list as onlineList, displayId, playerId, onOnline, sendChat, sendOnlineEvent, chatHistory, serverStats, MAX_PLAYERS, PRIVATE_MAX_PLAYERS } from './online.js';
import { blockC } from './world/layout.js';

const $ = (s) => document.querySelector(s);
let game; // main.js beradigan API
let current = null, mapTimer = 0;

export function initUI(api) {
  game = api;
  $('#modalClose').onclick = closeModal;
  $('#modal').addEventListener('pointerdown', (e) => { if (e.target.id === 'modal') closeModal(); });
  document.querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => open(b.dataset.open)));
}

export const isOpen = () => !!current;
export function closeModal() {
  if (!current) return;
  current = null; clearInterval(mapTimer); stopGarage();
  $('#modal').classList.remove('show');
  game.onModal(false);
}
export function showModal(name, title, html) {
  current = name;
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = html;
  const m = $('#modal'); m.classList.remove('show'); void m.offsetWidth; m.classList.add('show');
  game.onModal(true);
  return $('#modalBody');
}
// Bir xil tugma ikki marta bosilsa — yopiladi
export function toggle(name) { if (current === name) closeModal(); else open(name); }
export function open(name) { beep('ok'); (PANELS[name] || (() => {}))(); }

export function toast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast ' + type; el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3100);
}

// ---------- Zapravka ----------
function gasStation() {
  const inst = activeCar(), cfg = carById(inst.id);
  const body = showModal('gas', '⛽ UZ-OIL zapravkasi', `
    <p style="margin-bottom:12px;color:var(--muted)">${cfg.name} · bak: <b>${inst.fuelL.toFixed(1)} / ${cfg.tank} l</b> · tavsiya etilgan: <b>${cfg.fuel}</b></p>
    <div class="fuel-types">${Object.entries(FUELS).map(([k, f]) => `
      <button class="card ${k === inst.fuelType ? 'sel' : ''}" data-fuel="${k}" style="text-align:left">
        <h3 style="color:${f.color}">${k}</h3><p>${fmt(f.price)} / litr</p>
        ${k === cfg.fuel ? '<p style="color:var(--green)">✔ Shu mashina uchun</p>' : '<p>Boshqa tur — quvvat biroz pasayadi</p>'}
      </button>`).join('')}</div>
    <div class="section-title">Litr miqdori: <b id="litVal"></b></div>
    <input type="range" id="lit" min="1" step="1" />
    <div class="row" style="margin-top:12px;align-items:center"><div>Jami: <b class="price" id="fuelTotal" style="color:var(--gold);font-size:20px"></b></div>
    <button class="btn gold" id="fillBtn">Benzin quyish</button></div>`);
  let type = inst.fuelType || cfg.fuel;
  const lit = body.querySelector('#lit');
  const sync = () => {
    // Boshqa turga o'tilsa, eski benzin to'kib tashlanadi
    const space = type === inst.fuelType ? cfg.tank - inst.fuelL : cfg.tank;
    lit.max = Math.max(1, Math.floor(space)); if (+lit.value > +lit.max) lit.value = lit.max;
    body.querySelector('#litVal').textContent = `${lit.value} l${type !== inst.fuelType ? ' (eski benzin to\'kiladi)' : ''}`;
    body.querySelector('#fuelTotal').textContent = fmt(lit.value * FUELS[type].price);
    body.querySelectorAll('[data-fuel]').forEach((b) => b.classList.toggle('sel', b.dataset.fuel === type));
    body.querySelector('#fillBtn').disabled = space < 1;
  };
  lit.value = Math.floor(cfg.tank - inst.fuelL) || 1;
  lit.oninput = sync;
  body.querySelectorAll('[data-fuel]').forEach((b) => (b.onclick = () => { type = b.dataset.fuel; sync(); lit.value = lit.max; sync(); }));
  body.querySelector('#fillBtn').onclick = () => {
    const l = +lit.value, cost = Math.round(l * FUELS[type].price);
    if (!spend(cost, `Benzin ${type}: ${l} l`)) { beep('err'); return toast("Mablag' yetarli emas", 'err'); }
    if (type !== inst.fuelType) { inst.fuelL = 0; inst.fuelType = type; }
    inst.fuelL = Math.min(cfg.tank, inst.fuelL + l); touch();
    beep('cash'); toast(`${l} l ${type} quyildi: −${fmt(cost)}`, 'cash'); closeModal();
  };
  sync();
}

// ---------- Xizmat paneli (E) ----------
function service() {
  const inst = activeCar(), cfg = carById(inst.id), repair = Math.round(inst.damage * cfg.price * 0.0008);
  const tasks = dailyTasks();
  const body = showModal('service', '🛠 Xizmat paneli', `
    <div class="grid">
      <div class="card"><h3>🔧 Ta'mirlash</h3><p>Holat: ${Math.round(100 - inst.damage)}%</p><p class="price">${fmt(repair)}</p><button class="btn" id="svRepair" ${inst.damage < 1 ? 'disabled' : ''}>Ta'mirlash</button></div>
      <div class="card"><h3>🚚 Evakuator</h3><p>Mashinani avtosalon oldiga olib borish</p><p class="price">${fmt(1_500_000)}</p><button class="btn" id="svTow">Chaqirish</button></div>
      <div class="card"><h3>⛽ Benzin olib kelish</h3><p>10 litr ${inst.fuelType}, joyiga yetkazib beriladi</p><p class="price">${fmt(10 * FUELS[inst.fuelType].price * 1.5)}</p><button class="btn" id="svFuel">Buyurtma</button></div>
      <div class="card"><h3>🎁 Kunlik bonus</h3><p>Har 20 soatda bir marta</p><p class="price">${fmt(25_000_000)}</p><button class="btn gold" id="svDaily" ${canClaimDaily() ? '' : 'disabled'}>${canClaimDaily() ? 'Olish' : 'Olingan'}</button></div>
    </div>
    <div class="section-title">Kundalik topshiriqlar</div>
    <div class="list">${tasks.map((t) => `<div><span>${t.done ? '✅' : '⬜'} ${t.name}</span><span>${t.stat === 'km' ? t.progress.toFixed(1) : Math.floor(t.progress)}/${t.goal} · <b class="plus">+${fmt(t.reward)}</b></span></div>`).join('')}</div>
    <div class="section-title">So'nggi tranzaksiyalar</div>
    <div class="list">${state.tx.slice(0, 12).map((t) => `<div><span>${new Date(t.t).toLocaleTimeString('uz')} · ${t.reason}</span><b class="${t.amount >= 0 ? 'plus' : 'minus'}">${t.amount >= 0 ? '+' : ''}${fmt(t.amount)}</b></div>`).join('') || '<div>Hali tranzaksiyalar yo\'q</div>'}</div>`);
  body.querySelector('#svRepair').onclick = () => {
    if (!spend(repair, `Ta'mirlash: ${cfg.name}`)) return toast("Mablag' yetarli emas", 'err');
    inst.damage = 0;
    inst.dmgParts = { front: 0, rear: 0, left: 0, right: 0 };
    touch(); beep('cash'); toast('Mashina to\'liq ta\'mirlandi', 'ok'); service();
  };
  body.querySelector('#svTow').onclick = () => {
    if (!spend(1_500_000, 'Evakuator xizmati')) return toast("Mablag' yetarli emas", 'err');
    game.tow(); closeModal(); toast('Mashina avtosalon oldiga olib kelindi', 'ok');
  };
  body.querySelector('#svFuel').onclick = () => {
    const cost = Math.round(10 * FUELS[inst.fuelType].price * 1.5);
    if (inst.fuelL > cfg.tank - 10) return toast('Bak deyarli to\'la', 'err');
    if (!spend(cost, `Benzin yetkazish: 10 l ${inst.fuelType}`)) return toast("Mablag' yetarli emas", 'err');
    inst.fuelL += 10; touch(); beep('cash'); service();
  };
  body.querySelector('#svDaily').onclick = () => { if (claimDaily()) { beep('cash'); toast(`Kunlik bonus: +${fmt(25_000_000)}`, 'cash'); service(); } };
}
// ---------- Katta Interaktiv Toshkent GPS Xaritasi (M) ----------
function bigMap() {
  const pl = game.player();
  const wp = game.waypoint();
  const distKm = wp ? (Math.hypot(wp.x - pl.x, wp.z - pl.z) / 1000).toFixed(2) : null;

  const body = showModal('map', '🗺️ Toshkent GPS Xaritasi (OpenStreetMap)', `
    <div class="gps-toolbar">
      <div class="gps-cats" id="gpsCatBar">
        ${MAP_CATEGORIES.map((c) => `
          <button type="button" class="gps-cat-btn ${mapState.filter === c.id ? 'on' : ''}" data-mcat="${c.id}">
            <span>${c.icon}</span><b>${c.label}</b>
          </button>
        `).join('')}
      </div>
      <div class="gps-quick-row">
        <button type="button" class="btn sm-btn primary" id="gpsNearGas">⛽ Eng yaqin Zapravka</button>
        <button type="button" class="btn sm-btn gold" id="gpsNearGarage">🚘 Eng yaqin Garaj</button>
        <button type="button" class="btn sm-btn" id="gpsCenterMe">🎯 Mening joyim</button>
        <button type="button" class="btn sm-btn" id="gpsZoomIn" title="Yaqinlashtirish">➕</button>
        <button type="button" class="btn sm-btn" id="gpsZoomOut" title="Uzoqlashtirish">➖</button>
        <button type="button" class="btn sm-btn danger" id="gpsClearWp" ${wp ? '' : 'style="display:none"'}>❌ GPS (${distKm || 0} km)</button>
      </div>
    </div>

    <div class="gps-map-stage">
      <canvas class="bigmap" id="bigMapCv" width="920" height="920"></canvas>
      <div id="mapPoiInspector" class="gps-poi-card hidden"></div>
    </div>
    <p class="hint" style="text-align:center;margin-top:6px">
      💡 Xaritadagi istalgan nuqta yoki belgi ustiga bosing — <b>GPS marshrut</b> chiziladi. G'ildirakcha yoki ➕/➖ orqali kattalashtiring.
    </p>
  `);

  const cv = body.querySelector('#bigMapCv');
  const inspector = body.querySelector('#mapPoiInspector');
  const clearBtn = body.querySelector('#gpsClearWp');

  const syncClearBtn = () => {
    const curWp = game.waypoint();
    const pNow = game.player();
    if (curWp) {
      const km = (Math.hypot(curWp.x - pNow.x, curWp.z - pNow.z) / 1000).toFixed(2);
      clearBtn.style.display = '';
      clearBtn.textContent = `❌ GPS (${km} km)`;
    } else {
      clearBtn.style.display = 'none';
    }
  };

  const renderInspector = () => {
    const sel = mapState.selectedPoi;
    if (!sel) {
      inspector.classList.add('hidden');
      inspector.innerHTML = '';
      return;
    }
    const pNow = game.player();
    const dKm = (Math.hypot(sel.x - pNow.x, sel.z - pNow.z) / 1000).toFixed(2);
    inspector.classList.remove('hidden');
    inspector.innerHTML = `
      <div class="poi-card-main">
        <div class="poi-ic" style="border-color:${sel.color}">${sel.icon}</div>
        <div class="poi-txt">
          <b>${sel.title}</b>
          <small>${sel.sub} · <span style="color:var(--cyan)">${dKm} km</span></small>
        </div>
      </div>
      <div class="poi-card-acts">
        <button type="button" class="btn sm-btn primary" id="poiSetGps">📍 Yo'nalish belgilash (GPS)</button>
        <button type="button" class="btn sm-btn" id="poiClose">✕</button>
      </div>
    `;
    inspector.querySelector('#poiSetGps').onclick = () => {
      game.setWaypoint({ x: sel.x, z: sel.z, label: sel.title });
      beep('ok');
      toast(`📍 GPS marshrut belgilandi: ${sel.title} (${dKm} km)`, 'ok');
      syncClearBtn();
      draw();
    };
    inspector.querySelector('#poiClose').onclick = () => {
      mapState.selectedPoi = null;
      renderInspector();
      draw();
    };
  };

  const draw = () => {
    drawBigMap(cv, game.player(), game.mapExtra());
    syncClearBtn();
  };

  // Kategoriya filtrlari
  body.querySelectorAll('[data-mcat]').forEach((b) => {
    b.onclick = () => {
      mapState.filter = b.dataset.mcat;
      body.querySelectorAll('[data-mcat]').forEach((x) => x.classList.toggle('on', x === b));
      beep('ok');
      draw();
    };
  });

  // Tezkor tugmalar: Eng yaqin Zapravka va Eng yaqin Garaj
  body.querySelector('#gpsNearGas').onclick = () => {
    const pNow = game.player();
    const near = findNearestPOI(pNow.x, pNow.z, 'gas');
    if (near) {
      mapState.selectedPoi = near;
      game.setWaypoint({ x: near.x, z: near.z, label: near.title });
      const km = (Math.hypot(near.x - pNow.x, near.z - pNow.z) / 1000).toFixed(2);
      beep('ok');
      toast(`⛽ Eng yaqin zapravka: ${near.title} (${km} km)`, 'ok');
      renderInspector();
      draw();
    }
  };

  body.querySelector('#gpsNearGarage').onclick = () => {
    const pNow = game.player();
    const near = findNearestPOI(pNow.x, pNow.z, 'garage');
    if (near) {
      mapState.selectedPoi = near;
      game.setWaypoint({ x: near.x, z: near.z, label: near.title });
      const km = (Math.hypot(near.x - pNow.x, near.z - pNow.z) / 1000).toFixed(2);
      beep('ok');
      toast(`🚘 Eng yaqin garaj: ${near.title} (${km} km)`, 'ok');
      renderInspector();
      draw();
    }
  };

  body.querySelector('#gpsCenterMe').onclick = () => {
    const pNow = game.player();
    mapState.panX = pNow.x;
    mapState.panZ = pNow.z;
    mapState.zoom = Math.max(1.5, mapState.zoom);
    beep('ok');
    draw();
  };

  body.querySelector('#gpsZoomIn').onclick = () => {
    mapState.zoom = Math.min(3.5, (mapState.zoom || 1) + 0.45);
    draw();
  };

  body.querySelector('#gpsZoomOut').onclick = () => {
    mapState.zoom = Math.max(1.0, (mapState.zoom || 1) - 0.45);
    if (mapState.zoom <= 1.05) { mapState.panX = 0; mapState.panZ = 0; }
    draw();
  };

  clearBtn.onclick = () => {
    game.setWaypoint(null);
    mapState.selectedPoi = null;
    renderInspector();
    beep('ok');
    toast("GPS yo'nalishi o'chirildi", 'ok');
    draw();
  };

  // Drag-to-pan va Click-to-select / Waypoint
  let dragStart = null;
  let moved = false;

  cv.addEventListener('pointerdown', (e) => {
    dragStart = { x: e.clientX, y: e.clientY, panX: mapState.panX || 0, panZ: mapState.panZ || 0 };
    moved = false;
    try { cv.setPointerCapture(e.pointerId); } catch { /* */ }
  });

  cv.addEventListener('pointermove', (e) => {
    if (!dragStart) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    if (Math.hypot(dx, dy) > 6) moved = true;
    if (moved && mapState.zoom > 1.02) {
      const r = cv.getBoundingClientRect();
      const worldSpan = 2100 / (mapState.zoom || 1);
      mapState.panX = dragStart.panX - (dx / r.width) * worldSpan;
      mapState.panZ = dragStart.panZ - (dy / r.height) * worldSpan;
      draw();
    }
  });

  const endPointer = (e) => {
    if (!dragStart) return;
    const wasMoved = moved;
    dragStart = null;
    if (wasMoved) return;

    const r = cv.getBoundingClientRect();
    const [wx, wz] = bigMapToWorld(
      ((e.clientX - r.left) / r.width) * cv.width,
      ((e.clientY - r.top) / r.height) * cv.height,
      cv.width
    );
    const hitPoi = findMapItemAt(wx, wz, 55 / Math.sqrt(mapState.zoom || 1));
    if (hitPoi) {
      mapState.selectedPoi = hitPoi;
      game.setWaypoint({ x: hitPoi.x, z: hitPoi.z, label: hitPoi.title });
      const pNow = game.player();
      const km = (Math.hypot(hitPoi.x - pNow.x, hitPoi.z - pNow.z) / 1000).toFixed(2);
      beep('ok');
      toast(`📍 ${hitPoi.icon} ${hitPoi.title} (${km} km)`, 'ok');
      renderInspector();
      draw();
    } else {
      mapState.selectedPoi = null;
      renderInspector();
      const curWp = game.waypoint();
      if (curWp && Math.hypot(curWp.x - wx, curWp.z - wz) < 38) {
        game.setWaypoint(null);
        toast("GPS nuqtasi o'chirildi", 'ok');
      } else {
        game.setWaypoint({ x: wx, z: wz });
        const pNow = game.player();
        const km = (Math.hypot(wx - pNow.x, wz - pNow.z) / 1000).toFixed(2);
        toast(`📍 GPS nuqta qo'yildi (${km} km)`, 'ok');
      }
      beep('ok');
      draw();
    }
  };

  cv.addEventListener('pointerup', endPointer);
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.28 : -0.28;
    mapState.zoom = Math.max(1.0, Math.min(3.5, (mapState.zoom || 1) + delta));
    draw();
  }, { passive: false });

  renderInspector();
  draw();
  mapTimer = setInterval(draw, 250);
}

// ---------- Poygalar (R) ----------
function races() {
  const h = game.hour(), night = h >= 20 || h < 5;
  const list = ['race', 'duel', 'drift'];
  const body = showModal('race', '🏁 Poygalar va musobaqalar', `
    ${mission.active ? `<div class="card" style="margin-bottom:12px"><h3>Faol: ${mission.active.name}</h3><button class="btn danger" id="cancelM">Bekor qilish</button></div>` : ''}
    <div class="grid">${list.map((k) => { const m = MISSIONS[k], locked = m.night && !night; return `
      <div class="card"><h3>${m.name}</h3><p>${m.desc}</p><p class="price">${m.fee ? 'Kirish: ' + fmt(m.fee) : 'Bepul'}</p>
      <button class="btn primary" data-start="${k}" ${locked ? 'disabled' : ''}>${locked ? '🌙 Tunda ochiladi' : 'Boshlash'}</button></div>`; }).join('')}</div>`);
  bindStart(body);
}

// ---------- Ishlar (T): yetkazib berish, taksi, ijara ----------
const RENTALS = ['malibu', 'm4gts', 'm4comp', 'bmw', 'mercedes', 'lambo'];
function jobs() {
  const body = showModal('jobs', '📦 Ishlar va xizmatlar', `
    ${mission.active ? `<div class="card" style="margin-bottom:12px"><h3>Faol: ${mission.active.name}</h3><button class="btn danger" id="cancelM">Bekor qilish</button></div>` : ''}
    <div class="grid">${['delivery', 'taxi'].map((k) => `<div class="card"><h3>${MISSIONS[k].name}</h3><p>${MISSIONS[k].desc}</p><button class="btn primary" data-start="${k}">Buyurtma olish</button></div>`).join('')}</div>
    <div class="section-title">🔑 Avtomobil ijarasi (10 daqiqa)</div>
    ${state.rental ? `<div class="card"><h3>Ijarada: ${carById(state.rental.car.id).name}</h3><p>Qolgan vaqt: ${Math.ceil((state.rental.until - Date.now()) / 60000)} daqiqa</p><button class="btn danger" id="endRent">Qaytarish</button></div>` : `
    <div class="grid">${RENTALS.map((id) => { const c = carById(id), price = Math.round(c.price * 0.004); return `
      <div class="card"><h3>${c.name}</h3><div class="stats"><span>Maks: <b>${c.maxSpeed} km/s</b></span><span>0-100: <b>${(27.8 / c.accel).toFixed(1)} s</b></span></div>
      <p class="price">${fmt(price)}</p><button class="btn" data-rent="${id}">Ijaraga olish</button></div>`; }).join('')}</div>`}`);
  bindStart(body);
  body.querySelectorAll('[data-rent]').forEach((b) => (b.onclick = () => {
    const c = carById(b.dataset.rent), price = Math.round(c.price * 0.004);
    if (!spend(price, `Ijara: ${c.name}`)) return toast("Mablag' yetarli emas", 'err');
    state.rental = { car: { uid: 'rent', id: c.id, color: '#111111', rims: 'chrome', spoiler: 'none', neon: 'none', engine: 0, fuelL: c.tank, fuelType: c.fuel, damage: 0 }, until: Date.now() + 10 * 60000 };
    touch(); game.changeCar(); beep('cash'); toast(`${c.name} 10 daqiqaga ijaraga olindi`, 'cash'); closeModal();
  }));
  const end = body.querySelector('#endRent');
  if (end) end.onclick = () => { game.endRental(); closeModal(); };
}

function bindStart(body) {
  body.querySelectorAll('[data-start]').forEach((b) => (b.onclick = () => { if (startMission(b.dataset.start, game.hour())) closeModal(); }));
  const c = body.querySelector('#cancelM');
  if (c) c.onclick = () => { cancelMission(); closeModal(); };
}

// ---------- Pauza (ESC), sozlamalar, yordam ----------
function pause() {
  const inf = onlineInfo();
  const dailyReady = canClaimDaily();
  const body = showModal('pause', '⏸ O\'yin Menyusi va Boshqaruv Markazi', `
    <div class="grid">
      <button class="btn primary big" data-a="resume">▶ O'yinni davom ettirish</button>
      <button class="btn gold big" data-a="garage">🚗 Garaj, Avtosalon va Tuning (G)</button>
      <button class="btn big" data-a="map">🗺️ Toshkent GPS Xaritasi (M)</button>
      <button class="btn big" data-a="race">🏁 Musobaqalar va Drift (R)</button>
      <button class="btn big" data-a="online">💰 Do'stlar va Depozit Poyga (${inf.count}/${inf.max || MAX_PLAYERS})</button>
      <button class="btn big" data-a="jobs">📦 Ishlar, Taksi va Ijara (T)</button>
      <button class="btn big ${dailyReady ? 'gold' : ''}" data-a="service">🛠 Xizmat va Kunlik Mukofot ${dailyReady ? '🎁' : ''}</button>
      <button class="btn big" data-a="leaderboard">🏆 Reyting va Statistika</button>
      <button class="btn big" data-a="settings">⚙ Sozlamalar va Grafika</button>
      <button class="btn big" data-a="help">⌨ Boshqaruv Yordami</button>
      <button class="btn big" data-a="save">💾 O'yinni Saqlash</button>
      <button class="btn danger big" data-a="lobby">🏠 Bosh menyuga qaytish</button>
    </div>
    <div class="section-title">Joriy Sessiya va Statistika</div>
    <div class="list">
      <div><span>Haydovchi</span><b>${state.name || 'Haydovchi'} (${displayId(inf.id)})</b></div>
      <div><span>Joriy Xona</span><b style="color:var(--cyan)">${displayId(inf.host || 'PUBLIC')} (${inf.roomType === 'private' ? '🔒 Private' : '🌍 Ommaviy'})</b></div>
      <div><span>Jami masofa</span><b>${state.totalKm.toFixed(1)} km</b></div>
      <div><span>Garajdagi mashinalar</span><b>${state.cars.length} / ${CARS.length}</b></div>
      <div><span>Balans</span><b class="plus">${fmt(state.money)}</b></div>
    </div>`);
  const act = {
    resume: closeModal,
    lobby: () => { closeModal(); game.returnToLobby?.(); },
    online,
    garage: () => open('garage'),
    map: () => open('map'),
    race: () => open('race'),
    jobs: () => open('jobs'),
    service: () => open('service'),
    leaderboard: () => open('leaderboard'),
    settings,
    help,
    save: () => { game.save(); toast("O'yin saqlandi", 'ok'); },
  };
  body.querySelectorAll('[data-a]').forEach((b) => (b.onclick = act[b.dataset.a]));
}

function online() {
  const inf = onlineInfo();
  const peers = onlineList();
  const myCode = displayId(inf.id);
  const roomCode = inf.host || 'PUBLIC';
  const isPrivate = inf.roomType === 'private' && roomCode !== 'PUBLIC' && !String(roomCode).startsWith('PUBLIC');
  const maxCap = inf.max || (isPrivate ? PRIVATE_MAX_PLAYERS : MAX_PLAYERS);
  const myCar = carById(activeCar().id);

  const statusBadge = {
    off: '<span class="minus">🔴 Ulanmagan</span>',
    connecting: '<span style="color:var(--gold)">🟡 Serverga ulanmoqda...</span>',
    ready: '<span class="plus">🟢 Online tayyor</span>',
    joining: '<span style="color:var(--gold)">🟡 Xonaga ulanmoqda...</span>',
    connected: isPrivate
      ? `<span class="plus">🔒 Do'stlar Xonasi · Kod: <b>${roomCode}</b> (${inf.count}/${maxCap})</span>`
      : `<span class="plus">🌍 Ommaviy Server · ${displayId(roomCode)} (${inf.count}/${maxCap})</span>`,
  }[inf.status] || '';

  const body = showModal('online', `🌐 Multiplayer Xona Tizimi (${inf.count}/${maxCap})`, `
    <!-- Jonli Server Statistikasi -->
    <div class="list" style="margin-bottom:12px">
      <div style="flex-wrap:wrap;gap:8px;background:rgba(0,229,255,0.08);border:1px solid var(--line)">
        <span>🟢 Jami Online: <b>${serverStats.totalOnline}</b></span>
        <span>🌍 Ommaviy Server: <b>${serverStats.publicPlayers}/${serverStats.publicMax}</b></span>
        <span>🔒 Private Xonalar: <b>${serverStats.privateRooms}</b></span>
        <span>⚡ Ping: <b style="color:var(--cyan)">${serverStats.pingMs} ms</b></span>
      </div>
    </div>

    <div class="set-grid">
      <section class="set-card">
        <h3>🌍 Ommaviy Server va Do'stlar Xonasi</h3>
        <div class="id-box">
          <div>
            <small>${isPrivate ? "Do'stlaringizga shu 6 belgili XONA KODINI yuboring:" : 'Joriy ulangan server:'}</small>
            <strong id="myIdCode">${isPrivate ? roomCode : displayId(roomCode)}</strong>
          </div>
          <button class="btn primary" id="copyIdBtn">📋 ${isPrivate ? 'Xona kodini nusxalash' : 'ID nusxalash'}</button>
        </div>

        <div class="row" style="margin-top:8px">
          <button class="btn gold" id="createPrivateBtn">🔒 Do'stlar xonasi yaratish</button>
          <button class="btn primary" id="joinLobbyBtn">🌍 Ommaviy serverga kirish</button>
        </div>
        ${isPrivate ? `<button class="btn danger" id="leaveRoomBtn" style="width:100%;margin-top:8px">🚪 Private xonadan chiqish</button>` : ''}

        <label class="online-lbl" style="margin-top:10px">Haydovchi ismingiz (ID: <b>${myCode}</b>)
          <div class="row" style="margin-top:6px">
            <input id="onlineName" maxlength="18" value="${state.name}" placeholder="Ismingiz..." style="margin:0" />
            <button class="btn" id="saveNameBtn" style="flex:0 0 auto">Saqlash</button>
          </div>
        </label>
        <p class="hint" style="margin-top:8px">Holat: ${statusBadge}</p>
      </section>

      <section class="set-card">
        <h3>🔑 Xona kodi orqali ulanish</h3>
        <label class="online-lbl">6 belgili Xona kodini kiriting:
          <div class="row" style="margin-top:6px">
            <input id="friendIdInput" maxlength="12" placeholder="Masalan: 7K2M9Q" style="margin:0;text-transform:uppercase;font-weight:800;letter-spacing:1.5px" />
            <button class="btn primary" id="joinFriendBtn" style="flex:0 0 auto">🔗 Xonaga kirish</button>
          </div>
        </label>
        <div class="list" style="margin-top:12px;font-size:12px">
          <div><span>1️⃣ Do'stlar xonasi yaratish</span><b>6 belgili kod beriladi</b></div>
          <div><span>2️⃣ Kodni do'stlarga ulashish</span><b>📋 Nusxalab yuboring</b></div>
          <div><span>3️⃣ Bo'sh xonalar tozalanishi</span><b>2 daqiqada avtomatik</b></div>
        </div>
        <p class="hint">Faqat bitta xonadagi o'yinchilar bir-birini ko'radi va birga Toshkentda hayday oladi.</p>
      </section>
    </div>

    <div class="section-title">💬 Real-vaqt suhbat va Online Poyga chaqiruvi</div>
    <div class="card" style="margin-bottom:12px">
      <div class="opts" style="margin:0">
        ${['👋 Salom!', '💺 Mashinamga o\'tiring!', '🏁 Poyga o\'ynaymiz!', '🔥 Driftga qarang!', '📍 Yonimga keling!', '👍 Zo\'r mashina!'].map((q) => `<button class="btn sm-btn" data-qchat="${q}">${q}</button>`).join('')}
      </div>
      <div class="row" style="margin-top:6px">
        <input id="chatInput" maxlength="56" placeholder="Xonadagi do'stlarga xabar yozing (3D mashina va personaj ustida ko'rinadi)..." style="margin:0" />
        <button class="btn primary" id="sendChatBtn" style="flex:0 0 auto">💬 Yuborish</button>
      </div>
      <div id="onlineChatLog" class="list" style="margin-top:8px;max-height:110px;overflow-y:auto">
        ${chatHistory.length === 0 ? '<div style="color:var(--muted);justify-content:center">Suhbat tarixi shu yerda ko\'rinadi</div>' : chatHistory.slice(-8).map((m) => `<div><span>💬 <b>${m.fromName}:</b> ${m.text}</span><small style="color:var(--muted)">${new Date(m.ts).toLocaleTimeString('uz').slice(0, 5)}</small></div>`).join('')}
      </div>
      <div class="section-title" style="margin-top:8px">🏁 Xonadagi do'stlar bilan Online Poyga (Umumiy GPS marra)</div>
      <div class="opts" style="margin:0">
        <button class="btn sm-btn gold" data-orace="Tashkent City" data-rx="${blockC(5)}" data-rz="${blockC(7)}">🏙️ Tashkent City gacha!</button>
        <button class="btn sm-btn gold" data-orace="Chorsu Bozori" data-rx="${blockC(3)}" data-rz="${blockC(5)}">🏛️ Chorsu bozorigacha!</button>
        <button class="btn sm-btn gold" data-orace="Teleminora" data-rx="${blockC(8)}" data-rz="${blockC(2)}">🗼 Teleminoragacha!</button>
        <button class="btn sm-btn gold" data-orace="Minor Masjidi" data-rx="${blockC(7)}" data-rz="${blockC(4)}">🕌 Minor masjidigacha!</button>
      </div>
    </div>

    <div class="section-title">💰 Do'stlar bilan Depozit Poyga (Garov + 100% O'yin Bonusi)</div>
    <div class="card" style="margin-bottom:12px;border-color:rgba(255,215,64,0.45)">
      <p style="font-size:12px;color:var(--muted)">
        Har ikki o'yinchi virtual valyutada (so'm) garov qo'yadi. O'yin umumiy fondga <b>+100% bonus</b> qo'shadi va g'olib barchasini oladi! (Masalan: 10M + 5M = 15M fond + 15M bonus = <b style="color:var(--gold)">30 000 000 so'm</b>)
      </p>
      ${(() => {
        const drState = game.getDepositRaceState?.() || {};
        const inv = drState.invite;
        const act = drState.active;
        const myId = playerId();
        if (act) {
          return `<div class="id-box" style="margin:6px 0;border-color:var(--gold)">
            <div>
              <small>Faol Depozit Poyga · Marra: <b>${act.target?.name || 'Marra'}</b></small>
              <strong style="color:var(--gold);font-size:18px">Sovrin: ${fmt(act.totalPrize)}</strong>
            </div>
            <button class="btn danger sm-btn" id="cancelDepRaceBtn">❌ Bekor qilish</button>
          </div>`;
        }
        if (inv && inv.hostId !== myId) {
          return `<div class="id-box" style="margin:6px 0;border-color:var(--green);flex-wrap:wrap">
            <div>
              <small>🏁 <b>${inv.hostName}</b> sizni «${inv.target?.name}» gacha Depozit Poygaga chaqirdi!</small>
              <strong style="color:var(--gold);font-size:16px">Uning garovi: ${fmt(inv.hostDeposit)}</strong>
            </div>
            <div class="row" style="width:100%;margin-top:6px;align-items:center">
              <select id="guestDepSelect" style="margin:0;flex:1">
                <option value="5000000">Garovim: 5 000 000 so'm</option>
                <option value="10000000" selected>Garovim: 10 000 000 so'm</option>
                <option value="25000000">Garovim: 25 000 000 so'm</option>
                <option value="50000000">Garovim: 50 000 000 so'm</option>
              </select>
              <button class="btn gold sm-btn" id="acceptDepRaceBtn" data-rid="${inv.raceId}">✅ Qabul qilish va Start</button>
              <button class="btn danger sm-btn" id="declineDepRaceBtn" data-rid="${inv.raceId}">✕</button>
            </div>
          </div>`;
        }
        if (inv && inv.hostId === myId) {
          return `<div class="id-box" style="margin:6px 0;border-color:var(--cyan)">
            <div>
              <small>Do'stingiz tasdiqlashini kutilmoqda · Marra: <b>${inv.target?.name}</b></small>
              <strong style="color:var(--gold);font-size:16px">Sizning garovingiz: ${fmt(inv.hostDeposit)}</strong>
            </div>
            <button class="btn danger sm-btn" id="cancelDepInviteBtn" data-rid="${inv.raceId}">❌ Bekor qilish (Pul qaytadi)</button>
          </div>`;
        }
        return `<div class="row" style="align-items:center;margin-top:4px">
          <select id="depTargetSelect" style="margin:0;flex:1.1">
            <option value="Tashkent City|${blockC(5)}|${blockC(7)}">📍 Marra: Tashkent City</option>
            <option value="Chorsu Bozori|${blockC(3)}|${blockC(5)}">📍 Marra: Chorsu Bozori</option>
            <option value="Teleminora|${blockC(8)}|${blockC(2)}">📍 Marra: Teleminora</option>
            <option value="Minor Masjidi|${blockC(7)}|${blockC(4)}">📍 Marra: Minor Masjidi</option>
          </select>
          <select id="depAmountSelect" style="margin:0;flex:1">
            <option value="5000000">💰 5 000 000 so'm</option>
            <option value="10000000" selected>💰 10 000 000 so'm</option>
            <option value="25000000">💰 25 000 000 so'm</option>
            <option value="50000000">💰 50 000 000 so'm</option>
          </select>
          <button class="btn gold" id="createDepRaceBtn" style="flex:0 0 auto">🏁 Garovli Poyga E'lon Qilish</button>
        </div>`;
      })()}
    </div>

    <div class="section-title">Xonadagi o'yinchilar (${inf.count} / ${maxCap})</div>
    <div class="list" id="onlinePeersList">
      <div>
        <span>🟢 <b>${state.name || 'Siz'}</b> <small style="color:var(--cyan)">(${myCode} · Siz)</small></span>
        <b>${myCar.name}</b>
      </div>
      ${peers.length === 0 ? `<div style="color:var(--muted);justify-content:center">Hozircha xonada boshqa o'yinchi yo'q — do'stingiz xona kodini kiritsa shu yerda paydo bo'ladi!</div>` : peers.map((p) => {
        const c = carById(p.car);
        const spd = Math.round(Math.abs(p.v || 0) * 3.6);
        return `<div>
          <span>🟢 <b>${p.name || 'Haydovchi'}</b> <small style="color:var(--cyan)">(${displayId(p.id)})</small> ${p.onFoot ? '<small style="color:var(--gold)">🚶 Piyoda</small>' : ''}${p.chat ? ` · <b style="color:var(--gold)">«${p.chat}»</b>` : ''}</span>
          <span style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <small style="color:var(--muted)">${spd} km/s</small>
            <b>${c.name}</b>
            <button class="btn sm-btn" data-tp="${p.id}">📍 Yoniga borish</button>
            <button class="btn sm-btn primary" data-sit="${p.id}">💺 Mashinasiga o'tirish</button>
          </span>
        </div>`;
      }).join('')}
    </div>
  `);

  body.querySelector('#copyIdBtn').onclick = () => {
    const codeToCopy = isPrivate ? roomCode : inf.id;
    navigator.clipboard?.writeText(codeToCopy);
    toast(`Nusxalandi: ${codeToCopy}`, 'ok');
  };
  body.querySelector('#saveNameBtn').onclick = () => {
    const v = body.querySelector('#onlineName').value.trim();
    if (!v) return toast('Ismingizni kiriting', 'err');
    setName(v);
    const hn = document.getElementById('hudName'); if (hn) hn.textContent = v;
    const mn = document.getElementById('nameInput'); if (mn) mn.value = v;
    toast(`Ism saqlandi: ${v}`, 'ok');
    online();
  };
  body.querySelector('#createPrivateBtn').onclick = async () => {
    try {
      const newCode = await createPrivateRoom();
      navigator.clipboard?.writeText(newCode).catch(() => {});
      beep('ok');
      toast(`🔒 Do'stlar xonasi yaratildi! Kod: ${newCode} (nusxalandi)`, 'cash');
      if (current === 'online') online();
    } catch (e) {
      toast(e.message || "Xona yaratib bo'lmadi", 'err');
    }
  };
  const doJoin = async (code) => {
    try {
      const joined = await joinRoomByCode(code);
      beep('ok');
      toast(`Xonaga ulandingiz: ${displayId(joined)}`, 'ok');
      if (current === 'online') online();
    } catch (e) {
      beep('err');
      toast(e.message || 'Ulanishda xatolik', 'err');
      if (current === 'online') online();
    }
  };
  body.querySelector('#joinFriendBtn').onclick = () => {
    const code = body.querySelector('#friendIdInput').value.trim();
    if (!code) return toast("6 belgili xona kodini kiriting", 'err');
    doJoin(code);
  };
  body.querySelector('#friendIdInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') body.querySelector('#joinFriendBtn').click();
  });
  body.querySelector('#joinLobbyBtn').onclick = async () => {
    try {
      await joinPublicServer();
      beep('ok');
      toast('🌍 Ommaviy serverga ulandingiz!', 'ok');
      if (current === 'online') online();
    } catch (e) {
      toast(e.message || 'Xatolik', 'err');
    }
  };
  const lv = body.querySelector('#leaveRoomBtn');
  if (lv) lv.onclick = () => { leave(); toast('🌍 Ommaviy serverga qaytdingiz', 'ok'); online(); };

  body.querySelectorAll('[data-tp]').forEach((b) => (b.onclick = () => {
    const p = peers.find((x) => x.id === b.dataset.tp);
    if (!p) return;
    game.teleportTo?.(p.x + 3.5, p.z + 3.5, p.h || 0);
    closeModal();
    toast(`${p.name} yoniga o'tdingiz!`, 'ok');
  }));

  body.querySelectorAll('[data-sit]').forEach((b) => (b.onclick = () => {
    const p = peers.find((x) => x.id === b.dataset.sit);
    if (!p) return;
    game.sitInFriendCar?.(p.id);
    closeModal();
  }));

  body.querySelectorAll('[data-orace]').forEach((b) => (b.onclick = () => {
    const place = b.dataset.orace;
    const x = Number(b.dataset.rx) || 0;
    const z = Number(b.dataset.rz) || 0;
    sendOnlineEvent({
      type: 'race',
      text: `🏁 ${state.name || 'Haydovchi'} barchani «${place}» gacha poygaga chaqirdi!`,
      target: { x, z, name: place },
    });
    game.setWaypoint?.({ x, z });
    beep('go');
    toast(`🏁 Online poyga marrasi belgilandi: ${place}!`, 'cash');
    closeModal();
  }));

  // Do'stlar bilan Depozit Poyga (Invite / Accept / Cancel)
  const createDepBtn = body.querySelector('#createDepRaceBtn');
  if (createDepBtn) {
    createDepBtn.onclick = () => {
      const tVal = body.querySelector('#depTargetSelect')?.value || `Tashkent City|${blockC(5)}|${blockC(7)}`;
      const [tName, tx, tz] = tVal.split('|');
      const dep = Number(body.querySelector('#depAmountSelect')?.value) || 10_000_000;
      if (!spend(dep, `Depozit Poyga garovi (${tName})`)) {
        beep('err');
        return toast("Garov uchun mablag' yetarli emas!", 'err');
      }
      sendOnlineEvent({
        type: 'deposit_race',
        action: 'invite',
        deposit: dep,
        target: { name: tName, x: Number(tx) || 0, z: Number(tz) || 0 },
      });
      beep('cash');
      toast(`🏁 Depozit poyga e'lon qilindi: ${fmt(dep)} garov!`, 'cash');
      setTimeout(() => { if (current === 'online') online(); }, 180);
    };
  }
  const acceptDepBtn = body.querySelector('#acceptDepRaceBtn');
  if (acceptDepBtn) {
    acceptDepBtn.onclick = () => {
      const rid = acceptDepBtn.dataset.rid;
      const dep = Number(body.querySelector('#guestDepSelect')?.value) || 10_000_000;
      if (!spend(dep, 'Depozit Poyga garovi (Qabul qilish)')) {
        beep('err');
        return toast("Garov uchun mablag' yetarli emas!", 'err');
      }
      sendOnlineEvent({
        type: 'deposit_race',
        action: 'accept',
        raceId: rid,
        deposit: dep,
      });
      closeModal();
    };
  }
  const declineDepBtn = body.querySelector('#declineDepRaceBtn');
  if (declineDepBtn) {
    declineDepBtn.onclick = () => {
      sendOnlineEvent({
        type: 'deposit_race',
        action: 'cancel',
        raceId: declineDepBtn.dataset.rid,
      });
      setTimeout(() => { if (current === 'online') online(); }, 180);
    };
  }
  const cancelInvBtn = body.querySelector('#cancelDepInviteBtn');
  if (cancelInvBtn) {
    cancelInvBtn.onclick = () => {
      sendOnlineEvent({
        type: 'deposit_race',
        action: 'cancel',
        raceId: cancelInvBtn.dataset.rid,
      });
      setTimeout(() => { if (current === 'online') online(); }, 180);
    };
  }
  const cancelActBtn = body.querySelector('#cancelDepRaceBtn');
  if (cancelActBtn) {
    cancelActBtn.onclick = () => {
      const dr = game.getDepositRaceState?.()?.active;
      if (dr) {
        sendOnlineEvent({
          type: 'deposit_race',
          action: 'cancel',
          raceId: dr.raceId,
        });
      }
      setTimeout(() => { if (current === 'online') online(); }, 180);
    };
  }

  const doChat = (txt) => {
    const t = String(txt || '').trim();
    if (!t) return;
    sendChat(t, state.name || 'Haydovchi');
    beep('ok');
    toast(`💬 Siz: ${t}`, 'ok');
    renderModalChatLog();
  };
  body.querySelectorAll('[data-qchat]').forEach((b) => (b.onclick = () => doChat(b.dataset.qchat)));
  body.querySelector('#sendChatBtn').onclick = () => {
    const inp = body.querySelector('#chatInput');
    doChat(inp.value);
    inp.value = '';
  };
  body.querySelector('#chatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') body.querySelector('#sendChatBtn').click();
  });

  if (inf.status === 'off') {
    goOnline().then(() => { if (current === 'online') online(); }).catch(() => {});
  }
}

function settings() {
  const s = state.settings;
  const seg = (id, items, cur) => `<div class="seg" data-seg="${id}">${items.map(([k, ic, n, d]) => `<button data-v="${k}" class="${String(cur) === String(k) ? 'on' : ''}"><i>${ic}</i><b>${n}</b>${d ? `<small>${d}</small>` : ''}</button>`).join('')}</div>`;
  const body = showModal('settings', '⚙ Sozlamalar', `
    <div class="set-grid">
      <section class="set-card">
        <h3>🎮 Boshqaruv rejimi</h3>
        ${seg('control', [['auto', '✨', 'Avto', 'Qurilmani o\'zi aniqlaydi'], ['pc', '🖥️', 'Kompyuter', 'Klaviatura + sichqoncha'], ['phone', '📱', 'Telefon', 'Gorizontal + Rul']], s.control)}
        <p class="hint" id="ctlHint"></p>
      </section>
      <section class="set-card">
        <h3>🛞 Telefon rul va tugmalar</h3>
        <div class="section-title" style="margin-top:0">Burilish boshqaruvi</div>
        ${seg('steerType', [['wheel', '🛞', 'Aylanuvchi Rul', 'Silliq analog rul'], ['buttons', '◀▶', 'Tugmalar', 'Chap / O\'ng tugma']], s.steerType || 'wheel')}
        <div class="section-title">Tugmalar va rul o'lchami</div>
        ${seg('touchScale', [['normal', '⚖️', "O'rta", 'Standart o\'lcham'], ['large', '🔎', 'Katta', 'Kattaroq rul va pedallar']], s.touchScale || 'normal')}
        <button class="btn primary" id="landscapeBtn" style="width:100%;margin-top:10px">⛶ Gorizontal To'liq Ekran (Landscape)</button>
      </section>
      <section class="set-card">
        <h3>🖼️ Grafik sifati</h3>
        ${seg('quality', [['low', '⚡', 'Past', 'Eng tez'], ['medium', '⚖️', "O'rta", ''], ['high', '💎', 'Yuqori', 'Soyalar + Bloom'], ['ultra', '🚀', 'Ultra', 'Maksimal']], s.quality)}
        <p class="hint">Past — soyalar va bloom o'chiriladi. Kuchli telefon va kompyuterlarda «Yuqori» yoki «Ultra» ham to'liq ishlaydi.</p>
        <button class="btn" id="perfAuditBtn" style="width:100%;margin-top:8px">📊 Performance Audit (FPS / Draw Calls — F3)</button>
      </section>
      <section class="set-card">
        <h3>🔊 Motor ovozi va kamera</h3>
        <label class="slide"><span>Motor va o'yin ovozi</span><b id="volV">${Math.round(s.volume * 100)}%</b><input type="range" id="vol" min="0" max="1" step="0.05" value="${s.volume}" /></label>
        <label class="slide"><span>Kamera sezgirligi</span><b id="sensV">${s.sens.toFixed(1)}</b><input type="range" id="sens" min="0.3" max="2.5" step="0.1" value="${s.sens}" /></label>
        <label class="toggle"><span>💨 Drift tutuni</span><input type="checkbox" id="smoke" ${s.smoke !== false ? 'checked' : ''} /><i></i></label>
      </section>
      <section class="set-card danger-zone">
        <h3>🗂️ Ma'lumotlar</h3>
        <button class="btn danger" id="reset">🗑 Progressni o'chirish va qaytadan boshlash</button>
      </section>
    </div>`);
  const hint = () => {
    const mode = applyControl(s.control, s.steerType, s.touchScale);
    body.querySelector('#ctlHint').textContent = (s.control === 'auto' ? 'Avto: ' : '') + (mode === 'phone' ? `ekranda ${s.steerType === 'buttons' ? 'chap/o\'ng tugmalar' : 'aylanuvchi rul (🛞)'} va gaz/tormoz pedallari yoqilgan.` : 'W A S D / strelkalar, Shift — nitro, Space — drift.');
  };
  hint();
  body.querySelectorAll('[data-seg]').forEach((g) => g.querySelectorAll('button').forEach((b) => (b.onclick = () => {
    g.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    const kind = g.dataset.seg;
    if (kind === 'control') { s.control = b.dataset.v; touch(); hint(); }
    else if (kind === 'steerType') { s.steerType = b.dataset.v; touch(); hint(); }
    else if (kind === 'touchScale') { s.touchScale = b.dataset.v; touch(); hint(); }
    else if (kind === 'quality') { const prev = s.quality; s.quality = b.dataset.v; touch(); game.setQuality(s.quality, prev); }
  })));
  body.querySelector('#landscapeBtn').onclick = () => {
    document.documentElement.requestFullscreen?.().then(() => {
      screen.orientation?.lock?.('landscape').catch(() => {});
    }).catch(() => {});
    screen.orientation?.lock?.('landscape').catch(() => {});
    toast("Gorizontal to'liq ekran rejimi yoqildi", 'ok');
  };
  body.querySelector('#vol').oninput = (e) => { s.volume = +e.target.value; body.querySelector('#volV').textContent = Math.round(s.volume * 100) + '%'; setVolume(s.volume); touch(); };
  body.querySelector('#sens').oninput = (e) => { s.sens = +e.target.value; window.__sens = s.sens; body.querySelector('#sensV').textContent = s.sens.toFixed(1); touch(); };
  body.querySelector('#smoke').onchange = (e) => { s.smoke = e.target.checked; touch(); };
  const paBtn = body.querySelector('#perfAuditBtn');
  if (paBtn) paBtn.onclick = () => { window.__togglePerfAudit?.(); };
  body.querySelector('#reset').onclick = () => { if (confirm("Barcha progress (pul, mashinalar) o'chiriladi. Davom etasizmi?")) resetSave(); };
}
function about() {
  const f = (i, t, d, soon) => `<div class="feat${soon ? ' soon' : ''}"><b>${i} ${t}${soon ? '<em>TEZDA</em>' : ''}</b><span>${d}</span></div>`;
  showModal('about', 'ℹ️ O\'yin haqida', `
    <p class="about-hero"><b style="color:var(--text)">TUNGI TOSHKENT</b> — brauzerda ishlaydigan 3D ochiq dunyo avtosimulyator. Toshkent ko'chalarida haydang, pul ishlang, mashina sotib oling va tuning qiling. Hech narsa o'rnatish shart emas, progress qurilmangizda saqlanadi.</p>
    <div class="section-title">Nimalar bor</div>
    <div class="feat-grid">
      ${f('🚗', '8 ta 3D mashina', 'Chevrolet, BMW, Mercedes va Lamborghini — haqiqiy 3D modellar.')}
      ${f('🏁', 'Poyga va drift', 'Raqiblar bilan poyga, drift paytida shinadan tutun.')}
      ${f('🚕', 'Ish va missiyalar', 'Taksi, yetkazib berish, ijara va kunlik topshiriqlar.')}
      ${f('🎨', 'Tuning', 'Rang, disk, spoyler, neon va dvigatel kuchaytirish.')}
      ${f('⛽', 'Benzin va ta\'mir', 'Yoqilg\'i turi, zapravka, xizmat paneli va evakuator.')}
      ${f('🌗', 'Kun va tun', '24 daqiqada bir kecha-kunduz, shahar chiroqlari va yulduzlar.')}
      ${f('🚶', '3D piyodalar va transport', 'Yo\'llarda jonli NPC mashinalar va yuruvchi odamlar.')}
      ${f('📱', 'Har qanday qurilma', 'Avto / Kompyuter / Telefon boshqaruvi.')}
    </div>`);
}

function ideas() {
  const f = (i, t, d) => `<div class="feat soon"><b>${i} ${t}<em>G'OYA</em></b><span>${d}</span></div>`;
  showModal('ideas', '💡 G\'oyalar va rejalar', `
    <p class="about-hero">O'yinni keyingi versiyalarda shunday rivojlantirish mumkin. Qaysi biri yoqsa, ayting — birinchi shuni qo'shamiz!</p>
    <div class="feat-grid">
      ${f('🌧️', 'Ob-havo', 'Yomg\'ir, tuman va ho\'l asfalt aksi.')}
      ${f('👮', 'Yo\'l politsiyasi', 'Tezlikni oshirsangiz, DPX mashinasi quvib keladi.')}
      ${f('🌐', 'Onlayn rejim', 'Do\'stlar bilan bitta shaharda haydash va poyga.')}
      ${f('🏠', 'Uy va garaj', 'Pul yig\'ib uy sotib olish, garajni bezash.')}
      ${f('🏆', 'Reyting jadvali', 'Eng tez davra, eng uzun drift va haftalik musobaqalar.')}
      ${f('📸', 'Foto rejim', 'Kamerani erkin qo\'yib, mashinani suratga olish.')}
      ${f('🔊', 'Radio', 'Mashinada o\'zbek va jahon musiqalari bilan radio.')}
      ${f('🔧', 'Chuqur tuning', 'G\'ildirak, pasaytirilgan podveska, bo\'yoq turlari va stiker.')}
      ${f('🕹️', 'Gamepad', 'Joystik / o\'yin pulti qo\'llab-quvvatlashi.')}
      ${f('🗺️', 'Yangi tumanlar', 'Chilonzor, Yunusobod, Mirobod — alohida muhit va missiyalar.')}
    </div>`);
}
function help() {
  const keys = [
    ['W A S D / ↑↓←→', 'Haydash (mashinada) / Yurish (piyoda)'],
    ['Shift', 'Nitro (mashinada) / Yugurish (piyoda)'],
    ['Space', "Qo'l tormozi va Drift / Sakrash (piyoda)"],
    ['E', 'Mashinaga kirish (piyoda) / Xizmat paneli va Zapravka'],
    ['F', 'Mashinadan tushish (ExitCar animatsiyasi bilan)'],
    ['G', 'Garaj, Avtosalon va 3D Tuning'],
    ['M', 'Toshkent katta xaritasi va GPS'],
    ['R', 'Poygalar va Tungi Drift musobaqalari'],
    ['T', 'Taksi, Yetkazib berish va Avto-ijara'],
    ['O', "Online Multiplayer va Do'stlar xonasi"],
    ['L', 'Faralarni yoqish / o\'chirish'],
    ['H', 'Avtomobil signali'],
    ['C', "Kamera ko'rinishini almashtirish"],
    ['ESC', 'Pauza va Boshqaruv Markazi'],
    ['Sichqoncha / Surish', 'Kamerani 360° aylantirish, g\'ildirak — masofa'],
  ];
  showModal('help', '⌨ Boshqaruv va Tugmalar', `<div class="keys">${keys.map(([k, d]) => `<div><span class="key">${k}</span>${d}</div>`).join('')}</div>`);
}

function leaderboard() {
  const peers = onlineList();
  const myKm = state.totalKm || 0;
  const rows = [
    { name: state.name || 'Siz (Haydovchi)', car: carById(activeCar().id).name, km: myKm, wins: state.stats?.raceWins || 0, isMe: true },
    ...peers.map((p, idx) => ({
      name: p.name || 'Haydovchi',
      car: carById(p.car).name,
      km: Math.max(2.5, (idx + 1) * 8.4),
      wins: Math.max(1, 3 - idx),
      isMe: false,
    })),
    { name: 'Sardor_UZ', car: 'Lamborghini Aventador', km: 142.8, wins: 19, isMe: false },
    { name: 'Jasur_M4', car: 'BMW M4 GTS', km: 98.4, wins: 14, isMe: false },
    { name: 'Toshkent_King', car: 'Mercedes-AMG G 63', km: 76.2, wins: 11, isMe: false },
    { name: 'Temur_Drift', car: 'BMW M5 CS', km: 54.0, wins: 8, isMe: false },
  ].sort((a, b) => b.km - a.km);

  showModal('leaderboard', '🏆 Toshkent Top Haydovchilari Reytingi', `
    <p style="color:var(--muted);margin-bottom:10px">Toshkent ko'chalarida eng ko'p masofa bosib o'tgan va poygalarda g'olib bo'lgan yetakchi haydovchilar:</p>
    <div class="list">
      ${rows.map((r, i) => `<div style="${r.isMe ? 'border:1px solid var(--cyan);background:rgba(0,229,255,0.12)' : ''}">
        <span><b>#${i + 1}</b> · <b>${r.name}</b> ${r.isMe ? '<small style="color:var(--cyan)">(Siz)</small>' : ''} <small style="color:var(--muted)">· ${r.car}</small></span>
        <span>🏆 <b>${r.wins}</b> g'alaba · <b class="plus">${r.km.toFixed(1)} km</b></span>
      </div>`).join('')}
    </div>
  `);
}

const PANELS = { gas: gasStation, service, garage: () => openGarage({ showModal, toast, closeModal, game }), map: bigMap, race: races, jobs, pause, online, settings, help, leaderboard, about, ideas };

function renderModalChatLog() {
  const logEl = document.getElementById('onlineChatLog');
  if (!logEl) return;
  if (chatHistory.length === 0) {
    logEl.innerHTML = '<div style="color:var(--muted);justify-content:center">Suhbat tarixi shu yerda ko\'rinadi</div>';
    return;
  }
  logEl.innerHTML = chatHistory.slice(-8).map((m) => `<div><span>💬 <b>${m.fromName}:</b> ${m.text}</span><small style="color:var(--muted)">${new Date(m.ts).toLocaleTimeString('uz').slice(0, 5)}</small></div>`).join('');
  logEl.scrollTop = logEl.scrollHeight;
}

onOnline((ev) => {
  if (ev.join) toast(`🌐 ${ev.join} o'yinga qo'shildi!`, 'ok');
  if (ev.leave) toast(`🌐 ${ev.leave} o'yindan chiqdi`, 'err');
  if (ev.left === 'host') toast("🌐 Xona egasi chiqib ketdi", 'err');
  if (ev.passengerJoin) {
    beep('ok');
    toast(`💺 ${ev.passengerJoin} sizning mashinangizga o'tirdi!`, 'cash');
  }
  if (ev.raceEvent) {
    beep('go');
    toast(ev.raceEvent.text || '🏁 Online Poyga boshlandi!', 'cash');
    if (ev.raceEvent.target) game?.setWaypoint?.({ x: ev.raceEvent.target.x, z: ev.raceEvent.target.z });
  }
  if (ev.chat) {
    beep('ok');
    toast(`💬 ${ev.chat.name}: ${ev.chat.text}`, 'ok');
    renderModalChatLog();
    return;
  }
  if (ev.chatUpdated) {
    renderModalChatLog();
    return;
  }
  if (current === 'online') {
    const inp = document.getElementById('chatInput');
    const fi = document.getElementById('friendIdInput');
    if (document.activeElement !== inp && document.activeElement !== fi) online();
  }
});



