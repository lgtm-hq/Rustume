import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { test, expect, DEFAULT_TEMPLATE_ID } from "./support/fixtures";

/** WCAG 2.2 AA scan scope (also includes the 2.0 and 2.1 A/AA baselines). */
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];

/**
 * Rule overrides layered on top of the tag selection.
 *
 * `target-size` (SC 2.5.8, 24x24 CSS px minimum) ships `enabled: false` in
 * axe-core, so selecting the `wcag22aa` tag is not enough to run it — it has
 * to be switched on explicitly.
 */
const RULE_OVERRIDES: Record<string, { enabled: boolean }> = {
  "target-size": { enabled: true },
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
  return results.violations.map((violation) => ({
    rule: violation.id,
    impact: violation.impact ?? "unknown",
    description: violation.description,
    targets: violation.nodes.flatMap((node) => node.target.map(String)),
  }));
}

test.describe("accessibility", () => {
  test("home page has no WCAG 2.2 AA violations", async ({ page, homePage }) => {
    await homePage.open();
    await homePage.assertLoaded();
    expect(await scanForViolations(page)).toEqual([]);
  });

  test("editor has no WCAG 2.2 AA violations", async ({ page, homePage, builderPage }) => {
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

  test("template picker dialog has no WCAG 2.2 AA violations", async ({
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

  test("export dialog has no WCAG 2.2 AA violations", async ({
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

  /**
   * A freshly created resume has no section items, so the editor scan above
   * never reaches the reorder controls, the visibility toggle, the remove
   * button or the rich-text toolbar — exactly the dense, icon-only controls
   * SC 2.5.8 exists for. Populate a section so those targets are in the tree.
   */
  test("populated section editor has no WCAG 2.2 AA violations", async ({
    page,
    homePage,
    builderPage,
  }) => {
    await homePage.open();
    await homePage.createResume();
    await builderPage.assertEditorOpen();
    await builderPage.openSection("Experience");
    await builderPage.assertSectionOpen("Experience");
    await builderPage.addSectionItem();
    await builderPage.fillItemField("Position", "Engineer");
    // A second item makes the reorder buttons meaningful: with one item both
    // are disabled, and axe skips disabled controls.
    await builderPage.addSectionItem();
    await builderPage.fillItemField("Position", "Designer");
    await builderPage.assertSectionItemCount(2);
    await builderPage.assertSaved();
    await expect(page.getByText("New resume created")).toBeHidden({ timeout: 15_000 });
    expect(await scanForViolations(page)).toEqual([]);
  });

  /**
   * The layout editor is the app's only drag-and-drop surface, so it carries
   * the SC 2.5.7 move controls and the densest cluster of icon-only buttons in
   * the product. A new resume defaults to two columns, so the lateral move
   * controls render without any extra setup.
   */
  test("layout editor has no WCAG 2.2 AA violations", async ({ page, homePage, builderPage }) => {
    await homePage.open();
    await homePage.createResume();
    await builderPage.assertEditorOpen();
    await builderPage.openSection("Layout");
    await builderPage.assertSectionOpen("Layout");
    await expect(page.getByRole("group", { name: "Main" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Sidebar" })).toBeVisible();
    await expect(page.getByText("New resume created")).toBeHidden({ timeout: 15_000 });
    expect(await scanForViolations(page)).toEqual([]);
  });

  test("account page has no WCAG 2.2 AA violations", async ({ page, accountPage }) => {
    await accountPage.open();
    await accountPage.assertLocalMode();
    expect(await scanForViolations(page)).toEqual([]);
  });
});
