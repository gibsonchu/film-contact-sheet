"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BottomDock } from "./BottomDock";
import { PhotoSidebar } from "./PhotoSidebar";
import { CanvasStage } from "../CanvasStage";
import { ExportDialog } from "../ExportDialog";
import { useEditorSession } from "../useEditorSession";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button, IconButton } from "@/components/ui/primitives";
import { IconRedo, IconUndo, IconZoomIn, IconZoomOut } from "@/components/icons";
import { computeLayout } from "@/lib/layout";
import { useEditor } from "@/lib/store/editor";

/**
 * The same editor with the furniture moved: the sheet's own settings in the
 * top-left corner, the roll down the left-hand side the way Preview lists
 * pages, and the tools on the desk in front of you instead of stood up at the
 * side of it.
 *
 * The canvas runs full-bleed underneath all of it, so the contact sheet is the
 * page and everything else floats over it.
 */
export function AltEditorScreen({ sheetId }: { sheetId: string }) {
  const doc = useEditor((s) => s.doc);
  const loading = useEditor((s) => s.loading);
  const loadError = useEditor((s) => s.loadError);
  const dirty = useEditor((s) => s.dirty);
  const sheetFullscreen = useEditor((s) => s.sheetFullscreen);
  const [showExport, setShowExport] = useState(false);

  useEditorSession(sheetId);

  const layout = useMemo(() => {
    if (!doc) return null;
    return computeLayout({
      templateId: doc.sheet.templateId,
      templateSettings: doc.sheet.templateSettings,
      photos: doc.photos,
    });
  }, [doc]);

  if (loading) return <Centered>Loading the roll…</Centered>;

  if (loadError || !doc || !layout) {
    return (
      <Centered>
        <p className="mb-4 max-w-sm text-center text-[12px] text-bone">
          {loadError ?? "Sheet not found."}
        </p>
        <div className="flex gap-2">
          <Link href="/projects">
            <Button variant="outline">All sheets</Button>
          </Link>
          <Link href="/new">
            <Button variant="primary">New contact sheet</Button>
          </Link>
        </div>
      </Centered>
    );
  }

  return (
    <div className="editor-shell flex h-dvh overflow-hidden bg-noir">
      {sheetFullscreen ? null : <PhotoSidebar />}

      <main id="main" className="relative flex min-w-0 flex-1 flex-col">
        {/* Leave room for the actions above and the dock below, so the sheet
            is centred in what you can see rather than under the furniture. */}
        <CanvasStage
          layout={layout}
          insets={sheetFullscreen ? undefined : { top: 52, bottom: 96 }}
        />

        {sheetFullscreen ? (
          <p className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 text-[10px] uppercase tracking-[0.18em] text-smoke/70">
            F or Esc to exit · ←/→ to review
          </p>
        ) : (
          <>
            <BackLink />
            <ActionBar onExport={() => setShowExport(true)} />
            <BottomDock />
          </>
        )}

        <ViewControls />
      </main>

      <ExportDialog open={showExport} onClose={() => setShowExport(false)} />

      <span className="sr-only" role="status" aria-live="polite">
        {dirty ? "Unsaved changes" : "All changes saved"}
      </span>
    </div>
  );
}

/** The way out, top left of the canvas — out of the way of the sheet itself. */
function BackLink() {
  return (
    <Link
      href="/projects"
      className="pill pointer-events-auto absolute left-3 top-3 z-30 px-3 py-1.5 text-[12px] text-bone transition-colors hover:text-warm"
    >
      ‹ All sheets
    </Link>
  );
}

/** Undo and the way to print it — top right, out of the way. */
function ActionBar({ onExport }: { onExport: () => void }) {
  const doc = useEditor((s) => s.doc);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const past = useEditor((s) => s.past.length);
  const future = useEditor((s) => s.future.length);
  if (!doc) return null;

  return (
    <div className="pointer-events-auto absolute right-3 top-3 z-30 flex items-center gap-2">
      <div className="pill flex items-center px-0.5 py-0.5">
        <ThemeToggle />
      </div>

      <div className="pill flex items-center px-1 py-0.5">
        <IconButton label="Undo (⌘Z)" onClick={undo} disabled={past === 0}>
          <IconUndo className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton label="Redo (⇧⌘Z)" onClick={redo} disabled={future === 0}>
          <IconRedo className="h-3.5 w-3.5" />
        </IconButton>
      </div>

      <Button variant="primary" size="sm" onClick={onExport}>
        Export
      </Button>
    </div>
  );
}

function ViewControls() {
  const step = (factor: number) => {
    const state = useEditor.getState();
    state.setZoom(state.zoom * factor);
  };
  return (
    <div className="pointer-events-none absolute bottom-4 right-3 z-30 flex gap-1">
      <div className="pill pointer-events-auto flex px-0.5">
        <IconButton label="Zoom out" onClick={() => step(1 / 1.2)}>
          <IconZoomOut className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton label="Zoom in" onClick={() => step(1.2)}>
          <IconZoomIn className="h-3.5 w-3.5" />
        </IconButton>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-noir p-6">
      <div className="flex flex-col items-center">{children}</div>
    </div>
  );
}
