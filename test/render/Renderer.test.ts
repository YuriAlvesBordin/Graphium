/**
 * @jest-environment jsdom
 */

import { Renderer } from '../../src/render/Renderer';
import { Camera } from '../../src/render/Camera';
import { GraphModel, NODE_DISABLED, NODE_DRAGGED, NODE_FIXED, NODE_HIDDEN, NODE_SELECTED } from '../../src/core/GraphModel';
import { TextureAtlas } from '../../src/render/TextureAtlas';
import { DEFAULT_THEME, resolveTheme } from '../../src/core/theme';

interface FakeGL extends Record<string, unknown> {
  canvas: unknown;
}

// The texture atlas needs an OffscreenCanvas; jsdom may not provide one.
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
});

function createFakeGL(options: { failCompile?: boolean; failLink?: boolean } = {}): FakeGL {
  const calls = { bufferData: [] as unknown[][], drawArraysInstanced: [] as unknown[][] };
  const gl: Record<string, unknown> = {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    ARRAY_BUFFER: 5,
    STATIC_DRAW: 6,
    DYNAMIC_DRAW: 7,
    FLOAT: 8,
    BLEND: 9,
    SRC_ALPHA: 10,
    ONE_MINUS_SRC_ALPHA: 11,
    ONE: 12,
    COLOR_BUFFER_BIT: 13,
    TRIANGLE_FAN: 14,
    TRIANGLE_STRIP: 15,
    TEXTURE0: 16,
    TEXTURE_2D: 17,
    createShader: jest.fn(() => ({ id: 'shader' })),
    shaderSource: jest.fn(),
    compileShader: jest.fn(),
    getShaderParameter: jest.fn(() => !options.failCompile),
    getShaderInfoLog: jest.fn(() => 'compile log'),
    deleteShader: jest.fn(),
    createProgram: jest.fn(() => ({ id: 'program' })),
    attachShader: jest.fn(),
    linkProgram: jest.fn(),
    getProgramParameter: jest.fn(() => !options.failLink),
    getProgramInfoLog: jest.fn(() => 'link log'),
    deleteProgram: jest.fn(),
    createTexture: jest.fn(() => ({ id: 'texture' })),
    texParameteri: jest.fn(),
    texImage2D: jest.fn(),
    createBuffer: jest.fn(() => ({ id: 'buffer' })),
    bindBuffer: jest.fn(),
    bufferData: jest.fn((...args: unknown[]) => {
      calls.bufferData.push(args);
      return undefined;
    }),
    createVertexArray: jest.fn(() => ({ id: 'vao' })),
    bindVertexArray: jest.fn(),
    enableVertexAttribArray: jest.fn(),
    vertexAttribPointer: jest.fn(),
    vertexAttribDivisor: jest.fn(),
    enable: jest.fn(),
    blendFuncSeparate: jest.fn(),
    viewport: jest.fn(),
    clearColor: jest.fn(),
    clear: jest.fn(),
    useProgram: jest.fn(),
    uniformMatrix3fv: jest.fn(),
    uniform1f: jest.fn(),
    uniform4fv: jest.fn(),
    uniform1i: jest.fn(),
    getUniformLocation: jest.fn(() => ({ id: 'location' })),
    drawArraysInstanced: jest.fn((...args: unknown[]) => {
      calls.drawArraysInstanced.push(args);
      return undefined;
    }),
    activeTexture: jest.fn(),
    bindTexture: jest.fn(),
    deleteBuffer: jest.fn(),
    deleteVertexArray: jest.fn(),
    __calls: calls,
  };
  return gl as unknown as FakeGL;
}

function callsOf(gl: FakeGL): { bufferData: unknown[][]; drawArraysInstanced: unknown[][] } {
  return (gl as unknown as { __calls: { bufferData: unknown[][]; drawArraysInstanced: unknown[][] } }).__calls;
}

function createCanvas(gl: unknown): HTMLCanvasElement {
  return {
    getContext: jest.fn(() => gl),
    width: 0,
    height: 0,
    toDataURL: jest.fn(() => 'data:image/png;base64,stub'),
  } as unknown as HTMLCanvasElement;
}

function makeModel(nodeCount = 3): GraphModel {
  const model = new GraphModel({ nodeCapacity: 64, linkCapacity: 64, theme: DEFAULT_THEME });
  model.addNode('a', { x: -60, y: 0, label: 'A' });
  for (let i = 1; i < nodeCount; i++) {
    model.addNode(`n${i}`, { x: i * 60, y: i % 2 === 0 ? 20 : -20 });
  }
  return model;
}

describe('Renderer', () => {
  it('should initialize programs, buffers and blend state when webgl2 exists', () => {
    const gl = createFakeGL();
    const canvas = createCanvas(gl);
    new Renderer(canvas, DEFAULT_THEME);
    expect(canvas.getContext).toHaveBeenCalledWith('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true });
    expect(gl.createProgram).toHaveBeenCalledTimes(3);
    expect(gl.enable).toHaveBeenCalledWith(gl.BLEND);
    expect(gl.getShaderParameter).toHaveBeenCalled();
  });

  it('should keep working without a webgl2 context', () => {
    const canvas = createCanvas(null);
    const renderer = new Renderer(canvas, DEFAULT_THEME);
    const model = makeModel();
    expect(renderer.render(model)).toBe(renderer);
    expect(() => renderer.destroy()).not.toThrow();
    expect(renderer.gl).toBeNull();
  });

  it('should fail loudly when a shader does not compile', () => {
    const gl = createFakeGL({ failCompile: true });
    expect(() => new Renderer(createCanvas(gl), DEFAULT_THEME)).toThrow(/shader error/);
  });

  it('should fail loudly when a program does not link', () => {
    const gl = createFakeGL({ failLink: true });
    expect(() => new Renderer(createCanvas(gl), DEFAULT_THEME)).toThrow(/program error/);
  });

  it('should resize with a clamped pixel ratio and update the camera', () => {
    const gl = createFakeGL();
    const renderer = new Renderer(createCanvas(gl), DEFAULT_THEME, { maxPixelRatio: 2 });
    const camera = new Camera();
    renderer.setCamera(camera);
    renderer.resize(100, 50, 4);
    expect(renderer.canvas.width).toBe(200);
    expect(renderer.canvas.height).toBe(100);
    expect(camera.width).toBe(200);
    renderer.resize(100, 50, 0.1);
    expect(renderer.canvas.width).toBe(50);
    renderer.resize(100, 50, Number.NaN);
    expect(renderer.canvas.width).toBe(100);
    expect(gl.viewport).toHaveBeenCalled();
  });

  it('should compute the clear color from the theme background', () => {
    const gl = createFakeGL();
    const renderer = new Renderer(createCanvas(gl), DEFAULT_THEME);
    renderer.setTheme(resolveTheme({ background: '#ff0000' }));
    renderer.setCamera(new Camera());
    renderer.render(makeModel());
    expect(gl.clearColor).toHaveBeenCalledWith(1, 0, 0, 1);
  });

  it('should draw straight edges, curved edges, arrows and nodes in one frame', () => {
    const gl = createFakeGL();
    const renderer = new Renderer(createCanvas(gl), DEFAULT_THEME, { fadeZoom: 0.1 });
    const camera = new Camera();
    camera.setViewport(800, 400);
    renderer.setCamera(camera);
    const atlas = new TextureAtlas(gl as unknown as WebGL2RenderingContext);
    renderer.setAtlas(atlas);

    const model = new GraphModel({ theme: DEFAULT_THEME });
    model.addNode('a', { x: -80, y: 0, label: 'A', image: 'face.png' });
    model.addNode('b', { x: 80, y: 0 });
    model.addNode('c', { x: 0, y: 60 });
    model.addLink('straight', 'a', 'b', {});
    model.addLink('curved', 'a', 'c', { curvature: 0.4, style: 'dashed', dashPattern: [4, 2], arrow: true });
    model.setNodeState(1, 'selected');
    model.setNodeState(2, 'hover');
    model.setNodeFixed(0, true);

    renderer.render(model);
    const { drawArraysInstanced } = callsOf(gl);
    expect(drawArraysInstanced.length).toBe(4);
    // Straight fan, curve strip, arrow fan, node fan.
    expect(drawArraysInstanced[0][0]).toBe(gl.TRIANGLE_FAN);
    expect(drawArraysInstanced[1][0]).toBe(gl.TRIANGLE_STRIP);
    expect(drawArraysInstanced[2][0]).toBe(gl.TRIANGLE_FAN);
    expect(drawArraysInstanced[3][0]).toBe(gl.TRIANGLE_FAN);
    expect(drawArraysInstanced[3][3]).toBe(3); // every visible node drawn
    expect(renderer.lastRenderMs).toBeGreaterThanOrEqual(0);
    // The atlas got an upload and sweep from the render pass.
    expect(atlas.update()).toBe(false); // nothing changed since the render
  });

  it('should draw arrows for a single forced link and skip degenerate ones', () => {
    const gl = createFakeGL();
    const renderer = new Renderer(createCanvas(gl), resolveTheme({ edge: { arrowEnabled: false } }));
    renderer.setCamera(new Camera());
    const model = new GraphModel({ theme: DEFAULT_THEME });
    model.addNode('a', { x: -50, y: 0 });
    model.addNode('b', { x: 50, y: 0 });
    model.addNode('c', { x: 200, y: 0 });
    model.addNode('d', { x: 260, y: 0 });
    model.addNode('e', { x: 400, y: 0 });
    model.addNode('f', { x: 460, y: 0 });
    // Curved links keep the pass order fixed: curves, arrows, nodes.
    model.addLink('forced', 'a', 'b', { arrow: true, arrowSize: 8, curvature: 0.3 });
    model.addLink('tiny', 'c', 'd', { arrow: true, arrowSize: 0, curvature: 0.3 });
    model.addLink('degenerate', 'e', 'f', { arrow: true, arrowSize: 8, curvature: 0.3 });
    model.setNodePosition(4, 400, 0);
    model.setNodePosition(5, 400, 0); // same position -> zero chord edge
    renderer.render(model);
    const { drawArraysInstanced } = callsOf(gl);
    const arrowCall = drawArraysInstanced[1];
    expect(arrowCall[0]).toBe(gl.TRIANGLE_FAN);
    expect(arrowCall[3]).toBe(1); // only the forced, non degenerate arrow
  });

  it('should respect per link arrow overrides over the theme', () => {
    const gl = createFakeGL();
    const renderer = new Renderer(createCanvas(gl), resolveTheme({ edge: { arrowEnabled: true } }));
    renderer.setCamera(new Camera());
    const model = new GraphModel({ theme: DEFAULT_THEME });
    model.addNode('a', { x: -50, y: 0 });
    model.addNode('b', { x: 50, y: 0 });
    model.addNode('c', { x: 200, y: 0 });
    model.addNode('d', { x: 300, y: 0 });
    model.addLink('off', 'a', 'b', { arrow: false, curvature: 0.25 });
    model.addLink('on', 'c', 'd', { curvature: 0.25 });
    renderer.render(model);
    const { drawArraysInstanced } = callsOf(gl);
    expect(drawArraysInstanced[1][3]).toBe(1);
  });

  it('should handle every node state code and hidden nodes', () => {
    const gl = createFakeGL();
    const renderer = new Renderer(createCanvas(gl), DEFAULT_THEME);
    renderer.setCamera(new Camera());
    const model = new GraphModel({ theme: DEFAULT_THEME });
    model.addNode('normal', { x: 0, y: 0 });
    model.addNode('selected', { x: 40, y: 0 });
    model.addNode('dragged', { x: 80, y: 0 });
    model.addNode('fixed', { x: 120, y: 0 });
    model.addNode('disabled', { x: 160, y: 0 });
    model.addNode('ghost', { x: 200, y: 0, hidden: true });
    model.setNodeSelected(1, true);
    model.flags[2] |= NODE_DRAGGED;
    model.flags[3] |= NODE_FIXED;
    model.flags[4] |= NODE_DISABLED;
    renderer.render(model);
    const { drawArraysInstanced } = callsOf(gl);
    expect(drawArraysInstanced[drawArraysInstanced.length - 1][3]).toBe(5);
  });

  it('should fade rings when zoomed far out', () => {
    const gl = createFakeGL();
    const renderer = new Renderer(createCanvas(gl), DEFAULT_THEME, { fadeZoom: 0.5 });
    const camera = new Camera();
    camera.setViewport(800, 400);
    camera.setZoom(0.2);
    renderer.setCamera(camera);
    renderer.render(makeModel(1));
    expect(gl.uniform1f).toHaveBeenCalled();
  });

  it('should grow instance buffers past their initial capacity', () => {
    const gl = createFakeGL();
    const renderer = new Renderer(createCanvas(gl), DEFAULT_THEME);
    renderer.setCamera(new Camera());
    const model = new GraphModel({ theme: DEFAULT_THEME });
    // 260 straight, 260 curved, 260 arrows and 260 nodes.
    for (let i = 0; i < 260; i++) {
      model.addNode(`n${i}`, { x: i, y: 0 });
    }
    for (let i = 1; i < 260; i++) {
      model.addLink(`s${i}`, `n${i - 1}`, `n${i}`, {});
      model.addLink(`c${i}`, `n${i - 1}`, `n${i}`, { curvature: 0.2, arrow: true });
    }
    renderer.render(model);
    const { drawArraysInstanced } = callsOf(gl);
    expect(drawArraysInstanced[0][3]).toBe(259); // straight edges
    expect(drawArraysInstanced[1][3]).toBe(259); // curved edges
    expect(drawArraysInstanced[2][3]).toBe(259); // arrows
    expect(drawArraysInstanced[3][3]).toBe(260); // nodes
  });

  it('should skip edges whose endpoints share a position', () => {
    const gl = createFakeGL();
    const renderer = new Renderer(createCanvas(gl), DEFAULT_THEME);
    renderer.setCamera(new Camera());
    const model = new GraphModel({ theme: DEFAULT_THEME });
    model.addNode('a', { x: 10, y: 10 });
    model.addNode('b', { x: 10, y: 10 });
    model.addLink('zero', 'a', 'b', {});
    renderer.render(model);
    const { drawArraysInstanced } = callsOf(gl);
    // The empty edge fan is skipped entirely; only nodes are drawn.
    expect(drawArraysInstanced.length).toBe(1);
    expect(drawArraysInstanced[0][3]).toBe(2);
  });

  it('should render without an atlas and never touch textures or sweep', () => {
    const gl = createFakeGL();
    const renderer = new Renderer(createCanvas(gl), DEFAULT_THEME);
    renderer.setCamera(new Camera());
    renderer.render(makeModel(2));
    expect(gl.activeTexture).not.toHaveBeenCalled();
    expect(gl.bindTexture).not.toHaveBeenCalled();
  });

  it('should release every gl resource on destroy', () => {
    const gl = createFakeGL();
    const renderer = new Renderer(createCanvas(gl), DEFAULT_THEME);
    renderer.destroy();
    expect(gl.deleteProgram).toHaveBeenCalledTimes(3);
    expect(gl.deleteBuffer).toHaveBeenCalledTimes(6);
    expect(gl.deleteVertexArray).toHaveBeenCalledTimes(4);
    expect(renderer.gl).toBeNull();
    renderer.destroy(); // second pass is a no-op through the null guard
  });
});

describe('Renderer remaining branches', () => {
  it('should fail loudly when the gl cannot create a shader', () => {
    const gl = createFakeGL();
    (gl as Record<string, unknown>).createShader = jest.fn(() => null);
    expect(() => new Renderer(createCanvas(gl), DEFAULT_THEME)).toThrow(/could not create a shader/);
  });

  it('should fail loudly when the gl cannot create a program', () => {
    const gl = createFakeGL();
    (gl as Record<string, unknown>).createProgram = jest.fn(() => null);
    expect(() => new Renderer(createCanvas(gl), DEFAULT_THEME)).toThrow(/could not create a program/);
  });

  it('should skip hidden links in every fill pass', () => {
    const gl = createFakeGL();
    const renderer = new Renderer(createCanvas(gl), resolveTheme({ edge: { arrowEnabled: true } }));
    renderer.setCamera(new Camera());
    const model = new GraphModel({ theme: DEFAULT_THEME });
    model.addNode('a', { x: 0, y: 0 });
    model.addNode('b', { x: 60, y: 0 });
    model.addNode('c', { x: 120, y: 0 });
    model.addLink('visible', 'a', 'b', { arrow: true });
    model.addLink('ghostStraight', 'b', 'c', { hidden: true });
    model.addLink('ghostCurved', 'b', 'c', { hidden: true, curvature: 0.3, arrow: true });
    renderer.render(model);
    const { drawArraysInstanced } = callsOf(gl);
    // Straight fan 1, curve strip 0 (skipped), arrow fan 1, node fan 3.
    expect(drawArraysInstanced.length).toBe(3);
    expect(drawArraysInstanced[0][3]).toBe(1);
    expect(drawArraysInstanced[1][3]).toBe(1);
    expect(drawArraysInstanced[2][3]).toBe(3);
  });

  it('should request atlas slots for nodes with images', () => {
    const gl = createFakeGL();
    const renderer = new Renderer(createCanvas(gl), DEFAULT_THEME);
    renderer.setCamera(new Camera());
    const atlas = new TextureAtlas(gl as unknown as WebGL2RenderingContext);
    const requestSpy = jest.spyOn(atlas, 'request');
    renderer.setAtlas(atlas);
    const model = new GraphModel({ theme: DEFAULT_THEME });
    model.addNode('pictured', { x: 0, y: 0, image: 'me.png', imageMode: 'contain' });
    renderer.render(model);
    expect(requestSpy).toHaveBeenCalledWith('me.png', 'contain');
  });
});
