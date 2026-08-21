import { expect, test } from "@playwright/test";
import { FILE_INPUT, fakeImages } from "./helpers";

test.describe("sheet orientation", () => {
  test("sits next to Location on the new-sheet form, defaulting to Landscape", async ({ page }) => {
    await page.goto("/new");
    const location = page.getByLabel("Location");
    const orientation = page.getByRole("group", { name: "Orientation" });
    await expect(location).toBeVisible();
    await expect(orientation).toBeVisible();

    const locationBox = (await location.boundingBox())!;
    const orientationBox = (await orientation.boundingBox())!;
    // Same row, side by side.
    expect(Math.abs(locationBox.y - orientationBox.y)).toBeLessThan(4);
    expect(locationBox.x).toBeLessThan(orientationBox.x);

    await expect(orientation.getByRole("button", { name: "Landscape" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("Portrait rotates the grid — the sheet comes out taller than wide", async ({ page }) => {
    await page.goto("/new");
    await page.setInputFiles(FILE_INPUT, fakeImages(21));
    await page
      .getByRole("group", { name: "Orientation" })
      .getByRole("button", { name: "Portrait" })
      .click();
    await page.getByRole("button", { name: "Create" }).click();
    await page.waitForURL(/\/sheet\//, { timeout: 15_000 });

    const svg = page.getByTestId("canvas-stage").locator("svg").first();
    const viewBox = await svg.getAttribute("viewBox");
    const [, , w, h] = viewBox!.split(" ").map(Number);
    expect(h).toBeGreaterThan(w);

    // Same reading order, just stacked down the first column instead of
    // spread across the first row: frames 1-8 share an x, not a y.
    const frames = page.locator("[data-frame-index]");
    const first = (await frames.nth(0).locator("rect").first().getAttribute("x"))!;
    const second = (await frames.nth(1).locator("rect").first().getAttribute("x"))!;
    expect(first).toBe(second);
  });
});
