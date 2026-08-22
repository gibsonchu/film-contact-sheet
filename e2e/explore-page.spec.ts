import { expect, test } from "@playwright/test";

test.describe("explore page", () => {
  test("is teased from the Sheets footer and reachable by its 'coming soon' link", async ({ page }) => {
    await page.goto("/sheets");
    const comingSoon = page.getByRole("link", { name: "coming soon" });
    await expect(comingSoon).toBeVisible();
    await expect(comingSoon).toHaveAttribute("href", "/explore");
    await comingSoon.click();
    await expect(page).toHaveURL(/\/explore$/);
  });

  test("shows the Explore title — the real feed once cloud storage exists, an honest stub without it", async ({
    page,
  }) => {
    await page.goto("/explore");
    await expect(page.getByRole("heading", { name: "Explore" })).toBeVisible();
    // This deployment has no Supabase credentials, so the feed itself is
    // covered by explore-feed.spec.ts's honest-stub coverage — just confirm
    // the old static placeholder copy is gone.
    await expect(page.getByText("Coming soon will be a place for people to publish")).toHaveCount(0);
  });

  test("nav matches the Sheets page, with Sheets in place of Demo", async ({ page }) => {
    await page.goto("/explore");
    const header = page.locator("header");
    await expect(header.getByRole("link", { name: "About" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Sheets" })).toHaveAttribute("href", "/sheets");
    await expect(header.getByRole("link", { name: "New Sheet" })).toBeVisible();
    await expect(header.getByRole("button", { name: "Demo" })).toHaveCount(0);

    await header.getByRole("link", { name: "Sheets" }).click();
    await expect(page).toHaveURL(/\/sheets$/);
  });
});
