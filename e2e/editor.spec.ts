import { expect, test } from "@playwright/test";
import { centreOf, dragBetween, frame, openDemo } from "./helpers";

test.describe("contact sheet editor", () => {
  test("renders the demo roll as a 36-frame contact sheet", async ({ page }) => {
    await openDemo(page);
    await expect(page.locator("[data-frame-index]")).toHaveCount(36);
    await expect(page.getByRole("button", { name: /^All/ })).toBeVisible();
    await expect(page.locator("text=Harbour Road, Winter").first()).toBeVisible();
  });

  test("reordering by drag renumbers the frames", async ({ page }) => {
    await openDemo(page);
    const firstPhoto = await frame(page, 0).getAttribute("data-photo-id");
    const from = await centreOf(page, '[data-frame-index="0"]');
    const to = await centreOf(page, '[data-frame-index="4"]');

    await dragBetween(page, from, to);

    await expect
      .poll(async () => frame(page, 4).getAttribute("data-photo-id"))
      .toBe(firstPhoto);
    const numbers = await page
      .locator("[data-frame-index]")
      .evaluateAll((nodes) => nodes.map((n) => Number(n.getAttribute("data-frame-index"))));
    expect(numbers.slice(0, 5)).toEqual([0, 1, 2, 3, 4]);
  });

  test("drawing with the grease pencil adds an editable annotation, and undo removes it", async ({
    page,
  }) => {
    await openDemo(page);
    const before = await page.locator("[data-annotation-id]").count();

    await page.getByRole("button", { name: /Grease pencil/ }).click();
    const start = await centreOf(page, '[data-frame-index="30"]');
    await dragBetween(page, start, { x: start.x + 120, y: start.y + 30 });

    await expect(page.locator("[data-annotation-id]")).toHaveCount(before + 1);

    await page.getByRole("button", { name: /^Undo/ }).click();
    await expect(page.locator("[data-annotation-id]")).toHaveCount(before);

    await page.getByRole("button", { name: /^Redo/ }).click();
    await expect(page.locator("[data-annotation-id]")).toHaveCount(before + 1);
  });

  test("review status can be set from the keyboard and survives a reload", async ({ page }) => {
    await openDemo(page);
    await frame(page, 5).click();
    await page.getByLabel("Title", { exact: true }).fill("Blue hull, reprint");
    await page.keyboard.press("Tab");
    // Re-focus the sheet without tripping double-click (which would enlarge it).
    await page.waitForTimeout(500);
    await frame(page, 5).click();
    await page.keyboard.press("f");

    const statusGroup = page.getByRole("group", { name: "Review status" });
    await expect(statusGroup.getByRole("button", { name: "Fav" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Autosave is debounced; give it a beat before reloading.
    await page.waitForTimeout(1200);
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll("[data-frame-index]").length >= 36);
    await frame(page, 5).click();
    await expect(
      page.getByRole("group", { name: "Review status" }).getByRole("button", { name: "Fav" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Blue hull, reprint");
  });

  test("switching template keeps frames, statuses and annotations", async ({ page }) => {
    await openDemo(page);
    const annotations = await page.locator("[data-annotation-id]").count();

    await page.getByRole("button", { name: /Darkroom Proof/ }).click();
    await expect(page.locator("[data-frame-index]")).toHaveCount(36);
    await expect(page.locator("[data-annotation-id]")).toHaveCount(annotations);

    await page.getByRole("button", { name: /Archival Sheet/ }).click();
    await expect(page.locator("[data-frame-index]")).toHaveCount(36);
    await expect(page.locator("[data-annotation-id]")).toHaveCount(annotations);
  });

  test("enlarged viewer navigates with the keyboard and closes with escape", async ({ page }) => {
    await openDemo(page);
    await frame(page, 2).dblclick();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("3 / 36")).toBeVisible();

    await page.keyboard.press("ArrowRight");
    await expect(dialog.getByText("4 / 36")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  });
});
