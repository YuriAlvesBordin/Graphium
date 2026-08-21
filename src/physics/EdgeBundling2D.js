const DEFAULTS = {
  edgeBundling: false,
  bundleMode: 'geometric',
  bundleStrength: 0.35,
  bundleIterations: 3,
  bundleSubdivisions: 6,
  bundleCompatibility: 0.65,
  bundleRadius: 180,
  nodeSeparationLength: 50,
  maxBundleSize: 32,
  maxBundlePairs: 10000,
  preserveEdgeStyle: true,
  preserveEdgeIdentity: true,
  avoidNodeInteriors: true,
  bundleShortEdges: false,
  avoidSharedNodes: false,
  thresholdNodes: 3,
  movementThreshold: 1.5,
  bundleRenderMode: 'parallel',
};

export class SegmentGrid {
  constructor(cellSize = 180, capacity = 256) {
    this.cellSize = Math.max(1, cellSize);
    this.inv = 1 / this.cellSize;
    this.capacity = Math.max(8, capacity);
    this.next = new Int32Array(this.capacity);
    this.entryEdge = new Int32Array(this.capacity);
    this.entrySegment = new Int32Array(this.capacity);
    this.cellKeys = new Int32Array(this.capacity);
    this.segmentCount = 0;
    this.buckets = new Map();
    this.queryBuffer = new Int32Array(256);
  }
  ensure(capacity) {
    if (capacity <= this.capacity) {
      return;
    }
    let nextCapacity = this.capacity;
    while (nextCapacity < capacity) {
      nextCapacity <<= 1;
    }
    const next = new Int32Array(nextCapacity);
    next.set(this.next);
    const edge = new Int32Array(nextCapacity);
    edge.set(this.entryEdge);
    const segment = new Int32Array(nextCapacity);
    segment.set(this.entrySegment);
    this.next = next;
    this.entryEdge = edge;
    this.entrySegment = segment;
    this.capacity = nextCapacity;
  }
  clear() {
    this.buckets.clear();
    this.segmentCount = 0;
  }
  _key(x, y) {
    return (Math.floor(x * this.inv) * 73856093) ^ (Math.floor(y * this.inv) * 19349663);
  }
  insert(edgeIndex, x, y, segmentIndex = 0) {
    this.insertSegment(edgeIndex, segmentIndex, x, y);
  }
  _insertEntry(edgeIndex, segmentIndex, key) {
    const entry = this.segmentCount++;
    if (entry >= this.capacity) {
      this.ensure(entry + 1);
    }
    const head = this.buckets.get(key);
    this.next[entry] = head === undefined ? -1 : head;
    this.entryEdge[entry] = edgeIndex;
    this.entrySegment[entry] = segmentIndex;
    this.buckets.set(key, entry);
  }
  insertSegment(edgeIndex, segmentIndex, x, y) {
    this._insertEntry(edgeIndex, segmentIndex, this._key(x, y));
  }
  insertSegmentBounds(edgeIndex, segmentIndex, ax, ay, bx, by) {
    const minX = Math.floor(Math.min(ax, bx) * this.inv);
    const maxX = Math.floor(Math.max(ax, bx) * this.inv);
    const minY = Math.floor(Math.min(ay, by) * this.inv);
    const maxY = Math.floor(Math.max(ay, by) * this.inv);
    for (let cy = minY; cy <= maxY; cy++) {
      for (let cx = minX; cx <= maxX; cx++) {
        this._insertEntry(edgeIndex, segmentIndex, (cx * 73856093) ^ (cy * 19349663));
      }
    }
  }
  queryBounds(minWorldX, maxWorldX, minWorldY, maxWorldY, output) {
    const minX = Math.floor(minWorldX * this.inv);
    const maxX = Math.floor(maxWorldX * this.inv);
    const minY = Math.floor(minWorldY * this.inv);
    const maxY = Math.floor(maxWorldY * this.inv);
    let count = 0;
    for (let cy = minY; cy <= maxY && count < output.length; cy++) {
      for (let cx = minX; cx <= maxX && count < output.length; cx++) {
        const key = (cx * 73856093) ^ (cy * 19349663);
        let index = this.buckets.get(key);
        while (index !== undefined && index >= 0 && count < output.length) {
          output[count++] = index;
          index = this.next[index];
        }
      }
    }
    return count;
  }
  queryEntries(x, y, radius, output) {
    return this.queryBounds(x - radius, x + radius, y - radius, y + radius, output);
  }
  query(x, y, radius, output) {
    const count = this.queryEntries(x, y, radius, output);
    for (let i = 0; i < count; i++) {
      output[i] = this.entryEdge[output[i]];
    }
    return count;
  }
  getEdgeIndex(entry) {
    return this.entryEdge[entry];
  }
  getSegmentIndex(entry) {
    return this.entrySegment[entry];
  }
}

const dot = (ax, ay, bx, by) => ax * bx + ay * by;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class EdgeBundling2D {
  /**
   * @brief Constructs the edge bundling router.
   * @param model The GraphModel instance.
   * @param options Bundling configuration options.
   */
  constructor(model, options = {}) {
    this.model = model;
    this.options = { ...DEFAULTS, ...options };
    this.routes = [];
    this.pointCounts = new Int32Array(0);
    this.bundleIds = new Int32Array(0);
    this.bundleSizes = new Int32Array(0);
    this.highCountEdges = new Uint8Array(0); // Tracks edges that are part of high-count node pairs
    this.edgeChainIndex = new Int32Array(0); // Index of edge in its node pair (for chaining)
    this.edgePairSize = new Int32Array(0);   // Total edges in node pair (for chaining)
    this.routeRevision = 0;
    this.lastTopologyRevision = -1;
    this.lastPositionRevision = -1;
    this.dirty = true;
    this.grid = new SegmentGrid(this.options.bundleRadius, Math.max(256, model.linkCapacity * 2));
    this.candidates = new Int32Array(Math.max(256, this.options.maxBundlePairs));
    this.onUpdated = null;
  }

  setOptions(options = {}) {
    Object.assign(this.options, options);
    if (options.bundleRadius) {
      this.grid.cellSize = options.bundleRadius;
    }

    if (options.maxBundlePairs && options.maxBundlePairs !== this.candidates.length) {
      this.candidates = new Int32Array(Math.max(16, options.maxBundlePairs));
    }
    this.markDirty();
  }
  markDirty() {
    this.dirty = true;
  }
  clear() {
    this.routes.length = 0;
    this.pointCounts = new Int32Array(0);
    this.bundleIds = new Int32Array(0);
    this.bundleSizes = new Int32Array(0);
    this.highCountEdges = new Uint8Array(0);
    this.dirty = false;
    this.routeRevision++;
  }
  _ensureLinkCapacity() {
    const count = this.model.linkCount;
    if (this.pointCounts.length >= count) {
      return;
    }
    this.pointCounts = new Int32Array(Math.max(count, this.pointCounts.length * 2 || 16));
    this.bundleIds = new Int32Array(this.pointCounts.length);
    this.bundleSizes = new Int32Array(this.pointCounts.length);
  }

  _initializeRoutes() {
    const m = this.model;
    const opt = this.options;
    const subdivisions = Math.max(2, Math.floor(opt.bundleSubdivisions));
    this._ensureLinkCapacity();
    this.routes.length = m.linkCount;
    for (let e = 0; e < m.linkCount; e++) {
      const a = m.source[e];
      const b = m.target[e];
      const ax = m.x[a];
      const ay = m.y[a];
      const bx = m.x[b];
      const by = m.y[b];
      
      // Determine start and end points for the edge
      let startX, startY, endX, endY;
      
      // If edge bundling is enabled and this edge is part of a high-count node pair (>= thresholdNodes edges),
      // use chaining: edges form a path A -> P0 -> P1 -> ... -> P_{N-1} -> B
      if (this.options.edgeBundling && this.highCountEdges[e]) {
        const i = this.edgeChainIndex[e]; // index of this edge in the pair (0 to N-1)
        const N = this.edgePairSize[e];   // total number of edges in the node pair
        
        // Chaining points: P_k = A + (B - A) * (k + 1) / (N + 2) for k = 0 to N
        // Edge i connects P_i to P_{i+1}
        const factorStart = (i + 1) / (N + 2);
        const factorEnd   = (i + 2) / (N + 2);
        
        startX = ax * (1 - factorStart) + bx * factorStart;
        startY = ay * (1 - factorStart) + by * factorStart;
        endX   = ax * (1 - factorEnd)   + bx * factorEnd;
        endY   = ay * (1 - factorEnd)   + by * factorEnd;
      } else {
        // Normal behavior: edge runs from near A to near B
        const dx = bx - ax;
        const dy = by - ay;
        const length = Math.hypot(dx, dy) || 1;
        const nx = dx / length;
        const ny = dy / length;
        const startDistance = Math.min(m.radius[a], length * 0.45);
        const endDistance = Math.min(m.radius[b], length * 0.45);
        
        startX = ax + nx * startDistance;
        startY = ay + ny * startDistance;
        endX   = bx - nx * endDistance;
        endY   = by - ny * endDistance;
      }
      
      // Now compute the edge vector from start to end
      const dx = endX - startX;
      const dy = endY - startY;
      const length = Math.hypot(dx, dy) || 1;
      const nx = dx / length;
      const ny = dy / length;
      
      const count = opt.bundleShortEdges || length >= opt.nodeSeparationLength * 2 ? subdivisions + 1 : 2;
      const route = new Float32Array(count * 2);
      this.pointCounts[e] = count;
      for (let p = 0; p < count; p++) {
        let t = p / (count - 1);
        if (p > 0 && p < count - 1 && count > 2 && length > opt.nodeSeparationLength * 2) {
          const minT = opt.nodeSeparationLength / length;
          t = clamp(t, minT, 1 - minT);
        }
        let px = startX + dx * t;
        let py = startY + dy * t;
        route[p * 2] = px;
        route[p * 2 + 1] = py;
      }
      this.routes[e] = route;
      this.bundleIds[e] = -1;
      this.bundleSizes[e] = 1;
    }
  }

  _segmentCompatibility(a, b) {
    const m = this.model;
    const routeA = this.routes[a];
    const routeB = this.routes[b];
    const ca = this.pointCounts[a];
    const cb = this.pointCounts[b];
    const sa = m.source[a];
    const ta = m.target[a];
    const sb = m.source[b];
    const tb = m.target[b];
    if (!routeA || !routeB || ca < 2 || cb < 2) {
      return 0;
    }

    if (this.options.avoidSharedNodes && (sa === sb || sa === tb || ta === sb || ta === tb)) {
      return 0;
    }
    const avx = routeA[(ca - 1) * 2] - routeA[0];
    const avy = routeA[(ca - 1) * 2 + 1] - routeA[1];
    const bvx = routeB[(cb - 1) * 2] - routeB[0];
    const bvy = routeB[(cb - 1) * 2 + 1] - routeB[1];
    const al = Math.hypot(avx, avy) || 1;
    const bl = Math.hypot(bvx, bvy) || 1;
    const orientation = Math.abs(dot(avx / al, avy / al, bvx / bl, bvy / bl));
    const lengthSimilarity = Math.min(al, bl) / Math.max(al, bl);
    const amx = (routeA[0] + routeA[(ca - 1) * 2]) * 0.5;
    const amy = (routeA[1] + routeA[(ca - 1) * 2 + 1]) * 0.5;
    const bmx = (routeB[0] + routeB[(cb - 1) * 2]) * 0.5;
    const bmy = (routeB[1] + routeB[(cb - 1) * 2 + 1]) * 0.5;
    const midpointDistance = Math.hypot(amx - bmx, amy - bmy);
    if (midpointDistance > this.options.bundleRadius) {
      return 0;
    }
    return orientation * lengthSimilarity * (1 - midpointDistance / this.options.bundleRadius);
  }

  _buildSegmentGrid() {
    this.grid.clear();
    this.grid.ensure(this.model.linkCount * Math.max(2, this.options.bundleSubdivisions));
    for (let e = 0; e < this.model.linkCount; e++) {
      const route = this.routes[e];
      const count = this.pointCounts[e];
      for (let p = 0; p < count - 1; p++) {
        const offset = p * 2;
        const next = offset + 2;
        this.grid.insertSegment(e, p, (route[offset] + route[next]) * 0.5, (route[offset + 1] + route[next + 1]) * 0.5);
      }
    }
  }

  _applyBundling() {
    const m = this.model;
    const opt = this.options;
    const pairLimit = Math.min(opt.maxBundlePairs, this.candidates.length);
    for (let iteration = 0; iteration < opt.bundleIterations; iteration++) {
      this._buildSegmentGrid();
      let pairs = 0;
      for (let a = 0; a < m.linkCount && pairs < pairLimit; a++) {
        const routeA = this.routes[a];
        const countA = this.pointCounts[a];
        for (let p = 1; p < countA - 1 && pairs < pairLimit; p++) {
          const offset = p * 2;
          const candidates = this.grid.query(routeA[offset], routeA[offset + 1], opt.bundleRadius, this.candidates);
          for (let c = 0; c < candidates && pairs < pairLimit; c++) {
            const b = this.candidates[c];
            if (b <= a || this.bundleSizes[a] >= opt.maxBundleSize || this.bundleSizes[b] >= opt.maxBundleSize) {
              continue;
            }
            const compatibility = this._segmentCompatibility(a, b);
            if (compatibility < opt.bundleCompatibility) {
              continue;
            }
            pairs++;
            const routeB = this.routes[b];
            const countB = this.pointCounts[b];
            const q = Math.min(countB - 2, Math.max(1, Math.round((p / Math.max(1, countA - 1)) * (countB - 1))));
            const bo = q * 2;
            const strength = (opt.bundleStrength * compatibility) / Math.max(1, opt.bundleIterations);
            const nx = routeA[offset] + (routeB[bo] - routeA[offset]) * strength;
            const ny = routeA[offset + 1] + (routeB[bo + 1] - routeA[offset + 1]) * strength;
            routeA[offset] = nx;
            routeA[offset + 1] = ny;
            routeB[bo] += (nx - routeB[bo]) * 0.5;
            routeB[bo + 1] += (ny - routeB[bo + 1]) * 0.5;
            this.bundleSizes[a] = Math.min(opt.maxBundleSize, this.bundleSizes[a] + 1);
            this.bundleSizes[b] = Math.min(opt.maxBundleSize, this.bundleSizes[b] + 1);
          }
        }
      }
    }
  }

  _smoothAndAvoidNodes() {
    const m = this.model;
    const opt = this.options;
    for (let e = 0; e < m.linkCount; e++) {
      const route = this.routes[e];
      const count = this.pointCounts[e];
      if (count < 3) {
        continue;
      }
      const source = m.source[e];
      const target = m.target[e];
      for (let p = 1; p < count - 1; p++) {
        const o = p * 2;
        const prev = o - 2;
        const next = o + 2;
        route[o] = route[o] * 0.55 + (route[prev] + route[next]) * 0.225;
        route[o + 1] = route[o + 1] * 0.55 + (route[prev + 1] + route[next + 1]) * 0.225;
        if (opt.avoidNodeInteriors) {
          let dx = route[o] - m.x[source];
          let dy = route[o + 1] - m.y[source];
          let d = Math.hypot(dx, dy) || 1;
          const min = m.radius[source] + 1;
          if (d < min) {
            route[o] = m.x[source] + (dx / d) * min;
            route[o + 1] = m.y[source] + (dy / d) * min;
          }
          dx = route[o] - m.x[target];
          dy = route[o + 1] - m.y[target];
          d = Math.hypot(dx, dy) || 1;
          const targetMin = m.radius[target] + 1;
          if (d < targetMin) {
            route[o] = m.x[target] + (dx / d) * targetMin;
            route[o + 1] = m.y[target] + (dy / d) * targetMin;
          }
}
    }
    this._restoreEndpointsHighCountAware(e);
  }
  }

  _restoreEndpoints(e) {
    const m = this.model;
    const route = this.routes[e];
    const count = this.pointCounts[e];
    const a = m.source[e];
    const b = m.target[e];
    let dx = m.x[b] - m.x[a];
    let dy = m.y[b] - m.y[a];
    const length = Math.hypot(dx, dy) || 1;
    dx /= length;
    dy /= length;
    route[0] = m.x[a] + dx * m.radius[a];
    route[1] = m.y[a] + dy * m.radius[a];
    route[(count - 1) * 2] = m.x[b] - dx * m.radius[b];
    route[(count - 1) * 2 + 1] = m.y[b] - dy * m.radius[b];
  }

  /**
   * @brief Updates which edges belong to high-count node pairs (>= thresholdNodes)
   *        and computes chaining parameters for those edges.
   */
  updateHighCountEdges() {
    const linkCount = this.model.linkCount;
    
    // Resize arrays if needed
    if (this.highCountEdges.length < linkCount) {
      this.highCountEdges = new Uint8Array(linkCount);
      this.edgeChainIndex = new Int32Array(linkCount);
      this.edgePairSize = new Int32Array(linkCount);
    } else {
      // Reset existing values
      for (let i = 0; i < linkCount; i++) {
        this.highCountEdges[i] = 0;
        this.edgeChainIndex[i] = 0;
        this.edgePairSize[i] = 0;
      }
    }
    
    // Count edges per undirected node pair and collect edge indices
    const pairToEdges = new Map(); // key -> list of edge indices
    
    for (let e = 0; e < linkCount; e++) {
      const source = this.model.source[e];
      const target = this.model.target[e];
      const key = `${Math.min(source, target)}-${Math.max(source, target)}`;
      if (!pairToEdges.has(key)) {
        pairToEdges.set(key, []);
      }
      pairToEdges.get(key).push(e);
    }
    
    // For each node pair with count >= thresholdNodes, mark edges and set chaining parameters
    for (const [key, edges] of pairToEdges.entries()) {
      const N = edges.length;
      if (N >= this.options.thresholdNodes) {
        // Assign indices to edges in this pair (using the order they were added)
        for (let i = 0; i < N; i++) {
          const e = edges[i];
          this.highCountEdges[e] = 1;
          this.edgeChainIndex[e] = i;
          this.edgePairSize[e] = N;
        }
      }
    }
  }

  /**
   * @brief Restores edge endpoints to node perimeters, skipping high-count edges
   */
  _restoreEndpointsHighCountAware() {
    const m = this.model;
    for (let e = 0; e < m.linkCount; e++) {
      // Skip endpoint fixing for high-count edges
      if (this.highCountEdges[e]) {
        continue;
      }
      
      const route = this.routes[e];
      const count = this.pointCounts[e];
      const a = m.source[e];
      const b = m.target[e];
      let dx = m.x[b] - m.x[a];
      let dy = m.y[b] - m.y[a];
      const length = Math.hypot(dx, dy) || 1;
      dx /= length;
      dy /= length;
      route[0] = m.x[a] + dx * m.radius[a];
      route[1] = m.y[a] + dy * m.radius[a];
      route[(count - 1) * 2] = m.x[b] - dx * m.radius[b];
      route[(count - 1) * 2 + 1] = m.y[b] - dy * m.radius[b];
    }
  }

  rebuild() {
    // Clear existing routing data
    this.clear();
    
    // If edge bundling is disabled, return early
    if (!this.options.edgeBundling) {
      return;
    }
    
    // Initialize routes for each edge (set up initial spline points)
    this._initializeRoutes();
    
    // Update which edges are part of high-count node pairs (>= thresholdNodes)
    this.updateHighCountEdges();
    
    // Apply bundling iterations to pull compatible edges together
    this._applyBundling();
    
    // Smooth the routes and prevent edges from going through nodes
    this._smoothAndAvoidNodes();
    
    // Restore endpoints with high-count awareness
    this._restoreEndpointsHighCountAware();
    
    // Increment route revision to indicate changes
    this.routeRevision++;
  }

  updateIfNeeded(force = false) {
    if (force || this.dirty || this.lastTopologyRevision !== this.model.topologyRevision || this.lastPositionRevision !== this.model.positionRevision) {
      this.rebuild();
    }
    return this;
  }
  getPointCount(index) {
    return this.pointCounts[index] || 0;
  }
  getRoute(index) {
    return this.routes[index] || null;
  }
  getRouteSnapshot(index) {
    const route = this.getRoute(index);
    return route ? new Float32Array(route) : null;
  }
  getBundleInfo(index) {
    return {
      linkIndex: index,
      bundleId: this.bundleIds[index] ?? -1,
      bundleSize: this.bundleSizes[index] || 1,
      mode: this.options.bundleRenderMode,
      pointCount: this.pointCounts[index] || 0,
    };
  }
}
