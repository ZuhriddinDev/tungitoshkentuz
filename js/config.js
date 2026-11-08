// O'yin konfiguratsiyasi: avtomobillar, dvigatel ovoz profillari, benzin, professional tuning, 7 kunlik bonus va Toshkent xaritasi
export const START_MONEY = 5_000_000_000;

// body: hatch | sedan | suv | super
// sound: 'i4' | 'turbo4' | 'bmwi6' | 'bmwv8' | 'amgv8' | 'v12'
export const CARS = [
  // Boshlang'ich avtomobillar (arzon va ommabop)
  { id: 'spark',      name: 'Chevrolet Spark',            price: 25_000_000,    tier: 'Boshlang\'ich', body: 'hatch', len: 3.65, wid: 1.62, hei: 1.52, accel: 6.2,  maxSpeed: 165, brake: 10.2, fuelUse: 5.8,  tank: 35,  grip: 0.96, pitch: 1.22, sound: 'i4',     fuel: 'AI-92' },
  { id: 'gentra',     name: 'Chevrolet Gentra',           price: 45_000_000,    tier: 'Boshlang\'ich', body: 'sedan', len: 4.52, wid: 1.73, hei: 1.45, accel: 7.5,  maxSpeed: 198, brake: 10.8, fuelUse: 7.5,  tank: 60,  grip: 0.98, pitch: 1.02, sound: 'i4',     fuel: 'AI-95' },
  { id: 'kia_k5',     name: 'Kia K5 Optima',              price: 85_000_000,    tier: 'Boshlang\'ich', body: 'sedan', len: 4.90, wid: 1.86, hei: 1.45, accel: 8.5,  maxSpeed: 225, brake: 11.5, fuelUse: 8.0,  tank: 60,  grip: 1.01, pitch: 0.95, sound: 'turbo4', fuel: 'AI-95' },
  { id: 'malibu',     name: 'Chevrolet Malibu Premier',   price: 120_000_000,   tier: 'Boshlang\'ich', body: 'sedan', len: 4.92, wid: 1.85, hei: 1.46, accel: 9.0,  maxSpeed: 235, brake: 11.8, fuelUse: 8.4,  tank: 60,  grip: 1.02, pitch: 0.92, sound: 'turbo4', fuel: 'AI-95' },

  // O'rta va Biznes darajadagi mashinalar
  { id: 'e55',        name: 'Mercedes-Benz E55 AMG W211', price: 175_000_000,   tier: "O'rta",        body: 'sedan', len: 4.85, wid: 1.82, hei: 1.45, accel: 10.6, maxSpeed: 270, brake: 12.8, fuelUse: 11.5, tank: 80,  grip: 1.06, pitch: 0.74, sound: 'amgv8',  fuel: 'AI-95' },
  { id: 'challenger', name: 'Dodge Challenger R/T',       price: 220_000_000,   tier: "O'rta",        body: 'sedan', len: 5.02, wid: 1.92, hei: 1.45, accel: 11.2, maxSpeed: 275, brake: 12.6, fuelUse: 13.0, tank: 70,  grip: 1.04, pitch: 0.68, sound: 'amgv8',  fuel: 'AI-95' },
  { id: 'supra',      name: 'Toyota Supra MK4 A80',       price: 280_000_000,   tier: "O'rta",        body: 'super', len: 4.52, wid: 1.81, hei: 1.28, accel: 12.0, maxSpeed: 285, brake: 13.6, fuelUse: 10.5, tank: 70,  grip: 1.11, pitch: 0.84, sound: 'bmwi6',  fuel: 'AI-100' },
  { id: 'm4gts',      name: 'BMW M4 GTS',                 price: 340_000_000,   tier: "O'rta",        body: 'sedan', len: 4.67, wid: 1.87, hei: 1.38, accel: 11.8, maxSpeed: 285, brake: 13.8, fuelUse: 10.8, tank: 60,  grip: 1.10, pitch: 0.80, sound: 'bmwi6',  fuel: 'AI-100' },
  { id: 'bmwx7',      name: 'BMW X7 xDrive40i',           price: 380_000_000,   tier: "O'rta",        body: 'suv',   len: 5.15, wid: 2.00, hei: 1.80, accel: 9.8,  maxSpeed: 245, brake: 12.5, fuelUse: 11.2, tank: 83,  grip: 1.05, pitch: 0.78, sound: 'bmwi6',  fuel: 'AI-95' },
  { id: 'm4comp',     name: 'BMW M4 Competition',         price: 430_000_000,   tier: "O'rta",        body: 'sedan', len: 4.79, wid: 1.89, hei: 1.39, accel: 12.4, maxSpeed: 290, brake: 14.2, fuelUse: 11.0, tank: 59,  grip: 1.12, pitch: 0.78, sound: 'bmwi6',  fuel: 'AI-100' },
  { id: 'bmw2018',    name: 'BMW M5 F90',                 price: 490_000_000,   tier: "O'rta",        body: 'sedan', len: 4.96, wid: 1.90, hei: 1.47, accel: 13.0, maxSpeed: 295, brake: 14.4, fuelUse: 11.6, tank: 68,  grip: 1.12, pitch: 0.74, sound: 'bmwv8',  fuel: 'AI-100' },
  { id: 'bmw',        name: 'BMW M5 CS',                  price: 620_000_000,   tier: "O'rta",        body: 'sedan', len: 4.98, wid: 1.90, hei: 1.47, accel: 13.8, maxSpeed: 305, brake: 14.8, fuelUse: 12.0, tank: 68,  grip: 1.14, pitch: 0.72, sound: 'bmwv8',  fuel: 'AI-100' },
  { id: 'bmwm8',      name: 'BMW M8 Coupe',               price: 700_000_000,   tier: 'Sport',        body: 'super', len: 4.87, wid: 1.91, hei: 1.36, accel: 14.2, maxSpeed: 310, brake: 15.0, fuelUse: 12.2, tank: 68,  grip: 1.15, pitch: 0.72, sound: 'bmwv8',  fuel: 'AI-100' },
  { id: 'bmwm8wb',    name: 'BMW M8 Widebody',            price: 780_000_000,   tier: 'Sport',        body: 'super', len: 4.92, wid: 2.02, hei: 1.35, accel: 14.8, maxSpeed: 320, brake: 15.4, fuelUse: 12.6, tank: 68,  grip: 1.17, pitch: 0.70, sound: 'bmwv8',  fuel: 'AI-100' },
  { id: 'mercedes',   name: 'Mercedes-AMG G 63 (Gelik)',  price: 950_000_000,   tier: 'Premium',      body: 'suv',   len: 4.87, wid: 1.98, hei: 1.95, accel: 11.8, maxSpeed: 255, brake: 13.4, fuelUse: 14.5, tank: 100, grip: 1.08, pitch: 0.66, sound: 'amgv8',  fuel: 'AI-100' },
  { id: 'maybach',    name: 'Mercedes-Maybach GLS 600',   price: 1_100_000_000, tier: 'Premium',      body: 'suv',   len: 5.20, wid: 2.03, hei: 1.84, accel: 11.8, maxSpeed: 260, brake: 13.4, fuelUse: 13.8, tank: 90,  grip: 1.08, pitch: 0.68, sound: 'amgv8',  fuel: 'AI-100' },

  // Premium Superkarlar va Giperkarlar
  { id: 'ferrari599', name: 'Ferrari 599 GTB Fiorano',    price: 1_400_000_000, tier: 'Premium',      body: 'super', len: 4.66, wid: 1.96, hei: 1.33, accel: 15.4, maxSpeed: 335, brake: 15.8, fuelUse: 15.0, tank: 85,  grip: 1.18, pitch: 0.62, sound: 'v12',    fuel: 'AI-100' },
  { id: 'porsche911', name: 'Porsche 911 GT3 RS',         price: 1_650_000_000, tier: 'Premium',      body: 'super', len: 4.57, wid: 1.90, hei: 1.32, accel: 15.8, maxSpeed: 340, brake: 16.5, fuelUse: 13.4, tank: 64,  grip: 1.24, pitch: 0.64, sound: 'v12',    fuel: 'AI-100' },
  { id: 'lambo',      name: 'Lamborghini Aventador',      price: 2_100_000_000, tier: 'Giperkar',     body: 'super', len: 4.80, wid: 2.03, hei: 1.14, accel: 16.5, maxSpeed: 350, brake: 16.0, fuelUse: 16.0, tank: 85,  grip: 1.20, pitch: 0.60, sound: 'v12',    fuel: 'AI-100' },
  { id: 'sf90',       name: 'Ferrari SF90 Spider',        price: 2_400_000_000, tier: 'Giperkar',     body: 'super', len: 4.70, wid: 1.97, hei: 1.19, accel: 17.5, maxSpeed: 365, brake: 16.8, fuelUse: 13.5, tank: 68,  grip: 1.23, pitch: 0.58, sound: 'v12',    fuel: 'AI-100' },
  { id: 'roadster',   name: 'Tesla Roadster 2020',        price: 2_650_000_000, tier: 'Giperkar',     body: 'super', len: 4.63, wid: 1.95, hei: 1.20, accel: 18.5, maxSpeed: 380, brake: 17.0, fuelUse: 6.5,  tank: 90,  grip: 1.25, pitch: 0.90, sound: 'turbo4', fuel: 'AI-100' },
];

export const carById = (id) => CARS.find((c) => c.id === id) || CARS[1];

export const FUELS = {
  'AI-92':  { price: 10_500, color: '#4caf50' },
  'AI-95':  { price: 12_800, color: '#ff9800' },
  'AI-100': { price: 16_500, color: '#e91e63' },
};

export const COLORS = [
  '#f5f5f5', '#0d1017', '#6b7280', '#d32f2f', '#1565c0', '#2e7d32',
  '#f9a825', '#6a1b9a', '#00acc1', '#ff6d00', '#c2185b', '#263238',
  '#00e676', '#3d5afe', '#ffd740', '#cfd8dc',
];

export const RIM_COLOR_SWATCHES = [
  { id: '#d4d8e2', name: 'Kumush' },
  { id: '#14161d', name: 'Qora Sport' },
  { id: '#f5f7fa', name: 'Xrom' },
  { id: '#d4a017', name: 'Oltin' },
  { id: '#b87333', name: 'Bronza' },
  { id: '#e53935', name: 'Qizil' },
  { id: '#00e5ff', name: 'Moviy Neon' },
  { id: '#ffffff', name: 'Oq' },
];

export const TUNING = {
  paintType: {
    name: "Bo'yoq qoplamasi (Metallik / Mat)",
    options: [
      { id: 'metallic', name: 'Metallik Yaltiroq', price: 0 },
      { id: 'matte',    name: 'Mat Qoplama (Satin)', price: 5_000_000 },
      { id: 'chrome',   name: 'Xrom Ko\'zgu', price: 12_000_000 },
      { id: 'pearl',    name: 'Marvarid (Ceramic)', price: 8_000_000 },
    ],
  },
  rims: {
    name: 'Disklar va G\'ildirak turi',
    options: [
      { id: 'std',     name: 'Zavod Standart', price: 0 },
      { id: 'sport',   name: 'Sport Black 5-Spoke', price: 6_000_000 },
      { id: 'chrome',  name: 'Luxury Xrom', price: 10_000_000 },
      { id: 'gold',    name: 'Oltin Forged', price: 18_000_000 },
      { id: 'bbs',     name: 'BBS Racing Mesh', price: 14_000_000 },
      { id: 'concave', name: 'AMG Deep Concave', price: 22_000_000 },
    ],
  },
  spoiler: {
    name: 'Spoyler va Aerodinamika',
    options: [
      { id: 'none',   name: "Yo'q (Zavod)", price: 0 },
      { id: 'lip',    name: 'Karbon Lip Spoyler', price: 4_000_000 },
      { id: 'wing',   name: 'GT Sport Qanot', price: 12_000_000 },
      { id: 'gt_pro', name: 'Motorsport Pro Wing', price: 20_000_000 },
    ],
  },
  bodykit: {
    name: 'Body Kit va Bamperlar',
    options: [
      { id: 'std',    name: 'Zavod Bamperlar', price: 0 },
      { id: 'street', name: 'Street Splitter + Slayder', price: 10_000_000 },
      { id: 'wide',   name: 'Aero Body Kit + Diffuzor', price: 24_000_000 },
    ],
  },
  tint: {
    name: 'Oyna Qoraytirish (Tonirovka)',
    options: [
      { id: 'none',      name: 'Shaffof (0%)', price: 0 },
      { id: 'light',     name: "O'rta Tonirovka (50%)", price: 3_000_000 },
      { id: 'dark',      name: "To'liq Qora (100% Armolan)", price: 6_000_000 },
      { id: 'chameleon', name: 'Xameleon Binafsha-Moviy', price: 10_000_000 },
    ],
  },
  headlightColor: {
    name: 'Faralar Rangi (LED / Xenon)',
    options: [
      { id: '#fff3d0', name: 'Zavod Oq Xenon', price: 0 },
      { id: '#64e9ff', name: 'Ice Blue LED (Moviy)', price: 4_000_000 },
      { id: '#ffea00', name: 'Le Mans Sariq', price: 5_000_000 },
      { id: '#e040fb', name: 'Binafsha Kristall', price: 6_000_000 },
      { id: '#ff1744', name: 'Qizil Demon Eye', price: 8_000_000 },
    ],
  },
  neon: {
    name: 'Taglik Neon Chiroqlari',
    options: [
      { id: 'none',    name: "Yo'q", price: 0 },
      { id: '#00e5ff', name: 'Kiber Moviy', price: 5_000_000 },
      { id: '#ff00d4', name: 'Neon Pushti', price: 5_000_000 },
      { id: '#76ff03', name: 'Toksik Yashil', price: 5_000_000 },
      { id: '#ffea00', name: 'Oltin Sariq', price: 5_000_000 },
      { id: '#ff1744', name: 'Olcha Qizil', price: 6_000_000 },
      { id: '#aa00ff', name: 'Ultra Binafsha', price: 6_000_000 },
    ],
  },
  engine: {
    name: 'Motor Yangilash (Dvigatel)',
    options: [
      { id: 0, name: 'Standart Motor', price: 0 },
      { id: 1, name: 'Stage 1 Chip (+10% Quvvat)', price: 12_000_000 },
      { id: 2, name: 'Stage 2 Sport (+20% Quvvat)', price: 28_000_000 },
      { id: 3, name: 'Stage 3 Forged (+32% Quvvat)', price: 55_000_000 },
    ],
  },
  turbo: {
    name: 'Turbo va Kompressor',
    options: [
      { id: 0, name: 'Atmosfera / Zavod', price: 0 },
      { id: 1, name: 'Street Garrett Turbo (+12%)', price: 15_000_000 },
      { id: 2, name: 'Twin-Turbo Pro (+25%)', price: 38_000_000 },
    ],
  },
  accelTune: {
    name: 'Tezlanish (Uzatmalar Qutisi)',
    options: [
      { id: 0, name: 'Standart КПП', price: 0 },
      { id: 1, name: 'Sport Launch (+12% Start)', price: 10_000_000 },
      { id: 2, name: 'Dual-Clutch Pro (+24% Start)', price: 24_000_000 },
    ],
  },
  brakeTune: {
    name: 'Tormoz Tizimi (Brembo)',
    options: [
      { id: 0, name: 'Standart Tormoz', price: 0 },
      { id: 1, name: 'Brembo Sport (+18% Tormoz)', price: 8_000_000 },
      { id: 2, name: 'Karbon-Keramika (+35% Tormoz)', price: 20_000_000 },
    ],
  },
  handlingTune: {
    name: 'Boshqaruv va Podveska',
    options: [
      { id: 0, name: 'Standart Podveska', price: 0 },
      { id: 1, name: 'Sport Coilover (+12% Grip)', price: 9_000_000 },
      { id: 2, name: 'Track Active Suspension (+25% Grip)', price: 22_000_000 },
    ],
  },
};

// 7 Kunlik Kundalik Bonus tizimi
export const DAILY_REWARDS_7 = [
  { day: 1, type: 'money', amount: 25_000_000,  title: '1-Kun', label: '25 000 000 so\'m', icon: '💵' },
  { day: 2, type: 'money', amount: 45_000_000,  title: '2-Kun', label: '45 000 000 so\'m', icon: '💰' },
  { day: 3, type: 'money', amount: 60_000_000,  title: '3-Kun', label: '60 000 000 so\'m', icon: '💎' },
  { day: 4, type: 'money', amount: 70_000_000,  title: '4-Kun', label: '70 000 000 so\'m', icon: '🏦' },
  { day: 5, type: 'money', amount: 85_000_000,  title: '5-Kun', label: '85 000 000 so\'m', icon: '👑' },
  { day: 6, type: 'money', amount: 125_000_000, title: '6-Kun', label: '125 000 000 so\'m', icon: '🚀' },
  { day: 7, type: 'car',   carId: 'sf90', fallbackAmount: 500_000_000, title: '7-Kun SUPER SOVG\'A', label: 'Ferrari SF90 Spider', icon: '🏎️' },
];

// Toshkent V11 Open-World xaritasi: 5000 x 5000 metr (25 km²) Real Toshkent
export const CITY = { N: 20, BLOCK: 220, ROAD: 30 };
CITY.CELL = 250;
CITY.SIZE = 5000;
CITY.HALF = 2500;

export const DAY_LENGTH_SEC = 24 * 60; // 24 daqiqa real vaqt = 24 soat o'yin vaqti
export const KM_BONUS = 500_000;        // har 10 km uchun
export const DAILY_BONUS = 25_000_000;

export const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/,/g, ' ') + " so'm";
