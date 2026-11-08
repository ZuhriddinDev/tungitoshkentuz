import fs from 'node:fs';
import path from 'node:path';
import { CARS } from '../js/config.js';
import { SOUND_PROFILES } from '../js/audio.js';

console.log('=== VERIFYING TUNGI TOSHKENT AUDIO SYSTEM ===\n');

// 1. Verify common audio files
console.log('1. Checking common audio files:');
const COMMON_FILES = [
  'audio/common/startup.wav',
  'audio/common/shutdown.wav',
  'audio/common/shift.wav',
  'audio/common/blowoff.wav',
  'audio/common/pop_1.wav',
  'audio/common/pop_2.wav',
  'audio/common/pop_3.wav',
];

let commonOk = true;
for (const file of COMMON_FILES) {
  if (!fs.existsSync(file)) {
    console.error(`  [FAIL] Missing common file: ${file}`);
    commonOk = false;
  } else {
    const size = fs.statSync(file).size;
    if (size === 0) {
      console.error(`  [FAIL] File is empty: ${file}`);
      commonOk = false;
    } else {
      console.log(`  [OK] ${file.padEnd(28)} (${(size / 1024).toFixed(1)} KB)`);
    }
  }
}

// 2. Verify all 21 in-game vehicles
console.log('\n2. Checking all 21 in-game vehicles and sound profiles:');
let carsOk = true;
const profileSet = new Set();

for (const car of CARS) {
  const profKey = car.sound;
  const prof = SOUND_PROFILES[profKey];
  if (!prof) {
    console.error(`  [FAIL] Vehicle ${car.name} (${car.id}) sound key "${profKey}" not in SOUND_PROFILES!`);
    carsOk = false;
    continue;
  }

  profileSet.add(profKey);

  let fileStatus = 'SYNTH / ACOUSTIC';
  if (prof.src) {
    if (!fs.existsSync(prof.src)) {
      console.error(`  [FAIL] Vehicle ${car.name} audio file missing: ${prof.src}`);
      carsOk = false;
      continue;
    }
    const sz = (fs.statSync(prof.src).size / 1024).toFixed(1);
    fileStatus = `${prof.src} (${sz} KB)`;
  }

  console.log(`  [OK] ${car.id.padEnd(12)} | ${car.name.padEnd(30)} | Sound: ${profKey.padEnd(14)} | ${fileStatus}`);
}

// 3. Verify distinct sound profiles
console.log(`\n3. Total distinct engine sound profiles used: ${profileSet.size}`);
for (const p of profileSet) {
  const prof = SOUND_PROFILES[p];
  console.log(`  - Profile [${p}]: Turbo=${prof.turbo}, Burble=${prof.burble}, BaseFreq=${prof.baseFreq}Hz, Filter=${prof.filterBase}-${prof.filterMax}Hz`);
}

if (commonOk && carsOk) {
  console.log('\n>>> ALL 21 VEHICLES AND COMMON AUDIO LAYERS VERIFIED SUCCESSFULLY! <<<');
} else {
  console.error('\n>>> SOME CHECKS FAILED! <<<');
  process.exit(1);
}
