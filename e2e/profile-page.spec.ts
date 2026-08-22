import { expect, test } from "@playwright/test";

/** Public profiles are cloud-only, same honest-stub pattern as Binders and
 *  Explore on a deployment with no Supabase credentials. */
test.describe("public profile page", () => {
  test("shows an honest stub when cloud storage isn't configured", async ({ page }) => {
    await page.goto("/u/some-user-id");
    await expect(page.getByText("Profiles need cloud storage")).toBeVisible();
  });

  test("links back to Explore", async ({ page }) => {
    await page.goto("/u/some-user-id");
    const link = page.getByRole("link", { name: "Explore" });
    await expect(link).toHaveAttribute("href", "/explore");
  });
});
