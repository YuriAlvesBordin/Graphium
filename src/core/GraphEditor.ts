/**
 * Owns every graph data mutation: node and link CRUD, per element property
 * updates, custom data attachment and JSON export.
 */

import type { Emitter } from './events.js';
import { GraphModel } from './GraphModel.js';
import type { PhysicsEngine } from '../physics/PhysicsEngine.js';
import type { GraphData, LinkId, LinkOptions, NodeId, NodeOptions, NodeStateName } from './types.js';

/** Collaborators and hooks the editor needs from the main facade. */
export interface GraphEditorDeps {
  model: GraphModel;
  physics: PhysicsEngine;
  events: Emitter;
  resetAutoFit(): void;
  invalidate(): void;
}

export class GraphEditor {
  private linkCounter = 0;

  constructor(private readonly deps: GraphEditorDeps) {}

  /** Adds one node. */
  addNode(id: NodeId, options: NodeOptions = {}): void {
    if (id === undefined || id === null) {
      throw new Error('Graphium requires a node id.');
    }
    this.deps.model.addNode(id, options);
    this.deps.physics.wake();
    this.deps.invalidate();
  }

  /** Adds many nodes in one call. */
  addNodes(nodes: Array<NodeOptions & { id: NodeId }>): void {
    for (let index = 0; index < nodes.length; index++) {
      this.deps.model.addNode(nodes[index].id ?? index, nodes[index]);
    }
    this.deps.physics.wake();
    this.deps.invalidate();
  }

  /** Links two nodes, reusing an existing link with the same auto id. */
  link(source: NodeId, target: NodeId, options: LinkOptions = {}): void {
    const autoId = options.id ?? `${String(source)}~${String(target)}~${this.linkCounter++}`;
    this.deps.model.addLink(autoId, source, target, options);
    this.deps.physics.wake();
    this.deps.invalidate();
  }

  /** Adds many links in one call. */
  addLinks(links: Array<LinkOptions & { source: NodeId; target: NodeId }>): void {
    for (let index = 0; index < links.length; index++) {
      const config = links[index];
      const linkId = config.id ?? `${String(config.source)}~${String(config.target)}~${this.linkCounter++}`;
      this.deps.model.addLink(linkId, config.source, config.target, config);
    }
    this.deps.physics.wake();
    this.deps.invalidate();
  }

  /** Replaces the entire graph with the supplied data payload. */
  setData(data: GraphData): void {
    this.deps.model.setData(data);
    this.deps.physics.reset();
    this.deps.resetAutoFit();
    this.deps.events.emit('dataupdated', { nodeCount: this.deps.model.nodeCount, linkCount: this.deps.model.linkCount });
    this.deps.invalidate();
  }

  /** Removes one node together with its links. */
  removeNode(id: NodeId): boolean {
    const removed = this.deps.model.removeNode(id);
    if (removed) {
      this.deps.physics.wake();
      this.deps.invalidate();
    }
    return removed;
  }

  /** Removes one link by id. */
  removeLink(id: LinkId): boolean {
    const removed = this.deps.model.removeLink(id);
    if (removed) {
      this.deps.physics.wake();
      this.deps.invalidate();
    }
    return removed;
  }

  /** Removes every node and link while keeping the current theme. */
  clear(): void {
    this.deps.model.clear();
    this.deps.physics.reset();
    this.deps.resetAutoFit();
    this.deps.invalidate();
  }

  /** Moves a node to a world position. */
  setNodePosition(id: NodeId | number, x: number, y: number): void {
    const index = this.deps.model.nodeIndexOf(id);
    if (index >= 0) {
      this.deps.model.setNodePosition(index, x, y, true);
      this.deps.physics.wake();
      this.deps.invalidate();
    }
  }

  /** Locks or unlocks a node in the solver. */
  setNodeFixed(id: NodeId | number, fixed: boolean): void {
    const index = this.deps.model.nodeIndexOf(id);
    if (index >= 0) {
      this.deps.model.setNodeFixed(index, fixed);
      this.deps.physics.wake();
      this.deps.invalidate();
    }
  }

  /** Assigns a visual state to a node. */
  setNodeState(id: NodeId | number, state: NodeStateName): void {
    const index = this.deps.model.nodeIndexOf(id);
    if (index >= 0) {
      this.deps.model.setNodeState(index, state);
      this.deps.invalidate();
    }
  }

  /** Updates node appearance properties. */
  setNodeAppearance(id: NodeId | number, options: NodeOptions): void {
    const index = this.deps.model.nodeIndexOf(id);
    if (index >= 0) {
      this.deps.model.updateNode(index, options);
      this.deps.invalidate();
    }
  }

  /** Updates link appearance properties. */
  setLinkAppearance(id: LinkId | number, options: LinkOptions): void {
    const index = this.deps.model.linkIndexOf(id);
    if (index >= 0) {
      this.deps.model.updateLink(index, options);
      this.deps.invalidate();
    }
  }

  /** Sets the node image and starts the asynchronous load. */
  setNodeImage(id: NodeId | number, url: string | null, mode: 'cover' | 'contain' = 'cover'): void {
    const index = this.deps.model.nodeIndexOf(id);
    if (index >= 0) {
      this.deps.model.updateNode(index, { image: url, imageMode: mode });
      this.deps.invalidate();
    }
  }

  /** Replaces the custom data object attached to a node. */
  setNodeData(id: NodeId | number, data: Record<string, unknown>): void {
    const index = this.deps.model.nodeIndexOf(id);
    if (index >= 0) {
      const userData = this.deps.model.nodeUserData(index);
      for (const key of Object.keys(userData)) {
        delete userData[key];
      }
      Object.assign(userData, data);
    }
  }

  /** Replaces the custom data object attached to a link. */
  setLinkData(id: LinkId | number, data: Record<string, unknown>): void {
    const index = this.deps.model.linkIndexOf(id);
    if (index >= 0) {
      const userData = this.deps.model.linkUserData(index);
      for (const key of Object.keys(userData)) {
        delete userData[key];
      }
      Object.assign(userData, data);
    }
  }

  /** Exports the current graph as a plain JSON friendly object. */
  toJSON(): GraphData {
    const nodes: Array<NodeOptions & { id: NodeId }> = [];
    const model = this.deps.model;
    for (let index = 0; index < model.nodeCount; index++) {
      const snapshot = model.nodeSnapshot(index);
      nodes.push({ id: snapshot.id, x: snapshot.x, y: snapshot.y, label: snapshot.label, radius: snapshot.radius, color: snapshot.color, fixed: snapshot.fixed });
    }
    const links: Array<LinkOptions & { source: NodeId; target: NodeId }> = [];
    for (let index = 0; index < model.linkCount; index++) {
      const snapshot = model.linkSnapshot(index);
      links.push({ id: snapshot.id, source: snapshot.source, target: snapshot.target, color: snapshot.color, curvature: snapshot.curvature, width: snapshot.width });
    }
    return { nodes, links };
  }
}
