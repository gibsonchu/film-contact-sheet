import type { Annotation, Point } from "./types";

/**
 * Geometric hit testing for annotations.
 *
 * The eraser tests against the *ink* — the polyline of a stroke, the outline of
 * a shape — rather than a bounding box. A bounding box is both too forgiving
 * (clicking the empty middle of a circled frame would erase the circle) and far
 * too strict for a thin stroke, whose box is only a few units tall.
 *
 * `radius` is in sheet units and should be derived from a screen-pixel reach
 * divided by the current zoom, so the eraser feels the same at any zoom.
 */
export function annotationHitTest(a: Annotation, p: Point, radius: number): boolean {
  const reach = radius + a.strokeWidth / 2;
  const g = a.geometry;

  // Tape, stickers and text are solid objects: anywhere inside counts.
  if (a.type === "tape" || a.type === "sticker" || a.type === "text") {
    return withinBox(p, boxOf(a), radius);
  }

  if (g.kind === "points") {
    for (let i = 1; i < g.points.length; i += 1) {
      if (distanceToSegment(p, g.points[i - 1], g.points[i]) <= reach) return true;
    }
    // A stroke can be a single dab.
    return g.points.length === 1 && distance(p, g.points[0]) <= reach;
  }

  if (g.kind === "segment") {
    return (
      distanceToSegment(p, { x: g.x1, y: g.y1 }, { x: g.x2, y: g.y2 }) <= reach
    );
  }

  const box = boxOf(a);
  switch (a.tool) {
    case "ellipse":
      return nearEllipse(p, box, reach);
    case "rect":
      return nearRectOutline(p, box, reach);
    case "x": {
      const a1 = { x: box.x, y: box.y };
      const a2 = { x: box.x + box.width, y: box.y + box.height };
      const b1 = { x: box.x + box.width, y: box.y };
      const b2 = { x: box.x, y: box.y + box.height };
      return (
        distanceToSegment(p, a1, a2) <= reach || distanceToSegment(p, b1, b2) <= reach
      );
    }
    case "crop":
      return nearCropCorners(p, box, reach);
    default:
      // Check marks and anything unrecognised: small enough that the box is fine.
      return withinBox(p, box, radius);
  }
}

/** Topmost unlocked annotation under the point, or null. */
export function annotationAt(
  annotations: Annotation[],
  p: Point,
  radius: number,
): Annotation | null {
  let best: Annotation | null = null;
  for (const a of annotations) {
    if (a.locked) continue;
    if (!annotationHitTest(a, p, radius)) continue;
    if (!best || a.zIndex > best.zIndex) best = a;
  }
  return best;
}

/* ------------------------------------------------------------------ maths */

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return distance(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function boxOf(a: Annotation): Box {
  const g = a.geometry;
  if (g.kind === "box") {
    return {
      x: Math.min(g.x, g.x + g.width),
      y: Math.min(g.y, g.y + g.height),
      width: Math.abs(g.width),
      height: Math.abs(g.height),
    };
  }
  if (g.kind === "segment") {
    return {
      x: Math.min(g.x1, g.x2),
      y: Math.min(g.y1, g.y2),
      width: Math.abs(g.x2 - g.x1),
      height: Math.abs(g.y2 - g.y1),
    };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const pt of g.points) {
    minX = Math.min(minX, pt.x);
    minY = Math.min(minY, pt.y);
    maxX = Math.max(maxX, pt.x);
    maxY = Math.max(maxY, pt.y);
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function withinBox(p: Point, b: Box, pad: number): boolean {
  return (
    p.x >= b.x - pad && p.x <= b.x + b.width + pad && p.y >= b.y - pad && p.y <= b.y + b.height + pad
  );
}

function nearRectOutline(p: Point, b: Box, reach: number): boolean {
  const tl = { x: b.x, y: b.y };
  const tr = { x: b.x + b.width, y: b.y };
  const br = { x: b.x + b.width, y: b.y + b.height };
  const bl = { x: b.x, y: b.y + b.height };
  return (
    distanceToSegment(p, tl, tr) <= reach ||
    distanceToSegment(p, tr, br) <= reach ||
    distanceToSegment(p, br, bl) <= reach ||
    distanceToSegment(p, bl, tl) <= reach
  );
}

function nearEllipse(p: Point, b: Box, reach: number): boolean {
  const rx = b.width / 2;
  const ry = b.height / 2;
  if (rx <= 0 || ry <= 0) return false;
  const cx = b.x + rx;
  const cy = b.y + ry;
  const nx = (p.x - cx) / rx;
  const ny = (p.y - cy) / ry;
  const t = Math.hypot(nx, ny);
  // Rough distance from the ellipse's edge: how far off the unit circle the
  // point falls, scaled back into sheet units by the smaller radius.
  return Math.abs(t - 1) * Math.min(rx, ry) <= reach;
}

function nearCropCorners(p: Point, b: Box, reach: number): boolean {
  const arm = Math.min(b.width, b.height) * 0.22;
  const corners: [Point, Point, Point][] = [
    [{ x: b.x, y: b.y }, { x: b.x + arm, y: b.y }, { x: b.x, y: b.y + arm }],
    [
      { x: b.x + b.width, y: b.y },
      { x: b.x + b.width - arm, y: b.y },
      { x: b.x + b.width, y: b.y + arm },
    ],
    [
      { x: b.x + b.width, y: b.y + b.height },
      { x: b.x + b.width - arm, y: b.y + b.height },
      { x: b.x + b.width, y: b.y + b.height - arm },
    ],
    [
      { x: b.x, y: b.y + b.height },
      { x: b.x + arm, y: b.y + b.height },
      { x: b.x, y: b.y + b.height - arm },
    ],
  ];
  return corners.some(
    ([corner, armA, armB]) =>
      distanceToSegment(p, corner, armA) <= reach || distanceToSegment(p, corner, armB) <= reach,
  );
}
