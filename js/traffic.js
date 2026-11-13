// Shahar AI Ekotizimi: Smart Vehicle AI + Realistic Human Pedestrian AI + Shared SpatialGrid + Diagnostics
import { SpatialHashGrid } from './ai/spatialGrid.js';
import { VehicleAIManager } from './ai/vehicleAI.js';
import { PedestrianAIManager } from './ai/pedestrianAI.js';
import { AIDiagnostics } from './ai/aiDiagnostics.js';

let _sharedGrid = null;
let _diag = null;
let _lastVeh = null;
let _lastPed = null;

function getSharedGrid() {
  if (!_sharedGrid) _sharedGrid = new SpatialHashGrid(18);
  return _sharedGrid;
}

export class Traffic {
  constructor(scene, count) {
    this.grid = getSharedGrid();
    this.manager = new VehicleAIManager(scene, count, this.grid);
    this.cars = this.manager.cars;
    _lastVeh = this.manager;
    if (!_diag) _diag = new AIDiagnostics(scene);
  }

  setNight(n, gameHour = 22) {
    this.manager.setNight(n, gameHour);
    if (_lastPed) _lastPed.setEnvironment(n, gameHour);
  }

  update(dt, t, player, peds = null) {
    this.manager.update(dt, t, player, peds);
  }
}

export class Pedestrians {
  constructor(scene, count) {
    this.grid = getSharedGrid();
    this.manager = new PedestrianAIManager(scene, count, this.grid);
    this.list = this.manager.list;
    _lastPed = this.manager;
    if (!_diag) _diag = new AIDiagnostics(scene);
  }

  update(dt, t, player) {
    this.manager.update(dt, t, player);
    if (_diag) _diag.update(this.manager, _lastVeh);
  }
}
