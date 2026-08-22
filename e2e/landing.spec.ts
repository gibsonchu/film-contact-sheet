import { expect, test } from "@playwright/test";

/**
 * The landing page is a section-divider page in the style of Magnum Contact
 * Sheets: a field of red with a title and four hand-drawn marks in two
 * columns — New/Binders on the left, Sheets/Explore on the right.
 */
test.describe("landing page", () => {
  test("shows the title and all four calls to action", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Film Contact Sheet" })).toBeVisible();

    const create = page.getByRole("link", { name: "Create a Contact Sheet" });
    const sheets = page.getByRole("link", { name: "Sheets" });
    const binders = page.getByRole("link", { name: "Binders" });
    const explore = page.getByRole("link", { name: "Explore" });
    await expect(create).toBeVisible();
    await expect(sheets).toBeVisible();
    await expect(binders).toBeVisible();
    await expect(explore).toBeVisible();

    // The artwork itself is decorative — the accessible name comes from the
    // link's own label, not from the image.
    await expect(create.locator("img")).toHaveAttribute("alt", "");
    await expect(create.getByText("New")).toBeVisible();
    await expect(sheets.getByText("Sheets")).toBeVisible();
  });

  test("New leads to a fresh sheet, Sheets leads to the sheet list", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Create a Contact Sheet" }).click();
    await expect(page).toHaveURL(/\/new$/);

    await page.goto("/");
    await page.getByRole("link", { name: "Sheets" }).click();
    await expect(page).toHaveURL(/\/sheets$/);
  });

  test("Binders sits below New, Explore sits below Sheets", async ({ page }) => {
    await page.goto("/");
    const create = page.getByRole("link", { name: "Create a Contact Sheet" });
    const sheets = page.getByRole("link", { name: "Sheets" });
    const binders = page.getByRole("link", { name: "Binders" });
    const explore = page.getByRole("link", { name: "Explore" });

    const createBox = (await create.boundingBox())!;
    const sheetsBox = (await sheets.boundingBox())!;
    const bindersBox = (await binders.boundingBox())!;
    const exploreBox = (await explore.boundingBox())!;

    // Same column (roughly the same horizontal centre), stacked below.
    expect(Math.abs(createBox.x + createBox.width / 2 - (bindersBox.x + bindersBox.width / 2))).toBeLessThan(4);
    expect(bindersBox.y).toBeGreaterThan(createBox.y + createBox.height);
    expect(Math.abs(sheetsBox.x + sheetsBox.width / 2 - (exploreBox.x + exploreBox.width / 2))).toBeLessThan(4);
    expect(exploreBox.y).toBeGreaterThan(sheetsBox.y + sheetsBox.height);

    // Binders and Explore are the smaller, secondary pair — same row as
    // each other, below the two primary marks.
    expect(Math.abs(bindersBox.y - exploreBox.y)).toBeLessThan(4);

    await binders.click();
    await expect(page).toHaveURL(/\/binders$/);

    await page.goto("/");
    await explore.click();
    await expect(page).toHaveURL(/\/explore$/);
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

  test("the sheets header has no title text and centers with its content", async ({ page }) => {
    await page.goto("/sheets");
    const header = page.locator("header");
    await expect(header.getByRole("link", { name: "Film Contact Sheet" })).toBeVisible();
    await expect(header.getByText("Sheets", { exact: true })).toHaveCount(0);

    const mark = header.getByRole("link", { name: "Film Contact Sheet" });
    const headerBox = (await mark.boundingBox())!;
    const searchBox = (await page.getByLabel("Search sheets").boundingBox())!;
    expect(Math.abs(headerBox.x - searchBox.x)).toBeLessThan(2);
  });
});
