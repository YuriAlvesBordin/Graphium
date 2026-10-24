/**
 * Stores the whole graph in contiguous TypedArrays so physics, picking and
 * rendering all run with zero per-frame allocations. External string ids map
 * to dense integer indices through hash maps, and swap-remove keeps every
 * mutation O(links) in the worst case while preserving cache locality.
 */

import { packRGBA, deterministicColor, DEFAULT_COLOR } from './colors.js';
import type { LinkId, LinkOptions, LinkSnapshot, LinkStyleName, NodeId, NodeOptions, NodeSnapshot, NodeStateName, ThemeResolved } from './types.js';

export const NODE_FIXED = 1;
export const NODE_SELECTED = 2;
export const NODE_DRAGGED = 4;
export const NODE_HIDDEN = 8;
export const NODE_DISABLED = 16;
export const NODE_DIM = 32;

export const LINK_SELECTED = 1;
export const LINK_HIDDEN = 2;
export const LINK_DIM = 4;

export const STATE_NORMAL = 0;
export const STATE_HOVER = 1;
export const STATE_SELECTED = 2;
export const STATE_DRAGGING = 3;
export const STATE_FIXED = 4;
export const STATE_DISABLED = 5;

export const STYLE_SOLID = 0;
export const STYLE_DASHED = 1;

const DEFAULT_NODE_CAPACITY = 512;
const DEFAULT_LINK_CAPACITY = 1024;

const stateFromName = (value: NodeStateName | number): number => {
  if (typeof value === 'number') {
    return Math.max(STATE_NORMAL, Math.min(STATE_DISABLED, value | 0));
  }
  switch (value) {
    case 'hover':
      return STATE_HOVER;
    case 'selected':
      return STATE_SELECTED;
    case 'dragging':
      return STATE_DRAGGING;
    case 'fixed':
      return STATE_FIXED;
    case 'disabled':
      return STATE_DISABLED;
    default:
      return STATE_NORMAL;
  }
};

const nameFromState = (code: number): NodeStateName => {
  switch (code) {
    case STATE_HOVER:
      return 'hover';
    case STATE_SELECTED:
      return 'selected';
    case STATE_DRAGGING:
      return 'dragging';
    case STATE_FIXED:
      return 'fixed';
    case STATE_DISABLED:
      return 'disabled';
    default:
      return 'normal';
  }
};

const styleCode = (value: LinkStyleName): number => (value === 'dashed' ? STYLE_DASHED : STYLE_SOLID);

const styleName = (code: number): LinkStyleName => (code === STYLE_DASHED ? 'dashed' : 'solid');

const finiteOr = (value: number | undefined, fallback: number): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export interface GraphModelOptions {
  nodeCapacity?: number;
  linkCapacity?: number;
  theme: ThemeResolved;
}

export class GraphModel {
  readonly nodeDefaults: Required<NonNullable<ThemeOptionsNode>>;
  readonly linkDefaults: Required<ThemeOptionsEdgeShape>;
  nodeCount = 0;
  linkCount = 0;
  topologyRevision = 0;
  positionRevision = 0;
  appearanceRevision = 0;
  restLengthRevision = 0;
  palette: number[];

  private nodeIds: Array<NodeId | undefined> = [];
  private linkIds: Array<LinkId | undefined> = [];
  private nodeIndexById = new Map<NodeId, number>();
  private linkIndexById = new Map<LinkId, number>();
  private nodeData: Array<Record<string, unknown>> = [];
  private linkData: Array<Record<string, unknown>> = [];

  x: Float32Array;
  y: Float32Array;
  px: Float32Array;
  py: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  fx: Float32Array;
  fy: Float32Array;
  radius: Float32Array;
  visualRadius: Float32Array;
  mass: Float32Array;
  degree: Int32Array;
  color: Uint32Array;
  borderColor: Uint32Array;
  borderWidth: Float32Array;
  nodeOpacity: Float32Array;
  nodeImage: Array<string | null>;
  nodeImageMode: Uint8Array;
  nodeLabel: Array<string | null>;
  nodeLabelSize: Float32Array;
  nodeLabelScale: Float32Array;
  nodeLabelColor: Array<string | undefined>;
  nodeLabelWeight: Array<number | string | undefined>;
  nodeLabelFont: Array<string | undefined>;
  nodeLabelBackground: Array<string | null | undefined>;
  flags: Uint8Array;
  state: Uint8Array;

  source: Int32Array;
  target: Int32Array;
  restLength: Float32Array;
  restLengthTarget: Float32Array;
  linkStrength: Float32Array;
  linkWidth: Float32Array;
  linkColor: Uint32Array;
  linkFlags: Uint8Array;
  linkOpacity: Float32Array;
  linkCurvature: Float32Array;
  linkStyle: Uint8Array;
  dashLength: Float32Array;
  dashGap: Float32Array;
  dashOffset: Float32Array;
  dashWorldScale: Uint8Array;
  arrowMode: Int8Array;
  arrowSize: Float32Array;
  arrowWidth: Float32Array;

  private nodeCapacity: number;
  private linkCapacity: number;

  constructor(options: GraphModelOptions) {
    const theme = options.theme;
    this.nodeDefaults = {
      radius: theme.nodeRadius,
      color: theme.nodeColor,
      borderColor: theme.nodeBorderColor,
      borderWidth: theme.nodeBorderWidth,
      borderOpacity: theme.nodeBorderOpacity,
      opacity: theme.nodeOpacity,
    };
    this.linkDefaults = {
      color: theme.edgeColor,
      width: theme.edgeWidth,
      opacity: theme.edgeOpacity,
      curvature: theme.edgeCurvature,
      style: styleCode(theme.edgeStyle),
      arrow: theme.edgeArrowEnabled ? 1 : -1,
      arrowSize: theme.edgeArrowSize,
      arrowWidth: theme.edgeArrowWidth,
    };
    this.palette = theme.nodeColorPalette;
    this.nodeCapacity = Math.max(16, options.nodeCapacity ?? DEFAULT_NODE_CAPACITY);
    this.linkCapacity = Math.max(16, options.linkCapacity ?? DEFAULT_LINK_CAPACITY);
    this.x = new Float32Array(this.nodeCapacity);
    this.y = new Float32Array(this.nodeCapacity);
    this.px = new Float32Array(this.nodeCapacity);
    this.py = new Float32Array(this.nodeCapacity);
    this.vx = new Float32Array(this.nodeCapacity);
    this.vy = new Float32Array(this.nodeCapacity);
    this.fx = new Float32Array(this.nodeCapacity);
    this.fy = new Float32Array(this.nodeCapacity);
    this.radius = new Float32Array(this.nodeCapacity);
    this.visualRadius = new Float32Array(this.nodeCapacity);
    this.mass = new Float32Array(this.nodeCapacity);
    this.degree = new Int32Array(this.nodeCapacity);
    this.color = new Uint32Array(this.nodeCapacity);
    this.borderColor = new Uint32Array(this.nodeCapacity);
    this.borderWidth = new Float32Array(this.nodeCapacity);
    this.nodeOpacity = new Float32Array(this.nodeCapacity);
    this.nodeImage = new Array(this.nodeCapacity).fill(null);
    this.nodeImageMode = new Uint8Array(this.nodeCapacity);
    this.nodeLabel = new Array(this.nodeCapacity).fill(null);
    this.nodeLabelSize = new Float32Array(this.nodeCapacity);
    this.nodeLabelScale = new Float32Array(this.nodeCapacity).fill(1);
    this.nodeLabelColor = new Array(this.nodeCapacity).fill(undefined);
    this.nodeLabelWeight = new Array(this.nodeCapacity).fill(undefined);
    this.nodeLabelFont = new Array(this.nodeCapacity).fill(undefined);
    this.nodeLabelBackground = new Array(this.nodeCapacity).fill(undefined);
    this.flags = new Uint8Array(this.nodeCapacity);
    this.state = new Uint8Array(this.nodeCapacity);
    this.source = new Int32Array(this.linkCapacity);
    this.target = new Int32Array(this.linkCapacity);
    this.restLength = new Float32Array(this.linkCapacity);
    this.restLengthTarget = new Float32Array(this.linkCapacity);
    this.linkStrength = new Float32Array(this.linkCapacity);
    this.linkWidth = new Float32Array(this.linkCapacity);
    this.linkColor = new Uint32Array(this.linkCapacity);
    this.linkFlags = new Uint8Array(this.linkCapacity);
    this.linkOpacity = new Float32Array(this.linkCapacity);
    this.linkCurvature = new Float32Array(this.linkCapacity);
    this.linkStyle = new Uint8Array(this.linkCapacity);
    this.dashLength = new Float32Array(this.linkCapacity);
    this.dashGap = new Float32Array(this.linkCapacity);
    this.dashOffset = new Float32Array(this.linkCapacity);
    this.dashWorldScale = new Uint8Array(this.linkCapacity);
    this.arrowMode = new Int8Array(this.linkCapacity);
    this.arrowSize = new Float32Array(this.linkCapacity);
    this.arrowWidth = new Float32Array(this.linkCapacity);
  }

  /** Resolves a node id or raw index into a dense index, or returns -1. */
  nodeIndexOf(idOrIndex: NodeId | number): number {
    if (typeof idOrIndex === 'number' && Number.isInteger(idOrIndex) && idOrIndex >= 0 && idOrIndex < this.nodeCount && !this.nodeIndexById.has(idOrIndex)) {
      return idOrIndex;
    }
    return this.nodeIndexById.get(idOrIndex as NodeId) ?? -1;
  }

  /** Resolves a link id or raw index into a dense index, or returns -1. */
  linkIndexOf(idOrIndex: LinkId | number): number {
    if (typeof idOrIndex === 'number' && Number.isInteger(idOrIndex) && idOrIndex >= 0 && idOrIndex < this.linkCount && !this.linkIndexById.has(idOrIndex)) {
      return idOrIndex;
    }
    return this.linkIndexById.get(idOrIndex as LinkId) ?? -1;
  }

  /** Returns the external id attached to a dense node index. */
  nodeIdAt(index: number): NodeId | undefined {
    return this.nodeIds[index];
  }

  /** Returns the external id attached to a dense link index. */
  linkIdAt(index: number): LinkId | undefined {
    return this.linkIds[index];
  }

  /** Adds a node or updates an existing one and returns its dense index. */
  addNode(id: NodeId, options: NodeOptions = {}): number {
    const existing = this.nodeIndexById.get(id);
    if (existing !== undefined) {
      this.applyNodeOptions(existing, options, false);
      return existing;
    }
    const index = this.nodeCount++;
    this.ensureNodeCapacity(this.nodeCount);
    this.nodeIds[index] = id;
    this.nodeIndexById.set(id, index);
    this.nodeData[index] = options.data ?? {};
    const hasPosition = typeof options.x === 'number' && Number.isFinite(options.x) && typeof options.y === 'number' && Number.isFinite(options.y);
    if (hasPosition) {
      this.x[index] = options.x as number;
      this.y[index] = options.y as number;
    } else {
      const angle = Math.random() * Math.PI * 2;
      const distance = 60 + Math.sqrt(this.nodeCount) * 24;
      this.x[index] = Math.cos(angle) * distance;
      this.y[index] = Math.sin(angle) * distance;
    }
    this.px[index] = this.x[index];
    this.py[index] = this.y[index];
    this.vx[index] = 0;
    this.vy[index] = 0;
    this.fx[index] = 0;
    this.fy[index] = 0;
    this.degree[index] = 0;
    this.state[index] = STATE_NORMAL;
    this.flags[index] = options.hidden ? NODE_HIDDEN : 0;
    this.applyNodeOptions(index, options, true);
    this.topologyRevision++;
    return index;
  }

  /** Adds a link or updates an existing one and returns its dense index. */
  addLink(id: LinkId, sourceId: NodeId, targetId: NodeId, options: LinkOptions = {}): number {
    const existing = this.linkIndexById.get(id);
    if (existing !== undefined) {
      this.applyLinkOptions(existing, options, false);
      return existing;
    }
    const source = this.nodeIndexOf(sourceId);
    const target = this.nodeIndexOf(targetId);
    if (source < 0 || target < 0) {
      throw new Error(`Graphium cannot link "${String(sourceId)}" to "${String(targetId)}" because a node is missing.`);
    }
    const index = this.linkCount++;
    this.ensureLinkCapacity(this.linkCount);
    this.linkIds[index] = id;
    this.linkIndexById.set(id, index);
    this.linkData[index] = options.data ?? {};
    this.source[index] = source;
    this.target[index] = target;
    const dx = this.x[target] - this.x[source];
    const dy = this.y[target] - this.y[source];
    const distance = Math.max(1, Math.hypot(dx, dy) || 90);
    this.restLength[index] = distance;
    this.restLengthTarget[index] = distance;
    this.linkStrength[index] = 1;
    this.linkFlags[index] = options.hidden ? LINK_HIDDEN : 0;
    this.arrowMode[index] = 0;
    this.degree[source]++;
    this.degree[target]++;
    this.applyLinkOptions(index, options, true);
    this.topologyRevision++;
    return index;
  }

  /** Applies node level appearance and physics properties to an index. */
  private applyNodeOptions(index: number, options: NodeOptions, isNew: boolean): void {
    const defaults = this.nodeDefaults;
    if (isNew || options.radius !== undefined) {
      this.radius[index] = Math.max(0.5, finiteOr(options.radius, defaults.radius));
      this.visualRadius[index] = this.radius[index];
    }
    if (isNew || options.visualRadius !== undefined) {
      this.visualRadius[index] = Math.max(0.5, finiteOr(options.visualRadius, this.radius[index]));
    }
    if (isNew || options.mass !== undefined) {
      this.mass[index] = Math.max(0.0001, finiteOr(options.mass, 1));
    }
    const fill = options.color;
    if (isNew || fill !== undefined) {
      this.color[index] = fill === undefined ? (this.palette.length ? deterministicColor(this.nodeIds[index] ?? index, this.palette) : DEFAULT_COLOR) : packRGBA(fill, DEFAULT_COLOR);
    }
    if (isNew || options.borderColor !== undefined) {
      this.borderColor[index] = packRGBA(options.borderColor, defaults.borderColor);
    }
    if (isNew || options.borderWidth !== undefined) {
      this.borderWidth[index] = Math.max(0, finiteOr(options.borderWidth, defaults.borderWidth));
    }
    if (isNew || options.opacity !== undefined) {
      this.nodeOpacity[index] = clamp01(finiteOr(options.opacity, defaults.opacity));
    }
    if (isNew || options.image !== undefined) {
      this.nodeImage[index] = options.image ? String(options.image) : null;
    }
    if (isNew || options.imageMode !== undefined) {
      this.nodeImageMode[index] = options.imageMode === 'contain' ? 1 : 0;
    }
    if (isNew || options.label !== undefined) {
      this.nodeLabel[index] = options.label === undefined || options.label === null ? null : String(options.label);
    }
    if (isNew || options.labelSize !== undefined) {
      const size = finiteOr(options.labelSize, 0);
      this.nodeLabelSize[index] = size > 0 ? Math.max(1, size) : 0;
    }
    if (isNew || options.labelScale !== undefined) {
      this.nodeLabelScale[index] = Math.max(0.1, finiteOr(options.labelScale, 1));
    }
    if (isNew || options.labelColor !== undefined) {
      this.nodeLabelColor[index] = options.labelColor;
    }
    if (isNew || options.labelWeight !== undefined) {
      this.nodeLabelWeight[index] = options.labelWeight;
    }
    if (isNew || options.labelFont !== undefined) {
      this.nodeLabelFont[index] = options.labelFont;
    }
    if (isNew || options.labelBackground !== undefined) {
      this.nodeLabelBackground[index] = options.labelBackground;
    }
    if (options.fixed !== undefined) {
      if (options.fixed) {
        this.flags[index] |= NODE_FIXED;
        this.state[index] = STATE_FIXED;
      } else {
        this.flags[index] &= ~NODE_FIXED;
        if (this.state[index] === STATE_FIXED) {
          this.state[index] = STATE_NORMAL;
        }
      }
    }
    if (options.disabled !== undefined) {
      if (options.disabled) {
        this.flags[index] |= NODE_DISABLED;
        this.state[index] = STATE_DISABLED;
      } else {
        this.flags[index] &= ~NODE_DISABLED;
        if (this.state[index] === STATE_DISABLED) {
          this.state[index] = STATE_NORMAL;
        }
      }
    }
    if (options.hidden !== undefined) {
      if (options.hidden) {
        this.flags[index] |= NODE_HIDDEN;
      } else {
        this.flags[index] &= ~NODE_HIDDEN;
      }
    }
    if (options.state !== undefined) {
      this.setNodeState(index, options.state);
    }
    this.appearanceRevision++;
  }

  /** Applies link level appearance and physics properties to an index. */
  private applyLinkOptions(index: number, options: LinkOptions, isNew: boolean): void {
    const defaults = this.linkDefaults;
    if (options.restLength !== undefined) {
      this.restLengthTarget[index] = Math.max(1, finiteOr(options.restLength, this.restLengthTarget[index]));
      this.restLengthRevision++;
    }
    if (isNew || options.strength !== undefined) {
      this.linkStrength[index] = Math.max(0.0001, finiteOr(options.strength, 1));
    }
    if (isNew || options.color !== undefined) {
      this.linkColor[index] = packRGBA(options.color, defaults.color);
    }
    if (isNew || options.width !== undefined) {
      this.linkWidth[index] = Math.max(0.05, finiteOr(options.width, defaults.width));
    }
    if (isNew || options.opacity !== undefined) {
      this.linkOpacity[index] = clamp01(finiteOr(options.opacity, defaults.opacity));
    }
    if (isNew || options.curvature !== undefined) {
      this.linkCurvature[index] = Math.max(-1.5, Math.min(1.5, finiteOr(options.curvature, defaults.curvature)));
    }
    if (isNew || options.style !== undefined) {
      this.linkStyle[index] = styleCode(options.style ?? 'solid');
    }
    if (isNew || options.dashPattern !== undefined) {
      const pattern = options.dashPattern ?? [6, 8];
      this.dashLength[index] = Math.max(0.25, finiteOr(pattern[0], 6));
      this.dashGap[index] = Math.max(0.25, finiteOr(pattern[1], 8));
    }
    if (isNew || options.dashOffset !== undefined) {
      this.dashOffset[index] = finiteOr(options.dashOffset, 0);
    }
    if (isNew || options.dashWorldScale !== undefined) {
      this.dashWorldScale[index] = options.dashWorldScale ? 1 : 0;
    }
    if (options.arrow !== undefined) {
      this.arrowMode[index] = options.arrow ? 1 : -1;
    }
    if (isNew || options.arrowSize !== undefined) {
      this.arrowSize[index] = Math.max(0, finiteOr(options.arrowSize, defaults.arrowSize));
    }
    if (isNew || options.arrowWidth !== undefined) {
      this.arrowWidth[index] = Math.max(0, finiteOr(options.arrowWidth, defaults.arrowWidth));
    }
    if (options.hidden !== undefined) {
      if (options.hidden) {
        this.linkFlags[index] |= LINK_HIDDEN;
      } else {
        this.linkFlags[index] &= ~LINK_HIDDEN;
      }
    }
    this.appearanceRevision++;
  }

  /** Writes a visual state code and keeps the flag mask synchronized. */
  setNodeState(index: number, value: NodeStateName | number): void {
    if (index < 0 || index >= this.nodeCount) {
      return;
    }
    const code = stateFromName(value);
    this.state[index] = code;
    this.flags[index] &= ~(NODE_SELECTED | NODE_DRAGGED | NODE_DISABLED);
    if (code === STATE_SELECTED) {
      this.flags[index] |= NODE_SELECTED;
    } else if (code === STATE_DRAGGING) {
      this.flags[index] |= NODE_DRAGGED;
    } else if (code === STATE_DISABLED) {
      this.flags[index] |= NODE_DISABLED;
    }
    this.appearanceRevision++;
  }

  /** Updates node appearance properties without touching topology. */
  updateNode(index: number, options: NodeOptions): void {
    if (index >= 0 && index < this.nodeCount) {
      this.applyNodeOptions(index, options, false);
    }
  }

  /** Updates link appearance properties without touching topology. */
  updateLink(index: number, options: LinkOptions): void {
    if (index >= 0 && index < this.linkCount) {
      this.applyLinkOptions(index, options, false);
    }
  }

  /** Sets node world position and optionally resets Verlet history. */
  setNodePosition(index: number, x: number, y: number, resetPrevious: boolean = false): void {
    if (index < 0 || index >= this.nodeCount) {
      return;
    }
    this.x[index] = x;
    this.y[index] = y;
    if (resetPrevious) {
      this.px[index] = x;
      this.py[index] = y;
      this.vx[index] = 0;
      this.vy[index] = 0;
    }
    this.positionRevision++;
  }

  /** Locks or unlocks a node inside the physics solver. */
  setNodeFixed(index: number, fixed: boolean): void {
    if (index < 0 || index >= this.nodeCount) {
      return;
    }
    if (fixed) {
      this.flags[index] |= NODE_FIXED;
      if (this.state[index] === STATE_NORMAL) {
        this.state[index] = STATE_FIXED;
      }
    } else {
      this.flags[index] &= ~NODE_FIXED;
      if (this.state[index] === STATE_FIXED) {
        this.state[index] = STATE_NORMAL;
      }
    }
    this.appearanceRevision++;
  }

  /** Toggles the selected flag of a node. */
  setNodeSelected(index: number, selected: boolean): void {
    if (index < 0 || index >= this.nodeCount) {
      return;
    }
    if (selected) {
      this.flags[index] |= NODE_SELECTED;
      this.state[index] = STATE_SELECTED;
    } else {
      this.flags[index] &= ~NODE_SELECTED;
      if (this.state[index] === STATE_SELECTED) {
        this.state[index] = STATE_NORMAL;
      }
    }
    this.appearanceRevision++;
  }

  /** Toggles the selected flag of a link. */
  setLinkSelected(index: number, selected: boolean): void {
    if (index < 0 || index >= this.linkCount) {
      return;
    }
    if (selected) {
      this.linkFlags[index] |= LINK_SELECTED;
    } else {
      this.linkFlags[index] &= ~LINK_SELECTED;
    }
    this.appearanceRevision++;
  }

  /** Removes a link using swap-remove and returns whether it existed. */
  removeLink(id: LinkId): boolean {
    const index = this.linkIndexById.get(id);
    if (index === undefined) {
      return false;
    }
    const last = this.linkCount - 1;
    this.degree[this.source[index]]--;
    this.degree[this.target[index]]--;
    this.linkIndexById.delete(id);
    if (index !== last) {
      const movedId = this.linkIds[last] as LinkId;
      this.linkIds[index] = movedId;
      this.linkIndexById.set(movedId, index);
      this.linkData[index] = this.linkData[last];
      this.source[index] = this.source[last];
      this.target[index] = this.target[last];
      this.restLength[index] = this.restLength[last];
      this.restLengthTarget[index] = this.restLengthTarget[last];
      this.linkStrength[index] = this.linkStrength[last];
      this.linkWidth[index] = this.linkWidth[last];
      this.linkColor[index] = this.linkColor[last];
      this.linkFlags[index] = this.linkFlags[last];
      this.linkOpacity[index] = this.linkOpacity[last];
      this.linkCurvature[index] = this.linkCurvature[last];
      this.linkStyle[index] = this.linkStyle[last];
      this.dashLength[index] = this.dashLength[last];
      this.dashGap[index] = this.dashGap[last];
      this.dashOffset[index] = this.dashOffset[last];
      this.dashWorldScale[index] = this.dashWorldScale[last];
      this.arrowMode[index] = this.arrowMode[last];
      this.arrowSize[index] = this.arrowSize[last];
      this.arrowWidth[index] = this.arrowWidth[last];
    }
    this.linkCount--;
    this.topologyRevision++;
    this.appearanceRevision++;
    return true;
  }

  /** Removes every link touching a node before the node itself is removed. */
  removeLinksOf(index: number): void {
    for (let link = this.linkCount - 1; link >= 0; link--) {
      if (this.source[link] === index || this.target[link] === index) {
        this.removeLink(this.linkIds[link] as LinkId);
      }
    }
  }

  /** Removes a node using swap-remove and reindexes surviving links. */
  removeNode(id: NodeId): boolean {
    const index = this.nodeIndexById.get(id);
    if (index === undefined) {
      return false;
    }
    this.removeLinksOf(index);
    const last = this.nodeCount - 1;
    this.nodeIndexById.delete(id);
    if (index !== last) {
      const movedId = this.nodeIds[last] as NodeId;
      this.nodeIds[index] = movedId;
      this.nodeIndexById.set(movedId, index);
      this.nodeData[index] = this.nodeData[last];
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
      this.nodeOpacity[index] = this.nodeOpacity[last];
      this.nodeImage[index] = this.nodeImage[last];
      this.nodeImageMode[index] = this.nodeImageMode[last];
      this.nodeLabel[index] = this.nodeLabel[last];
      this.nodeLabelSize[index] = this.nodeLabelSize[last];
      this.nodeLabelScale[index] = this.nodeLabelScale[last];
      this.nodeLabelColor[index] = this.nodeLabelColor[last];
      this.nodeLabelWeight[index] = this.nodeLabelWeight[last];
      this.nodeLabelFont[index] = this.nodeLabelFont[last];
      this.nodeLabelBackground[index] = this.nodeLabelBackground[last];
      this.flags[index] = this.flags[last];
      this.state[index] = this.state[last];
      for (let link = 0; link < this.linkCount; link++) {
        if (this.source[link] === last) {
          this.source[link] = index;
        }
        if (this.target[link] === last) {
          this.target[link] = index;
        }
      }
    }
    this.nodeIds.length = this.nodeCount - 1;
    this.nodeData.length = this.nodeCount - 1;
    this.nodeImage[this.nodeCount - 1] = null;
    this.nodeLabel[this.nodeCount - 1] = null;
    this.nodeLabelSize[this.nodeCount - 1] = 0;
    this.nodeLabelScale[this.nodeCount - 1] = 1;
    this.nodeLabelColor[this.nodeCount - 1] = undefined;
    this.nodeLabelWeight[this.nodeCount - 1] = undefined;
    this.nodeLabelFont[this.nodeCount - 1] = undefined;
    this.nodeLabelBackground[this.nodeCount - 1] = undefined;
    this.nodeCount--;
    this.topologyRevision++;
    this.appearanceRevision++;
    return true;
  }

  /** Replaces the whole graph with the supplied data payload. */
  setData(data: { nodes?: Array<NodeOptions & { id: NodeId }>; links?: Array<LinkOptions & { source: NodeId; target: NodeId }> }): void {
    this.clear();
    const nodes = data.nodes ?? [];
    for (let index = 0; index < nodes.length; index++) {
      const node = nodes[index];
      this.addNode(node.id ?? index, node);
    }
    const links = data.links ?? [];
    for (let index = 0; index < links.length; index++) {
      const link = links[index];
      const linkId = link.id ?? `${String(link.source)}->${String(link.target)}:${index}`;
      this.addLink(linkId, link.source, link.target, link);
    }
  }

  /** Clears topology while keeping allocated storage and current theme. */
  clear(): void {
    this.nodeCount = 0;
    this.linkCount = 0;
    this.nodeIds.length = 0;
    this.linkIds.length = 0;
    this.nodeData.length = 0;
    this.linkData.length = 0;
    this.nodeIndexById.clear();
    this.linkIndexById.clear();
    this.topologyRevision++;
    this.appearanceRevision++;
    this.positionRevision++;
  }

  /** Builds a readable snapshot object for one node. */
  nodeSnapshot(index: number): NodeSnapshot {
    return {
      id: this.nodeIds[index] as NodeId,
      index,
      x: this.x[index],
      y: this.y[index],
      vx: this.vx[index],
      vy: this.vy[index],
      radius: this.radius[index],
      visualRadius: this.visualRadius[index],
      mass: this.mass[index],
      degree: this.degree[index],
      color: this.color[index],
      borderColor: this.borderColor[index],
      borderWidth: this.borderWidth[index],
      opacity: this.nodeOpacity[index],
      image: this.nodeImage[index],
      label: this.nodeLabel[index],
      state: nameFromState(this.state[index]),
      fixed: (this.flags[index] & NODE_FIXED) !== 0,
      hidden: (this.flags[index] & NODE_HIDDEN) !== 0,
      disabled: (this.flags[index] & NODE_DISABLED) !== 0,
      data: this.nodeData[index] ?? {},
    };
  }

  /** Builds a readable snapshot object for one link. */
  linkSnapshot(index: number): LinkSnapshot {
    return {
      id: this.linkIds[index] as LinkId,
      index,
      source: this.nodeIds[this.source[index]] as NodeId,
      target: this.nodeIds[this.target[index]] as NodeId,
      sourceIndex: this.source[index],
      targetIndex: this.target[index],
      color: this.linkColor[index],
      width: this.linkWidth[index],
      opacity: this.linkOpacity[index],
      curvature: this.linkCurvature[index],
      style: styleName(this.linkStyle[index]),
      dashPattern: [this.dashLength[index], this.dashGap[index]],
      dashOffset: this.dashOffset[index],
      arrow: this.arrowMode[index] === 1 ? true : this.arrowMode[index] === -1 ? false : undefined,
      arrowSize: this.arrowSize[index],
      arrowWidth: this.arrowWidth[index],
      strength: this.linkStrength[index],
      restLength: this.restLengthTarget[index],
      hidden: (this.linkFlags[index] & LINK_HIDDEN) !== 0,
      data: this.linkData[index] ?? {},
    };
  }

  /** Returns the custom data object attached to a node. */
  nodeUserData(index: number): Record<string, unknown> {
    return this.nodeData[index] ?? (this.nodeData[index] = {});
  }

  /** Returns the custom data object attached to a link. */
  linkUserData(index: number): Record<string, unknown> {
    return this.linkData[index] ?? (this.linkData[index] = {});
  }

  /** Doubles node storage when the dense count would overflow. */
  private ensureNodeCapacity(required: number): void {
    if (required <= this.nodeCapacity) {
      return;
    }
    let capacity = this.nodeCapacity;
    while (capacity < required) {
      capacity *= 2;
    }
    this.x = grow(this.x, capacity);
    this.y = grow(this.y, capacity);
    this.px = grow(this.px, capacity);
    this.py = grow(this.py, capacity);
    this.vx = grow(this.vx, capacity);
    this.vy = grow(this.vy, capacity);
    this.fx = grow(this.fx, capacity);
    this.fy = grow(this.fy, capacity);
    this.radius = grow(this.radius, capacity);
    this.visualRadius = grow(this.visualRadius, capacity);
    this.mass = grow(this.mass, capacity);
    this.degree = growInt(this.degree, capacity);
    this.color = growUint32(this.color, capacity);
    this.borderColor = growUint32(this.borderColor, capacity);
    this.borderWidth = grow(this.borderWidth, capacity);
    this.nodeOpacity = grow(this.nodeOpacity, capacity);
    this.nodeImage = growObjects(this.nodeImage, capacity);
    this.nodeImageMode = growUint8(this.nodeImageMode, capacity);
    this.nodeLabel = growObjects(this.nodeLabel, capacity);
    this.nodeLabelSize = grow(this.nodeLabelSize, capacity);
    const nextLabelScale = new Float32Array(capacity).fill(1);
    nextLabelScale.set(this.nodeLabelScale);
    this.nodeLabelScale = nextLabelScale;
    this.nodeLabelColor = growObjects(this.nodeLabelColor, capacity);
    this.nodeLabelWeight = growObjects(this.nodeLabelWeight, capacity);
    this.nodeLabelFont = growObjects(this.nodeLabelFont, capacity);
    this.nodeLabelBackground = growObjects(this.nodeLabelBackground, capacity);
    this.flags = growUint8(this.flags, capacity);
    this.state = growUint8(this.state, capacity);
    this.nodeCapacity = capacity;
  }

  /** Doubles link storage when the dense count would overflow. */
  private ensureLinkCapacity(required: number): void {
    if (required <= this.linkCapacity) {
      return;
    }
    let capacity = this.linkCapacity;
    while (capacity < required) {
      capacity *= 2;
    }
    this.source = growInt(this.source, capacity);
    this.target = growInt(this.target, capacity);
    this.restLength = grow(this.restLength, capacity);
    this.restLengthTarget = grow(this.restLengthTarget, capacity);
    this.linkStrength = grow(this.linkStrength, capacity);
    this.linkWidth = grow(this.linkWidth, capacity);
    this.linkColor = growUint32(this.linkColor, capacity);
    this.linkFlags = growUint8(this.linkFlags, capacity);
    this.linkOpacity = grow(this.linkOpacity, capacity);
    this.linkCurvature = grow(this.linkCurvature, capacity);
    this.linkStyle = growUint8(this.linkStyle, capacity);
    this.dashLength = grow(this.dashLength, capacity);
    this.dashGap = grow(this.dashGap, capacity);
    this.dashOffset = grow(this.dashOffset, capacity);
    this.dashWorldScale = growUint8(this.dashWorldScale, capacity);
    this.arrowMode = growInt8(this.arrowMode, capacity);
    this.arrowSize = grow(this.arrowSize, capacity);
    this.arrowWidth = grow(this.arrowWidth, capacity);
    this.linkCapacity = capacity;
  }
}

interface ThemeOptionsNode {
  radius?: number;
  color?: number;
  borderColor?: number;
  borderWidth?: number;
  borderOpacity?: number;
  opacity?: number;
}

interface ThemeOptionsEdgeShape {
  color: number;
  width: number;
  opacity: number;
  curvature: number;
  style: number;
  arrow: number;
  arrowSize: number;
  arrowWidth: number;
}

function grow<T extends Float32Array>(array: T, capacity: number): T {
  const next = new Float32Array(capacity);
  next.set(array);
  return next as T;
}

function growInt(array: Int32Array, capacity: number): Int32Array {
  const next = new Int32Array(capacity);
  next.set(array);
  return next;
}

function growInt8(array: Int8Array, capacity: number): Int8Array {
  const next = new Int8Array(capacity);
  next.set(array);
  return next;
}

function growUint8(array: Uint8Array, capacity: number): Uint8Array {
  const next = new Uint8Array(capacity);
  next.set(array);
  return next;
}

function growUint32(array: Uint32Array, capacity: number): Uint32Array {
  const next = new Uint32Array(capacity);
  next.set(array);
  return next;
}

function growObjects<T>(array: Array<T>, capacity: number): Array<T> {
  const next = new Array<T>(capacity).fill(null as unknown as T);
  for (let index = 0; index < array.length; index++) {
    next[index] = array[index];
  }
  return next;
}
