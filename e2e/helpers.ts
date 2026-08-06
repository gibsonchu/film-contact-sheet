import { expect, type Page } from "@playwright/test";

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
