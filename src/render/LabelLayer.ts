/**
 * Renders node labels as a pooled set of DOM elements positioned over the
 * canvas. The pool keeps at most a fixed number of elements alive, updates
 * transforms without layout thrash and hides labels below a zoom threshold.
 *
 * Dense regions also cull labels: a label is only shown when it does not
 * overlap an already placed label. Placement follows a priority order —
 * selected and dragged nodes first, then larger nodes — so the labels that
 * matter most survive. The theme opt-out is `label: { cullOverlapping: false }`.
 */

import { GraphModel, NODE_DIM, NODE_DRAGGED, NODE_HIDDEN, NODE_SELECTED } from '../core/GraphModel.js';
import type { ThemeResolved } from '../core/types.js';
import { Camera } from './Camera.js';

const MAX_LABELS = 400;
/** Clearance kept between placed label rects so texts never touch. */
const LABEL_GAP = 4;
/** Estimated glyph width used when text cannot be measured (no 2D context). */
const ESTIMATED_GLYPH_WIDTH = 0.6;
/** Line height multiplier applied to the label size for rect heights. */
const LABEL_LINE_HEIGHT = 1.25;
/** Upper bound of the text measurement cache before it resets. */
const MEASURE_CACHE_LIMIT = 4096;

const measureCache = new Map<string, number>();

/** Measures one string at the label font, caching per font+text pair. */
function measureTextWidth(theme: ThemeResolved, text: string, context: CanvasRenderingContext2D | null): number {
  const font = `${theme.labelWeight} ${theme.labelSize}px ${theme.labelFont}`;
  const cacheKey = `${font}\u0000${text}`;
  const cached = measureCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  let width: number;
  if (context) {
    context.font = font;
    width = context.measureText(text).width;
  } else {
    width = text.length * theme.labelSize * ESTIMATED_GLYPH_WIDTH;
  }
  if (measureCache.size >= MEASURE_CACHE_LIMIT) {
    measureCache.clear();
  }
  measureCache.set(cacheKey, width);
  return width;
}

/** Creates the shared 2D context used for text measurement, or null. */
function createMeasureContext(): CanvasRenderingContext2D | null {
  try {
    return document.createElement('canvas').getContext('2d');
  } catch {
    return null;
  }
}

export class LabelLayer {
  container: HTMLDivElement;
  theme: ThemeResolved;
  minZoom = 0.3;

  private model: GraphModel | null = null;
  private camera: Camera | null = null;
  private pool: HTMLDivElement[] = [];
  private activeCount = 0;
  private screen = { x: 0, y: 0 };
  private measureContext: CanvasRenderingContext2D | null | undefined = undefined;
  private candidates = new Int32Array(128);
  private candidateCount = 0;
  private placedRects = new Float32Array(MAX_LABELS * 4);
  private placedCount = 0;

  /** Priority comparator: selected, dragged, larger radius, stable by index. */
  private readonly priority = (a: number, b: number): number => {
    const model = this.model as GraphModel;
    const byTier = this.tier(model.flags[a]) - this.tier(model.flags[b]);
    if (byTier !== 0) {
      return byTier;
    }
    const byRadius = model.visualRadius[b] - model.visualRadius[a];
    if (byRadius !== 0) {
      return byRadius;
    }
    return a - b;
  };

  /** Priority tier of a node: selected first, then dragged, then the rest. */
  private tier(flags: number): number {
    if ((flags & NODE_SELECTED) !== 0) {
      return 0;
    }
    if ((flags & NODE_DRAGGED) !== 0) {
      return 1;
    }
    return 2;
  }

  constructor(parent: HTMLElement, theme: ThemeResolved) {
    this.theme = theme;
    this.container = document.createElement('div');
    Object.assign(this.container.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      pointerEvents: 'none',
      userSelect: 'none',
      zIndex: '1',
    } as CSSStyleDeclaration);
    parent.appendChild(this.container);
    this.applyTheme();
  }

  /** Applies label styling from the theme to the pool and future nodes. */
  applyTheme(): void {
    const label = this.theme;
    for (const element of this.pool) {
      element.style.font = `${label.labelWeight} ${label.labelSize}px ${label.labelFont}`;
      element.style.color = label.labelColor;
      if (label.labelBackground) {
        element.style.background = label.labelBackground;
        element.style.padding = `${label.labelPadding[1]}px ${label.labelPadding[0]}px`;
        element.style.borderRadius = `${label.labelRadius}px`;
      } else {
        element.style.background = 'none';
        element.style.padding = '0';
      }
    }
  }

  /** Registers the model and camera the layer reads positions from. */
  attach(model: GraphModel, camera: Camera): void {
    this.model = model;
    this.camera = camera;
  }

  /** Syncs pooled labels with visible nodes for the current frame. */
  update(): void {
    const model = this.model;
    const camera = this.camera;
    if (!model || !camera) {
      return;
    }
    const enabled = this.theme.labelEnabled;
    if (!enabled || camera.zoom < this.minZoom) {
      this.hideAll();
      return;
    }
    const margin = 40;
    const width = camera.width;
    const height = camera.height;
    // camera dimensions are drawing-buffer pixels; DOM transforms are CSS pixels
    const dpr = this.container.clientWidth > 0 ? width / this.container.clientWidth : 1;
    const cssWidth = width / dpr;
    const cssHeight = height / dpr;

    // Pass 1: collect the indices of labeled nodes inside the viewport.
    this.candidateCount = 0;
    for (let index = 0; index < model.nodeCount; index++) {
      const label = model.nodeLabel[index];
      if (label === null || (model.flags[index] & (NODE_HIDDEN | NODE_DIM)) !== 0) {
        continue;
      }
      const screenX = (camera.zoom * (model.x[index] - camera.x) + width * 0.5) / dpr;
      const screenY = (camera.zoom * (model.y[index] - camera.y) + height * 0.5) / dpr;
      if (screenX < -margin || screenX > cssWidth + margin || screenY < -margin || screenY > cssHeight + margin) {
        continue;
      }
      if (this.candidateCount === this.candidates.length) {
        this.growCandidates();
      }
      this.candidates[this.candidateCount++] = index;
    }

    const cull = this.theme.labelCullOverlapping;
    if (cull) {
      this.candidates.subarray(0, this.candidateCount).sort(this.priority);
    }

    // Pass 2: place labels in priority order, skipping overlaps when culling.
    let used = 0;
    this.placedCount = 0;
    for (let candidate = 0; candidate < this.candidateCount && used < MAX_LABELS; candidate++) {
      const index = this.candidates[candidate];
      const label = model.nodeLabel[index] as string;
      const screenX = (camera.zoom * (model.x[index] - camera.x) + width * 0.5) / dpr;
      const screenY = (camera.zoom * (model.y[index] - camera.y) + height * 0.5) / dpr;
      const offset = (model.visualRadius[index] * camera.zoom) / dpr;
      let top = screenY;
      if (this.theme.labelPosition === 'above') {
        top -= offset + this.theme.labelOffset;
      } else if (this.theme.labelPosition === 'below') {
        top += offset + this.theme.labelOffset;
      }
      if (cull) {
        if (this.measureContext === undefined) {
          this.measureContext = createMeasureContext();
        }
        const halfWidth = measureTextWidth(this.theme, label, this.measureContext) / 2 + this.backgroundPaddingX() + LABEL_GAP;
        const halfHeight = (this.theme.labelSize * LABEL_LINE_HEIGHT) / 2 + this.backgroundPaddingY() + LABEL_GAP;
        const minX = screenX - halfWidth;
        const minY = top - halfHeight;
        if (this.overlapsPlaced(minX, minY, minX + halfWidth * 2, minY + halfHeight * 2)) {
          continue;
        }
        const slot = this.placedCount * 4;
        this.placedRects[slot] = minX;
        this.placedRects[slot + 1] = minY;
        this.placedRects[slot + 2] = minX + halfWidth * 2;
        this.placedRects[slot + 3] = minY + halfHeight * 2;
        this.placedCount++;
      }
      const element = this.acquire(used++);
      if (element.textContent !== label) {
        element.textContent = label;
      }
      element.style.display = '';
      element.style.transform = `translate3d(${screenX.toFixed(1)}px, ${top.toFixed(1)}px, 0) translate(-50%, -50%)`;
    }
    for (let index = used; index < this.activeCount; index++) {
      this.pool[index].style.display = 'none';
    }
    this.activeCount = used;
  }

  /** Returns a styled pool element, creating new ones only when needed. */
  private acquire(index: number): HTMLDivElement {
    if (index < this.pool.length) {
      return this.pool[index];
    }
    const element = document.createElement('div');
    Object.assign(element.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      whiteSpace: 'nowrap',
      willChange: 'transform',
      pointerEvents: 'none',
    } as CSSStyleDeclaration);
    element.style.font = `${this.theme.labelWeight} ${this.theme.labelSize}px ${this.theme.labelFont}`;
    element.style.color = this.theme.labelColor;
    if (this.theme.labelBackground) {
      element.style.background = this.theme.labelBackground;
      element.style.padding = `${this.theme.labelPadding[1]}px ${this.theme.labelPadding[0]}px`;
      element.style.borderRadius = `${this.theme.labelRadius}px`;
    }
    this.container.appendChild(element);
    this.pool.push(element);
    return element;
  }

  /** Horizontal clearance added to label rects from the themed padding. */
  private backgroundPaddingX(): number {
    return this.theme.labelBackground ? this.theme.labelPadding[0] : 0;
  }

  /** Vertical clearance added to label rects from the themed padding. */
  private backgroundPaddingY(): number {
    return this.theme.labelBackground ? this.theme.labelPadding[1] : 0;
  }

  /** Whether a label rect intersects any rect placed in this frame. */
  private overlapsPlaced(minX: number, minY: number, maxX: number, maxY: number): boolean {
    for (let rect = 0; rect < this.placedCount; rect++) {
      const slot = rect * 4;
      if (minX < this.placedRects[slot + 2] && maxX > this.placedRects[slot] && minY < this.placedRects[slot + 3] && maxY > this.placedRects[slot + 1]) {
        return true;
      }
    }
    return false;
  }

  /** Doubles candidate storage when more nodes than ever collected compete. */
  private growCandidates(): void {
    const next = new Int32Array(this.candidates.length * 2);
    next.set(this.candidates);
    this.candidates = next;
  }

  /** Hides every active label element. */
  private hideAll(): void {
    for (let index = 0; index < this.activeCount; index++) {
      this.pool[index].style.display = 'none';
    }
    this.activeCount = 0;
  }

  /** Removes all DOM elements and detaches the layer. */
  destroy(): void {
    for (const element of this.pool) {
      element.remove();
    }
    this.pool.length = 0;
    this.activeCount = 0;
    this.container.remove();
  }
}
