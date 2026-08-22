import { expect, test } from "@playwright/test";

/**
 * Binders are cloud-only — this deployment has no Supabase credentials, so
 * every one of these renders the honest "needs cloud storage" / "sign in"
 * state rather than a broken or blank page.
 */
test.describe("binders page", () => {
  test("shows an honest stub when cloud storage isn't configured", async ({ page }) => {
    await page.goto("/binders");
    await expect(page.getByRole("heading", { name: "Binders" })).toBeVisible();
    await expect(page.getByText("Binders need cloud storage")).toBeVisible();
    await expect(page.getByRole("button", { name: "New Binder" })).toHaveCount(0);
  });

  test("nav matches the other secondary pages, with Sheets in place of Demo", async ({ page }) => {
    await page.goto("/binders");
    const header = page.locator("header");
    await expect(header.getByRole("link", { name: "About" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Sheets" })).toHaveAttribute("href", "/sheets");
  });

  test("a binder detail page asks visitors to sign in", async ({ page }) => {
    await page.goto("/binders/does-not-exist");
    await expect(page.getByText("Sign in")).toBeVisible();
    await expect(page.getByText("to view this binder")).toBeVisible();
  });

  test("View Binder does not appear on Sheets when nothing is cloud-linked", async ({ page }) => {
    await page.goto("/sheets");
    await expect(page.getByRole("link", { name: "View Binder" })).toHaveCount(0);
  });
});
