import Link from "next/link";
import { handEllipse, handLine, rng } from "@/lib/hand";
import { CrayonFilter } from "@/components/CrayonFilter";

const VB_W = 320;
const VB_H = 200;

/** The wax build-up used everywhere else the pastel hand appears: a faint
 *  wide halo, a solid body, and a denser core, all crumbled by the same
 *  crayon filter so this reads as the same hand as the rest of the product. */
function WaxPath({
  d,
  color,
  filterId,
  weight = "heavy",
}: {
  d: string;
  color: string;
  filterId: string;
  /** A "light" pass reads as a quick flick of the wrist rather than a bearing-down loop —
   *  used for small marks where the loop's full-weight halo would blob into one mass. */
  weight?: "heavy" | "light";
}) {
  const widths = weight === "heavy" ? [20, 12, 6.5] : [8, 4.5, 2.4];
  return (
    <g filter={`url(#${filterId})`}>
      <path d={d} stroke={color} strokeWidth={widths[0]} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.22} />
      <path d={d} stroke={color} strokeWidth={widths[1]} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.88} />
      <path d={d} stroke={color} strokeWidth={widths[2]} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.55} />
    </g>
  );
}

/** A lasso that doesn't quite close, with a couple of quick flicks picking up
 *  right where the line breaks off — the loose, energetic mark a grease
 *  pencil makes circling a frame worth a second look, pen lifted before it
 *  ever meets its own start. */
function LoopMark({ seed, color, filterId }: { seed: string; color: string; filterId: string }) {
  // A negative overshoot stops the loop short of closing instead of running
  // past itself — start is pinned so the gap lands up and to the right,
  // exactly where the flourish below picks it up.
  const gapAngle = -0.8;
  const loop = handEllipse(VB_W / 2, VB_H / 2 + 4, 122, 76, seed, {
    wobble: 0.085,
    overshoot: -0.5,
    laps: 1,
    start: gapAngle,
  });
  const r = rng(`${seed}:flourish`);
  const baseX = VB_W / 2 + 104;
  const baseY = VB_H / 2 - 62;
  // A fanned-out crown of quick ticks, each starting from its own point along
  // a short arc rather than one shared origin — a shared origin is what
  // makes a fan of short strokes read as a single blob instead of a spray.
  const flicks = [0, 1, 2, 3].map((i) => {
    const spread = -1.15 + i * 0.36;
    const originAngle = spread + (r() - 0.5) * 0.08;
    const originR = 6 + r() * 5;
    const x1 = baseX + Math.cos(originAngle) * originR;
    const y1 = baseY + Math.sin(originAngle) * originR;
    const len = 22 + r() * 12;
    const x2 = x1 + Math.cos(spread) * len;
    const y2 = y1 + Math.sin(spread) * len;
    return handLine(x1, y1, x2, y2, `${seed}:flick${i}`);
  });
  return (
    <>
      <WaxPath d={loop} color={color} filterId={filterId} />
      {flicks.map((d, i) => (
        <WaxPath key={i} d={d} color={color} filterId={filterId} weight="light" />
      ))}
    </>
  );
}

/**
 * A wobbly rounded rectangle, drawn almost all the way around — a small gap
 * is left in the middle of the right edge, the way a hand-drawn frame rarely
 * quite meets back up with itself. Returns two path pieces either side of
 * the gap rather than one, so each end gets its own round cap.
 */
function openRectPath(x: number, y: number, w: number, h: number, seed: string): [string, string] {
  const rand = rng(seed);
  const j = (m: number) => (rand() - 0.5) * m;
  const jx = Math.min(w * 0.03, 6);
  const jy = Math.min(h * 0.03, 6);
  const corners: [number, number][] = [
    [x + j(jx), y + j(jy)],
    [x + w + j(jx), y + j(jy)],
    [x + w + j(jx), y + h + j(jy)],
    [x + j(jx), y + h + j(jy)],
  ];
  const bowed = (m: [number, number], jm: number) => [m[0] + j(jm), m[1] + j(jm)] as [number, number];

  // The right edge (corner 1 → corner 2) carries the gap, split at its own
  // midpoint into a start-half and an end-half.
  const right = { a: corners[1], b: corners[2], mid: bowed([(corners[1][0] + corners[2][0]) / 2, (corners[1][1] + corners[2][1]) / 2], jx * 1.4) };
  const gapStart = quadPoint(right.a, right.mid, right.b, 0.42);
  const gapEnd = quadPoint(right.a, right.mid, right.b, 0.58);

  // Piece one: top, then down into the right edge as far as the gap.
  const topMid = bowed([(corners[0][0] + corners[1][0]) / 2, (corners[0][1] + corners[1][1]) / 2], jx * 1.4);
  const pieceOne = [
    `M ${corners[0][0]} ${corners[0][1]}`,
    `Q ${topMid[0]} ${topMid[1]} ${corners[1][0]} ${corners[1][1]}`,
    `Q ${right.mid[0]} ${right.mid[1]} ${gapStart[0]} ${gapStart[1]}`,
  ].join(" ");

  // Piece two: out of the gap, finishing the right edge, then bottom and left
  // back to the top-left corner.
  const bottomMid = bowed([(corners[2][0] + corners[3][0]) / 2, (corners[2][1] + corners[3][1]) / 2], jy * 1.4);
  const leftMid = bowed([(corners[3][0] + corners[0][0]) / 2, (corners[3][1] + corners[0][1]) / 2], jy * 1.4);
  const pieceTwo = [
    `M ${gapEnd[0]} ${gapEnd[1]}`,
    `Q ${right.mid[0]} ${right.mid[1]} ${corners[2][0]} ${corners[2][1]}`,
    `Q ${bottomMid[0]} ${bottomMid[1]} ${corners[3][0]} ${corners[3][1]}`,
    `Q ${leftMid[0]} ${leftMid[1]} ${corners[0][0]} ${corners[0][1]}`,
  ].join(" ");

  return [pieceOne, pieceTwo];
}

/** A point on a quadratic bezier at t, for splitting a bowed side cleanly. */
function quadPoint(p0: [number, number], p1: [number, number], p2: [number, number], t: number): [number, number] {
  const mt = 1 - t;
  return [
    mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0],
    mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1],
  ];
}

/** A rounded frame, the way a contact sheet's own crop marks look, with two
 *  punched dots stemming off the top edge — the sprocket holes of a strip
 *  of film. */
function FrameMark({ seed, color, filterId }: { seed: string; color: string; filterId: string }) {
  const [rectA, rectB] = openRectPath(28, 22, VB_W - 56, VB_H - 44, seed);
  const r = rng(`${seed}:dots`);
  const dots = [
    { cx: 96, cy: 18, r: 10, stemY: 28 },
    { cx: 142, cy: 15, r: 6.5, stemY: 25 },
  ];
  return (
    <>
      <WaxPath d={rectA} color={color} filterId={filterId} />
      <WaxPath d={rectB} color={color} filterId={filterId} />
      {dots.map((dot, i) => (
        <g key={i} filter={`url(#${filterId})`}>
          <path
            d={handLine(dot.cx + (r() - 0.5) * 3, dot.cy, dot.cx + (r() - 0.5) * 3, dot.stemY, `${seed}:stem${i}`)}
            stroke={color}
            strokeWidth={5}
            fill="none"
            strokeLinecap="round"
            opacity={0.7}
          />
          <circle cx={dot.cx} cy={dot.cy} r={dot.r} fill={color} opacity={0.92} />
        </g>
      ))}
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
