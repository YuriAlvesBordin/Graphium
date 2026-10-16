# Graphium

[![npm version](https://img.shields.io/npm/v/@yurialvesbordin/graphium.svg)](https://www.npmjs.com/package/@yurialvesbordin/graphium)
[![npm downloads](https://img.shields.io/npm/dm/@yurialvesbordin/graphium.svg)](https://www.npmjs.com/package/@yurialvesbordin/graphium)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/built%20with-TypeScript-0074c1.svg)](http://www.typescriptlang.org/)
[![WebGL2](https://img.shields.io/badge/WebGL2-enabled-ff69b4.svg)](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)

High-performance **WebGL2** graph visualization with silk-smooth force physics, curved edges, node images and a fluent API. Built for dashboards, network diagrams, knowledge graphs and any interactive node-link visualization.

## 📦 Installation

```bash
# npm
npm install @yurialvesbordin/graphium

# Yarn
yarn add @yurialvesbordin/graphium

# pnpm
pnpm add @yurialvesbordin/graphium
```

> **Nota sobre o nome**: o pacote é publicado com o escopo `@yurialvesbordin`.  
> O nome `graphium` (sem escopo) já é ocupado por um pacote diferente (charts para Angular), então use sempre o nome completo `@yurialvesbordin/graphium`.

## 🚀 Quick Start

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

## ✨ Features

- **WebGL2 GPU rendering** — 60 fps para milhares de nós e arestas
- **Física force-directed** suave e estável (presets: silk, bouncy, crystal, liquid)
- **Arestas curvas, imagens de nós, rótulos, setas e traços tracejados**
- **API fluente com handles** — encadeie operações em nós e arestas individuais
- **Temas integrados** (midnight, light, slate, sunset) e temas customizados
- **Sistema de eventos** completo (click, drag, zoom, pan, hover, sleep/wake, etc.)
- **TypeScript nativo** — tipagem completa incluída, zero dependências de runtime

## 📖 Documentação

Guias completos em [`docs/`](docs):

| Guia | O que cobre |
|------|-------------|
| [Getting Started](docs/getting-started.md) | Instalação, primeiro grafo, handles, limpeza |
| [Physics Configuration](docs/physics-configuration.md) | Presets e ajuste fino da física |
| [Theming Guide](docs/theming-guide.md) | Temas integrados e customizados |
| [Events & Interaction](docs/events-interaction.md) | Eventos, interação, acessibilidade |
| [Node Images](docs/node-images.md) | Imagens customizadas como fundo de nós |
| [Performance Tuning](docs/performance-tuning.md) | Otimização de renderização e física |

## 🛠️ API Reference

A lista completa de métodos e tipos está no [API Reference](docs/api-reference.md) e no código-fonte em `src/`.

## 🤝 Contribuindo

Pull requests são bem-vindos! Para mudanças maiores, abra uma issue primeiro para discutir o que você gostaria de mudar.

## 📄 License

MIT © Yuri Alves Bordin
