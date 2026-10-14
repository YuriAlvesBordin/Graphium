import { InteractionBinder } from '../../src/interaction/InteractionBinder';
import { Emitter } from '../../src/core/events';
import { GraphModel, STATE_HOVER, STATE_NORMAL } from '../../src/core/GraphModel';
import { DEFAULT_THEME } from '../../src/core/theme';
import { PhysicsEngine } from '../../src/physics/PhysicsEngine';
import { SelectionController } from '../../src/core/SelectionController';

// The pointer controller needs a browser canvas; stub it out so the binder
// wiring can be exercised in a plain Node environment.
jest.mock('../../src/interaction/PointerController', () => {
  return {
    PointerController: jest.fn().mockImplementation(() => ({
      options: {},
      destroy: jest.fn(),
    })),
  };
});

function createBinder() {
  const model = new GraphModel({ nodeCapacity: 10, linkCapacity: 10, theme: DEFAULT_THEME });
  const physics = new PhysicsEngine(model, {});
  const events = new Emitter();
  const selection = new SelectionController(model, () => {});
  const invalidate = jest.fn();
  const binder = new InteractionBinder({
    canvas: {} as HTMLCanvasElement,
    model,
    physics,
    camera: { zoom: 1 } as never,
    hash: {} as never,
    events,
    interaction: {},
    selection,
    invalidate,
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
    const { physics, events } = createBinder();
    const seen: unknown[] = [];
    events.on('sleep', payload => seen.push(payload));
    physics.onSleep?.(0.25);
    expect(seen).toEqual([{ energy: 0.25 }]);
  });

  it('should invalidate on pan, zoom and pinch events', () => {
    const { events, invalidate } = createBinder();
    events.emit('pan', {});
    events.emit('zoom', {});
    events.emit('pinch', {});
    expect(invalidate).toHaveBeenCalledTimes(3);
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

  it('should patch pointer options through setInteraction', () => {
    const { binder } = createBinder();
    binder.setInteraction({ wheelZoomSpeed: 2.5 });
    expect((binder as unknown as { pointer: { options: Record<string, number> } }).pointer.options.wheelZoomSpeed).toBe(2.5);
  });

  it('should return -1 from pickLinkAt when the graph has no links', () => {
    const { binder } = createBinder();
    expect(binder.pickLinkAt(0, 0, 8)).toBe(-1);
  });

  it('should destroy the pointer controller', () => {
    const { binder } = createBinder();
    const pointer = (binder as unknown as { pointer: { destroy: jest.Mock } }).pointer;
    binder.destroy();
    expect(pointer.destroy).toHaveBeenCalled();
  });
});
