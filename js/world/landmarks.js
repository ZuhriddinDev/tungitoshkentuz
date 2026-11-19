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

  // 9. GTA 5 (LSIA) uslubidagi 1000m x 480m Yagona Toshkent Xalqaro Aeroporti Majmuasi (j=8..11, k=13..14)
  airport(g, l) {
    // '9,13' markazidan butun 8-kvartalli (980m x 480m) aeroport majmuasining markaziga siljish:
    const ox = 125;
    const oz = 125;
    const root = new THREE.Group();
    root.position.set(ox, 0, oz);
    g.add(root);

    const wx = l.x + ox;
    const wz = l.z + oz;

    // 1. 980m x 480m Yagona Perron va Aerodrom betoni (ichidagi ko'cha chiziqlarini 100% yopadi, bordyur yo'q!)
    const apronMat = std(0x181e27, { roughness: 0.86, metalness: 0.1 });
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(980, 480).rotateX(-Math.PI / 2), apronMat);
    apron.position.y = 0.038;
    root.add(apron);

    // 2. To'lqinli Tomli (Wave-Roof) Xalqaro Terminal 2 (290m kenglik, shimoliy qismda z = -155)
    const glassMat = std(0x0f2942, { metalness: 0.88, roughness: 0.1, emissive: 0x0ea5e9, emissiveIntensity: 0.48 });
    const steelMat = std(0xe2e8f0, { metalness: 0.65, roughness: 0.25 });
    const darkSteel = std(0x1e293b, { metalness: 0.7, roughness: 0.35 });
    const cyanGlow = std(0x38bdf8, { emissive: 0x00e5ff, emissiveIntensity: 1.25 });
    const goldGlow = std(0xfacc15, { emissive: 0xf59e0b, emissiveIntensity: 1.1 });
    nightMats.push({ mat: glassMat, base: 1.05, day: 0.22 }, { mat: cyanGlow, base: 1.6, day: 0.5 });

    const termZ = -155;
    const termX = -45;
    const termMain = new THREE.Mesh(new THREE.BoxGeometry(280, 20, 52), glassMat);
    termMain.position.set(termX, 10, termZ);
    root.add(termMain);

    // Zamonaviy aerodinamik egri arka tomlar (7 ta qanotli gumbaz segment)
    for (let i = -3; i <= 3; i++) {
      const segX = termX + i * 38;
      const archRoof = new THREE.Mesh(
        new THREE.CylinderGeometry(24, 24, 36, 16, 1, false, -Math.PI * 0.35, Math.PI * 0.7).rotateZ(Math.PI / 2),
        steelMat
      );
      archRoof.position.set(segX, 4.5, termZ + 2);
      archRoof.scale.set(1, 0.78, 1.35);
      root.add(archRoof);
    }

    const roofTrim = new THREE.Mesh(new THREE.BoxGeometry(294, 1.1, 66), cyanGlow);
    roofTrim.position.set(termX, 21.2, termZ + 2);
    root.add(roofTrim);

    // Old kirish estakadasi ustunlari (VIP Drop-off)
    for (let x = termX - 128; x <= termX + 128; x += 32) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.0, 21, 10), steelMat);
      col.position.set(x, 10.5, termZ + 31);
      root.add(col);
    }

    // Katta 3D Airport Peshlavhasi
    const signTex = signTexture(['✈️ TASHKENT INTERNATIONAL AIRPORT', 'ISLOM KARIMOV · TERMINAL 2 · UZBEKISTAN AIRWAYS'], {
      bg: '#041022',
      accent: '#38bdf8',
      w: 1024,
      h: 220,
    });
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, emissiveMap: signTex, emissive: 0xffffff, emissiveIntensity: 1.2 });
    nightMats.push({ mat: signMat, base: 1.85, day: 0.65 });
    const signFront = new THREE.Mesh(new THREE.PlaneGeometry(78, 13.5), signMat);
    signFront.position.set(termX, 28.5, termZ + 31);
    const signBack = signFront.clone();
    signBack.rotation.y = Math.PI;
    signBack.position.set(termX, 28.5, termZ - 27);
    root.add(signFront, signBack);

    // 3 ta Teleskopik Teletrap (Passenger Boarding Bridges — samolyot eshigigacha boradi)
    for (const jx of [termX - 88, termX + 8, termX + 104]) {
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.8, 36), steelMat);
      bridge.position.set(jx, 6.4, termZ + 44);
      const glassStrip = new THREE.Mesh(new THREE.BoxGeometry(4.55, 1.6, 34), glassMat);
      glassStrip.position.set(jx, 6.6, termZ + 44);
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 6.2, 10), darkSteel);
      pillar.position.set(jx, 3.1, termZ + 60);
      root.add(bridge, glassStrip, pillar);
    }

    // 3. 84 metrli Dispetcherlik Minorasi (Air Traffic Control Tower)
    const atcX = -225, atcZ = -148;
    const atcBase = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 7.8, 18, 14), darkSteel);
    atcBase.position.set(atcX, 9, atcZ);
    const atcShaft = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 5.2, 58, 16), steelMat);
    atcShaft.position.set(atcX, 42, atcZ);
    const atcCab1 = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 6.0, 6.5, 18), glassMat);
    atcCab1.position.set(atcX, 71, atcZ);
    const atcCab2 = new THREE.Mesh(new THREE.CylinderGeometry(9.8, 8.2, 5.5, 18), glassMat);
    atcCab2.position.set(atcX, 77.5, atcZ);
    const atcRoof = new THREE.Mesh(new THREE.CylinderGeometry(10.6, 10.2, 1.6, 18), steelMat);
    atcRoof.position.set(atcX, 81, atcZ);
    const radarDish = new THREE.Mesh(new THREE.BoxGeometry(11, 1.1, 1.4), cyanGlow);
    radarDish.position.set(atcX, 84.5, atcZ);
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.45, 12, 8), goldGlow);
    spire.position.set(atcX, 87, atcZ);
    root.add(atcBase, atcShaft, atcCab1, atcCab2, atcRoof, radarDish, spire);
    animated.push((t) => {
      radarDish.rotation.y = t * 2.6;
    });

    // 4. Sharqiy qismda 2 ta Ulkan VIP va Cargo Samolyot Angarlari (x = +270, z = -140)
    for (const hx of [210, 345]) {
      const roofArc = new THREE.Mesh(
        new THREE.CylinderGeometry(38, 38, 76, 20, 1, true, 0, Math.PI),
        std(0x1e293b, { side: THREE.DoubleSide, metalness: 0.65, roughness: 0.35 })
      );
      roofArc.rotation.z = Math.PI / 2;
      roofArc.rotation.y = Math.PI / 2;
      roofArc.position.set(hx, 14, -145);
      const backW = new THREE.Mesh(new THREE.BoxGeometry(74, 26, 2), darkSteel);
      backW.position.set(hx, 13, -182);
      root.add(roofArc, backW);
      addCollider(wx + hx - 38, wz - 184, wx + hx + 38, wz - 179);
    }
    addMonumentSign(root, 'UZBEKISTAN AIRWAYS TECHNICS', 'VIP HANGAR & MAINTENANCE CENTER', 278, 25, -106);

    // 5. 920m x 58m Bosh Uchish-Qo'nish Yo'lagi (RUNWAY 08L / 26R — z = +118 da, hech qanday kesishmasiz!)
    buildFullGtaRunway(root);

    // 6. Samolyotlar parki:
    // - 2 ta Uzbekistan Airways Boeing 787 Dreamliner teletraplar oldida
    buildBoeing787(root, wx, wz, termX - 88, termZ + 96, Math.PI);
    buildBoeing787(root, wx, wz, termX + 104, termZ + 96, Math.PI * 0.96);
    // - 1 ta VIP Business Jet Angar ichida
    buildVipBusinessJet(root, 210, -135, 0.15);
    buildVipBusinessJet(root, 345, -135, -0.2);

    // 7. Jonli uchib-qo'nuvchi Boeing 787 Dreamliner (Runway 08L/26R bo'ylab tezlanib havoga ko'tariladi va aylanib qo'nadi!)
    const flyingJet = new THREE.Group();
    root.add(flyingJet);
    buildBoeing787(flyingJet, wx, wz, 0, 0, Math.PI / 2, false);
    animated.push((t) => {
      // 38 soniyalik to'liq sikl:
      // 0..10s: Runway 08L (-420m -> +180m) bo'ylab yugurish va burun ko'tarish (rotate)
      // 10..26s: Havoga ko'tarilish (145m balandlikda aeroport ustidan katta aylana)
      // 26..38s: Final qo'nish (Runway 08L ga tushish va sekinlashish)
      const cycle = 38;
      const p = (t % cycle) / cycle;
      if (p < 0.28) {
        const u = p / 0.28;
        const accelU = u * u;
        flyingJet.position.set(-410 + accelU * 620, u > 0.65 ? Math.pow((u - 0.65) / 0.35, 2) * 42 : 0, 118);
        flyingJet.rotation.set(0, 0, u > 0.55 ? Math.min(0.24, (u - 0.55) * 0.6) : 0);
      } else if (p < 0.72) {
        const u = (p - 0.28) / 0.44;
        const ang = u * Math.PI * 2;
        const rx = 210 + Math.sin(ang) * 460;
        const rz = 118 - (1 - Math.cos(ang)) * 280;
        const ry = 42 + Math.sin(u * Math.PI) * 115;
        const nextAng = ang + 0.05;
        const dx = 210 + Math.sin(nextAng) * 460 - rx;
        const dz = 118 - (1 - Math.cos(nextAng)) * 280 - rz;
        flyingJet.position.set(rx, ry, rz);
        flyingJet.rotation.set(-Math.sin(ang) * 0.18, Math.atan2(-dz, dx), Math.cos(ang) * 0.12);
      } else {
        const u = (p - 0.72) / 0.28;
        const decel = 1 - Math.pow(1 - u, 2);
        const alt = u < 0.45 ? (1 - u / 0.45) * 42 : 0;
        flyingJet.position.set(-440 + decel * 260, alt, 118);
        flyingJet.rotation.set(0, 0, u < 0.45 ? 0.12 * (1 - u / 0.45) : 0);
      }
    });

    // Terminal va minora kolliziyalari (qolgan barcha perron va 920m runway mashinalar uchun 100% ochiq!)
    addCollider(wx + termX - 144, wz + termZ - 28, wx + termX + 144, wz + termZ + 26);
    addCollider(wx + atcX - 10, wz + atcZ - 10, wx + atcX + 10, wz + atcZ + 10);
  },

  // Xaritadagi 2-nuqta (Runway 08L/26R belgisi uchun; 3D obyektlar airport() ichida yagona quriladi)
  runway() {},
};

function buildFullGtaRunway(root) {
  const rwZ = 118;
  const txZ = -8;
  const rwLen = 920;
  const rwWid = 58;

  const rwMat = std(0x0d1117, { roughness: 0.74, metalness: 0.14 });
  const txMat = std(0x131922, { roughness: 0.8, metalness: 0.12 });
  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
  const yellowMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  const greenLed = new THREE.MeshBasicMaterial({ color: 0x22c55e });
  const blueLed = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const redLed = new THREE.MeshBasicMaterial({ color: 0xef4444 });

  // 920m Asosiy Uchish-Qo'nish Yo'lagi (Runway 08L / 26R)
  const mainStrip = new THREE.Mesh(new THREE.PlaneGeometry(rwLen, rwWid).rotateX(-Math.PI / 2), rwMat);
  mainStrip.position.set(0, 0.048, rwZ);
  root.add(mainStrip);

  // 880m Parallel Taxiway Alpha
  const taxiStrip = new THREE.Mesh(new THREE.PlaneGeometry(880, 26).rotateX(-Math.PI / 2), txMat);
  taxiStrip.position.set(0, 0.045, txZ);
  root.add(taxiStrip);

  // 4 ta Diagonal High-Speed Exit Taxiways (Runway va Taxiway orasida)
  for (const ex of [-320, -110, 110, 320]) {
    const conn = new THREE.Mesh(new THREE.PlaneGeometry(24, 134).rotateX(-Math.PI / 2), txMat);
    conn.position.set(ex, 0.046, (rwZ + txZ) / 2);
    root.add(conn);
    const yLine = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 132).rotateX(-Math.PI / 2), yellowMat);
    yLine.position.set(ex, 0.056, (rwZ + txZ) / 2);
    root.add(yLine);
  }

  // Runway yon oq chiziqlari va Taxiway sariq markaziy chizig'i
  for (const sz of [-rwWid / 2 + 1.5, rwWid / 2 - 1.5]) {
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(rwLen - 16, 0.9).rotateX(-Math.PI / 2), whiteMat);
    edge.position.set(0, 0.058, rwZ + sz);
    root.add(edge);
  }
  const taxiCenter = new THREE.Mesh(new THREE.PlaneGeometry(860, 0.85).rotateX(-Math.PI / 2), yellowMat);
  taxiCenter.position.set(0, 0.056, txZ);
  root.add(taxiCenter);

  // Runway markaziy uzuq chiziqlari va yon LED chiroqlar
  const lampGeo = new THREE.BoxGeometry(0.55, 0.4, 0.55);
  for (let x = -410; x <= 410; x += 28) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(15, 1.15).rotateX(-Math.PI / 2), whiteMat);
    dash.position.set(x, 0.058, rwZ);
    const l1 = new THREE.Mesh(lampGeo, whiteMat);
    l1.position.set(x, 0.22, rwZ - rwWid / 2 - 0.8);
    const l2 = new THREE.Mesh(lampGeo, whiteMat);
    l2.position.set(x, 0.22, rwZ + rwWid / 2 + 0.8);
    const tl = new THREE.Mesh(lampGeo, blueLed);
    tl.position.set(x, 0.2, txZ - 13.5);
    const tg = new THREE.Mesh(lampGeo, greenLed);
    tg.position.set(x, 0.08, txZ);
    root.add(dash, l1, l2, tl, tg);
  }

  // G'arbiy (08L) va Sharqiy (26R) Threshold Piano Keys + Touchdown Zone + ALS chiroqlari
  for (const [tx, isWest] of [[-432, true], [432, false]]) {
    const ledMat = isWest ? greenLed : redLed;
    for (let z = -22; z <= 22; z += 3.6) {
      const keyBar = new THREE.Mesh(new THREE.PlaneGeometry(18, 1.85).rotateX(-Math.PI / 2), whiteMat);
      keyBar.position.set(tx, 0.06, rwZ + z);
      const lamp = new THREE.Mesh(lampGeo, ledMat);
      lamp.position.set(tx + (isWest ? -14 : 14), 0.25, rwZ + z);
      root.add(keyBar, lamp);
    }
    // Aiming Point bloklari
    for (const sz of [-11, 11]) {
      const aim = new THREE.Mesh(new THREE.PlaneGeometry(32, 5.2).rotateX(-Math.PI / 2), whiteMat);
      aim.position.set(tx + (isWest ? 75 : -75), 0.06, rwZ + sz);
      root.add(aim);
    }
  }

  // Markazda Speed Trap Darvozasi (Runway 08L / 26R)
  const archMat = std(0x0f172a, { metalness: 0.75, roughness: 0.25 });
  const neonMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
  for (const sz of [-31, 31]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.8, 15, 1.8), archMat);
    p.position.set(0, 7.5, rwZ + sz);
    root.add(p);
  }
  const topBeam = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.0, 64), neonMat);
  topBeam.position.set(0, 15.2, rwZ);
  root.add(topBeam);
  addMonumentSign(root, '✈️ TASHKENT RUNWAY 08L / 26R', '920M MAX-SPEED POLIGONI · RADAR BONUS', 0, 18.2, rwZ, Math.PI / 2);
}

function buildBoeing787(g, wx, wz, x, z, rotY = 0, withCollider = true) {
  const plane = new THREE.Group();
  plane.position.set(x, 0, z);
  plane.rotation.y = rotY;
  g.add(plane);

  const white = std(0xf8fafc, { metalness: 0.38, roughness: 0.2 });
  const uzBlue = std(0x0088cc, { metalness: 0.55, roughness: 0.22, emissive: 0x003366, emissiveIntensity: 0.28 });
  const uzGreen = std(0x16a34a, { metalness: 0.45, roughness: 0.25 });
  const darkMetal = std(0x1e293b, { metalness: 0.78, roughness: 0.28 });
  const cockpitMat = std(0x091526, { metalness: 0.92, roughness: 0.08, emissive: 0x38bdf8, emissiveIntensity: 0.45 });
  const winMat = std(0xfef08a, { emissive: 0xfde047, emissiveIntensity: 1.15 });

  // Silliq aerodinamik fyuzelyaj + yumaloq Dreamliner burni (uzunligi ~56m, balandligi y = 4.7m)
  const body = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 36, 22).rotateZ(Math.PI / 2), white);
  body.position.set(0, 4.7, 0);
  const noseMid = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 2.8, 6.2, 22).rotateZ(-Math.PI / 2), white);
  noseMid.position.set(21.1, 4.5, 0);
  const noseTip = new THREE.Mesh(new THREE.SphereGeometry(1.55, 18, 14), white);
  noseTip.scale.set(1.9, 0.92, 1.0);
  noseTip.position.set(24.1, 4.35, 0);
  const tailCone = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 2.8, 12.5, 20).rotateZ(Math.PI / 2), white);
  tailCone.position.set(-24.2, 5.05, 0);

  // Uzbekistan Airways ko'k va yashil chiziqlari + yoritilgan yo'lovchi illyuminatorlari qatori
  const stripeB = new THREE.Mesh(new THREE.BoxGeometry(36.6, 0.55, 5.66), uzBlue);
  stripeB.position.set(0, 4.85, 0);
  const stripeG = new THREE.Mesh(new THREE.BoxGeometry(36.6, 0.32, 5.68), uzGreen);
  stripeG.position.set(0, 4.35, 0);
  const cabinWindows = new THREE.Mesh(new THREE.BoxGeometry(31, 0.34, 5.72), winMat);
  cabinWindows.position.set(0.5, 5.38, 0);

  // Uchuvchilar kabinasi oynasi
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 3.1), cockpitMat);
  cockpit.position.set(20.6, 5.45, 0);
  cockpit.rotation.z = -0.18;
  plane.add(body, noseMid, noseTip, tailCone, stripeB, stripeG, cabinWindows, cockpit);

  // Orqaga qayrilgan (Swept) Dreamliner qanotlari + Wingletlar (balandligi 4.4m — mashinalar qanot tagidan bemalol o'tadi!)
  for (const side of [-1, 1]) {
    const wHalf = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.36, 25.5), white);
    wHalf.position.set(-1.8, 4.4, side * 13.5);
    wHalf.rotation.y = side * -0.24;
    const winglet = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 0.28), uzBlue);
    winglet.position.set(-4.8, 5.5, side * 25.8);
    winglet.rotation.x = side * -0.22;
    plane.add(wHalf, winglet);
  }

  // 2 ta ulkan GE GEnx Turbofan Dvigatel + Pilon (qanotlar ostida)
  for (const sz of [-10.8, 10.8]) {
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.1, 0.55), white);
    pylon.position.set(1.2, 3.85, sz);
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(1.68, 1.52, 5.2, 20).rotateZ(Math.PI / 2), uzBlue);
    nacelle.position.set(2.0, 3.05, sz);
    const intakeRing = new THREE.Mesh(new THREE.CylinderGeometry(1.72, 1.72, 0.45, 20).rotateZ(Math.PI / 2), white);
    intakeRing.position.set(4.5, 3.05, sz);
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(1.48, 1.48, 0.45, 16).rotateZ(Math.PI / 2), darkMetal);
    fan.position.set(4.35, 3.05, sz);
    plane.add(pylon, nacelle, intakeRing, fan);
  }

  // Dum qanoti (Vertical Stabilizer) va qayrilgan Gorizontal stabilizatorlar
  const vTail = new THREE.Mesh(new THREE.BoxGeometry(7.6, 10.8, 0.52), uzBlue);
  vTail.position.set(-24.8, 10.2, 0);
  vTail.rotation.z = 0.32;
  const vTailStripe = new THREE.Mesh(new THREE.BoxGeometry(7.7, 1.4, 0.58), uzGreen);
  vTailStripe.position.set(-24.8, 8.2, 0);
  vTailStripe.rotation.z = 0.32;
  for (const side of [-1, 1]) {
    const hHalf = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.28, 9.2), white);
    hHalf.position.set(-25.5, 5.35, side * 4.8);
    hHalf.rotation.y = side * -0.26;
    plane.add(hHalf);
  }
  plane.add(vTail, vTailStripe);

  // Shassi ustunlari (Landing Gear)
  for (const [gx, gz] of [[18.5, 0], [-2.5, -4.2], [-2.5, 4.2]]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 3.3, 10), darkMetal);
    strut.position.set(gx, 1.65, gz);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.74, 1.05, 14).rotateX(Math.PI / 2), darkMetal);
    wheel.position.set(gx, 0.74, gz);
    plane.add(strut, wheel);
  }

  // Qanot uchidagi Navigatsiya va Strob chiroqlari
  const redWing = new THREE.Mesh(new THREE.SphereGeometry(0.48, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff1744 }));
  redWing.position.set(-4.8, 6.6, 26.0);
  const greenWing = new THREE.Mesh(new THREE.SphereGeometry(0.48, 8, 8), new THREE.MeshBasicMaterial({ color: 0x00e676 }));
  greenWing.position.set(-4.8, 6.6, -26.0);
  const topBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.58, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff1744 }));
  topBeacon.position.set(0, 7.7, 0);
  plane.add(redWing, greenWing, topBeacon);
  animated.push((t) => {
    topBeacon.visible = Math.floor(t * 4) % 2 === 0;
  });

  if (withCollider) {
    // Faqat samolyot shassisi atrofida kichik kolliziya (qanot tagidan mashinada o'tish 100% ochiq!)
    addCollider(wx + x - 5, wz + z - 4.5, wx + x + 18, wz + z + 4.5);
  }
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
