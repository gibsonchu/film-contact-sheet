import { expect, test } from "@playwright/test";
import { openDemo } from "./helpers";

/**
 * Light and dark mode, toggled by a sun/moon button — everywhere except the
 * landing page, which keeps its own fixed red-and-white identity regardless
 * of what's stored.
 */
test.describe("theme toggle", () => {
  test("is absent from the landing page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: /Switch to (light|dark) mode/ })).toHaveCount(0);
  });

  test("switches /binder to light, persists across navigation, and never touches the landing page", async ({
    page,
  }) => {
    await page.goto("/binder");
    const toggle = page.getByRole("button", { name: "Switch to light mode" });
    await expect(toggle).toBeVisible();
    await toggle.click();

    await expect(page.getByRole("button", { name: "Switch to dark mode" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    // Persists to a fresh load, not just this session's DOM.
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.getByRole("button", { name: "Switch to dark mode" })).toBeVisible();

    // Follows to /new.
    await page.goto("/new");
    await expect(page.getByRole("button", { name: "Switch to dark mode" })).toBeVisible();

    // The landing page ignores it entirely — no toggle, and the background
    // is still the fixed red, not a chrome token that would have flipped.
    await page.goto("/");
    await expect(page.getByRole("button", { name: /Switch to (light|dark) mode/ })).toHaveCount(0);
    const bg = await page.locator("main").evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toBe("rgb(216, 31, 38)");
  });

  test("the primary button fades on hover in light mode, not just dark", async ({ page }) => {
    await page.goto("/binder");
    await page.getByRole("button", { name: "Switch to light mode" }).click();

    const newSheet = page.getByRole("link", { name: "New Sheet" }).getByRole("button");
    await expect(newSheet).toHaveCSS("opacity", "1");
    await newSheet.hover();
    await expect(newSheet).toHaveCSS("opacity", "0.8");
  });

  test("appears top right, left of Undo, on the contact sheet editor", async ({ page }) => {
    await openDemo(page);
    const toggle = page.getByRole("button", { name: "Switch to light mode" });
    await expect(toggle).toBeVisible();

    const toggleBox = (await toggle.boundingBox())!;
    const undoBox = (await page.getByRole("button", { name: "Undo (⌘Z)" }).boundingBox())!;
    expect(toggleBox.x).toBeLessThan(undoBox.x);

    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    // The sheet's own dark background is content, not chrome — it doesn't
    // flip with the app around it.
    await expect(page.getByTestId("canvas-stage").locator("svg").first()).toBeVisible();
  });
});
