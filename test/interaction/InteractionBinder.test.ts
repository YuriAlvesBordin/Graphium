import { InteractionBinder } from '../../src/interaction/InteractionBinder';
import { Emitter } from '../../src/core/events';
import { GraphModel, STATE_HOVER, STATE_NORMAL } from '../../src/core/GraphModel';
import { DEFAULT_THEME } from '../../src/core/theme';
import { PhysicsEngine } from '../../src/physics/PhysicsEngine';
import { SelectionController } from '../../src/core/SelectionController';
import { PointerController } from '../../src/interaction/PointerController';

// The pointer controller needs a browser canvas; stub it out so the binder
// wiring can be exercised in a plain Node environment. Constructor arguments
// are preserved so tests can reach the injected options object.
jest.mock('../../src/interaction/PointerController', () => ({
  PointerController: jest.fn().mockImplementation(() => ({
    options: {},
    destroy: jest.fn(),
  })),
}));

function lastPointerOptions(): { pickLink?: (x: number, y: number, r: number) => number; [key: string]: unknown } {
  const calls = (PointerController as unknown as jest.Mock).mock.calls;
  return calls[calls.length - 1][6];
}

function createBinder(overrides: Record<string, unknown> = {}) {
  const model = new GraphModel({ nodeCapacity: 16, linkCapacity: 16, theme: DEFAULT_THEME });
  const physics = new PhysicsEngine(model, {});
  const events = new Emitter();
  const selection = new SelectionController(model, () => {});
  const invalidate = jest.fn();
  const binder = new InteractionBinder({
    canvas: {} as HTMLCanvasElement,
    model,
    physics,
    camera: { zoom: 1 } as never,
    hash: physics.hash,
    events,
    interaction: {},
    selection,
    invalidate,
    ...overrides,
  });
  return { model, physics, events, selection, invalidate, binder };
}

describe('InteractionBinder', () => {
  it('should build the pointer controller and keep physics hooks', () => {
    const { physics } = createBinder();
    expect(typeof physics.onSleep).toBe('function');
    expect(typeof physics.onWake).toBe('function');
  });

  it('should forward sleep and wake through the emitter', () => {
    const { physics, events, invalidate } = createBinder();
    const seen: unknown[] = [];
    events.on('sleep', payload => seen.push(payload));
    physics.onSleep?.(0.25);
    physics.onWake?.();
    expect(seen).toEqual([{ energy: 0.25 }]);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('should map explicit interaction settings onto the pointer options', () => {
    createBinder({
      interaction: { wheelZoomSpeed: 3, dragThreshold: 9, longPressMs: 700, linkHitRadius: 4, hoverEnabled: false, panEnabled: false, zoomEnabled: false, dragEnabled: false },
    });
    const options = lastPointerOptions();
    expect(options.wheelZoomSpeed).toBe(3);
    expect(options.dragThreshold).toBe(9);
    expect(options.longPressMs).toBe(700);
    expect(options.linkHitRadius).toBe(4);
    expect(options.hoverEnabled).toBe(false);
    expect(options.panEnabled).toBe(false);
    expect(options.zoomEnabled).toBe(false);
    expect(options.dragEnabled).toBe(false);
  });

  it('should pass the interaction true shorthand through verbatim', () => {
    // The binder maps settings as-is; applying defaults is the pointer
    // controller's own concern (it receives {} and applies 1.12/4/true).
    createBinder({ interaction: true });
    const options = lastPointerOptions();
    expect(options.wheelZoomSpeed).toBeUndefined();
    expect(options.dragThreshold).toBeUndefined();
    expect(options.hoverEnabled).toBeUndefined();
  });

  it('should skip pointer construction when interaction is false', () => {
    const callsBefore = (PointerController as unknown as jest.Mock).mock.calls.length;
    const { binder } = createBinder({ interaction: false });
    expect((PointerController as unknown as jest.Mock).mock.calls.length).toBe(callsBefore);
    expect((binder as unknown as { pointer: unknown }).pointer).toBeNull();
    expect(() => binder.setInteraction({ wheelZoomSpeed: 2 })).not.toThrow();
    expect(() => binder.destroy()).not.toThrow();
  });

  it('should invalidate on pan, zoom and pinch events', () => {
    const { events, invalidate } = createBinder();
    events.emit('pan', {});
    events.emit('zoom', {});
    events.emit('pinch', {});
    expect(invalidate).toHaveBeenCalledTimes(3);
  });

  it('should invalidate on dragend and imageload events', () => {
    const { events, invalidate } = createBinder();
    events.emit('dragend', {});
    events.emit('imageload', {});
    expect(invalidate).toHaveBeenCalledTimes(2);
  });

  it('should wake the physics on drag', () => {
    const { physics, events, invalidate } = createBinder();
    const wakeSpy = jest.spyOn(physics, 'wake');
    events.emit('drag', {});
    expect(wakeSpy).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalled();
  });

  it('should route clicks to the selection controller', () => {
    const { model, events, selection, invalidate } = createBinder();
    model.addNode('a', {});
    model.addNode('b', {});
    model.addLink('l0', 'a', 'b', {});
    const clearSpy = jest.spyOn(selection, 'clear');
    const selectNodeSpy = jest.spyOn(selection, 'selectNode');
    const selectLinkSpy = jest.spyOn(selection, 'selectLink');

    events.emit('click', { nodeIndex: 0, linkIndex: -1 });
    expect(selectNodeSpy).toHaveBeenCalledWith(0, true);
    events.emit('click', { nodeIndex: -1, linkIndex: 0 });
    expect(selectLinkSpy).toHaveBeenCalledWith(0, true);
    events.emit('click', { nodeIndex: -1, linkIndex: -1 });
    expect(clearSpy).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledTimes(3);
  });

  it('should maintain the hover state flags', () => {
    const { model, events, invalidate } = createBinder();
    model.addNode('a', {});
    model.addNode('b', {});
    events.emit('hover', { nodeIndex: 0 });
    expect(model.state[0]).toBe(STATE_HOVER);
    expect(model.state[1]).toBe(STATE_NORMAL);
    events.emit('hover', { nodeIndex: 1 });
    expect(model.state[0]).toBe(STATE_NORMAL);
    expect(model.state[1]).toBe(STATE_HOVER);
    events.emit('hover', {});
    expect(model.state[1]).toBe(STATE_NORMAL);
    expect(invalidate).toHaveBeenCalledTimes(3);
  });

  it('should ignore repeated hover payloads for the same index', () => {
    const { model, events, invalidate } = createBinder();
    model.addNode('a', {});
    events.emit('hover', { nodeIndex: 0 });
    events.emit('hover', { nodeIndex: 0 });
    events.emit('hover', { nodeIndex: 0 });
    expect(invalidate).toHaveBeenCalledTimes(3);
    expect(model.state[0]).toBe(STATE_HOVER);
  });

  it('should patch pointer options through setInteraction', () => {
    const { binder } = createBinder();
    binder.setInteraction({ wheelZoomSpeed: 2.5 });
    expect((binder as unknown as { pointer: { options: Record<string, number> } }).pointer.options.wheelZoomSpeed).toBe(2.5);
  });

  it('should return -1 from pickLinkAt when the graph has no links', () => {
    const { binder } = createBinder();
    expect(binder.pickLinkAt(0, 0, 8)).toBe(-1);
  });

  it('should find the closest visible link through scanning', () => {
    const { model, binder } = createBinder();
    model.addNode('a', { x: -100, y: 0 });
    model.addNode('b', { x: 100, y: 0 });
    model.addNode('c', { x: 0, y: 20 });
    model.addNode('d', { x: 0, y: 400 });
    model.addLink('ab', 'a', 'b', { width: 4 });
    model.addLink('cd', 'c', 'd', {});
    expect(binder.pickLinkAt(0, 1, 8)).toBe(0);
    expect(binder.pickLinkAt(0, 380, 8)).toBe(1);
    expect(binder.pickLinkAt(30, 200, 4)).toBe(-1);
  });

  it('should skip hidden links during picking', () => {
    const { model, binder } = createBinder();
    model.addNode('a', { x: -100, y: 0 });
    model.addNode('b', { x: 100, y: 0 });
    model.addLink('ab', 'a', 'b', { hidden: true });
    expect(binder.pickLinkAt(0, 0, 8)).toBe(-1);
  });

  it('should delegate the host pickLink callback into pickLinkAt', () => {
    const { model } = createBinder();
    model.addNode('a', { x: -100, y: 0 });
    model.addNode('b', { x: 100, y: 0 });
    model.addLink('ab', 'a', 'b', { width: 4 });
    const options = lastPointerOptions();
    expect(typeof options.pickLink).toBe('function');
    expect(options.pickLink?.(0, 0, 8)).toBe(0);
  });

  it('should destroy the pointer controller', () => {
    const { binder } = createBinder();
    const pointer = (binder as unknown as { pointer: { destroy: jest.Mock } }).pointer;
    binder.destroy();
    expect(pointer.destroy).toHaveBeenCalled();
  });
});
