import Link from "next/link";
import { handEllipse, handLine, handRect, rng } from "@/lib/hand";
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

/** A lasso that doesn't quite close, with a couple of quick flicks where the
 *  stick left the paper — the loose, energetic mark a grease pencil makes
 *  circling a frame worth a second look. */
function LoopMark({ seed, color, filterId }: { seed: string; color: string; filterId: string }) {
  const loop = handEllipse(VB_W / 2, VB_H / 2 + 4, 122, 76, seed, { wobble: 0.085, overshoot: 0.85, laps: 1 });
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

/** A rounded frame, the way a contact sheet's own crop marks look, with two
 *  punched dots stemming off the top edge — the sprocket holes of a strip
 *  of film. */
function FrameMark({ seed, color, filterId }: { seed: string; color: string; filterId: string }) {
  const rect = handRect(28, 22, VB_W - 56, VB_H - 44, seed);
  const r = rng(`${seed}:dots`);
  const dots = [
    { cx: 96, cy: 18, r: 10, stemY: 28 },
    { cx: 142, cy: 15, r: 6.5, stemY: 25 },
  ];
  return (
    <>
      <WaxPath d={rect} color={color} filterId={filterId} />
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
