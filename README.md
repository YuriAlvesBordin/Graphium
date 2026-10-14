# Graphium

High-performance WebGL2 graph visualization library.

## Installation
```bash
npm install graphium
```

## Quick Start
```ts
import { Graphium } from 'graphium';

const graph = Graphium.create({ container: document.getElementById('stage') });
graph
  .addNode('alice', { label: 'Alice' })
  .addNode('bob', { label: 'Bob' })
  .link('alice', 'bob')
  .fit();
```

## Documentation
See the `docs/` directory.

## License
MIT