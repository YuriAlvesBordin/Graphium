/**
 * @class SpatialHash2D
 * @brief Contiguous spatial grid for O(1) neighborhood queries.
 *
 * Performs zero-allocation queries using TypedArrays and implicit sorting.
 * Designed to accelerate collision detection, picking, and edge conflict detection.
 */
export class SpatialHash2D {
  /**
   * @brief Constructs a new SpatialHash2D.
   * @param options Configuration options including cellSize and capacities.
   */
  constructor(options = {}) {
    this.cellSize = Math.max(0.0001, options.cellSize || 80);
    this.invCellSize = 1 / this.cellSize;
    this.nodeCapacity = Math.max(8, options.nodeCapacity || 256);
    this.tableCapacity = 1;
    const requested = Math.max(16, options.tableCapacity || this.nodeCapacity * 4);
    while (this.tableCapacity < requested) {
      this.tableCapacity <<= 1;
    }
    this.mask = this.tableCapacity - 1;
    this.keyX = new Int32Array(this.tableCapacity);
    this.keyY = new Int32Array(this.tableCapacity);
    this.head = new Int32Array(this.tableCapacity);
    this.used = new Uint8Array(this.tableCapacity);
    this.next = new Int32Array(this.nodeCapacity);
    this.head.fill(-1);
    this.next.fill(-1);
    this.count = 0;
  }

  setCellSize(value) {
    this.cellSize = Math.max(0.0001, value);
    this.invCellSize = 1 / this.cellSize;
  }

  ensureNodeCapacity(required) {
    if (required <= this.nodeCapacity) {
      return;
    }
    let capacity = this.nodeCapacity;
    while (capacity < required) {
      capacity <<= 1;
    }
    const next = new Int32Array(capacity);
    next.set(this.next);
    next.fill(-1, this.nodeCapacity);
    this.next = next;
    this.nodeCapacity = capacity;
  }

  clear() {
    this.used.fill(0);
    this.head.fill(-1);
    this.next.fill(-1);
    this.count = 0;
  }

  _hash(cx, cy) {
    return (((cx * 73856093) ^ (cy * 19349663)) >>> 0) & this.mask;
  }

  _slot(cx, cy) {
    let slot = this._hash(cx, cy);
    while (this.used[slot] && (this.keyX[slot] !== cx || this.keyY[slot] !== cy)) {
      slot = (slot + 1) & this.mask;
    }
    return slot;
  }

  cellX(x) {
    return Math.floor(x * this.invCellSize);
  }
  cellY(y) {
    return Math.floor(y * this.invCellSize);
  }

  /**
   * @brief Rebuilds the spatial index for a set of points.
   * @param x Array of X coordinates.
   * @param y Array of Y coordinates.
   * @param count Number of points to index.
   * @param hidden Optional bitmask array where truthy values exclude points.
   */
  rebuild(x, y, count, hidden) {
    this.ensureNodeCapacity(count);
    this.clear();
    for (let i = 0; i < count; i++) {
      if (hidden && hidden[i]) {
        continue;
      }
      const cx = Math.floor(x[i] * this.invCellSize);
      const cy = Math.floor(y[i] * this.invCellSize);
      const slot = this._slot(cx, cy);
      if (!this.used[slot]) {
        this.used[slot] = 1;
        this.keyX[slot] = cx;
        this.keyY[slot] = cy;
        this.head[slot] = -1;
      }
      this.next[i] = this.head[slot];
      this.head[slot] = i;
      this.count++;
    }
  }

  queryCellInto(cx, cy, output, maxResults = output.length) {
    const slot = this._slot(cx, cy);
    if (!this.used[slot] || this.keyX[slot] !== cx || this.keyY[slot] !== cy) {
      return 0;
    }
    let found = 0;
    for (let index = this.head[slot]; index >= 0 && found < maxResults; index = this.next[index]) {
      output[found++] = index;
    }
    return found;
  }

  /**
   * @brief Queries the spatial hash for all points within a radius.
   * @param x The center X coordinate.
   * @param y The center Y coordinate.
   * @param radius The search radius.
   * @param output The array to populate with found indices.
   * @return The number of results written to the output array.
   */
  queryRadiusInto(x, y, radius, output) {
    const minX = Math.floor((x - radius) * this.invCellSize);
    const maxX = Math.floor((x + radius) * this.invCellSize);
    const minY = Math.floor((y - radius) * this.invCellSize);
    const maxY = Math.floor((y + radius) * this.invCellSize);
    const radiusSq = radius * radius;
    let found = 0;
    for (let cy = minY; cy <= maxY && found < output.length; cy++) {
      for (let cx = minX; cx <= maxX && found < output.length; cx++) {
        const slot = this._slot(cx, cy);
        if (!this.used[slot] || this.keyX[slot] !== cx || this.keyY[slot] !== cy) {
          continue;
        }
        for (let index = this.head[slot]; index >= 0 && found < output.length; index = this.next[index]) {
          output[found++] = index;
        }
      }
    }
    return found;
  }

  /**
   * @brief Performs an exact radius query considering the individual radii of the points.
   * @param x The center X coordinate.
   * @param y The center Y coordinate.
   * @param radius The search radius.
   * @param positionsX Array of point X coordinates.
   * @param positionsY Array of point Y coordinates.
   * @param radii Array of point radii.
   * @param output The array to populate with found indices.
   * @return The number of results written to the output array.
   */
  queryCircleInto(x, y, radius, positionsX, positionsY, radii, output) {
    const candidates = output;
    const count = this.queryRadiusInto(x, y, radius, candidates);
    const radiusSq = radius * radius;
    let found = 0;
    for (let i = 0; i < count; i++) {
      const index = candidates[i];
      const dx = positionsX[index] - x;
      const dy = positionsY[index] - y;
      const limit = radius + (radii ? radii[index] : 0);
      if (dx * dx + dy * dy <= Math.max(radiusSq, limit * limit)) {
        candidates[found++] = index;
      }
    }
    return found;
  }

  /**
   * @brief Finds the top-most node under a specific point, considering node radii.
   * @param x The query X coordinate.
   * @param y The query Y coordinate.
   * @param positionsX Array of node X coordinates.
   * @param positionsY Array of node Y coordinates.
   * @param radii Array of node radii.
   * @param output Array where the first element receives the picked index, or -1.
   * @return 1 if a node was picked, 0 otherwise.
   */
  pickNodeInto(x, y, positionsX, positionsY, radii, output) {
    const count = this.queryRadiusInto(x, y, 64, output);
    let best = -1;
    let bestDistance = Infinity;
    for (let i = 0; i < count; i++) {
      const index = output[i];
      const dx = positionsX[index] - x;
      const dy = positionsY[index] - y;
      const distance = dx * dx + dy * dy;
      const r = radii[index];
      if (distance <= r * r && distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    }
    return best;
  }
}
