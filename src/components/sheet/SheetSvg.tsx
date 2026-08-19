"use client";

import { memo, useMemo, type CSSProperties, type ReactNode, type Ref } from "react";
import type { FrameBox, SheetLayout } from "@/lib/layout";
import { cropMarks, frameTilt, handCheck, handEllipse, handQuestion, handStar, handX } from "@/lib/hand";
import { getGrainTexture } from "@/lib/grain";
import { SHEET_FONT } from "@/lib/fonts";
import { CrayonFilter } from "@/components/CrayonFilter";
import type { PickMark, Photo, SheetDocument } from "@/lib/types";

export interface SheetRenderOptions {
  includeAnnotations: boolean;
  includeTitles: boolean;
  includeMetadata: boolean;
  includeStatusMarks: boolean;
  transparentBackground: boolean;
  grain: boolean;
}

export const DEFAULT_RENDER_OPTIONS: SheetRenderOptions = {
  includeAnnotations: true,
  includeTitles: true,
  includeMetadata: true,
  includeStatusMarks: true,
  transparentBackground: false,
  grain: true,
};

interface Props {
  doc: SheetDocument;
  layout: SheetLayout;
  urls: Record<string, string>;
  options?: Partial<SheetRenderOptions>;
  svgRef?: Ref<SVGSVGElement>;
  className?: string;
  style?: CSSProperties;
  selectedPhotoId?: string | null;
  dimmedPhotoIds?: Set<string>;
  draggingPhotoId?: string | null;
  dropIndex?: number | null;
  children?: ReactNode;
  onFramePointerDown?: (frame: FrameBox, event: React.PointerEvent<SVGGElement>) => void;
  onFrameDoubleClick?: (frame: FrameBox) => void;
  interactive?: boolean;
}

/**
 * The single source of truth for what a contact sheet looks like. The editor
 * mounts it live; the exporter serialises this exact element and rasterises it
 * at print scale, which is why a 300dpi PNG matches the screen precisely.
 */
function SheetSvgImpl({
  doc,
  layout,
  urls,
  options,
  svgRef,
  className,
  style,
  selectedPhotoId,
  dimmedPhotoIds,
  draggingPhotoId,
  dropIndex,
  children,
  onFramePointerDown,
  onFrameDoubleClick,
  interactive = false,
}: Props) {
  const opts = { ...DEFAULT_RENDER_OPTIONS, ...(options ?? {}) };
  const { palette, settings, template } = layout;
  const photoById = useMemo(() => new Map(doc.photos.map((p) => [p.id, p])), [doc.photos]);
  const grainUrl = useMemo(() => (settings.grain > 0 ? getGrainTexture() : null), [settings.grain]);

  const showTitles = Boolean(settings.showTitles && opts.includeTitles);
  const showFilenames = Boolean(settings.showFilenames && opts.includeTitles);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width={layout.width}
      height={layout.height}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      role="img"
      aria-label={`Contact sheet: ${doc.sheet.title}`}
    >
      <defs>
        <filter id="fcs-softshadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" floodOpacity="0.35" />
        </filter>

        <CrayonFilter id="fcs-crayon" />
        {grainUrl ? (
          <>
            <pattern id="fcs-grain" width="140" height="140" patternUnits="userSpaceOnUse">
              <image href={grainUrl} width="140" height="140" />
            </pattern>
            {/* Reused at a smaller pitch to give pastel its chalky body. */}
            <pattern id="fcs-chalk" width="46" height="46" patternUnits="userSpaceOnUse">
              <image href={grainUrl} width="46" height="46" />
            </pattern>
          </>
        ) : null}
      </defs>

      {!opts.transparentBackground ? (
        <rect width={layout.width} height={layout.height} fill={layout.background} />
      ) : null}

      <SheetHeader layout={layout} doc={doc} />

      {layout.strips.map((strip) => (
        <FilmStrip key={strip.row} strip={strip} layout={layout} />
      ))}

      {layout.frames.map((frame) => {
        const photo = frame.photoId ? photoById.get(frame.photoId) ?? null : null;
        return (
          <FrameCell
            key={frame.index}
            frame={frame}
            photo={photo}
            layout={layout}
            urls={urls}
            showTitles={showTitles}
            showFilenames={showFilenames}
            showStatus={opts.includeStatusMarks}
            pickMark={doc.sheet.pickMark ?? "circle"}
            selected={Boolean(photo && photo.id === selectedPhotoId)}
            dimmed={Boolean(photo && dimmedPhotoIds?.has(photo.id))}
            dragging={Boolean(photo && photo.id === draggingPhotoId)}
            dropTarget={dropIndex === frame.index}
            interactive={interactive}
            onPointerDown={onFramePointerDown}
            onDoubleClick={onFrameDoubleClick}
          />
        );
      })}

      {settings.showMetadata && opts.includeMetadata ? (
        <SheetFooter layout={layout} doc={doc} />
      ) : null}

      {opts.grain && grainUrl ? (
        <rect
          width={layout.width}
          height={layout.height}
          fill="url(#fcs-grain)"
          opacity={settings.grain * 0.5}
          style={{ mixBlendMode: palette.paper === "#ffffff" ? "multiply" : "screen" }}
          pointerEvents="none"
        />
      ) : null}

      {template.chrome === "card" ? (
        <rect
          x={4}
          y={4}
          width={layout.width - 8}
          height={layout.height - 8}
          fill="none"
          stroke={palette.rule}
          strokeWidth={1}
          pointerEvents="none"
        />
      ) : null}

      {opts.includeAnnotations ? children : null}
    </svg>
  );
}

export const SheetSvg = memo(SheetSvgImpl);

/* ---------------------------------------------------------------- header */

function SheetHeader({ layout, doc }: { layout: SheetLayout; doc: SheetDocument }) {
  const { header, palette, template } = layout;
  const sheet = doc.sheet;
  const style = template.header;
  if (style === "none") return null;

  const baseY = header.y + header.height * 0.52;
  const metaBits = [sheet.rollNumber && `ROLL ${sheet.rollNumber}`, sheet.filmStock, sheet.dateShot]
    .filter(Boolean)
    .join("   ·   ");

  if (style === "handwritten") {
    return (
      <g pointerEvents="none">
        <text
          x={header.x}
          y={baseY}
          fill={palette.ink}
          fontFamily={SHEET_FONT}
          fontSize={40}
          letterSpacing="0.5"
        >
          {sheet.title}
        </text>
        <text
          x={header.x}
          y={baseY + 30}
          fill={palette.accent}
          fontFamily={SHEET_FONT}
          fontSize={22}
        >
          {[sheet.photographer, sheet.location].filter(Boolean).join("  ·  ")}
        </text>
        <text
          x={header.x + header.width}
          y={baseY}
          textAnchor="end"
          fill={palette.inkMuted}
          fontFamily={SHEET_FONT}
          fontSize={15}
          letterSpacing="2"
        >
          {metaBits}
        </text>
        <line
          x1={header.x}
          y1={header.y + header.height - 6}
          x2={header.x + header.width}
          y2={header.y + header.height - 6}
          stroke={palette.rule}
          strokeWidth={1}
        />
      </g>
    );
  }

  if (style === "order-slip") {
    // A bordered notes bar to write in, and the lab's order number and date in
    // a box at the top right — the anatomy of a scanning-lab index print.
    const slipWidth = 132;
    const barWidth = header.width - slipWidth - 14;
    const barHeight = header.height - 30;
    return (
      <g pointerEvents="none">
        <rect
          x={header.x}
          y={header.y}
          width={barWidth}
          height={barHeight}
          fill="none"
          stroke={palette.rule}
          strokeWidth={1.4}
        />
        <text
          x={header.x + 9}
          y={header.y + 19}
          fill={palette.ink}
          fontFamily={SHEET_FONT}
          fontSize={13}
        >
          Notes:
        </text>
        {sheet.description ? (
          <text
            x={header.x + 58}
            y={header.y + 19}
            fill={palette.inkMuted}
            fontFamily={SHEET_FONT}
            fontSize={12}
          >
            {truncate(sheet.description, Math.floor(barWidth / 6))}
          </text>
        ) : null}

        <rect
          x={header.x + header.width - slipWidth}
          y={header.y}
          width={slipWidth}
          height={26}
          fill="none"
          stroke={palette.rule}
          strokeWidth={1.6}
        />
        <text
          x={header.x + header.width - slipWidth + 8}
          y={header.y + 18}
          fill={palette.ink}
          fontFamily={SHEET_FONT}
          fontSize={15}
          letterSpacing="0.6"
        >
          {(sheet.rollNumber || "00000000").slice(0, 12)}
        </text>
        <text
          x={header.x + header.width - slipWidth + 8}
          y={header.y + 44}
          fill={palette.ink}
          fontFamily={SHEET_FONT}
          fontSize={12}
          letterSpacing="0.4"
        >
          {sheet.dateShot ? sheet.dateShot.replace(/-/g, "/") : ""}
        </text>
      </g>
    );
  }

  if (style === "lab") {
    return (
      <g pointerEvents="none">
        <rect
          x={0}
          y={0}
          width={layout.width}
          height={header.height * 0.72}
          fill={palette.frame}
          opacity={0.45}
        />
        <text
          x={header.x}
          y={header.height * 0.45}
          fill={palette.ink}
          fontFamily={SHEET_FONT}
          fontSize={19}
          letterSpacing="1.5"
        >
          {sheet.title.toUpperCase()}
        </text>
        <text
          x={header.x + header.width}
          y={header.height * 0.45}
          textAnchor="end"
          fill={palette.inkMuted}
          fontFamily={SHEET_FONT}
          fontSize={14}
          letterSpacing="1"
        >
          {`ORDER ${sheet.rollNumber || "—"}   ${doc.photos.length} FRAMES`}
        </text>
      </g>
    );
  }

  if (style === "minimal") {
    return (
      <g pointerEvents="none">
        <text
          x={header.x}
          y={baseY + 6}
          fill={palette.ink}
          fontFamily={SHEET_FONT}
          fontSize={28}
          letterSpacing="-0.4"
        >
          {sheet.title}
        </text>
        <text
          x={header.x + header.width}
          y={baseY + 6}
          textAnchor="end"
          fill={palette.inkMuted}
          fontFamily={SHEET_FONT}
          fontSize={14}
          letterSpacing="2"
        >
          {metaBits}
        </text>
      </g>
    );
  }

  // typeset
  return (
    <g pointerEvents="none">
      <text
        x={header.x}
        y={baseY - 6}
        fill={palette.ink}
        fontFamily={SHEET_FONT}
        fontSize={34}
        fontWeight={500}
        letterSpacing="-0.6"
      >
        {sheet.title}
      </text>
      {doc.sheet.subtitle ? (
        <text
          x={header.x}
          y={baseY + 24}
          fill={palette.inkMuted}
          fontFamily={SHEET_FONT}
          fontSize={17}
        >
          {doc.sheet.subtitle}
        </text>
      ) : null}
      <text
        x={header.x + header.width}
        y={baseY - 6}
        textAnchor="end"
        fill={palette.inkMuted}
        fontFamily={SHEET_FONT}
        fontSize={14}
        letterSpacing="2.2"
      >
        {metaBits}
      </text>
      <line
        x1={header.x}
        y1={layout.header.y + layout.header.height - 14}
        x2={header.x + header.width}
        y2={layout.header.y + layout.header.height - 14}
        stroke={layout.palette.rule}
        strokeWidth={1}
      />
    </g>
  );
}

function SheetFooter({ layout, doc }: { layout: SheetLayout; doc: SheetDocument }) {
  const { footer, palette } = layout;
  const sheet = doc.sheet;
  const left = [sheet.photographer, sheet.location, sheet.camera].filter(Boolean).join("   ·   ");
  const counts = doc.photos.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});
  const right = [
    `${doc.photos.filter((p) => !p.hidden).length} FRAMES`,
    counts.favorite ? `${counts.favorite} FAV` : null,
    counts.selected ? `${counts.selected} SEL` : null,
    counts.rejected ? `${counts.rejected} REJ` : null,
  ]
    .filter(Boolean)
    .join("   ·   ");

  return (
    <g pointerEvents="none">
      <line
        x1={footer.x}
        y1={footer.y}
        x2={footer.x + footer.width}
        y2={footer.y}
        stroke={palette.rule}
        strokeWidth={1}
      />
      <text
        x={footer.x}
        y={footer.y + 24}
        fill={palette.inkMuted}
        fontFamily={SHEET_FONT}
        fontSize={13}
        letterSpacing="1.6"
      >
        {left.toUpperCase()}
      </text>
      <text
        x={footer.x + footer.width}
        y={footer.y + 24}
        textAnchor="end"
        fill={palette.inkMuted}
        fontFamily={SHEET_FONT}
        fontSize={13}
        letterSpacing="1.6"
      >
        {right}
      </text>
    </g>
  );
}

/* ------------------------------------------------------------ film strip */

function FilmStrip({ strip, layout }: { strip: SheetLayout["strips"][number]; layout: SheetLayout }) {
  const { palette, settings } = layout;
  const holes = useMemo(() => {
    if (!settings.showSprockets) return [];
    const holeW = 12;
    const gap = 9;
    const pitch = holeW + gap;
    const count = Math.floor((strip.width - 14) / pitch);
    const startX = strip.x + (strip.width - (count * pitch - gap)) / 2;
    return Array.from({ length: count }, (_, i) => startX + i * pitch);
  }, [strip.width, strip.x, settings.showSprockets]);

  return (
    <g pointerEvents="none">
      <rect
        x={strip.x}
        y={strip.y}
        width={strip.width}
        height={strip.height}
        fill={palette.base}
        rx={2}
      />
      {settings.showSprockets ? (
        <>
          {holes.map((x, i) => (
            <g key={i}>
              <rect
                x={x}
                y={strip.sprocketTopY}
                width={12}
                height={strip.sprocketHeight}
                rx={2.6}
                fill={layout.background}
              />
              <rect
                x={x}
                y={strip.sprocketBottomY}
                width={12}
                height={strip.sprocketHeight}
                rx={2.6}
                fill={layout.background}
              />
            </g>
          ))}
          {settings.showEdgeLabel ? (
            <text
              x={strip.x + 20}
              y={strip.sprocketTopY + strip.sprocketHeight + 11}
              fill={palette.accent}
              fontFamily={SHEET_FONT}
              fontSize={9}
              letterSpacing="3.4"
              opacity={0.85}
            >
              {`${settings.edgeLabel}  ${settings.edgeLabel}  ${settings.edgeLabel}`.slice(0, 64)}
            </text>
          ) : null}
        </>
      ) : null}
    </g>
  );
}

/* ----------------------------------------------------------- frame cell */

interface FrameCellProps {
  frame: FrameBox;
  photo: Photo | null;
  layout: SheetLayout;
  urls: Record<string, string>;
  showTitles: boolean;
  showFilenames: boolean;
  showStatus: boolean;
  pickMark: PickMark;
  selected: boolean;
  dimmed: boolean;
  dragging: boolean;
  dropTarget: boolean;
  interactive: boolean;
  onPointerDown?: (frame: FrameBox, e: React.PointerEvent<SVGGElement>) => void;
  onDoubleClick?: (frame: FrameBox) => void;
}

function FrameCell({
  frame,
  photo,
  layout,
  urls,
  showTitles,
  showFilenames,
  showStatus,
  pickMark,
  selected,
  dimmed,
  dragging,
  dropTarget,
  interactive,
  onPointerDown,
  onDoubleClick,
}: FrameCellProps) {
  const { palette, settings, template } = layout;
  const url = photo ? urls[photo.storagePath] ?? urls[photo.thumbPath] ?? null : null;
  // Butted thumbnails must not be tilted — the block reads as one printed sheet.
  const tilt =
    photo && template.chrome !== "contact"
      ? frameTilt(photo.id, template.chrome === "film-strip" ? 0.22 : 0.5)
      : 0;
  const isProofStyle = template.chrome === "proof";
  const border = isProofStyle ? 9 : 0;

  const crop = photo?.cropData ?? { x: 0, y: 0, width: 1, height: 1 };
  const swapped = photo ? photo.rotation === 90 || photo.rotation === 270 : false;
  const cx = frame.x + frame.width / 2;
  const cy = frame.y + frame.height / 2;
  const innerW = swapped ? frame.height : frame.width;
  const innerH = swapped ? frame.width : frame.height;

  const label = photo
    ? [showTitles ? photo.title : "", showFilenames ? photo.originalFilename : ""]
        .filter(Boolean)
        .join("  ")
    : "";

  return (
    <g
      transform={`rotate(${tilt} ${cx} ${cy})`}
      opacity={dragging ? 0.35 : dimmed ? 0.22 : 1}
      style={interactive ? { cursor: "pointer" } : undefined}
      onPointerDown={interactive && onPointerDown ? (e) => onPointerDown(frame, e) : undefined}
      onDoubleClick={interactive && onDoubleClick ? () => onDoubleClick(frame) : undefined}
      data-frame-index={frame.index}
      data-photo-id={photo?.id ?? ""}
    >
      {/* frame bed */}
      {isProofStyle ? (
        <rect
          x={frame.x - border}
          y={frame.y - border}
          width={frame.width + border * 2}
          height={frame.height + border * 2}
          fill={palette.frame}
          filter="url(#fcs-softshadow)"
        />
      ) : (
        <rect x={frame.x} y={frame.y} width={frame.width} height={frame.height} fill={palette.frame} />
      )}

      {photo && url && !photo.blank ? (
        <g transform={swapped ? `rotate(${photo.rotation} ${cx} ${cy})` : undefined}>
          <svg
            x={cx - innerW / 2}
            y={cy - innerH / 2}
            width={innerW}
            height={innerH}
            viewBox={`${crop.x * photo.width} ${crop.y * photo.height} ${crop.width * photo.width} ${
              crop.height * photo.height
            }`}
            preserveAspectRatio={photo.fit === "fill" ? "xMidYMid slice" : "xMidYMid meet"}
          >
            <image
              href={url}
              x={0}
              y={0}
              width={photo.width}
              height={photo.height}
              transform={
                photo.rotation === 180
                  ? `rotate(180 ${photo.width / 2} ${photo.height / 2})`
                  : undefined
              }
              preserveAspectRatio="none"
            />
          </svg>
        </g>
      ) : (
        <rect
          x={frame.x}
          y={frame.y}
          width={frame.width}
          height={frame.height}
          fill="none"
          stroke={palette.rule}
          strokeWidth={1}
          strokeDasharray="5 5"
        />
      )}

      {template.chrome === "plain" || template.chrome === "index" ? (
        <rect
          x={frame.x}
          y={frame.y}
          width={frame.width}
          height={frame.height}
          fill="none"
          stroke={palette.rule}
          strokeWidth={1}
        />
      ) : null}

      {settings.showFrameNumbers && photo && !photo.hidden ? (
        template.numberStyle === "chip" ? (
          <NumberChip frame={frame} label={formatFrameNumber(frame.frameNumber)} />
        ) : (
          <text
            x={frame.numberX}
            y={frame.numberY}
            fill={palette.inkMuted}
            fontFamily={SHEET_FONT}
            fontSize={template.chrome === "film-strip" ? 11 : 12}
            letterSpacing="1.2"
          >
            {formatFrameNumber(frame.frameNumber)}
          </text>
        )
      ) : null}

      {label ? (
        <text
          x={frame.x}
          y={frame.captionY}
          fill={palette.inkMuted}
          fontFamily={SHEET_FONT}
          fontSize={11}
          letterSpacing="0.6"
        >
          {truncate(label, Math.floor(frame.width / 6))}
        </text>
      ) : null}

      {showStatus && photo ? (
        <StatusMark frame={frame} photo={photo} accent={palette.accent} pickMark={pickMark} />
      ) : null}

      {selected ? (
        <rect
          x={frame.x - 5}
          y={frame.y - 5}
          width={frame.width + 10}
          height={frame.height + 10}
          fill="none"
          stroke="#f2c218"
          strokeWidth={2}
          strokeDasharray="7 4"
          pointerEvents="none"
        />
      ) : null}

      {dropTarget ? (
        <rect
          x={frame.x - 4}
          y={frame.y - 4}
          width={frame.width + 8}
          height={frame.height + 8}
          fill="none"
          stroke={palette.accent}
          strokeWidth={3}
          pointerEvents="none"
        />
      ) : null}
    </g>
  );
}

/** Lab-print frame number: black on a small white chip, over the frame corner. */
function NumberChip({ frame, label }: { frame: FrameBox; label: string }) {
  if (!label) return null;
  const height = Math.max(11, frame.height * 0.14);
  const width = 7 + label.length * height * 0.55;
  const y = frame.y + frame.height - height;
  return (
    <g pointerEvents="none">
      <rect x={frame.x} y={y} width={width} height={height} fill="#ffffff" />
      <text
        x={frame.x + 3.5}
        y={y + height * 0.78}
        fill="#111111"
        fontFamily={SHEET_FONT}
        fontSize={height * 0.76}
      >
        {label}
      </text>
    </g>
  );
}

/* ---------------------------------------------------------- status mark */

/**
 * The review mark drawn on a frame. These are structured metadata rendered as
 * marks, not freehand drawing: they follow the photograph when frames are
 * reordered, and they are set and cleared with P / M / X / U.
 */
function StatusMark({
  frame,
  photo,
  accent,
  pickMark,
}: {
  frame: FrameBox;
  photo: Photo;
  accent: string;
  pickMark: PickMark;
}) {
  const seed = `${photo.id}:${photo.status}`;
  const stroke = Math.max(2.4, frame.width * 0.016);
  const common = {
    fill: "none" as const,
    stroke: accent,
    strokeWidth: stroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    opacity: 0.92,
    pointerEvents: "none" as const,
  };
  const cx = frame.x + frame.width / 2;
  const cy = frame.y + frame.height / 2;

  if (photo.status === "pick") {
    if (pickMark === "check") {
      const size = Math.min(frame.width, frame.height) * 0.34;
      return <path {...common} strokeWidth={stroke * 1.15} d={handCheck(cx - size * 0.5, cy - size * 0.3, size, seed)} />;
    }
    if (pickMark === "dot") {
      return <circle cx={cx} cy={cy} r={Math.min(frame.width, frame.height) * 0.11} fill={accent} opacity={0.9} />;
    }
    if (pickMark === "star") {
      return <path {...common} d={handStar(cx, cy, Math.min(frame.width, frame.height) * 0.3, seed)} />;
    }
    // The contact-sheet convention, and the default.
    return (
      <path
        {...common}
        d={handEllipse(cx, cy, frame.width * 0.47, frame.height * 0.47, seed, { laps: 1.4, wobble: 0.05 })}
      />
    );
  }

  if (photo.status === "reject") {
    const [a, b] = handX(frame.x, frame.y, frame.width, frame.height, seed);
    return (
      <g>
        <path {...common} d={a} />
        <path {...common} d={b} />
      </g>
    );
  }

  if (photo.status === "maybe") {
    const size = Math.min(frame.width, frame.height) * 0.3;
    const [hook, dot] = handQuestion(
      frame.x + frame.width - size * 0.95,
      frame.y + frame.height - size * 0.7,
      size,
      seed,
    );
    return (
      <g>
        <path {...common} d={hook} />
        <path {...common} strokeWidth={stroke * 1.6} d={dot} />
      </g>
    );
  }

  return null;
}

/** Crop-mark decoration used by the crop tool. */
export function CropMarkGroup({
  x,
  y,
  width,
  height,
  color,
  strokeWidth,
  seed,
  opacity = 1,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
  seed: string;
  opacity?: number;
}) {
  const marks = cropMarks(x, y, width, height, seed);
  return (
    <g opacity={opacity}>
      {marks.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

/* --------------------------------------------------------------- helpers */

export function formatFrameNumber(n: number): string {
  if (!n) return "";
  return String(n);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 1))}…`;
}
