/**
 * Per-template sheet visual baselines for the shared doc-editor fixture.
 *
 * Renders `tests/fixtures/v3/doc-editor.json` once per shipped template and
 * snapshots the document sheet. Lives next to the Typst/PDF baseline set under
 * `crates/render/tests/baselines/pdf/` for parity *review* — the two raster
 * pipelines are not auto-compared pixel-for-pixel (see #831).
 *
 * Baselines are generated on CI (Linux) and committed from the workflow
 * artifact, matching the #812 convention. Local runs skip by default; opt in
 * with `E2E_VISUAL=1` (expect platform diffs until you pull CI actuals).
 */
import { fileURLToPath } from "node:url";
import { test, expect, TEMPLATES_ROUTE } from "./support/fixtures";
import { FULL_TEMPLATE_CATALOG } from "./support/fullTemplateCatalog";

test.skip(
  !process.env.CI && process.env.E2E_VISUAL !== "1",
  "Visual baselines are CI (Linux) generated; set E2E_VISUAL=1 to compare locally",
);

/** Shared Reactive Resume v3 fixture used by both sheet and PDF baseline sets. */
const DOC_EDITOR_FIXTURE = fileURLToPath(
  new URL("../../../tests/fixtures/v3/doc-editor.json", import.meta.url),
);

test.describe("per-template sheet baselines", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(TEMPLATES_ROUTE, (route) =>
      route.fulfill({ status: 200, json: FULL_TEMPLATE_CATALOG }),
    );
  });

  test.afterEach(async ({ page }) => {
    await page.unroute(TEMPLATES_ROUTE);
  });

  for (const template of FULL_TEMPLATE_CATALOG) {
    test(`sheet · ${template.id}`, async ({
      page,
      homePage,
      docEditorPage,
      importModal,
      templatesDrawer,
    }) => {
      await homePage.open();
      await homePage.createResume();
      await docEditorPage.assertDocEditorOpen();
      await docEditorPage.assertSaved();

      await docEditorPage.openImportModal();
      await importModal.assertOpen();
      await importModal.importFile(DOC_EDITOR_FIXTURE);
      await expect(page.getByText("Resume imported successfully")).toBeVisible({
        timeout: 15_000,
      });
      await importModal.assertClosed();
      await docEditorPage.assertName("Mireille Okafor");
      await docEditorPage.assertSaved();

      // Transient toasts would otherwise pollute the steady frame.
      await expect(page.getByText("New resume created")).toBeHidden({ timeout: 15_000 });
      await expect(page.getByText("Resume imported successfully")).toBeHidden({
        timeout: 15_000,
      });

      // Fixture ships as ditto — switch when the target differs so applyTemplate
      // rebuilds layout from this template's registry metadata.
      if (template.id !== "ditto") {
        await docEditorPage.openTemplatesDrawer();
        await templatesDrawer.assertOpen();
        await templatesDrawer.selectTemplate(template.name);
        await templatesDrawer.assertClosed();
        await docEditorPage.assertDocEditorOpen();
        await docEditorPage.assertSaved();
      }

      await expect(docEditorPage.sheet).toHaveScreenshot(`sheet-${template.id}.png`);
    });
  }
});
