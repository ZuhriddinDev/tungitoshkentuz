// TUNGI TOSHKENT — asosiy fayl: yuklash, o'yin sikli, 3D Personaj va real-vaqt online tizimlar
import * as THREE from 'three';
import { carById, KM_BONUS, DAY_LENGTH_SEC, fmt } from './config.js';
import { state, activeCar, addMoney, bumpStat, touch, save, setName, canClaimDaily } from './state.js';
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
import { goOnline, tick as tickOnline, list as onlineList, info as onlineInfo, displayId, playerId, onOnline, sendChat, chatHistory, MAX_PLAYERS } from './online.js';
import { RemoteCars } from './remoteCars.js';
import { PlayerCharacter } from './character.js';

const $ = (s) => document.getElementById(s);
const canvas = $('game');
const R = createRenderer(canvas, state.settings.quality);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 5000);
R.attach(scene, camera);
window.__sens = state.settings.sens;

let smoke, sky, traffic, peds, remotes, model, vehicle, headlight, charCtrl;
let playing = false, paused = false;
let playerMode = 'driving'; // 'driving' | 'walking' | 'passenger'
let ridingWith = '';        // Do'st ID si (agar 'passenger' bo'lsa)
let hour = 21, waypoint = null, lightsMode = 'auto', kmAcc = 0, fuelWarned = false, pitch = 0, lastV = 0;
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

function updateMenuCarInfo() {
  const inst = activeCar();
  const cfg = carById(inst.id);
  if ($('menuCarName')) $('menuCarName').textContent = cfg.name;
  if ($('menuCarSpeed')) $('menuCarSpeed').textContent = `⚡ ${cfg.maxSpeed} km/s`;
  if ($('menuCarAccel')) $('menuCarAccel').textContent = `⏱ 0-100: ${(27.8 / cfg.accel).toFixed(1)}s`;
  if ($('menuCarSound')) $('menuCarSound').textContent = SOUND_NAMES[cfg.sound] || '🔊 Sport Motor';
}

function setModeUI(mode) {
  playerMode = mode;
  const footEl = $('footActions');
  const txtEl = $('hbExitTxt');
  const touchBtn = $('touchExitBtn');
  if (mode === 'driving') {
    footEl?.classList.add('hidden');
    if (txtEl) txtEl.textContent = 'Tushish (G)';
    if (touchBtn) touchBtn.textContent = '🚶';
  } else if (mode === 'walking') {
    footEl?.classList.remove('hidden');
    if (txtEl) txtEl.textContent = "O'tirish (G)";
    if (touchBtn) touchBtn.textContent = '🚗';
  } else if (mode === 'passenger') {
    footEl?.classList.add('hidden');
    if (txtEl) txtEl.textContent = 'Tushish (G)';
    if (touchBtn) touchBtn.textContent = '🚶';
  }
}

function enterOwnCar() {
  ridingWith = '';
  charCtrl?.hide();
  setModeUI('driving');
  beep('ok');
  toast(`🚗 ${vehicle.cfg.name} ruliga o'tirdingiz!`, 'ok');
}

function summonOwnCar() {
  if (!charCtrl) return;
  const cx = charCtrl.x + Math.sin(charCtrl.heading) * 3.2;
  const cz = charCtrl.z + Math.cos(charCtrl.heading) * 3.2;
  vehicle.place(cx, cz, charCtrl.heading);
  model.group.position.set(vehicle.x, groundY(vehicle.x, vehicle.z), vehicle.z);
  model.group.rotation.set(0, vehicle.heading, 0);
  enterOwnCar();
}

function sitInFriendCar(friendId) {
  const p = onlineList().find((x) => x.id === friendId);
  if (!p) return toast("Do'stingiz topilmadi", 'err');
  engineOff();
  vehicle.v = 0;
  charCtrl?.hide();
  ridingWith = friendId;
  setModeUI('passenger');
  beep('ok');
  toast(`💺 ${p.name || 'Do\'st'} ning mashinasiga o'tirdingiz! (Tushish — G)`, 'cash');
}

function toggleExitEnter() {
  if (!playing) return;
  if (playerMode === 'driving') {
    if (vehicle.kmh > 32) {
      return toast('Mashinadan tushish uchun biroz sekinlashtiring!', 'err');
    }
    engineOff();
    vehicle.v = 0;
    // Chap eshik yonida personajni chiqarish
    const doorX = vehicle.x - Math.cos(vehicle.heading) * (vehicle.cfg.wid * 0.85 + 0.55);
    const doorZ = vehicle.z + Math.sin(vehicle.heading) * (vehicle.cfg.wid * 0.85 + 0.55);
    charCtrl.setColor?.(vehicle.inst.color);
    charCtrl.spawnAt(doorX, doorZ, vehicle.heading, groundY(doorX, doorZ));
    setModeUI('walking');
    beep('ok');
    toast("🚶 Mashinadan tushdingiz! Do'st mashinasiga yoki o'z mashinangizga o'tirish — G", 'ok');
    return;
  }

  if (playerMode === 'passenger') {
    const host = remotes?.map.get(ridingWith) || onlineList().find((x) => x.id === ridingWith);
    const hx = host ? host.x : vehicle.x;
    const hz = host ? host.z : vehicle.z;
    const hh = host ? (host.h || 0) : vehicle.heading;
    const outX = hx + Math.cos(hh) * 2.2;
    const outZ = hz - Math.sin(hh) * 2.2;
    ridingWith = '';
    charCtrl.spawnAt(outX, outZ, hh, groundY(outX, outZ));
    setModeUI('walking');
    beep('ok');
    toast("🚶 Do'stingiz mashinasidan tushdingiz!", 'ok');
    return;
  }

  // playerMode === 'walking'
  // 1. Yaqin atrofdagi do'st mashinasini tekshiramiz
  const peers = onlineList();
  let nearestPeer = null, minPeerDist = 9.0;
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
    enterOwnCar();
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
  if (playerMode !== 'driving') enterOwnCar();
}

function tow() {
  enterOwnCar();
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
onKey('KeyG', keyGuard(toggleExitEnter));
onKey('KeyE', keyGuard(() => (nearPoi()?.type === 'gas' ? toggle('gas') : toggle('service'))));
onKey('KeyF', keyGuard(() => toggle('garage')));
onKey('KeyM', keyGuard(() => toggle('map')));
onKey('KeyR', keyGuard(() => toggle('race')));
onKey('KeyT', keyGuard(() => toggle('jobs')));
onKey('KeyO', keyGuard(() => toggle('online')));
onKey('Escape', keyGuard(() => (isOpen() ? closeModal() : open('pause'))));
onKey('KeyL', keyGuard(() => { lightsMode = { auto: 'on', on: 'off', off: 'auto' }[lightsMode]; toast(`Faralar: ${{ auto: 'avtomatik', on: 'yoqilgan', off: "o'chirilgan" }[lightsMode]}`); }));
onKey('KeyH', keyGuard(() => horn()));
onKey('KeyC', keyGuard(() => { camState.mode = (camState.mode + 1) % 3; }));

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
    onFoot: playerMode === 'walking',
    px: charCtrl ? charCtrl.x : vehicle.x,
    py: charCtrl ? charCtrl.y : 0,
    pz: charCtrl ? charCtrl.z : vehicle.z,
    ph: charCtrl ? charCtrl.heading : vehicle.heading,
    pv: charCtrl ? charCtrl.v : 0,
    emote: charCtrl ? charCtrl.emote : '',
    ridingWith: playerMode === 'passenger' ? ridingWith : '',
  });
  remotes?.update(dt, onlineList(), player, night);
}

function step(dt, t, sub = 1) {
  hour = (hour + (dt / DAY_LENGTH_SEC) * 24) % 24;
  const input = player.locked ? { throttle: 0, reverse: 0, steer: 0, boost: false, handbrake: true } : readDrive();
  const others = [...traffic.cars, ...rivals(), ...(remotes ? remotes.cars : [])];

  const g = model.group;
  let dist = 0;

  if (playerMode === 'driving') {
    let impact = 0;
    for (let i = 0; i < sub; i++) {
      dist += vehicle.step(dt / sub, input, others);
      impact = Math.max(impact, vehicle.impact);
    }
    vehicle.impact = impact;
    smoke?.update(dt, vehicle, state.settings.smoke !== false, groundY(vehicle.x, vehicle.z));
    if (vehicle.impact > 3) { addShake(Math.min(0.6, vehicle.impact * 0.05)); thump(vehicle.impact); }

    g.position.set(vehicle.x, g.position.y + (groundY(vehicle.x, vehicle.z) - g.position.y) * Math.min(1, dt * 12), vehicle.z);
    const acc = (vehicle.v - lastV) / Math.max(dt, 1e-3); lastV = vehicle.v;
    pitch += (THREE.MathUtils.clamp(-acc * 0.004, -0.04, 0.04) - pitch) * Math.min(1, dt * 6);
    g.rotation.set(pitch, vehicle.heading, THREE.MathUtils.clamp(-vehicle.yawRate * vehicle.v * 0.004, -0.06, 0.06));
    model.update(dist * Math.sign(vehicle.v || 1), vehicle.steer);
    model.setBrake(vehicle.braking);

    updateEngine(vehicle.rpm, input.throttle, vehicle.cfg.pitch, vehicle.slip, vehicle.kmh, {
      sound: vehicle.cfg.sound,
      braking: vehicle.braking,
      gear: vehicle.gear,
      dt,
    });
    updateCamera(camera, vehicle, input.boost, dt);
  } else if (playerMode === 'walking') {
    // Mashina to'xtab turadi, 3D Personaj harakatlanadi
    g.position.set(vehicle.x, groundY(vehicle.x, vehicle.z), vehicle.z);
    model.setBrake(false);
    charCtrl.step(dt, input, groundY(charCtrl.x, charCtrl.z));
    updateCharCamera(camera, charCtrl, dt);
  } else if (playerMode === 'passenger') {
    // Do'stning mashinasida yo'lovchi
    const hostCar = remotes?.map.get(ridingWith);
    const hostPeer = onlineList().find((x) => x.id === ridingWith);
    if (!hostCar && !hostPeer) {
      toast("Do'stingiz xonadan chiqdi", 'err');
      enterOwnCar();
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
  updateCitySectors(player.x, player.z, R.preset.shadows ? 1150 : 780);
  traffic.setNight(night); traffic.update(dt, t, player);
  peds.update(dt, t, player);
  updateMission(dt);
  for (const f of animated) f(t);

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
    setPrompt(`<span class="key">G</span>💺 Siz <b>${hostPeer?.name || 'Do\'st'}</b> mashinasidasiz · Tushish`);
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
      setPrompt(`<span class="key">G</span>💺 <b>${nearFriend.name || 'Do\'st'}</b> mashinasiga o'tirish`);
    } else if (myD < 10) {
      setPrompt(`<span class="key">G</span>🚗 O'z mashinangizga o'tirish (${vehicle.cfg.name})`);
    } else {
      setPrompt(`<span class="key">G</span>🔑 Mashinani chaqirish va rulga o'tirish`);
    }
  } else if (vehicle.nearBorder && vehicle.borderMsg) {
    setPrompt(`<span class="key">👮 YPX</span>${vehicle.borderMsg}`);
  } else {
    setPrompt(poi ? (poi.type === 'gas' ? '<span class="key">E</span>Benzin quyish' : '<span class="key">F</span>Garaj va avtosalon') : '');
  }
}

const clock = new THREE.Clock();
let fps = 60, frames = 0, fpsT = 0, hudT = 0, mapT = 0, peerHudT = 0;

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
    if (playerMode !== 'driving') enterOwnCar();
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
  el.innerHTML = chatHistory.slice(-4).map((m) => `<div class="hud-chat-msg"><b>${m.fromName}:</b> ${m.text}</div>`).join('');
  el.scrollTop = el.scrollHeight;
}

function loop() {
  requestAnimationFrame(loop);
  const raw = clock.getDelta(), t = clock.elapsedTime;
  frames++; fpsT += raw; if (fpsT > 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
  const dt = Math.min(raw, 0.2), sub = Math.ceil(dt / (1 / 30));

  // Online sinxronizatsiya har doim (hatto modal oyna ochiqligida ham!) uzluksiz ishlaydi
  syncOnlineNow(dt);

  if (playing && !paused) step(dt, t, sub);
  else if (!playing) {
    hour = 21.5; sky.update(hour, model.group.position, R.preset.shadows);
    for (const { mat, base, day = 0 } of nightMats) mat.emissiveIntensity = day + (base - day) * sky.night;
    updateProps(t, sky.night); traffic.setNight(sky.night); traffic.update(dt, t, player); peds.update(dt, t, player);
    model.setLights(true); headlight.intensity = 95; menuCamera(camera, vehicle, t);
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
  traffic: traffic.cars,
  target: mission.target,
  waypoint,
});
function onModal(open) {
  paused = open; setEnabled(!open);
  if (open) engineOff();
}

function setQuality(q, prev) {
  const a = PRESETS[q], b = PRESETS[prev];
  if (!sky) return;
  if (a.traffic !== b.traffic) { save(true); toast('Sifat o\'zgardi, qayta yuklanmoqda...'); setTimeout(() => location.reload(), 600); return; }
  sky.sun.shadow.mapSize.set(a.map, a.map); sky.sun.shadow.map?.dispose(); sky.sun.shadow.map = null;
  R.apply(q);
}

async function boot() {
  const q = state.settings.quality, preset = PRESETS[q] || PRESETS.high;
  await progress(10, 'Osmon va yorug\'lik...');
  sky = createSky(scene);
  const s = sky.sun.shadow; s.mapSize.set(preset.map, preset.map);
  Object.assign(s.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 10, far: 700 }); s.bias = -0.0004; s.normalBias = 0.6;
  await progress(30, 'Binolar va ko\'chalar qurilmoqda...');
  buildCity(scene, q);
  await progress(55, 'Chiroqlar, svetoforlar, daraxtlar...');
  buildProps(scene, q);
  await progress(70, 'Teleminora, Chorsu, Toshkent Siti...');
  buildLandmarks(scene);
  await progress(80, '3D avtomobil va personaj yuklanmoqda...');
  charCtrl = new PlayerCharacter(scene, activeCar().color);
  preloadCar(carById(activeCar().id));
  setCar();
  await progress(90, 'Shahar transporti va 3D NPC lar...');
  traffic = new Traffic(scene, preset.traffic);
  peds = new Pedestrians(scene, preset.peds);
  remotes = new RemoteCars(scene);
  initMissions({ scene, player, toast, hud: setMissionHud });
  initUI({
    onModal, tow, endRental, changeCar, save: () => save(true), setQuality,
    teleportTo: (x, z, h = 0) => {
      if (playerMode !== 'driving') enterOwnCar();
      vehicle.place(x, z, h);
    },
    sitInFriendCar,
    player: () => player, hour: () => hour, mapExtra, waypoint: () => waypoint, setWaypoint: (w) => { waypoint = w; },
  });
  initInput(canvas, () => {
    const s = state.settings;
    s.steerType = s.steerType === 'buttons' ? 'wheel' : 'buttons';
    touch();
    applyControl(s.control, s.steerType, s.touchScale);
    toast(s.steerType === 'wheel' ? '🛞 Aylanuvchi Rul yoqildi' : '◀ ▶ Tugmalar yoqildi', 'ok');
  });
  smoke = new TireSmoke(scene);
  applyControl(state.settings.control, state.settings.steerType, state.settings.touchScale);
  addEventListener('resize', () => {
    if (state.settings.control === 'auto') applyControl('auto', state.settings.steerType, state.settings.touchScale);
  });

  // Personaj (piyoda) tugmalari: Salomlashish, Raqs, Mashinani chaqirish
  document.querySelectorAll('[data-emote]').forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    const em = b.dataset.emote;
    charCtrl?.triggerEmote(em);
    sendChat(em === 'dance' ? '💃 Raqsga tushmoqda!' : '👋 Salom!', state.name || 'Haydovchi');
    beep('ok');
  }));
  if ($('summonCarBtn')) $('summonCarBtn').onclick = (e) => {
    e.stopPropagation();
    summonOwnCar();
  };

  // HUD ustidagi Tezkor Suhbat (Quick Chat)
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

  const myCode = displayId(playerId());
  if ($('menuMyId')) $('menuMyId').textContent = myCode;
  if ($('hudMyId')) $('hudMyId').textContent = myCode;
  if ($('copyMenuId')) $('copyMenuId').onclick = () => {
    navigator.clipboard?.writeText(myCode);
    toast(`Sizning ID nusxalandi: ${myCode}`, 'ok');
  };
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
  onOnline((ev) => {
    const inf = onlineInfo();
    if ($('hudOnline')) $('hudOnline').textContent = `🌐 Online: ${inf.count}/${MAX_PLAYERS}`;
    if ($('hudMyId')) $('hudMyId').textContent = displayId(inf.host || inf.id);
    if (ev.chat || ev.chatUpdated) updateHudChatLog();
    if (playing) updateOnlinePeersHud();
  });
  goOnline().catch(() => {});
  await progress(100, 'Tayyor!');
  $('loading').classList.add('hidden'); $('menuForm').classList.remove('hidden');
  $('nameInput').value = state.name;
  loop();
}

async function play() {
  const name = $('nameInput').value.trim();
  if (!name) { $('nameInput').focus(); return toast('Ismingizni kiriting', 'err'); }
  setName(name);
  const cfg0 = carById(activeCar().id);
  if (!isCarReady(cfg0)) await withBusy(cfg0.name, 'Mashina modeli yuklanmoqda...', (setP) => preloadCar(cfg0, setP));
  initAudio(state.settings.volume);
  $('menu').classList.remove('show'); $('hud').classList.remove('hidden');
  $('hudName').textContent = name;
  playing = true; clock.getDelta();
  toast(`Xush kelibsiz, ${name}! Balans: ${fmt(state.money)}`, 'cash');
  if (canClaimDaily()) setTimeout(() => toast('🎁 Kunlik bonus tayyor — E tugmasini bosing', 'ok'), 1500);
}

$('playBtn').onclick = play;
$('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') play(); });
document.addEventListener('visibilitychange', () => { suspend(document.hidden); if (document.hidden) save(true); });
addEventListener('beforeunload', () => save(true));

boot().catch((e) => {
  console.error(e);
  $('loadText').textContent = 'Xatolik: ' + e.message + '. Brauzer WebGL ni qo\'llab-quvvatlashini va internet ulanishini tekshiring.';
});
