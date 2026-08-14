import { describe, expect, it } from "vitest";
import {
  chunkForSheets,
  createDocument,
  createPhoto,
  movePhoto,
  remapAnnotationsForTemplate,
  removePhoto,
  renumber,
  sheetTitleForChunk,
  swapPhotos,
  switchTemplate,
  toSharedDocument,
} from "@/lib/document";
import { DEFAULT_TEMPLATE_ID, TEMPLATE_LIST } from "@/lib/templates";
import { MAX_PHOTOS_PER_SHEET, type Annotation, type Photo } from "@/lib/types";

function makePhotos(n: number): Photo[] {
  return renumber(
    Array.from({ length: n }, (_, i) =>
      createPhoto("sheet_1", { id: `p${i}`, originalFilename: `${i}.jpg`, position: i }),
    ),
  );
}

describe("frame numbering", () => {
  it("numbers visible frames from one", () => {
    const photos = makePhotos(4);
    expect(photos.map((p) => p.frameNumber)).toEqual([1, 2, 3, 4]);
    expect(photos.map((p) => p.position)).toEqual([0, 1, 2, 3]);
  });

  it("renumbers after reordering", () => {
    const photos = movePhoto(makePhotos(4), 0, 3);
    expect(photos.map((p) => p.id)).toEqual(["p1", "p2", "p3", "p0"]);
    expect(photos.map((p) => p.frameNumber)).toEqual([1, 2, 3, 4]);
    expect(photos.find((p) => p.id === "p0")!.position).toBe(3);
  });

  it("renumbers after removing a frame", () => {
    const photos = removePhoto(makePhotos(5), "p1");
    expect(photos.map((p) => p.id)).toEqual(["p0", "p2", "p3", "p4"]);
    expect(photos.map((p) => p.frameNumber)).toEqual([1, 2, 3, 4]);
  });

  it("skips hidden frames when numbering but keeps them in order", () => {
    const photos = makePhotos(3);
    photos[1] = { ...photos[1], hidden: true };
    const out = renumber(photos);
    expect(out.map((p) => p.frameNumber)).toEqual([1, 0, 2]);
    expect(out.map((p) => p.position)).toEqual([0, 1, 2]);
  });

  it("swaps two frames without shifting the rest", () => {
    const photos = swapPhotos(makePhotos(4), 0, 2);
    expect(photos.map((p) => p.id)).toEqual(["p2", "p1", "p0", "p3"]);
    expect(photos.map((p) => p.frameNumber)).toEqual([1, 2, 3, 4]);
  });

  it("leaves the list alone for out-of-range moves", () => {
    const photos = makePhotos(3);
    expect(movePhoto(photos, 5, 0)).toBe(photos);
    expect(swapPhotos(photos, 0, 9)).toBe(photos);
  });
});

describe("defaults", () => {
  it("starts a new sheet on the default template", () => {
    expect(createDocument().sheet.templateId).toBe(DEFAULT_TEMPLATE_ID);
    expect(DEFAULT_TEMPLATE_ID).toBe("eliz-digital");
  });

  it("lists the default template first", () => {
    expect(TEMPLATE_LIST[0].id).toBe(DEFAULT_TEMPLATE_ID);
  });

  it("still honours an explicitly chosen template", () => {
    expect(createDocument({ templateId: "classic-35mm" }).sheet.templateId).toBe("classic-35mm");
  });
});

describe("roll capacity", () => {
  it("keeps a single sheet at or below the 38-frame limit", () => {
    expect(chunkForSheets(Array.from({ length: MAX_PHOTOS_PER_SHEET }))).toHaveLength(1);
  });

  it("splits an over-length upload into additional sheets", () => {
    const chunks = chunkForSheets(Array.from({ length: 90 }, (_, i) => i));
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(38);
    expect(chunks[1]).toHaveLength(38);
    expect(chunks[2]).toHaveLength(14);
    expect(chunks.flat()).toHaveLength(90);
  });

  it("names split rolls so the user can tell them apart", () => {
    expect(sheetTitleForChunk("Harbour", 0, 1)).toBe("Harbour");
    expect(sheetTitleForChunk("Harbour", 1, 3)).toBe("Harbour — Roll 2 of 3");
  });
});

describe("template switching", () => {
  it("preserves photos, statuses, notes and annotations", () => {
    const doc = createDocument({ title: "Roll" });
    doc.photos = makePhotos(6).map((p, i) =>
      i === 0 ? { ...p, title: "Slipway", status: "pick", privateNote: "grainy" } : p,
    );
    doc.annotations = [annotation("a1", "p0")];

    const next = switchTemplate(doc, "darkroom-proof");

    expect(next.sheet.templateId).toBe("darkroom-proof");
    expect(next.photos).toHaveLength(6);
    expect(next.photos[0].title).toBe("Slipway");
    expect(next.photos[0].status).toBe("pick");
    expect(next.photos[0].privateNote).toBe("grainy");
    expect(next.annotations).toHaveLength(1);
  });

  it("moves frame-anchored annotations with their frame", () => {
    const from = {
      width: 1000,
      height: 1000,
      frames: new Map([["p0", { x: 100, y: 100, width: 200, height: 100 }]]),
    };
    const to = {
      width: 2000,
      height: 2000,
      frames: new Map([["p0", { x: 600, y: 400, width: 400, height: 200 }]]),
    };
    const [moved] = remapAnnotationsForTemplate([annotation("a1", "p0")], from, to);
    expect(moved.geometry).toMatchObject({ kind: "box", x: 600, y: 400, width: 100, height: 100 });
  });

  it("rescales loose margin annotations against the sheet", () => {
    const from = { width: 1000, height: 1000, frames: new Map() };
    const to = { width: 2000, height: 2000, frames: new Map() };
    const [moved] = remapAnnotationsForTemplate([annotation("a1", null)], from, to);
    expect(moved.geometry).toMatchObject({ kind: "box", x: 200, y: 200 });
  });
});

describe("shared documents", () => {
  it("never exposes private notes", () => {
    const doc = createDocument();
    doc.photos = makePhotos(2).map((p) => ({
      ...p,
      privateNote: "do not show this",
      publicNote: "safe to show",
    }));
    const shared = toSharedDocument(doc);
    expect(shared.photos.every((p) => p.privateNote === "")).toBe(true);
    expect(shared.photos.every((p) => p.publicNote === "safe to show")).toBe(true);
  });

  it("strips postal addresses from a shared sheet", () => {
    const doc = createDocument();
    doc.sheet.postcard.recipientAddress = "1 Harbour Road";
    doc.sheet.postcard.senderAddress = "2 Quay Street";
    const shared = toSharedDocument(doc);
    expect(shared.sheet.postcard.recipientAddress).toBe("");
    expect(shared.sheet.postcard.senderAddress).toBe("");
  });
});

function annotation(id: string, photoId: string | null): Annotation {
  return {
    id,
    contactSheetId: "sheet_1",
    photoId,
    anchor: null,
    type: "shape",
    tool: "ellipse",
    color: "#d81f26",
    strokeWidth: 4,
    opacity: 1,
    geometry: { kind: "box", x: 100, y: 100, width: 50, height: 50 },
    text: null,
    zIndex: 1,
    locked: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}
