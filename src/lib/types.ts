/**
 * Core domain types.
 *
 * These mirror the Postgres schema in `supabase/migrations/` one-to-one so the
 * same objects can round-trip through either the local (IndexedDB) adapter or a
 * cloud (Supabase) adapter without translation.
 */

export const MAX_PHOTOS_PER_SHEET = 38;

export const SCHEMA_VERSION = 1;

/* ------------------------------------------------------------------ photos */

export type ReviewStatus = "unreviewed" | "favorite" | "selected" | "maybe" | "rejected";

export const REVIEW_STATUSES: ReviewStatus[] = [
  "unreviewed",
  "favorite",
  "selected",
  "maybe",
  "rejected",
];

export type FitMode = "fit" | "fill" | "original";

export interface CropData {
  /** Normalised 0..1 crop rect against the *source* image. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExifData {
  make?: string;
  model?: string;
  lens?: string;
  focalLength?: string;
  aperture?: string;
  shutterSpeed?: string;
  iso?: string;
  dateTaken?: string;
  orientation?: number;
}

export interface Photo {
  id: string;
  contactSheetId: string;
  /** Key into the asset store (IndexedDB blob key, or Supabase storage path). */
  storagePath: string;
  thumbPath: string;
  originalFilename: string;
  mimeType: string;
  width: number;
  height: number;
  fileSize: number;
  /** Order within the sheet. Contiguous, 0-based. */
  position: number;
  /** Printed frame number. Derived from position but persisted for exports. */
  frameNumber: number;
  title: string;
  caption: string;
  privateNote: string;
  publicNote: string;
  status: ReviewStatus;
  /** Degrees, multiples of 90. */
  rotation: 0 | 90 | 180 | 270;
  cropData: CropData | null;
  fit: FitMode;
  exifData: ExifData | null;
  hidden: boolean;
  /** A blank frame holds a slot open with no image. */
  blank?: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------- annotations */

export type AnnotationTool =
  | "pen"
  | "grease"
  | "marker"
  | "highlighter"
  | "pencil"
  | "text"
  | "arrow"
  | "ellipse"
  | "rect"
  | "line"
  | "x"
  | "check"
  | "crop"
  | "tape"
  | "sticker";

export type AnnotationType = "stroke" | "shape" | "text" | "tape" | "sticker";

export type TapeKind =
  | "masking"
  | "artist-red"
  | "lab-yellow"
  | "paper-white"
  | "transparent"
  | "label"
  | "dot";

export interface Point {
  x: number;
  y: number;
  /** Pointer pressure 0..1; falls back to 0.5 for mice. */
  p?: number;
}

/**
 * Geometry is a discriminated union stored as JSON. All coordinates are in
 * *sheet units* (the SVG user-space of the current sheet) so annotations are
 * resolution-independent and survive zoom, export scaling and template changes.
 */
export type AnnotationGeometry =
  | { kind: "points"; points: Point[] }
  | { kind: "box"; x: number; y: number; width: number; height: number; rotation?: number }
  | { kind: "segment"; x1: number; y1: number; x2: number; y2: number };

export interface Annotation {
  id: string;
  contactSheetId: string;
  /** When set, the annotation is anchored to a frame and follows it. */
  photoId: string | null;
  /**
   * Anchor of the annotation relative to its frame, normalised against the
   * frame box. Lets us reposition annotations when templates change.
   */
  anchor: { x: number; y: number; scale: number } | null;
  type: AnnotationType;
  tool: AnnotationTool;
  color: string;
  strokeWidth: number;
  opacity: number;
  geometry: AnnotationGeometry;
  text: string | null;
  tapeKind?: TapeKind;
  zIndex: number;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ---------------------------------------------------------------- comments */

export interface Comment {
  id: string;
  contactSheetId: string;
  photoId: string | null;
  authorName: string;
  authorEmail: string | null;
  body: string;
  createdAt: string;
  resolvedAt: string | null;
}

/* -------------------------------------------------------------- share/link */

export type SharingMode = "private" | "link-view" | "link-comment" | "password";

export interface ShareLink {
  id: string;
  contactSheetId: string;
  token: string;
  passwordHash: string | null;
  permission: "view" | "comment";
  expiresAt: string | null;
  createdAt: string;
}

/* --------------------------------------------------------------- templates */

export type TemplateId =
  | "classic-35mm"
  | "darkroom-proof"
  | "photographer-edit"
  | "archival-sheet"
  | "lab-print"
  | "eliz-digital"
  | "postcard";

/** Per-sheet overrides on top of the template defaults. */
export interface TemplateSettings {
  columns?: number;
  frameGap?: number;
  stripGap?: number;
  margin?: number;
  background?: string;
  showSprockets?: boolean;
  showFrameNumbers?: boolean;
  showFilenames?: boolean;
  showTitles?: boolean;
  showMetadata?: boolean;
  showEdgeLabel?: boolean;
  grain?: number;
  edgeLabel?: string;
}

/* ------------------------------------------------------------ contact sheet */

export interface ContactSheet {
  id: string;
  userId: string | null;
  title: string;
  subtitle: string;
  description: string;
  rollNumber: string;
  dateShot: string;
  photographer: string;
  location: string;
  camera: string;
  filmStock: string;
  templateId: TemplateId;
  templateSettings: TemplateSettings;
  sharingMode: SharingMode;
  commentsEnabled: boolean;
  downloadsEnabled: boolean;
  postcard: PostcardData;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
}

export interface PostcardData {
  message: string;
  senderName: string;
  senderAddress: string;
  recipientName: string;
  recipientAddress: string;
  stampNote: string;
}

/** The complete, self-contained document the editor works on. */
export interface SheetDocument {
  schemaVersion: number;
  sheet: ContactSheet;
  photos: Photo[];
  annotations: Annotation[];
  comments: Comment[];
  shareLinks: ShareLink[];
}

/* ----------------------------------------------------------------- exports */

export type ExportFormat = "png" | "jpeg" | "pdf" | "postcard-pdf";

export interface ExportSettings {
  format: ExportFormat;
  /** 1 = screen, 2 = standard print, 4.17 ≈ 300dpi against a 72pt base. */
  scale: number;
  quality: number;
  transparentBackground: boolean;
  includeAnnotations: boolean;
  includeTitles: boolean;
  includeMetadata: boolean;
  trimMarks: boolean;
  bleedMm: number;
  orientation: "portrait" | "landscape";
  postcardSides: "front" | "front-back";
}

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  format: "png",
  scale: 2,
  quality: 0.92,
  transparentBackground: false,
  includeAnnotations: true,
  includeTitles: true,
  includeMetadata: true,
  trimMarks: false,
  bleedMm: 0,
  orientation: "portrait",
  postcardSides: "front-back",
};

/* -------------------------------------------------------- library metadata */

export interface ProjectSummary {
  id: string;
  title: string;
  photoCount: number;
  templateId: TemplateId;
  sharingMode: SharingMode;
  coverThumb: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
}
