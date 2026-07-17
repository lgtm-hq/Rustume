import { test, expect } from "./support/fixtures";

const FULL_NAME = "Ada Lovelace";
const OFFLINE_EDIT = "Ada Lovelace, Countess";
/** The list title derives from the typed name at whichever save resolved it,
 *  or stays at the placeholder when the first save preceded WASM readiness. */
const TITLE_PATTERN = /^(Ada Lovelace(, Countess)?|Untitled Resume)$/;

test.describe("offline behavior", () => {
  test("edits made offline are saved locally and survive reconnect + reload", async ({
    page,
    context,
    homePage,
    builderPage,
  }) => {
    await homePage.open();
    await homePage.createResume();
    await builderPage.assertEditorOpen();
    await builderPage.assertSaved();
    await builderPage.fillFullName(FULL_NAME);
    await builderPage.assertSaved();

    // Go offline: local-mode persistence must keep working without network.
    await context.setOffline(true);
    await builderPage.fillFullName(OFFLINE_EDIT);
    await builderPage.assertUnsaved();
    await builderPage.assertSaved();

    // Client-side navigation still works offline and lists the saved resume.
    await builderPage.goHome();
    await homePage.assertLoaded();
    await homePage.assertResumeListed(TITLE_PATTERN);
    await homePage.openResume(TITLE_PATTERN);
    await builderPage.assertEditorOpen();

    // Back online: a full reload serves the state persisted while offline.
    // Reconnecting first is deliberate — the harness blocks service workers
    // (playwright.config.ts) so route stubbing stays reliable, which means
    // the app shell itself cannot be served while the network is down.
    await context.setOffline(false);
    await page.reload();
    await builderPage.assertEditorOpen();
    await builderPage.assertFullName(OFFLINE_EDIT);
  });

  test("preview recovers after connectivity is restored", async ({
    page,
    homePage,
    builderPage,
  }) => {
    await homePage.open();
    await homePage.createResume();
    await builderPage.assertEditorOpen();
    await builderPage.assertSaved();
    await builderPage.assertPreviewVisible();

    // Simulate the render backend being unreachable. Registering a second
    // handler for the pattern shadows the fixture stub without removing it.
    const dropPreview = (route: import("@playwright/test").Route) =>
      route.abort("internetdisconnected");
    await page.route("**/api/render/preview", dropPreview);
    await builderPage.fillFullName(FULL_NAME);
    await builderPage.assertSaved();
    // The failed render surfaces as an error state replacing the preview
    // image — proving the outage actually broke the preview pipeline.
    await expect(builderPage.previewImage).toBeHidden();

    // Reconnect: removing only the outage handler restores the stub, and the
    // next edit triggers a re-render that must complete successfully with
    // the latest content.
    await page.unroute("**/api/render/preview", dropPreview);
    const previewResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/render/preview") &&
        (response.request().postData() ?? "").includes(OFFLINE_EDIT),
    );
    await builderPage.fillFullName(OFFLINE_EDIT);
    expect((await previewResponse).ok()).toBe(true);
    await builderPage.assertPreviewVisible();
  });
});
