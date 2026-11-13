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

/**
 * Architectural dark basalt/travertine stone PBR texture for club facade & columns
 */
export function createArchitecturalStonePBR() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#141720';
  ctx.fillRect(0, 0, size, size);

  // Subtle horizontal stone ashlar courses
  for (let row = 0; row < 8; row++) {
    const y = row * 32;
    const shade = 16 + ((row * 7) % 10);
    ctx.fillStyle = `rgb(${shade}, ${shade + 3}, ${shade + 11})`;
    ctx.fillRect(0, y + 1, size, 30);
    ctx.fillStyle = '#090b10';
    ctx.fillRect(0, y, size, 1.5);
    const offset = (row % 2) * 64;
    for (let x = offset; x < size; x += 128) {
      ctx.fillRect(x, y, 1.5, 32);
    }
  }
  // Fine mineral grain
  for (let i = 0; i < 1600; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const v = 18 + Math.floor(Math.random() * 24);
    ctx.fillStyle = `rgba(${v},${v + 2},${v + 8},0.22)`;
    ctx.fillRect(x, y, 2, 1.5);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Wet-look dark granite entrance plaza texture
 */
export function createWetPlazaPBR() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#0f1119';
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 32) {
    for (let x = 0; x < size; x += 32) {
      const tone = 14 + (((x + y) * 3) % 9);
      ctx.fillStyle = `rgb(${tone}, ${tone + 2}, ${tone + 8})`;
      ctx.fillRect(x + 1, y + 1, 30, 30);
    }
  }
  // Wet sheen patches
  for (let i = 0; i < 18; i++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    const r = 16 + Math.random() * 28;
    const g = ctx.createRadialGradient(px, py, 2, px, py, r);
    g.addColorStop(0, 'rgba(148, 163, 184, 0.14)');
    g.addColorStop(1, 'rgba(148, 163, 184, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 5);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * VIP & General queue stanchions + draped velvet ropes + VIP host check-in podium
 */
export function createQueueBarriers({ goldMat, velvetMat, obsidianMat }) {
  const group = new THREE.Group();
  const baseGeo = new THREE.CylinderGeometry(0.18, 0.21, 0.06, 12);
  const postGeo = new THREE.CylinderGeometry(0.035, 0.04, 0.96, 10);
  const finialGeo = new THREE.SphereGeometry(0.06, 10, 8);

  const addStanchion = (x, z) => {
    const base = new THREE.Mesh(baseGeo, goldMat);
    base.position.set(x, 0.03, z);
    const post = new THREE.Mesh(postGeo, goldMat);
    post.position.set(x, 0.51, z);
    const finial = new THREE.Mesh(finialGeo, goldMat);
    finial.position.set(x, 1.01, z);
    group.add(base, post, finial);
  };

  const addDrapedRope = (x1, z1, x2, z2) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x1, 0.88, z1),
      new THREE.Vector3((x1 + x2) * 0.5, 0.72, (z1 + z2) * 0.5),
      new THREE.Vector3(x2, 0.88, z2),
    ]);
    const rope = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.028, 6, false), velvetMat);
    group.add(rope);
  };

  // Left & Right VIP Fast-Track & Main Entrance Queue lanes
  for (const sx of [-1, 1]) {
    const xOuter = sx * 4.4;
    const xInner = sx * 2.5;
    const zStops = [0, -2.6, -5.2, -7.8];
    for (let i = 0; i < zStops.length; i++) {
      addStanchion(xOuter, zStops[i]);
      addStanchion(xInner, zStops[i]);
      if (i > 0) {
        addDrapedRope(xOuter, zStops[i - 1], xOuter, zStops[i]);
        addDrapedRope(xInner, zStops[i - 1], xInner, zStops[i]);
      }
    }
  }

  // VIP Host Check-in Podium (east side of entrance)
  const podium = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.12, 0.65), obsidianMat);
  podium.position.set(5.4, 0.56, -2.2);
  const podiumTop = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.06, 0.72), goldMat);
  podiumTop.position.set(5.4, 1.15, -2.2);
  group.add(podium, podiumTop);

  return group;
}

/**
 * Outdoor terrace seating, low illuminated tables, planters, and warm bollard lamps
 */
export function createOutdoorLounge({ obsidianMat, goldMat, velvetMat, leafMat, warmMat }) {
  const group = new THREE.Group();

  for (const sx of [-1, 1]) {
    const lx = sx * 16.5;
    // Outdoor low sofa facing entrance plaza
    const sofa = createDetailedSofa({ leatherMat: obsidianMat, velvetMat, goldMat }, 3.4, 1.05);
    sofa.position.set(lx, 0, -4.5);
    sofa.rotation.y = sx > 0 ? -Math.PI * 0.28 : Math.PI * 0.28;
    group.add(sofa);

    // Sleek low cocktail table with warm glowing top trim
    const tblBase = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.36, 12), goldMat);
    tblBase.position.set(lx - sx * 1.4, 0.18, -5.6);
    const tblTop = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.06, 16), obsidianMat);
    tblTop.position.set(lx - sx * 1.4, 0.39, -5.6);
    const tblGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 12), warmMat);
    tblGlow.position.set(lx - sx * 1.4, 0.51, -5.6);
    group.add(tblBase, tblTop, tblGlow);

    // Architectural planter + ornamental multi-tier foliage
    const px = sx * 22.0;
    const pot = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.75, 2.2), obsidianMat);
    pot.position.set(px, 0.375, -1.5);
    const potRim = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.06, 2.3), goldMat);
    potRim.position.set(px, 0.76, -1.5);
    const bush1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 1), leafMat);
    bush1.position.set(px, 1.45, -1.5);
    const bush2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.65, 1), leafMat);
    bush2.position.set(px + sx * 0.4, 2.05, -1.3);
    group.add(pot, potRim, bush1, bush2);

    // Warm architectural bollard lights along terrace edge
    for (let b = 0; b < 3; b++) {
      const bx = sx * (12.0 + b * 4.5);
      const bollard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.85, 0.18), obsidianMat);
      bollard.position.set(bx, 0.425, -8.5);
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.2), warmMat);
      lens.position.set(bx, 0.76, -8.5);
      group.add(bollard, lens);
    }
  }

  return group;
}

/**
 * Backlit multi-tier bar display with instanced glassware & under-counter LED strip
 */
export function createBarBacklitDisplay({ obsidianMat, glassMat, goldMat, warmMat }) {
  const group = new THREE.Group();

  // Backlit frosted light panel behind bottle shelves
  const backLight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.6, 13.4), warmMat);
  backLight.position.set(-0.42, 2.35, 0);
  group.add(backLight);

  // 3 illuminated glass shelves
  for (let tier = 0; tier < 3; tier++) {
    const sy = 1.38 + tier * 0.95;
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.05, 13.4), glassMat);
    shelf.position.set(-0.08, sy, 0);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 13.4), goldMat);
    trim.position.set(0.25, sy, 0);
    group.add(shelf, trim);
  }

  // Instanced glassware set on bar back counter (1 draw call)
  const glassGeo = new THREE.CylinderGeometry(0.055, 0.04, 0.16, 8);
  const glassInst = new THREE.InstancedMesh(glassGeo, glassMat, 36);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 36; i++) {
    const row = Math.floor(i / 18);
    const col = i % 18;
    dummy.position.set(0.02 + row * 0.18, 1.49, -6.0 + col * 0.7);
    dummy.updateMatrix();
    glassInst.setMatrixAt(i, dummy.matrix);
  }
  glassInst.instanceMatrix.needsUpdate = true;
  group.add(glassInst);

  // Under-counter warm LED foot-rail & brass rail
  const footRail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 15.6, 8), goldMat);
  footRail.rotation.x = Math.PI / 2;
  footRail.position.set(8.8, 0.18, 0);
  const underLed = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 15.6), warmMat);
  underLed.position.set(8.65, 1.12, 0);
  group.add(footRail, underLed);

  return group;
}

/**
 * Modern Restroom entrance & lit corridor with frosted glass doors and sconces
 */
export function createRestroomCorridor({ obsidianMat, goldMat, glassMat, signTex, warmMat }) {
  const group = new THREE.Group();

  // Corridor partition wall with doorway opening (width 11m along Z, height 5.2m)
  const wallTop = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.8, 10.5), obsidianMat);
  wallTop.position.set(0, 4.3, 0);
  const wallNorth = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.4, 3.5), obsidianMat);
  wallNorth.position.set(0, 1.7, -3.5);
  const wallSouth = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.4, 3.5), obsidianMat);
  wallSouth.position.set(0, 1.7, 3.5);
  const headerTrim = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 10.6), goldMat);
  headerTrim.position.set(0, 5.2, 0);
  group.add(wallTop, wallNorth, wallSouth, headerTrim);

  // Illuminated WC · RESTROOMS sign above doorway
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 0.8),
    new THREE.MeshBasicMaterial({ map: signTex })
  );
  sign.position.set(-0.2, 3.85, 0);
  sign.rotation.y = -Math.PI / 2;
  group.add(sign);

  // Two frosted glass restroom stall doors inside corridor
  for (const dz of [-1.8, 1.8]) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.8, 1.7), goldMat);
    frame.position.set(4.2, 1.4, dz);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.7, 1.55), glassMat);
    door.position.set(4.2, 1.4, dz);
    const sconce = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.12), warmMat);
    sconce.position.set(4.1, 2.1, dz + (dz < 0 ? -1.1 : 1.1));
    group.add(frame, door, sconce);
  }

  // Ceiling warm cove light strip inside corridor
  const cove = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.06, 0.25), warmMat);
  cove.position.set(2.2, 4.8, 0);
  group.add(cove);

  return group;
}
