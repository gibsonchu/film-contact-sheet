import { cropMarks, handEllipse, handX, rng } from "@/lib/hand";

const COLS = 4;
const ROWS = 3;
const FRAME_W = 118;
const FRAME_H = 78;
const GAP = 7;
const PAD_X = 12;
const SPROCKET = 15;

/**
 * A decorative sheet for the landing page. Deliberately image-free: every frame
 * is a gradient, so it renders on the server, costs nothing to load and can
 * never break on a dead asset URL.
 */
export function LandingSheet() {
  const stripW = PAD_X * 2 + COLS * FRAME_W + (COLS - 1) * GAP;
  const stripH = SPROCKET * 2 + FRAME_H + 12;
  const width = stripW + 40;
  const height = ROWS * stripH + (ROWS - 1) * 18 + 60;
  const rand = rng("landing-sheet");

  return (
    <div className="texture-noise relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full drop-shadow-[0_30px_80px_rgba(0,0,0,0.7)]"
        role="img"
        aria-label="Illustration of a marked-up 35mm contact sheet"
      >
        <rect width={width} height={height} fill="#131315" />
        <defs>
          {Array.from({ length: COLS * ROWS }, (_, i) => {
            const a = 25 + rand() * 60;
            const b = 120 + rand() * 120;
            return (
              <linearGradient key={i} id={`ls-g${i}`} x1="0" y1="0" x2={rand()} y2="1">
                <stop offset="0%" stopColor={`rgb(${b},${b - 6},${b - 14})`} />
                <stop offset="55%" stopColor={`rgb(${a + 40},${a + 36},${a + 30})`} />
                <stop offset="100%" stopColor={`rgb(${a},${a},${a - 3})`} />
              </linearGradient>
            );
          })}
        </defs>

        {Array.from({ length: ROWS }, (_, row) => {
          const y = 22 + row * (stripH + 18);
          const holes = Math.floor((stripW - 10) / 20);
          return (
            <g key={row}>
              <rect x={20} y={y} width={stripW} height={stripH} fill="#08080a" rx={2} />
              {Array.from({ length: holes }, (_, i) => (
                <g key={i}>
                  <rect x={26 + i * 20} y={y + 4} width={10} height={8} rx={2} fill="#131315" />
                  <rect x={26 + i * 20} y={y + stripH - 12} width={10} height={8} rx={2} fill="#131315" />
                </g>
              ))}
              {Array.from({ length: COLS }, (_, col) => {
                const i = row * COLS + col;
                const x = 20 + PAD_X + col * (FRAME_W + GAP);
                const fy = y + SPROCKET;
                return (
                  <g key={col}>
                    <rect x={x} y={fy} width={FRAME_W} height={FRAME_H} fill={`url(#ls-g${i})`} />
                    <text
                      x={x + 2}
                      y={y + stripH - 4}
                      fill="#8b8780"
                      fontSize={7}
                      fontFamily="ui-monospace, monospace"
                      letterSpacing="1"
                    >
                      {i + 1}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* editorial marks */}
        <path
          d={handEllipse(20 + PAD_X + FRAME_W * 1.5 + GAP, 22 + SPROCKET + FRAME_H / 2, FRAME_W * 0.52, FRAME_H * 0.58, "ls-fav", { laps: 1.35 })}
          fill="none"
          stroke="#d81f26"
          strokeWidth={3}
          strokeLinecap="round"
        />
        {handX(
          20 + PAD_X + (FRAME_W + GAP) * 2,
          22 + (stripH + 18) + SPROCKET,
          FRAME_W,
          FRAME_H,
          "ls-rej",
        ).map((d, i) => (
          <path key={i} d={d} fill="none" stroke="#d81f26" strokeWidth={3} strokeLinecap="round" />
        ))}
        {cropMarks(
          20 + PAD_X + 8,
          22 + (stripH + 18) * 2 + SPROCKET + 6,
          FRAME_W - 16,
          FRAME_H - 12,
          "ls-crop",
        ).map((d, i) => (
          <path key={i} d={d} fill="none" stroke="#f2c218" strokeWidth={2.4} strokeLinecap="round" />
        ))}

        {/* tape */}
        <g transform={`rotate(-4 ${width - 96} 14)`}>
          <rect x={width - 150} y={4} width={120} height={26} fill="#e8c73c" opacity={0.95} />
          <text
            x={width - 90}
            y={22}
            textAnchor="middle"
            fill="#3a3117"
            fontSize={13}
            fontFamily="'Bradley Hand', 'Segoe Script', cursive"
          >
            roll 017
          </text>
        </g>
      </svg>
    </div>
  );
}
