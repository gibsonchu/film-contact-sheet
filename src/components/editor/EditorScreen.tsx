"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CanvasStage } from "./CanvasStage";
import { ExportDialog } from "./ExportDialog";
import { FilmstripBar } from "./FilmstripBar";
import { Inspector } from "./Inspector";
import { ShareDialog } from "./ShareDialog";
import { ToolRail } from "./ToolRail";
import { TopBar } from "./TopBar";
import { Button, IconButton } from "@/components/ui/primitives";
import { IconFit, IconRedo, IconUndo, IconZoomIn, IconZoomOut } from "@/components/icons";
import { computeLayout } from "@/lib/layout";
import { useEditor, type ToolId } from "@/lib/store/editor";
import type { ReviewStatus } from "@/lib/types";

/** Review shortcuts — the four judgements, on the letters that name them. */
export const STATUS_KEYS: Record<string, ReviewStatus> = {
  p: "pick",
  m: "maybe",
  x: "reject",
  u: "unflagged",
};

/**
 * The browser's own fullscreen is a nicety on top of our sheet-fullscreen mode:
 * if it is refused, the panels still fold away and the sheet still fills the
 * window, so there is nothing worth reporting when it fails.
 */
async function enterBrowserFullscreen() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
  } catch {
    /* refused — our own fullscreen mode carries on regardless */
  }
}

async function exitBrowserFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    /* nothing useful to say about it */
  }
}

/**
 * Tool shortcuts. B and the Marks key reach for whichever instrument is
 * currently loaded in that family rather than a fixed tool, which is why they
 * are resolved from the store instead of listed here.
 */
const SHORTCUT_TOOLS: Record<string, ToolId> = {
  v: "select",
  h: "pan",
  e: "eraser",
  t: "text",
};

export function EditorScreen({ sheetId }: { sheetId: string }) {
  const doc = useEditor((s) => s.doc);
  const loading = useEditor((s) => s.loading);
  const loadError = useEditor((s) => s.loadError);
  const dirty = useEditor((s) => s.dirty);
  const sheetFullscreen = useEditor((s) => s.sheetFullscreen);
  const showRail = useEditor((s) => s.showRail);
  const showInspector = useEditor((s) => s.showInspector);
  const showFilmstrip = useEditor((s) => s.showFilmstrip);
  const [showExport, setShowExport] = useState(false);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    void useEditor.getState().loadDocument(sheetId);
  }, [sheetId]);

  /* Warn before losing unsaved work. */
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!useEditor.getState().dirty) return;
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  /* Global keyboard shortcuts. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      if (el?.isContentEditable) return;
      const state = useEditor.getState();
      const meta = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (meta && key === "z") {
        e.preventDefault();
        if (e.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (meta && key === "s") {
        e.preventDefault();
        void state.save();
        return;
      }
      if (meta) return;

      if (e.key === "Escape") {
        // Escape backs out of fullscreen first, then out of the selection.
        if (state.sheetFullscreen) {
          state.setSheetFullscreen(false);
          if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
          return;
        }
        state.selectAnnotation(null);
        state.selectPhoto(null);
        return;
      }
      if ((e.key === "Backspace" || e.key === "Delete") && state.selectedAnnotationId) {
        e.preventDefault();
        state.deleteAnnotation(state.selectedAnnotationId);
        return;
      }

      // Fullscreen shows the whole contact sheet, never one photograph.
      if (key === "f") {
        e.preventDefault();
        const next = !state.sheetFullscreen;
        state.setSheetFullscreen(next);
        void (next ? enterBrowserFullscreen() : exitBrowserFullscreen());
        return;
      }

      // Zoom applies to the sheet as a whole.
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        state.setZoom(state.zoom * 1.2);
        return;
      }
      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        state.setZoom(state.zoom / 1.2);
        return;
      }
      if (e.key === "0") {
        e.preventDefault();
        state.requestFit();
        return;
      }

      // Arrow keys walk the frames of the sheet, wherever the focus happens to be.
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        state.stepSelection(1);
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        state.stepSelection(-1);
        return;
      }

      if (state.selectedPhotoId) {
        const status = STATUS_KEYS[key];
        if (status) {
          e.preventDefault();
          state.setStatus(state.selectedPhotoId, status);
          return;
        }
      }

      if (key === "b") {
        e.preventDefault();
        state.setTool(state.instrument);
        return;
      }
      const tool = SHORTCUT_TOOLS[key];
      if (tool) {
        e.preventDefault();
        state.setTool(tool);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /* Leaving browser fullscreen by any other route should leave our own too. */
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement && useEditor.getState().sheetFullscreen) {
        useEditor.getState().setSheetFullscreen(false);
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const layout = useMemo(() => {
    if (!doc) return null;
    return computeLayout({
      templateId: doc.sheet.templateId,
      templateSettings: doc.sheet.templateSettings,
      photos: doc.photos,
    });
  }, [doc]);

  if (loading) {
    return <Centered>Loading the roll…</Centered>;
  }

  if (loadError || !doc || !layout) {
    return (
      <Centered>
        <p className="mb-4 max-w-sm text-center text-[12px] text-bone">{loadError ?? "Sheet not found."}</p>
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
    <div className="editor-shell flex h-dvh flex-col overflow-hidden bg-noir">
      {sheetFullscreen ? null : (
        <TopBar onExport={() => setShowExport(true)} onShare={() => setShowShare(true)} />
      )}

      <div className="flex min-h-0 flex-1">
        {showRail && !sheetFullscreen ? (
          <div className="hidden sm:block">
            <ToolRail />
          </div>
        ) : null}

        <main id="main" className="relative flex min-w-0 flex-1 flex-col">
          <div className="relative flex min-h-0 flex-1 flex-col">
            <CanvasStage layout={layout} />
            <ViewControls />
            {sheetFullscreen ? (
              <FullscreenHint />
            ) : (
              <>
                <PanelToggle side="left" open={showRail} />
                <PanelToggle side="right" open={showInspector} />
                <PanelToggle side="bottom" open={showFilmstrip} />
              </>
            )}
          </div>
          {showFilmstrip && !sheetFullscreen ? <FilmstripBar /> : null}
        </main>

        {showInspector && !sheetFullscreen ? <Inspector /> : null}
      </div>

      {sheetFullscreen ? null : <MobileToolbar />}

      <ExportDialog open={showExport} onClose={() => setShowExport(false)} />
      <ShareDialog open={showShare} onClose={() => setShowShare(false)} />

      <span className="sr-only" role="status" aria-live="polite">
        {dirty ? "Unsaved changes" : "All changes saved"}
      </span>
    </div>
  );
}

/** A quiet reminder of the way out, since the chrome is gone. */
function FullscreenHint() {
  return (
    <p className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 text-[10px] uppercase tracking-[0.18em] text-smoke/70">
      F or Esc to exit · ←/→ to review
    </p>
  );
}

function ViewControls() {
  const requestFit = useEditor((s) => s.requestFit);
  // Each step reads the live zoom so a rapid burst of clicks compounds properly
  // instead of every click starting from the same rendered value.
  const step = (factor: number) => {
    const state = useEditor.getState();
    state.setZoom(state.zoom * factor);
  };
  return (
    <div className="pointer-events-none absolute bottom-2 right-2 z-10 flex gap-1">
      <div className="pill pointer-events-auto flex px-0.5">
        <IconButton label="Zoom out" onClick={() => step(1 / 1.2)}>
          <IconZoomOut className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton label="Fit sheet to screen" onClick={requestFit}>
          <IconFit className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton label="Zoom in" onClick={() => step(1.2)}>
          <IconZoomIn className="h-3.5 w-3.5" />
        </IconButton>
      </div>
    </div>
  );
}

/**
 * A chevron on the edge of the working area that folds the panel beside it
 * away. It stays put when the panel is hidden, pointing the other way, so
 * there is always something to click to bring it back.
 */
function PanelToggle({ side, open }: { side: "left" | "right" | "bottom"; open: boolean }) {
  const togglePanel = useEditor((s) => s.togglePanel);
  const panel = side === "left" ? "rail" : side === "right" ? "inspector" : "filmstrip";
  const names = { left: "tools", right: "inspector", bottom: "filmstrip" } as const;

  // The chevron points the way the panel is about to travel: out towards its
  // edge to hide it, back in towards the canvas to bring it out again. The
  // glyph is drawn pointing left, so these are clockwise rotations of that.
  const rotate = {
    left: open ? 0 : 180,
    right: open ? 180 : 0,
    bottom: open ? 270 : 90,
  }[side];

  const place = {
    left: "left-1 top-1/2 -translate-y-1/2",
    right: "right-1 top-1/2 -translate-y-1/2",
    bottom: "bottom-2 left-1/2 -translate-x-1/2",
  }[side];

  return (
    <button
      type="button"
      onClick={() => togglePanel(panel)}
      aria-expanded={open}
      aria-label={`${open ? "Hide" : "Show"} the ${names[side]} panel`}
      title={`${open ? "Hide" : "Show"} the ${names[side]} panel`}
      className={`pill absolute z-10 grid h-5 w-5 place-items-center text-smoke transition-colors hover:text-warm ${place} ${
        side === "bottom" ? "h-4 w-8" : ""
      }`}
    >
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" style={{ transform: `rotate(${rotate}deg)` }} aria-hidden="true">
        <path d="M7.5 2 3.5 6l4 4" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    </button>
  );
}

/** Mobile keeps the essentials: review, quick marks, undo. */
function MobileToolbar() {
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);

  const tools: { id: ToolId; label: string }[] = [
    { id: "select", label: "Select" },
    { id: "pan", label: "Pan" },
    { id: "marker", label: "Draw" },
    { id: "ellipse", label: "Circle" },
    { id: "x", label: "X" },
    { id: "text", label: "Text" },
    { id: "tape", label: "Tape" },
    { id: "eraser", label: "Erase" },
  ];

  return (
    <div className="hair-t flex items-center gap-2 overflow-x-auto px-3 py-2 sm:hidden">
      {tools.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setTool(t.id)}
          aria-pressed={tool === t.id}
          className={`shrink-0 text-[11px] ${tool === t.id ? "text-warm" : "text-smoke"}`}
        >
          {t.label}
        </button>
      ))}
      <div className="flex-1" />
      <IconButton label="Undo" onClick={undo}>
        <IconUndo className="h-4 w-4" />
      </IconButton>
      <IconButton label="Redo" onClick={redo}>
        <IconRedo className="h-4 w-4" />
      </IconButton>
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
