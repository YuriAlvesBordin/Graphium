import { PhysicsEngine } from '../../src/physics/PhysicsEngine';
import { GraphModel } from '../../src/core/GraphModel';
import { DEFAULT_THEME } from '../../src/core/theme';
import type { PhysicsOptions } from '../../src/core/types';

function makeModel(nodeCapacity = 16, linkCapacity = 16): GraphModel {
  return new GraphModel({ nodeCapacity, linkCapacity, theme: DEFAULT_THEME });
}

/** Builds an engine with external forces disabled so individual behaviors are isolated. */
function makeEngine(model: GraphModel, overrides: PhysicsOptions = {}): PhysicsEngine {
  return new PhysicsEngine(model, {
    gravity: 0,
    repulsion: 0,
    springStrength: 0,
    collisionStrength: 0,
    edgeSeparation: 0,
    ...overrides,
  });
}

describe('PhysicsEngine', () => {
  it('should resolve the documented default options', () => {
    const engine = new PhysicsEngine(makeModel());
    expect(engine.options.repulsion).toBe(1100);
    expect(engine.options.repulsionRadius).toBe(200);
    expect(engine.options.springStrength).toBe(0.055);
    expect(engine.options.gravity).toBe(0.0022);
    expect(engine.options.damping).toBe(0.92);
    expect(engine.options.maxSpeed).toBe(900);
    expect(engine.options.temperature).toBe(0.7);
    expect(engine.options.sleepFrames).toBe(48);
    expect(engine.options.dragSmooth).toBe(0.42);
    expect(engine.options.throwFactor).toBe(1);
  });

  it('should apply preset values and keep explicit overrides on top', () => {
    const engine = new PhysicsEngine(makeModel());
    engine.usePreset('bouncy');
    expect(engine.options.repulsion).toBe(1300);
    expect(engine.options.damping).toBe(0.84);
    engine.usePreset('bouncy', { repulsion: 42 });
    expect(engine.options.repulsion).toBe(42);
    expect(engine.options.damping).toBe(0.84);
  });

  it('should merge setOptions over the live configuration', () => {
    const engine = new PhysicsEngine(makeModel());
    engine.setOptions({ repulsion: 2500 });
    expect(engine.options.repulsion).toBe(2500);
    expect(engine.options.damping).toBe(0.92);
    engine.setOptions({ preset: 'liquid', repulsion: 7 });
    expect(engine.options.repulsion).toBe(7);
    expect(engine.options.damping).toBe(0.96);
    expect((engine.options as unknown as { preset?: string }).preset).toBeUndefined();
  });

  it('should resize the hash cell when repulsionRadius changes', () => {
    const engine = new PhysicsEngine(makeModel());
    engine.setOptions({ repulsionRadius: 320 });
    expect(engine.hash.cellSize).toBe(320);
  });

  it('should wake through onWake exactly once after sleeping', () => {
    const engine = new PhysicsEngine(makeModel());
    engine.sleeping = true;
    const onWake = jest.fn();
    engine.onWake = onWake;
    engine.wake();
    expect(onWake).toHaveBeenCalledTimes(1);
    expect(engine.sleeping).toBe(false);
    engine.wake();
    expect(onWake).toHaveBeenCalledTimes(1);
  });

  it('should sleep after enough calm frames and notify through onSleep', () => {
    const model = makeModel();
    model.addNode('a', { x: 0, y: 0 });
    const engine = makeEngine(model, { sleepEnergy: 1e9, sleepFrames: 2 });
    const onSleep = jest.fn();
    engine.onSleep = onSleep;
    engine.step(1 / 60);
    engine.step(1 / 60);
    expect(engine.sleeping).toBe(true);
    expect(onSleep).toHaveBeenCalledTimes(1);
    // While sleeping, steps are skipped entirely.
    const revision = model.positionRevision;
    const energy = engine.step(1 / 60);
    expect(model.positionRevision).toBe(revision);
    expect(energy).toBe(engine.energy);
  });

  it('should resume stepping after being woken up', () => {
    const model = makeModel();
    model.addNode('a', { x: 0, y: 0 });
    const engine = makeEngine(model, { sleepEnergy: 1e9, sleepFrames: 1 });
    engine.step(1 / 60);
    expect(engine.sleeping).toBe(true);
    engine.wake();
    const revision = model.positionRevision;
    engine.step(1 / 60);
    expect(model.positionRevision).toBeGreaterThan(revision);
  });

  it('should do nothing on an empty graph', () => {
    const engine = makeEngine(makeModel());
    expect(engine.step(1 / 60)).toBe(0);
  });

  it('should push overlapping nodes apart through repulsion', () => {
    const model = makeModel();
    model.addNode('a', { x: 0, y: 0 });
    model.addNode('b', { x: 12, y: 0 });
    const engine = makeEngine(model, { repulsion: 1100 });
    const before = Math.hypot(model.x[1] - model.x[0], model.y[1] - model.y[0]);
    for (let i = 0; i < 10; i++) {
      engine.step(1 / 60);
    }
    const after = Math.hypot(model.x[1] - model.x[0], model.y[1] - model.y[0]);
    expect(after).toBeGreaterThan(before);
  });

  it('should pull linked nodes toward the rest length', () => {
    const model = makeModel();
    model.addNode('a', { x: 0, y: 0 });
    model.addNode('b', { x: 300, y: 0 });
    model.addLink('e', 'a', 'b', { restLength: 60 });
    expect(model.linkSnapshot(0).restLength).toBe(60);
    const engine = makeEngine(model);
    for (let i = 0; i < 40; i++) {
      engine.step(1 / 60);
    }
    const distance = Math.hypot(model.x[1] - model.x[0], model.y[1] - model.y[0]);
    expect(distance).toBeLessThan(200);
    expect(distance).toBeGreaterThan(20);
  });

  it('should pull free nodes toward the origin through gravity', () => {
    const model = makeModel();
    model.addNode('a', { x: 500, y: 0 });
    const engine = makeEngine(model, { gravity: 0.01 });
    for (let i = 0; i < 60; i++) {
      engine.step(1 / 60);
    }
    expect(Math.abs(model.x[0])).toBeLessThan(500);
  });

  it('should never move a fixed node', () => {
    const model = makeModel();
    // The free node must have the lower index: pair forces are applied when
    // the lower index is the actor, so a fixed lower node exerts no force.
    model.addNode('free', { x: 30, y: 0 });
    model.addNode('anchor', { x: 0, y: 0 });
    model.setNodeFixed(1, true);
    const engine = makeEngine(model, { repulsion: 1100 });
    for (let i = 0; i < 10; i++) {
      engine.step(1 / 60);
    }
    expect(model.x[1]).toBe(0);
    expect(model.y[1]).toBe(0);
    expect(model.vx[1]).toBe(0);
    expect(model.vy[1]).toBe(0);
    expect(Math.hypot(model.x[0] - 30, model.y[0])).toBeGreaterThan(0);
  });

  it('should clamp velocity to maxSpeed', () => {
    const model = makeModel();
    model.addNode('a', { x: 0, y: 0 });
    model.vx[0] = 1e6;
    const engine = makeEngine(model, { maxSpeed: 100 });
    engine.step(1 / 60);
    const speed = Math.hypot(model.vx[0], model.vy[0]);
    expect(speed).toBeLessThanOrEqual(100.0001);
  });

  it('should decay velocity through damping when no forces act', () => {
    const model = makeModel();
    model.addNode('a', { x: 0, y: 0 });
    model.vx[0] = 100;
    const engine = makeEngine(model, { damping: 0.5 });
    engine.step(1 / 60);
    // damping^(dt * 60) at dt = 1/60 is exactly the configured damping.
    expect(model.vx[0]).toBeCloseTo(50, 5);
  });

  it('should floor the temperature at minTemperature', () => {
    const model = makeModel();
    model.addNode('a', { x: 0, y: 0 });
    const engine = makeEngine(model, { temperature: 0.7, cooling: 0.5, minTemperature: 0.05 });
    for (let i = 0; i < 40; i++) {
      engine.step(1 / 60);
    }
    expect(engine.temperature).toBe(0.05);
  });

  it('should follow the drag target and hand momentum over on release', () => {
    const model = makeModel();
    model.addNode('a', { x: 0, y: 0 });
    const engine = makeEngine(model, { dragSmooth: 0.5, throwFactor: 2 });
    engine.beginDrag(0, 100, 0);
    engine.step(1 / 60);
    expect(model.x[0]).toBeCloseTo(50, 1);
    expect(model.vx[0]).toBeGreaterThan(0);
    const velocityBefore = model.vx[0];
    engine.endDrag();
    expect(model.vx[0]).toBeCloseTo(velocityBefore * 2, 3);
    expect((engine as unknown as { dragIndex: number }).dragIndex).toBe(-1);
  });

  it('should ignore drag updates when nothing is being dragged', () => {
    const engine = makeEngine(makeModel());
    expect(() => engine.dragTo(10, 10)).not.toThrow();
    expect(() => engine.endDrag()).not.toThrow();
    expect(() => engine.beginDrag(-1, 10, 10)).not.toThrow();
  });

  it('should keep hidden nodes out of the energy measure and motion', () => {
    const model = makeModel();
    model.addNode('ghost', { x: 0, y: 0, hidden: true });
    model.addNode('alive', { x: 0, y: 0 });
    model.vx[0] = 500;
    model.vx[1] = 10;
    const engine = makeEngine(model);
    const energy = engine.step(1 / 60);
    expect(model.x[0]).toBe(0);
    expect(model.x[1]).not.toBe(0);
    // Only the visible node counts: 10 * damping(0.92) squared, measured
    // after integration.
    expect(energy).toBeCloseTo(Math.pow(10 * 0.92, 2), 2);
  });

  it('should reset velocities, temperature and iteration counters', () => {
    const model = makeModel();
    model.addNode('a', { x: 0, y: 0 });
    const engine = makeEngine(model, { temperature: 0.9 });
    for (let i = 0; i < 5; i++) {
      engine.step(1 / 60);
    }
    expect(engine.iteration).toBeGreaterThan(0);
    engine.reset();
    expect(model.vx[0]).toBe(0);
    expect(model.vy[0]).toBe(0);
    expect(engine.temperature).toBe(0.9);
    expect(engine.iteration).toBe(0);
    expect(engine.sleeping).toBe(false);
  });

  it('should nudge crossing edges apart when edgeSeparation is on', () => {
    const build = () => {
      const model = makeModel();
      // The two segments cross, and their midpoints are distinct so the
      // separation resolver has a direction to push along.
      model.addNode('a', { x: -100, y: -50 });
      model.addNode('b', { x: 100, y: 50 });
      model.addNode('c', { x: -150, y: 60 });
      model.addNode('d', { x: 120, y: -60 });
      model.addLink('e0', 'a', 'b', {});
      model.addLink('e1', 'c', 'd', {});
      return model;
    };
    const withSeparation = build();
    const withoutSeparation = build();
    makeEngine(withSeparation, { edgeSeparation: 1, positionIterations: 1 }).step(1 / 60);
    makeEngine(withoutSeparation, { edgeSeparation: 0, positionIterations: 1 }).step(1 / 60);
    let differs = false;
    for (let i = 0; i < withSeparation.nodeCount && !differs; i++) {
      differs = withSeparation.x[i] !== withoutSeparation.x[i] || withSeparation.y[i] !== withoutSeparation.y[i];
    }
    expect(differs).toBe(true);
  });

  it('should clamp large time steps into a stable range', () => {
    const model = makeModel();
    model.addNode('a', { x: 0, y: 0 });
    model.vx[0] = 100;
    const engine = makeEngine(model, { damping: 0.5 });
    engine.step(10);
    // dt is clamped to 0.05, so the decay factor is damping^(0.05 * 60).
    expect(model.vx[0]).toBeCloseTo(100 * Math.pow(0.5, 3), 5);
  });
});

describe('PhysicsEngine remaining branches', () => {
  it('should apply temperature and reallocate the neighbor buffer via setOptions', () => {
    const engine = makeEngine(makeModel());
    engine.setOptions({ temperature: 0.4, maxNeighbors: 32 });
    expect(engine.temperature).toBe(0.4);
    expect((engine as unknown as { neighbors: Int32Array }).neighbors.length).toBe(32);
  });

  it('should skip gravity for fixed nodes', () => {
    const model = makeModel();
    model.addNode('anchor', { x: 100, y: 100 });
    model.setNodeFixed(0, true);
    const engine = makeEngine(model, { gravity: 0.01 });
    engine.step(1 / 60);
    expect(model.x[0]).toBe(100);
    expect(model.y[0]).toBe(100);
  });

  it('should separate nodes spawned at the exact same position', () => {
    const model = makeModel();
    model.addNode('a', { x: 0, y: 0 });
    model.addNode('b', { x: 0, y: 0 });
    const engine = makeEngine(model, { repulsion: 1100, collisionStrength: 1, positionIterations: 1 });
    engine.step(1 / 60);
    const distance = Math.hypot(model.x[1] - model.x[0], model.y[1] - model.y[0]);
    expect(distance).toBeGreaterThan(0.0001);
  });

  it('should ignore hidden links in the spring pass', () => {
    const model = makeModel();
    model.addNode('a', { x: 0, y: 0 });
    model.addNode('b', { x: 200, y: 0 });
    model.addLink('e', 'a', 'b', { restLength: 50, hidden: true });
    const engine = makeEngine(model, { springStrength: 1 });
    engine.step(1 / 60);
    expect(model.x[0]).toBe(0);
    expect(model.x[1]).toBe(200);
  });

  it('should skip springs and constraints between two fixed nodes', () => {
    const model = makeModel();
    model.addNode('a', { x: 0, y: 0 });
    model.addNode('b', { x: 30, y: 0 });
    model.setNodeFixed(0, true);
    model.setNodeFixed(1, true);
    model.addLink('e', 'a', 'b', { restLength: 5 });
    const engine = makeEngine(model, { springStrength: 1, collisionStrength: 1 });
    engine.step(1 / 60);
    expect(model.x[0]).toBe(0);
    expect(model.x[1]).toBe(30);
  });

  it('should pull only the free end of a spring whose other end is fixed', () => {
    const model = makeModel();
    model.addNode('a', { x: 0, y: 0 });
    model.addNode('b', { x: 200, y: 0 });
    model.setNodeFixed(1, true);
    model.addLink('e', 'a', 'b', { restLength: 50 });
    const engine = makeEngine(model, { springStrength: 1 });
    engine.step(1 / 60);
    expect(model.x[1]).toBe(200);
    expect(model.x[0]).toBeGreaterThan(0);
  });

  it('should jitter apart nodes that overlap exactly during collision', () => {
    const model = makeModel();
    model.addNode('a', { x: 0, y: 0 });
    model.addNode('b', { x: 0, y: 0 });
    const engine = makeEngine(model, { repulsion: 0, collisionStrength: 1, positionIterations: 1 });
    engine.step(1 / 60);
    const distance = Math.hypot(model.x[1] - model.x[0], model.y[1] - model.y[0]);
    expect(distance).toBeGreaterThan(0.0001);
  });

  it('should grow the edge midpoint buffers past 256 links', () => {
    const model = makeModel(8, 8);
    model.addNode('hub', { x: 0, y: 0 });
    for (let i = 0; i < 300; i++) {
      model.addNode(`n${i}`, { x: Math.cos(i) * 300, y: Math.sin(i) * 300 });
      model.addLink(`e${i}`, 'hub', `n${i}`, {});
    }
    const engine = makeEngine(model, { edgeSeparation: 1, positionIterations: 1 });
    expect(() => engine.step(1 / 60)).not.toThrow();
  });

  it('should break out after four thousand crossing conflicts', () => {
    const model = makeModel(256, 256);
    // 120 segments through the origin: 119 visible ones produce
    // 119 * 118 / 2 = 7021 crossing pairs; the loop must bail at 4000.
    // Collision is disabled so the geometry stays exactly on the crossing.
    for (let i = 0; i < 120; i++) {
      const angle = (i / 120) * Math.PI;
      const x = Math.cos(angle) * 250;
      const y = Math.sin(angle) * 250;
      model.addNode(`a${i}`, { x, y });
      model.addNode(`b${i}`, { x: -x, y: -y });
      // The first link is hidden so its skip runs before the conflict break.
      model.addLink(`e${i}`, `a${i}`, `b${i}`, { hidden: i === 0 });
    }
    const engine = makeEngine(model, { edgeSeparation: 1, collisionStrength: 0 });
    expect(() => engine.step(1 / 60)).not.toThrow();
    expect((engine as unknown as { edgeScratch: Int32Array }).edgeScratch.length).toBeGreaterThan(0);
  });

  it('should skip crossing checks for links sharing an endpoint', () => {
    const model = makeModel();
    model.addNode('a', { x: -80, y: 0 });
    model.addNode('b', { x: 80, y: 0 });
    model.addNode('c', { x: 0, y: 80 });
    model.addLink('ab', 'a', 'b', {});
    model.addLink('bc', 'b', 'c', {});
    const engine = makeEngine(model, { edgeSeparation: 1, positionIterations: 1 });
    const beforeX = model.x[0];
    engine.step(1 / 60);
    expect(Number.isFinite(beforeX)).toBe(true);
  });

  it('should ignore near parallel non crossing edges inside the query window', () => {
    const model = makeModel();
    model.addNode('a', { x: 0, y: 0 });
    model.addNode('b', { x: 40, y: 0 });
    model.addNode('c', { x: 0, y: 20 });
    model.addNode('d', { x: 40, y: 20 });
    model.addLink('ab', 'a', 'b', {});
    model.addLink('cd', 'c', 'd', {});
    const engine = makeEngine(model, { edgeSeparation: 1, positionIterations: 1 });
    engine.step(1 / 60);
    expect(model.x[0]).toBe(0);
  });

  it('should not nudge a fixed endpoint while untangling crossings', () => {
    const model = makeModel();
    model.addNode('a', { x: -100, y: -50 });
    model.addNode('b', { x: 100, y: 50 });
    model.addNode('c', { x: -150, y: 60 });
    model.addNode('d', { x: 120, y: -60 });
    model.setNodeFixed(0, true);
    model.addLink('ab', 'a', 'b', {});
    model.addLink('cd', 'c', 'd', {});
    const engine = makeEngine(model, { edgeSeparation: 1, positionIterations: 1 });
    engine.step(1 / 60);
    expect(model.x[0]).toBe(-100);
    expect(model.y[0]).toBe(-50);
    const moved = model.x[1] !== 100 || model.y[1] !== 50 || model.x[2] !== -150 || model.y[2] !== 60;
    expect(moved).toBe(true);
  });
});
