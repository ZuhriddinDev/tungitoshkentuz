// Garaj (o'z mashinalari, V9 professional tuning, sotish) va Avtosalon — telefon va kompyuter uchun 3D interfeys
import { CARS, COLORS, RIM_COLOR_SWATCHES, TUNING, carById, fmt } from './config.js';
import { state, buyCar, sellCar, spend, touch } from './state.js';
import { showCar, rotateGarage } from './garage3d.js';
import { beep } from './audio.js';

let ui;
let rootBody = null;
let tab = 'mine';
let tuneCat = 'paint'; // 'paint' | 'rims' | 'aero' | 'tint' | 'lights' | 'power' | 'chassis'
let selUid = null;
let shopId = 'malibu';
let shopTier = 'all';
let shopColor = COLORS[0];
let preview = null;
let lastPreviewKey = '';

export function openGarage(api, initialTab = null) {
  ui = api;
  if (initialTab === 'shop' || initialTab === 'mine') tab = initialTab;
  lastPreviewKey = '';
  rootBody = ui.showModal('garage', '🚗 Garaj, Tuning va Avtosalon', `<div id="garageRoot" class="garage-wrap"></div>`);
  render();
}

function computeTunedStats(cfg, inst = {}) {
  const engBonus = TUNING.engine.options.find((o) => o.id === (inst.engine || 0))?.speedBonus || 0;
  const trbBonus = TUNING.turbo.options.find((o) => o.id === (inst.turbo || 0))?.speedBonus || 0;
  const accMult = TUNING.accelTune.options.find((o) => o.id === (inst.accelTune || 0))?.accelMult || 1;
  const brkMult = TUNING.brakeTune.options.find((o) => o.id === (inst.brakeTune || 0))?.brakeMult || 1;
  const hndMult = TUNING.handlingTune.options.find((o) => o.id === (inst.handlingTune || 0))?.gripMult || 1;

  const maxSpeed = Math.round(cfg.maxSpeed + engBonus + trbBonus);
  const effectiveAccel = cfg.accel * (1 + (engBonus + trbBonus) / 220) * accMult;
  const zeroToHundred = Math.max(1.8, 27.8 / effectiveAccel).toFixed(1);
  const brakeScore = Math.min(100, Math.round(68 * brkMult));
  const gripScore = Math.min(100, Math.round((cfg.grip || 0.88) * 82 * hndMult));

  return { maxSpeed, zeroToHundred, brakeScore, gripScore };
}

const statsPills = (cfg, inst = {}) => {
  const st = computeTunedStats(cfg, inst);
  return `
  <div class="g-stats">
    <span>⚡ <b>${st.maxSpeed}</b> km/h</span>
    <span>⏱ 0–100: <b>${st.zeroToHundred}s</b></span>
    <span>🛑 Tormoz: <b>${st.brakeScore}%</b></span>
    <span>🛞 Tutish: <b>${st.gripScore}%</b></span>
  </div>`;
};

function formatShortPrice(price) {
  if (price >= 1e9) return (price / 1e9).toFixed(price % 1e9 === 0 ? 0 : 2) + ' mlrd';
  return (price / 1e6).toFixed(0) + ' mln';
}

function render(keepPreview = false) {
  if (!rootBody) return;
  const wrap = rootBody.querySelector('#garageRoot');
  if (!wrap) return;

  if (tab === 'mine') {
    if (!state.cars.some((c) => c.uid === selUid)) selUid = state.activeUid;
    const idx = Math.max(0, state.cars.findIndex((c) => c.uid === selUid));
    const inst = state.cars[idx] || state.cars[0];
    const cfg = carById(inst.id);
    const sellPrice = Math.round(cfg.price * 0.65);
    const isDriving = inst.uid === state.activeUid && !state.rental;

    if (!keepPreview) {
      wrap.innerHTML = `
        <div class="g-topbar">
          <div class="tabs g-tabs">
            <button data-tab="mine" class="on">🚗 Garajim & Tuning (${state.cars.length})</button>
            <button data-tab="shop">🛒 Avtosalon (${CARS.length})</button>
          </div>
          <div class="g-bal">💰 <b id="gMoney">${fmt(state.money)}</b></div>
        </div>

        <div class="g-strip-wrap">
          <button class="g-nav" id="gPrev" title="Oldingi mashina">◀</button>
          <div class="g-strip" id="glist">
            ${state.cars.map((c) => {
              const k = carById(c.id);
              const act = c.uid === state.activeUid && !state.rental;
              return `<button class="g-chip ${c.uid === selUid ? 'sel' : ''}" data-uid="${c.uid}">
                <i class="g-dot" style="background:${c.color}"></i>
                <div>
                  <b>${k.name}</b>
                  <small>${act ? '🟢 Haydalmoqda' : (k.tier || 'Garajda')}</small>
                </div>
              </button>`;
            }).join('')}
          </div>
          <button class="g-nav" id="gNext" title="Keyingi mashina">▶</button>
        </div>

        <div class="garage-pro">
          <div class="garage-stage">
            <div class="g-canvas-box">
              <canvas id="gcv"></canvas>
              <div class="g-stage-head">
                <b>${cfg.name}</b>
                ${isDriving ? '<span class="g-tag">FAOL</span>' : `<span class="g-tag">${cfg.tier || 'Avto'}</span>`}
              </div>
              <div class="g-rot-btns">
                <button type="button" id="rotL" title="Chapga aylantirish">⟲</button>
                <span>360°</span>
                <button type="button" id="rotR" title="O'ngga aylantirish">⟳</button>
              </div>
            </div>
            <div id="gStatsWrap">${statsPills(cfg, inst)}</div>
            <div class="row g-actions">
              <button class="btn primary" id="drive" ${isDriving ? 'disabled' : ''}>${isDriving ? '✔ Hozir haydalmoqda' : '🚗 Shu mashinani haydash'}</button>
              <button class="btn danger" id="sell" ${state.cars.length < 2 ? 'disabled' : ''}>Sotish (${fmt(sellPrice)})</button>
            </div>
          </div>

          <div class="garage-tune" id="gside"></div>
        </div>`;

      const cv = wrap.querySelector('#gcv');
      preview = showCar(cv, cfg, inst);
      lastPreviewKey = `mine:${inst.uid}`;
    } else {
      const gm = wrap.querySelector('#gMoney');
      if (gm) gm.textContent = fmt(state.money);
      const sw = wrap.querySelector('#gStatsWrap');
      if (sw) sw.innerHTML = statsPills(cfg, inst);
    }

    renderTunePanel(wrap.querySelector('#gside'), cfg, inst);
    bindCommon(wrap);

    wrap.querySelectorAll('[data-uid]').forEach((b) => (b.onclick = () => {
      selUid = b.dataset.uid;
      beep('ok');
      render(false);
    }));
    wrap.querySelector('#gPrev').onclick = () => {
      const n = state.cars.length;
      selUid = state.cars[(idx - 1 + n) % n].uid;
      beep('ok');
      render(false);
    };
    wrap.querySelector('#gNext').onclick = () => {
      const n = state.cars.length;
      selUid = state.cars[(idx + 1) % n].uid;
      beep('ok');
      render(false);
    };
    wrap.querySelector('#drive').onclick = () => {
      if (state.rental) ui.game.endRental(true);
      state.activeUid = inst.uid;
      touch();
      ui.game.changeCar();
      ui.toast(`${cfg.name} tanlandi`, 'ok');
      ui.closeModal();
    };
    wrap.querySelector('#sell').onclick = () => {
      if (!confirm(`${cfg.name} ni ${fmt(sellPrice)} ga sotasizmi?`)) return;
      const wasActive = inst.uid === state.activeUid;
      const p = sellCar(inst.uid);
      if (p) {
        beep('cash');
        ui.toast(`Sotildi: +${fmt(p)}`, 'cash');
        if (wasActive) ui.game.changeCar();
        selUid = state.activeUid;
        render(false);
      }
    };
  } else {
    // AVTOSALON (SHOP)
    const tiers = ['all', "Boshlang'ich", "O'rta", 'Sport', 'Premium', 'Giperkar'];
    const filteredCars = shopTier === 'all' ? CARS : CARS.filter((c) => c.tier === shopTier);
    if (!filteredCars.some((c) => c.id === shopId)) {
      shopId = (filteredCars[0] || CARS[0]).id;
    }
    const idx = Math.max(0, filteredCars.findIndex((c) => c.id === shopId));
    const cfg = carById(shopId);
    const ownedCount = state.cars.filter((x) => x.id === cfg.id).length;

    if (!keepPreview || lastPreviewKey !== `shop:${cfg.id}:${shopTier}`) {
      wrap.innerHTML = `
        <div class="g-topbar">
          <div class="tabs g-tabs">
            <button data-tab="mine">🚗 Garajim & Tuning (${state.cars.length})</button>
            <button data-tab="shop" class="on">🛒 Avtosalon (${CARS.length})</button>
          </div>
          <div class="g-bal">💰 <b id="gMoney">${fmt(state.money)}</b></div>
        </div>

        <div class="g-cat-tabs" style="margin-bottom:6px">
          ${tiers.map((t) => `<button type="button" data-tier="${t}" class="${shopTier === t ? 'on' : ''}">${t === 'all' ? '🌟 Barchasi' : t}</button>`).join('')}
        </div>

        <div class="g-strip-wrap">
          <button class="g-nav" id="gPrev" title="Oldingi">◀</button>
          <div class="g-strip" id="glist">
            ${filteredCars.map((c) => {
              const has = state.cars.some((x) => x.id === c.id);
              return `<button class="g-chip ${c.id === shopId ? 'sel' : ''}" data-id="${c.id}">
                <div>
                  <b>${c.name}</b>
                  <small style="color:var(--gold)">${formatShortPrice(c.price)} ${has ? '· ✔ Bor' : ''}</small>
                </div>
              </button>`;
            }).join('')}
          </div>
          <button class="g-nav" id="gNext" title="Keyingi">▶</button>
        </div>

        <div class="garage-pro">
          <div class="garage-stage">
            <div class="g-canvas-box">
              <canvas id="gcv"></canvas>
              <div class="g-stage-head">
                <b>${cfg.name}</b>
                <span class="g-tag">${ownedCount ? `Garajda: ${ownedCount} ta` : (cfg.tier || 'Yangi')}</span>
              </div>
              <div class="g-rot-btns">
                <button type="button" id="rotL">⟲</button>
                <span>360°</span>
                <button type="button" id="rotR">⟳</button>
              </div>
            </div>
            ${statsPills(cfg)}
          </div>

          <div class="garage-tune" id="gside">
            <div class="section-title" style="margin-top:0">🎨 Kuzov rangini tanlang</div>
            <div class="swatches" id="shopSwatches">
              ${COLORS.map((c) => `<button class="swatch ${c === shopColor ? 'on' : ''}" data-color="${c}" style="background:${c}"></button>`).join('')}
            </div>
            <div class="g-price-box">
              <div>
                <small>${cfg.tier || 'Avtomobil'} narxi:</small>
                <strong class="price">${fmt(cfg.price)}</strong>
              </div>
              <button class="btn gold" id="buy" ${state.money < cfg.price ? 'disabled' : ''}>🛒 Sotib olish</button>
            </div>
          </div>
        </div>`;

      const cv = wrap.querySelector('#gcv');
      preview = showCar(cv, cfg, { color: shopColor });
      lastPreviewKey = `shop:${cfg.id}:${shopTier}`;
    }

    bindCommon(wrap);
    wrap.querySelectorAll('[data-tier]').forEach((b) => (b.onclick = () => {
      shopTier = b.dataset.tier;
      beep('ok');
      render(false);
    }));
    wrap.querySelectorAll('[data-id]').forEach((b) => (b.onclick = () => {
      shopId = b.dataset.id;
      beep('ok');
      render(false);
    }));
    wrap.querySelector('#gPrev').onclick = () => {
      const n = filteredCars.length;
      shopId = filteredCars[(idx - 1 + n) % n].id;
      beep('ok');
      render(false);
    };
    wrap.querySelector('#gNext').onclick = () => {
      const n = filteredCars.length;
      shopId = filteredCars[(idx + 1) % n].id;
      beep('ok');
      render(false);
    };
    wrap.querySelectorAll('#shopSwatches [data-color]').forEach((b) => (b.onclick = () => {
      shopColor = b.dataset.color;
      preview?.setColor(shopColor);
      wrap.querySelectorAll('#shopSwatches .swatch').forEach((s) => s.classList.toggle('on', s.dataset.color === shopColor));
    }));
    wrap.querySelector('#buy').onclick = async () => {
      const car = buyCar(shopId, shopColor);
      if (!car) return ui.toast("Balansda mablag' yetarli emas!", 'err');
      if (state.rental) ui.game.endRental(true);
      beep('cash');
      ui.toast(`🎉 Tabriklaymiz! ${cfg.name} garajingizga qo'shildi!`, 'cash');
      await ui.game.changeCar();
      tab = 'mine';
      selUid = car.uid;
      render(false);
    };
  }

  const selChip = wrap.querySelector('.g-chip.sel');
  selChip?.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'smooth' });
}

function renderOptionGrid(key, inst) {
  const t = TUNING[key];
  if (!t) return '';
  return `
    <div class="section-title" style="margin-top:6px">${t.name}</div>
    <div class="g-tune-grid">
      ${t.options.map((o) => {
        const active = String(inst[key] ?? t.options[0].id) === String(o.id);
        return `<button type="button" data-tune="${key}" data-val="${o.id}" class="g-tune-btn ${active ? 'on' : ''}">
          <b>${o.name}</b>
          <small>${active ? "✔ O'rnatilgan" : o.price ? fmt(o.price) : 'Bepul'}</small>
        </button>`;
      }).join('')}
    </div>`;
}

function renderTunePanel(side, cfg, inst) {
  if (!side) return;
  const cats = [
    ['paint',   '🎨 Bo\'yoq'],
    ['rims',    '🛞 Diska'],
    ['aero',    '🛡️ Kuzov & Spoyler'],
    ['tint',    '🕶️ Tonirovka'],
    ['lights',  '💡 Fara & Neon'],
    ['power',   '⚡ Motor & Turbo'],
    ['chassis', '🔧 Tormoz & Rul'],
  ];

  let bodyHtml = '';
  if (tuneCat === 'paint') {
    bodyHtml = `
      <div class="section-title" style="margin-top:4px">Kuzov rangi · <b>${fmt(5_000_000)}</b></div>
      <div class="swatches">
        ${COLORS.map((c) => `<button type="button" class="swatch ${c === inst.color ? 'on' : ''}" data-color="${c}" style="background:${c}"></button>`).join('')}
      </div>
      ${renderOptionGrid('paintType', inst)}`;
  } else if (tuneCat === 'rims') {
    bodyHtml = `
      ${renderOptionGrid('rims', inst)}
      <div class="section-title" style="margin-top:10px">Disk rangi · <b>${fmt(4_000_000)}</b></div>
      <div class="swatches">
        ${RIM_COLOR_SWATCHES.map((rc) => {
          const isSel = (inst.rimColor || '') === rc.id;
          const bg = rc.id || '#d8dde6';
          return `<button type="button" class="swatch ${isSel ? 'on' : ''}" data-rim-color="${rc.id}" title="${rc.name}" style="background:${bg}"></button>`;
        }).join('')}
      </div>`;
  } else if (tuneCat === 'aero') {
    bodyHtml = `
      ${renderOptionGrid('bodykit', inst)}
      ${renderOptionGrid('spoiler', inst)}`;
  } else if (tuneCat === 'tint') {
    bodyHtml = renderOptionGrid('tint', inst);
  } else if (tuneCat === 'lights') {
    bodyHtml = `
      ${renderOptionGrid('headlightColor', inst)}
      ${renderOptionGrid('neon', inst)}`;
  } else if (tuneCat === 'power') {
    bodyHtml = `
      ${renderOptionGrid('engine', inst)}
      ${renderOptionGrid('turbo', inst)}
      ${renderOptionGrid('accelTune', inst)}`;
  } else if (tuneCat === 'chassis') {
    bodyHtml = `
      ${renderOptionGrid('brakeTune', inst)}
      ${renderOptionGrid('handlingTune', inst)}`;
  }

  side.innerHTML = `
    <div class="g-cat-tabs">
      ${cats.map(([k, label]) => `<button type="button" data-cat="${k}" class="${tuneCat === k ? 'on' : ''}">${label}</button>`).join('')}
    </div>
    <div class="g-cat-body">${bodyHtml}</div>
  `;

  side.querySelectorAll('[data-cat]').forEach((b) => (b.onclick = () => {
    tuneCat = b.dataset.cat;
    beep('ok');
    renderTunePanel(side, cfg, inst);
  }));

  side.querySelectorAll('[data-color]').forEach((b) => (b.onclick = () => {
    if (b.dataset.color === inst.color) return;
    if (!spend(5_000_000, `Bo'yash: ${cfg.name}`)) return ui.toast("Balansda mablag' yetarli emas!", 'err');
    inst.color = b.dataset.color;
    touch();
    beep('cash');
    preview?.setTuning(inst);
    if (inst.uid === state.activeUid && !state.rental) ui.game.changeCar(true);
    const dot = rootBody?.querySelector(`.g-chip[data-uid="${inst.uid}"] .g-dot`);
    if (dot) dot.style.background = inst.color;
    render(true);
  }));

  side.querySelectorAll('[data-rim-color]').forEach((b) => (b.onclick = () => {
    const val = b.dataset.rimColor || '';
    if ((inst.rimColor || '') === val) return;
    if (val && !spend(4_000_000, `Disk bo'yash: ${cfg.name}`)) return ui.toast("Balansda mablag' yetarli emas!", 'err');
    inst.rimColor = val;
    touch();
    beep('cash');
    preview?.setTuning(inst);
    if (inst.uid === state.activeUid && !state.rental) ui.game.changeCar(true);
    render(true);
  }));

  side.querySelectorAll('[data-tune]').forEach((b) => (b.onclick = () => {
    const key = b.dataset.tune;
    const opt = TUNING[key]?.options.find((o) => String(o.id) === b.dataset.val);
    if (!opt || String(inst[key]) === String(opt.id)) return;
    if (opt.price && !spend(opt.price, `Tuning (${TUNING[key].name}): ${opt.name}`)) {
      return ui.toast("Balansda mablag' yetarli emas!", 'err');
    }
    inst[key] = opt.id;
    touch();
    beep('cash');
    preview?.setTuning(inst);
    if (inst.uid === state.activeUid && !state.rental) ui.game.changeCar(true);
    ui.toast(`✔ ${opt.name} o'rnatildi!`, 'ok');
    render(true);
  }));
}

function bindCommon(wrap) {
  wrap.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => {
    tab = b.dataset.tab;
    beep('ok');
    render(false);
  }));
  const rl = wrap.querySelector('#rotL');
  const rr = wrap.querySelector('#rotR');
  if (rl) rl.onclick = () => rotateGarage(-0.55);
  if (rr) rr.onclick = () => rotateGarage(0.55);
}
