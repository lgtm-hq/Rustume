import { test } from "./support/fixtures";

/**
 * The document editor is the default `/edit/:id` surface (#734), with
 * `?ff=form-builder` as the temporary escape hatch back to the legacy form
 * editor. These tests run without the suite-wide override seed so they see
 * the real default. TODO(#735): fold into the main suites once the form
 * builder is retired.
 */
test.use({ formBuilderOverride: false });

test.describe("document editor default", () => {
  test("a fresh browser gets the document editor at /edit/:id", async ({
    homePage,
    docEditorPage,
  }) => {
    await homePage.open();
    await homePage.createResume();

    await docEditorPage.assertUrl(/\/edit\/[\w-]+$/);
    await docEditorPage.assertDocEditorOpen();
  });

  test("?ff=form-builder restores the legacy editor and persists until ?ff=off", async ({
    page,
    homePage,
    builderPage,
    docEditorPage,
  }) => {
    await homePage.open();
    await homePage.createResume();
    await docEditorPage.assertUrl(/\/edit\/[\w-]+$/);
    const editUrl = new URL(page.url());
    const id = editUrl.pathname.split("/").pop() as string;

    await test.step("the escape hatch serves the form editor", async () => {
      await docEditorPage.openWithFlag(id, "form-builder");
      await builderPage.assertFormSurface();
    });

    await test.step("the override persists across a plain visit", async () => {
      await builderPage.open(id);
      await builderPage.assertEditorOpen();
    });

    await test.step("?ff=off clears the override back to the default", async () => {
      await docEditorPage.openWithFlag(id, "off");
      await docEditorPage.assertDocEditorOpen();
    });
  });

  test("the transition-era ?ff=doc-editor request forgets a persisted override", async ({
    page,
    homePage,
    builderPage,
    docEditorPage,
  }) => {
    await homePage.open();
    await homePage.createResume();
    await docEditorPage.assertUrl(/\/edit\/[\w-]+$/);
    const id = new URL(page.url()).pathname.split("/").pop() as string;

    await docEditorPage.openWithFlag(id, "form-builder");
    await builderPage.assertFormSurface();

    await docEditorPage.openWithFlag(id, "doc-editor");
    await docEditorPage.assertDocEditorOpen();

    await docEditorPage.open(id);
    await docEditorPage.assertDocEditorOpen();
  });
});
