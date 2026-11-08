import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const SOURCES = {
  'bmw_i6': 'audio/sources/bmw_i6.m4a',
  'bmw_v8': 'audio/sources/bmw_v8.m4a',
  'amg_v8': 'audio/sources/amg_v8.m4a',
  'malibu_turbo': 'audio/sources/malibu_turbo.m4a',
  'kia_turbo': 'audio/sources/kia_turbo.m4a',
  'gentra_i4': 'audio/sources/gentra_i4.m4a',
  'hemi_v8': 'audio/sources/hemi_v8.m4a',
  'ferrari_v12': 'audio/sources/ferrari_599_hgte.mp3',
  'lambo_v12': 'audio/sources/lambo_aventador.ogg',
  'porsche_f6': 'audio/sources/porsche_f6.m4a',
  'tesla_ev': 'audio/sources/tesla_roadster.ogg',
  'w12': 'audio/sources/w12.m4a',
};

const outDir = path.resolve('audio/engines');
fs.mkdirSync(outDir, { recursive: true });

for (const [id, srcPath] of Object.entries(SOURCES)) {
  const dest = path.join(outDir, `${id}.mp3`);
  console.log(`Converting ${id}: ${srcPath} -> ${dest}...`);
  try {
    // 96kbps MP3 stereo 44100Hz
    execSync(`ffmpeg -y -i "${srcPath}" -ar 44100 -b:a 96k "${dest}"`, { stdio: 'inherit' });
    const stat = fs.statSync(dest);
    console.log(`  Done: ${id}.mp3 (${(stat.size / 1024).toFixed(1)} KB)`);
  } catch (err) {
    console.error(`  Error converting ${id}:`, err.message);
  }
}
