/**
 * Builds a fake WebGL2 rendering context that satisfies every call the
 * Renderer and TextureAtlas make. All methods are jest mocks and every
 * shader or program is reported as healthy unless configured otherwise.
 */

export interface FakeGL extends Record<string, unknown> {
  failCompile: boolean;
  failLink: boolean;
}

export function createFakeGL(options: { failCompile?: boolean; failLink?: boolean } = {}): FakeGL {
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
    LINEAR: 18,
    CLAMP_TO_EDGE: 19,
    RGBA: 20,
    UNSIGNED_BYTE: 21,
    TEXTURE_MIN_FILTER: 22,
    TEXTURE_MAG_FILTER: 23,
    TEXTURE_WRAP_S: 24,
    TEXTURE_WRAP_T: 25,
    failCompile: options.failCompile ?? false,
    failLink: options.failLink ?? false,
    createShader: jest.fn(() => ({ id: 'shader' })),
    shaderSource: jest.fn(),
    compileShader: jest.fn(),
    getShaderParameter: jest.fn(function (this: FakeGL) {
      return !this.failCompile;
    }),
    getShaderInfoLog: jest.fn(() => 'compile log'),
    deleteShader: jest.fn(),
    createProgram: jest.fn(() => ({ id: 'program' })),
    attachShader: jest.fn(),
    linkProgram: jest.fn(),
    getProgramParameter: jest.fn(function (this: FakeGL) {
      return !this.failLink;
    }),
    getProgramInfoLog: jest.fn(() => 'link log'),
    deleteProgram: jest.fn(),
    createTexture: jest.fn(() => ({ id: 'texture' })),
    activeTexture: jest.fn(),
    bindTexture: jest.fn(),
    texParameteri: jest.fn(),
    texImage2D: jest.fn(),
    createBuffer: jest.fn(() => ({ id: 'buffer' })),
    bindBuffer: jest.fn(),
    bufferData: jest.fn(),
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
    drawArraysInstanced: jest.fn(),
    deleteBuffer: jest.fn(),
    deleteVertexArray: jest.fn(),
  };
  return gl as unknown as FakeGL;
}
