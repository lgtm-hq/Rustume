import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import {
  test,
  expect,
  PRICING_TITLE,
  SAMPLE_DOC,
  SAMPLE_TEMPLATE_ID,
  TEMPLATES_TITLE,
} from "./support/fixtures";
import { SCANNED_THEMES } from "./support/themes";

/** WCAG 2.2 AA scan scope (also includes the 2.0 and 2.1 A/AA baselines). */
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];

/**
 * Rules deferred to follow-up work. This suite asserts structure, semantics
 * and ARIA across themes; color decisions are design-language work with their
 * own lane.
 *
 * - `color-contrast`: the audited Craft palette already has a dedicated gate
 *   (`bun run check:contrast`), but the 40+ turbo flavors the picker offers
 *   have not been audited against the site's own components.
 *
 * It is not suppressed to hide a flake — it fails deterministically today, and
 * shipping it red would make the suite unusable as a gate. Every other WCAG
 * 2.2 A/AA rule runs, including `link-in-text-block`, whose failure was fixed
 * by underlining docs prose links (Rustume#648).
 */
const DEFERRED_RULES = ["color-contrast"];

/**
 * Rule overrides layered on top of the tag selection.
 *
 * `target-size` (SC 2.5.8, 24x24 CSS px minimum) and `heading-order`
 * (SC 1.3.1, no heading level skips) both ship `enabled: false` /
 * `best-practice`-tagged in axe-core, so selecting the `wcag22aa` tag alone
 * is not enough to run either — they have to be switched on explicitly. The
 * deferred rules are turned off in the same map because `disableRules()`
 * would replace it wholesale.
 */
const RULE_OVERRIDES: Record<string, { enabled: boolean }> = {
  "target-size": { enabled: true },
  "heading-order": { enabled: true },
  ...Object.fromEntries(DEFERRED_RULES.map((rule) => [rule, { enabled: false }])),
};

/** Human-readable summary so failures state the rule, impact, and targets. */
interface ViolationSummary {
  rule: string;
  impact: string;
  description: string;
  targets: string[];
}

/** Every bucket axe reports a rule under once it has actually been evaluated. */
const RESULT_GROUPS = ["passes", "violations", "incomplete", "inapplicable"] as const;

type AxeResults = Awaited<ReturnType<AxeBuilder["analyze"]>>;

/**
 * Guard against a silently skipped rule. `target-size` is off by default and
 * only runs because of `RULE_OVERRIDES`; if a refactor drops that override (or
 * reorders `options()` after `withTags()`), the suite would keep passing while
 * scanning strictly less. A rule that ran always lands in one of the four
 * result buckets, so absence from all of them means it never ran.
 */
function assertRuleEvaluated(results: AxeResults, ruleId: string): void {
  const evaluated = RESULT_GROUPS.some((group) =>
    results[group].some((result) => result.id === ruleId),
  );
  if (!evaluated) {
    throw new Error(
      `axe never evaluated the "${ruleId}" rule — check RULE_OVERRIDES and the tag scope.`,
    );
  }
}

async function scanForViolations(page: Page, include?: string): Promise<ViolationSummary[]> {
  // `options()` replaces the whole option object, so it must come before
  // `withTags()` — the reverse order would drop the tag selection.
  let builder = new AxeBuilder({ page }).options({ rules: RULE_OVERRIDES }).withTags(WCAG_TAGS);
  if (include) {
    builder = builder.include(include);
  }
  const results = await builder.analyze();
  assertRuleEvaluated(results, "target-size");
  assertRuleEvaluated(results, "heading-order");
  // This one is tag-selected rather than overridden, so nothing in
  // RULE_OVERRIDES keeps it alive — but it was suppressed until #648 and the
  // claim that it runs again is the point of that change. Dropping it back
  // into DEFERRED_RULES would otherwise turn the suite green by scanning less,
  // which is the failure mode this guard exists for.
  assertRuleEvaluated(results, "link-in-text-block");
  return results.violations.map((violation) => ({
    rule: violation.id,
    impact: violation.impact ?? "unknown",
    description: violation.description,
    targets: violation.nodes.flatMap((node) => node.target.map(String)),
  }));
}

for (const theme of SCANNED_THEMES) {
  test.describe(`accessibility (${theme.id})`, () => {
    test("home page has no WCAG 2.2 AA violations", async ({ page, homePage }) => {
      await homePage.open();
      await homePage.assertLoaded();
      await homePage.useTheme(theme);
      expect(await scanForViolations(page)).toEqual([]);
    });

    test("docs page has no WCAG 2.2 AA violations", async ({ page, docsPage }) => {
      await docsPage.open(SAMPLE_DOC.slug);
      await docsPage.assertLoaded(SAMPLE_DOC.title);
      await docsPage.useTheme(theme);
      expect(await scanForViolations(page)).toEqual([]);
    });

    test("pricing table has no WCAG 2.2 AA violations", async ({ page, pricingPage }) => {
      await pricingPage.open();
      await pricingPage.assertLoaded(PRICING_TITLE);
      await pricingPage.assertPlansTableVisible();
      await pricingPage.useTheme(theme);
      expect(await scanForViolations(page)).toEqual([]);
    });

    test("template gallery has no WCAG 2.2 AA violations", async ({
      page,
      templateGalleryPage,
    }) => {
      await templateGalleryPage.open();
      await templateGalleryPage.assertLoaded(TEMPLATES_TITLE);
      await templateGalleryPage.assertGalleryLoaded();
      await templateGalleryPage.useTheme(theme);
      expect(await scanForViolations(page)).toEqual([]);
    });

    test("open template preview dialog has no WCAG 2.2 AA violations", async ({
      page,
      templateGalleryPage,
    }) => {
      await templateGalleryPage.open();
      await templateGalleryPage.assertGalleryLoaded();
      await templateGalleryPage.useTheme(theme);
      await templateGalleryPage.openPreview(SAMPLE_TEMPLATE_ID);
      expect(await scanForViolations(page)).toEqual([]);
    });

    test("open search dialog has no WCAG 2.2 AA violations", async ({ page, homePage }) => {
      await homePage.open();
      await homePage.useTheme(theme);
      await homePage.openSearch();
      expect(await scanForViolations(page)).toEqual([]);
    });

    test("open theme picker has no WCAG 2.2 AA violations", async ({ page, homePage }) => {
      await homePage.open();
      await homePage.useTheme(theme);
      await homePage.openThemeMenu();
      expect(await scanForViolations(page)).toEqual([]);
    });
  });
}
