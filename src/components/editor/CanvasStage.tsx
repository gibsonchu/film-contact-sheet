"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnnotationView, annotationBounds, scaleAnnotation, translateAnnotation } from "@/components/annotations/AnnotationView";
import { SheetSvg } from "@/components/sheet/SheetSvg";
import { annotationAt } from "@/lib/hit";
import { computeLayout, frameSlotAt, type SheetLayout } from "@/lib/layout";
import { FREEHAND_TOOLS } from "@/lib/palette";
import { decimate } from "@/lib/stroke";
import { useEditor, type ToolId } from "@/lib/store/editor";
import { uid } from "@/lib/document";
import type { Annotation, AnnotationTool, Point } from "@/lib/types";

type Drag =
  | { kind: "pan"; startX: number; startY: number; panX: number; panY: number }
  | { kind: "frame"; photoId: string; fromIndex: number; startX: number; startY: number; armed: boolean }
  | { kind: "annotation"; id: string; original: Annotation; startX: number; startY: number }
  | { kind: "resize"; id: string; original: Annotation; originX: number; originY: number; startDist: number }
  | { kind: "draw" }
  | { kind: "erase" };

const DRAG_THRESHOLD = 5;

/** How far past the sheet's edge the view may be pushed, in screen pixels. */
const OVERSCROLL = 72;

/** Eraser reach, in screen pixels — matches the size of its cursor ring. */
const ERASER_SCREEN_RADIUS = 13;

export function CanvasStage({ layout }: { layout: SheetLayout }) {
  const doc = useEditor((s) => s.doc);
  const urls = useEditor((s) => s.urls);
  const tool = useEditor((s) => s.tool);
  const color = useEditor((s) => s.color);
  const strokeWidth = useEditor((s) => s.strokeWidth);
  const opacity = useEditor((s) => s.opacity);
  const tapeKind = useEditor((s) => s.tapeKind);
  const zoom = useEditor((s) => s.zoom);
  const panX = useEditor((s) => s.panX);
  const panY = useEditor((s) => s.panY);
  const fitRequest = useEditor((s) => s.fitRequest);
  const filter = useEditor((s) => s.filter);
  const showGrain = useEditor((s) => s.showGrain);
  const selectedPhotoId = useEditor((s) => s.selectedPhotoId);
  const selectedAnnotationId = useEditor((s) => s.selectedAnnotationId);
  const readOnly = useEditor((s) => s.readOnly);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
  const fittedFor = useRef<string>("");
  /** Cached viewport size so pan clamping never forces a layout read. */
  const viewport = useRef({ w: 0, h: 0 });
  /** The tool to hand back when the space bar is released. */
  const spaceHand = useRef<ToolId | null>(null);

  const [draft, setDraftState] = useState<Annotation | null>(null);
  /** Mirror of the in-progress stroke; the ref is authoritative so a pointerup
      batched with the final move can never drop the stroke. */
  const draftRef = useRef<Annotation | null>(null);
  const setDraft = useCallback((next: Annotation | null | ((prev: Annotation | null) => Annotation | null)) => {
    const value = typeof next === "function" ? next(draftRef.current) : next;
    draftRef.current = value;
    setDraftState(value);
  }, []);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [draggingPhotoId, setDraggingPhotoId] = useState<string | null>(null);
  const [textEditor, setTextEditor] = useState<{
    id: string;
    value: string;
    left: number;
    top: number;
  } | null>(null);

  const dimmed = useMemo(() => {
    if (!doc || filter === "all") return undefined;
    return new Set(doc.photos.filter((p) => p.status !== filter).map((p) => p.id));
  }, [doc, filter]);

  const sortedAnnotations = useMemo(
    () => (doc ? [...doc.annotations].sort((a, b) => a.zIndex - b.zIndex) : []),
    [doc],
  );

  const toSheet = useCallback((clientX: number, clientY: number): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: pt.x, y: pt.y };
  }, []);

  /** Sheet units back to a position within the stage, for the text overlay. */
  const toStage = useCallback((p: Point): { left: number; top: number } => {
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container) return { left: 0, top: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { left: 0, top: 0 };
    const screen = new DOMPoint(p.x, p.y).matrixTransform(ctm);
    const rect = container.getBoundingClientRect();
    return { left: screen.x - rect.left, top: screen.y - rect.top };
  }, []);

  /**
   * Typing happens in a real textarea floated over the sheet — an SVG <text>
   * has no caret or selection of its own. On commit the value is written back
   * to the annotation; an empty one is dropped rather than left as an
   * invisible object you can't find again.
   */
  const openTextEditor = useCallback(
    (id: string, at: Point, value: string) => {
      const { left, top } = toStage(at);
      setTextEditor({ id, value, left, top });
    },
    [toStage],
  );

  /** Fit the sheet to the viewport. */
  const fitToScreen = useCallback(() => {
    const el = containerRef.current;
    if (!el || el.clientWidth < 80 || el.clientHeight < 80) return;
    const pad = 56;
    const z = Math.min(
      (el.clientWidth - pad) / layout.width,
      (el.clientHeight - pad) / layout.height,
    );
    useEditor.setState({ zoom: Math.max(0.06, Math.min(2, z)), panX: 0, panY: 0 });
  }, [layout.width, layout.height]);

  /**
   * The sheet can't be thrown off into empty space: panning stops once the
   * sheet's edge reaches the viewport edge, with a small overscroll so you can
   * still work comfortably right on the margin. When the sheet is smaller than
   * the viewport it stays near the middle.
   */
  const clampPan = useCallback(
    (x: number, y: number, z: number) => {
      const { w, h } = viewport.current;
      if (!w || !h) return { x, y };
      const maxX = Math.max(0, (layout.width * z - w) / 2) + OVERSCROLL;
      const maxY = Math.max(0, (layout.height * z - h) / 2) + OVERSCROLL;
      return {
        x: Math.min(maxX, Math.max(-maxX, x)),
        y: Math.min(maxY, Math.max(-maxY, y)),
      };
    },
    [layout.width, layout.height],
  );

  /* Auto-fit until the photographer takes over the view (any manual zoom or
     pan clears `autoFitView`), and re-fit whenever the sheet's dimensions
     change — template switch, column count, margins. */
  useEffect(() => {
    const key = `${layout.width}x${layout.height}`;
    if (fittedFor.current !== key) {
      fittedFor.current = key;
      useEditor.setState({ autoFitView: true });
    }
    const el = containerRef.current;
    if (!el) return;
    viewport.current = { w: el.clientWidth, h: el.clientHeight };
    if (useEditor.getState().autoFitView) fitToScreen();
    const observer = new ResizeObserver(() => {
      viewport.current = { w: el.clientWidth, h: el.clientHeight };
      if (useEditor.getState().autoFitView) fitToScreen();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [layout.width, layout.height, fitToScreen, fitRequest]);

  /**
   * Bring a frame to the middle of the viewport. The sheet is drawn centred on
   * the origin, so a frame's offset from the sheet's centre, scaled and
   * negated, is the pan that puts it under the eye.
   */
  const centerOnFrame = useCallback(
    (photoId: string) => {
      const frame = layout.frames.find((fr) => fr.photoId === photoId);
      if (!frame) return;
      const z = useEditor.getState().zoom;
      const dx = -(frame.x + frame.width / 2 - layout.width / 2) * z;
      const dy = -(frame.y + frame.height / 2 - layout.height / 2) * z;
      const clamped = clampPan(dx, dy, z);
      useEditor.setState({ panX: clamped.x, panY: clamped.y, autoFitView: false });
    },
    [layout, clampPan],
  );

  /* Arrowing through the roll can walk the selection off-screen; when it does,
     bring the sheet along so the frame under review is always visible. */
  useEffect(() => {
    if (!selectedPhotoId) return;
    const el = containerRef.current;
    const frame = layout.frames.find((fr) => fr.photoId === selectedPhotoId);
    if (!el || !frame) return;
    const z = useEditor.getState().zoom;
    const cx = el.clientWidth / 2 + useEditor.getState().panX + (frame.x + frame.width / 2 - layout.width / 2) * z;
    const cy = el.clientHeight / 2 + useEditor.getState().panY + (frame.y + frame.height / 2 - layout.height / 2) * z;
    const margin = 24;
    const outside =
      cx < margin ||
      cy < margin ||
      cx > el.clientWidth - margin ||
      cy > el.clientHeight - margin;
    if (outside) centerOnFrame(selectedPhotoId);
  }, [selectedPhotoId, layout, centerOnFrame]);

  /* Holding space borrows the hand, as it does everywhere else that pans. */
  useEffect(() => {
    const isTyping = (el: EventTarget | null) => {
      const node = el as HTMLElement | null;
      return Boolean(
        node && (["INPUT", "TEXTAREA", "SELECT"].includes(node.tagName) || node.isContentEditable),
      );
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || isTyping(e.target)) return;
      e.preventDefault();
      const state = useEditor.getState();
      if (state.tool === "pan") return;
      spaceHand.current = state.tool;
      state.setTool("pan");
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !spaceHand.current) return;
      useEditor.getState().setTool(spaceHand.current);
      spaceHand.current = null;
    };
    // Losing focus mid-pan would otherwise strand us in the hand tool.
    const onBlur = () => {
      if (spaceHand.current) {
        useEditor.getState().setTool(spaceHand.current);
        spaceHand.current = null;
      }
    };
    document.addEventListener("keydown", onDown);
    document.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("keydown", onDown);
      document.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  /* Catch-all: zooming out, pinching or a window resize can leave the sheet
     outside the bounds a drag would have respected, so pull it back. */
  useEffect(() => {
    const clamped = clampPan(panX, panY, zoom);
    if (clamped.x !== panX || clamped.y !== panY) {
      useEditor.setState({ panX: clamped.x, panY: clamped.y });
    }
  }, [panX, panY, zoom, clampPan]);

  /* ------------------------------------------------------------ helpers */

  const frameAtPoint = useCallback(
    (p: Point) => layout.frames.find((f) => p.x >= f.x && p.x <= f.x + f.width && p.y >= f.y && p.y <= f.y + f.height) ?? null,
    [layout],
  );

  const anchorFor = useCallback(
    (p: Point) => {
      const frame = frameAtPoint(p);
      if (!frame || !frame.photoId) return { photoId: null, anchor: null };
      return {
        photoId: frame.photoId,
        anchor: {
          x: (p.x - frame.x) / frame.width,
          y: (p.y - frame.y) / frame.height,
          scale: 1,
        },
      };
    },
    [frameAtPoint],
  );

  const makeDraft = useCallback(
    (p: Point, drawTool: AnnotationTool): Annotation => {
      const { photoId, anchor } = anchorFor(p);
      const isFreehand = FREEHAND_TOOLS.includes(drawTool);
      const id = uid("anno");
      return {
        id,
        contactSheetId: doc?.sheet.id ?? "",
        photoId,
        anchor,
        type: isFreehand ? "stroke" : drawTool === "tape" ? "tape" : drawTool === "sticker" ? "sticker" : drawTool === "text" ? "text" : "shape",
        tool: drawTool,
        color,
        strokeWidth,
        opacity,
        tapeKind,
        geometry: isFreehand
          ? { kind: "points", points: [p] }
          : drawTool === "arrow" || drawTool === "line"
            ? { kind: "segment", x1: p.x, y1: p.y, x2: p.x, y2: p.y }
            : { kind: "box", x: p.x, y: p.y, width: 0, height: 0 },
        text: null,
        zIndex: 999,
        locked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    },
    [anchorFor, color, doc?.sheet.id, opacity, strokeWidth, tapeKind],
  );

  /** Places a new, empty piece of text and opens it for typing. */
  const placeText = useCallback(
    (clientX: number, clientY: number) => {
      const state = useEditor.getState();
      if (state.readOnly) return;
      const point = toSheet(clientX, clientY);
      const id = state.addAnnotation(
        stripMeta({
          ...makeDraft(point, "text"),
          geometry: { kind: "box", x: point.x, y: point.y, width: 0, height: 0 },
          text: "",
        }),
      );
      state.selectAnnotation(id);
      openTextEditor(id, point, "");
    },
    [makeDraft, openTextEditor, toSheet],
  );

  /**
   * Erase whatever ink is under the pointer. The reach is a fixed number of
   * *screen* pixels converted into sheet units, so the eraser is as easy to
   * land zoomed out as zoomed in, and it tests the stroke itself rather than
   * its bounding box.
   */
  const eraseAt = useCallback((p: Point) => {
    const state = useEditor.getState();
    const radius = ERASER_SCREEN_RADIUS / Math.max(0.05, state.zoom);
    const hit = annotationAt(state.doc?.annotations ?? [], p, radius);
    if (hit) state.deleteAnnotation(hit.id);
  }, []);

  /* ------------------------------------------------------ pointer events */

  const onPointerDown = (e: React.PointerEvent) => {
    if (!doc) return;
    const target = e.target as Element;
    // Only touch contacts are tracked for pinch; a mouse or pen never pinches,
    // and tracking them risks a stale entry wedging the canvas into pinch mode.
    if (e.pointerType === "touch") pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      dragRef.current = null;
      setDraft(null);
      return;
    }

    // Note: no preventDefault here — that would suppress the compatibility
    // click/dblclick events the frame viewer relies on. Text selection is
    // handled with `user-select: none` on the canvas instead.
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* capture is best-effort; synthetic pointers can't be captured */
    }
    const p = toSheet(e.clientX, e.clientY);

    if (tool === "pan" || e.button === 1) {
      dragRef.current = { kind: "pan", startX: e.clientX, startY: e.clientY, panX, panY };
      return;
    }

    if (!readOnly) {
      if (handleEditingTools(e, p)) return;
    }

    // select / read-only path
    const annoEl = target.closest("[data-annotation-id]");
    const handle = target.closest("[data-resize-handle]");
    if (!readOnly && handle && selectedAnnotationId) {
      const original = doc.annotations.find((a) => a.id === selectedAnnotationId);
      const bounds = original ? annotationBounds(original) : null;
      if (original && bounds) {
        dragRef.current = {
          kind: "resize",
          id: original.id,
          original,
          originX: bounds.x,
          originY: bounds.y,
          startDist: Math.max(8, Math.hypot(p.x - bounds.x, p.y - bounds.y)),
        };
        return;
      }
    }
    if (!readOnly && annoEl) {
      const id = annoEl.getAttribute("data-annotation-id")!;
      const original = doc.annotations.find((a) => a.id === id);
      if (original && !original.locked) {
        useEditor.getState().selectAnnotation(id);
        dragRef.current = { kind: "annotation", id, original, startX: p.x, startY: p.y };
        return;
      }
    }

    const frameEl = target.closest("[data-frame-index]");
    if (frameEl) {
      const photoId = frameEl.getAttribute("data-photo-id") || "";
      if (photoId) {
        // Clicking a photograph selects its frame within the sheet, and that is
        // all it does — there is no enlarged single-photo view in a review tool.
        useEditor.getState().selectPhoto(photoId);
        if (!readOnly) {
          const fromIndex = doc.photos.findIndex((ph) => ph.id === photoId);
          dragRef.current = {
            kind: "frame",
            photoId,
            fromIndex,
            startX: e.clientX,
            startY: e.clientY,
            armed: false,
          };
        }
        return;
      }
    }

    useEditor.getState().selectPhoto(null);
    useEditor.getState().selectAnnotation(null);
    dragRef.current = { kind: "pan", startX: e.clientX, startY: e.clientY, panX, panY };
  };

  /** Editing tools; returns true when the event was consumed. */
  function handleEditingTools(e: React.PointerEvent, p: Point): boolean {
    if (tool === "eraser") {
      dragRef.current = { kind: "erase" };
      eraseAt(p);
      return true;
    }

    // Text is placed on click rather than here — see placeText. Consuming the
    // press stops it arming a pan on the way.
    if (tool === "text") return true;

    if (tool === "tape" || tool === "sticker") {
      const isTape = tool === "tape";
      const w = isTape ? 150 : 30;
      const h = isTape ? 40 : 30;
      useEditor.getState().addAnnotation(
        stripMeta({
          ...makeDraft(p, tool),
          geometry: {
            kind: "box",
            x: p.x - w / 2,
            y: p.y - h / 2,
            width: w,
            height: h,
            rotation: isTape ? -4 + Math.random() * 8 : 0,
          },
          text: null,
        }),
      );
      useEditor.getState().setTool("select");
      return true;
    }

    if (isDrawTool(tool)) {
      const d = makeDraft(p, tool as AnnotationTool);
      if (FREEHAND_TOOLS.includes(tool as AnnotationTool)) {
        d.geometry = { kind: "points", points: [{ ...p, p: e.pressure || 0.5 }] };
      }
      setDraft(d);
      dragRef.current = { kind: "draw" };
      return true;
    }

    return false;
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === "touch" && pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (pointers.current.size === 2 && pinchRef.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      useEditor.getState().setZoom((pinchRef.current.zoom * dist) / pinchRef.current.dist);
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;
    const p = toSheet(e.clientX, e.clientY);

    switch (drag.kind) {
      case "pan": {
        // Live zoom, not the render-time value: a wheel or button zoom part-way
        // through a drag must widen or tighten the bounds immediately.
        const next = clampPan(
          drag.panX + (e.clientX - drag.startX),
          drag.panY + (e.clientY - drag.startY),
          useEditor.getState().zoom,
        );
        useEditor.setState({ panX: next.x, panY: next.y, autoFitView: false });
        break;
      }
      case "erase":
        eraseAt(p);
        break;
      case "draw":
        setDraft((prev) => (prev ? extendDraft(prev, p, e.pressure || 0.5) : prev));
        break;
      case "annotation": {
        const dx = p.x - drag.startX;
        const dy = p.y - drag.startY;
        const moved = translateAnnotation(drag.original, dx, dy);
        useEditor.getState().updateAnnotation(drag.id, { geometry: moved.geometry });
        break;
      }
      case "resize": {
        const dist = Math.hypot(p.x - drag.originX, p.y - drag.originY);
        const factor = Math.max(0.15, Math.min(8, dist / drag.startDist));
        const scaled = scaleAnnotation(drag.original, factor, drag.originX, drag.originY);
        useEditor.getState().updateAnnotation(drag.id, {
          geometry: scaled.geometry,
          strokeWidth: scaled.strokeWidth,
        });
        break;
      }
      case "frame": {
        const dist = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
        if (!drag.armed && dist < DRAG_THRESHOLD) break;
        drag.armed = true;
        setDraggingPhotoId(drag.photoId);
        const slot = frameSlotAt(layout, p.x, p.y);
        setDropIndex(slot ? slot.index : null);
        break;
      }
    }
  };

  const endDrag = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchRef.current = null;
    const drag = dragRef.current;
    dragRef.current = null;

    if (drag?.kind === "draw" && draftRef.current) {
      const finished = finalizeDraft(draftRef.current);
      if (finished) useEditor.getState().addAnnotation(stripMeta(finished));
      setDraft(null);
    }

    if (drag?.kind === "frame" && drag.armed && dropIndex !== null) {
      const state = useEditor.getState();
      const target = layout.frames[dropIndex];
      if (target) {
        const targetPhotoId = target.photoId;
        const toIndex = targetPhotoId
          ? state.doc!.photos.findIndex((ph) => ph.id === targetPhotoId)
          : state.doc!.photos.length - 1;
        if (e.shiftKey) state.swapPhotos(drag.fromIndex, toIndex);
        else state.movePhoto(drag.fromIndex, toIndex);
      }
    }

    setDraggingPhotoId(null);
    setDropIndex(null);
  };

  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      const before = toSheet(e.clientX, e.clientY);
      const next = Math.max(0.08, Math.min(4, zoom * (1 - e.deltaY * 0.0016)));
      useEditor.getState().setZoom(next);
      // keep the point under the cursor stable
      requestAnimationFrame(() => {
        const after = toSheet(e.clientX, e.clientY);
        const state = useEditor.getState();
        const moved = clampPan(
          state.panX + (after.x - before.x) * next,
          state.panY + (after.y - before.y) * next,
          next,
        );
        useEditor.setState({ panX: moved.x, panY: moved.y, autoFitView: false });
      });
      return;
    }
    const state = useEditor.getState();
    const scrolled = clampPan(state.panX - e.deltaX, state.panY - e.deltaY, state.zoom);
    useEditor.setState({ panX: scrolled.x, panY: scrolled.y, autoFitView: false });
  };

  function commitText() {
    if (!textEditor) return;
    const state = useEditor.getState();
    const value = textEditor.value.trim();
    if (value === "") state.deleteAnnotation(textEditor.id);
    else state.updateAnnotation(textEditor.id, { text: textEditor.value });
    setTextEditor(null);
  }

  if (!doc) return null;

  const selectedAnnotation = doc.annotations.find((a) => a.id === selectedAnnotationId) ?? null;
  const selectionBounds = selectedAnnotation ? annotationBounds(selectedAnnotation) : null;

  return (
    <div
      ref={containerRef}
      className="sheet-canvas relative flex-1 overflow-hidden bg-noir"
      onWheel={onWheel}
      data-testid="canvas-stage"
    >
      <div
        className="absolute left-1/2 top-1/2 origin-center"
        style={{
          transform: `translate(-50%, -50%) translate(${panX}px, ${panY}px) scale(${zoom})`,
        }}
      >
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClick={(e) => {
            if (tool === "text" && !readOnly && !textEditor) {
              placeText(e.clientX, e.clientY);
            }
          }}
          onDoubleClick={(e) => {
            const state = useEditor.getState();

            // Hit-test by geometry rather than by event target: the first of the
            // two clicks re-renders the mark it selected, so the browser reports
            // the dblclick against their common ancestor instead of the mark.
            const point = toSheet(e.clientX, e.clientY);
            const hit = annotationAt(
              state.doc?.annotations ?? [],
              point,
              6 / Math.max(0.05, state.zoom),
            );
            if (!readOnly && hit && hit.type === "text" && hit.geometry.kind === "box") {
              state.selectAnnotation(hit.id);
              openTextEditor(hit.id, { x: hit.geometry.x, y: hit.geometry.y }, hit.text ?? "");
              return;
            }

            // Otherwise centre the frame that was double-clicked, which is the
            // review equivalent of pulling the sheet over to look closer.
            const frameEl = (e.target as Element).closest("[data-frame-index]");
            const photoId = frameEl?.getAttribute("data-photo-id");
            if (photoId) {
              state.selectPhoto(photoId);
              centerOnFrame(photoId);
            }
          }}
          style={{ cursor: cursorFor(tool) }}
          className=""
        >
          <SheetSvg
            doc={doc}
            layout={layout}
            urls={urls}
            svgRef={svgRef}
            interactive
            selectedPhotoId={selectedPhotoId}
            dimmedPhotoIds={dimmed}
            draggingPhotoId={draggingPhotoId}
            dropIndex={dropIndex}
            options={{ grain: showGrain }}
          >
            <g data-layer="annotations">
              {sortedAnnotations.map((a) => (
                <AnnotationView
                  key={a.id}
                  annotation={a}
                  interactive={tool === "select"}
                  selected={a.id === selectedAnnotationId}
                />
              ))}
              {draft ? <AnnotationView annotation={draft} /> : null}
              {selectionBounds && tool === "select" ? (
                <g data-export-hide="true">
                  <rect
                    data-resize-handle="se"
                    x={selectionBounds.x + selectionBounds.width}
                    y={selectionBounds.y + selectionBounds.height}
                    width={11}
                    height={11}
                    fill="#f2c218"
                    stroke="#0a0a0b"
                    strokeWidth={1}
                    style={{ cursor: "nwse-resize" }}
                  />
                </g>
              ) : null}
            </g>
          </SheetSvg>
        </div>
      </div>

      {textEditor ? (
        <textarea
          autoFocus
          value={textEditor.value}
          onChange={(e) => setTextEditor({ ...textEditor, value: e.target.value })}
          onBlur={commitText}
          onKeyDown={(e) => {
            // Enter breaks the line; Escape and ⌘/Ctrl+Enter both commit.
            if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
              e.preventDefault();
              commitText();
            }
            e.stopPropagation();
          }}
          aria-label="Annotation text"
          placeholder="Type a note"
          className="absolute z-20 min-h-[42px] w-52 resize border border-warm bg-noir p-1.5 text-[12px] leading-snug text-warm outline-none"
          style={{ left: textEditor.left, top: textEditor.top - 14 }}
        />
      ) : null}

      <div className="pointer-events-none absolute bottom-2 left-2 select-none">
        <span className="pill label px-2 py-[3px]">
          {Math.round(zoom * 100)}% · {layout.width}×{layout.height}
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- utils */

type NewAnnotation = Omit<Annotation, "id" | "contactSheetId" | "createdAt" | "updatedAt" | "zIndex">;

/** Drops server-assigned metadata so the store can mint its own. */
function stripMeta(a: Annotation): NewAnnotation {
  const { id: _id, contactSheetId: _sheet, createdAt: _c, updatedAt: _u, zIndex: _z, ...rest } = a;
  return rest;
}

function isDrawTool(tool: ToolId): boolean {
  return (
    FREEHAND_TOOLS.includes(tool as AnnotationTool) ||
    ["arrow", "ellipse", "rect", "line", "x", "check", "crop"].includes(tool)
  );
}

function extendDraft(draft: Annotation, p: Point, pressure: number): Annotation {
  const g = draft.geometry;
  if (g.kind === "points") {
    return { ...draft, geometry: { kind: "points", points: [...g.points, { ...p, p: pressure }] } };
  }
  if (g.kind === "segment") {
    return { ...draft, geometry: { ...g, x2: p.x, y2: p.y } };
  }
  return { ...draft, geometry: { ...g, width: p.x - g.x, height: p.y - g.y } };
}

/** Normalises a draft on release; a click without a drag becomes a stamp. */
function finalizeDraft(draft: Annotation): Annotation | null {
  const g = draft.geometry;
  if (g.kind === "points") {
    if (g.points.length < 2) return null;
    return { ...draft, geometry: { kind: "points", points: decimate(g.points) } };
  }
  if (g.kind === "segment") {
    if (Math.hypot(g.x2 - g.x1, g.y2 - g.y1) < 6) {
      return { ...draft, geometry: { kind: "segment", x1: g.x1 - 60, y1: g.y1 - 40, x2: g.x2, y2: g.y2 } };
    }
    return draft;
  }
  const tiny = Math.abs(g.width) < 8 || Math.abs(g.height) < 8;
  if (tiny) {
    const size = draft.tool === "check" ? 40 : 64;
    return {
      ...draft,
      geometry: { kind: "box", x: g.x - size / 2, y: g.y - size / 2, width: size, height: size },
    };
  }
  return {
    ...draft,
    geometry: {
      kind: "box",
      x: Math.min(g.x, g.x + g.width),
      y: Math.min(g.y, g.y + g.height),
      width: Math.abs(g.width),
      height: Math.abs(g.height),
    },
  };
}

/** A ring the size of the eraser's actual reach, so its bite is visible. */
const ERASER_CURSOR = (() => {
  const d = ERASER_SCREEN_RADIUS * 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${d + 4}" height="${d + 4}"><circle cx="${d / 2 + 2}" cy="${d / 2 + 2}" r="${ERASER_SCREEN_RADIUS}" fill="rgba(255,255,255,0.12)" stroke="%23f2c218" stroke-width="1.5"/></svg>`;
  return `url("data:image/svg+xml,${svg.replace(/#/g, "%23").replace(/"/g, "'")}") ${d / 2 + 2} ${d / 2 + 2}, cell`;
})();

function cursorFor(tool: ToolId): string {
  if (tool === "pan") return "grab";
  if (tool === "select") return "default";
  if (tool === "eraser") return ERASER_CURSOR;
  if (tool === "text") return "text";
  return "crosshair";
}

export { computeLayout };
