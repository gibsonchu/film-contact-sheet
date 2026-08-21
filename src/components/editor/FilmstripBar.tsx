"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui/primitives";
import { createPhoto } from "@/lib/document";
import { ACCEPT_ATTR, processImage } from "@/lib/images";
import { getStorage } from "@/lib/storage/local";
import { keepImages, sortFiles } from "@/lib/upload";
import { filteredPhotos, useEditor } from "@/lib/store/editor";
import { MAX_PHOTOS_PER_SHEET, type Photo, type ReviewStatus } from "@/lib/types";

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
 * Adds photographs to a sheet that already exists, from files or a whole
 * folder. The 38-frame roll limit still holds: anything over the remaining
 * room is left out and said so plainly rather than silently dropped.
 */
export function AddPhotos({ count, layout = "strip" }: { count: number; layout?: "strip" | "wide" }) {
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const readOnly = useEditor((s) => s.readOnly);

  const room = MAX_PHOTOS_PER_SHEET - count;
  if (readOnly) return null;

  async function ingest(incoming: File[]) {
    const usable = keepImages(sortFiles(incoming));
    if (usable.length === 0) {
      setNote("No usable images in there.");
      return;
    }
    const accepted = usable.slice(0, Math.max(0, room));
    const leftOut = usable.length - accepted.length;

    const state = useEditor.getState();
    const sheetId = state.doc?.sheet.id;
    if (!sheetId) return;
    const storage = getStorage();
    const photos: Photo[] = [];

    try {
      for (const [i, file] of accepted.entries()) {
        setBusy(`Adding ${i + 1}/${accepted.length}…`);
        const processed = await processImage(file);
        const stamp = `${Date.now()}-${i}`;
        const storagePath = `${sheetId}/${stamp}-${file.name}`;
        const thumbPath = `${sheetId}/${stamp}-thumb.jpg`;
        await storage.putAsset(storagePath, processed.preview);
        await storage.putAsset(thumbPath, processed.thumb);
        photos.push(
          createPhoto(sheetId, {
            storagePath,
            thumbPath,
            originalFilename: processed.originalFilename,
            mimeType: processed.mimeType,
            width: processed.width,
            height: processed.height,
            rotation: processed.rotation,
            fileSize: processed.fileSize,
          }),
        );
      }
      if (photos.length) useEditor.getState().addPhotos(photos);
      setNote(
        leftOut > 0
          ? `Added ${photos.length}. ${leftOut} left out — a sheet holds ${MAX_PHOTOS_PER_SHEET} frames.`
          : null,
      );
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not add those photographs.");
    } finally {
      setBusy(null);
    }
  }

  const wide = layout === "wide";
  const buttonClass = wide
    ? "flex-1 border border-[var(--line)] px-2 py-1.5 text-[11px] text-smoke transition-colors hover:border-warm hover:text-warm disabled:opacity-35"
    : "h-12 w-12 shrink-0 border border-[var(--line)] text-[10px] leading-tight text-smoke transition-colors hover:border-warm hover:text-warm disabled:opacity-35";

  return (
    <div className={cx("flex flex-col gap-1", wide ? "w-full" : "shrink-0 justify-center pr-2")}>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => filesRef.current?.click()}
          disabled={Boolean(busy) || room <= 0}
          aria-label="Add photos"
          title={room > 0 ? "Add photos" : "This sheet is full"}
          className={buttonClass}
        >
          {wide ? "Add photos" : "+ Photos"}
        </button>
        <button
          type="button"
          onClick={() => folderRef.current?.click()}
          disabled={Boolean(busy) || room <= 0}
          aria-label="Add a folder of photos"
          title={room > 0 ? "Add a folder of photos" : "This sheet is full"}
          className={buttonClass}
        >
          {wide ? "Add folder" : "+ Folder"}
        </button>
      </div>
      <span className={cx("label truncate", wide ? "" : "max-w-[104px]")} role="status">
        {busy ?? note ?? `${Math.max(0, room)} of ${MAX_PHOTOS_PER_SHEET} free`}
      </span>

      <input
        ref={filesRef}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void ingest(files);
        }}
      />
      <input
        ref={folderRef}
        type="file"
        multiple
        className="sr-only"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {...({ webkitdirectory: "", directory: "" } as any)}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void ingest(files);
        }}
      />
    </div>
  );
}

/** Compact strip for jumping between frames, plus the review filter. */
export function FilmstripBar() {
  const doc = useEditor((s) => s.doc);
  const urls = useEditor((s) => s.urls);
  const selected = useEditor((s) => s.selectedPhotoId);
  const filter = useEditor((s) => s.filter);
  const setFilter = useEditor((s) => s.setFilter);
  const selectPhoto = useEditor((s) => s.selectPhoto);
  const stripRef = useRef<HTMLDivElement>(null);

  /* Keep the selected frame in view however it was selected — from the strip,
     from the sheet, or from the keyboard. The arrow keys themselves belong to
     the editor's global handler, so that they work wherever you are looking;
     handling them here as well would step the selection twice. */
  useEffect(() => {
    if (!selected) return;
    const strip = stripRef.current;
    const el = strip?.querySelector<HTMLElement>(`[data-strip-photo="${selected}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    // Carry focus along with the roving tabstop, but only if it was in the
    // strip to begin with — otherwise arrowing would steal it from the sheet.
    if (strip?.contains(document.activeElement)) el.focus();
  }, [selected]);

  if (!doc) return null;
  const counts = doc.photos.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="hair-t shrink-0">
      <div className="hair-b flex items-center gap-3 overflow-x-auto px-3 py-1">
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
            {f.value !== "all" ? (
              <span className="ml-1 opacity-50">{counts[f.value] ?? 0}</span>
            ) : (
              <span className="ml-1 opacity-50">{doc.photos.length}</span>
            )}
          </button>
        ))}
      </div>

      <div
        ref={stripRef}
        className="flex gap-1 overflow-x-auto px-3 py-2 focus:outline-none"
        role="listbox"
        aria-label="Frames"
        aria-activedescendant={selected ? `strip-${selected}` : undefined}
      >
        <AddPhotos count={doc.photos.length} />
        {filteredPhotos(doc, filter).map((photo) => {
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
              // Roving tabstop: one stop for the whole strip, then arrow keys.
              tabIndex={isSelected || (!selected && photo.position === 0) ? 0 : -1}
              onClick={() => selectPhoto(photo.id)}
              title={`${photo.frameNumber || "—"} ${photo.title || photo.originalFilename}`}
              className={cx(
                "relative h-12 w-[68px] shrink-0 overflow-hidden border bg-black transition-colors",
                isSelected ? "border-warm" : "border-transparent hover:border-smoke",
                photo.hidden && "opacity-35",
              )}
            >
              {url ? (
                <img src={url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="label absolute inset-0 grid place-items-center">—</span>
              )}
              <span className="absolute bottom-0 left-0 bg-black/75 px-1 text-[9px] text-bone">
                {photo.frameNumber || "–"}
              </span>
              {photo.status !== "unflagged" ? (
                <span
                  className="absolute right-0.5 top-0 text-[13px] leading-none text-darkroom"
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
