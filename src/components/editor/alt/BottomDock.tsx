"use client";

import { useEffect, useRef, useState } from "react";
import { Family, InkAndSize, InkSwatches } from "../ToolRail";
import {
  IconArrow,
  IconCheck,
  IconCircle,
  IconCrop,
  IconCursor,
  IconEraser,
  IconFullscreen,
  IconHand,
  IconLayers,
  IconLine,
  IconLock,
  IconMarker2 as IconMarker,
  IconPastel,
  IconPen,
  IconRect,
  IconRotate,
  IconSharpie,
  IconSticker,
  IconTape,
  IconText,
  IconTrash,
  IconX,
} from "@/components/icons";
import { IconButton, cx, inputClass } from "@/components/ui/primitives";
import {
  DRAW_INSTRUMENTS,
  INK_COLORS,
  MARK_TOOLS,
  TAPE_KINDS,
  TEXT_FONTS,
  instrumentFor,
  nearestSize,
  sizeOptions,
} from "@/lib/palette";
import { useEditor } from "@/lib/store/editor";
import type { ReviewStatus } from "@/lib/types";

const INSTRUMENT_ICONS: Record<string, typeof IconPen> = {
  pen: IconPen,
  marker: IconMarker,
  pastel: IconPastel,
  sharpie: IconSharpie,
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

const REVIEW: { value: ReviewStatus; label: string; title: string }[] = [
  { value: "pick", label: "Pick", title: "Pick (P)" },
  { value: "maybe", label: "Maybe", title: "Maybe (M)" },
  { value: "reject", label: "Reject", title: "Reject (X)" },
  { value: "unflagged", label: "—", title: "Unflagged (U)" },
];

/**
 * The pencil case, laid on the desk in front of you rather than stood up at
 * the side. Same eight tools as the rail, in reach of the thumb, with the ink
 * kept behind a swatch so the dock stays one row long.
 *
 * Above it sits whatever you have in your hand at the moment: a selected frame
 * shows its title and its verdict, a selected mark shows its ink and weight.
 * When nothing is selected there is nothing there, and the sheet has the room.
 */
export function BottomDock() {
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const instrument = useEditor((s) => s.instrument);
  const markTool = useEditor((s) => s.markTool);
  const sheetFullscreen = useEditor((s) => s.sheetFullscreen);
  const [open, setOpen] = useState<null | "draw" | "marks" | "tape" | "ink">(null);

  const DrawIcon = INSTRUMENT_ICONS[instrument] ?? IconMarker;
  const MarkIcon = MARK_ICONS[markTool] ?? IconCircle;
  const drawingActive = DRAW_INSTRUMENTS.some((i) => i.id === tool);
  const markActive = MARK_TOOLS.some((m) => m.id === tool);

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-2">
      {open === "ink" ? (
        <div
          role="dialog"
          aria-label="Ink and width"
          className="pointer-events-auto rounded-[2px] border border-[var(--line)] bg-charcoal/95 px-3 py-2.5 backdrop-blur"
        >
          <InkAndSize layout="row" />
        </div>
      ) : null}

      <ContextStrip />

      <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-charcoal/95 px-3 py-2 backdrop-blur">
        <IconButton
          label="Select (V)"
          size="lg"
          active={tool === "select"}
          onClick={() => setTool("select")}
        >
          <IconCursor className="h-[21px] w-[21px]" />
        </IconButton>
        <IconButton
          label="Hand / pan (H)"
          size="lg"
          active={tool === "pan"}
          onClick={() => setTool("pan")}
        >
          <IconHand className="h-[21px] w-[21px]" />
        </IconButton>

        <Rule />

        <Family
          label={`Draw — ${instrumentFor(instrument).label} (B)`}
          title="Draw with"
          placement="above"
          size="lg"
          active={drawingActive}
          open={open === "draw"}
          onOpen={(next) => setOpen(next ? "draw" : null)}
          onPick={() => setTool(instrument)}
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
          <DrawIcon className="h-[21px] w-[21px]" />
        </Family>

        <Family
          label={`Marks — ${MARK_TOOLS.find((m) => m.id === markTool)?.label ?? "Circle"}`}
          title="Mark"
          placement="above"
          size="lg"
          active={markActive}
          open={open === "marks"}
          onOpen={(next) => setOpen(next ? "marks" : null)}
          onPick={() => setTool(markTool)}
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
          <MarkIcon className="h-[21px] w-[21px]" />
        </Family>

        <IconButton label="Text (T)" size="lg" active={tool === "text"} onClick={() => setTool("text")}>
          <IconText className="h-[21px] w-[21px]" />
        </IconButton>

        <Family
          label="Tape and stickers"
          title="Add"
          placement="above"
          size="lg"
          active={tool === "tape" || tool === "sticker"}
          open={open === "tape"}
          onOpen={(next) => setOpen(next ? "tape" : null)}
          onPick={() => setTool("tape")}
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
          <IconTape className="h-[21px] w-[21px]" />
        </Family>

        <IconButton
          label="Eraser (E)"
          size="lg"
          active={tool === "eraser"}
          onClick={() => setTool("eraser")}
        >
          <IconEraser className="h-[21px] w-[21px]" />
        </IconButton>

        <Rule />

        {/* The ink lives behind its own colour, so the dock stays one row. */}
        <InkButton open={open === "ink"} onOpen={(next) => setOpen(next ? "ink" : null)} />

        <IconButton
          label="Fullscreen contact sheet (F)"
          size="lg"
          active={sheetFullscreen}
          onClick={() => useEditor.getState().setSheetFullscreen(!sheetFullscreen)}
        >
          <IconFullscreen className="h-[21px] w-[21px]" />
        </IconButton>
      </div>
    </div>
  );
}

function Rule() {
  return <span className="mx-0.5 h-7 w-px bg-[var(--line)]" aria-hidden="true" />;
}

/* ----------------------------------------------------------------- ink */

function InkButton({ open, onOpen }: { open: boolean; onOpen: (v: boolean) => void }) {
  const color = useEditor((s) => s.color);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      // The panel is a sibling up the column rather than a child, so ask it
      // directly whether the click landed inside.
      const panel = document.querySelector('[role="dialog"][aria-label="Ink and width"]');
      if (!ref.current?.contains(target) && !panel?.contains(target)) onOpen(false);
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
  }, [open, onOpen]);

  const name = INK_COLORS.find((c) => c.hex === color)?.label ?? "Ink";

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onOpen(!open)}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={`Ink and width — ${name}`}
      title={`Ink and width — ${name}`}
      className={cx(
        "grid h-12 w-12 place-items-center rounded-full transition-colors",
        open ? "bg-white/10" : "hover:bg-white/6",
      )}
    >
      <span
        className="block h-5 w-5 rounded-full border border-white/25"
        style={{ background: color }}
      />
    </button>
  );
}

/* ------------------------------------------------------------ context */

/** What you have in your hand: a frame, a mark, or nothing at all. */
function ContextStrip() {
  const doc = useEditor((s) => s.doc);
  const photoId = useEditor((s) => s.selectedPhotoId);
  const annotationId = useEditor((s) => s.selectedAnnotationId);

  const photo = doc?.photos.find((p) => p.id === photoId) ?? null;
  const annotation = doc?.annotations.find((a) => a.id === annotationId) ?? null;

  if (annotation) return <Shell><AnnotationControls /></Shell>;
  if (photo) return <Shell><FrameControls /></Shell>;
  return null;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-auto flex max-w-[min(92vw,860px)] items-center gap-2 overflow-x-auto rounded-full border border-[var(--line)] bg-charcoal/95 px-3 py-1.5 backdrop-blur">
      {children}
    </div>
  );
}

function FrameControls() {
  const doc = useEditor((s) => s.doc);
  const id = useEditor((s) => s.selectedPhotoId);
  const updatePhoto = useEditor((s) => s.updatePhoto);
  const rotatePhoto = useEditor((s) => s.rotatePhoto);
  const setStatus = useEditor((s) => s.setStatus);
  const removePhoto = useEditor((s) => s.removePhoto);
  const [noteOpen, setNoteOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const photo = doc?.photos.find((p) => p.id === id);
  if (!photo) return null;

  return (
    <>
      <span className="label shrink-0">Frame {photo.frameNumber || "—"}</span>
      <input
        value={photo.title}
        onChange={(e) => updatePhoto(photo.id, { title: e.target.value })}
        aria-label="Title"
        placeholder="Untitled frame"
        className="w-36 shrink-0 border-none bg-transparent text-[12px] text-warm outline-none placeholder:text-smoke"
      />

      <Rule />

      <div className="flex shrink-0 items-center gap-0.5" role="group" aria-label="Review status">
        {REVIEW.map((r) => (
          <button
            key={r.value}
            type="button"
            title={r.title}
            aria-pressed={photo.status === r.value}
            onClick={() => setStatus(photo.id, r.value)}
            className={cx(
              "rounded-full px-2.5 py-1 text-[11px] transition-colors",
              photo.status === r.value ? "bg-warm text-noir" : "text-smoke hover:text-warm",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <Rule />

      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setNoteOpen((v) => !v)}
          aria-expanded={noteOpen}
          className={cx(
            "rounded-full px-2.5 py-1 text-[11px] transition-colors",
            photo.publicNote || photo.privateNote
              ? "text-warm"
              : "text-smoke hover:text-warm",
          )}
        >
          Notes{photo.publicNote || photo.privateNote ? " ·" : ""}
        </button>
        {noteOpen ? (
          <div className="absolute bottom-[calc(100%+10px)] left-1/2 w-64 -translate-x-1/2 space-y-2 rounded-[2px] border border-[var(--line)] bg-noir p-2">
            <label className="label block">
              Note
              <textarea
                rows={2}
                className={cx(inputClass, "mt-1")}
                value={photo.publicNote}
                onChange={(e) => updatePhoto(photo.id, { publicNote: e.target.value })}
              />
            </label>
            <label className="label block">
              Private note
              <textarea
                rows={2}
                className={cx(inputClass, "mt-1")}
                value={photo.privateNote}
                onChange={(e) => updatePhoto(photo.id, { privateNote: e.target.value })}
              />
            </label>
            <p className="label leading-snug">
              Private notes never leave this sheet — no shares, no exports.
            </p>
          </div>
        ) : null}
      </div>

      <IconButton label="Rotate left" onClick={() => rotatePhoto(photo.id, -90)}>
        <IconRotate className="h-3.5 w-3.5 -scale-x-100" />
      </IconButton>
      <IconButton label="Rotate right" onClick={() => rotatePhoto(photo.id, 90)}>
        <IconRotate className="h-3.5 w-3.5" />
      </IconButton>
      {/* Losing a frame to a stray click is worse than one extra click. */}
      {confirmRemove ? (
        <button
          type="button"
          onClick={() => {
            removePhoto(photo.id);
            setConfirmRemove(false);
          }}
          onBlur={() => setConfirmRemove(false)}
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] text-darkroom transition-colors hover:bg-darkroom hover:text-white"
        >
          Remove?
        </button>
      ) : (
        <IconButton label="Remove frame" onClick={() => setConfirmRemove(true)}>
          <IconTrash className="h-3.5 w-3.5" />
        </IconButton>
      )}
    </>
  );
}

function AnnotationControls() {
  const doc = useEditor((s) => s.doc);
  const id = useEditor((s) => s.selectedAnnotationId);
  const update = useEditor((s) => s.updateAnnotation);
  const remove = useEditor((s) => s.deleteAnnotation);
  const forward = useEditor((s) => s.bringForward);
  const backward = useEditor((s) => s.sendBackward);

  const a = doc?.annotations.find((x) => x.id === id);
  if (!a) return null;

  const isText = a.type === "text";
  const isTape = a.type === "tape";
  const isSticker = a.type === "sticker";
  const rotation = a.geometry.kind === "box" ? (a.geometry.rotation ?? 0) : 0;
  const drawing = DRAW_INSTRUMENTS.find((i) => i.id === a.tool);
  const showOpacity = isText || isTape || isSticker || !drawing || drawing.opacityMatters;

  return (
    <>
      <span className="label shrink-0 capitalize">
        {isText ? "Text" : isTape ? "Tape" : isSticker ? "Sticker" : `${a.tool} mark`}
      </span>

      {isTape ? (
        <div className="flex shrink-0 gap-1">
          {TAPE_KINDS.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.label}
              aria-label={t.label}
              aria-pressed={a.tapeKind === t.id}
              onClick={() => update(a.id, { tapeKind: t.id })}
              className={cx("h-4 w-7 border", a.tapeKind === t.id ? "border-warm" : "border-transparent")}
              style={{ background: t.fill, opacity: t.id === "transparent" ? 0.5 : 1 }}
            />
          ))}
        </div>
      ) : (
        <div className="shrink-0">
          <InkSwatches
            value={a.color}
            onChange={(hex) => update(a.id, { color: hex })}
            size="sm"
          />
        </div>
      )}

      {!isTape && !isSticker ? (
        <>
          <Rule />
          <div
            className="flex shrink-0 gap-0.5"
            role="group"
            aria-label={isText ? "Text size" : "Stroke width"}
          >
            {sizeOptions(isText).map((o) => {
              const active = nearestSize(a.strokeWidth, isText).id === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  title={o.label}
                  aria-pressed={active}
                  onClick={() => update(a.id, { strokeWidth: o.value })}
                  className={cx(
                    "rounded-full px-2.5 py-1 text-[11px] transition-colors",
                    active ? "bg-warm text-noir" : "text-smoke hover:text-warm",
                  )}
                >
                  {isText ? o.short : o.label}
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      {isText ? (
        <>
          <Rule />
          <div className="flex shrink-0 gap-0.5" role="group" aria-label="Lettering">
            {TEXT_FONTS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={(a.font ?? "hand") === f.id}
                onClick={() => update(a.id, { font: f.id })}
                className={cx(
                  "rounded-full px-2 py-1 text-[11px] transition-colors",
                  (a.font ?? "hand") === f.id ? "bg-warm text-noir" : "text-smoke hover:text-warm",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {showOpacity ? (
        <>
          <Rule />
          <label className="label flex shrink-0 items-center gap-1.5">
            Opacity
            <input
              type="range"
              aria-label="Opacity"
              min={0.1}
              max={1}
              step={0.05}
              value={a.opacity}
              onChange={(e) => update(a.id, { opacity: Number(e.target.value) })}
              className="w-16"
            />
          </label>
        </>
      ) : null}

      {a.geometry.kind === "box" ? (
        <label className="label flex shrink-0 items-center gap-1.5">
          Rotate
          <input
            type="range"
            aria-label="Rotation"
            min={-45}
            max={45}
            step={1}
            value={rotation}
            onChange={(e) =>
              update(a.id, {
                geometry: { ...a.geometry, rotation: Number(e.target.value) } as typeof a.geometry,
              })
            }
            className="w-16"
          />
        </label>
      ) : null}

      <Rule />

      <IconButton label="Bring forward" onClick={() => forward(a.id)}>
        <IconLayers className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton label="Send back" onClick={() => backward(a.id)}>
        <IconLayers className="h-3.5 w-3.5 rotate-180" />
      </IconButton>
      <IconButton
        label={a.locked ? "Unlock" : "Lock"}
        active={a.locked}
        onClick={() => update(a.id, { locked: !a.locked })}
      >
        <IconLock className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton label="Delete annotation" onClick={() => remove(a.id)}>
        <IconTrash className="h-3.5 w-3.5" />
      </IconButton>
    </>
  );
}
