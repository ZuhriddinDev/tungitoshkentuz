// Toshkentning haqiqiy diqqatga sazovor maskanlari (3D Landmarks):
// 1) Toshkent Teleminorasi (375m)
// 2) Minor masjidi (Oq marmar masjid, moviy gumbaz va 2 ta minora)
// 3) Chorsu bozori (Ko'k gumbazlar va Sharqona darvoza arkasi)
// 4) Amir Temur xiyoboni (Amir Temur haykali va Toshkent Kurantlari)
// 5) "O'zbekiston" mehmonxonasi (Mashhur yarim-oy shaklidagi bino)
// 6) Tashkent City (Nest One 266m, Hilton, Congress Hall)
// 7) Mustaqillik maydoni (Ezgulik arkasi, Senat ustunlari va favvoralar)
// 8) Magic City & Milliy bog' (Ertaknamo qasr minoralari va favvora)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { LANDMARKS, addCollider } from './layout.js';
import { nightMats } from './city.js';
import { signTexture } from './textures.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...o });
export const animated = [];

const bldDraco = new DRACOLoader();
bldDraco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/draco/gltf/');
const bldLoader = new GLTFLoader();
bldLoader.setDRACOLoader(bldDraco);
const bldCache = new Map();

/**
 * /binolar/ papkasidagi 3D GLB binolarni asinxron yuklash,
 * markazlashtirish, o'lchamini moslash va FPS uchun optimallashtirish
 */
const IS_MOBILE = typeof navigator !== 'undefined' && (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900));

export function loadBuildingGlb(url, { targetHeight = 0, targetWidth = 0, rotY = 0 } = {}) {
  const key = `${url}|${targetHeight}|${targetWidth}|${rotY}`;
  if (bldCache.has(key)) {
    return bldCache.get(key).then((tpl) => (tpl ? tpl.clone(true) : null));
  }
  const p = new Promise((resolve) => {
    // Mobil qurilmalarda yuklanish silliq bo'lishi uchun ozgina kechiktirib asinxron yuklaymiz
    const delay = IS_MOBILE ? 1400 : 350;
    setTimeout(() => {
      bldLoader.load(
        url,
        (gltf) => {
          try {
            const root = gltf.scene;
            root.rotation.set(0, rotY, 0);
            root.position.set(0, 0, 0);
            root.scale.setScalar(1);
            root.updateMatrixWorld(true);

            const box = new THREE.Box3().setFromObject(root);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            let sc = 1;
            if (targetHeight > 0) sc = targetHeight / Math.max(size.y, 0.01);
            else if (targetWidth > 0) sc = targetWidth / Math.max(size.x, size.z, 0.01);

            root.scale.setScalar(sc);
            root.position.set(-center.x * sc, -box.min.y * sc, -center.z * sc);
            root.updateMatrixWorld(true);

            // Mobil va kompyuterda yuqori FPS saqlash uchun frustum culling va yengil materiallar
            root.traverse((o) => {
              if (!o.isMesh) return;
              o.castShadow = false;
              o.receiveShadow = false;
              o.frustumCulled = true;
              if (IS_MOBILE && o.material) {
                // Mobil GPU xotirasini tejash
                if (Array.isArray(o.material)) {
                  o.material.forEach((m) => { if (m.map) m.map.generateMipmaps = false; });
                } else if (o.material.map) {
                  o.material.map.generateMipmaps = false;
                }
              }
            });

            const wrap = new THREE.Group();
            wrap.add(root);
            resolve(wrap);
          } catch (e) {
            console.warn('[Binolar GLB] Xatolik:', url, e);
            resolve(null);
          }
        },
        undefined,
        () => resolve(null)
      );
    }, delay);
  });
  bldCache.set(key, p);
  return p.then((tpl) => (tpl ? tpl.clone(true) : null));
}

export const landmarkEntries = [];

export function buildLandmarks(scene) {
  animated.length = 0;
  landmarkEntries.length = 0;
  for (const l of LANDMARKS) {
    const g = new THREE.Group();
    g.position.set(l.x, 0, l.z);
    scene.add(g);
    const f = BUILDERS[l.type];
    if (f) f(g, l);
    landmarkEntries.push({
      group: g,
      x: l.x,
      z: l.z,
      isTall: l.type === 'tvtower' || l.type === 'citytower' || l.type === 'airport' || l.type === 'runway' || l.type === 'runway_east',
    });
  }
}

export function updateLandmarks(px, pz) {
  for (let i = 0; i < landmarkEntries.length; i++) {
    const item = landmarkEntries[i];
    const d = Math.hypot(item.x - px, item.z - pz);
    item.group.visible = item.isTall ? d < 2800 : d < 950;
  }
}

function addMonumentSign(g, title, sub, x, y, z, ry = 0) {
  const tex = signTexture([title, sub], { bg: '#09122c', accent: '#ffd740', w: 512, h: 192 });
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.65 });
  nightMats.push({ mat, base: 1.5, day: 0.45 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(11, 4.2), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  g.add(mesh);
}

const BUILDERS = {
  // 1. Toshkent Teleminorasi
  tvtower(g, l) {
    const steel = std(0xcfd4da, { metalness: 0.72, roughness: 0.28 });
    for (let a = 0; a < 3; a++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.8, 64, 8), steel);
      const ang = (a * Math.PI * 2) / 3;
      leg.position.set(Math.cos(ang) * 10, 30, Math.sin(ang) * 10);
      leg.rotation.set(Math.sin(ang) * 0.16, 0, -Math.cos(ang) * 0.16);
      g.add(leg);
    }
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 3.8, 240, 14), steel);
    shaft.position.y = 120;
    g.add(shaft);

    const podMat = std(0x2a3a55, { metalness: 0.65, emissive: 0x2080ff, emissiveIntensity: 0.25 });
    nightMats.push({ mat: podMat, base: 1.3, day: 0.15 });
    for (const [y, r] of [[105, 9.5], [175, 6.5]]) {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.82, 6.5, 24), podMat);
      pod.position.y = y;
      g.add(pod);
    }
    const tip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 1.1, 65, 8),
      std(0xff3030, { emissive: 0xff1744, emissiveIntensity: 1.4 })
    );
    tip.position.y = 268;
    g.add(tip);
    addMonumentSign(g, 'TELEMINORA', '375 metr · Yunusobod', 0, 5.5, 34);
    addCollider(l.x - 13, l.z - 13, l.x + 13, l.z + 13);
  },

  // 2. Minor masjidi (Oq marmar masjid, moviy gumbaz va 2 ta minora)
  minor(g, l) {
    const marble = std(0xf5f3ee, { roughness: 0.35, metalness: 0.08 });
    const azure = std(0x0088cc, { roughness: 0.22, metalness: 0.35, emissive: 0x003366, emissiveIntensity: 0.2 });
    const gold = std(0xffd740, { metalness: 0.85, roughness: 0.2, emissive: 0x664400, emissiveIntensity: 0.3 });
    nightMats.push({ mat: marble, base: 0.35, day: 0 });

    // Asosiy marmar platforma va bino
    const podium = new THREE.Mesh(new THREE.BoxGeometry(58, 1.2, 48), std(0xe2ded5));
    podium.position.y = 0.6;
    g.add(podium);

    const hall = new THREE.Mesh(new THREE.BoxGeometry(36, 12, 28), marble);
    hall.position.set(0, 7.2, -4);
    g.add(hall);

    // Old peshayvon (baland kirish arkasi)
    const portal = new THREE.Mesh(new THREE.BoxGeometry(16, 17, 6), marble);
    portal.position.set(0, 9.5, 11);
    g.add(portal);
    const archInner = new THREE.Mesh(new THREE.BoxGeometry(8, 12, 6.3), azure);
    archInner.position.set(0, 7, 11);
    g.add(archInner);

    // Moviy gumbaz va oltin hilol
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(10.5, 11, 4.5, 24), marble);
    drum.position.set(0, 15.2, -4);
    g.add(drum);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(10.8, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), azure);
    dome.position.set(0, 17.2, -4);
    g.add(dome);
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.4, 3.8, 8), gold);
    spire.position.set(0, 29, -4);
    g.add(spire);

    // Ikki yonida 2 ta baland oq marmar minora (38m)
    for (const sx of [-23, 23]) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.7, 34, 16), marble);
      tower.position.set(sx, 18, 12);
      g.add(tower);
      const lantern = new THREE.Mesh(
        new THREE.CylinderGeometry(2.2, 2.2, 3.5, 12),
        std(0xffe9a8, { emissive: 0xffc864, emissiveIntensity: 0.8 })
      );
      lantern.position.set(sx, 36.5, 12);
      g.add(lantern);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(2.25, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), azure);
      cap.position.set(sx, 38.2, 12);
      g.add(cap);
    }

    fountain(g, 0, 26);
    addMonumentSign(g, 'MINOR MASJIDI', 'Anhor bo\'yi · Oq marmar majmuasi', 0, 4.8, 38);
    addCollider(l.x - 28, l.z - 22, l.x + 28, l.z + 18);
  },

  // 3. Chorsu bozori
  chorsu(g, l) {
    const tile = std(0x1b75bc, { metalness: 0.32, roughness: 0.25, emissive: 0x082a4d, emissiveIntensity: 0.15 });
    const sand = std(0xd9c69e, { roughness: 0.7 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(27, 29, 10, 32), sand);
    base.position.y = 5;
    g.add(base);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(26, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), tile);
    dome.position.y = 10;
    g.add(dome);
    for (let a = 0; a < 8; a++) {
      const ang = (a * Math.PI) / 4;
      const d = new THREE.Mesh(new THREE.SphereGeometry(5.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), tile);
      d.position.set(Math.cos(ang) * 34, 4.2, Math.sin(ang) * 34);
      g.add(d);
      const p = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 4.2, 12), sand);
      p.position.set(Math.cos(ang) * 34, 2.1, Math.sin(ang) * 34);
      g.add(p);
    }
    // Sharqona Chorsu darvoza arkasi
    const gate = new THREE.Mesh(new THREE.BoxGeometry(18, 13, 3.2), sand);
    gate.position.set(0, 6.5, 42);
    g.add(gate);
    addMonumentSign(g, 'CHORSU BOZORI', 'Eski shahar · Tarixiy savdo gumbazi', 0, 14.5, 42.2);
    addCollider(l.x - 38, l.z - 38, l.x + 38, l.z + 38);
  },

  // 4. Amir Temur xiyoboni (Skver) va Kurantlar
  square(g, l) {
    const ped = new THREE.Mesh(new THREE.BoxGeometry(6.5, 5.5, 9.5), std(0x7a6552));
    ped.position.y = 2.75;
    g.add(ped);
    const bronze = std(0x6b4c28, { metalness: 0.82, roughness: 0.3 });
    const horse = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.5, 5.2), bronze);
    horse.position.y = 7.2;
    g.add(horse);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.5, 1.3), bronze);
    neck.position.set(0, 9.0, 2.5);
    neck.rotation.x = -0.4;
    g.add(neck);
    const rider = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.95, 3.2, 10), bronze);
    rider.position.set(0, 9.8, -0.3);
    g.add(rider);
    for (const z of [-1.6, 1.6])
      for (const x of [-0.75, 0.75]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.42, 2.4, 0.42), bronze);
        leg.position.set(x, 5.2 + (z > 0 ? 0.6 : 0), z);
        g.add(leg);
      }

    // Egizak Toshkent Kurantlari (Soat minoralari)
    for (const dx of [24, 34]) {
      const clock = new THREE.Mesh(new THREE.BoxGeometry(5.2, 28, 5.2), std(0xe8e0cc));
      clock.position.set(dx, 14, -30);
      g.add(clock);
      const face = new THREE.Mesh(
        new THREE.CircleGeometry(1.9, 24),
        std(0xffffff, { emissive: 0xfff0c0, emissiveIntensity: 0.7 })
      );
      face.position.set(dx, 23.5, -27.3);
      g.add(face);
      nightMats.push({ mat: face.material, base: 2.0, day: 0.35 });
    }
    addMonumentSign(g, 'AMIR TEMUR XIYOBONI', 'Markaziy Skver · Toshkent Kurantlari', 0, 5.2, 36);
    addCollider(l.x - 4.5, l.z - 6, l.x + 4.5, l.z + 6);
    addCollider(l.x + 21, l.z - 33, l.x + 37, l.z - 27);
    fountain(g, -26, 24);
    fountain(g, 26, 24);
  },

  // 5. "O'zbekiston" mehmonxonasi (Mashhur egri-yoy shaklidagi 17 qavatli bino)
  uzhotel(g, l) {
    const facadeMat = std(0xd8ccb4, { roughness: 0.55 });
    const glassMat = std(0x283848, { metalness: 0.6, roughness: 0.25, emissive: 0xffd280, emissiveIntensity: 0.18 });
    nightMats.push({ mat: glassMat, base: 0.65, day: 0.05 });

    const segs = 7;
    const H = 56;
    for (let i = 0; i < segs; i++) {
      const t = (i / (segs - 1)) - 0.5;
      const ang = t * 0.65;
      const x = Math.sin(ang) * 38;
      const z = -Math.cos(ang) * 22 + 12;
      const wing = new THREE.Mesh(new THREE.BoxGeometry(12.5, H, 13), facadeMat);
      wing.position.set(x, H / 2, z);
      wing.rotation.y = -ang;
      g.add(wing);
      const win = new THREE.Mesh(new THREE.BoxGeometry(11.8, H - 4, 13.3), glassMat);
      win.position.set(x, H / 2 + 1, z);
      win.rotation.y = -ang;
      g.add(win);
    }
    addMonumentSign(g, 'HOTEL UZBEKISTAN', 'Amir Temur xiyoboni', 0, H + 3.5, -6);
    addCollider(l.x - 32, l.z - 18, l.x + 32, l.z + 14);
  },

  // 6. Tashkent City (Nest One 266m + Hilton + Business Towers)
  citytower(g, l) {
    const glass = std(0x3a6ea5, { metalness: 0.88, roughness: 0.1, emissive: 0x163c70, emissiveIntensity: 0.12 });
    const goldGlass = std(0x4a607a, { metalness: 0.85, roughness: 0.12, emissive: 0x204568, emissiveIntensity: 0.14 });
    nightMats.push({ mat: glass, base: 0.72, day: 0.08 });
    nightMats.push({ mat: goldGlass, base: 0.75, day: 0.08 });

    const isNestOne = l.name.includes('Nest One');
    const towers = isNestOne
      ? [
          { x: -16, z: -10, r: 12, h: 195, mat: glass },      // Nest One (eng baland osmono'par)
          { x: 20,  z: 14,  r: 10, h: 135, mat: goldGlass },
          { x: 18,  z: -18, r: 9,  h: 105, mat: glass },
        ]
      : [
          { x: -18, z: -12, r: 11, h: 125, mat: goldGlass },  // Hilton Tashkent City
          { x: 18,  z: 12,  r: 10, h: 98,  mat: glass },
          { x: -14, z: 20,  r: 14, h: 24,  mat: glass },      // Congress Hall
        ];

    for (const tw of towers) {
      const body = new THREE.Mesh(new THREE.BoxGeometry(tw.r * 1.7, tw.h, tw.r * 1.4), tw.mat);
      body.position.set(tw.x, tw.h / 2, tw.z);
      g.add(body);
      const crown = new THREE.Mesh(
        new THREE.BoxGeometry(tw.r * 1.75, 2.2, tw.r * 1.45),
        std(0xffffff, { emissive: 0x00e5ff, emissiveIntensity: 1.1 })
      );
      crown.position.set(tw.x, tw.h + 1.1, tw.z);
      g.add(crown);
      addCollider(l.x + tw.x - tw.r, l.z + tw.z - tw.r, l.x + tw.x + tw.r, l.z + tw.z + tw.r);

      // Nest One asosiy minorasi uchun /binolar/3d_model_uzbekistan_tashkent_sity_nest_one.glb ni yuklash
      if (isNestOne && tw.h === 195) {
        loadBuildingGlb('/binolar/3d_model_uzbekistan_tashkent_sity_nest_one.glb', { targetHeight: 198 }).then((glb) => {
          if (!glb) return;
          body.visible = false;
          crown.visible = false;
          glb.position.set(tw.x, 0, tw.z);
          g.add(glb);
        });
      }
    }
    if (isNestOne) addMonumentSign(g, 'TASHKENT CITY · NEST ONE', '266m Osmono\'par · Ishbilarmonlik markazi', 0, 6, 36);
  },

  // Tashkent City Mall va Hilton
  mall(g, l) {
    const glass = std(0x284865, { metalness: 0.8, roughness: 0.15 });
    const white = std(0xedf0f4, { roughness: 0.4 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(90, 24, 75), white);
    base.position.y = 12;
    g.add(base);

    const atrium = new THREE.Mesh(new THREE.CylinderGeometry(20, 24, 8, 24), glass);
    atrium.position.y = 28;
    g.add(atrium);

    const tower = new THREE.Mesh(new THREE.BoxGeometry(32, 58, 28), glass);
    tower.position.set(24, 29, 0);
    g.add(tower);

    addMonumentSign(g, 'TASHKENT CITY MALL', 'Hilton & Savdo Markazi', 0, 8.5, 40);
    addCollider(l.x - 48, l.z - 40, l.x + 48, l.z + 40, 'building');
  },

  // 7. Mustaqillik maydoni va Oliy Majlis / Senat binosi
  park(g, l) {
    if (l.name.startsWith('Mustaqillik')) {
      const fallbackGroup = new THREE.Group();
      g.add(fallbackGroup);
      const white = std(0xf2eee6);
      for (const x of [-22, -11, 0, 11, 22]) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 15, 12), white);
        c.position.set(x, 7.5, -30);
        fallbackGroup.add(c);
        addCollider(l.x + x - 1.2, l.z - 31.2, l.x + x + 1.2, l.z - 28.8);
      }
      const top = new THREE.Mesh(new THREE.BoxGeometry(50, 2.2, 3.6), white);
      top.position.set(0, 15.8, -30);
      fallbackGroup.add(top);
      for (const x of [-15, -5, 5, 15]) {
        const bird = new THREE.Mesh(
          new THREE.ConeGeometry(0.85, 3.2, 8),
          std(0xffd740, { metalness: 0.85, emissive: 0x553300, emissiveIntensity: 0.3 })
        );
        bird.position.set(x, 18.5, -30);
        fallbackGroup.add(bird);
      }
      // /binolar/oliy_majlis_binosi..glb 3D modelini yuklash
      loadBuildingGlb('/binolar/oliy_majlis_binosi..glb', { targetWidth: 56 }).then((glb) => {
        if (!glb) return;
        glb.position.set(0, 0, -18);
        g.add(glb);
      });
      addMonumentSign(g, 'MUSTAQILLIK VA OLIY MAJLIS', 'Ezgulik arkasi · Parlament binosi', 0, 5.2, 36);
      fountain(g, -18, 12);
      fountain(g, 18, 12);
    }
    fountain(g, 0, 14);
  },

  // 8. Magic City (Ertaknamo qasr minoralari va bayram chiroqlari)
  magiccity(g, l) {
    const wallMat = std(0xeae2d3);
    const roofMat = std(0x2a52be, { metalness: 0.4, roughness: 0.3, emissive: 0x102560, emissiveIntensity: 0.3 });
    const glowMat = std(0xff4081, { emissive: 0xff2bd6, emissiveIntensity: 0.9 });
    nightMats.push({ mat: roofMat, base: 0.9, day: 0.15 });

    // Markaziy qasr va 5 ta minora
    const base = new THREE.Mesh(new THREE.BoxGeometry(36, 16, 24), wallMat);
    base.position.set(0, 8, -10);
    g.add(base);

    const spires = [
      [0, -10, 4.2, 34, 16],
      [-15, -10, 3.0, 24, 12],
      [15, -10, 3.0, 24, 12],
      [-22, 0, 2.5, 18, 10],
      [22, 0, 2.5, 18, 10],
    ];
    for (const [x, z, r, h, ch] of spires) {
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, h, 14), wallMat);
      cyl.position.set(x, h / 2, z);
      g.add(cyl);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r * 1.15, ch, 14), roofMat);
      cone.position.set(x, h + ch / 2, z);
      g.add(cone);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.95, 0.2, 8, 20).rotateX(Math.PI / 2), glowMat);
      ring.position.set(x, h, z);
      g.add(ring);
    }
    fountain(g, 0, 18);
    addMonumentSign(g, 'MAGIC CITY', 'Oilaviy ko\'ngilochar park va qasr', 0, 5.5, 36);
    addCollider(l.x - 24, l.z - 22, l.x + 24, l.z + 4);
  },

  // 9. Islom Karimov nomidagi Toshkent Xalqaro Aeroporti (TAS / Terminal + Dispetcherlik minorasi)
  airport(g, l) {
    // Tekis asfalt perron va uchish yo'lagi (bordyursiz, mashinalar erkin kiradi)
    const tarmacMat = std(0x1b2028, { roughness: 0.85, metalness: 0.1 });
    const tarmac = new THREE.Mesh(new THREE.PlaneGeometry(220, 220).rotateX(-Math.PI / 2), tarmacMat);
    tarmac.position.y = 0.025;
    g.add(tarmac);

    // 2-qavatli oyna-fasadli Xalqaro Terminal binosi (shimoliy tomonda z = -62)
    const glassMat = std(0x1e3a5f, { metalness: 0.85, roughness: 0.12, emissive: 0x0ea5e9, emissiveIntensity: 0.42 });
    const frameMat = std(0xe2e8f0, { metalness: 0.45, roughness: 0.35 });
    const goldMat = std(0xffd740, { metalness: 0.8, roughness: 0.2, emissive: 0x00e5ff, emissiveIntensity: 0.7 });
    nightMats.push({ mat: glassMat, base: 0.95, day: 0.2 }, { mat: goldMat, base: 1.4, day: 0.4 });

    const termBody = new THREE.Mesh(new THREE.BoxGeometry(164, 18, 44), glassMat);
    termBody.position.set(0, 9, -64);
    g.add(termBody);

    // Terminal tomi va old soyabon (Canopy)
    const roof = new THREE.Mesh(new THREE.BoxGeometry(176, 2.2, 58), frameMat);
    roof.position.set(0, 19.1, -60);
    const roofLed = new THREE.Mesh(new THREE.BoxGeometry(177, 0.55, 58.6), goldMat);
    roofLed.position.set(0, 20.1, -60);
    g.add(roof, roofLed);

    // Soyabon ustunlari
    for (let x = -72; x <= 72; x += 24) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.8, 18, 10), frameMat);
      col.position.set(x, 9, -35);
      g.add(col);
    }

    // Terminal tepasidagi katta yoritilgan "TASHKENT INTERNATIONAL AIRPORT" peshlavhasi
    const signTex = signTexture(['✈️ TASHKENT AIRPORT', 'ISLOM KARIMOV · TERMINAL 2 (TAS)'], {
      bg: '#06152d',
      accent: '#38bdf8',
      w: 1024,
      h: 220,
    });
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, emissiveMap: signTex, emissive: 0xffffff, emissiveIntensity: 1.1 });
    nightMats.push({ mat: signMat, base: 1.8, day: 0.6 });
    const signFront = new THREE.Mesh(new THREE.PlaneGeometry(54, 10.5), signMat);
    signFront.position.set(0, 25.5, -38);
    const signBack = signFront.clone();
    signBack.rotation.y = Math.PI;
    signBack.position.set(0, 25.5, -38.4);
    g.add(signFront, signBack);

    // 68 metrli Dispetcherlik Minorasi (Air Traffic Control Tower) + aylanuvchi radar
    const towerX = -78, towerZ = -58;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.8, 54, 14), frameMat);
    shaft.position.set(towerX, 27, towerZ);
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 5.2, 8.5, 16), glassMat);
    cab.position.set(towerX, 57, towerZ);
    const cabRoof = new THREE.Mesh(new THREE.CylinderGeometry(7.8, 7.8, 1.4, 16), frameMat);
    cabRoof.position.set(towerX, 62, towerZ);
    const radarBar = new THREE.Mesh(
      new THREE.BoxGeometry(8.5, 0.8, 1.1),
      std(0x38bdf8, { emissive: 0x00e5ff, emissiveIntensity: 1.4 })
    );
    radarBar.position.set(towerX, 64.5, towerZ);
    g.add(shaft, cab, cabRoof, radarBar);
    animated.push((t) => {
      radarBar.rotation.y = t * 2.4;
    });

    // Janubiy qismda Uchish-Qo'nish yo'lagi boshlanishi (Runway 08L)
    buildRunwayStrip(g, true, false);

    // Kolliziyalar: faqat terminal binosi va minora uchun (uchish yo'lagi 100% ochiq)
    addCollider(l.x - 84, l.z - 88, l.x + 84, l.z - 40);
  },

  // 10. Aeroport Uchish Yo'lagi va Uzbekistan Airways Boeing 787 Dreamliner
  runway(g, l) {
    const tarmacMat = std(0x1b2028, { roughness: 0.85, metalness: 0.1 });
    const tarmac = new THREE.Mesh(new THREE.PlaneGeometry(220, 220).rotateX(-Math.PI / 2), tarmacMat);
    tarmac.position.y = 0.025;
    g.add(tarmac);

    buildRunwayStrip(g, false, false);

    // Shimoliy perronda (z = -54) turgan ulkan 3D Boeing 787 Dreamliner samolyoti
    buildBoeing787(g, l, 0, -54, 0.18);

    // Uchish yo'lagi o'rtasida (z = 35) Speed Trap / Tezlik Darvozasi
    const archMat = std(0x0f172a, { metalness: 0.7, roughness: 0.3 });
    const neonMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    for (const sx of [-24, 24]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.4, 13, 1.4), archMat);
      p.position.set(sx, 6.5, 35);
      p.rotation.y = Math.PI / 2;
      g.add(p);
    }
    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 50), neonMat);
    topBeam.position.set(0, 13.2, 35);
    g.add(topBeam);
    addMonumentSign(g, '✈️ RUNWAY 08L / 26R', '350+ KM/H MAKS-TEZLIK POLIGONI', 0, 15.8, 35, Math.PI / 2);
  },

  // 11. Aeroport Sharqiy Uchish Yo'lagi (26R) + VIP Samolyot Angari + Tramplin
  runway_east(g, l) {
    const tarmacMat = std(0x1b2028, { roughness: 0.85, metalness: 0.1 });
    const tarmac = new THREE.Mesh(new THREE.PlaneGeometry(220, 220).rotateX(-Math.PI / 2), tarmacMat);
    tarmac.position.y = 0.025;
    g.add(tarmac);

    buildRunwayStrip(g, false, true);

    // Shimoliy qismda Ochiq VIP Aviatsiya Angari va VIP Private Jet (z = -58)
    const hangarMat = std(0x273244, { metalness: 0.65, roughness: 0.35 });
    const roofArc = new THREE.Mesh(
      new THREE.CylinderGeometry(34, 34, 68, 18, 1, true, 0, Math.PI),
      std(0x1e293b, { side: THREE.DoubleSide, metalness: 0.6, roughness: 0.4 })
    );
    roofArc.rotation.z = Math.PI / 2;
    roofArc.rotation.y = Math.PI / 2;
    roofArc.position.set(0, 12, -58);
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(66, 22, 1.8), hangarMat);
    backWall.position.set(0, 11, -91);
    g.add(roofArc, backWall);
    addMonumentSign(g, 'VIP AVIATION HANGAR', 'TASHKENT BUSINESS JET TERMINAL', 0, 22, -24);

    // Angar oldida VIP Business Jet
    buildVipBusinessJet(g, 0, -48, -0.25);

    addCollider(l.x - 35, l.z - 93, l.x + 35, l.z - 89);
  },
};

function buildRunwayStrip(g, isWestThreshold, isEastThreshold) {
  // z = +35 bo'ylab X o'qi yo'nalishida (-110..+110) 44m kenglikdagi yoritilgan uchish-qo'nish yo'lagi
  const rwZ = 35;
  const rwMat = std(0x11151c, { roughness: 0.78, metalness: 0.12 });
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(220, 46).rotateX(-Math.PI / 2), rwMat);
  strip.position.set(0, 0.04, rwZ);
  g.add(strip);

  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
  const yellowMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  const greenLed = new THREE.MeshBasicMaterial({ color: 0x22c55e });
  const blueLed = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const redLed = new THREE.MeshBasicMaterial({ color: 0xef4444 });

  // Yon chegara chiziqlari
  for (const sz of [-21, 21]) {
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(220, 0.65).rotateX(-Math.PI / 2), whiteMat);
    edge.position.set(0, 0.055, rwZ + sz);
    g.add(edge);
  }

  // Markaziy uzuq-uzuq oq chiziqlar va yon LED chiroqlar
  const boxGeo = new THREE.BoxGeometry(0.45, 0.35, 0.45);
  for (let x = -96; x <= 96; x += 24) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(12, 0.9).rotateX(-Math.PI / 2), whiteMat);
    dash.position.set(x, 0.055, rwZ);
    g.add(dash);

    const l1 = new THREE.Mesh(boxGeo, blueLed);
    l1.position.set(x, 0.2, rwZ - 22.2);
    const l2 = new THREE.Mesh(boxGeo, blueLed);
    l2.position.set(x, 0.2, rwZ + 22.2);
    g.add(l1, l2);
  }

  // Perronga ulovchi sariq taxiway chizig'i
  const taxi = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 56).rotateX(-Math.PI / 2), yellowMat);
  taxi.position.set(0, 0.055, -6);
  g.add(taxi);

  // Uchish yo'lagi boshi / oxiri "Piano Key" belgilari
  if (isWestThreshold || isEastThreshold) {
    const tx = isWestThreshold ? -88 : 88;
    const ledMat = isWestThreshold ? greenLed : redLed;
    for (let z = -17; z <= 17; z += 3.4) {
      const keyBar = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.7).rotateX(-Math.PI / 2), whiteMat);
      keyBar.position.set(tx, 0.06, rwZ + z);
      const lamp = new THREE.Mesh(boxGeo, ledMat);
      lamp.position.set(tx + (isWestThreshold ? -10 : 10), 0.25, rwZ + z);
      g.add(keyBar, lamp);
    }
  }
}

function buildBoeing787(g, l, x, z, rotY = 0) {
  const plane = new THREE.Group();
  plane.position.set(x, 0, z);
  plane.rotation.y = rotY;
  g.add(plane);

  const white = std(0xf8fafc, { metalness: 0.35, roughness: 0.22 });
  const uzBlue = std(0x0088cc, { metalness: 0.5, roughness: 0.25, emissive: 0x003366, emissiveIntensity: 0.25 });
  const uzGreen = std(0x16a34a, { metalness: 0.45, roughness: 0.28 });
  const darkMetal = std(0x1e293b, { metalness: 0.75, roughness: 0.3 });
  const cockpitMat = std(0x091526, { metalness: 0.9, roughness: 0.08, emissive: 0x38bdf8, emissiveIntensity: 0.35 });

  // Fyuzelyaj (uzunligi ~52m, balandligi y = 4.6m)
  const body = new THREE.Mesh(new THREE.CylinderGeometry(2.65, 2.65, 36, 18).rotateZ(Math.PI / 2), white);
  body.position.set(0, 4.6, 0);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(2.65, 9.5, 18).rotateZ(-Math.PI / 2), white);
  nose.position.set(22.7, 4.6, 0);
  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(2.65, 11, 18).rotateZ(Math.PI / 2), white);
  tailCone.position.set(-23.5, 4.9, 0);

  // Uzbekistan Airways ko'k va yashil chiziqlari
  const stripeB = new THREE.Mesh(new THREE.BoxGeometry(36.4, 0.55, 5.42), uzBlue);
  stripeB.position.set(0, 4.75, 0);
  const stripeG = new THREE.Mesh(new THREE.BoxGeometry(36.4, 0.32, 5.44), uzGreen);
  stripeG.position.set(0, 4.25, 0);

  // Kabina oynasi
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.15, 2.8), cockpitMat);
  cockpit.position.set(20.2, 5.45, 0);
  plane.add(body, nose, tailCone, stripeB, stripeG, cockpit);

  // Qanotlar (50m qanot kengligi — balandligi 4.4m, mashinalar qanot tagidan bemalol o'ta oladi!)
  const wingGeo = new THREE.BoxGeometry(7.2, 0.38, 48);
  const wings = new THREE.Mesh(wingGeo, white);
  wings.position.set(-1.2, 4.35, 0);
  plane.add(wings);

  // 2 ta ulkan Turbofan Dvigatel (qanotlar ostida)
  for (const sz of [-11.5, 11.5]) {
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.45, 4.6, 16).rotateZ(Math.PI / 2), uzBlue);
    nacelle.position.set(1.2, 3.1, sz);
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.4, 14).rotateZ(Math.PI / 2), darkMetal);
    fan.position.set(3.35, 3.1, sz);
    plane.add(nacelle, fan);
  }

  // Dum qanoti (Vertical Stabilizer) va Gorizontal stabilizator
  const vTail = new THREE.Mesh(new THREE.BoxGeometry(6.8, 9.5, 0.45), uzBlue);
  vTail.position.set(-23.5, 9.5, 0);
  vTail.rotation.z = 0.28;
  const hTail = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.3, 16), white);
  hTail.position.set(-24.2, 5.2, 0);
  plane.add(vTail, hTail);

  // Shassi ustunlari (Landing Gear)
  for (const [gx, gz] of [[16.5, 0], [-2.5, -3.6], [-2.5, 3.6]]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3.2, 8), darkMetal);
    strut.position.set(gx, 1.6, gz);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.9, 12).rotateX(Math.PI / 2), darkMetal);
    wheel.position.set(gx, 0.68, gz);
    plane.add(strut, wheel);
  }

  // Qanot uchidagi Navigatsiya va Strob chiroqlari
  const redWing = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff1744 }));
  redWing.position.set(-1.2, 4.45, 24.2);
  const greenWing = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), new THREE.MeshBasicMaterial({ color: 0x00e676 }));
  greenWing.position.set(-1.2, 4.45, -24.2);
  const topBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff1744 }));
  topBeacon.position.set(0, 7.45, 0);
  plane.add(redWing, greenWing, topBeacon);
  animated.push((t) => {
    topBeacon.visible = Math.floor(t * 4) % 2 === 0;
  });

  // Faqat samolyot shassisi atrofida kichik kolliziya (qanot tagidan mashinada o'tish 100% ochiq!)
  addCollider(l.x + x - 5, l.z + z - 4.5, l.x + x + 18, l.z + z + 4.5);
}

function buildVipBusinessJet(g, x, z, rotY = 0) {
  const jet = new THREE.Group();
  jet.position.set(x, 0, z);
  jet.rotation.y = rotY;
  g.add(jet);

  const pearl = std(0xf1f5f9, { metalness: 0.6, roughness: 0.16 });
  const gold = std(0xf59e0b, { metalness: 0.85, roughness: 0.18, emissive: 0x78350f, emissiveIntensity: 0.3 });
  const dark = std(0x0f172a, { metalness: 0.9, roughness: 0.1 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 18, 14).rotateZ(Math.PI / 2), pearl);
  body.position.set(0, 2.5, 0);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.35, 4.8, 14).rotateZ(-Math.PI / 2), pearl);
  nose.position.set(11.4, 2.5, 0);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(18.2, 0.25, 2.76), gold);
  stripe.position.set(0, 2.55, 0);
  const wings = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.22, 22), pearl);
  wings.position.set(-1, 2.3, 0);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(3.4, 4.6, 0.28), gold);
  tail.position.set(-8.8, 4.8, 0);
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.72, 1.65), dark);
  cockpit.position.set(9.4, 3.0, 0);
  jet.add(body, nose, stripe, wings, tail, cockpit);
}

function fountain(g, x, z) {
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.8, 1, 24), std(0xcfc7b5));
  bowl.position.set(x, 0.5, z);
  g.add(bowl);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(6.7, 24).rotateX(-Math.PI / 2),
    std(0x3fa9d9, { metalness: 0.5, roughness: 0.1, emissive: 0x0a4060, emissiveIntensity: 0.5 })
  );
  water.position.set(x, 1.05, z);
  g.add(water);
  const jet = new THREE.Mesh(
    new THREE.ConeGeometry(1.3, 5.5, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.5, depthWrite: false })
  );
  jet.position.set(x, 3.6, z);
  g.add(jet);
  animated.push((t) => {
    jet.scale.y = 1 + Math.sin(t * 4) * 0.16;
  });
  const wp = g.position;
  addCollider(wp.x + x - 7.8, wp.z + z - 7.8, wp.x + x + 7.8, wp.z + z + 7.8);
}
