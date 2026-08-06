import type { TemplateId, TemplateSettings } from "./types";

/**
 * A template is pure data. The layout engine (`lib/layout.ts`) turns a template
 * plus a photo list into geometry, and the SVG renderer draws that geometry.
 * Adding a new film format (120, 6x6, Polaroid, slide mounts) means adding a
 * record here — no renderer changes.
 */

export type SheetChrome = "film-strip" | "proof" | "plain" | "index" | "card";
export type HeaderStyle = "handwritten" | "typeset" | "lab" | "minimal" | "none";

export interface TemplatePalette {
  /** Sheet background. */
  paper: string;
  /** Film carrier / strip base. */
  base: string;
  /** Background behind an individual image (letterbox colour). */
  frame: string;
  /** Primary text. */
  ink: string;
  /** Secondary text (frame numbers, edge printing). */
  inkMuted: string;
  /** Grease-pencil accent used by status marks. */
  accent: string;
  /** Hairline rules. */
  rule: string;
}

export interface TemplateDef {
  id: TemplateId;
  name: string;
  blurb: string;
  format: string;
  chrome: SheetChrome;
  header: HeaderStyle;
  /** Image frame aspect ratio, width / height. */
  frameAspect: number;
  frameWidth: number;
  palette: TemplatePalette;
  defaults: Required<
    Pick<
      TemplateSettings,
      | "columns"
      | "frameGap"
      | "stripGap"
      | "margin"
      | "showSprockets"
      | "showFrameNumbers"
      | "showFilenames"
      | "showTitles"
      | "showMetadata"
      | "showEdgeLabel"
      | "grain"
      | "edgeLabel"
    >
  >;
  /**
   * Fixed sheet size in sheet units (postcards and other cards). When set, the
   * sheet never grows with the photo count — the grid is fitted inside instead.
   */
  fixedSize?: { width: number; height: number };
  /** Choose the column count from the photo count instead of a fixed value. */
  autoColumns?: boolean;
  /** Caption band height below each frame, when titles/filenames are shown. */
  captionHeight: number;
}

const FILM_DARK: TemplatePalette = {
  paper: "#0b0b0c",
  base: "#131315",
  frame: "#000000",
  ink: "#f2efe9",
  inkMuted: "#8c8880",
  accent: "#d81f26",
  rule: "#2a2a2c",
};

export const TEMPLATES: Record<TemplateId, TemplateDef> = {
  "classic-35mm": {
    id: "classic-35mm",
    name: "Classic 35mm",
    blurb: "Six frames to a strip, sprocket holes top and bottom, edge printing.",
    format: "35mm · 36exp",
    chrome: "film-strip",
    header: "typeset",
    frameAspect: 3 / 2,
    frameWidth: 212,
    palette: {
      paper: "#111112",
      base: "#0a0a0b",
      frame: "#000000",
      ink: "#efece5",
      inkMuted: "#9a958c",
      accent: "#d81f26",
      rule: "#28282a",
    },
    defaults: {
      columns: 6,
      frameGap: 9,
      stripGap: 26,
      margin: 76,
      showSprockets: true,
      showFrameNumbers: true,
      showFilenames: false,
      showTitles: false,
      showMetadata: true,
      showEdgeLabel: true,
      grain: 0.5,
      edgeLabel: "PAN 400",
    },
    captionHeight: 22,
  },
  "darkroom-proof": {
    id: "darkroom-proof",
    name: "Darkroom Proof",
    blurb: "Black board, white-bordered proofs, wide margins for grease pencil.",
    format: "Proof print",
    chrome: "proof",
    header: "handwritten",
    frameAspect: 3 / 2,
    frameWidth: 236,
    palette: {
      paper: "#0d0d0e",
      base: "#0d0d0e",
      frame: "#f4f1ea",
      ink: "#f4f1ea",
      inkMuted: "#8f8b83",
      accent: "#e01e26",
      rule: "#333335",
    },
    defaults: {
      columns: 5,
      frameGap: 30,
      stripGap: 34,
      margin: 96,
      showSprockets: false,
      showFrameNumbers: true,
      showFilenames: false,
      showTitles: true,
      showMetadata: true,
      showEdgeLabel: false,
      grain: 0.35,
      edgeLabel: "PAN 400",
    },
    captionHeight: 26,
  },
  "photographer-edit": {
    id: "photographer-edit",
    name: "Photographer Edit",
    blurb: "Large frames, four to a row. Built to be marked up hard.",
    format: "Edit sheet",
    chrome: "plain",
    header: "minimal",
    frameAspect: 3 / 2,
    frameWidth: 300,
    palette: FILM_DARK,
    defaults: {
      columns: 4,
      frameGap: 40,
      stripGap: 46,
      margin: 104,
      showSprockets: false,
      showFrameNumbers: true,
      showFilenames: false,
      showTitles: true,
      showMetadata: false,
      showEdgeLabel: false,
      grain: 0.3,
      edgeLabel: "PAN 400",
    },
    captionHeight: 28,
  },
  "archival-sheet": {
    id: "archival-sheet",
    name: "Archival Sheet",
    blurb: "Cream stock, hairline grid, typeset roll data. For delivery.",
    format: "Archive",
    chrome: "plain",
    header: "typeset",
    frameAspect: 3 / 2,
    frameWidth: 214,
    palette: {
      paper: "#f3eee3",
      base: "#f3eee3",
      frame: "#e6e0d3",
      ink: "#1a1a19",
      inkMuted: "#6d675c",
      accent: "#a8121a",
      rule: "#c9c1b1",
    },
    defaults: {
      columns: 6,
      frameGap: 20,
      stripGap: 26,
      margin: 88,
      showSprockets: false,
      showFrameNumbers: true,
      showFilenames: false,
      showTitles: false,
      showMetadata: true,
      showEdgeLabel: false,
      grain: 0.18,
      edgeLabel: "PAN 400",
    },
    captionHeight: 22,
  },
  "lab-print": {
    id: "lab-print",
    name: "Lab Print",
    blurb: "Commercial index print. Small thumbnails, file numbers, order slip.",
    format: "Index print",
    chrome: "index",
    header: "lab",
    frameAspect: 3 / 2,
    frameWidth: 168,
    palette: {
      paper: "#ffffff",
      base: "#ffffff",
      frame: "#e9e9e9",
      ink: "#141414",
      inkMuted: "#767676",
      accent: "#c8102e",
      rule: "#d8d8d8",
    },
    defaults: {
      columns: 7,
      frameGap: 14,
      stripGap: 16,
      margin: 56,
      showSprockets: false,
      showFrameNumbers: true,
      showFilenames: true,
      showTitles: false,
      showMetadata: true,
      showEdgeLabel: false,
      grain: 0.1,
      edgeLabel: "PAN 400",
    },
    captionHeight: 20,
  },
  postcard: {
    id: "postcard",
    name: "Postcard",
    blurb: "6 × 4 inch card. Sheet on the front, message and address on the back.",
    format: '6" × 4" card',
    chrome: "card",
    header: "minimal",
    frameAspect: 3 / 2,
    frameWidth: 196,
    // 6 × 4 inches at 200 units/inch.
    fixedSize: { width: 1200, height: 800 },
    autoColumns: true,
    palette: {
      paper: "#0c0c0d",
      base: "#0c0c0d",
      frame: "#000000",
      ink: "#f2efe9",
      inkMuted: "#948f87",
      accent: "#d81f26",
      rule: "#2c2c2e",
    },
    defaults: {
      columns: 4,
      frameGap: 12,
      stripGap: 12,
      margin: 44,
      showSprockets: false,
      showFrameNumbers: true,
      showFilenames: false,
      showTitles: false,
      showMetadata: false,
      showEdgeLabel: false,
      grain: 0.4,
      edgeLabel: "PAN 400",
    },
    captionHeight: 0,
  },
};

export const TEMPLATE_LIST = Object.values(TEMPLATES);

export function getTemplate(id: TemplateId): TemplateDef {
  return TEMPLATES[id] ?? TEMPLATES["classic-35mm"];
}

/** Template defaults merged with the sheet's overrides. */
export function resolveSettings(
  id: TemplateId,
  overrides: TemplateSettings | undefined,
): TemplateDef["defaults"] & { background?: string } {
  const t = getTemplate(id);
  return { ...t.defaults, ...(overrides ?? {}) };
}
