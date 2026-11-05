// Renderer: ACES Filmic HDR ranglar, yumshoq soyalar, yorqin metall aks-sado (envMap) va tezkor UnrealBloom
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const PRESETS = {
  low:    { pr: 1.0,  shadows: false, map: 512,  bloom: false, traffic: 4,  peds: 16 },
  medium: { pr: 1.15, shadows: false, map: 1024, bloom: false, traffic: 6,  peds: 24 },
  high:   { pr: 1.75, shadows: true,  map: 2048, bloom: true,  traffic: 10, peds: 50 },
  ultra:  { pr: 2.1,  shadows: true,  map: 4096, bloom: true,  traffic: 16, peds: 90 },
};

export const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900);

export function createRenderer(canvas, quality) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !IS_MOBILE,
    powerPreference: 'high-performance',
    stencil: false,
  });
  // GPU xotirasi tugasa (ko'pincha telefonda) — foydalanuvchiga xabar berib, sahifani qayta yuklaymiz
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    const t = document.getElementById('loadText');
    if (t) t.textContent = "Grafika xotirasi tugadi. Sahifa qayta yuklanmoqda... (Sozlamalarda grafikani 'Past' qiling)";
    try {
      const k = 'tungi-toshkent-save-v3';
      const s = JSON.parse(localStorage.getItem(k) || '{}');
      if (s.settings) { s.settings.quality = 'low'; localStorage.setItem(k, JSON.stringify(s)); }
    } catch { /* */ }
    setTimeout(() => location.reload(), 1500);
  }, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;

  let composer, bloom, preset, scene, camera;
  const R = {
    renderer,
    envMap,
    get preset() { return preset; },
    attach(s, c) {
      scene = s;
      camera = c;
      scene.environment = envMap;
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      // Yarim o'lchamli bloom: telefon va kompyuterda yuqori FPS bilan chiroyli neon nuri beradi
      bloom = new UnrealBloomPass(
        new THREE.Vector2(Math.max(256, innerWidth >> 1), Math.max(256, innerHeight >> 1)),
        0.48,
        0.52,
        0.84
      );
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
      R.apply(quality);
    },
    apply(q) {
      preset = PRESETS[q] || (IS_MOBILE ? PRESETS.medium : PRESETS.high);
      // Telefon: GPU xotirasi va batareyani tejash, 60 FPS silliq ishlashi uchun Bloom va og'ir soyalarni o'chirish
      if (IS_MOBILE) {
        preset = {
          ...preset,
          pr: Math.min(preset.pr, 1.15),
          shadows: false, // Mobil qurilmada og'ir PC soyalar o'chiriladi -> FPS 2-3 barobar oshadi!
          bloom: false,   // UnrealBloom telefonda sekundiga 20-30 FPS yo'qotadi
          traffic: Math.min(preset.traffic, 6),
          peds: Math.min(preset.peds, 20),
        };
      }
      const pr = Math.min(devicePixelRatio || 1, preset.pr);
      renderer.setPixelRatio(pr);
      renderer.shadowMap.enabled = preset.shadows;
      composer?.setPixelRatio(pr);
      scene?.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
      R.resize();
    },
    resize() {
      const w = innerWidth, h = innerHeight;
      renderer.setSize(w, h);
      composer?.setSize(w, h);
      bloom?.resolution?.set(Math.max(256, w >> 1), Math.max(256, h >> 1));
      if (camera) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
    },
    // night: 0 (kun) .. 1 (tun)
    render(night) {
      // Tungi rejimda ham mashina kuzovi va shahar yorqin, tiniq ko'rinishi uchun
      renderer.toneMappingExposure = 1.08 + night * 0.16;
      scene.environmentIntensity = 0.48 + (1 - night) * 0.45;
      if (preset.bloom) {
        bloom.strength = 0.16 + night * 0.28;
        bloom.threshold = 0.92 - night * 0.08;
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
    },
  };
  addEventListener('resize', () => R.resize());
  return R;
}
