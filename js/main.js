// TUNGI TOSHKENT V9 — Asosiy fayl: Malibu Kirish Banneri, 5 mlrd Iqtisodiyot, 3D Tuning va Real-Vaqt Multiplayer
import * as THREE from 'three';
import { CARS, COLORS, TUNING, carById, KM_BONUS, DAY_LENGTH_SEC, fmt } from './config.js';
import {
  state,
  activeCar,
  addMoney,
  spend,
  bumpStat,
  touch,
  save,
  setName,
  claimUsernameServer,
  canClaimDaily,
  onChange,
  syncEconomyWithServer,
} from './state.js';
import { createRenderer, PRESETS } from './render.js';
import { buildCity, updateCitySectors, nightMats, waterMat, roadMat } from './world/city.js';
import { buildProps, updateProps } from './world/props.js';
import { buildLandmarks, updateLandmarks, animated } from './world/landmarks.js';
import { createSky } from './world/sky.js';
import { SPAWN, POIS, N, onRoad, blockC, blockInfo } from './world/layout.js';
import { buildCar, preloadCar, isCarReady } from './carModel.js';
import { withBusy } from './busy.js';
import { Vehicle } from './physics.js';
import { Traffic, Pedestrians } from './traffic.js';
import { initInput, readDrive, onKey, setEnabled, applyControl, isTouch, cam } from './input.js';
import { TireSmoke } from './smoke.js';
import { initAudio, updateEngine, engineStart, engineOff, remoteAudio, thump, horn, beep, suspend } from './audio.js';
import { initMissions, updateMission, mission, rivals } from './missions.js';
import { drawMinimap } from './map.js';
import { initUI, toggle, open, closeModal, isOpen, toast } from './ui.js';
import { updateCamera, updateCharCamera, cycleCharZoom, resetCharCamera, menuCamera, addShake, camState } from './camera.js';
import { drawSpeedo, updateHud, setPrompt, setMissionHud } from './hud.js';
import { buildKokobangoClub } from './world/kokobango.js';
import { PlayerCharacter } from './character.js';
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
let kokobango, playerChar, insideClub = false, clubTransitioning = false, clubSeated = false;
let playing = false, paused = false;
let perfAuditVisible = false;
let activeDepositRace = null;
let pendingDepositInvite = null;
const FIXED_DT = 1 / 60;
let physAcc = 0;
let speedoT = 0, lastNightVal = -1;
let hour = 21.75, waypoint = null, lightsMode = 'auto', kmAcc = 0, fuelWarned = false;
const progress = (p, t) => {
  if ($('loadBar')) $('loadBar').style.width = p + '%';
  if ($('loadText')) $('loadText').textContent = t;
  return new Promise((r) => setTimeout(r, 30));
};

// V9: Barcha o'yinchilar doimo avtomobil ichida bo'ladi
const player = {
  get x() { return insideClub && playerChar ? playerChar.x : vehicle.x; },
  get z() { return insideClub && playerChar ? playerChar.z : vehicle.z; },
  get heading() { return insideClub && playerChar ? playerChar.heading : vehicle.heading; },
  get kmh() { return insideClub ? 0 : vehicle.kmh; },
  get v() { return insideClub ? 0 : vehicle.v; },
  get cfg() { return vehicle.cfg; },
  get inst() { return vehicle.inst; },
  get vehicle() { return vehicle; },
  get len() { return vehicle.cfg.len; },
  get inClub() { return insideClub; },
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

// E — Zapravka, Garaj, Xizmat paneli hamda KOKOBANGO CLUB interaksiyasi
onKey('KeyE', keyGuard(() => {
  if (!isTouch() && insideClub && kokobango && playerChar) {
    if (clubSeated) {
      clubSeated = false;
      const exitX = playerChar.x - 0.9;
      playerChar.spawnAt(exitX, playerChar.z, playerChar.heading, kokobango.getFloorY(exitX, playerChar.z, playerChar.y));
      toast('🚶 Divandan turdingiz', 'ok');
      return;
    }
    const act = kokobango.getInteractable?.(playerChar.x, playerChar.z, playerChar.y);
    if (!act) return;
    if (act.id === 'vip_unlock') {
      const cost = act.cost || 25_000_000;
      showVipLoungeModal(cost, () => {
        if (!spend(cost, 'KOKOBANGO VIP Lounge (21+)')) {
          beep(220, 0.12);
          toast(`💸 VIP Lounge uchun mablag‘ yetarli emas (${fmt(cost)})!`, 'err');
          return;
        }
        state.vipClubPass = true;
        save();
        kokobango.setVipUnlocked?.(true);
        beep(880, 0.14);
        toast('👑 VIP Lounge (21+) ochildi! Endi VIP hududga kirishingiz mumkin.', 'ok');
      });
    } else if (act.id === 'vip_service') {
      const vipDrinkCost = 1_500_000;
      if (!spend(vipDrinkCost, 'KOKOBANGO VIP Lounge: Shampan xizmati')) {
        beep(220, 0.12);
        toast(`💸 VIP xizmat uchun mablag‘ yetarli emas (${fmt(vipDrinkCost)})!`, 'err');
        return;
      }
      beep(740, 0.11);
      toast('🥂 VIP Lounge: Premium shampan (alkogolsiz) va VIP xizmat tayyor (-1 500 000 so‘m)!', 'ok');
    } else if (act.id === 'bar' || act.id === 'rooftop_bar') {
      const drinkCost = 500_000;
      if (!spend(drinkCost, 'KOKOBANGO BAR: Alkogolsiz kokteyl')) {
        beep(220, 0.12);
        toast(`💸 Kokteyl uchun mablag‘ yetarli emas (${fmt(drinkCost)})!`, 'err');
        return;
      }
      beep(660, 0.09);
      toast('🍹 KOKOBANGO BAR: Maxsus alkogolsiz kokteyl tayyorlandi (-500 000 so‘m)!', 'ok');
    } else if (act.id === 'dj') {
      kokobango.triggerBeatDrop();
      beep(880, 0.12);
      toast('🎧 DJ BEAT DROP! Lazer shou boshlandi!', 'ok');
    } else if (act.id === 'npc') {
      beep(580, 0.07);
      toast(act.reply || '💬 Mehmon: "KOKOBANGO CLUB muhiti zo‘r ekan!"', 'ok');
    } else if (act.teleport) {
      const fadeEl = $('clubFade');
      if (fadeEl) fadeEl.classList.add('active');
      setTimeout(() => {
        playerChar.spawnAt(act.teleport.x, act.teleport.z, act.teleport.h, act.teleport.y);
        resetCharCamera(act.teleport.h);
        toast(act.teleport.msg || '🛗 Qavat almashtirildi', 'ok');
        setTimeout(() => { if (fadeEl) fadeEl.classList.remove('active'); }, 120);
      }, 180);
    } else if (act.seat) {
      clubSeated = true;
      playerChar.spawnAt(act.seat.x, act.seat.z, act.seat.h, act.seat.y);
      toast("🛋️ Divanga o'tirdingiz ([E] yoki [WASD] — turish)", 'ok');
    }
    return;
  }

  if (!isTouch() && !insideClub && kokobango && vehicle) {
    const carInfo = kokobango.getNearbySupercar?.(vehicle.x, vehicle.z);
    if (carInfo) {
      beep(520, 0.08);
      toast(`🏎️ ${carInfo.name} · ${carInfo.tier} · Max ${carInfo.maxSpeed} km/h`, 'ok');
      return;
    }
  }

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
let clubMobileNoticeShown = false;
let clubEntryPaid = false;
const CLUB_ENTRY_FEE = 9_000_000;

function showClubAgeGateModal(onConfirm) {
  let modal = document.getElementById('clubAgeGateModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'clubAgeGateModal';
    modal.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:9999', 'display:flex', 'align-items:center',
      'justify-content:center', 'padding:18px', 'background:rgba(8,2,14,0.82)',
      'backdrop-filter:blur(12px)', '-webkit-backdrop-filter:blur(12px)',
      'font-family:Inter,system-ui,sans-serif',
    ].join(';');
    modal.innerHTML = `
      <div style="max-width:420px;width:100%;background:linear-gradient(160deg,rgba(32,6,24,0.97),rgba(12,4,20,0.99));border:1px solid rgba(244,63,94,0.45);border-radius:18px;padding:24px 22px;box-shadow:0 24px 56px rgba(0,0,0,0.75),0 0 32px rgba(244,63,94,0.22);text-align:center;color:#fdf2f8;">
        <div style="width:54px;height:54px;margin:0 auto 12px;border-radius:14px;background:linear-gradient(135deg,rgba(244,63,94,0.28),rgba(251,191,36,0.2));border:1px solid rgba(251,191,36,0.45);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:#fde047;">21+</div>
        <h3 style="margin:0 0 10px;font-size:18px;font-weight:800;letter-spacing:1.1px;color:#fb7185;">KOKOBANGO CLUB · 18+ / 21+</h3>
        <p style="margin:0 0 14px;font-size:13.5px;line-height:1.58;color:#e2e8f0;">
          Ushbu hudud faqat <b>18+ / 21+</b> kattalar uchun mo‘ljallangan tungi klub va VIP lounge muhitidir.<br><br>
          <b>Asosiy zalga kirish chiptasi:</b> <span style="color:#fde047;font-weight:800;">9 000 000 so‘m</span><br>
          <span style="font-size:12px;color:#94a3b8;">(Tasdiqlasangiz virtual hisobingizdan yechiladi)</span>
        </p>
        <div style="display:flex;gap:10px;">
          <button id="clubAgeCancel" type="button" style="flex:1;padding:11px 12px;border:1px solid rgba(255,255,255,0.18);border-radius:12px;background:rgba(255,255,255,0.06);color:#cbd5e1;font-weight:700;font-size:13px;cursor:pointer;">Bekor qilish</button>
          <button id="clubAgeConfirm" type="button" style="flex:1.5;padding:11px 14px;border:none;border-radius:12px;background:linear-gradient(90deg,#e11d48,#a855f7);color:#fff;font-weight:800;font-size:13px;cursor:pointer;letter-spacing:0.3px;">18+ · 9 mln to‘lab kirish</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  const confirmBtn = document.getElementById('clubAgeConfirm');
  const cancelBtn = document.getElementById('clubAgeCancel');
  if (confirmBtn) {
    confirmBtn.onclick = () => {
      modal.style.display = 'none';
      if (typeof onConfirm === 'function') onConfirm();
    };
  }
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      modal.style.display = 'none';
    };
  }
  modal.onclick = (e) => {
    if (e.target === modal) modal.style.display = 'none';
  };
  modal.style.display = 'flex';
}

function showVipLoungeModal(cost, onConfirm) {
  let modal = document.getElementById('clubVipModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'clubVipModal';
    modal.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:9999', 'display:flex', 'align-items:center',
      'justify-content:center', 'padding:18px', 'background:rgba(8,2,14,0.84)',
      'backdrop-filter:blur(12px)', '-webkit-backdrop-filter:blur(12px)',
      'font-family:Inter,system-ui,sans-serif',
    ].join(';');
    modal.innerHTML = `
      <div style="max-width:440px;width:100%;background:linear-gradient(160deg,rgba(40,8,28,0.98),rgba(14,4,22,0.99));border:1px solid rgba(251,191,36,0.5);border-radius:18px;padding:24px 22px;box-shadow:0 24px 56px rgba(0,0,0,0.8),0 0 36px rgba(251,191,36,0.2);text-align:center;color:#fdf2f8;">
        <div style="width:54px;height:54px;margin:0 auto 12px;border-radius:14px;background:linear-gradient(135deg,rgba(251,191,36,0.28),rgba(244,63,94,0.25));border:1px solid rgba(251,191,36,0.55);display:flex;align-items:center;justify-content:center;font-size:24px;">👑</div>
        <h3 style="margin:0 0 10px;font-size:18px;font-weight:800;letter-spacing:1.1px;color:#fde047;">VIP LOUNGE (21+ EXCLUSIVE)</h3>
        <p style="margin:0 0 14px;font-size:13.5px;line-height:1.6;color:#e2e8f0;text-align:left;background:rgba(0,0,0,0.28);padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">
          ✨ <b>Yopiq premium zona:</b> tashqaridan ko‘rinmaydigan maxfiy VIP muhit<br>
          🛋️ <b>Hashamatli baxmal divanlar</b> va shaxsiy stol xizmati<br>
          🥂 <b>VIP mini-bar:</b> maxsus shampan va kokteyl xizmati<br>
          🎭 <b>21+ Glamour atmosfera:</b> oltin ramkali fotografiyalar va maxsus yoritish
        </p>
        <div style="margin-bottom:16px;font-size:14px;font-weight:800;color:#fde047;">Kirish to‘lovi: ${fmt(cost)}</div>
        <div style="display:flex;gap:10px;">
          <button id="clubVipCancel" type="button" style="flex:1;padding:11px 12px;border:1px solid rgba(255,255,255,0.18);border-radius:12px;background:rgba(255,255,255,0.06);color:#cbd5e1;font-weight:700;font-size:13px;cursor:pointer;">Kirmayman</button>
          <button id="clubVipConfirm" type="button" style="flex:1.5;padding:11px 14px;border:none;border-radius:12px;background:linear-gradient(90deg,#f59e0b,#e11d48);color:#fff;font-weight:800;font-size:13px;cursor:pointer;letter-spacing:0.3px;">25 mln to‘lab kirish</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  const confirmBtn = document.getElementById('clubVipConfirm');
  const cancelBtn = document.getElementById('clubVipCancel');
  if (confirmBtn) {
    confirmBtn.onclick = () => {
      modal.style.display = 'none';
      if (typeof onConfirm === 'function') onConfirm();
    };
  }
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      modal.style.display = 'none';
    };
  }
  modal.onclick = (e) => {
    if (e.target === modal) modal.style.display = 'none';
  };
  modal.style.display = 'flex';
}

function showClubPcOnlyNotice(customTitle, customMsg) {
  let modal = document.getElementById('clubPcOnlyModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'clubPcOnlyModal';
    modal.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:9999', 'display:flex', 'align-items:center',
      'justify-content:center', 'padding:18px', 'background:rgba(4,8,18,0.72)',
      'backdrop-filter:blur(10px)', '-webkit-backdrop-filter:blur(10px)',
      'font-family:Inter,system-ui,sans-serif',
    ].join(';');
    modal.innerHTML = `
      <div style="max-width:390px;width:100%;background:linear-gradient(160deg,rgba(16,22,42,0.96),rgba(10,14,28,0.98));border:1px solid rgba(0,229,255,0.35);border-radius:18px;padding:22px 20px;box-shadow:0 20px 50px rgba(0,0,0,0.65),0 0 28px rgba(176,38,255,0.22);text-align:center;color:#f3f6ff;">
        <div style="width:52px;height:52px;margin:0 auto 12px;border-radius:14px;background:linear-gradient(135deg,rgba(176,38,255,0.25),rgba(0,229,255,0.2));border:1px solid rgba(0,229,255,0.4);display:flex;align-items:center;justify-content:center;font-size:24px;">💻</div>
        <h3 id="clubPcOnlyTitle" style="margin:0 0 10px;font-size:18px;font-weight:800;letter-spacing:1.2px;color:#00e5ff;">KOKOBANGO CLUB</h3>
        <p id="clubPcOnlyBody" style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#cbd5e1;">
          Ushbu hududga faqat PC va noutbuk orqali kirish mumkin.<br><br>
          Klubga kirish uchun kompyuterdan foydalaning.
        </p>
        <button id="clubPcOnlyClose" type="button" style="width:100%;padding:11px 16px;border:none;border-radius:12px;background:linear-gradient(90deg,#00e5ff,#7b2cbf);color:#fff;font-weight:700;font-size:14px;cursor:pointer;letter-spacing:0.4px;">Tushunarli</button>
      </div>
    `;
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.id === 'clubPcOnlyClose') modal.style.display = 'none';
    });
    document.body.appendChild(modal);
  }
  const titleEl = document.getElementById('clubPcOnlyTitle');
  const bodyEl = document.getElementById('clubPcOnlyBody');
  if (titleEl && customTitle) titleEl.textContent = customTitle;
  if (bodyEl && customMsg) bodyEl.innerHTML = customMsg;
  modal.style.display = 'flex';
}

function setClubPrompt(text, allowTouch = false) {
  const el = $('clubPrompt');
  if (!el) return;
  if (!text || (isTouch() && !allowTouch)) {
    el.classList.add('hidden');
    el.innerHTML = '';
    el.onclick = null;
    return;
  }
  el.innerHTML = text;
  el.classList.remove('hidden');
}

function syncClubAudioUi() {
  const btn = $('clubMusicToggle');
  const slider = $('clubVolSlider');
  if (btn && kokobango?.music) {
    btn.textContent = kokobango.music.muted ? "🔇 Musiqa o'chiq" : '🔊 Musiqa';
  }
  if (slider && kokobango?.music && document.activeElement !== slider) {
    slider.value = String(Math.round((kokobango.music.targetVol || 0.75) * 100));
  }
}

async function enterKokobangoClub() {
  if (!kokobango || !playerChar || insideClub || clubTransitioning) return;
  if (isTouch()) {
    showClubPcOnlyNotice();
    return;
  }
  clubTransitioning = true;
  try {
    const res = await fetch('/api/club/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isTouch: isTouch(),
        coarsePointer: typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches,
        maxTouchPoints: navigator.maxTouchPoints || 0,
      }),
    });
    if (res.status === 403) {
      const data = await res.json().catch(() => ({}));
      clubTransitioning = false;
      showClubPcOnlyNotice(data.title || 'KOKOBANGO CLUB');
      return;
    }
  } catch { /* Offline/static server fallback relies on !isTouch() */ }
  if (!clubEntryPaid) {
    clubTransitioning = false;
    showClubAgeGateModal(() => {
      if (!spend(CLUB_ENTRY_FEE, 'KOKOBANGO CLUB kirish chiptasi')) {
        beep(220, 0.12);
        toast(`💸 Klubga kirish uchun mablag‘ yetarli emas (${fmt(CLUB_ENTRY_FEE)})!`, 'err');
        return;
      }
      clubEntryPaid = true;
      beep(780, 0.1);
      toast('🎟️ KOKOBANGO CLUB chiptasi olindi (-9 000 000 so‘m)!', 'ok');
      enterKokobangoClub();
    });
    return;
  }
  setClubPrompt('');
  const fadeEl = $('clubFade');
  if (fadeEl) fadeEl.classList.add('active');
  setTimeout(() => {
    const dropH = Number.isFinite(kokobango.parkDropOff.heading) ? kokobango.parkDropOff.heading : Math.PI;
    const spawnH = Number.isFinite(kokobango.insideSpawn.heading) ? kokobango.insideSpawn.heading : Math.PI;
    vehicle.place(kokobango.parkDropOff.x, kokobango.parkDropOff.z, dropH);
    vehicle.v = 0;
    insideClub = true;
    $('hud')?.classList.add('club-mode');
    $('clubUi')?.classList.remove('hidden');
    engineOff();
    if (model) model.group.visible = false;
    if (state.vipClubPass) kokobango.setVipUnlocked?.(true);
    kokobango.setInside(true);
    playerChar.spawnAt(kokobango.insideSpawn.x, kokobango.insideSpawn.z, spawnH, kokobango.interiorY);
    resetCharCamera(spawnH);
    kokobango.music.setVolume(0.75);
    syncClubAudioUi();
    toast('🎧 KOKOBANGO CLUB! [WASD] Yurish · [V] Kamera · [B] Raqs · [X] Chiqish', 'ok');
    setTimeout(() => {
      if (fadeEl) fadeEl.classList.remove('active');
      clubTransitioning = false;
    }, 140);
  }, 280);
}

function exitKokobangoClub() {
  if (!kokobango || !playerChar || !insideClub || clubTransitioning) return;
  clubTransitioning = true;
  clubEntryPaid = false;
  setClubPrompt('');
  const fadeEl = $('clubFade');
  if (fadeEl) fadeEl.classList.add('active');
  setTimeout(() => {
    insideClub = false;
    clubSeated = false;
    $('hud')?.classList.remove('club-mode');
    $('clubUi')?.classList.add('hidden');
    kokobango.setInside(false);
    kokobango.music.setVolume(0);
    playerChar.hide();
    if (model) model.group.visible = true;
    const dropH = Number.isFinite(kokobango.parkDropOff.heading) ? kokobango.parkDropOff.heading : Math.PI;
    vehicle.place(kokobango.parkDropOff.x, kokobango.parkDropOff.z, dropH);
    if (playing && !paused) engineStart();
    setTimeout(() => {
      if (fadeEl) fadeEl.classList.remove('active');
      clubTransitioning = false;
    }, 140);
  }, 280);
}

onKey('KeyH', keyGuard(() => { if (!insideClub) horn(); }));
onKey('KeyC', keyGuard(() => { if (!insideClub) camState.mode = (camState.mode + 1) % 2; }));
onKey('KeyV', keyGuard(() => {
  if (!isTouch() && insideClub) {
    const zm = cycleCharZoom();
    toast(`📷 Kamera masofasi: ${zm.label}`, 'ok');
  }
}));
onKey('KeyM', keyGuard(() => {
  if (!isTouch() && insideClub && kokobango) {
    const muted = kokobango.music.toggleMute();
    syncClubAudioUi();
    toast(muted ? '🔇 Klub musiqasi o‘chirildi' : '🔊 Klub musiqasi yoqildi', 'ok');
    return;
  }
  toggle('map');
}));
$('clubMusicToggle')?.addEventListener('click', () => {
  if (!insideClub || !kokobango) return;
  const muted = kokobango.music.toggleMute();
  syncClubAudioUi();
  toast(muted ? '🔇 Klub musiqasi o‘chirildi' : '🔊 Klub musiqasi yoqildi', 'ok');
});
$('clubVolSlider')?.addEventListener('input', (e) => {
  if (!insideClub || !kokobango) return;
  const v = Math.max(0, Math.min(1, Number(e.target.value) / 100));
  if (kokobango.music.muted && v > 0) kokobango.music.muted = false;
  kokobango.music.setVolume(v);
  syncClubAudioUi();
});
onKey('KeyX', keyGuard(() => {
  if (!isTouch() && kokobango && !clubTransitioning) {
    if (insideClub && kokobango.nearExit(playerChar.x, playerChar.z)) {
      exitKokobangoClub();
      return;
    }
    if (!insideClub && kokobango.nearEntrance(vehicle.x, vehicle.z)) {
      enterKokobangoClub();
      return;
    }
  }
  if (!insideClub) resetCarOnRoad();
}));
onKey('KeyB', keyGuard(() => {
  if (!isTouch() && insideClub && playerChar) {
    playerChar.triggerEmote('dance');
  }
}));
onKey('F3', () => window.__togglePerfAudit?.());

// Real-vaqt online sinxronizatsiya
function syncOnlineNow(dt) {
  if (!vehicle || !model) return;
  const night = sky ? sky.night : 0.8;
  const lightsOn = lightsMode === 'on' || (lightsMode === 'auto' && night > 0.35);
  const inClubNow = insideClub && !!playerChar;
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
    x: inClubNow ? playerChar.x : vehicle.x,
    y: inClubNow ? kokobango.interiorY : model.group.position.y,
    z: inClubNow ? playerChar.z : vehicle.z,
    h: inClubNow ? playerChar.heading : vehicle.heading,
    v: inClubNow ? 0 : vehicle.v,
    steer: inClubNow ? 0 : vehicle.steer,
    yawRate: inClubNow ? 0 : vehicle.yawRate,
    braking: inClubNow ? false : vehicle.braking,
    lights: inClubNow ? false : lightsOn,
    drifting: inClubNow ? false : vehicle.drifting,
    onFoot: inClubNow,
    inClub: inClubNow,
    anim: inClubNow ? (playerChar.animState || 'idle') : '',
    km: state.totalKm || 0,
  });
  remotes?.update(dt, onlineList(), player, night);
  if (!inClubNow && remotes?.cars && vehicle) {
    remoteAudio.update(remotes.cars, vehicle, dt);
  }
}

const othersList = [];

function step(dt, t) {
  hour = (hour + (dt / DAY_LENGTH_SEC) * 24) % 24;
  if (kokobango) {
    const dx = player.x - kokobango.cx;
    const dz = player.z - kokobango.cz;
    kokobango.update(dt, t, insideClub, dx * dx + dz * dz);
  }

  if (insideClub && playerChar && kokobango) {
    const input = player.locked ? { throttle: 0, reverse: 0, steer: 0, boost: false, handbrake: true, drift: false } : readDrive();
    if (clubSeated && (input.throttle > 0.1 || input.reverse > 0.1 || Math.abs(input.steer) > 0.1)) {
      clubSeated = false;
      playerChar.x -= 0.85;
    }
    const activeColliders = kokobango.getCollidersAt ? kokobango.getCollidersAt(playerChar.y) : kokobango.interiorColliders;
    if (!clubSeated) {
      const clubFloorY = kokobango.getFloorY ? kokobango.getFloorY(playerChar.x, playerChar.z, playerChar.y) : kokobango.interiorY;
      playerChar.step(dt, input, clubFloorY, cam.yaw, activeColliders);
    } else {
      playerChar.model.animate(dt, 0, 'sit');
    }
    updateCharCamera(camera, playerChar, dt, activeColliders);
    const zoneInfo = kokobango.getZoneInfo?.(playerChar.x, playerChar.y, playerChar.z);
    if (zoneInfo) {
      const badge = $('clubZoneBadge');
      if (badge && badge.textContent !== zoneInfo.label) badge.textContent = zoneInfo.label;
      kokobango.music.setZone?.(zoneInfo.musicZone);
    }
    setPrompt('');
    if (!isTouch()) {
      if (kokobango.nearExit(playerChar.x, playerChar.z, playerChar.y)) {
        setClubPrompt('<span class="key">X</span> EXIT KOKOBANGO CLUB');
      } else if (clubSeated) {
        setClubPrompt('<span class="key">E</span> DIVANDAN TURISH');
      } else {
        const act = kokobango.getInteractable?.(playerChar.x, playerChar.z, playerChar.y);
        setClubPrompt(act ? act.label : '');
      }
    } else {
      setClubPrompt('');
    }
    return;
  }

  if (kokobango && kokobango.nearEntrance(vehicle.x, vehicle.z)) {
    if (isTouch()) {
      setClubPrompt('🚪 KOKOBANGO CLUB (PC)', true);
      const el = $('clubPrompt');
      if (el) el.onclick = () => showClubPcOnlyNotice();
      if (!clubMobileNoticeShown) {
        clubMobileNoticeShown = true;
        showClubPcOnlyNotice();
      }
    } else {
      setClubPrompt('<span class="key">X</span> ENTER KOKOBANGO CLUB');
    }
  } else {
    clubMobileNoticeShown = false;
    if (!isTouch() && kokobango) {
      const nearCar = kokobango.getNearbySupercar?.(vehicle.x, vehicle.z);
      setClubPrompt(nearCar ? `<span class="key">E</span> ${nearCar.name} ko'rish` : '');
    } else {
      setClubPrompt('');
    }
  }

  const input = player.locked ? { throttle: 0, reverse: 0, steer: 0, boost: false, handbrake: true, drift: false } : readDrive();
  othersList.length = 0;
  for (let i = 0; i < traffic.cars.length; i++) othersList.push(traffic.cars[i]);
  const rivs = rivals();
  for (let i = 0; i < rivs.length; i++) othersList.push(rivs[i]);
  if (remotes?.cars) {
    for (let i = 0; i < remotes.cars.length; i++) othersList.push(remotes.cars[i]);
  }

  const g = model.group;
  let dist = 0;

  physAcc = Math.min(physAcc + dt, FIXED_DT * 4);
  let impact = 0;
  let steps = 0;
  while (physAcc >= FIXED_DT && steps < 4) {
    dist += vehicle.step(FIXED_DT, input, othersList, sky?.wetGrip || 1.0);
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
  model.update(signedDist, vehicle.steer, vehicle.pitch || 0, vehicle.roll || 0, vehicle.wheelSusp);
  model.setBrake(vehicle.braking);

  updateEngine(vehicle.rpm, input.throttle, vehicle.cfg.pitch, vehicle.slip, vehicle.kmh, {
    sound: vehicle.cfg.sound,
    braking: vehicle.braking,
    gear: vehicle.gear,
    isInterior: false,
    dt,
  });
  updateCamera(camera, vehicle, input.boost, dt);

  sky.update(hour, g.position, R.preset.shadows, dt);
  if (roadMat) {
    const wet = sky.wetness || 0;
    roadMat.roughness = 0.46 - wet * 0.28;
    roadMat.envMapIntensity = 1.35 + wet * 0.95;
  }
  const night = sky.night;
  const lightsOn = lightsMode === 'on' || (lightsMode === 'auto' && night > 0.35);
  model.setLights(lightsOn);
  headlight.intensity = lightsOn ? 90 : 0;
  if (vehicle.inst.headlightColor) {
    headlight.color.set(vehicle.inst.headlightColor);
  }
  if (Math.abs(night - lastNightVal) > 0.004) {
    lastNightVal = night;
    for (const { mat, base, day = 0 } of nightMats) mat.emissiveIntensity = day + (base - day) * night;
    waterMat.emissiveIntensity = 0.3 + night;
  }
  const cullDist = R.activeQuality === 'low' ? 700 : R.activeQuality === 'medium' ? 850 : R.activeQuality === 'ultra' ? 1250 : 1000;
  updateProps(t, night, player.x, player.z, cullDist);
  updateCitySectors(player.x, player.z, cullDist);
  updateLandmarks(player.x, player.z);
  traffic.setNight(night);
  traffic.update(dt, t, player, peds);
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
let fps = 60, frames = 0, fpsT = 0, hudT = 0, mapT = 0, peerHudT = 0, perfT = 0, posSaveTimer = 0;

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

  const stats = serverStats?.() || {};
  const pingVal = stats.rtt ? `${Math.round(stats.rtt)} ms` : (onlineInfo?.()?.ping ? `${Math.round(onlineInfo().ping)} ms` : '16 ms');
  if ($('paPing')) $('paPing').textContent = pingVal;

  if ($('paChunks')) {
    $('paChunks').textContent = '14 Sektor';
  }

  const oList = onlineList?.() || [];
  if ($('paOnline')) $('paOnline').textContent = `${oList.length + 1} ta`;
}

window.__togglePerfAudit = (forceState) => {
  perfAuditVisible = typeof forceState === 'boolean' ? forceState : !perfAuditVisible;
  const el = $('perfAuditPanel');
  if (el) el.classList.toggle('hidden', !perfAuditVisible);
  toast(perfAuditVisible ? '📊 Performance Audit yoqildi (F3)' : "📊 Performance Audit o'chirildi", 'ok');
  return perfAuditVisible;
};
window.__isPerfAuditVisible = () => perfAuditVisible;

let peersHudCollapsed = false;

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

  const countStr = `${peers.length}/30`;
  const arrow = peersHudCollapsed ? '▶' : '▼';

  const rowsHtml = peers.map((p) => {
    const d = Math.round(Math.hypot((p.x || 0) - player.x, (p.z || 0) - player.z));
    const distStr = d > 1000 ? `${(d / 1000).toFixed(1)}km` : `${d}m`;
    const carObj = p.car ? CARS.find(c => c.id === p.car) : null;
    const carName = carObj ? carObj.name.split(' ')[0] : '';
    const carBadge = carName ? `<span class="peer-car-tag">${carName}</span>` : '';
    return `<div class="peer-pill">
      <div class="peer-pill-meta">
        <span class="peer-status-dot"></span>
        <b class="peer-name" title="${p.name || 'Haydovchi'}">${p.name || 'Haydovchi'}</b>
        ${carBadge}
      </div>
      <div class="peer-pill-actions">
        <small class="peer-dist">${distStr}</small>
        <button type="button" class="peer-tp-btn" data-tp-hud="${p.id}" title="Do'st yoniga teleport">📍</button>
      </div>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="peers-hud-box">
      <button type="button" class="peers-hud-toggle-btn" id="peersHudToggle">
        <span class="peers-hud-label">👥 <b>O'yinchilar:</b> <span class="cyan-txt">${countStr}</span></span>
        <span class="peers-hud-arrow">${arrow}</span>
      </button>
      <div class="peers-hud-scroll ${peersHudCollapsed ? 'collapsed' : ''}">
        ${rowsHtml}
      </div>
    </div>
  `;

  const toggleBtn = $('peersHudToggle');
  if (toggleBtn) {
    toggleBtn.onclick = (e) => {
      e.stopPropagation();
      peersHudCollapsed = !peersHudCollapsed;
      updateOnlinePeersHud();
    };
  }

  el.querySelectorAll('[data-tp-hud]').forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    const p = peers.find((x) => x.id === b.dataset.tpHud);
    if (!p) return;
    vehicle.place(p.x + 3.5, p.z + 3.5, p.h || 0);
    toast(`${p.name || "Do'st"} yoniga o'tdingiz!`, 'ok');
  }));
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
    R.reportFps?.(fps);
  }
  const dt = Math.min(raw, 0.1);

  if (perfAuditVisible && (perfT += raw) > 0.25) {
    perfT = 0;
    updatePerfAuditPanel(raw);
  }

  syncOnlineNow(dt);

  if (playing && !paused) {
    if (malibuHeroModel) malibuHeroModel.group.visible = false;
    if (malibuHeadlight) malibuHeadlight.intensity = 0;
    model.group.visible = !insideClub;
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
    sky.update(hour, focusGroup.position, R.preset.shadows, dt);
    if (Math.abs(sky.night - lastNightVal) > 0.004) {
      lastNightVal = sky.night;
      for (const { mat, base, day = 0 } of nightMats) mat.emissiveIntensity = day + (base - day) * sky.night;
      waterMat.emissiveIntensity = 0.3 + sky.night;
    }
    updateProps(t, sky.night, heroX, heroZ, 1000);
    updateCitySectors(heroX, heroZ, 1000);
    updateLandmarks(heroX, heroZ);
    traffic.setNight(sky.night);
    traffic.update(dt, t, { x: heroX, z: heroZ }, peds);
    peds.update(dt, t, { x: heroX, z: heroZ });
    for (const f of animated) f(t);
    menuCamera(camera, { x: heroX, z: heroZ, heading: heroH }, t, dt);
  }

  if (playing) {
    if ((speedoT += dt) > 0.033) { speedoT = 0; drawSpeedo(player.kmh, vehicle.cfg.maxSpeed, vehicle.rpm); }
    if ((hudT += dt) > 0.1) { hudT = 0; updateHud(vehicle, hour, waypoint, fps); }
    if ((mapT += dt) > 0.1) { mapT = 0; drawMinimap($('minimap'), player, mapExtra()); }
    if ((peerHudT += dt) > 0.35) { peerHudT = 0; updateOnlinePeersHud(); }
    if (!paused && !insideClub && (posSaveTimer += dt) > 2.0) {
      posSaveTimer = 0;
      state.pos = { x: Math.round(vehicle.x), z: Math.round(vehicle.z), h: vehicle.heading };
      save();
    }
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
  else if (playing && !insideClub) engineStart();
}

function returnToLobby() {
  if (insideClub) {
    insideClub = false;
    kokobango?.setInside(false);
    kokobango?.music.setVolume(0);
    playerChar?.hide();
    setClubPrompt('');
  }
  engineOff();
  remoteAudio.disposeAll();
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
  Object.assign(s.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 80, far: 520 });
  s.bias = -0.0004;
  s.normalBias = 0.6;
  await progress(30, "Toshkent binolari va ko'chalari qurilmoqda...");
  buildCity(scene, q);
  await progress(55, 'Chiroqlar, svetoforlar, daraxtlar...');
  buildProps(scene, q);
  await progress(70, 'Teleminora, Chorsu, Toshkent Siti...');
  buildLandmarks(scene);
  kokobango = buildKokobangoClub(scene);
  playerChar = new PlayerCharacter(scene, state.look?.color || '#00e5ff');
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
        toast(dr.text || dr.reason || 'Depozit poyga bekor qilindi, garov qaytarildi', 'err');
      } else if (dr.action === 'finished') {
        pendingDepositInvite = null;
        activeDepositRace = null;
        if (dr.winnerId === myId) {
          bumpStat('raceWins', 1);
          beep('cash');
          toast(`🏆 G'ALABA! +${fmt(dr.totalPrize)} yutib oldingiz!`, 'cash');
        } else {
          toast(dr.text || `🏁 ${dr.winnerName} poygada g'olib bo'ldi!`, 'ok');
        }
      }
    }
    if (ev.join) {
      toast(`🟢 ${ev.join} serverga qo'shildi`, 'ok');
    } else if (ev.leave) {
      toast(`⚪ ${ev.leave} serverdan chiqdi`, 'warn');
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
  const claimRes = await claimUsernameServer(name);
  if (!claimRes.ok) {
    beep('err');
    toast(claimRes.error || `❌ «${name}» nomi allaqachon band! Boshqa ism tanlang.`, 'err');
    $('nameInput')?.focus();
    $('nameInput')?.select?.();
    return;
  }
  name = claimRes.name || name;
  $('nameInput').value = name;
  try {
    document.activeElement?.blur?.();
    window.focus?.();
  } catch { /* */ }
  try {
    screen.orientation?.lock?.('landscape').catch(() => {});
  } catch { /* */ }
  R.resize();
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
  engineStart();
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
if (localStorage.getItem('tt_landscape_dismissed') === '1') {
  window.__forceLandscapeRot = true;
  window.__hideRotateHint = true;
}
if ($('autoLandscapeBtn')) {
  $('autoLandscapeBtn').onclick = () => {
    try { localStorage.setItem('tt_landscape_dismissed', '1'); } catch {}
    window.__triggerAutoLandscape?.();
    toast("⛶ Gorizontal to'liq ekran rejimi yoqildi!", 'ok');
  };
}
if ($('forceLandscapeBtn')) {
  $('forceLandscapeBtn').onclick = () => {
    try { localStorage.setItem('tt_landscape_dismissed', '1'); } catch {}
    window.__triggerAutoLandscape?.();
    toast("⛶ Gorizontal to'liq ekran rejimi yoqildi!", 'ok');
  };
}
if ($('closeRotateHint')) {
  $('closeRotateHint').onclick = () => {
    try { localStorage.setItem('tt_landscape_dismissed', '1'); } catch {}
    window.__hideRotateHint = true;
    const rHint = $('rotateHint');
    if (rHint) rHint.style.display = 'none';
  };
}
$('nameInput').addEventListener('change', async () => {
  const v = $('nameInput').value.trim();
  if (!v) return;
  const res = await claimUsernameServer(v);
  if (!res.ok) {
    beep('err');
    toast(res.error || `❌ «${v}» nomi band! Boshqa ism tanlang.`, 'err');
    $('nameInput').focus();
  }
});
$('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') play(false); });
document.addEventListener('visibilitychange', () => { suspend(document.hidden); if (document.hidden) save(true); });
addEventListener('beforeunload', () => save(true));

boot().catch((e) => {
  console.error(e);
  $('loadText').textContent = 'Xatolik: ' + e.message + ". Brauzer WebGL ni qo'llab-quvvatlashini va internet ulanishini tekshiring.";
});
