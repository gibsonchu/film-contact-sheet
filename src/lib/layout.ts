import { getTemplate, resolveSettings, type TemplateDef, type TemplatePalette } from "./templates";
import type { Photo, TemplateId, TemplateSettings } from "./types";

/**
 * Geometry engine. Pure functions: (template, settings, photos) -> boxes in
 * sheet units. Both the on-screen SVG and the high-resolution export consume
 * this same layout, which is what keeps the export a pixel-faithful match.
 */

export interface FrameBox {
  /** Slot index within the sheet (0-based). */
  index: number;
  photoId: string | null;
  frameNumber: number;
  /** Image area. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Full slot including caption band — the drop target. */
  slotX: number;
  slotY: number;
  slotWidth: number;
  slotHeight: number;
  /** y for the title/filename caption lines — 0 when that line isn't shown. */
  titleY: number;
  filenameY: number;
  numberX: number;
  numberY: number;
  numberAnchor: "start" | "middle" | "end";
  row: number;
  col: number;
}

export interface StripBox {
  x: number;
  y: number;
  width: number;
  height: number;
  sprocketTopY: number;
  sprocketBottomY: number;
  sprocketHeight: number;
  row: number;
}

export interface SheetLayout {
  template: TemplateDef;
  palette: TemplatePalette;
  settings: ReturnType<typeof resolveSettings>;
  width: number;
  height: number;
  background: string;
  margin: number;
  header: { x: number; y: number; width: number; height: number };
  footer: { x: number; y: number; width: number; height: number };
  content: { x: number; y: number; width: number; height: number };
  strips: StripBox[];
  frames: FrameBox[];
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
}

const HEADER_HEIGHT: Record<string, number> = {
  typeset: 104,
  handwritten: 126,
  lab: 78,
  "order-slip": 92,
  minimal: 68,
  none: 0,
};

const SPROCKET_BAND = 23;
const SPROCKET_INSET = 7;
const STRIP_PAD_X = 16;
/** Gap between the bottom of the photo and its first caption line — Frame
 *  titles most often lands here, so this is effectively "space above the
 *  title". */
const CAPTION_TOP_PAD = 16;
/** Used only if a template forgets to set its own caption line height. */
const CAPTION_LINE_HEIGHT_FALLBACK = 16;

export interface LayoutInput {
  templateId: TemplateId;
  templateSettings?: TemplateSettings;
  photos: Photo[];
  /** "Portrait" rotates the frame grid 90° — same frames, same reading
   *  order, same header/footer/captions, just laid out down the page
   *  instead of across it. Fixed-size cards (a postcard's 6×4 stock) and
   *  film-strip sprockets don't rotate — there's no card stock or strip
   *  housing to redraw, so they keep their natural shape either way. */
  orientation?: "landscape" | "portrait";
  /** Overrides used by exports (e.g. hide titles). */
  overrides?: Partial<{ showTitles: boolean; showFilenames: boolean; showMetadata: boolean }>;
}

export function computeLayout({
  templateId,
  templateSettings,
  photos,
  orientation,
  overrides,
}: LayoutInput): SheetLayout {
  const template = getTemplate(templateId);
  const settings = { ...resolveSettings(templateId, templateSettings), ...(overrides ?? {}) };
  const palette = template.palette;

  const visible = photos.filter((p) => !p.hidden);
  const count = Math.max(visible.length, 1);

  // Cards pick a column count that uses the fixed proportions well, unless the
  // photographer has set one explicitly.
  const autoColumns =
    template.autoColumns && templateSettings?.columns === undefined && template.fixedSize
      ? Math.max(
          1,
          Math.min(
            12,
            Math.round(
              Math.sqrt(
                (count * (template.fixedSize.width / template.fixedSize.height)) /
                  template.frameAspect,
              ),
            ),
          ),
        )
      : null;
  const columns = autoColumns ?? Math.max(1, Math.round(settings.columns));
  const rows = Math.max(1, Math.ceil(count / columns));

  const gap = settings.frameGap;
  const rowGap = settings.stripGap;
  const margin = settings.margin;

  let frameWidth = template.frameWidth;
  let frameHeight = frameWidth / template.frameAspect;

  const headerHeight = HEADER_HEIGHT[template.header] ?? 80;
  const footerHeight = settings.showMetadata ? 54 : 18;

  const isFilm = template.chrome === "film-strip";
  const stripPadY = isFilm ? SPROCKET_BAND + SPROCKET_INSET : 0;

  // A postcard's grid is fitted inside fixed card stock, and a film strip is
  // a physical housing with sprockets along its length — neither has a
  // second shape to rotate into, so orientation only affects the plain
  // thumbnail-grid templates.
  const portrait = orientation === "portrait" && !template.fixedSize && !isFilm;
  // Rotating the table: what was laid out across the page now runs down it.
  // Reading order (row-major over columns/rows) is untouched — only which
  // axis each index maps to on the page flips, along with which gap governs
  // which axis.
  const gridCols = portrait ? rows : columns;
  const gridRows = portrait ? columns : rows;
  const colSpacing = portrait ? rowGap : gap;
  const rowSpacing = portrait ? gap : rowGap;

  // A frame's number sits below the photo, alongside the title/filename,
  // for every style except film-strip (numbered on the strip edge) and
  // "chip" (a number badge printed straight onto the corner of the photo).
  // Whichever of these three lines are actually on stacks compactly, in
  // that order, instead of overlapping each other at a single fixed y.
  const numberBelowPhoto = settings.showFrameNumbers && !isFilm && template.numberStyle !== "chip";
  const showTitleLine = settings.showTitles;
  const showFilenameLine = settings.showFilenames;
  const captionLineHeight = template.captionHeight || CAPTION_LINE_HEIGHT_FALLBACK;
  let nextCaptionRow = 0;
  const numberRowOffset = numberBelowPhoto
    ? CAPTION_TOP_PAD + captionLineHeight * nextCaptionRow++
    : null;
  const titleRowOffset = showTitleLine ? CAPTION_TOP_PAD + captionLineHeight * nextCaptionRow++ : null;
  const filenameRowOffset = showFilenameLine
    ? CAPTION_TOP_PAD + captionLineHeight * nextCaptionRow++
    : null;
  const captionHeight = nextCaptionRow > 0 ? CAPTION_TOP_PAD + nextCaptionRow * captionLineHeight : 0;

  // --- horizontal extent -------------------------------------------------
  let contentWidth = gridCols * frameWidth + (gridCols - 1) * colSpacing;
  if (isFilm) contentWidth += STRIP_PAD_X * 2;

  let width = contentWidth + margin * 2;
  const rowHeight = stripPadY * 2 + frameHeight + captionHeight;
  let contentHeight = gridRows * rowHeight + (gridRows - 1) * rowSpacing;
  let height = margin + headerHeight + contentHeight + footerHeight + margin;
  let contentTop = margin + headerHeight;

  // --- fixed-size templates (cards) fit the grid inside the card ----------
  if (template.fixedSize) {
    width = template.fixedSize.width;
    height = template.fixedSize.height;
    const availableWidth = width - margin * 2;
    const availableHeight = height - margin * 2 - headerHeight - footerHeight;

    // The frame width that satisfies both the horizontal and vertical budget.
    const byWidth = (availableWidth - (columns - 1) * gap) / columns;
    const byHeight =
      ((availableHeight - (rows - 1) * rowGap) / rows - captionHeight) * template.frameAspect;
    frameWidth = Math.max(8, Math.min(byWidth, byHeight));
    frameHeight = frameWidth / template.frameAspect;

    contentWidth = columns * frameWidth + (columns - 1) * gap;
    contentHeight = rows * (frameHeight + captionHeight) + (rows - 1) * rowGap;
    contentTop = margin + headerHeight + Math.max(0, (availableHeight - contentHeight) / 2);
  }

  const contentX = Math.round((width - contentWidth) / 2);
  const contentY = contentTop;

  const strips: StripBox[] = [];
  const frames: FrameBox[] = [];
  const effectiveRowHeight = (isFilm ? stripPadY * 2 : 0) + frameHeight + captionHeight;

  for (let row = 0; row < rows; row += 1) {
    if (isFilm) {
      // isFilm implies !portrait, so the pixel row equals the logical row.
      const stripY = contentY + row * (effectiveRowHeight + rowSpacing);
      strips.push({
        x: contentX,
        y: stripY,
        width: contentWidth,
        height: effectiveRowHeight,
        sprocketTopY: stripY + 4,
        sprocketBottomY: stripY + effectiveRowHeight - SPROCKET_BAND - 4,
        sprocketHeight: SPROCKET_BAND - 8,
        row,
      });
    }
    for (let col = 0; col < columns; col += 1) {
      const index = row * columns + col;
      if (index >= count && index >= visible.length) break;
      const photo = visible[index] ?? null;

      // In landscape, pixel position matches logical position exactly. In
      // portrait, the logical row (a strip of frames read left to right)
      // becomes a pixel column read top to bottom instead.
      const pixelCol = portrait ? row : col;
      const pixelRow = portrait ? col : row;
      const rowY = contentY + pixelRow * (effectiveRowHeight + rowSpacing);
      const x = contentX + (isFilm ? STRIP_PAD_X : 0) + pixelCol * (frameWidth + colSpacing);
      const y = rowY + stripPadY;
      frames.push({
        index,
        photoId: photo ? photo.id : null,
        frameNumber: photo ? photo.frameNumber : index + 1,
        x,
        y,
        width: frameWidth,
        height: frameHeight,
        slotX: x - colSpacing / 2,
        slotY: rowY,
        slotWidth: frameWidth + colSpacing,
        slotHeight: effectiveRowHeight,
        titleY: titleRowOffset !== null ? y + frameHeight + titleRowOffset : 0,
        filenameY: filenameRowOffset !== null ? y + frameHeight + filenameRowOffset : 0,
        numberX: isFilm ? x + 3 : x,
        numberY: isFilm
          ? rowY + effectiveRowHeight - 8
          : y + frameHeight + (numberRowOffset ?? CAPTION_TOP_PAD),
        numberAnchor: "start",
        row: pixelRow,
        col: pixelCol,
      });
    }
  }

  // Sheet dimensions are whole units so exports land on exact pixel counts.
  height = Math.round(height);
  const sheetWidth = Math.round(width);

  return {
    template,
    palette,
    settings,
    width: sheetWidth,
    height,
    background: settings.background ?? palette.paper,
    margin,
    header: { x: margin, y: margin * 0.55, width: sheetWidth - margin * 2, height: headerHeight },
    footer: { x: margin, y: height - margin - footerHeight, width: sheetWidth - margin * 2, height: footerHeight },
    content: { x: contentX, y: contentY, width: contentWidth, height: contentHeight },
    strips,
    frames,
    frameWidth,
    frameHeight,
    columns,
    rows,
  };
}

/** Nearest frame slot to a point, used for drag-and-drop reordering. */
export function frameSlotAt(layout: SheetLayout, x: number, y: number): FrameBox | null {
  let best: FrameBox | null = null;
  let bestDist = Infinity;
  for (const f of layout.frames) {
    const cx = f.x + f.width / 2;
    const cy = f.y + f.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      best = f;
    }
  }
  return best;
}

/** The frame box whose image area contains the point, if any. */
export function frameHitTest(layout: SheetLayout, x: number, y: number): FrameBox | null {
  for (const f of layout.frames) {
    if (x >= f.x && x <= f.x + f.width && y >= f.y && y <= f.y + f.height) return f;
  }
  return null;
}

/**
 * Fit a source image into a frame box under a fit mode, returning the draw rect
 * plus whether clipping is required (fill mode).
 */
export function fitImage(
  frame: { x: number; y: number; width: number; height: number },
  srcWidth: number,
  srcHeight: number,
  mode: "fit" | "fill" | "original",
  rotation = 0,
): { x: number; y: number; width: number; height: number; clip: boolean } {
  const swapped = rotation === 90 || rotation === 270;
  const w = swapped ? srcHeight : srcWidth;
  const h = swapped ? srcWidth : srcHeight;
  if (!w || !h) return { ...frame, clip: false };
  const srcAspect = w / h;
  const boxAspect = frame.width / frame.height;

  if (mode === "fill") {
    let dw = frame.width;
    let dh = frame.width / srcAspect;
    if (dh < frame.height) {
      dh = frame.height;
      dw = frame.height * srcAspect;
    }
    return {
      x: frame.x + (frame.width - dw) / 2,
      y: frame.y + (frame.height - dh) / 2,
      width: dw,
      height: dh,
      clip: true,
    };
  }

  // "original" keeps the true aspect but never exceeds the frame; visually the
  // same rule as fit, kept distinct so future per-format sizing can differ.
  const scale = srcAspect > boxAspect ? frame.width / w : frame.height / h;
  const dw = w * scale;
  const dh = h * scale;
  return {
    x: frame.x + (frame.width - dw) / 2,
    y: frame.y + (frame.height - dh) / 2,
    width: dw,
    height: dh,
    clip: false,
  };
}
