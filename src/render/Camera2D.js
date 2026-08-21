export class Camera2D {
  /**
   * @brief Constructs a new Camera2D.
   * @param options Camera configuration options including zoom limits and initial viewport.
   */
  constructor(options = {}) {
    this.width = Math.max(1, options.width || 1);
    this.height = Math.max(1, options.height || 1);
    this.x = Number.isFinite(options.x) ? options.x : 0;
    this.y = Number.isFinite(options.y) ? options.y : 0;
    this.zoom = Number.isFinite(options.zoom) ? options.zoom : 1;
    this.minZoom = Number.isFinite(options.minZoom) ? options.minZoom : 0.02;
    this.maxZoom = Number.isFinite(options.maxZoom) ? options.maxZoom : 80;
    this.matrix = new Float32Array(9);
    this.inverseMatrix = new Float32Array(9);
    this.revision = 0;
    this._updateMatrices();
  }

  _updateMatrices() {
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
    this.inverseMatrix[0] = 1 / sx;
    this.inverseMatrix[1] = 0;
    this.inverseMatrix[2] = 0;
    this.inverseMatrix[3] = 0;
    this.inverseMatrix[4] = 1 / sy;
    this.inverseMatrix[5] = 0;
    this.inverseMatrix[6] = this.x;
    this.inverseMatrix[7] = this.y;
    this.inverseMatrix[8] = 1;
    this.revision++;
  }

  setViewport(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this._updateMatrices();
    return this;
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this._updateMatrices();
    return this;
  }
  setZoom(zoom) {
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    this._updateMatrices();
    return this;
  }
  pan(dx, dy) {
    this.x += dx / this.zoom;
    this.y += dy / this.zoom;
    this._updateMatrices();
    return this;
  }

  /**
   * @brief Zooms the camera while keeping a specific screen point fixed.
   * @param factor The zoom multiplier.
   * @param screenX The fixed screen X coordinate.
   * @param screenY The fixed screen Y coordinate.
   * @return The current Camera2D instance.
   */
  zoomAt(factor, screenX, screenY) {
    const beforeX = this.x + (screenX - this.width * 0.5) / this.zoom;
    const beforeY = this.y + (screenY - this.height * 0.5) / this.zoom;
    this.setZoom(this.zoom * factor);
    this.x = beforeX - (screenX - this.width * 0.5) / this.zoom;
    this.y = beforeY - (screenY - this.height * 0.5) / this.zoom;
    this._updateMatrices();
    return this;
  }

  /**
   * @brief Projects a world coordinate to a screen coordinate.
   * @param worldX The world X coordinate.
   * @param worldY The world Y coordinate.
   * @param out Optional array to store the result.
   * @return The projected screen coordinates.
   */
  worldToScreen2D(worldX, worldY, out) {
    const result = out || { x: 0, y: 0 };
    const sx = this.zoom * (worldX - this.x) + this.width * 0.5;
    const sy = this.zoom * (worldY - this.y) + this.height * 0.5;
    if (Array.isArray(result) || ArrayBuffer.isView(result)) {
      result[0] = sx;
      result[1] = sy;
    } else {
      result.x = sx;
      result.y = sy;
    }
    return result;
  }

  /**
   * @brief Unprojects a screen coordinate to a world coordinate.
   * @param screenX The screen X coordinate.
   * @param screenY The screen Y coordinate.
   * @param out Optional array to store the result.
   * @return The unprojected world coordinates.
   */
  screenToWorld2D(screenX, screenY, out) {
    const result = out || { x: 0, y: 0 };
    const wx = this.x + (screenX - this.width * 0.5) / this.zoom;
    const wy = this.y + (screenY - this.height * 0.5) / this.zoom;
    if (Array.isArray(result) || ArrayBuffer.isView(result)) {
      result[0] = wx;
      result[1] = wy;
    } else {
      result.x = wx;
      result.y = wy;
    }
    return result;
  }

  fit(minX, minY, maxX, maxY, padding = 40) {
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
