# Events & Interaction Guide

Learn how to handle user interactions and respond to events in Graphium, from basic clicks and drags to advanced custom interactions and gesture handling.

## Overview

Graphium provides a comprehensive event system that allows you to respond to user interactions like clicks, drags, zooms, and hovers, as well as internal events like sleep/wake cycles and image loading. The event system follows familiar patterns similar to DOM events but is tailored for graph-specific interactions.

## Event Categories

Graphium events fall into several categories:

### Input Events
- **Mouse/Pointer**: click, dblclick, longpress, contextmenu, pointerdown, pointerup
- **Drag**: drag, dragend
- **Zoom/Pan**: zoom, pan, pinch (touch)
- **Hover**: hover

### Graph State Events
- **Simulation**: sleep, wake, start, stop
- **Data**: dataupdated
- **Resources**: imageload, imageerror
- **Links**: linkclick

### Event Payloads
Every pointer event payload carries `type`, `originalEvent`, `nodeIndex`, `nodeId`, `linkIndex`, `linkId`, `screenX`, `screenY`, `worldX` and `worldY`, so handlers can act on ids without re-picking:
```ts
graph.on('click', event => {
  if (event.nodeId) console.log('clicked node', event.nodeId);
  if (event.linkId) console.log('clicked link', event.linkId);
});
```

## Basic Event Handling

### Subscribing to Events
```ts
// Mouse click on any node or background
graph.on('click', event => {
  if (event.nodeId) {
    console.log(`Clicked node: ${event.nodeId}`);
  } else {
    console.log('Clicked background');
  }
});

// Double click
graph.on('dblclick', event => {
  console.log(`Double clicked: ${event.nodeId ? 'node' : 'background'}`);
});

// Long press (touch and hold)
graph.on('longpress', event => {
  console.log(`Long pressed: ${event.nodeId}`);
});

// Context menu (right click or long press)
graph.on('contextmenu', event => {
  event.preventDefault(); // Prevent browser context menu
  console.log('Context menu triggered');
});
```

### Drag Events
```ts
// Press on a node (drag feedback starts here)
graph.on('pointerdown', event => {
  if (event.nodeId) console.log(`Pressed: ${event.nodeId}`);
});

// During drag
graph.on('drag', event => {
  console.log(`Dragging ${event.nodeId} to (${event.worldX}, ${event.worldY})`);
});

// Drag end
graph.on('dragend', event => {
  console.log(`Ended dragging ${event.nodeId}`);
  console.log(`Final position: (${event.worldX}, ${event.worldY})`);
  console.log(`Velocity: (${event.vx}, ${event.vy})`);
});
```

### Zoom and Pan Events
```ts
// Zoom with mouse wheel or pinch gesture
graph.on('zoom', event => {
  console.log(`Zoom level: ${event.zoomLevel}`);
  console.log(`Zoom point: (${event.worldX}, ${event.worldY})`);
});

// Pan (dragging background)
graph.on('pan', event => {
  console.log(`Panned by: (${event.dx}, ${event.dy})`);
  console.log(`New center: (${event.centerX}, ${event.centerY})`);
});

// Pinch gesture (touchscreens)
graph.on('pinch', event => {
  console.log(`Pinch scale: ${event.scale}`);
});
```

### Hover Events
```ts
// Hover start (mouse enters node)
graph.on('hover', event => {
  console.log(`Hovering over: ${event.nodeId}`);
  // Show tooltip, highlight connections, etc.
});

// Hover end (the same event fires with nodeIndex -1 when the pointer
// leaves every node, or when it leaves the canvas)
graph.on('hover', event => {
  if (event.nodeIndex < 0) {
    console.log('Stopped hovering over nodes');
    // Hide tooltip, reset highlights
  }
});
```

### Simulation Events
```ts
// When the physics simulation starts stabilizing
graph.on('sleep', () => {
  console.log('Layout settled - simulation sleeping');
  // Save battery, reduce CPU usage
});

// When the simulation wakes up (due to interaction or data change)
graph.on('wake', () => {
  console.log('Layout changing - simulation awake');
  // Resume full functionality
});

// Manual control
graph.on('start', () => console.log('Simulation started'));
graph.on('stop', () => console.log('Simulation stopped'));
```

### Data Events
```ts
// When graph data changes (nodes/links added/removed/modified)
graph.on('dataupdated', () => {
  console.log('Graph data updated');
  // Update external controls, save to persistence layer, etc.
});

// When images finish loading
graph.on('imageload', event => {
  console.log(`Image loaded: ${event.url} for node ${event.nodeId}`);
});

// When images fail to load
graph.on('imageerror', event => {
  console.log(`Image failed: ${event.url} for node ${event.nodeId}`);
  // Show fallback image or error indicator
});
```

## Event Object Properties

All event objects contain common properties, with additional properties specific to each event type:

### Common Properties
| Property | Type | Description |
|----------|------|-------------|
| `type` | String | Event type (e.g., 'click', 'drag') |
| `timestamp` | Number | Time since graph creation in milliseconds |

### Mouse/Pointer Events
| Property | Type | Description |
|----------|------|-------------|
| `nodeId` | String\|null | ID of node under pointer, or null if background |
| `nodeIndex` | Number\|null | Numerical index of node, or null |
| `linkId` | String\|null | ID of link under pointer, or null |
| `linkIndex` | Number\|null | Numerical index of link, or null |
| `worldX` | Number | X coordinate in world space |
| `worldY` | Number | Y coordinate in world space |
| `screenX` | Number | X coordinate in screen space |
| `screenY` | Number | Y coordinate in screen space |
| `pointerId` | Number | Pointer ID (for multi-touch) |
| `pressure` | Number | Pressure sensitivity (0-1, if available) |

### Drag Events (extend pointer events)
| Property | Type | Description |
|----------|------|-------------|
| `vx` | Number | Velocity X component |
| `vy` | Number | Velocity Y component |
| `dragX` | Number | Total drag distance X |
| `dragY` | Number | Total drag distance Y |

### Zoom Events
| Property | Type | Description |
|----------|------|-------------|
| `zoomLevel` | Number | Current zoom level (1.0 = 100%) |
| `zoomPointX` | Number | World X coordinate where zoom originated |
| `zoomPointY` | Number | World Y coordinate where zoom originated |

### Pan Events
| Property | Type | Description |
|----------|------|-------------|
| `dx` | Number | Change in X position |
| `dy` | Number | Change in Y position |
| `centerX` | Number | New view center X |
| `centerY` | Number | New view center Y |

### Sleep/Wake Events
| Property | Type | Description |
|----------|------|-------------|
| `sleeping` | Boolean | Whether the graph is now sleeping (wake event only) |

### Image Events
| Property | Type | Description |
|----------|------|-------------|
| `type` | String | `imageload` or `imageerror` |
| `url` | String | URL of the image that loaded or failed |
| `slot` | Number | Atlas slot assigned to the image |

## Working with Specific Nodes and Links

Handles are value objects for styling and geometry; they do not carry event
subscriptions. Subscribe on the graph and filter payloads by id:

```ts
// React to interactions with one specific node
graph.on('click', event => {
  if (event.nodeId === 'alice') {
    console.log('Alice was clicked!');
    highlightConnections('alice');
  }
});

// The hover event fires on every move and with nodeIndex -1 when the
// pointer leaves every node or the canvas
graph.on('hover', event => {
  if (event.nodeId === 'alice') {
    highlightConnections('alice');
  } else if (event.nodeIndex < 0) {
    resetHighlights();
  }
});

// React to a finished drag of one node
graph.on('dragend', event => {
  if (event.nodeId === 'alice') {
    saveNodePosition('alice', event.worldX, event.worldY);
  }
});

// Link clicks arrive through the linkclick event
graph.on('linkclick', event => {
  if (event.linkId === 'bob~carol~0') {
    showLinkDetails(event.linkId);
  }
});

// Handles are still the tool for styling and reading state
const alice = graph.node('alice');
if (alice) {
  alice.color('#4ecdc4');
  const snapshot = alice.snapshot; // { id, x, y, label, ... } or null
}
```

## Event Unsubscribing## Event Unsubscribing

### Manual Unsubscription
```ts
// When you subscribe, you get a stopper function
const stopper = graph.on('click', (event) => {
  console.log('Clicked!');
  // ... handle click
});

// Later, when you no longer need the listener:
stopper(); // Removes the listener

// Listeners scoped to one node use the graph emitter plus an id check
const isAlice = event => event.nodeId === 'alice';
const nodeStopper = graph.on('hover', event => {
  if (isAlice(event)) console.log('Hovering over Alice');
});

// Later:
nodeStopper(); // Removes the listener
```

### Batch Unsubscription
```ts
// Store multiple stoppers
const stoppers = [];

// Add several listeners
stoppers.push(graph.on('click', handleClick));
stoppers.push(graph.on('dragend', handleDragEnd));
stoppers.push(graph.on('sleep', handleSleep));
stoppers.push(graph.on('hover', event => {
  if (event.nodeId === 'important') handleImportantHover(event);
}));

// Later, remove all at once
stoppers.forEach(stopper => stopper());
stoppers = []; // Clear the array
```

### Using AbortController (Modern Approach)
```ts
// Create a controller for a group of listeners
const controller = new AbortController();
const { signal } = controller;

// The emitter accepts only (type, listener), so wire the signal yourself
graph.on('click', e => { if (!signal.aborted) handler(e); });
graph.on('hover', e => { if (!signal.aborted) handler(e); });
graph.on('dragend', e => { if (!signal.aborted) handler(e); });

// Later, cancel all listeners associated with this controller
controller.abort();
// This is similar to how fetch() abort works
```

## Custom Events and Event Extension

### Creating Custom Events
While Graphium doesn't have a built-in custom event system, you can extend it:

```ts
// Custom event wrapper
class GraphiumEvents {
  constructor(graph) {
    this.graph = graph;
    this.listeners = new Map();
  }
  
  on(type, listener, options) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
      
      // If it's a standard Graphium event, subscribe to it
      if (this.isStandardEvent(type)) {
        const stopper = this.graph.on(type, (event) => {
          this.emit(type, event);
        });
        
        // Store stopper for cleanup
        if (!this.stoppers) this.stoppers = new Map();
        this.stoppers.set(type, stopper);
      }
    }
    
    this.listeners.get(type).push(listener);
    
    // Return stopper function
    return () => {
      const listeners = this.listeners.get(type) || [];
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
      
      // If no more listeners and it's a standard event, unsubscribe
      if (listeners.length === 0 && this.isStandardEvent(type)) {
        const stopper = this.stoppers?.get(type);
        if (stopper) {
          stopper();
          this.stoppers.delete(type);
        }
      }
    };
  }
  
  emit(type, event) {
    const listeners = this.listeners.get(type) || [];
    listeners.forEach(listener => listener(event));
  }
  
  isStandardEvent(type) {
    const standardEvents = new Set([
      'click', 'dblclick', 'longpress', 'contextmenu', 'linkclick',
      'drag', 'dragend', 'pointerdown', 'pointerup',
      'zoom', 'pan', 'pinch',
      'hover',
      'sleep', 'wake', 'start', 'stop',
      'dataupdated', 'imageload', 'imageerror'
    ]);
    
    return standardEvents.has(type);
  }
}

// Usage
const events = new GraphiumEvents(graph);

// Subscribe to standard events
events.on('click', (event) => {
  console.log('Custom click handler:', event.nodeId);
});

// Subscribe to custom events
events.on('nodedblclick', (event) => {
  console.log('Custom nodedblclick event!');
});

// Emit custom events
graph.on('dblclick', (event) => {
  events.emit('nodedblclick', event);
});

// Later, clean up
// (In practice, you'd manage the lifecycle of the Events object)
```

## Interaction Configuration

### Tuning Interaction Parameters
```ts
// Adjust how the graph responds to user input
graph.setInteraction({
  // Gesture toggles
  dragEnabled: true,          // Whether dragging nodes is enabled
  zoomEnabled: true,          // Whether zooming is enabled
  panEnabled: true,           // Whether panning is enabled
  hoverEnabled: true,         // Whether hover detection is enabled

  // Feel tuning
  wheelZoomSpeed: 1.2,        // Multiplier per wheel notch (higher = faster zoom)
  dragThreshold: 4,           // Pixels of movement before a press becomes a drag
  longPressMs: 550,           // Time to hold for a long press (ms)
  linkHitRadius: 8            // Screen-space tolerance for clicking links (px)
});
```

Node drag elasticity (`dragSmooth`) and release momentum (`throwFactor`) live in the physics options, not in interaction settings: use `graph.setPhysics({ dragSmooth, throwFactor })`.

### Disabling Specific Interactions
```ts
// Create a read-only graph view
graph.setInteraction({
  dragEnabled: false,
  zoomEnabled: false,
  panEnabled: false,
  hoverEnabled: false
});

// Create a graph that only allows zooming and panning (no node manipulation)
graph.setInteraction({
  dragEnabled: false,
  zoomEnabled: true,
  panEnabled: true,
  hoverEnabled: true
});

// Create a graph for mobile devices (adjust touch sensitivity)
graph.setInteraction({
  wheelZoomSpeed: 1.4,      // Fewer wheel notches to zoom
  dragThreshold: 8          // Require more deliberate drags
});
```

## Camera Bounds (constrainToViewport)

The `constrainToViewport` option keeps the camera inside the area occupied by the graph, so users cannot pan or zoom the content off screen.

### Enabling the Constraint
```ts
const graph = Graphium.create({
  container: document.getElementById('graph'),
  constrainToViewport: true   // camera is confined to the graph bounds
});
```

When enabled, the camera bounds are derived from the node positions (including their visual radius) and are kept up to date automatically:

- Data operations (`addNode`, `addNodes`, `addLinks`, `setData`, `removeNode`, `clear`) recompute the bounds immediately.
- Node movement — including physics simulation and dragging — recomputes the bounds on every rendered frame, so the clamp always reflects the current layout.
- Hidden nodes are excluded from the bounds and do not restrict the camera.
- Resizing the canvas re-applies the bounds.

### Manual Bounds Control
```ts
// Set bounds explicitly (world coordinates); the camera clamps inside it
graph.camera.setBounds(0, 0, 2000, 1000);

// Remove the constraint and allow free panning
graph.camera.clearBounds();

// Inspect the current bounds (null when unconstrained)
const bounds = graph.camera.getBounds(); // { minX, minY, maxX, maxY } | null
```

### Clamping Behavior
- When the bounded content is **larger** than the viewport, panning is limited so no empty area is shown beyond the content edges, at any zoom level.
- When the content **fits** the viewport, panning stays free within a margin, but the content center is confined to the middle half of the viewport, so the content can never be pushed off screen entirely (at least half of it remains visible). Use `graph.fit()` or `graph.centerOn(x, y)` to center small content deliberately.
- Zooming (wheel and pinch) is anchored to the pointer position and re-clamped, so zooming never breaks containment.

### Dragging Nodes
When `constrainToViewport` is enabled, node dragging is constrained too: the drag target is clamped to the visible world rectangle inset by the node's visual radius, so a node can never be dragged out of the visible canvas. A node whose radius exceeds half the viewport (very deep zoom) is held at the camera center.

Nodes pushed by the physics simulation are not clamped — while the graph is larger than the viewport they may move past the edge; pan to bring them back, knowing the camera clamp guarantees the content never disappears entirely.

## Advanced Interaction Patterns

### Context Menus
```ts
// Prevent default context menu and show custom one
graph.on('contextmenu', event => {
  event.preventDefault(); // Prevent browser menu
  
  if (event.nodeId) {
    showNodeContextMenu(event.nodeId, event.screenX, event.screenY);
  } else if (event.linkId) {
    showLinkContextMenu(event.linkId, event.screenX, event.screenY);
  } else {
    showBackgroundContextMenu(event.screenX, event.screenY);
  }
});

// Context menu implementations would use DOM elements positioned at the coordinates
function showNodeContextMenu(nodeId, x, y) {
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  
  menu.innerHTML = `
    <div class="menu-item" data-action="edit">Edit Node</div>
    <div class="menu-item" data-action="delete">Delete Node</div>
    <div class="menu-item" data-action="duplicate">Duplicate Node</div>
    <div class="menu-separator"></div>
    <div class="menu-item" data-action="connections">Show Connections</div>
    <div class="menu-item" data-action="center">Center on Node</div>
  `;
  
  document.body.appendChild(menu);
  
  // Handle menu clicks
  const handleMenuClick = (e) => {
    const action = e.target.dataset.action;
    if (action) {
      handleContextMenuAction(nodeId, action);
    }
    menu.remove();
    document.removeEventListener('click', handleMenuClick);
  };
  
  document.addEventListener('click', handleMenuClick);
}

function handleContextMenuAction(nodeId, action) {
  switch (action) {
    case 'edit':
      editNodeDetails(nodeId);
      break;
    case 'delete':
      graph.removeNode(nodeId);
      break;
    case 'duplicate':
      duplicateNode(nodeId);
      break;
    case 'connections':
      showNodeConnections(nodeId);
      break;
    case 'center':
      graph.centerOnNode(nodeId);
      break;
  }
}
```

### Node Selection and Multi-Select
```ts
// Track selected nodes in your application state
const selectedNodes = new Set();

// Handle node clicks for selection
graph.on('click', event => {
  if (event.nodeId) {
    const { shiftKey, ctrlKey, metaKey } = event; // From the event object
    
    if (shiftKey && selectedNodes.size > 0) {
      // Shift-click: range selection (would need implementation)
      selectRange(lastClickedNode, event.nodeId);
    } else if (ctrlKey || metaKey) {
      // Ctrl/Cmd-click: toggle selection
      if (selectedNodes.has(event.nodeId)) {
        selectedNodes.delete(event.nodeId);
        graph.node(event.nodeId).selected(false);
      } else {
        selectedNodes.add(event.nodeId);
        graph.node(event.nodeId).selected(true);
      }
      lastClickedNode = event.nodeId;
    } else {
      // Plain click: select only this node
      selectedNodes.clear();
      selectedNodes.add(event.nodeId);
      
      // Update visual selection state
      graph.nodes().forEach(node => {
        graph.node(node.id).selected(selectedNodes.has(node.id));
      });
      
      lastClickedNode = event.nodeId;
    }
    
    // Update UI based on selection
    updateSelectionControls();
  }
});

// Alternative: Use Graphium's built-in selection methods
graph.on('click', event => {
  if (event.nodeId) {
    const { shiftKey, ctrlKey, metaKey } = event;
    
    if (shiftKey) {
      // Extend selection
      const lastSelected = getLastSelectedNode(); // You'd track this
      if (lastSelected) {
        graph.selectNode(event.nodeId, true, true); // additive=true, preserveExisting=true
      } else {
        graph.selectNode(event.nodeId); // Just select this one
      }
    } else if (ctrlKey || metaKey) {
      // Toggle selection
      if (graph.isNodeSelected(event.nodeId)) {
        graph.selectNode(event.nodeId, false, true); // selective=false, additive=true
      } else {
        graph.selectNode(event.nodeId, true, true);  // selective=true, additive=true
      }
    } else {
      // Select only this node
      graph.selectNode(event.nodeId); // This clears previous selection
    }
  } else {
    // Clicked background - clear selection unless modifier key held
    if (!(event.ctrlKey || event.metaKey || event.shiftKey)) {
      graph.selectNode(null); // Clear selection
    }
  }
});

// Respond to selection changes
graph.on('select', event => {
  console.log(`Selection changed: ${event.nodes.length} nodes selected`);
  updateSelectionUI(event.nodes);
});

// Note: Graphium doesn't emit a native 'select' event - you would wrap selectNode
const originalSelectNode = graph.selectNode.bind(graph);
graph.selectNode = (nodeId, additive = false, preserveExisting = false) => {
  const result = originalSelectNode(nodeId, additive, preserveExisting);
  
  // Emit custom selection event
  const selectedNodeIds = getCurrentlySelectedNodeIds(); // You'd implement this
  graph.emit('select', { nodes: selectedNodeIds });
  
  return result;
});
```

### Marquee (Box) Selection
```ts
// Enable marquee selection by dragging on background
let marqueeStart = null;
let marqueeElement = null;

graph.on('pointerdown', event => {
  // Only start marquee if pressing on background
  if (!event.nodeId && !event.linkId) {
    marqueeStart = { x: event.screenX, y: event.screenY };
    
    // Create marquee selection element
    marqueeElement = document.createElement('div');
    marqueeElement.className = 'marquee-selection';
    marqueeElement.style.left = `${event.screenX}px`;
    marqueeElement.style.top = `${event.screenY}px`;
    marqueeElement.style.width = '0px';
    marqueeElement.style.height = '0px';
    document.body.appendChild(marqueeElement);
  }
});

graph.on('drag', event => {
  if (marqueeStart) {
    const currentX = event.screenX;
    const currentY = event.screenY;
    
    const minX = Math.min(marqueeStart.x, currentX);
    const minY = Math.min(marqueeStart.y, currentY);
    const width = Math.abs(currentX - marqueeStart.x);
    const height = Math.abs(currentY - marqueeStart.y);
    
    marqueeElement.style.left = `${minX}px`;
    marqueeElement.style.top = `${minY}px`;
    marqueeElement.style.width = `${width}px`;
    marqueeElement.style.height = `${height}px`;
  }
});

graph.on('dragend', event => {
  if (marqueeStart) {
    // Find nodes within the marquee rectangle
    const selectedNodes = [];
    
    const minX = Math.min(marqueeStart.x, event.screenX);
    const minY = Math.min(marqueeStart.y, event.screenY);
    const maxX = Math.max(marqueeStart.x, event.screenX);
    const maxY = Math.max(marqueeStart.y, event.screenY);
    
    // Convert screen coordinates to world coordinates
    const worldMin = graph.screenToWorld(minX, minY);
    const worldMax = graph.screenToWorld(maxX, maxY);
    
    // Check each node
    graph.nodes().forEach(node => {
      const nodePos = graph.getNodePosition(node.id);
      if (
        nodePos.x >= worldMin.x && nodePos.x <= worldMax.x &&
        nodePos.y >= worldMin.y && nodePos.y <= worldMax.y
      ) {
        selectedNodes.push(node.id);
      }
    });
    
    // Apply selection (would depend on your selection model)
    applySelection(selectedNodes);
    
    // Clean up
    if (marqueeElement) {
      marqueeElement.parentNode.removeChild(marqueeElement);
      marqueeElement = null;
    }
    marqueeStart = null;
  }
});
```

### Custom Drag Feedback
```ts
// Show what will be dragged when the press starts
graph.on('pointerdown', event => {
  if (event.nodeId) {
    // Show preview of what's being dragged
    const node = graph.getNode(event.nodeId);
    if (node) {
      showDragPreview(node, event.worldX, event.worldY);
    }
  }
});

// During drag, update preview
graph.on('drag', event => {
  if (event.nodeId) {
    updateDragPreview(event.nodeId, event.worldX, event.worldY);
  }
});

// Hide preview when drag ends
graph.on('dragend', event => {
  if (event.nodeId) {
    hideDragPreview();
    
    // Optionally: snap to grid or align with other nodes
    if (shouldSnapToGrid()) {
      snapNodeToGrid(event.nodeId, Math.round(event.worldX / 10) * 10, 
                                 Math.round(event.worldY / 10) * 10);
    }
  }
});

// Drag preview implementations
function showDragPreview(node, x, y) {
  // Create a semi-transparent copy of the node at drag position
  // Or show a ghost indicator
  const preview = document.createElement('div');
  preview.className = 'drag-preview';
  preview.style.position = 'fixed';
  preview.style.left = `${x}px`;
  preview.style.top = `${y}px`;
  preview.style.width = `${node.radius * 2}px`;
  preview.style.height = `${node.radius * 2}px`;
  preview.style.backgroundColor = node.color || '#ccc';
  preview.style.borderRadius = '50%';
  preview.style.opacity = '0.6';
  preview.style.pointerEvents = 'none';
  preview.style.zIndex = '1000';
  
  document.body.appendChild(preview);
  
  // Store reference for updates
  node._dragPreview = preview;
}

function updateDragPreview(nodeId, x, y) {
  const preview = graph.getNode(nodeId)?._dragPreview;
  if (preview) {
    preview.style.left = `${x}px`;
    preview.style.top = `${y}px`;
  }
}

function hideDragPreview() {
  // Remove all drag previews
  document.querySelectorAll('.drag-preview').forEach(el => el.remove());
  
  // Clean up references
  graph.nodes().forEach(node => {
    delete node._dragPreview;
  });
}
```

## Performance Considerations

### Event Listener Efficiency
```ts
// Instead of trying to attach listeners per node (handles do not emit):
inefficientButCommonApproach:
nodes.forEach(nodeId => {
  // graph.node(nodeId).on('hover', ...) does not exist
});

// Use event delegation (more efficient):
efficientApproach:
graph.on('hover', event => {
  if (event.nodeId) {
    updateTooltip(event.nodeId);
  }
});

graph.on('hover', event => {
  if (event.nodeIndex < 0) {
    hideTooltip();
  }
});

// For handle-specific events when you need per-node state:
// Still more efficient than per-node listeners in most cases
graph.on('hover', event => {
  if (event.nodeId) {
    const node = graph.getNode(event.nodeId);
    if (node && node.needsSpecialHoverHandling) {
      showSpecialTooltip(event.nodeId);
    }
  }
});
```

### Throttling and Debouncing
```ts
// Throttle rapid-fire events (like drag or zoom)
function throttle(callback, delay) {
  let lastCall = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      return callback(...args);
    }
  };
}

// Debounce events that happen in bursts
function debounce(callback, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => callback(...args), delay);
  };
}

// Apply to graph events
graph.on('drag', throttle((event) => {
  // Expensive operation during drag
  updateNodeConnectionsInRealTime(event.nodeId);
}, 16)); // ~60fps

graph.on('zoom', debounce((event) => {
  // Update URL or save view state after zooming stops
  saveCurrentViewState();
}, 300));

graph.on('dataupdated', debounce(() => {
  // Save to persistence layer after batch updates
  saveGraphToDatabase();
}, 1000));
```

### Reducing Event Frequency
```ts
// For high-frequency events, consider if you need every instance
graph.on('drag', (event) => {
  // Only update every 5th drag event to reduce workload
  const dragCount = getDragCountForNode(event.nodeId) || 0;
  if (dragCount % 5 === 0) {
    updatePositionIndicator(event.nodeId, event.worldX, event.worldY);
  }
  incrementDragCount(event.nodeId);
});

// Or sample based on time
const lastUpdate = new Map();
graph.on('drag', (event) => {
  const now = Date.now();
  const lastTime = lastUpdate.get(event.nodeId) || 0;
  
  if (now - lastTime >= 100) { // Update at most 10 times per second
    updatePositionIndicator(event.nodeId, event.worldX, event.worldY);
    lastUpdate.set(event.nodeId, now);
  }
});
```

## Accessibility Considerations

### Keyboard Navigation
```ts
// Enable keyboard navigation for accessibility
graph.setInteraction({
  enableKeyboardNavigation: true,
  focusOutlineWidth: 2,
  focusOutlineColor: '#0066ff'
});

// Listen for keyboard events when graph has focus
graph.on('keydown', event => {
  switch (event.key) {
    case 'ArrowUp':
      moveFocus('up');
      break;
    case 'ArrowDown':
      moveFocus('down');
      break;
    case 'ArrowLeft':
      moveFocus('left');
      break;
    case 'ArrowRight':
      moveFocus('right');
      break;
    case 'Enter':
    case ' ':
      activateFocusedNode();
      break;
    case 'Escape':
      clearFocus();
      break;
  }
});

// Implementation would track a focused node index
let focusedNodeIndex = null;

function moveFocus(direction) {
  const nodes = graph.nodes();
  if (nodes.length === 0) return;
  
  if (focusedNodeIndex === null) {
    focusedNodeIndex = 0;
  } else {
    switch (direction) {
      case 'up':    focusedNodeIndex = (focusedNodeIndex - 1 + nodes.length) % nodes.length; break;
      case 'down':  focusedNodeIndex = (focusedNodeIndex + 1) % nodes.length; break;
      case 'left':  // More complex - would need spatial navigation
      case 'right': // More complex - would need spatial navigation
    }
  }
  
  const nodeId = nodes[focusedNodeIndex].id;
  graph.focusNode(nodeId); // Assuming such a method exists
  // Or manually set selection/styles
  graph.node(nodeId).select();
  
  // Scroll node into view if needed
  const nodePos = graph.getNodePosition(nodeId);
  const viewport = graph.getViewport();
  // ... adjust camera if node is outside viewport
}

function activateFocusedNode() {
  if (focusedNodeIndex !== null) {
    const nodes = graph.nodes();
    const nodeId = nodes[focusedNodeIndex].id;
    // Trigger click or default action
    graph.node(nodeId).select().fix(); // Example action
  }
}

function clearFocus() {
  if (focusedNodeIndex !== null) {
    const nodes = graph.nodes();
    const nodeId = nodes[focusedNodeIndex].id;
    graph.node(nodeId).selected(false);
    focusedNodeIndex = null;
  }
}
```

### ARIA Labels and Screen Reader Support
```ts
// While Graphium renders to canvas (not accessible by default),
// you can provide accessibility through alternative means:

// 1. Provide a text alternative in ARIA-label on container
const graphContainer = document.getElementById('graph-container');
graphContainer.setAttribute('aria-label', 
  'Social network visualization showing 124 people and their connections'
);

// 2. Offer a table or list alternative for screen readers
function createAccessibleAlternative() {
  const nodes = graph.nodes();
  const links = graph.links();
  
  // Create accessible description
  const description = `
    This graph contains ${nodes.length} nodes and ${links.length} links.
    Nodes represent: ${getNodeTypesSummary()}.
    Links represent: ${getLinkTypesSummary()}.
    Most connected node: ${getMostConnectedNode()}.
  `;
  
  // Put in visually hidden but screen reader accessible element
  const altText = document.createElement('div');
  altText.className = 'visually-hidden';
  altText.setAttribute('aria-hidden', 'false');
  altText.textContent = description;
  
  graphContainer.parentNode.insertBefore(altText, graphContainer.nextSibling);
}

// 3. Provide keyboard-navigable list of nodes
function createNodeList() {
  const nodes = graph.nodes();
  const list = document.createElement('ul');
  list.className = 'node-list-accessible';
  
  nodes.forEach(node => {
    const item = document.createElement('li');
    item.tabIndex = 0; // Make keyboard focusable
    item.textContent = `${node.label} (${node.degree} connections)`;
    
    // When activated, focus the node in the graph
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        graph.focusNode(node.id);
        item.focus(); // Refocus for continued navigation
      }
    });
    
    list.appendChild(item);
  });
  
  return list;
}
```

## Best Practices

### 1. Keep Listeners Lightweight
```ts
// ❌ Avoid expensive operations in event listeners
graph.on('drag', event => {
  // DON'T do this - runs on every drag pixel
  const allNodes = graph.nodes();
  const allLinks = graph.links();
  const expensiveCalculation = computeSomeComplexMetric(allNodes, allLinks);
  updateExpensiveUI(expensiveCalculation);
});

// ✅ Do lightweight work in listeners, defer expensive operations
graph.on('drag', event => {
  // Just update position indicator - fast
  updatePositionDisplay(event.nodeId, event.worldX, event.worldY);
  
  // Debounce expensive updates
  scheduleExpensiveUpdate();
});

// ✅ Or use requestAnimationFrame for visual updates
graph.on('drag', event => {
  requestAnimationFrame(() => {
    updateDragPreviewVisuals(event.nodeId, event.worldX, event.worldY);
  });
});
```

### 2. Clean Up Listeners Properly
```ts
// ✅ Always clean up when components unmount
class GraphComponent {
  constructor() {
    this.stoppers = [];
  }
  
  init() {
    // Store stoppers for cleanup
    this.stoppers.push(graph.on('click', this.handleClick.bind(this)));
    this.stoppers.push(graph.on('dragend', this.handleDragEnd.bind(this)));
    this.stoppers.push(graph.on('sleep', this.handleSleep.bind(this)));
    
    // Handle-specific stoppers
    this.stoppers.push(
      graph.node('important-node').on('hover', this.handleImportantHover.bind(this))
    );
  }
  
  destroy() {
    // Remove all listeners
    this.stoppers.forEach(stopper => stopper());
    this.stoppers = [];
  }
}

// ✅ Or use AbortController for groups
class GraphFeature {
  constructor() {
    this.controller = new AbortController();
  }
  
  init() {
    const { signal } = this.controller;
    
    graph.on('click', this.handleClick, { signal });
    graph.on('zoom', this.handleZoom, { signal });
    graph.node('special-node').on('hover', this.handleSpecialHover, { signal });
  }
  
  destroy() {
    // Abort all associated listeners at once
    this.controller.abort();
  }
}
```

### 3. Consider Event Frequency
```ts
// ❌ Don't assume low frequency
// Some events can fire hundreds of times per second:
graph.on('drag', (event) => {
  // This might run 60+ times per second during a drag
  console.log(`Dragging ${event.nodeId}`); // Avoid console.log in performance critical code
});

// ✅ Throttle high-frequency events
graph.on('drag', throttle((event) => {
  // Now runs at most 10 times per second
  updateDragHints(event.nodeId, event.worldX, event.worldY);
}, 100));

// ✅ Use appropriate events for your needs
// Use dragend instead of drag when you only need final result
graph.on('dragend', (event) => {
  // Runs once when drag completes
  saveFinalPosition(event.nodeId, event.worldX, event.worldY);
});

// Use drag instead of dragend when you need continuous feedback
graph.on('drag', (event) => {
  // Runs continuously during drag
  updateDragPreview(event.nodeId, event.worldX, event.worldY);
});
```

### 4. Handle Edge Cases
```ts
// ❌ Forgetting to check for null values
graph.on('click', event => {
  // This will crash if event.nodeId is null and you try to use it
  const node = graph.getNode(event.nodeId); // ERROR if nodeId is null
  console.log(`Clicked ${node.label}`);
});

// ✅ Always check for null/undefined values
graph.on('click', event => {
  if (event.nodeId) {
    const node = graph.getNode(event.nodeId);
    if (node) {
      console.log(`Clicked ${node.label}`);
    }
  } else {
    console.log('Clicked background');
  }
});

// ❌ Assuming events always come from user interaction
// Some events can be triggered programmatically
graph.on('dragend', event => {
  // This might fire from code like: graph.node('alice').fix().drag(100, 0);
  // Don't assume it's always a user gesture
  if (event.isUserInteraction) {
    // Handle user-initiated drag end
    saveUserDragPosition(event.nodeId, event.worldX, event.worldY);
  } else {
    // Handle programmatically initiated drag end
    // Maybe just update internal state without saving to DB
    updateInternalPosition(event.nodeId, event.worldX, event.worldY);
  }
});

// Better approach: Separate concerns
graph.on('dragend', event => {
  // Always update visual/positional state
  updateNodePosition(event.nodeId, event.worldX, event.worldY);
  
  // Only handle user interaction consequences
  if (event.isUserInteraction) {
    trackUserInteraction('dragend');
    maybeShowDragTips();
  }
});
```

### 5. Work with Graphium's Coordinate Systems
```ts
// ❌ Mixing up coordinate systems
graph.on('click', event => {
  // event.worldX/Y are in world coordinates
  // But if you're comparing to screen positions, you need to convert
  
  const screenX = event.screenX; // pixels from left of viewport
  const screenY = event.screenY; // pixels from top of viewport
  
  const worldX = event.worldX; // graph world units
  const worldY = event.worldY; // graph world units
  
  // To check if click was near a specific screen position:
  const tolerance = 20; // pixels
  const targetScreenX = 100;
  const targetScreenY = 200;
  
  if (Math.abs(screenX - targetScreenX) < tolerance &&
      Math.abs(screenY - targetScreenY) < tolerance) {
    // Click was near target screen position
  }
  
  // To check if click was near a specific world position:
  const toleranceWorld = 10; // world units
  const targetWorldX = 50;
  const targetWorldY = -30;
  
  if (Math.abs(worldX - targetWorldX) < toleranceWorld &&
      Math.abs(worldY - targetWorldY) < toleranceWorld) {
    // Click was near target world position
  }
});

// ✅ Use helper methods for coordinate conversion
graph.on('click', event => {
  // Convert world position to screen position
  const screenPos = graph.worldToScreen(event.worldX, event.worldY);
  
  // Convert screen position to world position
  const worldPos = graph.screenToWorld(event.screenX, event.screenY);
  
  // These are useful for:
  // 1. Creating DOM elements at graph positions (worldToScreen)
  // 2. Determining what graph element is under mouse (screenToWorld)
});
```

## Common Interaction Patterns

### 1. Node Inspection Panel
```ts
// Show detailed information when clicking a node
graph.on('click', event => {
  if (event.nodeId) {
    const node = graph.getNode(event.nodeId);
    if (node) {
      showNodeInspector(node);
    }
  }
});

function showNodeInspector(node) {
  const inspector = document.getElementById('node-inspector') || createInspector();
  
  // Fill with node data
  inspector.querySelector('.name').textContent = node.label || node.id;
  inspector.querySelector('.id').textContent = `ID: ${node.id}`;
  inspector.querySelector('.connections').textContent = 
    `Connections: ${node.degree}`;
  inspector.querySelector('.title').textContent = 
    node.title || 'No title';
  // ... fill other fields
  
  // Position near node or in fixed panel
  const screenPos = graph.worldToScreen(node.x, node.y);
  inspector.style.left = `${screenPos.x + 20}px`;
  inspector.style.top = `${screenPos.y - 10}px`;
  
  inspector.style.display = 'block';
}

// Hide when clicking background or pressing Escape
graph.on('click', event => {
  if (!event.nodeId) {
    hideNodeInspector();
  }
});

graph.on('keydown', event => {
  if (event.key === 'Escape') {
    hideNodeInspector();
  }
});
```

### 2. Connection Highlighting on Hover
```ts
// Highlight connections when hovering over a node
let currentlyHoveredNode = null;

graph.on('hover', event => {
  if (event.nodeId && event.nodeId !== currentlyHoveredNode) {
    // Hide previous highlights
    if (currentlyHoveredNode) {
      hideNodeHighlight(currentlyHoveredNode);
      hideConnectionsHighlight(currentlyHoveredNode);
    }
    
    // Show new highlights
    showNodeHighlight(event.nodeId);
    showConnectionsHighlight(event.nodeId);
    currentlyHoveredNode = event.nodeId;
  }
});

graph.on('hover', event => {
  if (event.nodeIndex < 0 && currentlyHoveredNode) {
    hideNodeHighlight(currentlyHoveredNode);
    hideConnectionsHighlight(currentlyHoveredNode);
    currentlyHoveredNode = null;
  }
});

// Highlight implementations
function showNodeHighlight(nodeId) {
  graph.node(nodeId)
    .style({ 
      borderWidth: 3,
      borderColor: '#ff9f1c' 
    })
    .pulse(); // Assuming pulse method exists
}

function hideNodeHighlight(nodeId) {
  // Reset to theme defaults or previous state
  const node = graph.getNode(nodeId);
  if (node) {
    // Would need to restore previous state
    // Simplified: just reset border
    graph.node(nodeId).style({ borderWidth: 1, borderColor: '#ccc' });
  }
}

function showConnectionsHighlight(nodeId) {
  const node = graph.getNode(nodeId);
  if (!node) return;
  
  // Get connected nodes (would need implementation)
  const connectedIds = getConnectedNodeIds(nodeId);
  
  connectedIds.forEach(connectedId => {
    // Highlight the node
    graph.node(connectedId)
      .style({ 
        borderWidth: 2,
        borderColor: '#4cc9f0' 
      });
    
    // Highlight the link
    const linkId = getLinkId(nodeId, connectedId);
    if (linkId) {
      graph.linkById(linkId)
        .style({ 
          width: 2.5,
          color: '#4cc9f0' 
        });
    }
  });
}

function hideConnectionsHighlight(nodeId) {
  const node = graph.getNode(nodeId);
  if (!node) return;
  
  const connectedIds = getConnectedNodeIds(nodeId);
  
  connectedIds.forEach(connectedId => {
    // Reset node highlight
    graph.node(connectedId).style({ borderWidth: 1, borderColor: '#ccc' });
    
    // Reset link highlight
    const linkId = getLinkId(nodeId, connectedId);
    if (linkId) {
      graph.linkById(linkId).style({ width: 1, color: '#888' });
    }
  });
}

// Helper functions (would need to be implemented based on your graph structure)
function getConnectedNodeIds(nodeId) {
  // Return array of node IDs directly connected to nodeId
  // Implementation depends on how you store/retrieve connections
  return []; // Placeholder
}

function getLinkId(nodeId1, nodeId2) {
  // Return the link ID between two nodes, or null if not connected
  // Implementation depends on your link ID scheme
  return `${nodeId1}~${nodeId2}~0`; // Simplified assumption
}
```

### 3. Drag-to-Connect Interaction
```ts
// Allow users to create links by dragging from one node to another
let dragSource = null;
let dragPreviewLink = null;

graph.on('pointerdown', event => {
  if (event.nodeId) {
    // Remember which node we started from
    dragSource = event.nodeId;
    
    // Create a preview link that follows the mouse
    dragPreviewLink = document.createElement('div');
    dragPreviewLink.className = 'drag-preview-link';
    document.body.appendChild(dragPreviewLink);
  }
});

graph.on('drag', event => {
  if (dragSource) {
    // Update the preview link from source to current mouse position
    const sourceSnapshot = graph.getNode(dragSource);
    const sourcePos = sourceSnapshot ? { x: sourceSnapshot.x, y: sourceSnapshot.y } : null;
    updatePreviewLink(dragPreviewLink, sourcePos.x, sourcePos.y, 
                     event.worldX, event.worldY);
  }
});

graph.on('dragend', event => {
  // Clean up preview
  if (dragPreviewLink) {
    dragPreviewLink.parentNode.removeChild(dragPreviewLink);
    dragPreviewLink = null;
  }
  
  // If we ended on a valid node, create the link
  if (dragSource && event.nodeId && dragSource !== event.nodeId) {
    // Don't allow self-links
    const sourceId = dragSource;
    const targetId = event.nodeId;
    
    // Check if link already exists (optional)
    if (!graph.hasLink(sourceId, targetId)) {
      // Create the link
      graph.link(sourceId, targetId);
      
      // Optionally: automatically select the new link
      graph.selectLink(`${sourceId}~${targetId}~0`);
    }
    
    // Show feedback
    showLinkCreatedFeedback(sourceId, targetId);
  }
  
  // Reset drag source
  dragSource = null;
});

// Preview link implementation
function updatePreviewLink(element, x1, y1, x2, y2) {
  // Calculate length and angle
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  
  // Position and size the element
  element.style.left = `${x1}px`;
  element.style.top = `${y1}px`;
  element.style.width = `${length}px`;
  element.style.height = '2px'; // Thin line
  element.style.backgroundColor = '#4f8ef7';
  element.style.position = 'fixed';
  element.style.transformOrigin = '0 50%';
  element.style.transform = `rotate(${angle}rad)`;
  
  // Add arrowhead at end (simplified)
  // In practice, you'd use SVG or canvas for better arrows
}

// Feedback implementation
function showLinkCreatedFeedback(sourceId, targetId) {
  // Brief visual indication that link was created
  const sourceNode = graph.getNode(sourceId);
  const targetNode = getNode(targetId);
  
  if (sourceNode && targetNode) {
    // Flash both nodes
    [sourceNode, targetNode].forEach(node => {
      const originalColor = node.color;
      node.style({ color: '#ff9f1c' });
      
      setTimeout(() => {
        node.style({ color: originalColor });
      }, 300);
    });
    
    // Briefly highlight the new link
    const linkId = `${sourceId}~${targetId}~0`;
    const link = graph.getLink(linkId);
    if (link) {
      const originalWidth = link.width;
      const originalColor = link.color;
      
      link.style({ width: 3, color: '#ff9f1c' });
      
      setTimeout(() => {
        link.style({ width: originalWidth, color: originalColor });
      }, 300);
    }
  }
}
```

### 4. Context-Aware Toolbars
```ts
// Show different toolbars based on what's selected/hovered
let currentContext = null; // 'node', 'link', 'background', null

graph.on('hover', event => {
  let newContext = null;
  
  if (event.nodeId) {
    newContext = 'node';
  } else if (event.linkId) {
    newContext = 'link';
  } else {
    newContext = 'background';
  }
  
  if (newContext !== currentContext) {
    updateContextToolbar(newContext);
    currentContext = newContext;
  }
});

graph.on('hover', event => {
  // nodeIndex -1 means the pointer left every node
  if (event.nodeIndex < 0 && currentContext !== 'background') {
    updateContextToolbar('background');
    currentContext = 'background';
  }
});

// Click can also change context
graph.on('click', event => {
  if (event.nodeId) {
    updateContextToolbar('node-selected');
    // Could also show node-specific actions
  } else if (event.linkId) {
    updateContextToolbar('link-selected');
  } else {
    updateContextToolbar('background');
  }
});

function updateContextToolbar(context) {
  const toolbar = document.getElementById('context-toolbar');
  if (!toolbar) return;
  
  // Hide all context-specific sections
  toolbar.querySelectorAll('[data-context]').forEach(el => {
    el.style.display = 'none';
  });
  
  // Show the relevant section
  const section = toolbar.querySelector(`[data-context="${context}"]`);
  if (section) {
    section.style.display = 'flex';
    toolbar.style.display = 'flex';
  } else {
    toolbar.style.display = 'none';
  }
}

// Example toolbar HTML:
// <div id="context-toolbar" style="display: none;">
//   <div data-context="node">
//     <button onclick="editSelectedNode()">Edit</button>
//     <button onclick="deleteSelectedNode()">Delete</button>
//   </div>
//   <div data-context="node-selected">
//     <button onclick="mergeSelectedNodes()">Merge</button>
//     <button onclick="splitSelectedNode()">Split</button>
//   </div>
//   <div data-context="link">
//     <button onclick="editSelectedLink()">Edit Link</button>
//     <button onclick="deleteSelectedLink()">Delete Link</button>
//   </div>
//   <div data-context="background">
//     <button onclick="addNode()">Add Node</button>
//     <button onclick="createLinkMode()">Link Tool</button>
//   </div>
// </div>
```

## Event Reference

### Standard Events
| Event | Description | Key Properties |
|-------|-------------|----------------|
| `click` | Mouse click or tap | `nodeId`, `linkId`, `worldX`, `worldY` |
| `dblclick` | Double click/tap | `nodeId`, `linkId`, `worldX`, `worldY` |
| `longpress` | Long press/touch and hold | `nodeId`, `linkId`, `worldX`, `worldY` |
| `contextmenu` | Right click or long press (menu trigger) | `nodeId`, `linkId`, `worldX`, `worldY` |
| `drag` | During drag operation | `nodeId`, `linkId`, `worldX`, `worldY`, `vx`, `vy` |
| `dragend` | End of drag operation | `nodeId`, `linkId`, `worldX`, `worldY`, `vx`, `vy` |
| `zoom` | Mouse wheel zoom or pinch gesture | `zoomLevel`, `worldX`, `worldY` |
| `pan` | Dragging background to pan view | `dx`, `dy`, `centerX`, `centerY` |
| `pinch` | Touch pinch gesture | `scale`, `focalPointX`, `focalPointY` |
| `hover` | Mouse pointer enters node | `nodeId`, `worldX`, `worldY` |
| `sleep` | Physics simulation has stabilized | `sleeping` (true) |
| `wake` | Physics simulation started after sleep | `sleeping` (false) |
| `start` | Physics simulation started manually | - |
| `stop` | Physics simulation stopped manually | - |
| `dataupdated` | Graph data has changed (nodes/links modified) | - |
| `imageload` | Image successfully loaded | `url`, `slot` |
| `imageerror` | Image failed to load | `url`, `slot` |
| `linkclick` | A link was clicked | `linkIndex`, `linkId` |

### Mouse Properties (available on pointer events)
| Property | Description |
|----------|-------------|
| `screenX`, `screenY` | Position relative to viewport (pixels) |
| `worldX`, `worldY` | Position in graph world coordinates |
| `clientX`, `clientY` | Position relative to browser viewport |
| `pageX`, `pageY` | Position relative to document |
| `offsetX`, `offsetY` | Position relative to target element |
| `button` | Mouse button pressed (0=left, 1=middle, 2=right) |
| `buttons` | Bitmask of all pressed buttons |
| `ctrlKey`, `shiftKey`, `altKey`, `metaKey` | Modifier key states |
| `pointerId` | Unique identifier for the pointer |
| `pressure` | Pressure sensitivity (0-1, if supported) |
| `tangentialPressure` | Tangential pressure (if supported) |
| `tiltX`, `tiltY` | Tilt angles (if supported) |
| `twist` | Twist rotation (if supported) |

### Touch-Specific Properties
| Property | Description |
|----------|-------------|
| `touchCount` | Number of active touch points |
| `touches` | Array of touch points (each with x/y/id) |
| `changedTouches` | Touches that changed since last event |
| `rotation` | Rotation angle for multi-touch gestures |
| `scale` | Scale factor for pinch gestures |

## Integration with Application State

### Pattern 1: Graph as Source of Truth
```ts
// Let the graph be the primary state manager
// Application derives UI state from graph state

class AppState {
  constructor(graph) {
    this.graph = graph;
    this.derivedState = {
      selectedNodes: new Set(),
      hoveredNode: null,
      // ... other derived state
    };
    
    this.setupListeners();
  }
  
  setupListeners() {
    // Track selection
    this.graph.on('click', event => {
      if (event.nodeId) {
        // Simple selection model: last clicked wins
        this.derivedState.selectedNodes.clear();
        this.derivedState.selectedNodes.add(event.nodeId);
        this.updateUI();
      }
    });
    
    // Track hover
    this.graph.on('hover', event => {
      this.derivedState.hoveredNode = event.nodeId;
      this.updateUI();
    });
    
    this.graph.on('hover', event => {
      if (event.nodeIndex < 0) {
        this.derivedState.hoveredNode = null;
        this.updateUI();
      }
    });
    
    // Track data changes
    this.graph.on('dataupdated', () => {
      this.refreshDerivedState();
      this.updateUI();
    });
  }
  
  refreshDerivedState() {
    // Recalculate derived state from current graph
    this.derivedState.selectedNodes.clear();
    // ... recalculate other derived state
  }
  
  updateUI() {
    // Update React/Vue/Svelte components or DOM
    // based on this.derivedState
  }
}

// Usage
const appState = new AppState(graph);
```

### Pattern 2: Bidirectional Synchronization
```ts
// Keep application state and graph state in sync
class SyncedGraphManager {
  constructor(initialData) {
    this.state = {
      nodes: initialData.nodes || [],
      links: initialData.links || [],
      selectedNodes: new Set(),
      hoveredNode: null,
      // ... other state
    };
    
    this.graph = null;
    this.setupGraph();
    this.setupSync();
  }
  
  setupGraph() {
    this.graph = Graphium.create({
      // ... graph options
    });
    
    // Initial data load
    this.graph.setData({
      nodes: this.state.nodes,
      links: this.state.links
    });
  }
  
  setupSync() {
    // Graph → State synchronization
    this.graph.on('click', event => {
      if (event.nodeId) {
        // Update selection state
        this.state.selectedNodes.clear();
        this.state.selectedNodes.add(event.nodeId);
        this.updateUI();
      }
    });
    
    this.graph.on('hover', event => {
      this.state.hoveredNode = event.nodeId;
      this.updateUI();
    });
    
    this.graph.on('hover', event => {
      if (event.nodeIndex < 0) {
        this.hoveredNode = null;
        this.updateUI();
      }
    });
    
    this.graph.on('dataupdated', () => {
      // Extract current state from graph
      const graphData = this.graph.toJSON();
      this.state.nodes = graphData.nodes;
      this.state.links = graphData.links;
      this.updateUI();
    });
    
    // State → Graph synchronization
    // Whenever application state changes, update graph
  }
  
  updateState(newState) {
    // Update our state
    this.state = { ...this.state, ...newState };
    
    // Synchronize to graph
    const changedFields = [];
    
    if (newState.nodes !== undefined) {
      this.graph.setData({
        nodes: newState.nodes,
        links: this.state.links // Preserve current links
      });
      changedFields.push('nodes');
    }
    
    if (newState.links !== undefined) {
      this.graph.setData({
        nodes: this.state.nodes,
        links: newState.links
      });
      changedFields.push('links');
    }
    
    if (newState.selectedNodes !== undefined) {
      // Clear previous selection
      this.graph.selectNode(null);
      
      // Apply new selection
      newState.selectedNodes.forEach(nodeId => {
        this.graph.selectNode(nodeId, true, true); // additive=true, preserveExisting=true
      });
      changedFields.push('selectedNodes');
    }
    
    // Notify listeners of changes
    this.notifyListeners(changedFields);
  }
  
  // ... rest of implementation
}
```

## Debugging and Visualization

### Visualizing Event Flow
```ts
// Create an event logger for debugging
class EventLogger {
  constructor(graph, maxEvents = 100) {
    this.graph = graph;
    this.maxEvents = maxEvents;
    this.events = [];
    this.setupLogging();
  }
  
  setupLogging() {
    const eventsToLog = [
      'click', 'dblclick', 'longpress', 'contextmenu',
      'drag', 'dragend', 'pointerdown', 'pointerup',
      'zoom', 'pan', 'pinch',
      'hover',
      'sleep', 'wake', 'start', 'stop',
      'dataupdated', 'imageload', 'imageerror'
    ];
    
    eventsToLog.forEach(eventType => {
      this.graph.on(eventType, (event) => {
        this.logEvent(eventType, event);
      });
    });
  }
  
  logEvent(type, event) {
    const logEntry = {
      timestamp: Date.now(),
      type: type,
      event: this.cloneEvent(event) // Clone to avoid reference issues
    };
    
    this.events.push(logEntry);
    if (this.events.length > this.maxEvents) {
      this.events.shift(); // Remove oldest
    }
    
    // Optionally: display in console or UI
    if (window.__EVENT_LOG_DEBUG) {
      console.log(`[${new Date(logEntry.timestamp).toLocaleTimeString()}] ${type}`, logEntry.event);
    }
  }
  
  cloneEvent(event) {
    // Simple shallow clone - adjust based on event structure
    return { ...event };
  }
  
  getRecentEvents(count = 10) {
    return this.events.slice(-count);
  }
  
  clear() {
    this.events = [];
  }
  
  destroy() {
    // Would need to remove listeners - simplified here
  }
}

// Usage
const eventLogger = new EventLogger(graph);
// ... later
console.log('Recent events:', eventLogger.getRecentEvents(5));
```

### Hit Testing Visualization
```ts
// Show what's under the mouse for debugging
graph.on('pointermove', event => {
  // Clear previous debug visuals
  clearDebugVisuals();
  
  if (event.nodeId !== null) {
    // Highlight node under cursor
    highlightNodeUnderCursor(event.nodeId);
    
    // Show node info
    showNodeTooltip(event.nodeId, event.worldX, event.worldY);
  } else if (event.linkId !== null) {
    // Highlight link under cursor
    highlightLinkUnderCursor(event.linkId);
    
    // Show link info
    showLinkTooltip(event.linkId, event.worldX, event.worldY);
  } else {
    // Show background info
    showBackgroundTooltip(event.worldX, event.worldY);
  }
});

function highlightNodeUnderCursor(nodeId) {
  const node = graph.getNode(nodeId);
  if (node) {
    // Temporarily increase border width
    const originalBorderWidth = node.style().borderWidth;
    node.style({ borderWidth: originalBorderWidth + 2 });
    
    // Store original for restoration
    node._debugOriginalBorderWidth = originalBorderWidth;
  }
}

function clearHighlightNodeUnderCursor(nodeId) {
  const node = getNode(nodeId);
  if (node && node._debugOriginalBorderWidth !== undefined) {
    node.style({ borderWidth: node._debugOriginalBorderWidth });
    delete node._debugOriginalBorderWidth;
  }
}

function clearDebugVisuals() {
  // Clear all debug highlights
  graph.nodes().forEach(node => {
    clearHighlightNodeUnderCursor(node.id);
  });
  
  graph.links().forEach(link => {
    clearHighlightLinkUnderCursor(link.id);
  });
  
  // Remove any tooltip elements
  removeAllTooltips();
}
```

## Event Reference Cheat Sheet

### Most Commonly Used Events
```ts
// User interaction
graph.on('click', handler);           // Primary action
graph.on('dblclick', handler);        // Secondary action/edit
graph.on('hover', handler);           // Show tooltip/preview (nodeIndex -1 on leave)
graph.on('pointerdown', handler);     // Start press/drag feedback
graph.on('drag', handler);            // Update drag preview
graph.on('dragend', handler);         // Finalize drag action

// View control
graph.on('zoom', handler);            // Update zoom UI
graph.on('pan', handler);             // Update pan UI
graph.on('contextmenu', handler);     // Show context menu

// Graph lifecycle
graph.on('sleep', handler);           // Save energy/pause updates
graph.on('wake', handler);            // Resume full functionality
graph.on('start', handler);           // Simulation begun
graph.on('stop', handler);            // Simulation paused
graph.on('dataupdated', handler);     // Data changed - update dependent state

// Resources
graph.on('imageload', handler);       // Image loaded successfully
graph.on('imageerror', handler);      // Image failed - show fallback

```

### Event Properties You'll Use Most Often
| Property | Where Found | Typical Use |
|----------|-------------|-------------|
| `event.nodeId` | Pointer events | Check if click was on node |
| `event.linkId` | Pointer events | Check if click was on link |
| `event.worldX`, `event.worldY` | Pointer events | Get position in graph coordinates |
| `event.screenX`, `event.screenY` | Pointer events | Position DOM elements |
| `event.vx`, `event.vy` | Drag events | Get drag velocity |
| `event.zoomLevel` | Zoom events | Update zoom slider/readout |
| `event.dx`, `event.dy` | Pan events | Calculate new position |
| `event.url` | Image events | Identify which image loaded/failed |
| `event.nodeId` | Image events | Know which node's image changed |

### Modifier Keys in Events
```ts
// All mouse/pointer events include these properties:
graph.on('click', event => {
  if (event.ctrlKey || event.metaKey) {
    // Ctrl+Click or Cmd+Click
    toggleNodeSelection(event.nodeId);
  } else if (event.shiftKey) {
    // Shift+Click
    extendSelectionTo(event.nodeId);
  } else {
    // Plain Click
    selectOnly(event.nodeId);
  }
});

graph.on('wheel', event => {
  // Check for modifier keys on wheel events too
  if (event.ctrlKey) {
    // Ctrl+Wheel = zoom
    graph.zoomBy(event.deltaY < 0 ? 1.2 : 0.8);
  } else {
    // Default wheel behavior might be pan or nothing
    // Depending on your interaction settings
  }
});
```

## Related Guides

- [Getting Started](./getting-started.md) - Basic setup and first graph
- [Physics Configuration](./physics-configuration.md) - Control the simulation
- [Theming Guide](./theming-guide.md) - Customize colors and styles
- [Node Images](./node-images.md) - Use images as node backgrounds
- [Performance Tuning](./performance-tuning.md) - Optimize rendering and interaction
- [API Reference](https://github.com/YuriAlvesBordin/Graphium/blob/main/docs/api-reference.md) - Complete method listings