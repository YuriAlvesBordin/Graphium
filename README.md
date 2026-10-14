# Graphium

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/built%20with-TypeScript-0074c1.svg)](http://www.typescriptlang.org/)
[![WebGL2](https://img.shields.io/badge/WebGL2-enabled-ff69b4.svg)](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)
[![npm version](https://img.shields.io/npm/v/graphium.svg)](https://www.npmjs.com/package/graphium)

A high-performance WebGL2 graph visualization library delivering silk-smooth physics, curved edges, and node images through a fluent TypeScript API.

## Why Graphium?

Graphium reimagines graph visualization with three core principles:
- **Performance First**: Zero CPU at rest, GPU-accelerated rendering, and efficient data structures
- **Developer Experience**: Fluent API, intelligent handles, and minimal boilerplate
- **Visual Fidelity**: True Bézier curves, automatic texture atlasing, and professional theming

Unlike traditional graph libraries that struggle with performance or usability, Graphium delivers buttery-smooth interactions even with thousands of nodes while maintaining a clean, intuitive API.

## Installation

```bash
# Using npm
npm install graphium

# Using Yarn
yarn add graphium

# Using pnpm
pnpm add graphium
```

## Quick Start

Create an interactive graph in just a few lines of code:

```ts
import { Graphium } from 'graphium';

// Initialize the graph
const graph = Graphium.create({
  container: document.getElementById('graph-container'),
  autoStart: true,
  autoFit: true,
  physics: { preset: 'silk' },
  theme: { name: 'midnight' }
});

// Add your data
graph
  .addNodes([
    { id: 'alice', label: 'Alice' },
    { id: 'bob',   label: 'Bob'   },
    { id: 'carol', label: 'Carol' }
  ])
  .addLinks([
    { source: 'alice', target: 'bob' },
    { source: 'bob',   target: 'carol' },
    { source: 'carol', target: 'alice' }
  ]);

// Customize appearance
graph.node('alice')
  .style({ radius: 20, color: '#ff6b6b' })
  .fix();

graph.link('alice~bob~0')
  .curve(0.3)
  .dashed([4, 2]);

// Frame the view
graph.fit(80);
```

## Key Features

### Performance
- **Silk-smooth physics**: Velocity-based integration with adaptive damping
- **Zero idle cost**: Render loop stops completely when stable
- **GPU accelerated**: Instanced rendering for nodes, edges, and labels
- **Spatial hashing**: Efficient O(n) neighbor queries for large graphs

### Visuals
- **True curves**: Quadratic Bézier ribbons with exact tangent normals
- **Node images**: Automatic texture atlasing with cover/contain modes
- **Professional theming**: Four built-in themes with easy customization
- **Focus mode**: Dim non-adjacent elements with one call

### Developer Experience
- **Fluent API**: Chainable methods that return the graph instance
- **Intelligent handles**: Per-node/link manipulation with method chaining
- **Rich event system**: Click, drag, zoom, hover, sleep/wake, and more
- **TypeScript first**: Complete type definitions with zero runtime deps

### Usability
- **Render on demand**: Updates only when data actually changes
- **Label pooling**: DOM recycling capped at 400 visible elements
- **Camera controls**: Fit, center, zoom, reboot, and screenshot
- **Data flexibility**: Add incrementally or set all at once

## Documentation

Comprehensive guides are available in the `docs/` directory:

- [Getting Started](./docs/getting-started.md) - Setup and basic usage
- [Physics Configuration](./docs/physics-configuration.md) - Tuning the simulation
- [Theming Guide](./docs/theming-guide.md) - Customizing appearance
- [Node Images](./docs/node-images.md) - Using images as node backgrounds
- [Events & Interaction](./docs/events-interaction.md) - Handling user input
- [Performance Tuning](./docs/performance-tuning.md) - Optimization techniques

## Usage Patterns

### Handle-Based Manipulation

```ts
// Node operations
graph.node('user123')
  .move(100, 200)
  .fix()
  .image('/avatar.png')
  .label('John Doe')
  .color('#4ecdc4')
  .select();

// Link operations
graph.linkById('alice~bob~0')
  .curve(-0.2)
  .width(2.5)
  .color('#51586b')
  .dashed([6, 3])
  .select();
```

### Bulk Data Updates

```ts
// Replace all data efficiently
graph.setData({
  nodes: [
    { id: 'a', label: 'Node A', x: 0, y: 0 },
    { id: 'b', label: 'Node B', x: 100, y: 100 }
  ],
  links: [
    { source: 'a', target: 'b', curvature: 0.15 }
  ]
});
```

### Event Handling

```ts
// Respond to user interactions
graph.on('click', event => {
  if (event.nodeId) {
    console.log(`Selected node: ${event.nodeId}`);
  }
});

graph.on('dragend', event => {
  console.log(`Released with velocity: (${event.vx.toFixed(1)}, ${event.vy.toFixed(1)})`);
});

graph.on('sleep', () => {
  console.log('Layout stabilized - saving energy');
});

graph.on('imageload', event => {
  console.log(`Loaded image for ${event.nodeId}: ${event.url}`);
});
```

### Camera and Navigation

```ts
// View controls
graph.fit(85);                    // Frame with 15% padding
graph.centerOn(0, 0);             // Move view to origin
graph.zoomTo(1.5);                // Set absolute zoom level
graph.zoomBy(1.2);                // Increase zoom by 20%

// Screenshot and export
const png = graph.screenshot();   // Get current view as PNG
const json = graph.toJSON();      // Export graph state

// Lifecycle
graph.reboot();                   // Restart layout from current state
graph.destroy();                  // Clean up resources
```

## Configuration

### Physics Settings

Adjust the force-directed simulation to match your graph's characteristics:

```ts
graph.setPhysics({
  repulsion: 1100,              // Node-to-node repulsion strength
  repulsionRadius: 200,         // Effective range for repulsion
  springStrength: 0.055,        // Link stiffness multiplier
  gravity: 0.0022,              // Central attraction force
  damping: 0.92,                // Velocity damping per frame
  maxSpeed: 900,                // Maximum node velocity
  collisionStrength: 0.85,      // Response to node overlap
  positionIterations: 2,        // Solver iterations per frame
  temperature: 0.7,             // Initial simulation energy
  cooling: 0.99,                // Energy dissipation rate
  minTemperature: 0.05,         // Minimum energy floor
  sleepEnergy: 0.0004,          // Threshold for sleeping
  sleepFrames: 48,              // Frames of stability to sleep
  maxNeighbors: 128,            // Neighbor limit for performance
  edgeSeparation: 0.45,         // Edge crossing reduction
  dragSmooth: 0.42,             // Drag motion smoothing
  throwFactor: 1                // Momentum preservation on release
});
```

### Theming

Customize the visual appearance with minimal effort:

```ts
// Apply a built-in theme
graph.setTheme({ name: 'sunset' });

// Create a custom theme
graph.setTheme({
  background: '#0a0a0a',
  node: {
    radius: 14,
    borderWidth: 2,
    colorPalette: ['#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3']
  },
  edge: {
    color: '#636e72',
    width: 1.8,
    curvature: 0.2,
    arrowEnabled: true
  },
  label: {
    size: 12,
    color: '#f8f9fa',
    background: 'rgba(0,0,0,0.6)'
  },
  hoverRing: {
    color: '#74b9ff',
    width: 3
  },
  selectedRing: {
    color: '#fd79a8',
    width: 4
  }
});
```

## Building from Source

```bash
# Clone the repository
git clone https://github.com/YuriAlvesBordin/Graphium.git
cd Graphium

# Install dependencies
npm install

# Build the library
npm run build

# Outputs to ./dist/
# - index.js: ES module bundle
# - index.d.ts: TypeScript declarations
# - *.map: Source maps for debugging
```

### Development Workflow

```bash
# Watch for changes and rebuild automatically
npm run watch

# Run the interactive demo
npm run demo
```

## Browser Support

Graphium requires WebGL2 and is compatible with:
- Chrome 56+ 
- Firefox 51+
- Safari 15+
- Edge 79+
- Opera 43+

## License

Graphium is released under the MIT License. See the [LICENSE](./LICENSE) file for details.

## Acknowledgments

- Inspired by force-directed graph layout algorithms
- Built with ❤️ using TypeScript and WebGL2
- Thanks to the open-source visualization community

---

**Ready to visualize your data?** Start with [the getting started guide](./docs/getting-started.md) or explore the [interactive demo](demo/index.html).