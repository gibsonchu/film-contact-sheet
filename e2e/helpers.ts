import { expect, type Page } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";

/** Opens the generated demo roll and waits for the sheet to render. */
export async function openDemo(page: Page) {
  await page.goto("/demo");
  await page.waitForURL(/\/sheet\//, { timeout: 60_000 });
  await expect(page.getByTestId("canvas-stage").locator("svg").first()).toBeVisible();
  await page.waitForFunction(
    () => document.querySelectorAll("[data-frame-index]").length >= 36,
    undefined,
    { timeout: 60_000 },
  );
}

export function frame(page: Page, index: number) {
  return page.locator(`[data-frame-index="${index}"]`);
}

/** Drags from one point to another with enough steps to look like a real drag. */
export async function dragBetween(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i += 1) {
    await page.mouse.move(
      from.x + ((to.x - from.x) * i) / 12,
      from.y + ((to.y - from.y) * i) / 12,
    );
  }
  await page.mouse.up();
}

export async function centreOf(page: Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`No bounding box for ${selector}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** A minimal valid 1×1 PNG, used to build synthetic uploads. */
export const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buf) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed), 0);
  return Buffer.concat([len, typed, crc]);
}

/** Builds a solid-colour PNG at exact pixel dimensions — real width/height
 *  are what the auto-rotate-on-upload behaviour keys off of, which the
 *  fixed 1×1 PNG_1PX can never exercise. */
export function makePng(width: number, height: number): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  const rowBytes = 1 + width * 3;
  const raw = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * rowBytes;
    for (let x = 0; x < width; x += 1) {
      const px = row + 1 + x * 3;
      raw[px] = 200;
      raw[px + 1] = 60;
      raw[px + 2] = 60;
    }
  }
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

export function fakeImages(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    name: `frame-${String(i + 1).padStart(3, "0")}.png`,
    mimeType: "image/png",
    buffer: PNG_1PX,
  }));
}

/** The words currently drawn on the sheet, including SVG text annotations. */
export async function sheetText(page: Page): Promise<string> {
  return page.evaluate(() =>
    [...document.querySelectorAll("[data-annotation-id] text")]
      .map((node) => node.textContent ?? "")
      .join(" | "),
  );
}

/** Drives the template listbox, which is a custom control rather than a select. */
export async function chooseTemplate(page: Page, label: RegExp | string) {
  await page.getByRole("combobox", { name: "Sheet template" }).click();
  await page.getByRole("option", { name: label }).click();
}

export function templateButton(page: Page) {
  return page.getByRole("combobox", { name: "Sheet template" });
}

/** The plain multi-file input, as opposed to the directory picker beside it. */
export const FILE_INPUT = 'input[type="file"]:not([webkitdirectory])';
export const FOLDER_INPUT = "input[webkitdirectory]";

/**
 * A real folder on disk: a directory input can only be driven with a path, not
 * with in-memory buffers. Includes the junk a photo folder actually carries.
 */
export function makeImageFolder(count: number, opts?: { withJunk?: boolean }): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fcs-roll-"));
  for (let i = 0; i < count; i += 1) {
    fs.writeFileSync(path.join(dir, `frame-${String(i + 1).padStart(3, "0")}.png`), PNG_1PX);
  }
  if (opts?.withJunk) {
    fs.writeFileSync(path.join(dir, ".DS_Store"), "junk");
    fs.writeFileSync(path.join(dir, "notes.txt"), "hello");
  }
  return dir;
}

/** Opens the demo roll in the original panelled layout. */
export async function openDemoPanels(page: Page) {
  await openDemo(page);
  await page.goto(`${page.url()}/panels`);
  await expect(page.getByTestId("canvas-stage").locator("svg").first()).toBeVisible();
  await page.waitForFunction(
    () => document.querySelectorAll("[data-frame-index]").length >= 36,
    undefined,
    { timeout: 60_000 },
  );
}
