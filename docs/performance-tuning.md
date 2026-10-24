# Performance Tuning Guide

Learn how to optimize Graphium for maximum performance, from reducing rendering overhead to minimizing physics calculations and managing memory efficiently.

## Understanding Graphium's Performance Characteristics

Graphium is designed for high-performance graph visualization, but like any complex visualization library, performance depends on several factors:

### Rendering Pipeline
1. **Physics Simulation**: Calculates forces, updates positions, handles collisions
2. **State Update**: Updates internal node/link states (colors, sizes, etc.)
3. **Render Preparation**: Prepares data for GPU upload (buffer updates)
4. **GPU Rendering**: Draws nodes, edges, labels, and effects
5. **DOM Updates**: Updates HTML labels and toolbars (if used)

### Key Performance Factors
- **Node Count**: Primary factor affecting physics (O(n²) worst-case, O(n) average with spatial hashing)
- **Link Count**: Affects rendering complexity (more links = more GPU draw calls)
- **Image Count**: Affects texture atlas updates and GPU memory usage
- **Label Count**: Affects DOM manipulation and layout thrashing
- **Interaction Frequency**: How often events like drag/zoom trigger updates
- **Visual Complexity**: Effects like gradients, shadows, complex shaders

## Performance Measurement

### Built-in Statistics
```ts
// Get a snapshot of live performance counters
const stats = graph.stats();

/*
Returns:
{
  nodeCount: 150,       // Number of nodes in the graph
  linkCount: 200,       // Number of links in the graph
  fps: 60,              // Rolling average of frames per second
  frameMs: 2.3,         // Rolling average of frame time (ms)
  physicsMs: 0.8,       // Time spent in the physics step of the last frame (ms)
  renderMs: 1.2,        // Time spent in the GPU render pass (ms)
  sleeping: false       // Whether the simulation is currently asleep
}
*/
```

The loop only steps physics and repaints while something is dirty, so `frameMs` near zero together with `sleeping: true` means the graph is idle and costing almost nothing.

### Frame Timing API
```ts
// Monitor frame times for jank detection
let lastFrameTime = performance.now();
let frameTimes = [];

function monitorFrameRate() {
  const now = performance.now();
  const frameTime = now - lastFrameTime;
  lastFrameTime = now;
  
  frameTimes.push(frameTime);
  if (frameTimes.length > 100) {
    frameTimes.shift(); // Keep last 100 frames
  }
  
  // Calculate statistics
  if (frameTimes.length >= 10) {
    const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const max = Math.max(...frameTimes);
    const min = Math.min(...frameTimes);
    const jankCount = frameTimes.filter(t => t > 16.67).length; // >60fps threshold
    
    console.log(`Frame stats: avg=${avg.toFixed(1)}ms, min=${min.toFixed(1)}ms, max=${max.toFixed(1)}ms, jank=${jankCount}`);
  }
  
  requestAnimationFrame(monitorFrameRate);
}

// Start monitoring
requestAnimationFrame(monitorFrameRate);
```

### Custom Performance Markers
```ts
// Instrument specific operations
function measureOperation(name, operation) {
  const start = performance.now();
  const result = operation();
  const end = performance.now();
  
  console.log(`${name}: ${(end - start).toFixed(2)}ms`);
  return result;
}

// Usage
const nodes = measureOperation("Node creation", () => {
  return [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    // ...
  ];
});

const layoutTime = measureOperation("Layout calculation", () => {
  graph.setData({ nodes, links });
  // Wait for layout to stabilize (simplified)
  return new Promise(resolve => setTimeout(resolve, 1000));
});
```

## Optimization Strategies

### 1. Reduce Node Count (Most Impactful)
```ts
// Instead of showing all 10,000 nodes, show a representative sample
function getSampledNodes(fullNodeSet, sampleSize = 500) {
  if (fullNodeSet.length <= sampleSize) {
    return fullNodeSet;
  }
  
  // Strategy 1: Random sampling
  // return shuffle(fullNodeSet).slice(0, sampleSize);
  
  // Strategy 2: Stratified sampling (preserve distribution)
  // return stratifiedSample(fullNodeSet, sampleSize, 'nodeType');
  
  // Strategy 3: Degree-based sampling (show highly connected nodes)
  // return fullNodeSet
  //   .sort((a, b) => b.degree - a.degree)
  //   .slice(0, sampleSize);
  
  // Strategy 4: Geographic clustering (for spatial graphs)
  // return clusterSample(fullNodeSet, sampleSize);
}

// Or use level-of-detail based on zoom level
graph.on('zoom', event => {
  const nodeCount = getOptimalNodeCountForZoom(event.zoomLevel);
  
  if (nodeCount !== currentNodeCount) {
    updateDisplayedNodes(nodeCount);
    currentNodeCount = nodeCount;
  }
});

function getOptimalNodeCountForZoom(zoomLevel) {
  // Show fewer nodes when zoomed out (seeing the forest)
  // Show more nodes when zoomed in (seeing the trees)
  if (zoomLevel < 0.5) {
    return Math.min(200, totalNodes * 0.02); // 2% when very zoomed out
  } else if (zoomLevel < 2.0) {
    return Math.min(500, totalNodes * 0.1);   // 10% at medium zoom
  } else {
    return totalNodes; // Show all when zoomed in
  }
}
```

### 2. Optimize Link Count
```ts
// Strategy 1: Link sampling for dense graphs
function sampleLinksForDensity(links, maxLinksPerNode = 10) {
  const linkMap = new Map(); // nodeId -> array of links
  
  // Group links by source node
  links.forEach(link => {
    if (!linkMap.has(link.source)) {
      linkMap.set(link.source, []);
    }
    linkMap.get(link.source).push(link);
  });
  
  // Sample links for each node
  const sampledLinks = [];
  linkMap.forEach((nodeLinks, nodeId) => {
    if (nodeLinks.length <= maxLinksPerNode) {
      sampledLinks.push(...nodeLinks);
    } else {
      // Sort by importance (weight, recency, etc.) and take top N
      const sortedLinks = nodeLinks
        .sort((a, b) => (b.weight || 1) - (a.weight || 1))
        .slice(0, maxLinksPerNode);
      sampledLinks.push(...sortedLinks);
    }
  });
  
  return sampledLinks;
}

// Strategy 2: Link bundling (conceptual - would require custom rendering)
// Instead of drawing 100 parallel links, draw 1 thick link representing the bundle

// Strategy 3: Hierarchical edge bundling
// Group links by common destinations and render them sharing paths

// Strategy 4: Show links only on demand
graph.on('hover', event => {
  if (event.nodeId) {
    // Show all connections of hovered node
    showAllConnections(event.nodeId);
  }
});

graph.on('hover', event => {
  if (event.nodeIndex < 0) {
    // Pointer left every node: hide connections unless selected
    hideConnectionsUnlessSelected();
  }
});
```

### 3. Optimize Images
```ts
// 1. Resize images to appropriate dimensions
//    - 64x64 to 128x128 pixels is usually sufficient for node avatars
//    - Larger images waste GPU memory and bandwidth

// 2. Use appropriate formats
//    - JPEG for photographs (quality 80-85)
//    - PNG for graphics with transparency
//    - WebP for best compression (browser permitting)

// 3. Keep the atlas small: it holds 64 concurrent images in fixed 128px cells
//    and there is no size or cache configuration. Reuse the same URL across
//    nodes (deduplicated), serve images near 128x128px, and rely on automatic
//    slot recycling: a URL dropped by every rendered frame frees its slot.

// 4. Load images on demand by computing visibility yourself
const imageUrls = new Map(); // nodeId -> url, your application data

graph.on('pointerup', () => {
  const center = graph.screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
  // ... pick the ids your app considers visible and assign their images
  // graph.setNodeImage(id, imageUrls.get(id));
});

// 5. There is no placeholder option: nodes render their fill color until the
//    image arrives. To avoid a visible pop, await graph.loadImages() before
//    revealing the container, or listen for imageerror and style the node.

// 6. Batch image updates to minimize atlas rebuilds
function batchSetNodeImages(imageUpdates) {
  // imageUpdates = [{nodeId: 'a', url: 'url1'}, {nodeId: 'b', url: 'url2'}, ...]

  // The atlas uploads once per frame at most, but helping it still pays off:
  // 1. Grouping updates by time
  // 2. Avoiding updates during animations
  // 3. Using requestAnimationFrame for non-urgent updates

  imageUpdates.forEach(update => {
    requestAnimationFrame(() => {
      graph.setNodeImage(update.nodeId, update.url);
    });
  });
}
```

### 4. Optimize Labels
```ts
// 1. Disable labels for large graphs
if (totalNodes > 1000) {
  graph.setTheme({ label: { enabled: false } });
} else {
  graph.setTheme({ label: { enabled: true, size: 12 } });
}

// 2. Show labels only on hover or selection
graph.setTheme({ label: { enabled: false } }); // Disable by default

graph.on('hover', event => {
  if (event.nodeId) {
    // Temporarily enable label for hovered node
    const node = graph.getNode(event.nodeId);
    if (node) {
      // Store original label setting
      node._originalLabelEnabled = node.theme.label?.enabled;
      
      // Enable label for this node only
      // Would require per-node label control (conceptual)
      // Alternative: use tooltip or overlay instead
      showTooltip(node.label, event.worldX, event.worldY);
    }
  }
});

graph.on('hover', event => {
  if (event.nodeIndex < 0) {
    // Pointer left every node: hide the tooltip
    hideTooltip();
  }
});

// 3. Use label pooling effectively (Graphium does this automatically)
//    - Label pool is capped at 400 elements by default
//    - Labels are recycled as nodes enter/leave viewport
//    - Minimize label creation/destruction by keeping viewport stable

// 4. Optimize label text
//    - Keep labels short (1-20 characters ideal)
//    - Avoid HTML in labels (plain text only)
//    - Use consistent formatting to reduce layout thrashing

// 5. Consider canvas-based labels for extremely large graphs
//    - Instead of DOM labels, render text directly to canvas
//    - Much better performance but less flexible styling
//    - Would require custom renderer extension or future Graphium feature
```

### 5. Optimize Physics Calculations
```ts
// 1. Use appropriate physics presets for your graph type
const presets = {
  'social-network': 'silk',      // Moderate density, need community detection
  'flowchart': 'crystal',        // Low density, need clean layout
  'molecular': 'liquid',         // Very specific distances needed
  'telecom': 'bouncy',           // High density, need to avoid occlusion
  'dependency-graph': 'silk'     // Moderate density, need clear hierarchies
};

graph.usePreset(presets[graphType] || 'silk');

// 2. Tune physics parameters for performance
function optimizePhysicsForNodeCount(nodeCount) {
  if (nodeCount > 2000) {
    // Large graph optimizations
    return {
      repulsionRadius: 150,      // Reduced from 200 - fewer neighbors to check
      maxNeighbors: 64,          // Reduced from 128 - harder cap
      positionIterations: 1,     // Reduced from 2 - faster but less stable
      sleepEnergy: 0.0002,       // Reduced from 0.0004 - sleeps easier
      sleepFrames: 24,           // Reduced from 48 - sleeps faster
      edgeSeparation: 0.3        // Reduced from 0.45 - less edge untangling
    };
  } else if (nodeCount > 500) {
    // Medium graph optimizations
    return {
      repulsionRadius: 180,
      maxNeighbors: 96,
      positionIterations: 1,
      sleepEnergy: 0.0003,
      sleepFrames: 36,
      edgeSeparation: 0.35
    };
  } else {
    // Small graph - use defaults or quality settings
    return {
      repulsionRadius: 200,
      maxNeighbors: 128,
      positionIterations: 2,
      sleepEnergy: 0.0004,
      sleepFrames: 48,
      edgeSeparation: 0.45
    };
  }
}

// Apply optimizations
const physicsOpts = optimizePhysicsForNodeCount(graph.model.nodeCount);
graph.setPhysics(physicsOpts);

// 3. Disable expensive features when not needed
if (!needEdgeUntangling) {
  graph.setPhysics({ edgeSeparation: 0 }); // Disables edge separation solver
}

if (!needCollisionDetection) {
  graph.setPhysics({ collisionStrength: 0 }); // Disables collision resolution
}

// 4. Use manual control for batch updates
graph.stop(); // Stop the simulation

// Make many changes
graph.setData(newData1);
graph.setData(newData2);
// ...
graph.setData(finalData);

graph.start(); // Restart simulation - processes all changes at once

// 5. Reboot instead of stopping/starting for minor adjustments
//    - Preserves current heat/velocity state
//    - Faster to stabilize than cold start
graph.reboot();

// 6. Consider fixed timestep for consistent performance
//    - Instead of variable frame rate, lock to 30fps or 60fps
//    - Would require custom render loop modification
```

### 6. Optimize Rendering Calls
```ts
// 1. Minimize state changes between draw calls
//    - Group nodes by similar properties (color, size, image)
//    - Graphium does this internally via instanced rendering, but you can help

// 2. Use image atlasing effectively (already done by Graphium)
//    - Ensure images are power-of-two dimensions for best GPU packing
//    - Use similar sized images to minimize atlas fragmentation

// 3. Disable unused features
graph.setTheme({
  // Disable expensive features when not needed
  hoverRing: { width: 0 },      // Disable hover rings
  selectedRing: { width: 0 },   // Disable selection rings
  node: { borderWidth: 0 },     // Disable node borders
  edge: { 
    width: 1,                   // Thin lines
    arrowEnabled: false,        // Disable arrow heads
    style: 'solid'              // Solid lines
  }
});

// 4. Simplify complex gradients/effects
//    - Instead of per-node gradients, use limited color palette
//    - Instead of per-node shadows, use global ambient occlusion approximation
//    - Instead of complex shaders, use simpler lighting models

// 5. Use frustum culling conceptually
//    - Graphium already renders only what's in view via camera transform
//    - But you can help by ensuring nodes outside view don't consume resources
//    - Label pooling helps here - off-screen labels are recycled

// 6. Consider reducing render frequency for static graphs
//    - If graph rarely changes, render only on demand
graph.setOptions({ renderOnDemand: true }); // Hypothetical API

//    - Or manually control rendering
graph.stop(); // Stop automatic rendering

// Make changes as needed
// ...

// Request render only when needed
graph.requestRender(); // Forces one render frame

// Or render at fixed interval
setInterval(() => {
  graph.requestRender();
}, 1000 / 15); // 15fps for mostly static content
```

### 7. Memory Management
```ts
// 1. Monitor and control memory usage
setInterval(() => {
  const stats = graph.stats();

  // The atlas holds at most 64 images at once and recycles freed slots
  // automatically; track distinct image URLs in your own data if you
  // need a usage signal.

  if (stats.nodeCount > 50000) {
    console.warn(`High node count: ${stats.nodeCount}`);
  }

  // Trigger garbage collection hint (in browsers that support it)
  if (window.gc) {
    window.gc();
  }
}, 5000);

// 2. Dispose of resources properly
function cleanupGraph() {
  // Remove all event listeners
  // (Would need to track them - see event management patterns)
  
  // Clear data
  graph.setData({ nodes: [], links: [] });
  
  // Destroy graph instance
  graph.destroy();
  
  // Null reference
  graph = null;
  
  // Suggest garbage collection
  if (window.gc) {
    window.gc();
  }
}

// 3. Reuse graph instances when possible
//    - Instead of destroying and creating, reset and reuse
function reuseGraph(newData) {
  // Keep the same graph instance
  // Clear existing data
  graph.setData({ nodes: [], links: [] });
  
  // Add new data
  graph.setData(newData);
  
  // Reset camera to default
  graph.fit(50);
  
  // Reset theme to default
  graph.setTheme({ name: 'midnight' });
  
  // Reset interaction to default
  graph.setInteraction({
    dragEnabled: true,
    zoomEnabled: true,
    panEnabled: true,
    hoverEnabled: true
  });
  
  // This avoids the overhead of creating/destroying WebGL resources
}
```

## Specific Optimization Scenarios

### Scenario 1: Large Social Network (10K+ nodes)
```ts
// Optimization targets: physics calculation, rendering, memory
const largeSocialNetConfig = {
  // Physics - prioritize stability over perfect accuracy
  physics: {
    repulsion: 800,              // Reduced repulsion for large graphs
    repulsionRadius: 120,        // Smaller radius = fewer neighbor checks
    springStrength: 0.03,        // Weaker springs = less tension
    gravity: 0.0015,             // Less gravity = less drift
    damping: 0.94,               // Higher damping = faster settling
    positionIterations: 1,       // Fewer iterations = faster physics
    sleepEnergy: 0.0002,         // Easier to sleep
    sleepFrames: 20,             // Sleeps faster
    maxNeighbors: 48,            // Hard limit on neighbors
    edgeSeparation: 0.2,         // Less edge untangling = faster
    dragSmooth: 0.3,             // Less elastic drag
    throwFactor: 0.8             // Less momentum
  },

  // Rendering - minimize draw calls and state changes
  theme: {
    node: {
      radius: 8,                 // Smaller nodes
      borderWidth: 0,            // No borders
      color: '#7f7f7f',          // Fallback fill when no palette color applies
      colorPalette: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd']
    },
    edge: {
      color: '#bbb',
      width: 0.8,
      arrowEnabled: false
    },
    label: {
      enabled: false,            // Disable labels for performance
      size: 10
    },
    hoverRing: { width: 0 },     // Disable hover effects
    selectedRing: { width: 2 }   // Minimal selection indicator
  },
  
  // Images - the atlas is fixed at 64 slots; keep distinct URLs low
  // and reuse the same URL across nodes (deduplicated by the atlas)
  
  // Interaction - reduce expensive feedback
  interaction: {
    wheelZoomSpeed: 1.3,         // Fewer zoom steps per wheel notch
    dragEnabled: true,
    zoomEnabled: true,
    panEnabled: true,
    hoverEnabled: false          // No hover picking saves a spatial query per move
  }
};

// Apply configuration
Object.entries(largeSocialNetConfig.physics).forEach(([key, value]) => {
  const physicsUpdate = {};
  physicsUpdate[key] = value;
  graph.setPhysics(physicsUpdate);
});

Object.entries(largeSocialNetConfig.theme).forEach(([key, value]) => {
  const themeUpdate = {};
  themeUpdate[key] = value;
  graph.setTheme(themeUpdate);
});

graph.setInteraction(largeSocialNetConfig.interaction);
```

### Scenario 2: Real-Time Trading Dashboard (100-500 nodes, frequent updates)
```ts
// Optimization targets: interaction responsiveness, update frequency, low latency
const realTimeDashboardConfig = {
  // Physics - prioritize responsiveness
  physics: {
    repulsion: 1000,             // Standard repulsion
    repulsionRadius: 180,        // Standard radius
    springStrength: 0.06,        // Standard/stronger springs
    gravity: 0.002,              // Standard gravity
    damping: 0.88,               // Lower damping = more responsive
    positionIterations: 2,       // Standard iterations
    sleepEnergy: 0.0008,         // Harder to sleep = more responsive
    sleepFrames: 60,             // Takes longer to sleep
    maxNeighbors: 96,
    edgeSeparation: 0.5,         // More edge untangling for clarity
    dragSmooth: 0.25,            // Very responsive drag
    throwFactor: 1.5             // More momentum for natural feel
  },

  // Rendering - prioritize clarity and update speed
  theme: {
    node: {
      radius: 12,                // Larger for readability
      borderWidth: 1,            // Thin border
      color: '#999999',          // Fallback fill when no palette color applies
      colorPalette: ['#0066ff', '#00cc66', '#ff6600', '#cc0066', '#6600cc']
    },
    edge: {
      color: '#666',
      width: 1.5,
      arrowEnabled: true,
      arrowSize: 6,
      style: 'dashed'
    },
    label: {
      enabled: true,
      size: 11,
      color: '#333',
      background: 'rgba(255,255,255,0.8)',
      radius: 3
    },
    hoverRing: { 
      color: '#0066ff',
      width: 3
    },
    selectedRing: { 
      color: '#ff6600',
      width: 3
    }
  },
  
  // Images - reuse shared URLs so frequent updates stay inside 64 slots
  
  // Interaction - optimize for real-time feel
  interaction: {
    wheelZoomSpeed: 1.2,         // Standard zoom sensitivity
    dragThreshold: 2,            // Start drags quickly
    dragEnabled: true,
    zoomEnabled: true,
    panEnabled: true,
    hoverEnabled: true
  }
};

// Apply configuration (similar to previous example)
```

### Scenario 3: Static Documentation Diagram (<50 nodes, rarely changes)
```ts
// Optimization targets: image quality, print readiness, minimal interaction
const staticDiagramConfig = {
  // Physics - quality over performance
  physics: {
    repulsion: 1200,             // Higher repulsion for clean layout
    repulsionRadius: 250,        // Larger radius for better separation
    springStrength: 0.04,        // Standard springs
    gravity: 0.0022,             // Standard gravity
    damping: 0.93,               // Higher damping for stability
    positionIterations: 3,       // More iterations for quality
    sleepEnergy: 0.0001,         // Very easy to sleep
    sleepFrames: 15,             // Sleeps very quickly
    maxNeighbors: 128,
    edgeSeparation: 0.6          // Aggressive edge untangling
  },
  
  // Rendering - prioritize visual quality
  theme: {
    node: { 
      radius: 16,                // Larger for detail
      borderWidth: 2,            // Noticeable border
      colorPalette: ['#e63946', '#f1faee', '#a8dadc', '#457b9d', '#1d3557'],
      color: '#6c757d'
    },
    edge: { 
      color: '#6c757d',
      width: 2,
      arrowEnabled: true,
      arrowSize: 8,
      style: 'dashed'
    },
    label: { 
      enabled: true,
      size: 14,
      color: '#212529',
      background: 'rgba(255,255,255,0.7)',
      borderRadius: 4,
      fontFamily: "'Georgia', serif"
    },
    hoverRing: { 
      color: '#457b9d',
      width: 3
    },
    selectedRing: { 
      color: '#e63946',
      width: 4
    }
  },
  
  // Images - serve pre-resized 128px assets; no placeholder option exists,
  // await graph.loadImages() before revealing the container
  
  // Interaction - minimal, mostly for viewing
  interaction: {
    dragEnabled: false,          // No node dragging
    zoomEnabled: true,           // Allow zooming for detail
    panEnabled: true,            // Allow panning
    hoverEnabled: true           // Allow tooltips
  }
};
```

## Advanced Optimization Techniques

### 1. Custom Rendering Bypass
```ts
// For absolute maximum performance, bypass Graphium's rendering entirely
// and render directly to the same canvas (advanced use case only)

// 1. Get access to the underlying renderer
const renderer = graph.renderer; // Assuming such a property exists

// 2. Access the GL context
const gl = renderer.gl; // WebGL2 rendering context

// 3. Render your custom objects directly
function renderCustomOverlay() {
  // Save current GL state
  const previousBlend = gl.getParameter(gl.BLEND);
  const previousDepthTest = gl.getParameter(gl.DEPTH_TEST);
  
  // Set up for overlay rendering
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.disable(gl.DEPTH_TEST);
  
  // Render your custom objects (points, lines, text, etc.)
  // ... custom rendering code ...
  
  // Restore GL state
  if (previousBlend) {
    gl.enable(gl.BLEND);
  } else {
    gl.disable(gl.BLEND);
  }
  
  if (previousDepthTest) {
    gl.enable(gl.DEPTH_TEST);
  } else {
    gl.disable(gl.DEPTH_TEST);
  }
}

// 4. Hook into Graphium's render loop
const originalRender = renderer.render.bind(renderer);
renderer.render = function() {
  // Call original render
  originalRender();
  
  // Then render our custom overlay
  renderCustomOverlay();
};

// 5. Remember to clean up when done
// renderer.render = originalRender;
```

### 2. Web Worker Physics (Conceptual)
```ts
// Move physics calculation to a Web Worker to keep main thread free
// Note: This would require significant changes to Graphium architecture
// and is shown here as a conceptual example

class WebWorkerPhysics {
  constructor() {
    this.worker = new Worker('physics-worker.js');
    this.setupCommunication();
  }
  
  setupCommunication() {
    this.worker.onmessage = (e) => {
      if (e.data.type === 'physics-update') {
        // Apply physics results to graph
        this.applyPhysicsResults(e.data.positions, e.data.velocities);
      }
    };
  }
  
  applyPhysicsResults(positions, velocities) {
    // Update node positions directly in Graphium's internal arrays
    // This would require access to Graphium's internal state
    // graph.model.nodeX = positions.x;
    // graph.model.nodeY = positions.y;
    // graph.model.nodeVx = velocities.x;
    // graph.model.nodeVy = velocities.y;
    
    // Request render to show updated positions
    graph.requestRender();
  }
  
  startPhysics(nodes, links, physicsOptions) {
    // Send data to worker
    this.worker.postMessage({
      type: 'start-physics',
      nodes: nodes,
      links: links,
      options: physicsOptions
    });
  }
  
  stopPhysics() {
    this.worker.postMessage({ type: 'stop-physics' });
  }
  
  terminate() {
    this.worker.terminate();
  }
}

// physics-worker.js would contain:
// - Force calculation algorithms
// - Spatial hash implementation
// - Integration solvers
// - Collision detection
// - All the heavy lifting moved off the main thread
```

### 3. Adaptive Quality System
```ts
// Automatically adjust quality based on performance
class AdaptiveQualityManager {
  constructor(graph, targetFps = 45) {
    this.graph = graph;
    this.targetFps = targetFps;
    this.currentQualityLevel = 2; // 0=low, 1=medium, 2=high, 3=ultra
    this.frameTimes = [];
    this.setupMonitoring();
  }
  
  setupMonitoring() {
    this.graph.on('rendercomplete', () => {
      // In reality, you'd measure frame time differently
      const frameTime = 1000 / this.graph.stats().fps;
      this.frameTimes.push(frameTime);
      
      if (this.frameTimes.length > 30) {
        this.frameTimes.shift();
        this.evaluateAndAdjust();
      }
    });
  }
  
  evaluateAndAdjust() {
    const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    const currentFps = 1000 / avgFrameTime;
    
    if (currentFps < this.targetFps - 5) {
      // FPS too low - reduce quality
      this.decreaseQuality();
    } else if (currentFps > this.targetFps + 10 && this.currentQualityLevel < 3) {
      // FPS plenty high - can increase quality
      this.increaseQuality();
    }
  }
  
  increaseQuality() {
    if (this.currentQualityLevel >= 3) return;
    
    this.currentQualityLevel++;
    this.applyQualityLevel(this.currentQualityLevel);
    console.log(`Increased quality to level ${this.currentQualityLevel}`);
  }
  
  decreaseQuality() {
    if (this.currentQualityLevel <= 0) return;
    
    this.currentQualityLevel--;
    this.applyQualityLevel(this.currentQualityLevel);
    console.log(`Decreased quality to level ${this.currentQualityLevel}`);
  }
  
  applyQualityLevel(level) {
    switch (level) {
      case 0: // Lowest quality
        this.graph.setTheme({
          node: { radius: 6, borderWidth: 0 },
          edge: { width: 0.8, arrowEnabled: false },
          label: { enabled: false },
          hoverRing: { width: 0 },
          selectedRing: { width: 1 }
        });
        this.graph.setPhysics({
          positionIterations: 1,
          repulsionRadius: 100,
          maxNeighbors: 32,
          dragSmooth: 0.2
        });
        this.graph.setInteraction({
          hoverEnabled: false
        });
        break;
        
      case 1: // Low quality
        this.graph.setTheme({
          node: { radius: 8, borderWidth: 0 },
          edge: { width: 1, arrowEnabled: false },
          label: { enabled: false, size: 10 },
          hoverRing: { width: 0 },
          selectedRing: { width: 1 }
        });
        this.graph.setPhysics({
          positionIterations: 1,
          repulsionRadius: 120,
          maxNeighbors: 48
        });
        break;
        
      case 2: // Medium quality (default)
        // Apply your standard settings
        this.graph.setTheme({ name: 'midnight' });
        this.graph.usePreset('silk');
        this.graph.setInteraction({
          dragEnabled: true,
          zoomEnabled: true,
          panEnabled: true,
          hoverEnabled: true
        });
        break;
        
      case 3: // Highest quality
        this.graph.setTheme({
          node: { radius: 14, borderWidth: 2 },
          edge: { width: 2, arrowEnabled: true, style: 'dashed' },
          label: { enabled: true, size: 14, background: 'rgba(0,0,0,0.6)' },
          hoverRing: { width: 3 },
          selectedRing: { width: 4 }
        });
        this.graph.setPhysics({
          positionIterations: 3,
          repulsionRadius: 250,
          maxNeighbors: 150,
          temperature: 0.8
        });
        break;
    }
  }
  
  destroy() {
    // Clean up listeners
  }
}

// Usage
const qualityManager = new AdaptiveQualityManager(graph, 45); // Target 45fps
// ... later when cleaning up
// qualityManager.destroy();
```

## Profiling and Identification of Bottlenecks

### 1. Chrome DevTools Performance Profiling
1. Open Chrome DevTools → Performance tab
2. Click the record button
3. Interact with your graph (zoom, drag, add nodes)
4. Stop recording
5. Analyze the flame graph to see where time is spent

Look for:
- Long bars under "scripting" → JavaScript execution time
- Long bars under "rendering" → Browser rendering/painting
- Long bars under "painting" → Layout and paint operations
- GPU activity in the "GPU" thread

### 2. Identifying Common Bottlenecks

#### JavaScript Execution Bottlenecks
```ts
// Example: Expensive calculation in event listener
graph.on('drag', event => {
  // ❌ BAD: Expensive operation in high-frequency event
  const allNodes = graph.nodes();
  const allLinks = graph.links();
  const clusteringCoefficient = calculateGlobalClusteringCoefficient(allNodes, allLinks);
  updateClusteringDisplay(clusteringCoefficient); // Runs 60x/sec
  
  // ✅ GOOD: Defer expensive operations
  scheduleClusteringUpdate(); // Uses requestAnimationFrame or throttling
});

// Example: Inefficient DOM manipulation
graph.on('dataupdated', () => {
  // ❌ BAD: Recreating entire list every time
  const container = document.getElementById('node-list');
  container.innerHTML = ''; // Causes layout thrashing
  
  graph.nodes().forEach(node => {
    const item = document.createElement('div');
    item.textContent = node.label;
    container.appendChild(item);
  });
  
  // ✅ GOOD: Update only what changed
  updateNodeListIncrementally(changedNodes);
});

// Example: Memory allocation in loops
function updateAllNodeColors(nodes, newColor) {
  // ❌ BAD: Creating new objects in loop
  nodes.forEach(node => {
    // This creates a new style object each time
    graph.node(node.id).style({ color: newColor });
  });
  
  // ✅ GOOD: Reuse objects when possible
  const styleUpdate = { color: newColor };
  nodes.forEach(node => {
    graph.node(node.id).style(styleUpdate); // Same object reference
  });
}
```

#### Rendering Bottlenecks
```ts
// ❌ BAD: Too many state changes
graph.on('dataupdated', () => {
  // Each of these might cause a separate state change/setup
  graph.nodes().forEach(node => {
    graph.node(node.id)      // Separate state change
      .style({ color: getRandomColor() }) 
      .size(random(8, 24))   // Separate state change
      .borderWidth(random(0, 3)); // Separate state change
  });
  
  // ✅ GOOD: Batch similar operations
  const nodeUpdates = [];
  graph.nodes().forEach(node => {
    nodeUpdates.push({
      id: node.id,
      style: { color: getRandomColor() },
      size: random(8, 24),
      borderWidth: random(0, 3)
    });
  });
  
  // Apply all updates in batch (conceptual - Graphium may already batch)
  batchApplyNodeUpdates(nodeUpdates);
});

// ❌ BAD: Large images causing texture thrashing
nodes.forEach(node => {
  // Using 1024x1024 images for node avatars
  graph.setNodeImage(node.id, '/high-res-photos/' + node.id + '.jpg');
  // Each large image causes significant atlas reorganization
});

// ✅ GOOD: Appropriately sized images
const AVATAR_SIZE = 128; // pixels
nodes.forEach(node => {
  graph.setNodeImage(node.id, `/avatars/${node.id}-${AVATAR_SIZE}.jpg`);
});

// ❌ BAD: Frequently changing atlas size
// Avoid frequently switching between small and large images
// which causes the atlas to resize up and down repeatedly

// ✅ GOOD: Pre-sort images by size for better packing
function optimizeImageLoadingOrder(nodes) {
  // Sort by image size (largest first) for better packing
  const sortedNodes = [...nodes].sort((a, b) => {
    const sizeA = getImageSize(a.imageUrl);
    const sizeB = getImageSize(b.imageUrl);
    return sizeB - sizeA; // Descending order
  });
  
  // Load in this order for better atlas utilization
  sortedNodes.forEach(node => {
    if (node.imageUrl) {
      graph.setNodeImage(node.id, node.imageUrl);
    }
  });
}
```

#### Physics Bottlenecks
```ts
// ❌ BAD: High node count with default settings
// 10,000 nodes with repulsionRadius=200 creates huge neighbor checks

// ✅ GOOD: Reduce repulsionRadius for large graphs
if (nodeCount > 5000) {
  graph.setPhysics({ repulsionRadius: 80 }); // Much smaller radius
}

// ❌ BAD: Unnecessary collision detection
// For graphs where nodes rarely overlap
if (graphType === 'hierarchical-tree' || graphType === 'flowchart') {
  graph.setPhysics({ collisionStrength: 0 }); // Disable completely
}

// ❌ BAD: High positionIterations when not needed
// For stable, low-tension graphs
if (averageLinkLength > 100 && linkCount < nodeCount * 1.5) {
  graph.setPhysics({ positionIterations: 1 }); // One iteration is enough
}

// ❌ BAD: Keeping simulation hot when idle
// Prevents sleeping and wastes CPU
setInterval(() => {
  if (graph.isStable() && !hasRecentInteraction()) {
    // Encourage sleeping
    graph.setPhysics({ 
      sleepEnergy: 0.0001, // Very low threshold
      damping: 0.98        // Very high damping
    });
  } else {
    // Normal settings for active periods
    graph.setPhysics({
      sleepEnergy: 0.0004,
      damping: 0.92
    });
  }
}, 2000);
```

## Mobile-Specific Optimizations

### 1. Touch Interaction Optimization
```ts
// Reduce expensive touch feedback
graph.setInteraction({
  // Touch-specific settings
  touchDragThreshold: 10,      // Require more deliberate movement
  touchHoverDelay: 200,        // Longer delay to prevent accidental triggers
  tapTimeout: 250,             // Shorter for snappier feel
  doubleTapTimeout: 300,       // Standard
  
  // Reduce visual feedback on touch
  theme: {
    hoverRing: { width: 0 },    // Disable hover rings on touch devices
    selectedRing: { width: 2 }  // Minimal selection
  },
  
  // Reduce physics calculations during touch
  physics: {
    damping: 0.9,               // Higher damping during touch to prevent oscillation
    sleepEnergy: 0.0006         // Harder to sleep during interaction
  }
});

// Use passive event listeners for better scroll performance
// (This would be handled internally by Graphium, but good to know)
document.addEventListener('touchmove', handler, { passive: true });
```

### 2. Memory Constraints on Mobile
```ts
// Reduce resource usage for mobile devices
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

if (isMobile) {
  // The atlas is fixed at 64 slots; on mobile keep the number of distinct
  // image URLs per frame low and serve pre-resized 128px assets

  // Simplify theme
  graph.setTheme({
    node: { radius: 10, borderWidth: 1 },
    edge: { width: 1.2, arrowEnabled: true },
    label: { enabled: true, size: 10 },
    hoverRing: { width: 0 },    // Disable on mobile to save performance
    selectedRing: { width: 2 }
  });
  
  // Reduce physics complexity
  graph.setPhysics({
    positionIterations: 1,
    repulsionRadius: 150,
    maxNeighbors: 64,
    edgeSeparation: 0.3
  });
  
  // Reduce interaction complexity
  graph.setInteraction({
    hoverEnabled: false         // Often disabled on mobile
  });
}

// Consider screen density
const pixelRatio = window.devicePixelRatio || 1;
if (pixelRatio > 2) {
  // High DPI screen - might need higher resolution assets
  // But balance with performance considerations
  const baseSize = 12;
  graph.setTheme({
    label: { size: Math.round(baseSize * pixelRatio / 1.5) } // Scale moderately
  });
}
```

## Performance Checklist

### Before Development
- [ ] Set performance budgets (target FPS, max load time, max memory)
- [ ] Identify target devices and browsers
- [ ] Define acceptable quality levels for different scenarios
- [ ] Set up performance monitoring in development

### During Development
- [ ] Measure baseline performance with realistic data
- [ ] Identify and optimize hotspots early
- [ ] Use performance budgets to guide decisions
- [ ] Test on target devices regularly
- [ ] Keep dependency tree small and focused
- [ ] Avoid premature optimization - measure first

### Before Release
- [ ] Test on lowest-spec target device
- [ ] Verify performance budgets are met
- [ ] Check for memory leaks during extended use
- [ ] Validate battery impact on mobile devices
- [ ] Confirm graceful degradation when resources constrained
- [ ] Document performance characteristics for users

### Ongoing Maintenance
- [ ] Monitor performance in production (if possible)
- [ ] Track performance regressions in CI
- [ ] Update optimization strategies as Graphium evolves
- [ ] Re-evaluate tradeoffs as requirements change
- [ ] Consider A/B testing different performance/quality balances

## Quick Wins

### 1. Immediate Improvements
```ts
// Apply these for immediate performance gains:

// 1. Disable expensive visual features you don't need
graph.setTheme({
  hoverRing: { width: 0 },           // Saves ~0.1-0.3ms per frame
  selectedRing: { width: 1 },        // Minimal selection indicator
  node: { borderWidth: 0 },          // Saves vertex calculations
  edge: { 
    width: 1, 
    arrowEnabled: false,             // Saves complex geometry calculations
    style: 'solid'                   // Saves shader complexity
  }
});

// 2. Optimize physics for your node count
const nodeCount = graph.model.nodeCount;
if (nodeCount > 1000) {
  graph.setPhysics({
    repulsionRadius: Math.max(80, 200 - Math.floor(nodeCount / 50)),
    maxNeighbors: Math.max(32, 128 - Math.floor(nodeCount / 20)),
    positionIterations: 1,
    sleepEnergy: Math.max(0.0001, 0.0004 - nodeCount * 0.0000001)
  });
}

// 3. Keep the image atlas lean: clear node images that scroll out of view
//    with graph.setNodeImage(id, null) so their slots are recycled

// 4. Disable labels for large graphs
if (nodeCount > 500) {
  graph.setTheme({ label: { enabled: false } });
}

// 5. Use appropriate interaction and physics settings
graph.setInteraction({
  hoverEnabled: nodeCount < 300     // Disable hover for large graphs
});
graph.setPhysics({
  dragSmooth: 0.3                   // Less expensive than 0.42
});
```

### 2. Monitoring Checklist
- [ ] Frame rate consistently above 30fps (60fps ideal)
- [ ] Physics time consistently under 5ms per frame
- [ ] Render time consistently under 10ms per frame
- [ ] Memory usage stable or slowly increasing (no leaks)
- [ ] GPU memory usage reasonable for target devices
- [ ] Battery drain acceptable on mobile (if applicable)
- [ ] Input latency under 50ms for interactive elements
- [ ] Page load time under 3 seconds on target network

### 3. Emergency Performance Recovery
```ts
// If performance suddenly drops, try these:

// 1. Reset to known-good configuration
function resetToSafeMode() {
  // Ultra-safe theme
  graph.setTheme({
    node: { radius: 6, borderWidth: 0, colorPalette: ['#333'] },
    edge: { color: '#999', width: 0.8, arrowEnabled: false },
    label: { enabled: false },
    hoverRing: { width: 0 },
    selectedRing: { width: 1 },
    background: '#ffffff'
  });
  
  // Conservative physics
  graph.setPhysics({
    repulsion: 600,
    repulsionRadius: 100,
    springStrength: 0.02,
    gravity: 0.001,
    damping: 0.96,
    positionIterations: 1,
    sleepEnergy: 0.0001,
    sleepFrames: 15,
    maxNeighbors: 32,
    edgeSeparation: 0.1
  });
  
  // Minimal interaction
  graph.setInteraction({
    hoverEnabled: false,
    dragEnabled: true,
    zoomEnabled: true,
    panEnabled: true
  });

  // The image atlas is fixed at 64 slots; clear node images you no longer
  // display with graph.setNodeImage(id, null) to free their slots
}

// 2. Reduce visual complexity emergency brake
function enablePerformanceMode() {
  // Store current state
  const originalState = {
    theme: graph.theme,
    physics: graph.physics.options
  };

  // Apply minimums
  resetToSafeMode();

  // Return function to restore original state
  return () => {
    graph.setTheme(originalState.theme);
    graph.setPhysics(originalState.physics);
  };
}

// Usage during performance crisis:
// const restore = enablePerformanceMode();
// ... later when safe to restore quality
// restore();
```

## Conclusion

Performance optimization in Graphium is about understanding the trade-offs between visual quality, interactivity, and computational efficiency. The most impactful optimizations usually come from:

1. **Reducing node count** through sampling, LOD, or clustering
2. **Optimizing physics parameters** for your specific graph topology and size
3. **Managing image resources** effectively through appropriate sizing and caching
4. **Minimizing expensive visual features** that don't add value to your use case
5. **Properly managing event listeners** to prevent memory leaks and excessive callbacks
6. **Testing regularly on target devices** to ensure real-world performance

Remember that the best performance optimization is often not doing work that isn't needed. Start with the simplest configuration that meets your requirements, then add features and quality only as needed, measuring the impact at each step.

By following the strategies in this guide and continuously monitoring your application's performance, you can create Graphium visualizations that are both beautiful and performant across a wide range of devices and use cases.