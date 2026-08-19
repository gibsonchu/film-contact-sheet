import Link from "next/link";
import { rng } from "@/lib/hand";
import { strokeOutlinePath } from "@/lib/stroke";
import { CrayonFilter } from "@/components/CrayonFilter";
import type { Point } from "@/lib/types";

const VB_W = 320;
const VB_H = 200;

/**
 * The mark itself runs through the exact same pipeline a live pastel stroke
 * does — perfect-freehand's pressure-simulated outline — rather than a fixed
 * SVG stroke-width. That's what makes a real crayon mark read as drawn:
 * the line breathes, thickening and thinning as if a hand had actually
 * pressed and eased along it, not just traced at one constant weight.
 */
function WaxPath({
  points,
  color,
  filterId,
  size = 11,
}: {
  points: Point[];
  color: string;
  filterId: string;
  size?: number;
}) {
  const core = strokeOutlinePath(points, size, "pastel");
  const halo = strokeOutlinePath(points, size, "pastel", 1.5);
  const dense = strokeOutlinePath(points, size, "pastel", 0.55);
  return (
    <g filter={`url(#${filterId})`}>
      <path d={halo} fill={color} opacity={0.22} />
      <path d={core} fill={color} opacity={0.85} />
      <path d={dense} fill={color} opacity={0.55} />
    </g>
  );
}

/** A wobbling loop, sampled as raw points rather than collapsed into a smooth
 *  path — perfect-freehand wants the samples themselves so it can vary the
 *  width along their curvature, the way a hand varies pressure on a turn. */
function loopPoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: string,
  opts: { wobble: number; overshoot: number },
): Point[] {
  const rand = rng(seed);
  const steps = 90;
  const start = rand() * Math.PI * 2;
  const end = start + Math.PI * 2 + opts.overshoot;
  const tilt = (rand() - 0.5) * 0.14;
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = start + ((end - start) * i) / steps;
    const jitter = 1 + (rand() - 0.5) * opts.wobble * 2;
    const drift = Math.sin(t * 1.7 + i * 0.3) * opts.wobble * 0.6;
    const x = Math.cos(t) * rx * (jitter + drift);
    const y = Math.sin(t) * ry * (jitter - drift);
    pts.push({
      x: cx + x * Math.cos(tilt) - y * Math.sin(tilt),
      y: cy + x * Math.sin(tilt) + y * Math.cos(tilt),
    });
  }
  return pts;
}

/** A rounded, bowed rectangle, the same way handRect draws one, but as the
 *  raw sampled points along each side rather than four collapsed curves. */
function rectPoints(x: number, y: number, w: number, h: number, seed: string): Point[] {
  const rand = rng(seed);
  const jx = Math.min(w * 0.025, 5);
  const jy = Math.min(h * 0.025, 5);
  const corners: Point[] = [
    { x: x + (rand() - 0.5) * jx, y: y + (rand() - 0.5) * jy },
    { x: x + w + (rand() - 0.5) * jx, y: y + (rand() - 0.5) * jy },
    { x: x + w + (rand() - 0.5) * jx, y: y + h + (rand() - 0.5) * jy },
    { x: x + (rand() - 0.5) * jx, y: y + h + (rand() - 0.5) * jy },
  ];
  const pts: Point[] = [];
  const perSide = 16;
  for (let i = 0; i < 4; i += 1) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    const bow = (rand() - 0.5) * Math.min(w, h) * 0.045;
    for (let s = 0; s <= perSide; s += 1) {
      const t = s / perSide;
      const bowAmt = Math.sin(t * Math.PI) * bow;
      // Perpendicular to this side, so the bow reads as a genuine outward/
      // inward belly rather than a diagonal smear.
      const nx = -(b.y - a.y);
      const ny = b.x - a.x;
      const len = Math.hypot(nx, ny) || 1;
      pts.push({
        x: a.x + (b.x - a.x) * t + (nx / len) * bowAmt,
        y: a.y + (b.y - a.y) * t + (ny / len) * bowAmt,
      });
    }
  }
  pts.push(pts[0]);
  return pts;
}

/** A handful of points along a short straight run, with a little life in the
 *  middle — enough for perfect-freehand to find a genuine taper rather than
 *  rendering a dead-straight sliver. */
function flickPoints(x1: number, y1: number, x2: number, y2: number, seed: string): Point[] {
  const rand = rng(seed);
  const steps = 5;
  const nx = -(y2 - y1);
  const ny = x2 - x1;
  const len = Math.hypot(nx, ny) || 1;
  const bow = (rand() - 0.5) * 3;
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const b = Math.sin(t * Math.PI) * bow;
    pts.push({
      x: x1 + (x2 - x1) * t + (nx / len) * b,
      y: y1 + (y2 - y1) * t + (ny / len) * b,
    });
  }
  return pts;
}

/** A lasso that doesn't quite close, with a fanned crown of quick flicks
 *  where the stick left the paper — the loose, energetic mark a grease
 *  pencil makes circling a frame worth a second look. */
function LoopMark({ seed, color, filterId }: { seed: string; color: string; filterId: string }) {
  const loop = loopPoints(VB_W / 2, VB_H / 2 + 4, 122, 76, seed, { wobble: 0.11, overshoot: 0.85 });
  const r = rng(`${seed}:flourish`);
  const baseX = VB_W / 2 + 104;
  const baseY = VB_H / 2 - 62;
  const flicks = [0, 1, 2, 3].map((i) => {
    const spread = -1.15 + i * 0.36;
    const originAngle = spread + (r() - 0.5) * 0.08;
    const originR = 6 + r() * 5;
    const x1 = baseX + Math.cos(originAngle) * originR;
    const y1 = baseY + Math.sin(originAngle) * originR;
    const len = 22 + r() * 12;
    const x2 = x1 + Math.cos(spread) * len;
    const y2 = y1 + Math.sin(spread) * len;
    return flickPoints(x1, y1, x2, y2, `${seed}:flick${i}`);
  });
  return (
    <>
      <WaxPath points={loop} color={color} filterId={filterId} />
      {flicks.map((pts, i) => (
        <WaxPath key={i} points={pts} color={color} filterId={filterId} size={5} />
      ))}
    </>
  );
}

/** A rounded frame, the way a contact sheet's own crop marks look, with two
 *  punched dots stemming off the top edge — the sprocket holes of a strip
 *  of film. */
function FrameMark({ seed, color, filterId }: { seed: string; color: string; filterId: string }) {
  const rect = rectPoints(28, 22, VB_W - 56, VB_H - 44, seed);
  const r = rng(`${seed}:dots`);
  const dots = [
    { cx: 96, cy: 18, r: 10, stemY: 28 },
    { cx: 142, cy: 15, r: 6.5, stemY: 25 },
  ];
  return (
    <>
      <WaxPath points={rect} color={color} filterId={filterId} />
      {dots.map((dot, i) => {
        const jx = (r() - 0.5) * 3;
        return (
          <g key={i}>
            <WaxPath
              points={flickPoints(dot.cx + jx, dot.cy, dot.cx + jx, dot.stemY, `${seed}:stem${i}`)}
              color={color}
              filterId={filterId}
              size={4}
            />
            <g filter={`url(#${filterId})`}>
              <circle cx={dot.cx} cy={dot.cy} r={dot.r} fill={color} opacity={0.92} />
            </g>
          </g>
        );
      })}
    </>
  );
}

interface Props {
  href: string;
  label: string;
  /** The word shown inside the mark — what the mockup actually shows. */
  word: string;
  variant: "loop" | "frame";
  seed: string;
}

/**
 * One of the landing page's two calls to action: a word circled in wax
 * crayon, the way an editor marks a frame worth printing on a contact sheet.
 */
export function HandDrawnCTA({ href, label, word, variant, seed }: Props) {
  const color = "var(--color-china)";
  // Each mark defines its own filter instance — two SVGs on the same page
  // can't share one literal id without colliding.
  const filterId = `fcs-landing-crayon-${seed}`;
  return (
    <Link
      href={href}
      aria-label={label}
      className="block w-[240px] shrink-0 transition-transform hover:scale-[1.03] sm:w-[300px]"
    >
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="h-auto w-full overflow-visible" aria-hidden="true">
        <defs>
          <CrayonFilter id={filterId} />
        </defs>
        {variant === "loop" ? (
          <LoopMark seed={seed} color={color} filterId={filterId} />
        ) : (
          <FrameMark seed={seed} color={color} filterId={filterId} />
        )}
        <text
          x={VB_W / 2}
          y={VB_H / 2}
          dy="0.35em"
          textAnchor="middle"
          fill="var(--color-warm)"
          fontFamily="var(--font-sans)"
          fontSize={46}
        >
          {word}
        </text>
      </svg>
    </Link>
  );
}
