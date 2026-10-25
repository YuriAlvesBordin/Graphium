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

  it('should exclude hidden nodes from the constrained graph bounds', () => {
    const graph = Graphium.create({
      container: createHost(),
      autoStart: false,
      constrainToViewport: true,
    });

    graph.addNodes([
      { id: 'visible', x: 0, y: 0, radius: 10 },
      { id: 'ghost', x: 5000, y: 5000, radius: 10, hidden: true },
    ]);

    // Reaplica o confinamento (equivalente ao que o render loop faz a cada frame)
    graph.resize();

    // O nó oculto não participa dos bounds: confinam apenas os visíveis.
    const bounds = graph.camera.getBounds();
    expect(bounds).not.toBeNull();
    expect(bounds!.minX).toBeCloseTo(-10);
    expect(bounds!.minY).toBeCloseTo(-10);
    expect(bounds!.maxX).toBeCloseTo(10);
    expect(bounds!.maxY).toBeCloseTo(10);

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

  it('should keep the whole content visible when the camera pans far away', () => {
    const graph = Graphium.create({
      container: createHost(),
      autoStart: false,
      constrainToViewport: true,
    });

    graph.addNode('a', { x: 100, y: 100, radius: 20 });

    // Conteúdo pequeno cabe na tela: o clamp não recentraliza por conta
    // própria, mas puxa a câmera o mínimo para nenhuma parte do conteúdo
    // sair da viewport (bounds com raio: 80..120 em ambos os eixos).
    const halfWidth = graph.camera.width / graph.camera.zoom * 0.5;
    const halfHeight = graph.camera.height / graph.camera.zoom * 0.5;
    expect(graph.camera.x).toBeCloseTo(Math.max(120 - halfWidth, Math.min(80 + halfWidth, 0)));
    expect(graph.camera.y).toBeCloseTo(Math.max(120 - halfHeight, Math.min(80 + halfHeight, 0)));

    // Pan fica livre dentro da folga, mas a câmera desliza o mínimo para
    // o conteúdo inteiro permanecer visível.
    graph.camera.pan(5000, 5000);
    expect(graph.camera.x).toBeCloseTo(80 + halfWidth);
    expect(graph.camera.y).toBeCloseTo(80 + halfHeight);

    // Nenhuma parte do conteúdo ficou fora da viewport.
    expect(graph.camera.x - halfWidth).toBeLessThanOrEqual(80);
    expect(graph.camera.y - halfHeight).toBeLessThanOrEqual(80);
    expect(graph.camera.x + halfWidth).toBeGreaterThanOrEqual(120);
    expect(graph.camera.y + halfHeight).toBeGreaterThanOrEqual(120);

    graph.destroy();
  });

  it('should keep the camera frozen while a node is dragged', () => {
    const graph = Graphium.create({
      container: createHost(),
      autoStart: false,
      constrainToViewport: true,
    });

    graph.addNode('a', { x: 0, y: 0, radius: 20 });
    graph.render();

    const canvas = graph.renderer.canvas;
    canvas.setPointerCapture = () => {};
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 800, height: 400 }) as DOMRect;
    const cameraBefore = { x: graph.camera.x, y: graph.camera.y };

    // Pressiona o nó (world 0,0 => client 400,200) e arrasta para bem
    // além da borda direita da viewport.
    canvas.dispatchEvent(new MouseEvent('pointerdown', { clientX: 400, clientY: 200, button: 0 }));
    canvas.dispatchEvent(new MouseEvent('pointermove', { clientX: 1200, clientY: 210 }));

    // A câmera não reage aos bounds em movimento durante o arraste.
    expect(graph.camera.x).toBeCloseTo(cameraBefore.x);
    expect(graph.camera.y).toBeCloseTo(cameraBefore.y);

    // O alvo do arraste foi preso ao retângulo visível: a física conduz o
    // nó até a borda menos o raio — e não até a posição do ponteiro.
    for (let i = 0; i < 120; i++) {
      graph.step(1 / 60);
    }
    const halfWidth = graph.camera.width / graph.camera.zoom * 0.5;
    const dragged = graph.model.x[graph.model.nodeIndexOf('a') as number];
    expect(dragged).toBeCloseTo(graph.camera.x + halfWidth - 20);
    expect(graph.camera.x).toBeCloseTo(cameraBefore.x);

    // Ao soltar, o clamp da câmera volta a valer.
    canvas.dispatchEvent(new MouseEvent('pointerup', { clientX: 1200, clientY: 210 }));
    graph.step(1 / 60);
    expect(graph.camera.x).toBeGreaterThanOrEqual(dragged + 20 - halfWidth);

    graph.destroy();
  });
});
