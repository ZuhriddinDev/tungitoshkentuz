// O'yinchi holati, iqtisodiyot va saqlash (localStorage + ixtiyoriy bulut)
import { START_MONEY, CARS, carById, DAILY_BONUS, fmt } from './config.js';

const KEY = 'tungi-toshkent-save-v3';
try { localStorage.removeItem('tungi-toshkent-save-v1'); localStorage.removeItem('tungi-toshkent-save-v2'); } catch (e) {}
const listeners = new Set();

const DAILY_TASKS = [
  { id: 'drive5', name: '5 km yo\'l yuring', goal: 5, reward: 3_000_000, stat: 'km' },
  { id: 'deliver2', name: '2 ta yetkazib berish', goal: 2, reward: 6_000_000, stat: 'deliveries' },
  { id: 'race1', name: '1 ta poygada g\'alaba', goal: 1, reward: 10_000_000, stat: 'raceWins' },
  { id: 'taxi2', name: '2 ta taksi buyurtmasi', goal: 2, reward: 5_000_000, stat: 'taxi' },
  { id: 'drift', name: 'Driftda 3000 ochko', goal: 3000, reward: 7_000_000, stat: 'driftBest' },
];

function newCar(id, color = '#f5f5f5') {
  const c = carById(id);
  return { uid: Math.random().toString(36).slice(2, 10), id, color, rims: 'std', spoiler: 'none', neon: 'none', engine: 0, fuelL: c.tank * 0.6, fuelType: c.fuel, damage: 0 };
}

function fresh() {
  const first = newCar('gentra', '#f5f5f5');
  return {
    playerId: 'p_' + Math.random().toString(36).slice(2, 12),
    name: '', money: START_MONEY, cars: [first], activeUid: first.uid,
    rental: null, // { car, until (Date.now() millisoniya) }
    totalKm: 0, kmBonusPaid: 0, lastDaily: 0,
    stats: { km: 0, deliveries: 0, raceWins: 0, taxi: 0, driftBest: 0 },
    daily: { day: '', done: [] },
    tx: [],
    settings: {
      volume: 0.6,
      quality: 'high',
      sens: 1,
      control: 'auto',
      steerType: 'wheel', // 'wheel' (Aylanuvchi rul) | 'buttons' (Chap-O'ng tugmalar)
      touchScale: 'normal', // 'normal' | 'large'
      smoke: true,
    },
    charConfig: {
      preset: 'temur',
      outfit: 'bomber',
      color: '#12141c',
      hair: 'classic',
      hairColor: '#181311',
      glasses: 'dark',
      accessory: 'watch',
    },
    mapVer: 2,
    gfxVer: 2,
    pos: null,
  };
}

export const state = load();

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.cars?.length) {
      const validIds = new Set(CARS.map((c) => c.id));
      const migrated = s.cars.filter((c) => validIds.has(c.id));
      if (!migrated.length) migrated.push(newCar('gentra', '#f5f5f5'));
      s.cars = migrated;
      if (!s.cars.some((c) => c.uid === s.activeUid)) s.activeUid = s.cars[0].uid;
      if (s.rental && !validIds.has(s.rental.car?.id)) s.rental = null;
      if (s.mapVer !== 2) { s.pos = null; s.mapVer = 2; }
      if (s.gfxVer !== 2) {
        if (s.settings && s.settings.quality === 'low') s.settings.quality = 'high';
        s.gfxVer = 2;
      }
      return {
        ...fresh(),
        ...s,
        settings: { ...fresh().settings, ...s.settings },
        charConfig: { ...fresh().charConfig, ...(s.charConfig || {}) },
      };
    }
  } catch (e) { /* buzilgan saqlov */ }
  return fresh();
}

let saveTimer = 0;
const doSave = () => { saveTimer = 0; try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* xotira to'la */ } };
export function save(now = false) {
  if (now) { clearTimeout(saveTimer); doSave(); return; }
  if (!saveTimer) saveTimer = setTimeout(doSave, 1000);
}

export function onChange(fn) { listeners.add(fn); }
function emit() { listeners.forEach((f) => f(state)); save(); }

export function activeCar() {
  if (state.rental) return state.rental.car;
  return state.cars.find((c) => c.uid === state.activeUid) || state.cars[0];
}

// Barcha moliyaviy operatsiyalar shu yerdan o'tadi va jurnalga yoziladi
export function addMoney(amount, reason) {
  state.money += amount;
  state.tx.unshift({ t: Date.now(), amount, reason });
  if (state.tx.length > 200) state.tx.length = 200;
  emit();
  return true;
}
export function spend(amount, reason) {
  if (state.money < amount) return false;
  return addMoney(-amount, reason);
}

export function buyCar(id, color) {
  const c = carById(id);
  if (!spend(c.price, `Sotib olindi: ${c.name}`)) return null;
  const car = newCar(id, color);
  car.fuelL = c.tank;
  state.cars.push(car);
  state.activeUid = car.uid;
  emit();
  return car;
}

export function sellCar(uid) {
  if (state.cars.length <= 1) return false;
  const car = state.cars.find((c) => c.uid === uid);
  const price = Math.round(carById(car.id).price * 0.65 * (1 - car.damage / 200));
  state.cars = state.cars.filter((c) => c.uid !== uid);
  if (state.activeUid === uid) state.activeUid = state.cars[0].uid;
  addMoney(price, `Sotildi: ${carById(car.id).name}`);
  return price;
}

export function setName(n) { state.name = n.slice(0, 18); emit(); }
export function touch() { emit(); }

export function today() { return new Date().toISOString().slice(0, 10); }
export function dailyTasks() {
  if (state.daily.day !== today()) { state.daily = { day: today(), done: [] }; state.stats = { km: 0, deliveries: 0, raceWins: 0, taxi: 0, driftBest: 0 }; save(); }
  return DAILY_TASKS.map((t) => ({ ...t, progress: Math.min(state.stats[t.stat], t.goal), done: state.daily.done.includes(t.id) }));
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

export function canClaimDaily() { return Date.now() - state.lastDaily > 20 * 3600 * 1000; }
export function claimDaily() {
  if (!canClaimDaily()) return false;
  state.lastDaily = Date.now();
  addMoney(DAILY_BONUS, 'Kunlik bonus');
  return true;
}

export function resetSave() { localStorage.removeItem(KEY); location.reload(); }
export { fmt, newCar };

