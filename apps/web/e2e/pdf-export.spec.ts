import { readFile } from "node:fs/promises";
import { test, expect, PDF_STUB } from "./support/fixtures";

const FULL_NAME = "Ada Lovelace";

test.describe("PDF export", () => {
  test.beforeEach(async ({ homePage, docEditorPage }) => {
    await homePage.open();
    await homePage.createResume();
    await docEditorPage.assertEditorOpen();
    await docEditorPage.assertSaved();
    await docEditorPage.fillName(FULL_NAME);
    await docEditorPage.assertSaved();
  });

  test("exports a PDF named after the resume with the rendered bytes", async ({
    page,
    docEditorPage,
    exportModal,
  }) => {
    await docEditorPage.openExportModal();
    await exportModal.assertOpen();

    // The render request carries the resume content and the template under a
    // `{resume, template}` envelope; the response bytes are saved verbatim as
    // the download.
    const renderRequest = page.waitForRequest((request) => {
      if (!request.url().includes("/api/render/pdf")) return false;
      try {
        const body = JSON.parse(request.postData() ?? "") as {
          resume?: { basics?: { name?: string } };
          template?: unknown;
        };
        return body.resume?.basics?.name === FULL_NAME && typeof body.template === "string";
      } catch {
        return false;
      }
    });
    const downloadPromise = page.waitForEvent("download");
    await exportModal.exportPdf();

    await renderRequest;
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("ada-lovelace.pdf");

    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const bytes = await readFile(filePath);
    expect(bytes.length).toBeGreaterThan(0);
    expect(bytes.equals(PDF_STUB)).toBe(true);

    await exportModal.assertClosed();
  });

  test("exports resume JSON with the edited content", async ({
    page,
    docEditorPage,
    exportModal,
  }) => {
    await docEditorPage.openExportModal();
    await exportModal.assertOpen();

    const downloadPromise = page.waitForEvent("download");
    await exportModal.exportJson();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("ada-lovelace.json");

    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as {
      basics: { name: string };
      sections: unknown;
      metadata: { template: string };
    };
    expect(parsed.basics.name).toBe(FULL_NAME);
    expect(parsed.sections).toBeDefined();
    expect(parsed.metadata.template).toBeDefined();

    await exportModal.assertClosed();
  });

  test("shows an error and stays open when PDF rendering fails", async ({
    page,
    docEditorPage,
    exportModal,
  }) => {
    // Shadows the fixture stub; removed handler-specifically afterwards.
    const failRender = (route: import("@playwright/test").Route) => route.fulfill({ status: 500 });
    await page.route("**/api/render/pdf", failRender);

    await docEditorPage.openExportModal();
    await exportModal.assertOpen();
    await exportModal.exportPdf();

    // The modal stays open so the user can retry or pick another format.
    await exportModal.assertOpen();
    await expect(exportModal.dialog.getByText(/failed|error/i).first()).toBeVisible();

    await page.unroute("**/api/render/pdf", failRender);
  });
});
