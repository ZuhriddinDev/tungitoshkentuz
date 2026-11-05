// Garaj (o'z mashinalari, tuning, sotish) va avtosalon (sotib olish) — 3D namoyish bilan
import { CARS, COLORS, TUNING, carById, fmt } from './config.js';
import { state, buyCar, sellCar, spend, touch } from './state.js';
import { showCar } from './garage3d.js';
import { beep } from './audio.js';

let ui, tab = 'mine', selUid = null, shopId = 'gentra', shopColor = COLORS[0];

export function openGarage(api) { ui = api; render(); }

const statsHtml = (c) => `<div class="stats">
  <span>Maks. tezlik: <b>${c.maxSpeed} km/s</b></span><span>0–100: <b>${(27.8 / c.accel).toFixed(1)} s</b></span>
  <span>Sarf: <b>${c.fuelUse} l/100km</b></span><span>Bak: <b>${c.tank} l · ${c.fuel}</b></span></div>`;

function render() {
  const body = ui.showModal('garage', '🚗 Garaj va avtosalon', `
    <div class="tabs"><button data-tab="mine" class="${tab === 'mine' ? 'on' : ''}">Mening garajim (${state.cars.length})</button><button data-tab="shop" class="${tab === 'shop' ? 'on' : ''}">Avtosalon</button></div>
    <div class="garage"><div><canvas id="gcv"></canvas><p style="color:var(--muted);font-size:12px;margin-top:6px">Sichqoncha bilan aylantiring</p></div><div id="gside"></div></div>
    <div class="section-title">${tab === 'mine' ? 'Mashinalaringiz' : 'Sotuvdagi mashinalar'}</div><div class="grid" id="glist"></div>`);
  body.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; render(); }));
  tab === 'mine' ? mine(body) : shop(body);
}

function mine(body) {
  if (!state.cars.some((c) => c.uid === selUid)) selUid = state.activeUid;
  const inst = state.cars.find((c) => c.uid === selUid), cfg = carById(inst.id);
  const preview = showCar(body.querySelector('#gcv'), cfg, inst);
  body.querySelector('#glist').innerHTML = state.cars.map((c) => { const k = carById(c.id); return `
    <button class="card ${c.uid === selUid ? 'sel' : ''}" data-uid="${c.uid}" style="text-align:left"><h3><span class="swatch" style="display:inline-block;width:14px;height:14px;background:${c.color};vertical-align:middle"></span> ${k.name}</h3>
    <p>${c.uid === state.activeUid && !state.rental ? '🟢 Hozir haydalmoqda' : 'Garajda'} · holat ${Math.round(100 - c.damage)}%</p></button>`; }).join('');
  body.querySelectorAll('[data-uid]').forEach((b) => (b.onclick = () => { selUid = b.dataset.uid; render(); }));

  const sellPrice = Math.round(cfg.price * 0.65 * (1 - inst.damage / 200));
  const side = body.querySelector('#gside');
  side.innerHTML = `<h3 style="font-size:20px">${cfg.name}</h3>${statsHtml(cfg)}
    <div class="section-title">Rang · ${fmt(2_000_000)}</div><div class="swatches">${COLORS.map((c) => `<button class="swatch ${c === inst.color ? 'on' : ''}" data-color="${c}" style="background:${c}"></button>`).join('')}</div>
    ${Object.entries(TUNING).map(([key, t]) => `<div class="section-title">${t.name}</div><div class="opts">${t.options.map((o) => `<button data-tune="${key}" data-val="${o.id}" class="${String(inst[key]) === String(o.id) ? 'on' : ''}">${o.name}${o.price ? ' · ' + (o.price / 1e6) + ' mln' : ''}</button>`).join('')}</div>`).join('')}
    <div class="row" style="margin-top:10px"><button class="btn primary" id="drive" ${inst.uid === state.activeUid && !state.rental ? 'disabled' : ''}>🚗 Haydash</button>
    <button class="btn danger" id="sell" ${state.cars.length < 2 ? 'disabled' : ''}>Sotish · ${fmt(sellPrice)}</button></div>`;

  side.querySelectorAll('[data-color]').forEach((b) => (b.onclick = () => {
    if (b.dataset.color === inst.color) return;
    if (!spend(2_000_000, `Bo'yash: ${cfg.name}`)) return ui.toast("Mablag' yetarli emas", 'err');
    inst.color = b.dataset.color; touch(); beep('cash'); applied(); render();
  }));
  side.querySelectorAll('[data-tune]').forEach((b) => (b.onclick = () => {
    const key = b.dataset.tune, opt = TUNING[key].options.find((o) => String(o.id) === b.dataset.val);
    if (String(inst[key]) === String(opt.id)) return;
    if (opt.price && !spend(opt.price, `Tuning (${TUNING[key].name}): ${opt.name}`)) return ui.toast("Mablag' yetarli emas", 'err');
    inst[key] = opt.id; touch(); beep('cash'); preview.setTuning(inst); applied(); render();
  }));
  side.querySelector('#drive').onclick = () => {
    if (state.rental) ui.game.endRental(true);
    state.activeUid = inst.uid; touch(); ui.game.changeCar(); ui.toast(`${cfg.name} tanlandi`, 'ok'); ui.closeModal();
  };
  side.querySelector('#sell').onclick = () => {
    if (!confirm(`${cfg.name} ni ${fmt(sellPrice)} ga sotasizmi?`)) return;
    const wasActive = inst.uid === state.activeUid, p = sellCar(inst.uid);
    if (p) { beep('cash'); ui.toast(`Sotildi: +${fmt(p)}`, 'cash'); if (wasActive) ui.game.changeCar(); selUid = null; render(); }
  };
  function applied() { if (inst.uid === state.activeUid && !state.rental) ui.game.changeCar(true); }
}

function shop(body) {
  const cfg = carById(shopId);
  showCar(body.querySelector('#gcv'), cfg, { color: shopColor });
  body.querySelector('#glist').innerHTML = CARS.map((c) => `
    <button class="card ${c.id === shopId ? 'sel' : ''}" data-id="${c.id}" style="text-align:left"><h3>${c.name}</h3>
    <p class="price">${fmt(c.price)}</p><p>${state.cars.filter((x) => x.id === c.id).length ? '✔ Garajingizda bor' : ''}</p></button>`).join('');
  body.querySelectorAll('[data-id]').forEach((b) => (b.onclick = () => { shopId = b.dataset.id; render(); }));
  body.querySelector('#gside').innerHTML = `<h3 style="font-size:20px">${cfg.name}</h3>${statsHtml(cfg)}
    <div class="section-title">Rangni tanlang</div><div class="swatches">${COLORS.map((c) => `<button class="swatch ${c === shopColor ? 'on' : ''}" data-color="${c}" style="background:${c}"></button>`).join('')}</div>
    <p class="price" style="font-size:24px;margin:16px 0 4px;color:var(--gold);font-weight:900">${fmt(cfg.price)}</p>
    <p style="color:var(--muted);font-size:13px;margin-bottom:10px">Balans: ${fmt(state.money)}</p>
    <button class="btn gold big" id="buy" ${state.money < cfg.price ? 'disabled' : ''}>Sotib olish</button>`;
  body.querySelectorAll('#gside [data-color]').forEach((b) => (b.onclick = () => { shopColor = b.dataset.color; render(); }));
  body.querySelector('#buy').onclick = async () => {
    const car = buyCar(shopId, shopColor);
    if (!car) return ui.toast("Mablag' yetarli emas", 'err');
    if (state.rental) ui.game.endRental(true);
    beep('cash'); ui.toast(`Tabriklaymiz! ${cfg.name} sizniki`, 'cash');
    await ui.game.changeCar(); tab = 'mine'; selUid = car.uid; render();
  };
}

