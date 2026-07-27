import { test as base } from "@playwright/test";
import HomePage from "../pages/HomePage";
import DocsPage from "../pages/DocsPage";
import PricingPage from "../pages/PricingPage";
import TemplateGalleryPage from "../pages/TemplateGalleryPage";

/**
 * Google Fonts endpoints — aborted so text always renders with the same
 * fallback fonts: hermetic, and identical between local and CI runs.
 * `global.css` @imports them, so without this the suite needs the network.
 */
const FONT_ROUTES = ["https://fonts.googleapis.com/**", "https://fonts.gstatic.com/**"];

/** Docs slug used wherever a suite needs "a representative prose page". */
export const SAMPLE_DOC = {
  slug: "getting-started/quickstart",
  title: "Quickstart",
} as const;

/** Title of the docs entry that embeds the pricing table. */
export const PRICING_TITLE = "Hosting Options";

/** Title of the docs entry that embeds the template gallery. */
export const TEMPLATES_TITLE = "Templates";

/** Template whose preview dialog the suites open. */
export const SAMPLE_TEMPLATE_ID = "onyx";

interface Fixtures {
  homePage: HomePage;
  docsPage: DocsPage;
  pricingPage: PricingPage;
  templateGalleryPage: TemplateGalleryPage;
}

/**
 * The site is a static build served by `astro preview`, so there is no backend
 * to stub — the only external dependency is the webfont CDN, and that is cut.
 */
export const test = base.extend<Fixtures>({
  page: async ({ page }, use) => {
    for (const fontRoute of FONT_ROUTES) {
      await page.route(fontRoute, (route) => route.abort());
    }
    await use(page);
    for (const fontRoute of FONT_ROUTES) {
      await page.unroute(fontRoute);
    }
  },
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  docsPage: async ({ page }, use) => {
    await use(new DocsPage(page));
  },
  pricingPage: async ({ page }, use) => {
    await use(new PricingPage(page));
  },
  templateGalleryPage: async ({ page }, use) => {
    await use(new TemplateGalleryPage(page));
  },
});

export { expect } from "@playwright/test";
