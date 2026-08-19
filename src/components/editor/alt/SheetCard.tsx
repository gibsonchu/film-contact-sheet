"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SheetInspector } from "../Inspector";
import { cx } from "@/components/ui/primitives";
import { useEditor } from "@/lib/store/editor";

/**
 * The sheet itself, top left, the way a document names itself in the corner of
 * a canvas application: title, how it is doing, and a disclosure that drops the
 * whole of the sheet's settings underneath.
 *
 * Nothing here is about a photograph — this is the roll, the template and the
 * printing. Frame-level things belong to the dock at the bottom.
 */
export function SheetCard() {
  const doc = useEditor((s) => s.doc);
  const saveState = useEditor((s) => s.saveState);
  const dirty = useEditor((s) => s.dirty);
  const updateSheet = useEditor((s) => s.updateSheet);
  const [open, setOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  /* Click away or press Escape and the settings fold back up, leaving the
     sheet unobstructed. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!cardRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!doc) return null;

  const save: Record<string, string> = {
    idle: dirty ? "Unsaved" : "Saved",
    saving: "Saving",
    saved: "Saved",
    offline: "Offline",
    error: "Save failed",
  };

  return (
    <div
      ref={cardRef}
      className="pointer-events-auto absolute left-3 top-3 z-30 w-[268px] overflow-hidden rounded-[2px] border border-[var(--line)] bg-charcoal/95 backdrop-blur"
    >
      <div className="flex items-center gap-2 px-2.5 py-2">
        <Link
          href="/projects"
          aria-label="Back to all contact sheets"
          title="All contact sheets"
          className="label shrink-0 hover:text-warm"
        >
          ‹ Sheets
        </Link>
        <input
          value={doc.sheet.title}
          onChange={(e) => updateSheet({ title: e.target.value })}
          aria-label="Contact sheet title"
          placeholder="Untitled"
          className="min-w-0 flex-1 truncate border-none bg-transparent text-[12px] text-warm outline-none placeholder:text-smoke"
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Contact sheet settings"
          title="Contact sheet settings"
          className={cx(
            "grid h-5 w-5 shrink-0 place-items-center transition-colors",
            open ? "text-warm" : "text-smoke hover:text-warm",
          )}
        >
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden="true">
            <path
              d="M2 4.5 6 8.5l4-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              style={{ transform: open ? "rotate(180deg)" : "none", transformOrigin: "center" }}
            />
          </svg>
        </button>
      </div>

      <div className="hair-t flex items-center justify-between px-2.5 py-1.5">
        <span className="label">
          {doc.photos.length} frames · {doc.sheet.rollNumber || "no roll number"}
        </span>
        <span className="label" role="status" aria-live="polite">
          {save[saveState] ?? save.idle}
        </span>
      </div>

      {open ? (
        <div className="hair-t max-h-[min(70vh,620px)] space-y-3 overflow-y-auto p-3">
          <SheetInspector />
        </div>
      ) : null}
    </div>
  );
}
