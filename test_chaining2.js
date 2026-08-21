// Test the chaining logic for edge bundling with debug output
import { EdgeBundling2D } from './src/physics/EdgeBundling2D.js';
import { GraphModel } from './src/core/GraphModel.js';

// Mock model with 3 edges between two nodes
const model = new GraphModel({
  nodeCapacity: 10,
  linkCapacity: 10,
  nodeDefaults: { radius: 10 },
  linkDefaults: { width: 1 }
});

// Add two nodes: A at (0,0), B at (1000,0) to make longer edges
model.addNode('A', { x: 0, y: 0 });
model.addNode('B', { x: 1000, y: 0 });

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
  bundleSubdivisions: 5,
  nodeSeparationLength: 50 // Keep this reasonable
};

console.log('Options:', options);

const bundling = new EdgeBundling2D(model, options);

// Check internal state before rebuild
console.log('\nBefore rebuild:');
console.log('highCountEdges:', Array.from(bundling.highCountEdges));
console.log('edgeChainIndex:', Array.from(bundling.edgeChainIndex));
console.log('edgePairSize:', Array.from(bundling.edgePairSize));

// Trigger rebuild
bundling.rebuild();

// Check internal state after updateHighCountEdges
console.log('\nAfter updateHighCountEdges (inside rebuild):');
console.log('highCountEdges:', Array.from(bundling.highCountEdges));
console.log('edgeChainIndex:', Array.from(bundling.edgeChainIndex));
console.log('edgePairSize:', Array.from(bundling.edgePairSize));

// Check the routes
for (let e = 0; e < model.linkCount; e++) {
  const route = bundling.getRoute(e);
  const count = bundling.getPointCount(e);
  console.log(`\nEdge ${e}:`);
  console.log(`  Point count: ${count}`);
  console.log('  Points:');
  for (let p = 0; p < count; p++) {
    console.log(`    ${p}: (${route[p*2].toFixed(2)}, ${route[p*2+1].toFixed(2)})`);
  }
}

// Expected for N=3 edges with A(0,0), B(1000,0):
// P0 = A + (B-A)*1/5 = (0,0) + (1000,0)*0.2 = (200, 0)
// P1 = A + (B-A)*2/5 = (0,0) + (1000,0)*0.4 = (400, 0)
// P2 = A + (B-A)*3/5 = (0,0) + (1000,0)*0.6 = (600, 0)
// P3 = A + (B-A)*4/5 = (0,0) + (1000,0)*0.8 = (800, 0)
//
// Edge 0: P0->P1 = (200,0) to (400,0)
// Edge 1: P1->P2 = (400,0) to (600,0)
// Edge 2: P2->P3 = (600,0) to (800,0)
//
// With nodeSeparationLength=50, length of each edge = 200
// length >= nodeSeparationLength * 2 ? 200 >= 100 -> TRUE
// So count = subdivisions + 1 = 5 + 1 = 6 points per edge (5 segments)
//
// For edge 0 from (200,0) to (400,0):
// t=0: (200,0)
// t=1/5: (200 + 40, 0) = (240, 0)
// t=2/5: (200 + 80, 0) = (280, 0)
// t=3/5: (200 + 120, 0) = (320, 0)
// t=4/5: (200 + 160, 0) = (360, 0)
// t=1: (400, 0)

console.log('\nExpected points for N=3, subdivisions=5:');
console.log('Edge 0: (200,0) -> (240,0) -> (280,0) -> (320,0) -> (360,0) -> (400,0)');
console.log('Edge 1: (400,0) -> (440,0) -> (480,0) -> (520,0) -> (560,0) -> (600,0)');
console.log('Edge 2: (600,0) -> (640,0) -> (680,0) -> (720,0) -> (760,0) -> (800,0)');
console.log('\nEdges should connect to each other at intermediate points:');
console.log('Edge 0 end (400,0) should equal Edge 1 start (400,0)');
console.log('Edge 1 end (600,0) should equal Edge 2 start (600,0)');