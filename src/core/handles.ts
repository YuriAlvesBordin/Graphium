/**
 * Exposes fluent per node and per link handles returned by the main facade.
 * Handles wrap a dense index resolution so users interact with stable ids
 * while the library keeps operating on flat arrays.
 */

import type { Graphium } from '../Graphium.js';
import type { ColorInput, LinkOptions, LinkSnapshot, NodeId, NodeOptions, NodeSnapshot, NodeStateName } from './types.js';

export class NodeHandle {
  /** Creates a handle bound to one graph and one node id. */
  constructor(
    private graph: Graphium,
    readonly id: NodeId,
  ) {}

  /** Updates node appearance properties and returns the handle. */
  style(options: NodeOptions): this {
    this.graph.editor.setNodeAppearance(this.id, options);
    return this;
  }

  /** Moves the node to a world position and returns the handle. */
  move(x: number, y: number): this {
    this.graph.editor.setNodePosition(this.id, x, y);
    return this;
  }

  /** Locks or unlocks the node in the physics solver. */
  fix(fixed = true): this {
    this.graph.editor.setNodeFixed(this.id, fixed);
    return this;
  }

  /** Selects or deselects the node. */
  select(selected = true): this {
    this.graph.selectNode(this.id, selected);
    return this;
  }

  /** Assigns a visual state such as hover or disabled. */
  state(name: NodeStateName): this {
    this.graph.editor.setNodeState(this.id, name);
    return this;
  }

  /** Sets the label text, or removes it with null. */
  label(text: string | null): this {
    this.graph.editor.setNodeAppearance(this.id, { label: text });
    return this;
  }

  /** Sets the node image from a URL or data URL. */
  image(url: string | null, mode: 'cover' | 'contain' = 'cover'): this {
    this.graph.setNodeImage(this.id, url, mode);
    return this;
  }

  /** Tints the node with a color shortcut. */
  color(color: ColorInput): this {
    this.graph.editor.setNodeAppearance(this.id, { color });
    return this;
  }

  /** Resizes the node with a radius shortcut. */
  radius(value: number): this {
    this.graph.editor.setNodeAppearance(this.id, { radius: value });
    return this;
  }

  /** Attaches or replaces custom user data. */
  data(data: Record<string, unknown>): this {
    this.graph.editor.setNodeData(this.id, data);
    return this;
  }

  /** Removes the node from the graph. */
  remove(): void {
    this.graph.removeNode(this.id);
  }

  /** Returns a point in time snapshot of the node. */
  get snapshot(): NodeSnapshot | null {
    return this.graph.getNode(this.id);
  }
}

export class LinkHandle {
  /** Creates a handle bound to one graph and one link id. */
  constructor(
    private graph: Graphium,
    readonly id: string | number,
  ) {}

  /** Updates link appearance properties and returns the handle. */
  style(options: LinkOptions): this {
    this.graph.editor.setLinkAppearance(this.id, options);
    return this;
  }

  /** Sets the curvature of the edge in one call. */
  curve(value: number): this {
    this.graph.editor.setLinkAppearance(this.id, { curvature: value });
    return this;
  }

  /** Switches the edge to a dashed style with an optional pattern. */
  dashed(pattern?: [number, number]): this {
    this.graph.editor.setLinkAppearance(this.id, { style: 'dashed', dashPattern: pattern });
    return this;
  }

  /** Sets the link color shortcut. */
  color(color: ColorInput): this {
    this.graph.editor.setLinkAppearance(this.id, { color });
    return this;
  }

  /** Selects or deselects the link. */
  select(selected = true): this {
    this.graph.selectLink(this.id, selected);
    return this;
  }

  /** Attaches or replaces custom user data. */
  data(data: Record<string, unknown>): this {
    this.graph.editor.setLinkData(this.id, data);
    return this;
  }

  /** Removes the link from the graph. */
  remove(): void {
    this.graph.removeLink(this.id);
  }

  /** Returns a point in time snapshot of the link. */
  get snapshot(): LinkSnapshot | null {
    return this.graph.getLink(this.id);
  }
}
