import { test as base } from "@playwright/test";
import HomePage from "../pages/HomePage";
import BuilderPage from "../pages/BuilderPage";
import AccountPage from "../pages/AccountPage";
import TemplatePickerModal from "../pages/TemplatePickerModal";
import ExportModal from "../pages/ExportModal";
import ImportModal from "../pages/ImportModal";

/** Route pattern for the auth-mode probe issued on app boot. */
const AUTH_PROBE_ROUTE = "**/auth/me";
/** Route pattern for the server-side preview renderer. */
export const PREVIEW_ROUTE = "**/api/render/preview";
/** Route pattern for the server-side PDF renderer. */
export const PDF_ROUTE = "**/api/render/pdf";
/** Route pattern for the template catalog. */
export const TEMPLATES_ROUTE = "**/api/templates";
/** Route pattern for template thumbnail images. */
export const THUMBNAIL_ROUTE = "**/api/templates/*/thumbnail";
/**
 * Google Fonts endpoints — aborted so text always renders with the same
 * fallback fonts: hermetic, and identical between local and CI runs.
 */
const FONT_ROUTES = ["https://fonts.googleapis.com/**", "https://fonts.gstatic.com/**"];

/** 1x1 transparent PNG, stands in for a rendered preview page. */
const PREVIEW_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** Minimal single-page PDF document, stands in for a rendered export. */
export const PDF_STUB = Buffer.from(
  [
    "%PDF-1.4",
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj",
    "trailer<</Root 1 0 R>>",
    "%%EOF",
  ].join("\n"),
);

/**
 * Deterministic template catalog served to the TemplatePicker. Ids, display
 * names, and theme colors mirror real templates from
 * `crates/render/src/typst_engine/engine.rs` so assertions match what the
 * production API would return.
 */
export const TEMPLATE_FIXTURES = [
  {
    id: "rhyhorn",
    name: "Rhyhorn",
    theme: { background: "#ffffff", text: "#000000", primary: "#65a30d" },
  },
  {
    id: "azurill",
    name: "Azurill",
    theme: { background: "#ffffff", text: "#1f2937", primary: "#d97706" },
  },
  {
    id: "onyx",
    name: "Onyx",
    theme: { background: "#ffffff", text: "#111827", primary: "#dc2626" },
  },
] as const;

/** Template id every new resume starts with (`src/wasm/defaults.ts`). */
export const DEFAULT_TEMPLATE_ID = "rhyhorn";

interface Fixtures {
  homePage: HomePage;
  builderPage: BuilderPage;
  accountPage: AccountPage;
  templatePickerModal: TemplatePickerModal;
  exportModal: ExportModal;
  importModal: ImportModal;
}

/**
 * All suites exercise the app in local (self-hosted) mode: the auth probe
 * answers 404 so no cloud account is involved, and every backend rendering
 * endpoint — a service outside the scope of these suites — is fulfilled with
 * a deterministic stub so the client-side pipeline can be asserted end to
 * end without a server.
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
    await page.route(PDF_ROUTE, (route) =>
      route.fulfill({ status: 200, contentType: "application/pdf", body: PDF_STUB }),
    );
    await page.route(THUMBNAIL_ROUTE, (route) =>
      route.fulfill({ status: 200, contentType: "image/png", body: PREVIEW_PNG }),
    );
    await page.route(TEMPLATES_ROUTE, (route) =>
      route.fulfill({ status: 200, json: TEMPLATE_FIXTURES }),
    );
    for (const fontRoute of FONT_ROUTES) {
      await page.route(fontRoute, (route) => route.abort());
    }
    await use(page);
    for (const fontRoute of FONT_ROUTES) {
      await page.unroute(fontRoute);
    }
    await page.unroute(TEMPLATES_ROUTE);
    await page.unroute(THUMBNAIL_ROUTE);
    await page.unroute(PDF_ROUTE);
    await page.unroute(PREVIEW_ROUTE);
    await page.unroute(AUTH_PROBE_ROUTE);
  },
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  builderPage: async ({ page }, use) => {
    await use(new BuilderPage(page));
  },
  accountPage: async ({ page }, use) => {
    await use(new AccountPage(page));
  },
  templatePickerModal: async ({ page }, use) => {
    await use(new TemplatePickerModal(page));
  },
  exportModal: async ({ page }, use) => {
    await use(new ExportModal(page));
  },
  importModal: async ({ page }, use) => {
    await use(new ImportModal(page));
  },
});

export { expect } from "@playwright/test";
