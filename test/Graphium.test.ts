/**
 * @jest-environment jsdom
 */

import { Graphium } from '../src/Graphium';
import type { FakeGL } from './helpers/fakeGL';
import { createFakeGL } from './helpers/fakeGL';
import { DEFAULT_THEME } from '../../src/core/theme';

beforeAll(() => {
  // The texture atlas needs an OffscreenCanvas; jsdom does not provide one.
  (globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas = class {
    width: number;
    height: number;
    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
    getContext(type: string) {
      return type === '2d' ? { clearRect: jest.fn(), drawImage: jest.fn() } : null;
    }
  };
  // jsdom renders 2d contexts as null without the optional canvas package.
  HTMLCanvasElement.prototype.getContext = jest.fn(((type: string) =>
    type === 'webgl2' ? createFakeGL() : null) as unknown) as typeof HTMLCanvasElement.prototype.getContext;
});

function createHost(): HTMLElement {
  const host = document.createElement('div');
  Object.defineProperty(host, 'clientWidth', { value: 800 });
  Object.defineProperty(host, 'clientHeight', { value: 400 });
  document.body.appendChild(host);
  return host;
}

describe('Graphium facade', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should create itself from a container element with the full stack', () => {
    const graph = Graphium.create({
      container: createHost(),
      autoStart: false,
      autoFit: true,
      physics: { preset: 'bouncy' },
      theme: { name: 'midnight' },
      camera: { minZoom: 0.1, maxZoom: 8 },
    });
    expect(graph.model).toBeDefined();
    expect(graph.physics).toBeDefined();
    expect(graph.camera).toBeDefined();
    expect(graph.renderer).toBeDefined();
    expect(graph.atlas).toBeDefined();
    expect(graph.labels).toBeDefined();
    expect(graph.editor).toBeDefined();
    expect(graph.events).toBeDefined();
    expect(graph.physics.options.repulsion).toBe(1300); // bouncy preset
    expect(graph.camera.minZoom).toBe(0.1);
    expect(graph.model.nodeCount).toBe(0);
    graph.destroy();
  });

  it('should accept an explicit canvas and disable interaction', () => {
    const canvas = document.createElement('canvas');
    const graph = new Graphium({
      canvas,
      autoStart: false,
      autoResize: false,
      interaction: false,
    });
    expect(graph.renderer.canvas).toBe(canvas);
    graph.resize();
    graph.destroy();
  });

  it('should fall back to document.body when no host is supplied', () => {
    const graph = new Graphium({ autoStart: false, autoResize: false });
    expect(document.body.querySelector('canvas')).not.toBeNull();
    graph.destroy();
    // The facade clears its data; the created canvas stays attached to the host.
    expect(graph.model.nodeCount).toBe(0);
    expect(document.body.querySelector('canvas')).not.toBeNull();
  });

  it('should expose the whole data api through the facade', () => {
    const graph = Graphium.create({ container: createHost(), autoStart: false, autoResize: false });
    const dataupdated = jest.fn();
    graph.on('dataupdated', dataupdated);

    graph.addNode('a', { x: 0, y: 0, label: 'A' });
    graph.addNodes([
      { id: 'b', x: 60, y: 0 },
      { id: 'c', x: 120, y: 0 },
    ]);
    graph.link('a', 'b', { curvature: 0.2 });
    expect(graph.link('a~b~0')).not.toBeNull();
    graph.addLinks([{ source: 'b', target: 'c' }]);
    expect(graph.nodeCount).toBe(3);
    expect(graph.linkCount).toBe(2);
    expect(dataupdated).not.toHaveBeenCalled();

    graph.setData({
      nodes: [
        { id: 'x', x: 0, y: 0 },
        { id: 'y', x: 50, y: 0 },
      ],
      links: [{ source: 'x', target: 'y' }],
    });
    expect(dataupdated).toHaveBeenCalledTimes(1);
    expect(graph.node('x')).not.toBeNull();
    expect(graph.getNode('x')?.label).toBeNull();
    expect(graph.getLink('x->y:0')?.source).toBe('x');
    expect(graph.nodeIds()).toEqual(['x', 'y']);
    expect(graph.linkIds()).toEqual(['x->y:0']);

    graph.node('x').label('X').color('#ff0000').fix();
    expect(graph.getNode('x')?.label).toBe('X');
    graph.linkById('x->y:0').curve(0.3);
    expect(graph.getLink('x->y:0')?.curvature).toBeCloseTo(0.3);

    graph.setNodeImage('x', 'avatar.png');
    expect(graph.getNode('x')?.image).toBe('avatar.png');

    const exported = graph.toJSON();
    expect(exported.nodes.length).toBe(2);
    expect(exported.links.length).toBe(1);
    graph.destroy();
  });

  it('should expose selection, focus, theme, physics and interaction controls', () => {
    const graph = Graphium.create({ container: createHost(), autoStart: false, autoResize: false });
    graph.addNode('a', { x: 0, y: 0 });
    graph.addNode('b', { x: 50, y: 0 });
    graph.link('a', 'b', {});

    graph.selectNode('a');
    expect(graph.selectedNodes()).toEqual(['a']);
    graph.selectLink('a~b~0');
    expect(graph.selectedLinks()).toEqual(['a~b~0']);
    graph.clearSelection();
    expect(graph.selectedNodes()).toEqual([]);

    graph.focus('a');
    graph.unfocus();

    const before = graph.theme.background;
    graph.setTheme({ name: 'light' });
    expect(graph.theme.background).not.toBe(before);

    graph.setPhysics({ repulsion: 900 });
    expect(graph.physics.options.repulsion).toBe(900);
    graph.usePreset('liquid');
    expect(graph.physics.options.damping).toBe(0.96);
    graph.setInteraction({ wheelZoomSpeed: 2 });

    graph.reboot();
    graph.destroy();
  });

  it('should expose camera, loop and utility controls', async () => {
    const canvas = document.createElement('canvas');
    (canvas as unknown as { toDataURL: unknown }).toDataURL = jest.fn(() => 'data:image/png;base64,shot');
    const graph = new Graphium({ canvas, autoStart: false, autoResize: false });
    graph.addNodes([
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 100, y: 0 },
    ]);
    graph.link('a', 'b', {});

    graph.fit(40);
    graph.centerOn(0, 0);
    graph.zoomBy(1.2);
    graph.zoomTo(1.5);
    expect(graph.camera.zoom).toBe(1.5);
    const world = graph.screenToWorld(10, 10);
    expect(Number.isFinite(world.x)).toBe(true);

    const energy = graph.step(1 / 60);
    expect(energy).toBeGreaterThanOrEqual(0);
    graph.render();
    graph.requestRender();

    graph.start();
    expect(graph.running).toBe(true);
    graph.running = false;
    expect(graph.running).toBe(false);
    graph.start();
    graph.stop();
    expect(graph.sleeping).toBe(false);

    const stats = graph.stats();
    expect(stats.nodeCount).toBe(2);
    expect(stats.fps).toBeGreaterThan(0);

    expect(graph.screenshot()).toBe('data:image/png;base64,shot');
    await graph.loadImages();

    const oncePayloads: number[] = [];
    const stopOnce = graph.once('ping', payload => oncePayloads.push(payload as number));
    graph.emit('ping', 7);
    graph.emit('ping', 8);
    expect(oncePayloads).toEqual([7]);
    stopOnce();
    const stop = graph.on('ping', () => oncePayloads.push(99));
    stop();
    graph.off('ping');
    graph.emit('ping', 0);

    expect(graph.destroyed).toBe(false);
    graph.destroy();
    expect(graph.destroyed).toBe(true);
    graph.destroy(); // second call is a no-op
    expect(graph.running).toBe(false);
  });

  it('should emit lifecycle events around start and stop', () => {
    const graph = new Graphium({ autoStart: false, autoResize: false, interaction: false });
    const lifecycle: string[] = [];
    graph.on('start', () => lifecycle.push('start'));
    graph.on('stop', () => lifecycle.push('stop'));
    graph.start();
    graph.stop();
    expect(lifecycle).toEqual(['start', 'stop']);
    graph.destroy();
  });

  it('should find links through the public picking api', () => {
    const graph = new Graphium({ autoStart: false, autoResize: false, interaction: false });
    graph.addNode('a', { x: -100, y: 0 });
    graph.addNode('b', { x: 100, y: 0 });
    graph.link('a', 'b', { id: 'ab', width: 4 });
    expect(graph.pickLinkAt(0, 0, 8)).toBe(0);
    expect(graph.pickLinkAt(0, 500, 4)).toBe(-1);
    graph.destroy();
  });

  it('should wake through onWake from the physics and keep the loop alive', () => {
    const graph = new Graphium({ autoStart: false, autoResize: false, interaction: false });
    graph.addNode('a', { x: 0, y: 0 });
    graph.physics.sleeping = true;
    graph.physics.wake();
    expect(graph.physics.sleeping).toBe(false);
    graph.destroy();
  });
});

describe('Graphium facade remaining branches', () => {
  beforeAll(() => {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      static instances: Array<{ observe: jest.Mock; callback: () => void }> = [];
      callback: () => void;
      observe = jest.fn();
      disconnect = jest.fn();
      constructor(callback: () => void) {
        this.callback = callback;
        (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver;
        (this.constructor as unknown as { instances: Array<{ observe: jest.Mock; callback: () => void }> }).instances.push(this);
      }
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should wire auto resize, auto start and atlas event forwarding', async () => {
    jest.useFakeTimers();
    const graph = new Graphium({ container: createHost() }); // autoStart + autoResize defaults
    // Auto start spawned a frame; running the clock exercises the loop.
    jest.advanceTimersByTime(32);
    // The atlas event is forwarded to the graph emitter and dirties the view.
    const seen: string[] = [];
    graph.on('imageload', () => seen.push('imageload'));
    graph.atlas.onEvent?.({ type: 'imageload', url: 'x.png', slot: 0 });
    expect(seen).toEqual(['imageload']);
    graph.stop();
    graph.destroy();
    jest.useRealTimers();
  });

  it('should invoke the auto fit hook on the first rendered frame', () => {
    const graph = new Graphium({ container: createHost(), autoStart: false, autoFit: true, autoResize: false });
    graph.addNode('a', { x: 0, y: 0 });
    graph.render();
    expect(graph.camera.x).toBe(0);
    graph.destroy();
  });

  it('should observe canvas resizes when auto resize is on', () => {
    const graph = new Graphium({ container: createHost(), autoStart: false });
    const instances = ((globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver as unknown as { instances: Array<{ callback: () => void }> }).instances;
    const observer = instances[instances.length - 1];
    expect(observer).toBeDefined();
    const before = graph.camera.width;
    observer.callback();
    expect(graph.camera.width).toBeGreaterThanOrEqual(before);
    graph.destroy();
  });

  it('should delegate removal and clearing through the editor', () => {
    const graph = new Graphium({ autoStart: false, autoResize: false, interaction: false });
    graph.addNode('a', { x: 0, y: 0 });
    graph.addNode('b', { x: 50, y: 0 });
    graph.link('a', 'b', {});
    expect(graph.removeLink('a~b~0')).toBe(true);
    expect(graph.removeNode('a')).toBe(true);
    expect(graph.removeNode('a')).toBe(false);
    graph.addNode('c', { x: 0, y: 0 });
    graph.clear();
    expect(graph.nodeCount).toBe(0);
    graph.destroy();
  });

  it('should guard double start and double stop', () => {
    const graph = new Graphium({ autoStart: false, autoResize: false, interaction: false });
    graph.start();
    const events: string[] = [];
    graph.on('start', () => events.push('start'));
    graph.on('stop', () => events.push('stop'));
    graph.start(); // already running: no duplicate event
    graph.stop(); // the real transition emits
    graph.stop(); // already stopped: no duplicate event
    expect(events).toEqual(['stop']);
    graph.destroy();
  });
});

describe('Graphium fit on empty graphs', () => {
  it('should keep the camera untouched when fitting an empty graph', () => {
    const graph = new Graphium({ autoStart: false, autoResize: false, interaction: false });
    const x = graph.camera.x;
    const zoom = graph.camera.zoom;
    graph.fit(40);
    expect(graph.camera.x).toBe(x);
    expect(graph.camera.zoom).toBe(zoom);
    graph.destroy();
  });
});

describe('Graphium default parameters and theme merge branches', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should construct with no options at all', () => {
    const graph = new Graphium();
    expect(graph.model).toBeDefined();
    graph.stop();
    graph.destroy();
  });

  it('should use default parameters on step and pickLinkAt', () => {
    const graph = new Graphium({ autoStart: false, autoResize: false, interaction: false });
    graph.addNode('a', { x: 0, y: 0 });
    expect(graph.step()).toBeGreaterThanOrEqual(0);
    expect(graph.pickLinkAt(0, 0)).toBe(-1);
    graph.destroy();
  });

  it('should merge themes without a name over the stored options', () => {
    const graph = new Graphium({ autoStart: false, autoResize: false, interaction: false, theme: { background: '#101010' } });
    graph.setTheme({}); // no name, no overrides: base comes from stored options
    expect(graph.theme.background).toBe('#101010');
    graph.setTheme({ label: { enabled: false } });
    expect(graph.labels.minZoom).toBe(2);
    graph.setTheme({ label: { enabled: true } });
    expect(graph.labels.minZoom).toBe(0.3);
    graph.destroy();
  });

  it('should fail with a clear error when WebGL2 is unavailable', () => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = jest.fn(() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    const host = createHost();
    try {
      expect(() => new Graphium({ container: host, autoStart: false, autoResize: false })).toThrow(/WebGL2/);
      expect(host.querySelector('canvas')).toBeNull(); // the abandoned canvas is cleaned up
    } finally {
      HTMLCanvasElement.prototype.getContext = original;
    }
  });

  it('should disconnect the resize observer on destroy', () => {
    const observers: Array<{ disconnect: jest.Mock; observe: jest.Mock }> = [];
    class StubResizeObserver {
      disconnect = jest.fn();
      observe = jest.fn();
      unobserve = jest.fn();
      constructor() {
        observers.push(this);
      }
    }
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = StubResizeObserver;
    try {
      const graph = new Graphium({ container: createHost(), autoStart: false });
      expect(observers).toHaveLength(1);
      expect(observers[0].observe).toHaveBeenCalled();
      graph.destroy();
      expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
    } finally {
      delete (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver;
    }
  });
});
