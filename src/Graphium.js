import {
  GraphModel,
  NODE_FIXED,
  NODE_SELECTED,
  NODE_DRAGGED,
  LINK_SELECTED,
  NODE_STATE_NORMAL,
  NODE_STATE_HOVER,
  NODE_STATE_SELECTED,
  NODE_STATE_DRAGGING,
  NODE_STATE_FIXED,
  NODE_STATE_DISABLED,
  NODE_HIDDEN,
  LINK_STYLE_SOLID,
  LINK_STYLE_DASHED,
  packRGBA,
  unpackRGBA,
  deterministicNodeColor,
} from './core/GraphModel.js';
import { SpatialHash2D } from './physics/SpatialHash2D.js';
import { Physics2D } from './physics/Physics2D.js';
import { EdgeBundling2D, SegmentGrid } from './physics/EdgeBundling2D.js';
import { EdgeConflictDetector2D } from './physics/EdgeConflict2D.js';
import { Coarsening2D } from './physics/Coarsening2D.js';
import { Camera2D } from './render/Camera2D.js';
import { WebGLRenderer2D } from './render/WebGLRenderer2D.js';
import { PointerController } from './interaction/PointerController.js';

const DEFAULTS = {
  autoStart: false,
  nodeCapacity: 256,
  linkCapacity: 512,
  physics: {},
  edgeBundling: false,
  bundleMode: 'geometric',
  bundleStrength: 0.35,
  bundleIterations: 3,
  bundleSubdivisions: 6,
  bundleCompatibility: 0.65,
  bundleRadius: 180,
  nodeSeparationLength: 50,
  maxBundleSize: 32,
  maxBundlePairs: 10000,
  preserveEdgeStyle: true,
  preserveEdgeIdentity: true,
  avoidNodeInteriors: true,
  bundleShortEdges: false,
  bundleRenderMode: 'parallel',
  camera: {},
  renderer: {},
  renderLabels: true,
  labelPosition: 'below',
  labelOffset: 0,
  appearance: {
    nodeRadius: 8,
    nodeVisualRadius: undefined,
    nodeBorderEnabled: true,
    nodeBorderWidth: 0,
    nodeBorderColor: '#ffffff',
    nodeBorderOpacity: 1,
    nodeOpacity: 1,
    edgeWidth: 1.25,
    edgeColor: '#8b949e',
    edgeOpacity: 0.72,
    edgeCap: 'round',
    edgeJoin: 'round',
    hoverRingColor: '#007aff',
    hoverRingWidth: 2,
    selectedRingColor: '#ff9f0a',
    selectedRingWidth: 3,
    fixedRingColor: '#64748b',
    fixedRingWidth: 1.5,
    draggingOpacity: 1,
    disabledOpacity: 0.45,
    selectedEdgeColor: '#007aff',
    selectedEdgeWidthMultiplier: 1.8,
    selectedEdgeOpacity: 1,
  },
  interaction: true,
};

export class Graphium {
  /**
   * @brief Constructs the main Graphium facade.
   * @param options Configuration options covering bundling, physics, camera, renderer, and interaction.
   */
  constructor(options = {}) {
    this.options = {
      ...DEFAULTS,
      ...options,
      physics: { ...DEFAULTS.physics, ...(options.physics || {}) },
      camera: { ...DEFAULTS.camera, ...(options.camera || {}) },
      renderer: { ...DEFAULTS.renderer, ...(options.renderer || {}) },
      appearance: { ...DEFAULTS.appearance, ...(options.appearance || {}) },
    };
    this.model = new GraphModel({
      nodeCapacity: this.options.nodeCapacity,
      linkCapacity: this.options.linkCapacity,
      nodeDefaults: {
        radius: this.options.appearance.nodeRadius,
        visualRadius: this.options.appearance.nodeVisualRadius,
        borderWidth: this.options.appearance.nodeBorderEnabled ? this.options.appearance.nodeBorderWidth : 0,
        borderColor: this.options.appearance.nodeBorderColor,
        borderOpacity: this.options.appearance.nodeBorderOpacity,
        opacity: this.options.appearance.nodeOpacity,
      },
      linkDefaults: {
        width: this.options.appearance.edgeWidth,
        color: this.options.appearance.edgeColor,
        opacity: this.options.appearance.edgeOpacity,
      },
    });
    this.spatialHash = new SpatialHash2D({
      cellSize: this.options.physics.repulsionRadius || 180,
      nodeCapacity: this.options.nodeCapacity,
    });
    this.physics = new Physics2D(this.model, this.spatialHash, this.options.physics);
    this.camera = new Camera2D(this.options.camera);
    this.renderer = new WebGLRenderer2D(this.options.canvas || null, {
      ...this.options.renderer,
      appearance: this.options.appearance,
    });
    this.renderer.setCamera(this.camera);

    this.labelContainer = document.createElement('div');
    Object.assign(this.labelContainer.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      userSelect: 'none',
      zIndex: '10'
    });
    const parent = this.options.canvas?.parentNode ?? document.body;
    if (parent) {
      parent.style.position = parent.style.position || 'relative';
      parent.appendChild(this.labelContainer);
    }
    this._labelElements = new Map();

    this.bundling = new EdgeBundling2D(this.model, this.options);
    this.physics.setRouteProvider(this.bundling);
    this.events = new Map();
    this.running = false;
    this.destroyed = false;
    this._raf = 0;
    this._lastTime = 0;
    this._cameraMoving = false;
    this._lastRenderedBundleRevision = -1;
    this.pointer = null;
    if (this.options.canvas && this.options.interaction) {
      this.pointer = new PointerController(this.options.canvas, this.camera, this.model, this.spatialHash, {
        ...(this.options.interaction === true ? {} : this.options.interaction),
        pickLink: (worldX, worldY, radius) => this.pickLinkAt(worldX, worldY, radius),
      });
    }
    this._wireEvents();
    if (this.options.autoStart) {
      this.start();
    }
  }

  _createLabelElement(nodeId, text) {
    const div = document.createElement('div');
    div.className = 'g2d-label';
    div.textContent = text ?? '';
    Object.assign(div.style, {
      position: 'absolute',
      font: '12px sans-serif',
      color: '#fff',
      transform: 'translate(-50%, -50%)',
      whiteSpace: 'nowrap'
    });
    return div;
  }

  _updateLabelPositions() {
    if (!this.options.renderLabels || !this.camera) return;

    for (const [nodeId, el] of this._labelElements) {
      const idx = this.model.getNodeIndex(nodeId);
      if (idx < 0 || (this.model.flags[idx] & NODE_HIDDEN)) {
        el.style.display = 'none';
        continue;
      }

      const worldX = this.model.x[idx];
      const worldY = this.model.y[idx];
      const radius = this.model.visualRadius[idx];
      const screenPos = this.camera.worldToScreen2D(worldX, worldY);
      const screenRadius = radius * this.camera.zoom;
      const offset = this.options.labelOffset ?? 0;

      let offsetY = 0;
      switch (this.options.labelPosition) {
        case 'above': offsetY = -(screenRadius + offset); break;
        case 'below': offsetY =  screenRadius + offset; break;
        case 'center': offsetY = 0; break;
      }

      el.style.display = '';
      el.style.left = `${screenPos.x}px`;
      el.style.top  = `${screenPos.y + offsetY}px`;
    }
  }

  _manageLabelOnAdd(nodeId, labelText) {
    if (!this.options.renderLabels) return;
    if (labelText === null || labelText === undefined) return;
    const el = this._createLabelElement(nodeId, labelText);
    this.labelContainer.appendChild(el);
    this._labelElements.set(nodeId, el);
  }

  _manageLabelOnRemove(nodeId) {
    const el = this._labelElements.get(nodeId);
    if (el) {
      el.remove();
      this._labelElements.delete(nodeId);
    }
  }

  _manageLabelOnAppearanceChange(nodeId, newLabel) {
    const el = this._labelElements.get(nodeId);
    if (el) {
      el.textContent = newLabel ?? '';
      if (newLabel === null || newLabel === undefined) {
        this._manageLabelOnRemove(nodeId);
      }
    }
  }

  _wireEvents() {
    this.physics.onSleep = energy => this.emit('sleep', { energy });
    this.physics.onWake = () => this.emit('wake');
    this.physics.onEdgeConflict = (edgeA, edgeB, type, severity, distance, angle) => {
      if (!this.physics.options.edgeConflictEvents) {
        return;
      }
      this.emit('edgeconflict', {
        edgeAId: this.model.getLinkId(edgeA),
        edgeBId: this.model.getLinkId(edgeB),
        edgeAIndex: edgeA,
        edgeBIndex: edgeB,
        type,
        severity,
        distance,
        angle,
      });
    };
    this.physics.onEdgeConflictSolved = energy => this.emit('edgeconflictsolved', { energy });
    this.bundling.onUpdated = revision => this.emit('bundleupdated', { revision });
    if (this.pointer) {
      const forward = ['click', 'dblclick', 'hover', 'longpress', 'contextmenu', 'drag', 'dragend', 'pan', 'zoom', 'pinch', 'pointerdown', 'pointerup'];
      for (let i = 0; i < forward.length; i++) {
        this.pointer.on(forward[i], event => {
          this.physics.wake();
          this._cameraMoving = event.type === 'pan' || event.type === 'zoom' || event.type === 'pinch';
          if (event.type === 'hover') {
            this._setHoveredNode(event.nodeIndex ?? -1);
          }

          if (event.type === 'click' && event.linkIndex >= 0) {
            this.selectLink(event.linkIndex, true);
          }
          this.emit(event.type, event);
        });
      }
    }
  }

  on(type, callback) {
    if (!this.events.has(type)) {
      this.events.set(type, []);
    }
    this.events.get(type).push(callback);
    return () => this.off(type, callback);
  }
  off(type, callback) {
    const list = this.events.get(type);
    if (!list) {
      return this;
    }
    const index = list.indexOf(callback);
    if (index >= 0) {
      list.splice(index, 1);
    }
    return this;
  }
  emit(type, payload) {
    const list = this.events.get(type);
    if (!list) {
      return this;
    }
    for (let i = 0; i < list.length; i++) {
      list[i](payload);
    }
    return this;
  }

  /**
   * @brief Adds or updates a node.
   * @param id The unique external ID of the node.
   * @param options Node properties (x, y, radius, mass, color, opacity, fixed).
   * @return A snapshot of the created or updated node.
   */
  addNode(id, options = {}) {
    const data = typeof id === 'object' && id !== null ? id : { ...options, id };
    if (data.id === undefined || data.id === null) {
      throw new Error('Graphium node requires an id.');
    }
    const index = this.model.addNode(data.id, data);
    this.bundling.markDirty();
    this.physics.wake();
    this._manageLabelOnAdd(data.id, data.label);
    return this.model.getNodeSnapshot(index);
  }

  /**
   * @brief Adds or updates a link.
   * @param id The unique external ID of the link.
   * @param source The external ID of the source node.
   * @param target The external ID of the target node.
   * @param options Link properties (restLength, strength, width, color, opacity).
   * @return A snapshot of the created or updated link.
   */
  addLink(id, source, target, options = {}) {
    const data = typeof id === 'object' && id !== null ? id : { ...options, id, source, target };
    if (data.source === undefined || data.target === undefined) {
      throw new Error('Graphium link requires source and target IDs.');
    }
    const linkId = data.id ?? `${String(data.source)}:${String(data.target)}:${this.model.linkCount}`;
    const index = this.model.addLink(linkId, data.source, data.target, data);
    this.bundling.markDirty();
    this.physics.wake();
    return this.model.getLinkSnapshot(index);
  }
  removeNode(id) {
    const result = this.model.removeNode(id);
    if (result) {
      this.bundling.markDirty();
      this.physics.wake();
      this._manageLabelOnRemove(id);
    }
    return result;
  }
  removeLink(id) {
    const result = this.model.removeLink(id);
    if (result) {
      this.bundling.markDirty();
      this.physics.wake();
    }
    return result;
  }
  setData(data) {
    this.model.setData(data);
    this.bundling.markDirty();
    this.physics.reset();
    this.emit('dataupdated', { nodeCount: this.model.nodeCount, linkCount: this.model.linkCount });
    return this;
  }
  getNode(id) {
    const index = this.model.getNodeIndex(id);
    return index < 0 ? null : this.model.getNodeSnapshot(index);
  }
  getLink(id) {
    const index = this.model.getLinkIndex(id);
    return index < 0 ? null : this.model.getLinkSnapshot(index);
  }
  setNodePosition(idOrIndex, x, y, resetPrevious = true) {
    const index = typeof idOrIndex === 'number' && idOrIndex < this.model.nodeCount && !this.model.nodeIdToIndex.has(idOrIndex) ? idOrIndex : this.model.getNodeIndex(idOrIndex);
    if (index < 0) {
      return false;
    }
    this.model.setNodePosition(index, x, y, resetPrevious);
    this.bundling.markDirty();
    this.physics.wake();
    return true;
  }
  setNodeFixed(idOrIndex, fixed = true) {
    const index = typeof idOrIndex === 'number' && idOrIndex < this.model.nodeCount && !this.model.nodeIdToIndex.has(idOrIndex) ? idOrIndex : this.model.getNodeIndex(idOrIndex);
    if (index < 0) {
      return false;
    }
    this.model.setNodeFixed(index, fixed);
    this.physics.wake();
    return true;
  }
  selectNode(idOrIndex, selected = true) {
    const index = typeof idOrIndex === 'number' && idOrIndex < this.model.nodeCount && !this.model.nodeIdToIndex.has(idOrIndex) ? idOrIndex : this.model.getNodeIndex(idOrIndex);
    if (index < 0) {
      return false;
    }

    if (selected) {
      this.model.flags[index] |= NODE_SELECTED;
    } else {
      this.model.flags[index] &= ~NODE_SELECTED;
    }
    return true;
  }
  selectLink(idOrIndex, selected = true) {
    const index = typeof idOrIndex === 'number' && idOrIndex < this.model.linkCount && !this.model.linkIdToIndex.has(idOrIndex) ? idOrIndex : this.model.getLinkIndex(idOrIndex);
    if (index < 0) {
      return false;
    }

    if (selected) {
      this.model.linkFlags[index] |= LINK_SELECTED;
    } else {
      this.model.linkFlags[index] &= ~LINK_SELECTED;
    }
    this.model.appearanceRevision++;
    return true;
  }
  setNodeAppearance(idOrIndex, appearance = {}) {
    const index = typeof idOrIndex === 'number' && idOrIndex < this.model.nodeCount && !this.model.nodeIdToIndex.has(idOrIndex) ? idOrIndex : this.model.getNodeIndex(idOrIndex);
    if (index < 0) {
      return false;
    }
    this.model.setNodeAppearance(index, appearance);
    this.bundling.markDirty();
    if (appearance.label !== undefined) {
      const nodeId = this.model.id[index];
      this._manageLabelOnAppearanceChange(nodeId, appearance.label);
    }
    return true;
  }
  setLinkAppearance(idOrIndex, appearance = {}) {
    const index = typeof idOrIndex === 'number' && idOrIndex < this.model.linkCount && !this.model.linkIdToIndex.has(idOrIndex) ? idOrIndex : this.model.getLinkIndex(idOrIndex);
    if (index < 0) {
      return false;
    }
    this.model.setLinkAppearance(index, appearance);
    return true;
  }
  setNodeState(idOrIndex, state) {
    const index = typeof idOrIndex === 'number' && idOrIndex < this.model.nodeCount && !this.model.nodeIdToIndex.has(idOrIndex) ? idOrIndex : this.model.getNodeIndex(idOrIndex);
    if (index < 0) {
      return false;
    }
    this.model.setNodeState(index, state);
    return true;
  }
  setAppearance(appearance = {}) {
    this.options.appearance = { ...this.options.appearance, ...appearance };
    this.renderer.setAppearance(this.options.appearance);
    return this;
  }
  pickLinkAt(worldX, worldY, hitRadius = 7) {
    const model = this.model;
    const tolerance = hitRadius / Math.max(this.camera.zoom, 0.0001);
    let result = -1;
    let best = Infinity;
    for (let link = 0; link < model.linkCount; link++) {
      if (model.linkFlags[link] & 2) {
        continue;
      }
      const route = this.bundling.getRoute(link);
      const points = this.bundling.getPointCount(link);
      const segmentCount = route && points > 1 ? points - 1 : 1;
      for (let segment = 0; segment < segmentCount; segment++) {
        const ax = route ? route[segment * 2] : model.x[model.source[link]];
        const ay = route ? route[segment * 2 + 1] : model.y[model.source[link]];
        const bx = route ? route[segment * 2 + 2] : model.x[model.target[link]];
        const by = route ? route[segment * 2 + 3] : model.y[model.target[link]];
        const dx = bx - ax;
        const dy = by - ay;
        const lengthSq = dx * dx + dy * dy;
        const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((worldX - ax) * dx + (worldY - ay) * dy) / lengthSq)) : 0;
        const px = ax + dx * t;
        const py = ay + dy * t;
        const distance = Math.hypot(worldX - px, worldY - py);
        const limit = tolerance + model.linkWidth[link] / Math.max(this.camera.zoom, 0.0001);
        if (distance <= limit && distance < best) {
          result = link;
          best = distance;
        }
      }
    }
    return result;
  }
  _setHoveredNode(index) {
    const previous = this._hoveredNode ?? -1;
    if (previous === index) {
      return;
    }

    if (previous >= 0 && this.model.nodeState[previous] === 1) {
      this.model.setNodeState(previous, 0);
    }
    this._hoveredNode = index;
    if (index >= 0 && (this.model.flags[index] & (NODE_SELECTED | NODE_DRAGGED | NODE_FIXED)) === 0) {
      this.model.setNodeState(index, 1);
    }
  }

  fit(padding = 40) {
    if (!this.model.nodeCount) {
      return this;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < this.model.nodeCount; i++) {
      minX = Math.min(minX, this.model.x[i] - this.model.radius[i]);
      minY = Math.min(minY, this.model.y[i] - this.model.radius[i]);
      maxX = Math.max(maxX, this.model.x[i] + this.model.radius[i]);
      maxY = Math.max(maxY, this.model.y[i] + this.model.radius[i]);
    }
    this.camera.fit(minX, minY, maxX, maxY, padding);
    this._cameraMoving = false;
    this.render();
    return this;
  }

  rebuildEdgeBundles() {
    this.bundling.rebuild();
    this._lastRenderedBundleRevision = this.bundling.routeRevision;
    this.render();
    return this;
  }
  clearEdgeBundles() {
    this.bundling.clear();
    this.render();
    return this;
  }
  setBundlingOptions(options = {}) {
    this.bundling.setOptions(options);
    this.options = { ...this.options, ...options };
    return this;
  }
  setPhysicsOptions(options = {}) {
    this.physics.setOptions(options);
    this.options = { ...this.options, physics: { ...this.options.physics, ...options } };
    return this;
  }
  getEdgeRoute(linkId) {
    const index = this.model.getLinkIndex(linkId);
    return index < 0 ? null : this.bundling.getRouteSnapshot(index);
  }
  getBundleInfo(linkId) {
    const index = this.model.getLinkIndex(linkId);
    return index < 0 ? null : this.bundling.getBundleInfo(index);
  }
  getConflictEnergy() {
    return this.physics.edgeConflictEnergy;
  }
  measureConflictEnergy() {
    return this.physics.measureConflictEnergy();
  }
  getConflictDiagnostics() {
    return this.physics.getConflictDiagnostics();
  }

  step(dt) {
    const energy = this.physics.step(dt);
    if (!this._cameraMoving) {
      this.bundling.updateIfNeeded();
    }
    this.render();
    return energy;
  }
  render() {
    if (this.destroyed) {
      return this;
    }

    if (!this._cameraMoving) {
      this.bundling.updateIfNeeded();
    }
    this.renderer.render(this.model, this.bundling);
    this._updateLabelPositions();
    return this;
  }

  _frame = time => {
    if (!this.running || this.destroyed) {
      return;
    }
    const dt = this._lastTime ? Math.min(0.05, (time - this._lastTime) / 1000) : 1 / 60;
    this._lastTime = time;
    this.step(dt);
    this._cameraMoving = false;
    if (typeof globalThis.requestAnimationFrame === 'function') {
      this._raf = globalThis.requestAnimationFrame(this._frame);
    } else {
      this._raf = globalThis.setTimeout(() => this._frame(performance.now()), 16);
    }
  };

  start() {
    if (this.running || this.destroyed) {
      return this;
    }
    this.running = true;
    this._lastTime = 0;
    this.emit('start');
    if (typeof globalThis.requestAnimationFrame === 'function') {
      this._raf = globalThis.requestAnimationFrame(this._frame);
    } else {
      this._raf = globalThis.setTimeout(() => this._frame(performance.now()), 0);
    }
    return this;
  }
  stop() {
    if (!this.running) {
      return this;
    }
    this.running = false;
    if (typeof globalThis.cancelAnimationFrame === 'function') {
      globalThis.cancelAnimationFrame(this._raf);
    } else {
      globalThis.clearTimeout(this._raf);
    }
    this._raf = 0;
    this.emit('stop');
    return this;
  }
  destroy() {
    if (this.destroyed) {
      return;
    }
    this.stop();
    this.pointer?.destroy();
    this.renderer.destroy();
    this.labelContainer?.remove();
    this._labelElements.clear();
    this.events.clear();
    this.model.clear();
    this.destroyed = true;
  }

  get nodeCount() {
    return this.model.nodeCount;
  }
  get linkCount() {
    return this.model.linkCount;
  }
  get sleeping() {
    return this.physics.sleeping;
  }
}

export {
  GraphModel,
  SpatialHash2D,
  Physics2D,
  EdgeBundling2D,
  SegmentGrid,
  EdgeConflictDetector2D,
  Coarsening2D,
  Camera2D,
  WebGLRenderer2D,
  PointerController,
  NODE_FIXED,
  NODE_SELECTED,
  NODE_DRAGGED,
  LINK_SELECTED,
  NODE_STATE_NORMAL,
  NODE_STATE_HOVER,
  NODE_STATE_SELECTED,
  NODE_STATE_DRAGGING,
  NODE_STATE_FIXED,
  NODE_STATE_DISABLED,
  LINK_STYLE_SOLID,
  LINK_STYLE_DASHED,
  packRGBA,
  unpackRGBA,
  deterministicNodeColor,
};
export default Graphium;
