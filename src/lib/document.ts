import { DEFAULT_TEMPLATE_ID } from "./templates";
import {
  MAX_PHOTOS_PER_SHEET,
  type ReviewStatus,
  SCHEMA_VERSION,
  type Annotation,
  type ContactSheet,
  type Photo,
  type SheetDocument,
  type TemplateId,
} from "./types";

/** Stable id generator that works in the browser, Node and tests. */
export function uid(prefix = "id"): string {
  const g = globalThis as { crypto?: Crypto };
  const raw =
    g.crypto && "randomUUID" in g.crypto
      ? g.crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}_${raw.replace(/-/g, "").slice(0, 16)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function createSheet(partial: Partial<ContactSheet> = {}): ContactSheet {
  const ts = nowIso();
  return {
    id: partial.id ?? uid("sheet"),
    userId: partial.userId ?? null,
    title: partial.title ?? "Untitled Roll",
    subtitle: partial.subtitle ?? "",
    description: partial.description ?? "",
    rollNumber: partial.rollNumber ?? "",
    dateShot: partial.dateShot ?? "",
    photographer: partial.photographer ?? "",
    location: partial.location ?? "",
    camera: partial.camera ?? "",
    filmStock: partial.filmStock ?? "",
    templateId: partial.templateId ?? DEFAULT_TEMPLATE_ID,
    templateSettings: partial.templateSettings ?? {},
    sharingMode: partial.sharingMode ?? "private",
    commentsEnabled: partial.commentsEnabled ?? false,
    downloadsEnabled: partial.downloadsEnabled ?? true,
    pickMark: partial.pickMark ?? "circle",
    autoAdvance: partial.autoAdvance ?? false,
    postcard: partial.postcard ?? {
      message: "",
      senderName: "",
      senderAddress: "",
      recipientName: "",
      recipientAddress: "",
      stampNote: "",
    },
    createdAt: partial.createdAt ?? ts,
    updatedAt: partial.updatedAt ?? ts,
    archivedAt: partial.archivedAt ?? null,
    deletedAt: partial.deletedAt ?? null,
  };
}

export function createDocument(sheet?: Partial<ContactSheet>): SheetDocument {
  return {
    schemaVersion: SCHEMA_VERSION,
    sheet: createSheet(sheet),
    photos: [],
    annotations: [],
    comments: [],
    shareLinks: [],
  };
}

export function createPhoto(contactSheetId: string, partial: Partial<Photo> = {}): Photo {
  const ts = nowIso();
  return {
    id: partial.id ?? uid("photo"),
    contactSheetId,
    storagePath: partial.storagePath ?? "",
    thumbPath: partial.thumbPath ?? "",
    originalFilename: partial.originalFilename ?? "",
    mimeType: partial.mimeType ?? "image/jpeg",
    width: partial.width ?? 0,
    height: partial.height ?? 0,
    fileSize: partial.fileSize ?? 0,
    position: partial.position ?? 0,
    frameNumber: partial.frameNumber ?? (partial.position ?? 0) + 1,
    title: partial.title ?? "",
    caption: partial.caption ?? "",
    privateNote: partial.privateNote ?? "",
    publicNote: partial.publicNote ?? "",
    status: partial.status ?? "unflagged",
    rotation: partial.rotation ?? 0,
    cropData: partial.cropData ?? null,
    fit: partial.fit ?? "fit",
    exifData: partial.exifData ?? null,
    hidden: partial.hidden ?? false,
    blank: partial.blank ?? false,
    createdAt: partial.createdAt ?? ts,
    updatedAt: partial.updatedAt ?? ts,
  };
}

/**
 * Re-derives `position` (contiguous) and `frameNumber` (1-based over *visible*
 * photos) from array order. Called after every structural mutation so the two
 * can never drift out of sync.
 */
export function renumber(photos: Photo[]): Photo[] {
  let frame = 0;
  return photos.map((photo, index) => {
    if (!photo.hidden) frame += 1;
    const frameNumber = photo.hidden ? 0 : frame;
    if (photo.position === index && photo.frameNumber === frameNumber) return photo;
    return { ...photo, position: index, frameNumber };
  });
}

/** Move the photo at `from` to index `to`, then renumber. */
export function movePhoto(photos: Photo[], from: number, to: number): Photo[] {
  if (from === to || from < 0 || from >= photos.length) return photos;
  const next = photos.slice();
  const clamped = Math.max(0, Math.min(photos.length - 1, to));
  const [moved] = next.splice(from, 1);
  next.splice(clamped, 0, moved);
  return renumber(next);
}

/** Exchange two photos' positions without shifting anything else. */
export function swapPhotos(photos: Photo[], a: number, b: number): Photo[] {
  if (a === b) return photos;
  if (a < 0 || b < 0 || a >= photos.length || b >= photos.length) return photos;
  const next = photos.slice();
  [next[a], next[b]] = [next[b], next[a]];
  return renumber(next);
}

export function removePhoto(photos: Photo[], id: string): Photo[] {
  return renumber(photos.filter((p) => p.id !== id));
}

/**
 * Split an incoming file list into sheet-sized batches. More than 38 images
 * spills into additional contact sheets, one per roll.
 */
export function chunkForSheets<T>(items: T[], max = MAX_PHOTOS_PER_SHEET): T[][] {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += max) chunks.push(items.slice(i, i + max));
  return chunks;
}

export function sheetTitleForChunk(base: string, index: number, total: number): string {
  if (total <= 1) return base;
  return `${base} — Roll ${index + 1} of ${total}`;
}

/**
 * Template switching keeps every photo, status, note and annotation. Annotations
 * anchored to a frame are re-expressed against the new frame geometry; loose
 * margin annotations keep their relative position on the sheet.
 */
export function remapAnnotationsForTemplate(
  annotations: Annotation[],
  from: { width: number; height: number; frames: Map<string, { x: number; y: number; width: number; height: number }> },
  to: { width: number; height: number; frames: Map<string, { x: number; y: number; width: number; height: number }> },
): Annotation[] {
  return annotations.map((a) => {
    const src = a.photoId ? from.frames.get(a.photoId) : undefined;
    const dst = a.photoId ? to.frames.get(a.photoId) : undefined;

    let translate: (p: { x: number; y: number }) => { x: number; y: number };
    let scale: number;

    if (src && dst) {
      const sx = dst.width / (src.width || 1);
      const sy = dst.height / (src.height || 1);
      scale = (sx + sy) / 2;
      translate = (p) => ({
        x: dst.x + (p.x - src.x) * sx,
        y: dst.y + (p.y - src.y) * sy,
      });
    } else {
      const sx = to.width / (from.width || 1);
      const sy = to.height / (from.height || 1);
      scale = (sx + sy) / 2;
      translate = (p) => ({ x: p.x * sx, y: p.y * sy });
    }

    const g = a.geometry;
    let geometry = g;
    if (g.kind === "points") {
      geometry = { kind: "points", points: g.points.map((pt) => ({ ...pt, ...translate(pt) })) };
    } else if (g.kind === "box") {
      const tl = translate({ x: g.x, y: g.y });
      geometry = { ...g, x: tl.x, y: tl.y, width: g.width * scale, height: g.height * scale };
    } else if (g.kind === "segment") {
      const p1 = translate({ x: g.x1, y: g.y1 });
      const p2 = translate({ x: g.x2, y: g.y2 });
      geometry = { kind: "segment", x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
    }

    return { ...a, geometry, strokeWidth: a.strokeWidth * (a.photoId ? scale : 1) };
  });
}

export function switchTemplate(doc: SheetDocument, templateId: TemplateId): SheetDocument {
  return {
    ...doc,
    sheet: { ...doc.sheet, templateId, updatedAt: nowIso() },
  };
}

/**
 * Brings a stored document up to the current shape.
 *
 * Review used to carry five states with a separate "favorite" and "selected";
 * both meant "keep this", so they fold into Pick. Sheets saved before the
 * review preferences existed get the defaults.
 */
export function migrateDocument(doc: SheetDocument): SheetDocument {
  const statusMap: Record<string, ReviewStatus> = {
    favorite: "pick",
    selected: "pick",
    rejected: "reject",
    unreviewed: "unflagged",
  };
  return {
    ...doc,
    sheet: {
      ...doc.sheet,
      pickMark: doc.sheet.pickMark ?? "circle",
      autoAdvance: doc.sheet.autoAdvance ?? false,
    },
    photos: doc.photos.map((p) =>
      statusMap[p.status] ? { ...p, status: statusMap[p.status] } : p,
    ),
  };
}

export function isPublicField(field: "publicNote" | "privateNote"): boolean {
  return field === "publicNote";
}

/** Strips anything a shared viewer must never see. */
export function toSharedDocument(doc: SheetDocument): SheetDocument {
  return {
    ...doc,
    photos: doc.photos.map((p) => ({ ...p, privateNote: "" })),
    sheet: { ...doc.sheet, postcard: { ...doc.sheet.postcard, recipientAddress: "", senderAddress: "" } },
  };
}
