"use client";

import { memo } from "react";
import { cropMarks, handArrow, handCheck, handEllipse, handLine, handRect, handX, rng } from "@/lib/hand";
import { TAPE_KINDS } from "@/lib/palette";
import { textBoxOf } from "@/lib/hit";
import { strokeOutlinePath } from "@/lib/stroke";
import type { Annotation } from "@/lib/types";
import { SHEET_FONT } from "@/lib/fonts";

interface Props {
  annotation: Annotation;
  selected?: boolean;
  interactive?: boolean;
  onPointerDown?: (a: Annotation, e: React.PointerEvent<SVGGElement>) => void;
}

/** Renders one annotation object. Pure — takes geometry, returns SVG. */
function AnnotationViewImpl({ annotation: a, selected, interactive, onPointerDown }: Props) {
  const body = renderBody(a);
  const bounds = annotationBounds(a);

  return (
    <g
      data-annotation-id={a.id}
      opacity={a.opacity}
      style={interactive && !a.locked ? { cursor: "move" } : undefined}
      onPointerDown={interactive && onPointerDown ? (e) => onPointerDown(a, e) : undefined}
      pointerEvents={interactive ? "auto" : "none"}
    >
      {/* invisible hit area so thin strokes are still grabbable */}
      {interactive && bounds ? (
        <rect
          x={bounds.x - 6}
          y={bounds.y - 6}
          width={bounds.width + 12}
          height={bounds.height + 12}
          fill="transparent"
        />
      ) : null}
      {body}
      {selected && bounds ? (
        <rect
          x={bounds.x - 5}
          y={bounds.y - 5}
          width={bounds.width + 10}
          height={bounds.height + 10}
          fill="none"
          stroke="#f2c218"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          pointerEvents="none"
        />
      ) : null}
    </g>
  );
}

export const AnnotationView = memo(AnnotationViewImpl);

function renderBody(a: Annotation) {
  const common = {
    fill: "none" as const,
    stroke: a.color,
    strokeWidth: a.strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (a.type === "stroke" && a.geometry.kind === "points") {
    const isHighlighter = a.tool === "highlighter";
    return (
      <path
        d={strokeOutlinePath(a.geometry.points, a.strokeWidth, a.tool)}
        fill={a.color}
        style={isHighlighter ? { mixBlendMode: "multiply" } : undefined}
      />
    );
  }

  if (a.type === "tape") return <Tape annotation={a} />;
  if (a.type === "sticker") return <Sticker annotation={a} />;

  if (a.type === "text" && a.geometry.kind === "box") {
    const { x, y } = a.geometry;
    const lines = (a.text ?? "").split("\n");
    const size = Math.max(12, a.strokeWidth * 4.2);
    return (
      <text
        x={x}
        y={y}
        fill={a.color}
        fontFamily={SHEET_FONT}
        fontSize={size}
        style={{ userSelect: "none" }}
      >
        {lines.map((line, i) => (
          <tspan key={i} x={x} dy={i === 0 ? 0 : size * 1.2}>
            {line || " "}
          </tspan>
        ))}
      </text>
    );
  }

  if (a.geometry.kind === "box") {
    const { x, y, width, height } = a.geometry;
    switch (a.tool) {
      case "ellipse":
        return (
          <path
            {...common}
            d={handEllipse(x + width / 2, y + height / 2, Math.abs(width) / 2, Math.abs(height) / 2, a.id, {
              laps: 1.25,
            })}
          />
        );
      case "rect":
        return <path {...common} d={handRect(x, y, width, height, a.id)} />;
      case "x": {
        const [p1, p2] = handX(x, y, width, height, a.id);
        return (
          <g>
            <path {...common} d={p1} />
            <path {...common} d={p2} />
          </g>
        );
      }
      case "check":
        return <path {...common} d={handCheck(x, y, Math.min(Math.abs(width), Math.abs(height)) || 30, a.id)} />;
      case "crop":
        return (
          <g>
            {cropMarks(x, y, width, height, a.id).map((d, i) => (
              <path key={i} {...common} d={d} />
            ))}
          </g>
        );
      default:
        return <path {...common} d={handRect(x, y, width, height, a.id)} />;
    }
  }

  if (a.geometry.kind === "segment") {
    const { x1, y1, x2, y2 } = a.geometry;
    if (a.tool === "arrow") {
      const { shaft, head } = handArrow(x1, y1, x2, y2, a.id);
      return (
        <g>
          <path {...common} d={shaft} />
          <path {...common} d={head} />
        </g>
      );
    }
    return <path {...common} d={handLine(x1, y1, x2, y2, a.id)} />;
  }

  return null;
}

/* ------------------------------------------------------------------ tape */

function Tape({ annotation: a }: { annotation: Annotation }) {
  if (a.geometry.kind !== "box") return null;
  const { x, y, width, height, rotation = 0 } = a.geometry;
  const kind = TAPE_KINDS.find((t) => t.id === (a.tapeKind ?? "masking")) ?? TAPE_KINDS[0];
  const rand = rng(a.id);
  const isTransparent = kind.id === "transparent";
  const isLabel = kind.id === "label";

  // Torn ends: the short edges wander, the long edges stay straight.
  const tearAmount = isLabel ? 1 : Math.min(9, width * 0.05);
  const steps = 6;
  const edge = (edgeX: number, from: number, to: number): string[] =>
    Array.from({ length: steps + 1 }, (_, i) => {
      const t = from + ((to - from) * i) / steps;
      const jx = edgeX + (rand() - 0.5) * tearAmount;
      return `L ${jx.toFixed(2)} ${(y + height * t).toFixed(2)}`;
    });

  const path = [
    `M ${x} ${y}`,
    ...edge(x, 0, 1).slice(1),
    `L ${x + width} ${y + height}`,
    ...edge(x + width, 1, 0).slice(1),
    "Z",
  ].join(" ");

  return (
    <g transform={`rotate(${rotation} ${x + width / 2} ${y + height / 2})`}>
      <path
        d={path}
        fill={kind.fill}
        opacity={isTransparent ? 0.42 : 0.96}
        filter="url(#fcs-softshadow)"
      />
      {/* fibre texture */}
      {Array.from({ length: 5 }, (_, i) => (
        <line
          key={i}
          x1={x + 2}
          y1={y + (height * (i + 0.5)) / 5}
          x2={x + width - 2}
          y2={y + (height * (i + 0.5)) / 5 + (rand() - 0.5) * 1.6}
          stroke="#000"
          strokeWidth={0.6}
          opacity={0.05}
        />
      ))}
      {isLabel ? (
        <rect x={x + 2} y={y + 2} width={width - 4} height={height - 4} fill="none" stroke={kind.ink} strokeWidth={0.8} opacity={0.5} />
      ) : null}
      {a.text ? (
        <text
          x={x + width / 2}
          y={y + height / 2 + height * 0.16}
          textAnchor="middle"
          fill={kind.ink}
          fontFamily={SHEET_FONT}
          fontSize={Math.min(height * 0.62, 26)}
          style={{ userSelect: "none" }}
        >
          {a.text}
        </text>
      ) : null}
    </g>
  );
}

function Sticker({ annotation: a }: { annotation: Annotation }) {
  if (a.geometry.kind !== "box") return null;
  const { x, y, width, height } = a.geometry;
  const r = Math.min(Math.abs(width), Math.abs(height)) / 2;
  return (
    <g>
      <circle cx={x + width / 2} cy={y + height / 2} r={r} fill={a.color} filter="url(#fcs-softshadow)" />
      <circle cx={x + width / 2} cy={y + height / 2} r={r} fill="none" stroke="#000" strokeWidth={0.5} opacity={0.18} />
      {a.text ? (
        <text
          x={x + width / 2}
          y={y + height / 2 + r * 0.34}
          textAnchor="middle"
          fill="#fff"
          fontFamily={SHEET_FONT}
          fontSize={r * 0.95}
          style={{ userSelect: "none" }}
        >
          {a.text}
        </text>
      ) : null}
    </g>
  );
}

/* --------------------------------------------------------------- bounds */

export function annotationBounds(
  a: Annotation,
): { x: number; y: number; width: number; height: number } | null {
  const g = a.geometry;
  if (g.kind === "points") {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of g.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    if (!Number.isFinite(minX)) return null;
    const pad = a.strokeWidth;
    return { x: minX - pad, y: minY - pad, width: maxX - minX + pad * 2, height: maxY - minY + pad * 2 };
  }
  if (g.kind === "box") {
    const x = Math.min(g.x, g.x + g.width);
    const y = Math.min(g.y, g.y + g.height);
    const width = Math.abs(g.width);
    const height = Math.abs(g.height);
    if (a.type === "text") return textBoxOf(a);
    return { x, y, width, height };
  }
  const x = Math.min(g.x1, g.x2);
  const y = Math.min(g.y1, g.y2);
  return { x, y, width: Math.abs(g.x2 - g.x1), height: Math.abs(g.y2 - g.y1) };
}

export function translateAnnotation(a: Annotation, dx: number, dy: number): Annotation {
  const g = a.geometry;
  if (g.kind === "points") {
    return { ...a, geometry: { kind: "points", points: g.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })) } };
  }
  if (g.kind === "box") return { ...a, geometry: { ...g, x: g.x + dx, y: g.y + dy } };
  return { ...a, geometry: { kind: "segment", x1: g.x1 + dx, y1: g.y1 + dy, x2: g.x2 + dx, y2: g.y2 + dy } };
}

export function scaleAnnotation(a: Annotation, factor: number, originX: number, originY: number): Annotation {
  const s = (v: number, o: number) => o + (v - o) * factor;
  const g = a.geometry;
  if (g.kind === "points") {
    return {
      ...a,
      strokeWidth: a.strokeWidth * factor,
      geometry: {
        kind: "points",
        points: g.points.map((p) => ({ ...p, x: s(p.x, originX), y: s(p.y, originY) })),
      },
    };
  }
  if (g.kind === "box") {
    return {
      ...a,
      geometry: { ...g, x: s(g.x, originX), y: s(g.y, originY), width: g.width * factor, height: g.height * factor },
    };
  }
  return {
    ...a,
    geometry: {
      kind: "segment",
      x1: s(g.x1, originX),
      y1: s(g.y1, originY),
      x2: s(g.x2, originX),
      y2: s(g.y2, originY),
    },
  };
}
