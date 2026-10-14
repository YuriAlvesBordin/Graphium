/**
 * Owns view framing and navigation: fitting the graph, centering, zooming,
 * resizing the renderer to the canvas and screen to world conversion.
 */

import type { GraphModel } from '../core/GraphModel.js';
import type { Camera } from './Camera.js';
import type { Renderer } from './Renderer.js';

/** Collaborators the viewport control needs from the main facade. */
export interface ViewportDeps {
  model: GraphModel;
  camera: Camera;
  renderer: Renderer;
  invalidate: () => void;
}

export class ViewportController {
  constructor(private readonly deps: ViewportDeps) {}

  /** Scales the view so the whole graph fits with padding. */
  fit(padding = 60): void {
    const model = this.deps.model;
    if (model.nodeCount === 0) {
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let index = 0; index < model.nodeCount; index++) {
      const radius = model.visualRadius[index];
      minX = Math.min(minX, model.x[index] - radius);
      minY = Math.min(minY, model.y[index] - radius);
      maxX = Math.max(maxX, model.x[index] + radius);
      maxY = Math.max(maxY, model.y[index] + radius);
    }
    this.deps.camera.fit(minX, minY, maxX, maxY, padding);
    this.deps.invalidate();
  }

  /** Centers the view on a world point. */
  centerOn(x: number, y: number): void {
    this.deps.camera.setPosition(x, y);
    this.deps.invalidate();
  }

  /** Multiplies the current zoom level. */
  zoomBy(factor: number): void {
    this.deps.camera.setZoom(this.deps.camera.zoom * factor);
    this.deps.invalidate();
  }

  /** Sets an absolute zoom level. */
  zoomTo(zoom: number): void {
    this.deps.camera.setZoom(zoom);
    this.deps.invalidate();
  }

  /** Resizes the renderer to the canvas client size. */
  resize(): void {
    const canvas = this.deps.renderer.canvas;
    const width = canvas.clientWidth || canvas.width || 1;
    const height = canvas.clientHeight || canvas.height || 1;
    this.deps.renderer.resize(width, height, window.devicePixelRatio || 1);
    this.deps.invalidate();
  }

  /** Returns the world position under a screen position. */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return this.deps.camera.screenToWorld(screenX, screenY, { x: 0, y: 0 });
  }
}
