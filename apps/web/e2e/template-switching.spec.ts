import { test, expect, TEMPLATE_FIXTURES } from "./support/fixtures";

const FULL_NAME = "Ada Lovelace";
/** Display name of the template every new resume starts with. */
const DEFAULT_TEMPLATE_NAME = "Rhyhorn";
const TARGET_ID = "azurill";
const target = TEMPLATE_FIXTURES.find((template) => template.id === TARGET_ID);
if (!target) throw new Error(`Template fixture ${TARGET_ID} missing`);
const TARGET = target;

test.describe("template switching", () => {
  test.beforeEach(async ({ homePage, docEditorPage }) => {
    await homePage.open();
    await homePage.createResume();
    await docEditorPage.assertDocEditorOpen();
    await docEditorPage.assertSaved();
  });

  test("drawer lists every template and marks the current one", async ({
    docEditorPage,
    templatesDrawer,
  }) => {
    await docEditorPage.openTemplatesDrawer();
    await templatesDrawer.assertOpen();
    for (const template of TEMPLATE_FIXTURES) {
      await templatesDrawer.assertTemplateListed(template.name);
    }

    await templatesDrawer.assertCurrentTemplate(DEFAULT_TEMPLATE_NAME);
  });

  test("switching templates keeps resume data and marks the new current", async ({
    page,
    docEditorPage,
    templatesDrawer,
  }) => {
    await docEditorPage.fillName(FULL_NAME);
    await docEditorPage.assertSaved();

    await docEditorPage.openTemplatesDrawer();
    await templatesDrawer.assertOpen();

    // Selecting a template applies it as one store action and closes the
    // drawer; the sheet re-renders from the new layout reactively (#797).
    await templatesDrawer.selectTemplate(TARGET.name);
    await templatesDrawer.assertClosed();

    // Resume data survived the switch.
    await docEditorPage.assertName(FULL_NAME);

    // The selection persists across a reload.
    await docEditorPage.assertSaved();
    await page.reload();
    await docEditorPage.assertDocEditorOpen();
    await docEditorPage.assertName(FULL_NAME);
    await docEditorPage.openTemplatesDrawer();
    await templatesDrawer.assertOpen();
    await templatesDrawer.assertCurrentTemplate(TARGET.name);
  });

  test("dismissing the drawer keeps the current template", async ({
    docEditorPage,
    templatesDrawer,
  }) => {
    await docEditorPage.openTemplatesDrawer();
    await templatesDrawer.assertOpen();
    await templatesDrawer.dismiss();
    await templatesDrawer.assertClosed();

    await docEditorPage.openTemplatesDrawer();
    await templatesDrawer.assertOpen();
    await templatesDrawer.assertCurrentTemplate(DEFAULT_TEMPLATE_NAME);
  });

  test("templates drawer shows an empty state when no templates load", async ({
    page,
    docEditorPage,
    templatesDrawer,
  }) => {
    // Shadows the fixture stub; removed handler-specifically afterwards.
    const emptyCatalog = (route: import("@playwright/test").Route) =>
      route.fulfill({ status: 200, json: [] });
    await page.route("**/api/templates", emptyCatalog);
    await docEditorPage.openTemplatesDrawer();
    await templatesDrawer.assertOpen();
    await expect(
      templatesDrawer.dialog.getByText("No templates available", { exact: false }),
    ).toBeVisible();
    await page.unroute("**/api/templates", emptyCatalog);
  });
});
