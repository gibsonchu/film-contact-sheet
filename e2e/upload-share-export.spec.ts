import { expect, test } from "@playwright/test";
import {
  FILE_INPUT,
  FOLDER_INPUT,
  fakeImages,
  makeImageFolder,
  openDemo,
  openDemoPanels,
  templateButton,
} from "./helpers";

test.describe("creating without photos", () => {
  test("Create works with nothing uploaded, the way Blank sheet used to", async ({ page }) => {
    await page.goto("/new");
    const createBtn = page.getByRole("button", { name: "Create" });
    await expect(createBtn).toBeEnabled();

    await page.getByLabel("Title", { exact: true }).fill("Empty Roll");
    await createBtn.click();
    await page.waitForURL(/\/sheet\//, { timeout: 15_000 });

    // The layout always reserves at least one frame slot; the roll itself
    // has no photographs in it.
    await expect(page.getByText("0 frames")).toBeVisible();
    await expect(page.getByLabel("Contact sheet title")).toHaveValue("Empty Roll");
  });
});

test.describe("upload limits", () => {
  test("keeps 38 frames on one sheet", async ({ page }) => {
    await page.goto("/new");
    await page.setInputFiles(FILE_INPUT, fakeImages(38));
    await expect(page.getByText("38 frames ready")).toBeVisible();
    await expect(page.getByText(/split into/)).toBeHidden();
    await expect(page.getByRole("button", { name: "Create" })).toBeVisible();
  });

  test("splits more than 38 frames into extra sheets and says so", async ({ page }) => {
    await page.goto("/new");
    await page.setInputFiles(FILE_INPUT, fakeImages(40));

    await expect(page.getByText(/40 frames is more than one 35mm roll/)).toBeVisible();
    await expect(page.getByText(/2 contact sheets/)).toBeVisible();

    await page.getByRole("button", { name: "Create" }).click();
    await page.waitForURL(/\/sheet\//, { timeout: 60_000 });

    // New sheets open on the default template; it is changed in the editor,
    // where the sheet's settings live at the head of the left-hand column.
    await page.getByRole("button", { name: "Contact sheet settings" }).click();
    await expect(templateButton(page)).toContainText("Eliz Digital");

    await page.goto("/binder");
    await expect(page.getByText("Roll 1 of 2")).toBeVisible();
    await expect(page.getByText("Roll 2 of 2")).toBeVisible();
  });

  test("accepts a whole folder, keeping only the photographs", async ({ page }) => {
    await page.goto("/new");
    await page.setInputFiles(FOLDER_INPUT, makeImageFolder(6, { withJunk: true }));

    // The two non-images are listed but flagged, so six frames are usable.
    await expect(page.getByText("6 frames ready")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create" })).toBeVisible();
  });

  test("adding to a full sheet stops at the 38-frame roll limit", async ({ page }) => {
    await openDemo(page);
    await expect(page.locator("[data-frame-index]")).toHaveCount(36);
    await expect(page.getByText("2 of 38 free")).toBeVisible();

    // Five more into a sheet with room for two.
    await page.setInputFiles(FOLDER_INPUT, makeImageFolder(5));

    await expect(page.locator("[data-frame-index]")).toHaveCount(38, { timeout: 30_000 });
    await expect(page.getByText(/3 left out/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Add a folder of photos" })).toBeDisabled();
  });

  test("rejects a RAW file with a readable message", async ({ page }) => {
    await page.goto("/new");
    await page.setInputFiles(FILE_INPUT, [
      { name: "DSC_0001.NEF", mimeType: "image/x-nikon-nef", buffer: Buffer.from("raw") },
    ]);
    await expect(page.getByText(/RAW files aren’t supported/)).toBeVisible();
  });
});

test.describe("sharing", () => {
  test("a shared view is read-only and never exposes private notes", async ({ page }) => {
    // Sharing lives on the panelled layout — the default dock layout no
    // longer surfaces it, by design.
    await openDemoPanels(page);

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
