"use client";

export const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

export const ACCEPT_ATTR = ".jpg,.jpeg,.png,.webp,.heic,.heif,image/*";

export const MAX_FILE_BYTES = 40 * 1024 * 1024;

export const PREVIEW_MAX_EDGE = 1800;
export const THUMB_MAX_EDGE = 360;

export interface ProcessedImage {
  original: Blob;
  preview: Blob;
  thumb: Blob;
  width: number;
  height: number;
  /** Vertical shots land rotated left (270°) so every frame lays horizontal
   *  on the sheet — the same non-destructive rotation the editor's own
   *  Rotate controls use, not a re-encode of the pixels. */
  rotation: 0 | 90 | 180 | 270;
  mimeType: string;
  fileSize: number;
  originalFilename: string;
}

export function validateFile(file: File): string | null {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  const looksAccepted =
    ACCEPTED_TYPES.includes(type) || /\.(jpe?g|png|webp|heic|heif)$/.test(name);
  if (/\.(cr2|cr3|nef|arw|dng|raf|orf|rw2)$/.test(name)) {
    return "RAW files aren’t supported yet — export a JPEG or PNG first.";
  }
  if (!looksAccepted) return "Unsupported format. Use JPG, PNG, WebP or HEIC.";
  if (file.size > MAX_FILE_BYTES) return "File is larger than 40 MB.";
  if (file.size === 0) return "File is empty.";
  return null;
}

/**
 * Decodes with EXIF orientation applied by the browser, then produces a
 * downscaled editor preview and a thumbnail. The original blob is retained
 * untouched so exports can use full resolution.
 */
export async function processImage(file: File): Promise<ProcessedImage> {
  const bitmap = await decode(file);
  const width = bitmap.width;
  const height = bitmap.height;

  const preview = await resample(bitmap, PREVIEW_MAX_EDGE, 0.88);
  const thumb = await resample(bitmap, THUMB_MAX_EDGE, 0.72);
  bitmap.close?.();

  return {
    original: file,
    preview,
    thumb,
    width,
    height,
    rotation: height > width ? 270 : 0,
    mimeType: file.type || "image/jpeg",
    fileSize: file.size,
    originalFilename: file.name,
  };
}

async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Safari-era fallback; also the path HEIC takes on browsers that can
    // render it through <img> but not through createImageBitmap.
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("Could not decode this image."));
        el.src = url;
      });
      return await createImageBitmap(img);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

async function resample(bitmap: ImageBitmap, maxEdge: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Encode failed"))),
      "image/jpeg",
      quality,
    );
  });
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();

/** Loads (and caches) an <img> for a URL — used by the export rasteriser. */
export function loadImageElement(url: string): Promise<HTMLImageElement> {
  const hit = imageCache.get(url);
  if (hit) return hit;
  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image: ${url}`));
    img.src = url;
  });
  imageCache.set(url, p);
  return p;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
