import Image from "next/image";
import Link from "next/link";

interface Props {
  href: string;
  label: string;
  /** The word shown inside the mark — what the mockup actually shows. */
  word: string;
  src: string;
  width: number;
  height: number;
  /** "lg" is the two primary calls to action; "sm" is for a secondary mark
   *  (smaller mark, word set like a caption rather than a headline). */
  size?: "lg" | "sm";
  /** Centre point of the word as a percentage of the artwork's own box.
   *  Defaults to dead centre; a mark whose drawn lines aren't symmetric
   *  (open cell sits off the canvas's true middle) can override this so the
   *  word reads as centred on the ink, not on the invisible image bounds. */
  wordCenter?: { x: string; y: string };
}

const SIZES = {
  lg: { wrap: "w-[240px] sm:w-[300px]", word: "text-[32px] sm:text-[40px]" },
  sm: { wrap: "w-[130px] sm:w-[160px]", word: "text-[11px] tracking-[0.08em] sm:text-[12px]" },
};

/**
 * One of the landing page's calls to action: a word inside a mark drawn by
 * hand — the actual artwork, not a procedural stand-in for it.
 */
export function HandDrawnCTA({
  href,
  label,
  word,
  src,
  width,
  height,
  size = "lg",
  wordCenter = { x: "50%", y: "50%" },
}: Props) {
  const sized = SIZES[size];
  return (
    <Link
      href={href}
      aria-label={label}
      className={`relative block shrink-0 transition-transform hover:scale-[1.03] ${sized.wrap}`}
    >
      <Image src={src} alt="" width={width} height={height} priority className="h-auto w-full" />
      {/* Fixed, not the --color-warm token: this page has no theme toggle
          and always reads white on red, even if a light preference was set
          elsewhere and follows the visitor here. */}
      <span
        className={`pointer-events-none absolute whitespace-nowrap ${sized.word}`}
        style={{
          left: wordCenter.x,
          top: wordCenter.y,
          transform: "translate(-50%, -50%)",
          fontFamily: "var(--font-sans)",
          color: "#ededea",
        }}
        aria-hidden="true"
      >
        {word}
      </span>
    </Link>
  );
}
