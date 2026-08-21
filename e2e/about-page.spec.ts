import { expect, test } from "@playwright/test";

test.describe("about page", () => {
  test("is reachable from the new-sheet and binder navs, next to Demo", async ({ page }) => {
    await page.goto("/new");
    await expect(page.getByRole("link", { name: "About" })).toBeVisible();
    await page.getByRole("link", { name: "About" }).click();
    await expect(page).toHaveURL(/\/about$/);

    await page.goto("/binder");
    const about = page.getByRole("link", { name: "About" });
    const demo = page.getByRole("button", { name: "Demo" });
    await expect(about).toBeVisible();
    const aboutBox = (await about.boundingBox())!;
    const demoBox = (await demo.boundingBox())!;
    // About sits immediately left of Demo in the nav's right-hand cluster.
    expect(aboutBox.x).toBeLessThan(demoBox.x);
  });

  test("shows the About title, the essay, and a working @gibsontchu link", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { name: "About" })).toBeVisible();
    await expect(page.getByText(/Magnum’s book, Contact Sheets/)).toBeVisible();

    const handle = page.getByRole("link", { name: "@gibsontchu", exact: true });
    await expect(handle).toHaveAttribute("href", "https://x.com/gibsontchu");
  });

  test("Built by @gibsontchu appears bottom-center on New Sheet, Binder, and About", async ({ page }) => {
    for (const path of ["/new", "/binder", "/about"]) {
      await page.goto(path);
      const credit = page.getByRole("link", { name: "Built by @gibsontchu" });
      await expect(credit).toBeVisible();
      await expect(credit).toHaveAttribute("href", "https://gibsonchu.com/");
    }
  });
});
