// Interfeys V9: modal oynalar, 7 kunlik bonus, P2P pul o'tkazish, promokod + admin panel, reklama banneri, garaj, xarita, poyga, sozlamalar
import { FUELS, carById, fmt, CARS, DAILY_REWARDS_7 } from './config.js';
import {
  state,
  activeCar,
  spend,
  touch,
  canClaimDaily,
  getDaily7Status,
  claimDaily7,
  dailyTasks,
  resetSave,
  setName,
  claimUsernameServer,
  lookupPlayerServer,
  transferMoneyServer,
  redeemPromocodeServer,
  applyServerTransferPush,
} from './state.js';
import { MISSIONS, mission, startMission, cancelMission } from './missions.js';
import { drawBigMap, bigMapToWorld, mapState, MAP_CATEGORIES, findNearestPOI, findMapItemAt } from './map.js';
import { beep, setVolume } from './audio.js';
import { openGarage } from './ui-garage.js';
import { stopGarage } from './garage3d.js';
import { applyControl, getLandscapePointerXY } from './input.js';
import {
  goOnline,
  createPrivateRoom,
  joinRoomByCode,
  joinPublicServer,
  leave,
  info as onlineInfo,
  list as onlineList,
  displayId,
  playerId,
  onOnline,
  sendOnlineEvent,
  serverStats,
  MAX_PLAYERS,
  PRIVATE_MAX_PLAYERS,
} from './online.js';
import { blockC } from './world/layout.js';

const $ = (s) => document.querySelector(s);
let game; // main.js beradigan API
let current = null, mapTimer = 0;

export function initUI(api) {
  game = api;
  $('#modalClose').onclick = closeModal;
  $('#modal').addEventListener('pointerdown', (e) => { if (e.target.id === 'modal') closeModal(); });
  document.querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => open(b.dataset.open)));
}

export const isOpen = () => !!current;
export function closeModal() {
  if (!current) return;
  current = null;
  clearInterval(mapTimer);
  stopGarage();
  $('#modal').classList.remove('show');
  game.onModal(false);
}
export function showModal(name, title, html) {
  current = name;
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = html;
  const m = $('#modal');
  m.classList.remove('show');
  void m.offsetWidth;
  m.classList.add('show');
  game.onModal(true);
  return $('#modalBody');
}
export function toggle(name) { if (current === name) closeModal(); else open(name); }
export function open(name) { beep('ok'); (PANELS[name] || (() => {}))(); }

export function toast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 2800);
  setTimeout(() => el.remove(), 3300);
}

// ---------- O'YIN ICHIDA REKLAMA / DO'STLARNI TAKLIF QILISH BANNERI ----------
function renderInvitePromoBanner() {
  const inviteUrl = 'https://tungi-toshkent-3d.onrender.com/';
  return `
    <div class="tt-promo-banner">
      <div class="tt-promo-left">
        <div class="tt-promo-logo">TUNGI <span>TOSHKENT</span></div>
        <h4>🚀 Do‘stlaringni taklif qil!</h4>
        <p>Toshkent ko‘chalarida birga hayda! Har bir yangi o‘yinchiga <b style="color:var(--gold)">5 000 000 000 so‘m</b> boshlang‘ich balans beriladi.</p>
        <div class="tt-promo-actions">
          <input type="text" readonly value="${inviteUrl}" class="tt-promo-url" id="promoInviteUrlInput" />
          <button type="button" class="btn sm-btn gold" id="copyPromoInviteBtn">📋 Havolani nusxalash</button>
        </div>
      </div>
      <div class="tt-promo-qr" title="Tungi Toshkent QR-kod">
        <svg viewBox="0 0 64 64" width="68" height="68" fill="#00e5ff">
          <rect x="4" y="4" width="18" height="18" fill="none" stroke="#00e5ff" stroke-width="4"/>
          <rect x="9" y="9" width="8" height="8"/>
          <rect x="42" y="4" width="18" height="18" fill="none" stroke="#00e5ff" stroke-width="4"/>
          <rect x="47" y="9" width="8" height="8"/>
          <rect x="4" y="42" width="18" height="18" fill="none" stroke="#00e5ff" stroke-width="4"/>
          <rect x="9" y="47" width="8" height="8"/>
          <rect x="26" y="6" width="4" height="4"/><rect x="32" y="10" width="4" height="8"/>
          <rect x="26" y="18" width="8" height="4"/><rect x="6" y="26" width="8" height="4"/>
          <rect x="18" y="28" width="6" height="6"/><rect x="28" y="26" width="10" height="6"/>
          <rect x="42" y="26" width="6" height="6"/><rect x="52" y="28" width="8" height="4"/>
          <rect x="26" y="36" width="6" height="8"/><rect x="36" y="38" width="8" height="6"/>
          <rect x="48" y="36" width="10" height="6"/><rect x="26" y="48" width="8" height="4"/>
          <rect x="38" y="48" width="6" height="10"/><rect x="48" y="46" width="12" height="6"/>
          <rect x="48" y="54" width="6" height="6"/>
        </svg>
        <small>SCAN & PLAY</small>
      </div>
    </div>
  `;
}

function bindInvitePromoBanner(root) {
  const btn = root?.querySelector('#copyPromoInviteBtn');
  if (!btn) return;
  btn.onclick = () => {
    const url = 'https://tungi-toshkent-3d.onrender.com/';
    navigator.clipboard?.writeText(url).catch(() => {});
    beep('ok');
    toast("🔗 O'yin havolasi nusxalandi! Do'stlaringizga yuboring.", 'cash');
  };
}

// ---------- 9. 7 KUNLIK KUNDALIK BONUS (DAILY REWARDS) ----------
function dailyRewardsModal() {
  const st = getDaily7Status();
  const body = showModal('daily', '🎁 7 Kunlik Kundalik Bonus (Daily Rewards)', `
    <div class="daily7-wrap">
      <div class="daily7-header">
        <div>
          <h3>Har kuni o‘yinga kiring va mukofot oling!</h3>
          <p>Ketma-ket 7 kun kiring — 7-kuni <b style="color:var(--gold)">Ferrari SF90 Spider</b> superkari bepul sovg‘a qilinadi!</p>
        </div>
        <div class="daily7-streak-badge">
          <span>🔥 Joriy seriya</span>
          <b>${st.streak} / 7 kun</b>
        </div>
      </div>

      <div id="dailyRewardAnim" class="daily7-anim-banner hidden"></div>

      <div class="daily7-grid">
        ${DAILY_REWARDS_7.map((r) => {
          const isClaimed = !st.canClaim ? r.day <= st.streak : r.day < st.activeDay;
          const isCurrent = st.canClaim && r.day === st.activeDay;
          const isGrand = r.day === 7;
          return `
            <div class="daily7-card ${isClaimed ? 'claimed' : ''} ${isCurrent ? 'current' : ''} ${isGrand ? 'grand' : ''}">
              <div class="d7-day">${r.day}-KUN</div>
              <div class="d7-icon">${r.icon}</div>
              <b class="d7-title">${r.title}</b>
              <small class="d7-sub">${r.subtitle}</small>
              <div class="d7-status">
                ${isClaimed ? '✅ Olingan' : isCurrent ? '🔥 Bugun olish mumkin!' : '🔒 Kutilmoqda'}
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="daily7-footer">
        <button type="button" class="btn gold big" id="claimDaily7Btn" ${st.canClaim ? '' : 'disabled'}>
          ${st.canClaim ? `🎁 ${st.activeDay}-Kunlik Bonusni Olish (${DAILY_REWARDS_7[st.activeDay - 1]?.title})` : "✅ Bugungi bonus olingan — Ertaga yana kiring!"}
        </button>
      </div>
    </div>
    ${renderInvitePromoBanner()}
  `);

  bindInvitePromoBanner(body);

  const claimBtn = body.querySelector('#claimDaily7Btn');
  if (claimBtn) {
    claimBtn.onclick = async () => {
      claimBtn.disabled = true;
      claimBtn.textContent = '⏳ Tekshirilmoqda...';
      const res = await claimDaily7();
      if (!res.ok) {
        beep('err');
        toast(res.error || 'Bonus olishda xatolik', 'err');
        dailyRewardsModal();
        return;
      }
      beep('win');
      const r = res.reward || {};
      if (r.car) {
        await game.changeCar?.();
        toast(`🏆 TABRIKLAYMIZ! 7-kun mukofoti: ${r.title} garajingizga qo'shildi!`, 'cash');
      } else {
        toast(`🎁 ${res.claimedDay}-kunlik bonus olindi: +${fmt(r.money || 0)}!`, 'cash');
      }
      dailyRewardsModal();
      const animEl = document.getElementById('dailyRewardAnim');
      if (animEl) {
        animEl.classList.remove('hidden');
        animEl.innerHTML = `🎉 Tabriklaymiz! <b>${res.claimedDay}-kun</b> mukofoti muvaffaqiyatli topshirildi: <b style="color:var(--gold)">${r.title}</b>!`;
      }
    };
  }
}

// ---------- 6. FOYDALANUVCHILAR O'RTASIDA PUL O'TKAZISH (P2P TRANSFER) ----------
let verifiedTarget = null;
function transferModal() {
  const inf = onlineInfo();
  const peers = onlineList();
  const myCode = displayId(inf.id);

  const body = showModal('transfer', '💸 Foydalanuvchilar O‘rtasida Pul O‘tkazish', `
    <div class="set-grid">
      <section class="set-card">
        <h3>💳 Pul Jo‘natish</h3>
        <div class="id-box" style="margin-bottom:10px">
          <div>
            <small>Sizning balansingiz (ID: <b>${myCode}</b>):</small>
            <strong style="color:var(--gold);font-size:20px" id="trMyBalance">${fmt(state.money)}</strong>
          </div>
        </div>

        <label class="online-lbl">1️⃣ Qabul qiluvchi ID (TT-XXXXXX) yoki Ismini kiriting:
          <div class="row" style="margin-top:6px">
            <input id="trTargetInput" maxlength="20" placeholder="Masalan: TT-7K2M9Q yoki Sardor" value="${verifiedTarget ? verifiedTarget.displayId : ''}" style="margin:0;font-weight:700" autocomplete="off" />
            <button type="button" class="btn primary" id="trVerifyBtn" style="flex:0 0 auto">🔍 Tekshirish</button>
          </div>
        </label>

        ${peers.length > 0 ? `
          <div style="margin-top:8px">
            <small style="color:var(--muted)">Xonadagi do'stlardan tez tanlash:</small>
            <div class="opts" style="margin-top:4px">
              ${peers.map((p) => `<button type="button" class="btn sm-btn" data-pick-peer="TT-${p.id}">👤 ${p.name || 'Haydovchi'} (TT-${p.id})</button>`).join('')}
            </div>
          </div>
        ` : ''}

        <div id="trVerifyBox" class="id-box ${verifiedTarget ? '' : 'hidden'}" style="margin-top:10px;border-color:var(--green)">
          ${verifiedTarget ? `
            <div>
              <small>✅ Tasdiqlangan qabul qiluvchi:</small>
              <strong>${verifiedTarget.name} (${verifiedTarget.displayId}) ${verifiedTarget.online ? '🟢 Online' : ''}</strong>
            </div>
          ` : ''}
        </div>

        <label class="online-lbl" style="margin-top:10px">2️⃣ O‘tkazma miqdori (so‘m):
          <input type="number" id="trAmountInput" min="100000" max="50000000000" step="1000000" placeholder="Masalan: 50000000" value="50000000" style="margin-top:6px;font-weight:800;font-size:16px" />
        </label>
        <div class="opts" style="margin-top:6px">
          ${[
            [10_000_000, '10 mln'],
            [50_000_000, '50 mln'],
            [100_000_000, '100 mln'],
            [500_000_000, '500 mln'],
            [1_000_000_000, '1 mlrd'],
          ].map(([val, lbl]) => `<button type="button" class="btn sm-btn" data-tr-amt="${val}">+${lbl}</button>`).join('')}
        </div>

        <label class="online-lbl" style="margin-top:8px">3️⃣ Izoh (ixtiyoriy):
          <input id="trNoteInput" maxlength="40" placeholder="Masalan: Mashina uchun sovg'a 🚗" style="margin-top:4px" autocomplete="off" />
        </label>

        <!-- Tasdiqlash dialogi -->
        <div id="trConfirmWrap" class="card hidden" style="margin-top:10px;border-color:var(--gold)">
          <p id="trConfirmText" style="font-size:13px;color:var(--text);margin-bottom:8px"></p>
          <div class="row">
            <button type="button" class="btn gold" id="trFinalSendBtn">✅ Tasdiqlash va Jo‘natish</button>
            <button type="button" class="btn danger" id="trCancelConfirmBtn">Bekor qilish</button>
          </div>
        </div>

        <button type="button" class="btn gold big" id="trInitSendBtn" style="width:100%;margin-top:12px">💸 Pul Jo‘natish</button>
      </section>

      <section class="set-card">
        <h3>📜 O‘tkazmalar Tarixi (Transaction ID bilan)</h3>
        <div class="list" id="trHistoryList" style="max-height:360px;overflow-y:auto">
          ${(!state.transfers || state.transfers.length === 0)
            ? '<div style="color:var(--muted);justify-content:center">Hozircha o‘tkazmalar tarixi bo‘sh</div>'
            : state.transfers.slice(0, 20).map((tx) => {
                const isOut = tx.dir === 'out' || tx.fromId === state.playerId;
                const peerLabel = isOut ? `➡️ ${tx.toName} (TT-${tx.toId})` : `⬅️ ${tx.fromName} (TT-${tx.fromId})`;
                return `
                  <div style="flex-direction:column;align-items:flex-start;gap:4px">
                    <div style="display:flex;justify-content:space-between;width:100%">
                      <b>${peerLabel}</b>
                      <b class="${isOut ? 'minus' : 'plus'}">${isOut ? '−' : '+'}${fmt(tx.amount)}</b>
                    </div>
                    <div style="display:flex;justify-content:space-between;width:100%;font-size:11px;color:var(--muted)">
                      <span>🆔 ${tx.txId} ${tx.note ? `· «${tx.note}»` : ''}</span>
                      <span>${new Date(tx.ts).toLocaleTimeString('uz')}</span>
                    </div>
                  </div>
                `;
              }).join('')}
        </div>
      </section>
    </div>
  `);

  const targetInp = body.querySelector('#trTargetInput');
  const amtInp = body.querySelector('#trAmountInput');
  const noteInp = body.querySelector('#trNoteInput');
  const verifyBox = body.querySelector('#trVerifyBox');
  const confirmWrap = body.querySelector('#trConfirmWrap');
  const confirmText = body.querySelector('#trConfirmText');
  const initSendBtn = body.querySelector('#trInitSendBtn');

  const doVerify = async (rawQ) => {
    const q = String(rawQ ?? targetInp.value).trim();
    if (!q) {
      toast("O'yinchi ID yoki ismini kiriting!", 'err');
      return null;
    }
    const res = await lookupPlayerServer(q);
    if (!res.ok) {
      verifiedTarget = null;
      verifyBox.classList.add('hidden');
      beep('err');
      toast(res.error || "O'yinchi topilmadi", 'err');
      return null;
    }
    verifiedTarget = res.player;
    verifyBox.classList.remove('hidden');
    verifyBox.innerHTML = `
      <div>
        <small>✅ Tasdiqlangan qabul qiluvchi:</small>
        <strong>${verifiedTarget.name} (${verifiedTarget.displayId}) ${verifiedTarget.online ? '🟢 Online' : ''}</strong>
      </div>
    `;
    beep('ok');
    return verifiedTarget;
  };

  body.querySelector('#trVerifyBtn').onclick = () => doVerify();
  body.querySelectorAll('[data-pick-peer]').forEach((b) => {
    b.onclick = () => {
      targetInp.value = b.dataset.pickPeer;
      doVerify(b.dataset.pickPeer);
    };
  });

  body.querySelectorAll('[data-tr-amt]').forEach((b) => {
    b.onclick = () => {
      amtInp.value = b.dataset.trAmt;
      beep('ok');
    };
  });

  initSendBtn.onclick = async () => {
    const q = targetInp.value.trim();
    const amount = Math.floor(Number(amtInp.value) || 0);
    if (!q) return toast("Qabul qiluvchi ID yoki ismini kiriting!", 'err');
    if (amount < 100_000) return toast("Minimal o'tkazma miqdori: 100 000 so'm", 'err');
    if (amount > state.money) return toast("Balansingizda mablag' yetarli emas!", 'err');

    if (!verifiedTarget || (verifiedTarget.displayId !== q.toUpperCase() && verifiedTarget.name.toLowerCase() !== q.toLowerCase())) {
      const v = await doVerify(q);
      if (!v) return;
    }

    confirmText.innerHTML = `Haqiqatan ham <b>${verifiedTarget.name} (${verifiedTarget.displayId})</b> ga <b style="color:var(--gold)">${fmt(amount)}</b> o‘tkazishni tasdiqlaysizmi?`;
    confirmWrap.classList.remove('hidden');
    initSendBtn.classList.add('hidden');
  };

  body.querySelector('#trCancelConfirmBtn').onclick = () => {
    confirmWrap.classList.add('hidden');
    initSendBtn.classList.remove('hidden');
  };

  body.querySelector('#trFinalSendBtn').onclick = async () => {
    const finalBtn = body.querySelector('#trFinalSendBtn');
    finalBtn.disabled = true;
    finalBtn.textContent = '⏳ Yuborilmoqda...';

    const amount = Math.floor(Number(amtInp.value) || 0);
    const note = noteInp.value.trim();
    const res = await transferMoneyServer({
      toQuery: verifiedTarget ? verifiedTarget.id : targetInp.value.trim(),
      amount,
      note,
    });

    if (!res.ok) {
      beep('err');
      toast(res.error || "Pul o'tkazishda xatolik", 'err');
      finalBtn.disabled = false;
      finalBtn.textContent = '✅ Tasdiqlash va Jo‘natish';
      return;
    }

    beep('cash');
    toast(`✅ Muvaffaqiyatli! ${res.tx.toName} ga ${fmt(res.tx.amount)} o'tkazildi [${res.tx.txId}]`, 'cash');
    verifiedTarget = null;
    transferModal();
  };
}

// ---------- 7. MAXFIY PROMOKOD TIZIMI (FAQAT KIRITISH OYNASI) ----------
function promocodeModal() {
  const usedCount = Array.isArray(state.usedPromos) ? state.usedPromos.length : 0;
  const body = showModal('promocode', '🎟️ Maxfiy Promokod Markazi', `
    <div class="card" style="max-width:560px;margin:0 auto;padding:18px;border:1.5px solid rgba(0,229,255,0.38)">
      <h3 style="margin-bottom:6px;color:var(--gold)">🎁 Maxsus Promokod Kiritish</h3>
      <p style="font-size:13px;color:var(--muted);margin-bottom:14px">
        Faqat rasmiy berilgan maxfiy promokodni kiriting va <b>50 000 000 so‘mdan 850 000 000 so‘mgacha</b> virtual pul mukofotiga ega bo‘ling!
      </p>
      <div class="row">
        <input id="promoCodeInput" maxlength="24" placeholder="PROMOKODNI TERING..." style="margin:0;text-transform:uppercase;font-weight:900;letter-spacing:2px;font-size:16px" autocomplete="off" />
        <button type="button" class="btn gold" id="redeemPromoBtn" style="flex:0 0 auto">🎉 Faollashtirish</button>
      </div>

      <div id="promoResultBox" class="card hidden" style="margin-top:12px;border-color:var(--green)"></div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:10px;border-top:1px solid var(--line);font-size:12.5px;color:var(--muted)">
        <span>🎟️ Siz faollashtirgan maxfiy promokodlar:</span>
        <b style="color:var(--cyan)">${usedCount} / 20</b>
      </div>
    </div>
  `);

  const codeInp = body.querySelector('#promoCodeInput');
  const redeemBtn = body.querySelector('#redeemPromoBtn');

  const doRedeem = async () => {
    const code = codeInp.value.trim().toUpperCase();
    if (!code) return toast('Promokodni kiriting!', 'err');
    redeemBtn.disabled = true;
    redeemBtn.textContent = '⏳ Tekshirilmoqda...';

    const res = await redeemPromocodeServer(code);
    if (!res.ok) {
      beep('err');
      toast(res.error || "Promokod noto'g'ri yoki ishlatilgan!", 'err');
      redeemBtn.disabled = false;
      redeemBtn.textContent = '🎉 Faollashtirish';
      return;
    }

    beep('win');
    if (res.reward?.car) {
      await game.changeCar?.();
    }
    toast(`🎉 Promokod faollashtirildi! +${res.reward?.title}!`, 'cash');
    promocodeModal();
    const box = document.getElementById('promoResultBox');
    if (box) {
      box.classList.remove('hidden');
      box.innerHTML = `✅ Promokod muvaffaqiyatli faollashtirildi! Mukofot: <b style="color:var(--gold)">+${res.reward?.title}</b>`;
    }
  };

  redeemBtn.onclick = doRedeem;
  codeInp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doRedeem();
  });
}

// ---------- Zapravka ----------
function gasStation() {
  const inst = activeCar(), cfg = carById(inst.id);
  const body = showModal('gas', '⛽ UZ-OIL zapravkasi', `
    <p style="margin-bottom:12px;color:var(--muted)">${cfg.name} · bak: <b>${inst.fuelL.toFixed(1)} / ${cfg.tank} l</b> · tavsiya etilgan: <b>${cfg.fuel}</b></p>
    <div class="fuel-types">${Object.entries(FUELS).map(([k, f]) => `
      <button class="card ${k === inst.fuelType ? 'sel' : ''}" data-fuel="${k}" style="text-align:left">
        <h3 style="color:${f.color}">${k}</h3><p>${fmt(f.price)} / litr</p>
        ${k === cfg.fuel ? '<p style="color:var(--green)">✔ Shu mashina uchun</p>' : '<p>Boshqa tur — quvvat biroz pasayadi</p>'}
      </button>`).join('')}</div>
    <div class="section-title">Litr miqdori: <b id="litVal"></b></div>
    <input type="range" id="lit" min="1" step="1" />
    <div class="row" style="margin-top:12px;align-items:center"><div>Jami: <b class="price" id="fuelTotal" style="color:var(--gold);font-size:20px"></b></div>
    <button class="btn gold" id="fillBtn">Benzin quyish</button></div>`);
  let type = inst.fuelType || cfg.fuel;
  const lit = body.querySelector('#lit');
  const sync = () => {
    const space = type === inst.fuelType ? cfg.tank - inst.fuelL : cfg.tank;
    lit.max = Math.max(1, Math.floor(space));
    if (+lit.value > +lit.max) lit.value = lit.max;
    body.querySelector('#litVal').textContent = `${lit.value} l${type !== inst.fuelType ? " (eski benzin to'kiladi)" : ''}`;
    body.querySelector('#fuelTotal').textContent = fmt(lit.value * FUELS[type].price);
    body.querySelectorAll('[data-fuel]').forEach((b) => b.classList.toggle('sel', b.dataset.fuel === type));
    body.querySelector('#fillBtn').disabled = space < 1;
  };
  lit.value = Math.floor(cfg.tank - inst.fuelL) || 1;
  lit.oninput = sync;
  body.querySelectorAll('[data-fuel]').forEach((b) => (b.onclick = () => { type = b.dataset.fuel; sync(); lit.value = lit.max; sync(); }));
  body.querySelector('#fillBtn').onclick = () => {
    const l = +lit.value, cost = Math.round(l * FUELS[type].price);
    if (!spend(cost, `Benzin ${type}: ${l} l`)) { beep('err'); return toast("Mablag' yetarli emas", 'err'); }
    if (type !== inst.fuelType) { inst.fuelL = 0; inst.fuelType = type; }
    inst.fuelL = Math.min(cfg.tank, inst.fuelL + l);
    touch();
    beep('cash');
    toast(`${l} l ${type} quyildi: −${fmt(cost)}`, 'cash');
    closeModal();
  };
  sync();
}

// ---------- Xizmat paneli (E) ----------
function service() {
  const inst = activeCar(), cfg = carById(inst.id);
  const tasks = dailyTasks();
  const body = showModal('service', '🛠 Xizmat va Bonuslar Markazi', `
    <div class="grid">
      <div class="card"><h3>🎁 7 Kunlik Bonus</h3><p>Har kuni pul va 7-kuni SF90 Spider sovg'a!</p><p class="price">${canClaimDaily() ? 'Tayyor!' : 'Olingan'}</p><button class="btn gold" id="svOpenDaily">Bonus oynasi</button></div>
      <div class="card"><h3>🎟️ Promokod</h3><p>Maxsus kod orqali bonus olish</p><p class="price">VIP Sovg'alar</p><button class="btn primary" id="svOpenPromo">Kiritish</button></div>
      <div class="card"><h3>💸 Pul O'tkazish</h3><p>Do'stlarga ID yoki ism orqali pul jo'natish</p><p class="price">P2P Transfer</p><button class="btn primary" id="svOpenTransfer">O'tkazish</button></div>
      <div class="card"><h3>🚚 Evakuator</h3><p>Mashinani avtosalon oldiga olib borish</p><p class="price">${fmt(1_500_000)}</p><button class="btn" id="svTow">Chaqirish</button></div>
      <div class="card"><h3>⛽ Benzin yetkazish</h3><p>10 litr ${inst.fuelType}, joyiga yetkazib beriladi</p><p class="price">${fmt(10 * FUELS[inst.fuelType].price * 1.5)}</p><button class="btn" id="svFuel">Buyurtma</button></div>
    </div>
    <div class="section-title">Kundalik topshiriqlar</div>
    <div class="list">${tasks.map((t) => `<div><span>${t.done ? '✅' : '⬜'} ${t.name}</span><span>${t.stat === 'km' ? t.progress.toFixed(1) : Math.floor(t.progress)}/${t.goal} · <b class="plus">+${fmt(t.reward)}</b></span></div>`).join('')}</div>
    <div class="section-title">So'nggi tranzaksiyalar</div>
    <div class="list">${state.tx.slice(0, 12).map((t) => `<div><span>${new Date(t.t).toLocaleTimeString('uz')} · ${t.reason}</span><b class="${t.amount >= 0 ? 'plus' : 'minus'}">${t.amount >= 0 ? '+' : ''}${fmt(t.amount)}</b></div>`).join('') || "<div>Hali tranzaksiyalar yo'q</div>"}</div>`);

  body.querySelector('#svOpenDaily').onclick = () => open('daily');
  body.querySelector('#svOpenPromo').onclick = () => open('promocode');
  body.querySelector('#svOpenTransfer').onclick = () => open('transfer');
  body.querySelector('#svTow').onclick = () => {
    if (!spend(1_500_000, 'Evakuator xizmati')) return toast("Mablag' yetarli emas", 'err');
    game.tow();
    closeModal();
    toast('Mashina avtosalon oldiga olib kelindi', 'ok');
  };
  body.querySelector('#svFuel').onclick = () => {
    const cost = Math.round(10 * FUELS[inst.fuelType].price * 1.5);
    if (inst.fuelL > cfg.tank - 10) return toast("Bak deyarli to'la", 'err');
    if (!spend(cost, `Benzin yetkazish: 10 l ${inst.fuelType}`)) return toast("Mablag' yetarli emas", 'err');
    inst.fuelL += 10;
    touch();
    beep('cash');
    service();
  };
}

// ---------- Katta Interaktiv Toshkent GPS Xaritasi (M) ----------
function bigMap() {
  const pl = game.player();
  const wp = game.waypoint();
  const distKm = wp ? (Math.hypot(wp.x - pl.x, wp.z - pl.z) / 1000).toFixed(2) : null;

  const body = showModal('map', '🗺️ Toshkent GPS Xaritasi (OpenStreetMap)', `
    <div class="gps-toolbar">
      <div class="gps-cats" id="gpsCatBar">
        ${MAP_CATEGORIES.map((c) => `
          <button type="button" class="gps-cat-btn ${mapState.filter === c.id ? 'on' : ''}" data-mcat="${c.id}">
            <span>${c.icon}</span><b>${c.label}</b>
          </button>
        `).join('')}
      </div>
      <div class="gps-quick-row">
        <button type="button" class="btn sm-btn primary" id="gpsNearGas">⛽ Eng yaqin Zapravka</button>
        <button type="button" class="btn sm-btn gold" id="gpsNearGarage">🚘 Eng yaqin Garaj</button>
        <button type="button" class="btn sm-btn" id="gpsCenterMe">🎯 Mening joyim</button>
        <button type="button" class="btn sm-btn" id="gpsZoomIn" title="Yaqinlashtirish">➕</button>
        <button type="button" class="btn sm-btn" id="gpsZoomOut" title="Uzoqlashtirish">➖</button>
        <button type="button" class="btn sm-btn danger" id="gpsClearWp" ${wp ? '' : 'style="display:none"'}>❌ GPS (${distKm || 0} km)</button>
      </div>
    </div>

    <div class="gps-map-stage">
      <canvas class="bigmap" id="bigMapCv" width="920" height="920"></canvas>
      <div id="mapPoiInspector" class="gps-poi-card hidden"></div>
    </div>
    <p class="hint" style="text-align:center;margin-top:6px">
      💡 Xaritadagi istalgan nuqta yoki belgi ustiga bosing — <b>GPS marshrut</b> chiziladi. G'ildirakcha yoki ➕/➖ orqali kattalashtiring.
    </p>
  `);

  const cv = body.querySelector('#bigMapCv');
  const inspector = body.querySelector('#mapPoiInspector');
  const clearBtn = body.querySelector('#gpsClearWp');

  const syncClearBtn = () => {
    const curWp = game.waypoint();
    const pNow = game.player();
    if (curWp) {
      const km = (Math.hypot(curWp.x - pNow.x, curWp.z - pNow.z) / 1000).toFixed(2);
      clearBtn.style.display = '';
      clearBtn.textContent = `❌ GPS (${km} km)`;
    } else {
      clearBtn.style.display = 'none';
    }
  };

  const renderInspector = () => {
    const sel = mapState.selectedPoi;
    if (!sel) {
      inspector.classList.add('hidden');
      inspector.innerHTML = '';
      return;
    }
    const pNow = game.player();
    const dKm = (Math.hypot(sel.x - pNow.x, sel.z - pNow.z) / 1000).toFixed(2);
    inspector.classList.remove('hidden');
    inspector.innerHTML = `
      <div class="poi-card-main">
        <div class="poi-ic" style="border-color:${sel.color}">${sel.icon}</div>
        <div class="poi-txt">
          <b>${sel.title}</b>
          <small>${sel.sub} · <span style="color:var(--cyan)">${dKm} km</span></small>
        </div>
      </div>
      <div class="poi-card-acts">
        <button type="button" class="btn sm-btn primary" id="poiSetGps">📍 Yo'nalish belgilash (GPS)</button>
        <button type="button" class="btn sm-btn" id="poiClose">✕</button>
      </div>
    `;
    inspector.querySelector('#poiSetGps').onclick = () => {
      game.setWaypoint({ x: sel.x, z: sel.z, label: sel.title });
      beep('ok');
      toast(`📍 GPS marshrut belgilandi: ${sel.title} (${dKm} km)`, 'ok');
      syncClearBtn();
      draw();
    };
    inspector.querySelector('#poiClose').onclick = () => {
      mapState.selectedPoi = null;
      renderInspector();
      draw();
    };
  };

  const draw = () => {
    drawBigMap(cv, game.player(), game.mapExtra());
    syncClearBtn();
  };

  body.querySelectorAll('[data-mcat]').forEach((b) => {
    b.onclick = () => {
      mapState.filter = b.dataset.mcat;
      body.querySelectorAll('[data-mcat]').forEach((x) => x.classList.toggle('on', x === b));
      beep('ok');
      draw();
    };
  });

  body.querySelector('#gpsNearGas').onclick = () => {
    const pNow = game.player();
    const near = findNearestPOI(pNow.x, pNow.z, 'gas');
    if (near) {
      mapState.selectedPoi = near;
      game.setWaypoint({ x: near.x, z: near.z, label: near.title });
      const km = (Math.hypot(near.x - pNow.x, near.z - pNow.z) / 1000).toFixed(2);
      beep('ok');
      toast(`⛽ Eng yaqin zapravka: ${near.title} (${km} km)`, 'ok');
      renderInspector();
      draw();
    }
  };

  body.querySelector('#gpsNearGarage').onclick = () => {
    const pNow = game.player();
    const near = findNearestPOI(pNow.x, pNow.z, 'garage');
    if (near) {
      mapState.selectedPoi = near;
      game.setWaypoint({ x: near.x, z: near.z, label: near.title });
      const km = (Math.hypot(near.x - pNow.x, near.z - pNow.z) / 1000).toFixed(2);
      beep('ok');
      toast(`🚘 Eng yaqin garaj: ${near.title} (${km} km)`, 'ok');
      renderInspector();
      draw();
    }
  };

  body.querySelector('#gpsCenterMe').onclick = () => {
    const pNow = game.player();
    mapState.panX = pNow.x;
    mapState.panZ = pNow.z;
    mapState.zoom = Math.max(1.5, mapState.zoom);
    beep('ok');
    draw();
  };

  body.querySelector('#gpsZoomIn').onclick = () => {
    mapState.zoom = Math.min(3.5, (mapState.zoom || 1) + 0.45);
    draw();
  };

  body.querySelector('#gpsZoomOut').onclick = () => {
    mapState.zoom = Math.max(1.0, (mapState.zoom || 1) - 0.45);
    if (mapState.zoom <= 1.05) { mapState.panX = 0; mapState.panZ = 0; }
    draw();
  };

  clearBtn.onclick = () => {
    game.setWaypoint(null);
    mapState.selectedPoi = null;
    renderInspector();
    beep('ok');
    toast("GPS yo'nalishi o'chirildi", 'ok');
    draw();
  };

  let dragStart = null;
  let moved = false;

  cv.addEventListener('pointerdown', (e) => {
    const pt = getLandscapePointerXY(e);
    dragStart = { x: pt.x, y: pt.y, panX: mapState.panX || 0, panZ: mapState.panZ || 0 };
    moved = false;
    try { cv.setPointerCapture(e.pointerId); } catch { /* */ }
  });

  cv.addEventListener('pointermove', (e) => {
    if (!dragStart) return;
    const pt = getLandscapePointerXY(e);
    const dx = pt.x - dragStart.x;
    const dy = pt.y - dragStart.y;
    if (Math.hypot(dx, dy) > 6) moved = true;
    if (moved && mapState.zoom > 1.02) {
      const cw = Math.max(100, cv.clientWidth);
      const ch = Math.max(100, cv.clientHeight);
      const worldSpan = 2100 / (mapState.zoom || 1);
      mapState.panX = dragStart.panX - (dx / cw) * worldSpan;
      mapState.panZ = dragStart.panZ - (dy / ch) * worldSpan;
      draw();
    }
  });

  const endPointer = (e) => {
    if (!dragStart) return;
    const wasMoved = moved;
    dragStart = null;
    if (wasMoved) return;

    const rect = cv.getBoundingClientRect();
    let nx = 0.5;
    let ny = 0.5;
    if (document.body.classList.contains('auto-landscape-rot')) {
      nx = (e.clientY - rect.top) / Math.max(1, rect.height);
      ny = (rect.right - e.clientX) / Math.max(1, rect.width);
    } else {
      nx = (e.clientX - rect.left) / Math.max(1, rect.width);
      ny = (e.clientY - rect.top) / Math.max(1, rect.height);
    }
    const [wx, wz] = bigMapToWorld(
      nx * cv.width,
      ny * cv.height,
      cv.width
    );
    const hitPoi = findMapItemAt(wx, wz, 55 / Math.sqrt(mapState.zoom || 1));
    if (hitPoi) {
      mapState.selectedPoi = hitPoi;
      game.setWaypoint({ x: hitPoi.x, z: hitPoi.z, label: hitPoi.title });
      const pNow = game.player();
      const km = (Math.hypot(hitPoi.x - pNow.x, hitPoi.z - pNow.z) / 1000).toFixed(2);
      beep('ok');
      toast(`📍 ${hitPoi.icon} ${hitPoi.title} (${km} km)`, 'ok');
      renderInspector();
      draw();
    } else {
      mapState.selectedPoi = null;
      renderInspector();
      const curWp = game.waypoint();
      if (curWp && Math.hypot(curWp.x - wx, curWp.z - wz) < 38) {
        game.setWaypoint(null);
        toast("GPS nuqtasi o'chirildi", 'ok');
      } else {
        game.setWaypoint({ x: wx, z: wz });
        const pNow = game.player();
        const km = (Math.hypot(wx - pNow.x, wz - pNow.z) / 1000).toFixed(2);
        toast(`📍 GPS nuqta qo'yildi (${km} km)`, 'ok');
      }
      beep('ok');
      draw();
    }
  };

  cv.addEventListener('pointerup', endPointer);
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.28 : -0.28;
    mapState.zoom = Math.max(1.0, Math.min(3.5, (mapState.zoom || 1) + delta));
    draw();
  }, { passive: false });

  renderInspector();
  draw();
  mapTimer = setInterval(draw, 250);
}

// ---------- Poygalar (R) ----------
function races() {
  const h = game.hour(), night = h >= 20 || h < 5;
  const list = ['race', 'duel', 'drift'];
  const body = showModal('race', '🏁 Poygalar va musobaqalar', `
    ${mission.active ? `<div class="card" style="margin-bottom:12px"><h3>Faol: ${mission.active.name}</h3><button class="btn danger" id="cancelM">Bekor qilish</button></div>` : ''}
    <div class="grid">${list.map((k) => { const m = MISSIONS[k], locked = m.night && !night; return `
      <div class="card"><h3>${m.name}</h3><p>${m.desc}</p><p class="price">${m.fee ? 'Kirish: ' + fmt(m.fee) : 'Bepul'}</p>
      <button class="btn primary" data-start="${k}" ${locked ? 'disabled' : ''}>${locked ? '🌙 Tunda ochiladi' : 'Boshlash'}</button></div>`; }).join('')}</div>`);
  bindStart(body);
}

// ---------- Ishlar (T): yetkazib berish, taksi, ijara ----------
const RENTALS = ['kia_k5', 'malibu', 'e55', 'challenger', 'supra', 'm4comp', 'bmw', 'mercedes', 'maybach', 'porsche911', 'lambo', 'sf90', 'roadster'];
function jobs() {
  const body = showModal('jobs', '📦 Ishlar va xizmatlar', `
    ${mission.active ? `<div class="card" style="margin-bottom:12px"><h3>Faol: ${mission.active.name}</h3><button class="btn danger" id="cancelM">Bekor qilish</button></div>` : ''}
    <div class="grid">${['delivery', 'taxi'].map((k) => `<div class="card"><h3>${MISSIONS[k].name}</h3><p>${MISSIONS[k].desc}</p><button class="btn primary" data-start="${k}">Buyurtma olish</button></div>`).join('')}</div>
    <div class="section-title">🔑 Avtomobil ijarasi (10 daqiqa)</div>
    ${state.rental ? `<div class="card"><h3>Ijarada: ${carById(state.rental.car.id).name}</h3><p>Qolgan vaqt: ${Math.ceil((state.rental.until - Date.now()) / 60000)} daqiqa</p><button class="btn danger" id="endRent">Qaytarish</button></div>` : `
    <div class="grid">${RENTALS.map((id) => { const c = carById(id), price = Math.round(c.price * 0.004); return `
      <div class="card"><h3>${c.name}</h3><div class="stats"><span>Maks: <b>${c.maxSpeed} km/h</b></span><span>0-100: <b>${(27.8 / c.accel).toFixed(1)} s</b></span></div>
      <p class="price">${fmt(price)}</p><button class="btn" data-rent="${id}">Ijaraga olish</button></div>`; }).join('')}</div>`}`);
  bindStart(body);
  body.querySelectorAll('[data-rent]').forEach((b) => (b.onclick = () => {
    const c = carById(b.dataset.rent), price = Math.round(c.price * 0.004);
    if (!spend(price, `Ijara: ${c.name}`)) return toast("Mablag' yetarli emas", 'err');
    state.rental = {
      car: {
        uid: 'rent',
        id: c.id,
        color: c.defaultColor || '#111111',
        paintType: 'metallic',
        rims: 'vossen',
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
        fuelL: c.tank,
        fuelType: c.fuel,
        damage: 0,
      },
      until: Date.now() + 10 * 60000,
    };
    touch();
    game.changeCar();
    beep('cash');
    toast(`${c.name} 10 daqiqaga ijaraga olindi`, 'cash');
    closeModal();
  }));
  const end = body.querySelector('#endRent');
  if (end) end.onclick = () => { game.endRental(); closeModal(); };
}

function bindStart(body) {
  body.querySelectorAll('[data-start]').forEach((b) => (b.onclick = () => { if (startMission(b.dataset.start, game.hour())) closeModal(); }));
  const c = body.querySelector('#cancelM');
  if (c) c.onclick = () => { cancelMission(); closeModal(); };
}

// ---------- Pauza (ESC) va Boshqaruv Markazi ----------
function pause() {
  const inf = onlineInfo();
  const dailyReady = canClaimDaily();
  const body = showModal('pause', 'O\'yin Menyusi', `
    <div class="grid pause-grid">
      <button class="btn primary big" data-a="resume">▶ O'yinni davom ettirish</button>
      <button class="btn gold big" data-a="garage">🚗 Garaj va Tuning</button>
      <button class="btn big ${dailyReady ? 'gold' : ''}" data-a="daily">🎁 7 Kunlik Bonus ${dailyReady ? '🔥' : ''}</button>
      <button class="btn big" data-a="promocode">🎟️ Promokod</button>
      <button class="btn big" data-a="transfer">💸 Pul O'tkazish</button>
      <button class="btn big" data-a="online">👥 Do'stlar (${inf.count}/${inf.max || MAX_PLAYERS})</button>
      <button class="btn big" data-a="settings">⚙️ Sozlamalar</button>
      <button class="btn danger big" data-a="lobby">🏠 Bosh menyuga qaytish</button>
    </div>

    ${renderInvitePromoBanner()}

    <div class="section-title">Haydovchi Statistikasi</div>
    <div class="list">
      <div><span>Haydovchi</span><b>${state.name || 'Haydovchi'} (${displayId(inf.id)})</b></div>
      <div><span>Xona</span><b style="color:var(--cyan)">${displayId(inf.host || 'PUBLIC')} (${inf.roomType === 'private' ? 'Private' : 'Ommaviy'})</b></div>
      <div><span>Jami masofa</span><b>${state.totalKm.toFixed(1)} km</b></div>
      <div><span>Garaj</span><b>${state.cars.length} / ${CARS.length} ta mashina</b></div>
      <div><span>Balans</span><b class="plus">${fmt(state.money)}</b></div>
    </div>`);

  bindInvitePromoBanner(body);

  const act = {
    resume: closeModal,
    lobby: () => { closeModal(); game.returnToLobby?.(); },
    online,
    garage: () => open('garage'),
    daily: () => open('daily'),
    promocode: () => open('promocode'),
    transfer: () => open('transfer'),
    map: () => open('map'),
    settings,
  };
  body.querySelectorAll('[data-a]').forEach((b) => (b.onclick = act[b.dataset.a]));
}

// ---------- Multiplayer Xona Tizimi (O) ----------
function online() {
  const inf = onlineInfo();
  const peers = onlineList();
  const myCode = displayId(inf.id);
  const roomCode = inf.host || 'PUBLIC';
  const isPrivate = inf.roomType === 'private' && roomCode !== 'PUBLIC' && !String(roomCode).startsWith('PUBLIC');
  const maxCap = inf.max || (isPrivate ? PRIVATE_MAX_PLAYERS : MAX_PLAYERS);
  const myCar = carById(activeCar().id);

  const statusBadge = {
    off: '<span class="minus">🔴 Ulanmagan</span>',
    connecting: '<span style="color:var(--gold)">🟡 Serverga ulanmoqda...</span>',
    ready: '<span class="plus">🟢 Online tayyor</span>',
    joining: '<span style="color:var(--gold)">🟡 Xonaga ulanmoqda...</span>',
    connected: isPrivate
      ? `<span class="plus">🔒 Do'stlar Xonasi · Kod: <b>${roomCode}</b> (${inf.count}/${maxCap})</span>`
      : `<span class="plus">🌍 Ommaviy Server · ${displayId(roomCode)} (${inf.count}/${maxCap})</span>`,
  }[inf.status] || '';

  const body = showModal('online', `🌐 Multiplayer Xona Tizimi (${inf.count}/${maxCap})`, `
    <div class="list" style="margin-bottom:12px">
      <div id="onlineStatsBar" style="flex-wrap:wrap;gap:8px;background:rgba(0,229,255,0.08);border:1px solid var(--line)">
        <span>🟢 Jami Online: <b>${serverStats.totalOnline}</b></span>
        <span>🌍 Ommaviy Server: <b>${serverStats.publicPlayers}/${serverStats.publicMax}</b></span>
        <span>🔒 Private Xonalar: <b>${serverStats.privateRooms}</b></span>
        <span>⚡ Ping: <b style="color:var(--cyan)">${serverStats.pingMs} ms</b></span>
      </div>
    </div>

    <div class="set-grid">
      <section class="set-card">
        <h3>🌍 Ommaviy Server va Do'stlar Xonasi</h3>
        <div class="id-box">
          <div>
            <small>${isPrivate ? "Do'stlaringizga shu 6 belgili XONA KODINI yuboring:" : 'Joriy ulangan server:'}</small>
            <strong id="myIdCode">${isPrivate ? roomCode : displayId(roomCode)}</strong>
          </div>
          <button class="btn primary" id="copyIdBtn">📋 ${isPrivate ? 'Xona kodini nusxalash' : 'ID nusxalash'}</button>
        </div>

        <div class="row" style="margin-top:8px">
          <button class="btn gold" id="createPrivateBtn">🔒 Do'stlar xonasi yaratish</button>
          <button class="btn primary" id="joinLobbyBtn">🌍 Ommaviy serverga kirish</button>
        </div>
        ${isPrivate ? `<button class="btn danger" id="leaveRoomBtn" style="width:100%;margin-top:8px">🚪 Private xonadan chiqish</button>` : ''}

        <label class="online-lbl" style="margin-top:10px">Haydovchi ismingiz (ID: <b>${myCode}</b>)
          <div class="row" style="margin-top:6px">
            <input id="onlineName" maxlength="18" value="${state.name}" placeholder="Ismingiz..." style="margin:0" />
            <button class="btn" id="saveNameBtn" style="flex:0 0 auto">Saqlash</button>
          </div>
        </label>
        <p class="hint" id="onlineStatusHint" style="margin-top:8px">Holat: ${statusBadge}</p>
      </section>

      <section class="set-card">
        <h3>🔑 Xona kodi yoki do'st ID si</h3>
        <label class="online-lbl">Xona kodi, do'st ID si yoki ismini kiriting:
          <div class="row" style="margin-top:6px">
            <input id="friendIdInput" maxlength="16" placeholder="Kod, ID yoki ism..." style="margin:0;text-transform:uppercase;font-weight:800;letter-spacing:1px" />
            <button class="btn primary" id="joinFriendBtn" style="flex:0 0 auto">🔗 Xonaga kirish</button>
          </div>
        </label>
        <div class="row" style="margin-top:10px">
          <button type="button" class="btn gold" id="openTransferFromOnlineBtn" style="width:100%">💸 Do'stga Pul O'tkazish (P2P)</button>
        </div>
        <p class="hint" style="margin-top:8px">Faqat bitta xonadagi o'yinchilar bir-birini ko'radi va birga Toshkentda hayday oladi.</p>
      </section>
    </div>

    ${renderInvitePromoBanner()}

    <div class="section-title">💰 Do'stlar bilan Depozit Poyga (Garov + 100% O'yin Bonusi)</div>
    <div class="card" style="margin-bottom:12px;border-color:rgba(255,215,64,0.45)">
      <p style="font-size:12px;color:var(--muted)">
        Har ikki o'yinchi virtual valyutada (so'm) garov qo'yadi. O'yin umumiy fondga <b>+100% bonus</b> qo'shadi va g'olib barchasini oladi!
      </p>
      ${(() => {
        const drState = game.getDepositRaceState?.() || {};
        const inv = drState.invite;
        const act = drState.active;
        const myId = playerId();
        if (act) {
          return `<div class="id-box" style="margin:6px 0;border-color:var(--gold)">
            <div>
              <small>Faol Depozit Poyga · Marra: <b>${act.target?.name || 'Marra'}</b></small>
              <strong style="color:var(--gold);font-size:18px">Sovrin: ${fmt(act.totalPrize)}</strong>
            </div>
            <button class="btn danger sm-btn" id="cancelDepRaceBtn">❌ Bekor qilish</button>
          </div>`;
        }
        if (inv && inv.hostId !== myId) {
          return `<div class="id-box" style="margin:6px 0;border-color:var(--green);flex-wrap:wrap">
            <div>
              <small>🏁 <b>${inv.hostName}</b> sizni «${inv.target?.name}» gacha Depozit Poygaga chaqirdi!</small>
              <strong style="color:var(--gold);font-size:16px">Uning garovi: ${fmt(inv.hostDeposit)}</strong>
            </div>
            <div class="row" style="width:100%;margin-top:6px;align-items:center">
              <select id="guestDepSelect" style="margin:0;flex:1">
                <option value="5000000">Garovim: 5 000 000 so'm</option>
                <option value="10000000" selected>Garovim: 10 000 000 so'm</option>
                <option value="25000000">Garovim: 25 000 000 so'm</option>
                <option value="50000000">Garovim: 50 000 000 so'm</option>
              </select>
              <button class="btn gold sm-btn" id="acceptDepRaceBtn" data-rid="${inv.raceId}">✅ Qabul qilish va Start</button>
              <button class="btn danger sm-btn" id="declineDepRaceBtn" data-rid="${inv.raceId}">✕</button>
            </div>
          </div>`;
        }
        if (inv && inv.hostId === myId) {
          return `<div class="id-box" style="margin:6px 0;border-color:var(--cyan)">
            <div>
              <small>Do'stingiz tasdiqlashini kutilmoqda · Marra: <b>${inv.target?.name}</b></small>
              <strong style="color:var(--gold);font-size:16px">Sizning garovingiz: ${fmt(inv.hostDeposit)}</strong>
            </div>
            <button class="btn danger sm-btn" id="cancelDepInviteBtn" data-rid="${inv.raceId}">❌ Bekor qilish (Pul qaytadi)</button>
          </div>`;
        }
        return `<div class="row" style="align-items:center;margin-top:4px">
          <select id="depTargetSelect" style="margin:0;flex:1.1">
            <option value="Tashkent City|${blockC(5)}|${blockC(7)}">📍 Marra: Tashkent City</option>
            <option value="Chorsu Bozori|${blockC(3)}|${blockC(5)}">📍 Marra: Chorsu Bozori</option>
            <option value="Teleminora|${blockC(8)}|${blockC(2)}">📍 Marra: Teleminora</option>
            <option value="Minor Masjidi|${blockC(7)}|${blockC(4)}">📍 Marra: Minor Masjidi</option>
          </select>
          <select id="depAmountSelect" style="margin:0;flex:1">
            <option value="5000000">💰 5 000 000 so'm</option>
            <option value="10000000" selected>💰 10 000 000 so'm</option>
            <option value="25000000">💰 25 000 000 so'm</option>
            <option value="50000000">💰 50 000 000 so'm</option>
          </select>
          <button class="btn gold" id="createDepRaceBtn" style="flex:0 0 auto">🏁 Garovli Poyga E'lon Qilish</button>
        </div>`;
      })()}
    </div>

    <div class="section-title" id="onlinePeersCount">Xonadagi o'yinchilar (${inf.count} / ${maxCap})</div>
    <div class="list" id="onlinePeersList">
      <div>
        <span>🟢 <b>${state.name || 'Siz'}</b> <small style="color:var(--cyan)">(${myCode} · Siz)</small></span>
        <b>${myCar.name}</b>
      </div>
      ${peers.length === 0 ? `<div style="color:var(--muted);justify-content:center">Hozircha xonada boshqa o'yinchi yo'q — do'stingiz xona kodini kiritsa shu yerda paydo bo'ladi!</div>` : peers.map((p) => {
        const c = carById(p.car);
        const spd = Math.round(Math.abs(p.v || 0) * 3.6);
        return `<div>
          <span>🟢 <b>${p.name || 'Haydovchi'}</b> <small style="color:var(--cyan)">(${displayId(p.id)})</small>${p.chat ? ` · <b style="color:var(--gold)">«${p.chat}»</b>` : ''}</span>
          <span style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <small style="color:var(--muted)">${spd} km/h</small>
            <b>${c.name}</b>
            <button class="btn sm-btn" data-tp="${p.id}">📍 Yoniga borish</button>
            <button class="btn sm-btn gold" data-send-cash="${p.id}">💸 Pul o'tkazish</button>
          </span>
        </div>`;
      }).join('')}
    </div>
  `);

  bindInvitePromoBanner(body);

  body.querySelector('#openTransferFromOnlineBtn').onclick = () => open('transfer');

  body.querySelector('#copyIdBtn').onclick = () => {
    const codeToCopy = isPrivate ? roomCode : inf.id;
    navigator.clipboard?.writeText(codeToCopy);
    toast(`Nusxalandi: ${codeToCopy}`, 'ok');
  };
  body.querySelector('#saveNameBtn').onclick = async () => {
    const inp = body.querySelector('#onlineName');
    const saveBtn = body.querySelector('#saveNameBtn');
    const v = inp.value.trim();
    if (!v) return toast('Ismingizni kiriting!', 'err');
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳...';
    const res = await claimUsernameServer(v);
    saveBtn.disabled = false;
    saveBtn.textContent = 'Saqlash';
    if (!res.ok) {
      beep('err');
      toast(res.error || `❌ «${v}» nomi allaqachon band! Boshqa ism tanlang.`, 'err');
      inp.focus();
      return;
    }
    const hn = document.getElementById('hudName'); if (hn) hn.textContent = res.name;
    const mn = document.getElementById('nameInput'); if (mn) mn.value = res.name;
    beep('ok');
    toast(`✅ Ism saqlandi: ${res.name}`, 'ok');
    online();
  };
  body.querySelector('#createPrivateBtn').onclick = async () => {
    try {
      const newCode = await createPrivateRoom();
      navigator.clipboard?.writeText(newCode).catch(() => {});
      beep('ok');
      toast(`🔒 Do'stlar xonasi yaratildi! Kod: ${newCode} (nusxalandi)`, 'cash');
      if (current === 'online') online();
    } catch (e) {
      toast(e.message || "Xona yaratib bo'lmadi", 'err');
    }
  };
  const doJoin = async (code) => {
    try {
      const joined = await joinRoomByCode(code);
      beep('ok');
      toast(`Xonaga ulandingiz: ${displayId(joined)}`, 'ok');
      if (current === 'online') online();
    } catch (e) {
      beep('err');
      toast(e.message || 'Ulanishda xatolik', 'err');
      if (current === 'online') online();
    }
  };
  body.querySelector('#joinFriendBtn').onclick = () => {
    const code = body.querySelector('#friendIdInput').value.trim();
    if (!code) return toast("Xona kodi, do'st ID si yoki ismini kiriting", 'err');
    doJoin(code);
  };
  body.querySelector('#friendIdInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') body.querySelector('#joinFriendBtn').click();
  });
  body.querySelector('#joinLobbyBtn').onclick = async () => {
    try {
      await joinPublicServer();
      beep('ok');
      toast('🌍 Ommaviy serverga ulandingiz!', 'ok');
      if (current === 'online') online();
    } catch (e) {
      toast(e.message || 'Xatolik', 'err');
    }
  };
  const lv = body.querySelector('#leaveRoomBtn');
  if (lv) lv.onclick = () => { leave(); toast('🌍 Ommaviy serverga qaytdingiz', 'ok'); online(); };

  body.querySelectorAll('[data-tp]').forEach((b) => (b.onclick = () => {
    const p = peers.find((x) => x.id === b.dataset.tp);
    if (!p) return;
    game.teleportTo?.(p.x + 3.5, p.z + 3.5, p.h || 0);
    closeModal();
    toast(`${p.name} yoniga o'tdingiz!`, 'ok');
  }));

  body.querySelectorAll('[data-send-cash]').forEach((b) => (b.onclick = () => {
    const p = peers.find((x) => x.id === b.dataset.sendCash);
    if (p) {
      verifiedTarget = { id: p.id, displayId: `TT-${p.id}`, name: p.name || 'Haydovchi', online: true };
    }
    open('transfer');
  }));

  body.querySelectorAll('[data-orace]').forEach((b) => (b.onclick = () => {
    const place = b.dataset.orace;
    const x = Number(b.dataset.rx) || 0;
    const z = Number(b.dataset.rz) || 0;
    sendOnlineEvent({
      type: 'race',
      text: `🏁 ${state.name || 'Haydovchi'} barchani «${place}» gacha poygaga chaqirdi!`,
      target: { x, z, name: place },
    });
    game.setWaypoint?.({ x, z });
    beep('go');
    toast(`🏁 Online poyga marrasi belgilandi: ${place}!`, 'cash');
    closeModal();
  }));

  const createDepBtn = body.querySelector('#createDepRaceBtn');
  if (createDepBtn) {
    createDepBtn.onclick = () => {
      const tVal = body.querySelector('#depTargetSelect')?.value || `Tashkent City|${blockC(5)}|${blockC(7)}`;
      const [tName, tx, tz] = tVal.split('|');
      const dep = Number(body.querySelector('#depAmountSelect')?.value) || 10_000_000;
      if (!spend(dep, `Depozit Poyga garovi (${tName})`)) {
        beep('err');
        return toast("Garov uchun mablag' yetarli emas!", 'err');
      }
      sendOnlineEvent({
        type: 'deposit_race',
        action: 'invite',
        deposit: dep,
        target: { name: tName, x: Number(tx) || 0, z: Number(tz) || 0 },
      });
      beep('cash');
      toast(`🏁 Depozit poyga e'lon qilindi: ${fmt(dep)} garov!`, 'cash');
      setTimeout(() => { if (current === 'online') online(); }, 180);
    };
  }
  const acceptDepBtn = body.querySelector('#acceptDepRaceBtn');
  if (acceptDepBtn) {
    acceptDepBtn.onclick = () => {
      const rid = acceptDepBtn.dataset.rid;
      const dep = Number(body.querySelector('#guestDepSelect')?.value) || 10_000_000;
      if (!spend(dep, 'Depozit Poyga garovi (Qabul qilish)')) {
        beep('err');
        return toast("Garov uchun mablag' yetarli emas!", 'err');
      }
      sendOnlineEvent({
        type: 'deposit_race',
        action: 'accept',
        raceId: rid,
        deposit: dep,
      });
      closeModal();
    };
  }
  const declineDepBtn = body.querySelector('#declineDepRaceBtn');
  if (declineDepBtn) {
    declineDepBtn.onclick = () => {
      sendOnlineEvent({
        type: 'deposit_race',
        action: 'cancel',
        raceId: declineDepBtn.dataset.rid,
      });
      setTimeout(() => { if (current === 'online') online(); }, 180);
    };
  }
  const cancelInvBtn = body.querySelector('#cancelDepInviteBtn');
  if (cancelInvBtn) {
    cancelInvBtn.onclick = () => {
      sendOnlineEvent({
        type: 'deposit_race',
        action: 'cancel',
        raceId: cancelInvBtn.dataset.rid,
      });
      setTimeout(() => { if (current === 'online') online(); }, 180);
    };
  }
  const cancelActBtn = body.querySelector('#cancelDepRaceBtn');
  if (cancelActBtn) {
    cancelActBtn.onclick = () => {
      const dr = game.getDepositRaceState?.()?.active;
      if (dr) {
        sendOnlineEvent({
          type: 'deposit_race',
          action: 'cancel',
          raceId: dr.raceId,
        });
      }
      setTimeout(() => { if (current === 'online') online(); }, 180);
    };
  }

  if (inf.status === 'off') {
    goOnline().then(() => { if (current === 'online') online(); }).catch(() => {});
  }
}

// ---------- 13. SETTINGS VA QO'SHIMCHA MENYU (V9) ----------
function settings() {
  const s = state.settings;
  const seg = (id, items, cur) => `<div class="seg" data-seg="${id}">${items.map(([k, n, d]) => `<button type="button" data-v="${k}" class="${String(cur) === String(k) ? 'on' : ''}"><b>${n}</b>${d ? `<small>${d}</small>` : ''}</button>`).join('')}</div>`;
  const body = showModal('settings', 'Sozlamalar va Boshqaruv', `
    <div class="set-grid">
      <section class="set-card">
        <h3>Grafik Sifati</h3>
        ${seg('quality', [
          ['auto',   'Auto',   'Avtomatik'],
          ['low',    'Low',    'Eng tez'],
          ['medium', 'Medium', "O'rta"],
          ['high',   'High',   'Soyalar + Bloom'],
          ['ultra',  'Ultra',  'Maksimal'],
        ], s.quality || 'high')}
        <p class="hint">Qurilmangiz quvvatiga mos grafik rejimni tanlang.</p>
        <button type="button" class="btn" id="perfAuditBtn" style="width:100%;margin-top:8px">Performance Audit (FPS / Draw Calls — F3)</button>
      </section>

      <section class="set-card">
        <h3>Ovoz va Musiqa</h3>
        <label class="slide"><span>Motor va o'yin ovozi</span><b id="volV">${Math.round((s.volume ?? 0.65) * 100)}%</b><input type="range" id="vol" min="0" max="1" step="0.05" value="${s.volume ?? 0.65}" /></label>
        <label class="slide"><span>Musiqa va muhit balandligi</span><b id="musV">${Math.round((s.musicVolume ?? 0.45) * 100)}%</b><input type="range" id="musVol" min="0" max="1" step="0.05" value="${s.musicVolume ?? 0.45}" /></label>
      </section>

      <section class="set-card">
        <h3>Boshqaruv va Sezgirlik</h3>
        <label class="slide"><span>Burilish sezgirligi</span><b id="steerSensV">${(s.steerSens ?? 1.0).toFixed(1)}</b><input type="range" id="steerSens" min="0.5" max="2.0" step="0.1" value="${s.steerSens ?? 1.0}" /></label>
        <label class="slide"><span>Kamera sezgirligi</span><b id="sensV">${(s.sens ?? 1.0).toFixed(1)}</b><input type="range" id="sens" min="0.3" max="2.5" step="0.1" value="${s.sens ?? 1.0}" /></label>
        <div class="section-title" style="margin-top:8px">Mobil tugmalar o'lchami</div>
        ${seg('touchScale', [
          ['normal', "O'rta", 'Standart'],
          ['large',  'Katta', 'Kattaroq tugmalar'],
        ], s.touchScale || 'normal')}
        <button type="button" class="btn primary" id="landscapeBtn" style="width:100%;margin-top:10px">Gorizontal To'liq Ekran (Landscape)</button>
      </section>

      <section class="set-card">
        <h3>Ekran va Ko'rinish</h3>
        <label class="toggle"><span>FPS ko'rsatkichi</span><input type="checkbox" id="showFpsToggle" ${s.showFps !== false ? 'checked' : ''} /><i></i></label>
        <label class="toggle"><span>Boshqaruv elementlarini ko'rsatish</span><input type="checkbox" id="showHudToggle" ${s.showHud !== false ? 'checked' : ''} /><i></i></label>
        <label class="toggle"><span>Drift tutuni effekti</span><input type="checkbox" id="smoke" ${s.smoke !== false ? 'checked' : ''} /><i></i></label>
        <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line)">
          <button type="button" class="btn danger" id="reset" style="width:100%">Progressni o'chirish va qayta boshlash</button>
        </div>
      </section>

      <section class="set-card set-card-founder" style="grid-column: 1 / -1;">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px">
          <div>
            <h4 style="margin:0 0 4px 0;color:#00e5ff">👑 Zuhriddin Sulaymonov — Loyiha Asoschisi</h4>
            <blockquote style="margin:0;font-size:12.5px;color:rgba(255,255,255,0.8);font-style:italic">
              “Great dreams begin quietly. TUNGI TOSHKENT — a great history is still ahead of us. 🌃”
            </blockquote>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <a href="https://zuhriddin-uz.netlify.app/" target="_blank" rel="noopener noreferrer" class="btn" style="text-decoration:none;font-size:12px;padding:6px 12px;background:rgba(0,229,255,0.15);border:1px solid #00e5ff">🌐 Asoschi Sayti ↗</a>
            <a href="https://t.me/Tungitoshkent3d" target="_blank" rel="noopener noreferrer" class="btn primary" style="text-decoration:none;font-size:12px;padding:6px 14px;background:#0088cc;border-color:#0088cc">✈️ Rasmiy Telegram ↗</a>
          </div>
        </div>
      </section>
    </div>`);

  body.querySelectorAll('[data-seg]').forEach((g) => g.querySelectorAll('button').forEach((b) => (b.onclick = () => {
    g.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    const kind = g.dataset.seg;
    if (kind === 'touchScale') {
      s.touchScale = b.dataset.v;
      applyControl('auto', 'buttons', s.touchScale);
      touch();
    } else if (kind === 'quality') {
      const prev = s.quality;
      const val = b.dataset.v;
      s.quality = val;
      const resolved = val === 'auto' ? (matchMedia('(pointer: coarse)').matches ? 'medium' : 'high') : val;
      touch();
      game.setQuality(resolved, prev);
    }
  })));

  body.querySelector('#landscapeBtn').onclick = () => {
    if (window.__triggerAutoLandscape) {
      window.__triggerAutoLandscape();
    } else {
      document.documentElement.requestFullscreen?.().then(() => {
        screen.orientation?.lock?.('landscape').catch(() => {});
      }).catch(() => {});
      screen.orientation?.lock?.('landscape').catch(() => {});
    }
    toast("Gorizontal rejim faollashtirildi", 'ok');
  };

  body.querySelector('#vol').oninput = (e) => {
    s.volume = +e.target.value;
    body.querySelector('#volV').textContent = Math.round(s.volume * 100) + '%';
    setVolume(s.volume);
    touch();
  };
  body.querySelector('#musVol').oninput = (e) => {
    s.musicVolume = +e.target.value;
    body.querySelector('#musV').textContent = Math.round(s.musicVolume * 100) + '%';
    touch();
  };
  body.querySelector('#steerSens').oninput = (e) => {
    s.steerSens = +e.target.value;
    window.__steerSens = s.steerSens;
    body.querySelector('#steerSensV').textContent = s.steerSens.toFixed(1);
    touch();
  };
  body.querySelector('#sens').oninput = (e) => {
    s.sens = +e.target.value;
    window.__sens = s.sens;
    body.querySelector('#sensV').textContent = s.sens.toFixed(1);
    touch();
  };
  body.querySelector('#showFpsToggle').onchange = (e) => {
    s.showFps = e.target.checked;
    const fpsEl = document.getElementById('hudFps');
    if (fpsEl) fpsEl.style.display = s.showFps ? '' : 'none';
    touch();
  };
  body.querySelector('#showHudToggle').onchange = (e) => {
    s.showHud = e.target.checked;
    document.body.classList.toggle('hide-hud-panels', !s.showHud);
    touch();
  };
  body.querySelector('#smoke').onchange = (e) => {
    s.smoke = e.target.checked;
    touch();
  };
  const paBtn = body.querySelector('#perfAuditBtn');
  if (paBtn) paBtn.onclick = () => { window.__togglePerfAudit?.(); };
  body.querySelector('#reset').onclick = () => {
    if (confirm("Barcha progress (pul, mashinalar) o'chiriladi va 5 mlrd boshlang'ich balans tiklanadi. Davom etasizmi?")) resetSave();
  };
}

function help() {
  const keys = [
    ['W A S D / ↑↓←→', 'Avtomobilni boshqarish (Gaz, Tormoz, Chap, O\'ng)'],
    ['Shift', 'Nitro tezlatgich'],
    ['Space', "Qo'l tormozi"],
    ['Q / Ctrl', 'Drift rejimi'],
    ['G', 'Garaj, Avtosalon va Professional 3D Tuning'],
    ['E', 'Xizmat paneli va Zapravka'],
    ['M', 'Toshkent katta xaritasi va GPS'],
    ['R', 'Poygalar va Tungi Drift musobaqalari'],
    ['T', 'Taksi, Yetkazib berish va Avto-ijara'],
    ['O', "Online Multiplayer va Do'stlar xonasi"],
    ['L', 'Faralarni yoqish / o\'chirish'],
    ['C', "Kamera ko'rinishini almashtirish"],
    ['ESC', 'Pauza va Boshqaruv Markazi'],
    ['Sichqoncha / Surish', 'Kamerani 360° aylantirish'],
  ];
  showModal('help', '⌨ Boshqaruv va Tugmalar', `<div class="keys">${keys.map(([k, d]) => `<div><span class="key">${k}</span>${d}</div>`).join('')}</div>`);
}

function leaderboard() {
  const peers = onlineList();
  const myKm = state.totalKm || 0;
  const rows = [
    { name: state.name || 'Siz (Haydovchi)', car: carById(activeCar().id).name, km: myKm, wins: state.stats?.raceWins || 0, isMe: true },
    ...peers.map((p, idx) => ({
      name: p.name || 'Haydovchi',
      car: carById(p.car).name,
      km: Math.max(2.5, (idx + 1) * 8.4),
      wins: Math.max(1, 3 - idx),
      isMe: false,
    })),
    { name: 'Sardor_UZ', car: 'Lamborghini Aventador', km: 142.8, wins: 19, isMe: false },
    { name: 'Jasur_M4', car: 'BMW M4 GTS', km: 98.4, wins: 14, isMe: false },
    { name: 'Toshkent_King', car: 'Mercedes-AMG G 63', km: 76.2, wins: 11, isMe: false },
    { name: 'Temur_Drift', car: 'BMW M5 CS', km: 54.0, wins: 8, isMe: false },
  ].sort((a, b) => b.km - a.km);

  showModal('leaderboard', '🏆 Toshkent Top Haydovchilari Reytingi', `
    <p style="color:var(--muted);margin-bottom:10px">Toshkent ko'chalarida eng ko'p masofa bosib o'tgan va poygalarda g'olib bo'lgan yetakchi haydovchilar:</p>
    <div class="list">
      ${rows.map((r, i) => `<div style="${r.isMe ? 'border:1px solid var(--cyan);background:rgba(0,229,255,0.12)' : ''}">
        <span><b>#${i + 1}</b> · <b>${r.name}</b> ${r.isMe ? '<small style="color:var(--cyan)">(Siz)</small>' : ''} <small style="color:var(--muted)">· ${r.car}</small></span>
        <span>🏆 <b>${r.wins}</b> g'alaba · <b class="plus">${r.km.toFixed(1)} km</b></span>
      </div>`).join('')}
    </div>
  `);
}

const PANELS = {
  gas: gasStation,
  service,
  daily: dailyRewardsModal,
  promocode: promocodeModal,
  transfer: transferModal,
  garage: () => openGarage({ showModal, toast, closeModal, game }),
  map: bigMap,
  race: races,
  jobs,
  pause,
  online,
  settings,
  help,
  leaderboard,
};

function updateOnlineModalDynamic() {
  if (current !== 'online') return;
  const inf = onlineInfo();
  const peers = onlineList();
  const myCode = displayId(inf.id);
  const roomCode = inf.host || 'PUBLIC';
  const isPrivate = inf.roomType === 'private' && roomCode !== 'PUBLIC' && !String(roomCode).startsWith('PUBLIC');
  const maxCap = inf.max || (isPrivate ? PRIVATE_MAX_PLAYERS : MAX_PLAYERS);
  const myCar = carById(activeCar().id);

  const statsEl = document.getElementById('onlineStatsBar');
  if (statsEl) {
    statsEl.innerHTML = `
      <span>🟢 Jami Online: <b>${serverStats.totalOnline}</b></span>
      <span>🌍 Ommaviy Server: <b>${serverStats.publicPlayers}/${serverStats.publicMax}</b></span>
      <span>🔒 Private Xonalar: <b>${serverStats.privateRooms}</b></span>
      <span>⚡ Ping: <b style="color:var(--cyan)">${serverStats.pingMs} ms</b></span>
    `;
  }

  const countEl = document.getElementById('onlinePeersCount');
  if (countEl) countEl.textContent = `Xonadagi o'yinchilar (${inf.count} / ${maxCap})`;

  const titleEl = document.getElementById('modalTitle');
  if (titleEl && current === 'online') {
    titleEl.textContent = `🌐 Multiplayer Xona Tizimi (${inf.count}/${maxCap})`;
  }

  const peersEl = document.getElementById('onlinePeersList');
  if (peersEl) {
    peersEl.innerHTML = `
      <div>
        <span>🟢 <b>${state.name || 'Siz'}</b> <small style="color:var(--cyan)">(${myCode} · Siz)</small></span>
        <b>${myCar.name}</b>
      </div>
      ${peers.length === 0 ? `<div style="color:var(--muted);justify-content:center">Hozircha xonada boshqa o'yinchi yo'q — do'stingiz xona kodini kiritsa shu yerda paydo bo'ladi!</div>` : peers.map((p) => {
        const c = carById(p.car);
        const spd = Math.round(Math.abs(p.v || 0) * 3.6);
        return `<div>
          <span>🟢 <b>${p.name || 'Haydovchi'}</b> <small style="color:var(--cyan)">(${displayId(p.id)})</small>${p.chat ? ` · <b style="color:var(--gold)">«${p.chat}»</b>` : ''}</span>
          <span style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <small style="color:var(--muted)">${spd} km/h</small>
            <b>${c.name}</b>
            <button class="btn sm-btn" data-tp="${p.id}">📍 Yoniga borish</button>
            <button class="btn sm-btn gold" data-send-cash="${p.id}">💸 Pul o'tkazish</button>
          </span>
        </div>`;
      }).join('')}
    `;
    peersEl.querySelectorAll('[data-tp]').forEach((b) => (b.onclick = () => {
      const p = peers.find((x) => x.id === b.dataset.tp);
      if (!p) return;
      game.teleportTo?.(p.x + 3.5, p.z + 3.5, p.h || 0);
      closeModal();
      toast(`${p.name} yoniga o'tdingiz!`, 'ok');
    }));
    peersEl.querySelectorAll('[data-send-cash]').forEach((b) => (b.onclick = () => {
      const p = peers.find((x) => x.id === b.dataset.sendCash);
      if (p) {
        verifiedTarget = { id: p.id, displayId: `TT-${p.id}`, name: p.name || 'Haydovchi', online: true };
      }
      open('transfer');
    }));
  }
}

onOnline((ev) => {
  if (ev.economyUpdate) {
    applyServerTransferPush(ev.economyUpdate);
    const upd = ev.economyUpdate;
    if (upd.tx) {
      beep('cash');
      toast(`💸 ${upd.tx.fromName} (TT-${upd.tx.fromId}) sizga +${fmt(upd.tx.amount)} o'tkazdi!`, 'cash');
    } else if (upd.kind === 'race_won') {
      beep('cash');
      toast(upd.text || `🏁 Poygada g'olib bo'ldingiz! +${fmt(upd.amount)}`, 'cash');
    } else if (upd.kind === 'deposit_race_refund') {
      toast(upd.reason || `Garov qaytarildi: +${fmt(upd.refund)}`, 'ok');
    } else if (upd.kind === 'deposit_race_escrow') {
      toast(upd.text || `Poyga depoziti bloklandi: ${fmt(upd.delta)}`, 'ok');
    } else if (upd.kind === 'error') {
      toast(upd.text || 'Xatolik yuz berdi', 'err');
    }
    if (current === 'transfer') transferModal();
    return;
  }
  if (ev.join) toast(`🌐 ${ev.join} o'yinga qo'shildi!`, 'ok');
  if (ev.leave) toast(`🌐 ${ev.leave} o'yindan chiqdi`, 'err');
  if (ev.left === 'host') toast('🌐 Xona egasi chiqib ketdi', 'err');
  if (ev.raceEvent) {
    beep('go');
    toast(ev.raceEvent.text || '🏁 Online Poyga boshlandi!', 'cash');
    if (ev.raceEvent.target) game?.setWaypoint?.({ x: ev.raceEvent.target.x, z: ev.raceEvent.target.z });
  }
  if (current === 'online') {
    if (ev.roomChanged || ev.depositRace) {
      const activeTag = document.activeElement?.tagName;
      if (activeTag !== 'INPUT' && activeTag !== 'SELECT') {
        online();
        return;
      }
    }
    updateOnlineModalDynamic();
  }
});
