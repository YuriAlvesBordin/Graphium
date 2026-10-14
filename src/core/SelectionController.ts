/**
 * Owns the selection flags of nodes and links, including exclusive versus
 * additive selection and the selected id listings.
 */

import { GraphModel, LINK_SELECTED, NODE_SELECTED } from './GraphModel.js';
import type { LinkId, NodeId } from './types.js';

export class SelectionController {
  constructor(
    private readonly model: GraphModel,
    private readonly invalidate: () => void,
  ) {}

  /** Selects one node, optionally keeping the current selection. */
  selectNode(id: NodeId | number, selected: boolean = true, additive = false): void {
    const index = this.model.nodeIndexOf(id);
    if (index < 0) {
      return;
    }
    if (selected && !additive) {
      this.clearNodeSelection();
    }
    this.model.setNodeSelected(index, selected);
    this.invalidate();
  }

  /** Selects one link, optionally keeping the current selection. */
  selectLink(id: LinkId | number, selected: boolean = true, additive = false): void {
    const index = this.model.linkIndexOf(id);
    if (index < 0) {
      return;
    }
    if (selected && !additive) {
      this.clearLinkSelection();
    }
    this.model.setLinkSelected(index, selected);
    this.invalidate();
  }

  /** Clears the selection of every node and link. */
  clear(): void {
    this.clearNodeSelection();
    this.clearLinkSelection();
    this.invalidate();
  }

  /** Returns the ids of every selected node. */
  selectedNodes(): NodeId[] {
    const ids: NodeId[] = [];
    for (let index = 0; index < this.model.nodeCount; index++) {
      if (this.model.flags[index] & NODE_SELECTED) {
        ids.push(this.model.nodeIdAt(index) as NodeId);
      }
    }
    return ids;
  }

  /** Returns the ids of every selected link. */
  selectedLinks(): LinkId[] {
    const ids: LinkId[] = [];
    for (let index = 0; index < this.model.linkCount; index++) {
      if (this.model.linkFlags[index] & LINK_SELECTED) {
        ids.push(this.model.linkIdAt(index) as LinkId);
      }
    }
    return ids;
  }

  /** Deselects every node. */
  private clearNodeSelection(): void {
    for (let index = 0; index < this.model.nodeCount; index++) {
      if (this.model.flags[index] & NODE_SELECTED) {
        this.model.setNodeSelected(index, false);
      }
    }
  }

  /** Deselects every link. */
  private clearLinkSelection(): void {
    for (let index = 0; index < this.model.linkCount; index++) {
      if (this.model.linkFlags[index] & LINK_SELECTED) {
        this.model.setLinkSelected(index, false);
      }
    }
  }
}
