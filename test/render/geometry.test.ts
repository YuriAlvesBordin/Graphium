import { bezierLength, bezierPoint, controlPoint, distanceToEdge, distanceToSegment } from '../../src/render/geometry';

describe('geometry', () => {
  describe('controlPoint', () => {
    it('should return the midpoint for straight edges', () => {
      const out = { x: 0, y: 0 };
      controlPoint(0, 0, 10, 0, 0, out);
      expect(out).toEqual({ x: 5, y: 0 });
    });

    it('should return the midpoint for degenerate zero length edges', () => {
      const out = { x: 0, y: 0 };
      controlPoint(5, 5, 5, 5, 0.5, out);
      expect(out).toEqual({ x: 5, y: 5 });
    });

    it('should offset the control point perpendicular to the chord', () => {
      const out = { x: 0, y: 0 };
      controlPoint(0, 0, 10, 0, 1, out);
      // Chord along +x with curvature 1: offset = 0.35 * length on +y.
      expect(out.x).toBeCloseTo(5);
      expect(out.y).toBeCloseTo(3.5);
    });
  });

  describe('bezierPoint', () => {
    it('should return the endpoints at t = 0 and t = 1', () => {
      const out = { x: 0, y: 0 };
      bezierPoint(0, 0, 5, -4, 10, 0, 0, out);
      expect(out).toEqual({ x: 0, y: 0 });
      bezierPoint(0, 0, 5, -4, 10, 0, 1, out);
      expect(out).toEqual({ x: 10, y: 0 });
    });

    it('should return the curve midpoint pulled toward the control point', () => {
      const out = { x: 0, y: 0 };
      bezierPoint(0, 0, 5, -4, 10, 0, 0.5, out);
      expect(out.x).toBeCloseTo(5);
      expect(out.y).toBeCloseTo(-2);
    });
  });

  describe('bezierLength', () => {
    it('should approximate the chord length for a straight curve', () => {
      expect(bezierLength(0, 0, 5, 0, 10, 0)).toBeCloseTo(10, 5);
    });

    it('should be longer than the chord for curved edges', () => {
      const length = bezierLength(0, 0, 5, -8, 10, 0);
      expect(length).toBeGreaterThan(10);
      expect(length).toBeLessThan(20);
    });
  });

  describe('distanceToEdge', () => {
    it('should delegate straight edges to the segment distance', () => {
      expect(distanceToEdge(5, 3, 0, 0, 10, 0, 0)).toBeCloseTo(3);
      expect(distanceToEdge(-5, 0, 0, 0, 10, 0, 0)).toBeCloseTo(5);
    });

    it('should measure against the curved path', () => {
      // The curve midpoint of this edge sits at (5, 1.75).
      expect(distanceToEdge(5, 1.75, 0, 0, 10, 0, 1)).toBeLessThan(0.05);
      const far = distanceToEdge(5, 50, 0, 0, 10, 0, 1);
      expect(far).toBeGreaterThan(40);
    });
  });

  describe('distanceToSegment', () => {
    it('should project inside the segment when the foot lies between ends', () => {
      expect(distanceToSegment(5, 4, 0, 0, 10, 0)).toBeCloseTo(4);
    });

    it('should clamp to the endpoints when the foot falls outside', () => {
      expect(distanceToSegment(-3, 0, 0, 0, 10, 0)).toBeCloseTo(3);
      expect(distanceToSegment(14, 0, 0, 0, 10, 0)).toBeCloseTo(4);
    });

    it('should handle zero length segments', () => {
      expect(distanceToSegment(3, 4, 7, 7, 7, 7)).toBeCloseTo(5);
    });
  });
});
