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
}

/**
 * One of the landing page's two calls to action: a word inside a mark drawn
 * by hand — the actual artwork, not a procedural stand-in for it.
 */
export function HandDrawnCTA({ href, label, word, src, width, height }: Props) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="relative block w-[240px] shrink-0 transition-transform hover:scale-[1.03] sm:w-[300px]"
    >
      <Image src={src} alt="" width={width} height={height} priority className="h-auto w-full" />
      <span
        className="pointer-events-none absolute inset-0 flex items-center justify-center text-[32px] text-warm sm:text-[40px]"
        style={{ fontFamily: "var(--font-sans)" }}
        aria-hidden="true"
      >
        {word}
      </span>
    </Link>
  );
}
