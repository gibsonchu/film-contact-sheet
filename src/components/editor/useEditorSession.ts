"use client";

import { useEffect } from "react";
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

/**
 * Everything the editor does before a single panel is drawn: load the sheet,
 * guard unsaved work, and own the keyboard. Both the panelled layout and the
 * dock layout mount this, so the two never drift apart on behaviour — they
 * differ only in where the controls sit.
 */
export function useEditorSession(sheetId: string) {
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

}
