/**
 * Renders node labels as a pooled set of DOM elements positioned over the
 * canvas. The pool keeps at most a fixed number of elements alive, updates
 * transforms without layout thrash and hides labels below a zoom threshold.
 *
 * Every node can override its own label styling (`labelSize`, `labelScale`,
 * `labelColor`, `labelWeight`, `labelFont`, `labelBackground`); unset fields
 * fall back to the theme, so the theme stays the global default.
 */

import { GraphModel, NODE_DIM, NODE_HIDDEN } from '../core/GraphModel.js';
import type { ThemeResolved } from '../core/types.js';
import { Camera } from './Camera.js';

const MAX_LABELS = 400;

export class LabelLayer {
  container: HTMLDivElement;
  theme: ThemeResolved;
  minZoom = 0.3;

  private model: GraphModel | null = null;
  private camera: Camera | null = null;
  private pool: HTMLDivElement[] = [];
  private activeCount = 0;
  private screen = { x: 0, y: 0 };
  private styleKeys: string[] = [];

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
    // Pool styles were reset: force per-node styles to reapply next update.
    this.styleKeys.length = 0;
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
    let used = 0;
    const width = camera.width;
    const height = camera.height;
    // camera dimensions are drawing-buffer pixels; DOM transforms are CSS pixels
    const dpr = this.container.clientWidth > 0 ? width / this.container.clientWidth : 1;
    const cssWidth = width / dpr;
    const cssHeight = height / dpr;
    for (let index = 0; index < model.nodeCount && used < MAX_LABELS; index++) {
      const label = model.nodeLabel[index];
      if (label === null || (model.flags[index] & (NODE_HIDDEN | NODE_DIM)) !== 0) {
        continue;
      }
      const screenX = (camera.zoom * (model.x[index] - camera.x) + width * 0.5) / dpr;
      const screenY = (camera.zoom * (model.y[index] - camera.y) + height * 0.5) / dpr;
      if (screenX < -margin || screenX > cssWidth + margin || screenY < -margin || screenY > cssHeight + margin) {
        continue;
      }
      const slot = used;
      const element = this.acquire(used++);
      const offset = (model.visualRadius[index] * camera.zoom) / dpr;
      let top = screenY;
      if (this.theme.labelPosition === 'above') {
        top -= offset + this.theme.labelOffset;
      } else if (this.theme.labelPosition === 'below') {
        top += offset + this.theme.labelOffset;
      }
      if (element.textContent !== label) {
        element.textContent = label;
      }
      element.style.display = '';
      element.style.transform = `translate3d(${screenX.toFixed(1)}px, ${top.toFixed(1)}px, 0) translate(-50%, -50%)`;
      this.applyNodeStyle(element, slot, model, index);
    }
    for (let index = used; index < this.activeCount; index++) {
      this.pool[index].style.display = 'none';
    }
    this.activeCount = used;
  }

  /** Applies one node's effective label style when it differs from the pool slot. */
  private applyNodeStyle(element: HTMLDivElement, slot: number, model: GraphModel, index: number): void {
    const size = (model.nodeLabelSize[index] || this.theme.labelSize) * (model.nodeLabelScale[index] || 1);
    const weight = model.nodeLabelWeight[index] ?? this.theme.labelWeight;
    const family = model.nodeLabelFont[index] ?? this.theme.labelFont;
    const font = `${weight} ${size}px ${family}`;
    const color = model.nodeLabelColor[index] ?? this.theme.labelColor;
    const background = model.nodeLabelBackground[index];
    const styleKey = `${font}\u0000${color}\u0000${background ?? ''}`;
    if (this.styleKeys[slot] === styleKey) {
      return;
    }
    this.styleKeys[slot] = styleKey;
    element.style.fontWeight = String(weight);
    element.style.fontSize = `${size}px`;
    element.style.fontFamily = family;
    element.style.color = color;
    if (background === null) {
      element.style.background = 'none';
      element.style.padding = '0';
      return;
    }
    const themed = background ?? this.theme.labelBackground;
    if (themed) {
      element.style.background = themed;
      element.style.padding = `${this.theme.labelPadding[1]}px ${this.theme.labelPadding[0]}px`;
      element.style.borderRadius = `${this.theme.labelRadius}px`;
    } else {
      element.style.background = 'none';
      element.style.padding = '0';
    }
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
    this.styleKeys.length = 0;
    this.activeCount = 0;
    this.container.remove();
  }
}
