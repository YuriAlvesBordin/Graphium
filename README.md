# Graphium

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/built%20with-TypeScript-0074c1.svg)](http://www.typescriptlang.org/)
[![WebGL2](https://img.shields.io/badge/WebGL2-enabled-ff69b4.svg)](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)
[![npm version](https://img.shields.io/npm/v/graphium.svg)](https://www.npmjs.com/package/graphium)

A high-performance WebGL2 graph visualization library with silk-smooth physics, curved edges, and a fluent TypeScript API.

## Installation
```bash
npm install graphium
```

## Quick Start
```ts
import { Graphium } from 'graphium';

const graph = Graphium.create({
  container: document.getElementById('stage'),
  autoStart: true,
  autoFit: true,
  physics: { preset: 'silk' },
  theme: { name: 'midnight' }
});

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
  ])
  .fit(80);
```

## Documentation
Comprehensive guides are available in the `docs/` directory:
- [Getting Started](./docs/getting-started.md)
- [Physics Configuration](./docs/physics-configuration.md)
- [Theming Guide](./docs/theming-guide.md)
- [Node Images](./docs/node-images.md)
- [Events & Interaction](./docs/events-interaction.md)
- [Performance Tuning](./docs/performance-tuning.md)

## License
MIT

## Acknowledgements
Inspired by force-directed graph layout algorithms.
Built with love using modern web technologies.