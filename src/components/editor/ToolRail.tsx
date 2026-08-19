"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  IconArrow,
  IconCheck,
  IconCircle,
  IconCrop,
  IconCursor,
  IconEraser,
  IconFullscreen,
  IconGrease,
  IconHand,
  IconLine,
  IconMarker2 as IconMarker,
  IconPastel,
  IconPen,
  IconRect,
  IconSharpie,
  IconSticker,
  IconTape,
  IconText,
  IconX,
} from "@/components/icons";
import { IconButton, cx } from "@/components/ui/primitives";
import {
  DRAW_INSTRUMENTS,
  INK_COLORS,
  MARK_TOOLS,
  STROKE_SIZES,
  TAPE_KINDS,
  instrumentFor,
  sizeNames,
} from "@/lib/palette";
import { useEditor, type ToolId } from "@/lib/store/editor";

const INSTRUMENT_ICONS: Record<string, typeof IconPen> = {
  pen: IconPen,
  marker: IconMarker,
  pastel: IconPastel,
  sharpie: IconSharpie,
  grease: IconGrease,
  highlighter: IconMarker,
  pencil: IconPen,
};

const MARK_ICONS: Record<string, typeof IconCircle> = {
  ellipse: IconCircle,
  x: IconX,
  check: IconCheck,
  question: IconText,
  arrow: IconArrow,
  rect: IconRect,
  crop: IconCrop,
  line: IconLine,
};

/**
 * A photographer's pencil case, not a graphics application.
 *
 * Eight things sit in the rail. Related instruments live behind the one that is
 * currently chosen — the rail shows the marker you are drawing with, not four
 * pens at once — and each family opens a small tactile popup.
 */
export function ToolRail() {
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const instrument = useEditor((s) => s.instrument);
  const markTool = useEditor((s) => s.markTool);
  const sheetFullscreen = useEditor((s) => s.sheetFullscreen);
  const [openFamily, setOpenFamily] = useState<null | "draw" | "marks" | "tape">(null);

  const DrawIcon = INSTRUMENT_ICONS[instrument] ?? IconMarker;
  const MarkIcon = MARK_ICONS[markTool] ?? IconCircle;
  const drawingActive = DRAW_INSTRUMENTS.some((i) => i.id === tool);
  const markActive = MARK_TOOLS.some((m) => m.id === tool);

  return (
    <div className="hair-r flex h-full w-[46px] shrink-0 flex-col items-center gap-1 overflow-y-auto py-2">
      <IconButton label="Select (V)" active={tool === "select"} onClick={() => setTool("select")}>
        <IconCursor className="h-[15px] w-[15px]" />
      </IconButton>
      <IconButton label="Hand / pan (H)" active={tool === "pan"} onClick={() => setTool("pan")}>
        <IconHand className="h-[15px] w-[15px]" />
      </IconButton>

      <Divider />

      <Family
        label={`Draw — ${instrumentFor(instrument).label} (B)`}
        active={drawingActive}
        open={openFamily === "draw"}
        onOpen={(next) => setOpenFamily(next ? "draw" : null)}
        onPick={() => setTool(instrument)}
        title="Draw with"
        items={DRAW_INSTRUMENTS.map((i) => {
          const Icon = INSTRUMENT_ICONS[i.id] ?? IconMarker;
          return {
            id: i.id,
            label: i.label,
            hint: i.hint,
            icon: <Icon className="h-4 w-4" />,
            selected: instrument === i.id,
            onSelect: () => useEditor.getState().setInstrument(i.id),
          };
        })}
      >
        <DrawIcon className="h-[15px] w-[15px]" />
      </Family>

      <Family
        label={`Marks — ${MARK_TOOLS.find((m) => m.id === markTool)?.label ?? "Circle"}`}
        active={markActive}
        open={openFamily === "marks"}
        onOpen={(next) => setOpenFamily(next ? "marks" : null)}
        onPick={() => setTool(markTool)}
        title="Mark"
        items={MARK_TOOLS.map((m) => {
          const Icon = MARK_ICONS[m.id] ?? IconCircle;
          return {
            id: m.id,
            label: m.label,
            icon: <Icon className="h-4 w-4" />,
            selected: markTool === m.id,
            onSelect: () => useEditor.getState().setMarkTool(m.id),
          };
        })}
      >
        <MarkIcon className="h-[15px] w-[15px]" />
      </Family>

      <IconButton label="Text (T)" active={tool === "text"} onClick={() => setTool("text")}>
        <IconText className="h-[15px] w-[15px]" />
      </IconButton>

      <Family
        label="Tape and stickers"
        active={tool === "tape" || tool === "sticker"}
        open={openFamily === "tape"}
        onOpen={(next) => setOpenFamily(next ? "tape" : null)}
        onPick={() => setTool("tape")}
        title="Add"
        items={[
          ...TAPE_KINDS.filter((t) => t.id !== "dot").map((t) => ({
            id: t.id,
            label: t.label,
            icon: (
              <span
                className="block h-3 w-6 border border-black/20"
                style={{ background: t.fill, opacity: t.id === "transparent" ? 0.5 : 1 }}
              />
            ),
            selected: false,
            onSelect: () => {
              useEditor.getState().setTapeKind(t.id);
              useEditor.getState().setTool("tape");
            },
          })),
          {
            id: "dot",
            label: "Dot sticker",
            icon: <IconSticker className="h-4 w-4" />,
            selected: false,
            onSelect: () => useEditor.getState().setTool("sticker"),
          },
        ]}
      >
        <IconTape className="h-[15px] w-[15px]" />
      </Family>

      <IconButton label="Eraser (E)" active={tool === "eraser"} onClick={() => setTool("eraser")}>
        <IconEraser className="h-[15px] w-[15px]" />
      </IconButton>

      <Divider />

      <IconButton
        label="Fullscreen contact sheet (F)"
        active={sheetFullscreen}
        onClick={() => useEditor.getState().setSheetFullscreen(!sheetFullscreen)}
      >
        <IconFullscreen className="h-[15px] w-[15px]" />
      </IconButton>

      <Divider />

      <InkAndSize />
    </div>
  );
}

function Divider() {
  return <span className="my-0.5 h-px w-5 bg-[var(--line)]" aria-hidden="true" />;
}

/* ------------------------------------------------------------- families */

export interface FamilyItem {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
}

/**
 * A tool button that both selects its family's current tool and, from the small
 * corner marker, opens the family to change which one that is. The popup goes
 * beside the button in the vertical rail and above it in the bottom dock, so
 * that it never opens off the edge of the window.
 */
export function Family({
  label,
  title,
  active,
  open,
  onOpen,
  onPick,
  items,
  placement = "right",
  size = "sm",
  children,
}: {
  label: string;
  title: string;
  active: boolean;
  open: boolean;
  onOpen: (open: boolean) => void;
  onPick: () => void;
  items: FamilyItem[];
  placement?: "right" | "above";
  size?: "sm" | "md";
  children: React.ReactNode;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const rect = anchorRef.current?.getBoundingClientRect();
    if (rect) {
      setBox(
        placement === "above"
          ? // Centred over the button, kept clear of the window's left edge.
            { left: Math.max(8, rect.left + rect.width / 2 - 88), top: rect.top - 8 }
          : { left: rect.right + 6, top: rect.top },
      );
    }
    const onDown = (e: MouseEvent) => {
      if (!popRef.current?.contains(e.target as Node) && !anchorRef.current?.contains(e.target as Node)) {
        onOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpen, placement]);

  return (
    <div ref={anchorRef} className="relative">
      <IconButton
        label={label}
        active={active}
        size={size}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          onPick();
          onOpen(!open);
        }}
      >
        {children}
      </IconButton>
      {/* The corner notch says there is more behind this one. */}
      <span
        className={cx(
          "pointer-events-none absolute bottom-0.5 right-0.5 block h-0 w-0 border-b-[3px] border-l-[3px] border-b-current border-l-transparent",
          active ? "text-noir" : "text-smoke",
        )}
        aria-hidden="true"
      />

      {open && box
        ? createPortal(
            <div
              ref={popRef}
              role="menu"
              aria-label={title}
              className="fixed z-[60] w-44 border border-[var(--line)] bg-noir py-1"
              style={
                placement === "above"
                  ? { left: box.left, top: box.top, transform: "translateY(-100%)" }
                  : { left: box.left, top: box.top }
              }
            >
              <p className="label px-2 pb-1 pt-0.5">{title}</p>
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    item.onSelect();
                    onOpen(false);
                  }}
                  className={cx(
                    "flex w-full items-center gap-2 px-2 py-1 text-left text-[12px] transition-colors hover:bg-white/10",
                    item.selected ? "text-warm" : "text-smoke",
                  )}
                >
                  <span className="grid h-4 w-6 place-items-center">{item.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.selected ? <span aria-hidden="true">·</span> : null}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/* ------------------------------------------------------- ink and weight */

/** The analog palette, the four weights, and opacity only when it matters. */
export function InkAndSize({ layout = "column" }: { layout?: "column" | "row" } = {}) {
  const tool = useEditor((s) => s.tool);
  const color = useEditor((s) => s.color);
  const setColor = useEditor((s) => s.setColor);
  const strokeWidth = useEditor((s) => s.strokeWidth);
  const setStrokeWidth = useEditor((s) => s.setStrokeWidth);
  const opacity = useEditor((s) => s.opacity);
  const setOpacity = useEditor((s) => s.setOpacity);

  const isText = tool === "text";
  const drawing = DRAW_INSTRUMENTS.find((i) => i.id === tool);
  const showOpacity = Boolean(drawing?.opacityMatters);

  const row = layout === "row";

  return (
    <div className={cx("flex items-center gap-2", row ? "flex-row px-1" : "flex-col px-2 pb-2")}>
      <div className={cx("grid gap-1", row ? "grid-cols-3" : "grid-cols-2")}>
        {INK_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            title={c.label}
            aria-label={c.label}
            aria-pressed={color === c.hex}
            onClick={() => setColor(c.hex)}
            className={cx(
              "h-3.5 w-3.5 border transition-colors",
              color === c.hex ? "border-warm" : "border-transparent hover:border-smoke",
            )}
            style={{ background: c.hex }}
          />
        ))}
      </div>

      <div className={cx("flex items-center gap-1", row ? "flex-row" : "flex-col")}>
        {STROKE_SIZES.map((s, i) => {
          const names = sizeNames(s, isText);
          return (
            <button
              key={s.id}
              type="button"
              title={names.full}
              aria-label={isText ? `${names.full} text` : `${names.full} stroke`}
              aria-pressed={strokeWidth === s.value}
              onClick={() => setStrokeWidth(s.value)}
              className={cx(
                "grid h-4 w-7 place-items-center transition-colors",
                strokeWidth === s.value ? "bg-white/10" : "hover:bg-white/6",
              )}
            >
              {isText ? (
                <span
                  className={cx("leading-none", strokeWidth === s.value ? "text-warm" : "text-smoke")}
                  style={{ fontSize: 7 + i * 2.5 }}
                  aria-hidden="true"
                >
                  A
                </span>
              ) : (
                <span
                  className={cx("block", strokeWidth === s.value ? "bg-warm" : "bg-smoke")}
                  style={{ width: 16, height: Math.max(1, s.value * 0.55) }}
                />
              )}
            </button>
          );
        })}
      </div>

      {showOpacity ? (
        <div className={cx("flex items-center gap-1", row ? "flex-row" : "flex-col")}>
          <input
            type="range"
            aria-label="Opacity"
            min={0.1}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className={row ? "w-16" : "w-9"}
          />
          <span className="label">{Math.round(opacity * 100)}</span>
        </div>
      ) : null}
    </div>
  );
}

export type { ToolId };
