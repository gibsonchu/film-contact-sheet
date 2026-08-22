import { expect, test } from "@playwright/test";

/**
 * Binders and Explore are top-level destinations, same tier as About and
 * Sheets — every primary page's header links to both (except the page
 * that IS that destination, matching the existing self-link-omitted
 * pattern already used for About/Sheets).
 */
test.describe("nav consistency", () => {
  const primaryPages = ["/about", "/sheets", "/new", "/explore", "/binders"];

  for (const path of primaryPages) {
    test(`${path} links to both Binders and Explore in its header (except itself)`, async ({ page }) => {
      await page.goto(path);
      const header = page.locator("header");

      if (path !== "/binders") {
        await expect(header.getByRole("link", { name: "Binders" })).toHaveAttribute("href", "/binders");
      }
      if (path !== "/explore") {
        await expect(header.getByRole("link", { name: "Explore" })).toHaveAttribute("href", "/explore");
      }
    });
  }
});
