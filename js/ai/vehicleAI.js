// Smart Vehicle AI & Realistic Driving Dynamics:
// Uses actual GLB models from CARS/carModel.js, Shared SpatialHashGrid collision avoidance,
// traffic light compliance, pedestrian crosswalk yielding, driving profiles, and LOD.
import * as THREE from 'three';
import { CARS } from '../config.js';
import { buildCar, GLB_SPECS } from '../carModel.js';
import { N, ROAD, MAIN_ROADS_X, MAIN_ROADS_Z, roadC, POIS, nearestRoad } from '../world/layout.js';
import { signalFor } from '../world/props.js';

const GAS_STATIONS = POIS.filter((p) => p.type === 'gas');
const LANE = 4.6;
const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const CULL_DIST_SQ = 175 * 175;
const NEAR_PHYS_DIST_SQ = 92 * 92;
const RESPAWN_DIST_SQ = 480 * 480;

const TAXI_COLOR = '#f9d71c';
const PALETTE = [
  '#f5f5f5',
  '#f5f5f5',
  '#111111',
  '#9e9e9e',
  '#c0c0c0',
  '#1565c0',
  '#c62828',
  TAXI_COLOR,
  '#2e3b4e',
];

const DRIVER_PROFILES = [
  { id: 'calm', speedMul: 0.85, headway: 1.8, maxLatG: 4.5, accelMul: 0.85 },
  { id: 'normal', speedMul: 1.0, headway: 1.45, maxLatG: 5.5, accelMul: 1.0 },
  { id: 'fast', speedMul: 1.24, headway: 1.15, maxLatG: 6.8, accelMul: 1.2 },
  { id: 'cautious', speedMul: 0.78, headway: 2.1, maxLatG: 4.0, accelMul: 0.75 },
];

// Build verified registry of city-appropriate GLB vehicles from CARS + GLB_SPECS
const CITY_CANDIDATES = [
  'gentra',
  'spark',
  'nexia2',
  'malibu',
  'kia_k5',
  'byd_han',
  'e55',
  'mercedes',
  'bmwx7',
  'bmw2018',
  'bmw',
  'lc300',
  'challenger',
  'm4gts',
  'escalade',
  'maybach',
];

export function buildCityVehicleRegistry() {
  const registry = [];
  for (const id of CITY_CANDIDATES) {
    const cfg = CARS.find((c) => c.id === id);
    if (cfg && GLB_SPECS[id]) {
      registry.push(cfg);
    }
  }
  return registry.length > 0 ? registry : [CARS[0]];
}

const validNode = (i, k) => i >= 0 && k >= 0 && i <= N && k <= N;

export class VehicleAIManager {
  constructor(scene, count, sharedGrid) {
    this.scene = scene;
    this.sharedGrid = sharedGrid;
    this.registry = buildCityVehicleRegistry();
    this.cars = [];
    this.night = 0.8;
    this.gameHour = 22;
    this._tick = 0;
    this._nearby = [];

    this.stats = {
      activeCount: 0,
      nearCount: 0,
      medCount: 0,
      farCount: 0,
      stoppedAtRed: 0,
      yieldingPed: 0,
      avoidingCar: 0,
      stuckRecoveries: 0,
      lastUpdateMs: 0,
    };

    for (let n = 0; n < count; n++) {
      const cfg = this.registry[n % this.registry.length];
      const profile = DRIVER_PROFILES[n % DRIVER_PROFILES.length];
      const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      const model = buildCar(cfg, { color }, { beam: false });
      scene.add(model.group);

      const mass = cfg.body === 'suv' ? 2350 : cfg.body === 'hatch' ? 1050 : 1550;
      const baseCruise = (9.2 + Math.random() * 4.2) * profile.speedMul;
      const car = {
        id: n,
        isVehicle: true,
        model,
        cfg,
        profile,
        len: cfg.len,
        wid: cfg.wid,
        mass,
        x: 0,
        z: 0,
        heading: 0,
        v: 0,
        cruise: baseCruise,
        stun: 0,
        honk: 0,
        fuel: 0.35 + Math.random() * 0.65,
        refuelStation: null,
        refuelTimer: 0,
        lane: 0,
        laneOffset: LANE,
        turning: false,
        stuckTimer: 0,
        roll: 0,
        pitch: 0,
        aiState: 'cruising',
      };
      car.onHit = (nx, nz, kmh) => {
        car.stun = 2.6;
        const pushSpd = Math.min(8, Math.max(1.5, (kmh || 20) * 0.12));
        car.x += nx * 0.45;
        car.z += nz * 0.45;
        car.v = (nx * Math.sin(car.heading) + nz * Math.cos(car.heading)) * pushSpd;
        car.honk = kmh > 10 ? 1 : 0;
        car.model.setBlinker?.('hazard', performance.now() / 1000);
      };
      this.respawn(car, 0, 0, true);
      this.cars.push(car);
    }
  }

  setNight(n, gameHour = 22) {
    this.night = n;
    this.gameHour = gameHour;
  }

  respawn(car, px, pz, anywhere = false) {
    for (let tries = 0; tries < 30; tries++) {
      const i = Math.floor(Math.random() * (N + 1));
      const k = Math.floor(Math.random() * (N + 1));
      const d = Math.hypot(roadC(i) - px, roadC(k) - pz);
      if (!anywhere && (d < 150 || d > 420)) continue;
      const opts = DIRS.filter(([dx, dz]) => validNode(i + dx, k + dz));
      if (!opts.length) continue;
      const [dx, dz] = opts[Math.floor(Math.random() * opts.length)];
      Object.assign(car, {
        ni: i + dx,
        nk: k + dz,
        dx,
        dz,
        v: car.cruise * 0.8,
        stun: 0,
        lane: 0,
        laneOffset: LANE,
        turning: false,
        aiState: 'cruising',
      });
      car.x = roadC(i) - dz * LANE;
      car.z = roadC(k) + dx * LANE;
      car.heading = Math.atan2(dx, dz);
      return;
    }
  }

  nextNode(car) {
    const i = car.ni;
    const k = car.nk;
    let opts = DIRS.filter(([dx, dz]) => !(dx === -car.dx && dz === -car.dz) && validNode(i + dx, k + dz));
    if (!opts.length) opts = [[-car.dx, -car.dz]];
    if (opts.some(([dx, dz]) => dx === car.dx && dz === car.dz) && Math.random() < 0.58) {
      opts = [[car.dx, car.dz]];
    }
    const [dx, dz] = opts[Math.floor(Math.random() * opts.length)];
    car.turning = !(dx === car.dx && dz === car.dz);
    Object.assign(car, { dx, dz, ni: i + dx, nk: k + dz });
  }

  update(dt, t, player, peds = null) {
    const tStart = performance.now();
    this._tick++;
    const night = this.night || 0;
    const px = player.x;
    const pz = player.z;

    // Gradual day/night traffic density: quieter late night (02:00-06:00)
    const isLateNight = this.gameHour >= 2 && this.gameHour < 6;
    const activeTarget = isLateNight ? Math.floor(this.cars.length * 0.6) : this.cars.length;

    // Populate shared spatial grid once per frame with active vehicles + pedestrians
    this.sharedGrid.clear();
    for (let i = 0; i < activeTarget; i++) {
      this.sharedGrid.insert(this.cars[i], this.cars[i].x, this.cars[i].z);
    }
    if (peds && peds.list) {
      for (let i = 0; i < peds.list.length; i++) {
        const ped = peds.list[i];
        if (ped.active && !ped.culled) {
          this.sharedGrid.insert(ped, ped.x, ped.z);
        }
      }
    }

    let nearCount = 0;
    let medCount = 0;
    let farCount = 0;
    let stoppedAtRed = 0;
    let yieldingPed = 0;
    let avoidingCar = 0;

    for (let idx = 0; idx < this.cars.length; idx++) {
      const car = this.cars[idx];
      const g = car.model.group;

      if (idx >= activeTarget) {
        g.visible = false;
        farCount++;
        continue;
      }

      const distSq = (car.x - px) * (car.x - px) + (car.z - pz) * (car.z - pz);
      if (distSq > RESPAWN_DIST_SQ) {
        this.respawn(car, px, pz, false);
        continue;
      }

      if (distSq > CULL_DIST_SQ) {
        g.visible = false;
        farCount++;
        if ((this._tick + idx) % 3 === 0) {
          const step = car.v * dt * 3;
          car.x += Math.sin(car.heading) * step;
          car.z += Math.cos(car.heading) * step;
          g.position.set(car.x, 0, car.z);
        }
        continue;
      }

      g.visible = true;
      const isNear = distSq < NEAR_PHYS_DIST_SQ;
      if (isNear) nearCount++;
      else medCount++;

      // Refuel state at gas station
      if (car.refuelTimer > 0) {
        car.refuelTimer -= dt;
        car.v = 0;
        car.aiState = 'refueling';
        car.model.setLights(night > 0.4);
        car.model.setBrake(true);
        car.model.setBlinker?.('hazard', t);
        if (car.refuelTimer <= 0) {
          car.fuel = 1.0;
          car.refuelStation = null;
          car.ni = nearestRoad(car.x);
          car.nk = nearestRoad(car.z);
        }
        continue;
      }

      if (!car.refuelStation && car.fuel < 0.14 && GAS_STATIONS.length > 0) {
        const activeRefuelers = this.cars.reduce((acc, c) => acc + (c.refuelStation ? 1 : 0), 0);
        if (activeRefuelers < 2) {
          let bestSt = null;
          let bestD = Infinity;
          for (const st of GAS_STATIONS) {
            if (st._aiBusy && st._aiBusy > t) continue;
            const sd = Math.hypot(st.x - car.x, st.z - car.z);
            if (sd < bestD) {
              bestD = sd;
              bestSt = st;
            }
          }
          if (bestSt && bestD < 450) {
            car.refuelStation = bestSt;
            bestSt._aiBusy = t + 18;
          }
        }
      }

      const targetLane = LANE + (car.lane || 0) * 3.8;
      car.laneOffset = (car.laneOffset ?? LANE) + (targetLane - (car.laneOffset ?? LANE)) * Math.min(1, dt * 3.5);
      const tx = car.refuelStation ? car.refuelStation.x : roadC(car.ni) - car.dz * car.laneOffset;
      const tz = car.refuelStation ? car.refuelStation.z - 2 : roadC(car.nk) + car.dx * car.laneOffset;
      const toT = Math.hypot(tx - car.x, tz - car.z);

      if (car.refuelStation) {
        if (toT < 3.2) {
          car.refuelTimer = 3.5;
          continue;
        }
      } else if (toT < 4.8) {
        car.lane = 0;
        this.nextNode(car);
      }

      let want = car.cruise;
      car.aiState = 'cruising';
      const interior = car.ni > 0 && car.nk > 0 && car.ni < N && car.nk < N;
      const stopD = toT - ROAD / 2 - 2.2;
      const sig = interior ? signalFor(car.dx ? 'x' : 'z', t) : 'g';
      const atRed = interior && sig !== 'g' && stopD > -1 && stopD < 16;
      if (atRed) {
        want = stopD < 1.0 ? 0 : Math.min(want, stopD * 0.65);
        car.aiState = 'red_light';
        stoppedAtRed++;
      }

      // Broad-phase SpatialHashGrid check for vehicles + pedestrians
      const fx = Math.sin(car.heading);
      const fz = Math.cos(car.heading);
      let blockedAhead = false;
      let outerLaneClear = true;
      const safeGap = 5.5 + car.v * car.profile.headway * 0.35;

      this.sharedGrid.query(car.x + fx * 8, car.z + fz * 8, 18, this._nearby);
      for (let q = 0; q < this._nearby.length; q++) {
        const obj = this._nearby[q];
        if (!obj || obj === car) continue;
        const ox = obj.x - car.x;
        const oz = obj.z - car.z;
        const ahead = ox * fx + oz * fz;
        const sideSigned = ox * fz - oz * fx;

        if (obj.isVehicle) {
          if (ahead > 0 && ahead < 17 && Math.abs(sideSigned) < 2.6) {
            avoidingCar++;
            want = Math.min(want, Math.max(0, (ahead - safeGap) * 0.85));
            if (ahead < 12.5) blockedAhead = true;
            if (want < car.cruise * 0.7) car.aiState = 'following';
          }
          if (ahead > -6 && ahead < 19 && sideSigned > 2.3 && sideSigned < 6.4) {
            outerLaneClear = false;
          }
        } else if (ahead > 0 && ahead < 12.5 && Math.abs(sideSigned) < 2.6) {
          // Yield to pedestrian in/near crosswalk
          yieldingPed++;
          want = Math.min(want, Math.max(0, (ahead - 4.0) * 0.72));
          car.aiState = 'yield_ped';
        }
      }

      // Check player vehicle
      const pox = px - car.x;
      const poz = pz - car.z;
      const pAhead = pox * fx + poz * fz;
      const pSide = pox * fz - poz * fx;
      if (pAhead > 0 && pAhead < 15 && Math.abs(pSide) < 2.6) {
        avoidingCar++;
        want = Math.min(want, Math.max(0, (pAhead - 6.0) * 0.82));
        if (pAhead < 12) blockedAhead = true;
      }
      if (pAhead > -6 && pAhead < 18 && pSide > 2.3 && pSide < 6.4) {
        outerLaneClear = false;
      }

      // Safe overtaking on main multi-lane roads only
      const onMainRoad = car.dx ? MAIN_ROADS_X.has(car.nk) : MAIN_ROADS_Z.has(car.ni);
      if (blockedAhead && !atRed && onMainRoad && toT > 26 && outerLaneClear && car.lane === 0 && !car.turning) {
        car.lane = 1;
        car.aiState = 'overtaking';
      } else if (!blockedAhead && car.lane === 1 && outerLaneClear) {
        car.lane = 0;
      }

      // Gridlock / stuck prevention
      if (!atRed && car.v < 0.8 && car.stun <= 0 && !car.refuelStation) {
        car.stuckTimer += dt;
        if (car.stuckTimer > 4.0) {
          car.stuckTimer = 0;
          this.stats.stuckRecoveries++;
          car.lane = car.lane === 0 ? 1 : 0;
          if (toT < 20) this.nextNode(car);
        }
      } else {
        car.stuckTimer = 0;
      }

      if (car.stun > 0) {
        car.stun -= dt;
        want = 0;
        car.aiState = 'stunned';
      }

      // Speed-dependent cornering & mass-based acceleration/braking
      const desired = Math.atan2(tx - car.x, tz - car.z);
      const dh = Math.atan2(Math.sin(desired - car.heading), Math.cos(desired - car.heading));
      if (Math.abs(dh) > 0.35) want = Math.min(want, 5.4);
      else if (toT < 22 && car.turning) want = Math.min(want, 7.2);

      const maxAccel = (3.4 * car.profile.accelMul * 1500) / car.mass;
      const maxBrake = (8.8 * 1500) / car.mass;
      car.v += THREE.MathUtils.clamp(want - car.v, -maxBrake * dt, maxAccel * dt);

      const speedTurnFactor = THREE.MathUtils.clamp(car.v / 5.0, 0.25, 1.0);
      const maxSteerRate = 2.2 * speedTurnFactor;
      car.heading += THREE.MathUtils.clamp(dh, -maxSteerRate * dt, maxSteerRate * dt);

      const step = car.v * dt;
      car.x += Math.sin(car.heading) * step;
      car.z += Math.cos(car.heading) * step;
      car.fuel = Math.max(0.05, car.fuel - Math.abs(step) * 0.00022);

      // Suspension body roll & brake/accel pitch
      car.roll += (-dh * car.v * 0.012 - car.roll) * Math.min(1, dt * 5);
      car.pitch += ((want < car.v - 0.5 ? 0.022 : want > car.v + 0.8 ? -0.014 : 0) - car.pitch) * Math.min(1, dt * 6);
      g.position.set(car.x, 0, car.z);
      g.rotation.set(car.pitch, car.heading, THREE.MathUtils.clamp(car.roll, -0.055, 0.055), 'YXZ');

      if (isNear) {
        car.model.update(step, THREE.MathUtils.clamp(dh * 2, -0.5, 0.5));
      }
      car.model.setLights(night > 0.4);
      car.model.setBrake(want < car.v - 0.5 || car.stun > 0);
      if (car.stun > 0) car.model.setBlinker?.('hazard', t);
      else if (car.turning && toT < 24) {
        const turnSign = Math.sin(desired - car.heading);
        car.model.setBlinker?.(turnSign > 0.08 ? 'left' : turnSign < -0.08 ? 'right' : 'off', t);
      } else {
        car.model.setBlinker?.('off', t);
      }
    }

    this.stats.activeCount = activeTarget;
    this.stats.nearCount = nearCount;
    this.stats.medCount = medCount;
    this.stats.farCount = farCount;
    this.stats.stoppedAtRed = stoppedAtRed;
    this.stats.yieldingPed = yieldingPed;
    this.stats.avoidingCar = avoidingCar;
    this.stats.lastUpdateMs = performance.now() - tStart;
  }
}
