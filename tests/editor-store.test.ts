import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDocument, createPhoto, renumber } from "@/lib/document";
import { setStorage } from "@/lib/storage/local";
import type { StorageAdapter } from "@/lib/storage/adapter";
import type { SheetDocument } from "@/lib/types";
import { useEditor } from "@/lib/store/editor";

/** In-memory adapter so the store can be exercised without IndexedDB. */
function memoryAdapter() {
  const docs = new Map<string, SheetDocument>();
  const saves = vi.fn();
  const adapter: StorageAdapter = {
    mode: "local",
    async listProjects() {
      return [];
    },
    async loadDocument(id) {
      return docs.get(id) ?? null;
    },
    async saveDocument(doc) {
      saves(doc.sheet.id);
      docs.set(doc.sheet.id, doc);
    },
    async deleteDocument(id) {
      docs.delete(id);
    },
    async putAsset(key) {
      return key;
    },
    async getAssetBlob() {
      return null;
    },
    async getAssetUrl() {
      return null;
    },
    async removeAssets() {},
    async findByShareToken() {
      return null;
    },
  };
  return { adapter, docs, saves };
}

function seedDocument(count = 6): SheetDocument {
  const doc = createDocument({ id: "sheet_test", title: "Test Roll" });
  doc.photos = renumber(
    Array.from({ length: count }, (_, i) => createPhoto(doc.sheet.id, { id: `p${i}`, position: i })),
  );
  return doc;
}

describe("editor store", () => {
  beforeEach(async () => {
    const { adapter } = memoryAdapter();
    setStorage(adapter);
    await useEditor.getState().adoptDocument(seedDocument());
  });

  it("records titles and statuses on the document", () => {
    const store = useEditor.getState();
    store.updatePhoto("p0", { title: "Slipway" });
    store.setStatus("p2", "pick");
    const doc = useEditor.getState().doc!;
    expect(doc.photos[0].title).toBe("Slipway");
    expect(doc.photos[2].status).toBe("pick");
  });

  it("cycles review status through every state and back", () => {
    const store = useEditor.getState();
    const seen: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      store.cycleStatus("p1");
      seen.push(useEditor.getState().doc!.photos[1].status);
    }
    expect(seen).toEqual(["pick", "maybe", "reject", "unflagged"]);
  });

  it("renumbers frames after a drag reorder", () => {
    useEditor.getState().movePhoto(0, 4);
    const doc = useEditor.getState().doc!;
    expect(doc.photos.map((p) => p.id)).toEqual(["p1", "p2", "p3", "p4", "p0", "p5"]);
    expect(doc.photos.map((p) => p.frameNumber)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("undoes and redoes a reorder", () => {
    const before = useEditor.getState().doc!.photos.map((p) => p.id);
    useEditor.getState().movePhoto(0, 5);
    expect(useEditor.getState().doc!.photos.map((p) => p.id)).not.toEqual(before);

    useEditor.getState().undo();
    expect(useEditor.getState().doc!.photos.map((p) => p.id)).toEqual(before);

    useEditor.getState().redo();
    expect(useEditor.getState().doc!.photos[5].id).toBe("p0");
  });

  it("undoes and redoes annotations", () => {
    const id = useEditor.getState().addAnnotation({
      photoId: null,
      anchor: null,
      type: "shape",
      tool: "ellipse",
      color: "#d81f26",
      strokeWidth: 4,
      opacity: 1,
      geometry: { kind: "box", x: 10, y: 10, width: 40, height: 40 },
      text: null,
      locked: false,
    });
    expect(useEditor.getState().doc!.annotations).toHaveLength(1);

    useEditor.getState().updateAnnotation(id, { color: "#f2c218" });
    expect(useEditor.getState().doc!.annotations[0].color).toBe("#f2c218");

    useEditor.getState().undo();
    expect(useEditor.getState().doc!.annotations[0].color).toBe("#d81f26");

    useEditor.getState().undo();
    expect(useEditor.getState().doc!.annotations).toHaveLength(0);

    useEditor.getState().redo();
    expect(useEditor.getState().doc!.annotations).toHaveLength(1);
  });

  it("deletes a frame's annotations along with the frame", () => {
    useEditor.getState().addAnnotation({
      photoId: "p1",
      anchor: null,
      type: "shape",
      tool: "x",
      color: "#d81f26",
      strokeWidth: 4,
      opacity: 1,
      geometry: { kind: "box", x: 0, y: 0, width: 10, height: 10 },
      text: null,
      locked: false,
    });
    useEditor.getState().removePhoto("p1");
    const doc = useEditor.getState().doc!;
    expect(doc.photos.find((p) => p.id === "p1")).toBeUndefined();
    expect(doc.annotations).toHaveLength(0);
  });

  it("keeps every photo and annotation when the template changes", () => {
    useEditor.getState().updatePhoto("p0", { title: "Keeper", status: "pick" });
    useEditor.getState().addAnnotation({
      photoId: "p0",
      anchor: { x: 0.5, y: 0.5, scale: 1 },
      type: "shape",
      tool: "ellipse",
      color: "#d81f26",
      strokeWidth: 4,
      opacity: 1,
      geometry: { kind: "box", x: 0, y: 0, width: 30, height: 30 },
      text: null,
      locked: false,
    });

    useEditor.getState().setTemplate("archival-sheet");

    const doc = useEditor.getState().doc!;
    expect(doc.sheet.templateId).toBe("archival-sheet");
    expect(doc.photos).toHaveLength(6);
    expect(doc.photos[0].title).toBe("Keeper");
    expect(doc.photos[0].status).toBe("pick");
    expect(doc.annotations).toHaveLength(1);
  });

  it("refuses to mutate a read-only (shared) document", async () => {
    await useEditor.getState().adoptDocument(seedDocument(), { readOnly: true });
    useEditor.getState().updatePhoto("p0", { title: "hacked" });
    useEditor.getState().setStatus("p0", "reject");
    const doc = useEditor.getState().doc!;
    expect(doc.photos[0].title).toBe("");
    expect(doc.photos[0].status).toBe("unflagged");
  });

  it("hides a frame without deleting it, and restores it", () => {
    useEditor.getState().toggleHidden("p2");
    let doc = useEditor.getState().doc!;
    expect(doc.photos).toHaveLength(6);
    expect(doc.photos[2].hidden).toBe(true);
    expect(doc.photos.map((p) => p.frameNumber)).toEqual([1, 2, 0, 3, 4, 5]);

    useEditor.getState().toggleHidden("p2");
    doc = useEditor.getState().doc!;
    expect(doc.photos[2].hidden).toBe(false);
    expect(doc.photos.map((p) => p.frameNumber)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
