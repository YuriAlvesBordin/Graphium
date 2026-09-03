<p align="center">
  <img src="https://raw.githubusercontent.com/yourusername/Graphium/main/assets/logo.svg" alt="Graphium" width="200">
</p>

<h1 align="center">Graphium</h1>

<p align="center">
  <strong>High-performance, interactive 2D graph visualization for the web.</strong><br>
  Built on WebGL2 · Zero dependencies · No build step required
</p>

<p align="center">
  <a href="https://github.com/yourusername/Graphium/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
  <a href="https://www.npmjs.com/package/graphium"><img src="https://img.shields.io/npm/v/graphium.svg" alt="npm version"></a>
  <a href="https://github.com/yourusername/Graphium/actions"><img src="https://img.shields.io/github/actions/workflow/status/yourusername/Graphium/ci.yml" alt="Build Status"></a>
  <a href="https://github.com/yourusername/Graphium"><img src="https://img.shields.io/github/stars/yourusername/Graphium.svg?style=social" alt="GitHub Stars"></a>
</p>

---

## Why Graphium?

| Feature | Description |
|---------|-------------|
| **Fast** | Instanced WebGL2 rendering handles 10,000+ nodes at 60fps |
| **Physics-based** | Force-directed layout with Verlet integration, collision, and automatic sleep/wake |
| **Smart Conflict Resolution** | Detects and corrects edge crossings, proximity overlaps, and alignment issues |
| **Rich Interaction** | Drag, pan, zoom, pinch, hover, click, long-press, link selection |
| **Zero Dependencies** | Single ES module, runs directly in browser -- no build, no npm install required |
| **TypeScript Ready** | Full `.d.ts` declarations included |

---

## Features in Action

### Force-Directed Layout
Nodes repel, links act as springs, system settles into equilibrium automatically.

### Edge Conflict Resolution
Crossings, overlaps, and tight angles detected and corrected in real-time.

### Multi-Level Coarsening
Large graphs initialize faster via Heavy-Edge Matching hierarchy.

### GPU-Accelerated Rendering
Instanced draws, avatar atlas, dashed edges, per-node state styling -- all on GPU.

---

## Documentation

| Topic | Description |
|-------|-------------|
| [Architecture](docs/architecture.md) | System overview, data flow, module dependencies |
| [Physics Engine](docs/physics.md) | Forces, integration, sleep/wake, parameters |
| [Rendering](docs/rendering.md) | WebGL2 pipeline, shaders, instancing, atlas |
| [Interaction](docs/interaction.md) | Pointer controller, gestures, picking, events |
| [Data Model](docs/data-model.md) | GraphModel, TypedArray storage, revisions |
| [API Reference](docs/api-reference.md) | Complete class/method/option reference |

---

## Browser Support

| Browser | Version |
|---------|---------|
| Chrome | 56+ |
| Firefox | 51+ |
| Safari | 15+ |
| Edge | 79+ |

Requires **WebGL2**. No polyfills.

---

## Installation

### Direct
```html
<script type="module">
import { Graphium } from 'https://cdn.jsdelivr.net/gh/yourusername/Graphium/src/Graphium.js';
</script>
```

### npm
```bash
npm install graphium
```
```javascript
import { Graphium } from 'graphium';
```

### Local
```bash
git clone https://github.com/yourusername/Graphium.git
cp -r Graphium/src your-project/
```

---

## License

MIT -- free for personal and commercial use.