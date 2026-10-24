/**
 * @jest-environment jsdom
 */

import { Graphium } from '../../src/Graphium';
import type { FakeGL } from '../helpers/fakeGL';
import { createFakeGL } from '../helpers/fakeGL';

beforeAll(() => {
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

describe('constrainToViewport', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should not confine by default', () => {
    const graph = Graphium.create({ container: createHost(), autoStart: false });
    graph.addNode('a', { x: 10, y: 10 });
    expect(graph.camera.getBounds()).toBeNull();
    graph.destroy();
  });

  it('should confine the camera to the node bounds when enabled', () => {
    const graph = Graphium.create({ container: createHost(), autoStart: false, constrainToViewport: true });
    graph.addNode('a', { x: 10, y: 10, radius: 20 });
    const bounds = graph.camera.getBounds();
    expect(bounds).not.toBeNull();
    expect(bounds!.minX).toBe(-10);
    expect(bounds!.minY).toBe(-10);
    expect(bounds!.maxX).toBe(30);
    expect(bounds!.maxY).toBe(30);
    graph.destroy();
  });

  it('should update confinement after removing nodes', () => {
    const graph = Graphium.create({ container: createHost(), autoStart: false, constrainToViewport: true });
    graph.addNodes([
      { id: 'a', x: 0, y: 0, radius: 10 },
      { id: 'b', x: 100, y: 100, radius: 10 },
    ]);
    expect(graph.camera.getBounds()).not.toBeNull();

    graph.removeNode('b');
    const bounds = graph.camera.getBounds();
    expect(bounds).not.toBeNull();
    expect(bounds!.maxX).toBe(10);
    expect(bounds!.maxY).toBe(10);
    graph.destroy();
  });

  it('should clear confinement when the graph is emptied', () => {
    const graph = Graphium.create({ container: createHost(), autoStart: false, constrainToViewport: true });
    graph.addNode('a', { x: 0, y: 0, radius: 10 });
    expect(graph.camera.getBounds()).not.toBeNull();

    graph.clear();
    expect(graph.camera.getBounds()).toBeNull();
    graph.destroy();
  });
});
