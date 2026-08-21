# API Reference

Complete reference for all public classes, methods, options, and events.

---

## Graphium (Main Facade)

### Constructor
```typescript
new Graphium(options: GraphiumOptions)
```

### GraphiumOptions
```typescript
interface GraphiumOptions {
  // Required
  canvas: HTMLCanvasElement | OffscreenCanvas;

  // Lifecycle
  autoStart?: boolean;              // default: false

  // Capacity
  nodeCapacity?: number;            // default: 256
  linkCapacity?: number;            // default: 512

  // Physics
  physics?: PhysicsOptions;         // See PhysicsOptions

  // Edge Bundling
  edgeBundling?: boolean;           // default: false
  bundleMode?: 'geometric';         // default: 'geometric'
  bundleStrength?: number;          // default: 0.35
  bundleIterations?: number;        // default: 3
  bundleSubdivisions?: number;      // default: 6
  bundleCompatibility?: number;     // default: 0.65
  bundleRadius?: number;            // default: 180
  nodeSeparationLength?: number;    // default: 50
  maxBundleSize?: number;           // default: 32
  maxBundlePairs?: number;          // default: 10000
  preserveEdgeStyle?: boolean;      // default: true
  preserveEdgeIdentity?: boolean;   // default: true
  avoidNodeInteriors?: boolean;     // default: true
  bundleShortEdges?: boolean;       // default: false
  avoidSharedNodes?: boolean;       // default: false
  thresholdNodes?: number;          // default: 3
  movementThreshold?: number;       // default: 1.5
  bundleRenderMode?: 'shared' | 'parallel' | 'layered' | 'individual';  // default: 'parallel'

  // Camera
  camera?: CameraOptions;           // See CameraOptions

  // Renderer
  renderer?: Record<string, unknown>;

  // Appearance
  appearance?: AppearanceOptions;   // See AppearanceOptions

  // Interaction
  interaction?: boolean | InteractionOptions;  // default: true
}
```

### Properties
| Property | Type | Description |
|----------|------|-------------|
| `model` | `GraphModel` | Core data model |
| `physics` | `Physics2D` | Physics engine |
| `camera` | `Camera2D` | Camera/viewport |
| `renderer` | `WebGLRenderer2D` | WebGL renderer |
| `bundling` | `EdgeBundling2D` | Edge bundling |
| `pointer` | `PointerController \| null` | Interaction controller |
| `nodeCount` | `number` | Current node count (readonly) |
| `linkCount` | `number` | Current link count (readonly) |
| `sleeping` | `boolean` | Physics sleeping state (readonly) |

### Core Methods

#### `addNode(id: GraphId, options?: NodeOptions): NodeSnapshot`
```typescript
// Add or update node
graph.addNode('A', { x: 0, y: 0, color: '#ff0000' });

// Or pass object with id
graph.addNode({ id: 'B', x: 100, y: 50 });
```

#### `addLink(id: GraphId, source: GraphId, target: GraphId, options?: LinkOptions): LinkSnapshot`
```typescript
// Add or update link
graph.addLink('A-B', 'A', 'B', { strength: 0.1 });

// Or pass object
graph.addLink({ id: 'B-C', source: 'B', target: 'C' });
```

#### `removeNode(id: GraphId): boolean`
```typescript
graph.removeNode('A');  // Also removes connected links
```

#### `removeLink(id: GraphId): boolean`
```typescript
graph.removeLink('A-B');
```

#### `setData(data: GraphData): this`
```typescript
graph.setData({
  nodes: [{ id: 'A', x: 0, y: 0 }],
  links: [{ source: 'A', target: 'B' }]
});
```

#### `getNode(id: GraphId): NodeSnapshot | null`
```typescript
const node = graph.getNode('A');
```

#### `getLink(id: GraphId): LinkSnapshot | null`
```typescript
const link = graph.getLink('A-B');
```

#### `setNodePosition(idOrIndex: GraphId, x: number, y: number, resetPrevious?: boolean): boolean`
```typescript
graph.setNodePosition('A', 100, 200, true);  // resetPrevious=true clears Verlet history
```

#### `setNodeFixed(idOrIndex: GraphId, fixed?: boolean): boolean`
```typescript
graph.setNodeFixed('A', true);   // Pin in place
graph.setNodeFixed('A', false);  // Release
```

#### `setNodeState(idOrIndex: GraphId, state: NodeState | number): boolean`
```typescript
graph.setNodeState('A', 'selected');  // or NodeState enum
```

#### `setNodeAppearance(idOrIndex: GraphId, appearance: NodeAppearance): boolean`
```typescript
graph.setNodeAppearance('A', { color: '#00ff00', radius: 15 });
```

#### `setLinkAppearance(idOrIndex: GraphId, appearance: LinkAppearance): boolean`
```typescript
graph.setLinkAppearance('A-B', { color: '#0000ff', width: 3 });
```

#### `setAppearance(appearance: AppearanceOptions): this`
```typescript
graph.setAppearance({ nodeRadius: 12, edgeWidth: 2 });
```

#### `selectNode(idOrIndex: GraphId, selected?: boolean): boolean`
```typescript
graph.selectNode('A', true);
graph.selectNode('A', false);
```

#### `selectLink(idOrIndex: GraphId, selected?: boolean): boolean`
```typescript
graph.selectLink('A-B', true);
```

#### `pickLinkAt(worldX: number, worldY: number, hitRadius?: number): number`
```typescript
const linkIndex = graph.pickLinkAt(100, 200, 10);  // Returns link index or -1
```

#### `fit(padding?: number): this`
```typescript
graph.fit(40);  // Zoom to fit all nodes with 40px padding
```

#### `rebuildEdgeBundles(): this`
```typescript
graph.rebuildEdgeBundles();  // Force recompute all routes
```

#### `clearEdgeBundles(): this`
```typescript
graph.clearEdgeBundles();  // Remove all bundled routes
```

#### `setBundlingOptions(options: BundlingOptions): this`
```typescript
graph.setBundlingOptions({ bundleStrength: 0.5, bundleRenderMode: 'layered' });
```

#### `setPhysicsOptions(options: PhysicsOptions): this`
```typescript
graph.setPhysicsOptions({ repulsion: 1500, gravity: 0.005 });
```

#### `getEdgeRoute(linkId: GraphId): Float32Array | null`
```typescript
const route = graph.getEdgeRoute('A-B');  // [x0,y0,x1,y1,...]
```

#### `getBundleInfo(linkId: GraphId): BundleInfo | null`
```typescript
const info = graph.getBundleInfo('A-B');
// { linkIndex, bundleId, bundleSize, mode, pointCount }
```

#### `getConflictEnergy(): number`
```typescript
const energy = graph.getConflictEnergy();
```

#### `measureConflictEnergy(): number`
```typescript
const energy = graph.measureConflictEnergy();  // Full recomputation
```

#### `getConflictDiagnostics(): ConflictDiagnostics`
```typescript
const diag = graph.getConflictDiagnostics();
// { edgeConflictPairs, edgeCrossings, maxEdgeCorrection, edgeConflictEnergy, edgeConflictTimeMs }
```

### Animation Control

#### `step(dt?: number): number`
```typescript
const energy = graph.step(1/60);  // Single physics step
```

#### `render(): this`
```typescript
graph.render();  // Single render frame
```

#### `start(): this`
```typescript
graph.start();  // Start animation loop
```

#### `stop(): this`
```typescript
graph.stop();  // Stop animation loop
```

#### `destroy(): void`
```typescript
graph.destroy();  // Cleanup all resources
```

---

## Events

```typescript
// Subscribe
const unsubscribe = graph.on('click', (event) => { ... });

// Unsubscribe
graph.off('click', callback);
// Or use returned function
unsubscribe();
```

### Event Types

| Event | Payload | Description |
|-------|---------|-------------|
| `click` | `{ nodeIndex, nodeId, linkIndex, linkId, worldX, worldY, originalEvent }` | Node/link clicked |
| `dblclick` | `{ nodeIndex, nodeId, worldX, worldY }` | Double-click |
| `hover` | `{ nodeIndex, nodeId, worldX, worldY }` | Hover changed (nodeIndex = -1 if none) |
| `drag` | `{ nodeIndex, nodeId, worldX, worldY }` | Node dragging |
| `dragend` | `{ nodeIndex, nodeId, worldX, worldY }` | Drag ended |
| `pan` | `{ worldX, worldY, deltaX, deltaY }` | Canvas panned |
| `zoom` | `{ zoom, worldX, worldY, factor }` | Zoom changed |
| `pinch` | `{ scale, centerX, centerY, worldX, worldY }` | Pinch gesture |
| `longpress` | `{ nodeIndex, nodeId, worldX, worldY }` | Long press |
| `contextmenu` | `{ nodeIndex, nodeId, linkIndex, linkId, worldX, worldY, preventDefault }` | Right-click/long-press |
| `sleep` | `{ energy }` | Physics went to sleep |
| `wake` | `{}` | Physics woke up |
| `edgeconflict` | `{ edgeAId, edgeBId, edgeAIndex, edgeBIndex, type, severity, distance, angle }` | Edge conflict detected |
| `edgeconflictsolved` | `{ energy }` | Conflicts resolved |
| `bundleupdated` | `{ revision }` | Bundles recomputed |
| `dataupdated` | `{ nodeCount, linkCount }` | Data changed via setData() |
| `start` | `{}` | Animation started |
| `stop` | `{}` | Animation stopped |

---

## PhysicsOptions

```typescript
interface PhysicsOptions {
  // Integration
  damping?: number;              // default: 0.88
  maxSpeed?: number;             // default: 1200
  fixedDt?: number;              // default: 1/60

  // Forces
  gravity?: number;              // default: 0.003
  repulsion?: number;            // default: 900
  degreeFactor?: number;         // default: 0.05
  degreeExponent?: number;       // default: 0.75
  repulsionRadius?: number;      // default: 180
  physicalRadiusScale?: number;  // default: 1
  collisionStrength?: number;    // default: 1
  positionIterations?: number;   // default: 3
  springStrength?: number;       // default: 0.08

  // Temperature
  temperature?: number;          // default: 1
  cooling?: number;              // default: 0.995
  minTemperature?: number;       // default: 0.02

  // Sleep
  sleepEnergy?: number;          // default: 0.0008
  sleepFrames?: number;          // default: 45
  maxNeighbors?: number;         // default: 256

  // Edge Conflicts
  edgeRepulsionEnabled?: boolean;         // default: true
  edgeMinSeparation?: number;             // default: 18
  edgeRepulsionStrength?: number;         // default: 0.8
  edgeProximityStrength?: number;         // default: 0.35
  edgeAlignmentStrength?: number;         // default: 0.5
  crossingStrength?: number;              // default: 1
  crossingAngleStrength?: number;         // default: 0.5
  preferredCrossingAngle?: number;        // default: Math.PI/2
  edgeRepulsionIterations?: number;       // default: 2
  edgeRepulsionMaxPairs?: number;         // default: 10000
  maxEdgeCorrection?: number;             // default: 12
  edgeConflictDamping?: number;           // default: 0.85
  preserveEdgeLength?: number;            // default: 0.75
  maxLengthRatio?: number;                // default: 2.5
  lengthStretchPenalty?: number;          // default: 0.25
  edgeConflictWakeThreshold?: number;     // default: 0.2
  edgeConflictSleepThreshold?: number;    // default: 0.02
  edgeConflictEnergyScale?: number;       // default: 1
  draggedNodeConflictWeight?: number;     // default: 0.1
  sharedEndpointExclusion?: number;       // default: 0.18
  edgeConflictUseBundledRoutes?: boolean; // default: false
  edgeConflictCellSize?: number;          // default: 48
  edgeConflictEvents?: boolean;           // default: false
  edgeConflictRebuildThreshold?: number;  // default: 1
}
```

---

## CameraOptions

```typescript
interface CameraOptions {
  width?: number;      // Canvas width
  height?: number;     // Canvas height
  x?: number;          // World X center
  y?: number;          // World Y center
  zoom?: number;       // Zoom level (default: 1)
  minZoom?: number;    // Minimum zoom
  maxZoom?: number;    // Maximum zoom
}
```

### Camera2D Methods
```typescript
camera.setViewport(width, height)
camera.setPosition(x, y)
camera.setZoom(zoom)
camera.pan(dx, dy)
camera.zoomAt(factor, screenX, screenY)
camera.worldToScreen2D(worldX, worldY)  // → { x, y }
camera.screenToWorld2D(screenX, screenY)  // → { x, y }
camera.fit(minX, minY, maxX, maxY, padding)
```

---

## AppearanceOptions

```typescript
interface AppearanceOptions {
  // Nodes
  nodeRadius?: number;              // default: 8
  nodeVisualRadius?: number;        // default: undefined (uses nodeRadius)
  nodeBorderEnabled?: boolean;      // default: true
  nodeBorderWidth?: number;         // default: 0
  nodeBorderColor?: RGBA;           // default: '#ffffff'
  nodeBorderOpacity?: number;       // default: 1
  nodeOpacity?: number;             // default: 1

  // Edges
  edgeWidth?: number;               // default: 1.25
  edgeColor?: RGBA;                 // default: '#8b949e'
  edgeOpacity?: number;             // default: 0.72
  edgeCap?: 'round' | 'butt';       // default: 'round'
  edgeJoin?: 'round' | 'bevel';     // default: 'round'

  // Rings
  hoverRingColor?: RGBA;            // default: '#007aff'
  hoverRingWidth?: number;          // default: 2
  selectedRingColor?: RGBA;         // default: '#ff9f0a'
  selectedRingWidth?: number;       // default: 3
  fixedRingColor?: RGBA;            // default: '#64748b'
  fixedRingWidth?: number;          // default: 1.5

  // States
  draggingOpacity?: number;         // default: 1
  disabledOpacity?: number;         // default: 0.45
  selectedEdgeColor?: RGBA;         // default: '#007aff'
  selectedEdgeWidthMultiplier?: number;  // default: 1.8
  selectedEdgeOpacity?: number;     // default: 1
}
```

---

## NodeOptions / NodeData

```typescript
interface NodeOptions extends NodeAppearance {
  x?: number;
  y?: number;
  radius?: number;
  mass?: number;
  fixed?: boolean;
}

interface NodeData extends NodeOptions {
  id: GraphId;  // Required
}
```

### NodeAppearance
```typescript
interface NodeAppearance {
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
```

---

## LinkOptions / LinkData

```typescript
interface LinkOptions extends LinkAppearance {
  restLength?: number;
  strength?: number;
}

interface LinkData extends LinkOptions {
  id?: GraphId;
  source: GraphId;
  target: GraphId;
}
```

### LinkAppearance
```typescript
interface LinkAppearance {
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
}
```

---

## Type Definitions

```typescript
type GraphId = string | number;

type RGBA = string | number | [number, number, number, number?];

type NodeState = 'normal' | 'hover' | 'selected' | 'dragging' | 'fixed' | 'disabled';

type LinkStyle = 'solid' | 'dashed';

interface GraphData {
  nodes?: NodeData[];
  links?: LinkData[];
}

interface NodeSnapshot extends NodeData {
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

interface LinkSnapshot extends LinkData {
  sourceIndex: number;
  targetIndex: number;
  color: number;
  dashPattern: [number, number];
}

interface BundleInfo {
  linkIndex: number;
  bundleId: number;
  bundleSize: number;
  mode: string;
  pointCount: number;
}

interface ConflictDiagnostics {
  edgeConflictPairs: number;
  edgeCrossings: number;
  maxEdgeCorrection: number;
  edgeConflictEnergy: number;
  edgeConflictTimeMs: number;
}
```

---

## Physics2D

```typescript
class Physics2D {
  sleeping: boolean;
  energy: number;
  temperature: number;
  edgeConflictEnergy: number;

  constructor(model: GraphModel, spatialHash: SpatialHash2D, options?: PhysicsOptions)

  setOptions(options: PhysicsOptions): void
  setRouteProvider(provider: EdgeBundling2D): this
  getConflictDiagnostics(): ConflictDiagnostics
  measureConflictEnergy(): number
  wake(): void
  reset(): void
  step(dt?: number): number  // Returns energy

  // Callbacks
  onSleep: (energy: number) => void | null;
  onWake: () => void | null;
  onEdgeConflict: (edgeA, edgeB, type, severity, distance, angle) => void | null;
  onEdgeConflictSolved: (energy: number) => void | null;
}
```

---

## EdgeBundling2D

```typescript
class EdgeBundling2D {
  dirty: boolean;
  routeRevision: number;

  constructor(model: GraphModel, options?: BundlingOptions)

  setOptions(options: BundlingOptions): void
  markDirty(): void
  rebuild(): this
  updateIfNeeded(force?: boolean): this
  clear(): void
  getRoute(index: number): Float32Array | null
  getPointCount(index: number): number
  getRouteSnapshot(index: number): Float32Array | null
  getBundleInfo(index: number): BundleInfo
}
```

---

## SpatialHash2D

```typescript
class SpatialHash2D {
  cellSize: number;

  constructor(options?: { cellSize?: number; nodeCapacity?: number; tableCapacity?: number })

  setCellSize(value: number): void
  rebuild(x, y, count, hidden?): void
  queryRadiusInto(x, y, radius, output: Int32Array): number
  pickNodeInto(x, y, positionsX, positionsY, radii, output: Int32Array): number
}
```

---

## EdgeConflictDetector2D

```typescript
class EdgeConflictDetector2D {
  lastEnergy: number;
  persistentConflict: boolean;
  debug: ConflictDiagnostics;

  constructor(model: GraphModel, options?: PhysicsOptions)

  setRouteProvider(provider: EdgeBundling2D): this
  setOptions(options: PhysicsOptions): this
  ensureNodeCapacity(required: number): void
  evaluate(applyCorrections?: boolean): number
  apply(): number
  measure(): number

  onConflict: (edgeA, edgeB, type, severity, distance, angle) => void | null;
  onSolved: (energy: number) => void | null;
}
```

---

## Coarsening2D

```typescript
class Coarsening2D {
  levels: Array<{ nodeCount: number; fineToCoarse: Int32Array }>;

  constructor(model: GraphModel, options?: { enabled?: boolean; maxLevels?: number; minNodes?: number })

  build(): Array<{ nodeCount: number; fineToCoarse: Int32Array }>
  getLevel(index?: number): { nodeCount: number; fineToCoarse: Int32Array } | null
}
```

---

## WebGLRenderer2D

```typescript
class WebGLRenderer2D {
  constructor(canvas?: HTMLCanvasElement | OffscreenCanvas | null, options?: Record<string, unknown>)

  attachCanvas(canvas: HTMLCanvasElement | OffscreenCanvas): boolean
  setCamera(camera: Camera2D): this
  setAppearance(appearance?: AppearanceOptions): this
  resize(width?: number, height?: number, pixelRatio?: number): this
  render(model: GraphModel, routes?: EdgeBundling2D): void
  destroy(): void
}
```

---

## PointerController

```typescript
class PointerController {
  constructor(
    element: HTMLElement,
    camera: Camera2D,
    model: GraphModel,
    spatialHash: SpatialHash2D,
    options?: Record<string, unknown>
  )

  on(type: string, callback: EventCallback): () => void
  off(type: string, callback: EventCallback): this
  enable(): this
  disable(): this
  destroy(): void
}
```

---

## GraphModel

```typescript
class GraphModel {
  // Counts
  nodeCount: number;
  linkCount: number;
  topologyRevision: number;
  positionRevision: number;
  appearanceRevision: number;

  // Arrays (direct access - use with caution)
  x, y: Float32Array;
  px, py: Float32Array;
  // ... all arrays from Data Model docs

  constructor(options?: { nodeCapacity?: number; linkCapacity?: number; nodeDefaults?: NodeAppearance; linkDefaults?: LinkAppearance })

  getNodeIndex(id: GraphId): number
  getLinkIndex(id: GraphId): number
  getNodeId(index: number): GraphId
  getLinkId(index: number): GraphId

  addNode(id: GraphId, options?: NodeOptions): number
  addLink(id: GraphId, source: GraphId, target: GraphId, options?: LinkOptions): number
  removeNode(id: GraphId): boolean
  removeLink(id: GraphId): boolean

  setNodePosition(index: number, x: number, y: number, resetPrevious?: boolean): void
  setNodeFixed(index: number, fixed: boolean): void
  setNodeState(index: number, state: NodeState | number): void
  setNodeAppearance(index: number, appearance?: NodeAppearance): void
  setLinkAppearance(index: number, appearance?: LinkAppearance): void

  setData(data: GraphData): this
  clear(): void

  getNodeSnapshot(index: number): NodeSnapshot
  getLinkSnapshot(index: number): LinkSnapshot

  isNodeFixed(index: number): boolean
  isNodeHidden(index: number): boolean
  isNodeDisabled(index: number): boolean
  isLinkHidden(index: number): boolean
}
```

---

## Utility Functions

```typescript
// Color utilities
packRGBA(color?: RGBA): number
unpackRGBA(color: number): [number, number, number, number]
deterministicNodeColor(id: GraphId): number

// Constants
NODE_FIXED, NODE_SELECTED, NODE_DRAGGED, NODE_HIDDEN, NODE_DISABLED
LINK_SELECTED, LINK_HIDDEN
NODE_STATE_NORMAL, NODE_STATE_HOVER, NODE_STATE_SELECTED, NODE_STATE_DRAGGING, NODE_STATE_FIXED, NODE_STATE_DISABLED
LINK_STYLE_SOLID, LINK_STYLE_DASHED
```

---

## Complete Usage Example

```html
<canvas id="graph" width="1200" height="800"></canvas>
<script type="module">
import { Graphium } from './src/Graphium.js';

const graph = new Graphium({
  canvas: document.getElementById('graph'),
  autoStart: true,
  physics: {
    repulsion: 1500,
    springStrength: 0.05,
    gravity: 0.002
  },
  appearance: {
    nodeRadius: 12,
    edgeWidth: 2,
    edgeColor: '#58a6ff'
  }
});

// Build graph
graph.addNode('server', { x: 0, y: 0, color: '#ff6b6b', fixed: true, label: 'API' });
graph.addNode('db', { x: -200, y: 150, color: '#4ecdc4', label: 'DB' });
graph.addNode('cache', { x: 200, y: 150, color: '#ffe66d', label: 'Redis' });
graph.addNode('worker-1', { x: -300, y: 300, color: '#a8e6cf' });
graph.addNode('worker-2', { x: -100, y: 300, color: '#a8e6cf' });
graph.addNode('worker-3', { x: 100, y: 300, color: '#a8e6cf' });
graph.addNode('worker-4', { x: 300, y: 300, color: '#a8e6cf' });

graph.addLink('server-db', 'server', 'db', { color: '#ff6b6b', width: 2 });
graph.addLink('server-cache', 'server', 'cache', { color: '#ffe66d', width: 2 });
graph.addLink('server-w1', 'server', 'worker-1', { color: '#a8e6cf' });
graph.addLink('server-w2', 'server', 'worker-2', { color: '#a8e6cf' });
graph.addLink('server-w3', 'server', 'worker-3', { color: '#a8e6cf' });
graph.addLink('server-w4', 'server', 'worker-4', { color: '#a8e6cf' });

// Events
graph.on('click', (e) => {
  if (e.nodeId) console.log('Clicked node:', e.nodeId);
  if (e.linkId) console.log('Clicked link:', e.linkId);
});

graph.on('sleep', (e) => {
  console.log('Layout settled, energy:', e.energy);
});
</script>
```