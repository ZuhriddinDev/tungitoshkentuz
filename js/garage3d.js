// Garaj va avtosalon uchun aylanuvchi 3D ko'rgazma podiumi (GLB modelli, mobil va kompyuterga mos)
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildCar, preloadCar, isCarReady } from './carModel.js';
import { showBusy, hideBusy, setBusyProgress } from './busy.js';

let renderer, scene, camera, carGroup, raf = 0, angle = 0.55, drag = null;

function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.32;
  renderer.shadowMap.enabled = true;
  scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.035).texture;
  scene.environmentIntensity = 1.15;
  camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 200);

  // Ko'rgazma podiumi va ikki qavatli neon halqa
  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(4.4, 4.65, 0.24, 64),
    new THREE.MeshStandardMaterial({ color: 0x101528, metalness: 0.85, roughness: 0.2 })
  );
  floor.position.y = -0.12;
  floor.receiveShadow = true;
  scene.add(floor);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(4.5, 0.045, 10, 96).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x00e5ff })
  );
  scene.add(ring);

  const innerRing = new THREE.Mesh(
    new THREE.TorusGeometry(3.4, 0.025, 8, 72).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xff2bd6 })
  );
  innerRing.position.y = 0.01;
  scene.add(innerRing);

  const key = new THREE.SpotLight(0xffffff, 75, 34, 0.68, 0.5);
  key.position.set(4, 8, 5);
  key.castShadow = true;
  scene.add(key);

  const rim2 = new THREE.PointLight(0xff2bd6, 28, 22);
  rim2.position.set(-5, 2.2, -4);
  scene.add(rim2);

  const fill = new THREE.PointLight(0x00e5ff, 24, 22);
  fill.position.set(5, 1.8, -3);
  scene.add(fill);

  scene.add(new THREE.AmbientLight(0xffffff, 0.72));
}

function bindDrag(canvas) {
  canvas.style.touchAction = 'pan-y';
  canvas.onpointerdown = (e) => {
    drag = e.clientX;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
  };
  canvas.onpointermove = (e) => {
    if (drag !== null) {
      angle -= (e.clientX - drag) * 0.012;
      drag = e.clientX;
    }
  };
  canvas.onpointerup = canvas.onpointercancel = () => { drag = null; };
}

export function rotateGarage(delta = 0.45) {
  angle += delta;
}

export function showCar(canvas, cfg, look) {
  if (!renderer) init();
  bindDrag(canvas);

  if (carGroup) {
    scene.remove(carGroup);
    carGroup = null;
  }

  if (!isCarReady(cfg)) {
    showBusy(cfg.name, 'Mashina modeli yuklanmoqda...');
    preloadCar(cfg, setBusyProgress).finally(hideBusy);
  }
  const built = buildCar(cfg, look, { beam: false, priority: true });
  built.setLights(true);
  carGroup = built.group;
  scene.add(carGroup);

  const fit = Math.max(cfg.len * 1.02, 4.1);
  cancelAnimationFrame(raf);

  const dpr = Math.min(devicePixelRatio || 1, 2);
  const loop = () => {
    if (!canvas.isConnected) { raf = 0; return; }
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w && h) {
      const tw = Math.round(w * dpr), th = Math.round(h * dpr);
      if (canvas.width !== tw || canvas.height !== th) {
        canvas.width = tw;
        canvas.height = th;
      }
      renderer.setSize(tw, th, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (drag === null) angle += 0.0055;
      camera.position.set(
        Math.sin(angle) * fit * 1.48,
        fit * 0.40,
        Math.cos(angle) * fit * 1.48
      );
      camera.lookAt(0, cfg.hei * 0.42, 0);
      renderer.render(scene, camera);
      const ctx2d = canvas.getContext('2d');
      ctx2d.clearRect(0, 0, tw, th);
      ctx2d.drawImage(renderer.domElement, 0, 0);
    }
    raf = requestAnimationFrame(loop);
  };
  loop();

  return built;
}

export function stopGarage() { cancelAnimationFrame(raf); raf = 0; }
