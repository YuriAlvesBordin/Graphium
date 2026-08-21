// Test the chaining logic for edge bundling
import { EdgeBundling2D } from './src/physics/EdgeBundling2D.js';
import { GraphModel } from './src/core/GraphModel.js';

// Mock model with 3 edges between two nodes
const model = new GraphModel({
  nodeCapacity: 10,
  linkCapacity: 10,
  nodeDefaults: { radius: 10 },
  linkDefaults: { width: 1 }
});

// Add two nodes: A at (0,0), B at (100,0)
model.addNode('A', { x: 0, y: 0 });
model.addNode('B', { x: 100, y: 0 });

// Add 3 edges between A and B
model.addLink('e1', 'A', 'B');
model.addLink('e2', 'A', 'B');
model.addLink('e3', 'A', 'B');

console.log('Node count:', model.nodeCount); // Should be 2
console.log('Link count:', model.linkCount); // Should be 3

// Create options with edge bundling enabled and thresholdNodes = 3
const options = {
  edgeBundling: true,
  thresholdNodes: 3,
  bundleRadius: 180,
  bundleIterations: 1,
  bundleCompatibility: 0.65,
  bundleStrength: 0.35,
  bundleSubdivisions: 3
};

const bundling = new EdgeBundling2D(model, options);

// Trigger rebuild
bundling.rebuild();

// Check the routes
for (let e = 0; e < model.linkCount; e++) {
  const route = bundling.getRoute(e);
  const count = bundling.getPointCount(e);
  console.log(`Edge ${e}:`);
  console.log(`  Point count: ${count}`);
  console.log('  Points:');
  for (let p = 0; p < count; p++) {
    console.log(`    ${p}: (${route[p*2].toFixed(2)}, ${route[p*2+1].toFixed(2)})`);
  }
  console.log('');
}

// Expected for N=3 edges:
// P0 = A + (B-A)*1/5 = (0,0) + (100,0)*0.2 = (20, 0)
// P1 = A + (B-A)*2/5 = (0,0) + (100,0)*0.4 = (40, 0)
// P2 = A + (B-A)*3/5 = (0,0) + (100,0)*0.6 = (60, 0)
// P3 = A + (B-A)*4/5 = (0,0) + (100,0)*0.8 = (80, 0)
//
// Edge 0: P0->P1 = (20,0) to (40,0)
// Edge 1: P1->P2 = (40,0) to (60,0)
// Edge 2: P2->P3 = (60,0) to (80,0)
//
// With subdivisions=3, each edge gets 2 segments (count = subdivisions + 1 = 4 points? Wait)
// Actually: count = opt.bundleShortEdges || length >= opt.nodeSeparationLength * 2 ? subdivisions + 1 : 2
// length = 100, nodeSeparationLength = 50 (default), so length >= 2*50 = 100 -> true
// So count = subdivisions + 1 = 3 + 1 = 4 points per edge (3 segments)
//
// For edge 0 from (20,0) to (40,0):
// t=0: (20,0)
// t=1/3: (20 + 20/3, 0) = (26.67, 0)
// t=2/3: (20 + 40/3, 0) = (33.33, 0)
// t=1: (40, 0)
//
// Similarly for others.

console.log('Expected points for N=3, subdivisions=3:');
console.log('Edge 0: (20,0) -> (26.67,0) -> (33.33,0) -> (40,0)');
console.log('Edge 1: (40,0) -> (46.67,0) -> (53.33,0) -> (60,0)');
console.log('Edge 2: (60,0) -> (66.67,0) -> (73.33,0) -> (80,0)');