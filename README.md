# Graphium

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/built%20with-TypeScript-0074c1.svg)](http://www.typescriptlang.org/)
[![WebGL2](https://img.shields.io/badge/WebGL2-enabled-ff69b4.svg)](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)
[![npm version](https://img.shields.io/npm/v/graphium.svg)](https://www.npmjs.com/package/graphium)

A high-performance WebGL2 graph visualization library with silk-smooth force-directed physics, curved edges, node images, and a fluent TypeScript API.

## Features

- Silk-smooth physics: Velocity-based integration with tuned damping for natural, gliding motion
- Zero CPU at rest: Render loop stops completely when simulation sleeps; zero idle cost
- Curved edges: True quadratic Bézier ribbons rendered on GPU with exact normals and dash support
- Node images: Automatic texture atlasing with CORS-friendly loading and cover/contain framing
- Focus mode: Dim non-adjacent nodes/links with one call
- Render on demand: Frames produced only when data changes (topology, appearance, positions, camera, atlas)
- Pooled labels: DOM pool capped at 400 visible elements, updated with translate3d and culled to viewport
- Fluent TypeScript API: Chainable methods with intelligent handles for nodes/links
- Built-in theming: Four themes (midnight, light, slate, sunset) with easy customization
- Rich event system: Click, drag, zoom, hover, sleep/wake, image load/error, and more
- Camera controls: Fit, center, zoom, reboot, screenshot, export/import
- TypeScript first: Full type definitions with zero runtime dependencies

## Installation

```bash
# npm
npm install graphium

# Yarn
yarn add graphium

# pnpm
pnpm add graphium
```

## Quick Start

```ts
import { Graphium } from 'graphium';

// Create instance
const graph = Graphium.create({
  container: document.getElementById('stage'), // or container, or nothing for auto canvas
  autoStart: true,                            // run the simulation immediately
  autoFit: true,                              // frame the graph when data appears
  physics: { preset: 'silk' },
  theme: { name: 'midnight' },
});

// Add data
graph
  .addNodes([
    { id: 'alice', label: 'Alice' },
    { id: 'bob',   label: 'Bob'   },
    { id: 'carol', label: 'Carol' },
  ])
  .addLinks([
    { source: 'alice', target: 'bob' },
    { source: 'bob',   target: 'carol' },
    { source: 'carol', target: 'alice' },
  ]);

// Optional: customize nodes/links
graph.node('alice').style({ radius: 18, color: '#ff6b6b' }).fix();
graph.link('alice~bob~0').curve(0.4).dashed([4, 2]);

// Fit view
graph.fit(80);
```

## Documentation

### Guides

- [Getting Started](./docs/getting-started.md) - Introduction to Graphium with basic examples
- [Physics Configuration](./docs/physics-configuration.md) - Tuning the force-directed physics engine
- [Theming Guide](./docs/theming-guide.md) - Customizing colors, styles, and appearance
- [Node Images](./docs/node-images.md) - Using images as node backgrounds
- [Events & Interaction](./docs/events-interaction.md) - Handling user input and responding to events
- [Performance Tuning](./docs/performance-tuning.md) - Optimizing for speed and efficiency

## Usage Patterns

### Fluent API with Handles

```ts
// Node handle chain
graph.node('user123')
  .move(100, 200)
  .fix()
  .image('/avatars/user123.png')
  .label('Alice')
  .color('#4ecdc4')
  .select();

// Link handle chain
graph.linkById('link1')
  .curve(-0.3)
  .width(2.5)
  .color('#51586b')
  .select();
```

### Bulk Operations

```ts
// Add many nodes/links at once
graph.setData({
  nodes: [
    { id: 'a', label: 'A', x: 0, y: 0 },
    { id: 'b', label: 'B', x: 100, y: 100 },
    // ...
  ],
  links: [
    { source: 'a', target: 'b', curvature: 0.2 },
    // ...
  ]
});

// Replace all data
graph.setData(newData);
```

### Event Handling

```ts
// Node click
graph.on('click', e => {
  console.log('Clicked node:', e.nodeId);
  console.log('World coords:', e.worldX, e.worldY);
});

// Drag end with momentum
graph.on('dragend', e => {
  console.log(`Released ${e.nodeId} with velocity`, e.vx, e.vy);
});

// Sleep/wake events
graph.on('sleep', () => console.log('Layout settled'));
graph.on('wake',  () => console.log('Layout started'));
```

### Camera & View

```ts
// Frame everything with padding
graph.fit(80); // 80% padding

// Move view center
graph.centerOn(0, 0);

// Absolute zoom
graph.zoomTo(2);  // 2x

// Relative zoom
graph.zoomBy(1.5); // 1.5x current

// Screenshot (returns PNG data URL)
const img = graph.screenshot();
```

### Cleanup

```ts
// Release all resources
graph.destroy();
```

## Configuration

### Physics Options

```ts
graph.setPhysics({
  repulsion: 1100,          // Node-node repulsion strength
  repulsionRadius: 200,     // Distance cutoff for repulsion
  springStrength: 0.055,    // Link spring force multiplier
  gravity: 0.0022,          // Pull toward origin
  damping: 0.92,            // Velocity retention per frame
  maxSpeed: 900,            // Velocity clamp
  collisionStrength: 0.85,  // Node overlap repulsion
  positionIterations: 2,    // Constraint solver passes
  temperature: 0.7,         // Initial simulation heat
  cooling: 0.99,            // Heat decay per frame
  minTemperature: 0.05,     // Heat floor
  sleepEnergy: 0.0004,      // Velocity threshold for sleep
  sleepFrames: 48,          // Calm frames required to sleep
  maxNeighbors: 128,        // Repulsion neighbor cap
  edgeSeparation: 0.45,     // Edge crossing untangler (0 disables)
  dragSmooth: 0.42,         // Drag follower elasticity
  throwFactor: 1,           // Momentum multiplier on release
});
```

### Theming

```ts
// Use built-in theme
graph.setTheme({ name: 'sunset' });

// Custom theme
graph.setTheme({
  background: '#0b0e14',
  node: { 
    radius: 12, 
    borderWidth: 2, 
    colorPalette: ['#ff6b6b', '#4ecdc4', '#ffe66d'] 
  },
  edge: { color: '#51586b', curvature: 0.25, arrowEnabled: true },
  label: { size: 13, color: '#e8ecf5', background: 'rgba(0,0,0,0.4)' },
  hoverRing: { color: '#ffffff', width: 3 },
  selectedRing: { color: '#ffd166', width: 4 }
});
```

## Building from Source

```bash
# Clone repository
git clone https://github.com/YuriAlvesBordin/Graphium.git
cd Graphium

# Install dependencies
npm install

# Build
npm run build

# Outputs to ./dist/
# - index.js (ES module)
# - index.d.ts (TypeScript declarations)
# - sourcemaps included
```

### Development

```bash
# Watch mode (rebuild on changes)
npm run watch

# Run demo
npm run demo
```

## License

Graphium is MIT licensed. See [LICENSE](./LICENSE) for details.

## Acknowledgements

- Inspired by force-directed graph layout algorithms
- Thanks to the open-source WebGL2 and TypeScript communities
- Built with love using modern web technologies

Happy graphing!