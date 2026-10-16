# Graphium

[![npm version](https://img.shields.io/npm/v/@yurialvesbordin/graphium.svg)](https://www.npmjs.com/package/@yurialvesbordin/graphium)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/built%20with-TypeScript-0074c1.svg)](http://www.typescriptlang.org/)
[![WebGL2](https://img.shields.io/badge/WebGL2-enabled-ff69b4.svg)](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)

High-performance WebGL2 graph visualization with silk-smooth force physics, curved edges, node images, and a fluent API.

## Installation

```bash
npm install @yurialvesbordin/graphium
```

## Usage

```ts
import { Graphium } from '@yurialvesbordin/graphium';

const graph = Graphium.create({
  container: document.getElementById('graph-container'),
  autoStart: true,
  autoFit: true,
  physics: { preset: 'silk' },
  theme: { name: 'midnight' },
});

graph
  .addNode('alice', { label: 'Alice' })
  .addNode('bob',   { label: 'Bob'   })
  .addNode('carol', { label: 'Carol' });

graph.link('alice', 'bob').link('bob', 'carol').link('carol', 'alice');

graph.fit(80);
```

## Showcase

![Graphium hero](docs/assets/hero.png)

![Curved edges](docs/assets/curved-edges.png)

![Light theme](docs/assets/light-theme.png)

![Tree layout](docs/assets/tree.png)

![Showcase](github-connections/assets/Showcase.gif)

## Documentation

Complete guides live in the docs directory:

- Getting Started - installation, first graph, handles, cleanup
- Physics Configuration - presets and fine-tuning the simulation
- Theming Guide - built-in and custom themes
- Events & Interaction - events, interaction, accessibility
- Node Images - custom images as node backgrounds
- Performance Tuning - optimization of rendering and physics

## License

MIT
