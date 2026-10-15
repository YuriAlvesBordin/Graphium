/**
 * @jest-environment jsdom
 */

import { LabelLayer } from '../../src/render/LabelLayer';
import { Camera } from '../../src/render/Camera';
import { GraphModel, NODE_DIM, NODE_HIDDEN } from '../../src/core/GraphModel';
import { DEFAULT_THEME, resolveTheme } from '../../src/core/theme';

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

  it('should cap the pool at four hundred visible labels', () => {
    const { layer, model } = makeLayer();
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
