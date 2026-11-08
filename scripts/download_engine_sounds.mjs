import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'https://raw.githubusercontent.com/sathyaram/exhaustnotes/master/public/sounds/';

// Mapping of cars to real authentic recordings
const SOUND_FILES = {
  // BMW
  'bmw_i6.m4a': 'm4.m4a',          // BMW M4 Twin-Turbo S55/S58 3.0L Inline-6 (used for M4 GTS, M4 Comp, X7, Supra)
  'bmw_v8.m4a': 'corvette.m4a',    // 6.2L V8 high output / American/Euro performance V8
  // Mercedes
  'amg_v8.m4a': 'e63.m4a',         // Mercedes-AMG E63 / G63 4.0L Bi-Turbo V8 (for Gelik, E55, Maybach)
  'amg_gtr.m4a': 'amggtr.m4a',     // Mercedes-AMG GT-R dry-sump 4.0L Biturbo V8
  // Chevrolet Malibu Turbo
  'malibu_turbo.m4a': 'golfgti.m4a', // 2.0L Turbo 4-cylinder (high-torque turbo spool)
  // Kia Turbo
  'kia_turbo.m4a': 'velostern.m4a',  // 2.0L Turbo 4-cylinder with aggressive exhaust burble & pops
  // Gentra NA 4-cylinder
  'gentra_i4.m4a': 'toyota86.m4a',   // 2.0L Naturally Aspirated 4-cylinder
  // Dodge HEMI V8
  'hemi_v8.m4a': 'hellcat.m4a',      // Dodge Challenger 6.2L Supercharged HEMI V8
  // Supercars & Hypercars
  'ferrari_v12.m4a': 'ferrari458.m4a', // Ferrari screaming flat-plane / V12 exhaust note
  'lambo_v12.m4a': 'huracan.m4a',      // Screaming high-rev Lamborghini V10/V12
  'porsche_f6.m4a': '911gt2rs.m4a',    // Porsche 911 Twin-Turbo Boxer-6
  'w12.m4a': 'continentalgt.m4a',      // Bentley 6.0L Twin-Turbo W12
};

async function download() {
  const outDir = path.resolve('audio/sources');
  fs.mkdirSync(outDir, { recursive: true });

  for (const [localName, remoteName] of Object.entries(SOUND_FILES)) {
    const dest = path.join(outDir, localName);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
      console.log(`Already exists: ${localName}`);
      continue;
    }
    const url = BASE_URL + remoteName;
    console.log(`Downloading ${remoteName} -> ${localName}...`);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buf);
      console.log(`  Saved ${localName} (${(buf.length / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.error(`  Failed ${remoteName}:`, err.message);
    }
  }
}

download().catch(console.error);
