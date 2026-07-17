import { test } from "./support/fixtures";

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

    // Reconnect: removing only the outage handler restores the stub, and the
    // next edit triggers a successful re-render.
    await page.unroute("**/api/render/preview", dropPreview);
    const previewRequest = page.waitForRequest(
      (request) =>
        request.url().includes("/api/render/preview") &&
        (request.postData() ?? "").includes(OFFLINE_EDIT),
    );
    await builderPage.fillFullName(OFFLINE_EDIT);
    await previewRequest;
    await builderPage.assertPreviewVisible();
  });
});
