/**
 * Maintains the 2D view transform as a cached 3x3 matrix and provides
 * coordinate conversion helpers for pointer math and label placement.
 */

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

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

  private bounds: Bounds | null = null;

  constructor(options: { width?: number; height?: number; x?: number; y?: number; zoom?: number; minZoom?: number; maxZoom?: number } = {}) {
    this.x = Number.isFinite(options.x) ? (options.x as number) : 0;
    this.y = Number.isFinite(options.y) ? (options.y as number) : 0;
    this.zoom = Number.isFinite(options.zoom) ? (options.zoom as number) : 1;
    this.minZoom = options.minZoom ?? 0.02;
    this.maxZoom = options.maxZoom ?? 80;
    this.updateMatrix();
  }

  /** Defines a bounding area (in world coordinates) that restricts the camera. */
  setBounds(minX: number, minY: number, maxX: number, maxY: number): this {
    this.bounds = { minX, minY, maxX, maxY };
    this.clampPosition();
    this.updateMatrix();
    return this;
  }

  /** Removes the bounding area, restoring free panning. */
  clearBounds(): this {
    this.bounds = null;
    return this;
  }

  /** Returns the current bounding area, or null when none is set. */
  getBounds(): Bounds | null {
    return this.bounds;
  }

  /** Clamps the camera position so the bounded content stays inside the viewport. */
  private clampPosition(): void {
    const bounds = this.bounds;
    if (!bounds) {
      return;
    }
    const { minX, minY, maxX, maxY } = bounds;
    const viewWidth = this.width / this.zoom;
    const viewHeight = this.height / this.zoom;

    const halfWidth = viewWidth * 0.5;
    if (maxX - minX > viewWidth) {
      // O conteúdo é maior que a tela: limita o pan para não mostrar
      // área vazia além dos extremos do conteúdo.
      this.x = Math.max(minX + halfWidth, Math.min(maxX - halfWidth, this.x));
    } else {
      // O conteúdo cabe na tela: o pan continua livre, mas o centro do
      // conteúdo nunca sai da metade central da viewport, então pelo menos
      // metade dele permanece visível. Recentralizar por conta própria
      // criaria um loop de feedback com bounds que acompanham os nós em
      // movimento; centralizar é responsabilidade de fit()/centerOn().
      const centerX = (minX + maxX) * 0.5;
      this.x = Math.max(centerX - halfWidth, Math.min(centerX + halfWidth, this.x));
    }

    const halfHeight = viewHeight * 0.5;
    if (maxY - minY > viewHeight) {
      this.y = Math.max(minY + halfHeight, Math.min(maxY - halfHeight, this.y));
    } else {
      const centerY = (minY + maxY) * 0.5;
      this.y = Math.max(centerY - halfHeight, Math.min(centerY + halfHeight, this.y));
    }
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
    this.clampPosition();
    this.updateMatrix();
    return this;
  }

  /** Moves the camera center to a world position. */
  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    this.clampPosition();
    this.updateMatrix();
    return this;
  }

  /** Sets the zoom level clamped between the configured limits. */
  setZoom(zoom: number): this {
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    this.clampPosition();
    this.updateMatrix();
    return this;
  }

  /** Pans the view by a screen pixel delta. */
  pan(dx: number, dy: number): this {
    this.x += dx / this.zoom;
    this.y += dy / this.zoom;
    this.clampPosition();
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
    this.clampPosition();
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
    this.clampPosition();
    return this;
  }
}
