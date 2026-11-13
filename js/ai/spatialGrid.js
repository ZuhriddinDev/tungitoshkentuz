// Broad-phase Spatial Hash Grid shared by Pedestrian AI & Vehicle AI (zero per-frame array churn)
export class SpatialHashGrid {
  constructor(cellSize = 18) {
    this.cellSize = cellSize;
    this.invCell = 1 / cellSize;
    this.cells = new Map();
    this._pool = [];
    this._usedCount = 0;
  }

  clear() {
    for (let i = 0; i < this._usedCount; i++) {
      this._pool[i].length = 0;
    }
    this._usedCount = 0;
    this.cells.clear();
  }

  _key(cx, cz) {
    return ((cx + 2048) << 12) | ((cz + 2048) & 0xfff);
  }

  insert(item, x, z) {
    const cx = Math.floor(x * this.invCell);
    const cz = Math.floor(z * this.invCell);
    const key = this._key(cx, cz);
    let bucket = this.cells.get(key);
    if (!bucket) {
      if (this._usedCount < this._pool.length) {
        bucket = this._pool[this._usedCount++];
      } else {
        bucket = [];
        this._pool.push(bucket);
        this._usedCount++;
      }
      this.cells.set(key, bucket);
    }
    bucket.push(item);
  }

  query(x, z, radius, outList) {
    outList.length = 0;
    const minX = Math.floor((x - radius) * this.invCell);
    const maxX = Math.floor((x + radius) * this.invCell);
    const minZ = Math.floor((z - radius) * this.invCell);
    const maxZ = Math.floor((z + radius) * this.invCell);

    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const bucket = this.cells.get(this._key(cx, cz));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          outList.push(bucket[i]);
        }
      }
    }
    return outList;
  }
}
