// TUNGI TOSHKENT — asosiy fayl: yuklash, o'yin sikli va tizimlarni bog'lash
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
import { initAudio, updateEngine, engineOff, thump, horn, suspend } from './audio.js';
import { initMissions, updateMission, mission, rivals } from './missions.js';
import { drawMinimap } from './map.js';
import { initUI, toggle, open, closeModal, isOpen, toast } from './ui.js';
import { updateCamera, menuCamera, addShake, camState } from './camera.js';
import { drawSpeedo, updateHud, setPrompt, setMissionHud } from './hud.js';
import { goOnline, tick as tickOnline, list as onlineList, info as onlineInfo, displayId, playerId, onOnline, MAX_PLAYERS } from './online.js';
import { RemoteCars } from './remoteCars.js';

const $ = (s) => document.getElementById(s);
const canvas = $('game');
const R = createRenderer(canvas, state.settings.quality);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 5000);
R.attach(scene, camera);
window.__sens = state.settings.sens;

let smoke, sky, traffic, peds, remotes, model, vehicle, headlight, playing = false, paused = false;
let hour = 21, waypoint = null, lightsMode = 'auto', kmAcc = 0, fuelWarned = false, pitch = 0, lastV = 0;
const progress = (p, t) => { $('loadBar').style.width = p + '%'; $('loadText').textContent = t; return new Promise((r) => setTimeout(r, 30)); };

// Missiyalar va traffik ishlatadigan o'yinchi ko'rinishi
const player = {
  get x() { return vehicle.x; }, get z() { return vehicle.z; }, get heading() { return vehicle.heading; },
  get kmh() { return vehicle.kmh; }, get v() { return vehicle.v; }, get cfg() { return vehicle.cfg; },
  get inst() { return vehicle.inst; }, get vehicle() { return vehicle; }, get len() { return vehicle.cfg.len; },
  locked: false,
};

function setCar(soft = false) {
  const inst = activeCar(), cfg = carById(inst.id);
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

// Mashina almashganda (sotib olish, garajdan tanlash, ijara) modeli yuklanguncha «Yuklanmoqda» ko'rsatiladi
async function changeCar(soft = false) {
  const cfg = carById(activeCar().id);
  if (!soft && !isCarReady(cfg)) await withBusy(cfg.name, 'Mashina modeli yuklanmoqda...', (setP) => preloadCar(cfg, setP));
  setCar(soft);
}

function tow() { vehicle.place(SPAWN.x, SPAWN.z, SPAWN.heading); }
function endRental(silent) {
  if (!state.rental) return;
  state.rental = null; touch(); changeCar();
  if (!silent) toast('Ijara muddati tugadi, mashina qaytarildi', 'err');
}

// Mashina trotuar yoki maydonchaga chiqsa, balandlik biroz ko'tariladi
function groundY(x, z) {
  if (onRoad(x, z)) return 0;
  const info = blockInfo(nearestBlock(x), nearestBlock(z));
  return info.type === 'gas' || info.type === 'garage' ? 0.25 : info.type === 'park' || info.type === 'square' ? 0.3 : 0.22;
}
const nearestBlock = (v) => Math.max(0, Math.min(N - 1, Math.round((v - blockC(0)) / (blockC(1) - blockC(0)))));

const nearPoi = () => POIS.find((p) => Math.hypot(p.x - vehicle.x, p.z - vehicle.z) < p.r && vehicle.kmh < 20);
function keyGuard(fn) { return () => { if (playing) fn(); }; }
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
function step(dt, t, sub = 1) {
  hour = (hour + (dt / DAY_LENGTH_SEC) * 24) % 24;
  const input = player.locked ? { throttle: 0, reverse: 0, steer: 0, boost: false, handbrake: true } : readDrive();
  const others = [...traffic.cars, ...rivals(), ...(remotes ? remotes.cars : [])];
  let dist = 0, impact = 0;
  for (let i = 0; i < sub; i++) { dist += vehicle.step(dt / sub, input, others); impact = Math.max(impact, vehicle.impact); }
  vehicle.impact = impact;
  smoke?.update(dt, vehicle, state.settings.smoke !== false, groundY(vehicle.x, vehicle.z));
  if (vehicle.impact > 3) { addShake(Math.min(0.6, vehicle.impact * 0.05)); thump(vehicle.impact); }

  // Model: holat, kuzovning burilishda og'ishi va tormozda engashishi
  const g = model.group;
  g.position.set(vehicle.x, g.position.y + (groundY(vehicle.x, vehicle.z) - g.position.y) * Math.min(1, dt * 12), vehicle.z);
  const acc = (vehicle.v - lastV) / Math.max(dt, 1e-3); lastV = vehicle.v;
  pitch += (THREE.MathUtils.clamp(-acc * 0.004, -0.04, 0.04) - pitch) * Math.min(1, dt * 6);
  g.rotation.set(pitch, vehicle.heading, THREE.MathUtils.clamp(-vehicle.yawRate * vehicle.v * 0.004, -0.06, 0.06));
  model.update(dist * Math.sign(vehicle.v || 1), vehicle.steer);
  model.setBrake(vehicle.braking);

  sky.update(hour, model.group.position, R.preset.shadows);
  const night = sky.night;
  const lightsOn = lightsMode === 'on' || (lightsMode === 'auto' && night > 0.35);
  model.setLights(lightsOn); headlight.intensity = lightsOn ? 90 : 0;
  for (const { mat, base, day = 0 } of nightMats) mat.emissiveIntensity = day + (base - day) * night;
  waterMat.emissiveIntensity = 0.3 + night;
  updateProps(t, night);
  updateCitySectors(vehicle.x, vehicle.z, R.preset.shadows ? 1150 : 780);
  traffic.setNight(night); traffic.update(dt, t, player);
  peds.update(dt, t, player);
  tickOnline(dt, {
    id: playerId(),
    name: state.name,
    car: vehicle.cfg.id,
    color: vehicle.inst.color,
    x: vehicle.x,
    y: g.position.y,
    z: vehicle.z,
    h: vehicle.heading,
    v: vehicle.v,
    steer: vehicle.steer,
  });
  remotes?.update(dt, onlineList(), player, night);
  updateMission(dt);
  for (const f of animated) f(t);
  updateEngine(vehicle.rpm, input.throttle, vehicle.cfg.pitch, vehicle.slip, vehicle.kmh, {
    sound: vehicle.cfg.sound,
    braking: vehicle.braking,
    gear: vehicle.gear,
    dt,
  });

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
  if (waypoint && Math.hypot(waypoint.x - vehicle.x, waypoint.z - vehicle.z) < 20) { waypoint = null; toast('Manzilga yetib keldingiz', 'ok'); }

  const poi = nearPoi();
  if (vehicle.nearBorder && vehicle.borderMsg) {
    setPrompt(`<span class="key">👮 YPX</span>${vehicle.borderMsg}`);
  } else {
    setPrompt(poi ? (poi.type === 'gas' ? '<span class="key">E</span>Benzin quyish' : '<span class="key">F</span>Garaj va avtosalon') : '');
  }
  updateCamera(camera, vehicle, input.boost, dt);
}

const clock = new THREE.Clock();
let fps = 60, frames = 0, fpsT = 0, hudT = 0, mapT = 0;
function loop() {
  requestAnimationFrame(loop);
  const raw = clock.getDelta(), t = clock.elapsedTime;
  frames++; fpsT += raw; if (fpsT > 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
  // Past FPS da ham o'yin sekinlashmasligi uchun fizika kichik qadamlarga bo'linadi
  const dt = Math.min(raw, 0.2), sub = Math.ceil(dt / (1 / 30));
  if (playing && !paused) step(dt, t, sub);
  else if (!playing) {
    hour = 21.5; sky.update(hour, model.group.position, R.preset.shadows);
    for (const { mat, base, day = 0 } of nightMats) mat.emissiveIntensity = day + (base - day) * sky.night;
    updateProps(t, sky.night); traffic.setNight(sky.night); traffic.update(dt, t, player); peds.update(dt, t, player);
    model.setLights(true); headlight.intensity = 90; menuCamera(camera, vehicle, t);
  }
  if (playing) {
    drawSpeedo(vehicle.kmh, vehicle.cfg.maxSpeed, vehicle.rpm);
    if ((hudT += dt) > 0.1) { hudT = 0; updateHud(vehicle, hour, waypoint, fps); }
    if ((mapT += dt) > 0.05) { mapT = 0; drawMinimap($('minimap'), player, mapExtra()); }
    if (!paused) { state.pos = { x: vehicle.x, z: vehicle.z, h: vehicle.heading }; save(); }
  }
  R.render(sky.night);
}

const mapExtra = () => ({
  remotes: [
    ...rivals().map((r) => ({ x: r.x, z: r.z, name: 'Raqib' })),
    ...onlineList().map((p) => ({ x: p.x, z: p.z, name: `${p.name} (${displayId(p.id)})` })),
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
  if (!sky) return; // hali yuklanmoqda — sozlama keyingi ishga tushishda qo'llanadi
  if (a.traffic !== b.traffic) { save(true); toast('Sifat o\'zgardi, qayta yuklanmoqda...'); setTimeout(() => location.reload(), 600); return; }
  sky.sun.shadow.mapSize.set(a.map, a.map); sky.sun.shadow.map?.dispose(); sky.sun.shadow.map = null;
  R.apply(q);
}

async function boot() {
  const q = state.settings.quality, preset = PRESETS[q] || PRESETS.medium;
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
  await progress(80, '3D avtomobil modeli yuklanmoqda...');
  preloadCar(carById(activeCar().id));
  setCar(); // 3D model orqa fonda yuklanadi — menyu kutib qolmaydi
  await progress(90, 'Shahar transporti va 3D NPC lar...');
  traffic = new Traffic(scene, preset.traffic);
  peds = new Pedestrians(scene, preset.peds);
  remotes = new RemoteCars(scene);
  initMissions({ scene, player, toast, hud: setMissionHud });
  initUI({
    onModal, tow, endRental, changeCar, save: () => save(true), setQuality,
    teleportTo: (x, z, h = 0) => vehicle.place(x, z, h),
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
  const myCode = displayId(playerId());
  if ($('menuMyId')) $('menuMyId').textContent = myCode;
  if ($('hudMyId')) $('hudMyId').textContent = myCode;
  if ($('copyMenuId')) $('copyMenuId').onclick = () => {
    navigator.clipboard?.writeText(myCode);
    toast(`Sizning ID nusxalandi: ${myCode}`, 'ok');
  };
  onOnline(() => {
    const inf = onlineInfo();
    if ($('hudOnline')) $('hudOnline').textContent = `🌐 Online: ${inf.count}/${MAX_PLAYERS}`;
    if ($('hudMyId')) $('hudMyId').textContent = displayId(inf.host || inf.id);
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




