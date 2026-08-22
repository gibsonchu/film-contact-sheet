import { expect, test } from "@playwright/test";
import { openDemo } from "./helpers";

/**
 * Explore, like Binders, is cloud-only — this deployment has no Supabase
 * credentials, so every one of these renders the honest "needs cloud
 * storage" state rather than a broken page or a fake feed.
 */
test.describe("explore feed", () => {
  test("shows an honest stub and no search box when cloud storage isn't configured", async ({ page }) => {
    await page.goto("/explore");
    await expect(page.getByRole("heading", { name: "Explore" })).toBeVisible();
    await expect(page.getByText("Explore needs cloud storage")).toBeVisible();
    await expect(page.getByLabel("Search the community")).toHaveCount(0);
  });

  test("a sheet detail page shows the same stub", async ({ page }) => {
    await page.goto("/explore/does-not-exist");
    await expect(page.getByText("Explore needs cloud storage")).toBeVisible();
  });

  test("Publish does not appear in the editor or on Sheets when signed out", async ({ page }) => {
    await openDemo(page);
    await expect(page.getByRole("button", { name: "Publish" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Share" })).toBeVisible();

    await page.goto("/sheets");
    await expect(page.getByRole("button", { name: "Publish" })).toHaveCount(0);
  });
});
