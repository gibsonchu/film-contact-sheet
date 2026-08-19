import { expect, test } from "@playwright/test";

/**
 * The landing page is now a section-divider page in the style of Magnum
 * Contact Sheets: a field of red with a title and two hand-drawn marks that
 * double as the site's only two calls to action.
 */
test.describe("landing page", () => {
  test("shows the title and both hand-drawn calls to action", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Film Contact Sheet" })).toBeVisible();

    const create = page.getByRole("link", { name: "Create a Contact Sheet" });
    const past = page.getByRole("link", { name: "My Sheets" });
    await expect(create).toBeVisible();
    await expect(past).toBeVisible();

    // The marks themselves are decorative — the accessible name comes from
    // the link, not from parsing hand-drawn SVG text.
    await expect(create.locator("svg")).toHaveAttribute("aria-hidden", "true");
  });

  test("New leads to a fresh sheet, Past leads to the sheet list", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Create a Contact Sheet" }).click();
    await expect(page).toHaveURL(/\/new$/);

    await page.goto("/");
    await page.getByRole("link", { name: "My Sheets" }).click();
    await expect(page).toHaveURL(/\/projects$/);
  });
});
