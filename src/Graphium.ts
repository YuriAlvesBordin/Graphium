/**
 * Implements the main Graphium facade. The class wires the data model,
 * physics engine, camera, renderer, label layer and pointer controller into
 * one object, exposes a fluent chainable API with sensible defaults, and
 * runs an on demand render loop that pauses completely while the simulation
 * sleeps.
 */

import { Emitter } from './core/events.js';
import { GraphModel, LINK_HIDDEN, LINK_SELECTED, NODE_DIM, LINK_DIM, NODE_SELECTED, STATE_HOVER, STATE_NORMAL } from './core/GraphModel.js';
import { LinkHandle, NodeHandle } from './core/handles.js';
import { resolveTheme } from './core/theme.js';
import { BUILT_IN_THEMES } from './core/themes.js';
import type {
  GraphData,
  GraphiumOptions,
  InteractionOptions,
  LinkId,
  LinkOptions,
  LinkSnapshot,
  NodeId,
  NodeOptions,
  NodeSnapshot,
  NodeStateName,
  PhysicsOptions,
  PhysicsPresetName,
  StatsSnapshot,
  ThemeOptions,
  ThemeResolved,
} from './core/types.js';
import { PointerController } from './interaction/PointerController.js';
import { PhysicsEngine } from './physics/PhysicsEngine.js';
import { PRESETS } from './physics/presets.js';
import { SpatialHash } from './physics/SpatialHash.js';
import { Camera } from './render/Camera.js';
import { controlPoint, distanceToEdge } from './render/geometry.js';
import { LabelLayer } from './render/LabelLayer.js';
import { RenderLoop } from './render/RenderLoop.js';
import { Renderer } from './render/Renderer.js';
import { TextureAtlas } from './render/TextureAtlas.js';

export class Graphium {
  readonly model: GraphModel;
  readonly physics: PhysicsEngine;
  readonly camera: Camera;
  readonly renderer: Renderer;
  readonly atlas: TextureAtlas;
  readonly labels: LabelLayer;
  readonly events = new Emitter();
  theme: ThemeResolved;
  running = false;
  destroyed = false;

  private options: GraphiumOptions;
  private hash: SpatialHash;
  private pointer: PointerController | null = null;
  private readonly loop: RenderLoop;
  private hoverIndex = -1;
  private linkCounter = 0;

  constructor(options: GraphiumOptions = {}) {
    this.options = options;
    this.theme = resolveTheme(options.theme);
    this.model = new GraphModel({
      nodeCapacity: options.nodeCapacity,
      linkCapacity: options.linkCapacity,
      theme: this.theme,
    });
    this.physics = new PhysicsEngine(this.model, options.physics ?? {});
    this.hash = this.physics.hash;
    this.hash.setCellSize(this.physics.options.repulsionRadius);
    this.camera = new Camera(options.camera ?? {});
    const canvas = options.canvas ?? (options.container ? createCanvasIn(options.container) : createCanvasIn(document.body));
    this.renderer = new Renderer(canvas, this.theme, options.renderer ?? {});
    this.renderer.setCamera(this.camera);
    this.atlas = new TextureAtlas(this.renderer.gl as WebGL2RenderingContext);
    this.renderer.setAtlas(this.atlas);
    this.atlas.onEvent = event => {
      this.events.emit(event.type, event);
      this.invalidate();
    };
    const host = canvas.parentElement ?? document.body;
    this.labels = new LabelLayer(host, this.theme);
    this.labels.attach(this.model, this.camera);
    this.loop = new RenderLoop({
      model: this.model,
      physics: this.physics,
      camera: this.camera,
      renderer: this.renderer,
      labels: this.labels,
      atlas: this.atlas,
      isRunning: () => this.running,
      isDestroyed: () => this.destroyed,
      autoFit: options.autoFit ?? false,
      fitView: () => this.fit(),
    });
    this.wirePointer(canvas);
    this.wireEvents();
    this.resize();
    if (typeof ResizeObserver !== 'undefined' && (options.autoResize ?? true)) {
      new ResizeObserver(() => this.resize()).observe(canvas);
    }
    if (options.autoStart ?? true) {
      this.start();
    }
  }

  /** Creates a Graphium instance with the supplied configuration. */
  static create(options: GraphiumOptions = {}): Graphium {
    return new Graphium(options);
  }

  /** Subscribes to an event and returns an unsubscribe function. */
  on<T = unknown>(type: string, listener: (payload: T) => void): () => void {
    return this.events.on(type, listener);
  }

  /** Subscribes to an event exactly once. */
  once<T = unknown>(type: string, listener: (payload: T) => void): () => void {
    return this.events.once(type, listener);
  }

  /** Removes one listener, or every listener of a type. */
  off<T = unknown>(type: string, listener?: (payload: T) => void): this {
    this.events.off(type, listener);
    return this;
  }

  /** Dispatches an event payload to the registered listeners. */
  emit<T = unknown>(type: string, payload: T): this {
    this.events.emit(type, payload);
    return this;
  }

  /** Builds the pointer controller when interaction is not disabled. */
  private wirePointer(canvas: HTMLCanvasElement): void {
    const interaction = this.options.interaction;
    if (interaction === false) {
      return;
    }
    const settings: InteractionOptions = interaction === true || interaction === undefined ? {} : interaction;
    this.pointer = new PointerController(canvas, this.camera, this.model, this.physics, this.hash, this.events, {
      wheelZoomSpeed: settings.wheelZoomSpeed,
      dragThreshold: settings.dragThreshold,
      longPressMs: settings.longPressMs,
      linkHitRadius: settings.linkHitRadius,
      hoverEnabled: settings.hoverEnabled,
      panEnabled: settings.panEnabled,
      zoomEnabled: settings.zoomEnabled,
      dragEnabled: settings.dragEnabled,
      pickLink: (worldX, worldY, radius) => this.pickLinkAt(worldX, worldY, radius),
    });
  }

  /** Connects library internal reactions to emitter traffic. */
  private wireEvents(): void {
    this.physics.onSleep = energy => {
      this.events.emit('sleep', { energy });
    };
    this.physics.onWake = () => {
      this.events.emit('wake', {});
      this.loop.schedule();
    };
    this.events.on('pan', () => this.invalidate());
    this.events.on('zoom', () => this.invalidate());
    this.events.on('pinch', () => this.invalidate());
    this.events.on('hover', payload => {
      const event = payload as unknown as { nodeIndex?: number };
      this.setHover(typeof event.nodeIndex === 'number' ? event.nodeIndex : -1);
      this.invalidate();
    });
    this.events.on('click', payload => {
      const event = payload as unknown as { nodeIndex: number; linkIndex: number };
      if (event.linkIndex >= 0) {
        this.selectLink(event.linkIndex, true);
      } else if (event.nodeIndex >= 0) {
        this.selectNode(event.nodeIndex, true);
      } else {
        this.clearSelection();
      }
      this.invalidate();
    });
    this.events.on('drag', () => {
      this.physics.wake();
      this.invalidate();
    });
    this.events.on('dragend', () => this.invalidate());
    this.events.on('imageload', () => this.invalidate());
  }

  /** Updates the hovered node and keeps the previous one consistent. */
  private setHover(index: number): void {
    const previous = this.hoverIndex;
    if (previous === index) {
      return;
    }
    if (previous >= 0 && this.model.state[previous] === STATE_HOVER) {
      this.model.state[previous] = STATE_NORMAL;
    }
    this.hoverIndex = index;
    if (index >= 0 && this.model.state[index] === STATE_NORMAL) {
      this.model.state[index] = STATE_HOVER;
    }
  }

  /** Adds one node and returns the graph for chaining. */
  addNode(id: NodeId, options: NodeOptions = {}): this {
    if (id === undefined || id === null) {
      throw new Error('Graphium requires a node id.');
    }
    this.model.addNode(id, options);
    this.physics.wake();
    this.invalidate();
    return this;
  }

  /** Adds many nodes in one call and returns the graph for chaining. */
  addNodes(nodes: Array<NodeOptions & { id: NodeId }>): this {
    for (let index = 0; index < nodes.length; index++) {
      this.model.addNode(nodes[index].id ?? index, nodes[index]);
    }
    this.physics.wake();
    this.invalidate();
    return this;
  }

  /** Links two nodes, reusing an existing link with the same auto id. */
  link(source: NodeId, target: NodeId, options?: LinkOptions): this;
  /** Returns a fluent handle when called with a single link id. */
  link(id: LinkId): LinkHandle | null;
  link(sourceOrId: NodeId, target?: NodeId, options: LinkOptions = {}): this | LinkHandle | null {
    if (target === undefined) {
      const index = this.model.linkIndexOf(sourceOrId as LinkId);
      return index < 0 ? null : new LinkHandle(this, this.model.linkIdAt(index) as LinkId);
    }
    const autoId = options.id ?? `${String(sourceOrId)}~${String(target)}~${this.linkCounter++}`;
    this.model.addLink(autoId, sourceOrId, target, options);
    this.physics.wake();
    this.invalidate();
    return this;
  }

  /** Adds a link with an explicit id, mirroring the legacy signature. */
  addLink(id: LinkId, source: NodeId, target: NodeId, options: LinkOptions = {}): this {
    this.model.addLink(id, source, target, options);
    this.physics.wake();
    this.invalidate();
    return this;
  }

  /** Adds many links in one call and returns the graph for chaining. */
  addLinks(links: Array<LinkOptions & { source: NodeId; target: NodeId }>): this {
    for (let index = 0; index < links.length; index++) {
      const config = links[index];
      const linkId = config.id ?? `${String(config.source)}~${String(config.target)}~${this.linkCounter++}`;
      this.model.addLink(linkId, config.source, config.target, config);
    }
    this.physics.wake();
    this.invalidate();
    return this;
  }

  /** Returns a fluent handle for one node, or null when it is missing. */
  node(id: NodeId): NodeHandle | null {
    const index = this.model.nodeIndexOf(id);
    return index < 0 ? null : new NodeHandle(this, this.model.nodeIdAt(index) as NodeId);
  }

  /** Returns a fluent handle for one link, or null when it is missing. */
  linkById(id: LinkId): LinkHandle | null {
    const index = this.model.linkIndexOf(id);
    return index < 0 ? null : new LinkHandle(this, this.model.linkIdAt(index) as LinkId);
  }

  /** Replaces the entire graph with the supplied data payload. */
  setData(data: GraphData): this {
    this.model.setData(data);
    this.physics.reset();
    this.loop.resetAutoFit();
    this.events.emit('dataupdated', { nodeCount: this.model.nodeCount, linkCount: this.model.linkCount });
    this.invalidate();
    return this;
  }

  /** Removes one node together with its links. */
  removeNode(id: NodeId): boolean {
    const removed = this.model.removeNode(id);
    if (removed) {
      this.physics.wake();
      this.invalidate();
    }
    return removed;
  }

  /** Removes one link by id. */
  removeLink(id: LinkId): boolean {
    const removed = this.model.removeLink(id);
    if (removed) {
      this.physics.wake();
      this.invalidate();
    }
    return removed;
  }

  /** Removes every node and link while keeping the current theme. */
  clear(): this {
    this.model.clear();
    this.physics.reset();
    this.loop.resetAutoFit();
    this.invalidate();
    return this;
  }

  /** Returns a snapshot of one node or null when it does not exist. */
  getNode(id: NodeId): NodeSnapshot | null {
    const index = this.model.nodeIndexOf(id);
    return index < 0 ? null : this.model.nodeSnapshot(index);
  }

  /** Returns a snapshot of one link or null when it does not exist. */
  getLink(id: LinkId): LinkSnapshot | null {
    const index = this.model.linkIndexOf(id);
    return index < 0 ? null : this.model.linkSnapshot(index);
  }

  /** Returns the ids of every node currently in the graph. */
  nodeIds(): NodeId[] {
    const ids: NodeId[] = [];
    for (let index = 0; index < this.model.nodeCount; index++) {
      ids.push(this.model.nodeIdAt(index) as NodeId);
    }
    return ids;
  }

  /** Returns the ids of every link currently in the graph. */
  linkIds(): LinkId[] {
    const ids: LinkId[] = [];
    for (let index = 0; index < this.model.linkCount; index++) {
      ids.push(this.model.linkIdAt(index) as LinkId);
    }
    return ids;
  }

  /** Moves a node to a world position. */
  setNodePosition(id: NodeId | number, x: number, y: number): this {
    const index = this.model.nodeIndexOf(id);
    if (index >= 0) {
      this.model.setNodePosition(index, x, y, true);
      this.physics.wake();
      this.invalidate();
    }
    return this;
  }

  /** Locks or unlocks a node in the solver. */
  setNodeFixed(id: NodeId | number, fixed: boolean): this {
    const index = this.model.nodeIndexOf(id);
    if (index >= 0) {
      this.model.setNodeFixed(index, fixed);
      this.physics.wake();
      this.invalidate();
    }
    return this;
  }

  /** Assigns a visual state to a node. */
  setNodeState(id: NodeId | number, state: NodeStateName): this {
    const index = this.model.nodeIndexOf(id);
    if (index >= 0) {
      this.model.setNodeState(index, state);
      this.invalidate();
    }
    return this;
  }

  /** Updates node appearance properties. */
  setNodeAppearance(id: NodeId | number, options: NodeOptions): this {
    const index = this.model.nodeIndexOf(id);
    if (index >= 0) {
      this.model.updateNode(index, options);
      this.invalidate();
    }
    return this;
  }

  /** Updates link appearance properties. */
  setLinkAppearance(id: LinkId | number, options: LinkOptions): this {
    const index = this.model.linkIndexOf(id);
    if (index >= 0) {
      this.model.updateLink(index, options);
      this.invalidate();
    }
    return this;
  }

  /** Sets the node image and starts the asynchronous load. */
  setNodeImage(id: NodeId | number, url: string | null, mode: 'cover' | 'contain' = 'cover'): this {
    const index = this.model.nodeIndexOf(id);
    if (index >= 0) {
      this.model.updateNode(index, { image: url, imageMode: mode });
      this.invalidate();
    }
    return this;
  }

  /** Replaces the custom data object attached to a node. */
  setNodeData(id: NodeId | number, data: Record<string, unknown>): this {
    const index = this.model.nodeIndexOf(id);
    if (index >= 0) {
      const userData = this.model.nodeUserData(index);
      for (const key of Object.keys(userData)) {
        delete userData[key];
      }
      Object.assign(userData, data);
    }
    return this;
  }

  /** Replaces the custom data object attached to a link. */
  setLinkData(id: LinkId | number, data: Record<string, unknown>): this {
    const index = this.model.linkIndexOf(id);
    if (index >= 0) {
      const userData = this.model.linkUserData(index);
      for (const key of Object.keys(userData)) {
        delete userData[key];
      }
      Object.assign(userData, data);
    }
    return this;
  }

  /** Selects one node, optionally keeping the current selection. */
  selectNode(id: NodeId | number, selected: boolean = true, additive = false): this {
    const index = this.model.nodeIndexOf(id);
    if (index < 0) {
      return this;
    }
    if (selected && !additive) {
      this.clearNodeSelection();
    }
    this.model.setNodeSelected(index, selected);
    this.invalidate();
    return this;
  }

  /** Selects one link, optionally keeping the current selection. */
  selectLink(id: LinkId | number, selected: boolean = true, additive = false): this {
    const index = this.model.linkIndexOf(id);
    if (index < 0) {
      return this;
    }
    if (selected && !additive) {
      this.clearLinkSelection();
    }
    this.model.setLinkSelected(index, selected);
    this.invalidate();
    return this;
  }

  /** Clears the selection of every node and link. */
  clearSelection(): this {
    this.clearNodeSelection();
    this.clearLinkSelection();
    this.invalidate();
    return this;
  }

  /** Deselects every node. */
  private clearNodeSelection(): void {
    for (let index = 0; index < this.model.nodeCount; index++) {
      if (this.model.flags[index] & NODE_SELECTED) {
        this.model.setNodeSelected(index, false);
      }
    }
  }

  /** Deselects every link. */
  private clearLinkSelection(): void {
    for (let index = 0; index < this.model.linkCount; index++) {
      if (this.model.linkFlags[index] & LINK_SELECTED) {
        this.model.setLinkSelected(index, false);
      }
    }
  }

  /** Returns the ids of every selected node. */
  selectedNodes(): NodeId[] {
    const ids: NodeId[] = [];
    for (let index = 0; index < this.model.nodeCount; index++) {
      if (this.model.flags[index] & NODE_SELECTED) {
        ids.push(this.model.nodeIdAt(index) as NodeId);
      }
    }
    return ids;
  }

  /** Returns the ids of every selected link. */
  selectedLinks(): LinkId[] {
    const ids: LinkId[] = [];
    for (let index = 0; index < this.model.linkCount; index++) {
      if (this.model.linkFlags[index] & LINK_SELECTED) {
        ids.push(this.model.linkIdAt(index) as LinkId);
      }
    }
    return ids;
  }

  /** Dims every node and link that is not adjacent to the focus node. */
  focus(id: NodeId | number): this {
    const index = this.model.nodeIndexOf(id);
    if (index < 0) {
      return this;
    }
    const model = this.model;
    const neighbors = new Set<number>([index]);
    for (let link = 0; link < model.linkCount; link++) {
      const touches = model.source[link] === index || model.target[link] === index;
      if (touches) {
        neighbors.add(model.source[link]);
        neighbors.add(model.target[link]);
      } else {
        model.linkFlags[link] |= LINK_DIM;
      }
    }
    for (let node = 0; node < model.nodeCount; node++) {
      if (!neighbors.has(node)) {
        model.flags[node] |= NODE_DIM;
      } else {
        model.flags[node] &= ~NODE_DIM;
      }
    }
    model.appearanceRevision++;
    this.invalidate();
    return this;
  }

  /** Removes all dimming applied by focus. */
  unfocus(): this {
    const model = this.model;
    for (let node = 0; node < model.nodeCount; node++) {
      model.flags[node] &= ~NODE_DIM;
    }
    for (let link = 0; link < model.linkCount; link++) {
      model.linkFlags[link] &= ~LINK_DIM;
    }
    model.appearanceRevision++;
    this.invalidate();
    return this;
  }

  /** Merges theme values, optionally starting from a built in theme name. */
  setTheme(theme: ThemeOptions & { name?: string }): this {
    const base = theme.name && BUILT_IN_THEMES[theme.name] ? BUILT_IN_THEMES[theme.name] : this.options.theme ?? {};
    const merged: ThemeOptions = { ...base, ...theme };
    delete (merged as { name?: string }).name;
    this.options.theme = merged;
    this.theme = resolveTheme(merged, this.theme);
    this.model.palette = this.theme.nodeColorPalette;
    this.renderer.setTheme(this.theme);
    this.labels.theme = this.theme;
    this.labels.applyTheme();
    this.labels.minZoom = this.theme.labelEnabled ? 0.3 : 2;
    this.invalidate();
    return this;
  }

  /** Updates physics options live and wakes the simulation. */
  setPhysics(options: PhysicsOptions): this {
    this.physics.setOptions(options);
    this.hash.setCellSize(this.physics.options.repulsionRadius);
    return this;
  }

  /** Applies a named physics preset with optional overrides. */
  usePreset(name: PhysicsPresetName, overrides: PhysicsOptions = {}): this {
    this.physics.usePreset(name, overrides);
    this.hash.setCellSize(this.physics.options.repulsionRadius);
    return this;
  }

  /** Updates interaction options on the live pointer controller. */
  setInteraction(options: InteractionOptions): this {
    if (this.pointer) {
      Object.assign(this.pointer.options, options);
    }
    return this;
  }

  /** Restarts the simulation and returns the graph for chaining. */
  reboot(): this {
    this.physics.reset();
    return this;
  }

  /** Scales the view so the whole graph fits with padding. */
  fit(padding = 60): this {
    const model = this.model;
    if (model.nodeCount === 0) {
      return this;
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
    this.camera.fit(minX, minY, maxX, maxY, padding);
    this.invalidate();
    return this;
  }

  /** Centers the view on a world point. */
  centerOn(x: number, y: number): this {
    this.camera.setPosition(x, y);
    this.invalidate();
    return this;
  }

  /** Multiplies the current zoom level. */
  zoomBy(factor: number): this {
    this.camera.setZoom(this.camera.zoom * factor);
    this.invalidate();
    return this;
  }

  /** Sets an absolute zoom level. */
  zoomTo(zoom: number): this {
    this.camera.setZoom(zoom);
    this.invalidate();
    return this;
  }

  /** Resizes the renderer to the canvas client size. */
  resize(): this {
    const canvas = this.renderer.canvas;
    const width = canvas.clientWidth || canvas.width || 1;
    const height = canvas.clientHeight || canvas.height || 1;
    this.renderer.resize(width, height, window.devicePixelRatio || 1);
    this.invalidate();
    return this;
  }

  /** Advances physics and renders once, returning the kinetic energy. */
  step(dt = 1 / 60): number {
    return this.loop.step(dt);
  }

  /** Renders a frame immediately without stepping the simulation. */
  render(): this {
    this.loop.renderNow();
    return this;
  }

  /** Requests a render on the next scheduled frame. */
  requestRender(): this {
    this.loop.requestRender();
    return this;
  }

  /** Marks the view dirty and guarantees a scheduled frame. */
  private invalidate(): void {
    this.loop.invalidate();
  }

  /** Starts the run loop and returns the graph for chaining. */
  start(): this {
    if (this.running || this.destroyed) {
      return this;
    }
    this.running = true;
    this.physics.wake();
    this.events.emit('start', {});
    this.loop.schedule();
    return this;
  }

  /** Stops the run loop and returns the graph for chaining. */
  stop(): this {
    if (!this.running) {
      return this;
    }
    this.running = false;
    this.events.emit('stop', {});
    return this;
  }

  /** Resolves when every requested node image finished loading. */
  loadImages(): Promise<void> {
    return this.atlas.loadAll();
  }

  /** Finds the link index closest to a world position within a radius. */
  pickLinkAt(worldX: number, worldY: number, hitRadius = 8): number {
    const model = this.model;
    const tolerance = hitRadius / Math.max(this.camera.zoom, 0.0001);
    let best = -1;
    let bestDistance = Infinity;
    for (let link = 0; link < model.linkCount; link++) {
      if (model.linkFlags[link] & LINK_HIDDEN) {
        continue;
      }
      const source = model.source[link];
      const target = model.target[link];
      const distance = distanceToEdge(worldX, worldY, model.x[source], model.y[source], model.x[target], model.y[target], model.linkCurvature[link]);
      const limit = tolerance + model.linkWidth[link] / Math.max(this.camera.zoom, 0.0001);
      if (distance <= limit && distance < bestDistance) {
        best = link;
        bestDistance = distance;
      }
    }
    return best;
  }

  /** Returns the world position under a screen position. */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return this.camera.screenToWorld(screenX, screenY, { x: 0, y: 0 });
  }

  /** Returns a performance statistics snapshot for dashboards. */
  stats(): StatsSnapshot {
    return {
      nodeCount: this.model.nodeCount,
      linkCount: this.model.linkCount,
      fps: Math.round(this.loop.fps),
      frameMs: Math.round(this.loop.frameMs * 100) / 100,
      physicsMs: Math.round(this.loop.physicsMs * 100) / 100,
      renderMs: Math.round(this.renderer.lastRenderMs * 100) / 100,
      sleeping: this.physics.sleeping,
    };
  }

  /** Captures the current canvas contents as a PNG data URL. */
  screenshot(): string {
    this.loop.renderNow();
    return this.renderer.canvas.toDataURL('image/png');
  }

  /** Exports the current graph as a plain JSON friendly object. */
  toJSON(): GraphData {
    const nodes: Array<NodeOptions & { id: NodeId }> = [];
    for (let index = 0; index < this.model.nodeCount; index++) {
      const snapshot = this.model.nodeSnapshot(index);
      nodes.push({ id: snapshot.id, x: snapshot.x, y: snapshot.y, label: snapshot.label, radius: snapshot.radius, color: snapshot.color, fixed: snapshot.fixed });
    }
    const links: Array<LinkOptions & { source: NodeId; target: NodeId }> = [];
    for (let index = 0; index < this.model.linkCount; index++) {
      const snapshot = this.model.linkSnapshot(index);
      links.push({ id: snapshot.id, source: snapshot.source, target: snapshot.target, color: snapshot.color, curvature: snapshot.curvature, width: snapshot.width });
    }
    return { nodes, links };
  }

  /** Releases every resource owned by the instance. */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.running = false;
    this.loop.cancel();
    this.pointer?.destroy();
    this.labels.destroy();
    this.atlas.onEvent = null;
    this.renderer.destroy();
    this.events.clear();
    this.model.clear();
  }

  /** Returns the number of nodes in the graph. */
  get nodeCount(): number {
    return this.model.nodeCount;
  }

  /** Returns the number of links in the graph. */
  get linkCount(): number {
    return this.model.linkCount;
  }

  /** Reports whether the physics simulation is currently asleep. */
  get sleeping(): boolean {
    return this.physics.sleeping;
  }
}

/** Creates a canvas element appended to a host element. */
function createCanvasIn(host: HTMLElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, {
    display: 'block',
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: '0',
    left: '0',
    zIndex: '0',
    touchAction: 'none',
  } as CSSStyleDeclaration);
  if (host !== document.body) {
    Object.assign(host.style, { position: 'relative' } as CSSStyleDeclaration);
  }
  host.appendChild(canvas);
  return canvas;
}

export { PRESETS, BUILT_IN_THEMES, controlPoint };
