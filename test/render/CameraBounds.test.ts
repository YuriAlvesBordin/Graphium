import { Camera } from '../../src/render/Camera';

describe('Camera bounds', () => {
  const viewport = { width: 800, height: 400 };

  beforeEach(() => {
    // Nenhuma influência de estado entre testes.
  });

  it('should keep the camera inside the viewport when content is smaller than the view', () => {
    const camera = new Camera({ zoom: 1 });
    camera.setViewport(viewport.width, viewport.height);
    camera.setBounds(100, 100, 300, 300);

    // Conteúdo cabe na tela: o clamp é no-op — a câmera já mostra tudo.
    expect(camera.x).toBe(0);
    expect(camera.y).toBe(0);

    // Panning fica livre, pois não há área vazia a esconder.
    camera.pan(1000, 1000);
    expect(camera.x).toBe(1000);
    expect(camera.y).toBe(1000);
  });

  it('should clamp panning to the content edges when content is larger than the view', () => {
    const camera = new Camera({ zoom: 1 });
    camera.setViewport(viewport.width, viewport.height);
    camera.setBounds(0, 0, 2000, 1000);

    camera.setPosition(500, 500);
    expect(camera.x).toBeCloseTo(500);
    expect(camera.y).toBeCloseTo(500);

    // Não pode mostrar área vazia além do lado esquerdo/top.
    camera.setPosition(-100, -100);
    expect(camera.x).toBe(400);
    expect(camera.y).toBe(200);

    // Não pode mostrar área vazia além do lado direito/bottom.
    camera.setPosition(10000, 10000);
    expect(camera.x).toBeCloseTo(1600);
    expect(camera.y).toBeCloseTo(800);
  });

  it('should re-clamp when zooming changes the visible world area', () => {
    const camera = new Camera({ zoom: 1 });
    camera.setViewport(viewport.width, viewport.height);
    camera.setBounds(0, 0, 2000, 1000);

    camera.setPosition(1500, 500);
    expect(camera.x).toBeCloseTo(1500);

    // Fazer zoom out amplia a área visível; a câmera deve se reajustar
    // para não ultrapassar os limites do conteúdo.
    camera.setZoom(0.5);
    expect(camera.x).toBeGreaterThanOrEqual(400);
    expect(camera.x).toBeLessThanOrEqual(1600);
  });

  it('should re-clamp when the viewport is resized', () => {
    const camera = new Camera({ zoom: 1 });
    camera.setViewport(viewport.width, viewport.height);
    camera.setBounds(0, 0, 2000, 1000);
    camera.setPosition(1500, 500);

    camera.setViewport(200, 100);
    expect(camera.x).toBeGreaterThanOrEqual(100);
    expect(camera.x).toBeLessThanOrEqual(1900);
  });

  it('should clear bounds and restore free panning', () => {
    const camera = new Camera({ zoom: 1 });
    camera.setViewport(viewport.width, viewport.height);
    camera.setBounds(0, 0, 1000, 1000);
    expect(camera.getBounds()).not.toBeNull();

    camera.clearBounds();
    expect(camera.getBounds()).toBeNull();

    camera.setPosition(99999, -99999);
    expect(camera.x).toBe(99999);
    expect(camera.y).toBe(-99999);
  });

  it('should not clamp when no bounds are set', () => {
    const camera = new Camera({ zoom: 1 });
    camera.setViewport(viewport.width, viewport.height);
    camera.setPosition(123, 456);
    expect(camera.x).toBe(123);
    expect(camera.y).toBe(456);
  });
});
