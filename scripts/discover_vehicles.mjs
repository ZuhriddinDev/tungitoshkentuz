// ============================================================================
// TUNGI TOSHKENT — RECURSIVE GLB VEHICLE DISCOVERY & AUDIO VALIDATION TOOL
// ============================================================================
// Scans car/opt/ and car3d/ recursively, reads GLB JSON chunk metadata,
// identifies duplicates/unknowns, verifies engine classifications & audio
// assets on disk, and writes data/vehicle_audio_manifest.json.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARS } from '../js/config.js';
import { ENGINE_DATABASE, getEngineSpec } from '../js/engineDb.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function walkGlbs(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkGlbs(full, out);
    else if (ent.isFile() && ent.name.toLowerCase().endsWith('.glb')) out.push(full);
  }
  return out;
}

function readGlbJson(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const hdr = Buffer.alloc(20);
    fs.readSync(fd, hdr, 0, 20, 0);
    if (hdr.readUInt32LE(0) !== 0x46546c67) return null; // 'glTF'
    const jsonLen = hdr.readUInt32LE(12);
    const jsonBuf = Buffer.alloc(jsonLen);
    fs.readSync(fd, jsonBuf, 0, jsonLen, 20);
    return JSON.parse(jsonBuf.toString('utf8'));
  } catch {
    return null;
  } finally {
    fs.closeSync(fd);
  }
}

// Parse GLB_SPECS file map from js/carModel.js
const carModelSrc = fs.readFileSync(path.join(ROOT, 'js/carModel.js'), 'utf8');
const glbSpecFileById = new Map();
const idByGlbFile = new Map();
for (const m of carModelSrc.matchAll(/(\w+):\s*\{\s*[\r\n]+\s*file:\s*'([^']+)'/g)) {
  const id = m[1];
  const file = m[2];
  glbSpecFileById.set(id, file);
  idByGlbFile.set(path.basename(file).toLowerCase(), id);
}

const optGlbs = walkGlbs(path.join(ROOT, 'car/opt'));
const rawGlbs = walkGlbs(path.join(ROOT, 'car3d'));

const discovered = [];
const seenBasenames = new Map();

for (const abs of optGlbs) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const base = path.basename(abs).toLowerCase();
  const glbJson = readGlbJson(abs);
  const vid = idByGlbFile.get(base) || null;
  const carCfg = vid ? CARS.find((c) => c.id === vid) : null;
  const engineSpec = getEngineSpec(vid);

  const missingAssets = (engineSpec.soundAssetPaths || []).filter(
    (a) => !fs.existsSync(path.join(ROOT, a))
  );

  const isDuplicate = seenBasenames.has(base);
  seenBasenames.set(base, rel);

  discovered.push({
    glbPath: rel,
    filename: path.basename(abs),
    sizeBytes: fs.statSync(abs).size,
    generator: glbJson?.asset?.generator || null,
    extras: glbJson?.asset?.extras || null,
    meshCount: glbJson?.meshes?.length || 0,
    materialCount: glbJson?.materials?.length || 0,
    vehicleId: vid || 'UNKNOWN',
    registeredInCars: !!carCfg,
    manufacturer: engineSpec.manufacturer,
    model: engineSpec.model,
    modelYear: engineSpec.modelYear,
    engineType: engineSpec.engineType,
    powertrain: engineSpec.powertrain,
    idleRPM: engineSpec.idleRPM,
    redlineRPM: engineSpec.redlineRPM,
    audioProfile: engineSpec.audioProfile,
    soundAssetPaths: engineSpec.soundAssetPaths,
    missingAssets,
    confidence: vid && engineSpec.engineType !== 'UNKNOWN' ? 'verified' : 'unknown',
    isDuplicate,
  });
}

const manifest = {
  generatedAt: new Date().toISOString(),
  optGlbCount: optGlbs.length,
  rawCar3dGlbCount: rawGlbs.length,
  registeredCarsCount: CARS.length,
  engineDbCount: Object.keys(ENGINE_DATABASE).length,
  unknownCount: discovered.filter((d) => d.engineType === 'UNKNOWN').length,
  missingAssetVehicles: discovered.filter((d) => d.missingAssets.length > 0).map((d) => d.vehicleId),
  vehicles: discovered,
};

fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'data/vehicle_audio_manifest.json'), JSON.stringify(manifest, null, 2));

console.log(`Discovered ${optGlbs.length} opt GLBs (${rawGlbs.length} in car3d/).`);
console.log(`Verified vehicles: ${discovered.filter((d) => d.confidence === 'verified').length} | Unknown: ${manifest.unknownCount} | Missing assets: ${manifest.missingAssetVehicles.length}`);
for (const v of discovered) {
  console.log(`  [${v.confidence.toUpperCase()}] ${v.vehicleId.padEnd(13)} | ${v.filename.padEnd(40)} | ${v.engineType.padEnd(12)} | ${v.audioProfile.padEnd(15)} | missing=${v.missingAssets.length}`);
}
