// ============================================================================
// TUNGI TOSHKENT — OPEN WORLD LIFE SIMULATOR MODULE
// 1) 5-Bosqichli Ko'chmas Mulk va 3D Yunusobod Luxury VIP Villa (Basseyn, Bog', Garaj, Interyer)
// 2) "Toshkentda Yangi Hayot" — 6 Bobli Syujet Kampaniyasi (Story Campaign + NPC Dialoglar)
// 3) O'yin Ichidagi Smartfon (10 ta ilova: Xarita, Bank, Ishlar, Uylar, Syujet, Garaj, Poyga, Kontakt, Xabar, Saqlash)
// ============================================================================
import * as THREE from 'three';
import { blockC, roadC, addCollider } from './world/layout.js';
import { nightMats } from './world/city.js';
import {
  state,
  save,
  addMoney,
  spend,
  activeCar,
  getGameMode,
  setGameMode,
  getSpSlot,
  getSpSlotSummary,
  touch,
} from './state.js';
import { CARS, carById, fmt } from './config.js';
import { MISSIONS, startMission, startCustomMission } from './missions.js';
import { beep } from './audio.js';
import { list as onlineList, chatHistory, sendChat } from './online.js';

export const HOUSING_PROPERTIES = [
  {
    id: 'apt_chilonzor',
    level: 1,
    name: '1-Daraja: Chilonzor Studiya Kvartira',
    district: 'Chilonzor tumani',
    price: 0,
    garageSlots: 1,
    desc: 'Boshlang\'ich kichik kvartira va hovli parkovkasi. Toshkentdagi yangi hayotingiz shu yerdan boshlanadi.',
    x: blockC(3) + 26,
    z: blockC(11) - 32,
    spawnX: roadC(3) + 6,
    spawnZ: blockC(11) - 20,
    heading: 0,
  },
  {
    id: 'apt_shayxontohur',
    level: 2,
    name: '2-Daraja: Shayxontohur 2-Xonali Kvartira',
    district: 'Shayxontohur (Chorsu yaqinida)',
    price: 45_000_000,
    garageSlots: 2,
    desc: 'Ta\'mirlangan shinam kvartira, zamonaviy mebel va 2 mashinali yopiq parkovka.',
    x: blockC(2) - 24,
    z: blockC(6) + 28,
    spawnX: roadC(2) + 6,
    spawnZ: blockC(6) + 18,
    heading: 0,
  },
  {
    id: 'apt_tashkentcity',
    level: 3,
    name: '3-Daraja: Tashkent City Modern Apartament',
    district: 'Tashkent City (Nest One yonida)',
    price: 160_000_000,
    garageSlots: 3,
    desc: 'Panoramik oynali biznes-klass apartament va 3 mashinali yerosti VIP garaji.',
    x: blockC(4) + 28,
    z: blockC(8) - 28,
    spawnX: roadC(5) - 6,
    spawnZ: blockC(8) - 15,
    heading: Math.PI,
  },
  {
    id: 'house_mirzo',
    level: 4,
    name: '4-Daraja: Mirzo Ulug\'bek Shaxsiy Hovli Uy',
    district: 'Mirzo Ulug\'bek tumani',
    price: 420_000_000,
    garageSlots: 4,
    desc: 'Ikki qavatli shaxsiy kottej, yashil hovli, darvoza va 4 mashinali shaxsiy garaj.',
    x: blockC(11) - 26,
    z: blockC(6) - 26,
    spawnX: roadC(11) + 6,
    spawnZ: blockC(6) - 16,
    heading: 0,
  },
  {
    id: 'villa_yunusobod',
    level: 5,
    name: '5-Daraja: Yunusobod Luxury VIP Villa',
    district: 'Yunusobod (Teleminora & Yapon bog\'i yonida)',
    price: 1_200_000_000,
    garageSlots: 8,
    desc: 'Hashamatli 3D VIP Villa: mehmonxona, yotoqxona, oshxona, panoramik oynalar, suzish havzasi (basseyn), bog\' va ko\'p mashinali garaj!',
    x: blockC(10),
    z: blockC(2) + 20,
    spawnX: blockC(10),
    spawnZ: blockC(2) + 38,
    heading: Math.PI,
  },
];

export const STORY_CAMPAIGN = [
  {
    step: 0,
    title: '1-Bob: Toshkentga Qadam',
    npc: 'Rustam aka (Chilonzor oqsoqoli)',
    dialogue: '«Toshkentga xush kelibsan, uka! Avval shahar markazidagi Avtosalonga borib, mashinangni tekshirtirib ol.»',
    objective: 'Chilonzordan Markaziy Avtosalongacha yetib boring.',
    reward: 10_000_000,
    limit: 140,
    points: [
      { x: roadC(5), z: roadC(9), label: 'Bunyodkor shoh ko\'chasi' },
      { x: roadC(8), z: roadC(6), label: 'Markaziy Avtosalon' },
    ],
  },
  {
    step: 1,
    title: '2-Bob: Chorsu Express',
    npc: 'Dilshod oshpaz (Milliy Taomlar)',
    dialogue: '«Chorsudan Tashkent City ofisiga issiq buyurtmani vaqtida yetkazib bersang, yaxshi haq to\'layman!»',
    objective: 'Chorsu bozoridan yukni olib, Tashkent City ga yetkazing.',
    reward: 18_000_000,
    limit: 130,
    points: [
      { x: roadC(2), z: roadC(5), label: 'Chorsu Bozori' },
      { x: roadC(5), z: roadC(7), label: 'Tashkent City' },
    ],
  },
  {
    step: 2,
    title: '3-Bob: Ustaxona va Ishonch',
    npc: 'Usta Bahrom (Bosh mexanik)',
    dialogue: '«Bu mashinaning motorini yangiladik. Amir Temur xiyobonidan Minor masjidigacha tezlikda sinab ber!»',
    objective: 'Amir Temur xiyobonidan Minor masjidigacha sinov haydovini bajaring.',
    reward: 30_000_000,
    limit: 120,
    points: [
      { x: roadC(9), z: roadC(7), label: 'Amir Temur Xiyoboni' },
      { x: roadC(7), z: roadC(4), label: 'Minor Masjidi' },
    ],
  },
  {
    step: 3,
    title: '4-Bob: VIP Mehmon',
    npc: 'Lola (Hilton menejeri)',
    dialogue: '«Xorijlik VIP mehmonimizni Tashkent City dan Toshkent Teleminorasiga kechikmasdan olib borish kerak.»',
    objective: 'Tashkent City -> Mustaqillik -> Teleminora yo\'nalishida harakatlaning.',
    reward: 50_000_000,
    limit: 135,
    points: [
      { x: roadC(5), z: roadC(7), label: 'Tashkent City Hilton' },
      { x: roadC(7), z: roadC(7), label: 'Mustaqillik Maydoni' },
      { x: roadC(8), z: roadC(1), label: 'Toshkent Teleminorasi' },
    ],
  },
  {
    step: 4,
    title: '5-Bob: Tungi Shoh Ko\'cha',
    npc: 'Timur (Street Racing yetakchisi)',
    dialogue: '«Endi seni shaharda hamma taniydi! Magic City dan Amir Temur xiyobonigacha rekord vaqt ko\'rsat!»',
    objective: 'Magic City -> Oybek -> Amir Temur sprintini yakunlang.',
    reward: 90_000_000,
    limit: 120,
    points: [
      { x: roadC(4), z: roadC(10), label: 'Magic City' },
      { x: roadC(7), z: roadC(10), label: 'Oybek ko\'chasi' },
      { x: roadC(9), z: roadC(7), label: 'Amir Temur Xiyoboni' },
    ],
  },
  {
    step: 5,
    title: '6-Bob: Toshkent Qiroli',
    npc: 'Sardor (VIP Klub asoschisi)',
    dialogue: '«Sen Toshkentda o\'z hayotingni noldan qurding! Final sinovdan o\'t va Yunusobod VIP Villasiga yo\'l ol!»',
    objective: 'Kokobango Club -> Tashkent City -> Yunusobod VIP Villa marshrutini yakunlang.',
    reward: 200_000_000,
    limit: 150,
    points: [
      { x: roadC(8), z: roadC(7), label: 'Kokobango Club' },
      { x: roadC(4), z: roadC(7), label: 'Tashkent City Nest One' },
      { x: blockC(10), z: blockC(2) + 36, label: 'Yunusobod VIP Villa' },
    ],
  },
];

export const NPC_CONTACTS = [
  {
    id: 'rustam',
    name: 'Rustam aka',
    role: 'Chilonzor Taksi & Mahalla Oqsoqoli',
    phone: '+998 90 101-22-33',
    shortCode: '101',
    msg: 'Taksi buyurtma, Syujet topshirig\'i yoki moliyaviy yordam uchun qo\'ng\'iroq qiling.',
    greeting: '«Alo, assalomu alaykum uka! Tinchmisan? Qanday yordam kerak?»',
    btnLabel: '📞 Qo\'ng\'iroq qilish',
    options: [
      { act: 'rustam_taxi', label: '🚕 «Rustam aka, menga hozir Taksi mijozi topib bering!» (Bepul)' },
      { act: 'rustam_story', label: '📖 «Keyingi Syujet topshirig\'ini boshlamoqchiman»' },
      { act: 'rustam_help', label: '💵 «cho\'ntagimda pul kam qoldi, 3 mln so\'m yordam bering» (Balans < 5 mln bo\'lsa)' },
    ],
  },
  {
    id: 'bahrom',
    name: 'Usta Bahrom',
    role: '24/7 Mobil Avtoservis & Benzin',
    phone: '+998 93 555-01-01',
    shortCode: '555',
    msg: 'Yo\'lda mashina buzilsa yoki benzin tugasa, turgan joyingizda tuzatib beradi.',
    greeting: '«Alo, Usta Bahrom eshitadi! Mashinangga nima bo\'ldi, uka?»',
    btnLabel: '📞 Qo\'ng\'iroq qilish',
    options: [
      { act: 'bahrom_full', label: '🔧 «Turgan joyimda 100% ta\'mir + To\'liq bak benzin quyib bering» (1 500 000 so\'m)' },
      { act: 'bahrom_fuel', label: '⛽ «Faqat bakni to\'ldirib benzin yetkazib bering» (600 000 so\'m)' },
      { act: 'bahrom_job', label: '🛠️ «Ustaxonangizda Mobil Mexanik bo\'lib pul ishlamoqchiman»' },
    ],
  },
  {
    id: 'lola',
    name: 'Lola',
    role: 'Tashkent City VIP Menedjer',
    phone: '+998 99 777-88-99',
    shortCode: '777',
    msg: 'Yuqori daromadli VIP haydovchi va tez yetkazib berish buyurtmalari.',
    greeting: '«Alo! Tashkent City VIP xizmati. Qaysi buyurtmani ulaymiz?»',
    btnLabel: '📞 Qo\'ng\'iroq qilish',
    options: [
      { act: 'lola_vip', label: '🕴️ «Shaxsiy VIP Mijoz tashish buyurtmasini bering» (Katta to\'lov)' },
      { act: 'lola_food', label: '🍔 «Tezkor Ovqat Yetkazish (Food Delivery) buyurtmasini bering»' },
      { act: 'lola_club', label: '🎧 «Kokobango Club manzilini GPS xaritaga belgilab bering»' },
    ],
  },
  {
    id: 'timur',
    name: 'Timur',
    role: 'Tungi Poyga Klubi Yetakchisi',
    phone: '+998 97 707-07-07',
    shortCode: '707',
    msg: 'Istalgan joydan turib 1v1 Duel, Drag Racing yoki Drift poygasini chaqirish.',
    greeting: '«Alo brat! Motor qizigan bo\'lsa, qaysi poygaga raqib chiqaray?»',
    btnLabel: '📞 Qo\'ng\'iroq qilish',
    options: [
      { act: 'timur_duel', label: '🏁 «1v1 Tungi Duelga kuchli raqib chiqar!»' },
      { act: 'timur_drag', label: '🚀 «402m Drag Racing boshlaymiz!»' },
      { act: 'timur_drift', label: '💨 «Tungi Drift musobaqasini yoq!»' },
    ],
  },
  {
    id: 'evakuator',
    name: 'Tezkor Evakuator 911',
    role: '24/7 Evakuatsiya va Teleport Xizmati',
    phone: '+998 71 200-09-11',
    shortCode: '911',
    msg: 'Mashina tiqilib qolsa, darhol Markaziy Avtosalon yoki Uyingiz oldiga olib boradi.',
    greeting: '«Toshkent 911 Evakuator xizmati! Mashinangizni qayerga yetkazamiz?»',
    btnLabel: '📞 Qo\'ng\'iroq qilish',
    options: [
      { act: 'evak_salon', label: '🏢 «Markaziy Avtosalon va Garaj oldiga olib boring» (1 000 000 so\'m)' },
      { act: 'evak_home', label: '🏠 «O\'zimning Uyim / Villam oldiga olib boring» (1 000 000 so\'m)' },
      { act: 'evak_job', label: '🪝 «O\'zim Evakuator haydovchisi bo\'lib pul ishlamoqchiman»' },
    ],
  },
];

let activeCallNpcId = null;

export function getActiveProperty() {
  const id = state.activeProperty || 'apt_chilonzor';
  return HOUSING_PROPERTIES.find((p) => p.id === id) || HOUSING_PROPERTIES[0];
}

// ============================================================================
// 3D YUNUSOBOD LUXURY VIP VILLA & KO'CHMAS MULK BELGILARI
// ============================================================================
export function buildHousing3D(scene) {
  const g = new THREE.Group();
  g.name = 'TashkentHousing3D';
  scene.add(g);

  const box = new THREE.BoxGeometry(1, 1, 1);
  const mWhite = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.28, metalness: 0.25 });
  const mDark = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.35, metalness: 0.65 });
  const mWood = new THREE.MeshStandardMaterial({ color: 0x7c3f1c, roughness: 0.55, metalness: 0.15 });
  const mGold = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.22, metalness: 0.88 });
  const mGlass = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.08, metalness: 0.85, transparent: true, opacity: 0.52 });
  const mPool = new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x0891b2, emissiveIntensity: 0.65, roughness: 0.12, metalness: 0.4 });
  const mWarm = new THREE.MeshStandardMaterial({ color: 0xfff7ed, emissive: 0xfbbf24, emissiveIntensity: 0.75, roughness: 0.25 });
  nightMats.push({ mat: mPool, base: 1.4, day: 0.5 });
  nightMats.push({ mat: mWarm, base: 1.6, day: 0.4 });

  const addB = (sx, sy, sz, x, y, z, mat) => {
    const m = new THREE.Mesh(box, mat);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };

  // 5-Daraja: Yunusobod Luxury VIP Villa (blockC(10), blockC(2) + 20)
  const vx = blockC(10);
  const vz = blockC(2) + 18;

  // Villa hovli plitasi va devorlari
  addB(36, 0.16, 30, vx, 0.08, vz, mDark);
  // 1-qavat (Mehmonxona, Oshxona, Vanna) + panoramik oyna + ichki mebel/yorug'lik
  addB(20, 4.2, 12, vx - 4, 2.1, vz - 5, mWhite);
  addB(18.6, 3.6, 0.25, vx - 4, 2.0, vz + 1.05, mGlass);
  addB(17.5, 0.2, 9.5, vx - 4, 3.85, vz - 5, mWarm); // Ichki shift nuri
  // Ichki divan va stol (oynadan ko'rinadi)
  addB(4.5, 0.75, 1.6, vx - 7, 0.55, vz - 4.5, mWood);
  addB(2.4, 0.85, 2.2, vx, 0.6, vz - 5.2, mDark);

  // 2-qavat (Yotoqxona + Balkon terrasasi)
  addB(15, 3.8, 10, vx - 5.5, 6.1, vz - 5.5, mWhite);
  addB(16.2, 0.35, 11.4, vx - 5.5, 8.1, vz - 5.2, mDark);
  addB(13.8, 3.1, 0.25, vx - 5.5, 6.0, vz - 0.45, mGlass);
  addB(13.0, 0.18, 8.0, vx - 5.5, 7.65, vz - 5.5, mWarm);

  // Ko'p mashinali shaxsiy garaj qanoti (o'ng tomonda)
  addB(11, 3.9, 11, vx + 11.5, 1.95, vz - 5, mDark);
  addB(11.6, 0.3, 12.2, vx + 11.5, 4.05, vz - 4.8, mWhite);
  addB(4.2, 2.9, 0.28, vx + 9.0, 1.55, vz + 0.55, mGlass);
  addB(4.2, 2.9, 0.28, vx + 14.0, 1.55, vz + 0.55, mGlass);

  // Yoritilgan Suzish Havzasi (Swimming Pool — old hovlida)
  addB(12.4, 0.24, 6.4, vx - 5.5, 0.18, vz + 6.8, mWhite);
  addB(11.4, 0.28, 5.4, vx - 5.5, 0.22, vz + 6.8, mPool);

  //Shaxsiy kirish yo'lagi (Driveway) va Oltin Darvoza ustunlari
  addB(8.5, 0.18, 12, vx + 11.5, 0.09, vz + 7.2, mWood);
  addB(0.8, 2.6, 0.8, vx + 7.0, 1.3, vz + 12.8, mGold);
  addB(0.8, 2.6, 0.8, vx + 16.0, 1.3, vz + 12.8, mGold);

  addCollider(vx - 15, vz - 12, vx + 17.5, vz + 1.2, 'building');

  // Barcha 5 ta uy oldida ko'rinib turuvchi oltin/yashil 3D Uy halqasi
  const ringGeo = new THREE.RingGeometry(2.4, 2.95, 32).rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.68, depthWrite: false });
  for (const prop of HOUSING_PROPERTIES) {
    const rm = new THREE.Mesh(ringGeo, ringMat);
    rm.position.set(prop.spawnX, 0.28, prop.spawnZ);
    g.add(rm);
  }
}

// ============================================================================
// O'YIN ICHIDAGI SMARTFON INTERFEYSI (10 TA ILOVA)
// ============================================================================
let currentPhoneApp = 'home';

export function openSmartphoneModal(ui, game, initialApp = 'home') {
  currentPhoneApp = initialApp || 'home';
  const mode = getGameMode();
  const modeBadge = mode === 'single' ? '🏠 SINGLE PLAYER (Hayot & Syujet)' : '🌐 MULTIPLAYER (Online Server)';
  const body = ui.showModal('phone', `📱 Smartfon · ${modeBadge}`, '');
  renderPhone(body, ui, game);
}

function renderPhone(body, ui, game) {
  const mode = getGameMode();
  const activeHome = getActiveProperty();
  const curCar = carById(activeCar().id);
  const nextStory = STORY_CAMPAIGN[Math.min(state.storyStep || 0, STORY_CAMPAIGN.length - 1)];
  const allStoryDone = (state.storyStep || 0) >= STORY_CAMPAIGN.length;

  const apps = [
    ['home', '📱 Asosiy'],
    ['story', '📖 Syujet'],
    ['jobs', '🚕 Ishlar (9)'],
    ['homes', '🏠 Uylar (5)'],
    ['bank', '🏦 Bank'],
    ['cars', '🚘 Garajim'],
    ['races', '🏁 Poyga (6)'],
    ['contacts', '👥 Kontakt'],
    ['messages', '💬 Xabar'],
    ['saves', '💾 Saqlash'],
  ];

  let content = '';
  if (currentPhoneApp === 'home') {
    content = `
      <div class="ph-hero-card">
        <div>
          <small>${mode === 'single' ? 'SHAXSIY HAYOT REJIMI (OFFLINE)' : 'OMMAVIY SERVER REJIMI (ONLINE)'}</small>
          <h3>${state.name || 'Haydovchi'}</h3>
          <div class="ph-balances">
            <span>💵 Hamyon: <b class="gold-txt">${fmt(state.money)}</b></span>
            <span>🏦 Bank: <b class="cyan-txt">${fmt(state.bankBalance || 0)}</b></span>
          </div>
          <div style="font-size:12px;opacity:.85;margin-top:4px">
            🏠 Uy: <b>${activeHome.name}</b> · 🚘 Mashina: <b>${curCar.name}</b>
          </div>
        </div>
      </div>
      <div class="ph-app-grid">
        ${apps.slice(1).map(([id, lbl]) => `<button type="button" class="ph-app-tile" data-papp="${id}">${lbl}</button>`).join('')}
        <button type="button" class="ph-app-tile" data-popen="map">🗺️ GPS Xarita</button>
        <button type="button" class="ph-app-tile" data-popen="settings">⚙️ Sozlamalar</button>
      </div>
    `;
  } else if (currentPhoneApp === 'story') {
    content = `
      <div class="section-title">📖 «Toshkentda Yangi Hayot» — Syujet Kampaniyasi (${Math.min(state.storyStep || 0, STORY_CAMPAIGN.length)}/${STORY_CAMPAIGN.length})</div>
      <div class="list">
        ${STORY_CAMPAIGN.map((ch) => {
          const done = (state.storyStep || 0) > ch.step;
          const isCur = (state.storyStep || 0) === ch.step;
          return `
            <div class="row" style="border-left:3px solid ${done ? '#4ade80' : isCur ? '#38bdf8' : '#475569'}">
              <div>
                <b>${done ? '✔ ' : isCur ? '▶ ' : '🔒 '}${ch.title}</b>
                <small style="display:block;color:#fde047">${ch.npc}: ${ch.dialogue}</small>
                <small>Vazifa: ${ch.objective} · Mukofot: <b>${fmt(ch.reward)}</b></small>
              </div>
              ${isCur || done ? `<button type="button" class="btn ${isCur ? 'primary' : ''}" data-start-story="${ch.step}">${done ? 'Qayta' : 'Boshlash'}</button>` : ''}
            </div>
          `;
        }).join('')}
      </div>
      ${allStoryDone ? `<div class="toast ok" style="margin-top:8px">🏆 Tabriklaymiz! Barcha 6 ta syujet bobini muvaffaqiyatli yakunladingiz!</div>` : ''}
    `;
  } else if (currentPhoneApp === 'jobs') {
    const jobEntries = Object.entries(MISSIONS).filter(([, v]) => v.cat === 'job');
    content = `
      <div class="section-title">🚕 Toshkent Kasblari va Ish Tizimi (9 xil faoliyat)</div>
      <div class="list">
        ${jobEntries.map(([k, v]) => `
          <div class="row">
            <div>
              <b>${v.name}</b>
              <small>${v.desc} · Baza: <b>${fmt(v.base || 3_500_000)}+</b></small>
            </div>
            <button type="button" class="btn primary" data-start-job="${k}">Ishni boshlash</button>
          </div>
        `).join('')}
      </div>
    `;
  } else if (currentPhoneApp === 'homes') {
    const owned = new Set(state.ownedProperties || ['apt_chilonzor']);
    content = `
      <div class="section-title">🏠 Ko'chmas Mulk va Uy-Joy Bosqichlari (1–5 Daraja)</div>
      <div class="list">
        ${HOUSING_PROPERTIES.map((h) => {
          const has = owned.has(h.id) || h.price === 0;
          const isAct = (state.activeProperty || 'apt_chilonzor') === h.id;
          return `
            <div class="row" style="border-left:3px solid ${isAct ? '#facc15' : has ? '#4ade80' : '#38bdf8'}">
              <div>
                <b>${h.name} ${isAct ? '⭐ (Asosiy Uy)' : ''}</b>
                <small>${h.district} · Garaj: <b>${h.garageSlots} mashina</b> · ${h.price ? fmt(h.price) : 'Bepul'}</small>
                <small style="display:block;opacity:.8">${h.desc}</small>
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                ${has
                  ? `<button type="button" class="btn primary" data-visit-home="${h.id}">📍 Uyga borish</button>`
                  : `<button type="button" class="btn gold" data-buy-home="${h.id}">Sotib olish (${fmt(h.price)})</button>`}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } else if (currentPhoneApp === 'bank') {
    content = `
      <div class="section-title">🏦 Toshkent Milliy Banki · Hisob Boshqaruvi</div>
      <div class="row">
        <div><b>💵 Naqd hamyon:</b> <span class="gold-txt">${fmt(state.money)}</span></div>
        <div><b>🏦 Bank omonati:</b> <span class="cyan-txt">${fmt(state.bankBalance || 0)}</span></div>
      </div>
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px">
        <button type="button" class="btn primary" data-bank-dep="10000000">➕ 10 mln Bankka qo'yish</button>
        <button type="button" class="btn primary" data-bank-dep="100000000">➕ 100 mln Bankka qo'yish</button>
        <button type="button" class="btn" data-bank-with="10000000">➖ 10 mln Yechish</button>
        <button type="button" class="btn" data-bank-with="all">➖ Barchasini yechish</button>
      </div>
      <div class="section-title" style="margin-top:12px">Oxirgi Moliyaviy Operatsiyalar</div>
      <div class="list">
        ${(state.tx || []).slice(0, 8).map((t) => `
          <div class="row">
            <small>${t.reason || 'Operatsiya'}</small>
            <b style="color:${t.amount >= 0 ? '#4ade80' : '#fb7185'}">${t.amount >= 0 ? '+' : ''}${fmt(t.amount)}</b>
          </div>
        `).join('') || '<small>Operatsiyalar tarixi bo\'sh</small>'}
      </div>
    `;
  } else if (currentPhoneApp === 'cars') {
    content = `
      <div class="section-title">🚘 Shaxsiy Avtopark (${state.cars.length} ta mashina)</div>
      <div class="list">
        ${state.cars.map((c) => {
          const cfg = carById(c.id);
          const isAct = c.uid === state.activeUid;
          return `
            <div class="row">
              <div>
                <b>${cfg.name} ${isAct ? '⭐ (Faol)' : ''}</b>
                <small>Yoqilg'i: ${Math.round(c.fuelL || 0)}/${cfg.tank} L · Raqam: ${(c.plate || '01|A 777 AA').replace('|', ' ')}</small>
              </div>
              <div style="display:flex;gap:6px">
                ${!isAct ? `<button type="button" class="btn primary" data-sel-car="${c.uid}">Chaqirish</button>` : ''}
                <button type="button" class="btn" data-popen="garage">Garaj & Tuning</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } else if (currentPhoneApp === 'races') {
    const raceEntries = Object.entries(MISSIONS).filter(([, v]) => v.cat === 'race');
    content = `
      <div class="section-title">🏁 Shahar Poygalari (6 xil musobaqa)</div>
      <div class="list">
        ${raceEntries.map(([k, v]) => `
          <div class="row">
            <div>
              <b>${v.name}</b>
              <small>${v.desc}</small>
            </div>
            <button type="button" class="btn primary" data-start-job="${k}">Start (${v.fee ? fmt(v.fee) : 'Bepul'})</button>
          </div>
        `).join('')}
      </div>
    `;
  } else if (currentPhoneApp === 'contacts') {
    const peers = onlineList();
    const callingNpc = NPC_CONTACTS.find((c) => c.id === activeCallNpcId);
    if (callingNpc) {
      content = `
        <div class="ph-hero-card" style="border-color:#4ade80;background:linear-gradient(145deg,rgba(6,78,59,0.55),rgba(15,23,42,0.95))">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
            <div>
              <small style="color:#4ade80;font-weight:800">📲 QO'NG'IROQ DAVOM ETMOQDA · ALOQADA</small>
              <h3 style="margin:4px 0">👤 ${callingNpc.name}</h3>
              <small style="color:#fde047">${callingNpc.phone} · ${callingNpc.role}</small>
            </div>
            <button type="button" class="btn danger" id="phHangupBtn">📕 Go'shakni qo'yish</button>
          </div>
          <div style="margin-top:12px;padding:12px 14px;border-radius:12px;background:rgba(0,0,0,0.42);border-left:3px solid #38bdf8;color:#f8fafc;font-size:13.5px">
            🗣️ <b>${callingNpc.name}:</b> ${callingNpc.greeting}
          </div>
          <div class="section-title" style="margin-top:12px">Javobingizni tanlang (Xizmatdan foydalanish):</div>
          <div class="list">
            ${callingNpc.options.map((opt) => `
              <button type="button" class="btn primary" data-call-opt="${opt.act}" style="width:100%;text-align:left;padding:11px 14px;justify-content:flex-start">
                ${opt.label}
              </button>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      content = `
        <div class="section-title">🔢 Raqam terib qo'ng'iroq qilish yoki ro'yxatdan tanlash</div>
        <div class="row" style="gap:8px;margin-bottom:10px;flex-wrap:wrap">
          <input id="phDialInput" placeholder="Raqam yoki qisqa kod (masalan: 101, 555, 777, 707, 911)..." style="flex:1;min-width:200px;padding:9px 12px;border-radius:10px;background:#0f172a;color:#fff;border:1px solid rgba(56,189,248,0.4)" />
          <button type="button" class="btn primary" id="phDialBtn" style="background:linear-gradient(135deg,#16a34a,#15803d)">📞 Chaqirish</button>
        </div>
        <div class="section-title">👥 Toshkent Tezkor Xizmat Kontaktlari (Bosib qo'ng'iroq qiling)</div>
        <div class="list">
          ${NPC_CONTACTS.map((c) => `
            <div class="row" style="align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
              <div style="flex:1;min-width:210px">
                <b>👤 ${c.name}</b> <small>(${c.role})</small>
                <div style="color:#fde047;font-weight:800;font-size:13px;margin:2px 0">📱 ${c.phone} <small style="color:#94a3b8">(Qisqa kod: <b>${c.shortCode}</b>)</small></div>
                <small style="display:block;color:#38bdf8">${c.msg}</small>
              </div>
              <button type="button" class="btn primary" data-call-npc="${c.id}" style="background:linear-gradient(135deg,#16a34a,#059669);border-color:#4ade80;font-weight:800">
                ${c.btnLabel}
              </button>
            </div>
          `).join('')}
        </div>
        ${mode === 'multi' ? `
          <div class="section-title" style="margin-top:12px">🌐 Online Do'stlar (${peers.length} ta)</div>
          <div class="list">
            ${peers.map((p) => `
              <div class="row">
                <div><b>🟢 ${p.name || 'Haydovchi'}</b> <small>${carById(p.car || 'malibu').name}</small></div>
                <button type="button" class="btn primary" data-tp-peer="${p.id}">📍 Yoniga borish</button>
              </div>
            `).join('') || '<small>Hozircha xonada boshqa o\'yinchilar yo\'q</small>'}
          </div>
        ` : ''}
      `;
    }
  } else if (currentPhoneApp === 'messages') {
    content = `
      <div class="section-title">💬 Xabarlar va Chat</div>
      <div class="list" style="max-height:210px;overflow-y:auto">
        ${STORY_CAMPAIGN.slice(0, (state.storyStep || 0) + 1).map((ch) => `
          <div class="row"><div><b>📩 ${ch.npc}</b><small style="display:block">${ch.dialogue}</small></div></div>
        `).join('')}
        ${(chatHistory || []).slice(-6).map((m) => `
          <div class="row"><div><b>💬 ${m.fromName}:</b> <small>${m.text}</small></div></div>
        `).join('')}
      </div>
      ${mode === 'multi' ? `
        <div style="display:flex;gap:6px;margin-top:8px">
          <input id="phChatInp" placeholder="Online chatga xabar yozish..." style="flex:1;padding:8px;border-radius:8px;background:#0f172a;color:#fff;border:1px solid #38bdf8" />
          <button type="button" class="btn primary" id="phChatSend">Yuborish</button>
        </div>
      ` : ''}
    `;
  } else if (currentPhoneApp === 'saves') {
    const slots = [0, 1, 2].map(getSpSlotSummary);
    content = `
      <div class="section-title">💾 Saqlash Slotlari va O'yin Rejimi</div>
      <div class="row">
        <div><b>Joriy rejim:</b> ${mode === 'single' ? `🏠 Single Player (Slot #${getSpSlot() + 1})` : '🌐 Multiplayer (Online Server)'}</div>
        <button type="button" class="btn primary" id="phSaveNowBtn">💾 Hozir saqlash</button>
      </div>
      <div class="section-title" style="margin-top:10px">🏠 Single Player — 3 ta Mustaqil Saqlash Sloti (Offline)</div>
      <div class="list">
        ${slots.map((s) => `
          <div class="row">
            <div><b>${s.label}</b></div>
            <button type="button" class="btn ${mode === 'single' && getSpSlot() === s.slot ? 'primary' : ''}" data-load-spslot="${s.slot}">
              ${mode === 'single' && getSpSlot() === s.slot ? 'Faol Slot' : 'Yuklash'}
            </button>
          </div>
        `).join('')}
      </div>
    `;
  }

  body.innerHTML = `
    <div class="ph-shell">
      <div class="ph-nav">
        ${apps.map(([id, lbl]) => `<button type="button" class="btn ${currentPhoneApp === id ? 'primary' : ''}" data-papp="${id}">${lbl}</button>`).join('')}
      </div>
      <div class="ph-content" style="margin-top:10px">${content}</div>
    </div>
  `;

  body.querySelectorAll('[data-papp]').forEach((b) => (b.onclick = () => {
    currentPhoneApp = b.dataset.papp;
    beep('ok');
    renderPhone(body, ui, game);
  }));

  body.querySelectorAll('[data-popen]').forEach((b) => (b.onclick = () => {
    ui.open(b.dataset.popen);
  }));

  body.querySelectorAll('[data-start-job]').forEach((b) => (b.onclick = () => {
    ui.closeModal();
    startMission(b.dataset.startJob, game.hour());
  }));

  body.querySelectorAll('[data-start-story]').forEach((b) => (b.onclick = () => {
    const stepIdx = Number(b.dataset.startStory) || 0;
    const ch = STORY_CAMPAIGN[stepIdx];
    if (!ch) return;
    ui.closeModal();
    startCustomMission({
      name: ch.title,
      points: ch.points,
      limit: ch.limit,
      reward: ch.reward,
      dialogue: `${ch.npc}: ${ch.objective}`,
      onComplete: () => {
        if ((state.storyStep || 0) <= stepIdx) {
          state.storyStep = stepIdx + 1;
        }
        state.storyHistory = state.storyHistory || [];
        state.storyHistory.unshift({ step: stepIdx + 1, title: ch.title, ts: Date.now() });
        save(true);
      },
    });
  }));

  body.querySelectorAll('[data-buy-home]').forEach((b) => (b.onclick = () => {
    const h = HOUSING_PROPERTIES.find((x) => x.id === b.dataset.buyHome);
    if (!h) return;
    if (!spend(h.price, `Ko'chmas mulk: ${h.name}`)) {
      return ui.toast(`💸 Mablag' yetarli emas (${fmt(h.price)})!`, 'err');
    }
    state.ownedProperties = state.ownedProperties || ['apt_chilonzor'];
    if (!state.ownedProperties.includes(h.id)) state.ownedProperties.push(h.id);
    state.activeProperty = h.id;
    save(true);
    beep('cash');
    ui.toast(`🏠 Tabriklaymiz! «${h.name}» sotib olindi!`, 'ok');
    renderPhone(body, ui, game);
  }));

  body.querySelectorAll('[data-visit-home]').forEach((b) => (b.onclick = () => {
    const h = HOUSING_PROPERTIES.find((x) => x.id === b.dataset.visitHome);
    if (!h) return;
    state.activeProperty = h.id;
    save(true);
    ui.closeModal();
    game.teleportTo(h.spawnX, h.spawnZ, h.heading || 0);
    ui.toast(`🏠 «${h.name}» oldiga yetib keldingiz!`, 'ok');
  }));

  body.querySelectorAll('[data-bank-dep]').forEach((b) => (b.onclick = () => {
    const amt = Math.min(state.money, Number(b.dataset.bankDep) || 0);
    if (amt <= 0 || !spend(amt, 'Bank omonatiga kirim')) return ui.toast("Hamyonda mablag' yetarli emas!", 'err');
    state.bankBalance = (state.bankBalance || 0) + amt;
    save(true);
    beep('cash');
    renderPhone(body, ui, game);
  }));

  body.querySelectorAll('[data-bank-with]').forEach((b) => (b.onclick = () => {
    const bank = state.bankBalance || 0;
    const amt = b.dataset.bankWith === 'all' ? bank : Math.min(bank, Number(b.dataset.bankWith) || 0);
    if (amt <= 0) return ui.toast('Bank hisobida mablag\' yo\'q!', 'err');
    state.bankBalance = bank - amt;
    addMoney(amt, 'Bank omonatidan yechish');
    save(true);
    beep('cash');
    renderPhone(body, ui, game);
  }));

  body.querySelectorAll('[data-sel-car]').forEach((b) => (b.onclick = () => {
    state.activeUid = b.dataset.selCar;
    state.rental = null;
    touch();
    game.changeCar(true);
    ui.toast('🚘 Mashinangiz chaqirildi!', 'ok');
    renderPhone(body, ui, game);
  }));

  body.querySelectorAll('[data-tp-peer]').forEach((b) => (b.onclick = () => {
    const p = onlineList().find((x) => x.id === b.dataset.tpPeer);
    if (!p) return;
    ui.closeModal();
    game.teleportTo((p.x || 0) + 4, (p.z || 0) + 4, p.h || 0);
    ui.toast(`📍 ${p.name || "Do'st"} yoniga o'tdingiz!`, 'ok');
  }));

  body.querySelectorAll('[data-call-npc]').forEach((b) => (b.onclick = () => {
    activeCallNpcId = b.dataset.callNpc;
    beep('ok');
    renderPhone(body, ui, game);
  }));

  const dialBtn = body.querySelector('#phDialBtn');
  const dialInp = body.querySelector('#phDialInput');
  if (dialBtn && dialInp) {
    const doDial = () => {
      const q = dialInp.value.replace(/\s|-/g, '').toLowerCase();
      if (!q) return ui.toast('Qo\'ng\'iroq qilish uchun raqam yoki qisqa kod (101, 555, 777, 707, 911) kiriting!', 'err');
      const found = NPC_CONTACTS.find(
        (c) =>
          c.shortCode === q ||
          c.phone.replace(/\s|-/g, '').includes(q) ||
          c.name.toLowerCase().includes(q)
      );
      if (!found) {
        beep('err');
        return ui.toast('📵 Bunday raqam topilmadi! Ro\'yxatdagi raqamlardan birini tering.', 'err');
      }
      activeCallNpcId = found.id;
      beep('ok');
      renderPhone(body, ui, game);
    };
    dialBtn.onclick = doDial;
    dialInp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doDial();
    });
  }

  const hangupBtn = body.querySelector('#phHangupBtn');
  if (hangupBtn) {
    hangupBtn.onclick = () => {
      activeCallNpcId = null;
      renderPhone(body, ui, game);
    };
  }

  body.querySelectorAll('[data-call-opt]').forEach((b) => (b.onclick = () => {
    const act = b.dataset.callOpt;
    const hr = typeof game.hour === 'function' ? game.hour() : 22;
    if (act === 'rustam_taxi') {
      activeCallNpcId = null;
      beep('ok');
      ui.closeModal();
      startMission('taxi', hr);
      ui.toast('📞 Rustam aka: «Taksi mijozi lokatsiyasi GPS xaritangga tushdi, omad!»', 'cash');
    } else if (act === 'rustam_story') {
      const stepIdx = Math.min(state.storyStep || 0, STORY_CAMPAIGN.length - 1);
      const ch = STORY_CAMPAIGN[stepIdx];
      activeCallNpcId = null;
      ui.closeModal();
      startCustomMission({
        type: 'story',
        name: ch.title,
        points: ch.points,
        reward: ch.reward,
        limit: ch.limit,
        onWin: () => {
          if ((state.storyStep || 0) <= stepIdx) {
            state.storyStep = stepIdx + 1;
            touch();
          }
        },
      });
    } else if (act === 'rustam_help') {
      if ((state.money || 0) >= 5_000_000) {
        beep('err');
        return ui.toast('📞 Rustam aka: «Uka, hamyoningda puling yetarli ekan-ku! Mehnat qilib ko\'paytir!»', 'err');
      }
      addMoney(3_000_000, 'Rustam akadan moliyaviy yordam');
      beep('cash');
      ui.toast('📞 Rustam aka: «Mana senga +3 000 000 so\'m yordam, mashinangga benzin quyib ish boshla!»', 'cash');
      renderPhone(body, ui, game);
    } else if (act === 'bahrom_full') {
      const carInst = activeCar();
      const cfg = carById(carInst.id);
      if (!spend(1_500_000, 'Usta Bahrom: 100% ta\'mir va to\'liq bak')) {
        beep('err');
        return ui.toast('Mobil usta xizmati uchun 1 500 000 so\'m kerak!', 'err');
      }
      carInst.damage = 0;
      carInst.fuelL = cfg.tank || 60;
      touch();
      beep('cash');
      ui.toast('📞 Usta Bahrom: «Mashinang 100% ta\'mirlandi va baki to\'ldirildi!»', 'ok');
      renderPhone(body, ui, game);
    } else if (act === 'bahrom_fuel') {
      const carInst = activeCar();
      const cfg = carById(carInst.id);
      if (!spend(600_000, 'Usta Bahrom: Mobil benzin yetkazish')) {
        beep('err');
        return ui.toast('Mobil benzin yetkazish uchun 600 000 so\'m kerak!', 'err');
      }
      carInst.fuelL = cfg.tank || 60;
      touch();
      beep('cash');
      ui.toast('📞 Usta Bahrom: «Shogirdlarim bakingni to\'ldirib berdi!»', 'ok');
      renderPhone(body, ui, game);
    } else if (act === 'bahrom_job') {
      activeCallNpcId = null;
      ui.closeModal();
      startMission('mechanic', hr);
      ui.toast('📞 Usta Bahrom: «Buzilgan mashina lokatsiyasini GPS ga tashladim, borib tuzatib kel!»', 'cash');
    } else if (act === 'lola_vip') {
      activeCallNpcId = null;
      ui.closeModal();
      startMission('vip_driver', hr);
      ui.toast('📞 Lola: «VIP mijoz seni kutmoqda, GPS yo\'nalishiga qara!»', 'cash');
    } else if (act === 'lola_food') {
      activeCallNpcId = null;
      ui.closeModal();
      startMission('food_delivery', hr);
      ui.toast('📞 Lola: «Issiq buyurtma tayyor, tez yetkazib ber!»', 'cash');
    } else if (act === 'lola_club') {
      activeCallNpcId = null;
      ui.closeModal();
      game.setWaypoint?.({ x: roadC(8), z: roadC(7) });
      ui.toast('📍 Kokobango Club manzili GPS xaritaga belgilandi!', 'ok');
    } else if (act === 'timur_duel') {
      activeCallNpcId = null;
      ui.closeModal();
      startMission('duel', hr);
      ui.toast('📞 Timur: «1v1 Tungi Duel raqibi ko\'chaga chiqdi! Gazni bos!»', 'cash');
    } else if (act === 'timur_drag') {
      activeCallNpcId = null;
      ui.closeModal();
      startMission('drag', hr);
      ui.toast('📞 Timur: «402m Drag chizig\'ida kutaman!»', 'cash');
    } else if (act === 'timur_drift') {
      activeCallNpcId = null;
      ui.closeModal();
      startMission('drift', hr);
      ui.toast('📞 Timur: «Burilishlarda tutun chiqarib Drift ball yig\'!»', 'cash');
    } else if (act === 'evak_salon') {
      if (!spend(1_000_000, 'Tezkor Evakuator: Avtosalonga eltish')) {
        beep('err');
        return ui.toast('Evakuator uchun 1 000 000 so\'m kerak!', 'err');
      }
      activeCallNpcId = null;
      ui.closeModal();
      game.tow?.();
      ui.toast('📞 Evakuator: «Mashinangiz Markaziy Avtosalon oldiga olib kelindi!»', 'ok');
    } else if (act === 'evak_home') {
      if (!spend(1_000_000, 'Tezkor Evakuator: Uyga eltish')) {
        beep('err');
        return ui.toast('Evakuator uchun 1 000 000 so\'m kerak!', 'err');
      }
      const home = getActiveProperty();
      activeCallNpcId = null;
      ui.closeModal();
      game.teleportTo?.(home.spawnX, home.spawnZ, 0);
      ui.toast(`📞 Evakuator: «Mashinangiz ${home.name} oldiga yetkazildi!»`, 'ok');
    } else if (act === 'evak_job') {
      activeCallNpcId = null;
      ui.closeModal();
      startMission('tow_truck', hr);
      ui.toast('📞 Evakuator Markazi: «Yo\'lda qolgan mashinani avtoservisga tortib kel!»', 'cash');
    }
  }));

  const chatBtn = body.querySelector('#phChatSend');
  const chatInp = body.querySelector('#phChatInp');
  if (chatBtn && chatInp) {
    chatBtn.onclick = () => {
      const txt = chatInp.value.trim();
      if (!txt) return;
      sendChat(txt, state.name || 'Haydovchi');
      chatInp.value = '';
      renderPhone(body, ui, game);
    };
  }

  const saveBtn = body.querySelector('#phSaveNowBtn');
  if (saveBtn) {
    saveBtn.onclick = () => {
      save(true);
      beep('ok');
      ui.toast('💾 O\'yin holati saqlandi!', 'ok');
    };
  }

  body.querySelectorAll('[data-load-spslot]').forEach((b) => (b.onclick = () => {
    const slot = Number(b.dataset.loadSpslot) || 0;
    setGameMode('single', slot);
    game.changeCar(true);
    const home = getActiveProperty();
    game.teleportTo(home.spawnX, home.spawnZ, home.heading || 0);
    ui.toast(`🏠 Single Player Slot #${slot + 1} yuklandi!`, 'ok');
    renderPhone(body, ui, game);
  }));
}
