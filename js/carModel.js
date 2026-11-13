// 3D avtomobil modellari: /car/opt/ papkasidagi GLB modellarni xatosiz va tez yuklash,
// 4 ta g'ildirak haqiqiy aylanishi va burilishi (Gelik va barcha 26 ta model),
// hamda professional 3D Tuning (bo'yoq turi, disk, disk rangi, spoyler, body kit, tonirovka, fara rangi, neon)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { TUNING } from './config.js';

// /car/opt/ papkasidagi barcha 26 ta optimallashtirilgan GLB modellar uchun konfiguratsiya
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
  kia_k5: {
    file: 'opt/kia_optima_k5.glb',
    rotY: 0,
    paintMats: ['material_0', 'chassis.0'],
    rimMats: ['wheels.6'],
    headMats: ['material_2'],
    tailMats: ['material_3'],
  },
  malibu: {
    file: 'opt/2019_chevrolet_malibu_premier.glb',
    rotY: 0,
    paintMats: ['carpaint_mat'],
    rimMats: ['material'],
    headMats: ['light_SQ'],
    tailMats: ['red_sq', 'red_metal'],
  },
  e55: {
    file: 'opt/mersedes-benz_e55_w211.glb',
    rotY: 0,
    paintMats: ['paint'],
    rimMats: ['chrome.001', 'amdb11_misc_chrome.002'],
    headMats: ['loweam', 'Lsignal', 'Rsignal'],
    tailMats: ['midsize_signal_R', 'midsize_chmsl'],
  },
  challenger: {
    file: 'opt/dodge_challenger_rt.glb',
    rotY: 0,
    paintMats: ['dDodge_ChallengerRTShakerF7_2015Paint_Material1', 'dDodge_ChallengerRTShakerF7_2015Coloured_Material1', 'Color_2'],
    rimMats: ['dDodge_ChallengerRTShakerF7_2015_Wheel1A_3D_3DWheel1A_Material1'],
    headMats: ['dDodge_ChallengerRTShakerF7_2015LightA_Material1'],
    tailMats: ['red_glass'],
  },
  supra: {
    file: 'opt/toyota_supra_mk4_a80.glb',
    rotY: 0,
    paintMats: ['Paint', 'Coloured.002', 'Coloured.003'],
    rimMats: ['Wheel2A', 'DISK1', 'DISK2'],
    headMats: ['LightD'],
    tailMats: ['GlassRed.002'],
  },
  m4gts: {
    file: 'opt/2016_bmw_m4_gts.glb',
    rotY: 0,
    paintMats: ['carpaint'],
    rimMats: ['rims'],
    headMats: [],
    tailMats: [],
  },
  bmwx7: {
    file: 'opt/2019_bmw_x7_xdrive40i.glb',
    rotY: 0,
    paintMats: ['carpaint', 'Kuzov_1'],
    rimMats: ['Chome_R', 'MEtal_R'],
    headMats: ['Front_Lights_emissive', 'Front_lights_glass'],
    tailMats: ['Back_lights_emissive', 'red_emiss', 'baked_Back_lights'],
  },
  m4comp: {
    file: 'opt/2021_bmw_m4_competition.glb',
    rotY: 0,
    paintMats: ['Material_692'],
    rimMats: ['Material_753'],
    headMats: ['Material_701', 'Material_161', 'Material_776'],
    tailMats: ['Material_739', 'Material_738', 'Material_740'],
  },
  bmw2018: {
    file: 'opt/BMW_2018.glb',
    rotY: 0,
    paintMats: ['bM_CarPaint_Max1'],
    rimMats: ['BMW_M5CSRewardRecycled_2022_Wheel1A_3D_3DWheel1A_Material', 'bM_Rim_Main_Max1', 'bM_Rim_Secondary_Max1'],
    headMats: ['bM_LightGlassNormal_Clear_Low1', 'emis'],
    tailMats: ['bM_LightGlassNormal_OuterRed_Low1', 'bM_LightGlass_Red_Low1'],
  },
  bmw: {
    file: 'opt/2022_bmw_m5_cs.glb',
    rotY: 0,
    paintMats: ['BMW_M5CSRewardRecycled_2022Paint_Material'],
    rimMats: ['BMW_M5CSRewardRecycled_2022_Wheel1A_3D_3DWheel1A_Material'],
    headMats: ['BMW_M5CSRewardRecycled_2022LightA_Material'],
    tailMats: ['RED_GLASS'],
  },
  bmwm8: {
    file: 'opt/2020_bmw_m8.glb',
    rotY: 0,
    paintMats: ['bBMW_M8RewardRecycled_2020Paint_Material1', 'bBMW_M8RewardRecycled_2020Coloured_Material1'],
    rimMats: ['bBMW_M8RewardRecycled_2020_Wheel1A_3D_3DWheel2A_Material1'],
    headMats: ['bBMW_M8RewardRecycled_2020LightA_Material1'],
    tailMats: ['red_glass'],
  },
  bmwm8wb: {
    file: 'opt/bmw_m8_competition_widebody.glb',
    rotY: Math.PI,
    paintMats: ['BMW_M8RewardRecycled_2020Paint_Material', 'BMW_M8RewardRecycled_2020Coloured_Material', 'col2'],
    rimMats: ['rim.001'],
    headMats: ['BMW_M8RewardRecycled_2020LightA_Material', 'whitelight'],
    tailMats: ['redlight'],
  },
  mercedes: {
    file: 'opt/2025_mercedes-benz_g-class_amg_g_63.glb',
    rotY: 0,
    paintMats: ['MMAT_CarPaint_010'],
    rimMats: ['MMercedesAMG_G63SUVRewardRecycled_2020_Wheel1A_3D_3DWhee_e9cc5dd1', 'MMAT_Tire_Hub1'],
    headMats: ['MMAT_Lights1'],
    tailMats: [],
  },
  maybach: {
    file: 'opt/mersedes-_benz_maybach_gls_600.glb',
    rotY: 0,
    paintMats: ['gls_paint.021', 'gls_paint_two.126', 'gls_paint_two.162', 'vehicle_paint1.035', 'vehicle_paint1.037'],
    rimMats: ['wheel_42b.038', 'wheel_42b.059', 'wheel_42a.059'],
    headMats: ['gls_fara.003', 'gls_svet.003', 'gls_run.001'],
    tailMats: ['gls_stop.001', 'gls_rear.001'],
  },
  ferrari599: {
    file: 'opt/ferrari_599.glb',
    rotY: 0,
    paintMats: ['Body.002'],
    rimMats: ['Metal_white.002', 'Rim_bolts.002'],
    headMats: ['Headlights_lights.002', 'Headlights_white.002'],
    tailMats: ['Rearlight_red.004', 'Rearlight_red.005', 'Glass_rearlight.002'],
  },
  porsche911: {
    file: 'opt/porsche_911_gt3_rs.glb',
    rotY: 0,
    paintMats: ['Porsche_911GT3RS992Tribute_2023Paint_Material', 'Porsche_911GT3RS992Tribute_2023Coloured_Material'],
    rimMats: ['Porsche_911GT3RS992Tribute_2023_Wheel1A_3D_3DWheel1G_Material'],
    headMats: ['Porsche_911GT3RS992Tribute_2023LightA_Material'],
    tailMats: ['RED_GLASS'],
  },
  lambo: {
    file: 'opt/lamborgini_aventador.glb',
    rotY: Math.PI / 2,
    paintMats: ['Body'],
    rimMats: ['FELGE1'],
    headMats: ['LICHTER4', 'LICHTER1'],
    tailMats: ['LICHTER2'],
  },
  sf90: {
    file: 'opt/ferrari_sf90.glb',
    rotY: 0,
    paintMats: ['Ferrari_SF90SpiderRewardRecycled_2021Paint_Material', 'Ferrari_SF90SpiderRewardRecycled_2021Coloured_Material'],
    rimMats: ['Ferrari_SF90SpiderReward_2021_Wheel1A_3D_3DWheel1C_Material'],
    headMats: ['Ferrari_SF90SpiderRewardRecycled_2021LightA_Material'],
    tailMats: ['RED_GLASS'],
  },
  roadster: {
    file: 'opt/tesla_roadster_2020.glb',
    rotY: 0,
    paintMats: ['car_main_paint'],
    rimMats: ['Rims'],
    headMats: ['headlights_main', 'headlights_AHO'],
    tailMats: ['Glass_rear_lights_main', 'Glass_rear_lights_DHO'],
  },
};

for (const [k, v] of Object.entries(GLB_SPECS)) v.id = k;

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/draco/gltf/');
dracoLoader.preload();

const ktx2Loader = new KTX2Loader();
ktx2Loader.setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/basis/');

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);
loader.setKTX2Loader(ktx2Loader);
const glbCache = new Map();
const glbLoading = new Map();

const loadQueue = [];
let activeLoads = 0, priorityActive = 0;
const MAX_CONCURRENT = 4;
const progressCbs = new Map();

function pumpQueue() {
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

const RIM_COLORS = {
  std: 0x9a9a9a,
  sport: 0x18181b,
  chrome: 0xf2f4f8,
  gold: 0xd4a017,
  bbs: 0xcfd8dc,
  concave: 0x263238,
};
const box = new THREE.BoxGeometry(1, 1, 1);

// Ichki salon (SteeringWheel, BrakePedal, HandBrake, DoorPanel) va kuzov qismlarini g'ildirakdan 100% ajratish
const NON_WHEEL_PART_RE = /steering|steer|swheel|volan|pedal|handbrake|doorpanel|door_l|door_r|bumper|fender|hood|trunk|wing|spoiler|exhaust|light|glass|window|windshield|interior|cockpit|dashboard|seat|carpet|fgrll|license|chassis|lip|spare|zapas|grill|badge|emblem|wiper|antenna|roof|sideskirt|skirt|side_skirt|engine|dvig|motor|diffuser|splitter/i;
const WHEEL_MAT_OR_NAME_RE = /tire|tyre|wheel|rim|felge|reifen|caliper|calliper|brakedisk|brake|tormoz|koleso|disc|disk|ssr|bremse|chrome_r|metal_r/i;
const CALIPER_RE = /caliper|calliper|brakedisk|brake|tormoz|bremse|koleso_support/i;
const SPIN_WHEEL_RE = /tire|tyre|wheel|rim|felge|reifen|koleso|ssr|disc|disk|chrome_r|metal_r/i;
const GLASS_MAT_RE = /glass|window|windshield|vitre|steklo/i;

function getObjectFullPath(o) {
  let path = '';
  let cur = o;
  while (cur) {
    if (cur.name) path = cur.name + ' ' + path;
    cur = cur.parent;
  }
  const matName = o.material
    ? (Array.isArray(o.material) ? o.material.map((m) => m.name).join(' ') : o.material.name || '')
    : '';
  return (path + ' ' + matName).trim();
}

function extractSubGeometry(geom, triIndices) {
  const remap = new Map();
  const newIndices = [];
  let nextIdx = 0;
  for (let i = 0; i < triIndices.length; i++) {
    const oldIdx = triIndices[i];
    let mapped = remap.get(oldIdx);
    if (mapped === undefined) {
      mapped = nextIdx++;
      remap.set(oldIdx, mapped);
    }
    newIndices.push(mapped);
  }
  const sub = new THREE.BufferGeometry();
  for (const [attrName, attr] of Object.entries(geom.attributes)) {
    const itemSize = attr.itemSize;
    const outArr = new Float32Array(nextIdx * itemSize);
    for (const [oldIdx, newIdx] of remap.entries()) {
      for (let k = 0; k < itemSize; k++) {
        outArr[newIdx * itemSize + k] = attr.getComponent(oldIdx, k);
      }
    }
    sub.setAttribute(attrName, new THREE.BufferAttribute(outArr, itemSize, attr.normalized));
  }
  sub.setIndex(newIndices);
  sub.computeBoundingBox();
  sub.computeBoundingSphere();
  return sub;
}

/**
 * Ba'zi GLB modellarda (masalan BMW X6M, BMW X7, Kia K5, Lancia 037, BMW M8 Widebody)
 * 4 ta shina, disk yoki kaliper bitta umumiy mesh sifatida eksport qilingan bo'ladi.
 * Ushbu funksiya shunday birlashgan g'ildirak meshlarini 4 ta kvadrantga (FL, FR, RL, RR)
 * uchburchaklar markazi bo'yicha 100% aniq ajratib beradi.
 */
function splitMergedWheelMeshes(templateGroup, spec) {
  templateGroup.updateMatrixWorld(true);
  const rimMats = new Set(spec?.rimMats || []);

  const toSplit = [];
  templateGroup.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes?.position) return;
    const matName = o.material ? (Array.isArray(o.material) ? o.material.map((m) => m.name).join(' ') : o.material.name) : '';
    const full = getObjectFullPath(o);
    if (NON_WHEEL_PART_RE.test(full)) return;
    if (!WHEEL_MAT_OR_NAME_RE.test(full) && !rimMats.has(matName)) return;

    const b = new THREE.Box3().setFromObject(o);
    const size = b.getSize(new THREE.Vector3());
    const spansX = b.min.x < -0.35 && b.max.x > 0.35 && size.x > 1.0;
    const spansZ = b.min.z < -0.55 && b.max.z > 0.55 && size.z > 1.4;
    if ((spansX || spansZ) && size.y < 1.25) {
      toSplit.push(o);
    }
  });

  const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
  for (const mesh of toSplit) {
    const geom = mesh.geometry;
    const pos = geom.attributes.position;
    const idxAttr = geom.index;
    const triCount = idxAttr ? Math.floor(idxAttr.count / 3) : Math.floor(pos.count / 3);
    if (triCount < 8) continue;

    const quads = { FL: [], FR: [], RL: [], RR: [] };
    const wm = mesh.matrixWorld;

    for (let t = 0; t < triCount; t++) {
      const i0 = idxAttr ? idxAttr.getX(t * 3) : t * 3;
      const i1 = idxAttr ? idxAttr.getX(t * 3 + 1) : t * 3 + 1;
      const i2 = idxAttr ? idxAttr.getX(t * 3 + 2) : t * 3 + 2;
      v0.fromBufferAttribute(pos, i0).applyMatrix4(wm);
      v1.fromBufferAttribute(pos, i1).applyMatrix4(wm);
      v2.fromBufferAttribute(pos, i2).applyMatrix4(wm);
      const cx = (v0.x + v1.x + v2.x) / 3;
      const cz = (v0.z + v1.z + v2.z) / 3;
      if (Math.abs(cx) < 0.25) continue;
      const qKey = (cz >= 0 ? 'F' : 'R') + (cx < 0 ? 'L' : 'R');
      quads[qKey].push(i0, i1, i2);
    }

    const activeQuads = Object.entries(quads).filter(([, arr]) => arr.length >= 12);
    if (activeQuads.length < 2 || !mesh.parent) continue;

    for (const [qKey, indices] of activeQuads) {
      const subGeom = extractSubGeometry(geom, indices);
      const subMesh = new THREE.Mesh(subGeom, mesh.material);
      subMesh.name = `${mesh.name || 'wheel'}_${qKey}`;
      subMesh.position.copy(mesh.position);
      subMesh.quaternion.copy(mesh.quaternion);
      subMesh.scale.copy(mesh.scale);
      subMesh.castShadow = mesh.castShadow;
      subMesh.receiveShadow = mesh.receiveShadow;
      mesh.parent.add(subMesh);
    }
    mesh.parent.remove(mesh);
  }
}

/**
 * GLB sahnasini geometriyalarini buzmasdan, 100% original holatda
 * to'g'ri yo'nalish, markaz va o'lchamga keltiradi.
 */
function prepareGlbTemplate(origScene, cfg, spec) {
  // Model ichidagi noto'g'ri chetdagi adashgan meshlar (masalan Kia K5 dagi Object_156) markazni buzmasligi uchun olib tashlanadi
  origScene.traverse((o) => {
    if (o.isMesh && (o.name === 'Object_156' || (o.geometry?.attributes?.position && Math.abs(o.position.x) > 100))) {
      o.geometry?.dispose?.();
      o.parent?.remove(o);
    }
  });

  origScene.rotation.set(spec.rotX || 0, spec.rotY || 0, spec.rotZ || 0);
  origScene.position.set(0, 0, 0);
  origScene.scale.setScalar(1);
  origScene.updateMatrixWorld(true);

  const rawBox = new THREE.Box3().setFromObject(origScene);
  const rawSize = rawBox.getSize(new THREE.Vector3());
  const rawCenter = rawBox.getCenter(new THREE.Vector3());

  // Modelning Z o'qi yoki eng uzun o'qi bo'yicha proporsional masshtablash
  const modelDim = Math.max(rawSize.z, 0.001);
  const baseSc = cfg.len / modelDim;
  const sc = baseSc * (spec.scaleMul || 1.0);

  origScene.scale.setScalar(sc);
  origScene.position.set(
    -rawCenter.x * sc,
    -rawBox.min.y * sc,
    -rawCenter.z * sc
  );
  origScene.updateMatrixWorld(true);

  const isPaint = new Set(spec.paintMats || []);
  const isWheelMesh = (name) => /wheel|tire|rim|tyre|disk|disc/i.test(name || '');
  origScene.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const isWheel = isWheelMesh(o.name) || (o.parent && isWheelMesh(o.parent.name));
    for (const m of mats) {
      // Faqat g'ildiraklar DoubleSide bo'ladi; qolgan kuzov va detallar FrontSide
      // bo'lib, mobil va PC videokartasida Backface Culling orqali 50% fragment yuklamasini tejaydi
      if (isWheel && !m.transparent) {
        m.side = THREE.DoubleSide;
      } else {
        m.side = THREE.FrontSide;
      }
    }
    o.castShadow = isPaint.has(o.material.name || '');
    o.receiveShadow = false;
  });

  const templateGroup = new THREE.Group();
  templateGroup.add(origScene);
  splitMergedWheelMeshes(templateGroup, spec);

  const carHeight = rawSize.y * sc;
  const radius = cfg.len * 0.08;
  const rearTop = Math.min(carHeight * 0.72, cfg.hei * 0.76);
  return { templateGroup, radius, rearTop, carHeight };
}

/** Shablonni klonlash va dinamik materiallarni har bir mashina uchun alohida nusxalash */
function instantiateGlb(cached, spec, cfg) {
  const root = cached.templateGroup.clone(true);
  const matClones = new Map();
  const paintMats = [];
  const rimMats = [];
  const headMats = [];
  const tailMats = [];
  const glassMats = [];

  const isPaint = new Set(spec.paintMats || []);
  const isRim = new Set(spec.rimMats || []);
  const isHead = new Set(spec.headMats || []);
  const isTail = new Set(spec.tailMats || []);

  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mName = o.material.name || '';
    const isGlassCandidate = !isHead.has(mName) && !isTail.has(mName) && !isPaint.has(mName) && !isRim.has(mName) &&
      (GLASS_MAT_RE.test(mName) || (o.material.transparent && o.material.opacity < 0.85));

    if (isPaint.has(mName) || isRim.has(mName) || isHead.has(mName) || isTail.has(mName) || isGlassCandidate) {
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
        if (isGlassCandidate) {
          cloned.userData = {
            origColor: cloned.color ? cloned.color.clone() : new THREE.Color(0x111822),
            origOpacity: cloned.opacity ?? 0.45,
            origTransparent: cloned.transparent ?? true,
          };
          glassMats.push(cloned);
        }
        matClones.set(o.material, cloned);
      }
      o.material = cloned;
    }
  });

  // ============================================================
  // REAL 3D GLB G'ILDIRAKLAR VA BALLONLARNING HAQIQIY AYLANISHI (WHEEL RIG)
  // G'ildiraklar chassisTilt'dan ajratilgan: tormozda yerga botmaydi,
  // gaz berganda havoda suzmaydi va burilishda yer bilan 100% kontaktda turadi
  // ============================================================
  const wheelRig = new THREE.Group();
  wheelRig.name = 'GLB_WheelRig';
  const { wheels: glbWheels, radius: glbRadius } = setupGlbWheels(root, spec, cfg, wheelRig);

  return {
    root,
    wheelRig,
    paintMats,
    rimMats,
    headMats,
    tailMats,
    glassMats,
    wheels: glbWheels,
    radius: glbRadius || cached.radius,
    rearTop: cached.rearTop,
  };
}

/**
 * 3D GLB modelidagi barcha 4 ta g'ildirak (tire, rim, disc) va kaliper (tormoz) qismlarini topib,
 * markaziy pivotlariga o'rnatish:
 * - Salon ichidagi rul (SteeringWheel), pedallar, eshik panellari va kuzov detallari 100% chiqarib tashlanadi.
 * - G'ildiraklar faqat haqiqiy o'q koordinatalarida (chap/o'ng chetda, old/orqa o'qda, pastki qismda) bo'lsa olinadi.
 * - Kaliperlar (caliper/brake) aylanmaydi (pivot'ga ulanadi), lekin rul burilganda old g'ildirak bilan birga buriladi.
 */
function setupGlbWheels(root, spec, cfg, wheelRig = null) {
  root.updateMatrixWorld(true);
  const wheelMeshes = [];
  const caliperMeshes = [];

  const rimMats = new Set(spec?.rimMats || []);
  const carId = spec?.id || cfg?.id || '';
  const minTrackX = Math.max(0.42, (cfg?.wid || 1.8) * 0.27);
  const minAxleZ = Math.max(0.72, (cfg?.len || 4.5) * 0.18);
  const maxWheelY = Math.max(0.62, (cfg?.len || 4.5) * 0.145);

  root.traverse((o) => {
    if (!o.isMesh) return;
    const matName = o.material ? (Array.isArray(o.material) ? o.material.map((m) => m.name).join(' ') : o.material.name || '') : '';
    const full = getObjectFullPath(o);

    // Salon ruli (SteeringWheel), pedal, qo'l tormozi, eshik paneli va kuzov qismlarini o'tkazib yuborish
    if (NON_WHEEL_PART_RE.test(full)) return;

    // G63 Gelik, Challenger, Supra va boshqalardagi ota-ona tugunlari tekshiruvi
    const hasWheelParent = /3DWheel (Front|Rear)|WHEEL_(FL|FR|RL|RR)|wheel(FL|FR|BL|BR)/i.test(full);
    const isCaliper = (CALIPER_RE.test(full) || /bremse/i.test(matName)) && !/disk|disc|rotor/i.test(o.name || '');
    const isSpin = (SPIN_WHEEL_RE.test(full) || rimMats.has(matName) || hasWheelParent || /felge|reifen/i.test(matName) || (carId === 'kia_k5' && /wheels/i.test(matName))) && !isCaliper;
    const isGentraCap = carId === 'gentra' && /chrome|brakedisk/i.test(matName);

    if (!isCaliper && !isSpin && !isGentraCap) return;

    const b = new THREE.Box3().setFromObject(o);
    const center = b.getCenter(new THREE.Vector3());
    const size = b.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    // G'ildirak o'qlarining qat'iy fazoviy chegaralari (rul, zapaska yoki kuzov qismlari kirmasligi uchun)
    if (Math.abs(center.x) < minTrackX || Math.abs(center.z) < minAxleZ || center.y > maxWheelY || maxDim > 2.2) return;
    if (isGentraCap && maxDim > 0.4) return;

    if (isCaliper) {
      caliperMeshes.push({ mesh: o, center, size, box: b });
    } else {
      wheelMeshes.push({ mesh: o, center, size, box: b });
    }
  });

  if (wheelMeshes.length === 0) return { wheels: null, radius: null };

  const clusters = { FL: [], FR: [], RL: [], RR: [] };
  const caliperClusters = { FL: [], FR: [], RL: [], RR: [] };

  for (const item of wheelMeshes) {
    const key = (item.center.z >= 0 ? 'F' : 'R') + (item.center.x < 0 ? 'L' : 'R');
    clusters[key].push(item);
  }
  for (const item of caliperMeshes) {
    const key = (item.center.z >= 0 ? 'F' : 'R') + (item.center.x < 0 ? 'L' : 'R');
    caliperClusters[key].push(item);
  }

  const glbWheels = [];
  let detectedRadius = null;
  const wheelParent = wheelRig || root;

  for (const [key, rawItems] of Object.entries(clusters)) {
    if (rawItems.length === 0) continue;

    // Agar klaster ichida g'ildirak o'qidan uzoqda qolgan tasodifiy bo'lak bo'lsa, uni filtrlash
    const medZ = rawItems.reduce((s, it) => s + it.center.z, 0) / rawItems.length;
    const medY = rawItems.reduce((s, it) => s + it.center.y, 0) / rawItems.length;
    const items = rawItems.filter((it) => Math.abs(it.center.z - medZ) < 0.55 && Math.abs(it.center.y - medY) < 0.55);
    if (items.length === 0) continue;

    const clusterBox = new THREE.Box3();
    for (const it of items) clusterBox.expandByObject(it.mesh);
    const exactCenter = clusterBox.getCenter(new THREE.Vector3());
    const clusterSize = clusterBox.getSize(new THREE.Vector3());
    const r = Math.max(clusterSize.y, clusterSize.z) / 2;
    if (r > 0.18 && r < 0.65) {
      if (!detectedRadius || Math.abs(r - (cfg?.len || 4.5) * 0.08) < Math.abs(detectedRadius - (cfg?.len || 4.5) * 0.08)) {
        detectedRadius = r;
      }
    }

    const pivot = new THREE.Group();
    pivot.position.copy(exactCenter);
    const spin = new THREE.Group();
    pivot.add(spin);

    wheelParent.add(pivot);
    wheelParent.updateMatrixWorld(true);

    for (const it of items) {
      if (it.mesh && it.mesh.material) {
        const mats = Array.isArray(it.mesh.material) ? it.mesh.material : [it.mesh.material];
        for (const m of mats) m.side = THREE.DoubleSide;
      }
      spin.attach(it.mesh);
    }

    const cals = (caliperClusters[key] || []).filter(
      (cal) => Math.abs(cal.center.z - exactCenter.z) < 0.55 && Math.abs(cal.center.y - exactCenter.y) < 0.55
    );
    for (const cal of cals) {
      pivot.attach(cal.mesh);
    }

    glbWheels.push({
      pivot,
      spin,
      front: key.startsWith('F'),
    });
  }

  return { wheels: glbWheels.length > 0 ? glbWheels : null, radius: detectedRadius };
}

function loadGlb(id, cfg, priority = false) {
  const spec = GLB_SPECS[id];
  if (!spec) return Promise.resolve(null);
  const safeInstantiate = (cached) => {
    if (!cached) return null;
    try {
      return instantiateGlb(cached, spec, cfg);
    } catch (err) {
      console.warn(`[GLB] instantiateGlb xatosi (${id}):`, err);
      return null;
    }
  };
  if (glbCache.has(id)) return Promise.resolve(safeInstantiate(glbCache.get(id)));
  if (glbLoading.has(id)) {
    if (priority) {
      const i = loadQueue.findIndex((q) => q.id === id && !q.pri);
      if (i >= 0) {
        const [q] = loadQueue.splice(i, 1);
        q.pri = true;
        loadQueue.unshift(q);
        pumpQueue();
      }
    }
    return glbLoading.get(id).then(safeInstantiate);
  }

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
          (ev) => {
            const cbs = progressCbs.get(id);
            if (cbs) for (const f of cbs) f(ev.lengthComputable && ev.total ? ev.loaded / ev.total : -1);
          },
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
  return p.then(safeInstantiate);
}

export function preloadCar(cfg, onProgress) {
  if (!cfg || !GLB_SPECS[cfg.id] || glbCache.has(cfg.id)) return Promise.resolve();
  let set = progressCbs.get(cfg.id);
  if (onProgress) {
    if (!set) progressCbs.set(cfg.id, (set = new Set()));
    set.add(onProgress);
  }
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

function buildProceduralCar(cfg, look = {}, { beam = true } = {}) {
  const G = geos(cfg);
  const group = new THREE.Group();
  const procGroup = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: look.color || '#ffffff', metalness: 0.6, roughness: 0.3 });
  const procGlassMat = new THREE.MeshStandardMaterial({ color: 0x0a0f18, roughness: 0.05, metalness: 0.9 });
  const body = new THREE.Mesh(G.body, paint);
  body.castShadow = true;
  procGroup.add(body, new THREE.Mesh(G.glass, procGlassMat));

  const L = cfg.len, W = cfg.wid;
  const frontY = G.p.low[2][1] - 0.15, rearY = G.p.low.at(-1)[1] - 0.15;
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3d0, emissiveIntensity: 0.2 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1a1a, emissiveIntensity: 0.3 });
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(box, headMat); hl.scale.set(0.38, 0.12, 0.08); hl.position.set(sx * (W / 2 - 0.3), frontY, L / 2 + 0.07); procGroup.add(hl);
    const tl = new THREE.Mesh(box, tailMat); tl.scale.set(0.42, 0.12, 0.08); tl.position.set(sx * (W / 2 - 0.3), rearY, -L / 2 - 0.07); procGroup.add(tl);
  }

  const wheelRig = new THREE.Group();
  wheelRig.name = 'WheelRig';
  group.add(wheelRig);

  const rimMat = new THREE.MeshStandardMaterial({ color: RIM_COLORS[look.rims] ?? RIM_COLORS.std, metalness: 0.9, roughness: 0.25 });
  const wheels = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * (W / 2 - 0.06), G.r, sz * L * 0.32);
    const spin = new THREE.Group();
    spin.add(new THREE.Mesh(G.tire, tireMat), new THREE.Mesh(G.rim, rimMat));
    pivot.add(spin);
    wheelRig.add(pivot);
    wheels.push({ pivot, spin, front: sz > 0 });
  }
  const chassisTilt = new THREE.Group();
  chassisTilt.add(procGroup);
  group.add(chassisTilt);

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.5, L * 1.3), new THREE.MeshBasicMaterial({ map: SHADOW_TEX, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; group.add(shadow);

  let headBeam = null;
  if (beam) {
    headBeam = new THREE.Mesh(new THREE.PlaneGeometry(W * 2.6, 16), new THREE.MeshBasicMaterial({ map: GLOW_TEX, color: 0xfff1c8, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
    headBeam.rotation.x = -Math.PI / 2; headBeam.position.set(0, 0.05, L / 2 + 9); headBeam.visible = false;
    group.add(headBeam);
  }

  const extras = new THREE.Group();
  chassisTilt.add(extras);

  return {
    group, chassisTilt, wheelRig, procGroup, wheels, paint, procGlassMat, headMat, tailMat, rimMat, extras, headBeam,
    radius: G.r, rearTop: G.p.low.at(-1)[1],
  };
}

// ============================================================
// Asosiy API: buildCar — GLB model va to'liq 3D Tuning bilan
// ============================================================
export function buildCar(cfg, look = {}, opts = {}) {
  const proc = buildProceduralCar(cfg, look, opts);
  const {
    group, chassisTilt, procGroup, wheels, paint, procGlassMat, headMat, tailMat, rimMat, extras, headBeam,
  } = proc;
  let currentLook = {
    color: '#f5f5f5',
    paintType: 'metallic',
    rims: 'std',
    rimColor: '',
    spoiler: 'none',
    bodykit: 'std',
    tint: 'none',
    headlightColor: '#fff3d0',
    neon: 'none',
    ...look,
  };
  const isPriority = opts.beam !== false || opts.priority === true;

  const api = {
    group, chassisTilt, wheelRig: proc.wheelRig, cfg, wheels, paint,
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
    _glbGlassMats: [],

    setColor(c) {
      if (!c) return;
      currentLook.color = c;
      paint.color.set(c);
      for (const m of api._glbPaintMats) m.color.set(c);
    },

    setLights(on) {
      api.lightsOn = on;
      const hCol = currentLook.headlightColor || '#fff3d0';
      headMat.emissive.set(hCol);
      headMat.emissiveIntensity = on ? 3 : 0.2;
      if (headBeam) {
        headBeam.visible = on;
        headBeam.material.color.set(hCol);
      }
      for (const m of api._glbHeadMats) {
        if (m.emissive) m.emissive.set(hCol);
        m.emissiveIntensity = on ? 3.2 : 0.2;
      }
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

    setDamageState() {
      // Avariya va kuzov shikastlanish tizimi olib tashlangan
    },

    setTuning(t = {}) {
      currentLook = { ...currentLook, ...t };
      if (currentLook.color) api.setColor(currentLook.color);

      // 1. Kuzov bo'yoq qoplamasi (Metallik / Mat / Xrom / Marvarid)
      const pType = currentLook.paintType || 'metallic';
      const pSpec = pType === 'matte'
        ? { metalness: 0.15, roughness: 0.65, env: 0.75 }
        : pType === 'chrome'
          ? { metalness: 0.98, roughness: 0.05, env: 2.1 }
          : pType === 'pearl'
            ? { metalness: 0.84, roughness: 0.10, env: 1.75 }
            : { metalness: 0.72, roughness: 0.18, env: 1.45 };
      paint.metalness = pSpec.metalness;
      paint.roughness = pSpec.roughness;
      for (const m of api._glbPaintMats) {
        m.metalness = pSpec.metalness;
        m.roughness = pSpec.roughness;
        m.envMapIntensity = pSpec.env;
      }

      // 2. Spoyler, Body Kit, Bamperlar va Neon
      applyTuning(extras, cfg, api.rearTop, currentLook);

      // 3. Disk turi va Disk rangi
      const rType = currentLook.rims || 'std';
      const customRimCol = currentLook.rimColor || '';
      const rimHex = customRimCol ? new THREE.Color(customRimCol).getHex() : (RIM_COLORS[rType] ?? RIM_COLORS.std);
      rimMat.color.setHex(rimHex);
      for (const m of api._glbRimMats) {
        if (rType === 'std' && !customRimCol && m.userData?.origColor) {
          m.color.copy(m.userData.origColor);
          m.metalness = m.userData.origMetal;
          m.roughness = m.userData.origRough;
        } else {
          m.color.setHex(rimHex);
          m.metalness = rType === 'sport' ? 0.55 : rType === 'chrome' || rType === 'gold' ? 0.95 : 0.85;
          m.roughness = rType === 'sport' ? 0.35 : 0.15;
        }
      }

      // 4. Oyna qoraytirish (Tonirovka)
      const tint = currentLook.tint || 'none';
      const applyGlass = (gm) => {
        if (tint === 'dark') {
          gm.color?.setHex(0x030508);
          gm.opacity = 0.94;
          gm.metalness = 0.95;
          gm.roughness = 0.04;
        } else if (tint === 'light') {
          gm.color?.setHex(0x0a101a);
          gm.opacity = 0.72;
          gm.metalness = 0.88;
          gm.roughness = 0.08;
        } else if (tint === 'chameleon') {
          gm.color?.setHex(0x1e1045);
          gm.opacity = 0.84;
          gm.metalness = 0.96;
          gm.roughness = 0.05;
        } else if (gm.userData?.origColor) {
          gm.color?.copy(gm.userData.origColor);
          gm.opacity = gm.userData.origOpacity;
        }
      };
      applyGlass(procGlassMat);
      for (const gm of api._glbGlassMats) applyGlass(gm);

      // 5. Faralar rangi
      api.setLights(api.lightsOn);
    },

    setTilt(pitch = 0, roll = 0, steer = 0) {
      chassisTilt.rotation.x = pitch;
      chassisTilt.rotation.z = roll;
      chassisTilt.rotation.y = steer * 0.055;
      chassisTilt.position.y = Math.abs(roll) * 0.035;
    },

    setCockpitMode(on, telemetry) {
      const enabled = !!on;
      if (api._cockpitMode !== enabled) {
        api._cockpitMode = enabled;
        if (enabled && !api._cockpitRig) {
          api._cockpitRig = buildCockpitRig(cfg);
          chassisTilt.add(api._cockpitRig.group);
        }
        if (api._cockpitRig) api._cockpitRig.group.visible = enabled;
        // Make windshield glass crystal clear in 1st-person cockpit view
        const glassOpacity = enabled ? 0.14 : null;
        if (procGlassMat) {
          procGlassMat.opacity = glassOpacity ?? (currentLook.tint && currentLook.tint !== 'none' ? 0.85 : 0.45);
        }
        for (const gm of api._glbGlassMats) {
          if (enabled) {
            gm.transparent = true;
            gm.opacity = 0.14;
          } else {
            gm.opacity = gm.userData?.origOpacity ?? 0.5;
          }
        }
      }
      if (enabled && api._cockpitRig && telemetry) {
        api._cockpitRig.updateTelemetry(telemetry);
      }
    },

    update(dist, steer, pitch = 0, roll = 0) {
      const r = Math.max(api.radius, 0.2);
      // Mashina to'xtaganda g'ildiraklar 100% to'xtaydi (harakat paytida esa tezlikka mos aylanadi)
      const spinAngle = Math.abs(dist) > 1e-4 ? dist / r : 0;
      const targetWheels = api._glbWheels || wheels;
      for (const w of targetWheels) {
        if (spinAngle !== 0) w.spin.rotation.x += spinAngle;
        if (w.front) w.pivot.rotation.y = steer;
      }
      if (api._cockpitRig && api._cockpitMode) {
        api._cockpitRig.wheelSpin.rotation.z = -steer * 2.25;
      }
      if (pitch || roll || steer) {
        api.setTilt(pitch, roll, steer);
      } else {
        chassisTilt.rotation.y = steer * 0.055;
      }
    },

    _applyGlb(inst) {
      if (!inst) return;
      chassisTilt.remove(procGroup);
      chassisTilt.add(inst.root);
      if (inst.wheelRig && inst.wheels && inst.wheels.length > 0) {
        api.wheelRig.clear();
        api.wheelRig.add(inst.wheelRig);
        api._glbWheels = inst.wheels;
        api.wheels = inst.wheels;
      }
      api._glbLoaded = true;
      api._glbPaintMats = inst.paintMats;
      api._glbRimMats = inst.rimMats;
      api._glbHeadMats = inst.headMats;
      api._glbTailMats = inst.tailMats;
      api._glbGlassMats = inst.glassMats || [];
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
      try {
        api._applyGlb(instantiateGlb(glbCache.get(cfg.id), spec, cfg));
      } catch (err) {
        console.warn(`[GLB] apply cached xatosi (${cfg.id}):`, err);
      }
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
  const carbonMat = new THREE.MeshStandardMaterial({ color: 0x12151e, metalness: 0.65, roughness: 0.28 });
  const accentMat = new THREE.MeshStandardMaterial({ color: t.color || 0x00e5ff, metalness: 0.8, roughness: 0.2 });

  // 1. Spoyler turlari
  if (t.spoiler === 'lip') {
    const m = new THREE.Mesh(box, carbonMat);
    m.scale.set(W - 0.28, 0.055, 0.20);
    m.position.set(0, rearTop + 0.035, -L / 2 + 0.22);
    extras.add(m);
  } else if (t.spoiler === 'wing') {
    const wing = new THREE.Mesh(box, carbonMat);
    wing.scale.set(W * 0.94, 0.045, 0.32);
    wing.position.set(0, rearTop + 0.30, -L / 2 + 0.24);
    extras.add(wing);
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(box, carbonMat);
      p.scale.set(0.045, 0.28, 0.12);
      p.position.set(sx * W * 0.30, rearTop + 0.15, -L / 2 + 0.24);
      extras.add(p);
    }
  } else if (t.spoiler === 'gt_pro') {
    const wing = new THREE.Mesh(box, carbonMat);
    wing.scale.set(W * 1.02, 0.05, 0.38);
    wing.position.set(0, rearTop + 0.38, -L / 2 + 0.18);
    extras.add(wing);
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(box, carbonMat);
      p.scale.set(0.05, 0.36, 0.16);
      p.position.set(sx * W * 0.34, rearTop + 0.19, -L / 2 + 0.20);
      extras.add(p);
      const plate = new THREE.Mesh(box, accentMat);
      plate.scale.set(0.025, 0.16, 0.44);
      plate.position.set(sx * W * 0.51, rearTop + 0.39, -L / 2 + 0.18);
      extras.add(plate);
    }
  }

  // 2. Body Kit va Bamperlar (Old splitter, yon poroglar, orqa diffuzor)
  if (t.bodykit === 'street' || t.bodykit === 'wide') {
    const isWide = t.bodykit === 'wide';
    const frontSplitter = new THREE.Mesh(box, carbonMat);
    frontSplitter.scale.set(W * (isWide ? 1.04 : 0.96), 0.045, isWide ? 0.28 : 0.18);
    frontSplitter.position.set(0, 0.13, L / 2 - 0.06);
    extras.add(frontSplitter);

    for (const sx of [-1, 1]) {
      const sideSkirt = new THREE.Mesh(box, carbonMat);
      sideSkirt.scale.set(isWide ? 0.11 : 0.06, 0.055, L * 0.56);
      sideSkirt.position.set(sx * (W / 2 + (isWide ? 0.02 : -0.01)), 0.13, 0);
      extras.add(sideSkirt);
    }

    if (isWide) {
      const rearDiff = new THREE.Mesh(box, carbonMat);
      rearDiff.scale.set(W * 0.88, 0.08, 0.22);
      rearDiff.position.set(0, 0.16, -L / 2 + 0.08);
      extras.add(rearDiff);
    }
  }

  // 3. Taglik Neon
  if (t.neon && t.neon !== 'none') {
    const n = new THREE.Mesh(
      new THREE.PlaneGeometry(W * 2.05, L * 1.42),
      new THREE.MeshBasicMaterial({ map: GLOW_TEX, color: t.neon, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    n.rotation.x = -Math.PI / 2;
    n.position.y = 0.06;
    extras.add(n);
  }
}

// =========================================================================
// FIRST-PERSON COCKPIT RIG (Dashboard, Live Cluster, Steering Wheel, Mirrors)
// =========================================================================
function buildCockpitRig(cfg) {
  const group = new THREE.Group();
  const h = cfg?.hei || 1.42;
  const w = Math.min(1.95, Math.max(1.55, cfg?.wid || 1.82));
  const eyeY = Math.max(0.95, h * 0.76);
  const driverX = 0.33;

  const dashMat = new THREE.MeshStandardMaterial({ color: 0x151922, roughness: 0.72, metalness: 0.15 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x262f3f, roughness: 0.38, metalness: 0.55 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 0.7, roughness: 0.2 });
  const mirrorMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.06, metalness: 0.96 });
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0x11141b, roughness: 0.65, metalness: 0.08 });

  // Main upper & lower dashboard
  const dashUpper = new THREE.Mesh(box, dashMat);
  dashUpper.scale.set(w * 0.86, 0.16, 0.44);
  dashUpper.position.set(0, eyeY - 0.24, 0.58);
  group.add(dashUpper);

  const dashLower = new THREE.Mesh(box, leatherMat);
  dashLower.scale.set(w * 0.84, 0.22, 0.32);
  dashLower.position.set(0, eyeY - 0.4, 0.52);
  group.add(dashLower);

  // Ambient neon dash strip
  const dashStrip = new THREE.Mesh(box, accentMat);
  dashStrip.scale.set(w * 0.8, 0.012, 0.02);
  dashStrip.position.set(0, eyeY - 0.27, 0.36);
  group.add(dashStrip);

  // Center console & gear shifter
  const consoleBox = new THREE.Mesh(box, dashMat);
  consoleBox.scale.set(0.24, 0.26, 0.82);
  consoleBox.position.set(0, eyeY - 0.46, 0.18);
  group.add(consoleBox);

  const shifter = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.12, 10), trimMat);
  shifter.position.set(0, eyeY - 0.29, 0.24);
  shifter.rotation.x = -0.15;
  group.add(shifter);

  // Instrument binnacle hood
  const binnacle = new THREE.Mesh(box, dashMat);
  binnacle.scale.set(0.38, 0.17, 0.18);
  binnacle.position.set(driverX, eyeY - 0.15, 0.52);
  group.add(binnacle);

  // Live digital instrument cluster canvas
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 128;
  const ctx = cv.getContext('2d');
  const clusterTex = new THREE.CanvasTexture(cv);
  clusterTex.colorSpace = THREE.SRGBColorSpace;
  const clusterMat = new THREE.MeshBasicMaterial({ map: clusterTex });
  const clusterMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.13), clusterMat);
  clusterMesh.position.set(driverX, eyeY - 0.15, 0.425);
  clusterMesh.rotation.y = Math.PI;
  clusterMesh.rotation.x = 0.16;
  group.add(clusterMesh);

  // Steering column & animated steering wheel
  const colMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.044, 0.26, 12), dashMat);
  colMesh.rotation.x = Math.PI / 2 - 0.34;
  colMesh.position.set(driverX, eyeY - 0.22, 0.44);
  group.add(colMesh);

  const wheelTilt = new THREE.Group();
  wheelTilt.position.set(driverX, eyeY - 0.18, 0.32);
  wheelTilt.rotation.x = -0.34;
  group.add(wheelTilt);

  const wheelSpin = new THREE.Group();
  wheelTilt.add(wheelSpin);

  const rimMesh = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.019, 10, 28), leatherMat);
  wheelSpin.add(rimMesh);

  // 12-o'clock sport stripe
  const topMarker = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff3b30, emissiveIntensity: 0.35 }));
  topMarker.scale.set(0.022, 0.042, 0.044);
  topMarker.position.set(0, 0.155, 0);
  wheelSpin.add(topMarker);

  // Hub & 3 spokes
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.034, 16), trimMat);
  hub.rotation.x = Math.PI / 2;
  wheelSpin.add(hub);

  for (const ang of [0, Math.PI, -Math.PI / 2]) {
    const spoke = new THREE.Mesh(box, trimMat);
    spoke.scale.set(0.125, 0.026, 0.018);
    spoke.position.set(Math.cos(ang) * 0.075, Math.sin(ang) * 0.075, 0);
    spoke.rotation.z = ang;
    wheelSpin.add(spoke);
  }

  // A-pillars & roof header
  for (const sx of [-1, 1]) {
    const pillar = new THREE.Mesh(box, dashMat);
    pillar.scale.set(0.065, 0.56, 0.08);
    pillar.position.set(sx * (w * 0.41), eyeY + 0.06, 0.42);
    pillar.rotation.x = -0.52;
    group.add(pillar);

    // Side mirrors
    const mirrorHousing = new THREE.Mesh(box, dashMat);
    mirrorHousing.scale.set(0.16, 0.09, 0.07);
    mirrorHousing.position.set(sx * (w * 0.52), eyeY - 0.11, 0.44);
    group.add(mirrorHousing);

    const mirrorGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.07), mirrorMat);
    mirrorGlass.position.set(sx * (w * 0.52), eyeY - 0.11, 0.402);
    mirrorGlass.rotation.y = Math.PI;
    group.add(mirrorGlass);
  }

  const roofHeader = new THREE.Mesh(box, dashMat);
  roofHeader.scale.set(w * 0.84, 0.07, 0.18);
  roofHeader.position.set(0, eyeY + 0.25, 0.24);
  group.add(roofHeader);

  // Rear-view mirror
  const rvHousing = new THREE.Mesh(box, dashMat);
  rvHousing.scale.set(0.22, 0.055, 0.04);
  rvHousing.position.set(0, eyeY + 0.16, 0.34);
  group.add(rvHousing);

  const rvGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.045), mirrorMat);
  rvGlass.position.set(0, eyeY + 0.16, 0.318);
  rvGlass.rotation.y = Math.PI;
  group.add(rvGlass);

  let lastDraw = 0;
  let lastKmh = -1;
  let lastRpm = -1;
  let lastFuel = -1;
  let lastLights = null;

  function updateTelemetry({ kmh = 0, rpm = 0.15, fuel = 1, gear = 'D', lights = false } = {}) {
    const now = performance.now();
    const kInt = Math.round(kmh);
    const rInt = Math.round(rpm * 100);
    const fInt = Math.round(fuel * 100);
    if (now - lastDraw < 50 && kInt === lastKmh && Math.abs(rInt - lastRpm) < 3 && fInt === lastFuel && lights === lastLights) {
      return;
    }
    lastDraw = now;
    lastKmh = kInt;
    lastRpm = rInt;
    lastFuel = fInt;
    lastLights = lights;

    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, 256, 128);

    // Subtle border
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(3, 3, 250, 122);

    // Speed readout
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 46px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(kInt), 128, 62);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('KM/H', 128, 80);

    // Gear badge
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(14, 16, 36, 36);
    ctx.fillStyle = gear === 'R' ? '#f87171' : '#34d399';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(String(gear), 32, 42);

    // Lights indicator
    if (lights) {
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('LIGHTS', 218, 32);
    }

    // RPM bar
    const rpmFrac = Math.max(0, Math.min(1, rpm));
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(16, 94, 224, 10);
    ctx.fillStyle = rpmFrac > 0.85 ? '#ef4444' : rpmFrac > 0.65 ? '#f59e0b' : '#00e5ff';
    ctx.fillRect(16, 94, Math.round(224 * rpmFrac), 10);

    // Fuel bar
    const fuelFrac = Math.max(0, Math.min(1, fuel));
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(16, 110, 140, 7);
    ctx.fillStyle = fuelFrac < 0.2 ? '#ef4444' : '#22c55e';
    ctx.fillRect(16, 110, Math.round(140 * fuelFrac), 7);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`FUEL ${fInt}%`, 240, 117);

    clusterTex.needsUpdate = true;
  }

  return { group, wheelSpin, updateTelemetry };
}

export { TUNING };
