// TUNGI TOSHKENT V9 — Asosiy fayl: Malibu Kirish Banneri, 5 mlrd Iqtisodiyot, 3D Tuning va Real-Vaqt Multiplayer
import * as THREE from 'three';
import { CARS, COLORS, TUNING, carById, KM_BONUS, DAY_LENGTH_SEC, fmt } from './config.js';
import {
  state,
  activeCar,
  addMoney,
  bumpStat,
  touch,
  save,
  setName,
  canClaimDaily,
  onChange,
  syncEconomyWithServer,
} from './state.js';
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
import { updateCamera, menuCamera, addShake, camState } from './camera.js';
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

const $ = (s) => document.getElementById(s);
const canvas = $('game');
const initialQuality = state.settings.quality === 'auto'
  ? (matchMedia('(pointer: coarse)').matches ? 'medium' : 'high')
  : (state.settings.quality || 'high');
const R = createRenderer(canvas, initialQuality);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 5000);
R.attach(scene, camera);
window.__sens = state.settings.sens || 1.0;
window.__steerSens = state.settings.steerSens || 1.0;

let smoke, sky, traffic, peds, remotes, model, malibuHeroModel, malibuHeadlight, vehicle, headlight;
let playing = false, paused = false;
let perfAuditVisible = false;
let activeDepositRace = null;
let pendingDepositInvite = null;
const FIXED_DT = 1 / 60;
let physAcc = 0;
let hour = 21.75, waypoint = null, lightsMode = 'auto', kmAcc = 0, fuelWarned = false;
const progress = (p, t) => {
  if ($('loadBar')) $('loadBar').style.width = p + '%';
  if ($('loadText')) $('loadText').textContent = t;
  return new Promise((r) => setTimeout(r, 30));
};

// V9: Barcha o'yinchilar doimo avtomobil ichida bo'ladi
const player = {
  get x() { return vehicle.x; },
  get z() { return vehicle.z; },
  get heading() { return vehicle.heading; },
  get kmh() { return vehicle.kmh; },
  get v() { return vehicle.v; },
  get cfg() { return vehicle.cfg; },
  get inst() { return vehicle.inst; },
  get vehicle() { return vehicle; },
  get len() { return vehicle.cfg.len; },
  locked: false,
};

function updateLobbyServerUI() {
  const inf = onlineInfo();
  if ($('lobTotalOnline')) $('lobTotalOnline').textContent = String(serverStats.totalOnline || inf.count || 1);
  if ($('lobPublicCount')) $('lobPublicCount').textContent = `${serverStats.publicPlayers || 1}/${serverStats.publicMax || MAX_PLAYERS}`;
  if ($('lobServerStatus')) {
    const st = serverStats.status === 'online' ? 'Online' : serverStats.status === 'connecting' ? 'Connecting...' : 'Offline';
    $('lobServerStatus').textContent = st;
    $('lobServerStatus').className = serverStats.status === 'online' ? 'cyan-txt' : 'gold-txt';
  }
  if ($('lobPingMs')) $('lobPingMs').textContent = `(${serverStats.pingMs || 18} ms)`;
}

function updateLobbyProfileUI() {
  if ($('lobMoney')) $('lobMoney').textContent = fmt(state.money);
}

function resetCarOnRoad() {
  if (!vehicle) return;
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
  toast("🔄 Mashina yo'lga tiklandi!", 'ok');
}

function updateMenuCarInfo() {
  updateLobbyProfileUI();
}

function setCar(soft = false) {
  const inst = activeCar(), cfg = carById(inst.id);
  updateMenuCarInfo();
  if (soft && model && model.cfg.id === cfg.id) {
    model.setTuning(inst);
    return;
  }
  const prev = vehicle;
  if (model) scene.remove(model.group);
  model = buildCar(cfg, inst);
  model.group.rotation.order = 'YXZ';
  model.group.traverse((o) => {
    if (o.isMesh && o.material !== undefined && !o.material.transparent) o.castShadow = true;
  });
  headlight = new THREE.SpotLight(0xfff1d6, 0, 70, 0.55, 0.45, 1.2);
  headlight.position.set(0, 0.8, cfg.len / 2);
  headlight.target.position.set(0, 0, cfg.len / 2 + 20);
  model.group.add(headlight, headlight.target);
  scene.add(model.group);
  vehicle = new Vehicle(cfg, inst);
  if (prev) vehicle.place(prev.x, prev.z, prev.heading);
  else if (state.pos) vehicle.place(state.pos.x, state.pos.z, state.pos.h);
  else vehicle.place(SPAWN.x, SPAWN.z, SPAWN.heading);
  if ($('hudCar')) $('hudCar').textContent = cfg.name + (state.rental ? ' · IJARA' : '');
  fuelWarned = false;
}

async function changeCar(soft = false) {
  const cfg = carById(activeCar().id);
  if (!soft && !isCarReady(cfg)) {
    await withBusy(cfg.name, 'Mashina modeli yuklanmoqda...', (setP) => preloadCar(cfg, setP));
  }
  setCar(soft);
}

function tow() {
  vehicle.place(SPAWN.x, SPAWN.z, SPAWN.heading);
}

function endRental(silent) {
  if (!state.rental) return;
  state.rental = null;
  touch();
  changeCar();
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

// E — Zapravka, Garaj yoki Xizmat paneli
onKey('KeyE', keyGuard(() => {
  const poi = nearPoi();
  if (poi?.type === 'gas') toggle('gas');
  else if (poi?.type === 'garage') toggle('garage');
  else toggle('service');
}));

// V9: F tugmasi mashinadan tushirmaydi!
onKey('KeyG', keyGuard(() => toggle('garage')));
onKey('KeyM', keyGuard(() => toggle('map')));
onKey('KeyR', keyGuard(() => toggle('race')));
onKey('KeyT', keyGuard(() => toggle('jobs')));
onKey('KeyO', keyGuard(() => toggle('online')));
onKey('Escape', keyGuard(() => (isOpen() ? closeModal() : open('pause'))));
onKey('KeyL', keyGuard(() => {
  lightsMode = { auto: 'on', on: 'off', off: 'auto' }[lightsMode];
  toast(`Faralar: ${{ auto: 'avtomatik', on: 'yoqilgan', off: "o'chirilgan" }[lightsMode]}`);
}));
onKey('KeyH', keyGuard(() => horn()));
onKey('KeyC', keyGuard(() => { camState.mode = (camState.mode + 1) % 3; }));
onKey('KeyX', keyGuard(() => resetCarOnRoad()));
onKey('F3', () => window.__togglePerfAudit?.());

// Real-vaqt online sinxronizatsiya
function syncOnlineNow(dt) {
  if (!vehicle || !model) return;
  const night = sky ? sky.night : 0.8;
  const lightsOn = lightsMode === 'on' || (lightsMode === 'auto' && night > 0.35);
  tickOnline(dt, {
    id: playerId(),
    name: state.name || 'Haydovchi',
    car: vehicle.cfg.id,
    color: vehicle.inst.color,
    paintType: vehicle.inst.paintType || 'metallic',
    rims: vehicle.inst.rims || 'std',
    rimColor: vehicle.inst.rimColor || '',
    spoiler: vehicle.inst.spoiler || 'none',
    bodykit: vehicle.inst.bodykit || 'std',
    tint: vehicle.inst.tint || 'none',
    headlightColor: vehicle.inst.headlightColor || '#fff3d0',
    neon: vehicle.inst.neon || 'none',
    x: vehicle.x,
    y: model.group.position.y,
    z: vehicle.z,
    h: vehicle.heading,
    v: vehicle.v,
    steer: vehicle.steer,
    yawRate: vehicle.yawRate,
    braking: vehicle.braking,
    lights: lightsOn,
    drifting: vehicle.drifting,
    onFoot: false,
    km: state.totalKm || 0,
  });
  remotes?.update(dt, onlineList(), player, night);
}

function step(dt, t) {
  hour = (hour + (dt / DAY_LENGTH_SEC) * 24) % 24;
  const input = player.locked ? { throttle: 0, reverse: 0, steer: 0, boost: false, handbrake: true, drift: false } : readDrive();
  const others = [...traffic.cars, ...rivals(), ...(remotes ? remotes.cars : [])];

  const g = model.group;
  let dist = 0;

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
  if (vehicle.impact > 4) {
    addShake(Math.min(0.28, vehicle.impact * 0.025));
    thump(vehicle.impact * 0.5);
  }

  g.position.set(vehicle.x, g.position.y + (groundY(vehicle.x, vehicle.z) - g.position.y) * Math.min(1, dt * 14), vehicle.z);
  g.rotation.set(0, vehicle.heading, 0);
  // Mashina to'xtaganda g'ildiraklar aylanmasin
  const signedDist = Math.abs(vehicle.v) > 0.05 ? dist * Math.sign(vehicle.v) : 0;
  model.update(signedDist, vehicle.steer, vehicle.pitch || 0, vehicle.roll || 0);
  model.setBrake(vehicle.braking);

  updateEngine(vehicle.rpm, input.throttle, vehicle.cfg.pitch, vehicle.slip, vehicle.kmh, {
    sound: vehicle.cfg.sound,
    braking: vehicle.braking,
    gear: vehicle.gear,
    dt,
  });
  updateCamera(camera, vehicle, input.boost, dt);

  sky.update(hour, g.position, R.preset.shadows);
  const night = sky.night;
  const lightsOn = lightsMode === 'on' || (lightsMode === 'auto' && night > 0.35);
  model.setLights(lightsOn);
  headlight.intensity = lightsOn ? 90 : 0;
  if (vehicle.inst.headlightColor) {
    headlight.color.set(vehicle.inst.headlightColor);
  }
  for (const { mat, base, day = 0 } of nightMats) mat.emissiveIntensity = day + (base - day) * night;
  waterMat.emissiveIntensity = 0.3 + night;
  updateProps(t, night);
  updateCitySectors(player.x, player.z, R.preset.shadows ? 1050 : 620);
  traffic.setNight(night);
  traffic.update(dt, t, player);
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
    state.totalKm += kmAcc;
    bumpStat('km', kmAcc);
    kmAcc = 0;
    const due = Math.floor(state.totalKm / 10);
    if (due > state.kmBonusPaid) {
      state.kmBonusPaid = due;
      addMoney(KM_BONUS, `${due * 10} km bonusi`);
      toast(`🎉 ${due * 10} km! Bonus +${fmt(KM_BONUS)}`, 'cash');
    }
  }
  if (vehicle.inst.fuelL <= 0 && !fuelWarned) {
    fuelWarned = true;
    toast('Benzin tugadi! E — xizmat paneli (benzin olib kelish yoki evakuator)', 'err');
  }
  if (vehicle.inst.fuelL > 0) fuelWarned = false;
  if (state.rental && Date.now() > state.rental.until) endRental();
  if (waypoint && Math.hypot(waypoint.x - player.x, waypoint.z - player.z) < 20) {
    waypoint = null;
    toast('Manzilga yetib keldingiz', 'ok');
  }

  const poi = nearPoi();
  if (vehicle.nearBorder && vehicle.borderMsg) {
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
      </span>
    </div>`;
  }).join('');
  el.querySelectorAll('[data-tp-hud]').forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    const p = peers.find((x) => x.id === b.dataset.tpHud);
    if (!p) return;
    vehicle.place(p.x + 3.5, p.z + 3.5, p.h || 0);
    toast(`${p.name || "Do'st"} yoniga o'tdingiz!`, 'ok');
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
  frames++;
  fpsT += raw;
  if (fpsT > 0.5) {
    fps = Math.round(frames / fpsT);
    frames = 0;
    fpsT = 0;
  }
  const dt = Math.min(raw, 0.1);

  if (perfAuditVisible && (perfT += raw) > 0.25) {
    perfT = 0;
    updatePerfAuditPanel(raw);
  }

  syncOnlineNow(dt);

  if (playing && !paused) {
    if (malibuHeroModel) malibuHeroModel.group.visible = false;
    model.group.visible = true;
    step(dt, t);
  } else if (!playing) {
    // MALIBU HERO SCENE — Asosiy kirish bannerida Chevrolet Malibu Premier 3D ko'rinishi
    hour = 21.75;
    const heroX = SPAWN.x;
    const heroZ = SPAWN.z;
    const heroH = SPAWN.heading;
    const gy = groundY(heroX, heroZ);

    if (model) model.group.visible = false;

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
    traffic.setNight(sky.night);
    traffic.update(dt, t, { x: heroX, z: heroZ });
    peds.update(dt, t, { x: heroX, z: heroZ });
    for (const f of animated) f(t);
    menuCamera(camera, { x: heroX, z: heroZ, heading: heroH }, t, dt);
  }

  if (playing) {
    drawSpeedo(player.kmh, vehicle.cfg.maxSpeed, vehicle.rpm);
    if ((hudT += dt) > 0.1) { hudT = 0; updateHud(vehicle, hour, waypoint, fps); }
    if ((mapT += dt) > 0.05) { mapT = 0; drawMinimap($('minimap'), player, mapExtra()); }
    if ((peerHudT += dt) > 0.35) { peerHudT = 0; updateOnlinePeersHud(); }
    if (!paused) { state.pos = { x: vehicle.x, z: vehicle.z, h: vehicle.heading }; save(); }
  }
  R.render(sky.night);
}

const mapExtra = () => ({
  remotes: [
    ...rivals().map((r) => ({ x: r.x, z: r.z, name: 'Raqib' })),
    ...onlineList().map((p) => ({ x: p.x, z: p.z, name: `${p.name} (${displayId(p.id)})` })),
  ],
  traffic: traffic ? traffic.cars : [],
  target: mission.target,
  waypoint,
});

function onModal(openState) {
  paused = openState;
  setEnabled(!openState);
  if (openState) engineOff();
}

function returnToLobby() {
  engineOff();
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
  const q = initialQuality, preset = PRESETS[q] || PRESETS.high;
  await progress(10, "Osmon va tungi yorug'lik...");
  sky = createSky(scene);
  const s = sky.sun.shadow;
  s.mapSize.set(preset.map, preset.map);
  Object.assign(s.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 10, far: 700 });
  s.bias = -0.0004;
  s.normalBias = 0.6;
  await progress(30, "Toshkent binolari va ko'chalari qurilmoqda...");
  buildCity(scene, q);
  await progress(55, 'Chiroqlar, svetoforlar, daraxtlar...');
  buildProps(scene, q);
  await progress(70, 'Teleminora, Chorsu, Toshkent Siti...');
  buildLandmarks(scene);
  await progress(82, 'Chevrolet Malibu Premier 3D modeli yuklanmoqda...');
  const malibuCfg = carById('malibu');
  preloadCar(malibuCfg);
  preloadCar(carById(activeCar().id));
  malibuHeroModel = buildCar(malibuCfg, { color: '#0d111c', paintType: 'metallic', rims: 'vossen', spoiler: 'none', neon: 'none' });
  malibuHeroModel.group.rotation.order = 'YXZ';
  malibuHeroModel.group.traverse((o) => {
    if (o.isMesh && o.material !== undefined && !o.material.transparent) o.castShadow = true;
  });
  malibuHeadlight = new THREE.SpotLight(0xfff1d6, 105, 65, 0.55, 0.45, 1.2);
  malibuHeadlight.position.set(0, 0.8, malibuCfg.len / 2);
  malibuHeadlight.target.position.set(0, 0, malibuCfg.len / 2 + 20);
  malibuHeroModel.group.add(malibuHeadlight, malibuHeadlight.target);
  scene.add(malibuHeroModel.group);
  setCar();
  if (model) model.group.visible = false;
  await progress(92, 'Shahar transporti va 3D NPC lar...');
  traffic = new Traffic(scene, preset.traffic);
  peds = new Pedestrians(scene, preset.peds);
  remotes = new RemoteCars(scene);
  initMissions({ scene, player, toast, hud: setMissionHud });
  initUI({
    onModal,
    tow,
    endRental,
    changeCar,
    returnToLobby,
    save: () => save(true),
    setQuality,
    teleportTo: (x, z, h = 0) => {
      vehicle.place(x, z, h);
    },
    player: () => player,
    hour: () => hour,
    mapExtra,
    waypoint: () => waypoint,
    setWaypoint: (w) => { waypoint = w; },
    getDepositRaceState: () => ({ active: activeDepositRace, invite: pendingDepositInvite }),
  });
  initInput(canvas);
  smoke = new TireSmoke(scene);

  const syncControlOnViewport = () => {
    applyControl(state.settings.control, 'buttons', state.settings.touchScale);
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
  });

  if ($('btnResetCarHud')) $('btnResetCarHud').onclick = (e) => {
    e.stopPropagation();
    resetCarOnRoad();
  };
  if ($('perfAuditClose')) $('perfAuditClose').onclick = () => window.__togglePerfAudit?.(false);

  // Yig'iluvchi HUD Chat
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

  onOnline((ev) => {
    const inf = onlineInfo();
    if ($('hudOnline')) $('hudOnline').textContent = `🌐 Online: ${inf.count}/${inf.max || MAX_PLAYERS}`;
    if ($('hudMyId')) $('hudMyId').textContent = displayId(inf.host || inf.id);
    updateLobbyServerUI();
    if (ev.carHit && vehicle) {
      vehicle.applyExternalImpulse?.(ev.carHit.nx || 0, ev.carHit.nz || 0, ev.carHit.force || 8);
      addShake(Math.min(0.25, (ev.carHit.force || 8) * 0.01));
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
  syncEconomyWithServer().then(() => updateLobbyProfileUI()).catch(() => {});

  await progress(100, 'Tayyor!');
  $('loading').classList.add('hidden');
  $('menuForm').classList.remove('hidden');
  $('nameInput').value = state.name || 'Haydovchi';
  updateMenuCarInfo();
  updateLobbyServerUI();
  loop();
}

async function play(openFriendsModal = false) {
  let name = $('nameInput').value.trim();
  if (!name) {
    name = 'Haydovchi';
    $('nameInput').value = name;
  }
  setName(name);
  joinPublicServer().catch(() => {});
  const cfg0 = carById(activeCar().id);
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
  $('menu').classList.remove('show');
  $('hud').classList.remove('hidden');
  $('hudName').textContent = name;
  playing = true;
  clock.getDelta();
  toast(`Xush kelibsiz, ${name}! Balans: ${fmt(state.money)}`, 'cash');
  if (openFriendsModal) {
    setTimeout(() => open('online'), 250);
  } else if (canClaimDaily()) {
    setTimeout(() => toast('🎁 7 Kunlik Bonus tayyor! Yuqoridagi «🎁 Bonus» tugmasini bosing', 'ok'), 1200);
  }
}

$('playBtn').onclick = () => play(false);
if ($('playFriendsBtn')) {
  $('playFriendsBtn').onclick = () => play(true);
}
$('nameInput').addEventListener('change', () => {
  const v = $('nameInput').value.trim();
  if (v) setName(v);
});
$('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') play(false); });
document.addEventListener('visibilitychange', () => { suspend(document.hidden); if (document.hidden) save(true); });
addEventListener('beforeunload', () => save(true));

boot().catch((e) => {
  console.error(e);
  $('loadText').textContent = 'Xatolik: ' + e.message + ". Brauzer WebGL ni qo'llab-quvvatlashini va internet ulanishini tekshiring.";
});
