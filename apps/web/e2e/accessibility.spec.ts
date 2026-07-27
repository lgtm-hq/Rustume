import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { test, expect, DEFAULT_TEMPLATE_ID } from "./support/fixtures";

/** WCAG 2.1 AA scan scope (also includes the 2.0 A/AA baseline). */
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/**
 * Known pre-existing failures, excluded so the suite guards against
 * regressions on everything else.
 *
 * TODO(#352): re-enable color-contrast once the design-audit palette fixes
 * land — the stone-on-paper secondary text currently sits below the 4.5:1
 * AA ratio across all pages.
 */
const KNOWN_FAILING_RULES = ["color-contrast"];

/** Human-readable summary so failures state the rule, impact, and targets. */
interface ViolationSummary {
  rule: string;
  impact: string;
  description: string;
  targets: string[];
}

async function scanForViolations(page: Page, include?: string): Promise<ViolationSummary[]> {
  let builder = new AxeBuilder({ page }).withTags(WCAG_TAGS).disableRules(KNOWN_FAILING_RULES);
  if (include) {
    builder = builder.include(include);
  }
  const results = await builder.analyze();
  return results.violations.map((violation) => ({
    rule: violation.id,
    impact: violation.impact ?? "unknown",
    description: violation.description,
    targets: violation.nodes.flatMap((node) => node.target.map(String)),
  }));
}

test.describe("accessibility", () => {
  test("home page has no WCAG 2.1 AA violations", async ({ page, homePage }) => {
    await homePage.open();
    await homePage.assertLoaded();
    expect(await scanForViolations(page)).toEqual([]);
  });

  test("editor has no WCAG 2.1 AA violations", async ({ page, homePage, builderPage }) => {
    await homePage.open();
    await homePage.createResume();
    await builderPage.assertEditorOpen();
    await builderPage.assertSaved();
    await builderPage.assertPreviewVisible();
    // Let the transient "New resume created" toast dismiss so the scan sees
    // the editor's steady state, not notification chrome mid-animation.
    await expect(page.getByText("New resume created")).toBeHidden({ timeout: 15_000 });
    expect(await scanForViolations(page)).toEqual([]);
  });

  test("template picker dialog has no WCAG 2.1 AA violations", async ({
    page,
    homePage,
    builderPage,
    templatePickerModal,
  }) => {
    await homePage.open();
    await homePage.createResume();
    await builderPage.assertEditorOpen();
    await builderPage.assertSaved();
    await builderPage.openTemplatePicker(DEFAULT_TEMPLATE_ID);
    await templatePickerModal.assertOpen();
    await templatePickerModal.assertTemplateListed("Rhyhorn");
    expect(await scanForViolations(page, '[role="dialog"]')).toEqual([]);
  });

  test("export dialog has no WCAG 2.1 AA violations", async ({
    page,
    homePage,
    builderPage,
    exportModal,
  }) => {
    await homePage.open();
    await homePage.createResume();
    await builderPage.assertEditorOpen();
    await builderPage.assertSaved();
    await builderPage.openExportModal();
    await exportModal.assertOpen();
    expect(await scanForViolations(page, '[role="dialog"]')).toEqual([]);
  });

  test("account page has no WCAG 2.1 AA violations", async ({ page, accountPage }) => {
    await accountPage.open();
    await accountPage.assertLocalMode();
    expect(await scanForViolations(page)).toEqual([]);
  });
});
