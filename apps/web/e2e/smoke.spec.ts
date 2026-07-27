import { test, expect } from "./support/fixtures";

const FULL_NAME = "Ada Lovelace";

test.describe("smoke", () => {
  test("app loads, WASM initializes, and the resume list renders", async ({ page, homePage }) => {
    const wasmResponse = page.waitForResponse((response) =>
      response.url().endsWith("rustume_wasm_bg.wasm"),
    );

    await homePage.open();
    await homePage.assertLoaded();

    // The WASM binary was fetched successfully and the app did not fall back.
    expect((await wasmResponse).ok()).toBe(true);
    await homePage.assertWasmLoaded();

    // Fresh browser context: the resume list renders its empty state.
    await homePage.assertEmptyState();
  });

  test("creating a resume opens the editor and typing updates the preview", async ({
    page,
    homePage,
    builderPage,
  }) => {
    await homePage.open();
    await homePage.createResume();
    await builderPage.assertEditorOpen();

    // Typing triggers a debounced re-render request carrying the new content.
    const previewRequest = page.waitForRequest(
      (request) =>
        request.url().includes("/api/render/preview") &&
        (request.postData() ?? "").includes(FULL_NAME),
    );
    await builderPage.fillFullName(FULL_NAME);
    await builderPage.assertFullName(FULL_NAME);

    await previewRequest;
    await builderPage.assertPreviewVisible();
  });

  test("edited resume persists across a reload in local mode", async ({
    page,
    homePage,
    builderPage,
  }) => {
    await homePage.open();
    await homePage.createResume();
    await builderPage.assertEditorOpen();

    // Let the initial creation auto-save settle first, then anchor on the
    // Unsaved state so the final Saved assertion can only come from the
    // debounced save that persists the typed name.
    await builderPage.assertSaved();
    await builderPage.fillFullName(FULL_NAME);
    await builderPage.assertUnsaved();
    await builderPage.assertSaved();

    await page.reload();
    await builderPage.assertEditorOpen();
    await builderPage.assertFullName(FULL_NAME);

    // The stored resume also shows up on the home page list. Navigate
    // client-side so the already-initialized WASM storage serves the list.
    await builderPage.goHome();
    await homePage.assertLoaded();
    // The list title is derived once, on the save that created the resume,
    // and is sticky afterwards so an explicit rename survives later edits —
    // a resume created empty therefore keeps the placeholder title even
    // after basics.name is filled in.
    await homePage.assertResumeListed("Untitled Resume");
  });
});
