import Image from "next/image";
import Link from "next/link";

/**
 * The site's mark, standing in for the wordmark in the app's own chrome —
 * the same hand-drawn loop used on the landing page and as the favicon.
 */
export function SiteMark({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label="Film Contact Sheet" className={className}>
      {/* The artwork is white pixels baked into the PNG, not a colour a CSS
          class can touch — invert flips it to dark for light mode, since
          alpha (the transparent background) passes through untouched. */}
      <Image
        src="/mark-new.png"
        alt=""
        width={400}
        height={266}
        className="theme-invert h-6 w-auto"
        priority
      />
    </Link>
  );
}
