// Professional 3D O'yin Qahramoni (Rigged Streetwear Character):
// Skelet bo'g'imlari (Armature), Qora Streetwear Hoodie (orqa toj emblemasi bilan),
// Kargo shim, Oq-qora krossovka va 7 ta silliq almashuvchi animatsiya:
// Idle, Walk, Run, Jump, Fall, EnterCar, ExitCar (+ Wave/Dance)
import * as THREE from 'three';
import { HALF, queryColliders } from './world/layout.js';

let sharedAssets = null;

function createBackLogoTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);

  // Orqa fondagi nozik halqa
  g.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(128, 118, 68, 0, Math.PI * 2);
  g.stroke();

  // Streetwear Toj (Crown) emblemasi
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(82, 145);
  g.lineTo(74, 92);
  g.lineTo(104, 116);
  g.lineTo(128, 82);
  g.lineTo(152, 116);
  g.lineTo(182, 92);
  g.lineTo(174, 145);
  g.closePath();
  g.fill();

  // Toj cho'qqilaridagi nuqtalar
  for (const [px, py] of [[74, 84], [128, 74], [182, 84]]) {
    g.beginPath();
    g.arc(px, py, 5.5, 0, Math.PI * 2);
    g.fill();
  }

  // Yozuv
  g.font = '900 18px "Segoe UI", Arial, sans-serif';
  g.textAlign = 'center';
  g.fillStyle = '#00e5ff';
  g.fillText('TOSHKENT', 128, 172);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function getSharedAssets() {
  if (sharedAssets) return sharedAssets;

  const backLogoTex = createBackLogoTexture();

  // --- Materiallar ---
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xe0ac82,
    roughness: 0.52,
    metalness: 0.04,
  });
  const hoodieMat = new THREE.MeshStandardMaterial({
    color: 0x12141c,
    roughness: 0.72,
    metalness: 0.08,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: 0x161922,
    roughness: 0.78,
    metalness: 0.06,
  });
  const capMat = new THREE.MeshStandardMaterial({
    color: 0x0e1017,
    roughness: 0.6,
    metalness: 0.12,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x181311,
    roughness: 0.8,
  });
  const shoeWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xf4f6fb,
    roughness: 0.38,
    metalness: 0.08,
  });
  const shoeBlackMat = new THREE.MeshStandardMaterial({
    color: 0x141720,
    roughness: 0.55,
    metalness: 0.1,
  });
  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const eyePupilMat = new THREE.MeshBasicMaterial({ color: 0x1b120c });
  const backDecalMat = new THREE.MeshBasicMaterial({
    map: backLogoTex,
    transparent: true,
    depthWrite: false,
  });

  // --- Geometriyalar ---
  const pelvisGeo = new THREE.CapsuleGeometry(0.145, 0.08, 6, 12);
  pelvisGeo.scale(1.18, 0.85, 0.82);

  const abdomenGeo = new THREE.CylinderGeometry(0.165, 0.15, 0.24, 14);
  abdomenGeo.scale(1.12, 1, 0.78);

  const chestGeo = new THREE.CapsuleGeometry(0.185, 0.22, 8, 16);
  chestGeo.scale(1.18, 1, 0.78);

  // Kenguru cho'ntak (old tomonda)
  const pocketGeo = new THREE.BoxGeometry(0.24, 0.12, 0.04);
  // Orqadagi osilib turgan kapyushon (hood)
  const hoodBackGeo = new THREE.SphereGeometry(0.16, 12, 10);
  hoodBackGeo.scale(1.05, 0.75, 0.65);

  // Kapyushon bog'ichlari (drawstrings)
  const cordGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.18, 6);

  // Bo'yin va Bosh
  const neckGeo = new THREE.CylinderGeometry(0.058, 0.066, 0.11, 12);
  const headGeo = new THREE.SphereGeometry(0.122, 18, 16);
  headGeo.scale(0.92, 1.06, 0.96);

  const jawGeo = new THREE.BoxGeometry(0.135, 0.075, 0.13);
  const noseGeo = new THREE.ConeGeometry(0.02, 0.048, 6);
  noseGeo.rotateX(Math.PI * 0.48);
  const earGeo = new THREE.SphereGeometry(0.026, 8, 8);
  earGeo.scale(0.55, 1.1, 0.75);

  const eyeGeo = new THREE.SphereGeometry(0.016, 8, 8);
  const pupilGeo = new THREE.SphereGeometry(0.009, 6, 6);
  const browGeo = new THREE.BoxGeometry(0.038, 0.009, 0.012);

  // Soch va Qora Kepka
  const hairBackGeo = new THREE.SphereGeometry(0.126, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62);
  const capCrownGeo = new THREE.SphereGeometry(0.129, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
  capCrownGeo.scale(0.95, 1.02, 1.02);
  const capVisorGeo = new THREE.BoxGeometry(0.175, 0.016, 0.12);

  // Yelka va Qo'llar
  const upperArmGeo = new THREE.CapsuleGeometry(0.058, 0.21, 6, 12);
  const foreArmGeo = new THREE.CapsuleGeometry(0.05, 0.19, 6, 12);
  const cuffGeo = new THREE.CylinderGeometry(0.052, 0.048, 0.04, 10);

  // Kaft va barmoqlar
  const palmGeo = new THREE.BoxGeometry(0.042, 0.075, 0.068);
  const fingersGeo = new THREE.BoxGeometry(0.036, 0.058, 0.062);
  const thumbGeo = new THREE.CapsuleGeometry(0.013, 0.035, 4, 6);

  // Oyoqlar (Son va Boldir — Kargo shim)
  const thighGeo = new THREE.CapsuleGeometry(0.086, 0.28, 6, 12);
  const cargoPocketGeo = new THREE.BoxGeometry(0.025, 0.12, 0.11);
  const shinGeo = new THREE.CapsuleGeometry(0.072, 0.29, 6, 12);
  const pantCuffGeo = new THREE.CylinderGeometry(0.076, 0.068, 0.05, 10);

  // Zamonaviy Oq-Qora Krossovka
  const shoeSoleGeo = new THREE.BoxGeometry(0.116, 0.034, 0.255);
  const shoeUpperGeo = new THREE.BoxGeometry(0.108, 0.068, 0.21);
  const shoeToeGeo = new THREE.CylinderGeometry(0.054, 0.056, 0.065, 12, 1, false, 0, Math.PI);
  shoeToeGeo.rotateZ(Math.PI / 2);
  shoeToeGeo.rotateY(Math.PI / 2);
  const shoeCollarGeo = new THREE.CylinderGeometry(0.055, 0.058, 0.05, 10);
  const shoeStripeGeo = new THREE.BoxGeometry(0.112, 0.018, 0.09);

  const decalPlaneGeo = new THREE.PlaneGeometry(0.24, 0.24);

  sharedAssets = {
    skinMat,
    hoodieMat,
    pantsMat,
    capMat,
    hairMat,
    shoeWhiteMat,
    shoeBlackMat,
    eyeWhiteMat,
    eyePupilMat,
    backDecalMat,
    pelvisGeo,
    abdomenGeo,
    chestGeo,
    pocketGeo,
    hoodBackGeo,
    cordGeo,
    neckGeo,
    headGeo,
    jawGeo,
    noseGeo,
    earGeo,
    eyeGeo,
    pupilGeo,
    browGeo,
    hairBackGeo,
    capCrownGeo,
    capVisorGeo,
    upperArmGeo,
    foreArmGeo,
    cuffGeo,
    palmGeo,
    fingersGeo,
    thumbGeo,
    thighGeo,
    cargoPocketGeo,
    shinGeo,
    pantCuffGeo,
    shoeSoleGeo,
    shoeUpperGeo,
    shoeToeGeo,
    shoeCollarGeo,
    shoeStripeGeo,
    decalPlaneGeo,
  };
  return sharedAssets;
}

const lerp = (a, b, t) => a + (b - a) * t;

export function buildCharacterModel(accentColor = '#00e5ff') {
  const A = getSharedAssets();
  const group = new THREE.Group();
  group.rotation.order = 'YXZ';

  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor || '#00e5ff',
    emissive: accentColor || '#00e5ff',
    emissiveIntensity: 0.35,
    roughness: 0.3,
    metalness: 0.5,
  });

  // =========================================================
  // SKELET (ARMATURE) IYERARXIYASI
  // =========================================================
  // 1. Hips (Tos bo'g'imi — yerdan ~0.92m balandlikda)
  const hips = new THREE.Group();
  hips.position.set(0, 0.92, 0);
  group.add(hips);

  const pelvisMesh = new THREE.Mesh(A.pelvisGeo, A.pantsMat);
  pelvisMesh.castShadow = true;
  hips.add(pelvisMesh);

  // 2. Spine (Bel bo'g'imi)
  const spine = new THREE.Group();
  spine.position.set(0, 0.06, 0);
  hips.add(spine);

  const abdomenMesh = new THREE.Mesh(A.abdomenGeo, A.hoodieMat);
  abdomenMesh.position.set(0, 0.11, 0);
  abdomenMesh.castShadow = true;
  spine.add(abdomenMesh);

  const pocketMesh = new THREE.Mesh(A.pocketGeo, A.hoodieMat);
  pocketMesh.position.set(0, 0.09, 0.125);
  spine.add(pocketMesh);

  // 3. Chest (Ko'krak qafasi bo'g'imi)
  const chest = new THREE.Group();
  chest.position.set(0, 0.22, 0);
  spine.add(chest);

  const chestMesh = new THREE.Mesh(A.chestGeo, A.hoodieMat);
  chestMesh.position.set(0, 0.14, 0);
  chestMesh.castShadow = true;
  chest.add(chestMesh);

  // Orqa toj emblemasi (Streetwear Crown print)
  const backDecal = new THREE.Mesh(A.decalPlaneGeo, A.backDecalMat);
  backDecal.position.set(0, 0.15, -0.152);
  backDecal.rotation.y = Math.PI;
  chest.add(backDecal);

  // Kapyushon (bo'yin orqasida)
  const hoodBack = new THREE.Mesh(A.hoodBackGeo, A.hoodieMat);
  hoodBack.position.set(0, 0.29, -0.09);
  hoodBack.rotation.x = -0.35;
  chest.add(hoodBack);

  // Kapyushon bog'ichlari
  const cordL = new THREE.Mesh(A.cordGeo, accentMat);
  cordL.position.set(-0.045, 0.21, 0.142);
  const cordR = new THREE.Mesh(A.cordGeo, accentMat);
  cordR.position.set(0.045, 0.21, 0.142);
  chest.add(cordL, cordR);

  // 4. Neck & Head (Bo'yin va Bosh)
  const neck = new THREE.Group();
  neck.position.set(0, 0.33, 0);
  chest.add(neck);

  const neckMesh = new THREE.Mesh(A.neckGeo, A.skinMat);
  neckMesh.position.set(0, 0.04, 0);
  neck.add(neckMesh);

  const head = new THREE.Group();
  head.position.set(0, 0.09, 0);
  neck.add(head);

  const skullMesh = new THREE.Mesh(A.headGeo, A.skinMat);
  skullMesh.position.set(0, 0.09, 0);
  skullMesh.castShadow = true;
  head.add(skullMesh);

  const jawMesh = new THREE.Mesh(A.jawGeo, A.skinMat);
  jawMesh.position.set(0, 0.04, 0.015);
  head.add(jawMesh);

  const noseMesh = new THREE.Mesh(A.noseGeo, A.skinMat);
  noseMesh.position.set(0, 0.085, 0.125);
  head.add(noseMesh);

  const earL = new THREE.Mesh(A.earGeo, A.skinMat);
  earL.position.set(-0.112, 0.085, -0.005);
  const earR = new THREE.Mesh(A.earGeo, A.skinMat);
  earR.position.set(0.112, 0.085, -0.005);
  head.add(earL, earR);

  // Ko'zlar va qoshlar
  const eyeL = new THREE.Mesh(A.eyeGeo, A.eyeWhiteMat);
  eyeL.position.set(-0.042, 0.102, 0.105);
  const eyeR = new THREE.Mesh(A.eyeGeo, A.eyeWhiteMat);
  eyeR.position.set(0.042, 0.102, 0.105);
  const pupilL = new THREE.Mesh(A.pupilGeo, A.eyePupilMat);
  pupilL.position.set(-0.042, 0.102, 0.117);
  const pupilR = new THREE.Mesh(A.pupilGeo, A.eyePupilMat);
  pupilR.position.set(0.042, 0.102, 0.117);
  const browL = new THREE.Mesh(A.browGeo, A.hairMat);
  browL.position.set(-0.042, 0.125, 0.112);
  browL.rotation.z = -0.06;
  const browR = new THREE.Mesh(A.browGeo, A.hairMat);
  browR.position.set(0.042, 0.125, 0.112);
  browR.rotation.z = 0.06;
  head.add(eyeL, eyeR, pupilL, pupilR, browL, browR);

  // Soch va Qora Streetwear Kepka
  const hairMesh = new THREE.Mesh(A.hairBackGeo, A.hairMat);
  hairMesh.position.set(0, 0.105, -0.008);
  head.add(hairMesh);

  const capCrown = new THREE.Mesh(A.capCrownGeo, A.capMat);
  capCrown.position.set(0, 0.115, 0);
  capCrown.rotation.x = -0.08;
  const capVisor = new THREE.Mesh(A.capVisorGeo, A.capMat);
  capVisor.position.set(0, 0.138, 0.135);
  capVisor.rotation.x = 0.08;
  head.add(capCrown, capVisor);

  // 5. Qo'llar (Yelka -> Tirsak -> Bilak va Barmoqlar)
  function buildArm(side) {
    const s = side === 'L' ? 1 : -1; // +X chap yoki o'ng: Three.js da oldi +Z bo'lsa, chap qo'l +X, o'ng qo'l -X
    const shoulder = new THREE.Group();
    shoulder.position.set(s * 0.235, 0.25, 0);
    chest.add(shoulder);

    const upperArmMesh = new THREE.Mesh(A.upperArmGeo, A.hoodieMat);
    upperArmMesh.position.set(0, -0.12, 0);
    upperArmMesh.castShadow = true;
    shoulder.add(upperArmMesh);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.25, 0);
    shoulder.add(elbow);

    const foreArmMesh = new THREE.Mesh(A.foreArmGeo, A.hoodieMat);
    foreArmMesh.position.set(0, -0.11, 0);
    foreArmMesh.castShadow = true;
    elbow.add(foreArmMesh);

    const cuffMesh = new THREE.Mesh(A.cuffGeo, accentMat);
    cuffMesh.position.set(0, -0.21, 0);
    elbow.add(cuffMesh);

    const wrist = new THREE.Group();
    wrist.position.set(0, -0.24, 0);
    elbow.add(wrist);

    const palmMesh = new THREE.Mesh(A.palmGeo, A.skinMat);
    palmMesh.position.set(0, -0.035, 0);
    const fingersMesh = new THREE.Mesh(A.fingersGeo, A.skinMat);
    fingersMesh.position.set(0, -0.09, 0.004);
    fingersMesh.rotation.x = 0.18;
    const thumbMesh = new THREE.Mesh(A.thumbGeo, A.skinMat);
    thumbMesh.position.set(-s * 0.024, -0.045, 0.035);
    thumbMesh.rotation.x = 0.45;
    thumbMesh.rotation.z = s * 0.35;
    wrist.add(palmMesh, fingersMesh, thumbMesh);

    return { shoulder, elbow, wrist };
  }

  const armL = buildArm('L');
  const armR = buildArm('R');

  // 6. Oyoqlar (Son -> Tizza -> Boldir -> To'piq va Krossovka)
  function buildLeg(side) {
    const s = side === 'L' ? 1 : -1;
    const hip = new THREE.Group();
    hip.position.set(s * 0.105, -0.02, 0);
    hips.add(hip);

    const thighMesh = new THREE.Mesh(A.thighGeo, A.pantsMat);
    thighMesh.position.set(0, -0.19, 0);
    thighMesh.castShadow = true;
    hip.add(thighMesh);

    const cargoPocket = new THREE.Mesh(A.cargoPocketGeo, A.pantsMat);
    cargoPocket.position.set(s * 0.082, -0.20, 0.01);
    hip.add(cargoPocket);

    const knee = new THREE.Group();
    knee.position.set(0, -0.40, 0);
    hip.add(knee);

    const shinMesh = new THREE.Mesh(A.shinGeo, A.pantsMat);
    shinMesh.position.set(0, -0.19, 0);
    shinMesh.castShadow = true;
    knee.add(shinMesh);

    const pantCuff = new THREE.Mesh(A.pantCuffGeo, A.pantsMat);
    pantCuff.position.set(0, -0.36, 0);
    knee.add(pantCuff);

    const ankle = new THREE.Group();
    ankle.position.set(0, -0.41, 0);
    knee.add(ankle);

    // Krossovka (tag qismi y = -0.09 da joylashadi, shunda 0.92 - 0.02 - 0.40 - 0.41 - 0.09 = 0.00 m — aniq yerda!)
    const shoeSole = new THREE.Mesh(A.shoeSoleGeo, A.shoeWhiteMat);
    shoeSole.position.set(0, -0.073, 0.038);
    const shoeUpper = new THREE.Mesh(A.shoeUpperGeo, A.shoeBlackMat);
    shoeUpper.position.set(0, -0.028, 0.026);
    const shoeToe = new THREE.Mesh(A.shoeToeGeo, A.shoeWhiteMat);
    shoeToe.position.set(0, -0.042, 0.13);
    const shoeCollar = new THREE.Mesh(A.shoeCollarGeo, A.shoeWhiteMat);
    shoeCollar.position.set(0, 0.01, -0.015);
    const shoeStripe = new THREE.Mesh(A.shoeStripeGeo, A.shoeWhiteMat);
    shoeStripe.position.set(0, -0.028, 0.03);
    shoeStripe.rotation.x = -0.22;
    ankle.add(shoeSole, shoeUpper, shoeToe, shoeCollar, shoeStripe);

    return { hip, knee, ankle };
  }

  const legL = buildLeg('L');
  const legR = buildLeg('R');

  // Personaj ostidagi zamonaviy neon halqa (tungi yoritishda aniq ko'rinishi uchun)
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.30, 0.40, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.48,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  ring.position.y = 0.015;
  group.add(ring);

  // =========================================================
  // 7 ANIMATSIYA HOLATI VA SILLIQ INTERPOLYATSIYA (CROSS-FADE)
  // Holatlar: 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'enterCar' | 'exitCar' | 'wave' | 'dance'
  // =========================================================
  let phase = Math.random() * Math.PI * 2;
  let curState = 'idle';

  return {
    group,
    ring,
    setColor(c) {
      if (c) accentMat.color.set(c);
      if (c) accentMat.emissive.set(c);
    },
    animate(dt, speed = 0, stateOrEmote = 'idle', stateProgress = 0) {
      const absV = Math.abs(speed);
      let anim = stateOrEmote || 'idle';
      if (anim === '' || anim === 'none') {
        anim = absV > 6.8 ? 'run' : absV > 0.2 ? 'walk' : 'idle';
      }
      curState = anim;

      const blend = Math.min(1, dt * 14);

      // Maqsadli bo'g'im burchaklari
      let hipsY = 0.92, hipsZ = 0, hipsRotX = 0, hipsRotY = 0, hipsRotZ = 0;
      let spineRotX = 0, spineRotY = 0, spineRotZ = 0;
      let chestRotX = 0, chestRotY = 0;
      let headRotX = 0, headRotY = 0, headRotZ = 0;

      let shLX = 0, shLZ = 0.06, elLX = -0.18, wrLX = 0;
      let shRX = 0, shRZ = -0.06, elRX = -0.18, wrRX = 0;

      let hipLX = 0, hipLZ = 0, knLX = 0.04, ankLX = 0;
      let hipRX = 0, hipRZ = 0, knRX = 0.04, ankRX = 0;

      if (anim === 'walk' || (anim === 'idle' && absV > 0.2 && absV <= 6.8)) {
        // 1. WALK — Tabiiy qadam tashlash (oyoq sirpanmasligi uchun faza tezlikka bog'langan)
        const walkRate = Math.max(5.5, Math.min(11.0, absV * 1.65));
        phase += dt * walkRate;
        const s = Math.sin(phase);
        const c = Math.cos(phase);

        const stride = Math.min(0.62, 0.28 + absV * 0.055);
        hipLX = -s * stride;
        hipRX = s * stride;

        // Tizza faqat oyoq orqadan oldinga o'tayotganda bukiladi
        knLX = Math.max(0.05, c * 0.58 + 0.22);
        knRX = Math.max(0.05, -c * 0.58 + 0.22);

        ankLX = -hipLX * 0.35 - knLX * 0.25;
        ankRX = -hipRX * 0.35 - knRX * 0.25;

        // Qo'llar oyoqlarga qarama-qarshi silliq tebranadi
        shLX = s * stride * 0.78;
        shRX = -s * stride * 0.78;
        elLX = -0.28 - Math.max(0, -s) * 0.32;
        elRX = -0.28 - Math.max(0, s) * 0.32;

        // Tos va ko'krakning tabiiy qarama-qarshi buralishi
        hipsRotY = s * 0.08;
        hipsRotZ = c * 0.035;
        spineRotY = -s * 0.06;
        chestRotY = -s * 0.07;
        spineRotX = 0.04;
        headRotY = s * 0.04;

        // Eng past oyoq yerga tegib turishi uchun vertikal balans (yerga botmaslik!)
        const bounce = Math.abs(s) * 0.032;
        hipsY = 0.915 + bounce;
      } else if (anim === 'run' || (anim === 'idle' && absV > 6.8)) {
        // 2. RUN — Dinamik yugurish
        const runRate = Math.max(10.5, Math.min(16.5, absV * 1.55));
        phase += dt * runRate;
        const s = Math.sin(phase);
        const c = Math.cos(phase);

        const stride = 0.92;
        hipLX = -s * stride;
        hipRX = s * stride;

        knLX = Math.max(0.12, c * 0.95 + 0.45);
        knRX = Math.max(0.12, -c * 0.95 + 0.45);

        ankLX = -hipLX * 0.3 - 0.1;
        ankRX = -hipRX * 0.3 - 0.1;

        // Yugurganda tirsaklar ~85° bukilgan
        shLX = s * 0.95 + 0.1;
        shRX = -s * 0.95 + 0.1;
        elLX = -1.15 - Math.max(0, -s) * 0.35;
        elRX = -1.15 - Math.max(0, s) * 0.35;

        // Gavda oldinga biroz egiladi
        hipsRotX = 0.12;
        spineRotX = 0.10;
        chestRotX = 0.08;
        headRotX = -0.18;

        hipsRotY = s * 0.14;
        chestRotY = -s * 0.16;

        hipsY = 0.89 + Math.abs(c) * 0.055;
      } else if (anim === 'jump') {
        // 3. JUMP — Sakrash
        phase += dt * 6;
        hipsY = 0.94;
        hipsRotX = 0.08;
        spineRotX = -0.06;

        hipLX = -0.58;
        knLX = 0.88;
        ankLX = -0.25;

        hipRX = -0.35;
        knRX = 0.65;
        ankRX = -0.2;

        shLX = -0.85;
        shLZ = 0.28;
        elLX = -0.65;

        shRX = -0.85;
        shRZ = -0.28;
        elRX = -0.65;
        headRotX = -0.12;
      } else if (anim === 'fall') {
        // 4. FALL — Havodan tushish
        phase += dt * 10;
        const flail = Math.sin(phase) * 0.12;
        hipsY = 0.92;
        hipsRotX = 0.05;

        hipLX = -0.28 + flail;
        knLX = 0.48;
        hipRX = -0.18 - flail;
        knRX = 0.38;

        shLX = -0.45 + flail;
        shLZ = 0.42;
        elLX = -0.5;

        shRX = -0.45 - flail;
        shRZ = -0.42;
        elRX = -0.5;
        headRotX = 0.15;
      } else if (anim === 'enterCar') {
        // 5. ENTER CAR — Eshikni ochib mashina ichiga kirish va o'tirish (0..1)
        const p = THREE.MathUtils.clamp(stateProgress, 0, 1);
        if (p < 0.38) {
          // Chap qo'l bilan mashina eshigini tortib ochish
          const k = p / 0.38;
          shLX = -0.95 * k;
          elLX = -0.55 * k;
          spineRotY = -0.25 * k;
          headRotY = 0.2 * k;
        } else {
          // Mashina saloniga qadam qo'yib egilib o'tirish
          const k = (p - 0.38) / 0.62;
          hipsY = lerp(0.92, 0.56, k);
          hipsZ = lerp(0, 0.18, k);
          hipsRotX = lerp(0, 0.25, k);
          spineRotX = lerp(0, 0.32, k);
          headRotX = lerp(0, 0.22, k);

          hipLX = lerp(0, -1.15, k);
          knLX = lerp(0.05, 1.25, k);
          hipRX = lerp(0, -0.95, k);
          knRX = lerp(0.05, 1.15, k);

          shLX = lerp(-0.95, -0.55, k);
          elLX = lerp(-0.55, -0.65, k);
          shRX = lerp(0, -0.55, k);
          elRX = lerp(-0.18, -0.65, k);
        }
      } else if (anim === 'exitCar') {
        // 6. EXIT CAR — Mashina salonidan tashqariga chiqib tik turish (0..1)
        const p = THREE.MathUtils.clamp(stateProgress, 0, 1);
        const k = 1 - p; // 1 dan 0 ga (o'tirgan holatdan tik turishga)
        hipsY = lerp(0.92, 0.60, k);
        hipsRotX = lerp(0, 0.22, k);
        spineRotX = lerp(0, 0.28, k);
        headRotX = lerp(0, 0.18, k);

        hipLX = lerp(0, -1.05, k);
        knLX = lerp(0.05, 1.15, k);
        hipRX = lerp(0, -0.85, k);
        knRX = lerp(0.05, 1.05, k);

        shLX = lerp(0, -0.65, k);
        elLX = lerp(-0.18, -0.6, k);
        shRX = lerp(0, -0.45, k);
        elRX = lerp(-0.18, -0.5, k);
      } else if (anim === 'wave') {
        // Salomlashish
        phase += dt * 9;
        hipsY = 0.92 + Math.sin(phase * 0.4) * 0.008;
        shRX = -2.45;
        shRZ = -0.35 + Math.sin(phase) * 0.35;
        elRX = -0.45 + Math.cos(phase) * 0.25;
        headRotZ = -0.06;
      } else if (anim === 'dance') {
        // Raqs
        phase += dt * 8.5;
        const s = Math.sin(phase);
        const c = Math.cos(phase * 2);
        hipsY = 0.88 + Math.abs(c) * 0.05;
        hipsRotY = s * 0.28;
        hipsRotZ = s * 0.08;
        spineRotZ = -s * 0.1;
        chestRotY = -s * 0.22;
        shLX = -1.6 + s * 0.55;
        shLZ = 0.35;
        elLX = -0.85;
        shRX = -1.6 - s * 0.55;
        shRZ = -0.35;
        elRX = -0.85;
        hipLX = Math.max(0, s) * 0.45;
        knLX = Math.max(0.08, s * 0.65);
        hipRX = Math.max(0, -s) * 0.45;
        knRX = Math.max(0.08, -s * 0.65);
      } else {
        // 7. IDLE — Tinch turganda tabiiy nafas olish va vazn almashishi
        phase += dt * 2.2;
        const breath = Math.sin(phase);
        const sway = Math.cos(phase * 0.5);

        hipsY = 0.92 + breath * 0.006;
        hipsRotY = sway * 0.035;
        hipsRotZ = sway * 0.015;

        spineRotX = 0.015 + breath * 0.012;
        chestRotX = -0.01 + breath * 0.015;
        chestRotY = -sway * 0.03;

        headRotY = sway * 0.05;
        headRotX = breath * 0.015;

        shLX = breath * 0.025;
        shLZ = 0.065 + Math.max(0, breath) * 0.015;
        elLX = -0.20;

        shRX = -breath * 0.025;
        shRZ = -0.065 - Math.max(0, breath) * 0.015;
        elRX = -0.20;

        hipLX = -0.02;
        knLX = 0.04;
        hipRX = 0.02;
        knRX = 0.04;
      }

      // Bo'g'imlarni silliq interpolyatsiya qilish (robotdek sakrab o'tmasligi uchun)
      hips.position.y = lerp(hips.position.y, hipsY, blend);
      hips.position.z = lerp(hips.position.z, hipsZ, blend);
      hips.rotation.x = lerp(hips.rotation.x, hipsRotX, blend);
      hips.rotation.y = lerp(hips.rotation.y, hipsRotY, blend);
      hips.rotation.z = lerp(hips.rotation.z, hipsRotZ, blend);

      spine.rotation.x = lerp(spine.rotation.x, spineRotX, blend);
      spine.rotation.y = lerp(spine.rotation.y, spineRotY, blend);
      spine.rotation.z = lerp(spine.rotation.z, spineRotZ, blend);

      chest.rotation.x = lerp(chest.rotation.x, chestRotX, blend);
      chest.rotation.y = lerp(chest.rotation.y, chestRotY, blend);

      head.rotation.x = lerp(head.rotation.x, headRotX, blend);
      head.rotation.y = lerp(head.rotation.y, headRotY, blend);
      head.rotation.z = lerp(head.rotation.z, headRotZ, blend);

      armL.shoulder.rotation.x = lerp(armL.shoulder.rotation.x, shLX, blend);
      armL.shoulder.rotation.z = lerp(armL.shoulder.rotation.z, shLZ, blend);
      armL.elbow.rotation.x = lerp(armL.elbow.rotation.x, elLX, blend);
      armL.wrist.rotation.x = lerp(armL.wrist.rotation.x, wrLX, blend);

      armR.shoulder.rotation.x = lerp(armR.shoulder.rotation.x, shRX, blend);
      armR.shoulder.rotation.z = lerp(armR.shoulder.rotation.z, shRZ, blend);
      armR.elbow.rotation.x = lerp(armR.elbow.rotation.x, elRX, blend);
      armR.wrist.rotation.x = lerp(armR.wrist.rotation.x, wrRX, blend);

      legL.hip.rotation.x = lerp(legL.hip.rotation.x, hipLX, blend);
      legL.hip.rotation.z = lerp(legL.hip.rotation.z, hipLZ, blend);
      legL.knee.rotation.x = lerp(legL.knee.rotation.x, knLX, blend);
      legL.ankle.rotation.x = lerp(legL.ankle.rotation.x, ankLX, blend);

      legR.hip.rotation.x = lerp(legR.hip.rotation.x, hipRX, blend);
      legR.hip.rotation.z = lerp(legR.hip.rotation.z, hipRZ, blend);
      legR.knee.rotation.x = lerp(legR.knee.rotation.x, knRX, blend);
      legR.ankle.rotation.x = lerp(legR.ankle.rotation.x, ankRX, blend);

      // Oyoq tagi hech qachon yerga (y = 0) botib ketmasligini kafolatlash
      if (anim !== 'enterCar' && anim !== 'exitCar') {
        const reachL = 0.40 * Math.cos(legL.hip.rotation.x) + 0.41 * Math.cos(legL.hip.rotation.x + legL.knee.rotation.x) + 0.11;
        const reachR = 0.40 * Math.cos(legR.hip.rotation.x) + 0.41 * Math.cos(legR.hip.rotation.x + legR.knee.rotation.x) + 0.11;
        const maxReach = Math.max(reachL, reachR);
        if (hips.position.y < maxReach) {
          hips.position.y = maxReach;
        }
      }
    },
    getAnimState() {
      return curState;
    },
  };
}

export class PlayerCharacter {
  constructor(scene, color = '#00e5ff') {
    this.scene = scene;
    this.model = buildCharacterModel(color);
    this.model.group.visible = false;
    scene.add(this.model.group);
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.vy = 0;
    this.heading = 0;
    this.v = 0;
    this.animState = 'idle'; // 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'enterCar' | 'exitCar'
    this.emote = '';
    this.emoteTimer = 0;
    this.active = false;
    this. grounded = true;
    this.transition = null; // { type: 'enterCar' | 'exitCar', timer, duration, doorX, doorZ, carX, carZ, carH, onDone }
  }

  spawnAt(x, z, heading, groundY = 0) {
    this.x = x;
    this.z = z;
    this.y = groundY;
    this.vy = 0;
    this.heading = heading;
    this.v = 0;
    this.grounded = true;
    this.animState = 'idle';
    this.transition = null;
    this.active = true;
    this.model.group.visible = true;
    this.model.group.scale.set(1, 1, 1);
    this.model.group.position.set(this.x, this.y, this.z);
    this.model.group.rotation.set(0, this.heading, 0);
  }

  // Mashinadan tushganda eshik yonida ExitCar animatsiyasi bilan chiqish
  startExitCar(doorX, doorZ, carHeading, groundY = 0, onDone = null) {
    this.spawnAt(doorX, doorZ, carHeading, groundY);
    this.animState = 'exitCar';
    this.transition = {
      type: 'exitCar',
      timer: 0,
      duration: 0.62,
      startX: doorX + Math.cos(carHeading) * 0.45,
      startZ: doorZ - Math.sin(carHeading) * 0.45,
      endX: doorX,
      endZ: doorZ,
      heading: carHeading,
      onDone,
    };
  }

  // Mashinaga kirishda eshik oldiga yurib borib EnterCar animatsiyasini bajarish
  startEnterCar(doorX, doorZ, carX, carZ, carHeading, onDone = null) {
    if (!this.active) {
      onDone?.();
      return;
    }
    this.emote = '';
    this.animState = 'enterCar';
    this.transition = {
      type: 'enterCar',
      phase: 'walkToDoor',
      timer: 0,
      duration: 0.78,
      doorX,
      doorZ,
      carX,
      carZ,
      carHeading,
      onDone,
    };
  }

  setColor(c) {
    this.model.setColor(c);
  }

  hide() {
    this.active = false;
    this.v = 0;
    this.vy = 0;
    this.emote = '';
    this.animState = 'idle';
    this.transition = null;
    this.model.group.visible = false;
    this.model.group.scale.set(1, 1, 1);
  }

  triggerEmote(type = 'wave') {
    if (this.transition) return;
    this.emote = type;
    this.emoteTimer = 4.0;
  }

  step(dt, input, groundY = 0, camYaw = 0) {
    if (!this.active) return;

    // 1. Agar mashinaga kirish yoki tushish animatsiyasi ketayotgan bo'lsa
    if (this.transition) {
      const tr = this.transition;
      if (tr.type === 'enterCar') {
        if (tr.phase === 'walkToDoor') {
          const dx = tr.doorX - this.x;
          const dz = tr.doorZ - this.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 0.35 && tr.timer < 1.3) {
            tr.timer += dt;
            const targetH = Math.atan2(dx, dz);
            const dh = Math.atan2(Math.sin(targetH - this.heading), Math.cos(targetH - this.heading));
            this.heading += dh * Math.min(1, dt * 14);
            const walkSpd = Math.min(6.5, Math.max(3.8, dist * 3.2));
            this.v = walkSpd;
            this.x += (dx / dist) * Math.min(dist, walkSpd * dt);
            this.z += (dz / dist) * Math.min(dist, walkSpd * dt);
            this.y = groundY;
            this.animState = walkSpd > 6 ? 'run' : 'walk';
            this.model.group.position.set(this.x, this.y, this.z);
            this.model.group.rotation.set(0, this.heading, 0);
            this.model.animate(dt, this.v, this.animState);
            return;
          }
          // Eshik oldiga yetib keldi -> endi eshikni ochib ichkariga o'tirish
          tr.phase = 'entering';
          tr.timer = 0;
          tr.startX = this.x;
          tr.startZ = this.z;
        }

        tr.timer += dt;
        const p = Math.min(1, tr.timer / tr.duration);
        this.animState = 'enterCar';
        this.v = 0;
        const dh = Math.atan2(Math.sin(tr.carHeading - this.heading), Math.cos(tr.carHeading - this.heading));
        this.heading += dh * Math.min(1, dt * 12);

        // Eshikdan salon ichiga siljish
        const inCarX = lerp(tr.startX, tr.carX, Math.pow(p, 1.4) * 0.65);
        const inCarZ = lerp(tr.startZ, tr.carZ, Math.pow(p, 1.4) * 0.65);
        this.x = inCarX;
        this.z = inCarZ;
        this.y = groundY;

        this.model.group.position.set(this.x, this.y, this.z);
        this.model.group.rotation.set(0, this.heading, 0);
        this.model.animate(dt, 0, 'enterCar', p);

        if (p >= 1) {
          const cb = tr.onDone;
          this.transition = null;
          this.hide();
          cb?.();
        }
        return;
      }

      if (tr.type === 'exitCar') {
        tr.timer += dt;
        const p = Math.min(1, tr.timer / tr.duration);
        this.animState = 'exitCar';
        this.v = 0;
        this.x = lerp(tr.startX, tr.endX, p);
        this.z = lerp(tr.startZ, tr.endZ, p);
        this.y = groundY;
        this.heading = tr.heading;
        this.model.group.position.set(this.x, this.y, this.z);
        this.model.group.rotation.set(0, this.heading, 0);
        this.model.animate(dt, 0, 'exitCar', p);
        if (p >= 1) {
          const cb = tr.onDone;
          this.transition = null;
          this.animState = 'idle';
          cb?.();
        }
        return;
      }
    }

    // 2. Oddiy yurish, yugurish va sakrash (WASD + Shift + Space)
    const turnRate = 3.4;
    if (Math.abs(input.steer) > 0.02) {
      this.heading += input.steer * turnRate * dt;
    }

    const isRunning = !!input.boost;
    const maxSpd = isRunning ? 9.4 : 5.2; // Yugurish 9.4 m/s, yurish 5.2 m/s
    const moveDir = input.throttle - input.reverse * 0.65;
    const targetV = moveDir * maxSpd;
    this.v += (targetV - this.v) * Math.min(1, dt * 11);

    // Space (input.handbrake) bosilganda sakrash (Jump)
    if (input.handbrake && this.grounded) {
      this.vy = 6.2;
      this.grounded = false;
      this.emote = '';
      this.emoteTimer = 0;
    }

    if (Math.abs(this.v) > 0.18 || !this.grounded) {
      this.emote = '';
      this.emoteTimer = 0;
    } else if (this.emoteTimer > 0) {
      this.emoteTimer -= dt;
      if (this.emoteTimer <= 0) this.emote = '';
    }

    const nx = this.x + Math.sin(this.heading) * this.v * dt;
    const nz = this.z + Math.cos(this.heading) * this.v * dt;

    // Binolar va to'siqlar bilan to'qnashuvni tekshirish
    const r = 0.42;
    let blocked = false;
    for (const b of queryColliders(nx, nz, r + 1.5)) {
      if (nx + r > b.minX && nx - r < b.maxX && nz + r > b.minZ && nz - r < b.maxZ) {
        blocked = true;
        break;
      }
    }
    if (!blocked) {
      this.x = Math.max(-HALF + 5, Math.min(HALF - 5, nx));
      this.z = Math.max(-HALF + 5, Math.min(HALF - 5, nz));
    } else {
      this.v = 0;
    }

    // Vertikal fizika (Jump & Fall va yerga botmaslik)
    if (!this.grounded || this.y > groundY + 0.02) {
      this.vy -= 16.8 * dt; // Gravitatsiya
      this.y += this.vy * dt;
      if (this.y <= groundY) {
        this.y = groundY;
        this.vy = 0;
        this.grounded = true;
      }
    } else {
      this.y = groundY;
      this.vy = 0;
      this.grounded = true;
    }

    // Joriy animatsiya holatini aniqlash
    if (!this.grounded) {
      this.animState = this.vy > 0.35 ? 'jump' : 'fall';
    } else if (this.emote) {
      this.animState = this.emote;
    } else if (Math.abs(this.v) > 6.6) {
      this.animState = 'run';
    } else if (Math.abs(this.v) > 0.2) {
      this.animState = 'walk';
    } else {
      this.animState = 'idle';
    }

    this.model.group.position.set(this.x, this.y, this.z);
    this.model.group.rotation.set(0, this.heading, 0);
    this.model.animate(dt, this.v, this.animState);
  }
}
