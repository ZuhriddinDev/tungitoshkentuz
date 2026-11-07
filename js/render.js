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

function detectGpuCapability(renderer) {
  let isHighEndMobile = false;
  try {
    const gl = renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const gpuStr = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
    const cores = navigator.hardwareConcurrency || 4;
    const mem = navigator.deviceMemory || 4;
    if (/Apple GPU|A1[4-9]|M[1-5]|Adreno \(TM\) [678]\d\d|Mali-G[789]\d/i.test(gpuStr) || (cores >= 6 && mem >= 6)) {
      isHighEndMobile = true;
    }
  } catch { /* */ }
  return { isHighEndMobile };
}

export function createRenderer(canvas, quality) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !IS_MOBILE || (devicePixelRatio || 1) < 2,
    powerPreference: 'high-performance',
    stencil: false,
  });
  const gpuCap = detectGpuCapability(renderer);

  // GPU xotirasi tugasa — foydalanuvchiga xabar berib, xavfsiz rejimga o'tkazamiz
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    const t = document.getElementById('loadText');
    if (t) t.textContent = "Grafika xotirasi tiklanmoqda... (Sifat avtomatik ravishda moslashtirildi)";
    try {
      const k = 'tungi-toshkent-save-v3';
      const s = JSON.parse(localStorage.getItem(k) || '{}');
      if (s.settings) { s.settings.quality = 'medium'; localStorage.setItem(k, JSON.stringify(s)); }
    } catch { /* */ }
    setTimeout(() => location.reload(), 1200);
  }, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;

  let composer, bloom, preset, scene, camera, activeQuality = quality;
  const R = {
    renderer,
    envMap,
    get preset() { return preset; },
    get activeQuality() { return activeQuality; },
    getMetrics() {
      const info = renderer.info;
      const memHeap = performance.memory ? Math.round(performance.memory.usedJSHeapSize / (1024 * 1024)) : null;
      return {
        quality: activeQuality || 'high',
        gpuTier: gpuCap.isHighEndMobile ? 'High-Tier GPU' : IS_MOBILE ? 'Mobile GPU' : 'Desktop GPU',
        drawCalls: info.render.calls,
        calls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        memoryMB: memHeap,
        heapMb: memHeap,
      };
    },
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
      activeQuality = q || (IS_MOBILE ? 'medium' : 'high');
      preset = { ...(PRESETS[activeQuality] || (IS_MOBILE ? PRESETS.medium : PRESETS.high)) };
      // Mobil qurilmalarda tanlangan sifat darajasini (Low / Medium / High / Ultra) haqiqatan qo'llab-quvvatlaymiz:
      // High va Ultra rejimlarida mobil ekranda ham sifatli soyalar, reflekslar va yuqori aniqlik yoqiladi!
      if (IS_MOBILE) {
        if (activeQuality === 'low') {
          preset = { ...preset, pr: 1.0, shadows: false, map: 512, bloom: false, traffic: 4, peds: 14 };
        } else if (activeQuality === 'medium') {
          preset = { ...preset, pr: 1.25, shadows: false, map: 1024, bloom: false, traffic: 6, peds: 22 };
        } else if (activeQuality === 'high') {
          preset = {
            ...preset,
            pr: gpuCap.isHighEndMobile ? 1.65 : 1.4,
            shadows: true,
            map: 1024,
            bloom: gpuCap.isHighEndMobile,
            traffic: 8,
            peds: 32,
          };
        } else if (activeQuality === 'ultra') {
          preset = {
            ...preset,
            pr: gpuCap.isHighEndMobile ? 2.0 : 1.65,
            shadows: true,
            map: gpuCap.isHighEndMobile ? 2048 : 1024,
            bloom: true,
            traffic: 10,
            peds: 42,
          };
        }
      }
      const pr = Math.min(devicePixelRatio || 1, preset.pr);
      renderer.setPixelRatio(pr);
      renderer.shadowMap.enabled = preset.shadows;
      composer?.setPixelRatio(pr);
      scene?.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
      R.resize();
    },
    resize() {
      if (IS_MOBILE && document.activeElement?.tagName !== 'INPUT') {
        window.scrollTo(0, 0);
      }
      const vv = window.visualViewport;
      const rawW = vv && vv.width > 0 ? vv.width : (window.innerWidth || document.documentElement.clientWidth);
      const rawH = vv && vv.height > 0 ? vv.height : (window.innerHeight || document.documentElement.clientHeight);

      const isPhoneDevice = IS_MOBILE || document.body.classList.contains('phone');
      const isPortrait = rawH > rawW;
      // Agar telefon vertikal bo'lsa va foydalanuvchi "Gorizontal rejim" tugmasini bosgan bo'lsa,
      // avtomatik 90° buriladi; agar telefon jismonan yonbosh aylantirilsa, tabiiy toza landscape bo'ladi.
      const shouldRotate90 = isPhoneDevice && isPortrait && !!window.__forceLandscapeRot;

      const w = Math.max(240, Math.round(shouldRotate90 ? rawH : rawW));
      const h = Math.max(180, Math.round(shouldRotate90 ? rawW : rawH));

      document.documentElement.style.setProperty('--app-w', `${w}px`);
      document.documentElement.style.setProperty('--app-h', `${h}px`);
      document.documentElement.classList.toggle('auto-landscape-html', shouldRotate90);
      document.body.classList.toggle('auto-landscape-rot', shouldRotate90);
      document.body.classList.toggle('is-portrait', isPortrait && !shouldRotate90);
      document.body.classList.toggle('is-landscape', !isPortrait || shouldRotate90);

      // Portrait rejimda hint ko'rsatish
      const rHint = document.getElementById('rotateHint');
      if (rHint) {
        if (isPhoneDevice && isPortrait && !shouldRotate90 && !window.__hideRotateHint) {
          rHint.style.display = 'flex';
        } else {
          rHint.style.display = 'none';
        }
      }

      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      renderer.setSize(w, h, false);
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
      scene.environmentIntensity = 0.52 + (1 - night) * 0.45;
      if (preset.bloom) {
        bloom.strength = 0.16 + night * 0.28;
        bloom.threshold = 0.92 - night * 0.08;
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
    },
  };
  const triggerResizeSync = () => {
    R.resize();
    setTimeout(() => R.resize(), 80);
    setTimeout(() => R.resize(), 250);
    setTimeout(() => R.resize(), 500);
  };
  window.__triggerAutoLandscape = () => {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      screen.orientation?.lock?.('landscape').catch(() => {});
    } catch { /* */ }
    window.__forceLandscapeRot = true;
    window.__hideRotateHint = true;
    const rHint = document.getElementById('rotateHint');
    if (rHint) rHint.style.display = 'none';
    triggerResizeSync();
  };
  addEventListener('resize', () => R.resize());
  addEventListener('orientationchange', triggerResizeSync);
  if (screen.orientation && screen.orientation.addEventListener) {
    screen.orientation.addEventListener('change', triggerResizeSync);
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => R.resize());
    window.visualViewport.addEventListener('scroll', () => R.resize());
  }
  return R;
}
