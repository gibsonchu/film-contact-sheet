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
  IconText,
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
      { id: "text", icon: IconText, label: "Text", key: "T" },
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
    <div className="hair-r flex h-full w-[46px] shrink-0 flex-col gap-2.5 overflow-y-auto py-2">
      {GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col items-center gap-px">
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
                <Icon className="h-[15px] w-[15px]" />
              </IconButton>
            );
          })}
          <span className="mt-1.5 h-px w-5 bg-[var(--line)]" aria-hidden="true" />
        </div>
      ))}

      <div className="flex flex-col items-center gap-1.5 px-2">
        <div className="grid grid-cols-2 gap-1">
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
      </div>

      <div className="flex flex-col items-center gap-1 px-2">
        {STROKE_SIZES.map((s) => (
          <button
            key={s.id}
            type="button"
            title={s.label}
            aria-label={`${s.label} stroke`}
            aria-pressed={strokeWidth === s.value}
            onClick={() => setStrokeWidth(s.value)}
            className={cx(
              "grid h-4 w-7 place-items-center transition-colors",
              strokeWidth === s.value ? "bg-white/10" : "hover:bg-white/6",
            )}
          >
            <span
              className={cx("block", strokeWidth === s.value ? "bg-warm" : "bg-smoke")}
              style={{ width: 16, height: Math.max(1, s.value * 0.55) }}
            />
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center gap-1 px-2">
        <input
          id="tool-opacity"
          type="range"
          aria-label="Opacity"
          min={0.1}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          className="w-9 accent-white"
        />
        <span className="label">{Math.round(opacity * 100)}</span>
      </div>

      {tool === "tape" ? (
        <div className="flex flex-col items-center gap-1 px-2 pb-3">
          {TAPE_KINDS.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.label}
              aria-label={t.label}
              aria-pressed={tapeKind === t.id}
              onClick={() => setTapeKind(t.id)}
              className={cx(
                "h-3 w-7 border",
                tapeKind === t.id ? "border-warm" : "border-transparent",
              )}
              style={{ background: t.fill, opacity: t.id === "transparent" ? 0.5 : 1 }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
