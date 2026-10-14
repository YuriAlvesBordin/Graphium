import { GraphModel, LINK_HIDDEN, LINK_SELECTED, NODE_DISABLED, NODE_DRAGGED, NODE_FIXED, NODE_HIDDEN, NODE_SELECTED, STATE_FIXED, STATE_HOVER, STATE_NORMAL, STATE_SELECTED } from '../../src/core/GraphModel';
import { DEFAULT_THEME } from '../../src/core/theme';
import { packRGBA } from '../../src/core/colors';
import type { NodeOptions } from '../../src/core/types';

function makeModel(nodeCapacity = 16, linkCapacity = 16): GraphModel {
  return new GraphModel({ nodeCapacity, linkCapacity, theme: DEFAULT_THEME });
}

describe('GraphModel', () => {
  describe('construction', () => {
    it('should default the capacities to 512 nodes and 1024 links', () => {
      const model = new GraphModel({ theme: DEFAULT_THEME });
      expect(model.x.length).toBe(512);
      expect(model.source.length).toBe(1024);
    });

    it('should clamp capacities to a minimum of 16', () => {
      const model = makeModel(4, 2);
      expect(model.x.length).toBe(16);
      expect(model.source.length).toBe(16);
    });

    it('should seed node and link defaults from the theme', () => {
      const model = makeModel();
      expect(model.nodeDefaults.radius).toBe(DEFAULT_THEME.nodeRadius);
      expect(model.nodeDefaults.color).toBe(DEFAULT_THEME.nodeColor);
      expect(model.linkDefaults.color).toBe(DEFAULT_THEME.edgeColor);
      expect(model.linkDefaults.arrow).toBe(-1);
      expect(model.palette).toBe(DEFAULT_THEME.nodeColorPalette);
    });
  });

  describe('index resolution', () => {
    it('should resolve string ids through the map', () => {
      const model = makeModel();
      model.addNode('a', {});
      expect(model.nodeIndexOf('a')).toBe(0);
      expect(model.nodeIndexOf('missing')).toBe(-1);
      expect(model.linkIndexOf('missing')).toBe(-1);
    });

    it('should pass raw integer indexes through when they do not collide with ids', () => {
      const model = makeModel();
      model.addNode('a', {});
      expect(model.nodeIndexOf(0)).toBe(0);
      expect(model.linkIndexOf(0)).toBe(-1);
    });

    it('should prefer the id map when an integer id was registered', () => {
      const model = makeModel();
      model.addNode(7, { x: 1, y: 1 });
      model.addNode('b', { x: 2, y: 2 });
      // The integer 7 is a registered id, so it resolves through the map.
      expect(model.nodeIndexOf(7)).toBe(0);
      expect(model.nodeIndexOf(1)).toBe(1);
    });
  });

  describe('addNode', () => {
    it('should place explicit positions and increment the topology revision', () => {
      const model = makeModel();
      const before = model.topologyRevision;
      model.addNode('a', { x: 10, y: -4, label: 'A' });
      expect(model.nodeCount).toBe(1);
      expect(model.x[0]).toBe(10);
      expect(model.y[0]).toBe(-4);
      expect(model.topologyRevision).toBe(before + 1);
    });

    it('should scatter nodes without an explicit position around the origin', () => {
      const model = makeModel();
      model.addNode('a', {});
      const distance = Math.hypot(model.x[0], model.y[0]);
      const expected = 60 + Math.sqrt(1) * 24;
      expect(distance).toBeCloseTo(expected, 0);
    });

    it('should update an existing id without growing the node count', () => {
      const model = makeModel();
      model.addNode('a', { label: 'first' });
      const index = model.addNode('a', { label: 'second', radius: 99 });
      expect(index).toBe(0);
      expect(model.nodeCount).toBe(1);
      expect(model.nodeSnapshot(0).label).toBe('second');
      expect(model.radius[0]).toBe(99);
    });

    it('should store the hidden flag at creation', () => {
      const model = makeModel();
      model.addNode('ghost', { hidden: true });
      expect(model.flags[0] & NODE_HIDDEN).toBeTruthy();
    });
  });

  describe('addLink', () => {
    it('should derive the rest length from the endpoint distance', () => {
      const model = makeModel();
      model.addNode('a', { x: 0, y: 0 });
      model.addNode('b', { x: 30, y: 40 });
      model.addLink('e', 'a', 'b', {});
      expect(model.restLength[0]).toBeCloseTo(50);
      expect(model.degree[0]).toBe(1);
      expect(model.degree[1]).toBe(1);
    });

    it('should update an existing link id in place', () => {
      const model = makeModel();
      model.addNode('a', { x: 0, y: 0 });
      model.addNode('b', { x: 10, y: 0 });
      const first = model.addLink('e', 'a', 'b', { curvature: 0.1 });
      const again = model.addLink('e', 'a', 'b', { curvature: 0.5 });
      expect(again).toBe(first);
      expect(model.linkCount).toBe(1);
      expect(model.linkCurvature[0]).toBeCloseTo(0.5);
    });

    it('should reject links to missing nodes', () => {
      const model = makeModel();
      model.addNode('a', {});
      expect(() => model.addLink('e', 'a', 'ghost', {})).toThrow(/missing/);
    });

    it('should apply every link option', () => {
      const model = makeModel();
      model.addNode('a', { x: 0, y: 0 });
      model.addNode('b', { x: 10, y: 0 });
      model.addLink('e', 'a', 'b', {
        restLength: 42,
        strength: 2.5,
        color: '#123456',
        width: 3,
        opacity: 0.25,
        curvature: 2,
        style: 'dashed',
        dashPattern: [2, 4],
        dashOffset: 5,
        dashWorldScale: true,
        arrow: true,
        arrowSize: 20,
        arrowWidth: 4,
        hidden: true,
      });
      const snap = model.linkSnapshot(0);
      expect(snap.restLength).toBe(42);
      expect(snap.strength).toBe(2.5);
      expect(snap.color).toBe(packRGBA('#123456'));
      expect(snap.width).toBe(3);
      expect(snap.opacity).toBe(0.25);
      expect(snap.curvature).toBeCloseTo(1.5); // clamped to +/-1.5
      expect(snap.style).toBe('dashed');
      expect(snap.dashPattern).toEqual([2, 4]);
      expect(snap.dashOffset).toBe(5);
      expect(snap.arrow).toBe(true);
      expect(snap.arrowSize).toBe(20);
      expect(snap.arrowWidth).toBe(4);
      expect(snap.hidden).toBe(true);
      expect(model.dashWorldScale[0]).toBe(1);
    });

    it('should fall back to the default dash pattern for dashed links', () => {
      const model = makeModel();
      model.addNode('a', { x: 0, y: 0 });
      model.addNode('b', { x: 5, y: 0 });
      model.addLink('e', 'a', 'b', { style: 'dashed' });
      expect(model.dashLength[0]).toBe(6);
      expect(model.dashGap[0]).toBe(8);
      // Arrow mode starts neutral; the theme decision happens at render time.
      expect(model.arrowMode[0]).toBe(0);
    });

    it('should clear the hidden flag through link updates', () => {
      const model = makeModel();
      model.addNode('a', { x: 0, y: 0 });
      model.addNode('b', { x: 5, y: 0 });
      model.addLink('e', 'a', 'b', { hidden: true });
      model.updateLink(0, { hidden: false });
      expect((model.linkFlags[0] & LINK_HIDDEN) === 0).toBe(true);
    });
  });

  describe('node updates', () => {
    it('should ignore updates for out of range indexes', () => {
      const model = makeModel();
      expect(() => model.updateNode(3, { label: 'x' })).not.toThrow();
      expect(() => model.updateNode(-1, { label: 'x' })).not.toThrow();
      expect(() => model.updateLink(0, { width: 9 })).not.toThrow();
      expect(() => model.setNodeState(9, 'hover')).not.toThrow();
      expect(() => model.setNodePosition(9, 1, 1)).not.toThrow();
      expect(() => model.setNodeFixed(9, true)).not.toThrow();
      expect(() => model.setNodeSelected(9, true)).not.toThrow();
      expect(() => model.setLinkSelected(9, true)).not.toThrow();
    });

    it('should replace labels, images and custom colors', () => {
      const model = makeModel();
      model.addNode('a', { label: 'old', image: 'a.png', color: '#ff0000' });
      model.updateNode(0, { label: null, image: null, color: '#00ff00', imageMode: 'contain' });
      const snap = model.nodeSnapshot(0);
      expect(snap.label).toBeNull();
      expect(snap.image).toBeNull();
      expect(snap.color).toBe(packRGBA('#00ff00'));
      expect(model.nodeImageMode[0]).toBe(1);
    });

    it('should fall back to theme defaults for non finite numbers', () => {
      const model = makeModel();
      model.addNode('a', { radius: 8, mass: 3 });
      model.updateNode(0, { radius: Number.NaN, mass: Number.NaN });
      expect(model.radius[0]).toBe(DEFAULT_THEME.nodeRadius);
      expect(model.mass[0]).toBe(1);
    });

    it('should toggle fixed through options and restore the state on unlock', () => {
      const model = makeModel();
      model.addNode('a', {});
      model.updateNode(0, { fixed: true });
      expect(model.flags[0] & NODE_FIXED).toBeTruthy();
      expect(model.state[0]).toBe(STATE_FIXED);
      model.updateNode(0, { fixed: false });
      expect((model.flags[0] & NODE_FIXED) === 0).toBe(true);
      expect(model.state[0]).toBe(STATE_NORMAL);
    });

    it('should toggle disabled through options', () => {
      const model = makeModel();
      model.addNode('a', {});
      model.updateNode(0, { disabled: true });
      expect(model.flags[0] & NODE_DISABLED).toBeTruthy();
      expect(model.nodeSnapshot(0).state).toBe('disabled');
      model.updateNode(0, { disabled: false });
      expect(model.nodeSnapshot(0).state).toBe('normal');
    });

    it('should toggle hidden through updates', () => {
      const model = makeModel();
      model.addNode('a', {});
      model.updateNode(0, { hidden: true });
      expect(model.flags[0] & NODE_HIDDEN).toBeTruthy();
      model.updateNode(0, { hidden: false });
      expect((model.flags[0] & NODE_HIDDEN) === 0).toBe(true);
    });

    it('should apply the state option through setNodeState', () => {
      const model = makeModel();
      model.addNode('a', {});
      model.updateNode(0, { state: 'hover' });
      expect(model.state[0]).toBe(STATE_HOVER);
      expect(model.nodeSnapshot(0).state).toBe('hover');
    });
  });

  describe('setNodeState', () => {
    it('should map every state name and sync the flag mask', () => {
      const model = makeModel();
      model.addNode('a', {});
      model.setNodeState(0, 'selected');
      expect(model.flags[0] & NODE_SELECTED).toBeTruthy();
      model.setNodeState(0, 'dragging');
      expect(model.flags[0] & NODE_DRAGGED).toBeTruthy();
      model.setNodeState(0, 'disabled');
      expect(model.flags[0] & NODE_DISABLED).toBeTruthy();
      model.setNodeState(0, 'normal');
      expect(model.flags[0] & (NODE_SELECTED | NODE_DRAGGED | NODE_DISABLED)).toBe(0);
    });

    it('should clamp numeric state codes into the valid range', () => {
      const model = makeModel();
      model.addNode('a', {});
      model.setNodeState(0, 99);
      expect(model.state[0]).toBe(5);
      model.setNodeState(0, -7);
      expect(model.state[0]).toBe(STATE_NORMAL);
    });
  });

  describe('setNodePosition', () => {
    it('should reset the Verlet history and velocity when requested', () => {
      const model = makeModel();
      model.addNode('a', { x: 0, y: 0 });
      model.vx[0] = 5;
      model.px[0] = 99;
      model.setNodePosition(0, 10, 20, true);
      expect(model.x[0]).toBe(10);
      expect(model.px[0]).toBe(10);
      expect(model.vx[0]).toBe(0);
    });

    it('should keep the history when reset is not requested', () => {
      const model = makeModel();
      model.addNode('a', { x: 0, y: 0 });
      model.px[0] = 99;
      model.setNodePosition(0, 10, 20);
      expect(model.x[0]).toBe(10);
      expect(model.px[0]).toBe(99);
    });
  });

  describe('setNodeFixed and setNodeSelected', () => {
    it('should keep a non fixed state when unlocking', () => {
      const model = makeModel();
      model.addNode('a', {});
      model.setNodeSelected(0, true);
      model.setNodeFixed(0, true);
      model.setNodeFixed(0, false);
      // The selected state survives the unlock because it is not STATE_FIXED.
      expect(model.nodeSnapshot(0).state).toBe('selected');
    });

    it('should restore normal state when a fixed node unlocks', () => {
      const model = makeModel();
      model.addNode('a', {});
      model.setNodeFixed(0, true);
      model.setNodeFixed(0, false);
      expect(model.state[0]).toBe(STATE_NORMAL);
    });

    it('should keep the state untouched when deselecting a non selected node', () => {
      const model = makeModel();
      model.addNode('a', {});
      model.setNodeState(0, 'hover');
      model.setNodeSelected(0, false);
      expect(model.state[0]).toBe(STATE_HOVER);
    });
  });

  describe('removal', () => {
    it('should report false when removing something that does not exist', () => {
      const model = makeModel();
      expect(model.removeNode('ghost')).toBe(false);
      expect(model.removeLink('ghost')).toBe(false);
    });

    it('should remove the last link without any swap work', () => {
      const model = makeModel();
      model.addNode('a', { x: 0, y: 0 });
      model.addNode('b', { x: 5, y: 0 });
      model.addLink('only', 'a', 'b', { width: 4 });
      expect(model.removeLink('only')).toBe(true);
      expect(model.linkCount).toBe(0);
      expect(model.degree[0]).toBe(0);
      expect(model.degree[1]).toBe(0);
    });

    it('should swap remove a middle link preserving the surviving link data', () => {
      const model = makeModel();
      for (const id of ['a', 'b', 'c', 'd']) {
        model.addNode(id, { x: 0, y: 0 });
      }
      model.addLink('e0', 'a', 'b', { width: 1 });
      model.addLink('e1', 'b', 'c', { width: 2, curvature: 0.5 });
      model.addLink('e2', 'c', 'd', { width: 3 });
      expect(model.removeLink('e0')).toBe(true);
      expect(model.linkCount).toBe(2);
      // e2 was moved into slot 0.
      expect(model.linkIdAt(0)).toBe('e2');
      expect(model.linkWidth[0]).toBe(3);
      expect(model.linkIndexById.get('e2')).toBe(0);
      // e1 stayed in slot 1 with its own properties.
      expect(model.linkIdAt(1)).toBe('e1');
      expect(model.linkWidth[1]).toBe(2);
      expect(model.linkIndexById.get('e1')).toBe(1);
    });

    it('should remove a last node and keep ids dense', () => {
      const model = makeModel();
      model.addNode('a', {});
      model.addNode('b', {});
      expect(model.removeNode('b')).toBe(true);
      expect(model.nodeCount).toBe(1);
      expect(model.nodeIdAt(0)).toBe('a');
    });

    it('should swap remove a middle node, drop its links and reindex references', () => {
      const model = makeModel();
      for (const id of ['a', 'b', 'c']) {
        model.addNode(id, { x: 0, y: 0 });
      }
      model.addLink('ab', 'a', 'b', {});
      model.addLink('bc', 'b', 'c', {});
      model.addLink('ac', 'a', 'c', { width: 7 });
      expect(model.removeNode('b')).toBe(true);
      expect(model.nodeCount).toBe(2);
      // Node c swapped into slot 1.
      expect(model.nodeIdAt(1)).toBe('c');
      expect(model.nodeIndexById.get('c')).toBe(1);
      // Every remaining link: ab and bc touched b and are gone; ac survives
      // with its target reindexed from 2 (c) to 1.
      expect(model.linkCount).toBe(1);
      expect(model.linkIdAt(0)).toBe('ac');
      expect(model.source[0]).toBe(0);
      expect(model.target[0]).toBe(1);
      expect(model.linkWidth[0]).toBe(7);
    });

    it('should carry data and label with the swapped node', () => {
      const model = makeModel();
      model.addNode('a', { label: 'A' });
      model.addNode('b', { label: 'B', data: { tag: 'b' } });
      model.removeNode('a');
      expect(model.nodeLabel[0]).toBe('B');
      expect(model.nodeSnapshot(0).data).toEqual({ tag: 'b' });
    });

    it('should reindex links whose source referenced the swapped node', () => {
      const model = makeModel();
      for (const id of ['a', 'b', 'c', 'd']) {
        model.addNode(id, { x: 0, y: 0 });
      }
      // d (index 3) is the last node; both links reference it.
      model.addLink('dc', 'd', 'c', {});
      model.addLink('bd', 'b', 'd', {});
      model.removeNode('a');
      // d swapped into index 0; both links must now point at index 0.
      expect(model.nodeIdAt(0)).toBe('d');
      expect(model.source[model.linkIndexOf('dc')]).toBe(0);
      expect(model.target[model.linkIndexOf('bd')]).toBe(0);
    });
  });

  describe('setData and clear', () => {
    it('should build ids for unnamed links and accept payloads without links', () => {
      const model = makeModel();
      model.setData({ nodes: [{ id: 'x' }, { id: 'y' }] });
      expect(model.nodeCount).toBe(2);
      expect(model.linkCount).toBe(0);
      model.setData({
        nodes: [{ id: 'x' }, { id: 'y' }],
        links: [{ source: 'x', target: 'y' }],
      });
      expect(model.linkCount).toBe(1);
      expect(model.linkIdAt(0)).toBe('x->y:0');
    });

    it('should default missing node ids to their index', () => {
      const model = makeModel();
      model.setData({ nodes: [{ label: 'anon' }] });
      expect(model.nodeIdAt(0)).toBe(0);
    });

    it('should bump every revision when clearing', () => {
      const model = makeModel();
      model.addNode('a', {});
      const topology = model.topologyRevision;
      const appearance = model.appearanceRevision;
      const position = model.positionRevision;
      model.clear();
      expect(model.nodeCount).toBe(0);
      expect(model.topologyRevision).toBe(topology + 1);
      expect(model.appearanceRevision).toBe(appearance + 1);
      expect(model.positionRevision).toBe(position + 1);
    });
  });

  describe('snapshots', () => {
    it('should expose every node field including flags and data', () => {
      const model = makeModel();
      model.addNode('a', { x: 3, y: 4, label: 'A', fixed: true, data: { k: 1 } });
      const snap = model.nodeSnapshot(0);
      expect(snap.id).toBe('a');
      expect(snap.index).toBe(0);
      expect(snap.x).toBeCloseTo(3);
      expect(snap.y).toBeCloseTo(4);
      expect(snap.fixed).toBe(true);
      expect(snap.hidden).toBe(false);
      expect(snap.disabled).toBe(false);
      expect(snap.state).toBe('fixed');
      expect(snap.data).toEqual({ k: 1 });
      expect(snap.degree).toBe(0);
      expect(snap.mass).toBeGreaterThan(0);
    });

    it('should expose every link field including the hidden flag', () => {
      const model = makeModel();
      model.addNode('a', { x: 0, y: 0 });
      model.addNode('b', { x: 10, y: 0 });
      model.addLink('e', 'a', 'b', { hidden: true });
      const snap = model.linkSnapshot(0);
      expect(snap.hidden).toBe(true);
      expect(model.linkFlags[0] & LINK_HIDDEN).toBeTruthy();
      expect(model.linkFlags[0] & LINK_SELECTED).toBe(0);
    });

    it('should report arrow as undefined for neutral mode links', () => {
      const model = makeModel();
      model.addNode('a', { x: 0, y: 0 });
      model.addNode('b', { x: 5, y: 0 });
      model.addLink('e', 'a', 'b', {});
      expect(model.linkSnapshot(0).arrow).toBeUndefined();
      model.updateLink(0, { arrow: true });
      expect(model.linkSnapshot(0).arrow).toBe(true);
      model.updateLink(0, { arrow: false });
      expect(model.linkSnapshot(0).arrow).toBe(false);
    });

    it('should expose every state name through snapshots', () => {
      const model = makeModel();
      model.addNode('a', {});
      for (const expected of ['hover', 'selected', 'dragging', 'fixed', 'disabled', 'normal'] as const) {
        model.setNodeState(0, expected);
        expect(model.nodeSnapshot(0).state).toBe(expected);
      }
    });
  });

  describe('user data', () => {
    it('should lazily create the data objects', () => {
      const model = makeModel();
      model.addNode('a', {});
      model.addNode('b', {});
      model.addLink('e', 'a', 'b', {});
      expect(model.nodeUserData(0)).toEqual({});
      expect(model.linkUserData(0)).toEqual({});
      model.nodeUserData(0).marker = true;
      expect(model.nodeSnapshot(0).data).toEqual({ marker: true });
    });
  });

  describe('capacity growth', () => {
    it('should grow every node array past the initial capacity', () => {
      const model = makeModel(16, 16);
      for (let i = 0; i < 20; i++) {
        model.addNode(`n${i}`, { x: i, y: -i, label: `N${i}`, data: { i } });
      }
      expect(model.nodeCount).toBe(20);
      expect(model.x.length).toBeGreaterThanOrEqual(20);
      for (let i = 0; i < 20; i++) {
        const snap = model.nodeSnapshot(i);
        expect(snap.id).toBe(`n${i}`);
        expect(snap.x).toBeCloseTo(i);
        expect(snap.label).toBe(`N${i}`);
        expect(snap.data).toEqual({ i });
      }
    });

    it('should grow every link array past the initial capacity', () => {
      const model = makeModel(16, 16);
      model.addNode('hub', { x: 0, y: 0 });
      for (let i = 0; i < 20; i++) {
        model.addNode(`n${i}`, { x: i, y: 0 });
        model.addLink(`e${i}`, 'hub', `n${i}`, { curvature: 0.1 * (i % 3) });
      }
      expect(model.linkCount).toBe(20);
      expect(model.source.length).toBeGreaterThanOrEqual(20);
      expect(model.linkIndexOf('e19')).toBe(19);
      expect(model.linkCurvature[19]).toBeCloseTo(0.1);
      expect(model.linkSnapshot(19).id).toBe('e19');
      model.removeLink('e0');
      // e19 moved into the freed slot 0.
      expect(model.linkCount).toBe(19);
      expect(model.linkIndexOf('e19')).toBe(0);
    });
  });

  it('should place options driven nodes even when they use only defaults', () => {
    const model = makeModel();
    const options: NodeOptions = {};
    model.addNode('a', options);
    expect(model.nodeCount).toBe(1);
    expect(Number.isFinite(model.x[0])).toBe(true);
  });
});
