import { expect, test } from "@playwright/test";
import { centreOf, chooseTemplate, dragBetween, frame, openDemo, sheetText } from "./helpers";

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

  test("drawing with the pen adds an editable annotation, and undo removes it", async ({
    page,
  }) => {
    await openDemo(page);
    const before = await page.locator("[data-annotation-id]").count();

    await page.getByRole("button", { name: /^Draw —/ }).click();
    await page.getByRole("menu", { name: "Draw with" }).getByRole("menuitem", { name: "Pen" }).click();
    const start = await centreOf(page, '[data-frame-index="30"]');
    await dragBetween(page, start, { x: start.x + 120, y: start.y + 30 });

    await expect(page.locator("[data-annotation-id]")).toHaveCount(before + 1);

    await page.getByRole("button", { name: /^Undo/ }).click();
    await expect(page.locator("[data-annotation-id]")).toHaveCount(before);

    await page.getByRole("button", { name: /^Redo/ }).click();
    await expect(page.locator("[data-annotation-id]")).toHaveCount(before + 1);
  });

  test("the eraser removes a drawn stroke without a pixel-perfect click", async ({ page }) => {
    await openDemo(page);
    const before = await page.locator("[data-annotation-id]").count();

    await page.getByRole("button", { name: /^Draw —/ }).click();
    await page.getByRole("menu", { name: "Draw with" }).getByRole("menuitem", { name: "Pen" }).click();
    const start = await centreOf(page, '[data-frame-index="20"]');
    await dragBetween(page, start, { x: start.x + 160, y: start.y });
    await expect(page.locator("[data-annotation-id]")).toHaveCount(before + 1);

    // Track the stroke itself, so nothing else on the demo sheet can stand in
    // for it and make this pass or fail by accident.
    const strokeId = await page.evaluate(() => {
      const marks = [...document.querySelectorAll("[data-annotation-id]")];
      return marks[marks.length - 1]?.getAttribute("data-annotation-id") ?? "";
    });
    const stroke = page.locator(`[data-annotation-id="${strokeId}"]`);
    await expect(stroke).toHaveCount(1);

    await page.getByRole("button", { name: /^Eraser/ }).click();

    // Over the sheet but clear of any ink: nothing is erased.
    const sheet = await page.getByTestId("canvas-stage").locator("svg").first().boundingBox();
    if (!sheet) throw new Error("no sheet");
    await page.mouse.click(sheet.x + 10, sheet.y + 10);
    await expect(stroke).toHaveCount(1);
    await expect(page.locator("[data-annotation-id]")).toHaveCount(before + 1);

    // A near miss — how anyone actually aims — erases it.
    await page.mouse.click(start.x + 80, start.y + 8);
    await expect(stroke).toHaveCount(0);
    await expect(page.locator("[data-annotation-id]")).toHaveCount(before);
  });

  test("text can be written on the sheet, then re-opened and edited", async ({ page }) => {
    await openDemo(page);
    const before = await page.locator("[data-annotation-id]").count();

    await page.getByRole("button", { name: /^Text/ }).click();
    const spot = await centreOf(page, '[data-frame-index="24"]');
    await page.mouse.click(spot.x, spot.y);

    const editor = page.getByLabel("Annotation text");
    await expect(editor).toBeVisible();
    await editor.fill("reprint warmer");
    await page.keyboard.press("Escape");

    await expect(editor).toBeHidden();
    await expect(page.locator("[data-annotation-id]")).toHaveCount(before + 1);
    await expect.poll(() => sheetText(page)).toContain("reprint warmer");

    // Double-clicking the text puts it back in the editor with its content.
    await page.getByRole("button", { name: "Select (V)" }).click();
    await page.locator("[data-annotation-id]").last().dblclick();
    await expect(editor).toHaveValue("reprint warmer");

    await editor.fill("reprint much warmer");
    await page.keyboard.press("Escape");
    await expect.poll(() => sheetText(page)).toContain("reprint much warmer");
    await expect(page.locator("[data-annotation-id]")).toHaveCount(before + 1);
  });

  test("empty text is discarded rather than left invisible on the sheet", async ({ page }) => {
    await openDemo(page);
    const before = await page.locator("[data-annotation-id]").count();

    await page.getByRole("button", { name: /^Text/ }).click();
    const spot = await centreOf(page, '[data-frame-index="12"]');
    await page.mouse.click(spot.x, spot.y);
    await expect(page.getByLabel("Annotation text")).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(page.locator("[data-annotation-id]")).toHaveCount(before);
  });

  test("review status can be set from the keyboard and survives a reload", async ({ page }) => {
    await openDemo(page);
    await frame(page, 5).click();
    await page.getByLabel("Title", { exact: true }).fill("Blue hull, reprint");
    await page.keyboard.press("Tab");
    await frame(page, 5).click();
    await page.keyboard.press("p");

    const statusGroup = page.getByRole("group", { name: "Review status" });
    await expect(statusGroup.getByRole("button", { name: "Pick", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Autosave is debounced; give it a beat before reloading.
    await page.waitForTimeout(1200);
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll("[data-frame-index]").length >= 36);
    await frame(page, 5).click();
    await expect(
      page
        .getByRole("group", { name: "Review status" })
        .getByRole("button", { name: "Pick", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Blue hull, reprint");
  });

  test("each surrounding panel folds away and comes back", async ({ page }) => {
    await openDemo(page);

    const rail = page.getByRole("button", { name: "Select (V)" });
    const inspector = page.getByRole("combobox", { name: "Sheet template" });
    const strip = page.getByRole("listbox", { name: "Frames" });
    await expect(rail).toBeVisible();
    await expect(inspector).toBeVisible();
    await expect(strip).toBeVisible();

    await page.getByRole("button", { name: "Hide the tools panel" }).click();
    await expect(rail).toBeHidden();

    await page.getByRole("button", { name: "Hide the inspector panel" }).click();
    await expect(inspector).toBeHidden();

    await page.getByRole("button", { name: "Hide the filmstrip panel" }).click();
    await expect(strip).toBeHidden();

    // The sheet keeps rendering with everything folded away.
    await expect(page.locator("[data-frame-index]")).toHaveCount(36);

    await page.getByRole("button", { name: "Show the tools panel" }).click();
    await page.getByRole("button", { name: "Show the inspector panel" }).click();
    await page.getByRole("button", { name: "Show the filmstrip panel" }).click();
    await expect(rail).toBeVisible();
    await expect(inspector).toBeVisible();
    await expect(strip).toBeVisible();
  });

  test("arrow keys walk the filmstrip", async ({ page }) => {
    await openDemo(page);

    const frames = page.getByRole("listbox", { name: "Frames" }).getByRole("option");
    await frames.nth(3).click();
    await expect(frames.nth(3)).toHaveAttribute("aria-selected", "true");

    await page.keyboard.press("ArrowRight");
    await expect(frames.nth(4)).toHaveAttribute("aria-selected", "true");

    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowLeft");
    await expect(frames.nth(4)).toHaveAttribute("aria-selected", "true");

    // The selection is what the inspector is showing.
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Harbour wall");
  });

  test("switching template keeps frames, statuses and annotations", async ({ page }) => {
    await openDemo(page);
    const annotations = await page.locator("[data-annotation-id]").count();

    for (const template of [/Darkroom Proof/, /Eliz Digital/, /Archival Sheet/]) {
      await chooseTemplate(page, template);
      await expect(page.locator("[data-frame-index]")).toHaveCount(36);
      await expect(page.locator("[data-annotation-id]")).toHaveCount(annotations);
    }
  });

  test("Eliz Digital prints butted thumbnails with a notes bar and order slip", async ({ page }) => {
    await openDemo(page);
    await chooseTemplate(page, /Eliz Digital/);

    await expect(page.locator("text=Notes:")).toBeVisible();
    await expect(page.locator("[data-frame-index]")).toHaveCount(36);

    // Thumbnails sit edge to edge: no gap between neighbouring frames.
    const gap = await page.evaluate(() => {
      const frames = [...document.querySelectorAll("[data-frame-index]")];
      const a = frames[0].getBoundingClientRect();
      const b = frames[1].getBoundingClientRect();
      return b.left - a.right;
    });
    expect(Math.abs(gap)).toBeLessThan(2);

    // No roll-metadata footer on this template.
    await expect(page.locator("text=/\\d+ FRAMES/")).toBeHidden();
  });

  test("the sheet cannot be dragged away off the canvas", async ({ page }) => {
    await openDemo(page);

    const measure = async () => {
      const stage = await page.getByTestId("canvas-stage").boundingBox();
      const sheet = await page.getByTestId("canvas-stage").locator("svg").first().boundingBox();
      if (!stage || !sheet) throw new Error("no bounding boxes");
      return { stage, sheet, left: sheet.x - stage.x, top: sheet.y - stage.y };
    };

    const before = await measure();

    // Drag hard from empty canvas beside the sheet, well past any sane bound.
    const start = { x: before.stage.x + 8, y: before.stage.y + 8 };
    await dragBetween(page, start, {
      x: before.stage.x + before.stage.width - 4,
      y: before.stage.y + before.stage.height - 4,
    });

    const after = await measure();
    // Overscroll is capped at 72px per axis, so the sheet stays on screen.
    expect(Math.abs(after.left - before.left)).toBeLessThanOrEqual(80);
    expect(Math.abs(after.top - before.top)).toBeLessThanOrEqual(80);
    expect(after.sheet.x + after.sheet.width).toBeGreaterThan(after.stage.x);
    expect(after.sheet.y + after.sheet.height).toBeGreaterThan(after.stage.y);
  });

  test("clicking a photograph only selects its frame", async ({ page }) => {
    await openDemo(page);
    await frame(page, 2).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByLabel("Title", { exact: true })).toBeVisible();

    // Double-clicking centres the frame rather than enlarging it.
    await frame(page, 2).dblclick();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("[data-frame-index]")).toHaveCount(36);
  });

  test("F puts the whole contact sheet on the light table", async ({ page }) => {
    await openDemo(page);
    const rail = page.getByRole("button", { name: "Select (V)" });
    const inspector = page.getByRole("complementary", { name: "Inspector" });
    const strip = page.getByRole("listbox", { name: "Frames" });

    await page.locator("[data-frame-index]").first().click();
    await page.keyboard.press("f");

    // Everything but the sheet gets out of the way.
    await expect(rail).toBeHidden();
    await expect(inspector).toBeHidden();
    await expect(strip).toBeHidden();
    await expect(page.locator("[data-frame-index]")).toHaveCount(36);

    // Reviewing carries on in fullscreen.
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("p");

    await page.keyboard.press("Escape");
    await expect(rail).toBeVisible();
    await expect(inspector).toBeVisible();
    await expect(strip).toBeVisible();
  });

  test("the toolbar keeps its instruments behind the tool they belong to", async ({ page }) => {
    await openDemo(page);

    // Eight things in the rail, not thirty.
    await expect(page.getByRole("button", { name: "Draw — Marker (B)" })).toBeVisible();
    await page.getByRole("button", { name: "Draw — Marker (B)" }).click();

    const menu = page.getByRole("menu", { name: "Draw with" });
    await expect(menu).toBeVisible();
    await menu.getByRole("menuitem", { name: "Pastel" }).click();

    // The rail now shows the instrument in hand.
    await expect(page.getByRole("button", { name: "Draw — Pastel (B)" })).toBeVisible();
    await expect(page.getByRole("menu")).toHaveCount(0);
  });
});
