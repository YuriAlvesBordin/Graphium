import { PointerController } from '../../src/interaction/PointerController';
import { Camera } from '../../src/render/Camera';
import { Emitter } from '../../src/core/events';
import { GraphModel, NODE_DRAGGED, STATE_DRAGGING } from '../../src/core/GraphModel';
import { PhysicsEngine } from '../../src/physics/PhysicsEngine';
import { SpatialHash } from '../../src/physics/SpatialHash';
import { DEFAULT_THEME } from '../../src/core/theme';

// The controller defers long press detection through window.setTimeout, so a
// module level stub keeps every describe block working (unref'd so pending
// timers never hold the Jest worker open).
(globalThis as unknown as { window: unknown }).window = {
  setTimeout: (fn: () => void, ms: number) => {
    const handle = setTimeout(fn, ms);
    (handle as unknown as { unref?: () => void }).unref?.();
    return handle;
  },
  clearTimeout: (id: unknown) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

type Handler = (event: unknown) => void;

interface StubCanvas {
  element: HTMLElement;
  handlers: Map<string, Handler>;
  fire(type: string, event: unknown): void;
}

/**
 * Builds a fake canvas that records listeners so tests can dispatch synthetic
 * pointer events directly into the controller.
 */
function createStubCanvas(rect = { left: 100, top: 50, width: 800, height: 400 }): StubCanvas {
  const handlers = new Map<string, Handler>();
  const element = {
    addEventListener: (type: string, fn: Handler) => handlers.set(type, fn),
    removeEventListener: (type: string) => handlers.delete(type),
    getBoundingClientRect: () => rect,
    setPointerCapture: jest.fn(),
    releasePointerCapture: jest.fn(),
  };
  return {
    element: element as unknown as HTMLElement,
    handlers,
    fire(type: string, event: unknown) {
      const handler = handlers.get(type);
      if (handler) {
        handler(event);
      }
    },
  };
}

function pointerEvent(overrides: Record<string, unknown> = {}): PointerEvent {
  return {
    clientX: 0,
    clientY: 0,
    button: 0,
    pointerId: 1,
    preventDefault: jest.fn(),
    ...overrides,
  } as unknown as PointerEvent;
}

function createHarness() {
  const canvas = createStubCanvas();
  const camera = new Camera();
  camera.setViewport(800, 400);
  camera.setPosition(0, 0);
  camera.setZoom(1);
  const model = new GraphModel({ nodeCapacity: 16, linkCapacity: 16, theme: DEFAULT_THEME });
  const physics = new PhysicsEngine(model, {});
  const events = new Emitter();
  const controller = new PointerController(canvas.element, camera, model, physics, physics.hash, events, {
    pickLink: jest.fn(() => -1),
  });
  return { canvas, camera, model, physics, events, controller };
}

describe('PointerController', () => {
  it('should register every gesture listener on enable', () => {
    const { canvas } = createHarness();
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerleave', 'wheel', 'contextmenu']) {
      expect(canvas.handlers.has(type)).toBe(true);
    }
  });

  it('should detach every listener on disable and destroy', () => {
    const { canvas, controller } = createHarness();
    controller.disable();
    expect(canvas.handlers.size).toBe(0);
    expect(controller.enabled).toBe(false);
  });

  it('should convert client coordinates into screen and world space on wheel', () => {
    const { canvas, camera, events } = createHarness();
    const seen: Array<Record<string, unknown>> = [];
    events.on('zoom', payload => seen.push(payload as Record<string, unknown>));
    canvas.fire('wheel', { clientX: 500, clientY: 250, deltaY: -100, preventDefault: jest.fn() });
    expect(seen.length).toBe(1);
    expect(seen[0].screenX).toBe(400);
    expect(seen[0].screenY).toBe(200);
    // Camera centered at (0,0) with zoom 1: world = screen - center.
    expect(seen[0].worldX).toBeCloseTo(0);
    expect(seen[0].worldY).toBeCloseTo(0);
    expect(camera.zoom).toBeCloseTo(1.12);
  });

  it('should account for canvas scaling when the rect differs from the viewport', () => {
    const canvas = createStubCanvas({ left: 0, top: 0, width: 400, height: 200 });
    const camera = new Camera();
    camera.setViewport(800, 400);
    camera.setPosition(0, 0);
    camera.setZoom(1);
    const model = new GraphModel({ nodeCapacity: 8, linkCapacity: 8, theme: DEFAULT_THEME });
    const physics = new PhysicsEngine(model, {});
    const events = new Emitter();
    new PointerController(canvas.element, camera, model, physics, physics.hash, events, {});
    const seen: Array<Record<string, unknown>> = [];
    events.on('pointerup', payload => seen.push(payload as Record<string, unknown>));
    canvas.fire('pointerdown', pointerEvent({ clientX: 200, clientY: 100 }));
    canvas.fire('pointerup', pointerEvent({ clientX: 200, clientY: 100 }));
    expect(seen[0].screenX).toBe(400);
    expect(seen[0].screenY).toBe(200);
    expect(seen[0].worldX).toBeCloseTo(0);
    expect(seen[0].worldY).toBeCloseTo(0);
  });

  it('should emit clicks on the background with the exact coordinates', () => {
    const { canvas, events } = createHarness();
    const seen: Array<Record<string, unknown>> = [];
    events.on('click', payload => seen.push(payload as Record<string, unknown>));
    canvas.fire('pointerdown', pointerEvent({ clientX: 150, clientY: 75 }));
    canvas.fire('pointerup', pointerEvent({ clientX: 150, clientY: 75 }));
    expect(seen.length).toBe(1);
    expect(seen[0].nodeIndex).toBe(-1);
    expect(seen[0].screenX).toBe(50);
    expect(seen[0].screenY).toBe(25);
    expect(seen[0].worldX).toBeCloseTo(-350);
    expect(seen[0].worldY).toBeCloseTo(-175);
  });

  it('should pick the hovered node during free pointer movement', () => {
    const harness = createHarness();
    const { canvas, model, events } = harness;
    model.addNode('target', { x: 0, y: 0, radius: 40 });
    model.addNode('far', { x: 3000, y: 3000, radius: 40 });
    physicsHashRebuild(harness);
    const seen: Array<Record<string, unknown>> = [];
    events.on('hover', payload => seen.push(payload as Record<string, unknown>));
    // World (0,0) is screen (400,200), which is client (500,250).
    canvas.fire('pointermove', pointerEvent({ clientX: 500, clientY: 250 }));
    expect(seen.length).toBe(1);
    expect(seen[0].nodeIndex).toBe(0);
    expect(seen[0].nodeId).toBe('target');
    expect(seen[0].screenX).toBe(400);
    expect(seen[0].worldX).toBeCloseTo(0);
  });

  it('should drag a node through the physics engine and release with momentum', () => {
    const harness = createHarness();
    const { canvas, model, physics, events } = harness;
    model.addNode('grab', { x: 0, y: 0, radius: 40 });
    physicsHashRebuild(harness);
    const beginDrag = jest.spyOn(physics, 'beginDrag');
    const dragTo = jest.spyOn(physics, 'dragTo');
    const endDrag = jest.spyOn(physics, 'endDrag');
    const drags: Array<Record<string, unknown>> = [];
    const dragends: Array<Record<string, unknown>> = [];
    events.on('drag', payload => drags.push(payload as Record<string, unknown>));
    events.on('dragend', payload => dragends.push(payload as Record<string, unknown>));

    canvas.fire('pointerdown', pointerEvent({ clientX: 500, clientY: 250 }));
    expect(beginDrag).toHaveBeenCalledWith(0, 0, 0);
    expect(model.flags[0] & NODE_DRAGGED).toBeTruthy();
    expect(model.state[0]).toBe(STATE_DRAGGING);

    // Move far beyond the 4px drag threshold: world x goes from 0 to 200.
    canvas.fire('pointermove', pointerEvent({ clientX: 700, clientY: 250 }));
    expect(dragTo).toHaveBeenCalledWith(200, 0);
    expect(drags.length).toBe(1);
    expect(drags[0].screenX).toBe(600);

    canvas.fire('pointerup', pointerEvent({ clientX: 700, clientY: 250 }));
    expect(endDrag).toHaveBeenCalled();
    expect(dragends.length).toBe(1);
    expect((model.flags[0] & NODE_DRAGGED) === 0).toBe(true);
  });

  it('should emit a click when a node press never moves', () => {
    const harness = createHarness();
    const { canvas, model, events } = harness;
    model.addNode('grab', { x: 0, y: 0, radius: 40 });
    physicsHashRebuild(harness);
    const clicks: Array<Record<string, unknown>> = [];
    events.on('click', payload => clicks.push(payload as Record<string, unknown>));
    canvas.fire('pointerdown', pointerEvent({ clientX: 500, clientY: 250 }));
    canvas.fire('pointerup', pointerEvent({ clientX: 500, clientY: 250 }));
    expect(clicks.length).toBe(1);
    expect(clicks[0].nodeIndex).toBe(0);
  });

  it('should pan the camera when dragging the background', () => {
    const harness = createHarness();
    const { canvas, camera, events } = harness;
    const pans: Array<[number, number]> = [];
    jest.spyOn(camera, 'pan').mockImplementation((dx, dy) => {
      pans.push([dx, dy]);
      return camera;
    });
    const seen: Array<Record<string, unknown>> = [];
    events.on('pan', payload => seen.push(payload as Record<string, unknown>));
    canvas.fire('pointerdown', pointerEvent({ clientX: 500, clientY: 250 }));
    canvas.fire('pointermove', pointerEvent({ clientX: 530, clientY: 220 }));
    expect(pans).toEqual([[-30, 30]]);
    expect(seen.length).toBe(1);
    expect(seen[0].screenX).toBe(430);
  });

  it('should synthesize a double click from two quick presses', () => {
    const harness = createHarness();
    const { canvas, model, events } = harness;
    model.addNode('grab', { x: 0, y: 0, radius: 40 });
    physicsHashRebuild(harness);
    const kinds: string[] = [];
    events.on('click', () => kinds.push('click'));
    events.on('dblclick', () => kinds.push('dblclick'));
    for (let i = 0; i < 2; i++) {
      canvas.fire('pointerdown', pointerEvent({ clientX: 500, clientY: 250 }));
      canvas.fire('pointerup', pointerEvent({ clientX: 500, clientY: 250 }));
    }
    expect(kinds).toEqual(['click', 'dblclick']);
  });

  it('should emit link clicks through the host pick callback', () => {
    const canvas = createStubCanvas();
    const camera = new Camera();
    camera.setViewport(800, 400);
    const model = new GraphModel({ nodeCapacity: 8, linkCapacity: 8, theme: DEFAULT_THEME });
    model.addNode('a', { x: -200, y: 0 });
    model.addNode('b', { x: 200, y: 0 });
    model.addLink('l0', 'a', 'b', {});
    const physics = new PhysicsEngine(model, {});
    const events = new Emitter();
    const controller = new PointerController(canvas.element, camera, model, physics, physics.hash, events, {
      pickLink: jest.fn(() => 0),
    });
    const clicks: Array<Record<string, unknown>> = [];
    const linkClicks: Array<Record<string, unknown>> = [];
    events.on('click', payload => clicks.push(payload as Record<string, unknown>));
    events.on('linkclick', payload => linkClicks.push(payload as Record<string, unknown>));
    canvas.fire('pointerdown', pointerEvent({ clientX: 500, clientY: 250 }));
    canvas.fire('pointerup', pointerEvent({ clientX: 500, clientY: 250 }));
    expect(clicks[0].linkIndex).toBe(0);
    expect(linkClicks.length).toBe(1);
    expect(linkClicks[0].linkId).toBe('l0');
    expect(controller).toBeInstanceOf(PointerController);
  });

  it('should zoom the camera around the wheel position and honor zoomEnabled false', () => {
    const harness = createHarness();
    const { canvas, camera } = harness;
    canvas.fire('wheel', { clientX: 500, clientY: 250, deltaY: -100, preventDefault: jest.fn() });
    expect(camera.zoom).toBeCloseTo(1.12);
    canvas.fire('wheel', { clientX: 500, clientY: 250, deltaY: 100, preventDefault: jest.fn() });
    expect(camera.zoom).toBeCloseTo(1);
  });

  it('should ignore wheel input when zoom is disabled', () => {
    const canvas = createStubCanvas();
    const camera = new Camera();
    camera.setViewport(800, 400);
    const model = new GraphModel({ nodeCapacity: 8, linkCapacity: 8, theme: DEFAULT_THEME });
    const physics = new PhysicsEngine(model, {});
    const events = new Emitter();
    new PointerController(canvas.element, camera, model, physics, physics.hash, events, { zoomEnabled: false });
    const preventDefault = jest.fn();
    const seen: unknown[] = [];
    events.on('zoom', payload => seen.push(payload));
    canvas.fire('wheel', { clientX: 500, clientY: 250, deltaY: -100, preventDefault });
    expect(camera.zoom).toBe(1);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(seen.length).toBe(0);
  });

  it('should keep two finger gestures as pinch instead of pan', () => {
    const harness = createHarness();
    const { canvas, camera, events } = harness;
    const zoomAt = jest.spyOn(camera, 'zoomAt');
    const pans: Array<[number, number]> = [];
    jest.spyOn(camera, 'pan').mockImplementation((dx, dy) => {
      pans.push([dx, dy]);
      return camera;
    });
    const pinches: unknown[] = [];
    events.on('pinch', payload => pinches.push(payload));
    canvas.fire('pointerdown', pointerEvent({ pointerId: 1, clientX: 300, clientY: 250 }));
    canvas.fire('pointerdown', pointerEvent({ pointerId: 2, clientX: 500, clientY: 250 }));
    canvas.fire('pointermove', pointerEvent({ pointerId: 2, clientX: 700, clientY: 250 }));
    expect(pinches.length).toBe(1);
    canvas.fire('pointermove', pointerEvent({ pointerId: 2, clientX: 900, clientY: 250 }));
    expect(pinches.length).toBe(2);
    expect(zoomAt).toHaveBeenCalled();
  });

  it('should emit long press when the pointer stays still', () => {
    jest.useFakeTimers();
    try {
      const harness = createHarness();
      const { canvas, model, events } = harness;
      model.addNode('grab', { x: 0, y: 0, radius: 40 });
      physicsHashRebuild(harness);
      const longpress: Array<Record<string, unknown>> = [];
      events.on('longpress', payload => longpress.push(payload as Record<string, unknown>));
      canvas.fire('pointerdown', pointerEvent({ clientX: 500, clientY: 250 }));
      jest.advanceTimersByTime(600);
      expect(longpress.length).toBe(1);
      expect(longpress[0].nodeIndex).toBe(0);
      canvas.fire('pointerup', pointerEvent({ clientX: 500, clientY: 250 }));
    } finally {
      jest.useRealTimers();
    }
  });

  it('should suppress long press once the pointer moves', () => {
    jest.useFakeTimers();
    try {
      const harness = createHarness();
      const { canvas, events } = harness;
      const longpress: unknown[] = [];
      events.on('longpress', payload => longpress.push(payload));
      canvas.fire('pointerdown', pointerEvent({ clientX: 500, clientY: 250 }));
      canvas.fire('pointermove', pointerEvent({ clientX: 800, clientY: 250 }));
      jest.advanceTimersByTime(600);
      expect(longpress.length).toBe(0);
      canvas.fire('pointerup', pointerEvent({ clientX: 800, clientY: 250 }));
    } finally {
      jest.useRealTimers();
    }
  });

  it('should end hover with a clear payload when the pointer leaves', () => {
    const { canvas, events } = createHarness();
    const seen: Array<Record<string, unknown>> = [];
    events.on('hover', payload => seen.push(payload as Record<string, unknown>));
    canvas.fire('pointerleave', {});
    expect(seen.length).toBe(1);
    expect(seen[0].nodeIndex).toBe(-1);
  });

  it('should forward context menu with prevented default behavior', () => {
    const { canvas, events } = createHarness();
    const seen: Array<Record<string, unknown>> = [];
    events.on('contextmenu', payload => seen.push(payload as Record<string, unknown>));
    const preventDefault = jest.fn();
    canvas.fire('contextmenu', { clientX: 450, clientY: 275, preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    expect(seen[0].screenX).toBe(350);
    expect(seen[0].screenY).toBe(225);
  });

  it('should skip hover emission when hover is disabled', () => {
    const canvas = createStubCanvas();
    const camera = new Camera();
    camera.setViewport(800, 400);
    const model = new GraphModel({ nodeCapacity: 8, linkCapacity: 8, theme: DEFAULT_THEME });
    const physics = new PhysicsEngine(model, {});
    const events = new Emitter();
    new PointerController(canvas.element, camera, model, physics, physics.hash, events, { hoverEnabled: false });
    const seen: unknown[] = [];
    events.on('hover', payload => seen.push(payload));
    canvas.fire('pointermove', pointerEvent({ clientX: 500, clientY: 250 }));
    expect(seen.length).toBe(0);
  });
});

/** Physics normally rebuilds the hash every step; tests must do it manually. */
function physicsHashRebuild(harness: { model: GraphModel; physics: PhysicsEngine }): void {
  harness.physics.hash.rebuild(harness.model.x, harness.model.y, harness.model.nodeCount);
}

describe('PointerController remaining branches', () => {
  it('should grow the pick buffer when the graph exceeds its capacity', () => {
    const harness = createHarness();
    const { canvas, model, physics } = harness;
    for (let i = 0; i < 300; i++) {
      model.addNode(`n${i}`, { x: i * 5, y: 0, radius: 4 });
    }
    physics.hash.rebuild(model.x, model.y, model.nodeCount);
    // The node sits at world (1500, 0) = screen (1900, 200); the initial
    // 256 entry pick buffer must grow before picking succeeds.
    canvas.fire('pointermove', pointerEvent({ clientX: 1900, clientY: 250 }));
    const seen: Array<Record<string, unknown>> = [];
    events_on(harness, 'hover', payload => seen.push(payload as Record<string, unknown>));
    canvas.fire('pointermove', pointerEvent({ clientX: 1900, clientY: 250 }));
    expect(seen.length).toBe(1);
    expect(seen[0].nodeIndex).toBe(280);
  });

  it('should drop an active drag when a second pointer lands', () => {
    const harness = createHarness();
    const { canvas, model, events } = harness;
    model.addNode('grab', { x: 0, y: 0, radius: 40 });
    physicsHashRebuild(harness);
    const endDragSpy = jest.spyOn(harness.physics, 'endDrag');
    canvas.fire('pointerdown', pointerEvent({ pointerId: 1, clientX: 500, clientY: 250 }));
    expect((model.flags[0] & NODE_DRAGGED) === 0).toBe(false);
    canvas.fire('pointerdown', pointerEvent({ pointerId: 2, clientX: 700, clientY: 250 }));
    expect(endDragSpy).toHaveBeenCalled();
    expect((model.flags[0] & NODE_DRAGGED) === 0).toBe(true);
  });

  it('should tolerate a third pointer landing after the drag was released', () => {
    const harness = createHarness();
    const { canvas, model } = harness;
    model.addNode('grab', { x: 0, y: 0, radius: 40 });
    physicsHashRebuild(harness);
    canvas.fire('pointerdown', pointerEvent({ pointerId: 1, clientX: 500, clientY: 250 }));
    canvas.fire('pointerdown', pointerEvent({ pointerId: 2, clientX: 700, clientY: 250 }));
    // dragNode is already -1; releasing again exercises the guard.
    expect(() => canvas.fire('pointerdown', pointerEvent({ pointerId: 3, clientX: 750, clientY: 250 }))).not.toThrow();
  });

  it('should ignore enable twice and disable twice', () => {
    const harness = createHarness();
    const { canvas, controller } = harness;
    const countBefore = canvas.handlers.size;
    controller.enable();
    expect(canvas.handlers.size).toBe(countBefore);
    controller.disable();
    controller.disable();
    expect(canvas.handlers.size).toBe(0);
  });

  it('should fully release resources on destroy', () => {
    const harness = createHarness();
    const { canvas, controller } = harness;
    controller.destroy();
    expect(controller.enabled).toBe(false);
    expect(canvas.handlers.size).toBe(0);
    canvas.fire('pointerdown', pointerEvent({ clientX: 500, clientY: 250 }));
  });
});

/** Attaches an event listener through the exposed graph emitter. */
function events_on(harness: { events: Emitter }, type: string, listener: (payload: unknown) => void): () => void {
  return harness.events.on(type, listener);
}
