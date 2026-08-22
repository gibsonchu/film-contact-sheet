import Link from "next/link";
import type { BinderSummary } from "@/lib/binders";

/**
 * Deliberately not the plain photo-thumbnail card style used on /sheets — a
 * binder is a folder holding sheets, not a sheet itself, so it gets a
 * layered tab behind the card to read as "a folder" at a glance.
 */
export function BinderCard({ binder }: { binder: BinderSummary }) {
  return (
    <Link href={`/binders/${binder.id}`} className="group relative block pt-2">
      <div
        className="absolute left-2 right-6 top-0 h-3 border border-b-0 border-[var(--line)] bg-charcoal"
        aria-hidden="true"
      />
      <div className="relative border border-[var(--line)] bg-charcoal p-2 transition-colors group-hover:border-warm">
        <div className="flex aspect-[4/3] items-end justify-center overflow-hidden bg-graphite">
          {binder.sourceCoverThumb ? (
            <img src={binder.sourceCoverThumb} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="label m-auto">Empty</span>
          )}
        </div>
        <div className="mt-1.5 leading-[1.35]">
          <p className="truncate text-[11px] text-warm">{binder.title}</p>
          <p className="label truncate">
            {binder.sheetCount} sheet{binder.sheetCount === 1 ? "" : "s"}
            {binder.sourceSheetTitle ? ` · marked up from ${binder.sourceSheetTitle}` : ""}
          </p>
          {!binder.isOwner ? <p className="label truncate opacity-70">Shared with you</p> : null}
        </div>
      </div>
    </Link>
  );
}
