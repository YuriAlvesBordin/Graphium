/**
 * Maintains the 2D view transform as a cached 3x3 matrix and provides
 * coordinate conversion helpers for pointer math and label placement.
 */

export class Camera {
  width = 1;
  height = 1;
  x: number;
  y: number;
  zoom: number;
  minZoom: number;
  maxZoom: number;
  revision = 0;
  readonly matrix = new Float32Array(9);

  constructor(options: { width?: number; height?: number; x?: number; y?: number; zoom?: number; minZoom?: number; maxZoom?: number } = {}) {
    this.x = Number.isFinite(options.x) ? (options.x as number) : 0;
    this.y = Number.isFinite(options.y) ? (options.y as number) : 0;
    this.zoom = Number.isFinite(options.zoom) ? (options.zoom as number) : 1;
    this.minZoom = options.minZoom ?? 0.02;
    this.maxZoom = options.maxZoom ?? 80;
    this.updateMatrix();
  }

  /** Recomputes the cached view matrix after any transform change. */
  private updateMatrix(): void {
    const sx = (2 * this.zoom) / this.width;
    const sy = (-2 * this.zoom) / this.height;
    this.matrix[0] = sx;
    this.matrix[1] = 0;
    this.matrix[2] = 0;
    this.matrix[3] = 0;
    this.matrix[4] = sy;
    this.matrix[5] = 0;
    this.matrix[6] = -sx * this.x;
    this.matrix[7] = -sy * this.y;
    this.matrix[8] = 1;
    this.revision++;
  }

  /** Resizes the viewport and refreshes the view matrix. */
  setViewport(width: number, height: number): this {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.updateMatrix();
    return this;
  }

  /** Moves the camera center to a world position. */
  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    this.updateMatrix();
    return this;
  }

  /** Sets the zoom level clamped between the configured limits. */
  setZoom(zoom: number): this {
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    this.updateMatrix();
    return this;
  }

  /** Pans the view by a screen pixel delta. */
  pan(dx: number, dy: number): this {
    this.x += dx / this.zoom;
    this.y += dy / this.zoom;
    this.updateMatrix();
    return this;
  }

  /** Zooms while keeping the supplied screen point visually anchored. */
  zoomAt(factor: number, screenX: number, screenY: number): this {
    const beforeX = this.x + (screenX - this.width * 0.5) / this.zoom;
    const beforeY = this.y + (screenY - this.height * 0.5) / this.zoom;
    this.setZoom(this.zoom * factor);
    this.x = beforeX - (screenX - this.width * 0.5) / this.zoom;
    this.y = beforeY - (screenY - this.height * 0.5) / this.zoom;
    this.updateMatrix();
    return this;
  }

  /** Converts world coordinates into screen pixels. */
  worldToScreen(worldX: number, worldY: number, out: { x: number; y: number }): { x: number; y: number } {
    out.x = this.zoom * (worldX - this.x) + this.width * 0.5;
    out.y = this.zoom * (worldY - this.y) + this.height * 0.5;
    return out;
  }

  /** Converts screen pixels into world coordinates. */
  screenToWorld(screenX: number, screenY: number, out: { x: number; y: number }): { x: number; y: number } {
    out.x = this.x + (screenX - this.width * 0.5) / this.zoom;
    out.y = this.y + (screenY - this.height * 0.5) / this.zoom;
    return out;
  }

  /** Positions and scales the camera so a world rectangle fits the view. */
  fit(minX: number, minY: number, maxX: number, maxY: number, padding = 40): this {
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const availableWidth = Math.max(1, this.width - padding * 2);
    const availableHeight = Math.max(1, this.height - padding * 2);
    this.x = (minX + maxX) * 0.5;
    this.y = (minY + maxY) * 0.5;
    this.setZoom(Math.min(availableWidth / width, availableHeight / height));
    return this;
  }
}
