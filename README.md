# Graphium

<p align="center">
  <strong>The remastered graph visualization library.</strong><br>
  Silk-smooth physics · WebGL2 rendering · Curved edges · Node images · Fluent TypeScript API
</p>

Graphium is a complete rework of the original Graphium engine. Every module was rebuilt around three goals: make the simplest use case a single line of code, make the physics feel buttery and alive, and expose deep customization without ever getting in the way.

```ts
import { Graphium } from 'graphium';

const graph = Graphium.create({ theme: { name: 'midnight' } });

graph
  .addNode('alice', { label: 'Alice' })
  .addNode('bob', { label: 'Bob' })
  .addNode('carol', { label: 'Carol' })
  .link('alice', 'bob')
  .link('bob', 'carol')
  .link('carol', 'alice')
  .fit();
```

That is the entire setup. The canvas is created for you, the simulation starts on its own, the view fits your graph, and when the layout settles the engine puts itself to sleep to save battery.

---

## Why the remaster feels different

| Area | What changed |
|------|--------------|
| **Physics feel** | Velocity based integration with tuned damping, so nodes glide instead of twitch. Dragging now uses a soft follower: the node chases your pointer with a slight elastic lag, and when you release, it keeps the pointer momentum and flies. |
| **Silence** | The render loop stops completely when the simulation sleeps. Nothing animates, nothing draws, zero CPU. Any interaction or data change wakes everything up instantly. |
| **Curved edges** | Every link accepts a `curvature` value rendered as a true quadratic bezier ribbon, tessellated on the GPU with exact tangent normals, dash arc lengths and arrow tangents. |
| **Node images** | Pass an URL or data URL to any node. Images are downloaded asynchronously, packed into a 1024 px texture atlas with cover or contain framing and mixed over the node fill, all on the GPU. |
| **Focus mode** | One call dims every node and link that is not adjacent to your target, with labels hidden for dimmed nodes. |
| **Render on demand** | Frames are only produced when revisions change: topology, appearance, positions, camera or atlas. |
| **Pooled labels** | Labels live in a recycled DOM pool capped at 400 visible elements, updated with `translate3d` and culled to the viewport. |

---

## Installation

### npm

```bash
npm install graphium
```

### From source

```bash
git clone <your-repo> graphium
cd graphium
npm install
npm run build
```

The build emits plain ES modules into `dist/` with full `.d.ts` declarations. No bundler is required to consume the library.

### Browser direct

```html
<script type="module">
  import { Graphium } from './dist/index.js';
</script>
```

---

## The fluent API

Every mutation returns the graph instance, so calls chain naturally. Handles give individual nodes and links their own chains.

```ts
const graph = Graphium.create({
  canvas: document.querySelector('#stage'),   // or container, or nothing for auto canvas
  autoStart: true,                            // run the simulation immediately
  autoFit: true,                              // frame the graph when data appears
  physics: { preset: 'silk' },
  theme: { name: 'midnight' },
});

graph
  .addNodes([
    { id: 'a', label: 'Alpha' },
    { id: 'b', label: 'Beta' },
    { id: 'c', label: 'Gamma' },
  ])
  .addLinks([
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c', curvature: 0.4 },
  ]);

graph.node('a').style({ radius: 18, color: '#ff6b6b' }).fix();
graph.link('a~b~0').curve(0.6).dashed([4, 6]);
```

### Handles

```ts
graph.node('a')
  .move(100, 50)          // set position
  .fix()                  // lock in the solver
  .image('./face.png')    // set a node image
  .label('Alpha!')        // change the label
  .color('#4ecdc4')       // shortcut for style color
  .select();              // mark selected

graph.linkById('e1')
  .curve(-0.5)            // bow the other way
  .width(2.5)
  .select();

graph.node('a').remove(); // handles also remove
```

### Data at once

```ts
graph.setData({
  nodes: [
    { id: 'x', label: 'X' },
    { id: 'y', label: 'Y' },
  ],
  links: [{ source: 'x', target: 'y' }],
});
```

---

## Physics

The engine combines four ingredients: center gravity, hash accelerated pairwise repulsion, spring forces along links and iterative constraint passes for spring length and collision separation. A soft edge crossing resolver gently untangles overlapping edges over time.

### Presets

| Preset | Character |
|--------|-----------|
| `silk` | The default. Smooth accelerations, high damping, graceful settles. |
| `bouncy` | Lower damping and stronger springs for overshoot and playful wobble. |
| `crystal` | Stiff springs, extra constraint iterations, snap into rigid arrangements. |
| `liquid` | Heavy damping, soft springs, floating drift, slow motion. |

```ts
graph.usePreset('bouncy');
graph.usePreset('silk', { repulsion: 1500 });   // preset plus overrides
graph.setPhysics({ damping: 0.95 });            // live tweak, wakes the engine
```

### Full physics options

| Option | Default | Description |
|--------|---------|-------------|
| `repulsion` | 1100 | Strength of pairwise node repulsion. |
| `repulsionRadius` | 200 | Distance window for repulsion and the hash cell size. |
| `springStrength` | 0.055 | Global multiplier on link spring forces. |
| `gravity` | 0.0022 | Pull toward the world origin. |
| `damping` | 0.92 | Velocity retention per 60 fps frame. Higher glides longer. |
| `maxSpeed` | 900 | Velocity clamp that keeps motion elegant. |
| `collisionStrength` | 0.85 | How hard overlapping nodes push apart. |
| `positionIterations` | 2 | Constraint solver passes per frame. |
| `temperature` | 0.7 | Initial simulation heat, scaled into forces. |
| `cooling` | 0.99 | Heat decay per frame. |
| `minTemperature` | 0.05 | Floor for the heat so graphs keep breathing slightly. |
| `sleepEnergy` | 0.0004 | Mean squared velocity below which the graph may sleep. |
| `sleepFrames` | 48 | Consecutive calm frames required before sleeping. |
| `maxNeighbors` | 128 | Repulsion neighbor cap per node per frame. |
| `edgeSeparation` | 0.45 | Strength of the crossing untangler, 0 disables it. |
| `dragSmooth` | 0.42 | Drag follower elasticity per frame. |
| `throwFactor` | 1 | Momentum multiplier applied on release. |

---

## Theming

Four built in themes ship with the library: `midnight`, `light`, `slate` and `sunset`. Apply one by name or compose your own from any subset of values.

```ts
graph.setTheme({ name: 'sunset' });

graph.setTheme({
  background: '#101418',
  node: { radius: 12, borderWidth: 3, colorPalette: ['#e060a0', '#60b0ff'] },
  edge: { color: '#51586b', curvature: 0.25, arrowEnabled: true },
  hoverRing: { color: '#ffffff', width: 3 },
  selectedRing: { color: '#ffd166', width: 4 },
  label: { size: 13, color: '#e8ecf5', background: 'rgba(0,0,0,0.4)' },
});
```

Theme values merge over the current theme, so partial updates never reset the rest. New nodes pick colors deterministically from `colorPalette`, giving every id a stable color without configuration.

---

## Node images

```ts
graph.addNode('alice', { image: 'https://example.com/alice.png' });
graph.setNodeImage('bob', localDataUrl, 'contain');
await graph.loadImages();   // resolves when every pending image settles
```

Images render through a texture atlas. Requests are deduplicated by URL, loaded with CORS friendly settings, drawn into a cell with cover or contain framing and uploaded in one texture update. Failed loads fall back to the node fill color and emit an `imageerror` event.

---

## Interaction and events

Drag nodes with momentum, pan by dragging the background, zoom with the wheel, pinch on touch, hover for a highlight ring, click to select and focus, long press and double click are all built in.

```ts
graph.on('click', event => {
  console.log('clicked', event.nodeId, event.worldX, event.worldY);
});

graph.on('dragend', event => {
  console.log('released with momentum', event.nodeId);
});

graph.on('sleep', () => console.log('layout settled'));
graph.on('imageload', event => console.log('image ready', event.url));

const stop = graph.on('zoom', () => {});
stop();   // unsubscribe
```

Events: `click`, `dblclick`, `longpress`, `contextmenu`, `hover`, `drag`, `dragend`, `pan`, `zoom`, `pinch`, `pointerdown`, `pointerup`, `sleep`, `wake`, `start`, `stop`, `imageload`, `imageerror`, `dataupdated`.

Interaction can be tuned or disabled per gesture:

```ts
graph.setInteraction({ zoomEnabled: false, wheelZoomSpeed: 1.2 });
```

---

## Camera, focus and utilities

```ts
graph.fit(80);                  // frame everything with padding
graph.centerOn(0, 0);           // move the view center
graph.zoomTo(2);                // absolute zoom
graph.zoomBy(1.25);             // relative zoom

graph.focus('alice');           // dim everything not adjacent to alice
graph.unfocus();                // restore

graph.selectNode('alice');      // exclusive selection
graph.selectNode('bob', true, true);   // additive selection
graph.selectedNodes();          // ['alice']

graph.reboot();                 // restart the layout from current heat
graph.stats();                  // fps, timings, sleeping state
graph.screenshot();             // PNG data URL of the current frame
graph.toJSON();                 // plain object export
graph.loadImages();             // promise for pending image loads
graph.destroy();                // release everything
```

---

## Performance notes

- Storage is fully data oriented: positions, velocities, colors and flags live in TypedArrays and the hot loops allocate nothing.
- The spatial hash uses open addressing with intrusive chains, rebuilt in place each step.
- Rendering uses three instanced draws per frame: straight edge quads, tessellated curved ribbons and node discs with atlas images.
- The loop sleeps completely at rest and renders only when revisions change, which keeps idle cost at zero.
- Labels are pooled, viewport culled and capped, so large graphs never thrash the DOM.
- On typical desktop hardware the target of 10 to 20 thousand nodes holds 60 fps with the default configuration; tune `repulsionRadius` and `maxNeighbors` for your graph shape.

---

## Migration from previous versions

| Previous version | Current version (Graphium) |
|------------------|----------------------------|
| `new Graphium({ canvas })` | `Graphium.create({ canvas })` or the same constructor |
| `addLink(id, source, target, opts)` returns a snapshot | returns the graph; use `getLink(id)` for the snapshot |
| `setNodeAppearance(id, opts)` | still available, plus `node(id).style(opts)` |
| `edgeStar` mode | replaced by per link `curvature` |
| `edgeconflict` events | replaced by the automatic `edgeSeparation` resolver |
| labels as separate DOM divs per node | pooled label layer with theme options |
| manual resize handling | automatic through `autoResize` |

The legacy method names `addLink`, `setNodeAppearance`, `setLinkAppearance`, `setNodePosition`, `setNodeFixed`, `setNodeState`, `selectNode`, `selectLink`, `getNode`, `getLink`, `setData`, `removeNode`, `removeLink`, `on`, `off`, `emit`, `start`, `stop`, `fit`, `step`, `render` and `destroy` all still exist with chainable returns.

---

## Demo

Open `demo/index.html` through any static server:

```bash
npx serve .
```

The playground includes live physics sliders, the four presets, four themes, three generated datasets, node count control, curvature control, image toggles and a click inspector.

---

## Browser support

WebGL2 is required. Chrome 56+, Firefox 51+, Safari 15+, Edge 79+.

---

## License

MIT.