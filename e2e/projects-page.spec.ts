import { expect, test } from "@playwright/test";
import { openDemo } from "./helpers";

/**
 * The library page — search left, sort and filter grouped to the right, and
 * the header buttons trimmed down to what's actually needed to get started.
 */
test.describe("projects page", () => {
  test("New Sheet replaces Upload, Blank sheet is gone, Demo roll reads Demo", async ({ page }) => {
    await page.goto("/binder");
    await expect(page.getByRole("button", { name: "Blank sheet" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Upload" })).toHaveCount(0);

    await expect(page.getByRole("button", { name: "Demo" })).toBeVisible();
    const newSheet = page.getByRole("link", { name: "New Sheet" });
    await expect(newSheet).toBeVisible();
    await newSheet.click();
    await expect(page).toHaveURL(/\/new$/);
  });

  test("search sits left with a visible border, sort and filter are grouped on the right", async ({ page }) => {
    await page.goto("/binder");

    const search = page.getByLabel("Search sheets");
    const sortGroup = page.getByRole("group", { name: "Sort by" });
    const filterGroup = page.getByRole("group", { name: "View" });
    await expect(search).toBeVisible();
    await expect(page.getByText("Sort By")).toBeVisible();
    await expect(page.getByText("Filter By")).toBeVisible();

    const searchBox = (await search.boundingBox())!;
    const sortBox = (await sortGroup.boundingBox())!;
    const filterBox = (await filterGroup.boundingBox())!;
    expect(searchBox.x).toBeLessThan(sortBox.x);
    expect(sortBox.x).toBeLessThan(filterBox.x);

    // The search box reads as an actual field now, not borderless text.
    const borderWidth = await search.evaluate((el) => getComputedStyle(el).borderTopWidth);
    expect(parseFloat(borderWidth)).toBeGreaterThan(0);

    // Sort keeps three ways to order the shelf; Frames is gone, Edited reads
    // Last Edited.
    await expect(sortGroup.getByRole("button")).toHaveCount(3);
    await expect(sortGroup.getByRole("button", { name: "Last Edited" })).toBeVisible();
    await expect(sortGroup.getByRole("button", { name: "Frames" })).toHaveCount(0);
  });

  test("the footer explains sheets are local, not synced", async ({ page }) => {
    await page.goto("/binder");
    await expect(
      page.getByText(
        "Sheets are only stored locally on this browser. Download your contact sheets to share with friends and family.",
      ),
    ).toBeVisible();
  });

  test("results sit closer together than the old wider row spacing", async ({ page }) => {
    await openDemo(page);
    await page.goto("/binder");
    const grid = page.locator("ul").filter({ has: page.getByRole("link") }).first();
    const rowGap = await grid.evaluate((el) => getComputedStyle(el).rowGap);
    expect(parseFloat(rowGap)).toBeLessThan(28); // the old gap-y-7 (28px)
  });
});
