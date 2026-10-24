# Physics Configuration Guide

Learn how to configure Graphium's physics engine to achieve the perfect balance of stability, responsiveness, and visual appeal for your graph visualization.

## Overview

Graphium uses a force-directed physics simulator that combines several forces:
- **Repulsion**: Pushes nodes apart (like electrons with same charge)
- **Attraction**: Pulls connected nodes together (like springs)
- **Gravity**: Pulls nodes toward the origin (0,0)
- **Damping**: Reduces velocity over time to stabilize the system
- **Collision**: Prevents node overlap
- **Edge Separation**: Untangles overlapping edges
- **Rest Length**: Per-link target distance the springs keep, with smooth animated transitions

## Physics Presets

Graphium includes four built-in presets that serve as excellent starting points:

### Silk (Default)
```ts
graph.usePreset('silk');
// { repulsion: 1100, repulsionRadius: 200, springStrength: 0.055, 
//   gravity: 0.0022, damping: 0.92, ... }
```
Smooth accelerations, high damping, graceful settles. Good for most use cases.

### Bouncy
```ts
graph.usePreset('bouncy');
// { repulsion: 1000, repulsionRadius: 200, springStrength: 0.08, 
//   gravity: 0.002, damping: 0.85, ... }
```
Lower damping and stronger springs for overshoot and playful wobble.

### Crystal
```ts
graph.usePreset('crystal');
// { repulsion: 1200, repulsionRadius: 200, springStrength: 0.04, 
//   gravity: 0.0025, damping: 0.95, positionIterations: 4, ... }
```
Stiff springs, extra constraint iterations, snap into rigid arrangements.

### Liquid
```ts
graph.usePreset('liquid');
// { repulsion: 900, repulsionRadius: 250, springStrength: 0.03,
//   gravity: 0.0015, damping: 0.98, ... }
```
Heavy damping, soft springs, floating drift, slow motion.

### Unknown Preset Names

Passing a name that is not one of `silk`, `bouncy`, `crystal` or `liquid` throws immediately with the list of available presets, instead of failing silently:

```ts
graph.usePreset('bounncy');
// Error: Graphium: unknown physics preset "bounncy".
//        Available presets: silk, bouncy, crystal, liquid.
```

## Fine-Tuning Physics Parameters

You can override individual parameters after applying a preset, or set them all manually:

```ts
// Start with a preset then tweak
graph.usePreset('silk');
graph.setPhysics({ 
  repulsion: 1500,  // Increase repulsion to spread nodes further
  damping: 0.88     // Reduce damping for more lively motion
});

// Or set all parameters manually
graph.setPhysics({
  repulsion: 1100,
  repulsionRadius: 200,
  springStrength: 0.055,
  gravity: 0.0022,
  damping: 0.92,
  maxSpeed: 900,
  collisionStrength: 0.85,
  positionIterations: 2,
  temperature: 0.7,
  cooling: 0.99,
  minTemperature: 0.05,
  sleepEnergy: 0.0004,
  sleepFrames: 48,
  maxNeighbors: 128,
  edgeSeparation: 0.45,
  dragSmooth: 0.42,
  throwFactor: 1,
  restLengthSmooth: 0.12
});
```

## Parameter Reference

### Node Forces

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `repulsion` | 1100 | 0-5000 | Strength of pairwise node repulsion. Higher values push nodes further apart. |
| `repulsionRadius` | 200 | 50-500 | Distance cutoff for repulsion calculations. Nodes farther apart than this don't repel each other (performance optimization). |
| `springStrength` | 0.055 | 0.01-0.5 | Global multiplier on link spring forces. Higher values make links act like tighter springs. |
| `gravity` | 0.0022 | 0-0.1 | Pull toward the world origin (0,0). Prevents nodes from drifting too far away. |
| `damping` | 0.92 | 0.8-0.99 | Velocity retention per frame. Higher values = slower stabilization but smoother motion. |
| `maxSpeed` | 900 | 100-2000 | Velocity clamp that prevents nodes from moving too fast. |
| `collisionStrength` | 0.85 | 0-2 | How hard overlapping nodes push apart. Higher values prevent overlap more aggressively. |

### Solver Parameters

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `positionIterations` | 2 | 1-10 | Constraint solver passes per frame. More iterations = more stable but higher CPU cost. |
| `temperature` | 0.7 | 0.1-2.0 | Initial simulation heat, scaled into forces. Higher = more initial motion. |
| `cooling` | 0.99 | 0.9-0.999 | Heat decay per frame. Higher = slower cooling. |
| `minTemperature` | 0.05 | 0.01-0.5 | Floor for the heat so graphs keep breathing slightly. |

### Sleep Parameters

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `sleepEnergy` | 0.0004 | 0.0001-0.01 | Mean squared velocity below which the graph may sleep. |
| `sleepFrames` | 48 | 10-200 | Consecutive calm frames required before sleeping. |

### Interaction Parameters

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `maxNeighbors` | 128 | 16-512 | Repulsion neighbor cap per node per frame (performance optimization). |
| `edgeSeparation` | 0.45 | 0-2 | Strength of the crossing untangler. 0 disables edge separation. |
| `dragSmooth` | 0.42 | 0-1 | Drag follower elasticity per frame. Higher = more elastic dragging. |
| `throwFactor` | 1 | 0.5-3 | Momentum multiplier applied on release when dragging nodes. |

### Edge Length Parameters

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `restLengthSmooth` | 0.12 | 0-0.95 | Fraction of the remaining length difference the solver closes per frame when a link's rest length changes. `0` snaps instantly, higher values glide more slowly. |

## Common Configuration Patterns

### For Dense Graphs (Many Links)
```ts
graph.setPhysics({
  repulsion: 800,           // Reduce repulsion to allow closer packing
  springStrength: 0.07,     // Increase spring strength to handle link tension
  damping: 0.9,             // Slightly less damping for responsiveness
  edgeSeparation: 0.6       // Increase edge separation to handle link density
});
```

### For Sparse Graphs (Few Links)
```ts
graph.setPhysics({
  repulsion: 1500,          // Increase repulsion to spread nodes
  springStrength: 0.04,     // Decrease spring strength for looser links
  damping: 0.95,            // More damping for stability
  gravity: 0.003            // Stronger gravity to prevent drift
});
```

### For Large Graphs (>1000 Nodes)
```ts
graph.setPhysics({
  repulsionRadius: 150,     // Decrease radius for better performance
  maxNeighbors: 64,         // Decrease neighbor cap
  positionIterations: 1,    // Fewer iterations for speed
  sleepEnergy: 0.0002,      // Sleep more aggressively
  sleepFrames: 32           // Sleep faster
});
```

### For Interactive Applications
```ts
graph.setPhysics({
  damping: 0.88,            // Less damping for more responsive dragging
  throwFactor: 1.5,         // More momentum when thrown
  dragSmooth: 0.3,          // Less elastic drag for precise control
  sleepEnergy: 0.001        // Higher threshold to prevent sleeping during interaction
});
```

## Runtime Physics Adjustment

You can adjust physics parameters at runtime for dynamic effects:

```ts
// Create a pulsing effect by varying gravity
let pulse = 0;
setInterval(() => {
  pulse = Math.sin(Date.now() * 0.002) * 0.003;
  graph.setPhysics({ gravity: 0.0022 + pulse });
}, 16);

// Respond to user input
document.getElementById('repulsion-slider').addEventListener('input', e => {
  graph.setPhysics({ repulsion: parseInt(e.target.value) });
});

// Temporary boost for layout improvement
function improveLayout() {
  const original = graph.physics.options;
  graph.setPhysics({
    ...original,
    temperature: 1.0,   // Heat up the simulation
    damping: 0.85       // Reduce damping
  });
  
  // Cool down after 2 seconds
  setTimeout(() => {
    graph.setPhysics(original);
  }, 2000);
}
```

## Edge Length Control

Every link carries its own rest length: the distance the spring tries to keep
between its endpoints. Links created without one use their spawn distance.

```ts
// Set at creation time
graph.link('a', 'b', { restLength: 240 });

// Change later through the fluent handle. The solver eases toward the new
// target instead of jumping, even on a fully settled graph.
graph.linkById('a~b~0').restLength(90);
```

The transition speed is controlled by `restLengthSmooth`. While any length is
still easing, the engine stays awake; once every link reaches its target, the
normal sleep detection resumes.

Notes:
- Changing a rest length (or a link strength) wakes the simulation automatically, so updates apply to settled graphs too.
- `graph.reboot()` snaps all lengths to their declared targets instead of re-animating them.
- Set `restLengthSmooth: 0` to restore the instant snapping behavior of earlier versions.

## Performance Considerations

### Repulsion Calculations
The repulsion force is O(n²) in the worst case, but Graphium uses spatial hashing to reduce this to approximately O(n) for typical distributions. You can tune performance with:

- `repulsionRadius`: Smaller = fewer neighbors to check = better performance
- `maxNeighbors`: Hard cap on neighbors considered per node = predictable performance

### Solver Iterations
More `positionIterations` increases stability but costs more CPU:
- 1 iteration: Fast but may be unstable with stiff springs
- 2 iterations: Good balance (default)
- 3+ iterations: Very stable but higher CPU usage

### Sleep Optimization
When the graph sleeps, rendering stops completely and CPU usage drops to near zero:
- Tune `sleepEnergy` and `sleepFrames` to balance responsiveness with power saving
- Lower values = sleep easier but may wake frequently from minor disturbances
- Higher values = sleep less often but stay asleep longer when settled

## Diagnosing Physics Issues

### Nodes Flying Off to Infinity
- **Cause**: Insufficient repulsion or too much spring strength/gravity
- **Solution**: Increase `repulsion`, decrease `springStrength` or `gravity`

### Nodes Oscillating Violently
- **Cause**: Too little damping or too much spring strength
- **Solution**: Increase `damping`, decrease `springStrength`

### Graph Never Settles (Always Running)
- **Cause**: Too much energy in the system or sleep thresholds too high
- **Solution**: Increase `damping`, decrease `temperature`, lower `sleepEnergy` or `sleepFrames`

### Nodes Stuck in Local Minima
- **Cause**: Too much damping or not enough initial energy
- **Solution**: Decrease `damping`, increase `temperature` temporarily, or call `graph.reboot()`

### Edge Crossings Not Resolving
- **Cause**: Edge separation too low or disabled
- **Solution**: Increase `edgeSeparation` (try 0.5-0.8)

## Example Configurations

### Social Network Graph
```ts
// Many nodes, moderate density, need clear communities
graph.setPhysics({
  repulsion: 1200,
  repulsionRadius: 180,
  springStrength: 0.045,
  gravity: 0.002,
  damping: 0.93,
  edgeSeparation: 0.5,
  sleepEnergy: 0.0003
});
```

### Flowchart / Diagram
```ts
// Need clean hierarchies, minimal edge crossings
graph.setPhysics({
  repulsion: 1000,
  repulsionRadius: 220,
  springStrength: 0.06,
  gravity: 0.0025,
  damping: 0.9,
  positionIterations: 3,
  edgeSeparation: 0.7,
  sleepEnergy: 0.0002
});
```

### Molecular Structure
```ts
// Precise distances, rigid bonds
graph.setPhysics({
  repulsion: 600,
  repulsionRadius: 150,
  springStrength: 0.12,    // Very stiff bonds
  gravity: 0.001,
  damping: 0.85,
  positionIterations: 4,
  collisionStrength: 1.2,  // Strong collision prevention
  sleepEnergy: 0.0001
});
```

### Real-Time Monitoring
```ts
// Nodes frequently added/removed, need responsive interaction
graph.setPhysics({
  repulsion: 1000,
  repulsionRadius: 200,
  springStrength: 0.05,
  gravity: 0.002,
  damping: 0.88,
  throwFactor: 2.0,        // More momentum for interactive feel
  dragSmooth: 0.3,
  sleepEnergy: 0.001       // Less aggressive sleeping
});
```

## Best Practices

1. **Start with a preset**: Use `usePreset()` as your base, then tweak
2. **Change one parameter at a time**: Isolate the effect of each adjustment
3. **Consider your graph topology**: Dense vs sparse, hierarchical vs mesh
4. **Think about interaction**: More damping for stable viewing, less for responsive editing
5. **Watch performance**: Higher `positionIterations` and lower `repulsionRadius` cost more CPU
6. **Use sleep effectively**: Tune sleep parameters to save power when idle
7. **Reboot when needed**: Call `graph.reboot()` to restart simulation from current state
8. **Combine with theming**: Physics settings work alongside visual styling for optimal UX

## API Reference

```ts
// Apply a built-in preset
graph.usePreset(presetName: 'silk'|'bouncy'|'crystal'|'liquid');

// Apply a preset with overrides
graph.usePreset(presetName: string, options: Partial<PhysicsOptions>);

// Set physics options directly
graph.setPhysics(options: Partial<PhysicsOptions>);

// Get current physics options
const options = graph.physics.options;

// Reboot the simulation (useful after parameter changes)
graph.reboot();

// Get physics statistics
const stats = graph.stats();
// stats.physicsMs - time spent in physics calculation per frame
// stats.nodeCount, stats.linkCount - current counts
```