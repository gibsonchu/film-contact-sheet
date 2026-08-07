"use client";

import {
  IconArrow,
  IconCheck,
  IconCircle,
  IconCrop,
  IconCursor,
  IconEraser,
  IconGrease,
  IconHand,
  IconLine,
  IconRect,
  IconSticker,
  IconTape,
  IconX,
} from "@/components/icons";
import { IconButton, cx } from "@/components/ui/primitives";
import { INK_COLORS, STROKE_SIZES, TAPE_KINDS } from "@/lib/palette";
import { useEditor, type ToolId } from "@/lib/store/editor";

const GROUPS: { label: string; tools: { id: ToolId; icon: typeof IconGrease; label: string; key?: string }[] }[] = [
  {
    label: "Navigate",
    tools: [
      { id: "select", icon: IconCursor, label: "Select", key: "V" },
      { id: "pan", icon: IconHand, label: "Hand / pan", key: "H" },
    ],
  },
  {
    label: "Draw",
    tools: [
      { id: "pen", icon: IconGrease, label: "Pen", key: "P" },
      { id: "eraser", icon: IconEraser, label: "Eraser", key: "E" },
    ],
  },
  {
    label: "Mark",
    tools: [
      { id: "ellipse", icon: IconCircle, label: "Circle", key: "O" },
      { id: "x", icon: IconX, label: "X mark" },
      { id: "check", icon: IconCheck, label: "Check mark" },
      { id: "arrow", icon: IconArrow, label: "Arrow", key: "A" },
      { id: "rect", icon: IconRect, label: "Rectangle", key: "R" },
      { id: "line", icon: IconLine, label: "Line" },
      { id: "crop", icon: IconCrop, label: "Crop marks", key: "C" },
    ],
  },
  {
    label: "Stick",
    tools: [
      { id: "tape", icon: IconTape, label: "Tape" },
      { id: "sticker", icon: IconSticker, label: "Sticker dot" },
    ],
  },
];

export function ToolRail() {
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const color = useEditor((s) => s.color);
  const setColor = useEditor((s) => s.setColor);
  const strokeWidth = useEditor((s) => s.strokeWidth);
  const setStrokeWidth = useEditor((s) => s.setStrokeWidth);
  const opacity = useEditor((s) => s.opacity);
  const setOpacity = useEditor((s) => s.setOpacity);
  const tapeKind = useEditor((s) => s.tapeKind);
  const setTapeKind = useEditor((s) => s.setTapeKind);

  return (
    <div className="flex h-full w-[64px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-white/8 bg-charcoal py-3">
      {GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col items-center gap-0.5">
          <span className="sr-only">{group.label} tools</span>
          {group.tools.map((t) => {
            const Icon = t.icon;
            return (
              <IconButton
                key={t.id}
                label={t.key ? `${t.label} (${t.key})` : t.label}
                active={tool === t.id}
                onClick={() => setTool(t.id)}
              >
                <Icon className="h-[18px] w-[18px]" />
              </IconButton>
            );
          })}
          <span className="mt-1 h-px w-7 bg-white/8" aria-hidden="true" />
        </div>
      ))}

      <div className="flex flex-col items-center gap-1.5 px-2">
        <span className="label">Ink</span>
        <div className="grid grid-cols-2 gap-1.5">
          {INK_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              title={c.label}
              aria-label={c.label}
              aria-pressed={color === c.hex}
              onClick={() => setColor(c.hex)}
              className={cx(
                "h-5 w-5 rounded-full border transition-transform",
                color === c.hex ? "scale-110 border-warm" : "border-white/25 hover:scale-105",
              )}
              style={{ background: c.hex }}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-1 px-2">
        <span className="label">Size</span>
        {STROKE_SIZES.map((s) => (
          <button
            key={s.id}
            type="button"
            title={s.label}
            aria-label={`${s.label} stroke`}
            aria-pressed={strokeWidth === s.value}
            onClick={() => setStrokeWidth(s.value)}
            className={cx(
              "grid h-6 w-8 place-items-center border",
              strokeWidth === s.value ? "border-grease/70 bg-grease/10" : "border-transparent hover:border-white/15",
            )}
          >
            <span
              className="block rounded-full bg-bone"
              style={{ width: 18, height: Math.max(1.5, s.value * 0.7) }}
            />
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center gap-1 px-2">
        <label className="label" htmlFor="tool-opacity">
          Opac
        </label>
        <input
          id="tool-opacity"
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          className="w-10 accent-[#f2c218]"
        />
        <span className="label">{Math.round(opacity * 100)}</span>
      </div>

      {tool === "tape" ? (
        <div className="flex flex-col items-center gap-1 px-2 pb-3">
          <span className="label">Tape</span>
          {TAPE_KINDS.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.label}
              aria-label={t.label}
              aria-pressed={tapeKind === t.id}
              onClick={() => setTapeKind(t.id)}
              className={cx(
                "h-4 w-9 border",
                tapeKind === t.id ? "border-grease" : "border-white/15",
              )}
              style={{ background: t.fill, opacity: t.id === "transparent" ? 0.5 : 1 }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
