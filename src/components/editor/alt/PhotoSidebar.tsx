"use client";

import { useEffect, useRef, useState } from "react";
import { AddPhotos } from "../FilmstripBar";
import { SheetSettings } from "./SheetSettings";
import { cx } from "@/components/ui/primitives";
import { filteredPhotos, useEditor } from "@/lib/store/editor";
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
 * Everything about the roll, down the left-hand side, in the order you reach
 * for it: what the sheet is, how to put photographs on it, which of them to
 * look at, and then the photographs themselves — captioned in a single column
 * the way Preview lists the pages of a document.
 *
 * The whole column folds away when the sheet wants the room.
 */
export function PhotoSidebar() {
  const doc = useEditor((s) => s.doc);
  const urls = useEditor((s) => s.urls);
  const selected = useEditor((s) => s.selectedPhotoId);
  const filter = useEditor((s) => s.filter);
  const setFilter = useEditor((s) => s.setFilter);
  const selectPhoto = useEditor((s) => s.selectPhoto);
  const [open, setOpen] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  /* Follow the selection however it was made — from here, from the sheet, or
     from the arrow keys. Focus only moves if it was already in the column. */
  useEffect(() => {
    if (!selected || !open) return;
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>(`[data-strip-photo="${selected}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "nearest" });
    if (list?.contains(document.activeElement)) el.focus();
  }, [selected, open]);

  if (!doc) return null;

  const counts = doc.photos.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});
  const shown = filteredPhotos(doc, filter);

  if (!open) {
    return (
      <div className="hair-r flex h-full w-9 shrink-0 flex-col items-center bg-charcoal py-2">
        <PanelHandle open={false} onClick={() => setOpen(true)} />
        <span
          className="label mt-3 whitespace-nowrap text-[10px]"
          style={{ writingMode: "vertical-rl" }}
        >
          {doc.photos.length} frames
        </span>
      </div>
    );
  }

  return (
    <aside
      className="hair-r flex h-full min-h-0 w-[212px] shrink-0 flex-col bg-charcoal"
      aria-label="Frames"
    >
      <div className="hair-b flex items-start gap-1 p-2.5 pb-2">
        <div className="min-w-0 flex-1">
          <SheetSettings />
        </div>
        <PanelHandle open onClick={() => setOpen(false)} />
      </div>

      <div className="hair-b p-2.5">
        <AddPhotos count={doc.photos.length} layout="wide" />
      </div>

      <div className="hair-b flex flex-wrap gap-1 p-2.5">
        {FILTERS.map((f) => {
          const active = filter === f.value;
          const n = f.value === "all" ? doc.photos.length : (counts[f.value] ?? 0);
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              aria-pressed={active}
              className={cx(
                "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                active
                  ? "border-warm bg-warm text-noir"
                  : "border-[var(--line)] text-smoke hover:border-smoke hover:text-warm",
              )}
            >
              {f.label}
              <span className={active ? "opacity-60" : "opacity-50"}>{n}</span>
            </button>
          );
        })}
      </div>

      <div
        ref={listRef}
        role="listbox"
        aria-label="Frames"
        aria-activedescendant={selected ? `strip-${selected}` : undefined}
        // min-h-0 overrides the flex default of min-height:auto — without it
        // this list refuses to shrink below its content height, which pushes
        // the whole page taller instead of scrolling within its own bounds.
        className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3"
      >
        {shown.map((photo) => {
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
              // Establishes the containing block for the sr-only status span
              // below — without it, that absolutely-positioned span's layout
              // box escapes all the way to the document root (it has no other
              // positioned ancestor), inflating the whole page's scrollable
              // height by the sum of every thumbnail's position in the list.
              className="relative mb-3 block w-full text-center"
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
    </aside>
  );
}

/** The chevron that folds the column away, and the one that brings it back. */
function PanelHandle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-label={open ? "Hide the frames panel" : "Show the frames panel"}
      title={open ? "Hide the frames panel" : "Show the frames panel"}
      className="grid h-5 w-5 shrink-0 place-items-center text-smoke transition-colors hover:text-warm"
    >
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden="true">
        <path
          d="M7.5 2 3.5 6l4 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          style={{ transform: open ? "none" : "rotate(180deg)", transformOrigin: "center" }}
        />
      </svg>
    </button>
  );
}
