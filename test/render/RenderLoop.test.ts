import { RenderLoop } from '../../src/render/RenderLoop';
import type { RenderLoopDeps } from '../../src/render/RenderLoop';

/**
 * The loop only talks to its collaborators through the deps interface, so
 * the whole scheduling and dirty checking behavior is testable with plain
 * stubs and no DOM or WebGL.
 */
function createDeps(overrides: Partial<RenderLoopDeps> = {}): RenderLoopDeps {
  return {
    model: { nodeCount: 0, topologyRevision: 0, appearanceRevision: 0, positionRevision: 0 } as unknown as RenderLoopDeps['model'],
    physics: { step: jest.fn(() => 5), sleeping: false } as unknown as RenderLoopDeps['physics'],
    camera: { revision: 0 } as unknown as RenderLoopDeps['camera'],
    renderer: { render: jest.fn() } as unknown as RenderLoopDeps['renderer'],
    labels: { update: jest.fn() } as unknown as RenderLoopDeps['labels'],
    atlas: { revision: 0 } as unknown as RenderLoopDeps['atlas'],
    isRunning: () => true,
    isDestroyed: () => false,
    autoFit: false,
    fitView: jest.fn(),
    ...overrides,
  };
}

describe('RenderLoop', () => {
  it('should start with the default timing EMAs', () => {
    const loop = new RenderLoop(createDeps());
    expect(loop.fps).toBe(60);
    expect(loop.frameMs).toBe(16);
    expect(loop.physicsMs).toBe(0);
  });

  it('should step physics and render exactly once per step call', () => {
    const deps = createDeps();
    const loop = new RenderLoop(deps);
    const energy = loop.step(1 / 60);
    expect(energy).toBe(5);
    expect(deps.physics.step).toHaveBeenCalledWith(1 / 60);
    expect(deps.renderer.render).toHaveBeenCalledTimes(1);
    expect(deps.labels.update).toHaveBeenCalledTimes(1);
  });

  it('should render without stepping through renderNow', () => {
    const deps = createDeps();
    const loop = new RenderLoop(deps);
    loop.renderNow();
    expect(deps.physics.step).not.toHaveBeenCalled();
    expect(deps.renderer.render).toHaveBeenCalledTimes(1);
  });

  it('should trigger auto fit once on the first render with data', () => {
    const deps = createDeps({ autoFit: true });
    (deps.model as { nodeCount: number }).nodeCount = 3;
    const loop = new RenderLoop(deps);
    loop.renderNow();
    loop.renderNow();
    expect(deps.fitView).toHaveBeenCalledTimes(1);
  });

  it('should allow auto fit again after resetAutoFit', () => {
    const deps = createDeps({ autoFit: true });
    (deps.model as { nodeCount: number }).nodeCount = 3;
    const loop = new RenderLoop(deps);
    loop.renderNow();
    loop.resetAutoFit();
    loop.renderNow();
    expect(deps.fitView).toHaveBeenCalledTimes(2);
  });

  it('should request renders through the dirty flag', () => {
    const loop = new RenderLoop(createDeps());
    loop.requestRender();
    expect((loop as unknown as { forceDirty: boolean }).forceDirty).toBe(true);
  });

  it('should not schedule frames once destroyed', () => {
    const deps = createDeps({ isDestroyed: () => true });
    const loop = new RenderLoop(deps);
    loop.requestRender();
    expect(deps.renderer.render).not.toHaveBeenCalled();
  });

  it('should cancel pending frames without throwing', () => {
    const loop = new RenderLoop(createDeps());
    expect(() => loop.cancel()).not.toThrow();
  });
});
