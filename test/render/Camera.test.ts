import { Camera } from '../../src/render/Camera';

describe('Camera', () => {
  it('should default to a unit viewport centered at the origin', () => {
    const camera = new Camera();
    expect(camera.width).toBe(1);
    expect(camera.height).toBe(1);
    expect(camera.x).toBe(0);
    expect(camera.y).toBe(0);
    expect(camera.zoom).toBe(1);
    expect(camera.minZoom).toBe(0.02);
    expect(camera.maxZoom).toBe(80);
    expect(camera.revision).toBe(1);
  });

  it('should ignore non finite positions and zoom', () => {
    const camera = new Camera({ x: Number.NaN, y: Number.NaN, zoom: Number.NaN });
    expect(camera.x).toBe(0);
    expect(camera.y).toBe(0);
    expect(camera.zoom).toBe(1);
  });

  it('should build the cached view matrix from the transform', () => {
    // The constructor ignores width/height options; the viewport is applied
    // through setViewport exactly like the library does after resize.
    const camera = new Camera({ x: 10, y: -20, zoom: 2 });
    camera.setViewport(800, 400);
    const sx = (2 * 2) / 800;
    const sy = (-2 * 2) / 400;
    expect(camera.matrix[0]).toBeCloseTo(sx);
    expect(camera.matrix[4]).toBeCloseTo(sy);
    expect(camera.matrix[6]).toBeCloseTo(-sx * 10);
    expect(camera.matrix[7]).toBeCloseTo(-sy * -20);
    expect(camera.matrix[8]).toBe(1);
  });

  it('should bump the revision on every transform change', () => {
    const camera = new Camera();
    const initial = camera.revision;
    camera.setViewport(800, 400).setPosition(1, 2).setZoom(3).pan(4, 5).zoomAt(1.1, 0, 0).fit(0, 0, 10, 10);
    expect(camera.revision).toBeGreaterThan(initial + 4);
  });

  it('should clamp viewport dimensions to at least one pixel', () => {
    const camera = new Camera();
    camera.setViewport(0, -5);
    expect(camera.width).toBe(1);
    expect(camera.height).toBe(1);
  });

  it('should clamp zoom between the configured limits', () => {
    const camera = new Camera({ minZoom: 0.5, maxZoom: 4 });
    camera.setZoom(100);
    expect(camera.zoom).toBe(4);
    camera.setZoom(0.001);
    expect(camera.zoom).toBe(0.5);
  });

  it('should pan in world units divided by zoom', () => {
    const camera = new Camera({ zoom: 2 });
    camera.pan(10, -6);
    expect(camera.x).toBeCloseTo(5);
    expect(camera.y).toBeCloseTo(-3);
  });

  it('should anchor the world point under the screen position when zooming', () => {
    const camera = new Camera({ x: 0, y: 0, zoom: 1 });
    camera.setViewport(800, 400);
    const before = camera.screenToWorld(600, 300, { x: 0, y: 0 });
    camera.zoomAt(2, 600, 300);
    const after = camera.screenToWorld(600, 300, { x: 0, y: 0 });
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(camera.zoom).toBe(2);
  });

  it('should convert between world and screen coordinates consistently', () => {
    const camera = new Camera({ x: 5, y: -5, zoom: 1.5 });
    camera.setViewport(800, 400);
    const world = camera.screenToWorld(300, 100, { x: 0, y: 0 });
    const screen = camera.worldToScreen(world.x, world.y, { x: 0, y: 0 });
    expect(screen.x).toBeCloseTo(300);
    expect(screen.y).toBeCloseTo(100);
  });

  it('should center the view on the rectangle and scale it to fit with padding', () => {
    const camera = new Camera();
    camera.setViewport(800, 400);
    camera.fit(-100, -50, 100, 50, 40);
    expect(camera.x).toBe(0);
    expect(camera.y).toBe(0);
    // Available space: 720x320; rect: 200x100 -> scale limited by height.
    expect(camera.zoom).toBeCloseTo(320 / 100);
  });

  it('should clamp degenerate rectangles to unit size when fitting', () => {
    const camera = new Camera();
    camera.setViewport(800, 400);
    camera.fit(5, 5, 5, 5, 0);
    expect(camera.x).toBe(5);
    expect(camera.y).toBe(5);
    // min(800, 400) hits the default maxZoom clamp of 80.
    expect(camera.zoom).toBe(80);
  });
});
