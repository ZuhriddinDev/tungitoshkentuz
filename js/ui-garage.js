// Garaj (o'z mashinalari, tuning, sotish) va Avtosalon — telefon va kompyuter uchun ixcham 3D interfeys
import { CARS, COLORS, TUNING, carById, fmt } from './config.js';
import { state, buyCar, sellCar, spend, touch } from './state.js';
import { showCar, rotateGarage } from './garage3d.js';
import { beep } from './audio.js';

let ui;
let rootBody = null;
let tab = 'mine';
let tuneCat = 'color'; // 'color' | 'rims' | 'spoiler' | 'neon' | 'engine'
let selUid = null;
let shopId = 'gentra';
let shopColor = COLORS[0];
let preview = null;
let lastPreviewKey = '';

export function openGarage(api) {
  ui = api;
  lastPreviewKey = '';
  rootBody = ui.showModal('garage', '🚗 Garaj va Avtosalon', `<div id="garageRoot" class="garage-wrap"></div>`);
  render();
}

const statsPills = (c) => `
  <div class="g-stats">
    <span>⚡ <b>${c.maxSpeed}</b> km/s</span>
    <span>⏱ 0–100: <b>${(27.8 / c.accel).toFixed(1)}s</b></span>
    <span>⛽ <b>${c.tank}L</b> (${c.fuel})</span>
  </div>`;

function render(keepPreview = false) {
  if (!rootBody) return;
  const wrap = rootBody.querySelector('#garageRoot');
  if (!wrap) return;

  if (tab === 'mine') {
    if (!state.cars.some((c) => c.uid === selUid)) selUid = state.activeUid;
    const idx = Math.max(0, state.cars.findIndex((c) => c.uid === selUid));
    const inst = state.cars[idx] || state.cars[0];
    const cfg = carById(inst.id);
    const sellPrice = Math.round(cfg.price * 0.65 * (1 - inst.damage / 200));
    const isDriving = inst.uid === state.activeUid && !state.rental;

    if (!keepPreview) {
      wrap.innerHTML = `
        <div class="g-topbar">
          <div class="tabs g-tabs">
            <button data-tab="mine" class="on">🚗 Garajim (${state.cars.length})</button>
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
                  <small>${act ? '🟢 Haydalmoqda' : `🔧 ${Math.round(100 - c.damage)}%`}</small>
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
                ${isDriving ? '<span class="g-tag">FAOL</span>' : ''}
              </div>
              <div class="g-rot-btns">
                <button type="button" id="rotL" title="Chapga aylantirish">⟲</button>
                <span>360°</span>
                <button type="button" id="rotR" title="O'ngga aylantirish">⟳</button>
              </div>
            </div>
            ${statsPills(cfg)}
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
    const idx = Math.max(0, CARS.findIndex((c) => c.id === shopId));
    const cfg = carById(shopId);
    const ownedCount = state.cars.filter((x) => x.id === cfg.id).length;

    if (!keepPreview || lastPreviewKey !== `shop:${cfg.id}`) {
      wrap.innerHTML = `
        <div class="g-topbar">
          <div class="tabs g-tabs">
            <button data-tab="mine">🚗 Garajim (${state.cars.length})</button>
            <button data-tab="shop" class="on">🛒 Avtosalon (${CARS.length})</button>
          </div>
          <div class="g-bal">💰 <b id="gMoney">${fmt(state.money)}</b></div>
        </div>

        <div class="g-strip-wrap">
          <button class="g-nav" id="gPrev" title="Oldingi">◀</button>
          <div class="g-strip" id="glist">
            ${CARS.map((c) => {
              const has = state.cars.some((x) => x.id === c.id);
              return `<button class="g-chip ${c.id === shopId ? 'sel' : ''}" data-id="${c.id}">
                <div>
                  <b>${c.name}</b>
                  <small style="color:var(--gold)">${(c.price / 1e6).toFixed(0)} mln ${has ? '· ✔ Bor' : ''}</small>
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
                ${ownedCount ? `<span class="g-tag">Garajda: ${ownedCount} ta</span>` : ''}
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
                <small>Narxi:</small>
                <strong class="price">${fmt(cfg.price)}</strong>
              </div>
              <button class="btn gold" id="buy" ${state.money < cfg.price ? 'disabled' : ''}>🛒 Sotib olish</button>
            </div>
          </div>
        </div>`;

      const cv = wrap.querySelector('#gcv');
      preview = showCar(cv, cfg, { color: shopColor });
      lastPreviewKey = `shop:${cfg.id}`;
    }

    bindCommon(wrap);
    wrap.querySelectorAll('[data-id]').forEach((b) => (b.onclick = () => {
      shopId = b.dataset.id;
      beep('ok');
      render(false);
    }));
    wrap.querySelector('#gPrev').onclick = () => {
      const n = CARS.length;
      shopId = CARS[(idx - 1 + n) % n].id;
      beep('ok');
      render(false);
    };
    wrap.querySelector('#gNext').onclick = () => {
      const n = CARS.length;
      shopId = CARS[(idx + 1) % n].id;
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
      if (!car) return ui.toast("Mablag' yetarli emas", 'err');
      if (state.rental) ui.game.endRental(true);
      beep('cash');
      ui.toast(`Tabriklaymiz! ${cfg.name} xarid qilindi`, 'cash');
      await ui.game.changeCar();
      tab = 'mine';
      selUid = car.uid;
      render(false);
    };
  }

  // Tanlangan mashina kartochkasini ko'rinadigan joyga silliq surish
  const selChip = wrap.querySelector('.g-chip.sel');
  selChip?.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'smooth' });
}

function renderTunePanel(side, cfg, inst) {
  if (!side) return;
  const cats = [
    ['color', '🎨 Rang'],
    ['rims', '🛞 Diska'],
    ['spoiler', '🏎️ Spoyler'],
    ['neon', '💡 Neon'],
    ['engine', '⚡ Motor'],
  ];

  let bodyHtml = '';
  if (tuneCat === 'color') {
    bodyHtml = `
      <div class="section-title" style="margin-top:4px">Avtomobilni bo'yash · <b>${fmt(2_000_000)}</b></div>
      <div class="swatches">
        ${COLORS.map((c) => `<button class="swatch ${c === inst.color ? 'on' : ''}" data-color="${c}" style="background:${c}"></button>`).join('')}
      </div>`;
  } else {
    const t = TUNING[tuneCat];
    bodyHtml = `
      <div class="section-title" style="margin-top:4px">${t.name}</div>
      <div class="g-tune-grid">
        ${t.options.map((o) => {
          const active = String(inst[tuneCat]) === String(o.id);
          return `<button data-tune="${tuneCat}" data-val="${o.id}" class="g-tune-btn ${active ? 'on' : ''}">
            <b>${o.name}</b>
            <small>${active ? '✔ O\'rnatilgan' : o.price ? fmt(o.price) : 'Bepul'}</small>
          </button>`;
        }).join('')}
      </div>`;
  }

  side.innerHTML = `
    <div class="g-cat-tabs">
      ${cats.map(([k, label]) => `<button data-cat="${k}" class="${tuneCat === k ? 'on' : ''}">${label}</button>`).join('')}
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
    if (!spend(2_000_000, `Bo'yash: ${cfg.name}`)) return ui.toast("Mablag' yetarli emas", 'err');
    inst.color = b.dataset.color;
    touch();
    beep('cash');
    preview?.setColor(inst.color);
    if (inst.uid === state.activeUid && !state.rental) ui.game.changeCar(true);
    const dot = rootBody?.querySelector(`.g-chip[data-uid="${inst.uid}"] .g-dot`);
    if (dot) dot.style.background = inst.color;
    render(true);
  }));

  side.querySelectorAll('[data-tune]').forEach((b) => (b.onclick = () => {
    const key = b.dataset.tune;
    const opt = TUNING[key].options.find((o) => String(o.id) === b.dataset.val);
    if (!opt || String(inst[key]) === String(opt.id)) return;
    if (opt.price && !spend(opt.price, `Tuning (${TUNING[key].name}): ${opt.name}`)) return ui.toast("Mablag' yetarli emas", 'err');
    inst[key] = opt.id;
    touch();
    beep('cash');
    preview?.setTuning(inst);
    if (inst.uid === state.activeUid && !state.rental) ui.game.changeCar(true);
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
