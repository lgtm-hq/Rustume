import { test as base } from "@playwright/test";
import HomePage from "../pages/HomePage";
import BuilderPage from "../pages/BuilderPage";

/** Route pattern for the auth-mode probe issued on app boot. */
const AUTH_PROBE_ROUTE = "**/auth/me";
/** Route pattern for the server-side preview renderer. */
export const PREVIEW_ROUTE = "**/api/render/preview";

/** 1x1 transparent PNG, stands in for a rendered preview page. */
const PREVIEW_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

interface Fixtures {
  homePage: HomePage;
  builderPage: BuilderPage;
}

/**
 * Smoke tests exercise the app in local (self-hosted) mode: the auth probe
 * answers 404 so no cloud account is involved, and the preview renderer —
 * a backend service outside the scope of this suite — is fulfilled with a
 * stub image so the client-side preview pipeline can be asserted end to end.
 */
export const test = base.extend<Fixtures>({
  page: async ({ page }, use) => {
    await page.route(AUTH_PROBE_ROUTE, (route) => route.fulfill({ status: 404 }));
    await page.route(PREVIEW_ROUTE, (route) =>
      route.fulfill({
        status: 200,
        contentType: "image/png",
        headers: { "X-Total-Pages": "1" },
        body: PREVIEW_PNG,
      }),
    );
    await use(page);
    await page.unroute(PREVIEW_ROUTE);
    await page.unroute(AUTH_PROBE_ROUTE);
  },
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  builderPage: async ({ page }, use) => {
    await use(new BuilderPage(page));
  },
});

export { expect } from "@playwright/test";
