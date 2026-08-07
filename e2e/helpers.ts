import { expect, type Page } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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

export function fakeImages(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    name: `frame-${String(i + 1).padStart(3, "0")}.png`,
    mimeType: "image/png",
    buffer: PNG_1PX,
  }));
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
