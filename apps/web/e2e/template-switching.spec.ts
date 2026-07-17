import { test, expect, DEFAULT_TEMPLATE_ID, TEMPLATE_FIXTURES } from "./support/fixtures";

const FULL_NAME = "Ada Lovelace";
const TARGET = TEMPLATE_FIXTURES[1]; // azurill

test.describe("template switching", () => {
  test.beforeEach(async ({ homePage, builderPage }) => {
    await homePage.open();
    await homePage.createResume();
    await builderPage.assertEditorOpen();
    await builderPage.assertSaved();
  });

  test("picker lists templates and shows a lightbox preview", async ({
    builderPage,
    templatePickerModal,
  }) => {
    await builderPage.openTemplatePicker(DEFAULT_TEMPLATE_ID);
    await templatePickerModal.assertOpen();
    for (const template of TEMPLATE_FIXTURES) {
      await templatePickerModal.assertTemplateListed(template.name);
    }

    await templatePickerModal.previewTemplate(TARGET.name);
    await templatePickerModal.assertPreviewOpen(TARGET.name);
  });

  test("switching templates re-renders the preview and keeps resume data", async ({
    page,
    builderPage,
    templatePickerModal,
  }) => {
    await builderPage.fillFullName(FULL_NAME);
    await builderPage.assertSaved();

    await builderPage.openTemplatePicker(DEFAULT_TEMPLATE_ID);
    await templatePickerModal.assertOpen();

    // Selecting a template triggers a re-render for it, still carrying the
    // resume content, and the render must complete successfully.
    const previewResponse = page.waitForResponse((response) => {
      if (!response.url().includes("/api/render/preview")) return false;
      const body = response.request().postData() ?? "";
      return body.includes(`"${TARGET.id}"`) && body.includes(FULL_NAME);
    });
    await templatePickerModal.selectTemplate(TARGET.name);
    await templatePickerModal.assertClosed();
    expect((await previewResponse).ok()).toBe(true);

    await builderPage.assertSelectedTemplate(TARGET.id);
    await builderPage.assertPreviewVisible();
    // Resume data survived the switch.
    await builderPage.assertFullName(FULL_NAME);

    // The selection persists across a reload.
    await builderPage.assertSaved();
    await page.reload();
    await builderPage.assertEditorOpen();
    await builderPage.assertSelectedTemplate(TARGET.id);
    await builderPage.assertFullName(FULL_NAME);
  });

  test("cancelling the picker keeps the current template", async ({
    builderPage,
    templatePickerModal,
  }) => {
    await builderPage.openTemplatePicker(DEFAULT_TEMPLATE_ID);
    await templatePickerModal.assertOpen();
    await templatePickerModal.cancel();
    await templatePickerModal.assertClosed();
    await builderPage.assertSelectedTemplate(DEFAULT_TEMPLATE_ID);
  });

  test("template picker shows an empty state when no templates load", async ({
    page,
    builderPage,
    templatePickerModal,
  }) => {
    // Shadows the fixture stub; removed handler-specifically afterwards.
    const emptyCatalog = (route: import("@playwright/test").Route) =>
      route.fulfill({ status: 200, json: [] });
    await page.route("**/api/templates", emptyCatalog);
    await builderPage.openTemplatePicker(DEFAULT_TEMPLATE_ID);
    await templatePickerModal.assertOpen();
    await expect(
      templatePickerModal.dialog.getByText("No templates available", { exact: false }),
    ).toBeVisible();
    await page.unroute("**/api/templates", emptyCatalog);
  });
});
