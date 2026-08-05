import { test } from "./support/fixtures";

const FULL_NAME = "Ada Lovelace";
const OFFLINE_EDIT = "Ada Lovelace, Countess";
/** The list title is derived once, on the creating save, and is sticky after —
 *  a resume created empty keeps the placeholder however the basics change. */
const LISTED_TITLE = "Untitled Resume";

test.describe("offline behavior", () => {
  test("edits made offline are saved locally and survive reconnect + reload", async ({
    page,
    context,
    homePage,
    docEditorPage,
  }) => {
    await homePage.open();
    await homePage.createResume();
    await docEditorPage.assertDocEditorOpen();
    await docEditorPage.assertSaved();
    await docEditorPage.fillName(FULL_NAME);
    await docEditorPage.assertSaved();

    // Go offline: local-mode persistence must keep working without network.
    await context.setOffline(true);
    await docEditorPage.fillName(OFFLINE_EDIT);
    await docEditorPage.assertUnsaved();
    await docEditorPage.assertSaved();

    // Client-side navigation still works offline and lists the saved resume.
    await docEditorPage.goHome();
    await homePage.assertLoaded();
    await homePage.assertResumeListed(LISTED_TITLE);
    await homePage.openResume(LISTED_TITLE);
    await docEditorPage.assertDocEditorOpen();

    // Back online: a full reload serves the state persisted while offline.
    // Reconnecting first is deliberate — the harness blocks service workers
    // (playwright.config.ts) so route stubbing stays reliable, which means
    // the app shell itself cannot be served while the network is down.
    await context.setOffline(false);
    await page.reload();
    await docEditorPage.assertDocEditorOpen();
    await docEditorPage.assertName(OFFLINE_EDIT);
  });
});
