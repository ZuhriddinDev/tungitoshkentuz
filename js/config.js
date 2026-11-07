// O'yin konfiguratsiyasi: avtomobillar, dvigatel ovoz profillari, benzin, tuning, Toshkent xaritasi o'lchamlari
export const START_MONEY = 2_000_000_000;

// body: hatch | sedan | suv | super
// sound: 'i4' | 'turbo4' | 'bmwi6' | 'bmwv8' | 'amgv8' | 'v12'
export const CARS = [
  { id: 'spark',      name: 'Chevrolet Spark',            price: 95_000_000,    body: 'hatch', len: 3.65, wid: 1.62, hei: 1.52, accel: 5.8,  maxSpeed: 160, brake: 10.0, fuelUse: 5.8,  tank: 35,  grip: 0.95, pitch: 1.22, sound: 'i4',     fuel: 'AI-92' },
  { id: 'gentra',     name: 'Chevrolet Gentra',           price: 165_000_000,   body: 'sedan', len: 4.52, wid: 1.73, hei: 1.45, accel: 7.2,  maxSpeed: 195, brake: 10.8, fuelUse: 7.5,  tank: 60,  grip: 0.98, pitch: 1.02, sound: 'i4',     fuel: 'AI-95' },
  { id: 'kia_k5',     name: 'Kia K5 Optima',              price: 310_000_000,   body: 'sedan', len: 4.90, wid: 1.86, hei: 1.45, accel: 8.4,  maxSpeed: 225, brake: 11.5, fuelUse: 8.0,  tank: 60,  grip: 1.01, pitch: 0.95, sound: 'turbo4', fuel: 'AI-95' },
  { id: 'malibu',     name: 'Chevrolet Malibu Premier',   price: 380_000_000,   body: 'sedan', len: 4.92, wid: 1.85, hei: 1.46, accel: 8.8,  maxSpeed: 230, brake: 11.8, fuelUse: 8.4,  tank: 60,  grip: 1.02, pitch: 0.92, sound: 'turbo4', fuel: 'AI-95' },
  { id: 'e55',        name: 'Mercedes-Benz E55 AMG W211', price: 620_000_000,   body: 'sedan', len: 4.85, wid: 1.82, hei: 1.45, accel: 10.6, maxSpeed: 270, brake: 12.8, fuelUse: 11.5, tank: 80,  grip: 1.06, pitch: 0.74, sound: 'amgv8',  fuel: 'AI-95' },
  { id: 'challenger', name: 'Dodge Challenger R/T',       price: 780_000_000,   body: 'sedan', len: 5.02, wid: 1.92, hei: 1.45, accel: 11.2, maxSpeed: 275, brake: 12.6, fuelUse: 13.0, tank: 70,  grip: 1.04, pitch: 0.68, sound: 'amgv8',  fuel: 'AI-95' },
  { id: 'supra',      name: 'Toyota Supra MK4 A80',       price: 950_000_000,   body: 'super', len: 4.52, wid: 1.81, hei: 1.28, accel: 12.0, maxSpeed: 285, brake: 13.6, fuelUse: 10.5, tank: 70,  grip: 1.11, pitch: 0.84, sound: 'bmwi6',  fuel: 'AI-100' },
  { id: 'm4gts',      name: 'BMW M4 GTS',                 price: 1_100_000_000, body: 'sedan', len: 4.67, wid: 1.87, hei: 1.38, accel: 11.8, maxSpeed: 285, brake: 13.8, fuelUse: 10.8, tank: 60,  grip: 1.10, pitch: 0.80, sound: 'bmwi6',  fuel: 'AI-100' },
  { id: 'bmwx7',      name: 'BMW X7 xDrive40i',           price: 1_180_000_000, body: 'suv',   len: 5.15, wid: 2.00, hei: 1.80, accel: 9.8,  maxSpeed: 245, brake: 12.5, fuelUse: 11.2, tank: 83,  grip: 1.05, pitch: 0.78, sound: 'bmwi6',  fuel: 'AI-95' },
  { id: 'm4comp',     name: 'BMW M4 Competition',         price: 1_250_000_000, body: 'sedan', len: 4.79, wid: 1.89, hei: 1.39, accel: 12.4, maxSpeed: 290, brake: 14.2, fuelUse: 11.0, tank: 59,  grip: 1.12, pitch: 0.78, sound: 'bmwi6',  fuel: 'AI-100' },
  { id: 'bmw2018',    name: 'BMW M5 F90',                 price: 1_380_000_000, body: 'sedan', len: 4.96, wid: 1.90, hei: 1.47, accel: 13.0, maxSpeed: 295, brake: 14.4, fuelUse: 11.6, tank: 68,  grip: 1.12, pitch: 0.74, sound: 'bmwv8',  fuel: 'AI-100' },
  { id: 'bmwx6m',     name: 'BMW X6M Competition',        price: 1_490_000_000, body: 'suv',   len: 4.94, wid: 2.00, hei: 1.69, accel: 12.2, maxSpeed: 280, brake: 13.8, fuelUse: 12.8, tank: 83,  grip: 1.09, pitch: 0.72, sound: 'bmwv8',  fuel: 'AI-100' },
  { id: 'bmw',        name: 'BMW M5 CS',                  price: 1_650_000_000, body: 'sedan', len: 4.98, wid: 1.90, hei: 1.47, accel: 13.8, maxSpeed: 305, brake: 14.8, fuelUse: 12.0, tank: 68,  grip: 1.14, pitch: 0.72, sound: 'bmwv8',  fuel: 'AI-100' },
  { id: 'bmwm8',      name: 'BMW M8 Coupe',               price: 1_850_000_000, body: 'super', len: 4.87, wid: 1.91, hei: 1.36, accel: 14.2, maxSpeed: 310, brake: 15.0, fuelUse: 12.2, tank: 68,  grip: 1.15, pitch: 0.72, sound: 'bmwv8',  fuel: 'AI-100' },
  { id: 'bmwm8wb',    name: 'BMW M8 Widebody',            price: 2_100_000_000, body: 'super', len: 4.92, wid: 2.02, hei: 1.35, accel: 14.8, maxSpeed: 320, brake: 15.4, fuelUse: 12.6, tank: 68,  grip: 1.17, pitch: 0.70, sound: 'bmwv8',  fuel: 'AI-100' },
  { id: 'lancia037',  name: 'Lancia 037 Stradale',        price: 2_250_000_000, body: 'super', len: 4.16, wid: 1.85, hei: 1.24, accel: 13.5, maxSpeed: 290, brake: 14.6, fuelUse: 11.0, tank: 70,  grip: 1.16, pitch: 0.88, sound: 'turbo4', fuel: 'AI-100' },
  { id: 'mercedes',   name: 'Mercedes-AMG G 63',          price: 2_400_000_000, body: 'suv',   len: 4.87, wid: 1.98, hei: 1.95, accel: 11.5, maxSpeed: 250, brake: 13.0, fuelUse: 14.5, tank: 100, grip: 1.06, pitch: 0.66, sound: 'amgv8',  fuel: 'AI-100' },
  { id: 'maybach',    name: 'Mercedes-Maybach GLS 600',   price: 2_650_000_000, body: 'suv',   len: 5.20, wid: 2.03, hei: 1.84, accel: 11.8, maxSpeed: 260, brake: 13.4, fuelUse: 13.8, tank: 90,  grip: 1.08, pitch: 0.68, sound: 'amgv8',  fuel: 'AI-100' },
  { id: 'gt40',       name: 'Ford GT40 Le Mans',          price: 2_900_000_000, body: 'super', len: 4.26, wid: 1.82, hei: 1.12, accel: 15.0, maxSpeed: 330, brake: 15.5, fuelUse: 14.0, tank: 75,  grip: 1.18, pitch: 0.65, sound: 'amgv8',  fuel: 'AI-100' },
  { id: 'ferrari599', name: 'Ferrari 599 GTB Fiorano',    price: 3_200_000_000, body: 'super', len: 4.66, wid: 1.96, hei: 1.33, accel: 15.4, maxSpeed: 335, brake: 15.8, fuelUse: 15.0, tank: 85,  grip: 1.18, pitch: 0.62, sound: 'v12',    fuel: 'AI-100' },
  { id: 'porsche911', name: 'Porsche 911 GT3 RS',         price: 3_600_000_000, body: 'super', len: 4.57, wid: 1.90, hei: 1.32, accel: 15.8, maxSpeed: 340, brake: 16.5, fuelUse: 13.4, tank: 64,  grip: 1.24, pitch: 0.64, sound: 'v12',    fuel: 'AI-100' },
  { id: 'concept037', name: 'Concept 037 GT',             price: 3_900_000_000, body: 'super', len: 4.65, wid: 1.95, hei: 1.18, accel: 16.2, maxSpeed: 345, brake: 16.2, fuelUse: 12.5, tank: 75,  grip: 1.21, pitch: 0.62, sound: 'v12',    fuel: 'AI-100' },
  { id: 'lambo',      name: 'Lamborghini Aventador',      price: 4_200_000_000, body: 'super', len: 4.80, wid: 2.03, hei: 1.14, accel: 16.5, maxSpeed: 350, brake: 16.0, fuelUse: 16.0, tank: 85,  grip: 1.20, pitch: 0.60, sound: 'v12',    fuel: 'AI-100' },
  { id: 'sf90',       name: 'Ferrari SF90 Spider',        price: 4_800_000_000, body: 'super', len: 4.70, wid: 1.97, hei: 1.19, accel: 17.5, maxSpeed: 365, brake: 16.8, fuelUse: 13.5, tank: 68,  grip: 1.23, pitch: 0.58, sound: 'v12',    fuel: 'AI-100' },
  { id: 'roadster',   name: 'Tesla Roadster 2020',        price: 5_200_000_000, body: 'super', len: 4.63, wid: 1.95, hei: 1.20, accel: 18.5, maxSpeed: 380, brake: 17.0, fuelUse: 6.5,  tank: 90,  grip: 1.25, pitch: 0.90, sound: 'turbo4', fuel: 'AI-100' },
  { id: 'bolide',     name: 'Bugatti Bolide W16',         price: 7_500_000_000, body: 'super', len: 4.75, wid: 2.04, hei: 1.05, accel: 19.5, maxSpeed: 420, brake: 18.0, fuelUse: 18.0, tank: 100, grip: 1.28, pitch: 0.55, sound: 'v12',    fuel: 'AI-100' },
];

export const carById = (id) => CARS.find((c) => c.id === id) || CARS[1];

export const FUELS = {
  'AI-92':  { price: 10_500, color: '#4caf50' },
  'AI-95':  { price: 12_800, color: '#ff9800' },
  'AI-100': { price: 16_500, color: '#e91e63' },
};

export const COLORS = ['#f5f5f5', '#111111', '#9e9e9e', '#c62828', '#1565c0', '#2e7d32', '#f9a825', '#6a1b9a', '#00838f', '#ef6c00', '#ad1457', '#37474f'];

export const TUNING = {
  rims:    { name: 'Disklar',    options: [{ id: 'std', name: 'Standart', price: 0 }, { id: 'sport', name: 'Sport (qora)', price: 8_000_000 }, { id: 'chrome', name: 'Xrom', price: 15_000_000 }, { id: 'gold', name: 'Oltin', price: 30_000_000 }] },
  spoiler: { name: 'Spoyler',    options: [{ id: 'none', name: "Yo'q", price: 0 }, { id: 'lip', name: 'Kichik', price: 5_000_000 }, { id: 'wing', name: 'Katta qanot', price: 18_000_000 }] },
  neon:    { name: 'Neon',       options: [{ id: 'none', name: "Yo'q", price: 0 }, { id: '#00e5ff', name: 'Moviy', price: 7_000_000 }, { id: '#ff00d4', name: 'Pushti', price: 7_000_000 }, { id: '#76ff03', name: 'Yashil', price: 7_000_000 }, { id: '#ffea00', name: 'Sariq', price: 7_000_000 }] },
  engine:  { name: 'Dvigatel',   options: [{ id: 0, name: 'Standart', price: 0 }, { id: 1, name: 'Stage 1 (+10%)', price: 20_000_000 }, { id: 2, name: 'Stage 2 (+20%)', price: 45_000_000 }, { id: 3, name: 'Stage 3 (+32%)', price: 90_000_000 }] },
};

// Toshkent Open-World xaritasi: 14 x 14 yirik kvartal (jami ~1.7 km x 1.7 km)
export const CITY = { N: 14, BLOCK: 96, ROAD: 22 };
CITY.CELL = CITY.BLOCK + CITY.ROAD;
CITY.SIZE = CITY.N * CITY.CELL + CITY.ROAD;
CITY.HALF = CITY.SIZE / 2;

export const DAY_LENGTH_SEC = 24 * 60; // 24 daqiqa real vaqt = 24 soat o'yin vaqti
export const KM_BONUS = 500_000;        // har 10 km uchun
export const DAILY_BONUS = 25_000_000;

export const fmt = (n) => Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ') + " so'm";
