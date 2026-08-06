"use client";

/**
 * High-resolution export.
 *
 * The editor renders the sheet as one SVG in sheet units. To export we clone
 * that live element, inline every image as a data URI (blob: URLs would taint
 * or fail to load inside a detached SVG document), stamp on print dimensions,
 * and rasterise through a canvas at the requested scale.
 *
 * Chosen over a headless-browser screenshot service because it needs no server,
 * runs offline, and is a byte-for-byte re-render of the same vector description
 * the user is looking at — so text, hand-drawn strokes and film chrome stay
 * crisp at any DPI instead of being upscaled pixels.
 */

const MAX_CANVAS_EDGE = 16384;

export interface RasterOptions {
  scale: number;
  mime?: "image/png" | "image/jpeg";
  quality?: number;
  background?: string | null;
}

export async function rasterizeSvg(
  source: SVGSVGElement,
  { scale, mime = "image/png", quality = 0.92, background = null }: RasterOptions,
): Promise<Blob> {
  const canvas = await rasterizeToCanvas(source, { scale, background });
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the export."))),
      mime,
      quality,
    );
  });
}

export async function rasterizeToCanvas(
  source: SVGSVGElement,
  { scale, background = null }: { scale: number; background?: string | null },
): Promise<HTMLCanvasElement> {
  const viewBox = source.getAttribute("viewBox");
  const [, , vbW, vbH] = (viewBox ?? "0 0 1000 1000").split(/\s+/).map(Number);

  const safeScale = Math.min(scale, MAX_CANVAS_EDGE / Math.max(vbW, vbH));
  const width = Math.round(vbW * safeScale);
  const height = Math.round(vbH * safeScale);

  const clone = source.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  stripInteractiveArtifacts(clone);
  await inlineImages(clone);

  const svgText = new XMLSerializer().serializeToString(clone);
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The sheet could not be rendered for export."));
    img.src = svgUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable in this browser.");
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(image, 0, 0, width, height);
  return canvas;
}

/** Selection outlines, drop targets and cursors must not appear in exports. */
function stripInteractiveArtifacts(root: SVGSVGElement): void {
  root.querySelectorAll("[data-export-hide]").forEach((el) => el.remove());
  root.querySelectorAll<SVGElement>("[style*='cursor']").forEach((el) => {
    el.style.cursor = "";
  });
}

const dataUriCache = new Map<string, string>();

async function inlineImages(root: SVGSVGElement): Promise<void> {
  const images = Array.from(root.querySelectorAll("image"));
  await Promise.all(
    images.map(async (node) => {
      const href = node.getAttribute("href") ?? node.getAttribute("xlink:href");
      if (!href || href.startsWith("data:")) return;
      const dataUri = await toDataUri(href);
      if (!dataUri) {
        node.remove();
        return;
      }
      node.setAttribute("href", dataUri);
      node.removeAttribute("xlink:href");
    }),
  );
}

async function toDataUri(url: string): Promise<string | null> {
  const cached = dataUriCache.get(url);
  if (cached) return cached;
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const dataUri = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(blob);
    });
    dataUriCache.set(url, dataUri);
    return dataUri;
  } catch {
    return null;
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "contact-sheet"
  );
}

/** Scale factor for a target DPI, assuming sheet units are 72-per-inch points. */
export function scaleForDpi(dpi: number): number {
  return dpi / 72;
}
