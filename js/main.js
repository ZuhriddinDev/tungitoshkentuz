// TUNGI TOSHKENT — asosiy fayl: V4 Premium Game Lobby, 3D Streetwear Personaj (7 animatsiya) va Real-Vaqt Multiplayer Xona Tizimi
import * as THREE from 'three';
import { CARS, COLORS, TUNING, carById, KM_BONUS, DAY_LENGTH_SEC, fmt } from './config.js';
import { state, activeCar, addMoney, bumpStat, touch, save, setName, canClaimDaily, claimDaily, onChange } from './state.js';
import { createRenderer, PRESETS } from './render.js';
import { buildCity, updateCitySectors, nightMats, waterMat } from './world/city.js';
import { buildProps, updateProps } from './world/props.js';
import { buildLandmarks, animated } from './world/landmarks.js';
import { createSky } from './world/sky.js';
import { SPAWN, POIS, N, onRoad, blockC, blockInfo } from './world/layout.js';
import { buildCar, preloadCar, isCarReady } from './carModel.js';
import { withBusy } from './busy.js';
import { Vehicle } from './physics.js';
import { Traffic, Pedestrians } from './traffic.js';
import { initInput, readDrive, onKey, setEnabled, applyControl } from './input.js';
import { TireSmoke } from './smoke.js';
import { initAudio, updateEngine, engineOff, thump, horn, beep, suspend } from './audio.js';
import { initMissions, updateMission, mission, rivals } from './missions.js';
import { drawMinimap } from './map.js';
import { initUI, toggle, open, closeModal, isOpen, toast } from './ui.js';
import { updateCamera, updateCharCamera, menuCamera, addShake, camState } from './camera.js';
import { drawSpeedo, updateHud, setPrompt, setMissionHud } from './hud.js';
import {
  goOnline,
  joinPublicServer,
  tick as tickOnline,
  list as onlineList,
  info as onlineInfo,
  displayId,
  playerId,
  onOnline,
  sendChat,
  sendOnlineEvent,
  chatHistory,
  serverStats,
  MAX_PLAYERS,
} from './online.js';
import { RemoteCars } from './remoteCars.js';
import { PlayerCharacter } from './character.js';

const $ = (s) => document.getElementById(s);
const canvas = $('game');
const R = createRenderer(canvas, state.settings.quality);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 5000);
R.attach(scene, camera);
window.__sens = state.settings.sens;

let smoke, sky, traffic, peds, remotes, model, malibuHeroModel, malibuHeadlight, vehicle, headlight, charCtrl;
let playing = false, paused = false;
let playerMode = 'driving'; // 'driving' | 'walking' | 'passenger'
let ridingWith = '';        // Do'st ID si (agar 'passenger' bo'lsa)
let lobbyLightsOn = true;
let perfAuditVisible = false;
let activeDepositRace = null; // { raceId, target, totalPrize, status }
let pendingDepositInvite = null; // { raceId, hostId, hostName, hostDeposit, target }
const FIXED_DT = 1 / 60;
let physAcc = 0;
let hour = 21.75, waypoint = null, lightsMode = 'auto', kmAcc = 0, fuelWarned = false, pitch = 0, lastV = 0;
const progress = (p, t) => { $('loadBar').style.width = p + '%'; $('loadText').textContent = t; return new Promise((r) => setTimeout(r, 30)); };

// Missiyalar, xarita va traffik ishlatadigan o'yinchi ko'rinishi (har doim joriy nuqtani qaytaradi)
const player = {
  get x() {
    if (playerMode === 'walking' && charCtrl) return charCtrl.x;
    if (playerMode === 'passenger') {
      const host = remotes?.map.get(ridingWith);
      if (host) return host.x;
    }
    return vehicle.x;
  },
  get z() {
    if (playerMode === 'walking' && charCtrl) return charCtrl.z;
    if (playerMode === 'passenger') {
      const host = remotes?.map.get(ridingWith);
      if (host) return host.z;
    }
    return vehicle.z;
  },
  get heading() {
    if (playerMode === 'walking' && charCtrl) return charCtrl.heading;
    if (playerMode === 'passenger') {
      const host = remotes?.map.get(ridingWith);
      if (host) return host.h;
    }
    return vehicle.heading;
  },
  get kmh() { return playerMode === 'walking' ? Math.abs(charCtrl?.v || 0) * 3.6 : vehicle.kmh; },
  get v() { return playerMode === 'walking' ? (charCtrl?.v || 0) : vehicle.v; },
  get cfg() { return vehicle.cfg; },
  get inst() { return vehicle.inst; },
  get vehicle() { return vehicle; },
  get len() { return vehicle.cfg.len; },
  locked: false,
};

const SOUND_NAMES = {
  i4: '🔊 I4 Atmosfera',
  turbo4: '🔊 2.0L Turbo',
  bmwi6: '🔊 I6 Twin-Turbo',
  bmwv8: '🔊 M V8 Twin-Turbo',
  amgv8: '🔊 AMG V8 Biturbo',
  v12: '🔊 6.5L V12 F1',
};

const LANDMARK_COORDS = {
  'Amir Temur Xiyoboni': { x: blockC(6), z: blockC(6) },
  'Tashkent City': { x: blockC(5), z: blockC(7) },
  'Chorsu Bozori': { x: blockC(3), z: blockC(5) },
  'Minor Masjidi': { x: blockC(7), z: blockC(4) },
  'Toshkent Teleminorasi': { x: blockC(8), z: blockC(2) },
};

// =========================================================
// V4 PREMIUM GAME LOBBY YANGILASH FUNKSIYALARI
// =========================================================
function updateLobbyServerUI() {
  const inf = onlineInfo();
  if ($('lobTotalOnline')) $('lobTotalOnline').textContent = String(serverStats.totalOnline || inf.count || 1);
  if ($('lobPublicCount')) $('lobPublicCount').textContent = `${serverStats.publicPlayers || 1}/${serverStats.publicMax || MAX_PLAYERS}`;
  if ($('lobPrivateRooms')) $('lobPrivateRooms').textContent = String(serverStats.privateRooms || 0);
  if ($('lobServerStatus')) {
    const st = serverStats.status === 'online' ? 'Online' : serverStats.status === 'connecting' ? 'Connecting...' : 'Offline';
    $('lobServerStatus').textContent = st;
    $('lobServerStatus').className = serverStats.status === 'online' ? 'cyan-txt' : 'gold-txt';
  }
  if ($('lobPingMs')) $('lobPingMs').textContent = `(${serverStats.pingMs || 18} ms)`;
}

function updateLobbyProfileUI() {
  const km = state.totalKm || 0;
  const lv = Math.max(1, Math.floor(km / 5) + state.cars.length);
  const xpPct = Math.min(100, Math.round(((km % 5) / 5) * 100) || 45);
  const rankTitle = lv >= 12 ? '#1 · Toshkent Legendi' : lv >= 6 ? '#2 · Street Pro' : '#5 · Haydovchi';

  if ($('lobLevel')) $('lobLevel').textContent = `Lv.${lv}`;
  if ($('lobXpFill')) $('lobXpFill').style.width = `${xpPct}%`;
  if ($('lobMoney')) $('lobMoney').textContent = fmt(state.money);
  if ($('lobStatKm')) $('lobStatKm').textContent = `${km.toFixed(1)} km`;
  if ($('lobStatRank')) $('lobStatRank').textContent = rankTitle;
  if ($('lobStatLv')) $('lobStatLv').textContent = `Lv. ${lv}`;
  if ($('lobStatCars')) $('lobStatCars').textContent = `${state.cars.length} / ${CARS.length}`;
  if ($('lobStatBal')) $('lobStatBal').textContent = fmt(state.money);
  if ($('lobbyOwnedCount')) $('lobbyOwnedCount').textContent = `Garajda: ${state.cars.length}/${CARS.length}`;
  if ($('lobDailySub')) {
    $('lobDailySub').textContent = canClaimDaily() ? '🎁 25 000 000 so\'m bonus tayyor!' : '✅ Bugungi mukofot olingan';
  }
}

function applyCharConfig() {
  if (charCtrl) {
    charCtrl.setConfig();
  }
  updateLobbyProfileUI();
}

function resetCarOnRoad() {
  if (!vehicle) return;
  if (playerMode !== 'driving') enterOwnCarImmediate();
  vehicle.v = 0;
  vehicle.yawRate = 0;
  vehicle.pitch = 0;
  vehicle.roll = 0;
  if (onRoad(vehicle.x, vehicle.z)) {
    vehicle.place(vehicle.x, vehicle.z, vehicle.heading);
  } else {
    vehicle.place(SPAWN.x, SPAWN.z, SPAWN.heading);
  }
  beep('ok');
  toast('🔄 Mashina yo\'lga tiklandi!', 'ok');
}

function renderLobbyCarCarousel() {
  const strip = $('lobbyCarStrip');
  if (!strip) return;
  const curInst = activeCar();
  strip.innerHTML = CARS.map((c) => {
    const owned = state.cars.find((x) => x.id === c.id);
    const isAct = curInst.id === c.id;
    return `<button type="button" class="lob-car-card ${isAct ? 'active' : ''}" data-lob-car="${c.id}">
      <div class="lob-car-top">
        <span style="color:${owned ? 'var(--green)' : 'var(--gold)'}">${owned ? '✔ GARAJDA' : '🔒 SALON'}</span>
        <span>⚡${c.maxSpeed}</span>
      </div>
      <b>${c.name}</b>
      <small>${owned ? 'Tanlash uchun bosing' : fmt(c.price)}</small>
    </button>`;
  }).join('');

  strip.querySelectorAll('[data-lob-car]').forEach((btn) => {
    btn.onclick = () => {
      const cid = btn.dataset.lobCar;
      const owned = state.cars.find((x) => x.id === cid);
      if (owned) {
        state.activeUid = owned.uid;
        touch();
        changeCar();
        beep('ok');
      } else {
        open('garage');
      }
    };
  });
}

function renderLobbyColorDots() {
  const box = $('lobbyColorDots');
  if (!box) return;
  const inst = activeCar();
  const quickColors = COLORS.slice(0, 7);
  box.innerHTML = quickColors.map((col) =>
    `<button type="button" class="sr-color-dot ${inst.color === col ? 'on' : ''}" data-lob-col="${col}" style="background:${col}"></button>`
  ).join('');
  box.querySelectorAll('[data-lob-col]').forEach((b) => {
    b.onclick = () => {
      const instNow = activeCar();
      instNow.color = b.dataset.lobCol;
      touch();
      setCar(true);
      renderLobbyColorDots();
      beep('ok');
    };
  });
}

function updateMenuCarInfo() {
  const inst = activeCar();
  const cfg = carById(inst.id);
  if ($('menuCarName')) $('menuCarName').textContent = cfg.name;
  if ($('menuCarSpeed')) $('menuCarSpeed').textContent = `⚡ ${cfg.maxSpeed} km/s`;
  if ($('menuCarAccel')) $('menuCarAccel').textContent = `⏱ 0-100: ${(27.8 / cfg.accel).toFixed(1)}s`;
  if ($('menuCarSound')) $('menuCarSound').textContent = SOUND_NAMES[cfg.sound] || '🔊 Sport Motor';
  renderLobbyCarCarousel();
  renderLobbyColorDots();
  updateLobbyProfileUI();
}

// =========================================================
// O'YIN REJIMLARI: HAYDASH, PIYODA YURISH VA MASHINAGA KIRISH/TUSHISH
// =========================================================
function setModeUI(mode) {
  playerMode = mode;
  const footEl = $('footActions');
  const txtEl = $('hbExitTxt');
  const useTxtEl = $('hbUseTxt');
  const touchBtn = $('touchExitBtn');
  const boostTxt = $('touchBoostTxt');
  const brakeTxt = $('touchBrakeTxt');

  if (mode === 'driving') {
    footEl?.classList.add('hidden');
    if (txtEl) txtEl.textContent = 'Tushish (F)';
    if (useTxtEl) useTxtEl.textContent = 'Xizmat (E)';
    if (touchBtn) touchBtn.textContent = '🚶';
    if (boostTxt) boostTxt.textContent = 'NITRO';
    if (brakeTxt) brakeTxt.textContent = 'DRIFT';
  } else if (mode === 'walking') {
    footEl?.classList.remove('hidden');
    if (txtEl) txtEl.textContent = 'Kirish (E)';
    if (useTxtEl) useTxtEl.textContent = 'Kirish (E)';
    if (touchBtn) touchBtn.textContent = '🚗';
    if (boostTxt) boostTxt.textContent = 'YUGUR';
    if (brakeTxt) brakeTxt.textContent = 'SAKRA';
  } else if (mode === 'passenger') {
    footEl?.classList.add('hidden');
    if (txtEl) txtEl.textContent = 'Tushish (F)';
    if (useTxtEl) useTxtEl.textContent = 'Tushish (F)';
    if (touchBtn) touchBtn.textContent = '🚶';
    if (boostTxt) boostTxt.textContent = 'NITRO';
    if (brakeTxt) brakeTxt.textContent = 'DRIFT';
  }
}

function enterOwnCarImmediate() {
  ridingWith = '';
  charCtrl?.hide();
  setModeUI('driving');
  beep('ok');
  toast(`🚗 ${vehicle.cfg.name} ruliga o'tirdingiz!`, 'ok');
}

function enterOwnCarAnimated() {
  if (!charCtrl || !charCtrl.active) {
    enterOwnCarImmediate();
    return;
  }
  const doorX = vehicle.x - Math.cos(vehicle.heading) * (vehicle.cfg.wid * 0.65 + 0.35);
  const doorZ = vehicle.z + Math.sin(vehicle.heading) * (vehicle.cfg.wid * 0.65 + 0.35);
  beep('ok');
  charCtrl.startEnterCar(doorX, doorZ, vehicle.x, vehicle.z, vehicle.heading, () => {
    enterOwnCarImmediate();
  });
}

function summonOwnCar() {
  if (!charCtrl) return;
  const cx = charCtrl.x + Math.sin(charCtrl.heading) * 3.2;
  const cz = charCtrl.z + Math.cos(charCtrl.heading) * 3.2;
  vehicle.place(cx, cz, charCtrl.heading);
  model.group.position.set(vehicle.x, groundY(vehicle.x, vehicle.z), vehicle.z);
  model.group.rotation.set(0, vehicle.heading, 0);
  enterOwnCarAnimated();
}

function sitInFriendCar(friendId) {
  const p = onlineList().find((x) => x.id === friendId);
  if (!p) return toast("Do'stingiz topilmadi", 'err');
  engineOff();
  vehicle.v = 0;

  const rCar = remotes?.map.get(friendId);
  const fx = rCar ? rCar.x : p.x;
  const fz = rCar ? rCar.z : p.z;
  const fh = rCar ? rCar.h : (p.h || 0);

  if (playerMode === 'walking' && charCtrl?.active && Math.hypot(fx - charCtrl.x, fz - charCtrl.z) < 9.5) {
    const doorX = fx + Math.cos(fh) * 1.3;
    const doorZ = fz - Math.sin(fh) * 1.3;
    charCtrl.startEnterCar(doorX, doorZ, fx, fz, fh, () => {
      charCtrl?.hide();
      ridingWith = friendId;
      setModeUI('passenger');
      beep('ok');
      toast(`💺 ${p.name || 'Do\'st'} ning mashinasiga o'tirdingiz! (Tushish — F)`, 'cash');
    });
    return;
  }

  charCtrl?.hide();
  ridingWith = friendId;
  setModeUI('passenger');
  beep('ok');
  toast(`💺 ${p.name || 'Do\'st'} ning mashinasiga o'tirdingiz! (Tushish — F)`, 'cash');
}

// F tugmasi — Mashinadan tushish (yoki mobil tugma orqali almashish)
function handleExitOrEnter() {
  if (!playing) return;
  if (playerMode === 'driving') {
    if (vehicle.kmh > 35) {
      return toast('Mashinadan tushish uchun biroz sekinlashtiring!', 'err');
    }
    engineOff();
    vehicle.v = 0;
    const doorX = vehicle.x - Math.cos(vehicle.heading) * (vehicle.cfg.wid * 0.82 + 0.52);
    const doorZ = vehicle.z + Math.sin(vehicle.heading) * (vehicle.cfg.wid * 0.82 + 0.52);
    charCtrl.setColor?.(vehicle.inst.color);
    charCtrl.startExitCar(doorX, doorZ, vehicle.heading, groundY(doorX, doorZ));
    setModeUI('walking');
    beep('ok');
    toast("🚶 Mashinadan tushdingiz! (Mashinaga kirish — E)", 'ok');
    return;
  }

  if (playerMode === 'passenger') {
    const host = remotes?.map.get(ridingWith) || onlineList().find((x) => x.id === ridingWith);
    const hx = host ? host.x : vehicle.x;
    const hz = host ? host.z : vehicle.z;
    const hh = host ? (host.h || 0) : vehicle.heading;
    const outX = hx + Math.cos(hh) * 2.1;
    const outZ = hz - Math.sin(hh) * 2.1;
    ridingWith = '';
    charCtrl.startExitCar(outX, outZ, hh, groundY(outX, outZ));
    setModeUI('walking');
    beep('ok');
    toast("🚶 Do'stingiz mashinasidan tushdingiz!", 'ok');
    return;
  }

  // Agar piyoda bo'lsa -> yaqin mashinaga kirish
  handleEnterCarOnFoot();
}

// E tugmasi — Piyoda rejimda mashinaga kirish (EnterCar animatsiyasi bilan!)
function handleEnterCarOnFoot() {
  if (!playing || playerMode !== 'walking' || !charCtrl) return;

  // 1. Yaqin atrofdagi do'st mashinasini tekshiramiz
  const peers = onlineList();
  let nearestPeer = null, minPeerDist = 8.5;
  for (const p of peers) {
    if (p.ridingWith) continue;
    const rCar = remotes?.map.get(p.id);
    const px = rCar ? rCar.x : p.x;
    const pz = rCar ? rCar.z : p.z;
    const d = Math.hypot(px - charCtrl.x, pz - charCtrl.z);
    if (d < minPeerDist) {
      minPeerDist = d;
      nearestPeer = p;
    }
  }
  const myCarDist = Math.hypot(vehicle.x - charCtrl.x, vehicle.z - charCtrl.z);

  if (nearestPeer && minPeerDist < myCarDist) {
    sitInFriendCar(nearestPeer.id);
    return;
  }
  if (myCarDist < 12) {
    enterOwnCarAnimated();
  } else {
    summonOwnCar();
  }
}

function setCar(soft = false) {
  const inst = activeCar(), cfg = carById(inst.id);
  updateMenuCarInfo();
  if (charCtrl) charCtrl.model.setColor(inst.color);
  if (soft && model && model.cfg.id === cfg.id) { model.setColor(inst.color); model.setTuning(inst); return; }
  const prev = vehicle;
  if (model) scene.remove(model.group);
  model = buildCar(cfg, inst);
  model.group.rotation.order = 'YXZ';
  model.group.traverse((o) => { if (o.isMesh && o.material !== undefined && !o.material.transparent) o.castShadow = true; });
  headlight = new THREE.SpotLight(0xfff1d6, 0, 70, 0.55, 0.45, 1.2);
  headlight.position.set(0, 0.8, cfg.len / 2); headlight.target.position.set(0, 0, cfg.len / 2 + 20);
  model.group.add(headlight, headlight.target);
  scene.add(model.group);
  vehicle = new Vehicle(cfg, inst);
  if (prev) vehicle.place(prev.x, prev.z, prev.heading);
  else if (state.pos) vehicle.place(state.pos.x, state.pos.z, state.pos.h);
  else vehicle.place(SPAWN.x, SPAWN.z, SPAWN.heading);
  $('hudCar').textContent = cfg.name + (state.rental ? ' · IJARA' : '');
  fuelWarned = false;
}

async function changeCar(soft = false) {
  const cfg = carById(activeCar().id);
  if (!soft && !isCarReady(cfg)) await withBusy(cfg.name, 'Mashina modeli yuklanmoqda...', (setP) => preloadCar(cfg, setP));
  setCar(soft);
  if (playing && playerMode !== 'driving') enterOwnCarImmediate();
}

function tow() {
  enterOwnCarImmediate();
  vehicle.place(SPAWN.x, SPAWN.z, SPAWN.heading);
}
function endRental(silent) {
  if (!state.rental) return;
  state.rental = null; touch(); changeCar();
  if (!silent) toast('Ijara muddati tugadi, mashina qaytarildi', 'err');
}

function groundY(x, z) {
  if (onRoad(x, z)) return 0;
  const info = blockInfo(nearestBlock(x), nearestBlock(z));
  return info.type === 'gas' || info.type === 'garage' ? 0.25 : info.type === 'park' || info.type === 'square' ? 0.3 : 0.22;
}
const nearestBlock = (v) => Math.max(0, Math.min(N - 1, Math.round((v - blockC(0)) / (blockC(1) - blockC(0)))));

const nearPoi = () => POIS.find((p) => Math.hypot(p.x - player.x, p.z - player.z) < p.r && player.kmh < 20);
function keyGuard(fn) { return () => { if (playing) fn(); }; }

// E — Piyoda rejimda mashinaga kirish (EnterCar); mashinada esa Zapravka yoki Xizmat paneli
onKey('KeyE', keyGuard(() => {
  if (playerMode === 'walking') {
    handleEnterCarOnFoot();
    return;
  }
  const poi = nearPoi();
  if (poi?.type === 'gas') toggle('gas');
  else if (poi?.type === 'garage') toggle('garage');
  else toggle('service');
}));

// F — Mashinadan tushish (ExitCar)
onKey('KeyF', keyGuard(handleExitOrEnter));

// G — Garaj va Avtosalon
onKey('KeyG', keyGuard(() => toggle('garage')));
onKey('KeyM', keyGuard(() => toggle('map')));
onKey('KeyR', keyGuard(() => toggle('race')));
onKey('KeyT', keyGuard(() => toggle('jobs')));
onKey('KeyO', keyGuard(() => toggle('online')));
onKey('Escape', keyGuard(() => (isOpen() ? closeModal() : open('pause'))));
onKey('KeyL', keyGuard(() => { lightsMode = { auto: 'on', on: 'off', off: 'auto' }[lightsMode]; toast(`Faralar: ${{ auto: 'avtomatik', on: 'yoqilgan', off: "o'chirilgan" }[lightsMode]}`); }));
onKey('KeyH', keyGuard(() => horn()));
onKey('KeyC', keyGuard(() => { camState.mode = (camState.mode + 1) % 3; }));
onKey('KeyX', keyGuard(() => resetCarOnRoad()));
onKey('F3', () => window.__togglePerfAudit?.());

// Real-vaqt online sinxronizatsiya (pauza va modal ochiqligida ham to'xtamaydi!)
function syncOnlineNow(dt) {
  if (!vehicle || !model) return;
  const night = sky ? sky.night : 0.8;
  const lightsOn = lightsMode === 'on' || (lightsMode === 'auto' && night > 0.35);
  tickOnline(dt, {
    id: playerId(),
    name: state.name || 'Haydovchi',
    car: vehicle.cfg.id,
    color: vehicle.inst.color,
    rims: vehicle.inst.rims,
    spoiler: vehicle.inst.spoiler,
    neon: vehicle.inst.neon,
    x: vehicle.x,
    y: model.group.position.y,
    z: vehicle.z,
    h: vehicle.heading,
    v: playerMode === 'driving' ? vehicle.v : 0,
    steer: playerMode === 'driving' ? vehicle.steer : 0,
    yawRate: playerMode === 'driving' ? vehicle.yawRate : 0,
    braking: playerMode === 'driving' ? vehicle.braking : false,
    lights: lightsOn,
    drifting: playerMode === 'driving' ? vehicle.drifting : false,
    onFoot: playing && playerMode === 'walking',
    px: charCtrl ? charCtrl.x : vehicle.x,
    py: charCtrl ? charCtrl.y : 0,
    pz: charCtrl ? charCtrl.z : vehicle.z,
    ph: charCtrl ? charCtrl.heading : vehicle.heading,
    pv: charCtrl ? charCtrl.v : 0,
    animState: charCtrl ? charCtrl.animState : 'idle',
    emote: charCtrl ? charCtrl.emote : '',
    ridingWith: playerMode === 'passenger' ? ridingWith : '',
  });
  remotes?.update(dt, onlineList(), player, night);
}

function step(dt, t) {
  hour = (hour + (dt / DAY_LENGTH_SEC) * 24) % 24;
  const input = player.locked ? { throttle: 0, reverse: 0, steer: 0, boost: false, handbrake: true } : readDrive();
  const others = [...traffic.cars, ...rivals(), ...(remotes ? remotes.cars : [])];

  const g = model.group;
  let dist = 0;

  if (playerMode === 'driving') {
    physAcc = Math.min(physAcc + dt, FIXED_DT * 4);
    let impact = 0;
    let steps = 0;
    while (physAcc >= FIXED_DT && steps < 4) {
      dist += vehicle.step(FIXED_DT, input, others);
      impact = Math.max(impact, vehicle.impact);
      physAcc -= FIXED_DT;
      steps++;
    }
    vehicle.impact = impact;
    smoke?.update(dt, vehicle, state.settings.smoke !== false, groundY(vehicle.x, vehicle.z));
    if (vehicle.impact > 3) { addShake(Math.min(0.6, vehicle.impact * 0.05)); thump(vehicle.impact); }

    g.position.set(vehicle.x, g.position.y + (groundY(vehicle.x, vehicle.z) - g.position.y) * Math.min(1, dt * 14), vehicle.z);
    g.rotation.set(0, vehicle.heading, 0);
    model.update(dist * Math.sign(vehicle.v || 1), vehicle.steer, vehicle.pitch || 0, vehicle.roll || 0);
    model.setBrake(vehicle.braking);
    model.setDamageState?.(vehicle.inst.dmgParts, vehicle.inst.damage);

    updateEngine(vehicle.rpm, input.throttle, vehicle.cfg.pitch, vehicle.slip, vehicle.kmh, {
      sound: vehicle.cfg.sound,
      braking: vehicle.braking,
      gear: vehicle.gear,
      dt,
    });
    updateCamera(camera, vehicle, input.boost, dt);
  } else if (playerMode === 'walking') {
    // Mashina to'xtab turadi, Universal 3D Streetwear Personaj harakatlanadi
    g.position.set(vehicle.x, groundY(vehicle.x, vehicle.z), vehicle.z);
    model.setBrake(false);
    model.setDamageState?.(vehicle.inst.dmgParts, vehicle.inst.damage);
    charCtrl.step(dt, input, groundY(charCtrl.x, charCtrl.z));
    updateCharCamera(camera, charCtrl, dt);
  } else if (playerMode === 'passenger') {
    // Do'stning mashinasida yo'lovchi
    const hostCar = remotes?.map.get(ridingWith);
    const hostPeer = onlineList().find((x) => x.id === ridingWith);
    if (!hostCar && !hostPeer) {
      toast("Do'stingiz xonadan chiqdi", 'err');
      enterOwnCarImmediate();
    } else {
      const hx = hostCar ? hostCar.x : hostPeer.x;
      const hz = hostCar ? hostCar.z : hostPeer.z;
      const hh = hostCar ? hostCar.h : (hostPeer.h || 0);
      const hv = hostPeer ? (hostPeer.v || 0) : 0;
      const proxyVeh = {
        x: hx,
        z: hz,
        heading: hh,
        fwdX: Math.sin(hh),
        fwdZ: Math.cos(hh),
        kmh: Math.abs(hv) * 3.6,
        cfg: hostCar ? hostCar.model.cfg : vehicle.cfg,
      };
      updateCamera(camera, proxyVeh, false, dt);
    }
  }

  const focusPos = playerMode === 'walking' ? charCtrl.model.group.position : g.position;
  sky.update(hour, focusPos, R.preset.shadows);
  const night = sky.night;
  const lightsOn = lightsMode === 'on' || (lightsMode === 'auto' && night > 0.35);
  model.setLights(lightsOn);
  headlight.intensity = lightsOn ? 90 : 0;
  for (const { mat, base, day = 0 } of nightMats) mat.emissiveIntensity = day + (base - day) * night;
  waterMat.emissiveIntensity = 0.3 + night;
  updateProps(t, night);
  updateCitySectors(player.x, player.z, R.preset.shadows ? 1050 : 620);
  traffic.setNight(night); traffic.update(dt, t, player);
  peds.update(dt, t, player);
  updateMission(dt);
  for (const f of animated) f(t);

  // Do'stlar bilan Depozit Poyga marrasini tekshirish
  if (activeDepositRace && activeDepositRace.status === 'active' && activeDepositRace.target) {
    const distToFinish = Math.hypot(activeDepositRace.target.x - player.x, activeDepositRace.target.z - player.z);
    if (distToFinish < 28) {
      activeDepositRace.status = 'finishing';
      sendOnlineEvent({
        type: 'deposit_race',
        action: 'finish',
        raceId: activeDepositRace.raceId,
      });
    }
  }

  // Masofa: statistika, har 10 km uchun bonus
  kmAcc += dist / 1000;
  if (kmAcc > 0.05) {
    state.totalKm += kmAcc; bumpStat('km', kmAcc); kmAcc = 0;
    const due = Math.floor(state.totalKm / 10);
    if (due > state.kmBonusPaid) { state.kmBonusPaid = due; addMoney(KM_BONUS, `${due * 10} km bonusi`); toast(`🎉 ${due * 10} km! Bonus +${fmt(KM_BONUS)}`, 'cash'); }
  }
  if (vehicle.inst.fuelL <= 0 && !fuelWarned) { fuelWarned = true; toast('Benzin tugadi! E — xizmat paneli (benzin olib kelish yoki evakuator)', 'err'); }
  if (vehicle.inst.fuelL > 0) fuelWarned = false;
  if (state.rental && Date.now() > state.rental.until) endRental();
  if (waypoint && Math.hypot(waypoint.x - player.x, waypoint.z - player.z) < 20) { waypoint = null; toast('Manzilga yetib keldingiz', 'ok'); }

  // Kontekstli eslatmalar (Prompt)
  const poi = nearPoi();
  if (playerMode === 'passenger') {
    const hostPeer = onlineList().find((x) => x.id === ridingWith);
    setPrompt(`<span class="key">F</span>💺 Siz <b>${hostPeer?.name || 'Do\'st'}</b> mashinasidasiz · Tushish`);
  } else if (playerMode === 'walking') {
    let nearFriend = null, minD = 8.5;
    for (const p of onlineList()) {
      if (p.ridingWith) continue;
      const rc = remotes?.map.get(p.id);
      const d = Math.hypot((rc ? rc.x : p.x) - charCtrl.x, (rc ? rc.z : p.z) - charCtrl.z);
      if (d < minD) { minD = d; nearFriend = p; }
    }
    const myD = Math.hypot(vehicle.x - charCtrl.x, vehicle.z - charCtrl.z);
    if (nearFriend && minD < myD) {
      setPrompt(`<span class="key">E</span>💺 <b>${nearFriend.name || 'Do\'st'}</b> mashinasiga kirish`);
    } else if (myD < 11) {
      setPrompt(`<span class="key">E</span>🚗 Mashinaga kirish (<b>${vehicle.cfg.name}</b>)`);
    } else {
      setPrompt(`<span class="key">E</span>🔑 Mashinani chaqirish va rulga o'tirish`);
    }
  } else if (vehicle.nearBorder && vehicle.borderMsg) {
    setPrompt(`<span class="key">👮 YPX</span>${vehicle.borderMsg}`);
  } else {
    setPrompt(poi ? (poi.type === 'gas' ? '<span class="key">E</span>⛽ Benzin quyish' : '<span class="key">G</span>🚗 Garaj va avtosalon') : '');
  }
}

const clock = new THREE.Clock();
let fps = 60, frames = 0, fpsT = 0, hudT = 0, mapT = 0, peerHudT = 0, perfT = 0;

function updatePerfAuditPanel(rawDt) {
  if (!perfAuditVisible) return;
  const m = R.getMetrics();
  if ($('paFps')) $('paFps').textContent = String(fps);
  if ($('paFrame')) $('paFrame').textContent = `${(rawDt * 1000).toFixed(1)} ms`;
  if ($('paQuality')) $('paQuality').textContent = `${m.quality.toUpperCase()} (${m.gpuTier})`;
  if ($('paDraws')) $('paDraws').textContent = String(m.drawCalls);
  if ($('paTris')) $('paTris').textContent = m.triangles.toLocaleString('uz');
  if ($('paGeoTex')) $('paGeoTex').textContent = `${m.geometries} / ${m.textures}`;
  if ($('paMem')) $('paMem').textContent = m.memoryMB ? `${m.memoryMB} MB` : 'N/A';
}

window.__togglePerfAudit = (forceState) => {
  perfAuditVisible = typeof forceState === 'boolean' ? forceState : !perfAuditVisible;
  const el = $('perfAuditPanel');
  if (el) el.classList.toggle('hidden', !perfAuditVisible);
  toast(perfAuditVisible ? '📊 Performance Audit yoqildi (F3)' : "📊 Performance Audit o'chirildi", 'ok');
  return perfAuditVisible;
};
window.__isPerfAuditVisible = () => perfAuditVisible;

function updateOnlinePeersHud() {
  const el = $('onlinePeersHud');
  if (!el) return;
  const peers = onlineList();
  if (!peers.length) {
    el.classList.add('hidden');
    el.innerHTML = '';
    return;
  }
  el.classList.remove('hidden');
  el.innerHTML = peers.slice(0, 5).map((p) => {
    const d = Math.round(Math.hypot((p.x || 0) - player.x, (p.z || 0) - player.z));
    return `<div class="peer-pill">
      <span>🟢 <b>${p.name || 'Haydovchi'}</b> <small>${d}m</small></span>
      <span style="display:flex;gap:4px">
        <button type="button" data-tp-hud="${p.id}" title="Yoniga o'tish">📍</button>
        <button type="button" data-sit-hud="${p.id}" title="Mashinasiga o'tirish">💺</button>
      </span>
    </div>`;
  }).join('');
  el.querySelectorAll('[data-tp-hud]').forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    const p = peers.find((x) => x.id === b.dataset.tpHud);
    if (!p) return;
    if (playerMode !== 'driving') enterOwnCarImmediate();
    vehicle.place(p.x + 3.5, p.z + 3.5, p.h || 0);
    toast(`${p.name || 'Do\'st'} yoniga o'tdingiz!`, 'ok');
  }));
  el.querySelectorAll('[data-sit-hud]').forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    sitInFriendCar(b.dataset.sitHud);
  }));
}

function updateHudChatLog() {
  const el = $('hudChatLog');
  if (!el) return;
  el.innerHTML = chatHistory.slice(-6).map((m) => `<div class="hud-chat-msg"><b>${m.fromName}:</b> ${m.text}</div>`).join('');
  el.scrollTop = el.scrollHeight;
}

function loop() {
  requestAnimationFrame(loop);
  const raw = clock.getDelta(), t = clock.elapsedTime;
  frames++; fpsT += raw; if (fpsT > 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
  const dt = Math.min(raw, 0.1);

  if (perfAuditVisible && (perfT += raw) > 0.25) {
    perfT = 0;
    updatePerfAuditPanel(raw);
  }

  // Online sinxronizatsiya har doim (hatto modal oyna yoki lobby ochiqligida ham!) uzluksiz ishlaydi
  syncOnlineNow(dt);

  if (playing && !paused) {
    if (malibuHeroModel) malibuHeroModel.group.visible = false;
    model.group.visible = true;
    step(dt, t);
  } else if (!playing) {
    // MALIBU HERO SCENE — Asosiy banner markazida doim bitta Chevrolet Malibu Premier turadi!
    hour = 21.75;
    const heroX = SPAWN.x;
    const heroZ = SPAWN.z;
    const heroH = SPAWN.heading;
    const gy = groundY(heroX, heroZ);

    if (model) model.group.visible = false;
    if (charCtrl) charCtrl.model.group.visible = false;

    if (malibuHeroModel) {
      malibuHeroModel.group.visible = true;
      malibuHeroModel.group.position.set(heroX, gy, heroZ);
      malibuHeroModel.group.rotation.set(0, heroH, 0);
      malibuHeroModel.setLights(true);
      malibuHeroModel.update(dt * 0.65, 0.22, 0, 0);
      if (malibuHeadlight) malibuHeadlight.intensity = 105;
    }

    const focusGroup = malibuHeroModel ? malibuHeroModel.group : model.group;
    sky.update(hour, focusGroup.position, R.preset.shadows);
    for (const { mat, base, day = 0 } of nightMats) mat.emissiveIntensity = day + (base - day) * sky.night;
    updateProps(t, sky.night);
    updateCitySectors(heroX, heroZ, 950);
    traffic.setNight(sky.night); traffic.update(dt, t, { x: heroX, z: heroZ });
    peds.update(dt, t, { x: heroX, z: heroZ });
    for (const f of animated) f(t);
    menuCamera(camera, { x: heroX, z: heroZ, heading: heroH }, t, dt);
  }

  if (playing) {
    const dispKmh = playerMode === 'passenger'
      ? Math.round(Math.abs(onlineList().find((x) => x.id === ridingWith)?.v || 0) * 3.6)
      : player.kmh;
    drawSpeedo(dispKmh, vehicle.cfg.maxSpeed, playerMode === 'driving' ? vehicle.rpm : 0.15);
    if ((hudT += dt) > 0.1) { hudT = 0; updateHud(vehicle, hour, waypoint, fps); }
    if ((mapT += dt) > 0.05) { mapT = 0; drawMinimap($('minimap'), player, mapExtra()); }
    if ((peerHudT += dt) > 0.35) { peerHudT = 0; updateOnlinePeersHud(); }
    if (!paused && playerMode === 'driving') { state.pos = { x: vehicle.x, z: vehicle.z, h: vehicle.heading }; save(); }
  }
  R.render(sky.night);
}

const mapExtra = () => ({
  remotes: [
    ...rivals().map((r) => ({ x: r.x, z: r.z, name: 'Raqib' })),
    ...onlineList().map((p) => ({ x: p.onFoot ? (p.px || p.x) : p.x, z: p.onFoot ? (p.pz || p.z) : p.z, name: `${p.name} (${displayId(p.id)})` })),
  ],
  traffic: traffic ? traffic.cars : [],
  target: mission.target,
  waypoint,
});

function onModal(openState) {
  paused = openState; setEnabled(!openState);
  if (openState) engineOff();
}

function returnToLobby() {
  engineOff();
  if (playerMode !== 'driving') {
    ridingWith = '';
    charCtrl?.hide();
    setModeUI('driving');
  }
  playing = false;
  paused = false;
  if (model) model.group.visible = false;
  if (malibuHeroModel) malibuHeroModel.group.visible = true;
  $('hud').classList.add('hidden');
  $('menu').classList.add('show');
  updateMenuCarInfo();
  updateLobbyServerUI();
}

function setQuality(q) {
  const a = PRESETS[q] || PRESETS.high;
  if (!sky) return;
  R.apply(q);
  const mapSz = R.preset?.map || a.map;
  sky.sun.shadow.mapSize.set(mapSz, mapSz);
  sky.sun.shadow.map?.dispose();
  sky.sun.shadow.map = null;
  save(true);
  toast(`🖼️ Grafik sifati o'zgartirildi: ${q.toUpperCase()}`, 'ok');
}

async function boot() {
  const q = state.settings.quality, preset = PRESETS[q] || PRESETS.high;
  await progress(10, "Osmon va tungi yorug'lik...");
  sky = createSky(scene);
  const s = sky.sun.shadow; s.mapSize.set(preset.map, preset.map);
  Object.assign(s.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 10, far: 700 }); s.bias = -0.0004; s.normalBias = 0.6;
  await progress(30, "Toshkent binolari va ko'chalari qurilmoqda...");
  buildCity(scene, q);
  await progress(55, 'Chiroqlar, svetoforlar, daraxtlar...');
  buildProps(scene, q);
  await progress(70, 'Teleminora, Chorsu, Toshkent Siti...');
  buildLandmarks(scene);
  await progress(80, 'Chevrolet Malibu Premier va 3D Personaj yuklanmoqda...');
  charCtrl = new PlayerCharacter(scene, activeCar().color);
  applyCharConfig();
  const malibuCfg = carById('malibu');
  preloadCar(malibuCfg);
  preloadCar(carById(activeCar().id));
  malibuHeroModel = buildCar(malibuCfg, { color: '#0d111c', rims: 'chrome', spoiler: 'none', neon: 'none' });
  malibuHeroModel.group.rotation.order = 'YXZ';
  malibuHeroModel.group.traverse((o) => { if (o.isMesh && o.material !== undefined && !o.material.transparent) o.castShadow = true; });
  malibuHeadlight = new THREE.SpotLight(0xfff1d6, 105, 65, 0.55, 0.45, 1.2);
  malibuHeadlight.position.set(0, 0.8, malibuCfg.len / 2);
  malibuHeadlight.target.position.set(0, 0, malibuCfg.len / 2 + 20);
  malibuHeroModel.group.add(malibuHeadlight, malibuHeadlight.target);
  scene.add(malibuHeroModel.group);
  setCar();
  if (model) model.group.visible = false;
  await progress(90, 'Shahar transporti va 3D NPC lar...');
  traffic = new Traffic(scene, preset.traffic);
  peds = new Pedestrians(scene, preset.peds);
  remotes = new RemoteCars(scene);
  initMissions({ scene, player, toast, hud: setMissionHud });
  initUI({
    onModal,
    tow,
    endRental,
    changeCar,
    applyCharConfig,
    returnToLobby,
    save: () => save(true),
    setQuality,
    teleportTo: (x, z, h = 0) => {
      if (playerMode !== 'driving') enterOwnCarImmediate();
      vehicle.place(x, z, h);
    },
    sitInFriendCar,
    player: () => player,
    hour: () => hour,
    mapExtra,
    waypoint: () => waypoint,
    setWaypoint: (w) => { waypoint = w; },
    getDepositRaceState: () => ({ active: activeDepositRace, invite: pendingDepositInvite }),
  });
  initInput(canvas, () => {
    const s = state.settings;
    s.steerType = s.steerType === 'buttons' ? 'wheel' : 'buttons';
    touch();
    applyControl(s.control, s.steerType, s.touchScale);
    toast(s.steerType === 'wheel' ? '🛞 Aylanuvchi Rul yoqildi' : '◀ ▶ Tugmalar yoqildi', 'ok');
  });
  smoke = new TireSmoke(scene);
  const syncControlOnViewport = () => {
    applyControl(state.settings.control, state.settings.steerType, state.settings.touchScale);
  };
  syncControlOnViewport();
  addEventListener('resize', syncControlOnViewport);
  addEventListener('orientationchange', () => {
    syncControlOnViewport();
    setTimeout(syncControlOnViewport, 120);
    setTimeout(syncControlOnViewport, 350);
  });
  if (screen.orientation && screen.orientation.addEventListener) {
    screen.orientation.addEventListener('change', syncControlOnViewport);
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncControlOnViewport);
  }

  onChange(() => {
    updateLobbyProfileUI();
    renderLobbyCarCarousel();
  });

  // Personaj (piyoda) va Radial Menyu tugmalari
  if ($('enterNearCarBtn')) $('enterNearCarBtn').onclick = (e) => {
    e.stopPropagation();
    handleEnterCarOnFoot();
  };
  document.querySelectorAll('[data-emote]').forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    const em = b.dataset.emote;
    charCtrl?.triggerEmote(em);
    sendChat(em === 'dance' ? '💃 Raqsga tushmoqda!' : '👋 Salom!', state.name || 'Haydovchi');
    $('radialMenuWrap')?.classList.add('hidden');
    beep('ok');
  }));
  if ($('summonCarBtn')) $('summonCarBtn').onclick = (e) => {
    e.stopPropagation();
    $('radialMenuWrap')?.classList.add('hidden');
    summonOwnCar();
  };

  // Radial Harakatlar Menyusi va Mashinani qayta tiklash (Reset Car) + Burilish chiroqlari
  const radialWrap = $('radialMenuWrap');
  const toggleRadial = (e) => {
    e?.stopPropagation();
    radialWrap?.classList.toggle('hidden');
  };
  if ($('btnToggleRadial')) $('btnToggleRadial').onclick = toggleRadial;
  if ($('openRadialFootBtn')) $('openRadialFootBtn').onclick = toggleRadial;
  if ($('closeRadialBtn')) $('closeRadialBtn').onclick = () => radialWrap?.classList.add('hidden');
  if (radialWrap) {
    radialWrap.addEventListener('click', (e) => {
      if (e.target === radialWrap || e.target.closest('[data-open]')) {
        radialWrap.classList.add('hidden');
      }
    });
  }
  if ($('btnResetCarHud')) $('btnResetCarHud').onclick = (e) => {
    e.stopPropagation();
    resetCarOnRoad();
  };
  if ($('radialResetCarBtn')) $('radialResetCarBtn').onclick = (e) => {
    e.stopPropagation();
    radialWrap?.classList.add('hidden');
    resetCarOnRoad();
  };
  if ($('perfAuditClose')) $('perfAuditClose').onclick = () => window.__togglePerfAudit?.(false);

  // Yig'iluvchi (Collapsible) HUD Chat va bildirishnoma nishoni
  let unreadChatCount = 0;
  let hudChatOpen = false;
  const setHudChatOpen = (openState) => {
    hudChatOpen = openState;
    const w = $('hudChatWidget');
    const p = $('hudChatPanel');
    const b = $('hudChatBadge');
    if (w) w.classList.toggle('collapsed', !openState);
    if (p) p.classList.toggle('hidden', !openState);
    if (openState) {
      unreadChatCount = 0;
      if (b) { b.textContent = '0'; b.classList.add('hidden'); }
      updateHudChatLog();
    }
  };
  if ($('hudChatToggleBtn')) $('hudChatToggleBtn').onclick = (e) => {
    e.stopPropagation();
    setHudChatOpen(!hudChatOpen);
  };
  if ($('hudChatCloseBtn')) $('hudChatCloseBtn').onclick = (e) => {
    e.stopPropagation();
    setHudChatOpen(false);
  };

  const sendFromHud = (txt) => {
    const v = String(txt || '').trim();
    if (!v) return;
    sendChat(v, state.name || 'Haydovchi');
    beep('ok');
    toast(`💬 Siz: ${v}`, 'ok');
    updateHudChatLog();
  };
  document.querySelectorAll('[data-hud-chat]').forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    sendFromHud(b.dataset.hudChat);
  }));
  if ($('hudChatSend')) $('hudChatSend').onclick = (e) => {
    e.stopPropagation();
    const inp = $('hudChatInput');
    if (inp) { sendFromHud(inp.value); inp.value = ''; inp.blur(); }
  };
  if ($('hudChatInput')) $('hudChatInput').addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') $('hudChatSend')?.click();
  });

  // Mobil Lobby Hamburger Menyu va Mobil HUD Harakatlar Menyusi
  const mobLobbyDrawer = $('mobileLobbyDrawer');
  if ($('btnMobileLobbyDrawer')) $('btnMobileLobbyDrawer').onclick = (e) => {
    e.stopPropagation();
    mobLobbyDrawer?.classList.toggle('hidden');
  };
  if ($('closeMobileLobbyDrawer')) $('closeMobileLobbyDrawer').onclick = (e) => {
    e.stopPropagation();
    mobLobbyDrawer?.classList.add('hidden');
  };
  if (mobLobbyDrawer) {
    mobLobbyDrawer.addEventListener('click', (e) => {
      if (e.target === mobLobbyDrawer || e.target.closest('[data-open]')) {
        mobLobbyDrawer.classList.add('hidden');
      }
    });
  }
  if ($('mobStartPublicBtn')) $('mobStartPublicBtn').onclick = async () => {
    mobLobbyDrawer?.classList.add('hidden');
    joinPublicServer().catch(() => {});
    play();
  };
  if ($('mobDailyBtn')) $('mobDailyBtn').onclick = () => {
    mobLobbyDrawer?.classList.add('hidden');
    $('btnLobbyDaily')?.click();
  };

  const hudMobDrawer = $('hudMobileDrawer');
  if ($('hudMobileMenuBtn')) $('hudMobileMenuBtn').onclick = (e) => {
    e.stopPropagation();
    hudMobDrawer?.classList.toggle('hidden');
  };
  if (hudMobDrawer) {
    hudMobDrawer.addEventListener('click', () => {
      hudMobDrawer.classList.add('hidden');
    });
  }

  // Lobby: ID nusxalash
  const myCode = displayId(playerId());
  if ($('menuMyId')) $('menuMyId').textContent = myCode;
  if ($('hudMyId')) $('hudMyId').textContent = myCode;
  if ($('copyMenuId')) $('copyMenuId').onclick = () => {
    navigator.clipboard?.writeText(myCode);
    toast(`Sizning ID nusxalandi: ${myCode}`, 'ok');
  };

  // Lobby: 3D Showroom tezkor Disk va Fara tugmalari
  if ($('lobbyRimBtn')) $('lobbyRimBtn').onclick = () => {
    const inst = activeCar();
    const opts = TUNING.rims.options.map((o) => o.id);
    const idx = (opts.indexOf(inst.rims || 'std') + 1) % opts.length;
    inst.rims = opts[idx];
    touch();
    setCar(true);
    beep('ok');
    toast(`🛞 Disk: ${TUNING.rims.options[idx].name}`, 'ok');
  };
  if ($('lobbyLightBtn')) $('lobbyLightBtn').onclick = () => {
    lobbyLightsOn = !lobbyLightsOn;
    beep('ok');
    toast(lobbyLightsOn ? '💡 Faralar yoqildi' : "💡 Faralar o'chirildi", 'ok');
  };

  // Lobby: MASHINA TANLANG oldinga/orqaga tugmalari
  const cycleMenuCar = (dir) => {
    if (state.cars.length < 2) {
      open('garage');
      return;
    }
    const idx = Math.max(0, state.cars.findIndex((c) => c.uid === state.activeUid));
    const next = state.cars[(idx + dir + state.cars.length) % state.cars.length];
    state.activeUid = next.uid;
    touch();
    changeCar();
  };
  if ($('menuPrevCar')) $('menuPrevCar').onclick = () => cycleMenuCar(-1);
  if ($('menuNextCar')) $('menuNextCar').onclick = () => cycleMenuCar(1);

  // Lobby: O'YIN BOSHLASH (Ommaviy serverga kirish)
  if ($('btnStartPublic')) $('btnStartPublic').onclick = () => {
    joinPublicServer().catch(() => {});
    play();
  };

  // Lobby: KUNLIK MUKOFOT
  if ($('btnLobbyDaily')) $('btnLobbyDaily').onclick = () => {
    if (claimDaily()) {
      beep('cash');
      toast('🎁 Kunlik mukofot: +25 000 000 so\'m olindi!', 'cash');
      updateLobbyProfileUI();
    } else {
      open('service');
    }
  };

  // Lobby: Toshkent Xaritasi tezkor lokatsiya tugmalari
  document.querySelectorAll('[data-lob-poi]').forEach((b) => {
    b.onclick = () => {
      const name = b.dataset.lobPoi;
      const pt = LANDMARK_COORDS[name];
      if (pt) {
        waypoint = { x: pt.x, z: pt.z };
        beep('ok');
        toast(`📍 GPS manzil belgilandi: ${name}`, 'ok');
      }
    };
  });

  // Lobby: To'liq ekran / Chiqish tugmasi
  if ($('btnLobbyExit')) $('btnLobbyExit').onclick = () => {
    save(true);
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      toast("To'liq ekran rejimi yoqildi", 'ok');
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  onOnline((ev) => {
    const inf = onlineInfo();
    if ($('hudOnline')) $('hudOnline').textContent = `🌐 Online: ${inf.count}/${inf.max || MAX_PLAYERS}`;
    if ($('hudMyId')) $('hudMyId').textContent = displayId(inf.host || inf.id);
    updateLobbyServerUI();
    if (ev.carHit && vehicle) {
      vehicle.applyExternalImpulse?.(ev.carHit.nx || 0, ev.carHit.nz || 0, ev.carHit.force || 12);
      addShake(Math.min(0.45, (ev.carHit.force || 12) * 0.015));
      thump(ev.carHit.force || 12);
    }
    if (ev.depositRace) {
      const dr = ev.depositRace;
      const myId = playerId();
      const hostIdVal = dr.hostId || dr.p1Id;
      const hostNameVal = dr.hostName || dr.p1Name || 'Haydovchi';
      const hostDepVal = dr.hostDeposit ?? dr.p1Deposit ?? 0;
      const guestIdVal = dr.guestId || dr.p2Id;
      const guestDepVal = dr.guestDeposit ?? dr.p2Deposit ?? 0;
      if (dr.action === 'invited') {
        pendingDepositInvite = {
          ...dr,
          hostId: hostIdVal,
          hostName: hostNameVal,
          hostDeposit: hostDepVal,
        };
        beep('ok');
        toast(dr.text || `🏁 ${hostNameVal} Depozit Poygaga chaqirdi!`, 'cash');
      } else if (dr.action === 'started') {
        pendingDepositInvite = null;
        activeDepositRace = {
          raceId: dr.raceId,
          target: dr.target,
          totalPrize: dr.totalPrize,
          hostId: hostIdVal,
          guestId: guestIdVal,
          hostDeposit: hostDepVal,
          guestDeposit: guestDepVal,
          status: 'countdown',
        };
        if (dr.target) waypoint = { x: dr.target.x, z: dr.target.z, label: dr.target.name };
        beep('go');
        toast(`🏁 Depozit Poyga: 3 soniyada start! Umumiy sovrin: ${fmt(dr.totalPrize)}`, 'cash');
        setTimeout(() => { if (activeDepositRace?.raceId === dr.raceId) toast('⏱ 2...', 'gold'); }, 1000);
        setTimeout(() => { if (activeDepositRace?.raceId === dr.raceId) toast('⏱ 1...', 'gold'); }, 2000);
        setTimeout(() => {
          if (activeDepositRace?.raceId === dr.raceId) {
            activeDepositRace.status = 'active';
            beep('go');
            toast(`🚀 START! Marraga birinchi yeting: ${dr.target?.name || 'Marra'}!`, 'cash');
          }
        }, 3200);
      } else if (dr.action === 'cancelled') {
        if (pendingDepositInvite?.raceId === dr.raceId) pendingDepositInvite = null;
        if (activeDepositRace?.raceId === dr.raceId) activeDepositRace = null;
        if (hostIdVal === myId && hostDepVal > 0) {
          addMoney(hostDepVal, 'Depozit poyga bekor qilindi (qaytarildi)');
        }
        if (guestIdVal === myId && guestDepVal > 0) {
          addMoney(guestDepVal, 'Depozit poyga bekor qilindi (qaytarildi)');
        }
        toast(dr.text || dr.reason || 'Depozit poyga bekor qilindi, garov qaytarildi', 'err');
      } else if (dr.action === 'finished') {
        pendingDepositInvite = null;
        activeDepositRace = null;
        if (dr.winnerId === myId) {
          addMoney(dr.totalPrize, `Depozit Poyga g'alabasi (+100% bonus)`);
          bumpStat('raceWins', 1);
          beep('cash');
          toast(`🏆 G'ALABA! +${fmt(dr.totalPrize)} yutib oldingiz!`, 'cash');
        } else {
          toast(dr.text || `🏁 ${dr.winnerName} poygada g'olib bo'ldi!`, 'ok');
        }
      }
    }
    if (ev.chat || ev.chatUpdated) {
      updateHudChatLog();
      if (ev.chat && !hudChatOpen) {
        unreadChatCount++;
        const b = $('hudChatBadge');
        if (b) {
          b.textContent = String(unreadChatCount);
          b.classList.remove('hidden');
        }
      }
    }
    if (playing) updateOnlinePeersHud();
  });

  goOnline().then(() => updateLobbyServerUI()).catch(() => {});
  await progress(100, 'Tayyor!');
  $('loading').classList.add('hidden');
  $('menuForm').classList.remove('hidden');
  $('nameInput').value = state.name || 'Haydovchi';
  updateMenuCarInfo();
  updateLobbyServerUI();
  loop();
}

async function play() {
  let name = $('nameInput').value.trim();
  if (!name) {
    name = 'Haydovchi';
    $('nameInput').value = name;
  }
  setName(name);
  joinPublicServer().catch(() => {});
  const cfg0 = carById(activeCar().id);
  // GLB yuklanishi o'yinga kirishni bloklamasin: ko'pi bilan 2.5 soniya kutamiz, keyin model fonda almashadi
  if (!isCarReady(cfg0)) {
    try {
      await withBusy(cfg0.name, 'Mashina modeli yuklanmoqda...', (setP) => Promise.race([
        Promise.resolve(preloadCar(cfg0, setP)).catch(() => {}),
        new Promise((r) => setTimeout(r, 2500)),
      ]));
    } catch (e) { console.warn('[play] model yuklash:', e); }
  }
  initAudio(state.settings.volume);
  if (malibuHeroModel) malibuHeroModel.group.visible = false;
  if (model) model.group.visible = true;
  if (playerMode === 'driving') charCtrl?.hide();
  $('menu').classList.remove('show');
  $('hud').classList.remove('hidden');
  $('hudName').textContent = name;
  playing = true;
  clock.getDelta();
  toast(`Xush kelibsiz, ${name}! Balans: ${fmt(state.money)}`, 'cash');
  if (canClaimDaily()) setTimeout(() => toast('🎁 Kunlik bonus tayyor — E tugmasini bosing', 'ok'), 1500);
}

$('playBtn').onclick = play;
$('nameInput').addEventListener('change', () => {
  const v = $('nameInput').value.trim();
  if (v) setName(v);
});
$('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') play(); });
document.addEventListener('visibilitychange', () => { suspend(document.hidden); if (document.hidden) save(true); });
addEventListener('beforeunload', () => save(true));

boot().catch((e) => {
  console.error(e);
  $('loadText').textContent = 'Xatolik: ' + e.message + ". Brauzer WebGL ni qo'llab-quvvatlashini va internet ulanishini tekshiring.";
});
