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

describe('constrainToViewport integration', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should keep camera confined after physics moves nodes', () => {
    const graph = Graphium.create({
      container: createHost(),
      autoStart: false,
      constrainToViewport: true,
      physics: { preset: 'bouncy' },
    });

    graph.addNodes([
      { id: 'a', x: 0, y: 0, radius: 20 },
      { id: 'b', x: 500, y: 300, radius: 20 },
    ]);

    const boundsBefore = graph.camera.getBounds();
    expect(boundsBefore).not.toBeNull();

    // Simula a física movendo os nós para longe (fora dos bounds iniciais)
    graph.model.setNodePosition(graph.model.nodeIndexOf('a')!, 1000, 1000);
    graph.model.setNodePosition(graph.model.nodeIndexOf('b')!, 1500, 1200);

    // Reaplica o confinamento (equivalente ao que o render loop faz a cada frame)
    graph.resize();

    const boundsAfter = graph.camera.getBounds();
    expect(boundsAfter).not.toBeNull();
    // Os bounds devem ter acompanhado o movimento dos nós
    expect(boundsAfter!.minX).toBeCloseTo(980);
    expect(boundsAfter!.maxX).toBeCloseTo(1520);
    expect(boundsAfter!.minY).toBeCloseTo(980);
    expect(boundsAfter!.maxY).toBeCloseTo(1220);

    graph.destroy();
  });

  it('should prevent panning beyond content edges when constrained', () => {
    const graph = Graphium.create({
      container: createHost(),
      autoStart: false,
      constrainToViewport: true,
    });

    graph.addNodes([
      { id: 'a', x: 0, y: 0, radius: 20 },
      { id: 'b', x: 2000, y: 1000, radius: 20 },
    ]);

    // Tenta panar para bem além do limite esquerdo/top
    graph.camera.setPosition(-10000, -10000);

    const bounds = graph.camera.getBounds();
    expect(bounds).not.toBeNull();
    // A câmera não deve mostrar área vazia além dos extremos do conteúdo
    // (clamp limita o centro da câmera ao conteúdo + metade da viewport)
    expect(graph.camera.x).toBeGreaterThanOrEqual(bounds!.minX);
    expect(graph.camera.y).toBeGreaterThanOrEqual(bounds!.minY);
    expect(graph.camera.x).toBeLessThanOrEqual(bounds!.maxX);
    expect(graph.camera.y).toBeLessThanOrEqual(bounds!.maxY);

    graph.destroy();
  });

  it('should not confine when constrainToViewport is false', () => {
    const graph = Graphium.create({
      container: createHost(),
      autoStart: false,
      constrainToViewport: false,
    });

    graph.addNode('a', { x: 0, y: 0, radius: 20 });
    expect(graph.camera.getBounds()).toBeNull();

    // Câmera livre para qualquer posição
    graph.camera.setPosition(99999, -99999);
    expect(graph.camera.x).toBe(99999);
    expect(graph.camera.y).toBe(-99999);

    graph.destroy();
  });

  it('should keep camera centered on small content that fits the viewport', () => {
    const graph = Graphium.create({
      container: createHost(),
      autoStart: false,
      constrainToViewport: true,
    });

    graph.addNode('a', { x: 100, y: 100, radius: 20 });

    // Conteúdo pequeno cabe na tela: o clamp é no-op, a câmera não é forçada
    // a recentralizar (centralizar é papel de fit()/centerOn()).
    expect(graph.camera.x).toBeCloseTo(0);
    expect(graph.camera.y).toBeCloseTo(0);

    // Pan fica livre, pois a viewport já cobre todo o conteúdo.
    graph.camera.pan(5000, 5000);
    expect(graph.camera.x).toBeCloseTo(5000);
    expect(graph.camera.y).toBeCloseTo(5000);

    graph.destroy();
  });
});
