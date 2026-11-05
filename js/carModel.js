// 3D avtomobil modellari: /car/ papkasidagi GLB modellarni xatosiz va tez yuklash,
// rang, diska, spoyler, neon va faralarni boshqarish
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { TUNING } from './config.js';

// /car/ papkasidagi barcha 8 ta GLB model uchun aniq konfiguratsiya
export const GLB_SPECS = {
  spark: {
    file: 'opt/chevrolet_spark.glb',
    rotY: 0,
    paintMats: ['Chevrolet_Beat_2010_carpaint'],
    rimMats: ['Chevrolet_Beat_2010_rim'],
    headMats: ['Chevrolet_Beat_2010_clearglass'],
    tailMats: ['Chevrolet_Beat_2010_redglass'],
  },
  gentra: {
    file: 'opt/daewoo__gentra.glb',
    rotY: 0,
    paintMats: ['carpaint'],
    rimMats: ['material'],
    headMats: ['clearglass'],
    tailMats: ['redglass', 'redglass.001'],
  },
  malibu: {
    file: 'opt/2019_chevrolet_malibu_premier.glb',
    rotY: 0,
    paintMats: ['carpaint_mat'],
    rimMats: ['material'],
    headMats: ['light_SQ'],
    tailMats: ['red_sq', 'red_metal'],
  },
  m4gts: {
    file: 'opt/2016_bmw_m4_gts.glb',
    rotY: 0,
    paintMats: ['carpaint'],
    rimMats: ['rims'],
    headMats: [],
    tailMats: [],
  },
  m4comp: {
    file: 'opt/2021_bmw_m4_competition.glb',
    rotY: 0,
    paintMats: ['Material_692'],
    rimMats: ['Material_753'],
    headMats: ['Material_701', 'Material_161', 'Material_776'],
    tailMats: ['Material_739', 'Material_738', 'Material_740'],
  },
  bmw: {
    file: 'opt/2022_bmw_m5_cs.glb',
    rotY: 0,
    paintMats: ['BMW_M5CSRewardRecycled_2022Paint_Material'],
    rimMats: ['BMW_M5CSRewardRecycled_2022_Wheel1A_3D_3DWheel1A_Material'],
    headMats: ['BMW_M5CSRewardRecycled_2022LightA_Material'],
    tailMats: ['RED_GLASS'],
  },
  mercedes: {
    file: 'opt/2025_mercedes-benz_g-class_amg_g_63.glb',
    rotY: 0,
    paintMats: ['MMAT_CarPaint_010'],
    rimMats: ['MMercedesAMG_G63SUVRewardRecycled_2020_Wheel1A_3D_3DWhee_e9cc5dd1', 'MMAT_Tire_Hub1'],
    headMats: ['MMAT_Lights1'],
    tailMats: [],
  },
  lambo: {
    file: 'opt/lamborgini_aventador.glb',
    rotY: Math.PI / 2,
    paintMats: ['Body'],
    rimMats: ['FELGE1'],
    headMats: ['LICHTER4', 'LICHTER1'],
    tailMats: ['LICHTER2'],
  },
};

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/draco/gltf/');
dracoLoader.preload();

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);
const glbCache = new Map();
const glbLoading = new Map();

// Ustuvorlik navbati (o'yinchi mashinasi va garaj birinchi yuklanadi, trafik orqa fonda)
const loadQueue = [];
let activeLoads = 0, priorityActive = 0;
const MAX_CONCURRENT = 4;
const progressCbs = new Map(); // id -> Set<(0..1 | -1) => void>

function pumpQueue() {
  // Ustuvor yuklash (o'yinchi tanlagan mashina) bor ekan, orqa fondagi trafik yuklamalari kutadi
  while (loadQueue.length > 0) {
    const item = loadQueue[0];
    if (item.pri) {
      loadQueue.shift(); activeLoads++; priorityActive++;
      item.job().finally(() => { activeLoads--; priorityActive--; pumpQueue(); });
    } else {
      if (priorityActive > 0 || activeLoads >= MAX_CONCURRENT) break;
      loadQueue.shift(); activeLoads++;
      item.job().finally(() => { activeLoads--; pumpQueue(); });
    }
  }
}

export const isCarReady = (cfg) => !cfg || !GLB_SPECS[cfg.id] || glbCache.has(cfg.id);
function radialTex(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}
export const GLOW_TEX = radialTex();
const SHADOW_TEX = radialTex('rgba(0,0,0,0.75)', 'rgba(0,0,0,0)');

const RIM_COLORS = { std: 0x9a9a9a, sport: 0x18181b, chrome: 0xf2f4f8, gold: 0xd4a017 };
const box = new THREE.BoxGeometry(1, 1, 1);

/**
 * GLB sahnasini geometriyalarini buzmasdan, 100% original holatda
 * to'g'ri yo'nalish, markaz va o'lchamga keltiradi.
 */
function prepareGlbTemplate(origScene, cfg, spec) {
  origScene.rotation.set(0, spec.rotY || 0, 0);
  origScene.position.set(0, 0, 0);
  origScene.scale.setScalar(1);
  origScene.updateMatrixWorld(true);

  const rawBox = new THREE.Box3().setFromObject(origScene);
  const rawSize = rawBox.getSize(new THREE.Vector3());
  const rawCenter = rawBox.getCenter(new THREE.Vector3());

  const sc = cfg.len / Math.max(rawSize.z, 0.001);
  origScene.scale.setScalar(sc);
  origScene.position.set(
    -rawCenter.x * sc,
    -rawBox.min.y * sc,
    -rawCenter.z * sc
  );
  origScene.updateMatrixWorld(true);

  const isPaint = new Set(spec.paintMats || []);
  origScene.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m.transparent) m.side = THREE.DoubleSide;
    }
    // Faqat asosiy kuzov bo'laklari soya tashlasin (yuqori FPS uchun)
    o.castShadow = isPaint.has(o.material.name || '');
    o.receiveShadow = false;
  });

  const templateGroup = new THREE.Group();
  templateGroup.add(origScene);

  const carHeight = rawSize.y * sc;
  const radius = cfg.len * 0.08;
  const rearTop = Math.min(carHeight * 0.72, cfg.hei * 0.76);
  return { templateGroup, radius, rearTop, carHeight };
}

/** Shablonni klonlash va dinamik materiallarni har bir mashina uchun alohida nusxalash */
function instantiateGlb(cached, spec) {
  const root = cached.templateGroup.clone(true);
  const matClones = new Map();
  const paintMats = [];
  const rimMats = [];
  const headMats = [];
  const tailMats = [];

  const isPaint = new Set(spec.paintMats || []);
  const isRim = new Set(spec.rimMats || []);
  const isHead = new Set(spec.headMats || []);
  const isTail = new Set(spec.tailMats || []);

  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mName = o.material.name || '';
    if (isPaint.has(mName) || isRim.has(mName) || isHead.has(mName) || isTail.has(mName)) {
      let cloned = matClones.get(o.material);
      if (!cloned) {
        cloned = o.material.clone();
        cloned.side = THREE.DoubleSide;
        if (isPaint.has(mName)) {
          cloned.metalness = 0.72;
          cloned.roughness = 0.18;
          cloned.envMapIntensity = 1.45;
          paintMats.push(cloned);
        }
        if (isRim.has(mName)) {
          cloned.userData = {
            origColor: cloned.color ? cloned.color.clone() : new THREE.Color(0xcccccc),
            origMetal: cloned.metalness ?? 0.8,
            origRough: cloned.roughness ?? 0.3,
          };
          rimMats.push(cloned);
        }
        if (isHead.has(mName)) {
          if (!cloned.emissive) cloned.emissive = new THREE.Color(0xfff3d0);
          else cloned.emissive.setHex(0xfff3d0);
          cloned.emissiveIntensity = 0.2;
          headMats.push(cloned);
        }
        if (isTail.has(mName)) {
          if (!cloned.emissive) cloned.emissive = new THREE.Color(0xff1a1a);
          else cloned.emissive.setHex(0xff1a1a);
          cloned.emissiveIntensity = 0.3;
          tailMats.push(cloned);
        }
        matClones.set(o.material, cloned);
      }
      o.material = cloned;
    }
  });

  return { root, paintMats, rimMats, headMats, tailMats, radius: cached.radius, rearTop: cached.rearTop };
}

function loadGlb(id, cfg, priority = false) {
  const spec = GLB_SPECS[id];
  if (!spec) return Promise.resolve(null);
  if (glbCache.has(id)) return Promise.resolve(instantiateGlb(glbCache.get(id), spec));
  if (glbLoading.has(id)) {
    if (priority) { const i = loadQueue.findIndex((q) => q.id === id && !q.pri); if (i >= 0) { const [q] = loadQueue.splice(i, 1); q.pri = true; loadQueue.unshift(q); pumpQueue(); } }
  }
  if (glbLoading.has(id)) return glbLoading.get(id).then((cached) => (cached ? instantiateGlb(cached, spec) : null));

  const p = new Promise((resolve) => {
    const task = () =>
      new Promise((done) => {
        loader.load(
          `/car/${spec.file}`,
          (gltf) => {
            try {
              const cached = prepareGlbTemplate(gltf.scene, cfg, spec);
              glbCache.set(id, cached);
              resolve(cached);
            } catch (err) {
              console.warn(`[GLB] Tahlil xatosi (${spec.file}):`, err);
              resolve(null);
            }
            done();
          },
          (ev) => { const cbs = progressCbs.get(id); if (cbs) for (const f of cbs) f(ev.lengthComputable && ev.total ? ev.loaded / ev.total : -1); },
          (err) => {
            console.warn(`[GLB] Yuklab bo'lmadi: ${spec.file}`, err);
            resolve(null);
            done();
          }
        );
      });

    if (priority) loadQueue.unshift({ id, job: task, pri: true });
    else loadQueue.push({ id, job: task, pri: false });
    pumpQueue();
  });

  glbLoading.set(id, p);
  return p.then((cached) => (cached ? instantiateGlb(cached, spec) : null));
}

/** O'yin boshlanishida o'yinchi mashinasini oldindan yuklash */
export function preloadCar(cfg, onProgress) {
  if (!cfg || !GLB_SPECS[cfg.id] || glbCache.has(cfg.id)) return Promise.resolve();
  let set = progressCbs.get(cfg.id);
  if (onProgress) { if (!set) progressCbs.set(cfg.id, (set = new Set())); set.add(onProgress); }
  return loadGlb(cfg.id, cfg, true).finally(() => set && onProgress && set.delete(onProgress));
}

// ============================================================
// Vaqtinchalik yengil karkas (GLB yuklanguncha qisqa vaqt ko'rinadi)
// ============================================================
const geoCache = new Map();
function profiles(b, L, H) {
  const h = L / 2;
  switch (b) {
    case 'hatch': return { low: [[-h, .3], [h, .3], [h, .72], [L * .28, .85], [-L * .46, .9], [-h, .8]], glass: [[L * .28, .85], [L * .08, H], [-L * .42, H * .97], [-L * .46, .9]], clear: .3 };
    case 'suv': return { low: [[-h, .42], [h, .42], [h, .95], [L * .3, 1.05], [-L * .47, 1.06], [-h, 1.0]], glass: [[L * .3, 1.05], [L * .12, H], [-L * .45, H], [-L * .47, 1.06]], clear: .42 };
    case 'super': return { low: [[-h, .22], [h, .22], [h, .48], [L * .15, .72], [-L * .3, .8], [-h, .72]], glass: [[L * .15, .72], [-L * .05, H], [-L * .25, H * .95], [-L * .3, .8]], clear: .22 };
    default: return { low: [[-h, .3], [h, .3], [h, .75], [L * .3, .85], [-L * .38, .9], [-h, .85]], glass: [[L * .3, .85], [L * .12, H], [-L * .25, H], [-L * .38, .9]], clear: .3 };
  }
}
function extrude(points, width, bevel) {
  const s = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2 });
  g.translate(0, 0, -width / 2);
  g.rotateY(-Math.PI / 2);
  return g;
}
function geos(cfg) {
  if (geoCache.has(cfg.id)) return geoCache.get(cfg.id);
  const p = profiles(cfg.body, cfg.len, cfg.hei);
  const r = cfg.body === 'super' ? 0.36 : cfg.body === 'suv' ? 0.38 : 0.32;
  const out = {
    body: extrude(p.low, cfg.wid - 0.12, 0.06),
    glass: extrude(p.glass, cfg.wid - 0.22, 0.04),
    tire: new THREE.CylinderGeometry(r, r, 0.26, 24).rotateZ(Math.PI / 2),
    rim: new THREE.CylinderGeometry(r * 0.65, r * 0.65, 0.27, 16).rotateZ(Math.PI / 2),
    r, p,
  };
  geoCache.set(cfg.id, out);
  return out;
}

const tireMat = new THREE.MeshStandardMaterial({ color: 0x151518, roughness: 0.85 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x0a0f18, roughness: 0.05, metalness: 0.9 });

function buildProceduralCar(cfg, look = {}, { beam = true } = {}) {
  const G = geos(cfg);
  const group = new THREE.Group();
  const procGroup = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: look.color || '#ffffff', metalness: 0.6, roughness: 0.3 });
  const body = new THREE.Mesh(G.body, paint);
  body.castShadow = true;
  procGroup.add(body, new THREE.Mesh(G.glass, glassMat));

  const L = cfg.len, W = cfg.wid;
  const frontY = G.p.low[2][1] - 0.15, rearY = G.p.low.at(-1)[1] - 0.15;
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3d0, emissiveIntensity: 0.2 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1a1a, emissiveIntensity: 0.3 });
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(box, headMat); hl.scale.set(0.38, 0.12, 0.08); hl.position.set(sx * (W / 2 - 0.3), frontY, L / 2 + 0.07); procGroup.add(hl);
    const tl = new THREE.Mesh(box, tailMat); tl.scale.set(0.42, 0.12, 0.08); tl.position.set(sx * (W / 2 - 0.3), rearY, -L / 2 - 0.07); procGroup.add(tl);
  }

  const rimMat = new THREE.MeshStandardMaterial({ color: RIM_COLORS[look.rims] ?? RIM_COLORS.std, metalness: 0.9, roughness: 0.25 });
  const wheels = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * (W / 2 - 0.06), G.r, sz * L * 0.32);
    const spin = new THREE.Group();
    spin.add(new THREE.Mesh(G.tire, tireMat), new THREE.Mesh(G.rim, rimMat));
    pivot.add(spin); procGroup.add(pivot);
    wheels.push({ pivot, spin, front: sz > 0 });
  }
  group.add(procGroup);

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.5, L * 1.3), new THREE.MeshBasicMaterial({ map: SHADOW_TEX, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; group.add(shadow);

  let headBeam = null;
  if (beam) {
    headBeam = new THREE.Mesh(new THREE.PlaneGeometry(W * 2.6, 16), new THREE.MeshBasicMaterial({ map: GLOW_TEX, color: 0xfff1c8, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
    headBeam.rotation.x = -Math.PI / 2; headBeam.position.set(0, 0.05, L / 2 + 9); headBeam.visible = false;
    group.add(headBeam);
  }

  const extras = new THREE.Group(); group.add(extras);
  return { group, procGroup, wheels, paint, headMat, tailMat, rimMat, extras, headBeam, radius: G.r, rearTop: G.p.low.at(-1)[1] };
}

// ============================================================
// Asosiy API: buildCar — GLB model bilan
// ============================================================
export function buildCar(cfg, look = {}, opts = {}) {
  const proc = buildProceduralCar(cfg, look, opts);
  const { group, procGroup, wheels, paint, headMat, tailMat, rimMat, extras, headBeam } = proc;
  let currentLook = { color: '#f5f5f5', rims: 'std', spoiler: 'none', neon: 'none', ...look };
  const isPriority = opts.beam !== false || opts.priority === true;

  const api = {
    group, cfg, wheels, paint,
    radius: proc.radius,
    rearTop: proc.rearTop,
    headMat, tailMat,
    lightsOn: false,
    braking: false,
    _glbLoaded: false,
    _glbPaintMats: [],
    _glbRimMats: [],
    _glbHeadMats: [],
    _glbTailMats: [],

    setColor(c) {
      if (!c) return;
      currentLook.color = c;
      paint.color.set(c);
      for (const m of api._glbPaintMats) m.color.set(c);
    },

    setLights(on) {
      api.lightsOn = on;
      headMat.emissiveIntensity = on ? 3 : 0.2;
      if (headBeam) headBeam.visible = on;
      for (const m of api._glbHeadMats) m.emissiveIntensity = on ? 3.2 : 0.2;
      const tailInt = api.braking ? 4 : on ? 1.4 : 0.3;
      tailMat.emissiveIntensity = tailInt;
      for (const m of api._glbTailMats) m.emissiveIntensity = tailInt;
    },

    setBrake(b) {
      api.braking = b;
      const tailInt = b ? 4 : api.lightsOn ? 1.4 : 0.3;
      tailMat.emissiveIntensity = tailInt;
      for (const m of api._glbTailMats) m.emissiveIntensity = tailInt;
    },

    setTuning(t = {}) {
      currentLook = { ...currentLook, ...t };
      if (currentLook.color) api.setColor(currentLook.color);
      applyTuning(extras, cfg, api.rearTop, currentLook);
      const rType = currentLook.rims || 'std';
      rimMat.color.setHex(RIM_COLORS[rType] ?? RIM_COLORS.std);
      for (const m of api._glbRimMats) {
        if (rType === 'std' && m.userData?.origColor) {
          m.color.copy(m.userData.origColor);
          m.metalness = m.userData.origMetal;
          m.roughness = m.userData.origRough;
        } else {
          m.color.setHex(RIM_COLORS[rType] ?? RIM_COLORS.std);
          m.metalness = rType === 'sport' ? 0.5 : 0.92;
          m.roughness = rType === 'sport' ? 0.35 : 0.18;
        }
      }
    },

    update(dist, steer) {
      if (!api._glbLoaded) {
        const r = Math.max(api.radius, 0.2);
        for (const w of wheels) {
          w.spin.rotation.x += dist / r;
          if (w.front) w.pivot.rotation.y = steer;
        }
      }
    },

    _applyGlb(inst) {
      if (!inst) return;
      group.remove(procGroup);
      group.add(inst.root);
      api._glbLoaded = true;
      api._glbPaintMats = inst.paintMats;
      api._glbRimMats = inst.rimMats;
      api._glbHeadMats = inst.headMats;
      api._glbTailMats = inst.tailMats;
      api.radius = inst.radius;
      api.rearTop = inst.rearTop;
      api.setTuning(currentLook);
      api.setLights(api.lightsOn);
      api.setBrake(api.braking);
    },
  };

  api.setTuning(currentLook);

  const spec = GLB_SPECS[cfg.id];
  if (spec) {
    if (glbCache.has(cfg.id)) {
      api._applyGlb(instantiateGlb(glbCache.get(cfg.id), spec));
    } else {
      loadGlb(cfg.id, cfg, isPriority).then((inst) => {
        if (inst) api._applyGlb(inst);
      });
    }
  }

  return api;
}

function applyTuning(extras, cfg, rearTop, t) {
  extras.clear();
  const L = cfg.len, W = cfg.wid;
  if (t.spoiler === 'lip') {
    const m = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 }));
    m.scale.set(W - 0.32, 0.06, 0.22);
    m.position.set(0, rearTop + 0.04, -L / 2 + 0.22);
    extras.add(m);
  } else if (t.spoiler === 'wing') {
    const mat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.6, roughness: 0.3 });
    const wing = new THREE.Mesh(box, mat);
    wing.scale.set(W * 0.92, 0.05, 0.34);
    wing.position.set(0, rearTop + 0.32, -L / 2 + 0.25);
    extras.add(wing);
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(box, mat);
      p.scale.set(0.05, 0.30, 0.12);
      p.position.set(sx * W * 0.3, rearTop + 0.16, -L / 2 + 0.25);
      extras.add(p);
    }
  }
  if (t.neon && t.neon !== 'none') {
    const n = new THREE.Mesh(
      new THREE.PlaneGeometry(W * 2, L * 1.4),
      new THREE.MeshBasicMaterial({ map: GLOW_TEX, color: t.neon, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    n.rotation.x = -Math.PI / 2;
    n.position.y = 0.06;
    extras.add(n);
  }
}

export { TUNING };





