// ============================================================================
// TUNGI TOSHKENT V11 — 5x5 KM (25 km²) REAL OPEN WORLD CONSTANTS & GEOMETRY
// ============================================================================
// Ushbu modul haqiqiy Toshkent shahrining 5000 x 5000 metr (25 km²) hududini
// OpenStreetMap koordinatalari, 250 x 250 metrli 400 ta mustaqil chunk,
// magistral va mahalliy yo'l to'rlari bilan ta'minlaydi.

export const WORLD_SIZE = 5000;       // 5000 metr = 5 km
export const WORLD_HALF = 2500;       // -2500 dan +2500 metrgacha
export const CHUNK_SIZE = 250;        // 250 x 250 metr
export const CHUNKS_PER_AXIS = 20;    // 20 x 20 = 400 ta mustaqil chunk
export const CHUNK_MIN = -10;         // cx: -10..9
export const CHUNK_MAX = 9;

// Chiroyli ufq va chekka hududlar (o'yin keskin tugab qolmasligi uchun)
export const HORIZON_SIZE = 16000;    // 16 x 16 km tashqi tog'lar va ufq relyefi

// Haqiqiy Toshkent markaziy koordinatalari va tumanlari
export const DISTRICTS_V11 = [
  { name: 'Yunusobod',          x: 350,   z: -1700, r: 800, desc: 'Teleminora, Yapon bog\'i va shimoliy zamonaviy mavzelar' },
  { name: 'Olmazor / Sebzor',   x: -950,  z: -1250, r: 750, desc: 'Qadimiy Sebzor, Ganga va Talabalar shaharchasi tomon' },
  { name: 'Shayxontohur',       x: -1200, z: -350,  r: 700, desc: 'Eski shahar, Chorsu, Ko\'kaldosh va Xadra' },
  { name: 'Tashkent City',      x: -650,  z: 220,   r: 500, desc: 'Nest One (266m), Hilton, Mall va Kongress markazi' },
  { name: 'Mustaqillik Maydoni',x: -120,  z: -160,  r: 450, desc: 'Senat, Ezgulik arkasi va Anhor sohilbo\'yi' },
  { name: 'Amir Temur Xiyoboni',x: 450,   z: -90,   r: 450, desc: 'Toshkent Skveri, Kurantlar va "O\'zbekiston" mehmonxonasi' },
  { name: 'Chilonzor',          x: -1400, z: 1350,  r: 950, desc: 'Bunyodkor shoh ko\'chasi, Oqtepa va keng turar-joy massivlari' },
  { name: 'Yakkasaroy / Bobur', x: -200,  z: 1100,  r: 750, desc: 'Bobur bog\'i, Shota Rustaveli va xalqaro aeroport yo\'nalishi' },
  { name: 'Mirobod',            x: 950,   z: 850,   r: 800, desc: 'Nukus ko\'chasi, Oybek, Shimoliy vokzal va diplomatik korpus' },
  { name: 'Mirzo Ulug\'bek',    x: 1650,  z: -750,  r: 900, desc: 'Buyuk Ipak Yo\'li, Pushkin va fan shaharchasi' },
  { name: 'Yashnobod / Parkent',x: 1550,  z: 950,   r: 900, desc: 'Parkent bozori, Tuzel va Ohangaron shoh ko\'chasi' },
];

// OpenStreetMap asosidagi Toshkentning 9 ta bosh diqqatga sazovor joyi
export const REAL_LANDMARKS = [
  {
    id: 'tv_tower',
    type: 'tvtower',
    name: 'Toshkent Teleminorasi (375m)',
    sub: 'Markaziy Osiyodagi eng baland teleminora (Yunusobod)',
    x: 280,
    z: -1820,
    height: 375,
    skyline: true, // Butun shahar bo'ylab uzoqdan ko'rinadi
    category: 'landmark',
  },
  {
    id: 'minor_masjid',
    type: 'minor',
    name: 'Minor Masjidi (Oq masjid)',
    sub: 'Anhor kanali bo\'yidagi oq marmarli muazzam jome masjid',
    x: -80,
    z: -1080,
    height: 52,
    skyline: true,
    category: 'landmark',
  },
  {
    id: 'mustaqillik',
    type: 'park',
    name: 'Mustaqillik Maydoni',
    sub: 'Ezgulik arkasi, Senat maydoni va markaziy favvoralar',
    x: -140,
    z: -160,
    height: 28,
    skyline: true,
    category: 'park',
  },
  {
    id: 'skver',
    type: 'square',
    name: 'Amir Temur Xiyoboni (Skver)',
    sub: 'Amir Temur otliq haykali, Kurantlar va favvora xiyoboni',
    x: 440,
    z: -85,
    height: 32,
    skyline: true,
    category: 'square',
  },
  {
    id: 'hotel_uzbekistan',
    type: 'uzhotel',
    name: '"O\'zbekiston" Mehmonxonasi',
    sub: 'Skver ro\'parasidagi mashhur yarim-oy arxitekturali bino',
    x: 700,
    z: -110,
    height: 68,
    skyline: true,
    category: 'landmark',
  },
  {
    id: 'nestone',
    type: 'citytower',
    name: 'Tashkent City · Nest One (266m)',
    sub: 'O\'zbekistondagi eng baland zamonaviy osmono\'par bino',
    x: -610,
    z: 220,
    height: 266,
    skyline: true,
    category: 'landmark',
  },
  {
    id: 'city_mall',
    type: 'mall',
    name: 'Tashkent City Mall & Hilton',
    sub: 'Eng yirik savdo markazi, muz saroyi va 5 yulduzli mehmonxona',
    x: -870,
    z: 210,
    height: 48,
    skyline: true,
    category: 'landmark',
  },
  {
    id: 'chorsu',
    type: 'chorsu',
    name: 'Chorsu Bozori (Eski shahar)',
    sub: 'Ulkan moviy gumbazli tarixiy sharq bozori',
    x: -1620,
    z: -480,
    height: 42,
    skyline: true,
    category: 'landmark',
  },
  {
    id: 'magic_city',
    type: 'magiccity',
    name: 'Magic City & Milliy Bog\'',
    sub: 'Ertaknamo qasrlar, akvarium va dam olish xiyoboni',
    x: -730,
    z: 1240,
    height: 56,
    skyline: true,
    category: 'landmark',
  },
];

// OpenStreetMap magistral va shahar yo'llari tarmog'i
export const ROAD_SEGMENTS = [
  // 1. Shimol-Janub magistrallari
  { name: 'Amir Temur shoh ko\'chasi', x1: 440, z1: -2450, x2: 440, z2: 1800, width: 32, lanes: 8, isHighway: true },
  { name: 'Sharof Rashidov shoh ko\'chasi', x1: -120, z1: -2450, x2: -120, z2: 1200, width: 28, lanes: 6, isHighway: true },
  { name: 'Bunyodkor shoh ko\'chasi', x1: -920, z1: -500, x2: -1300, z2: 2450, width: 34, lanes: 8, isHighway: true },
  { name: 'Sebzor / Labzak ko\'chasi', x1: -450, z1: -2450, x2: -450, z2: -350, width: 26, lanes: 6, isHighway: false },
  { name: 'Furqat ko\'chasi', x1: -650, z1: -350, x2: -650, z2: 1400, width: 28, lanes: 6, isHighway: false },
  { name: 'Shota Rustaveli ko\'chasi', x1: 50, z1: 650, x2: -450, z2: 2450, width: 28, lanes: 6, isHighway: true },
  { name: 'Nukus ko\'chasi', x1: 750, z1: 150, x2: 250, z2: 2200, width: 28, lanes: 6, isHighway: true },
  { name: 'Beruniy shoh ko\'chasi', x1: -1620, z1: -2450, x2: -1620, z2: -480, width: 28, lanes: 6, isHighway: true },
  { name: 'Bobur shoh ko\'chasi', x1: -150, z1: 500, x2: 200, z2: 2450, width: 28, lanes: 6, isHighway: true },
  { name: 'Shahrisabz ko\'chasi', x1: 720, z1: -850, x2: 720, z2: 850, width: 26, lanes: 6, isHighway: false },

  // 2. Sharq-G'arb shoh ko'chalari
  { name: 'Kichik Halqa Yo\'li (Shimol)', x1: -2450, z1: -1400, x2: 2450, z2: -1400, width: 36, lanes: 8, isHighway: true },
  { name: 'Abdulla Qodiriy ko\'chasi', x1: -2100, z1: -950, x2: 2100, z2: -950, width: 28, lanes: 6, isHighway: true },
  { name: 'Alisher Navoiy shoh ko\'chasi', x1: -2450, z1: -380, x2: 2100, z2: -380, width: 32, lanes: 8, isHighway: true },
  { name: 'Mustaqillik shoh ko\'chasi', x1: -120, z1: -160, x2: 2450, z2: -160, width: 32, lanes: 8, isHighway: true },
  { name: 'Islom Karimov shoh ko\'chasi', x1: -2100, z1: 140, x2: 2450, z2: 140, width: 32, lanes: 8, isHighway: true },
  { name: 'Afrosiyob ko\'chasi', x1: -1200, z1: 650, x2: 1400, z2: 650, width: 26, lanes: 6, isHighway: false },
  { name: 'Muqimiy ko\'chasi', x1: -2450, z1: 1550, x2: 800, z2: 1550, width: 30, lanes: 6, isHighway: true },
  { name: 'Kichik Halqa Yo\'li (Janub)', x1: -2450, z1: 2200, x2: 2450, z2: 2200, width: 36, lanes: 8, isHighway: true },

  // 3. Tashqi aylanma va Katta halqa magistrallari
  { name: 'Tashqi Halqa (G\'arb)', x1: -2400, z1: -2450, x2: -2400, z2: 2450, width: 34, lanes: 8, isHighway: true },
  { name: 'Tashqi Halqa (Sharq)', x1: 2400, z1: -2450, x2: 2400, z2: 2450, width: 34, lanes: 8, isHighway: true },
  { name: 'Tashqi Halqa (Shimol)', x1: -2450, z1: -2400, x2: 2450, z2: -2400, width: 34, lanes: 8, isHighway: true },
  { name: 'Tashqi Halqa (Janub)', x1: -2450, z1: 2400, x2: 2450, z2: 2400, width: 34, lanes: 8, isHighway: true },
];

// Anhor Kanali egri chiziqli traektoriyasi (Shimoldan Janubga)
export const ANHOR_PATH = [
  { x: 320,  z: -2450 },
  { x: 120,  z: -1800 },
  { x: -50,  z: -1100 }, // Minor masjidi
  { x: -90,  z: -600 },
  { x: -130, z: -160 },  // Mustaqillik maydoni
  { x: -280, z: 280 },   // Tashkent City sharqi
  { x: -480, z: 800 },   // Milliy bog' ko'li
  { x: -620, z: 1300 },  // Magic City
  { x: -750, z: 1850 },
  { x: -850, z: 2450 },
];

// Chunk indeksini hisoblash
export function getChunkCoord(worldVal) {
  return Math.floor((worldVal + WORLD_HALF) / CHUNK_SIZE) + CHUNK_MIN;
}

export function getChunkCenter(cx, cz) {
  return {
    x: (cx - CHUNK_MIN + 0.5) * CHUNK_SIZE - WORLD_HALF,
    z: (cz - CHUNK_MIN + 0.5) * CHUNK_SIZE - WORLD_HALF,
  };
}

export function getChunkKey(cx, cz) {
  return `${cx},${cz}`;
}
