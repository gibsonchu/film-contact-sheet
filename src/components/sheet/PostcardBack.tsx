"use client";

import type { Ref } from "react";
import { SHEET_FONT } from "@/lib/fonts";
import type { ContactSheet } from "@/lib/types";

interface Props {
  sheet: ContactSheet;
  width: number;
  height: number;
  svgRef?: Ref<SVGSVGElement>;
  className?: string;
}

/**
 * The reverse of a postcard: message on the left, address block on the right,
 * stamp box top-right — the standard postal layout, sized to match the front.
 */
export function PostcardBack({ sheet, width, height, svgRef, className }: Props) {
  const m = Math.min(width, height) * 0.06;
  const divider = width * 0.52;
  const p = sheet.postcard;
  const lines = (p.message || "").split("\n").slice(0, 12);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Postcard back"
    >
      <rect width={width} height={height} fill="#f4f1e8" />
      <rect x={2} y={2} width={width - 4} height={height - 4} fill="none" stroke="#d8d2c4" strokeWidth={1} />

      {/* message side */}
      <text x={m} y={m + 14} fill="#8a8377" fontFamily={SHEET_FONT} fontSize={11} letterSpacing="2.4">
        {(sheet.title || "CONTACT SHEET").toUpperCase()}
      </text>
      {lines.map((line, i) => (
        <text
          key={i}
          x={m}
          y={m + 52 + i * 26}
          fill="#20201e"
          fontFamily={SHEET_FONT}
          fontSize={20}
        >
          {line}
        </text>
      ))}
      {p.senderName ? (
        <text x={m} y={height - m} fill="#4a463e" fontFamily={SHEET_FONT} fontSize={19}>
          — {p.senderName}
        </text>
      ) : null}

      {/* divider */}
      <line x1={divider} y1={m} x2={divider} y2={height - m} stroke="#cfc8b8" strokeWidth={1.2} />

      {/* stamp box */}
      <rect
        x={width - m - 74}
        y={m}
        width={74}
        height={92}
        fill="none"
        stroke="#cfc8b8"
        strokeWidth={1.2}
        strokeDasharray="5 4"
      />
      <text
        x={width - m - 37}
        y={m + 50}
        textAnchor="middle"
        fill="#b3ab9a"
        fontFamily={SHEET_FONT}
        fontSize={9}
        letterSpacing="1.4"
      >
        STAMP
      </text>

      {/* address block */}
      <text
        x={divider + m}
        y={m + 130}
        fill="#20201e"
        fontFamily={SHEET_FONT}
        fontSize={17}
      >
        {p.recipientName}
      </text>
      {(p.recipientAddress || "").split("\n").slice(0, 5).map((line, i) => (
        <text
          key={i}
          x={divider + m}
          y={m + 158 + i * 24}
          fill="#2c2b27"
          fontFamily={SHEET_FONT}
          fontSize={15}
        >
          {line}
        </text>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <line
          key={i}
          x1={divider + m}
          y1={m + 168 + i * 24}
          x2={width - m}
          y2={m + 168 + i * 24}
          stroke="#ded7c7"
          strokeWidth={0.8}
        />
      ))}
    </svg>
  );
}
