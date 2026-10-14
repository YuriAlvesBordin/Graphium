/**
 * Guards the public API surface of the package. Run after a build:
 *
 *   node scripts/check-api.mjs
 *
 * Fails with a non zero exit code when an expected export or class member
 * goes missing, or when a removed legacy member reappears.
 */

import * as graphium from '../dist/index.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const graphiumDts = readFileSync(join(here, '../dist/Graphium.d.ts'), 'utf8');

let failures = 0;

function checkExport(name) {
  if (!(name in graphium)) {
    console.error(`missing export: ${name}`);
    failures++;
  }
}

function checkMethod(className, instance, name) {
  if (typeof instance[name] !== 'function') {
    console.error(`missing ${className}.${name}`);
    failures++;
  }
}

// Package exports.
const valueExports = [
  'Graphium',
  'GraphModel',
  'NodeHandle',
  'LinkHandle',
  'Emitter',
  'packRGBA',
  'unpackRGBA',
  'deterministicColor',
  'BUILT_IN_THEMES',
  'themeNames',
  'PhysicsEngine',
  'PRESETS',
  'presetNames',
  'SpatialHash',
  'Camera',
  'Renderer',
  'TextureAtlas',
  'LabelLayer',
  'PointerController',
  'controlPoint',
  'bezierPoint',
  'bezierLength',
  'distanceToEdge',
  'distanceToSegment',
];
for (const name of valueExports) {
  checkExport(name);
}

// Graphium static and prototype surface.
const Graphium = graphium.Graphium;
if (typeof Graphium?.create !== 'function') {
  console.error('missing Graphium.create');
  failures++;
}
const graphMethods = [
  'on',
  'once',
  'off',
  'emit',
  'addNode',
  'addNodes',
  'link',
  'addLinks',
  'node',
  'linkById',
  'setData',
  'removeNode',
  'removeLink',
  'clear',
  'getNode',
  'getLink',
  'nodeIds',
  'linkIds',
  'setNodeImage',
  'selectNode',
  'selectLink',
  'clearSelection',
  'selectedNodes',
  'selectedLinks',
  'focus',
  'unfocus',
  'setTheme',
  'setPhysics',
  'usePreset',
  'setInteraction',
  'reboot',
  'fit',
  'centerOn',
  'zoomBy',
  'zoomTo',
  'resize',
  'step',
  'render',
  'requestRender',
  'start',
  'stop',
  'loadImages',
  'pickLinkAt',
  'screenToWorld',
  'stats',
  'screenshot',
  'toJSON',
  'destroy',
];
for (const name of graphMethods) {
  checkMethod('Graphium', Graphium.prototype, name);
}

// Subsystem accessors used by consumers (the demo relies on these).
// Instance fields live on instances rather than the prototype, so the
// emitted declaration file is the stable contract to inspect.
for (const field of ['model', 'physics', 'camera', 'renderer', 'atlas', 'labels', 'editor', 'events', 'theme', 'running', 'destroyed']) {
  if (!new RegExp(`(?:readonly )?${field}\\s*[?:]`).test(graphiumDts)) {
    console.error(`missing Graphium field: ${field}`);
    failures++;
  }
}

// Handle surface.
for (const name of ['style', 'move', 'fix', 'select', 'state', 'label', 'image', 'color', 'radius', 'data', 'remove']) {
  checkMethod('NodeHandle', graphium.NodeHandle.prototype, name);
}
for (const name of ['style', 'curve', 'dashed', 'color', 'select', 'data', 'remove']) {
  checkMethod('LinkHandle', graphium.LinkHandle.prototype, name);
}

// Legacy members that were intentionally removed must stay gone.
const legacyMembers = [
  'addLink',
  'setNodeAppearance',
  'setLinkAppearance',
  'setNodePosition',
  'setNodeFixed',
  'setNodeState',
  'setNodeData',
  'setLinkData',
];
for (const name of legacyMembers) {
  if (name in Graphium.prototype) {
    console.error(`legacy member resurrected: Graphium.${name}`);
    failures++;
  }
}

if (failures > 0) {
  console.error(`api check failed with ${failures} problem(s)`);
  process.exit(1);
}
console.log(`api check passed: ${valueExports.length} exports, ${graphMethods.length} graph methods, handles intact`);
