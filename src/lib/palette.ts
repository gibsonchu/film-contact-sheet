import type { AnnotationTool, TapeKind, TextFont } from "./types";

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
 * The four drawing instruments.
 *
 * These are meant to look like different things to draw with, not one stroke
 * under four names: each has its own weight, opacity, how much it thins with
 * pressure, and how its edge breaks up. `texture` picks the rendering
 * treatment in AnnotationView.
 */
export interface DrawInstrument {
  id: Extract<AnnotationTool, "pen" | "marker" | "pastel" | "sharpie">;
  label: string;
  hint: string;
  /** Multiplies the chosen stroke size. */
  widthScale: number;
  opacity: number;
  /** How much the stroke narrows with speed and pressure, 0..1. */
  thinning: number;
  smoothing: number;
  streamline: number;
  texture: "ink" | "wax" | "chalk" | "bleed";
  /** Whether an opacity control is worth showing for it. */
  opacityMatters: boolean;
}

export const DRAW_INSTRUMENTS: DrawInstrument[] = [
  {
    id: "marker",
    label: "Marker",
    hint: "Semi-opaque, waxy, the usual photo-marking tool",
    widthScale: 1.35,
    opacity: 0.85,
    thinning: 0.2,
    smoothing: 0.5,
    streamline: 0.45,
    texture: "wax",
    opacityMatters: true,
  },
  {
    id: "pen",
    label: "Pen",
    hint: "Thin and precise, for notes and arrows",
    widthScale: 0.55,
    opacity: 1,
    thinning: 0.5,
    smoothing: 0.55,
    streamline: 0.55,
    texture: "ink",
    opacityMatters: false,
  },
  {
    id: "pastel",
    label: "Pastel",
    hint: "Soft and chalky, laid straight onto the paper",
    widthScale: 2.1,
    opacity: 0.62,
    thinning: 0.72,
    smoothing: 0.3,
    streamline: 0.3,
    texture: "chalk",
    opacityMatters: true,
  },
  {
    id: "sharpie",
    label: "Sharpie",
    hint: "Dense and dark, with a little bleed",
    widthScale: 1.6,
    opacity: 1,
    thinning: 0.08,
    smoothing: 0.6,
    streamline: 0.5,
    texture: "bleed",
    opacityMatters: false,
  },
];

export const DEFAULT_INSTRUMENT = DRAW_INSTRUMENTS[0].id;

export function instrumentFor(tool: string): DrawInstrument {
  return DRAW_INSTRUMENTS.find((i) => i.id === tool) ?? RETIRED_INSTRUMENTS[tool] ?? DRAW_INSTRUMENTS[0];
}

/**
 * Instruments that are no longer offered but may exist in saved sheets. They
 * keep rendering the way they did when they were drawn.
 */
const RETIRED_INSTRUMENTS: Record<string, DrawInstrument> = {
  grease: { ...DRAW_INSTRUMENTS[0], id: "marker", widthScale: 1.5, opacity: 0.92, thinning: 0.65, smoothing: 0.32, streamline: 0.36, texture: "wax" },
  highlighter: { ...DRAW_INSTRUMENTS[0], id: "marker", widthScale: 2.6, opacity: 0.38, thinning: 0.05, smoothing: 0.6, streamline: 0.55, texture: "wax" },
  pencil: { ...DRAW_INSTRUMENTS[1], id: "pen", widthScale: 0.6, opacity: 0.78, thinning: 0.7, smoothing: 0.4, streamline: 0.4, texture: "chalk" },
};

/** Tools that draw a freehand stroke rather than a parametric shape. */
export const FREEHAND_TOOLS: AnnotationTool[] = [
  "pen",
  "marker",
  "pastel",
  "sharpie",
  "grease",
  "highlighter",
  "pencil",
];

/**
 * The photographic marks, collapsed behind one toolbar item. These are drawn
 * by hand by the photographer — they are not review statuses.
 */
export const MARK_TOOLS: { id: AnnotationTool; label: string }[] = [
  { id: "ellipse", label: "Circle" },
  { id: "x", label: "X" },
  { id: "check", label: "Check" },
  { id: "question", label: "Question mark" },
  { id: "arrow", label: "Arrow" },
  { id: "rect", label: "Rectangle" },
  { id: "crop", label: "Crop marks" },
  { id: "line", label: "Line" },
];

export const TEXT_FONTS: { id: TextFont; label: string; stack: string }[] = [
  { id: "sans", label: "Sans", stack: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  { id: "hand", label: "Handwritten", stack: "'Bradley Hand', 'Segoe Script', 'Snell Roundhand', cursive" },
  { id: "mono", label: "Technical", stack: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" },
];

export function fontStack(font: TextFont | undefined): string {
  return (TEXT_FONTS.find((f) => f.id === font) ?? TEXT_FONTS[0]).stack;
}
