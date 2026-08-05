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

  test("creating a resume opens the document editor and edits land on the sheet", async ({
    homePage,
    docEditorPage,
  }) => {
    await homePage.open();
    await homePage.createResume();
    await docEditorPage.assertDocEditorOpen();

    // A brand-new empty resume opens ready to type (#785); committing the
    // typed field dialog draws the new content straight on the sheet.
    await docEditorPage.assertMode("edit");
    await docEditorPage.fillName(FULL_NAME);
    await docEditorPage.assertName(FULL_NAME);

    // Done mode shows the same content as the clean rendered document.
    await docEditorPage.toggleMode();
    await docEditorPage.assertMode("done");
    await docEditorPage.assertName(FULL_NAME);
  });

  test("edited resume persists across a reload in local mode", async ({
    page,
    homePage,
    docEditorPage,
  }) => {
    await homePage.open();
    await homePage.createResume();
    await docEditorPage.assertDocEditorOpen();

    // Let the initial creation auto-save settle first, then anchor on the
    // Unsaved state so the final Saved assertion can only come from the
    // debounced save that persists the typed name.
    await docEditorPage.assertSaved();
    await docEditorPage.fillName(FULL_NAME);
    await docEditorPage.assertUnsaved();
    await docEditorPage.assertSaved();

    await page.reload();
    await docEditorPage.assertDocEditorOpen();
    await docEditorPage.assertName(FULL_NAME);

    // The stored resume also shows up on the home page list. Navigate
    // client-side so the already-initialized WASM storage serves the list.
    await docEditorPage.goHome();
    await homePage.assertLoaded();
    // The list title is derived once, on the save that created the resume,
    // and is sticky afterwards so an explicit rename survives later edits —
    // a resume created empty therefore keeps the placeholder title even
    // after basics.name is filled in.
    await homePage.assertResumeListed("Untitled Resume");
  });
});
