import { expect, test } from "@playwright/test";
import { frame, openDemoAlt } from "./helpers";

/**
 * The alternative arrangement: sheet settings top left, the roll down the left
 * side, the tools on the desk at the bottom. Same editor underneath, so these
 * check the furniture rather than re-testing the drawing engine.
 */
test.describe("dock layout", () => {
  test("puts the settings top left, the roll left, and the tools at the bottom", async ({
    page,
  }) => {
    await openDemoAlt(page);

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

    // Settings in the top-left corner.
    expect(cardBox.y).toBeLessThan(viewport.height / 3);
    // The roll runs down the left-hand edge, full height.
    expect(sidebarBox.x).toBeLessThan(40);
    expect(sidebarBox.height).toBeGreaterThan(viewport.height * 0.8);
    // The tools sit at the bottom, near the middle.
    expect(dockBox.y).toBeGreaterThan(viewport.height * 0.75);
    expect(dockBox.x).toBeGreaterThan(viewport.width / 4);

    // No right-hand inspector column.
    await expect(page.getByRole("complementary", { name: "Inspector" })).toHaveCount(0);
  });

  test("the settings for the sheet drop out of the corner card", async ({ page }) => {
    await openDemoAlt(page);

    const template = page.getByRole("combobox", { name: "Sheet template" });
    await expect(template).toBeHidden();

    await page.getByRole("button", { name: "Contact sheet settings" }).click();
    await expect(template).toBeVisible();
    await expect(page.getByRole("group", { name: "Picks are marked with" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(template).toBeHidden();
  });

  test("selecting a frame brings its review controls up over the dock", async ({ page }) => {
    await openDemoAlt(page);
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
    await openDemoAlt(page);

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
    await openDemoAlt(page);

    const options = page.getByRole("listbox", { name: "Frames" }).getByRole("option");
    await options.nth(4).click();
    await expect(options.nth(4)).toHaveAttribute("aria-selected", "true");
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Harbour wall");

    // The arrow keys still walk the roll from wherever you are.
    await page.keyboard.press("ArrowRight");
    await expect(options.nth(5)).toHaveAttribute("aria-selected", "true");
  });

  test("fullscreen clears the furniture away from the sheet", async ({ page }) => {
    await openDemoAlt(page);
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
});
