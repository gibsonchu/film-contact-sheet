import Link from "next/link";
import { LandingSheet } from "@/components/marketing/LandingSheet";

export default function HomePage() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      {/* Sized so the whole sheet and both CTAs stay above the fold: the sheet
          is 557 × 456 units, so its width is capped by the height available. */}
      <div
        className="w-full"
        style={{ maxWidth: "min(46rem, calc((100dvh - 210px) * 1.221))" }}
      >
        <LandingSheet />
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
