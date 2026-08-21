import { expect, test } from "@playwright/test";
import { FILE_INPUT, makePng } from "./helpers";

test.describe("auto-rotating vertical photos", () => {
  test("a vertical upload lands rotated left; a horizontal one is untouched", async ({ page }) => {
    await page.goto("/new");
    await page.setInputFiles(FILE_INPUT, [
      { name: "a-landscape.png", mimeType: "image/png", buffer: makePng(120, 60) },
      { name: "b-portrait.png", mimeType: "image/png", buffer: makePng(60, 120) },
    ]);

    await page.getByRole("button", { name: "Create" }).click();
    await page.waitForURL(/\/sheet\//, { timeout: 15_000 });

    const occupied = page.locator('[data-photo-id]:not([data-photo-id=""])');
    await expect(occupied).toHaveCount(2);

    // The renderer swaps a photo's own image group into a 270° rotate only
    // when Photo.rotation is 270 — the same mechanism the editor's "Rotate
    // left" button drives, just applied automatically on upload.
    const rotatedLeft = occupied.locator("g[transform^='rotate(270']");
    await expect(rotatedLeft).toHaveCount(1);
  });
});
