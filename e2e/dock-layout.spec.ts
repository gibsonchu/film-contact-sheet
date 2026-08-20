import { expect, test } from "@playwright/test";
import { chooseTemplate, frame, openDemo, templateButton } from "./helpers";

/**
 * The default arrangement: the roll and the sheet's settings down the left,
 * the tools on the desk at the bottom. Same editor underneath, so these check
 * the furniture rather than re-testing the drawing engine.
 */
test.describe("dock layout", () => {
  test("puts the roll and its settings left, and the tools at the bottom", async ({
    page,
  }) => {
    await openDemo(page);

    const card = page.getByLabel("Contact sheet title");
    const sidebar = page.getByRole("complementary", { name: "Frames" });
    const select = page.getByRole("button", { name: "Select (V)" });
    await expect(card).toBeVisible();
    await expect(sidebar).toBeVisible();
    await expect(select).toBeVisible();

    const cardBox = (await card.boundingBox())!;
    const sidebarBox = (await sidebar.boundingBox())!;
    const dockBox = (await select.boundingBox())!;
    const viewport = page.viewportSize()!;

    // The sheet's settings head the column, above the roll.
    expect(cardBox.y).toBeLessThan(viewport.height / 4);
    expect(cardBox.x).toBeLessThan(sidebarBox.x + sidebarBox.width);
    // The roll runs down the left-hand edge, full height.
    expect(sidebarBox.x).toBeLessThan(40);
    expect(sidebarBox.height).toBeGreaterThan(viewport.height * 0.8);
    // The tools sit at the bottom, near the middle.
    expect(dockBox.y).toBeGreaterThan(viewport.height * 0.75);
    expect(dockBox.x).toBeGreaterThan(viewport.width / 4);

    // No right-hand inspector column.
    await expect(page.getByRole("complementary", { name: "Inspector" })).toHaveCount(0);
  });

  test("the settings for the sheet drop out of the head of the column", async ({ page }) => {
    await openDemo(page);

    const template = page.getByRole("combobox", { name: "Sheet template" });
    await expect(template).toBeHidden();

    await page.getByRole("button", { name: "Contact sheet settings" }).click();
    await expect(template).toBeVisible();
    await expect(page.getByRole("group", { name: "Picks are marked with" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(template).toBeHidden();
  });

  test("choosing a template from the dropdown actually applies it, without the panel closing out from under the click", async ({ page }) => {
    await openDemo(page);
    await page.getByRole("button", { name: "Contact sheet settings" }).click();

    // The template's options render into a portal outside this disclosure's
    // own DOM subtree — the regression this guards against closed the panel,
    // and unmounted the dropdown, before the option's click could land.
    await expect(templateButton(page)).toBeVisible();
    await chooseTemplate(page, /Eliz Digital/);

    await expect(templateButton(page)).toContainText("Eliz Digital");
    // The settings panel is still open afterwards — a stray outside-click
    // closer would have folded the whole column away, not just the list.
    await expect(page.getByRole("group", { name: "Picks are marked with" })).toBeVisible();
  });

  test("selecting a frame brings its review controls up over the dock", async ({ page }) => {
    await openDemo(page);
    await expect(page.getByRole("group", { name: "Review status" })).toHaveCount(0);

    await frame(page, 3).click();
    const review = page.getByRole("group", { name: "Review status" });
    await expect(review).toBeVisible();

    // The contextual strip sits above the tools, not beside the canvas.
    const reviewBox = (await review.boundingBox())!;
    const dockBox = (await page.getByRole("button", { name: "Select (V)" }).boundingBox())!;
    expect(reviewBox.y + reviewBox.height).toBeLessThanOrEqual(dockBox.y + 2);

    await review.getByRole("button", { name: "Pick", exact: true }).click();
    await expect(review.getByRole("button", { name: "Pick", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Deselecting takes the strip away again.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("group", { name: "Review status" })).toHaveCount(0);
  });

  test("the tool families open upwards out of the dock", async ({ page }) => {
    await openDemo(page);

    const draw = page.getByRole("button", { name: /^Draw —/ });
    await draw.click();
    const menu = page.getByRole("menu", { name: "Draw with" });
    await expect(menu).toBeVisible();

    const menuBox = (await menu.boundingBox())!;
    const drawBox = (await draw.boundingBox())!;
    expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(drawBox.y + 2);

    await menu.getByRole("menuitem", { name: "Sharpie" }).click();
    await expect(page.getByRole("button", { name: "Draw — Sharpie (B)" })).toBeVisible();
  });

  test("clicking a thumbnail in the roll selects that frame on the sheet", async ({ page }) => {
    await openDemo(page);

    const options = page.getByRole("listbox", { name: "Frames" }).getByRole("option");
    await options.nth(4).click();
    await expect(options.nth(4)).toHaveAttribute("aria-selected", "true");
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Harbour wall");

    // The arrow keys still walk the roll from wherever you are.
    await page.keyboard.press("ArrowRight");
    await expect(options.nth(5)).toHaveAttribute("aria-selected", "true");
  });

  test("the roll folds away and comes back", async ({ page }) => {
    await openDemo(page);
    const sidebar = page.getByRole("complementary", { name: "Frames" });
    const before = (await sidebar.boundingBox())!.width;
    expect(before).toBeGreaterThan(150);

    await page.getByRole("button", { name: "Hide the frames panel" }).click();
    await expect(sidebar).toHaveCount(0);
    // The sheet keeps rendering, with more room than it had.
    await expect(page.locator("[data-frame-index]")).toHaveCount(36);

    await page.getByRole("button", { name: "Show the frames panel" }).click();
    await expect(sidebar).toBeVisible();
  });

  test("the review filters are pills that narrow the roll", async ({ page }) => {
    await openDemo(page);
    const options = page.getByRole("listbox", { name: "Frames" }).getByRole("option");
    await expect(options).toHaveCount(36);

    await page.getByRole("button", { name: /^Rejects/ }).click();
    await expect(page.getByRole("button", { name: /^Rejects/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const narrowed = await options.count();
    expect(narrowed).toBeGreaterThan(0);
    expect(narrowed).toBeLessThan(36);

    await page.getByRole("button", { name: /^All/ }).click();
    await expect(options).toHaveCount(36);
  });

  test("adding photos is offered at the head of the roll", async ({ page }) => {
    await openDemo(page);
    const add = page.getByRole("button", { name: "Add photos" });
    const folder = page.getByRole("button", { name: "Add a folder of photos" });
    await expect(add).toBeVisible();
    await expect(folder).toBeVisible();

    // Above the thumbnails, below the sheet's own settings.
    const addBox = (await add.boundingBox())!;
    const settingsBox = (await page.getByLabel("Contact sheet title").boundingBox())!;
    const firstThumb = (await page
      .getByRole("listbox", { name: "Frames" })
      .getByRole("option")
      .first()
      .boundingBox())!;
    expect(addBox.y).toBeGreaterThan(settingsBox.y);
    expect(addBox.y).toBeLessThan(firstThumb.y);
  });

  test("ink and width are offered as separate, readable choices", async ({ page }) => {
    await openDemo(page);
    await page.getByRole("button", { name: /^Ink and width/ }).click();

    // Two weights, named rather than shown as bars of varying height.
    const widths = page.getByRole("group", { name: "Stroke width" });
    await expect(widths.getByRole("button")).toHaveCount(2);
    await expect(widths.getByRole("button", { name: /Fine/ })).toBeVisible();
    await expect(widths.getByRole("button", { name: /Bold/ })).toBeVisible();

    // Colours are round.
    const red = page.getByRole("button", { name: "Red grease pencil", exact: true });
    await expect(red).toBeVisible();
    const radius = await red.evaluate(
      (el) => getComputedStyle(el.firstElementChild as Element).borderTopLeftRadius,
    );
    expect(radius).toContain("px");
    expect(parseFloat(radius)).toBeGreaterThan(4);

    await widths.getByRole("button", { name: /Bold/ }).click();
    await expect(widths.getByRole("button", { name: /Bold/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("fullscreen clears the furniture away from the sheet", async ({ page }) => {
    await openDemo(page);
    await frame(page, 0).click();
    await page.keyboard.press("f");

    await expect(page.getByRole("complementary", { name: "Frames" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Select (V)" })).toBeHidden();
    await expect(page.getByLabel("Contact sheet title")).toBeHidden();
    await expect(page.locator("[data-frame-index]")).toHaveCount(36);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("complementary", { name: "Frames" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Select (V)" })).toBeVisible();
  });

  test("the page itself never scrolls — only the roll in the left panel does", async ({ page }) => {
    await openDemo(page);

    // Every thumbnail carries an invisible sr-only status span; if its button
    // isn't a positioned ancestor, that span's layout box escapes to the
    // document root and silently makes the whole page scrollable by
    // thousands of pixels, even though nothing visible moves.
    const canScrollPage = await page.evaluate(
      () => document.scrollingElement!.scrollHeight > document.scrollingElement!.clientHeight,
    );
    expect(canScrollPage).toBe(false);

    // The roll itself still scrolls internally.
    const list = page.getByRole("listbox", { name: "Frames" });
    const before = await list.evaluate((el) => el.scrollTop);
    await list.evaluate((el) => { el.scrollTop = 400; });
    const after = await list.evaluate((el) => el.scrollTop);
    expect(after).toBeGreaterThan(before);

    // Scrolling never moved the document itself.
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("the panel/preview/postcard/share views are gone, and the way back sits over the canvas", async ({ page }) => {
    await openDemo(page);

    await expect(page.getByRole("link", { name: "Panel layout" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Preview" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Postcard" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Share" })).toHaveCount(0);

    // "All sheets" moved out of the left column and onto the canvas itself.
    const sidebar = page.getByRole("complementary", { name: "Frames" });
    await expect(sidebar.getByRole("link", { name: /all sheets/i })).toHaveCount(0);

    const back = page.getByRole("link", { name: "‹ All sheets" });
    await expect(back).toBeVisible();
    const backBox = (await back.boundingBox())!;
    const sidebarBox = (await sidebar.boundingBox())!;
    expect(backBox.x).toBeGreaterThan(sidebarBox.x + sidebarBox.width);

    await back.click();
    await expect(page).toHaveURL(/\/projects$/);
  });

  test("the settings toggle is a gear, not an arrow, and its section reads Roll Details", async ({ page }) => {
    await openDemo(page);
    // The gear is a toothed outline plus a centre hole — the old chevron
    // was a single path and nothing else.
    const gear = page.getByRole("button", { name: "Contact sheet settings" });
    await expect(gear.locator("path")).toHaveCount(1);
    await expect(gear.locator("circle")).toHaveCount(1);

    await gear.click();
    await expect(page.getByText("Roll Details")).toBeVisible();
  });
});
