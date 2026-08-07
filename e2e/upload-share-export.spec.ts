import { expect, test } from "@playwright/test";
import { fakeImages, openDemo } from "./helpers";

test.describe("upload limits", () => {
  test("keeps 38 frames on one sheet", async ({ page }) => {
    await page.goto("/new");
    await page.setInputFiles('input[type="file"]', fakeImages(38));
    await expect(page.getByText("38 frames ready")).toBeVisible();
    await expect(page.getByText(/split into/)).toBeHidden();
    await expect(page.getByRole("button", { name: /Build the sheet/ })).toBeVisible();
  });

  test("splits more than 38 frames into extra sheets and says so", async ({ page }) => {
    await page.goto("/new");
    await page.setInputFiles('input[type="file"]', fakeImages(40));

    await expect(page.getByText(/40 frames is more than one 35mm roll/)).toBeVisible();
    await expect(page.getByText(/2 contact sheets/)).toBeVisible();

    await page.getByRole("button", { name: /Build 2 sheets/ }).click();
    await page.waitForURL(/\/sheet\//, { timeout: 60_000 });

    // New sheets start on Classic 35mm; the template is chosen in the editor.
    await expect(page.getByRole("button", { name: /Classic 35mm/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.goto("/projects");
    await expect(page.getByText("Roll 1 of 2")).toBeVisible();
    await expect(page.getByText("Roll 2 of 2")).toBeVisible();
  });

  test("rejects a RAW file with a readable message", async ({ page }) => {
    await page.goto("/new");
    await page.setInputFiles('input[type="file"]', [
      { name: "DSC_0001.NEF", mimeType: "image/x-nikon-nef", buffer: Buffer.from("raw") },
    ]);
    await expect(page.getByText(/RAW files aren’t supported/)).toBeVisible();
  });
});

test.describe("sharing", () => {
  test("a shared view is read-only and never exposes private notes", async ({ page }) => {
    await openDemo(page);

    // Put a private note on frame 1.
    await page.locator('[data-frame-index="0"]').click();
    await page.getByLabel("Private note").fill("negative is scratched");
    await expect(page.getByLabel("Private note")).toHaveValue("negative is scratched");

    await page.getByRole("button", { name: "Share" }).click();
    await page.getByRole("button", { name: "Link · view" }).click();
    const link = page.getByLabel("Share link");
    await expect(link).toHaveValue(/\/share\//);
    const url = await link.inputValue();

    await page.goto(url);
    await expect(page.getByText("Shared contact sheet")).toBeVisible();
    await expect(page.getByText("negative is scratched")).toBeHidden();
    expect(await page.content()).not.toContain("negative is scratched");

    // No editing affordances in a shared view.
    await expect(page.getByRole("button", { name: /^Pen/ })).toBeHidden();
  });
});

test.describe("export", () => {
  test("exports a high-resolution PNG containing the sheet", async ({ page }) => {
    await openDemo(page);
    await page.getByRole("button", { name: "Export" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "300 DPI" }).click();
    await expect(dialog.getByText(/× \d+ px/)).toBeVisible();

    const downloadPromise = page.waitForEvent("download", { timeout: 120_000 });
    await dialog.getByRole("button", { name: "Export", exact: true }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.png$/);
    await expect(dialog.getByText(/^Saved .*\.png/)).toBeVisible({ timeout: 120_000 });
  });
});
