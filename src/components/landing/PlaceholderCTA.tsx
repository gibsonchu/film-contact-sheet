import Link from "next/link";

interface Props {
  href: string;
  label: string;
  word: string;
}

/**
 * Stands in for a HandDrawnCTA that doesn't have artwork yet — same "sm"
 * footprint and type treatment, just a dashed box instead of a drawn mark.
 * Swap for a real HandDrawnCTA once hand-drawn art exists for this
 * destination; nothing else about the layout needs to change.
 */
export function PlaceholderCTA({ href, label, word }: Props) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex h-[98px] w-[130px] shrink-0 items-center justify-center border border-dashed transition-transform hover:scale-[1.03] sm:h-[120px] sm:w-[160px]"
      style={{ borderColor: "#ededea" }}
    >
      <span
        className="text-[11px] tracking-[0.08em] sm:text-[12px]"
        style={{ fontFamily: "var(--font-sans)", color: "#ededea" }}
      >
        {word}
      </span>
    </Link>
  );
}
