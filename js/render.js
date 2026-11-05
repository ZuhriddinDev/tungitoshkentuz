// Renderer: ACES ranglar, soyalar, mashinalardagi aks-ado (environment map) va bloom (neon nuri)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const PRESETS = {
  low:    { pr: 0.8,  shadows: false, map: 512,  bloom: false, traffic: 4,  peds: 24 },
  medium: { pr: 1.0,  shadows: true,  map: 1024, bloom: false, traffic: 7,  peds: 40 },
  high:   { pr: 1.25, shadows: true,  map: 2048, bloom: true,  traffic: 12, peds: 70 },
  ultra:  { pr: 1.75, shadows: true,  map: 4096, bloom: true,  traffic: 18, peds: 110 },
};

export function createRenderer(canvas, quality) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  let composer, bloom, preset, scene, camera;
  const R = {
    renderer, envMap,
    get preset() { return preset; },
    attach(s, c) {
      scene = s; camera = c; scene.environment = envMap;
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.55, 0.82);
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
      R.apply(quality);
    },
    apply(q) {
      preset = PRESETS[q] || PRESETS.medium;
      renderer.setPixelRatio(Math.min(devicePixelRatio, preset.pr));
      renderer.shadowMap.enabled = preset.shadows;
      scene?.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
      R.resize();
    },
    resize() {
      const w = innerWidth, h = innerHeight;
      renderer.setSize(w, h);
      composer?.setSize(w, h);
      if (camera) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
    },
    // night: 0 (kun) .. 1 (tun)
    render(night) {
      renderer.toneMappingExposure = 0.95 + night * 0.1;
      scene.environmentIntensity = 0.16 + (1 - night) * 0.55;
      if (preset.bloom) {
        bloom.strength = 0.12 + night * 0.3;
        bloom.threshold = 0.95 - night * 0.08;
        composer.render();
      } else renderer.render(scene, camera);
    },
  };
  addEventListener('resize', () => R.resize());
  return R;
}


