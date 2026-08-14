"use client";

import { createDocument, createPhoto, renumber, uid } from "./document";
import { computeLayout } from "./layout";
import { getStorage } from "./storage/local";
import { rng } from "./hand";
import type { Annotation, Photo, SheetDocument } from "./types";

export const DEMO_SHEET_ID = "sheet_demo_roll_017";

/**
 * The demo roll is generated procedurally — no remote URLs, no bundled photos,
 * nothing that can rot or carry a licence. Each "negative" is a seeded abstract
 * composition rendered to a JPEG, so the sheet looks like a real roll shot in
 * one session.
 */
export async function ensureDemoDocument(force = false): Promise<SheetDocument> {
  const storage = getStorage();
  if (!force) {
    const existing = await storage.loadDocument(DEMO_SHEET_ID);
    if (existing && existing.photos.length > 0) return existing;
  }

  const doc = createDocument({
    id: DEMO_SHEET_ID,
    title: "Harbour Road, Winter",
    subtitle: "Second walk, low sun",
    rollNumber: "017",
    dateShot: "1998-02-14",
    photographer: "A. Vance",
    location: "Newlyn → Mousehole",
    camera: "Nikon FM2 · 35mm f/2",
    filmStock: "Generic Pan 400",
    templateId: "classic-35mm",
    templateSettings: { edgeLabel: "PAN 400" },
    description: "Demo roll. Everything here is editable — drag frames, mark them up, export it.",
  });

  const titles = [
    "Slipway", "Gulls, first light", "Rope coil", "Net loft", "Harbour wall",
    "Blue hull", "Diesel drum", "Ice machine", "Crab pots", "The turn",
    "Wet cobbles", "Chandlery window", "Two masts", "Bollard", "Low tide",
    "Man with flask", "Chalkboard", "Fish crates", "Wheelhouse", "Reflection",
    "Cat, doorway", "Yellow oilskin", "Cable drum", "Steps", "Buoys",
    "Gate latch", "Second slipway", "Long shadow", "Bench", "Backlit rigging",
    "Departure", "Wake", "Headland", "Rain starts", "Last light", "Home",
  ];

  const photos: Photo[] = [];
  for (let i = 0; i < 36; i += 1) {
    const portrait = i % 7 === 3;
    const width = portrait ? 720 : 1080;
    const height = portrait ? 1080 : 720;
    const blob = await renderNegative(`demo-frame-${i}`, width, height);
    const thumb = await renderNegative(`demo-frame-${i}`, portrait ? 240 : 360, portrait ? 360 : 240);
    const storagePath = `demo/${DEMO_SHEET_ID}/frame-${i}.jpg`;
    const thumbPath = `demo/${DEMO_SHEET_ID}/frame-${i}-thumb.jpg`;
    await storage.putAsset(storagePath, blob);
    await storage.putAsset(thumbPath, thumb);

    photos.push(
      createPhoto(DEMO_SHEET_ID, {
        id: `photo_demo_${String(i).padStart(2, "0")}`,
        storagePath,
        thumbPath,
        originalFilename: `ROLL017_${String(i + 1).padStart(3, "0")}.jpg`,
        mimeType: "image/jpeg",
        width,
        height,
        fileSize: blob.size,
        position: i,
        frameNumber: i + 1,
        title: titles[i] ?? "",
        status:
          [2, 11, 26, 8, 30].includes(i)
            ? "pick"
            : [5, 19].includes(i)
              ? "reject"
              : i === 22
                ? "maybe"
                : "unflagged",
        exifData: {
          make: "Nikon",
          model: "FM2",
          focalLength: "35mm",
          aperture: portrait ? "f/2.8" : "f/5.6",
          shutterSpeed: "1/250",
          iso: "400",
          dateTaken: "1998-02-14",
        },
      }),
    );
  }

  doc.photos = renumber(photos);
  doc.annotations = demoAnnotations(doc);
  await storage.saveDocument(doc);
  return doc;
}

function demoAnnotations(doc: SheetDocument): Annotation[] {
  const layout = computeLayout({
    templateId: doc.sheet.templateId,
    templateSettings: doc.sheet.templateSettings,
    photos: doc.photos,
  });
  const frameOf = (index: number) => layout.frames[index];
  const out: Annotation[] = [];
  const base = {
    contactSheetId: doc.sheet.id,
    locked: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    anchor: null,
  };

  // Crop marks on a frame the photographer wants tighter.
  const cropFrame = frameOf(14);
  if (cropFrame) {
    out.push({
      ...base,
      id: uid("anno"),
      photoId: cropFrame.photoId,
      type: "shape",
      tool: "crop",
      color: "#f2c218",
      strokeWidth: 3,
      opacity: 1,
      geometry: {
        kind: "box",
        x: cropFrame.x + cropFrame.width * 0.12,
        y: cropFrame.y + cropFrame.height * 0.1,
        width: cropFrame.width * 0.72,
        height: cropFrame.height * 0.74,
      },
      text: null,
      zIndex: 1,
    });
  }

  // An arrow and a taped-on note in the margin. Everything the demo shows is
  // something the toolbar can still make.
  const noteFrame = frameOf(26);
  if (noteFrame) {
    out.push({
      ...base,
      id: uid("anno"),
      photoId: null,
      type: "shape",
      tool: "arrow",
      color: "#d81f26",
      strokeWidth: 4,
      opacity: 1,
      geometry: {
        kind: "segment",
        x1: noteFrame.x + noteFrame.width + 44,
        y1: noteFrame.y + noteFrame.height + 62,
        x2: noteFrame.x + noteFrame.width * 0.72,
        y2: noteFrame.y + noteFrame.height * 0.8,
      },
      text: null,
      zIndex: 2,
    });
    out.push({
      ...base,
      id: uid("anno"),
      photoId: null,
      type: "tape",
      tool: "tape",
      tapeKind: "paper-white",
      color: "#efece4",
      strokeWidth: 1,
      opacity: 1,
      geometry: {
        kind: "box",
        x: noteFrame.x + noteFrame.width + 22,
        y: noteFrame.y + noteFrame.height + 62,
        width: 178,
        height: 44,
        rotation: -2.5,
      },
      text: "print warm",
      zIndex: 3,
    });
  }

  // Two pieces of tape: a label at the top, masking tape holding a strip.
  out.push({
    ...base,
    id: uid("anno"),
    photoId: null,
    type: "tape",
    tool: "tape",
    tapeKind: "lab-yellow",
    color: "#e8c73c",
    strokeWidth: 1,
    opacity: 1,
    geometry: {
      kind: "box",
      x: layout.width - layout.margin - 210,
      y: layout.margin * 0.3,
      width: 190,
      height: 46,
      rotation: -3.4,
    },
    text: "ROLL 017",
    zIndex: 4,
  });

  const strip = layout.strips[3];
  if (strip) {
    out.push({
      ...base,
      id: uid("anno"),
      photoId: null,
      type: "tape",
      tool: "tape",
      tapeKind: "masking",
      color: "#d9c69a",
      strokeWidth: 1,
      opacity: 1,
      geometry: {
        kind: "box",
        x: strip.x - 34,
        y: strip.y + strip.height * 0.3,
        width: 96,
        height: 34,
        rotation: 8,
      },
      text: null,
      zIndex: 5,
    });
  }

  // A grease-pencil ring in the margin beside the best sequence.
  const seq = frameOf(11);
  if (seq) {
    out.push({
      ...base,
      id: uid("anno"),
      photoId: seq.photoId,
      type: "shape",
      tool: "rect",
      color: "#f2c218",
      strokeWidth: 4,
      opacity: 0.95,
      geometry: {
        kind: "box",
        x: seq.x - 12,
        y: seq.y - 14,
        width: seq.width + 24,
        height: seq.height + 28,
      },
      text: null,
      zIndex: 6,
    });
  }

  return out;
}

/* ------------------------------------------------------- image synthesis */

/**
 * Renders a plausible monochrome "negative": a horizon, a light source, a few
 * silhouette masses, vignette and grain. Deterministic per seed.
 */
async function renderNegative(seed: string, width: number, height: number): Promise<Blob> {
  const rand = rng(seed);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  const warm = rand();
  const sky = 200 + rand() * 45;
  const ground = 26 + rand() * 40;
  const horizon = height * (0.38 + rand() * 0.3);

  const grad = ctx.createLinearGradient(0, 0, width * 0.25, height);
  grad.addColorStop(0, tone(sky, warm));
  grad.addColorStop(Math.min(0.95, horizon / height), tone(sky * 0.55, warm));
  grad.addColorStop(1, tone(ground, warm));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // light source
  const lx = width * (0.15 + rand() * 0.7);
  const ly = horizon * (0.25 + rand() * 0.5);
  const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, Math.max(width, height) * (0.2 + rand() * 0.3));
  glow.addColorStop(0, `rgba(255,252,244,${0.35 + rand() * 0.4})`);
  glow.addColorStop(1, "rgba(255,252,244,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // silhouette masses along the horizon
  const shapes = 3 + Math.floor(rand() * 5);
  for (let i = 0; i < shapes; i += 1) {
    const w = width * (0.06 + rand() * 0.22);
    const h = height * (0.08 + rand() * 0.34);
    const x = width * rand() - w * 0.3;
    const y = horizon - h * (0.3 + rand() * 0.8);
    ctx.fillStyle = `rgba(${Math.round(ground * 0.5)},${Math.round(ground * 0.48)},${Math.round(ground * 0.44)},${0.55 + rand() * 0.4})`;
    if (rand() > 0.55) {
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      ctx.lineTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(x, y, w, h);
    }
  }

  // foreground band
  ctx.fillStyle = `rgba(${Math.round(ground * 0.6)},${Math.round(ground * 0.58)},${Math.round(ground * 0.52)},0.9)`;
  ctx.fillRect(0, horizon + height * (0.18 + rand() * 0.3), width, height);

  // a few bright specular marks
  for (let i = 0; i < 14; i += 1) {
    ctx.fillStyle = `rgba(255,255,250,${rand() * 0.5})`;
    const r = 1 + rand() * (width * 0.006);
    ctx.beginPath();
    ctx.arc(rand() * width, horizon + (rand() - 0.4) * height * 0.4, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // vignette
  const vig = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.25,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.78,
  );
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);

  // grain, tiled from a small cached noise texture — a per-pixel pass over 36
  // full-size frames is slow enough to stall the demo on a modest machine.
  const tile = grainTile();
  if (tile) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    const pattern = ctx.createPattern(tile, "repeat");
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.restore();
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Demo render failed"))),
      "image/jpeg",
      0.82,
    );
  });
}

let grainCanvas: HTMLCanvasElement | null = null;
function grainTile(): HTMLCanvasElement | null {
  if (grainCanvas) return grainCanvas;
  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(size, size);
  const rand = rng("demo-grain");
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (rand() - 0.5) * 150;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 24;
  }
  ctx.putImageData(img, 0, 0);
  grainCanvas = canvas;
  return canvas;
}

function tone(v: number, warm: number): string {
  const r = clamp(v * (1 + warm * 0.06));
  const g = clamp(v * (1 + warm * 0.02));
  const b = clamp(v * (1 - warm * 0.05));
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, v));
}
