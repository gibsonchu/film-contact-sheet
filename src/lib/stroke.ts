import { getStroke } from "perfect-freehand";
import { instrumentFor } from "./palette";
import type { Point } from "./types";

/**
 * Freehand strokes are stored as raw pointer samples (with pressure) and
 * converted to an outline at render time. Keeping the samples means a stroke
 * can be re-rendered at any scale — including a 300dpi export — without ever
 * looking like an upscaled bitmap.
 */
export function strokeOutlinePath(
  points: Point[],
  size: number,
  tool: string,
  widthMultiplier = 1,
): string {
  if (points.length === 0) return "";
  const instrument = instrumentFor(tool);
  const input = points.map((p) => [p.x, p.y, p.p ?? 0.5] as [number, number, number]);
  const outline = getStroke(input, {
    size: size * instrument.widthScale * widthMultiplier,
    thinning: instrument.thinning,
    smoothing: instrument.smoothing,
    streamline: instrument.streamline,
    simulatePressure: points.every((p) => p.p === undefined || p.p === 0.5),
    last: true,
  });
  return svgPathFromPolygon(outline as number[][]);
}

function svgPathFromPolygon(points: number[][]): string {
  if (!points.length) return "";
  const d = points.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", points[0][0], points[0][1], "Q"] as (string | number)[],
  );
  d.push("Z");
  return d
    .map((v) => (typeof v === "number" ? Math.round(v * 100) / 100 : v))
    .join(" ");
}

/** Drops samples that are closer than `min` units apart, to bound stroke size. */
export function decimate(points: Point[], min = 1.6): Point[] {
  if (points.length < 3) return points;
  const out: Point[] = [points[0]];
  for (const p of points.slice(1, -1)) {
    const last = out[out.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) >= min) out.push(p);
  }
  out.push(points[points.length - 1]);
  return out;
}

export function boundsOfPoints(points: Point[]): { x: number; y: number; width: number; height: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
