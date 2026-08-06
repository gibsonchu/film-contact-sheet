/**
 * Hand-drawn path generators.
 *
 * Everything the app draws as a "mark" — status circles, X's, checks, crop
 * marks, shape annotations — routes through here so nothing looks like a
 * vector-perfect primitive. Wobble is deterministic (seeded by id) so a sheet
 * redraws identically on screen and in export.
 */

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small deterministic PRNG (mulberry32). */
export function rng(seed: number | string) {
  let a = typeof seed === "string" ? hashString(seed) : seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type P = [number, number];

function pathFrom(points: P[], close = false): string {
  if (points.length === 0) return "";
  const d = [`M ${round(points[0][0])} ${round(points[0][1])}`];
  for (let i = 1; i < points.length - 1; i += 1) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    d.push(`Q ${round(x0)} ${round(y0)} ${round((x0 + x1) / 2)} ${round((y0 + y1) / 2)}`);
  }
  const last = points[points.length - 1];
  d.push(`L ${round(last[0])} ${round(last[1])}`);
  if (close) d.push("Z");
  return d.join(" ");
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** A wobbling ellipse, drawn as a slightly over-run loop like a grease pencil. */
export function handEllipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: string,
  opts?: { wobble?: number; overshoot?: number; laps?: number },
): string {
  const rand = rng(seed);
  const wobble = opts?.wobble ?? 0.055;
  const overshoot = opts?.overshoot ?? 0.28;
  const laps = opts?.laps ?? 1;
  const steps = 34 * laps;
  const start = rand() * Math.PI * 2;
  const end = start + Math.PI * 2 * laps + overshoot;
  const tilt = (rand() - 0.5) * 0.14;
  const pts: P[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = start + ((end - start) * i) / steps;
    const jitter = 1 + (rand() - 0.5) * wobble * 2;
    const drift = Math.sin(t * 1.7 + seedOffset(seed)) * wobble * 0.6;
    const x = Math.cos(t) * rx * (jitter + drift);
    const y = Math.sin(t) * ry * (jitter - drift);
    pts.push([cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)]);
  }
  return pathFrom(pts);
}

function seedOffset(seed: string): number {
  return (hashString(seed) % 628) / 100;
}

/** Two crossing strokes with unequal lengths, like a rejected frame. */
export function handX(
  x: number,
  y: number,
  w: number,
  h: number,
  seed: string,
  overshoot = 0.06,
): string[] {
  const rand = rng(seed);
  const o = (v: number) => v * overshoot * (0.5 + rand());
  const stroke = (a: P, b: P, s: string): string => {
    const r = rng(s);
    const pts: P[] = [];
    const steps = 7;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const px = a[0] + (b[0] - a[0]) * t;
      const py = a[1] + (b[1] - a[1]) * t;
      const bow = Math.sin(t * Math.PI) * (r() - 0.5) * Math.min(w, h) * 0.07;
      pts.push([px + bow, py - bow * 0.4]);
    }
    return pathFrom(pts);
  };
  return [
    stroke([x - o(w), y - o(h)], [x + w + o(w), y + h + o(h)], seed + "a"),
    stroke([x + w + o(w), y - o(h)], [x - o(w), y + h + o(h)], seed + "b"),
  ];
}

/** A quick tick: short down-stroke, long up-stroke. */
export function handCheck(x: number, y: number, size: number, seed: string): string {
  const rand = rng(seed);
  const j = () => (rand() - 0.5) * size * 0.08;
  const pts: P[] = [
    [x + j(), y + size * 0.52 + j()],
    [x + size * 0.36 + j(), y + size * 0.92 + j()],
    [x + size * 1.02 + j(), y - size * 0.12 + j()],
  ];
  return pathFrom(pts);
}

export function handArrow(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  seed: string,
): { shaft: string; head: string } {
  const rand = rng(seed);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const angle = Math.atan2(dy, dx);
  const bow = (rand() - 0.5) * len * 0.08;
  const pts: P[] = [];
  const steps = 9;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const nx = -dy / len;
    const ny = dx / len;
    const b = Math.sin(t * Math.PI) * bow;
    pts.push([x1 + dx * t + nx * b, y1 + dy * t + ny * b]);
  }
  const headLen = Math.min(len * 0.28, 26 + len * 0.06);
  const spread = 0.42 + rand() * 0.12;
  const h1: P = [x2 - Math.cos(angle - spread) * headLen, y2 - Math.sin(angle - spread) * headLen];
  const h2: P = [x2 - Math.cos(angle + spread) * headLen, y2 - Math.sin(angle + spread) * headLen];
  return {
    shaft: pathFrom(pts),
    head: `M ${round(h1[0])} ${round(h1[1])} L ${round(x2)} ${round(y2)} L ${round(h2[0])} ${round(h2[1])}`,
  };
}

export function handRect(x: number, y: number, w: number, h: number, seed: string): string {
  const rand = rng(seed);
  const j = (m: number) => (rand() - 0.5) * m;
  const jx = Math.min(w * 0.03, 6);
  const jy = Math.min(h * 0.03, 6);
  const corners: P[] = [
    [x + j(jx), y + j(jy)],
    [x + w + j(jx), y + j(jy)],
    [x + w + j(jx), y + h + j(jy)],
    [x + j(jx), y + h + j(jy)],
  ];
  const segs: string[] = [];
  for (let i = 0; i < 4; i += 1) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    const mid: P = [
      (a[0] + b[0]) / 2 + j(jx * 1.4),
      (a[1] + b[1]) / 2 + j(jy * 1.4),
    ];
    segs.push(
      `${i === 0 ? `M ${round(a[0])} ${round(a[1])}` : ""} Q ${round(mid[0])} ${round(mid[1])} ${round(b[0])} ${round(b[1])}`,
    );
  }
  return segs.join(" ") + " Z";
}

export function handLine(x1: number, y1: number, x2: number, y2: number, seed: string): string {
  const rand = rng(seed);
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = -(y2 - y1) / len;
  const ny = (x2 - x1) / len;
  const pts: P[] = [];
  const steps = 8;
  const amp = Math.min(len * 0.03, 5) * (rand() - 0.5) * 2;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const b = Math.sin(t * Math.PI) * amp;
    pts.push([x1 + (x2 - x1) * t + nx * b, y1 + (y2 - y1) * t + ny * b]);
  }
  return pathFrom(pts);
}

/** Four L-shaped corner marks, as used to indicate a crop on a proof. */
export function cropMarks(x: number, y: number, w: number, h: number, seed: string): string[] {
  const arm = Math.min(w, h) * 0.22;
  const rand = rng(seed);
  const j = () => (rand() - 0.5) * 3;
  const corner = (cx: number, cy: number, sx: number, sy: number): string =>
    `M ${round(cx + sx * arm + j())} ${round(cy + j())} L ${round(cx + j())} ${round(cy + j())} L ${round(cx + j())} ${round(cy + sy * arm + j())}`;
  return [
    corner(x, y, 1, 1),
    corner(x + w, y, -1, 1),
    corner(x + w, y + h, -1, -1),
    corner(x, y + h, 1, -1),
  ];
}

/** A question mark drawn as a path, for "maybe" frames. */
export function handQuestion(x: number, y: number, size: number, seed: string): string[] {
  const rand = rng(seed);
  const j = () => (rand() - 0.5) * size * 0.06;
  const s = size;
  const hook = pathFrom([
    [x - s * 0.3 + j(), y - s * 0.26 + j()],
    [x - s * 0.1 + j(), y - s * 0.5 + j()],
    [x + s * 0.24 + j(), y - s * 0.42 + j()],
    [x + s * 0.26 + j(), y - s * 0.1 + j()],
    [x + s * 0.02 + j(), y + s * 0.08 + j()],
    [x + j(), y + s * 0.3 + j()],
  ]);
  const dot = `M ${round(x + j())} ${round(y + s * 0.52)} l 0.6 0`;
  return [hook, dot];
}

/** Deterministic tilt (in degrees) for a frame, for imperfect alignment. */
export function frameTilt(seed: string, amount = 0.35): number {
  return (rng(seed)() - 0.5) * 2 * amount;
}
