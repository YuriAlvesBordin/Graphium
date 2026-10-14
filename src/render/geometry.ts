/**
 * Hosts the quadratic bezier geometry helpers shared by the renderer and the
 * picking code so curved edges look and hit test exactly the same way.
 */

export interface Point2D {
  x: number;
  y: number;
}

/** Computes the quadratic bezier control point for an edge with curvature. */
export function controlPoint(ax: number, ay: number, bx: number, by: number, curvature: number, out: Point2D): Point2D {
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.hypot(dx, dy);
  if (curvature === 0 || length < 0.0001) {
    out.x = (ax + bx) * 0.5;
    out.y = (ay + by) * 0.5;
    return out;
  }
  const offset = curvature * length * 0.35;
  out.x = (ax + bx) * 0.5 - (dy / length) * offset;
  out.y = (ay + by) * 0.5 + (dx / length) * offset;
  return out;
}

/** Evaluates a point on the quadratic bezier defined by an edge. */
export function bezierPoint(ax: number, ay: number, cx: number, cy: number, bx: number, by: number, t: number, out: Point2D): Point2D {
  const u = 1 - t;
  out.x = u * u * ax + 2 * u * t * cx + t * t * bx;
  out.y = u * u * ay + 2 * u * t * cy + t * t * by;
  return out;
}

/** Estimates the arc length of a curved edge using fixed sampling. */
export function bezierLength(ax: number, ay: number, cx: number, cy: number, bx: number, by: number, samples = 10): number {
  let length = 0;
  let prevX = ax;
  let prevY = ay;
  const point: Point2D = { x: 0, y: 0 };
  for (let index = 1; index <= samples; index++) {
    bezierPoint(ax, ay, cx, cy, bx, by, index / samples, point);
    length += Math.hypot(point.x - prevX, point.y - prevY);
    prevX = point.x;
    prevY = point.y;
  }
  return length;
}

/** Computes the shortest distance from a point to a quadratic bezier edge. */
export function distanceToEdge(px: number, py: number, ax: number, ay: number, bx: number, by: number, curvature: number): number {
  const control: Point2D = { x: 0, y: 0 };
  controlPoint(ax, ay, bx, by, curvature, control);
  if (curvature === 0) {
    return distanceToSegment(px, py, ax, ay, bx, by);
  }
  const point: Point2D = { x: 0, y: 0 };
  let best = Infinity;
  const steps = 12;
  let prevX = ax;
  let prevY = ay;
  for (let index = 1; index <= steps; index++) {
    bezierPoint(ax, ay, control.x, control.y, bx, by, index / steps, point);
    best = Math.min(best, distanceToSegment(px, py, prevX, prevY, point.x, point.y));
    prevX = point.x;
    prevY = point.y;
  }
  return best;
}

/** Computes the shortest distance from a point to a straight segment. */
export function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq)) : 0;
  const cx = ax + dx * t;
  const cy = ay + dy * t;
  return Math.hypot(px - cx, py - cy);
}
