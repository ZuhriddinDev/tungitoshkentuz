// Garaj va avtosalon uchun aylanuvchi 3D namoyish sahnasi (GLB modelli)
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildCar, preloadCar, isCarReady } from './carModel.js';
import { showBusy, hideBusy, setBusyProgress } from './busy.js';

let renderer, scene, camera, carGroup, raf = 0, angle = 0.5, drag = null;

function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  camera = new THREE.PerspectiveCamera(35, 16 / 10, 0.1, 200);

  // Ko'rgazma podiumi va neon halqa
  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(4.5, 4.7, 0.25, 64),
    new THREE.MeshStandardMaterial({ color: 0x15182a, metalness: 0.8, roughness: 0.25 })
  );
  floor.position.y = -0.125;
  floor.receiveShadow = true;
  scene.add(floor);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(4.6, 0.04, 8, 96).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x00e5ff })
  );
  scene.add(ring);

  const key = new THREE.SpotLight(0xffffff, 65, 32, 0.65, 0.5);
  key.position.set(4, 8, 5);
  key.castShadow = true;
  scene.add(key);

  const rim2 = new THREE.PointLight(0xff2bd6, 25, 22);
  rim2.position.set(-5, 2.2, -4);
  scene.add(rim2);

  const fill = new THREE.PointLight(0x00e5ff, 20, 22);
  fill.position.set(5, 1.8, -3);
  scene.add(fill);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
}

function bindDrag(canvas) {
  canvas.onpointerdown = (e) => { drag = e.clientX; canvas.setPointerCapture(e.pointerId); };
  canvas.onpointermove = (e) => { if (drag !== null) { angle -= (e.clientX - drag) * 0.01; drag = e.clientX; } };
  canvas.onpointerup = canvas.onpointercancel = () => { drag = null; };
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

  const fit = Math.max(cfg.len * 1.05, 4.2);
  cancelAnimationFrame(raf);

  const loop = () => {
    if (!canvas.isConnected) { raf = 0; return; }
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w && h) {
      if (canvas.width !== w * 2) { canvas.width = w * 2; canvas.height = h * 2; }
      renderer.setSize(canvas.width, canvas.height, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (drag === null) angle += 0.006;
      camera.position.set(
        Math.sin(angle) * fit * 1.55,
        fit * 0.42,
        Math.cos(angle) * fit * 1.55
      );
      camera.lookAt(0, cfg.hei * 0.42, 0);
      renderer.render(scene, camera);
      const ctx2d = canvas.getContext('2d');
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);
      ctx2d.drawImage(renderer.domElement, 0, 0);
    }
    raf = requestAnimationFrame(loop);
  };
  loop();

  return built;
}

export function stopGarage() { cancelAnimationFrame(raf); raf = 0; }

