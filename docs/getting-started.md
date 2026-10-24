# Getting Started with Graphium

This guide will help you get started with Graphium, from installation to creating your first graph visualization.

## Prerequisites

- Node.js >=18.0.0
- A modern browser with WebGL2 support (Chrome 56+, Firefox 51+, Safari 15+, Edge 79+). Graphium throws a descriptive `Graphium requires a browser with WebGL2 support.` error at construction time when WebGL2 is missing.

## Installation

Install Graphium using your preferred package manager:

```bash
# npm
npm install @yurialvesbordin/graphium

# Yarn
yarn add @yurialvesbordin/graphium

# pnpm
pnpm add @yurialvesbordin/graphium
```

## Creating Your First Graph

Let's create a simple graph with three nodes connected in a triangle.

### Step 1: Import Graphium

```ts
import { Graphium } from '@yurialvesbordin/graphium';
```

### Step 2: Create a Graph Instance

```ts
const graph = Graphium.create({
  container: document.getElementById('graph-container'), // HTML element to render in
  autoStart: true,     // Start the physics simulation immediately
  autoFit: true,       // Automatically adjust view to fit the graph
  physics: { preset: 'silk' }, // Use the silk physics preset for smooth motion
  theme: { name: 'midnight' }  // Use the dark midnight theme
});
```

### Step 3: Add Nodes and Links

```ts
// Add three nodes
graph
  .addNode('alice', { label: 'Alice' })
  .addNode('bob',   { label: 'Bob'   })
  .addNode('carol', { label: 'Carol' });

// Connect them in a triangle
graph
  .link('alice', 'bob')
  .link('bob',   'carol')
  .link('carol', 'alice');
```

### Step 4: Customize (Optional)

You can customize the appearance of nodes and links:

```ts
// Make Alice's node larger and red
graph.node('alice')
  .style({ radius: 20, color: '#ff6b6b' })
  .fix(); // Lock Alice's position in place

// Make the Alice-Bob link curved and dashed
graph.link('alice~bob~0')
  .curve(0.3)        // Positive value curves clockwise
  .dashed([5, 3]);   // 5px dash, 3px gap
```

### Step 5: Fit the View

```ts
// Adjust the camera to show all nodes with some padding
graph.fit(80); // 80% padding around the graph
```

## Alternative: Data-First Approach

Instead of adding nodes and links individually, you can set all data at once:

```ts
graph.setData({
  nodes: [
    { id: 'alice', label: 'Alice' },
    { id: 'bob',   label: 'Bob'   },
    { id: 'carol', label: 'Carol' }
  ],
  links: [
    { source: 'alice', target: 'bob' },
    { source: 'bob',   target: 'carol' },
    { source: 'carol', target: 'alice' }
  ]
});
```

## Using Handles for Advanced Manipulation

Graphium uses a "handle" system for intuitive node/link manipulation:

```ts
// Get a handle for a node
const aliceHandle = graph.node('alice');

// Chain multiple operations
aliceHandle
  .move(100, 150)    // Set position
  .fix()             // Lock in solver
  .label('Alice Smith') // Change label
  .color('#4ecdc4'); // Change color

// Get a handle for a link
const bobCarolHandle = graph.linkById('bob~carol~0');

bobCarolHandle
  .curve(-0.2)               // Curve counter-clockwise
  .style({ width: 2.5 })     // Make thicker
  .color('#888');            // Change color
```

## Cleaning Up

When you're done with the graph, release its resources:

```ts
graph.destroy();
```

## Next Steps

- Explore the [Physics Configuration](./physics-configuration.md) guide to tune the simulation
- Learn about [Theming](./theming-guide.md) to customize colors and styles
- See how to use [Node Images](./node-images.md) for profile pictures or icons
- Understand the [Events & Interaction](./events-interaction.md) system
- Optimize performance with [Performance Tuning](./performance-tuning.md) tips

## Troubleshooting

### "Graphium requires a browser with WebGL2 support." error
The constructor throws this when the browser or context cannot provide WebGL2. Ensure you're using a modern browser with WebGL2 enabled, or that your hosting environment (headless browsers, sandboxed iframes) grants the `webgl2` context. Try updating your browser or using Chrome/Firefox/Edge/Safari.

### Graph not visible
1. Check that your container element has dimensions (width/height > 0)
2. Verify you've called `graph.fit()` or set initial camera position
3. Make sure nodes have been added to the graph

### Performance issues
- Reduce node count for complex graphs
- Increase `repulsionRadius` to reduce neighbor calculations
- Enable `renderOnDemand` if your data changes infrequently