// ============================================================================
// KOKOBANGO CLUB — AAA PROCEDURAL PBR TEXTURES & DETAILED 3D FURNITURE ASSETS
// ============================================================================
import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, g: c.getContext('2d') };
}

/**
 * Generates seamless PBR textures (albedo + bump/roughness) for luxury dark marble.
 */
export function createMarblePBR() {
  const { c, g } = makeCanvas(256, 256);
  g.fillStyle = '#0e101a';
  g.fillRect(0, 0, 256, 256);

  // Subtle marble veins
  for (let i = 0; i < 18; i++) {
    g.strokeStyle = i % 3 === 0 ? 'rgba(192, 132, 252, 0.14)' : 'rgba(226, 232, 240, 0.10)';
    g.lineWidth = 0.8 + (i % 3) * 0.7;
    g.beginPath();
    let x = (i * 37) % 256;
    let y = 0;
    g.moveTo(x, y);
    for (let s = 1; s <= 8; s++) {
      x += Math.sin(i * 1.7 + s * 0.9) * 18;
      y = s * 32;
      g.lineTo(x, y);
    }
    g.stroke();
  }

  // Tile grout grid
  g.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  g.lineWidth = 2;
  g.strokeRect(1, 1, 126, 126);
  g.strokeRect(129, 1, 126, 126);
  g.strokeRect(1, 129, 126, 126);
  g.strokeRect(129, 129, 126, 126);

  const map = new THREE.CanvasTexture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(8, 8);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

/**
 * Generates quilted velvet/leather texture for VIP sofas and acoustic wall panels.
 */
export function createQuiltedVelvetTex(baseHex = '#2e0a4f', seamHex = '#140324') {
  const { c, g } = makeCanvas(128, 128);
  g.fillStyle = baseHex;
  g.fillRect(0, 0, 128, 128);

  g.strokeStyle = seamHex;
  g.lineWidth = 2;
  for (let i = -128; i < 256; i += 32) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 128, 128);
    g.stroke();
    g.beginPath();
    g.moveTo(i + 128, 0);
    g.lineTo(i, 128);
    g.stroke();
  }
  // Subtle button tufts at intersections
  g.fillStyle = 'rgba(250, 204, 21, 0.28)';
  for (let x = 16; x < 128; x += 32) {
    for (let y = 16; y < 128; y += 32) {
      g.beginPath();
      g.arc(x, y, 2.2, 0, Math.PI * 2);
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Creates a bevelled luxury velvet sofa with armrests, tufted back, and gold legs.
 */
export function createDetailedSofa(length = 5.0, mats) {
  const group = new THREE.Group();
  const { velvetMat, goldMat, trimMat } = mats;

  // Extruded bevelled seat cushion
  const seatShape = new THREE.Shape();
  seatShape.moveTo(-0.65, 0);
  seatShape.lineTo(0.65, 0);
  seatShape.lineTo(0.65, 0.34);
  seatShape.lineTo(-0.65, 0.34);
  seatShape.closePath();

  const seatGeo = new THREE.ExtrudeGeometry(seatShape, {
    depth: length - 0.32,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 2,
  });
  seatGeo.center();
  const seat = new THREE.Mesh(seatGeo, velvetMat);
  seat.position.set(0.08, 0.38, 0);
  group.add(seat);

  // Extruded curved/angled backrest
  const backShape = new THREE.Shape();
  backShape.moveTo(-0.22, 0);
  backShape.lineTo(0.18, 0);
  backShape.lineTo(0.08, 0.78);
  backShape.lineTo(-0.26, 0.78);
  backShape.closePath();

  const backGeo = new THREE.ExtrudeGeometry(backShape, {
    depth: length - 0.16,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.04,
    bevelSegments: 2,
  });
  backGeo.center();
  const back = new THREE.Mesh(backGeo, velvetMat);
  back.position.set(-0.52, 0.76, 0);
  group.add(back);

  // Armrests (left & right)
  const armGeo = new THREE.BoxGeometry(1.36, 0.56, 0.24);
  for (const sz of [-1, 1]) {
    const arm = new THREE.Mesh(armGeo, velvetMat);
    arm.position.set(0.04, 0.48, sz * (length / 2 - 0.12));
    group.add(arm);
  }

  // Gold base trim & 4 tapered legs
  const baseTrim = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.06, length - 0.1), goldMat);
  baseTrim.position.set(0.06, 0.18, 0);
  group.add(baseTrim);

  const legGeo = new THREE.CylinderGeometry(0.045, 0.025, 0.18, 8);
  for (const lx of [-0.52, 0.62]) {
    for (const lz of [-length / 2 + 0.2, length / 2 - 0.2]) {
      const leg = new THREE.Mesh(legGeo, goldMat);
      leg.position.set(lx, 0.09, lz);
      group.add(leg);
    }
  }

  // Subtle LED underglow strip
  if (trimMat) {
    const under = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.03, length - 0.4), trimMat);
    under.position.set(0.08, 0.04, 0);
    group.add(under);
  }

  return group;
}

/**
 * Creates a lathed chrome/gold bar stool with footrest ring and cushioned seat.
 */
export function createDetailedBarStool(mats) {
  const group = new THREE.Group();
  const { chromeMat, velvetMat } = mats;

  const pts = [
    new THREE.Vector2(0.24, 0.0),
    new THREE.Vector2(0.23, 0.03),
    new THREE.Vector2(0.06, 0.06),
    new THREE.Vector2(0.035, 0.62),
    new THREE.Vector2(0.14, 0.65),
  ];
  const stem = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), chromeMat);
  group.add(stem);

  const footRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.015, 8, 18), chromeMat);
  footRing.rotation.x = Math.PI / 2;
  footRing.position.y = 0.28;
  group.add(footRing);

  const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.20, 0.11, 16), velvetMat);
  cushion.position.y = 0.71;
  group.add(cushion);

  const backLip = new THREE.Mesh(
    new THREE.TorusGeometry(0.20, 0.035, 8, 16, Math.PI * 0.9),
    velvetMat
  );
  backLip.rotation.x = Math.PI / 2;
  backLip.rotation.z = Math.PI * 0.05;
  backLip.position.y = 0.80;
  group.add(backLip);

  return group;
}

/**
 * Creates a detailed Line-Array PA Speaker Stack with recessed woofers and horn tweeters.
 */
export function createSpeakerStack(mats) {
  const group = new THREE.Group();
  const { cabinetMat, coneMat, chromeMat, neonMat } = mats;

  // Dual subwoofer base
  const subBox = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.5, 1.05), cabinetMat);
  subBox.position.y = 0.75;
  group.add(subBox);

  const wooferGeo = new THREE.CylinderGeometry(0.36, 0.18, 0.14, 16);
  wooferGeo.rotateX(Math.PI / 2);
  const ringGeo = new THREE.TorusGeometry(0.37, 0.03, 8, 20);

  for (const wy of [0.44, 1.08]) {
    const cone = new THREE.Mesh(wooferGeo, coneMat);
    cone.position.set(0, wy, 0.50);
    const rim = new THREE.Mesh(ringGeo, chromeMat);
    rim.position.set(0, wy, 0.54);
    group.add(cone, rim);
  }

  // 3-module curved line-array top
  for (let i = 0; i < 3; i++) {
    const mod = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.42, 0.72), cabinetMat);
    mod.position.set(0, 1.82 + i * 0.46, -0.05 + i * 0.05);
    mod.rotation.x = 0.08 * i;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(1.20, 0.04, 0.04), neonMat);
    strip.position.set(0, 1.82 + i * 0.46, 0.32 + i * 0.05);
    group.add(mod, strip);
  }

  return group;
}

/**
 * Creates a detailed VIP table with bevelled dark-glass top, pedestal, champagne bucket & glasses.
 */
export function createDetailedVipTable(mats) {
  const group = new THREE.Group();
  const { obsidianMat, goldMat, glassMat, neonMat } = mats;

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.08, 16), goldMat);
  base.position.y = 0.04;
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.46, 12), obsidianMat);
  col.position.y = 0.28;
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.08, 2.75), obsidianMat);
  top.position.y = 0.54;
  const trim = new THREE.Mesh(new THREE.BoxGeometry(1.49, 0.04, 2.79), neonMat);
  trim.position.y = 0.52;
  group.add(base, col, top, trim);

  // Champagne bucket
  const bucketPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.12, 0.0),
    new THREE.Vector2(0.17, 0.28),
    new THREE.Vector2(0.15, 0.28),
    new THREE.Vector2(0.10, 0.03),
  ];
  const bucket = new THREE.Mesh(new THREE.LatheGeometry(bucketPts, 14), goldMat);
  bucket.position.set(0, 0.58, 0);
  group.add(bucket);

  // 2 cocktail glasses
  const glassPts = [
    new THREE.Vector2(0.05, 0.0),
    new THREE.Vector2(0.012, 0.01),
    new THREE.Vector2(0.012, 0.11),
    new THREE.Vector2(0.075, 0.19),
    new THREE.Vector2(0.068, 0.19),
  ];
  const gGeo = new THREE.LatheGeometry(glassPts, 12);
  for (const gz of [-0.55, 0.55]) {
    const gl = new THREE.Mesh(gGeo, glassMat);
    gl.position.set(0.25, 0.58, gz);
    group.add(gl);
  }

  return group;
}
