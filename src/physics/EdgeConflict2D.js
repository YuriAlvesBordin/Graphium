import { SegmentGrid } from './EdgeBundling2D.js';
import { NODE_DRAGGED, NODE_FIXED } from '../core/GraphModel.js';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

const DEFAULTS = {
  edgeRepulsionEnabled: true,
  edgeMinSeparation: 18,
  edgeRepulsionStrength: 0.8,
  edgeProximityStrength: 0.35,
  edgeAlignmentStrength: 0.5,
  crossingStrength: 1,
  crossingAngleStrength: 0.5,
  preferredCrossingAngle: Math.PI / 2,
  edgeRepulsionIterations: 2,
  edgeRepulsionMaxPairs: 10000,
  maxEdgeCorrection: 12,
  edgeConflictDamping: 0.85,
  preserveEdgeLength: 0.75,
  maxLengthRatio: 2.5,
  lengthStretchPenalty: 0.25,
  edgeConflictWakeThreshold: 0.2,
  edgeConflictSleepThreshold: 0.02,
  edgeConflictEnergyScale: 1,
  draggedNodeConflictWeight: 0.1,
  sharedEndpointExclusion: 0.18,
  edgeConflictUseBundledRoutes: false,
  edgeConflictCellSize: 48,
  debug: false,
  edgeConflictEvents: false,
};

function segmentMetrics(ax, ay, bx, by, cx, cy, dx, dy, out) {
  const abx = bx - ax;
  const aby = by - ay;
  const cdx = dx - cx;
  const cdy = dy - cy;
  const ab2 = abx * abx + aby * aby;
  const cd2 = cdx * cdx + cdy * cdy;
  const eps = 1e-12;
  const rpx = ax - cx;
  const rpy = ay - cy;
  const denom = ab2 * cd2 - (abx * cdx + aby * cdy) ** 2;
  let ta = 0;
  let tb = 0;
  if (denom > eps) {
    ta = clamp(((cx - ax) * cdx * ab2 - (cy - ay) * cdy * ab2 - (cx - ax) * abx * (abx * cdx + aby * cdy) - (cy - ay) * aby * (abx * cdx + aby * cdy)) / denom, 0, 1);
    tb = clamp((ta * (abx * cdx + aby * cdy) + (cx - ax) * cdx + (cy - ay) * cdy) / Math.max(cd2, eps), 0, 1);
  } else {
    ta = ab2 > eps ? clamp(((cx - ax) * abx + (cy - ay) * aby) / ab2, 0, 1) : 0;
    tb = cd2 > eps ? clamp(((ax + ta * abx - cx) * cdx + (ay + ta * aby - cy) * cdy) / cd2, 0, 1) : 0;
    ta = ab2 > eps ? clamp(((cx + tb * cdx - ax) * abx + (cy + tb * cdy - ay) * aby) / ab2, 0, 1) : 0;
  }
  const pax = ax + ta * abx;
  const pay = ay + ta * aby;
  const pbx = cx + tb * cdx;
  const pby = cy + tb * cdy;
  const separationX = pbx - pax;
  const separationY = pby - pay;
  const crossAB = abx * cdy - aby * cdx;
  const c1 = (cx - ax) * aby - (cy - ay) * abx;
  const c2 = (dx - ax) * aby - (dy - ay) * abx;
  const c3 = (ax - cx) * cdy - (ay - cy) * cdx;
  const c4 = (bx - cx) * cdy - (by - cy) * cdx;
  const intersects =
    (((c1 > eps && c2 < -eps) || (c1 < -eps && c2 > eps)) && ((c3 > eps && c4 < -eps) || (c3 < -eps && c4 > eps))) ||
    (Math.abs(c1) <= eps && Math.abs(c2) <= eps && Math.abs(c3) <= eps && Math.abs(c4) <= eps && ta >= 0 && ta <= 1 && tb >= 0 && tb <= 1);
  const lenA = Math.sqrt(Math.max(ab2, eps));
  const lenB = Math.sqrt(Math.max(cd2, eps));
  const alignment = Math.abs((abx * cdx + aby * cdy) / (lenA * lenB));
  const sine = Math.abs(crossAB) / (lenA * lenB);
  out[0] = separationX * separationX + separationY * separationY;
  out[1] = pax;
  out[2] = pay;
  out[3] = pbx;
  out[4] = pby;
  out[5] = ta;
  out[6] = tb;
  out[7] = intersects ? 1 : 0;
  out[8] = alignment;
  out[9] = sine;
  return out;
}

export class EdgeConflictDetector2D {
  /**
   * @brief Constructs the edge conflict detector.
   * @param model The GraphModel instance.
   * @param options Physics configuration options.
   */
  constructor(model, options = {}) {
    this.model = model;
    this.options = { ...DEFAULTS, ...options };
    this.routeProvider = null;
    this.grid = new SegmentGrid(this.options.edgeConflictCellSize, Math.max(256, model.linkCapacity * 4));
    this.segmentCapacity = Math.max(16, model.linkCapacity * 8);
    this.segmentEdge = new Int32Array(this.segmentCapacity);
    this.segmentLocal = new Int32Array(this.segmentCapacity);
    this.segmentAx = new Float32Array(this.segmentCapacity);
    this.segmentAy = new Float32Array(this.segmentCapacity);
    this.segmentBx = new Float32Array(this.segmentCapacity);
    this.segmentBy = new Float32Array(this.segmentCapacity);
    this.segmentSeen = new Int32Array(this.segmentCapacity);
    this.queryStamp = 0;
    this.queryEntries = new Int32Array(Math.max(256, this.options.edgeRepulsionMaxPairs));
    this.correctionX = new Float32Array(Math.max(8, model.nodeCapacity));
    this.correctionY = new Float32Array(Math.max(8, model.nodeCapacity));
    this.metrics = new Float64Array(10);
    this.pointA = new Float32Array(2);
    this.pointB = new Float32Array(2);
    this.normal = new Float32Array(2);
    this.debug = {
      edgeConflictPairs: 0,
      edgeCrossings: 0,
      maxEdgeCorrection: 0,
      edgeConflictEnergy: 0,
      edgeConflictTimeMs: 0,
    };
    this.lastEnergy = 0;
    this.previousEnergy = 0;
    this.persistentConflict = false;
    this.onConflict = null;
    this.onSolved = null;
  }

  setRouteProvider(provider) {
    this.routeProvider = provider;
    return this;
  }
  setOptions(options = {}) {
    Object.assign(this.options, options);
    if (options.edgeConflictCellSize) {
      this.grid.cellSize = Math.max(1, options.edgeConflictCellSize);
      this.grid.inv = 1 / this.grid.cellSize;
    }

    if (options.edgeRepulsionMaxPairs && options.edgeRepulsionMaxPairs !== this.queryEntries.length) {
      this.queryEntries = new Int32Array(Math.max(16, options.edgeRepulsionMaxPairs));
    }
    return this;
  }

  ensureNodeCapacity(required) {
    if (required <= this.correctionX.length) {
      return;
    }
    let capacity = this.correctionX.length;
    while (capacity < required) {
      capacity <<= 1;
    }
    const x = new Float32Array(capacity);
    x.set(this.correctionX);
    const y = new Float32Array(capacity);
    y.set(this.correctionY);
    this.correctionX = x;
    this.correctionY = y;
  }
  ensureSegmentCapacity(required) {
    if (required <= this.segmentCapacity) {
      return;
    }
    let capacity = this.segmentCapacity;
    while (capacity < required) {
      capacity <<= 1;
    }
    const edge = new Int32Array(capacity);
    edge.set(this.segmentEdge);
    const local = new Int32Array(capacity);
    local.set(this.segmentLocal);
    const ax = new Float32Array(capacity);
    ax.set(this.segmentAx);
    const ay = new Float32Array(capacity);
    ay.set(this.segmentAy);
    const bx = new Float32Array(capacity);
    bx.set(this.segmentBx);
    const by = new Float32Array(capacity);
    by.set(this.segmentBy);
    const seen = new Int32Array(capacity);
    seen.set(this.segmentSeen);
    this.segmentEdge = edge;
    this.segmentLocal = local;
    this.segmentAx = ax;
    this.segmentAy = ay;
    this.segmentBx = bx;
    this.segmentBy = by;
    this.segmentSeen = seen;
    this.segmentCapacity = capacity;
  }

  _routePoint(edge, pointIndex, out) {
    const m = this.model;
    const provider = this.routeProvider;
    if (this.options.edgeConflictUseBundledRoutes && provider && provider.getRoute && provider.getPointCount && provider.getPointCount(edge) > 1) {
      const route = provider.getRoute(edge);
      const offset = pointIndex * 2;
      out[0] = route[offset];
      out[1] = route[offset + 1];
      return;
    }
    const a = m.source[edge];
    const b = m.target[edge];
    const count = pointIndex === 0 ? 0 : 1;
    out[0] = count ? m.x[b] : m.x[a];
    out[1] = count ? m.y[b] : m.y[a];
  }

  _buildSegments() {
    const m = this.model;
    this.grid.clear();
    let count = 0;
    const a = this.pointA;
    const b = this.pointB;
    for (let e = 0; e < m.linkCount; e++) {
      if (m.linkFlags[e] & 2) {
        continue;
      }
      const pointCount = this.options.edgeConflictUseBundledRoutes && this.routeProvider?.getPointCount ? this.routeProvider.getPointCount(e) : 2;
      const segmentCount = Math.max(1, pointCount - 1);
      this.ensureSegmentCapacity(count + segmentCount);
      for (let p = 0; p < segmentCount; p++) {
        if (this.options.edgeConflictUseBundledRoutes && this.routeProvider?.getRoute(e)) {
          const route = this.routeProvider.getRoute(e);
          const ao = p * 2;
          const bo = ao + 2;
          a[0] = route[ao];
          a[1] = route[ao + 1];
          b[0] = route[bo];
          b[1] = route[bo + 1];
        } else {
          this._routePoint(e, 0, a);
          this._routePoint(e, 1, b);
        }
        this.segmentEdge[count] = e;
        this.segmentLocal[count] = p;
        this.segmentAx[count] = a[0];
        this.segmentAy[count] = a[1];
        this.segmentBx[count] = b[0];
        this.segmentBy[count] = b[1];
        this.grid.insertSegmentBounds(count, p, a[0], a[1], b[0], b[1]);
        count++;
      }
    }
    this.segmentCount = count;
    return count;
  }

  _inverseMass(index) {
    const m = this.model;
    const flags = m.flags[index];
    if (flags & NODE_FIXED) {
      return 0;
    }

    if (flags & NODE_DRAGGED) {
      return this.options.draggedNodeConflictWeight / Math.max(0.0001, m.mass[index]);
    }
    return 1 / Math.max(0.0001, m.mass[index]);
  }

  _sharedEndpointOnly(edgeA, edgeB, ta, tb) {
    const m = this.model;
    const a0 = m.source[edgeA];
    const a1 = m.target[edgeA];
    const b0 = m.source[edgeB];
    const b1 = m.target[edgeB];
    const shared = a0 === b0 || a0 === b1 || a1 === b0 || a1 === b1;
    if (!shared) {
      return false;
    }
    return (
      ta <= this.options.sharedEndpointExclusion ||
      ta >= 1 - this.options.sharedEndpointExclusion ||
      tb <= this.options.sharedEndpointExclusion ||
      tb >= 1 - this.options.sharedEndpointExclusion
    );
  }

  _normal(edgeA, edgeB, out) {
    const m = this.model;
    let nx = this.metrics[3] - this.metrics[1];
    let ny = this.metrics[4] - this.metrics[2];
    const length = Math.hypot(nx, ny);
    if (length > 1e-6) {
      nx /= length;
      ny /= length;
    } else {
      const a = m.source[edgeA];
      const b = m.target[edgeA];
      const dx = m.x[b] - m.x[a];
      const dy = m.y[b] - m.y[a];
      const d = Math.hypot(dx, dy) || 1;
      nx = -dy / d;
      ny = dx / d;
      if (((edgeA + edgeB) & 1) !== 0) {
        nx = -nx;
        ny = -ny;
      }
    }
    out[0] = nx;
    out[1] = ny;
  }

  _addEndpointCorrection(edge, t, nx, ny, magnitude, sign) {
    const m = this.model;
    const source = m.source[edge];
    const target = m.target[edge];
    const sourceWeight = this._inverseMass(source) * (1 - t);
    const targetWeight = this._inverseMass(target) * t;
    const sum = sourceWeight + targetWeight;
    if (sum <= 0) {
      return;
    }
    const sourceScale = (sourceWeight / sum) * magnitude * sign;
    const targetScale = (targetWeight / sum) * magnitude * sign;
    this.correctionX[source] += nx * sourceScale;
    this.correctionY[source] += ny * sourceScale;
    this.correctionX[target] += nx * targetScale;
    this.correctionY[target] += ny * targetScale;
  }

  _classifyAndCorrect(segmentA, segmentB, applyCorrections) {
    const edgeA = this.segmentEdge[segmentA];
    const edgeB = this.segmentEdge[segmentB];
    if (edgeA === edgeB) {
      return 0;
    }
    const localA = this.segmentLocal[segmentA];
    const localB = this.segmentLocal[segmentB];
    if (Math.abs(localA - localB) <= 1 && edgeA === edgeB) {
      return 0;
    }
    const m = this.model;
    this.metrics.fill(0);
    segmentMetrics(
      this.segmentAx[segmentA],
      this.segmentAy[segmentA],
      this.segmentBx[segmentA],
      this.segmentBy[segmentA],
      this.segmentAx[segmentB],
      this.segmentAy[segmentB],
      this.segmentBx[segmentB],
      this.segmentBy[segmentB],
      this.metrics
    );
    const distance = Math.sqrt(Math.max(0, this.metrics[0]));
    const ta = this.metrics[5];
    const tb = this.metrics[6];
    const intersects = this.metrics[7] > 0.5;
    const alignment = this.metrics[8];
    const sine = this.metrics[9];
    if (this._sharedEndpointOnly(edgeA, edgeB, ta, tb)) {
      return 0;
    }
    const minSeparation = Math.max(0.0001, this.options.edgeMinSeparation);
    const proximity = clamp((minSeparation - distance) / minSeparation);
    const overlap = proximity * alignment;
    const preferredSine = Math.max(0.0001, Math.abs(Math.sin(this.options.preferredCrossingAngle)));
    const anglePenalty = clamp((preferredSine - sine) / preferredSine);
    const crossingPenalty = intersects ? 1 : 0;
    const crossingTerm = crossingPenalty * this.options.crossingStrength * anglePenalty;
    const rawSeverity = proximity * this.options.edgeProximityStrength + overlap * this.options.edgeAlignmentStrength + crossingTerm;
    const severity = clamp(rawSeverity / Math.max(1, this.options.edgeProximityStrength + this.options.edgeAlignmentStrength + this.options.crossingStrength));
    if (severity <= 0) {
      return 0;
    }
    let type = intersects ? 'crossing' : overlap >= 0.5 ? 'overlap' : 'proximity';
    const lengthA = Math.hypot(m.x[m.target[edgeA]] - m.x[m.source[edgeA]], m.y[m.target[edgeA]] - m.y[m.source[edgeA]]);
    const lengthB = Math.hypot(m.x[m.target[edgeB]] - m.x[m.source[edgeB]], m.y[m.target[edgeB]] - m.y[m.source[edgeB]]);
    const ratioA = lengthA / Math.max(0.0001, m.restLength[edgeA]);
    const ratioB = lengthB / Math.max(0.0001, m.restLength[edgeB]);
    const lengthRatio = Math.max(ratioA, ratioB);
    const stretchProgress = clamp((lengthRatio - 1) / Math.max(0.0001, this.options.maxLengthRatio - 1));
    const lengthPreservation = 1 - clamp(this.options.preserveEdgeLength) * stretchProgress;
    const stretch = lengthRatio > this.options.maxLengthRatio ? this.options.lengthStretchPenalty : lengthPreservation;
    const magnitude =
      Math.min(severity * this.options.edgeRepulsionStrength * Math.max(this.options.lengthStretchPenalty, stretch), this.options.maxEdgeCorrection) *
      this.options.edgeConflictDamping;
    if (applyCorrections && magnitude > 0) {
      const normal = this.normal;
      this._normal(edgeA, edgeB, normal);
      const totalSegmentsA = Math.max(1, this._routeSegmentCount(edgeA));
      const totalSegmentsB = Math.max(1, this._routeSegmentCount(edgeB));
      const routeTA = clamp((localA + ta) / totalSegmentsA);
      const routeTB = clamp((localB + tb) / totalSegmentsB);
      this._addEndpointCorrection(edgeA, routeTA, normal[0], normal[1], magnitude, -1);
      this._addEndpointCorrection(edgeB, routeTB, normal[0], normal[1], magnitude, 1);
      if (intersects && this.options.crossingAngleStrength > 0) {
        const angleMagnitude = Math.min(magnitude * this.options.crossingAngleStrength * anglePenalty, this.options.maxEdgeCorrection * 0.5);
        this._addEndpointCorrection(edgeA, routeTA, -normal[1], normal[0], angleMagnitude, 1);
        this._addEndpointCorrection(edgeB, routeTB, -normal[1], normal[0], angleMagnitude, -1);
      }
    }

    if (this.options.edgeConflictEvents && this.onConflict) {
      this.onConflict(edgeA, edgeB, type, severity, distance, Math.asin(clamp(sine, -1, 1)));
    }

    if (type === 'crossing') {
      this.debug.edgeCrossings++;
    }
    return severity;
  }

  _routeSegmentCount(edge) {
    return this.options.edgeConflictUseBundledRoutes && this.routeProvider?.getPointCount ? Math.max(1, this.routeProvider.getPointCount(edge) - 1) : 1;
  }

  /**
   * @brief Evaluates current edge conflicts and optionally applies corrections.
   * @param applyCorrections True to apply spatial corrections, false for measurement only.
   * @return The calculated conflict energy.
   */
  evaluate(applyCorrections = false) {
    const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const m = this.model;
    this.ensureNodeCapacity(m.nodeCount);
    this.debug.edgeCrossings = 0;
    if (applyCorrections) {
      this.debug.maxEdgeCorrection = 0;
      this.correctionX.fill(0, 0, m.nodeCount);
      this.correctionY.fill(0, 0, m.nodeCount);
    }
    const segmentCount = this._buildSegments();
    let energy = 0;
    let pairs = 0;
    const maxPairs = Math.min(this.options.edgeRepulsionMaxPairs, this.queryEntries.length);
    for (let i = 0; i < segmentCount && pairs < maxPairs; i++) {
      this.queryStamp++;
      if (this.queryStamp >= 2147483647) {
        this.segmentSeen.fill(0, 0, segmentCount);
        this.queryStamp = 1;
      }
      const queryStamp = this.queryStamp;
      const cx = (this.segmentAx[i] + this.segmentBx[i]) * 0.5;
      const cy = (this.segmentAy[i] + this.segmentBy[i]) * 0.5;
      const queryRadius = this.options.edgeMinSeparation;
      const count = this.grid.queryBounds(
        Math.min(this.segmentAx[i], this.segmentBx[i]) - queryRadius,
        Math.max(this.segmentAx[i], this.segmentBx[i]) + queryRadius,
        Math.min(this.segmentAy[i], this.segmentBy[i]) - queryRadius,
        Math.max(this.segmentAy[i], this.segmentBy[i]) + queryRadius,
        this.queryEntries
      );
      for (let q = 0; q < count && pairs < maxPairs; q++) {
        const entry = this.queryEntries[q];
        const j = this.grid.getEdgeIndex(entry);
        if (j <= i || this.segmentSeen[j] === queryStamp) {
          continue;
        }
        this.segmentSeen[j] = queryStamp;
        pairs++;
        energy += this._classifyAndCorrect(i, j, applyCorrections);
      }
    }

    if (applyCorrections) {
      let maxCorrection = 0;
      for (let i = 0; i < m.nodeCount; i++) {
        let dx = this.correctionX[i];
        let dy = this.correctionY[i];
        const length = Math.hypot(dx, dy);
        if (length > this.options.maxEdgeCorrection) {
          const scale = this.options.maxEdgeCorrection / length;
          dx *= scale;
          dy *= scale;
        }

        if (length > maxCorrection) {
          maxCorrection = length;
        }
        const inv = this._inverseMass(i);
        if (inv > 0) {
          m.x[i] += dx;
          m.y[i] += dy;
        }
      }
      this.debug.maxEdgeCorrection = maxCorrection;
    }
    this.debug.edgeConflictPairs = pairs;
    this.debug.edgeConflictEnergy = energy;
    this.debug.edgeConflictTimeMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started;
    this.previousEnergy = this.lastEnergy;
    this.lastEnergy = energy;
    this.persistentConflict = energy >= this.options.edgeConflictWakeThreshold;
    return energy;
  }

  apply() {
    return this.evaluate(true);
  }
  measure() {
    return this.evaluate(false);
  }
}

export { segmentMetrics };
