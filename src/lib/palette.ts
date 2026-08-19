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

/**
 * Two weights, because a contact sheet only ever asks for two: a line you
 * write with and a line you mark with. Four steps of thickness was a paint
 * program's idea of the problem.
 */
export const STROKE_SIZES = [
  { id: "fine", label: "Fine", short: "Fine", value: 4 },
  { id: "bold", label: "Bold", short: "Bold", value: 11 },
] as const;

export type StrokeSizeId = (typeof STROKE_SIZES)[number]["id"];

/**
 * Type keeps its four steps: a note is small or large, which is a different
 * question from how thick the pencil is, and one that wants finer grading.
 */
export const TEXT_SIZES = [
  { id: "small", label: "Small", short: "S", value: 2.5 },
  { id: "medium", label: "Medium", short: "M", value: 5 },
  { id: "large", label: "Large", short: "L", value: 9 },
  { id: "xlarge", label: "Extra large", short: "XL", value: 15 },
] as const;

export interface SizeOption {
  id: string;
  label: string;
  short: string;
  value: number;
}

/** The weights on offer for whatever is in hand. */
export function sizeOptions(forText: boolean): readonly SizeOption[] {
  return forText ? TEXT_SIZES : STROKE_SIZES;
}

/**
 * Which option a given width belongs to. Widths are plain numbers and older
 * sheets hold values these lists no longer contain, so the nearest one wins
 * rather than the control showing nothing selected.
 */
export function nearestSize(value: number, forText: boolean): SizeOption {
  const options = sizeOptions(forText);
  return options.reduce((best, option) =>
    Math.abs(option.value - value) < Math.abs(best.value - value) ? option : best,
  );
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
  texture: "ink" | "wax" | "crayon" | "bleed";
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
    hint: "Waxy and blunt, dragged over the tooth of the paper",
    // A wax stick is blunt and holds its width; what varies is how much of it
    // reaches the paper, which is the texture's job rather than the geometry's.
    widthScale: 2.4,
    opacity: 0.9,
    thinning: 0.34,
    smoothing: 0.22,
    streamline: 0.26,
    texture: "crayon",
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
  pencil: { ...DRAW_INSTRUMENTS[1], id: "pen", widthScale: 0.6, opacity: 0.78, thinning: 0.7, smoothing: 0.4, streamline: 0.4, texture: "crayon" },
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
