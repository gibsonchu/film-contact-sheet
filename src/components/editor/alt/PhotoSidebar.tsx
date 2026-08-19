"use client";

import { useEffect, useRef } from "react";
import { AddPhotos } from "../FilmstripBar";
import { cx } from "@/components/ui/primitives";
import { useEditor } from "@/lib/store/editor";
import type { ReviewStatus } from "@/lib/types";

const STATUS_GLYPH: Record<ReviewStatus, string> = {
  unflagged: "",
  pick: "◯",
  maybe: "?",
  reject: "✕",
};

const FILTERS: { value: ReviewStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pick", label: "Picks" },
  { value: "maybe", label: "Maybe" },
  { value: "reject", label: "Rejects" },
  { value: "unflagged", label: "Unflagged" },
];

/**
 * The roll down the left-hand side, the way Preview shows the pages of a
 * document: a single column of thumbnails, each captioned with its frame
 * number and filename, the current one outlined.
 *
 * It is a way of finding a frame, not a second canvas — clicking selects, and
 * the sheet is still where the reviewing happens.
 */
export function PhotoSidebar() {
  const doc = useEditor((s) => s.doc);
  const urls = useEditor((s) => s.urls);
  const selected = useEditor((s) => s.selectedPhotoId);
  const filter = useEditor((s) => s.filter);
  const setFilter = useEditor((s) => s.setFilter);
  const selectPhoto = useEditor((s) => s.selectPhoto);
  const listRef = useRef<HTMLDivElement>(null);

  /* Follow the selection however it was made — from here, from the sheet, or
     from the arrow keys. Focus only moves if it was already in the column. */
  useEffect(() => {
    if (!selected) return;
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>(`[data-strip-photo="${selected}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "nearest" });
    if (list?.contains(document.activeElement)) el.focus();
  }, [selected]);

  if (!doc) return null;

  const counts = doc.photos.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <aside
      className="hair-r flex h-full w-[184px] shrink-0 flex-col bg-charcoal"
      aria-label="Frames"
    >
      <div className="hair-b flex flex-wrap gap-x-2.5 gap-y-1 px-3 py-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            aria-pressed={filter === f.value}
            className={cx(
              "whitespace-nowrap text-[11px] transition-colors",
              filter === f.value ? "text-warm" : "text-smoke hover:text-warm",
            )}
          >
            {f.label}
            <span className="ml-1 opacity-50">
              {f.value === "all" ? doc.photos.length : (counts[f.value] ?? 0)}
            </span>
          </button>
        ))}
      </div>

      <div
        ref={listRef}
        role="listbox"
        aria-label="Frames"
        aria-activedescendant={selected ? `strip-${selected}` : undefined}
        className="flex-1 overflow-y-auto px-3 py-3"
      >
        {doc.photos.map((photo) => {
          const url = urls[photo.thumbPath] ?? urls[photo.storagePath];
          const isSelected = photo.id === selected;
          return (
            <button
              key={photo.id}
              id={`strip-${photo.id}`}
              data-strip-photo={photo.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              tabIndex={isSelected || (!selected && photo.position === 0) ? 0 : -1}
              onClick={() => selectPhoto(photo.id)}
              className="mb-3 block w-full text-center"
            >
              <span
                className={cx(
                  "relative block aspect-[4/3] w-full overflow-hidden border bg-black transition-colors",
                  isSelected ? "border-warm" : "border-[var(--line)] hover:border-smoke",
                  photo.hidden && "opacity-35",
                )}
              >
                {url ? (
                  <img src={url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="label absolute inset-0 grid place-items-center">—</span>
                )}
                {photo.status !== "unflagged" ? (
                  <span
                    className="absolute right-1 top-0 text-[15px] leading-tight text-darkroom"
                    aria-hidden="true"
                  >
                    {STATUS_GLYPH[photo.status]}
                  </span>
                ) : null}
              </span>
              <span
                className={cx(
                  "mt-1 block truncate text-[10px]",
                  isSelected ? "text-warm" : "text-smoke",
                )}
              >
                {photo.frameNumber || "–"} · {photo.title || photo.originalFilename || "Untitled"}
              </span>
              <span className="sr-only">{photo.status}</span>
            </button>
          );
        })}
      </div>

      <div className="hair-t px-3 py-2">
        <AddPhotos count={doc.photos.length} />
      </div>
    </aside>
  );
}
