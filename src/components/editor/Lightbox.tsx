"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconFit, IconStar, IconZoomIn, IconZoomOut } from "@/components/icons";
import { IconButton, Segmented, cx } from "@/components/ui/primitives";
import { useEditor } from "@/lib/store/editor";
import type { ReviewStatus } from "@/lib/types";

const STATUS_KEYS: Record<string, ReviewStatus> = {
  f: "favorite",
  s: "selected",
  m: "maybe",
  x: "rejected",
  u: "unreviewed",
};

export function Lightbox() {
  const doc = useEditor((s) => s.doc);
  const urls = useEditor((s) => s.urls);
  const photoId = useEditor((s) => s.lightboxPhotoId);
  const close = useCallback(() => useEditor.getState().openLightbox(null), []);
  const step = useEditor((s) => s.stepLightbox);
  const setStatus = useEditor((s) => s.setStatus);
  const updatePhoto = useEditor((s) => s.updatePhoto);
  const readOnly = useEditor((s) => s.readOnly);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const photo = doc?.photos.find((p) => p.id === photoId) ?? null;

  // Moving to another frame resets the view, derived during render rather than
  // in an effect so there is never a frame shown at the previous zoom.
  const [viewedPhotoId, setViewedPhotoId] = useState(photoId);
  if (viewedPhotoId !== photoId) {
    setViewedPhotoId(photoId);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  useEffect(() => {
    if (!photoId) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && ["INPUT", "TEXTAREA"].includes(el.tagName)) return;
      switch (e.key) {
        case "Escape":
          close();
          break;
        case "ArrowLeft":
          step(-1);
          break;
        case "ArrowRight":
          step(1);
          break;
        case "+":
        case "=":
          setZoom((z) => Math.min(8, z * 1.25));
          break;
        case "-":
          setZoom((z) => Math.max(1, z / 1.25));
          break;
        case "0":
          setZoom(1);
          setPan({ x: 0, y: 0 });
          break;
        case " ":
          e.preventDefault();
          setSpaceDown(true);
          break;
        case "Enter":
          void toggleFullscreen();
          break;
        default: {
          const status = STATUS_KEYS[e.key.toLowerCase()];
          if (status && photoId && !readOnly) {
            e.preventDefault();
            setStatus(photoId, status);
          }
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") setSpaceDown(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("keyup", onKeyUp);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("keyup", onKeyUp);
    };
  }, [photoId, close, step, setStatus, readOnly]);

  async function toggleFullscreen() {
    const el = shellRef.current;
    if (!el) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await el.requestFullscreen().catch(() => undefined);
  }

  if (!photo || !doc) return null;
  const url = urls[photo.storagePath] ?? urls[photo.thumbPath] ?? "";
  const visible = doc.photos.filter((p) => !p.hidden);
  const index = visible.findIndex((p) => p.id === photo.id);

  return (
    <div
      ref={shellRef}
      className="fixed inset-0 z-40 flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label={`Frame ${photo.frameNumber}${photo.title ? `: ${photo.title}` : ""}`}
    >
      <header className="flex items-center gap-3 border-b border-white/8 px-4 py-2.5">
        <span className="font-sans text-[13px] tracking-[0.2em] text-grease">
          {String(photo.frameNumber).padStart(2, "0")}
        </span>
        <input
          value={photo.title}
          disabled={readOnly}
          placeholder="Untitled frame"
          aria-label="Frame title"
          onChange={(e) => updatePhoto(photo.id, { title: e.target.value })}
          className="min-w-0 flex-1 border-none bg-transparent text-[15px] text-warm outline-none focus:bg-white/5 focus:px-2"
        />
        <span className="label hidden sm:inline">
          {index + 1} / {visible.length}
        </span>
        <IconButton label="Zoom out (−)" onClick={() => setZoom((z) => Math.max(1, z / 1.25))}>
          <IconZoomOut className="h-4 w-4" />
        </IconButton>
        <IconButton
          label="Fit to screen (0)"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          <IconFit className="h-4 w-4" />
        </IconButton>
        <IconButton label="Zoom in (+)" onClick={() => setZoom((z) => Math.min(8, z * 1.25))}>
          <IconZoomIn className="h-4 w-4" />
        </IconButton>
        <IconButton label="Fullscreen (Enter)" onClick={toggleFullscreen}>
          <IconStar className="h-4 w-4" />
        </IconButton>
        <button
          type="button"
          onClick={close}
          className="label px-2 py-1 hover:text-warm"
          aria-label="Close viewer (Escape)"
        >
          Close ✕
        </button>
      </header>

      <div
        className="relative flex-1 overflow-hidden"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        onPointerDown={(e) => {
          if (zoom <= 1 && !spaceDown) return;
          setPanning(true);
          dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = dragRef.current;
          if (!d || !panning) return;
          setPan({ x: d.px + (e.clientX - d.x), y: d.py + (e.clientY - d.y) });
        }}
        onPointerUp={() => {
          setPanning(false);
          dragRef.current = null;
        }}
        style={{ cursor: zoom > 1 || spaceDown ? (panning ? "grabbing" : "grab") : "zoom-in" }}
      >
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          {url ? (
            <img
              src={url}
              alt={photo.title || photo.originalFilename || `Frame ${photo.frameNumber}`}
              className="max-h-full max-w-full object-contain shadow-[0_20px_80px_rgba(0,0,0,0.8)]"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${photo.rotation}deg)`,
                transition: panning ? "none" : "transform 120ms ease-out",
              }}
            />
          ) : (
            <span className="label">Image unavailable</span>
          )}
        </div>

        <NavButton side="left" onClick={() => step(-1)} />
        <NavButton side="right" onClick={() => step(1)} />
      </div>

      <footer className="flex flex-wrap items-center gap-4 border-t border-white/8 px-4 py-3">
        <div className="min-w-[180px] flex-1">
          <Segmented
            label="Review status"
            value={photo.status}
            onChange={(v) => !readOnly && setStatus(photo.id, v)}
            options={[
              { value: "unreviewed", label: "None (U)" },
              { value: "favorite", label: "Fav (F)" },
              { value: "selected", label: "Sel (S)" },
              { value: "maybe", label: "Maybe (M)" },
              { value: "rejected", label: "Rej (X)" },
            ]}
          />
        </div>
        <input
          value={photo.caption}
          disabled={readOnly}
          placeholder="Caption…"
          aria-label="Caption"
          onChange={(e) => updatePhoto(photo.id, { caption: e.target.value })}
          className="min-w-[160px] flex-1 border border-white/10 bg-black/40 px-2 py-1.5 text-[13px] text-warm outline-none focus:border-grease/60"
        />
        <span className="label hidden lg:inline">
          ← → navigate · F S M X status · +/− zoom · space pan · esc close
        </span>
      </footer>
    </div>
  );
}

function NavButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous frame" : "Next frame"}
      className={cx(
        "absolute top-1/2 z-10 grid h-12 w-12 -translate-y-1/2 place-items-center bg-black/50 text-2xl text-bone transition-colors hover:bg-black/80 hover:text-warm",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      {side === "left" ? "‹" : "›"}
    </button>
  );
}
