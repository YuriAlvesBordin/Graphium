import { SpatialHash } from '../../src/physics/SpatialHash';

describe('SpatialHash', () => {
  it('should clamp the cell size to a positive minimum', () => {
    const hash = new SpatialHash(64, 0);
    expect(hash.cellSize).toBeGreaterThan(0);
    hash.setCellSize(-5);
    expect(hash.cellSize).toBeGreaterThan(0);
    hash.setCellSize(50);
    expect(hash.cellSize).toBe(50);
  });

  it('should rebuild and count every inserted node', () => {
    const hash = new SpatialHash(64, 100);
    const x = new Float32Array([0, 10, 20, 30]);
    const y = new Float32Array([0, 0, 0, 0]);
    hash.rebuild(x, y, 4);
    expect(hash.count).toBe(4);
    hash.clear();
    expect(hash.count).toBe(0);
  });

  it('should skip hidden nodes during rebuild', () => {
    const hash = new SpatialHash(64, 100);
    const x = new Float32Array([0, 10, 20]);
    const y = new Float32Array([0, 0, 0]);
    const hidden = new Uint8Array([0, 1, 0]);
    hash.rebuild(x, y, 3, hidden, 1);
    expect(hash.count).toBe(2);
  });

  it('should query neighbors within the radius window', () => {
    const hash = new SpatialHash(64, 100);
    const x = new Float32Array([0, 30, 500, -25]);
    const y = new Float32Array([0, 0, 0, 0]);
    hash.rebuild(x, y, 4);
    const output = new Int32Array(16);
    const found = hash.queryRadius(0, 0, 50, output);
    const hits = Array.from(output.slice(0, found)).sort((a, b) => a - b);
    expect(hits).toEqual([0, 1, 3]);
  });

  it('should cap results at the output capacity', () => {
    const hash = new SpatialHash(64, 10);
    const count = 50;
    const x = new Float32Array(count);
    const y = new Float32Array(count);
    hash.rebuild(x, y, count);
    const output = new Int32Array(8);
    const found = hash.queryRadius(0, 0, 1000, output);
    expect(found).toBe(8);
  });

  it('should return every node stacked in the same cell', () => {
    const hash = new SpatialHash(64, 100);
    const x = new Float32Array([5, 5, 5]);
    const y = new Float32Array([5, 5, 5]);
    hash.rebuild(x, y, 3);
    const output = new Int32Array(16);
    const found = hash.queryRadius(5, 5, 1, output);
    expect(found).toBe(3);
  });

  it('should handle negative coordinates', () => {
    const hash = new SpatialHash(64, 100);
    const x = new Float32Array([-150, 150]);
    const y = new Float32Array([-150, 150]);
    hash.rebuild(x, y, 2);
    const output = new Int32Array(8);
    expect(hash.queryRadius(-150, -150, 5, output)).toBe(1);
    expect(output[0]).toBe(0);
  });

  it('should pick the node whose disc contains the point', () => {
    const hash = new SpatialHash(64, 100);
    const x = new Float32Array([0, 200]);
    const y = new Float32Array([0, 0]);
    const radii = new Float32Array([10, 10]);
    hash.rebuild(x, y, 2);
    const output = new Int32Array(16);
    expect(hash.pick(3, 4, x, y, radii, output)).toBe(0);
    expect(hash.pick(203, 0, x, y, radii, output)).toBe(1);
    expect(hash.pick(500, 500, x, y, radii, output)).toBe(-1);
  });

  it('should pick the closest disc when two contain the point', () => {
    const hash = new SpatialHash(64, 100);
    const x = new Float32Array([-6, 4]);
    const y = new Float32Array([0, 0]);
    const radii = new Float32Array([10, 10]);
    hash.rebuild(x, y, 2);
    const output = new Int32Array(16);
    expect(hash.pick(0, 0, x, y, radii, output)).toBe(1);
  });

  it('should grow the chain storage past the initial capacity', () => {
    const hash = new SpatialHash(16, 100);
    const count = 200;
    const x = new Float32Array(count);
    const y = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      x[i] = (i % 20) * 30;
      y[i] = Math.floor(i / 20) * 30;
    }
    hash.rebuild(x, y, count);
    expect(hash.count).toBe(count);
    const output = new Int32Array(count);
    expect(hash.queryRadius(0, 0, 100, output)).toBeGreaterThan(0);
  });
});
