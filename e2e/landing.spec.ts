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
    const binder = page.getByRole("link", { name: "Binder" });
    await expect(create).toBeVisible();
    await expect(binder).toBeVisible();

    // The artwork itself is decorative — the accessible name comes from the
    // link's own label, not from the image.
    await expect(create.locator("img")).toHaveAttribute("alt", "");
    await expect(create.getByText("New")).toBeVisible();
    await expect(binder.getByText("Binder")).toBeVisible();
  });

  test("New leads to a fresh sheet, Binder leads to the sheet list", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Create a Contact Sheet" }).click();
    await expect(page).toHaveURL(/\/new$/);

    await page.goto("/");
    await page.getByRole("link", { name: "Binder" }).click();
    await expect(page).toHaveURL(/\/binder$/);
  });

  test("a smaller Community mark sits bottom-right and leads to the community page", async ({ page }) => {
    await page.goto("/");
    const community = page.getByRole("link", { name: "Community" });
    await expect(community).toBeVisible();
    await expect(community.getByText("Community")).toBeVisible();

    // Smaller than the two primary marks, and anchored to the bottom-right
    // of the page rather than sitting in the centred pair.
    const communityBox = (await community.boundingBox())!;
    const binderBox = (await page.getByRole("link", { name: "Binder" }).boundingBox())!;
    expect(communityBox.width).toBeLessThan(binderBox.width);

    const viewport = page.viewportSize()!;
    expect(communityBox.x + communityBox.width).toBeGreaterThan(viewport.width * 0.6);
    expect(communityBox.y + communityBox.height).toBeGreaterThan(viewport.height * 0.6);

    await community.click();
    await expect(page).toHaveURL(/\/community$/);
  });
});

/**
 * The site's icon stands in for the wordmark everywhere else in the app —
 * a small link back to "/", not spelled-out page titles the content below
 * already makes obvious.
 */
test.describe("site chrome", () => {
  test("the new-sheet header has no title text and centers with its content", async ({ page }) => {
    await page.goto("/new");
    const header = page.locator("header");
    const mark = header.getByRole("link", { name: "Film Contact Sheet" });
    await expect(mark).toBeVisible();
    await expect(header.getByText("New Contact Sheet")).toHaveCount(0);

    // The header's own centered row shares the same max-width column as the
    // content below it, rather than spanning edge to edge.
    const headerBox = (await mark.boundingBox())!;
    const contentBox = (await page.getByRole("heading", { name: "Photographs" }).boundingBox())!;
    expect(Math.abs(headerBox.x - contentBox.x)).toBeLessThan(2);

    await mark.click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("the projects header has no title text and centers with its content", async ({ page }) => {
    await page.goto("/binder");
    const header = page.locator("header");
    await expect(header.getByRole("link", { name: "Film Contact Sheet" })).toBeVisible();
    await expect(header.getByText("Sheets", { exact: true })).toHaveCount(0);

    const mark = header.getByRole("link", { name: "Film Contact Sheet" });
    const headerBox = (await mark.boundingBox())!;
    const searchBox = (await page.getByLabel("Search sheets").boundingBox())!;
    expect(Math.abs(headerBox.x - searchBox.x)).toBeLessThan(2);
  });
});
