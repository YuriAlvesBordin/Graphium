import { FocusController } from '../../src/core/FocusController';
import { GraphModel, NODE_DIM, LINK_DIM } from '../../src/core/GraphModel';
import { DEFAULT_THEME } from '../../src/core/theme';

describe('FocusController', () => {
  let model: GraphModel;
  let controller: FocusController;

  beforeEach(() => {
    model = new GraphModel({ nodeCapacity: 20, linkCapacity: 20, theme: DEFAULT_THEME });
    controller = new FocusController(model, () => {});
  });

  it('should dim every element outside the focused neighborhood', () => {
    // Two separate edges: 0-1 and 2-3. Focusing 1 keeps {0,1} bright.
    model.addNode('n0', {});
    model.addNode('n1', {});
    model.addNode('n2', {});
    model.addNode('n3', {});
    model.addLink('e0', 'n0', 'n1', {});
    model.addLink('e1', 'n2', 'n3', {});
    controller.focus('n1');
    expect((model.flags[0] & NODE_DIM) === 0).toBe(true);
    expect((model.flags[1] & NODE_DIM) === 0).toBe(true);
    expect((model.flags[2] & NODE_DIM) !== 0).toBe(true);
    expect((model.flags[3] & NODE_DIM) !== 0).toBe(true);
    expect((model.linkFlags[0] & LINK_DIM) === 0).toBe(true);
    expect((model.linkFlags[1] & LINK_DIM) !== 0).toBe(true);
  });

  it('should bump the appearance revision when focusing', () => {
    model.addNode('a', {});
    model.addNode('b', {});
    model.addNode('c', {});
    model.addLink('e0', 'a', 'b', {});
    const before = model.appearanceRevision;
    controller.focus('a');
    expect(model.appearanceRevision).toBeGreaterThan(before);
  });

  it('should clear every dim flag on unfocus', () => {
    model.addNode('n0', {});
    model.addNode('n1', {});
    model.addNode('n2', {});
    model.addNode('n3', {});
    model.addLink('e0', 'n0', 'n1', {});
    model.addLink('e1', 'n2', 'n3', {});
    controller.focus('n0');
    controller.unfocus();
    for (let i = 0; i < model.nodeCount; i++) {
      expect((model.flags[i] & NODE_DIM) === 0).toBe(true);
    }
    for (let i = 0; i < model.linkCount; i++) {
      expect((model.linkFlags[i] & LINK_DIM) === 0).toBe(true);
    }
  });

  it('should ignore unknown focus ids', () => {
    model.addNode('a', {});
    const before = model.appearanceRevision;
    controller.focus('missing');
    expect(model.appearanceRevision).toBe(before);
  });
});
