import { ARROW_FRAGMENT, ARROW_VERTEX, EDGE_FRAGMENT, EDGE_VERTEX, NODE_FRAGMENT, NODE_VERTEX } from '../../src/render/shaders';

describe('shaders', () => {
  it('should provide non empty GLSL sources for the three passes', () => {
    for (const source of [NODE_VERTEX, NODE_FRAGMENT, EDGE_VERTEX, EDGE_FRAGMENT, ARROW_VERTEX, ARROW_FRAGMENT]) {
      expect(typeof source).toBe('string');
      expect(source.length).toBeGreaterThan(0);
    }
  });

  it('should declare the shared camera uniform in every vertex stage', () => {
    expect(NODE_VERTEX).toContain('uCamera');
    expect(EDGE_VERTEX).toContain('uCamera');
    expect(ARROW_VERTEX).toContain('uCamera');
  });
});
