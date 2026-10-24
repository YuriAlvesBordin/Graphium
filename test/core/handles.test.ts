/**
 * @jest-environment jsdom
 */

import { LinkHandle, NodeHandle } from '../../src/core/handles';
import { Graphium } from '../../src/Graphium';

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
    type === 'webgl2'
      ? {
          // Minimal stub: handles never render, but the renderer constructor
          // walks its full initialization path.
          VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4,
          ARRAY_BUFFER: 5, STATIC_DRAW: 6, DYNAMIC_DRAW: 7, FLOAT: 8, BLEND: 9,
          SRC_ALPHA: 10, ONE_MINUS_SRC_ALPHA: 11, ONE: 12, COLOR_BUFFER_BIT: 13,
          TRIANGLE_FAN: 14, TRIANGLE_STRIP: 15, TEXTURE0: 16, TEXTURE_2D: 17,
          LINEAR: 18, CLAMP_TO_EDGE: 19, RGBA: 20, UNSIGNED_BYTE: 21,
          createShader: () => ({}), shaderSource: () => {}, compileShader: () => {},
          getShaderParameter: () => true, getShaderInfoLog: () => '', deleteShader: () => {},
          createProgram: () => ({}), attachShader: () => {}, linkProgram: () => {},
          getProgramParameter: () => true, getProgramInfoLog: () => '', deleteProgram: () => {},
          createTexture: () => ({}), activeTexture: () => {}, bindTexture: () => {},
          texParameteri: () => {}, texImage2D: () => {},
          createBuffer: () => ({}), bindBuffer: () => {}, bufferData: () => {},
          createVertexArray: () => ({}), bindVertexArray: () => {},
          enableVertexAttribArray: () => {}, vertexAttribPointer: () => {},
          vertexAttribDivisor: () => {}, enable: () => {}, blendFuncSeparate: () => {},
          viewport: () => {}, clearColor: () => {}, clear: () => {},
          useProgram: () => {}, uniformMatrix3fv: () => {}, uniform1f: () => {},
          uniform4fv: () => {}, uniform1i: () => {}, getUniformLocation: () => ({}),
          drawArraysInstanced: () => {}, deleteBuffer: () => {}, deleteVertexArray: () => {},
        }
      : null) as unknown) as typeof HTMLCanvasElement.prototype.getContext;
});

describe('Node and Link handles', () => {
  let graph: Graphium;

  beforeEach(() => {
    graph = new Graphium({ autoStart: false, autoResize: false, interaction: false });
    graph.addNode('a', { x: 0, y: 0, label: 'A' });
    graph.addNode('b', { x: 50, y: 0 });
    graph.link('a', 'b', { id: 'ab' });
  });

  afterEach(() => {
    graph.destroy();
  });

  it('should chain every node handle operation', () => {
    const handle = graph.node('a') as NodeHandle;
    const result = handle
      .style({ radius: 21 })
      .move(12, 34)
      .fix()
      .image('face.png', 'contain')
      .image('square.png')
      .label('Alice')
      .color('#ff0000')
      .radius(9)
      .data({ tag: 'a' })
      .state('hover');
    expect(result).toBe(handle);
    const snap = handle.snapshot;
    expect(snap?.radius).toBe(9);
    expect(snap?.x).toBeCloseTo(12);
    expect(snap?.y).toBeCloseTo(34);
    expect(snap?.fixed).toBe(true);
    expect(snap?.image).toBe('square.png');
    expect(snap?.label).toBe('Alice');
    expect(snap?.data).toEqual({ tag: 'a' });
    expect(snap?.state).toBe('hover');
    handle.select();
    expect(graph.selectedNodes()).toEqual(['a']);
    handle.remove();
    expect(graph.getNode('a')).toBeNull();
  });

  it('should return null handles for missing elements', () => {
    expect(graph.node('ghost')).toBeNull();
    expect(graph.linkById('ghost')).toBeNull();
  });

  it('should chain every link handle operation', () => {
    const handle = graph.linkById('ab') as LinkHandle;
    const result = handle
      .style({ width: 5 })
      .curve(0.4)
      .restLength(180)
      .dashed([3, 5])
      .color('#00ff00')
      .data({ weight: 2 });
    expect(result).toBe(handle);
    const snap = handle.snapshot;
    expect(snap?.width).toBe(5);
    expect(snap?.curvature).toBeCloseTo(0.4);
    expect(snap?.restLength).toBe(180);
    expect(snap?.style).toBe('dashed');
    expect(snap?.dashPattern).toEqual([3, 5]);
    expect(snap?.data).toEqual({ weight: 2 });
    handle.select();
    expect(graph.selectedLinks()).toEqual(['ab']);
    handle.remove();
    expect(graph.getLink('ab')).toBeNull();
  });
});

describe('Node handle label styling shortcuts', () => {
  let graph: Graphium;

  beforeEach(() => {
    graph = new Graphium({ autoStart: false, autoResize: false, interaction: false });
    graph.addNode('a', { x: 0, y: 0, label: 'A' });
  });

  afterEach(() => {
    graph.destroy();
  });

  it('should customize label styling through handle shortcuts', () => {
    const handle = graph.node('a') as NodeHandle;
    const result = handle
      .labelScale(1.5)
      .labelSize(16)
      .labelColor('#ff0000')
      .labelWeight(300)
      .labelFont('Georgia, serif')
      .labelBackground('rgba(0,0,0,0.4)');
    expect(result).toBe(handle);
    const index = graph.model.nodeIndexOf('a');
    expect(graph.model.nodeLabelScale[index]).toBe(1.5);
    expect(graph.model.nodeLabelSize[index]).toBe(16);
    expect(graph.model.nodeLabelColor[index]).toBe('#ff0000');
    expect(graph.model.nodeLabelWeight[index]).toBe(300);
    expect(graph.model.nodeLabelFont[index]).toBe('Georgia, serif');
    expect(graph.model.nodeLabelBackground[index]).toBe('rgba(0,0,0,0.4)');
    handle.labelBackground(null);
    expect(graph.model.nodeLabelBackground[index]).toBeNull();
  });
});
