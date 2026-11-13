// ============================================================================
// TUNGI TOSHKENT — CENTRALIZED ENGINE CLASSIFICATION & AUDIO DATABASE
// ============================================================================
// Verified model-specific powertrain, cylinder, RPM, aspiration, and audio
// configuration for every vehicle in TUNGI TOSHKENT.
// Unknown / unregistered GLBs are explicitly flagged as UNKNOWN rather than
// receiving random V8/V12 assignments.

const OVERRIDE_STORAGE_KEY = 'tt_engine_overrides_v1';

export const ENGINE_CATEGORIES = {
  I3_NA:        { label: 'Inline-3 NA',            cylinders: 3,  aspiration: 'Naturally Aspirated', powertrain: 'ice' },
  I4_NA:        { label: 'Inline-4 NA',            cylinders: 4,  aspiration: 'Naturally Aspirated', powertrain: 'ice' },
  I4_TURBO:     { label: 'Inline-4 Turbo',         cylinders: 4,  aspiration: 'Turbocharged',        powertrain: 'ice' },
  I4_PHEV:      { label: 'Inline-4 Turbo + EV',    cylinders: 4,  aspiration: 'Plug-in Hybrid',      powertrain: 'hybrid' },
  I6_NA:        { label: 'Inline-6 NA',            cylinders: 6,  aspiration: 'Naturally Aspirated', powertrain: 'ice' },
  I6_TT:        { label: 'Inline-6 Twin-Turbo',    cylinders: 6,  aspiration: 'Twin-Turbo',          powertrain: 'ice' },
  F6_NA:        { label: 'Flat-6 NA',              cylinders: 6,  aspiration: 'Naturally Aspirated', powertrain: 'ice' },
  V6_NA:        { label: 'V6 NA',                  cylinders: 6,  aspiration: 'Naturally Aspirated', powertrain: 'ice' },
  V6_TT:        { label: 'V6 Twin-Turbo',          cylinders: 6,  aspiration: 'Twin-Turbo',          powertrain: 'ice' },
  V8_NA:        { label: 'V8 NA',                  cylinders: 8,  aspiration: 'Naturally Aspirated', powertrain: 'ice' },
  V8_SC:        { label: 'V8 Supercharged',        cylinders: 8,  aspiration: 'Supercharged',        powertrain: 'ice' },
  V8_TT:        { label: 'V8 Twin-Turbo',          cylinders: 8,  aspiration: 'Twin-Turbo',          powertrain: 'ice' },
  V8_TT_HYBRID: { label: 'V8 Twin-Turbo Hybrid',   cylinders: 8,  aspiration: 'Twin-Turbo + EV',     powertrain: 'hybrid' },
  V10_NA:       { label: 'V10 NA',                 cylinders: 10, aspiration: 'Naturally Aspirated', powertrain: 'ice' },
  V12_NA:       { label: 'V12 NA',                 cylinders: 12, aspiration: 'Naturally Aspirated', powertrain: 'ice' },
  V12_TT:       { label: 'V12 Twin-Turbo',         cylinders: 12, aspiration: 'Twin-Turbo',          powertrain: 'ice' },
  V12_HYBRID:   { label: 'V12 NA + Electric',      cylinders: 12, aspiration: 'Hybrid V12',          powertrain: 'hybrid' },
  DIESEL:       { label: 'Turbo Diesel',           cylinders: 6,  aspiration: 'Turbo Diesel',        powertrain: 'ice' },
  EV_MULTI:     { label: 'Electric Drivetrain',    cylinders: 0,  aspiration: 'Electric',            powertrain: 'electric' },
  UNKNOWN:      { label: 'UNKNOWN',                cylinders: 0,  aspiration: 'Unknown',             powertrain: 'unknown' },
};

const COMMON_ICE_ASSETS = [
  'audio/common/startup.wav',
  'audio/common/shutdown.wav',
  'audio/common/shift.wav',
  'audio/common/pop_1.wav',
  'audio/common/pop_2.wav',
  'audio/common/pop_3.wav',
];

function entry(vehicleId, manufacturer, model, modelYear, engineType, idleRPM, redlineRPM, audioProfile, mainAsset, extraAssets = []) {
  const cat = ENGINE_CATEGORIES[engineType] || ENGINE_CATEGORIES.UNKNOWN;
  const assets = [];
  if (mainAsset) assets.push(mainAsset);
  if (cat.powertrain === 'ice' || cat.powertrain === 'hybrid') {
    assets.push(...COMMON_ICE_ASSETS, ...extraAssets);
  }
  return {
    vehicleId,
    manufacturer,
    model,
    modelYear,
    engineType,
    aspiration: cat.aspiration,
    cylinderCount: cat.cylinders,
    powertrain: cat.powertrain,
    idleRPM,
    redlineRPM,
    audioProfile,
    soundAssetPaths: [...new Set(assets)],
    confidence: engineType === 'UNKNOWN' ? 'unknown' : 'verified',
    verificationStatus: engineType === 'UNKNOWN' ? 'needs_review' : 'verified',
  };
}

export const ENGINE_DATABASE = {
  spark:       entry('spark',       'Chevrolet',    'Spark M300',                 2018, 'I3_NA',        850,  6200, 'spark_i3',     null),
  nexia2:      entry('nexia2',      'Daewoo',       'Nexia II (N150)',            2014, 'I4_NA',        800,  6400, 'gentra_i4',    'audio/engines/gentra_i4.mp3'),
  gentra:      entry('gentra',      'Chevrolet',    'Lacetti / Gentra',           2020, 'I4_NA',        780,  6500, 'gentra_i4',    'audio/engines/gentra_i4.mp3'),
  kia_k5:      entry('kia_k5',      'Kia',          'K5 / Optima GT-Line',        2021, 'I4_TURBO',     750,  6600, 'kia_turbo',    'audio/engines/kia_turbo.mp3',    ['audio/common/blowoff.wav']),
  malibu:      entry('malibu',      'Chevrolet',    'Malibu Premier 2.0T',        2022, 'I4_TURBO',     750,  6700, 'malibu_turbo', 'audio/engines/malibu_turbo.mp3', ['audio/common/blowoff.wav']),
  e55:         entry('e55',         'Mercedes-AMG', 'E 55 AMG (W211)',            2005, 'V8_SC',        680,  6800, 'amg_v8',       'audio/engines/amg_v8.mp3',       ['audio/common/blowoff.wav']),
  byd_han:     entry('byd_han',     'BYD',          'Han DM-p',                   2023, 'I4_PHEV',      0,    6200, 'byd_han_phev', 'audio/engines/kia_turbo.mp3',    ['audio/engines/tesla_ev.mp3']),
  challenger:  entry('challenger',  'Dodge',        'Challenger R/T HEMI',        2021, 'V8_NA',        650,  6400, 'hemi_v8',      'audio/engines/hemi_v8.mp3'),
  supra:       entry('supra',       'Toyota',       'Supra MK4 (A80 2JZ-GTE)',    1998, 'I6_TT',        800,  7400, 'bmw_i6',       'audio/engines/bmw_i6.mp3',       ['audio/common/blowoff.wav']),
  m4gts:       entry('m4gts',       'BMW',          'M4 GTS (F82)',               2016, 'I6_TT',        780,  7600, 'bmw_i6',       'audio/engines/bmw_i6.mp3',       ['audio/common/blowoff.wav']),
  bmwx7:       entry('bmwx7',       'BMW',          'X7 xDrive40i (G07)',         2019, 'I6_TT',        700,  6800, 'bmw_i6',       'audio/engines/bmw_i6.mp3',       ['audio/common/blowoff.wav']),
  m4comp:      entry('m4comp',      'BMW',          'M4 Competition (G82)',       2022, 'I6_TT',        750,  7400, 'bmw_i6',       'audio/engines/bmw_i6.mp3',       ['audio/common/blowoff.wav']),
  bmw2018:     entry('bmw2018',     'BMW',          'M5 (F90)',                   2018, 'V8_TT',        700,  7200, 'bmw_v8',       'audio/engines/bmw_v8.mp3',       ['audio/common/blowoff.wav']),
  bmw:         entry('bmw',         'BMW',          'M5 CS (F90)',                2022, 'V8_TT',        720,  7400, 'bmw_v8',       'audio/engines/bmw_v8.mp3',       ['audio/common/blowoff.wav']),
  bmwm8:       entry('bmwm8',       'BMW',          'M8 Coupe (F92)',             2020, 'V8_TT',        720,  7400, 'bmw_v8',       'audio/engines/bmw_v8.mp3',       ['audio/common/blowoff.wav']),
  bmwm8wb:     entry('bmwm8wb',     'BMW',          'M8 Competition Widebody',    2021, 'V8_TT',        740,  7500, 'bmw_v8',       'audio/engines/bmw_v8.mp3',       ['audio/common/blowoff.wav']),
  lc300:       entry('lc300',       'Toyota',       'Land Cruiser 300 VX-R',      2022, 'V6_TT',        650,  6300, 'v6_tt',        'audio/engines/bmw_i6.mp3',       ['audio/common/blowoff.wav']),
  mercedes:    entry('mercedes',    'Mercedes-AMG', 'G 63 (W463A)',               2021, 'V8_TT',        660,  7000, 'amg_v8',       'audio/engines/amg_v8.mp3',       ['audio/common/blowoff.wav']),
  escalade:    entry('escalade',    'Cadillac',     'Escalade Premium 6.2L',      2021, 'V8_NA',        600,  6200, 'hemi_v8',      'audio/engines/hemi_v8.mp3'),
  maybach:     entry('maybach',     'Mercedes-Maybach', 'GLS 600',                2022, 'V8_TT',        620,  6600, 'amg_v8',       'audio/engines/amg_v8.mp3',       ['audio/common/blowoff.wav']),
  ferrari599:  entry('ferrari599',  'Ferrari',      '599 GTB Fiorano',            2008, 'V12_NA',       900,  8400, 'ferrari_v12',  'audio/engines/ferrari_v12.mp3'),
  yangwang_u9: entry('yangwang_u9', 'BYD YangWang', 'U9 Quad-Motor',              2024, 'EV_MULTI',     0,    18000,'tesla_ev',     'audio/engines/tesla_ev.mp3'),
  porsche911:  entry('porsche911',  'Porsche',      '911 GT3 RS (992)',           2023, 'F6_NA',        880,  9000, 'porsche_f6',   'audio/engines/porsche_f6.mp3'),
  mclaren_720s:entry('mclaren_720s','McLaren',      '720S',                       2019, 'V8_TT',        820,  8500, 'mclaren_v8_tt','audio/engines/bmw_v8.mp3',       ['audio/common/blowoff.wav']),
  lambo:       entry('lambo',       'Lamborghini',  'Aventador LP 700-4',         2018, 'V12_NA',       900,  8500, 'lambo_v12',    'audio/engines/lambo_v12.mp3'),
  sf90:        entry('sf90',        'Ferrari',      'SF90 Spider',                2022, 'V8_TT_HYBRID', 800,  8000, 'sf90_hybrid',  'audio/engines/ferrari_v12.mp3',  ['audio/engines/tesla_ev.mp3', 'audio/common/blowoff.wav']),
  roadster:    entry('roadster',    'Tesla',        'Roadster (2nd Gen)',         2020, 'EV_MULTI',     0,    18500,'tesla_ev',     'audio/engines/tesla_ev.mp3'),
  revuelto:    entry('revuelto',    'Lamborghini',  'Revuelto V12 HPEV',          2024, 'V12_HYBRID',   920,  9500, 'lambo_hybrid', 'audio/engines/lambo_v12.mp3',    ['audio/engines/tesla_ev.mp3']),
  laferrari:   entry('laferrari',   'Ferrari',      'LaFerrari',                  2015, 'V12_HYBRID',   920,  9250, 'ferrari_v12',  'audio/engines/ferrari_v12.mp3',  ['audio/engines/tesla_ev.mp3']),
  sian:        entry('sian',        'Lamborghini',  'Sián FKP 37 Roadster',       2021, 'V12_HYBRID',   900,  8700, 'lambo_hybrid', 'audio/engines/lambo_v12.mp3',    ['audio/engines/tesla_ev.mp3']),
};

function loadOverrides() {
  try {
    if (typeof localStorage === 'undefined') return {};
    return JSON.parse(localStorage.getItem(OVERRIDE_STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

export function getEngineOverride(vehicleId) {
  return loadOverrides()[vehicleId] || null;
}

export function setEngineOverride(vehicleId, patch) {
  try {
    if (typeof localStorage === 'undefined') return;
    const all = loadOverrides();
    all[vehicleId] = { ...(all[vehicleId] || {}), ...patch, verificationStatus: 'override' };
    localStorage.setItem(OVERRIDE_STORAGE_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

export function clearEngineOverride(vehicleId) {
  try {
    if (typeof localStorage === 'undefined') return;
    const all = loadOverrides();
    delete all[vehicleId];
    localStorage.setItem(OVERRIDE_STORAGE_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

export function getEngineSpec(vehicleId) {
  const base = ENGINE_DATABASE[vehicleId];
  const ov = getEngineOverride(vehicleId);
  if (!base && !ov) {
    return {
      vehicleId: vehicleId || 'unknown',
      manufacturer: 'Unknown',
      model: vehicleId || 'Unknown Model',
      modelYear: null,
      engineType: 'UNKNOWN',
      aspiration: 'Unknown',
      cylinderCount: 0,
      powertrain: 'unknown',
      idleRPM: 750,
      redlineRPM: 6500,
      audioProfile: 'unknown_neutral',
      soundAssetPaths: [],
      confidence: 'unknown',
      verificationStatus: 'needs_review',
    };
  }
  const merged = { ...(base || {}), ...(ov || {}) };
  if (ov?.engineType && ENGINE_CATEGORIES[ov.engineType]) {
    const cat = ENGINE_CATEGORIES[ov.engineType];
    merged.aspiration = cat.aspiration;
    merged.cylinderCount = cat.cylinders;
    merged.powertrain = cat.powertrain;
  }
  return merged;
}
