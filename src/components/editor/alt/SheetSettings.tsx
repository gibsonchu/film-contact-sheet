"use client";

import { useEffect, useRef, useState } from "react";
import { SheetInspector } from "../Inspector";
import { IconGear } from "@/components/icons";
import { cx } from "@/components/ui/primitives";
import { useEditor } from "@/lib/store/editor";

/**
 * What the sheet is, at the head of the left-hand column: its name, how it is
 * doing, and a disclosure holding everything that shapes it — template,
 * layout, what gets printed, the roll's details.
 *
 * Nothing here belongs to a single photograph. Frame-level things live on the
 * dock at the bottom, next to the hand doing the work.
 */
export function SheetSettings() {
  const doc = useEditor((s) => s.doc);
  const saveState = useEditor((s) => s.saveState);
  const dirty = useEditor((s) => s.dirty);
  const updateSheet = useEditor((s) => s.updateSheet);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  /* Click away or press Escape and the settings fold back up. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      // The template dropdown (and anything else that renders its options
      // into a portal) paints outside this panel's own DOM subtree even
      // while logically part of it — without this, choosing an option read
      // as a click outside, and closed the panel out from under the click
      // before it could land.
      if (target instanceof Element && target.closest("[data-floating-content]")) return;
      setOpen(false);
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
    <div ref={panelRef} className="relative">
      <div className="flex items-center gap-1">
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
          <IconGear className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="label truncate">
        {doc.photos.length} frames · {save[saveState] ?? save.idle}
      </p>

      {/* Floated clear of the column so a long settings list is not trapped
          inside it, and so the roll underneath stays where it was. */}
      {open ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-40 max-h-[70vh] w-[248px] space-y-3 overflow-y-auto border border-[var(--line)] bg-noir p-3">
          <SheetInspector />
        </div>
      ) : null}
    </div>
  );
}
