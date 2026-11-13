// Realistic Human Pedestrian AI: Sidewalk & Crosswalk A* Navigation,
// Time-To-Collision (TTC) Crossing Safety, Crowd Separation, Day/Night Density,
// and GLB Bip01 AnimationMixer LOD Pooling.
import * as THREE from 'three';
import { N, BLOCK, ROAD, CELL, HALF, roadC, blockC, blockInfo, queryColliders } from '../world/layout.js';
import { signalFor } from '../world/props.js';
import { CHARACTER_GLB_CATALOG, CharacterAssetManager } from './characterAssetManager.js';

const SIDEWALK_HALF = BLOCK / 2 - 2.1;
const NEAR_GLB_DIST_SQ = 68 * 68;
const CULL_DIST_SQ = 158 * 158;
const RESPAWN_DIST_SQ = 360 * 360;
const MAX_GLB_CLONES = 18;

const PERSONALITIES = [
  { id: 'stroll', baseSpeed: 1.15, pauseChance: 0.35, phoneBias: 0.45 },
  { id: 'commuter', baseSpeed: 1.52, pauseChance: 0.14, phoneBias: 0.65 },
  { id: 'hurried', baseSpeed: 1.88, pauseChance: 0.06, phoneBias: 0.30 },
  { id: 'social', baseSpeed: 1.25, pauseChance: 0.45, phoneBias: 0.25 },
  { id: 'nightlife', baseSpeed: 1.32, pauseChance: 0.30, phoneBias: 0.50 },
];

const NIGHTLIFE_BLOCKS = [
  [8, 7], // Kokobango
  [9, 7], // Amir Temur
  [4, 10], // Magic City
  [5, 7], // Tashkent City
];

const DAY_HUB_BLOCKS = [
  [2, 5], // Chorsu
  [4, 7], // Tashkent City
  [5, 7],
  [7, 7], // Mustaqillik
  [9, 7], // Amir Temur
  [8, 6], // Markaz
];

function cornerWorld(j, k, c) {
  // c: 0=NW(-,-), 1=NE(+,-), 2=SE(+,+), 3=SW(-,+)
  const bx = blockC(j);
  const bz = blockC(k);
  const sx = c === 1 || c === 2 ? 1 : -1;
  const sz = c === 2 || c === 3 ? 1 : -1;
  return [bx + sx * SIDEWALK_HALF, bz + sz * SIDEWALK_HALF];
}

function validPedBlock(j, k) {
  if (j < 0 || k < 0 || j >= N || k >= N) return false;
  const t = blockInfo(j, k).type;
  return t !== 'canal' && t !== 'gas' && t !== 'garage';
}

function angleDiff(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

export class PedestrianAIManager {
  constructor(scene, count, sharedGrid) {
    this.scene = scene;
    this.count = count;
    this.sharedGrid = sharedGrid;
    this.charAssets = new CharacterAssetManager();
    this.list = [];
    this.glbPool = [];
    this.night = 0.8;
    this.gameHour = 22;
    this._nearCars = [];
    this._nearPeds = [];
    this._tick = 0;

    this.stats = {
      activeCount: 0,
      nearCount: 0,
      medCount: 0,
      farCount: 0,
      glbActive: 0,
      waitingCross: 0,
      crossing: 0,
      avoiding: 0,
      lastUpdateMs: 0,
    };

    // Lightweight LOD fallback markers for MEDIUM distance or while GLBs stream in
    const bodyGeo = new THREE.CapsuleGeometry(0.18, 0.72, 4, 8);
    bodyGeo.translate(0, 0.82, 0);
    const headGeo = new THREE.SphereGeometry(0.15, 8, 8);
    headGeo.translate(0, 1.54, 0);
    const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.72, metalness: 0.05 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xdfb18b, roughness: 0.6 });
    this.lodBody = new THREE.InstancedMesh(bodyGeo, bodyMat, count);
    this.lodHead = new THREE.InstancedMesh(headGeo, headMat, count);
    this.lodBody.frustumCulled = false;
    this.lodHead.frustumCulled = false;
    scene.add(this.lodBody, this.lodHead);

    this._m4 = new THREE.Matrix4();
    this._zero = new THREE.Matrix4().makeScale(0, 0, 0);
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1);
    this._up = new THREE.Vector3(0, 1, 0);

    const coatColors = ['#1e293b', '#334155', '#4c1d95', '#831843', '#14532d', '#7c2d12', '#1d4ed8', '#3f3f46'];
    const cTmp = new THREE.Color();

    for (let i = 0; i < count; i++) {
      cTmp.set(coatColors[i % coatColors.length]);
      this.lodBody.setColorAt(i, cTmp);
      const prof = PERSONALITIES[i % PERSONALITIES.length];
      const ped = {
        id: i,
        profile: prof,
        modelId: CHARACTER_GLB_CATALOG[i % CHARACTER_GLB_CATALOG.length].id,
        heightScale: 0.95 + (i % 5) * 0.025,
        j: 7,
        k: 7,
        corner: i % 4,
        destJ: 8,
        destK: 7,
        targetX: 0,
        targetZ: 0,
        nextJ: 7,
        nextK: 7,
        nextCorner: (i + 1) % 4,
        isCrosswalk: false,
        crossAxis: 'x',
        x: 0,
        z: 0,
        vx: 0,
        vz: 0,
        speed: 0,
        heading: 0,
        state: 'walk', // 'idle' | 'walk' | 'fast_walk' | 'run' | 'talk' | 'phone' | 'look_around' | 'wait_cross'
        stateTimer: 0,
        waitCooldown: 5 + Math.random() * 12,
        glbInst: null,
        culled: true,
        active: true,
      };
      this.spawnPed(ped, 0, 0, true);
      this.list.push(ped);
    }
    if (this.lodBody.instanceColor) this.lodBody.instanceColor.needsUpdate = true;

    // Preload all 7 GLB character templates asynchronously and warm pool
    this.charAssets.preloadAll().then(() => {
      for (let i = 0; i < MAX_GLB_CLONES; i++) {
        const spec = CHARACTER_GLB_CATALOG[i % CHARACTER_GLB_CATALOG.length];
        const inst = this.charAssets.createInstance(spec.id, 0.96 + (i % 4) * 0.025);
        if (inst) {
          inst.root.visible = false;
          this.scene.add(inst.root);
          this.glbPool.push({ inst, ownerId: -1 });
        }
      }
    });
  }

  setEnvironment(night, gameHour = 22) {
    this.night = night;
    this.gameHour = gameHour;
  }

  _pickDestination(fromJ, fromK, prof) {
    const isNight = this.gameHour >= 19 || this.gameHour < 5;
    const hubs = isNight ? NIGHTLIFE_BLOCKS : DAY_HUB_BLOCKS;
    if (Math.random() < (prof.id === 'nightlife' && isNight ? 0.65 : 0.3)) {
      const [hj, hk] = hubs[Math.floor(Math.random() * hubs.length)];
      if (validPedBlock(hj, hk)) return [hj, hk];
    }
    for (let t = 0; t < 16; t++) {
      const dj = Math.max(0, Math.min(N - 1, fromJ + Math.floor(Math.random() * 7) - 3));
      const dk = Math.max(0, Math.min(N - 1, fromK + Math.floor(Math.random() * 7) - 3));
      if (validPedBlock(dj, dk) && (dj !== fromJ || dk !== fromK)) return [dj, dk];
    }
    return [fromJ, fromK];
  }

  _chooseNextStep(ped) {
    // Move along current block sidewalk or cross at an intersection toward (destJ, destK)
    const { j, k, corner, destJ, destK } = ped;
    if (j === destJ && k === destK && Math.random() < 0.25) {
      [ped.destJ, ped.destK] = this._pickDestination(j, k, ped.profile);
    }

    const candidates = [];
    // Adjacent corners on same block (sidewalk edge)
    const cw = (corner + 1) % 4;
    const ccw = (corner + 3) % 4;
    candidates.push({ nj: j, nk: k, nc: cw, cross: false, axis: corner % 2 === 0 ? 'x' : 'z' });
    candidates.push({ nj: j, nk: k, nc: ccw, cross: false, axis: corner % 2 === 0 ? 'z' : 'x' });

    // Crosswalk across road to adjacent block
    if ((corner === 1 || corner === 2) && validPedBlock(j + 1, k)) {
      candidates.push({ nj: j + 1, nk: k, nc: corner === 1 ? 0 : 3, cross: true, axis: 'x' });
    }
    if ((corner === 0 || corner === 3) && validPedBlock(j - 1, k)) {
      candidates.push({ nj: j - 1, nk: k, nc: corner === 0 ? 1 : 2, cross: true, axis: 'x' });
    }
    if ((corner === 2 || corner === 3) && validPedBlock(j, k + 1)) {
      candidates.push({ nj: j, nk: k + 1, nc: corner === 2 ? 1 : 0, cross: true, axis: 'z' });
    }
    if ((corner === 0 || corner === 1) && validPedBlock(j, k - 1)) {
      candidates.push({ nj: j, nk: k - 1, nc: corner === 0 ? 3 : 2, cross: true, axis: 'z' });
    }

    // Score each candidate toward destination (A*-style heuristic + slight variety)
    const [destX, destZ] = cornerWorld(ped.destJ, ped.destK, 0);
    let best = candidates[0];
    let bestScore = Infinity;
    for (const cand of candidates) {
      const [wx, wz] = cornerWorld(cand.nj, cand.nk, cand.nc);
      const d = Math.hypot(destX - wx, destZ - wz);
      const jitter = Math.random() * 14;
      const crossPenalty = cand.cross ? 6 : 0;
      const score = d + jitter + crossPenalty;
      if (score < bestScore) {
        bestScore = score;
        best = cand;
      }
    }

    ped.nextJ = best.nj;
    ped.nextK = best.nk;
    ped.nextCorner = best.nc;
    ped.isCrosswalk = best.cross;
    ped.crossAxis = best.axis;
    const [tx, tz] = cornerWorld(best.nj, best.nk, best.nc);
    ped.targetX = tx + (Math.random() - 0.5) * 1.4;
    ped.targetZ = tz + (Math.random() - 0.5) * 1.4;
  }

  spawnPed(ped, px, pz, anywhere = false) {
    const isNight = this.gameHour >= 19 || this.gameHour < 5;
    for (let tries = 0; tries < 32; tries++) {
      let j, k;
      if (!anywhere && isNight && Math.random() < 0.28) {
        const [hj, hk] = NIGHTLIFE_BLOCKS[Math.floor(Math.random() * NIGHTLIFE_BLOCKS.length)];
        j = hj;
        k = hk;
      } else {
        j = Math.floor(Math.random() * N);
        k = Math.floor(Math.random() * N);
      }
      if (!validPedBlock(j, k)) continue;
      const bx = blockC(j);
      const bz = blockC(k);
      const d = Math.hypot(bx - px, bz - pz);
      if (!anywhere && (d < 85 || d > 280)) continue;

      const corner = Math.floor(Math.random() * 4);
      const [wx, wz] = cornerWorld(j, k, corner);
      // Avoid spawning inside building colliders
      if (queryColliders(wx, wz, 0.8)) continue;

      ped.j = j;
      ped.k = k;
      ped.corner = corner;
      ped.x = wx;
      ped.z = wz;
      [ped.destJ, ped.destK] = this._pickDestination(j, k, ped.profile);
      this._chooseNextStep(ped);
      ped.heading = Math.atan2(ped.targetX - ped.x, ped.targetZ - ped.z);
      ped.speed = ped.profile.baseSpeed;
      ped.state = 'walk';
      return;
    }
  }

  _isCrosswalkSafe(ped, t) {
    // Pedestrians check traffic lights: crossing X-road means checking Z traffic signal, and vice versa
    const vehicleAxis = ped.crossAxis === 'x' ? 'z' : 'x';
    const sig = signalFor(vehicleAxis, t);
    //Wait if traffic on the crossing road has green/yellow
    const interior = ped.j > 0 && ped.k > 0 && ped.j < N && ped.k < N;
    if (interior && sig === 'g') return false;

    // Predictive Time-To-Collision check against approaching vehicles
    const midX = (ped.x + ped.targetX) * 0.5;
    const midZ = (ped.z + ped.targetZ) * 0.5;
    this.sharedGrid.query(midX, midZ, 28, this._nearCars);
    for (let i = 0; i < this._nearCars.length; i++) {
      const car = this._nearCars[i];
      if (!car || !car.isVehicle) continue;
      const dx = midX - car.x;
      const dz = midZ - car.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 10) return false;
      const closing = (dx * Math.sin(car.heading) + dz * Math.cos(car.heading)) / (dist || 1);
      if (closing > 0.45 && car.v > 2.0) {
        const ttc = dist / Math.max(0.5, car.v * closing);
        if (ttc < 3.1) return false;
      }
    }
    return true;
  }

  _releaseGlb(ped) {
    if (!ped.glbInst) return;
    ped.glbInst.inst.root.visible = false;
    ped.glbInst.ownerId = -1;
    ped.glbInst = null;
  }

  _acquireGlb(ped) {
    if (ped.glbInst) return ped.glbInst;
    for (let i = 0; i < this.glbPool.length; i++) {
      const slot = this.glbPool[i];
      if (slot.ownerId === -1) {
        slot.ownerId = ped.id;
        slot.inst.root.visible = true;
        ped.glbInst = slot;
        return slot;
      }
    }
    return null;
  }

  update(dt, t, player) {
    const tStart = performance.now();
    this._tick++;
    const px = player.x;
    const pz = player.z;

    // Gradual day/night target population scaling
    const isLateNight = this.gameHour >= 1 && this.gameHour < 6;
    const activeTarget = isLateNight ? Math.floor(this.count * 0.55) : this.count;

    let nearCount = 0;
    let medCount = 0;
    let farCount = 0;
    let glbActive = 0;
    let waitingCross = 0;
    let crossing = 0;
    let avoiding = 0;

    for (let i = 0; i < this.list.length; i++) {
      const ped = this.list[i];
      ped.active = i < activeTarget;

      if (!ped.active) {
        this._releaseGlb(ped);
        this.lodBody.setMatrixAt(i, this._zero);
        this.lodHead.setMatrixAt(i, this._zero);
        ped.culled = true;
        farCount++;
        continue;
      }

      const dSq = (ped.x - px) * (ped.x - px) + (ped.z - pz) * (ped.z - pz);
      if (dSq > RESPAWN_DIST_SQ) {
        this._releaseGlb(ped);
        this.spawnPed(ped, px, pz, false);
      }

      if (dSq > CULL_DIST_SQ) {
        this._releaseGlb(ped);
        if (!ped.culled) {
          ped.culled = true;
          this.lodBody.setMatrixAt(i, this._zero);
          this.lodHead.setMatrixAt(i, this._zero);
        }
        farCount++;
        // Very lightweight far movement every 4 frames
        if ((this._tick + i) % 4 === 0) {
          const step = ped.profile.baseSpeed * dt * 4;
          const dx = ped.targetX - ped.x;
          const dz = ped.targetZ - ped.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 1.5) {
            ped.j = ped.nextJ;
            ped.k = ped.nextK;
            ped.corner = ped.nextCorner;
            this._chooseNextStep(ped);
          } else {
            ped.x += (dx / dist) * step;
            ped.z += (dz / dist) * step;
          }
        }
        continue;
      }

      ped.culled = false;
      const isNear = dSq < NEAR_GLB_DIST_SQ;
      if (isNear) nearCount++;
      else medCount++;

      // MEDIUM LOD: time-slice AI logic every 2 frames
      const aiStepDt = isNear ? dt : (this._tick + i) % 2 === 0 ? dt * 2 : 0;
      if (aiStepDt > 0) {
        const dx = ped.targetX - ped.x;
        const dz = ped.targetZ - ped.z;
        const distToTarget = Math.hypot(dx, dz);

        if (distToTarget < 1.35) {
          ped.j = ped.nextJ;
          ped.k = ped.nextK;
          ped.corner = ped.nextCorner;
          this._chooseNextStep(ped);
        }

        // Crosswalk safety decision
        if (ped.isCrosswalk) {
          crossing++;
          if (ped.state === 'wait_cross') {
            waitingCross++;
            if (this._isCrosswalkSafe(ped, t)) {
              ped.state = 'walk';
            }
          } else if (distToTarget > ROAD * 0.7 && !this._isCrosswalkSafe(ped, t)) {
            ped.state = 'wait_cross';
          }
        } else {
          // Occasional natural pause (phone, talk, look around)
          ped.waitCooldown -= aiStepDt;
          if (ped.state === 'wait_cross') ped.state = 'walk';
          if (ped.stateTimer > 0) {
            ped.stateTimer -= aiStepDt;
            if (ped.stateTimer <= 0) ped.state = 'walk';
          } else if (ped.waitCooldown <= 0) {
            ped.waitCooldown = 10 + Math.random() * 16;
            if (Math.random() < ped.profile.pauseChance) {
              ped.stateTimer = 2.4 + Math.random() * 3.8;
              const r = Math.random();
              ped.state = r < ped.profile.phoneBias ? 'phone' : r < 0.8 ? 'talk' : 'look_around';
            }
          }
        }

        // Steering & local obstacle/crowd/vehicle avoidance
        let wantSpeed =
          ped.state === 'wait_cross' || ped.state === 'phone' || ped.state === 'talk' || ped.state === 'look_around'
            ? 0
            : ped.state === 'run'
            ? 2.85
            : ped.profile.baseSpeed;

        let steerX = distToTarget > 0.01 ? dx / distToTarget : Math.sin(ped.heading);
        let steerZ = distToTarget > 0.01 ? dz / distToTarget : Math.cos(ped.heading);

        // Crowd separation & approaching vehicle evasion via Shared SpatialHashGrid
        if (isNear) {
          this.sharedGrid.query(ped.x, ped.z, 9.0, this._nearPeds);
          for (let q = 0; q < this._nearPeds.length; q++) {
            const other = this._nearPeds[q];
            if (!other || other === ped) continue;
            const ox = ped.x - other.x;
            const oz = ped.z - other.z;
            const od = Math.hypot(ox, oz);
            if (other.isVehicle) {
              const threatDist = other.v > 2 ? 7.5 : 3.2;
              if (od < threatDist && od > 0.01) {
                avoiding++;
                steerX += (ox / od) * 2.4;
                steerZ += (oz / od) * 2.4;
                if (other.v > 3 && ped.isCrosswalk) {
                  ped.state = 'run';
                  wantSpeed = 2.9;
                }
              }
            } else if (od < 1.35 && od > 0.01) {
              avoiding++;
              steerX += (ox / od) * (1.35 - od) * 1.8;
              steerZ += (oz / od) * (1.35 - od) * 1.8;
            }
          }
        }

        // Player vehicle evasion
        const pox = ped.x - px;
        const poz = ped.z - pz;
        const pDist = Math.hypot(pox, poz);
        if (pDist < 7.5 && (player.kmh || 0) > 8 && pDist > 0.01) {
          avoiding++;
          steerX += (pox / pDist) * 2.8;
          steerZ += (poz / pDist) * 2.8;
          ped.state = 'run';
          wantSpeed = 2.95;
        }

        // Smooth acceleration/deceleration & heading turn
        ped.speed += (wantSpeed - ped.speed) * Math.min(1, aiStepDt * 6.5);
        if (ped.speed > 0.08) {
          const targetHeading = Math.atan2(steerX, steerZ);
          const dh = angleDiff(targetHeading, ped.heading);
          ped.heading += THREE.MathUtils.clamp(dh, -4.5 * aiStepDt, 4.5 * aiStepDt);
          const nx = ped.x + Math.sin(ped.heading) * ped.speed * aiStepDt;
          const nz = ped.z + Math.cos(ped.heading) * ped.speed * aiStepDt;
          // Never walk into building colliders
          const col = queryColliders(nx, nz, 0.45);
          if (!col) {
            ped.x = nx;
            ped.z = nz;
          } else {
            ped.heading += 1.4 * aiStepDt;
          }
        }
      }

      // Render: NEAR uses real Bip01 GLB character + AnimationMixer, MEDIUM uses instanced LOD
      if (isNear && this.glbPool.length > 0) {
        const slot = this._acquireGlb(ped);
        if (slot) {
          glbActive++;
          this.lodBody.setMatrixAt(i, this._zero);
          this.lodHead.setMatrixAt(i, this._zero);
          slot.inst.root.position.x = ped.x;
          slot.inst.root.position.z = ped.z;
          slot.inst.root.rotation.y = ped.heading;
          const animName =
            ped.speed > 2.2
              ? 'run'
              : ped.speed > 0.25
              ? 'walk'
              : ped.state === 'phone'
              ? 'phone'
              : ped.state === 'talk'
              ? 'talk'
              : ped.state === 'wait_cross' || ped.state === 'look_around'
              ? 'look_around'
              : 'idle';
          const timeScale = animName === 'walk' ? Math.max(0.6, ped.speed / 1.32) : animName === 'run' ? Math.max(0.8, ped.speed / 2.6) : 1.0;
          slot.inst.setAnimation(animName, timeScale, 0.22);
          slot.inst.mixer.update(dt);
          continue;
        }
      }

      this._releaseGlb(ped);
      this._q.setFromAxisAngle(this._up, ped.heading);
      this._s.set(1, ped.heightScale, 1);
      this._m4.compose(this._v.set(ped.x, 0.2, ped.z), this._q, this._s);
      this.lodBody.setMatrixAt(i, this._m4);
      this._m4.compose(this._v.set(ped.x, 0.2, ped.z), this._q, this._s);
      this.lodHead.setMatrixAt(i, this._m4);
    }

    this.lodBody.instanceMatrix.needsUpdate = true;
    this.lodHead.instanceMatrix.needsUpdate = true;

    this.stats.activeCount = activeTarget;
    this.stats.nearCount = nearCount;
    this.stats.medCount = medCount;
    this.stats.farCount = farCount;
    this.stats.glbActive = glbActive;
    this.stats.waitingCross = waitingCross;
    this.stats.crossing = crossing;
    this.stats.avoiding = avoiding;
    this.stats.lastUpdateMs = performance.now() - tStart;
  }

  dispose() {
    for (const ped of this.list) this._releaseGlb(ped);
    for (const slot of this.glbPool) {
      slot.inst.dispose();
      this.scene.remove(slot.inst.root);
    }
    this.glbPool.length = 0;
    this.charAssets.disposeAll();
  }
}
