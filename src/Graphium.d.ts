export type GraphId = string | number;
export type RGBA = string | number | [number, number, number, number?];
export type NodeState = 'normal' | 'hover' | 'selected' | 'dragging' | 'fixed' | 'disabled';
export type LinkStyle = 'solid' | 'dashed';

export interface NodeAppearance {
  backgroundColor?: RGBA;
  color?: RGBA;
  fill?: RGBA;
  visualRadius?: number;
  borderColor?: RGBA;
  stroke?: RGBA;
  borderWidth?: number;
  strokeWidth?: number;
  borderOpacity?: number;
  opacity?: number;
  image?: string;
  avatar?: string;
  avatarUrl?: string;
  imageUrl?: string;
  label?: string;
  state?: NodeState | number;
  disabled?: boolean;
}

export interface LinkAppearance {
  color?: RGBA;
  stroke?: RGBA;
  lineColor?: RGBA;
  width?: number;
  strokeWidth?: number;
  lineWidth?: number;
  opacity?: number;
  style?: LinkStyle;
  lineStyle?: LinkStyle;
  dashPattern?: [number, number];
  dash?: [number, number];
  dashOffset?: number;
  dashScaleWithZoom?: boolean;
  /** Overrides the global edgeArrowEnabled for this link: true forces the arrow on, false forces it off (default: follows the global setting) */
  arrow?: boolean;
  /** Arrow head length in screen pixels (default: 10) */
  arrowSize?: number;
  /** Arrow head base width in screen pixels (default: 6) */
  arrowWidth?: number;
}

export interface AppearanceOptions {
  nodeRadius?: number;
  nodeVisualRadius?: number;
  nodeBorderEnabled?: boolean;
  nodeBorderWidth?: number;
  nodeBorderColor?: RGBA;
  nodeBorderOpacity?: number;
  nodeOpacity?: number;
  edgeWidth?: number;
  edgeColor?: RGBA;
  edgeOpacity?: number;
  edgeCap?: 'round' | 'butt';
  edgeJoin?: 'round' | 'bevel';
  hoverRingColor?: RGBA;
  hoverRingWidth?: number;
  selectedRingColor?: RGBA;
  selectedRingWidth?: number;
  fixedRingColor?: RGBA;
  fixedRingWidth?: number;
  draggingOpacity?: number;
  disabledOpacity?: number;
  selectedEdgeColor?: RGBA;
  selectedEdgeWidthMultiplier?: number;
  selectedEdgeOpacity?: number;
  /** Whether to render a direction arrowhead at the target end of every link (default: false) */
  edgeArrowEnabled?: boolean;
  /** Arrow head length in screen pixels (default: 10) */
  edgeArrowSize?: number;
  /** Arrow head base width in screen pixels (default: 6) */
  edgeArrowWidth?: number;
}

export interface NodeOptions extends NodeAppearance {
  x?: number;
  y?: number;
  radius?: number;
  mass?: number;
  fixed?: boolean;
}
export interface LinkOptions extends LinkAppearance {
  restLength?: number;
  strength?: number;
}
export interface NodeData extends NodeOptions {
  id: GraphId;
}
export interface LinkData extends LinkOptions {
  id?: GraphId;
  source: GraphId;
  target: GraphId;
}
export interface GraphData {
  nodes?: NodeData[];
  links?: LinkData[];
}
export interface PhysicsOptions {
  damping?: number;
  maxSpeed?: number;
  gravity?: number;
  repulsion?: number;
  degreeFactor?: number;
  degreeExponent?: number;
  repulsionRadius?: number;
  physicalRadiusScale?: number;
  collisionStrength?: number;
  positionIterations?: number;
  springStrength?: number;
  temperature?: number;
  cooling?: number;
  minTemperature?: number;
  sleepEnergy?: number;
  sleepFrames?: number;
  maxNeighbors?: number;
  fixedDt?: number;
  edgeRepulsionEnabled?: boolean;
  edgeMinSeparation?: number;
  edgeRepulsionStrength?: number;
  edgeProximityStrength?: number;
  edgeAlignmentStrength?: number;
  crossingStrength?: number;
  crossingAngleStrength?: number;
  preferredCrossingAngle?: number;
  edgeRepulsionIterations?: number;
  edgeRepulsionMaxPairs?: number;
  maxEdgeCorrection?: number;
  edgeConflictDamping?: number;
  preserveEdgeLength?: number;
  maxLengthRatio?: number;
  lengthStretchPenalty?: number;
  edgeConflictWakeThreshold?: number;
  edgeConflictSleepThreshold?: number;
  edgeConflictEnergyScale?: number;
  draggedNodeConflictWeight?: number;
  sharedEndpointExclusion?: number;
  edgeConflictCellSize?: number;
  edgeConflictEvents?: boolean;
  edgeConflictRebuildThreshold?: number;
}
export interface CameraOptions {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
}
export interface GraphiumOptions {
  canvas?: HTMLCanvasElement | OffscreenCanvas;
  autoStart?: boolean;
  nodeCapacity?: number;
  linkCapacity?: number;
  physics?: PhysicsOptions;
  camera?: CameraOptions;
  appearance?: AppearanceOptions;
  renderer?: Record<string, unknown>;
  interaction?: boolean | Record<string, unknown>;
  /** Whether to render edges inside fully connected clusters of 3+ nodes as a star routed through the cluster center (default: false) */
  edgeStar?: boolean;
  /** Whether to render node labels (default: false) */
  renderLabels?: boolean;
  /** Position of label relative to node: 'above', 'below', or 'center' (default: 'below') */
  labelPosition?: 'above' | 'below' | 'center';
  /** Additional offset in pixels added to node radius (default: 0) */
  labelOffset?: number;
}
export interface NodeSnapshot extends NodeData {
  degree: number;
  color: number;
  backgroundColor: number;
  borderColor: number;
  visualRadius: number;
  borderWidth: number;
  borderOpacity: number;
  state: number;
  fixed: boolean;
  disabled: boolean;
}
export interface LinkSnapshot extends LinkData {
  sourceIndex: number;
  targetIndex: number;
  color: number;
  dashPattern: [number, number];
}
export type ConflictType = 'overlap' | 'proximity' | 'crossing';
export interface EdgeConflictEvent extends GraphEvent {
  edgeAId: GraphId;
  edgeBId: GraphId;
  edgeAIndex: number;
  edgeBIndex: number;
  type: ConflictType;
  severity: number;
  distance: number;
  angle: number;
}
export interface ConflictDiagnostics {
  edgeConflictPairs: number;
  edgeCrossings: number;
  maxEdgeCorrection: number;
  edgeConflictEnergy: number;
  edgeConflictTimeMs: number;
}
export interface GraphEvent {
  type?: string;
  nodeIndex?: number;
  nodeId?: GraphId;
  linkIndex?: number;
  linkId?: GraphId;
  worldX?: number;
  worldY?: number;
  [key: string]: unknown;
}
export type EventCallback = (event: GraphEvent) => void;

export class GraphModel {
  nodeCount: number;
  linkCount: number;
  topologyRevision: number;
  positionRevision: number;
  appearanceRevision: number;
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
  borderOpacity: Float32Array;
  flags: Uint8Array;
  nodeState: Uint8Array;
  opacity: Float32Array;
  nodeImage: Array<string | null>;
  source: Int32Array;
  target: Int32Array;
  restLength: Float32Array;
  linkStrength: Float32Array;
  linkWidth: Float32Array;
  linkColor: Uint32Array;
  linkFlags: Uint8Array;
  linkOpacity: Float32Array;
  linkStyle: Uint8Array;
  linkDashLength: Float32Array;
  linkDashGap: Float32Array;
  linkDashOffset: Float32Array;
  linkDashWorld: Uint8Array;
  /** Arrow tri-state: 1 = always on, -1 = always off, 0 = follow global edgeArrowEnabled */
  linkArrow: Int8Array;
  linkArrowSize: Float32Array;
  linkArrowWidth: Float32Array;
  constructor(options?: { nodeCapacity?: number; linkCapacity?: number; nodeDefaults?: NodeAppearance; linkDefaults?: LinkAppearance });
  getNodeIndex(id: GraphId): number;
  getLinkIndex(id: GraphId): number;
  getNodeId(index: number): GraphId;
  getLinkId(index: number): GraphId;
  addNode(id: GraphId, options?: NodeOptions): number;
  addLink(id: GraphId, source: GraphId, target: GraphId, options?: LinkOptions): number;
  removeNode(id: GraphId): boolean;
  removeLink(id: GraphId): boolean;
  setNodePosition(index: number, x: number, y: number, resetPrevious?: boolean): void;
  setNodeFixed(index: number, fixed: boolean): void;
  setNodeState(index: number, state: NodeState | number): void;
  setNodeAppearance(index: number, appearance?: NodeAppearance): void;
  setLinkAppearance(index: number, appearance?: LinkAppearance): void;
  setData(data: GraphData): this;
  clear(): void;
  getNodeSnapshot(index: number): NodeSnapshot;
  getLinkSnapshot(index: number): LinkSnapshot;
}
export class SpatialHash2D {
  constructor(options?: { cellSize?: number; nodeCapacity?: number; tableCapacity?: number });
  setCellSize(value: number): void;
  rebuild(x: Float32Array, y: Float32Array, count: number, hidden?: Uint8Array): void;
  queryRadiusInto(x: number, y: number, radius: number, output: Int32Array): number;
  pickNodeInto(x: number, y: number, positionsX: Float32Array, positionsY: Float32Array, radii: Float32Array, output: Int32Array): number;
}
export class SegmentGrid {
  constructor(cellSize?: number, capacity?: number);
  ensure(capacity: number): void;
  clear(): void;
  insert(edgeIndex: number, x: number, y: number, segmentIndex?: number): void;
  insertSegment(edgeIndex: number, segmentIndex: number, x: number, y: number): void;
  insertSegmentBounds(edgeIndex: number, segmentIndex: number, ax: number, ay: number, bx: number, by: number): void;
  queryBounds(minWorldX: number, maxWorldX: number, minWorldY: number, maxWorldY: number, output: Int32Array): number;
  queryEntries(x: number, y: number, radius: number, output: Int32Array): number;
  query(x: number, y: number, radius: number, output: Int32Array): number;
  getEdgeIndex(entry: number): number;
  getSegmentIndex(entry: number): number;
}
export class EdgeConflictDetector2D {
  lastEnergy: number;
  persistentConflict: boolean;
  debug: ConflictDiagnostics;
  constructor(model: GraphModel, options?: PhysicsOptions);
  setOptions(options: PhysicsOptions): this;
  ensureNodeCapacity(required: number): void;
  evaluate(applyCorrections?: boolean): number;
  apply(): number;
  measure(): number;
}
export class Physics2D {
  sleeping: boolean;
  energy: number;
  temperature: number;
  edgeConflictEnergy: number;
  constructor(model: GraphModel, spatialHash: SpatialHash2D, options?: PhysicsOptions);
  setOptions(options: PhysicsOptions): void;
  getConflictDiagnostics(): ConflictDiagnostics;
  measureConflictEnergy(): number;
  wake(): void;
  reset(): void;
  step(dt?: number): number;
}
export class Coarsening2D {
  levels: Array<{ nodeCount: number; fineToCoarse: Int32Array }>;
  constructor(model: GraphModel, options?: { enabled?: boolean; maxLevels?: number; minNodes?: number });
  build(): Array<{ nodeCount: number; fineToCoarse: Int32Array }>;
  getLevel(index?: number): { nodeCount: number; fineToCoarse: Int32Array } | null;
}
export class Camera2D {
  width: number;
  height: number;
  x: number;
  y: number;
  zoom: number;
  matrix: Float32Array;
  constructor(options?: CameraOptions);
  setViewport(width: number, height: number): this;
  setPosition(x: number, y: number): this;
  setZoom(zoom: number): this;
  pan(dx: number, dy: number): this;
  zoomAt(factor: number, screenX: number, screenY: number): this;
  worldToScreen2D(worldX: number, worldY: number, out?: Float32Array | number[]): Float32Array | number[] | { x: number; y: number };
  screenToWorld2D(screenX: number, screenY: number, out?: Float32Array | number[]): Float32Array | number[] | { x: number; y: number };
  fit(minX: number, minY: number, maxX: number, maxY: number, padding?: number): this;
}
export class WebGLRenderer2D {
  constructor(canvas?: HTMLCanvasElement | OffscreenCanvas | null, options?: Record<string, unknown>);
  attachCanvas(canvas: HTMLCanvasElement | OffscreenCanvas): boolean;
  setCamera(camera: Camera2D): this;
  setAppearance(appearance?: AppearanceOptions): this;
  resize(width?: number, height?: number, pixelRatio?: number): this;
  render(model: GraphModel, routes?: any): void;
  destroy(): void;
}
export class PointerController {
  constructor(element: HTMLElement, camera: Camera2D, model: GraphModel, spatialHash: SpatialHash2D, options?: Record<string, unknown>);
  on(type: string, callback: EventCallback): () => void;
  off(type: string, callback: EventCallback): this;
  enable(): this;
  disable(): this;
  destroy(): void;
}
export class StarClusterRoutes {
  constructor(model: GraphModel);
  beginFrame(): this;
  getPointCount(linkIndex: number): number;
  getRoute(linkIndex: number): Float32Array | null;
}
export class Graphium {
  readonly model: GraphModel;
  readonly physics: Physics2D;
  readonly camera: Camera2D;
  readonly renderer: WebGLRenderer2D;
  readonly pointer: PointerController | null;
  readonly nodeCount: number;
  readonly linkCount: number;
  readonly sleeping: boolean;
  constructor(options?: GraphiumOptions);
  on(type: string, callback: EventCallback): () => void;
  off(type: string, callback: EventCallback): this;
  addNode(id: GraphId, options?: NodeOptions): NodeSnapshot;
  addNode(node: NodeData): NodeSnapshot;
  addLink(id: GraphId, source: GraphId, target: GraphId, options?: LinkOptions): LinkSnapshot;
  addLink(link: LinkData): LinkSnapshot;
  removeNode(id: GraphId): boolean;
  removeLink(id: GraphId): boolean;
  setData(data: GraphData): this;
  getNode(id: GraphId): NodeSnapshot | null;
  getLink(id: GraphId): LinkSnapshot | null;
  setNodePosition(idOrIndex: GraphId, x: number, y: number, resetPrevious?: boolean): boolean;
  setNodeFixed(idOrIndex: GraphId, fixed?: boolean): boolean;
  setNodeState(idOrIndex: GraphId, state: NodeState | number): boolean;
  setNodeAppearance(idOrIndex: GraphId, appearance: NodeAppearance): boolean;
  setLinkAppearance(idOrIndex: GraphId, appearance: LinkAppearance): boolean;
  setAppearance(appearance: AppearanceOptions): this;
  setEdgeStar(enabled: boolean): this;
  selectNode(idOrIndex: GraphId, selected?: boolean): boolean;
  selectLink(idOrIndex: GraphId, selected?: boolean): boolean;
  pickLinkAt(worldX: number, worldY: number, hitRadius?: number): number;
  fit(padding?: number): this;
  step(dt?: number): number;
  render(): this;
  start(): this;
  stop(): this;
  destroy(): void;
  setPhysicsOptions(options: PhysicsOptions): this;
  getConflictEnergy(): number;
  measureConflictEnergy(): number;
  getConflictDiagnostics(): ConflictDiagnostics;
}
export function packRGBA(color?: RGBA): number;
export function unpackRGBA(color: number): [number, number, number, number];
export function deterministicNodeColor(id: GraphId): number;
export const NODE_FIXED: number;
export const NODE_SELECTED: number;
export const NODE_DRAGGED: number;
export const NODE_HIDDEN: number;
export const NODE_DISABLED: number;
export const LINK_SELECTED: number;
export const LINK_HIDDEN: number;
export const NODE_STATE_NORMAL: number;
export const NODE_STATE_HOVER: number;
export const NODE_STATE_SELECTED: number;
export const NODE_STATE_DRAGGING: number;
export const NODE_STATE_FIXED: number;
export const NODE_STATE_DISABLED: number;
export const LINK_STYLE_SOLID: number;
export const LINK_STYLE_DASHED: number;
export { EdgeConflictDetector2D };
export default Graphium;