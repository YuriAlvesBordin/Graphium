/**
 * Owns the focus mode: dims every node and link that is not adjacent to
 * the focused node and restores the graph on unfocus.
 */

import { GraphModel, LINK_DIM, NODE_DIM } from './GraphModel.js';
import type { NodeId } from './types.js';

export class FocusController {
  constructor(
    private readonly model: GraphModel,
    private readonly invalidate: () => void,
  ) {}

  /** Dims every node and link that is not adjacent to the focus node. */
  focus(id: NodeId | number): void {
    const index = this.model.nodeIndexOf(id);
    if (index < 0) {
      return;
    }
    const model = this.model;
    const neighbors = new Set<number>([index]);
    for (let link = 0; link < model.linkCount; link++) {
      const touches = model.source[link] === index || model.target[link] === index;
      if (touches) {
        neighbors.add(model.source[link]);
        neighbors.add(model.target[link]);
      } else {
        model.linkFlags[link] |= LINK_DIM;
      }
    }
    for (let node = 0; node < model.nodeCount; node++) {
      if (!neighbors.has(node)) {
        model.flags[node] |= NODE_DIM;
      } else {
        model.flags[node] &= ~NODE_DIM;
      }
    }
    model.appearanceRevision++;
    this.invalidate();
  }

  /** Removes all dimming applied by focus. */
  unfocus(): void {
    const model = this.model;
    for (let node = 0; node < model.nodeCount; node++) {
      model.flags[node] &= ~NODE_DIM;
    }
    for (let link = 0; link < model.linkCount; link++) {
      model.linkFlags[link] &= ~LINK_DIM;
    }
    model.appearanceRevision++;
    this.invalidate();
  }
}
