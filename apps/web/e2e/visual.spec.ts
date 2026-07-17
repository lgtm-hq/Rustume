import { test, expect, DEFAULT_TEMPLATE_ID } from "./support/fixtures";

// Baselines are generated on CI (Linux) and committed from the workflow
// artifact, so font rasterization matches exactly. Local runs skip the
// comparisons by default; opt in with E2E_VISUAL=1 (expect platform diffs).
test.skip(
  !process.env.CI && process.env.E2E_VISUAL !== "1",
  "Visual baselines are CI (Linux) generated; set E2E_VISUAL=1 to compare locally",
);

test.describe("visual regression", () => {
  test("home page empty state", async ({ page, homePage }) => {
    await homePage.open();
    await homePage.assertLoaded();
    await homePage.assertEmptyState();
    await expect(page).toHaveScreenshot("home-empty.png", { fullPage: true });
  });

  test("editor split view with rendered preview", async ({ page, homePage, builderPage }) => {
    await homePage.open();
    await homePage.createResume();
    await builderPage.assertEditorOpen();
    await builderPage.assertSaved();
    await builderPage.assertPreviewVisible();
    // Wait out the transient "New resume created" toast for a steady frame.
    await expect(page.getByText("New resume created")).toBeHidden({ timeout: 15_000 });
    await expect(page).toHaveScreenshot("editor-split.png");
  });

  test("template picker grid", async ({ homePage, builderPage, templatePickerModal }) => {
    await homePage.open();
    await homePage.createResume();
    await builderPage.assertEditorOpen();
    await builderPage.assertSaved();
    await builderPage.openTemplatePicker(DEFAULT_TEMPLATE_ID);
    await templatePickerModal.assertOpen();
    await templatePickerModal.assertTemplateListed("Onyx");
    await expect(templatePickerModal.dialog).toHaveScreenshot("template-picker.png");
  });

  test("export dialog", async ({ homePage, builderPage, exportModal }) => {
    await homePage.open();
    await homePage.createResume();
    await builderPage.assertEditorOpen();
    await builderPage.assertSaved();
    await builderPage.openExportModal();
    await exportModal.assertOpen();
    await expect(exportModal.dialog).toHaveScreenshot("export-dialog.png");
  });

  test("import dialog", async ({ homePage, builderPage, importModal }) => {
    await homePage.open();
    await homePage.createResume();
    await builderPage.assertEditorOpen();
    await builderPage.assertSaved();
    await builderPage.openImportModal();
    await importModal.assertOpen();
    await expect(importModal.dialog).toHaveScreenshot("import-dialog.png");
  });
});
