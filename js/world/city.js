// ============================================================================
// TUNGI TOSHKENT V11 — 5x5 KM (25 km²) CITY INTEGRATION & CHUNK STREAMING
// ============================================================================
import * as THREE from 'three';
import { HALF, addCollider } from './layout.js';
import { ChunkStreamer, nightMats as chunkNightMats } from './chunkManager.js';

export const nightMats = chunkNightMats;
export const citySectors = [];
export let waterMat;
export let streamerInstance = null;

export function getChunkStreamer() {
  return streamerInstance;
}

export function buildCity(scene, quality) {
  citySectors.length = 0;
  streamerInstance = new ChunkStreamer(scene);

  // Shahar tashqi chegaralari (25 km² atrofidagi yumshoq himoya chegarasi)
  const E = HALF + 40;
  addCollider(-E - 10, -E - 10, E + 10, -E, 'border');
  addCollider(-E - 10, E, E + 10, E + 10, 'border');
  addCollider(-E - 10, -E, -E, E, 'border');
  addCollider(E, -E, E + 10, E, 'border');

  return streamerInstance.rootGroup;
}

// O'yinchi harakatlanganda ufq va 250m chunklarni dinamik yuklash / boshqarish
export function updateCitySectors(px, pz, maxDist = 950) {
  if (streamerInstance) {
    streamerInstance.update(px, pz, {
      activeRadius: Math.max(500, maxDist * 0.72),
      lodRadius: Math.max(1100, maxDist * 1.4),
    });
  }
}
