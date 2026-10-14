import { SelectionController } from '../../src/core/SelectionController';
import { GraphModel } from '../../src/core/GraphModel';
import { DEFAULT_THEME } from '../../src/core/theme';
import type { NodeId, LinkId } from '../../src/core/types';

describe('SelectionController', () => {
  let model: GraphModel;
  let controller: SelectionController;

  beforeEach(() => {
    model = new GraphModel({ nodeCapacity: 20, linkCapacity: 20, theme: DEFAULT_THEME });
    controller = new SelectionController(model, () => {});
  });

  it('should select a node and list it as selected', () => {
    model.addNode('test', {});
    controller.selectNode('test', true, false);
    expect(controller.selectedNodes()).toEqual(['test']);
  });

  it('should replace the selection when selecting exclusively', () => {
    model.addNode('a', {});
    model.addNode('b', {});
    controller.selectNode('a', true, false);
    expect(controller.selectedNodes()).toEqual(['a']);
    controller.selectNode('b', true, false);
    expect(controller.selectedNodes()).toEqual(['b']);
    expect(controller.selectedNodes().length).toBe(1);
  });

  it('should keep the previous selection when additive is true', () => {
    model.addNode('a', {});
    model.addNode('b', {});
    controller.selectNode('a', true, false);
    controller.selectNode('b', true, true);
    expect(controller.selectedNodes()).toEqual(['a', 'b']);
  });

  it('should deselect a node with selected false', () => {
    model.addNode('a', {});
    model.addNode('b', {});
    controller.selectNode('a', true, true);
    controller.selectNode('b', true, true);
    controller.selectNode('a', false, true);
    expect(controller.selectedNodes()).toEqual(['b']);
  });

  it('should ignore unknown node ids', () => {
    model.addNode('a', {});
    controller.selectNode('missing', true, false);
    expect(controller.selectedNodes()).toEqual([]);
  });

  it('should clear the whole selection', () => {
    model.addNode('a', {});
    model.addNode('b', {});
    controller.selectNode('a', true, true);
    controller.selectNode('b', true, true);
    expect(controller.selectedNodes().length).toBe(2);
    controller.clear();
    expect(controller.selectedNodes().length).toBe(0);
  });

  it('should select and list links', () => {
    model.addNode('la', {});
    model.addNode('lb', {});
    model.addLink('l0', 'la', 'lb', {});
    const lid: LinkId = model.linkIdAt(0) as LinkId;
    controller.selectLink(lid, true, false);
    expect(controller.selectedLinks()).toEqual([lid]);
    controller.clear();
    expect(controller.selectedLinks().length).toBe(0);
  });

  it('should select links by dense index', () => {
    model.addNode('la', {});
    model.addNode('lb', {});
    model.addLink('l0', 'la', 'lb', {});
    controller.selectLink(0, true, false);
    expect(controller.selectedLinks().length).toBe(1);
  });
});

describe('SelectionController link guards', () => {
  it('should ignore unknown link ids and out of range indexes', () => {
    const model = new GraphModel({ nodeCapacity: 8, linkCapacity: 8, theme: DEFAULT_THEME });
    const controller = new SelectionController(model, () => {});
    model.addNode('a', {});
    controller.selectLink('missing', true);
    controller.selectLink(0, true);
    expect(controller.selectedLinks()).toEqual([]);
  });
});
