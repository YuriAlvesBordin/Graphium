import { NODE_DRAGGED, NODE_SELECTED } from '../core/GraphModel.js';

export class PointerController {
  /** @param {HTMLElement|HTMLCanvasElement} element @param {import('../render/Camera2D.js').Camera2D} camera @param {import('../core/GraphModel.js').GraphModel} model @param {import('../physics/SpatialHash2D.js').SpatialHash2D} spatialHash @param {Record<string, any>} [options] */
  constructor(element, camera, model, spatialHash, options = {}) {
    this.element = element;
    this.camera = camera;
    this.model = model;
    this.spatialHash = spatialHash;
    this.options = {
      enableInertia: false,
      wheelZoomSpeed: 1.12,
      dragThreshold: 4,
      longPressMs: 550,
      linkHitRadius: 7,
      pickLink: null,
      ...options,
    };
    this.callbacks = new Map();
    this.pointers = new Map();
    this.primaryPointerId = -1;
    this.dragNode = -1;
    this.activeLink = -1;
    this.isPanning = false;
    this.downX = 0;
    this.downY = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.moved = false;
    this.longPressTimer = 0;
    this.enabled = false;
    this.pickBuffer = new Int32Array(Math.max(64, model.nodeCapacity));
    this._world = new Float32Array(2);
    this._boundDown = event => this._onPointerDown(event);
    this._boundMove = event => this._onPointerMove(event);
    this._boundUp = event => this._onPointerUp(event);
    this._boundCancel = event => this._onPointerUp(event);
    this._boundWheel = event => this._onWheel(event);
    this._boundContext = event => {
      event.preventDefault();
      this._emit('contextmenu', event, -1);
    };
    this.enable();
  }

  on(type, callback) {
    if (!this.callbacks.has(type)) {
      this.callbacks.set(type, []);
    }
    this.callbacks.get(type).push(callback);
    return () => this.off(type, callback);
  }
  off(type, callback) {
    const list = this.callbacks.get(type);
    if (!list) {
      return this;
    }
    const index = list.indexOf(callback);
    if (index >= 0) {
      list.splice(index, 1);
    }
    return this;
  }
  _emit(type, event, nodeIndex = -1, extra = undefined) {
    const list = this.callbacks.get(type);
    if (!list) {
      return;
    }
    const linkIndex = extra?.linkIndex ?? -1;
    for (let i = 0; i < list.length; i++) {
      list[i]({
        type,
        originalEvent: event,
        nodeIndex,
        nodeId: nodeIndex >= 0 ? this.model.getNodeId(nodeIndex) : undefined,
        linkIndex,
        linkId: linkIndex >= 0 ? this.model.getLinkId(linkIndex) : undefined,
        worldX: this._world[0],
        worldY: this._world[1],
        ...extra,
      });
    }
  }

  _position(event) {
    const rect = this.element.getBoundingClientRect();
    const scaleX = this.camera.width / Math.max(1, rect.width);
    const scaleY = this.camera.height / Math.max(1, rect.height);
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    this.camera.screenToWorld2D(x, y, this._world);
    return { x, y };
  }
  _pick(worldX, worldY) {
    if (this.pickBuffer.length < this.model.nodeCount) {
      this.pickBuffer = new Int32Array(this.model.nodeCount * 2);
    }
    return this.spatialHash.pickNodeInto(worldX, worldY, this.model.x, this.model.y, this.model.visualRadius, this.pickBuffer);
  }
  _pickLink(worldX, worldY) {
    return typeof this.options.pickLink === 'function' ? this.options.pickLink(worldX, worldY, this.options.linkHitRadius) : -1;
  }
  _onPointerDown(event) {
    const position = this._position(event);
    this.pointers.set(event.pointerId, { x: position.x, y: position.y });
    if (this.primaryPointerId < 0) {
      this.primaryPointerId = event.pointerId;
      this.downX = position.x;
      this.downY = position.y;
      this.lastX = position.x;
      this.lastY = position.y;
      this.moved = false;
    }

    if (this.pointers.size === 1) {
      const node = this._pick(this._world[0], this._world[1]);
      if (node >= 0 && event.button !== 2) {
        this.dragNode = node;
        this.model.flags[node] |= NODE_DRAGGED | NODE_SELECTED;
        this.model.setNodeState(node, 'dragging');
        this._emit('pointerdown', event, node);
      } else {
        this.dragNode = -1;
        this.activeLink = this._pickLink(this._world[0], this._world[1]);
        this.isPanning = this.activeLink < 0;
        this._emit('pointerdown', event, -1, { linkIndex: this.activeLink });
      }
      clearTimeout(this.longPressTimer);
      this.longPressTimer = setTimeout(() => {
        if (!this.moved) {
          this._emit('longpress', event, this.dragNode);
        }
      }, this.options.longPressMs);
    } else if (this.pointers.size === 2) {
      this.isPanning = false;
      this.dragNode = -1;
      clearTimeout(this.longPressTimer);
      const values = Array.from(this.pointers.values());
      this.pinchDistance = Math.hypot(values[1].x - values[0].x, values[1].y - values[0].y);
      this.pinchCenterX = (values[0].x + values[1].x) * 0.5;
      this.pinchCenterY = (values[0].y + values[1].y) * 0.5;
    }

    if (this.element.setPointerCapture) {
      this.element.setPointerCapture(event.pointerId);
    }
  }

  _onPointerMove(event) {
    const position = this._position(event);
    const pointer = this.pointers.get(event.pointerId);
    if (!pointer) {
      return;
    }
    const dx = position.x - pointer.x;
    const dy = position.y - pointer.y;
    pointer.x = position.x;
    pointer.y = position.y;
    if (Math.hypot(position.x - this.downX, position.y - this.downY) > this.options.dragThreshold) {
      this.moved = true;
      clearTimeout(this.longPressTimer);
    }

    if (this.pointers.size >= 2) {
      const values = Array.from(this.pointers.values());
      const distance = Math.hypot(values[1].x - values[0].x, values[1].y - values[0].y);
      const centerX = (values[0].x + values[1].x) * 0.5;
      const centerY = (values[0].y + values[1].y) * 0.5;
      if (this.pinchDistance > 0) {
        this.camera.zoomAt(distance / this.pinchDistance, centerX, centerY);
      }
      this.camera.pan(this.pinchCenterX - centerX, this.pinchCenterY - centerY);
      this.pinchDistance = distance;
      this.pinchCenterX = centerX;
      this.pinchCenterY = centerY;
      this._emit('pinch', event, -1);
      return;
    }

    if (this.dragNode >= 0) {
      this.camera.screenToWorld2D(position.x, position.y, this._world);
      this.model.setNodePosition(this.dragNode, this._world[0], this._world[1], true);
      this._emit('drag', event, this.dragNode);
    } else if (this.isPanning) {
      this.camera.pan(-dx, -dy);
      this._emit('pan', event, -1);
    }
    const hoveredNode = this.dragNode >= 0 ? this.dragNode : this._pick(this._world[0], this._world[1]);
    const hoveredLink = hoveredNode >= 0 ? -1 : this._pickLink(this._world[0], this._world[1]);
    this._emit('hover', event, hoveredNode, { linkIndex: hoveredLink });
  }

  _onPointerUp(event) {
    const position = this._position(event);
    this.pointers.delete(event.pointerId);
    clearTimeout(this.longPressTimer);
    if (this.dragNode >= 0) {
      const node = this.dragNode;
      this.model.flags[node] &= ~NODE_DRAGGED;
      this.model.setNodeState(node, 'selected');
      this._emit('dragend', event, node);
      if (!this.moved) {
        this._emit('click', event, node);
      }
      this.dragNode = -1;
    } else if (this.activeLink >= 0) {
      if (!this.moved) {
        this._emit('click', event, -1, { linkIndex: this.activeLink });
      }
      this.activeLink = -1;
    } else if (this.isPanning) {
      this.isPanning = false;
      if (!this.moved) {
        this._emit('click', event, -1);
      }
    }

    if (this.pointers.size === 0) {
      this.primaryPointerId = -1;
    }

    if (this.element.releasePointerCapture) {
      try {
        this.element.releasePointerCapture(event.pointerId);
      } catch {}
    }
    this._emit('pointerup', event, -1);
    this.camera.screenToWorld2D(position.x, position.y, this._world);
  }

  _onWheel(event) {
    event.preventDefault();
    const p = this._position(event);
    this.camera.zoomAt(event.deltaY < 0 ? this.options.wheelZoomSpeed : 1 / this.options.wheelZoomSpeed, p.x, p.y);
    this._emit('zoom', event, -1);
  }

  enable() {
    if (this.enabled || !this.element?.addEventListener) {
      return this;
    }
    this.enabled = true;
    this.element.addEventListener('pointerdown', this._boundDown);
    this.element.addEventListener('pointermove', this._boundMove);
    this.element.addEventListener('pointerup', this._boundUp);
    this.element.addEventListener('pointercancel', this._boundCancel);
    this.element.addEventListener('wheel', this._boundWheel, { passive: false });
    this.element.addEventListener('contextmenu', this._boundContext);
    return this;
  }
  disable() {
    if (!this.enabled) {
      return this;
    }
    this.enabled = false;
    this.element.removeEventListener('pointerdown', this._boundDown);
    this.element.removeEventListener('pointermove', this._boundMove);
    this.element.removeEventListener('pointerup', this._boundUp);
    this.element.removeEventListener('pointercancel', this._boundCancel);
    this.element.removeEventListener('wheel', this._boundWheel);
    this.element.removeEventListener('contextmenu', this._boundContext);
    clearTimeout(this.longPressTimer);
    return this;
  }
  destroy() {
    this.disable();
    this.pointers.clear();
    this.callbacks.clear();
  }
}
