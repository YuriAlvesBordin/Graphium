import { LINK_HIDDEN, LINK_SELECTED, NODE_DISABLED, NODE_DRAGGED, NODE_HIDDEN, NODE_SELECTED, packRGBA, unpackRGBA } from '../core/GraphModel.js';

const NODE_VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aNode;
layout(location=2) in vec4 aFill;
layout(location=3) in vec4 aBorder;
layout(location=4) in vec4 aStyle;
layout(location=5) in vec4 aImage;
uniform mat3 uCamera;
out vec2 vLocal;
out vec2 vAtlasUv;
out vec4 vFill;
out vec4 vBorder;
out vec4 vStyle;
flat out float vImageActive;
void main() {
  vec2 world = aNode.xy + aCorner * aNode.w;
  gl_Position = vec4((uCamera * vec3(world, 1.0)).xy, 0.0, 1.0);
  vLocal = aCorner;
  vAtlasUv = (aCorner * 0.5 + 0.5 + vec2(mod(aImage.x, 8.0), floor(aImage.x / 8.0))) / 8.0;
  vFill = aFill;
  vBorder = aBorder;
  vStyle = aStyle;
  vImageActive = aImage.y;
}`;

const NODE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vLocal;
in vec2 vAtlasUv;
in vec4 vFill;
in vec4 vBorder;
in vec4 vStyle;
flat in float vImageActive;
uniform sampler2D uAvatarAtlas;
uniform float uZoom;
uniform vec4 uHoverRing;
uniform vec4 uSelectedRing;
uniform vec4 uFixedRing;
uniform float uHoverRingWidth;
uniform float uSelectedRingWidth;
uniform float uFixedRingWidth;
uniform float uDisabledOpacity;
out vec4 outColor;
float band(float d, float inner, float outer, float aa) {
  return smoothstep(inner - aa, inner + aa, d) * (1.0 - smoothstep(outer - aa, outer + aa, d));
}
void main() {
  float d = length(vLocal);
  float aa = max(fwidth(d), 0.0008);
  float discRadius = vStyle.x / max(vStyle.w, 0.0001);
  float discAlpha = 1.0 - smoothstep(discRadius - aa, discRadius + aa, d);
  int state = int(vStyle.z + 0.5);
  vec4 ringColor = vec4(0.0);
  float ringWidth = 0.0;
  if (state == 1) { ringColor = uHoverRing; ringWidth = uHoverRingWidth; }
  else if (state == 2) { ringColor = uSelectedRing; ringWidth = uSelectedRingWidth; }
  else if (state == 3) { ringColor = uSelectedRing; ringWidth = uSelectedRingWidth; }
  else if (state == 4) { ringColor = uFixedRing; ringWidth = uFixedRingWidth; }
  float ringOuter = discRadius + ringWidth / max(uZoom * vStyle.w, 0.0001);
  float ring = ringWidth > 0.0 ? band(d, discRadius, ringOuter, aa) : 0.0;
  if (discAlpha <= 0.0 && ring <= 0.0) discard;
  vec4 fill = vFill;
  if (vImageActive > 0.5) {
    vec4 avatar = texture(uAvatarAtlas, vAtlasUv);
    fill.rgb = mix(fill.rgb, avatar.rgb, avatar.a);
  }
  float borderSize = vStyle.y / max(uZoom * vStyle.w, 0.0001);
  float border = vStyle.y > 0.0 ? band(d, max(0.0, discRadius - borderSize), discRadius, aa) : 0.0;
  vec4 core = mix(fill, vec4(vBorder.rgb, vBorder.a * vStyle.y), border);
  core.a *= discAlpha * (state == 5 ? uDisabledOpacity : 1.0);
  vec4 halo = vec4(ringColor.rgb, ringColor.a * ring);
  outColor = vec4(mix(halo.rgb, core.rgb, core.a), core.a + halo.a * (1.0 - core.a));
}`;

const EDGE_VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aSegment;
layout(location=2) in vec4 aColor;
layout(location=3) in vec4 aStyle;
layout(location=4) in vec4 aMeta;
uniform mat3 uCamera;
uniform float uZoom;
out float vSide;
out float vDashPosition;
out vec4 vColor;
out vec2 vDashPattern;
flat out float vDashed;
void main() {
  vec2 start = aSegment.xy;
  vec2 end = aSegment.zw;
  vec2 delta = end - start;
  float worldLength = max(length(delta), 0.00001);
  vec2 direction = delta / worldLength;
  vec2 normal = vec2(-direction.y, direction.x);
  float t = (aCorner.x + 1.0) * 0.5;
  float widthWorld = aStyle.x / max(uZoom, 0.0001);
  vec2 world = mix(start, end, t) + normal * aCorner.y * widthWorld * 0.5;
  gl_Position = vec4((uCamera * vec3(world, 1.0)).xy, 0.0, 1.0);
  vSide = aCorner.y;
  float dashScale = aMeta.x > 0.5 ? 1.0 : uZoom;
  vDashPosition = (aMeta.z + t * worldLength) * dashScale + aStyle.w;
  vColor = aColor;
  vDashPattern = aStyle.yz;
  vDashed = aMeta.y;
}`;

const EDGE_FRAGMENT = `#version 300 es
precision highp float;
in float vSide;
in float vDashPosition;
in vec4 vColor;
in vec2 vDashPattern;
flat in float vDashed;
out vec4 outColor;
void main() {
  float edgeAA = max(fwidth(vSide), 0.002);
  float alpha = 1.0 - smoothstep(1.0 - edgeAA, 1.0 + edgeAA, abs(vSide));
  if (vDashed > 0.5) {
    float cycle = max(0.5, vDashPattern.x + vDashPattern.y);
    float phase = mod(vDashPosition, cycle);
    float dashAA = max(fwidth(vDashPosition), 0.3);
    alpha *= 1.0 - smoothstep(vDashPattern.x - dashAA, vDashPattern.x + dashAA, phase);
  }

  if (alpha <= 0.0) discard;
  outColor = vec4(vColor.rgb, vColor.a * alpha);
}`;

const ARROW_VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aArrow;
layout(location=2) in vec4 aColor;
layout(location=3) in float aHalfWidth;
uniform mat3 uCamera;
out vec2 vLocal;
flat out float vLength;
flat out float vHalfWidth;
out vec4 vColor;
void main() {
  vec2 base = aArrow.xy;
  vec2 tip = aArrow.zw;
  vec2 direction = tip - base;
  float worldLength = max(length(direction), 0.00001);
  vec2 dirNorm = direction / worldLength;
  vec2 normal = vec2(-dirNorm.y, dirNorm.x);
  float t = (aCorner.x + 1.0) * 0.5;
  vec2 world = base + dirNorm * (t * worldLength) + normal * aCorner.y * aHalfWidth * (1.0 - t);
  gl_Position = vec4((uCamera * vec3(world, 1.0)).xy, 0.0, 1.0);
  vLocal = vec2(t * worldLength, aCorner.y * aHalfWidth * (1.0 - t));
  vLength = worldLength;
  vHalfWidth = aHalfWidth;
  vColor = aColor;
}`;

const ARROW_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vLocal;
flat in float vLength;
flat in float vHalfWidth;
in vec4 vColor;
out vec4 outColor;
void main() {
  float u = vLocal.x;
  float v = vLocal.y;
  float L = vLength;
  float W = vHalfWidth;
  if (L <= 0.00001) discard;
  // Signed distance to the triangle edges (base (0,+/-W) -> tip (L,0)), positive inside.
  float dEdges = (W * L - W * u - abs(v) * L) / length(vec2(L, W));
  float d = min(u, dEdges);
  float aa = max(fwidth(d), 0.002);
  float alpha = smoothstep(-aa, aa, d);
  if (alpha <= 0.0) discard;
  outColor = vec4(vColor.rgb, vColor.a * alpha);
}`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Graphium shader error: ${log}`);
  }
  return shader;
}

function createProgram(gl, vertex, fragment) {
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Graphium program error: ${gl.getProgramInfoLog(program)}`);
  }
  return program;
}

function createCanvas(size) {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(size, size);
  }

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    return canvas;
  }
  return null;
}

/**
 * @class WebGLRenderer2D
 * @brief Renders circular nodes, avatar fills, and styled graph links in WebGL2.
 */
export class WebGLRenderer2D {
  /**
   * @param {HTMLCanvasElement|OffscreenCanvas|null} [canvas] Target canvas.
   * @param {Record<string, unknown>} [options] Renderer and appearance configuration.
   */
  constructor(canvas = null, options = {}) {
    this.canvas = canvas;
    this.options = {
      clearColor: [0.035, 0.047, 0.075, 1],
      antialias: true,
      appearance: {},
      onImageEvent: null,
      ...options,
    };
    this.appearance = {
      hoverRingColor: '#007aff',
      hoverRingWidth: 2,
      selectedRingColor: '#ff9f0a',
      selectedRingWidth: 3,
      fixedRingColor: '#64748b',
      fixedRingWidth: 1.5,
      disabledOpacity: 0.45,
      selectedEdgeColor: '#007aff',
      selectedEdgeWidthMultiplier: 1.8,
      selectedEdgeOpacity: 1,
      ...this.options.appearance,
    };
    this.gl = null;
    this.nodeProgram = null;
    this.edgeProgram = null;
    this.arrowProgram = null;
    this.camera = null;
    this.nodeCapacity = 0;
    this.segmentCapacity = 0;
    this.arrowCapacity = 0;
    this.nodeData = new Float32Array(0);
    this.segmentData = new Float32Array(0);
    this.arrowData = new Float32Array(0);
    this.nodeVAO = null;
    this.edgeVAO = null;
    this.arrowVAO = null;
    this.nodeBuffer = null;
    this.edgeBuffer = null;
    this.arrowBuffer = null;
    this.cornerBuffer = null;
    this.avatarTexture = null;
    this.avatarCanvas = null;
    this.avatarContext = null;
    this.imageRecords = new Map();
    this.nextImageSlot = 0;
    this.nodeDrawCount = 0;
    this.segmentDrawCount = 0;
    this.arrowDrawCount = 0;
    this.lastRenderMs = 0;
    if (canvas) {
      this.attachCanvas(canvas);
    }
  }

  /** @param {Record<string, unknown>} appearance Updates global rendering defaults. @return {this} This renderer. */
  setAppearance(appearance = {}) {
    this.appearance = { ...this.appearance, ...appearance };
    return this;
  }

  /** @param {HTMLCanvasElement|OffscreenCanvas} canvas Canvas that receives the renderer context. @return {boolean} Whether WebGL2 was created. */
  attachCanvas(canvas) {
    this.canvas = canvas;
    this.gl = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('webgl2', { antialias: this.options.antialias, alpha: true }) : null;
    if (!this.gl) {
      return false;
    }
    this._initGL();
    return true;
  }

  _initGL() {
    const gl = this.gl;
    this.nodeProgram = createProgram(gl, NODE_VERTEX, NODE_FRAGMENT);
    this.edgeProgram = createProgram(gl, EDGE_VERTEX, EDGE_FRAGMENT);
    this.arrowProgram = createProgram(gl, ARROW_VERTEX, ARROW_FRAGMENT);
    this.cornerBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cornerBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
    this.nodeVAO = gl.createVertexArray();
    this.nodeBuffer = gl.createBuffer();
    gl.bindVertexArray(this.nodeVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cornerBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nodeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, 16, gl.DYNAMIC_DRAW);
    const nodeStride = 24 * 4;
    for (let attribute = 1; attribute <= 5; attribute++) {
      gl.enableVertexAttribArray(attribute);
      gl.vertexAttribPointer(attribute, 4, gl.FLOAT, false, nodeStride, (attribute - 1) * 16);
      gl.vertexAttribDivisor(attribute, 1);
    }
    this.edgeVAO = gl.createVertexArray();
    this.edgeBuffer = gl.createBuffer();
    gl.bindVertexArray(this.edgeVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cornerBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, 16, gl.DYNAMIC_DRAW);
    const edgeStride = 20 * 4;
    for (let attribute = 1; attribute <= 4; attribute++) {
      gl.enableVertexAttribArray(attribute);
      gl.vertexAttribPointer(attribute, 4, gl.FLOAT, false, edgeStride, (attribute - 1) * 16);
      gl.vertexAttribDivisor(attribute, 1);
    }
    this.arrowVAO = gl.createVertexArray();
    this.arrowBuffer = gl.createBuffer();
    gl.bindVertexArray(this.arrowVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cornerBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.arrowBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, 16, gl.DYNAMIC_DRAW);
    // Instance layout (9 floats): baseX, baseY, tipX, tipY, colorRGBA, halfWidth
    const arrowStride = 9 * 4;
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, arrowStride, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, arrowStride, 4 * 4);
    gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, arrowStride, 8 * 4);
    gl.vertexAttribDivisor(3, 1);
    this.avatarCanvas = createCanvas(512);
    this.avatarContext = this.avatarCanvas?.getContext('2d') || null;
    this.avatarTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.avatarTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 512, 512, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  /** @param {import('./Camera2D.js').Camera2D} camera Active view camera. @return {this} This renderer. */
  setCamera(camera) {
    this.camera = camera;
    return this;
  }

  /** @param {number} [width] CSS viewport width. @param {number} [height] CSS viewport height. @param {number} [pixelRatio] Device pixel ratio. @return {this} This renderer. */
  resize(width = this.canvas?.clientWidth || 1, height = this.canvas?.clientHeight || 1, pixelRatio = globalThis.devicePixelRatio || 1) {
    if (!this.canvas) {
      return this;
    }
    this.canvas.width = Math.max(1, Math.floor(width * pixelRatio));
    this.canvas.height = Math.max(1, Math.floor(height * pixelRatio));
    if (this.camera) {
      this.camera.setViewport(this.canvas.width, this.canvas.height);
    }

    if (this.gl) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    return this;
  }

  _ensureNodeCapacity(required) {
    if (required <= this.nodeCapacity) {
      return;
    }
    this.nodeCapacity = Math.max(required, this.nodeCapacity * 2 || 256);
    this.nodeData = new Float32Array(this.nodeCapacity * 24);
  }
  _ensureSegmentCapacity(required) {
    if (required <= this.segmentCapacity) {
      return;
    }
    this.segmentCapacity = Math.max(required, this.segmentCapacity * 2 || 512);
    this.segmentData = new Float32Array(this.segmentCapacity * 20);
  }
  _ensureArrowCapacity(required) {
    if (required <= this.arrowCapacity) {
      return;
    }
    this.arrowCapacity = Math.max(required, this.arrowCapacity * 2 || 256);
    this.arrowData = new Float32Array(this.arrowCapacity * 9);
  }

  _requestImage(url) {
    if (!url || this.imageRecords.has(url)) {
      return this.imageRecords.get(url)?.slot ?? -1;
    }

    if (this.nextImageSlot >= 64 || typeof Image === 'undefined') {
      return -1;
    }
    const record = { slot: this.nextImageSlot++, ready: false, used: true, image: null };
    this.imageRecords.set(url, record);
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (!this.imageRecords.has(url) || !this.gl || !this.avatarContext) {
        return;
      }
      record.ready = true;
      record.image = image;
      const cell = 64;
      const x = (record.slot % 8) * cell;
      const y = Math.floor(record.slot / 8) * cell;
      const scale = Math.max(cell / image.naturalWidth, cell / image.naturalHeight);
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      this.avatarContext.clearRect(x, y, cell, cell);
      this.avatarContext.drawImage(image, x + (cell - width) * 0.5, y + (cell - height) * 0.5, width, height);
      this.gl.activeTexture(this.gl.TEXTURE0);
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.avatarTexture);
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.avatarCanvas);
      if (typeof this.options.onImageEvent === 'function') {
        this.options.onImageEvent('imageload', { url, slot: record.slot });
      }
    };
    image.onerror = () => {
      record.failed = true;
      if (typeof this.options.onImageEvent === 'function') {
        this.options.onImageEvent('imageerror', { url });
      }
    };
    image.src = url;
    return record.slot;
  }

  _releaseUnusedImages() {
    for (const [url, record] of this.imageRecords) {
      if (!record.used) {
        this.imageRecords.delete(url);
      } else {
        record.used = false;
      }
    }
  }

  _fillNodeData(model) {
    this._ensureNodeCapacity(model.nodeCount);
    const zoom = this.camera?.zoom || 1;
    const ringExtent =
      Math.max(this.appearance.hoverRingWidth, this.appearance.selectedRingWidth, this.appearance.fixedRingWidth) / Math.max(zoom, 0.0001) + 2 / Math.max(zoom, 0.0001);
    let write = 0;
    for (let index = 0; index < model.nodeCount; index++) {
      if (model.flags[index] & NODE_HIDDEN) {
        continue;
      }
      const offset = write * 24;
      const fill = unpackRGBA(model.color[index]);
      const border = unpackRGBA(model.borderColor[index]);
      const radius = model.visualRadius[index];
      const extent = radius + ringExtent;
      const state =
        model.flags[index] & NODE_DISABLED
          ? 5
          : model.flags[index] & NODE_DRAGGED
            ? 3
            : model.flags[index] & NODE_SELECTED
              ? 2
              : model.isNodeFixed(index)
                ? 4
                : model.nodeState[index];
      const imageUrl = model.nodeImage[index];
      const slot = imageUrl ? this._requestImage(imageUrl) : -1;
      const record = imageUrl ? this.imageRecords.get(imageUrl) : null;
      if (record) {
        record.used = true;
      }
      this.nodeData[offset] = model.x[index];
      this.nodeData[offset + 1] = model.y[index];
      this.nodeData[offset + 2] = radius;
      this.nodeData[offset + 3] = extent;
      this.nodeData[offset + 4] = fill[0];
      this.nodeData[offset + 5] = fill[1];
      this.nodeData[offset + 6] = fill[2];
      this.nodeData[offset + 7] = fill[3] * model.opacity[index];
      this.nodeData[offset + 8] = border[0];
      this.nodeData[offset + 9] = border[1];
      this.nodeData[offset + 10] = border[2];
      this.nodeData[offset + 11] = border[3] * model.borderOpacity[index];
      this.nodeData[offset + 12] = radius;
      this.nodeData[offset + 13] = model.borderWidth[index];
      this.nodeData[offset + 14] = state;
      this.nodeData[offset + 15] = extent;
      this.nodeData[offset + 16] = slot < 0 ? 0 : slot;
      this.nodeData[offset + 17] = record?.ready ? 1 : 0;
      this.nodeData[offset + 18] = 0;
      this.nodeData[offset + 19] = 0;
      write++;
    }
    this.nodeDrawCount = write;
    this._releaseUnusedImages();
  }

  _writeSegment(model, linkIndex, ax, ay, bx, by, pathDistance, write) {
    const source = model.source[linkIndex];
    const target = model.target[linkIndex];
    let dx = bx - ax;
    let dy = by - ay;
    const length = Math.hypot(dx, dy);
    if (length < 0.0001) {
      return write;
    }
    const color = model.linkFlags[linkIndex] & LINK_SELECTED ? unpackRGBA(packRGBA(this.appearance.selectedEdgeColor)) : unpackRGBA(model.linkColor[linkIndex]);
    const selected = (model.linkFlags[linkIndex] & LINK_SELECTED) !== 0;
    const width = model.linkWidth[linkIndex] * (selected ? this.appearance.selectedEdgeWidthMultiplier : 1);
    const opacity = model.linkOpacity[linkIndex] * (selected ? this.appearance.selectedEdgeOpacity : 1);
    const offset = write * 20;
    this.segmentData[offset] = ax;
    this.segmentData[offset + 1] = ay;
    this.segmentData[offset + 2] = bx;
    this.segmentData[offset + 3] = by;
    this.segmentData[offset + 4] = color[0];
    this.segmentData[offset + 5] = color[1];
    this.segmentData[offset + 6] = color[2];
    this.segmentData[offset + 7] = color[3] * opacity;
    this.segmentData[offset + 8] = width;
    this.segmentData[offset + 9] = model.linkDashLength[linkIndex];
    this.segmentData[offset + 10] = model.linkDashGap[linkIndex];
    this.segmentData[offset + 11] = model.linkDashOffset[linkIndex];
    this.segmentData[offset + 12] = model.linkDashWorld[linkIndex];
    this.segmentData[offset + 13] = model.linkStyle[linkIndex];
    this.segmentData[offset + 14] = pathDistance;
    this.segmentData[offset + 15] = 0;
    return write + 1;
  }

  _fillSegmentData(model, routes) {
    let needed = 0;
    for (let index = 0; index < model.linkCount; index++) {
      if (!(model.linkFlags[index] & LINK_HIDDEN)) {
        needed += Math.max(1, (routes?.getPointCount(index) || 2) - 1);
      }
    }
    this._ensureSegmentCapacity(needed);
    let write = 0;
    for (let index = 0; index < model.linkCount; index++) {
      if (model.linkFlags[index] & LINK_HIDDEN) {
        continue;
      }
      const route = routes?.getRoute(index);
      const points = routes?.getPointCount(index) || 0;
      if (route && points > 1) {
        let distance = 0;
        for (let point = 0; point < points - 1; point++) {
          let ax = route[point * 2];
          let ay = route[point * 2 + 1];
          const bx = route[point * 2 + 2];
          const by = route[point * 2 + 3];
          const segmentLength = Math.hypot(bx - ax, by - ay);
// Do not shorten the edge at the source node - go to center
            // if (point === 0 && segmentLength > 0.0001) {
            //   const sourceRadius = model.visualRadius[model.source[index]];
            //   const scale = Math.min(0.48, sourceRadius / segmentLength);
            //   ax += (bx - ax) * scale;
            //   ay += (by - ay) * scale;
            // }
          const isLast = point === points - 2;
          let endX = bx;
          let endY = by;
// Do not shorten the edge at the target node - go to center
            // if (isLast && segmentLength > 0.0001) {
            //   const targetRadius = model.visualRadius[model.target[index]];
            //   const scale = Math.min(0.48, targetRadius / segmentLength);
            //   endX -= (bx - ax) * scale;
            //   endY -= (by - ay) * scale;
            // }
          write = this._writeSegment(model, index, ax, ay, endX, endY, distance, write);
          distance += segmentLength;
        }
      } else {
        const source = model.source[index];
        const target = model.target[index];
        let ax = model.x[source];
        let ay = model.y[source];
        let bx = model.x[target];
        let by = model.y[target];
        const length = Math.hypot(bx - ax, by - ay);
        if (length > 0.0001) {
          // Do not shorten the edge at all - go to center
          // const startScale = Math.min(0.48, model.visualRadius[source] / length);
          // const endScale = Math.min(0.48, model.visualRadius[target] / length);
          // const dx = bx - ax;
          // const dy = by - ay;
          // ax += dx * startScale;
          // ay += dy * startScale;
          // bx -= dx * endScale;
          // by -= dy * endScale;
        }
        write = this._writeSegment(model, index, ax, ay, bx, by, 0, write);
      }
    }
    this.segmentDrawCount = write;
  }

  /**
   * @brief Fills instanced arrow-head data for links that have arrows enabled.
   * @param {import('../core/GraphModel.js').GraphModel} model Graph data model.
   * @param {any} [routes] Edge routing provider.
   */
  _fillArrowData(model, routes) {
    const globalEnabled = this.appearance.edgeArrowEnabled;
    let needed = 0;
    for (let index = 0; index < model.linkCount; index++) {
      if (model.linkFlags[index] & LINK_HIDDEN) {
        continue;
      }
      const arrow = model.linkArrow[index];
      if (arrow === 1 || (arrow === 0 && globalEnabled)) {
        // Skip arrow for star-routed edges (to avoid visual confusion)
        if (routes && routes.getPointCount(index) > 0) {
          continue;
        }
        needed++;
      }
    }
    this._ensureArrowCapacity(needed);
    const zoom = Math.max(this.camera?.zoom || 1, 0.0001);
    let write = 0;
    for (let index = 0; index < model.linkCount; index++) {
      if (model.linkFlags[index] & LINK_HIDDEN) {
        continue;
      }
      const arrow = model.linkArrow[index];
      if (!(arrow === 1 || (arrow === 0 && globalEnabled))) {
        continue;
      }
      // Skip arrow for star-routed edges (to avoid visual confusion)
      if (routes && routes.getPointCount(index) > 0) {
        continue;
      }
      const source = model.source[index];
      const target = model.target[index];
      const tx = model.x[target];
      const ty = model.y[target];
      const route = routes?.getRoute(index);
      const points = routes?.getPointCount(index) || 0;
      let dx;
      let dy;
      if (route && points > 1) {
        const lastX = route[(points - 2) * 2];
        const lastY = route[(points - 2) * 2 + 1];
        dx = tx - lastX;
        dy = ty - lastY;
      } else {
        dx = tx - model.x[source];
        dy = ty - model.y[source];
      }
      const length = Math.hypot(dx, dy);
      const arrowSize = model.linkArrowSize[index] / zoom;
      if (length < 0.0001 || arrowSize <= 0) {
        continue;
      }
      const ndx = dx / length;
      const ndy = dy / length;
      const halfWidth = Math.max(0, model.linkArrowWidth[index] / (2 * zoom));
      const radius = model.visualRadius[target] || 0;
      // Place the tip slightly outside the node to avoid being covered by the node disc.
      const tipOffset = radius + arrowSize * 0.2;
      const tipX = tx - ndx * tipOffset;
      const tipY = ty - ndy * tipOffset;
      const baseX = tipX - ndx * arrowSize;
      const baseY = tipY - ndy * arrowSize;
      const selected = (model.linkFlags[index] & LINK_SELECTED) !== 0;
      const color = selected ? unpackRGBA(packRGBA(this.appearance.selectedEdgeColor)) : unpackRGBA(model.linkColor[index]);
      // Arrows are direction indicators: keep them at the link color's full
      // strength instead of inheriting the (often faded) edge opacity.
      const opacity = selected ? this.appearance.selectedEdgeOpacity : 1;
      const offset = write * 9;
      this.arrowData[offset] = baseX;
      this.arrowData[offset + 1] = baseY;
      this.arrowData[offset + 2] = tipX;
      this.arrowData[offset + 3] = tipY;
      this.arrowData[offset + 4] = color[0];
      this.arrowData[offset + 5] = color[1];
      this.arrowData[offset + 6] = color[2];
      this.arrowData[offset + 7] = color[3] * opacity;
      this.arrowData[offset + 8] = halfWidth;
      write++;
    }
    this.arrowDrawCount = write;
  }

  /**
   * @brief Renders graph links followed by nodes.
   * @param {import('../core/GraphModel.js').GraphModel} model Graph data model.
   * @param {any} [routes] Edge routing provider.
   */
  render(model, routes) {
if (!this.gl || !this.camera) {
      return;
    }
    const gl = this.gl;
    const started = performance.now();
    this._fillSegmentData(model, routes);
    this._fillArrowData(model, routes);
    this._fillNodeData(model);
    gl.clearColor(...this.options.clearColor);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.edgeProgram);
    gl.uniformMatrix3fv(gl.getUniformLocation(this.edgeProgram, 'uCamera'), false, this.camera.matrix);
    gl.uniform1f(gl.getUniformLocation(this.edgeProgram, 'uZoom'), this.camera.zoom);
    gl.bindVertexArray(this.edgeVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.segmentData.subarray(0, this.segmentDrawCount * 20), gl.DYNAMIC_DRAW);
    gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, this.segmentDrawCount);
    if (this.arrowDrawCount > 0) {
      gl.useProgram(this.arrowProgram);
      const uCameraLoc = gl.getUniformLocation(this.arrowProgram, 'uCamera');
      if (uCameraLoc) {
        gl.uniformMatrix3fv(uCameraLoc, false, this.camera.matrix);
      }
      gl.bindVertexArray(this.arrowVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.arrowBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.arrowData.subarray(0, this.arrowDrawCount * 9), gl.DYNAMIC_DRAW);
      gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, this.arrowDrawCount);
    }
    gl.useProgram(this.nodeProgram);
    gl.uniformMatrix3fv(gl.getUniformLocation(this.nodeProgram, 'uCamera'), false, this.camera.matrix);
    gl.uniform1f(gl.getUniformLocation(this.nodeProgram, 'uZoom'), this.camera.zoom);
    gl.uniform4fv(gl.getUniformLocation(this.nodeProgram, 'uHoverRing'), unpackRGBA(packRGBA(this.appearance.hoverRingColor)));
    gl.uniform4fv(gl.getUniformLocation(this.nodeProgram, 'uSelectedRing'), unpackRGBA(packRGBA(this.appearance.selectedRingColor)));
    gl.uniform4fv(gl.getUniformLocation(this.nodeProgram, 'uFixedRing'), unpackRGBA(packRGBA(this.appearance.fixedRingColor)));
    gl.uniform1f(gl.getUniformLocation(this.nodeProgram, 'uHoverRingWidth'), this.appearance.hoverRingWidth);
    gl.uniform1f(gl.getUniformLocation(this.nodeProgram, 'uSelectedRingWidth'), this.appearance.selectedRingWidth);
    gl.uniform1f(gl.getUniformLocation(this.nodeProgram, 'uFixedRingWidth'), this.appearance.fixedRingWidth);
    gl.uniform1f(gl.getUniformLocation(this.nodeProgram, 'uDisabledOpacity'), this.appearance.disabledOpacity);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.avatarTexture);
    gl.uniform1i(gl.getUniformLocation(this.nodeProgram, 'uAvatarAtlas'), 0);
    gl.bindVertexArray(this.nodeVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nodeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.nodeData.subarray(0, this.nodeDrawCount * 24), gl.DYNAMIC_DRAW);
    gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, this.nodeDrawCount);
    gl.bindVertexArray(null);
    this.lastRenderMs = performance.now() - started;
  }

  /** @brief Releases shader programs, buffers, textures, and image references. */
  destroy() {
    if (!this.gl) {
      return;
    }
    const gl = this.gl;
    if (this.nodeProgram) {
      gl.deleteProgram(this.nodeProgram);
    }

    if (this.edgeProgram) {
      gl.deleteProgram(this.edgeProgram);
    }

    if (this.arrowProgram) {
      gl.deleteProgram(this.arrowProgram);
    }

    if (this.nodeBuffer) {
      gl.deleteBuffer(this.nodeBuffer);
    }

    if (this.edgeBuffer) {
      gl.deleteBuffer(this.edgeBuffer);
    }

    if (this.arrowBuffer) {
      gl.deleteBuffer(this.arrowBuffer);
    }

    if (this.cornerBuffer) {
      gl.deleteBuffer(this.cornerBuffer);
    }

    if (this.avatarTexture) {
      gl.deleteTexture(this.avatarTexture);
    }

    if (this.nodeVAO) {
      gl.deleteVertexArray(this.nodeVAO);
    }

    if (this.edgeVAO) {
      gl.deleteVertexArray(this.edgeVAO);
    }

    if (this.arrowVAO) {
      gl.deleteVertexArray(this.arrowVAO);
    }
    this.imageRecords.clear();
    this.gl = null;
  }
}
