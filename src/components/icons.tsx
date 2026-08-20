import type { SVGProps } from "react";

/**
 * Hand-drawn-ish line icons, built here rather than pulled from an icon set so
 * the toolbar reads like a photographer's pencil case instead of a generic app.
 */

const base = {
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

type P = SVGProps<SVGSVGElement>;

export const IconCursor = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 3 L14.5 10.5 L10.3 11.3 L12.2 16 L10.2 16.8 L8.4 12.2 L5.4 15 Z" />
  </svg>
);

export const IconHand = (p: P) => (
  <svg {...base} {...p}>
    <path d="M7 12V5.6a1.1 1.1 0 0 1 2.2 0V10m0-.6V4.4a1.1 1.1 0 0 1 2.2 0V10m0-.4V5.6a1.1 1.1 0 0 1 2.2 0V12c0 3-1.9 4.8-4.4 4.8S5 15 4.6 12.6L4.2 10c-.2-1 1.3-1.6 1.8-.6L7 12" />
  </svg>
);

export const IconPen = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 17c1.4-.2 2.3-.6 3-1.3L15.4 6.3a1.6 1.6 0 0 0-2.3-2.3L3.9 13.4c-.7.7-1 1.7-.9 3.6Z" />
    <path d="M12.3 5.1 14.3 7.1" />
  </svg>
);

export const IconGrease = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4.5 16.5 6 12.2 13.6 4.4a1.9 1.9 0 0 1 2.7 2.7L8.7 14.7Z" />
    <path d="M4.5 16.5c1.6.4 3-.5 4.2-1.8" />
    <path d="M12.2 5.9 14.8 8.5" />
  </svg>
);

export const IconMarker = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6.5 15.5h7l-1.2-3.2H7.7Z" />
    <path d="M8 12.3V6.2a2 2 0 0 1 4 0v6.1" />
    <path d="M5.8 17.4h8.4" />
  </svg>
);

export const IconHighlighter = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 13.2 12.6 5a1.9 1.9 0 0 1 2.7 2.6l-7.8 8.2H5.4Z" />
    <path d="M3.6 17.6h12.8" strokeWidth={2.4} />
  </svg>
);

export const IconPencil = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 16.4 5 13l8.6-8.6 2.4 2.4L7.4 15.4Z" />
    <path d="M5 13l2.4 2.4" />
  </svg>
);

export const IconEraser = (p: P) => (
  <svg {...base} {...p}>
    <path d="M8.6 16.4h7.6" />
    <path d="M4.2 12.6 10.4 6.4a1.7 1.7 0 0 1 2.4 0l2.6 2.6a1.7 1.7 0 0 1 0 2.4l-4.8 4.8H6.6l-2.4-2.4a1.7 1.7 0 0 1 0-1.2Z" />
  </svg>
);

export const IconText = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 5.2h12M10 5.2v10M7.4 15.2h5.2" />
  </svg>
);

export const IconArrow = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 16 15.4 4.6" />
    <path d="M9.6 4.4h6v6" />
  </svg>
);

export const IconCircle = (p: P) => (
  <svg {...base} {...p}>
    <path d="M16.4 9.4c.3 3.4-2.4 6.4-6 6.6-3.4.2-6.3-2.2-6.6-5.4C3.5 7 6.2 4 9.9 3.8c2.8-.1 5.3 1.6 6.2 4.1" />
  </svg>
);

export const IconRect = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3.6 4.4 16.3 4 16 15.6 3.9 16Z" />
  </svg>
);

export const IconLine = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3.6 15.4c4-1 8-5.4 12.6-10.6" />
  </svg>
);

export const IconX = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4.2 4 15.6 16.2M15.8 4.2 4.4 16" />
  </svg>
);

export const IconCheck = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3.4 10.6 7.6 15.4 16.6 4.4" />
  </svg>
);

/** Four corner brackets — what the tool actually stamps, not a crop symbol. */
export const IconCrop = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3.4 7.4V3.4h4" />
    <path d="M12.6 3.4h4v4" />
    <path d="M16.6 12.6v4h-4" />
    <path d="M7.4 16.6h-4v-4" />
  </svg>
);

export const IconTape = (p: P) => (
  <svg {...base} {...p}>
    <path d="M2.6 7.4 17 5.4l.6 5.2-14.4 2Z" />
    <path d="M6.4 6.9 7 12M11 6.3l.6 5.1" />
  </svg>
);

export const IconSticker = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="10" cy="10" r="6.2" />
    <circle cx="10" cy="10" r="2.4" />
  </svg>
);

/** Chisel-tip marker: a broad wedge on a barrel. */
export const IconMarker2 = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6.4 15.6h7.2l-1.3-3.4H7.7Z" />
    <path d="M8 12.2V6.4a2 2 0 0 1 4 0v5.8" />
    <path d="M5.6 17.6h8.8" strokeWidth={1.8} />
  </svg>
);

/** Pastel stick: a blunt, square crayon. */
export const IconPastel = (p: P) => (
  <svg {...base} {...p}>
    <path d="M7 16.6h6V9.4H7Z" />
    <path d="M7 9.4 8.6 3.6h2.8L13 9.4" />
    <path d="M7.6 12.6h4.8M7.6 14.6h4.8" strokeWidth={1} opacity={0.6} />
  </svg>
);

/** Sharpie: a fat barrel with a conical nib. */
export const IconSharpie = (p: P) => (
  <svg {...base} {...p}>
    <path d="M8.4 16.8 10 13.4l1.6 3.4Z" fill="currentColor" />
    <path d="M10 13.4 8 9.6h4l-2 3.8Z" />
    <rect x="7.4" y="3.2" width="5.2" height="6.4" rx="0.6" />
  </svg>
);

/** Fullscreen: four corners pushing outward. */
export const IconFullscreen = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3.2 7.4V3.2h4.2M12.6 3.2h4.2v4.2M16.8 12.6v4.2h-4.2M7.4 16.8H3.2v-4.2" />
  </svg>
);

/** Settings: a six-toothed gear silhouette, softened by the same rounded
 *  joins as the rest of the set rather than cut sharp. */
export const IconGear = (p: P) => (
  <svg {...base} {...p}>
    <path d="M10 3.6 12.2 6.3 15.5 6.8 14.3 10 15.5 13.2 12.2 13.7 10 16.4 7.9 13.7 4.5 13.2 5.7 10 4.5 6.8 7.9 6.3Z" />
    <circle cx="10" cy="10" r="2.1" />
  </svg>
);

export const IconUndo = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6.4 6.2H3.6V3.4" />
    <path d="M3.9 6.4a6.4 6.4 0 1 1-1 5.6" />
  </svg>
);

export const IconRedo = (p: P) => (
  <svg {...base} {...p}>
    <path d="M13.6 6.2h2.8V3.4" />
    <path d="M16.1 6.4a6.4 6.4 0 1 0 1 5.6" />
  </svg>
);

export const IconZoomIn = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="8.8" cy="8.8" r="5.2" />
    <path d="M12.6 12.8 16.6 16.8M6.6 8.8h4.4M8.8 6.6v4.4" />
  </svg>
);

export const IconZoomOut = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="8.8" cy="8.8" r="5.2" />
    <path d="M12.6 12.8 16.6 16.8M6.6 8.8h4.4" />
  </svg>
);

export const IconFit = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3.4 7V3.6H7M13 3.6h3.6V7M16.6 13v3.4H13M7 16.4H3.4V13" />
  </svg>
);

export const IconStar = (p: P) => (
  <svg {...base} {...p}>
    <path d="M10 3.2 12 8h4.6l-3.7 3 1.4 4.7L10 13l-4.3 2.7L7.1 11 3.4 8H8Z" />
  </svg>
);

export const IconRotate = (p: P) => (
  <svg {...base} {...p}>
    <path d="M16.2 10a6.2 6.2 0 1 1-2-4.6" />
    <path d="M16.6 3v3.6H13" />
  </svg>
);

export const IconEye = (p: P) => (
  <svg {...base} {...p}>
    <path d="M1.8 10S4.8 5 10 5s8.2 5 8.2 5-3 5-8.2 5-8.2-5-8.2-5Z" />
    <circle cx="10" cy="10" r="2.2" />
  </svg>
);

export const IconEyeOff = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 3.4 17 16.8" />
    <path d="M7.4 6.2C4.4 7.4 1.8 10 1.8 10s3 5 8.2 5c1.4 0 2.7-.4 3.8-.9" />
    <path d="M16.4 12.6c1.2-1.2 1.8-2.6 1.8-2.6S15.2 5 10 5c-.6 0-1.1.1-1.6.2" />
  </svg>
);

export const IconTrash = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3.6 5.4h12.8M8 5.2V3.6h4v1.6M5.2 5.6l.8 10.8h8l.8-10.8" />
  </svg>
);

export const IconDownload = (p: P) => (
  <svg {...base} {...p}>
    <path d="M10 3v9.4M6.2 9l3.8 3.8L13.8 9M3.6 16.4h12.8" />
  </svg>
);

export const IconShare = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="15" cy="4.8" r="2.2" />
    <circle cx="5" cy="10" r="2.2" />
    <circle cx="15" cy="15.2" r="2.2" />
    <path d="M7 8.9 13 6M7 11.1 13 14" />
  </svg>
);

export const IconLock = (p: P) => (
  <svg {...base} {...p}>
    <rect x="4.4" y="8.6" width="11.2" height="8" rx="1" />
    <path d="M6.8 8.4V6.6a3.2 3.2 0 0 1 6.4 0v1.8" />
  </svg>
);

export const IconLayers = (p: P) => (
  <svg {...base} {...p}>
    <path d="m10 3 6.6 3.4L10 9.8 3.4 6.4Z" />
    <path d="m3.4 10.2 6.6 3.4 6.6-3.4M3.4 13.8 10 17.2l6.6-3.4" />
  </svg>
);

export const IconGrid = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3.4 3.6h5.2v5.2H3.4ZM11.4 3.6h5.2v5.2h-5.2ZM3.4 11.4h5.2v5.2H3.4ZM11.4 11.4h5.2v5.2h-5.2Z" />
  </svg>
);

export const IconFilm = (p: P) => (
  <svg {...base} {...p}>
    <rect x="2.4" y="5" width="15.2" height="10" rx="0.8" />
    <path d="M2.4 7.2h15.2M2.4 12.8h15.2M6 5v2.2M10 5v2.2M14 5v2.2M6 12.8V15M10 12.8V15M14 12.8V15" />
  </svg>
);
