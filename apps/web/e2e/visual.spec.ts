import { test, expect } from "./support/fixtures";

// Baselines are generated on CI (Linux) and committed from the workflow
// artifact, so font rasterization matches exactly. Local runs skip the
// comparisons by default; opt in with E2E_VISUAL=1 (expect platform diffs).
// Per-template sheet baselines live in template-sheet.visual.spec.ts; PDF
// baselines and the shared regen notes are in
// crates/render/tests/baselines/README.md (#831 / #812).
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

  test("document editor single-surface sheet", async ({ page, homePage, docEditorPage }) => {
    await homePage.open();
    await homePage.createResume();
    await docEditorPage.assertDocEditorOpen();
    await docEditorPage.assertSaved();
    // Wait out the transient "New resume created" toast for a steady frame.
    await expect(page.getByText("New resume created")).toBeHidden({ timeout: 15_000 });
    await expect(page).toHaveScreenshot("doc-editor-sheet.png");
  });

  test("templates drawer grid", async ({ homePage, docEditorPage, templatesDrawer }) => {
    await homePage.open();
    await homePage.createResume();
    await docEditorPage.assertDocEditorOpen();
    await docEditorPage.assertSaved();
    await docEditorPage.openTemplatesDrawer();
    await templatesDrawer.assertOpen();
    await templatesDrawer.assertTemplateListed("Onyx");
    await expect(templatesDrawer.dialog).toHaveScreenshot("templates-drawer.png");
  });

  test("export dialog", async ({ homePage, docEditorPage, exportModal }) => {
    await homePage.open();
    await homePage.createResume();
    await docEditorPage.assertDocEditorOpen();
    await docEditorPage.assertSaved();
    await docEditorPage.openExportModal();
    await exportModal.assertOpen();
    await expect(exportModal.dialog).toHaveScreenshot("export-dialog.png");
  });

  test("import dialog", async ({ homePage, docEditorPage, importModal }) => {
    await homePage.open();
    await homePage.createResume();
    await docEditorPage.assertDocEditorOpen();
    await docEditorPage.assertSaved();
    await docEditorPage.openImportModal();
    await importModal.assertOpen();
    await expect(importModal.dialog).toHaveScreenshot("import-dialog.png");
  });
});
