"use client";

import { cx } from "@/components/ui/primitives";
import { useEditor } from "@/lib/store/editor";
import type { ReviewStatus } from "@/lib/types";

const STATUS_GLYPH: Record<ReviewStatus, string> = {
  unreviewed: "",
  favorite: "★",
  selected: "✓",
  maybe: "?",
  rejected: "✕",
};

const FILTERS: { value: ReviewStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "favorite", label: "Favourites" },
  { value: "selected", label: "Selected" },
  { value: "maybe", label: "Maybe" },
  { value: "rejected", label: "Rejected" },
  { value: "unreviewed", label: "Unreviewed" },
];

/** Compact strip for jumping between frames, plus the review filter. */
export function FilmstripBar() {
  const doc = useEditor((s) => s.doc);
  const urls = useEditor((s) => s.urls);
  const selected = useEditor((s) => s.selectedPhotoId);
  const filter = useEditor((s) => s.filter);
  const setFilter = useEditor((s) => s.setFilter);
  const selectPhoto = useEditor((s) => s.selectPhoto);
  const openLightbox = useEditor((s) => s.openLightbox);

  if (!doc) return null;
  const counts = doc.photos.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="shrink-0 border-t border-white/8 bg-charcoal">
      <div className="flex items-center gap-1 overflow-x-auto border-b border-white/8 px-2 py-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            aria-pressed={filter === f.value}
            className={cx(
              "whitespace-nowrap px-2 py-1 text-[11px] uppercase tracking-[0.14em] transition-colors",
              filter === f.value ? "bg-warm text-noir" : "text-smoke hover:text-warm",
            )}
          >
            {f.label}
            {f.value !== "all" ? (
              <span className="ml-1.5 opacity-60">{counts[f.value] ?? 0}</span>
            ) : (
              <span className="ml-1.5 opacity-60">{doc.photos.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5 overflow-x-auto px-2 py-2" role="listbox" aria-label="Frames">
        {doc.photos.map((photo) => {
          const url = urls[photo.thumbPath] ?? urls[photo.storagePath];
          const isSelected = photo.id === selected;
          return (
            <button
              key={photo.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => selectPhoto(photo.id)}
              onDoubleClick={() => openLightbox(photo.id)}
              title={`${photo.frameNumber || "—"} ${photo.title || photo.originalFilename}`}
              className={cx(
                "relative h-14 w-20 shrink-0 overflow-hidden border bg-black/60 transition-colors",
                isSelected ? "border-grease" : "border-white/10 hover:border-white/40",
                photo.hidden && "opacity-35",
              )}
            >
              {url ? (
                <img src={url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="label absolute inset-0 grid place-items-center">—</span>
              )}
              <span className="absolute bottom-0 left-0 bg-black/70 px-1 font-sans text-[9px] text-bone">
                {photo.frameNumber || "–"}
              </span>
              {photo.status !== "unreviewed" ? (
                <span
                  className="absolute right-0.5 top-0 text-[15px] leading-none text-darkroom drop-shadow"
                  aria-hidden="true"
                >
                  {STATUS_GLYPH[photo.status]}
                </span>
              ) : null}
              <span className="sr-only">{photo.status}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
