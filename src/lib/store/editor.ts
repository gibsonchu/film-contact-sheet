"use client";

import { create } from "zustand";
import {
  createPhoto,
  movePhoto as movePhotoIn,
  nowIso,
  removePhoto as removePhotoIn,
  renumber,
  remapAnnotationsForTemplate,
  swapPhotos as swapPhotosIn,
  uid,
} from "../document";
import { computeLayout } from "../layout";
import { getStorage } from "../storage/local";
import { DEFAULT_INSTRUMENT, INK_COLORS, STROKE_SIZES } from "../palette";
import type {
  Annotation,
  AnnotationTool,
  ContactSheet,
  Photo,
  ReviewStatus,
  SheetDocument,
  TapeKind,
  TemplateId,
} from "../types";

export type ToolId =
  | "select"
  | "pan"
  | "eraser"
  | AnnotationTool;

export type SaveState = "idle" | "saving" | "saved" | "error" | "offline";

interface Snapshot {
  sheet: ContactSheet;
  photos: Photo[];
  annotations: Annotation[];
}

interface EditorState {
  doc: SheetDocument | null;
  urls: Record<string, string>;
  loading: boolean;
  loadError: string | null;
  saveState: SaveState;
  dirty: boolean;
  readOnly: boolean;

  past: Snapshot[];
  future: Snapshot[];

  tool: ToolId;
  color: string;
  strokeWidth: number;
  opacity: number;
  tapeKind: TapeKind;

  selectedPhotoId: string | null;
  selectedAnnotationId: string | null;
  filter: ReviewStatus | "all";
  zoom: number;
  panX: number;
  panY: number;
  showGrain: boolean;

  loadDocument: (id: string) => Promise<void>;
  adoptDocument: (doc: SheetDocument, opts?: { readOnly?: boolean; persist?: boolean }) => Promise<void>;
  registerUrl: (key: string, url: string) => void;
  hydrateUrls: () => Promise<void>;

  updateSheet: (patch: Partial<ContactSheet>) => void;
  setTemplate: (templateId: TemplateId) => void;
  updateTemplateSettings: (patch: Record<string, unknown>) => void;

  addPhotos: (photos: Photo[]) => void;
  updatePhoto: (id: string, patch: Partial<Photo>) => void;
  setStatus: (id: string, status: ReviewStatus) => void;
  cycleStatus: (id: string) => void;
  movePhoto: (from: number, to: number) => void;
  swapPhotos: (a: number, b: number) => void;
  removePhoto: (id: string) => void;
  toggleHidden: (id: string) => void;
  rotatePhoto: (id: string, delta: number) => void;
  insertBlank: (atIndex: number) => void;

  addAnnotation: (a: Omit<Annotation, "id" | "contactSheetId" | "createdAt" | "updatedAt" | "zIndex">) => string;
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  clearAnnotations: () => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  setTool: (tool: ToolId) => void;
  setColor: (hex: string) => void;
  setStrokeWidth: (w: number) => void;
  setOpacity: (o: number) => void;
  setTapeKind: (k: TapeKind) => void;
  selectPhoto: (id: string | null) => void;
  selectAnnotation: (id: string | null) => void;
  setFilter: (f: ReviewStatus | "all") => void;
  setZoom: (z: number) => void;
  nudgeView: (dx: number, dy: number) => void;
  resetView: () => void;
  /** Bumped to ask the canvas to re-fit the sheet to the viewport. */
  fitRequest: number;
  requestFit: () => void;
  /** True while the canvas should keep fitting the sheet to the viewport. */
  autoFitView: boolean;

  /** The instrument the Drawing tool draws with, and the active manual mark. */
  instrument: AnnotationTool;
  markTool: AnnotationTool;
  setInstrument: (tool: AnnotationTool) => void;
  setMarkTool: (tool: AnnotationTool) => void;

  /** Contact-sheet fullscreen: panels away, the whole sheet on the light table. */
  sheetFullscreen: boolean;
  setSheetFullscreen: (on: boolean) => void;

  /** Which surrounding panels are showing. */
  showRail: boolean;
  showInspector: boolean;
  showFilmstrip: boolean;
  togglePanel: (panel: "rail" | "inspector" | "filmstrip") => void;
  /** Moves the selection to the next or previous visible frame. */
  stepSelection: (delta: number) => void;
  toggleGrain: () => void;

  save: () => Promise<void>;
}

/** Frame boxes keyed by photo id, used when remapping annotations. */
function frameMapFor(doc: SheetDocument, templateId: TemplateId) {
  const layout = computeLayout({
    templateId,
    templateSettings: doc.sheet.templateSettings,
    photos: doc.photos,
  });
  const frames = new Map<string, { x: number; y: number; width: number; height: number }>();
  for (const frame of layout.frames) {
    if (frame.photoId) {
      frames.set(frame.photoId, { x: frame.x, y: frame.y, width: frame.width, height: frame.height });
    }
  }
  return { width: layout.width, height: layout.height, frames };
}

const HISTORY_LIMIT = 80;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function snapshot(doc: SheetDocument): Snapshot {
  return {
    sheet: { ...doc.sheet },
    photos: doc.photos.map((p) => ({ ...p })),
    annotations: doc.annotations.map((a) => ({ ...a, geometry: cloneGeometry(a.geometry) })),
  };
}

function cloneGeometry<T>(g: T): T {
  return JSON.parse(JSON.stringify(g)) as T;
}

export const useEditor = create<EditorState>()((set, get) => {
  /** Apply a mutation, optionally pushing an undo checkpoint, then autosave. */
  function commit(mutate: (doc: SheetDocument) => SheetDocument, opts?: { history?: boolean }) {
    const state = get();
    if (!state.doc || state.readOnly) return;
    const before = opts?.history === false ? null : snapshot(state.doc);
    const next = mutate(state.doc);
    next.sheet = { ...next.sheet, updatedAt: nowIso() };
    set({
      doc: next,
      dirty: true,
      past: before ? [...state.past, before].slice(-HISTORY_LIMIT) : state.past,
      future: before ? [] : state.future,
    });
    scheduleSave();
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    set({ saveState: "saving" });
    saveTimer = setTimeout(() => {
      void get().save();
    }, 700);
  }

  return {
    doc: null,
    urls: {},
    loading: false,
    loadError: null,
    saveState: "idle",
    dirty: false,
    readOnly: false,
    past: [],
    future: [],

    tool: "select",
    color: INK_COLORS[0].hex,
    strokeWidth: STROKE_SIZES[1].value,
    opacity: 1,
    tapeKind: "masking",

    selectedPhotoId: null,
    selectedAnnotationId: null,
    filter: "all",
    zoom: 1,
    panX: 0,
    panY: 0,
    fitRequest: 0,
    autoFitView: true,
    instrument: DEFAULT_INSTRUMENT,
    markTool: "ellipse",
    sheetFullscreen: false,
    showRail: true,
    showInspector: true,
    showFilmstrip: true,
    showGrain: true,

    async loadDocument(id) {
      set({ loading: true, loadError: null });
      try {
        const doc = await getStorage().loadDocument(id);
        if (!doc) {
          set({ loading: false, loadError: "That contact sheet isn’t on this device." });
          return;
        }
        await get().adoptDocument(doc, { persist: false });
      } catch (err) {
        set({ loading: false, loadError: err instanceof Error ? err.message : "Failed to load." });
      }
    },

    async adoptDocument(doc, opts) {
      set({
        doc,
        loading: false,
        loadError: null,
        past: [],
        future: [],
        dirty: false,
        saveState: "idle",
        readOnly: opts?.readOnly ?? false,
        selectedPhotoId: null,
        selectedAnnotationId: null,
      });
      await get().hydrateUrls();
      if (opts?.persist) await getStorage().saveDocument(doc);
    },

    registerUrl(key, url) {
      set((s) => ({ urls: { ...s.urls, [key]: url } }));
    },

    async hydrateUrls() {
      const doc = get().doc;
      if (!doc) return;
      const storage = getStorage();
      const entries: [string, string][] = [];
      for (const photo of doc.photos) {
        for (const key of [photo.storagePath, photo.thumbPath]) {
          if (!key || get().urls[key]) continue;
          const url = await storage.getAssetUrl(key);
          if (url) entries.push([key, url]);
        }
      }
      if (entries.length) {
        set((s) => ({ urls: { ...s.urls, ...Object.fromEntries(entries) } }));
      }
    },

    updateSheet(patch) {
      commit((doc) => ({ ...doc, sheet: { ...doc.sheet, ...patch } }));
    },

    setTemplate(templateId) {
      commit((doc) => {
        if (doc.sheet.templateId === templateId) return doc;
        // Annotations keep their relationship to the sheet: marks anchored to a
        // frame move with that frame into its new position and size; marks in
        // the margins scale with the sheet.
        const before = frameMapFor(doc, doc.sheet.templateId);
        const after = frameMapFor(doc, templateId);
        return {
          ...doc,
          sheet: { ...doc.sheet, templateId },
          annotations: remapAnnotationsForTemplate(doc.annotations, before, after),
        };
      });
    },

    updateTemplateSettings(patch) {
      commit((doc) => ({
        ...doc,
        sheet: { ...doc.sheet, templateSettings: { ...doc.sheet.templateSettings, ...patch } },
      }));
    },

    addPhotos(photos) {
      commit((doc) => ({ ...doc, photos: renumber([...doc.photos, ...photos]) }));
      void get().hydrateUrls();
    },

    updatePhoto(id, patch) {
      commit((doc) => ({
        ...doc,
        photos: doc.photos.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: nowIso() } : p)),
      }));
    },

    setStatus(id, status) {
      get().updatePhoto(id, { status });
      // Auto advance keeps a hand moving across the sheet, the way a grease
      // pencil does — without ever leaving the sheet.
      if (get().doc?.sheet.autoAdvance && get().selectedPhotoId === id) get().stepSelection(1);
    },

    cycleStatus(id) {
      const order: ReviewStatus[] = ["unflagged", "pick", "maybe", "reject"];
      const photo = get().doc?.photos.find((p) => p.id === id);
      if (!photo) return;
      const next = order[(order.indexOf(photo.status) + 1) % order.length];
      get().setStatus(id, next);
    },

    movePhoto(from, to) {
      commit((doc) => ({ ...doc, photos: movePhotoIn(doc.photos, from, to) }));
    },

    swapPhotos(a, b) {
      commit((doc) => ({ ...doc, photos: swapPhotosIn(doc.photos, a, b) }));
    },

    removePhoto(id) {
      commit((doc) => ({
        ...doc,
        photos: removePhotoIn(doc.photos, id),
        annotations: doc.annotations.filter((a) => a.photoId !== id),
      }));
      set({ selectedPhotoId: null });
    },

    toggleHidden(id) {
      commit((doc) => ({
        ...doc,
        photos: renumber(doc.photos.map((p) => (p.id === id ? { ...p, hidden: !p.hidden } : p))),
      }));
    },

    rotatePhoto(id, delta) {
      const photo = get().doc?.photos.find((p) => p.id === id);
      if (!photo) return;
      const rotation = (((photo.rotation + delta) % 360) + 360) % 360;
      get().updatePhoto(id, { rotation: rotation as Photo["rotation"] });
    },

    insertBlank(atIndex) {
      commit((doc) => {
        const blank = createPhoto(doc.sheet.id, { blank: true, originalFilename: "" });
        const next = doc.photos.slice();
        next.splice(Math.max(0, Math.min(next.length, atIndex)), 0, blank);
        return { ...doc, photos: renumber(next) };
      });
    },

    addAnnotation(input) {
      const id = uid("anno");
      commit((doc) => {
        const zIndex = doc.annotations.reduce((m, a) => Math.max(m, a.zIndex), 0) + 1;
        const annotation: Annotation = {
          ...input,
          id,
          contactSheetId: doc.sheet.id,
          zIndex,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        return { ...doc, annotations: [...doc.annotations, annotation] };
      });
      return id;
    },

    updateAnnotation(id, patch) {
      commit((doc) => ({
        ...doc,
        annotations: doc.annotations.map((a) =>
          a.id === id ? { ...a, ...patch, updatedAt: nowIso() } : a,
        ),
      }));
    },

    deleteAnnotation(id) {
      commit((doc) => ({ ...doc, annotations: doc.annotations.filter((a) => a.id !== id) }));
      set({ selectedAnnotationId: null });
    },

    bringForward(id) {
      commit((doc) => {
        const top = doc.annotations.reduce((m, a) => Math.max(m, a.zIndex), 0);
        return {
          ...doc,
          annotations: doc.annotations.map((a) => (a.id === id ? { ...a, zIndex: top + 1 } : a)),
        };
      });
    },

    sendBackward(id) {
      commit((doc) => {
        const bottom = doc.annotations.reduce((m, a) => Math.min(m, a.zIndex), 0);
        return {
          ...doc,
          annotations: doc.annotations.map((a) => (a.id === id ? { ...a, zIndex: bottom - 1 } : a)),
        };
      });
    },

    clearAnnotations() {
      commit((doc) => ({ ...doc, annotations: [] }));
    },

    undo() {
      const { doc, past, future } = get();
      if (!doc || past.length === 0) return;
      const prev = past[past.length - 1];
      set({
        past: past.slice(0, -1),
        future: [...future, snapshot(doc)].slice(-HISTORY_LIMIT),
        doc: { ...doc, ...prev },
        dirty: true,
      });
      scheduleSave();
    },

    redo() {
      const { doc, past, future } = get();
      if (!doc || future.length === 0) return;
      const next = future[future.length - 1];
      set({
        future: future.slice(0, -1),
        past: [...past, snapshot(doc)].slice(-HISTORY_LIMIT),
        doc: { ...doc, ...next },
        dirty: true,
      });
      scheduleSave();
    },

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,

    setTool: (tool) => set({ tool, selectedAnnotationId: tool === "select" ? get().selectedAnnotationId : null }),
    setColor: (color) => {
      const { selectedAnnotationId } = get();
      set({ color });
      if (selectedAnnotationId) get().updateAnnotation(selectedAnnotationId, { color });
    },
    setStrokeWidth: (strokeWidth) => {
      const { selectedAnnotationId } = get();
      set({ strokeWidth });
      if (selectedAnnotationId) get().updateAnnotation(selectedAnnotationId, { strokeWidth });
    },
    setOpacity: (opacity) => {
      const { selectedAnnotationId } = get();
      set({ opacity });
      if (selectedAnnotationId) get().updateAnnotation(selectedAnnotationId, { opacity });
    },
    setTapeKind: (tapeKind) => set({ tapeKind }),
    selectPhoto: (selectedPhotoId) => set({ selectedPhotoId, selectedAnnotationId: null }),
    selectAnnotation: (selectedAnnotationId) => set({ selectedAnnotationId, selectedPhotoId: null }),
    setFilter: (filter) => set({ filter }),
    setZoom: (zoom) => set({ zoom: Math.min(4, Math.max(0.06, zoom)), autoFitView: false }),
    nudgeView: (dx, dy) => set((s) => ({ panX: s.panX + dx, panY: s.panY + dy, autoFitView: false })),
    resetView: () => set({ zoom: 1, panX: 0, panY: 0, autoFitView: false }),
    requestFit: () => set((s) => ({ fitRequest: s.fitRequest + 1, autoFitView: true })),

    // Choosing an instrument also picks up that instrument: reaching into the
    // pencil case and then not drawing with it would be a strange thing to do.
    setInstrument: (instrument) => set({ instrument, tool: instrument }),
    setMarkTool: (markTool) => set({ markTool, tool: markTool }),

    setSheetFullscreen: (sheetFullscreen) =>
      set((s) => ({
        sheetFullscreen,
        // Coming back out, re-fit so the sheet lands where it was left.
        fitRequest: s.fitRequest + 1,
        autoFitView: true,
      })),

    togglePanel: (panel) =>
      set((s) =>
        panel === "rail"
          ? { showRail: !s.showRail }
          : panel === "inspector"
            ? { showInspector: !s.showInspector }
            : { showFilmstrip: !s.showFilmstrip },
      ),

    stepSelection: (delta) => {
      const { doc, filter, selectedPhotoId } = get();
      const photos = filteredPhotos(doc, filter);
      if (photos.length === 0) return;
      const at = photos.findIndex((p) => p.id === selectedPhotoId);
      // With nothing selected, step in from whichever end you came from.
      const next = at === -1 ? (delta > 0 ? 0 : photos.length - 1) : at + delta;
      const clamped = Math.min(photos.length - 1, Math.max(0, next));
      set({ selectedPhotoId: photos[clamped].id, selectedAnnotationId: null });
    },

    toggleGrain: () => set((s) => ({ showGrain: !s.showGrain })),

    async save() {
      const { doc, readOnly } = get();
      if (!doc || readOnly) return;
      try {
        await getStorage().saveDocument(doc);
        set({ saveState: navigator.onLine === false ? "offline" : "saved", dirty: false });
      } catch {
        set({ saveState: "error" });
      }
    },
  };
});

/** Visible photos after the review-status filter. */
export function filteredPhotos(doc: SheetDocument | null, filter: ReviewStatus | "all"): Photo[] {
  if (!doc) return [];
  if (filter === "all") return doc.photos;
  return doc.photos.filter((p) => p.status === filter);
}
