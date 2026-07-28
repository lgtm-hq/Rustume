import { test, expect, SAMPLE_DOC } from "./support/fixtures";

/**
 * Guards SC 1.3.1 / 2.4.6 heading structure for the marketing site's own
 * pages (`apps/site`, not the app chrome — that's tracked separately at
 * https://github.com/lgtm-hq/Rustume/issues/670).
 *
 * axe's `heading-order` rule is `best-practice`-tagged, so a WCAG-tag-only
 * scan (see `accessibility.spec.ts`) never runs it. This walks the DOM
 * outline directly instead of relying on axe, so the assertion holds even if
 * the axe rule selection changes again later. Rustume#676: the footer's
 * `.footer-col` headings used to render as `<h4>` following the page's
 * `<h2>`s, skipping a level on every docs/FAQ/cloud page. `/` happened to
 * pass only because its own content supplies the missing `h3` level.
 */

/** Every route measured in issue #676, plus a representative docs article. */
const ROUTES = ["/", "/docs/", "/faq/", "/cloud/", `/docs/${SAMPLE_DOC.slug}/`];

/** Reads every `h1`..`h6` in DOM order as rendered. */
async function headingLevels(page: import("@playwright/test").Page): Promise<number[]> {
  return page.$$eval("h1, h2, h3, h4, h5, h6", (nodes) =>
    nodes.map((node) => Number(node.tagName.slice(1))),
  );
}

for (const route of ROUTES) {
  test(`heading outline on ${route} never skips a level`, async ({ page }) => {
    await page.goto(route);
    const levels = await headingLevels(page);
    expect(levels.length).toBeGreaterThan(0);

    const skips: string[] = [];
    for (let i = 1; i < levels.length; i++) {
      const previous = levels[i - 1] as number;
      const current = levels[i] as number;
      if (current > previous + 1) {
        skips.push(`h${previous} -> h${current} (position ${i})`);
      }
    }
    expect(skips, `outline was: ${levels.map((level) => `h${level}`).join(", ")}`).toEqual([]);
  });
}
