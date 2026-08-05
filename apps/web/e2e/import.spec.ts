import { fileURLToPath } from "node:url";
import { test, expect } from "./support/fixtures";

/** Shared JSON Resume fixtures under `tests/fixtures/json_resume/`. */
const fixturePath = (name: string): string =>
  fileURLToPath(new URL(`../../../tests/fixtures/json_resume/${name}`, import.meta.url));

test.describe("JSON Resume import", () => {
  test.beforeEach(async ({ homePage, docEditorPage }) => {
    await homePage.open();
    await homePage.createResume();
    await docEditorPage.assertEditorOpen();
    await docEditorPage.assertSaved();
    await docEditorPage.openImportModal();
  });

  test("imports the full JSON Resume fixture and maps its fields", async ({
    page,
    docEditorPage,
    importModal,
  }) => {
    await importModal.assertOpen();
    await importModal.importFile(fixturePath("full.json"));

    await expect(page.getByText("Resume imported successfully")).toBeVisible();
    await importModal.assertClosed();

    // Basics mapped into the sheet header.
    await docEditorPage.assertName("Jane Smith");
    await expect(docEditorPage.headerField("Email")).toHaveText("jane@example.com");

    // Work history mapped into the experience section (2 entries in fixture).
    await docEditorPage.assertSectionItemCount("experience", 2);
    await expect(page.getByText("Tech Corp").first()).toBeVisible();

    // The imported content persists like any other edit.
    await docEditorPage.assertSaved();
    await page.reload();
    await docEditorPage.assertEditorOpen();
    await docEditorPage.assertName("Jane Smith");
  });

  test("imports the minimal JSON Resume fixture", async ({ page, docEditorPage, importModal }) => {
    await importModal.assertOpen();
    await importModal.importFile(fixturePath("minimal.json"));

    await expect(page.getByText("Resume imported successfully")).toBeVisible();
    await importModal.assertClosed();
    await docEditorPage.assertName("John Doe");
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
