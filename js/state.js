// O'yinchi holati, V9 iqtisodiyot, 7 kunlik bonus, promokod, P2P o'tkazma va saqlash
import { START_MONEY, CARS, carById, DAILY_BONUS, DAILY_REWARDS_7, fmt } from './config.js';

const KEY = 'tungi-toshkent-save-v3';
const IS_PHONE = typeof navigator !== 'undefined' && (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1);
try { localStorage.removeItem('tungi-toshkent-save-v1'); localStorage.removeItem('tungi-toshkent-save-v2'); } catch (e) {}
const listeners = new Set();

const DAILY_TASKS = [
  { id: 'drive5', name: '5 km yo\'l yuring', goal: 5, reward: 15_000_000, stat: 'km' },
  { id: 'deliver2', name: '2 ta yetkazib berish', goal: 2, reward: 25_000_000, stat: 'deliveries' },
  { id: 'race1', name: '1 ta poygada g\'alaba', goal: 1, reward: 40_000_000, stat: 'raceWins' },
  { id: 'taxi2', name: '2 ta taksi buyurtmasi', goal: 2, reward: 20_000_000, stat: 'taxi' },
  { id: 'drift', name: 'Driftda 3000 ochko', goal: 3000, reward: 30_000_000, stat: 'driftBest' },
];

export function newCar(id, color = null) {
  const c = carById(id);
  return {
    uid: Math.random().toString(36).slice(2, 10),
    id: c.id,
    color: color || c.defaultColor || '#f5f5f5',
    paintType: 'metallic',
    rims: 'std',
    rimColor: '',
    spoiler: 'none',
    bodykit: 'std',
    tint: 'none',
    headlightColor: '#fff3d0',
    neon: 'none',
    engine: 0,
    turbo: 0,
    accelTune: 0,
    brakeTune: 0,
    handlingTune: 0,
    fuelL: c.tank * 0.85,
    fuelType: c.fuel,
    damage: 0,
  };
}

function normalizeCar(carObj) {
  const c = carById(carObj?.id || 'gentra');
  return {
    uid: carObj?.uid || Math.random().toString(36).slice(2, 10),
    id: c.id,
    color: carObj?.color || c.defaultColor || '#f5f5f5',
    paintType: carObj?.paintType || 'metallic',
    rims: carObj?.rims || 'std',
    rimColor: carObj?.rimColor || '',
    spoiler: carObj?.spoiler || 'none',
    bodykit: carObj?.bodykit || 'std',
    tint: carObj?.tint || 'none',
    headlightColor: carObj?.headlightColor || '#fff3d0',
    neon: carObj?.neon || 'none',
    engine: Number(carObj?.engine) || 0,
    turbo: Number(carObj?.turbo) || 0,
    accelTune: Number(carObj?.accelTune) || 0,
    brakeTune: Number(carObj?.brakeTune) || 0,
    handlingTune: Number(carObj?.handlingTune) || 0,
    fuelL: Number.isFinite(carObj?.fuelL) ? carObj.fuelL : c.tank * 0.85,
    fuelType: carObj?.fuelType || c.fuel,
    damage: 0,
  };
}

function getOrMakePlayerId() {
  try {
    let pid = localStorage.getItem('tt_online_pid_v1');
    if (!pid) {
      pid = Math.random().toString(36).slice(2, 8).toUpperCase();
      localStorage.setItem('tt_online_pid_v1', pid);
    }
    return pid.toUpperCase().replace(/^TT-/, '').replace(/[^A-Z0-9_]/g, '').slice(0, 16);
  } catch {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }
}

function getOrMakeSecret() {
  try {
    let sec = localStorage.getItem('tt_econ_sec_v9');
    if (!sec) {
      sec = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      localStorage.setItem('tt_econ_sec_v9', sec);
    }
    return sec;
  } catch {
    return 'sec_' + Math.random().toString(36).slice(2);
  }
}

function fresh() {
  const first = newCar('malibu', '#12151f');
  const second = newCar('gentra', '#f5f5f5');
  return {
    playerId: getOrMakePlayerId(),
    secret: getOrMakeSecret(),
    name: '',
    money: START_MONEY, // 5 000 000 000 so'm
    econVer: 9,
    cars: [first, second],
    activeUid: first.uid,
    rental: null,
    totalKm: 0,
    kmBonusPaid: 0,
    lastDaily: 0,
    daily7: {
      streak: 0,
      lastClaimDay: '',
      lastClaimTs: 0,
    },
    usedPromos: [],
    transfers: [],
    stats: { km: 0, deliveries: 0, raceWins: 0, taxi: 0, driftBest: 0 },
    daily: { day: '', done: [] },
    tx: [],
    settings: {
      volume: 0.65,
      musicVolume: 0.45,
      quality: IS_PHONE ? 'medium' : 'high',
      sens: 1.0,
      steerSens: 1.0,
      control: 'buttons',
      steerType: 'buttons', // V9: Mobil versiyada rul olib tashlandi, faqat tugmali boshqaruv
      touchScale: 'normal',
      smoke: true,
      showFps: false,
      showHud: true,
      lang: 'uz',
    },
    mapVer: 2,
    gfxVer: 4,
    pos: null,
  };
}

// Ichki himoyalangan balans (DevTools orqali state.money = 999999999999 qilishdan himoya)
let _authoritativeMoney = START_MONEY;

export const state = load();

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.cars?.length) {
      const validIds = new Set(CARS.map((c) => c.id));
      const migrated = s.cars.filter((c) => validIds.has(c.id)).map(normalizeCar);
      if (!migrated.length) migrated.push(newCar('malibu', '#12151f'));
      s.cars = migrated;
      if (!s.cars.some((c) => c.uid === s.activeUid)) s.activeUid = s.cars[0].uid;
      if (s.rental && !validIds.has(s.rental.car?.id)) s.rental = null;
      if (s.mapVer !== 2) { s.pos = null; s.mapVer = 2; }

      // V9 Iqtisodiyot yangilanishi: barcha foydalanuvchilarga kamida 5 000 000 000 so'm!
      if ((s.econVer || 0) < 9) {
        s.money = Math.max(Number(s.money) || 0, START_MONEY);
        s.econVer = 9;
      }

      const base = fresh();
      const merged = {
        ...base,
        ...s,
        playerId: getOrMakePlayerId(),
        secret: s.secret || getOrMakeSecret(),
        daily7: { ...base.daily7, ...(s.daily7 || {}) },
        usedPromos: Array.isArray(s.usedPromos) ? s.usedPromos : [],
        transfers: Array.isArray(s.transfers) ? s.transfers : [],
        settings: {
          ...base.settings,
          ...(s.settings || {}),
          steerType: 'buttons',
          control: 'buttons',
        },
      };
      _authoritativeMoney = Math.max(0, Number(merged.money) || START_MONEY);
      merged.money = _authoritativeMoney;
      return merged;
    }
  } catch (e) { /* buzilgan saqlov */ }
  const f = fresh();
  _authoritativeMoney = f.money;
  return f;
}

// state.money ni DevTools orqali sun'iy o'zgartirishdan himoyalash
try {
  Object.defineProperty(state, 'money', {
    get() { return _authoritativeMoney; },
    set(v) {
      // Faqat ichki funksiyalar _setMoneyInternal orqali o'zgartira oladi
      if (typeof v === 'number' && Number.isFinite(v) && window.__ttAllowMoneyWrite) {
        _authoritativeMoney = Math.max(0, Math.round(v));
      }
    },
    enumerable: true,
    configurable: true,
  });
} catch { /* fallback */ }

function setMoneyInternal(nextVal) {
  window.__ttAllowMoneyWrite = true;
  _authoritativeMoney = Math.max(0, Math.round(Number(nextVal) || 0));
  state.money = _authoritativeMoney;
  window.__ttAllowMoneyWrite = false;
}

let saveTimer = 0;
const doSave = () => {
  saveTimer = 0;
  try {
    const snapshot = { ...state, money: _authoritativeMoney };
    localStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch (e) { /* xotira to'la */ }
};
export function save(now = false) {
  if (now) { clearTimeout(saveTimer); doSave(); return; }
  if (!saveTimer) saveTimer = setTimeout(doSave, 800);
}

export function onChange(fn) { listeners.add(fn); }
function emit() {
  window.__steerSens = state.settings?.steerSens || 1.0;
  listeners.forEach((f) => f(state));
  save();
}

export function activeCar() {
  if (state.rental) return state.rental.car;
  return state.cars.find((c) => c.uid === state.activeUid) || state.cars[0];
}

export function hasCarId(carId) {
  return state.cars.some((c) => c.id === carId);
}

export function grantGiftCar(carId, color = null, makeActive = true) {
  const c = carById(carId);
  if (!c) return null;
  let existing = state.cars.find((car) => car.id === c.id);
  if (!existing) {
    existing = newCar(c.id, color || c.defaultColor);
    existing.fuelL = c.tank;
    state.cars.push(existing);
  }
  if (makeActive) state.activeUid = existing.uid;
  emit();
  return existing;
}

// Barcha moliyaviy operatsiyalar shu yerdan o'tadi va server bilan sinxronlanadi
export function addMoney(amount, reason = '') {
  const delta = Math.round(Number(amount) || 0);
  if (!Number.isFinite(delta) || delta === 0) return true;
  setMoneyInternal(_authoritativeMoney + delta);
  state.tx.unshift({ t: Date.now(), amount: delta, reason });
  if (state.tx.length > 200) state.tx.length = 200;
  emit();
  const opId = `op_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  syncEconomyWithServer({ delta, opId, reason }).catch(() => {});
  return true;
}

export function spend(amount, reason = '') {
  const cost = Math.round(Number(amount) || 0);
  if (cost <= 0) return true;
  if (_authoritativeMoney < cost) return false;
  return addMoney(-cost, reason);
}

export function buyCar(id, color) {
  const c = carById(id);
  if (!spend(c.price, `Sotib olindi: ${c.name}`)) return null;
  const car = newCar(id, color);
  car.fuelL = c.tank;
  state.cars.push(car);
  state.activeUid = car.uid;
  emit();
  syncEconomyWithServer().catch(() => {});
  return car;
}

export function sellCar(uid) {
  if (state.cars.length <= 1) return false;
  const car = state.cars.find((c) => c.uid === uid);
  if (!car) return false;
  const price = Math.round(carById(car.id).price * 0.65);
  state.cars = state.cars.filter((c) => c.uid !== uid);
  if (state.activeUid === uid) state.activeUid = state.cars[0].uid;
  addMoney(price, `Sotildi: ${carById(car.id).name}`);
  return price;
}

export function setName(n) {
  state.name = String(n || '').trim().slice(0, 18);
  emit();
  syncEconomyWithServer().catch(() => {});
}

export async function claimUsernameServer(rawName) {
  const clean = String(rawName || '').replace(/\s+/g, ' ').trim().slice(0, 18);
  if (!clean || clean.toLowerCase() === 'haydovchi') {
    state.name = 'Haydovchi';
    emit();
    return { ok: true, name: 'Haydovchi' };
  }
  if (clean.length < 2) {
    return { ok: false, taken: false, error: "Ism kamida 2 ta belgidan iborat bo'lishi kerak!" };
  }
  try {
    const res = await fetch('/api/economy/set-name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: state.playerId,
        name: clean,
        secret: state.secret,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        taken: !!data.taken,
        error: data.error || `❌ «${clean}» nomi allaqachon band! Boshqa ism tanlang.`,
      };
    }
    state.name = data.name || clean;
    emit();
    return { ok: true, name: state.name };
  } catch {
    // Offline fallback
    state.name = clean;
    emit();
    return { ok: true, name: clean };
  }
}

export function touch() { emit(); }

export function today() {
  const d = new Date(Date.now() + 5 * 3600_000);
  return d.toISOString().slice(0, 10);
}

export function dailyTasks() {
  if (state.daily.day !== today()) {
    state.daily = { day: today(), done: [] };
    state.stats = { km: 0, deliveries: 0, raceWins: 0, taxi: 0, driftBest: 0 };
    save();
  }
  return DAILY_TASKS.map((t) => ({
    ...t,
    progress: Math.min(state.stats[t.stat], t.goal),
    done: state.daily.done.includes(t.id),
  }));
}

export function bumpStat(stat, v = 1, max = false) {
  dailyTasks();
  state.stats[stat] = max ? Math.max(state.stats[stat], v) : state.stats[stat] + v;
  const done = [];
  for (const t of DAILY_TASKS) {
    if (!state.daily.done.includes(t.id) && state.stats[t.stat] >= t.goal) {
      state.daily.done.push(t.id);
      addMoney(t.reward, `Kundalik topshiriq: ${t.name}`);
      done.push(t);
    }
  }
  save();
  return done;
}

// ============================================================================
// 7 KUNLIK KUNDALIK BONUS TIZIMI
// ============================================================================
export function canClaimDaily() {
  const todayKey = today();
  return state.daily7?.lastClaimDay !== todayKey;
}

export function getDaily7Status() {
  const todayKey = today();
  const streak = Number(state.daily7?.streak) || 0;
  const canClaim = state.daily7?.lastClaimDay !== todayKey;
  const activeDay = canClaim ? ((streak % 7) + 1) : (streak || 1);
  return {
    streak,
    canClaim,
    activeDay,
    lastClaimDay: state.daily7?.lastClaimDay || '',
    rewards: DAILY_REWARDS_7,
  };
}

export async function claimDaily7() {
  try {
    const res = await fetch('/api/economy/daily-claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: state.playerId,
        name: state.name || 'Haydovchi',
        secret: state.secret,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || 'Bonusni olishda xatolik' };
    }
    if (Number.isFinite(data.money)) setMoneyInternal(data.money);
    if (data.daily) {
      state.daily7 = {
        streak: data.daily.streak || state.daily7.streak,
        lastClaimDay: data.daily.lastClaimDay || today(),
        lastClaimTs: Date.now(),
      };
    }
    state.lastDaily = Date.now();
    if (data.reward?.car) {
      grantGiftCar(data.reward.car, null, true);
    }
    state.tx.unshift({
      t: Date.now(),
      amount: data.reward?.money || 0,
      reason: `7-Kunlik Bonus (${data.claimedDay}-kun): ${data.reward?.title || ''}`,
    });
    emit();
    return {
      ok: true,
      claimedDay: data.claimedDay,
      reward: data.reward,
    };
  } catch {
    // Offline fallback
    if (!canClaimDaily()) {
      return { ok: false, error: 'Bugungi kundalik bonus allaqachon olingan!' };
    }
    const nextDay = ((state.daily7?.streak || 0) % 7) + 1;
    const reward = DAILY_REWARDS_7[nextDay - 1] || DAILY_REWARDS_7[0];
    state.daily7 = {
      streak: nextDay,
      lastClaimDay: today(),
      lastClaimTs: Date.now(),
    };
    state.lastDaily = Date.now();
    if (reward.money > 0) {
      setMoneyInternal(_authoritativeMoney + reward.money);
    }
    if (reward.car) {
      grantGiftCar(reward.car, null, true);
    }
    state.tx.unshift({
      t: Date.now(),
      amount: reward.money || 0,
      reason: `7-Kunlik Bonus (${nextDay}-kun): ${reward.title}`,
    });
    emit();
    return {
      ok: true,
      claimedDay: nextDay,
      reward,
    };
  }
}

export function claimDaily() {
  return claimDaily7();
}

// ============================================================================
// SERVER BILAN SINXRONIZATSIYA, PUL O'TKAZISH VA PROMOKOD API
// ============================================================================
export async function syncEconomyWithServer(extra = {}) {
  try {
    const res = await fetch('/api/economy/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: state.playerId,
        name: state.name || 'Haydovchi',
        secret: state.secret,
        cars: state.cars.map((c) => c.id),
        ...extra,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.ok) {
      if (Number.isFinite(data.money)) {
        // Agar lokal balans 5 mlrd bo'lsa va serverdan kelgan balans aniq bo'lsa
        setMoneyInternal(data.money);
      }
      if (data.nameTaken && data.name) {
        state.name = data.name;
      }
      if (data.daily) {
        state.daily7 = {
          streak: data.daily.streak ?? state.daily7.streak,
          lastClaimDay: data.daily.lastClaimDay || state.daily7.lastClaimDay,
          lastClaimTs: data.daily.lastClaimTs || state.daily7.lastClaimTs,
        };
      }
      if (Array.isArray(data.usedPromos)) state.usedPromos = data.usedPromos;
      if (Array.isArray(data.transfers)) state.transfers = data.transfers;
      if (Array.isArray(data.cars)) {
        for (const cid of data.cars) {
          if (!hasCarId(cid) && CARS.some((x) => x.id === cid)) {
            state.cars.push(newCar(cid));
          }
        }
      }
      emit();
    }
    return data;
  } catch {
    return null;
  }
}

export async function lookupPlayerServer(query) {
  try {
    const res = await fetch('/api/economy/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || "O'yinchi topilmadi" };
    }
    return data;
  } catch {
    return { ok: false, error: "Server bilan aloqa yo'q" };
  }
}

export async function transferMoneyServer({ toQuery, amount, note = '' }) {
  const clientTxId = `ctx_${state.playerId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  try {
    const res = await fetch('/api/economy/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromId: state.playerId,
        fromName: state.name || 'Haydovchi',
        secret: state.secret,
        toQuery,
        amount: Math.floor(Number(amount) || 0),
        note,
        clientTxId,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || "Pul o'tkazishda xatolik yuz berdi" };
    }
    if (Number.isFinite(data.money)) setMoneyInternal(data.money);
    if (Array.isArray(data.transfers)) state.transfers = data.transfers;
    if (data.tx) {
      state.tx.unshift({
        t: data.tx.ts || Date.now(),
        amount: -data.tx.amount,
        reason: `O'tkazma → ${data.tx.toName} (TT-${data.tx.toId}) [${data.tx.txId}]`,
      });
    }
    emit();
    return data;
  } catch {
    return { ok: false, error: "Server bilan aloqa yo'q. Internetni tekshiring." };
  }
}

export function applyServerTransferPush(msg) {
  if (!msg) return;
  if (Number.isFinite(msg.money)) {
    setMoneyInternal(msg.money);
  }
  if (Array.isArray(msg.transfers)) {
    state.transfers = msg.transfers;
  }
  if (msg.tx) {
    state.tx.unshift({
      t: msg.tx.ts || Date.now(),
      amount: msg.tx.amount,
      reason: `O'tkazma qabul qilindi ← ${msg.tx.fromName} (TT-${msg.tx.fromId})`,
    });
  } else if (msg.kind === 'race_won' && msg.amount) {
    state.tx.unshift({
      t: Date.now(),
      amount: msg.amount,
      reason: `Deposit Race g'alabasi (+${fmt(msg.amount)})`,
    });
  } else if (msg.kind === 'deposit_race_escrow' && msg.delta) {
    state.tx.unshift({
      t: Date.now(),
      amount: msg.delta,
      reason: msg.text || 'Depozit poyga garovi band qilindi',
    });
  } else if (msg.kind === 'deposit_race_refund' && msg.refund) {
    state.tx.unshift({
      t: Date.now(),
      amount: msg.refund,
      reason: msg.reason || `Depozit poyga garovi qaytarildi (+${fmt(msg.refund)})`,
    });
  }
  emit();
}

export async function redeemPromocodeServer(code) {
  try {
    const res = await fetch('/api/economy/promocode/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: state.playerId,
        name: state.name || 'Haydovchi',
        secret: state.secret,
        code: String(code || '').trim().toUpperCase(),
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || "Promokodni faollashtirib bo'lmadi" };
    }
    if (Number.isFinite(data.money)) setMoneyInternal(data.money);
    if (Array.isArray(data.usedPromos)) state.usedPromos = data.usedPromos;
    if (data.reward?.car) {
      grantGiftCar(data.reward.car, null, true);
    }
    state.tx.unshift({
      t: Date.now(),
      amount: data.reward?.money || 0,
      reason: `Promokod (${data.code}): ${data.reward?.title || ''}`,
    });
    emit();
    return data;
  } catch {
    return { ok: false, error: "Server bilan aloqa yo'q" };
  }
}

export function resetSave() { localStorage.removeItem(KEY); location.reload(); }
export { fmt };
