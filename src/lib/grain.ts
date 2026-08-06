import { rng } from "./hand";

/**
 * A small tiling film-grain texture, generated once per session and cached.
 *
 * A raster tile is used rather than an SVG turbulence filter because the filter
 * would re-run at export scale — on a 6000 × 7400 px sheet that takes minutes.
 * The output is deterministic, so screen and export grain match exactly.
 */
let cached: string | null = null;

export function getGrainTexture(size = 140): string | null {
  if (cached) return cached;
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(size, size);
  const rand = rng("film-grain");
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + (rand() - 0.5) * 190;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = rand() > 0.55 ? 26 : 8;
  }
  ctx.putImageData(img, 0, 0);
  cached = canvas.toDataURL("image/png");
  return cached;
}
