import { fileURLToPath } from "node:url";
import { test, expect } from "./support/fixtures";

/** Shared JSON Resume fixtures under `tests/fixtures/json_resume/`. */
const fixturePath = (name: string): string =>
  fileURLToPath(new URL(`../../../tests/fixtures/json_resume/${name}`, import.meta.url));

test.describe("JSON Resume import", () => {
  test.beforeEach(async ({ homePage, builderPage }) => {
    await homePage.open();
    await homePage.createResume();
    await builderPage.assertEditorOpen();
    await builderPage.assertSaved();
    await builderPage.openImportModal();
  });

  test("imports the full JSON Resume fixture and maps its fields", async ({
    page,
    builderPage,
    importModal,
  }) => {
    await importModal.assertOpen();
    await importModal.importFile(fixturePath("full.json"));

    await expect(page.getByText("Resume imported successfully")).toBeVisible();
    await importModal.assertClosed();

    // Basics mapped into the form.
    await builderPage.assertFullName("Jane Smith");
    await expect(page.getByLabel("Email")).toHaveValue("jane@example.com");

    // Work history mapped into the experience section (2 entries in fixture).
    await builderPage.openSection("Experience");
    await builderPage.assertSectionOpen("Experience");
    await builderPage.assertSectionItemCount(2);
    await expect(page.getByText("Tech Corp").first()).toBeVisible();

    // The imported content persists like any other edit.
    await builderPage.assertSaved();
    await page.reload();
    await builderPage.assertEditorOpen();
    await builderPage.assertFullName("Jane Smith");
  });

  test("imports the minimal JSON Resume fixture", async ({ page, builderPage, importModal }) => {
    await importModal.assertOpen();
    await importModal.importFile(fixturePath("minimal.json"));

    await expect(page.getByText("Resume imported successfully")).toBeVisible();
    await importModal.assertClosed();
    await builderPage.assertFullName("John Doe");
  });

  test("shows an error for an unrecognized JSON payload", async ({ importModal }) => {
    await importModal.assertOpen();
    await importModal.importBuffer(
      "not-a-resume.json",
      "application/json",
      Buffer.from(JSON.stringify({ definitely: "not a resume" })),
    );

    await importModal.assertError(/Unrecognized resume format/);
    await importModal.assertOpen();
  });
});
