import { GraphEditor } from '../../src/core/GraphEditor';
import { Emitter } from '../../src/core/events';
import { GraphModel } from '../../src/core/GraphModel';
import { DEFAULT_THEME } from '../../src/core/theme';
import { PhysicsEngine } from '../../src/physics/PhysicsEngine';
import type { GraphData, NodeId, LinkOptions, NodeOptions } from '../../src/core/types';

describe('GraphEditor', () => {
  let model: GraphModel;
  let physics: PhysicsEngine;
  let events: Emitter;
  let editor: GraphEditor;

  beforeEach(() => {
    model = new GraphModel({ nodeCapacity: 100, linkCapacity: 100, theme: DEFAULT_THEME });
    physics = new PhysicsEngine(model, {});
    events = new Emitter();
    editor = new GraphEditor({
      model,
      physics,
      events,
      resetAutoFit: () => {},
      invalidate: () => {}
    });
  });

  it('should add a single node', () => {
    const nodeId: NodeId = 'node1';
    editor.addNode(nodeId, { label: 'Test Node' });
    expect(model.nodeCount).toBe(1);
    const snapshot = model.nodeSnapshot(0);
    expect(snapshot.id).toBe(nodeId);
    expect(snapshot.label).toBe('Test Node');
  });

  it('should throw when adding a node without id', () => {
    expect(() => editor.addNode(undefined as unknown as NodeId, {})).toThrow();
  });

  it('should add multiple nodes', () => {
    const nodes: Array<NodeOptions & { id: NodeId }> = [
      { id: 'n1', label: 'Node 1' },
      { id: 'n2', label: 'Node 2' },
      { id: 'n3', label: 'Node 3' }
    ];
    editor.addNodes(nodes);
    expect(model.nodeCount).toBe(3);
    expect(model.nodeIdAt(0)).toBe('n1');
    expect(model.nodeIdAt(1)).toBe('n2');
    expect(model.nodeIdAt(2)).toBe('n3');
  });

  it('should add a single link with an auto id', () => {
    editor.addNode('a', {});
    editor.addNode('b', {});
    editor.link('a', 'b', { color: 0xff0000ff });
    expect(model.linkCount).toBe(1);
    const snapshot = model.linkSnapshot(0);
    expect(snapshot.source).toBe('a');
    expect(snapshot.target).toBe('b');
    expect(snapshot.color).toBe(0xff0000ff);
    expect(snapshot.id).toBe('a~b~0');
  });

  it('should add a link with an explicit id through options', () => {
    editor.addNode('x', {});
    editor.addNode('y', {});
    editor.link('x', 'y', { id: 'link1' });
    expect(model.linkCount).toBe(1);
    expect(model.linkIdAt(0)).toBe('link1');
  });

  it('should auto increment the link counter across calls', () => {
    editor.addNode('p1', {});
    editor.addNode('p2', {});
    editor.addNode('p3', {});
    const links: Array<LinkOptions & { source: NodeId; target: NodeId }> = [
      { source: 'p1', target: 'p2' },
      { source: 'p2', target: 'p3' }
    ];
    editor.addLinks(links);
    expect(model.linkCount).toBe(2);
    expect(model.linkIdAt(0)).toBe('p1~p2~0');
    expect(model.linkIdAt(1)).toBe('p2~p3~1');
  });

  it('should update node appearance', () => {
    editor.addNode('test', {});
    editor.setNodeAppearance('test', { radius: 15, color: 0xff00ff00 });
    const snapshot = model.nodeSnapshot(0);
    expect(snapshot.radius).toBe(15);
    expect(snapshot.color).toBe(0xff00ff00);
  });

  it('should update link appearance', () => {
    editor.addNode('a', {});
    editor.addNode('b', {});
    editor.link('a', 'b', {});
    editor.setLinkAppearance('a~b~0', { width: 3.0, curvature: 0.2 });
    const snapshot = model.linkSnapshot(0);
    expect(snapshot.width).toBe(3.0);
    expect(snapshot.curvature).toBeCloseTo(0.2);
  });

  it('should set a node image', () => {
    editor.addNode('img', {});
    editor.setNodeImage('img', 'http://example.com/img.png', 'contain');
    const snapshot = model.nodeSnapshot(0);
    expect(snapshot.image).toBe('http://example.com/img.png');
  });

  it('should replace node data without keeping old keys', () => {
    editor.addNode('data', {});
    editor.setNodeData('data', { first: 1 });
    editor.setNodeData('data', { second: 2 });
    const snapshot = model.nodeSnapshot(0);
    expect(snapshot.data).toEqual({ second: 2 });
  });

  it('should replace link data', () => {
    editor.addNode('d1', {});
    editor.addNode('d2', {});
    editor.link('d1', 'd2', {});
    editor.setLinkData('d1~d2~0', { info: 'test' });
    const snapshot = model.linkSnapshot(0);
    expect(snapshot.data).toEqual({ info: 'test' });
  });

  it('should move a node to a world position', () => {
    editor.addNode('pos', {});
    editor.setNodePosition('pos', 100, 200);
    const snapshot = model.nodeSnapshot(0);
    expect(snapshot.x).toBeCloseTo(100);
    expect(snapshot.y).toBeCloseTo(200);
  });

  it('should fix a node in the solver', () => {
    editor.addNode('fix', {});
    editor.setNodeFixed('fix', true);
    const snapshot = model.nodeSnapshot(0);
    expect(snapshot.fixed).toBe(true);
  });

  it('should assign a visual state to a node', () => {
    editor.addNode('state', {});
    editor.setNodeState('state', 'selected');
    const snapshot = model.nodeSnapshot(0);
    expect(snapshot.state).toBe('selected');
  });

  it('should remove a node together with its links', () => {
    editor.addNode('rm', {});
    editor.addNode('keep', {});
    editor.link('rm', 'keep', {});
    expect(model.nodeCount).toBe(2);
    expect(model.linkCount).toBe(1);
    const removed = editor.removeNode('rm');
    expect(removed).toBe(true);
    expect(model.nodeCount).toBe(1);
    expect(model.linkCount).toBe(0);
    expect(model.nodeIdAt(0)).toBe('keep');
    expect(editor.removeNode('rm')).toBe(false);
  });

  it('should remove one link by id', () => {
    editor.addNode('l1', {});
    editor.addNode('l2', {});
    editor.link('l1', 'l2', {});
    expect(model.linkCount).toBe(1);
    expect(editor.removeLink('l1~l2~0')).toBe(true);
    expect(model.linkCount).toBe(0);
  });

  it('should clear every node and link', () => {
    editor.addNode('c1', {});
    editor.addNode('c2', {});
    editor.link('c1', 'c2', {});
    editor.clear();
    expect(model.nodeCount).toBe(0);
    expect(model.linkCount).toBe(0);
  });

  it('should emit dataupdated from setData and roundtrip through toJSON', () => {
    const emitted: number[] = [];
    events.on('dataupdated', payload => {
      emitted.push((payload as { nodeCount: number }).nodeCount);
    });
    const data: GraphData = {
      nodes: [
        { id: 'a', label: 'A', x: 0, y: 0 },
        { id: 'b', label: 'B', x: 10, y: 10 }
      ],
      links: [
        { source: 'a', target: 'b', color: 0xff0000ff }
      ]
    };
    editor.setData(data);
    expect(emitted).toEqual([2]);
    const exported = editor.toJSON();
    expect(exported.nodes.length).toBe(2);
    expect(exported.links.length).toBe(1);
    expect(exported.nodes[0].id).toBe('a');
    expect(exported.nodes[0].label).toBe('A');
    expect(exported.nodes[0].x).toBeCloseTo(0);
    expect(exported.nodes[0].y).toBeCloseTo(0);
    expect(exported.links[0].source).toBe('a');
    expect(exported.links[0].target).toBe('b');
    expect(exported.links[0].color).toBe(0xff0000ff);
  });
});

describe('GraphEditor remaining branches', () => {
  it('should clear previous keys when replacing link data', () => {
    const model = new GraphModel({ nodeCapacity: 8, linkCapacity: 8, theme: DEFAULT_THEME });
    const physics = new PhysicsEngine(model, {});
    const editor = new GraphEditor({ model, physics, events: new Emitter(), resetAutoFit: () => {}, invalidate: () => {} });
    model.addNode('a', { x: 0, y: 0 });
    model.addNode('b', { x: 5, y: 0 });
    editor.link('a', 'b', {});
    editor.setLinkData('a~b~0', { first: 1 });
    editor.setLinkData('a~b~0', { second: 2 });
    expect(model.linkSnapshot(0).data).toEqual({ second: 2 });
  });

  it('should ignore element updates for missing ids', () => {
    const model = new GraphModel({ nodeCapacity: 8, linkCapacity: 8, theme: DEFAULT_THEME });
    const physics = new PhysicsEngine(model, {});
    const editor = new GraphEditor({ model, physics, events: new Emitter(), resetAutoFit: () => {}, invalidate: () => {} });
    expect(() => editor.setNodeAppearance('missing', { label: 'x' })).not.toThrow();
    expect(() => editor.setNodeImage('missing', 'x.png')).not.toThrow();
  });
});
