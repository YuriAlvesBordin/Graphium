import { NODE_DRAGGED, NODE_FIXED } from '../core/GraphModel.js';
import { EdgeConflictDetector2D } from './EdgeConflict2D.js';

const DEFAULTS = {
  damping: 0.88,
  maxSpeed: 1200,
  gravity: 0.003,
  repulsion: 900,
  degreeFactor: 0.05,
  degreeExponent: 0.75,
  repulsionRadius: 180,
  physicalRadiusScale: 1,
  collisionStrength: 1,
  positionIterations: 3,
  springStrength: 0.08,
  temperature: 1,
  cooling: 0.995,
  minTemperature: 0.02,
  sleepEnergy: 0.0008,
  sleepFrames: 45,
  maxNeighbors: 256,
  fixedDt: 1 / 60,
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
  edgeConflictCellSize: 48,
  edgeConflictEvents: false,
  edgeConflictRebuildThreshold: 1,
};

const inverseMassFor = (flags, mass, index) => (flags[index] & (NODE_FIXED | NODE_DRAGGED) ? 0 : 1 / Math.max(0.0001, mass[index]));

export class Physics2D {
  /**
   * @brief Constructs the physics engine.
   * @param model The GraphModel instance.
   * @param spatialHash The SpatialHash2D instance.
   * @param options Physics configuration options.
   */
  constructor(model, spatialHash, options = {}) {
    this.model = model;
    this.spatialHash = spatialHash;
    this.options = { ...DEFAULTS, ...options };
    this.temperature = this.options.temperature;
    this.energy = Infinity;
    this.sleepCounter = 0;
    this.sleeping = false;
    this.iteration = 0;
    this.neighbors = new Int32Array(Math.max(256, this.options.maxNeighbors));
    this.edgeConflicts = new EdgeConflictDetector2D(model, this.options);
    this.edgeConflictEnergy = 0;
    this.edgeConflictFrame = 0;
    this.onEdgeConflict = null;
    this.onEdgeConflictSolved = null;
    this.edgeConflicts.onConflict = (...args) => {
      if (this.onEdgeConflict) {
        this.onEdgeConflict(...args);
      }
    };
    this.edgeConflicts.onSolved = (...args) => {
      if (this.onEdgeConflictSolved) {
        this.onEdgeConflictSolved(...args);
      }
    };
    this.lastTopologyRevision = -1;
    this.onSleep = null;
    this.onWake = null;
  }

  setOptions(options = {}) {
    Object.assign(this.options, options);
    if (options.temperature !== undefined) {
      this.temperature = options.temperature;
    }

    if (options.maxNeighbors && options.maxNeighbors !== this.neighbors.length) {
      this.neighbors = new Int32Array(Math.max(16, options.maxNeighbors));
    }

    if (options.repulsionRadius || options.cellSize) {
      this.spatialHash.setCellSize(options.cellSize || options.repulsionRadius || this.spatialHash.cellSize);
    }
    this.edgeConflicts.setOptions(options);
    this.wake();
  }

  wake() {
    const wasSleeping = this.sleeping;
    this.sleeping = false;
    this.sleepCounter = 0;
    if (wasSleeping && this.onWake) {
      this.onWake();
    }
  }

    getConflictDiagnostics() {
    return { ...this.edgeConflicts.debug };
  }
  measureConflictEnergy() {
    return this.edgeConflicts.measure();
  }

  reset() {
    const m = this.model;
    for (let i = 0; i < m.nodeCount; i++) {
      m.px[i] = m.x[i];
      m.py[i] = m.y[i];
      m.vx[i] = 0;
      m.vy[i] = 0;
    }
    this.temperature = this.options.temperature;
    this.wake();
  }

  _clearForces() {
    const m = this.model;
    m.fx.fill(0, 0, m.nodeCount);
    m.fy.fill(0, 0, m.nodeCount);
  }

  _applyCenterGravity() {
    const m = this.model;
    const gravity = this.options.gravity;
    for (let i = 0; i < m.nodeCount; i++) {
      const inv = inverseMassFor(m.flags, m.mass, i);
      if (inv === 0) {
        continue;
      }
      m.fx[i] -= m.x[i] * gravity;
      m.fy[i] -= m.y[i] * gravity;
    }
  }

  _applyRepulsionAndCollisions() {
    const m = this.model;
    const opt = this.options;
    this.spatialHash.rebuild(m.x, m.y, m.nodeCount, undefined);
    const radius = opt.repulsionRadius;
    for (let i = 0; i < m.nodeCount; i++) {
      if (m.flags[i] & 8) {
        continue;
      }
      const neighborCount = this.spatialHash.queryRadiusInto(m.x[i], m.y[i], radius, this.neighbors);
      const degreeFactorI = 1 + opt.degreeFactor * Math.pow(Math.max(0, m.degree[i]), opt.degreeExponent);
      for (let k = 0; k < neighborCount; k++) {
        const j = this.neighbors[k];
        if (j <= i || m.flags[j] & 8) {
          continue;
        }
        let dx = m.x[j] - m.x[i];
        let dy = m.y[j] - m.y[i];
        let distanceSq = dx * dx + dy * dy;
        if (distanceSq < 1e-10) {
          dx = 0.0001 * (i & 1 ? 1 : -1);
          dy = 0.0001;
          distanceSq = dx * dx + dy * dy;
        }
        const distance = Math.sqrt(distanceSq);
        if (distanceSq > radius * radius) {
          continue;
        }
        const degreeFactorJ = 1 + opt.degreeFactor * Math.pow(Math.max(0, m.degree[j]), opt.degreeExponent);
        const force = (opt.repulsion * Math.sqrt(degreeFactorI * degreeFactorJ)) / Math.max(4, distanceSq);
        const nx = dx / distance;
        const ny = dy / distance;
        const invI = inverseMassFor(m.flags, m.mass, i);
        const invJ = inverseMassFor(m.flags, m.mass, j);
        if (invI > 0) {
          m.fx[i] -= nx * force;
          m.fy[i] -= ny * force;
        }

        if (invJ > 0) {
          m.fx[j] += nx * force;
          m.fy[j] += ny * force;
        }
      }
    }
  }

  _applySprings() {
    const m = this.model;
    const opt = this.options;
    for (let e = 0; e < m.linkCount; e++) {
      if (m.linkFlags[e] & 2) {
        continue;
      }
      const a = m.source[e];
      const b = m.target[e];
      let dx = m.x[b] - m.x[a];
      let dy = m.y[b] - m.y[a];
      const distance = Math.hypot(dx, dy) || 0.0001;
      const extension = distance - m.restLength[e];
      const strength = m.linkStrength[e] * opt.springStrength;
      const force = extension * strength;
      dx /= distance;
      dy /= distance;
      const invA = inverseMassFor(m.flags, m.mass, a);
      const invB = inverseMassFor(m.flags, m.mass, b);
      if (invA > 0) {
        m.fx[a] += dx * force;
        m.fy[a] += dy * force;
      }

      if (invB > 0) {
        m.fx[b] -= dx * force;
        m.fy[b] -= dy * force;
      }
    }
  }

  _integrate(dt) {
    const m = this.model;
    const opt = this.options;
    const dtSq = dt * dt;
    const damping = Math.pow(opt.damping, dt * 60);
    const temperature = Math.max(opt.minTemperature, this.temperature);
    let energy = 0;
    for (let i = 0; i < m.nodeCount; i++) {
      const fixed = (m.flags[i] & (NODE_FIXED | NODE_DRAGGED)) !== 0;
      if (fixed) {
        m.px[i] = m.x[i];
        m.py[i] = m.y[i];
        m.vx[i] = 0;
        m.vy[i] = 0;
        continue;
      }
      const oldX = m.x[i];
      const oldY = m.y[i];
      const nextX = oldX + (oldX - m.px[i]) * damping + (m.fx[i] / Math.max(0.0001, m.mass[i])) * dtSq * temperature;
      const nextY = oldY + (oldY - m.py[i]) * damping + (m.fy[i] / Math.max(0.0001, m.mass[i])) * dtSq * temperature;
      m.px[i] = oldX;
      m.py[i] = oldY;
      m.x[i] = nextX;
      m.y[i] = nextY;
      let vx = (nextX - oldX) / dt;
      let vy = (nextY - oldY) / dt;
      const speed = Math.hypot(vx, vy);
      if (speed > opt.maxSpeed) {
        const scale = opt.maxSpeed / speed;
        vx *= scale;
        vy *= scale;
        m.x[i] = oldX + vx * dt;
        m.y[i] = oldY + vy * dt;
      }
      m.vx[i] = vx;
      m.vy[i] = vy;
      energy += vx * vx + vy * vy;
    }
    return m.nodeCount ? energy / m.nodeCount : 0;
  }

  _applyEdgeConflictCorrections() {
    if (!this.options.edgeRepulsionEnabled || this.model.linkCount < 2) {
      this.edgeConflictEnergy = 0;
      return 0;
    }
    this.edgeConflictFrame++;
    const cadence = Math.max(1, this.options.edgeConflictRebuildThreshold | 0);
    if (cadence > 1 && this.edgeConflictFrame % cadence !== 0) {
      return this.edgeConflictEnergy;
    }
    let energy = 0;
    const iterations = Math.max(1, this.options.edgeRepulsionIterations | 0);
    for (let i = 0; i < iterations; i++) {
      energy = this.edgeConflicts.apply();
    }
    this.edgeConflictEnergy = energy;
    if (this.edgeConflicts.persistentConflict && energy >= this.options.edgeConflictWakeThreshold) {
      this.sleepCounter = 0;
    }
    return energy;
  }

  _solveEdgeConstraints() {
    const m = this.model;
    const opt = this.options;
    for (let iteration = 0; iteration < opt.positionIterations; iteration++) {
      for (let e = 0; e < m.linkCount; e++) {
        if (m.linkFlags[e] & 2) {
          continue;
        }
        const a = m.source[e];
        const b = m.target[e];
        let dx = m.x[b] - m.x[a];
        let dy = m.y[b] - m.y[a];
        const distance = Math.hypot(dx, dy) || 0.0001;
        const invA = inverseMassFor(m.flags, m.mass, a);
        const invB = inverseMassFor(m.flags, m.mass, b);
        const total = invA + invB;
        if (total === 0) {
          continue;
        }
        const correction = (((distance - m.restLength[e]) / distance) * m.linkStrength[e]) / total;
        const cx = dx * correction;
        const cy = dy * correction;
        if (invA > 0) {
          m.x[a] += cx * invA;
          m.y[a] += cy * invA;
        }

        if (invB > 0) {
          m.x[b] -= cx * invB;
          m.y[b] -= cy * invB;
        }
      }
      this.spatialHash.rebuild(m.x, m.y, m.nodeCount);
      for (let i = 0; i < m.nodeCount; i++) {
        const ri = m.radius[i] * opt.physicalRadiusScale;
        const count = this.spatialHash.queryRadiusInto(m.x[i], m.y[i], ri + opt.repulsionRadius * 0.08, this.neighbors);
        for (let k = 0; k < count; k++) {
          const j = this.neighbors[k];
          if (j <= i) {
            continue;
          }
          let dx = m.x[j] - m.x[i];
          let dy = m.y[j] - m.y[i];
          let distance = Math.hypot(dx, dy);
          if (distance < 1e-6) {
            dx = 1;
            dy = 0;
            distance = 1;
          }
          const minDistance = ri + m.radius[j] * opt.physicalRadiusScale;
          if (distance >= minDistance) {
            continue;
          }
          const invI = inverseMassFor(m.flags, m.mass, i);
          const invJ = inverseMassFor(m.flags, m.mass, j);
          const total = invI + invJ;
          if (!total) {
            continue;
          }
          const correction = ((minDistance - distance) / distance) * opt.collisionStrength;
          if (invI > 0) {
            m.x[i] -= (dx * correction * invI) / total;
            m.y[i] -= (dy * correction * invI) / total;
          }

          if (invJ > 0) {
            m.x[j] += (dx * correction * invJ) / total;
            m.y[j] += (dy * correction * invJ) / total;
          }
        }
      }
    }
  }

  /**
   * @brief Advances the physics simulation by one time step.
   * @param dt The time delta in seconds.
   * @return The calculated kinetic energy of the system.
   */
  step(dt = 1 / 60) {
    if (this.sleeping || this.model.nodeCount === 0) {
      return this.energy;
    }
    const delta = Math.min(0.05, Math.max(0.001, Number(dt) || this.options.fixedDt));
    if (this.lastTopologyRevision !== this.model.topologyRevision) {
      this.spatialHash.ensureNodeCapacity(this.model.nodeCount);
      this.lastTopologyRevision = this.model.topologyRevision;
      this.wake();
    }
    this._clearForces();
    this._applyCenterGravity();
    this._applyRepulsionAndCollisions();
    this._applySprings();
    this.energy = this._integrate(delta);
    const previousConflictEnergy = this.edgeConflictEnergy;
    this._applyEdgeConflictCorrections();
    this._solveEdgeConstraints();
    this.temperature = Math.max(this.options.minTemperature, this.temperature * Math.pow(this.options.cooling, delta * 60));
    this.iteration++;
    const combinedEnergy = this.energy + this.edgeConflictEnergy * this.options.edgeConflictEnergyScale;
    if (combinedEnergy < this.options.sleepEnergy && this.edgeConflictEnergy <= this.options.edgeConflictSleepThreshold) {
      this.sleepCounter++;
    } else {
      this.sleepCounter = 0;
    }

    if (previousConflictEnergy >= this.options.edgeConflictWakeThreshold && this.edgeConflictEnergy < this.options.edgeConflictSleepThreshold && this.onEdgeConflictSolved) {
      this.onEdgeConflictSolved(this.edgeConflictEnergy);
    }

    if (this.sleepCounter >= this.options.sleepFrames) {
      this.sleeping = true;
      if (this.onSleep) {
        this.onSleep(this.energy);
      }
    }
    this.model.positionRevision++;
    return this.energy;
  }
}
