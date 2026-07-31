import { test, expect } from "./support/fixtures";

/**
 * SC 1.4.10 Reflow (Level AA): content must not require two-dimensional
 * scrolling at a 320 CSS px viewport (what 1280px at 400% zoom produces).
 * axe has no reflow rule — it is not machine-checkable from a single-viewport
 * scan — which is exactly why the otherwise-green accessibility suite missed
 * Rustume#677: `/faq/`'s `.docs-resource-tag` overran the viewport by 4px
 * (`document.documentElement.scrollWidth` 324 vs `clientWidth` 320).
 *
 * A component may still scroll on its OWN axis (a wide table or code block
 * with `overflow-x: auto`) — SC 1.4.10 only prohibits the *document*
 * scrolling. So this asserts `document.documentElement.scrollWidth`, not
 * anything about descendant elements.
 *
 * Routes are read from the built sitemap rather than hardcoded, so a newly
 * added page is covered automatically instead of silently being skipped —
 * the same gap that let the FAQ page go unmeasured until a manual pass
 * (#623) found it.
 */
test.describe("reflow at 320px", () => {
  test.use({ viewport: { width: 320, height: 512 } });

  test("no site route scrolls the document horizontally", async ({ page, baseURL }) => {
    if (!baseURL) {
      throw new Error("baseURL must be configured for the reflow suite");
    }
    const sitemapUrl = new URL("/sitemap-0.xml", baseURL).toString();
    const response = await page.request.get(sitemapUrl);
    expect(response.ok(), `GET ${sitemapUrl}`).toBe(true);
    const xml = await response.text();
    const routes = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(([, loc]) => {
      if (!loc) {
        throw new Error("sitemap <loc> entry did not capture a URL");
      }
      return new URL(loc).pathname;
    });
    expect(routes.length, "sitemap should list at least one route").toBeGreaterThan(0);

    const overflowing: string[] = [];
    for (const route of routes) {
      await test.step(route, async () => {
        await page.goto(route);
        await expect(page.getByRole("main")).toBeVisible();
        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        if (scrollWidth > clientWidth) {
          overflowing.push(`${route} (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`);
        }
      });
    }

    expect(overflowing).toEqual([]);
  });
});
