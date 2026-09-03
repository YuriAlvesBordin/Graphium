/**
 * @file Dense, data-oriented storage for graph simulation and rendering.
 */

export const NODE_FIXED = 1;
export const NODE_SELECTED = 2;
export const NODE_DRAGGED = 4;
export const NODE_HIDDEN = 8;
export const NODE_DISABLED = 16;
export const LINK_SELECTED = 1;
export const LINK_HIDDEN = 2;

export const NODE_STATE_NORMAL = 0;
export const NODE_STATE_HOVER = 1;
export const NODE_STATE_SELECTED = 2;
export const NODE_STATE_DRAGGING = 3;
export const NODE_STATE_FIXED = 4;
export const NODE_STATE_DISABLED = 5;

export const LINK_STYLE_SOLID = 0;
export const LINK_STYLE_DASHED = 1;

const DEFAULT_NODE_CAPACITY = 256;
const DEFAULT_LINK_CAPACITY = 512;
const FALLBACK_PALETTE = new Uint32Array([0x2563ebff, 0x0f766eff, 0x7c3aedff, 0xc2410cff, 0x0f766eff, 0xbe185dff, 0x0369a1ff, 0x4d7c0fff]);

const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));
const finiteOr = (value, fallback) => (Number.isFinite(value) ? value : fallback);
const firstDefined = (...values) => values.find(value => value !== undefined && value !== null);

/**
 * @brief Converts a supported CSS-like color into packed RGBA bytes.
 * @param {unknown} color Color in hexadecimal, rgb(), rgba(), packed, or normalized array form.
 * @return {number} Packed RGBA value.
 */
export function packRGBA(color = '#5b8def') {
  if (typeof color === 'number') {
    return color >>> 0;
  }

  if (Array.isArray(color)) {
    const r = Math.round(clamp01(color[0]) * 255);
    const g = Math.round(clamp01(color[1]) * 255);
    const b = Math.round(clamp01(color[2]) * 255);
    const a = Math.round(clamp01(color.length > 3 ? color[3] : 1) * 255);
    return ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
  }
  const text = String(color).trim().toLowerCase();
  const named = {
    white: '#ffffff',
    black: '#000000',
    red: '#ff0000',
    green: '#00a000',
    blue: '#0000ff',
    orange: '#ff8a00',
    transparent: '#00000000',
  };
  const hex = named[text] || text;
  if (hex.startsWith('#')) {
    const raw = hex.slice(1);
    if (raw.length === 3 || raw.length === 4) {
      return packRGBA(
        `#${raw
          .split('')
          .map(value => value + value)
          .join('')}`
      );
    }

    if (raw.length === 6 || raw.length === 8) {
      return parseInt(raw.length === 6 ? `${raw}ff` : raw, 16) >>> 0;
    }
    return 0x5b8defff;
  }
  const match = text.match(/^rgba?\(([^)]+)\)$/);
  if (match) {
    const parts = match[1].split(',').map(value => Number(value.trim()));
    return packRGBA([parts[0] / 255, parts[1] / 255, parts[2] / 255, parts[3] ?? 1]);
  }
  return 0x5b8defff;
}

/**
 * @brief Converts packed RGBA bytes to normalized shader-ready values.
 * @param {number} packed Packed RGBA value.
 * @return {[number, number, number, number]} Normalized RGBA tuple.
 */
export function unpackRGBA(packed) {
  return [((packed >>> 24) & 255) / 255, ((packed >>> 16) & 255) / 255, ((packed >>> 8) & 255) / 255, (packed & 255) / 255];
}

/**
 * @brief Returns a stable fallback color for a node ID.
 * @param {string|number} id External node identifier.
 * @return {number} Packed RGBA value.
 */
export function deterministicNodeColor(id) {
  const text = String(id);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return FALLBACK_PALETTE[(hash >>> 0) % FALLBACK_PALETTE.length];
}

function growTyped(array, capacity, Type) {
  const next = new Type(capacity);
  next.set(array);
  return next;
}

function growObjects(array, capacity) {
  const next = new Array(capacity).fill(null);
  for (let index = 0; index < array.length; index++) {
    next[index] = array[index];
  }
  return next;
}

function nodeStateCode(value) {
  if (typeof value === 'number') {
    return Math.max(NODE_STATE_NORMAL, Math.min(NODE_STATE_DISABLED, value | 0));
  }
  return (
    {
      hover: NODE_STATE_HOVER,
      selected: NODE_STATE_SELECTED,
      dragging: NODE_STATE_DRAGGING,
      fixed: NODE_STATE_FIXED,
      disabled: NODE_STATE_DISABLED,
    }[String(value || 'normal').toLowerCase()] ?? NODE_STATE_NORMAL
  );
}

function linkStyleCode(value) {
  return String(value || 'solid').toLowerCase() === 'dashed' ? LINK_STYLE_DASHED : LINK_STYLE_SOLID;
}

/**
 * @class GraphModel
 * @brief Stores simulation and appearance data in contiguous arrays.
 */
export class GraphModel {
  /**
   * @param {{nodeCapacity?: number, linkCapacity?: number, nodeDefaults?: Record<string, unknown>, linkDefaults?: Record<string, unknown>}} [options] Storage and appearance defaults.
   */
  constructor(options = {}) {
    this.nodeCapacity = Math.max(8, options.nodeCapacity || DEFAULT_NODE_CAPACITY);
    this.linkCapacity = Math.max(8, options.linkCapacity || DEFAULT_LINK_CAPACITY);
    this.nodeDefaults = {
      radius: 8,
      visualRadius: undefined,
      borderColor: '#ffffff',
      borderWidth: 0,
      borderOpacity: 1,
      opacity: 1,
      ...options.nodeDefaults,
    };
    this.linkDefaults = {
      color: '#9aa7bd',
      width: 1.25,
      opacity: 0.72,
      style: 'solid',
      dashPattern: [5, 8],
      dashOffset: 0,
      dashScaleWithZoom: false,
      arrowSize: 10,
      arrowWidth: 6,
      ...options.linkDefaults,
    };
    this.nodeCount = 0;
    this.linkCount = 0;
    this.topologyRevision = 0;
    this.positionRevision = 0;
    this.appearanceRevision = 0;
    this._nodeIds = [];
    this._linkIds = [];
    this.nodeIdToIndex = new Map();
    this.linkIdToIndex = new Map();
    this._allocateNodeArrays(this.nodeCapacity);
    this._allocateLinkArrays(this.linkCapacity);
  }

  _allocateNodeArrays(capacity) {
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.px = new Float32Array(capacity);
    this.py = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.fx = new Float32Array(capacity);
    this.fy = new Float32Array(capacity);
    this.radius = new Float32Array(capacity);
    this.visualRadius = new Float32Array(capacity);
    this.mass = new Float32Array(capacity);
    this.degree = new Int32Array(capacity);
    this.color = new Uint32Array(capacity);
    this.borderColor = new Uint32Array(capacity);
    this.borderWidth = new Float32Array(capacity);
    this.borderOpacity = new Float32Array(capacity);
    this.flags = new Uint8Array(capacity);
    this.nodeState = new Uint8Array(capacity);
    this.opacity = new Float32Array(capacity);
    this.nodeImage = new Array(capacity).fill(null);
    this.nodeLabel = new Array(capacity).fill(null);
  }

  _allocateLinkArrays(capacity) {
    this.source = new Int32Array(capacity);
    this.target = new Int32Array(capacity);
    this.restLength = new Float32Array(capacity);
    this.linkStrength = new Float32Array(capacity);
    this.linkWidth = new Float32Array(capacity);
    this.linkColor = new Uint32Array(capacity);
    this.linkFlags = new Uint8Array(capacity);
    this.linkOpacity = new Float32Array(capacity);
    this.linkStyle = new Uint8Array(capacity);
    this.linkDashLength = new Float32Array(capacity);
    this.linkDashGap = new Float32Array(capacity);
    this.linkDashOffset = new Float32Array(capacity);
    this.linkDashWorld = new Uint8Array(capacity);
    this.linkArrow = new Int8Array(capacity);
    this.linkArrowSize = new Float32Array(capacity);
    this.linkArrowWidth = new Float32Array(capacity);
  }

  _ensureNodeCapacity(required) {
    if (required <= this.nodeCapacity) {
      return;
    }
    let capacity = this.nodeCapacity;
    while (capacity < required) {
      capacity *= 2;
    }
    this.x = growTyped(this.x, capacity, Float32Array);
    this.y = growTyped(this.y, capacity, Float32Array);
    this.px = growTyped(this.px, capacity, Float32Array);
    this.py = growTyped(this.py, capacity, Float32Array);
    this.vx = growTyped(this.vx, capacity, Float32Array);
    this.vy = growTyped(this.vy, capacity, Float32Array);
    this.fx = growTyped(this.fx, capacity, Float32Array);
    this.fy = growTyped(this.fy, capacity, Float32Array);
    this.radius = growTyped(this.radius, capacity, Float32Array);
    this.visualRadius = growTyped(this.visualRadius, capacity, Float32Array);
    this.mass = growTyped(this.mass, capacity, Float32Array);
    this.degree = growTyped(this.degree, capacity, Int32Array);
    this.color = growTyped(this.color, capacity, Uint32Array);
    this.borderColor = growTyped(this.borderColor, capacity, Uint32Array);
    this.borderWidth = growTyped(this.borderWidth, capacity, Float32Array);
    this.borderOpacity = growTyped(this.borderOpacity, capacity, Float32Array);
    this.flags = growTyped(this.flags, capacity, Uint8Array);
    this.nodeState = growTyped(this.nodeState, capacity, Uint8Array);
    this.opacity = growTyped(this.opacity, capacity, Float32Array);
    this.nodeImage = growObjects(this.nodeImage, capacity);
    this.nodeLabel = growObjects(this.nodeLabel, capacity);
    this.nodeCapacity = capacity;
  }

  _ensureLinkCapacity(required) {
    if (required <= this.linkCapacity) {
      return;
    }
    let capacity = this.linkCapacity;
    while (capacity < required) {
      capacity *= 2;
    }
    this.source = growTyped(this.source, capacity, Int32Array);
    this.target = growTyped(this.target, capacity, Int32Array);
    this.restLength = growTyped(this.restLength, capacity, Float32Array);
    this.linkStrength = growTyped(this.linkStrength, capacity, Float32Array);
    this.linkWidth = growTyped(this.linkWidth, capacity, Float32Array);
    this.linkColor = growTyped(this.linkColor, capacity, Uint32Array);
    this.linkFlags = growTyped(this.linkFlags, capacity, Uint8Array);
    this.linkOpacity = growTyped(this.linkOpacity, capacity, Float32Array);
    this.linkStyle = growTyped(this.linkStyle, capacity, Uint8Array);
    this.linkDashLength = growTyped(this.linkDashLength, capacity, Float32Array);
    this.linkDashGap = growTyped(this.linkDashGap, capacity, Float32Array);
    this.linkDashOffset = growTyped(this.linkDashOffset, capacity, Float32Array);
    this.linkDashWorld = growTyped(this.linkDashWorld, capacity, Uint8Array);
    this.linkArrow = growTyped(this.linkArrow, capacity, Int8Array);
    this.linkArrowSize = growTyped(this.linkArrowSize, capacity, Float32Array);
    this.linkArrowWidth = growTyped(this.linkArrowWidth, capacity, Float32Array);
    this.linkCapacity = capacity;
  }

  /** @param {string|number} id @return {number} Dense node index or -1. */
  getNodeIndex(id) {
    return this.nodeIdToIndex.get(id) ?? -1;
  }
  /** @param {string|number} id @return {number} Dense link index or -1. */
  getLinkIndex(id) {
    return this.linkIdToIndex.get(id) ?? -1;
  }
  /** @param {number} index @return {string|number|undefined} External node ID. */
  getNodeId(index) {
    return this._nodeIds[index];
  }
  /** @param {number} index @return {string|number|undefined} External link ID. */
  getLinkId(index) {
    return this._linkIds[index];
  }

  _applyNodeOptions(index, options, isNew) {
    const defaults = this.nodeDefaults;
    if (isNew || options.x !== undefined) {
      this.x[index] = finiteOr(options.x, this.x[index]);
    }

    if (isNew || options.y !== undefined) {
      this.y[index] = finiteOr(options.y, this.y[index]);
    }

    if (isNew || options.x !== undefined) {
      this.px[index] = this.x[index];
    }

    if (isNew || options.y !== undefined) {
      this.py[index] = this.y[index];
    }

    if (isNew || options.radius !== undefined) {
      this.radius[index] = Math.max(0.1, finiteOr(options.radius, defaults.radius));
    }

    if (isNew || options.visualRadius !== undefined || options.radius !== undefined) {
      this.visualRadius[index] = Math.max(0.1, finiteOr(options.visualRadius, finiteOr(options.radius, defaults.visualRadius ?? defaults.radius)));
    }

    if (isNew || options.mass !== undefined) {
      this.mass[index] = Math.max(0.0001, finiteOr(options.mass, 1));
    }
    const fill = firstDefined(options.backgroundColor, options.color, options.fill);
    if (isNew || fill !== undefined) {
      this.color[index] = fill === undefined ? deterministicNodeColor(this._nodeIds[index]) : packRGBA(fill);
    }
    const border = firstDefined(options.borderColor, options.stroke);
    if (isNew || border !== undefined) {
      this.borderColor[index] = packRGBA(border ?? defaults.borderColor);
    }
    const borderWidth = firstDefined(options.borderWidth, options.strokeWidth);
    if (isNew || borderWidth !== undefined) {
      this.borderWidth[index] = Math.max(0, finiteOr(borderWidth, defaults.borderWidth));
    }

    if (isNew || options.borderOpacity !== undefined) {
      this.borderOpacity[index] = clamp01(finiteOr(options.borderOpacity, defaults.borderOpacity));
    }

    if (isNew || options.opacity !== undefined) {
      this.opacity[index] = clamp01(finiteOr(options.opacity, defaults.opacity));
    }
    const image = firstDefined(options.image, options.avatar, options.avatarUrl, options.imageUrl);
    if (isNew || image !== undefined) {
      this.nodeImage[index] = image ? String(image) : null;
    }

    if (isNew || options.label !== undefined) {
      this.nodeLabel[index] = options.label === undefined ? null : String(options.label);
    }

    if (isNew || options.fixed !== undefined) {
      if (options.fixed) {
        this.flags[index] |= NODE_FIXED;
      } else {
        this.flags[index] &= ~NODE_FIXED;
      }
    }

    if (isNew || options.state !== undefined || options.disabled !== undefined || options.fixed !== undefined) {
      this.setNodeState(index, options.disabled ? NODE_STATE_DISABLED : (options.state ?? (options.fixed ? NODE_STATE_FIXED : this.nodeState[index])));
    }
    this.appearanceRevision++;
  }

  _applyLinkOptions(index, options, isNew) {
    const defaults = this.linkDefaults;
    if (isNew || options.restLength !== undefined) {
      this.restLength[index] = Math.max(0, finiteOr(options.restLength, this.restLength[index] || 40));
    }

    if (isNew || options.strength !== undefined) {
      this.linkStrength[index] = Math.max(0, finiteOr(options.strength, 0.08));
    }
    const color = firstDefined(options.color, options.stroke, options.lineColor);
    if (isNew || color !== undefined) {
      this.linkColor[index] = packRGBA(color ?? defaults.color);
    }
    const width = firstDefined(options.width, options.strokeWidth, options.lineWidth);
    if (isNew || width !== undefined) {
      this.linkWidth[index] = Math.max(0.1, finiteOr(width, defaults.width));
    }

    if (isNew || options.opacity !== undefined) {
      this.linkOpacity[index] = clamp01(finiteOr(options.opacity, defaults.opacity));
    }
    const style = firstDefined(options.style, options.lineStyle);
    if (isNew || style !== undefined) {
      this.linkStyle[index] = linkStyleCode(style ?? defaults.style);
    }
    const pattern = firstDefined(options.dashPattern, options.dash, defaults.dashPattern);
    const dash = Array.isArray(pattern) ? pattern : defaults.dashPattern;
    if (isNew || options.dashPattern !== undefined || options.dash !== undefined) {
      this.linkDashLength[index] = Math.max(0.25, finiteOr(dash[0], defaults.dashPattern[0]));
      this.linkDashGap[index] = Math.max(0.25, finiteOr(dash[1], defaults.dashPattern[1]));
    }

    if (isNew || options.dashOffset !== undefined) {
      this.linkDashOffset[index] = finiteOr(options.dashOffset, defaults.dashOffset);
    }

    if (isNew || options.dashScaleWithZoom !== undefined) {
      this.linkDashWorld[index] = (options.dashScaleWithZoom ?? defaults.dashScaleWithZoom) ? 1 : 0;
    }
    // Arrow tri-state: 1 = always on, -1 = always off, 0 = follow global appearance.
    if (isNew || options.arrow !== undefined) {
      if (options.arrow === true) {
        this.linkArrow[index] = 1;
      } else if (options.arrow === false) {
        this.linkArrow[index] = -1;
      } else if (isNew) {
        this.linkArrow[index] = 0;
      }
    }

    if (isNew || options.arrowSize !== undefined) {
      this.linkArrowSize[index] = Math.max(0, finiteOr(options.arrowSize, defaults.arrowSize));
    }

    if (isNew || options.arrowWidth !== undefined) {
      this.linkArrowWidth[index] = Math.max(0, finiteOr(options.arrowWidth, defaults.arrowWidth));
    }
    this.appearanceRevision++;
  }

  /**
   * @brief Adds a node or applies supplied properties to an existing node.
   * @param {string|number} id External node identifier.
   * @param {Record<string, unknown>} [options] Node properties.
   * @return {number} Dense node index.
   */
  addNode(id, options = {}) {
    const existing = this.getNodeIndex(id);
    if (existing >= 0) {
      this._applyNodeOptions(existing, options, false);
      return existing;
    }
    const index = this.nodeCount++;
    this._ensureNodeCapacity(this.nodeCount);
    this._nodeIds[index] = id;
    this.nodeIdToIndex.set(id, index);
    this._applyNodeOptions(index, options, true);
    if (!Number.isFinite(options.x)) {
      this.x[index] = this.px[index] = (Math.random() - 0.5) * 100;
    }

    if (!Number.isFinite(options.y)) {
      this.y[index] = this.py[index] = (Math.random() - 0.5) * 100;
    }
    this.vx[index] = 0;
    this.vy[index] = 0;
    this.fx[index] = 0;
    this.fy[index] = 0;
    this.degree[index] = 0;
    this.topologyRevision++;
    return index;
  }

  /**
   * @brief Adds a link or applies supplied properties to an existing link.
   * @param {string|number} linkId External link identifier.
   * @param {string|number} sourceId Source node identifier.
   * @param {string|number} targetId Target node identifier.
   * @param {Record<string, unknown>} [options] Link properties.
   * @return {number} Dense link index.
   */
  addLink(linkId, sourceId, targetId, options = {}) {
    const existing = this.getLinkIndex(linkId);
    if (existing >= 0) {
      this._applyLinkOptions(existing, options, false);
      return existing;
    }
    const source = this.getNodeIndex(sourceId);
    const target = this.getNodeIndex(targetId);
    if (source < 0 || target < 0) {
      throw new Error(`Link ${String(linkId)} references an unknown node.`);
    }
    const index = this.linkCount++;
    this._ensureLinkCapacity(this.linkCount);
    this._linkIds[index] = linkId;
    this.linkIdToIndex.set(linkId, index);
    this.source[index] = source;
    this.target[index] = target;
    const dx = this.x[target] - this.x[source];
    const dy = this.y[target] - this.y[source];
    this.restLength[index] = Math.hypot(dx, dy) || 40;
    this._applyLinkOptions(index, options, true);
    this.degree[source]++;
    this.degree[target]++;
    this.topologyRevision++;
    return index;
  }

  /** @param {number} index @param {string|number} state Visual state name or code. */
  setNodeState(index, state) {
    if (index < 0 || index >= this.nodeCount) {
      return;
    }
    const code = nodeStateCode(state);
    this.nodeState[index] = code;
    this.flags[index] &= ~(NODE_SELECTED | NODE_DRAGGED | NODE_DISABLED);
    if (code === NODE_STATE_SELECTED) {
      this.flags[index] |= NODE_SELECTED;
    }

    if (code === NODE_STATE_DRAGGING) {
      this.flags[index] |= NODE_DRAGGED;
    }

    if (code === NODE_STATE_DISABLED) {
      this.flags[index] |= NODE_DISABLED;
    }
    this.appearanceRevision++;
  }

  /** @param {number} index @param {Record<string, unknown>} options Updates a node appearance without changing topology. */
  setNodeAppearance(index, options = {}) {
    if (index >= 0 && index < this.nodeCount) {
      this._applyNodeOptions(index, options, false);
    }
  }
  /** @param {number} index @param {Record<string, unknown>} options Updates a link appearance without changing topology. */
  setLinkAppearance(index, options = {}) {
    if (index >= 0 && index < this.linkCount) {
      this._applyLinkOptions(index, options, false);
    }
  }

  /** @param {string|number} linkId @return {boolean} Whether a link was removed. */
  removeLink(linkId) {
    const index = this.getLinkIndex(linkId);
    if (index < 0) {
      return false;
    }
    const last = this.linkCount - 1;
    const source = this.source[index];
    const target = this.target[index];
    this.degree[source]--;
    this.degree[target]--;
    this.linkIdToIndex.delete(linkId);
    if (index !== last) {
      const movedId = this._linkIds[last];
      this._linkIds[index] = movedId;
      this.linkIdToIndex.set(movedId, index);
      this.source[index] = this.source[last];
      this.target[index] = this.target[last];
      this.restLength[index] = this.restLength[last];
      this.linkStrength[index] = this.linkStrength[last];
      this.linkWidth[index] = this.linkWidth[last];
      this.linkColor[index] = this.linkColor[last];
      this.linkFlags[index] = this.linkFlags[last];
      this.linkOpacity[index] = this.linkOpacity[last];
      this.linkStyle[index] = this.linkStyle[last];
      this.linkDashLength[index] = this.linkDashLength[last];
      this.linkDashGap[index] = this.linkDashGap[last];
      this.linkDashOffset[index] = this.linkDashOffset[last];
      this.linkDashWorld[index] = this.linkDashWorld[last];
      this.linkArrow[index] = this.linkArrow[last];
      this.linkArrowSize[index] = this.linkArrowSize[last];
      this.linkArrowWidth[index] = this.linkArrowWidth[last];
    }
    this.linkCount--;
    this.topologyRevision++;
    this.appearanceRevision++;
    return true;
  }

  /** @param {string|number} nodeId @return {boolean} Whether a node was removed. */
  removeNode(nodeId) {
    const index = this.getNodeIndex(nodeId);
    if (index < 0) {
      return false;
    }
    for (let link = this.linkCount - 1; link >= 0; link--) {
      if (this.source[link] === index || this.target[link] === index) {
        this.removeLink(this._linkIds[link]);
      }
    }
    const last = this.nodeCount - 1;
    this.nodeIdToIndex.delete(nodeId);
    if (index !== last) {
      const movedId = this._nodeIds[last];
      this._nodeIds[index] = movedId;
      this.nodeIdToIndex.set(movedId, index);
      this.x[index] = this.x[last];
      this.y[index] = this.y[last];
      this.px[index] = this.px[last];
      this.py[index] = this.py[last];
      this.vx[index] = this.vx[last];
      this.vy[index] = this.vy[last];
      this.fx[index] = this.fx[last];
      this.fy[index] = this.fy[last];
      this.radius[index] = this.radius[last];
      this.visualRadius[index] = this.visualRadius[last];
      this.mass[index] = this.mass[last];
      this.degree[index] = this.degree[last];
      this.color[index] = this.color[last];
      this.borderColor[index] = this.borderColor[last];
      this.borderWidth[index] = this.borderWidth[last];
      this.borderOpacity[index] = this.borderOpacity[last];
      this.flags[index] = this.flags[last];
      this.nodeState[index] = this.nodeState[last];
      this.opacity[index] = this.opacity[last];
      this.nodeImage[index] = this.nodeImage[last];
      this.nodeLabel[index] = this.nodeLabel[last];
      for (let link = 0; link < this.linkCount; link++) {
        if (this.source[link] === last) {
          this.source[link] = index;
        }

        if (this.target[link] === last) {
          this.target[link] = index;
        }
      }
    }
    this.nodeImage[last] = null;
    this.nodeLabel[last] = null;
    this.nodeCount--;
    this.topologyRevision++;
    this.appearanceRevision++;
    return true;
  }

  /** @param {number} index @param {number} x World x coordinate. @param {number} y World y coordinate. @param {boolean} [resetPrevious] Resets Verlet history. */
  setNodePosition(index, x, y, resetPrevious = false) {
    if (index < 0 || index >= this.nodeCount) {
      return;
    }
    this.x[index] = x;
    this.y[index] = y;
    if (resetPrevious) {
      this.px[index] = x;
      this.py[index] = y;
    }
    this.positionRevision++;
  }

  /** @param {number} index @param {boolean} fixed Locks or unlocks the node in the physics solver. */
  setNodeFixed(index, fixed) {
    if (fixed) {
      this.flags[index] |= NODE_FIXED;
    } else {
      this.flags[index] &= ~NODE_FIXED;
    }

    if (this.nodeState[index] === NODE_STATE_FIXED && !fixed) {
      this.nodeState[index] = NODE_STATE_NORMAL;
    }

    if (fixed && this.nodeState[index] === NODE_STATE_NORMAL) {
      this.nodeState[index] = NODE_STATE_FIXED;
    }
    this.appearanceRevision++;
  }

  /** @param {number} index @return {boolean} Whether the node is fixed. */
  isNodeFixed(index) {
    return (this.flags[index] & NODE_FIXED) !== 0;
  }
  /** @param {number} index @return {boolean} Whether the node is hidden. */
  isNodeHidden(index) {
    return (this.flags[index] & NODE_HIDDEN) !== 0;
  }
  /** @param {number} index @return {boolean} Whether the node is disabled. */
  isNodeDisabled(index) {
    return (this.flags[index] & NODE_DISABLED) !== 0;
  }
  /** @param {number} index @return {boolean} Whether the link is hidden. */
  isLinkHidden(index) {
    return (this.linkFlags[index] & LINK_HIDDEN) !== 0;
  }

  /** @brief Removes all graph data while preserving allocated storage. */
  clear() {
    this.nodeCount = 0;
    this.linkCount = 0;
    this._nodeIds.length = 0;
    this._linkIds.length = 0;
    this.nodeIdToIndex.clear();
    this.linkIdToIndex.clear();
    this.topologyRevision++;
    this.appearanceRevision++;
  }

  /** @param {{nodes?: Array<Record<string, unknown>>, links?: Array<Record<string, unknown>>}} data Graph data to replace the current model. @return {this} This model. */
  setData(data = {}) {
    this.clear();
    const nodes = data.nodes || [];
    for (let index = 0; index < nodes.length; index++) {
      const node = nodes[index];
      this.addNode(node.id ?? index, node);
    }
    const links = data.links || [];
    for (let index = 0; index < links.length; index++) {
      const link = links[index];
      this.addLink(link.id ?? index, link.source, link.target, link);
    }
    return this;
  }

  /** @param {number} index @return {Record<string, unknown>} Immutable-style node view. */
  getNodeSnapshot(index) {
    return {
      id: this.getNodeId(index),
      x: this.x[index],
      y: this.y[index],
      radius: this.radius[index],
      visualRadius: this.visualRadius[index],
      mass: this.mass[index],
      degree: this.degree[index],
      color: this.color[index] >>> 0,
      backgroundColor: this.color[index] >>> 0,
      borderColor: this.borderColor[index] >>> 0,
      borderWidth: this.borderWidth[index],
      borderOpacity: this.borderOpacity[index],
      opacity: this.opacity[index],
      image: this.nodeImage[index],
      label: this.nodeLabel[index],
      state: this.nodeState[index],
      fixed: this.isNodeFixed(index),
      disabled: this.isNodeDisabled(index),
    };
  }

  /** @param {number} index @return {Record<string, unknown>} Immutable-style link view. */
  getLinkSnapshot(index) {
    return {
      id: this.getLinkId(index),
      sourceIndex: this.source[index],
      targetIndex: this.target[index],
      source: this.getNodeId(this.source[index]),
      target: this.getNodeId(this.target[index]),
      restLength: this.restLength[index],
      strength: this.linkStrength[index],
      width: this.linkWidth[index],
      color: this.linkColor[index] >>> 0,
      opacity: this.linkOpacity[index],
      style: this.linkStyle[index] === LINK_STYLE_DASHED ? 'dashed' : 'solid',
      dashPattern: [this.linkDashLength[index], this.linkDashGap[index]],
      dashOffset: this.linkDashOffset[index],
      dashScaleWithZoom: this.linkDashWorld[index] === 1,
      arrow: this.linkArrow[index] === 1 ? true : this.linkArrow[index] === -1 ? false : undefined,
      arrowSize: this.linkArrowSize[index],
      arrowWidth: this.linkArrowWidth[index],
    };
  }
}
