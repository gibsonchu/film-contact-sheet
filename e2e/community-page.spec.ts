import { expect, test } from "@playwright/test";

test.describe("community page", () => {
  test("is teased from the Binder footer and reachable by its 'coming soon' link", async ({ page }) => {
    await page.goto("/binder");
    const comingSoon = page.getByRole("link", { name: "coming soon" });
    await expect(comingSoon).toBeVisible();
    await expect(comingSoon).toHaveAttribute("href", "/community");
    await comingSoon.click();
    await expect(page).toHaveURL(/\/community$/);
  });

  test("shows the Community title and coming-soon description", async ({ page }) => {
    await page.goto("/community");
    await expect(page.getByRole("heading", { name: "Community" })).toBeVisible();
    await expect(
      page.getByText("Coming soon will be a place for people to publish their contact sheets and explore others."),
    ).toBeVisible();
  });

  test("nav matches the Binder page, with Binder in place of Demo", async ({ page }) => {
    await page.goto("/community");
    const header = page.locator("header");
    await expect(header.getByRole("link", { name: "About" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Binder" })).toHaveAttribute("href", "/binder");
    await expect(header.getByRole("link", { name: "New Sheet" })).toBeVisible();
    await expect(header.getByRole("button", { name: "Demo" })).toHaveCount(0);

    await header.getByRole("link", { name: "Binder" }).click();
    await expect(page).toHaveURL(/\/binder$/);
  });
});
