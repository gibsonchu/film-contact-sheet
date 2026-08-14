import type { AnnotationTool, TapeKind } from "./types";

export interface InkColor {
  id: string;
  label: string;
  hex: string;
  /** Grease pencils are chalky and slightly translucent. */
  texture: "grease" | "marker" | "ink";
}

export const INK_COLORS: InkColor[] = [
  { id: "grease-red", label: "Red grease pencil", hex: "#d81f26", texture: "grease" },
  { id: "grease-yellow", label: "Yellow grease pencil", hex: "#f2c218", texture: "grease" },
  { id: "china-white", label: "White china marker", hex: "#f4f1ea", texture: "grease" },
  { id: "marker-black", label: "Black marker", hex: "#141414", texture: "marker" },
  { id: "pen-blue", label: "Blue pen", hex: "#2b5bd7", texture: "ink" },
  { id: "pen-green", label: "Green pen", hex: "#2e9e57", texture: "ink" },
];

export const STROKE_SIZES = [
  { id: "thin", label: "Thin", value: 2.5 },
  { id: "medium", label: "Medium", value: 5 },
  { id: "thick", label: "Thick", value: 9 },
  { id: "extra", label: "Extra thick", value: 15 },
] as const;

export type StrokeSizeId = (typeof STROKE_SIZES)[number]["id"];

/**
 * The same four steps drive stroke weight and type size, but they are not the
 * same idea: a note is small or large, it is not thin or thick. Text gets its
 * own names so the control reads as what it actually does.
 */
const TEXT_SIZE_NAMES: Record<StrokeSizeId, { full: string; short: string }> = {
  thin: { full: "Small", short: "S" },
  medium: { full: "Medium", short: "M" },
  thick: { full: "Large", short: "L" },
  extra: { full: "Extra large", short: "XL" },
};

export function sizeNames(
  size: (typeof STROKE_SIZES)[number],
  forText: boolean,
): { full: string; short: string } {
  if (forText) return TEXT_SIZE_NAMES[size.id];
  return { full: size.label, short: size.label.slice(0, 5) };
}

export const TAPE_KINDS: { id: TapeKind; label: string; fill: string; ink: string }[] = [
  { id: "masking", label: "Masking tape", fill: "#d9c69a", ink: "#3a3025" },
  { id: "artist-red", label: "Red artist tape", fill: "#c8232c", ink: "#fff6f4" },
  { id: "lab-yellow", label: "Lab tape", fill: "#e8c73c", ink: "#3a3117" },
  { id: "paper-white", label: "White paper tape", fill: "#efece4", ink: "#2b2b2b" },
  { id: "transparent", label: "Transparent tape", fill: "#cfd6d8", ink: "#243033" },
  { id: "label", label: "Numbered label", fill: "#f5f2e8", ink: "#1d1d1d" },
  { id: "dot", label: "Sticker dot", fill: "#d81f26", ink: "#ffffff" },
];

/**
 * Tools that draw a freehand stroke rather than a parametric shape.
 *
 * There is one pen. The other freehand ids stay in the type and in TOOL_STYLE
 * so sheets drawn before the toolbar was simplified still render exactly as
 * they were saved — they just can't be selected any more.
 */
export const FREEHAND_TOOLS: AnnotationTool[] = ["pen"];

export const TOOL_LABELS: Record<string, string> = {
  select: "Select",
  pan: "Hand / pan",
  pen: "Pen",
  grease: "Grease pencil",
  marker: "Marker",
  highlighter: "Highlighter",
  pencil: "Pencil",
  eraser: "Eraser",
  text: "Text",
  arrow: "Arrow",
  ellipse: "Circle",
  rect: "Rectangle",
  line: "Line",
  x: "X mark",
  check: "Check mark",
  crop: "Crop marks",
  tape: "Tape",
  sticker: "Sticker dot",
};

/** Per-tool rendering character: how chalky, how wide, how transparent. */
export const TOOL_STYLE: Record<
  string,
  { thinning: number; smoothing: number; streamline: number; opacity: number; widthScale: number }
> = {
  // The pen is chalky and pressure-sensitive — a grease pencil in feel, which
  // is what makes a mark read as something drawn on a print.
  pen: { thinning: 0.6, smoothing: 0.36, streamline: 0.4, opacity: 0.95, widthScale: 1.3 },
  grease: { thinning: 0.65, smoothing: 0.32, streamline: 0.36, opacity: 0.92, widthScale: 1.5 },
  marker: { thinning: 0.15, smoothing: 0.55, streamline: 0.5, opacity: 0.95, widthScale: 1.25 },
  highlighter: { thinning: 0.05, smoothing: 0.6, streamline: 0.55, opacity: 0.38, widthScale: 2.6 },
  pencil: { thinning: 0.7, smoothing: 0.4, streamline: 0.4, opacity: 0.78, widthScale: 0.6 },
};
