"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CanvasStage } from "./CanvasStage";
import { ExportDialog } from "./ExportDialog";
import { FilmstripBar } from "./FilmstripBar";
import { Inspector } from "./Inspector";
import { Lightbox } from "./Lightbox";
import { ShareDialog } from "./ShareDialog";
import { ToolRail } from "./ToolRail";
import { TopBar } from "./TopBar";
import { Button, IconButton } from "@/components/ui/primitives";
import { IconFit, IconRedo, IconUndo, IconZoomIn, IconZoomOut } from "@/components/icons";
import { computeLayout } from "@/lib/layout";
import { useEditor, type ToolId } from "@/lib/store/editor";

const SHORTCUT_TOOLS: Record<string, ToolId> = {
  v: "select",
  h: "pan",
  g: "grease",
  p: "pen",
  m: "marker",
  e: "eraser",
  o: "ellipse",
  a: "arrow",
  r: "rect",
  c: "crop",
  t: "text",
};

export function EditorScreen({ sheetId }: { sheetId: string }) {
  const doc = useEditor((s) => s.doc);
  const loading = useEditor((s) => s.loading);
  const loadError = useEditor((s) => s.loadError);
  const dirty = useEditor((s) => s.dirty);
  const lightboxPhotoId = useEditor((s) => s.lightboxPhotoId);
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
      const state = useEditor.getState();
      if (state.lightboxPhotoId) return;

      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (meta && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void state.save();
        return;
      }
      if (e.key === "Escape") {
        state.selectAnnotation(null);
        state.selectPhoto(null);
        return;
      }
      if ((e.key === "Backspace" || e.key === "Delete") && state.selectedAnnotationId) {
        e.preventDefault();
        state.deleteAnnotation(state.selectedAnnotationId);
        return;
      }
      if (e.key === "Enter" && state.selectedPhotoId) {
        e.preventDefault();
        state.openLightbox(state.selectedPhotoId);
        return;
      }
      if (state.selectedPhotoId) {
        const map: Record<string, "favorite" | "selected" | "maybe" | "rejected" | "unreviewed"> = {
          f: "favorite",
          s: "selected",
          x: "rejected",
          u: "unreviewed",
        };
        const status = map[e.key.toLowerCase()];
        if (status && !meta) {
          e.preventDefault();
          state.setStatus(state.selectedPhotoId, status);
          return;
        }
      }
      const tool = SHORTCUT_TOOLS[e.key.toLowerCase()];
      if (tool && !meta) {
        e.preventDefault();
        state.setTool(tool);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
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
        <p className="mb-4 max-w-sm text-center text-sm text-bone">{loadError ?? "Sheet not found."}</p>
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
      <TopBar onExport={() => setShowExport(true)} onShare={() => setShowShare(true)} />

      <div className="flex min-h-0 flex-1">
        <div className="hidden sm:block">
          <ToolRail />
        </div>

        <main id="main" className="relative flex min-w-0 flex-1 flex-col">
          <CanvasStage layout={layout} />
          <ViewControls />
          <FilmstripBar />
        </main>

        <Inspector />
      </div>

      <MobileToolbar />

      {lightboxPhotoId ? <Lightbox /> : null}
      <ExportDialog open={showExport} onClose={() => setShowExport(false)} />
      <ShareDialog open={showShare} onClose={() => setShowShare(false)} />

      <span className="sr-only" role="status" aria-live="polite">
        {dirty ? "Unsaved changes" : "All changes saved"}
      </span>
    </div>
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
    <div className="pointer-events-none absolute bottom-3 right-3 z-10 flex gap-1">
      <div className="pointer-events-auto flex border border-white/10 bg-charcoal/90">
        <IconButton label="Zoom out" onClick={() => step(1 / 1.2)}>
          <IconZoomOut className="h-4 w-4" />
        </IconButton>
        <IconButton label="Fit sheet to screen" onClick={requestFit}>
          <IconFit className="h-4 w-4" />
        </IconButton>
        <IconButton label="Zoom in" onClick={() => step(1.2)}>
          <IconZoomIn className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
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
    { id: "grease", label: "Grease" },
    { id: "ellipse", label: "Circle" },
    { id: "x", label: "X" },
    { id: "text", label: "Text" },
    { id: "tape", label: "Tape" },
    { id: "eraser", label: "Erase" },
  ];

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-t border-white/8 bg-charcoal px-2 py-2 sm:hidden">
      {tools.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setTool(t.id)}
          aria-pressed={tool === t.id}
          className={`shrink-0 px-2.5 py-1.5 text-[11px] uppercase tracking-[0.14em] ${
            tool === t.id ? "bg-warm text-noir" : "text-smoke"
          }`}
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
      <div className="sprocket-rail w-40 opacity-30" aria-hidden="true" />
      <div className="flex flex-col items-center">{children}</div>
    </div>
  );
}
