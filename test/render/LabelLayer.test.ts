/**
 * @jest-environment jsdom
 */

import { LabelLayer } from '../../src/render/LabelLayer';
import { Camera } from '../../src/render/Camera';
import { GraphModel, NODE_DIM, NODE_HIDDEN } from '../../src/core/GraphModel';
import { DEFAULT_THEME, resolveTheme } from '../../src/core/theme';

const originalGetContext = HTMLCanvasElement.prototype.getContext;

beforeAll(() => {
  // jsdom has no canvas support: answer 2D context requests quietly with null
  // so label measurement runs on the estimate fallback without console noise.
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
});

afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
});

function makeLayer(themeOverrides: Record<string, unknown> = {}) {
  const theme = resolveTheme({ ...themeOverrides });
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const layer = new LabelLayer(parent, theme);
  const model = new GraphModel({ nodeCapacity: 32, linkCapacity: 32, theme });
  const camera = new Camera();
  camera.setViewport(800, 400);
  layer.attach(model, camera);
  return { layer, model, camera, parent, theme };
}

describe('LabelLayer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should append a styled container to the host element', () => {
    const { layer, parent } = makeLayer();
    expect(parent.contains(layer.container)).toBe(true);
    expect(layer.container.style.pointerEvents).toBe('none');
  });

  it('should do nothing on update before a model is attached', () => {
    const theme = resolveTheme({});
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const layer = new LabelLayer(parent, theme);
    expect(() => layer.update()).not.toThrow();
  });

  it('should create pool elements for visible labeled nodes', () => {
    const { layer, model, camera } = makeLayer();
    model.addNode('a', { x: 0, y: 0, label: 'Alpha' });
    layer.update();
    expect(layer.container.childElementCount).toBe(1);
    const element = layer.container.firstElementChild as HTMLElement;
    expect(element.textContent).toBe('Alpha');
    expect(element.style.display).toBe('');
    expect(element.style.transform).toContain('translate3d');
    // Camera centered at (0,0): the label renders at the viewport center
    // offset by the node radius plus the label offset.
    const expectedTop = camera.zoom * (0 - camera.x) + 200 + model.visualRadius[0] * camera.zoom + DEFAULT_THEME.labelOffset;
    expect(element.style.transform).toContain(expectedTop.toFixed(1));
  });

  it('should position labels above when the theme asks for it', () => {
    const { layer, model } = makeLayer({ label: { position: 'above' } });
    model.addNode('a', { x: 0, y: 0, label: 'Top' });
    layer.update();
    const element = layer.container.firstElementChild as HTMLElement;
    const expectedTop = 200 - (model.visualRadius[0] + resolveTheme({}).labelOffset);
    expect(element.style.transform).toContain(expectedTop.toFixed(1));
  });

  it('should hide every label when labels are disabled', () => {
    const { layer, model } = makeLayer();
    model.addNode('a', { x: 0, y: 0, label: 'A' });
    layer.update();
    layer.theme = resolveTheme({ label: { enabled: false } });
    layer.update();
    const element = layer.container.firstElementChild as HTMLElement;
    expect(element.style.display).toBe('none');
  });

  it('should hide every label below the minimum zoom', () => {
    const { layer, model, camera } = makeLayer();
    model.addNode('a', { x: 0, y: 0, label: 'A' });
    layer.update();
    camera.setZoom(0.1);
    layer.update();
    const element = layer.container.firstElementChild as HTMLElement;
    expect(element.style.display).toBe('none');
  });

  it('should skip unlabeled, hidden and dimmed nodes', () => {
    const { layer, model } = makeLayer();
    model.addNode('labeled', { x: 0, y: 0, label: 'visible' });
    model.addNode('unlabeled', { x: 10, y: 0 });
    model.addNode('hidden', { x: 20, y: 0, label: 'gone', hidden: true });
    model.addNode('dimmed', { x: 30, y: 0, label: 'dim' });
    model.flags[3] |= NODE_DIM;
    layer.update();
    expect(layer.container.childElementCount).toBe(1);
    const element = layer.container.firstElementChild as HTMLElement;
    expect(element.textContent).toBe('visible');
    // Hidden and dim flags must remain untouched by the layer.
    expect(model.flags[2] & NODE_HIDDEN).toBeTruthy();
  });

  it('should skip nodes outside the viewport margin', () => {
    const { layer, model } = makeLayer();
    model.addNode('far', { x: 5000, y: 0, label: 'offscreen' });
    layer.update();
    expect(layer.container.childElementCount).toBe(0);
  });

  it('should cull labels against CSS pixel bounds on HiDPI screens', () => {
    const { layer, model, camera } = makeLayer();
    Object.defineProperty(layer.container, 'clientWidth', { value: 400 });
    Object.defineProperty(layer.container, 'clientHeight', { value: 200 });
    camera.setViewport(800, 400); // drawing buffer twice the CSS size: dpr = 2
    model.addNode('near', { x: 200, y: 0, label: 'Near' }); // CSS x 300, inside
    model.addNode('far', { x: 600, y: 0, label: 'Far' }); // CSS x 500, beyond 440
    layer.update();
    expect(layer.container.childElementCount).toBe(1);
    expect(layer.container.firstElementChild?.textContent).toBe('Near');
  });

  it('should cap the pool at four hundred visible labels', () => {
    const { layer, model } = makeLayer({ label: { cullOverlapping: false } });
    for (let i = 0; i < 450; i++) {
      model.addNode(`n${i}`, { x: i % 20, y: Math.floor(i / 20), label: `N${i}` });
    }
    layer.update();
    expect(layer.container.childElementCount).toBe(400);
  });

  it('should reuse pooled elements and hide the surplus on shrink', () => {
    const { layer, model } = makeLayer();
    model.addNode('a', { x: 0, y: 0, label: 'A' });
    model.addNode('b', { x: 30, y: 0, label: 'B' });
    layer.update();
    expect(layer.container.childElementCount).toBe(2);
    model.removeNode('b');
    layer.update();
    expect(layer.container.childElementCount).toBe(2); // pool keeps both
    const second = layer.container.children[1] as HTMLElement;
    expect(second.style.display).toBe('none');
  });

  it('should restyle the pool when the theme changes', () => {
    const { layer, model } = makeLayer();
    model.addNode('a', { x: 0, y: 0, label: 'A' });
    layer.update();
    layer.theme = resolveTheme({ label: { background: 'rgba(0,0,0,0.5)', padding: [12, 8], radius: 10, color: '#ffffff' } });
    layer.applyTheme();
    const element = layer.container.firstElementChild as HTMLElement;
    expect(element.style.background).toBe('rgba(0, 0, 0, 0.5)');
    expect(element.style.color).toBe('rgb(255, 255, 255)');
    expect(element.style.borderRadius).toBe('10px');
  });

  it('should remove the container and pool on destroy', () => {
    const { layer, model, parent } = makeLayer();
    model.addNode('a', { x: 0, y: 0, label: 'A' });
    layer.update();
    layer.destroy();
    expect(parent.contains(layer.container)).toBe(false);
    expect(layer.container.childElementCount).toBe(0);
  });
});

describe('LabelLayer background branches', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should style new elements with the themed background on acquire', () => {
    const theme = resolveTheme({ label: { background: 'rgba(9,9,9,0.9)', padding: [14, 10], radius: 12 } });
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const layer = new LabelLayer(parent, theme);
    const model = new GraphModel({ theme });
    const camera = new Camera();
    camera.setViewport(800, 400);
    layer.attach(model, camera);
    model.addNode('a', { x: 0, y: 0, label: 'Boxed' });
    layer.update();
    const element = layer.container.firstElementChild as HTMLElement;
    expect(element.style.background).toBe('rgba(9, 9, 9, 0.9)');
    expect(element.style.padding).toBe('10px 14px');
    expect(element.style.borderRadius).toBe('12px');
  });

  it('should clear backgrounds when the theme drops the label background', () => {
    const theme = resolveTheme({ label: { background: 'rgba(9,9,9,0.9)' } });
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const layer = new LabelLayer(parent, theme);
    const model = new GraphModel({ theme });
    const camera = new Camera();
    camera.setViewport(800, 400);
    layer.attach(model, camera);
    model.addNode('a', { x: 0, y: 0, label: 'A' });
    layer.update();
    layer.theme = resolveTheme({});
    layer.applyTheme();
    const element = layer.container.firstElementChild as HTMLElement;
    expect(element.style.background).toBe('none');
    expect(element.style.padding).toBe('0px');
  });
});

describe('LabelLayer overlap culling', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function makeCullLayer(themeOverrides: Record<string, unknown> = {}) {
    return makeLayer(themeOverrides);
  }

  it('should hide the label that would overlap a higher priority label', () => {
    const { layer, model } = makeCullLayer();
    model.addNode('big', { x: 0, y: 0, radius: 20, label: 'Big node' });
    model.addNode('small', { x: 4, y: 0, radius: 6, label: 'Small' });
    layer.update();
    expect(layer.container.childElementCount).toBe(1);
    expect(layer.container.firstElementChild?.textContent).toBe('Big node');
  });

  it('should show both labels when they do not overlap', () => {
    const { layer, model } = makeCullLayer();
    model.addNode('left', { x: 0, y: 0, label: 'Left' });
    model.addNode('right', { x: 400, y: 200, label: 'Right' });
    layer.update();
    expect(layer.container.childElementCount).toBe(2);
  });

  it('should keep the selected node label over a larger plain node', () => {
    const { layer, model } = makeCullLayer({ label: { position: 'center' } });
    model.addNode('big', { x: 0, y: 0, radius: 30, label: 'Big' });
    model.addNode('picked', { x: 6, y: 0, radius: 5, label: 'Picked', state: 'selected' });
    layer.update();
    expect(layer.container.childElementCount).toBe(1);
    expect(layer.container.firstElementChild?.textContent).toBe('Picked');
  });

  it('should keep the dragged node label over a larger plain node', () => {
    const { layer, model } = makeCullLayer({ label: { position: 'center' } });
    model.addNode('big', { x: 0, y: 0, radius: 30, label: 'Big' });
    model.addNode('moved', { x: 6, y: 0, radius: 5, label: 'Moved', state: 'dragging' });
    layer.update();
    expect(layer.container.childElementCount).toBe(1);
    expect(layer.container.firstElementChild?.textContent).toBe('Moved');
  });

  it('should break ties by insertion order for same sized nodes', () => {
    const { layer, model } = makeCullLayer();
    model.addNode('first', { x: 0, y: 0, label: 'First' });
    model.addNode('second', { x: 2, y: 0, label: 'Second' });
    layer.update();
    expect(layer.container.childElementCount).toBe(1);
    expect(layer.container.firstElementChild?.textContent).toBe('First');
  });

  it('should show every label when culling is disabled', () => {
    const { layer, model } = makeCullLayer({ label: { cullOverlapping: false } });
    model.addNode('a', { x: 0, y: 0, label: 'Alpha' });
    model.addNode('b', { x: 4, y: 0, label: 'Beta' });
    layer.update();
    expect(layer.container.childElementCount).toBe(2);
  });

  it('should account for the themed background padding when culling', () => {
    const { layer, model } = makeCullLayer({
      label: { background: 'rgba(0,0,0,0.6)', padding: [40, 10] },
    });
    model.addNode('a', { x: 0, y: 0, label: 'Alpha' });
    model.addNode('b', { x: 30, y: 0, label: 'Beta' });
    layer.update();
    // 40px horizontal padding per side makes both boxed labels collide.
    expect(layer.container.childElementCount).toBe(1);
  });

  it('should reuse measured widths from the 2D context cache', () => {
    const measureText = jest.fn(() => ({ width: 64 }));
    const contextSpy = jest
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({ measureText, font: '' } as unknown as CanvasRenderingContext2D);
    const { layer, model } = makeCullLayer();
    model.addNode('a', { x: 0, y: 0, label: 'Measured' });
    model.addNode('b', { x: 40, y: 0, label: 'Measured' });
    layer.update();
    expect(measureText).toHaveBeenCalledTimes(1); // second label hits the cache
    expect(layer.container.childElementCount).toBe(1);
    contextSpy.mockRestore();
  });

  it('should survive a throwing measurement context with the estimate fallback', () => {
    const contextSpy = jest
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(() => {
        throw new Error('no canvas');
      });
    const { layer, model } = makeCullLayer();
    model.addNode('a', { x: 0, y: 0, label: 'Estimated' });
    model.addNode('b', { x: 3, y: 0, label: 'Near' });
    layer.update();
    expect(layer.container.childElementCount).toBe(1);
    contextSpy.mockRestore();
  });

  it('should keep culling labels from more candidates than the initial buffer', () => {
    const { layer, model } = makeCullLayer();
    for (let i = 0; i < 200; i++) {
      model.addNode(`n${i}`, { x: i % 10, y: Math.floor(i / 10), label: `N${i}` });
    }
    layer.update();
    expect(layer.container.childElementCount).toBeLessThan(200);
    expect(layer.container.childElementCount).toBeGreaterThan(0);
  });

  it('should reset the measurement cache once it exceeds its bound', () => {
    const { layer, model } = makeCullLayer();
    for (let i = 0; i < 4200; i++) {
      model.addNode(`n${i}`, { x: i * 0.1 - 210, y: 0, label: `label-${i}` });
    }
    expect(() => layer.update()).not.toThrow();
    expect(layer.container.childElementCount).toBeGreaterThan(0);
  });
});
