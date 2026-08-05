import { test, expect } from "./support/fixtures";

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
    await docEditorPage.assertEditorOpen();
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
    await docEditorPage.assertEditorOpen();

    // Back online: a full reload serves the state persisted while offline.
    // Reconnecting first is deliberate — the harness blocks service workers
    // (playwright.config.ts) so route stubbing stays reliable, which means
    // the app shell itself cannot be served while the network is down.
    await context.setOffline(false);
    await page.reload();
    await docEditorPage.assertEditorOpen();
    await docEditorPage.assertName(OFFLINE_EDIT);
  });

  test("preview recovers after connectivity is restored", async ({
    page,
    homePage,
    docEditorPage,
  }) => {
    await homePage.open();
    await homePage.createResume();
    await docEditorPage.assertEditorOpen();
    await docEditorPage.assertSaved();
    await docEditorPage.assertPreviewVisible();

    // Simulate the render backend being unreachable. Registering a second
    // handler for the pattern shadows the fixture stub without removing it.
    const dropPreview = (route: import("@playwright/test").Route) =>
      route.abort("internetdisconnected");
    await page.route("**/api/render/preview", dropPreview);
    await docEditorPage.fillName(FULL_NAME);
    await docEditorPage.assertSaved();
    // The failed render surfaces as an error state replacing the preview
    // image — proving the outage actually broke the preview pipeline.
    await expect(docEditorPage.previewImage).toBeHidden();

    // Reconnect: removing only the outage handler restores the stub, and the
    // next edit triggers a re-render that must complete successfully with
    // the latest content.
    await page.unroute("**/api/render/preview", dropPreview);
    const previewResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/render/preview") &&
        (response.request().postData() ?? "").includes(OFFLINE_EDIT),
    );
    await docEditorPage.fillName(OFFLINE_EDIT);
    expect((await previewResponse).ok()).toBe(true);
    await docEditorPage.assertPreviewVisible();
  });
});
