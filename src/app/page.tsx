import Image from "next/image";
import Link from "next/link";

/** Intrinsic size of public/landing-cover.jpg. */
const COVER = { width: 1800, height: 1247 };
const COVER_ASPECT = COVER.width / COVER.height;

export default function HomePage() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      {/* Width is capped against the height available so the cover and both
          CTAs stay above the fold on short windows and on mobile. */}
      <div
        className="w-full"
        style={{ maxWidth: `min(52rem, calc((100dvh - 210px) * ${COVER_ASPECT}))` }}
      >
        <Image
          src="/landing-cover.jpg"
          alt="A photographic lab index print resting on a concrete floor: rows of small colour frames, each numbered, with a notes bar and an order number along the top."
          width={COVER.width}
          height={COVER.height}
          priority
          sizes="(max-width: 840px) 100vw, 832px"
          className="h-auto w-full shadow-[0_30px_80px_rgba(0,0,0,0.65)]"
        />
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/new"
          className="bg-warm px-6 py-3 text-sm font-medium text-noir transition-colors hover:bg-white"
        >
          Create a Contact Sheet
        </Link>
        <Link
          href="/projects"
          className="border border-white/20 px-6 py-3 text-sm text-bone transition-colors hover:border-white/50 hover:text-warm"
        >
          My Sheets
        </Link>
      </div>
    </main>
  );
}
