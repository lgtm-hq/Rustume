import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";

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

  test("account page has no WCAG 2.2 AA violations", async ({ page, accountPage }) => {
    await accountPage.open();
    await accountPage.assertLocalMode();
    expect(await scanForViolations(page)).toEqual([]);
  });

  /**
   * The document editor (#785–#797). A brand-new resume opens in Edit mode,
   * which is the denser tree: section chrome, entry actions, the edge drawer
   * buttons and the whole top bar are all present.
   */
  test.describe("document editor", () => {
    test("edit surface has no WCAG 2.2 AA violations", async ({
      page,
      homePage,
      docEditorPage,
    }) => {
      await homePage.open();
      await homePage.createResume();
      await docEditorPage.assertDocEditorOpen();
      await docEditorPage.assertMode("edit");
      await expect(page.getByText("New resume created")).toBeHidden({ timeout: 15_000 });
      expect(await scanForViolations(page)).toEqual([]);
    });

    test("drawers and theme dialog have no WCAG 2.2 AA violations", async ({
      page,
      homePage,
      docEditorPage,
    }) => {
      await homePage.open();
      await homePage.createResume();
      await docEditorPage.assertDocEditorOpen();
      await expect(page.getByText("New resume created")).toBeHidden({ timeout: 15_000 });

      // Sections drawer, from its edge button.
      await page.getByTestId("doc-editor-sections-tab").click();
      await expect(page.getByRole("dialog", { name: "Sections" })).toBeVisible();
      expect(await scanForViolations(page, '[role="dialog"]')).toEqual([]);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "Sections" })).toBeHidden();

      // Templates drawer, from its edge button.
      await page.getByTestId("doc-editor-templates-tab").click();
      const templates = page.getByRole("dialog", { name: "Templates" });
      await expect(templates.getByTestId("templates-drawer-list")).toBeVisible();
      expect(await scanForViolations(page, '[role="dialog"]')).toEqual([]);
      await page.keyboard.press("Escape");
      await expect(templates).toBeHidden();

      // Theme dialog, from the top bar.
      await page.getByTestId("doc-editor-theme-button").click();
      await expect(page.getByRole("dialog", { name: "Theme" })).toBeVisible();
      expect(await scanForViolations(page, '[role="dialog"]')).toEqual([]);
    });

    test("export dialog has no WCAG 2.2 AA violations", async ({
      page,
      homePage,
      docEditorPage,
      exportModal,
    }) => {
      await homePage.open();
      await homePage.createResume();
      await docEditorPage.assertDocEditorOpen();
      await docEditorPage.assertSaved();
      await docEditorPage.openExportModal();
      await exportModal.assertOpen();
      expect(await scanForViolations(page, '[role="dialog"]')).toEqual([]);
    });

    /**
     * A freshly created resume has no section items, so the edit-surface scan
     * above never reaches the per-item edit / move / duplicate / hide / remove
     * controls — exactly the dense, icon-only targets SC 2.5.8 exists for.
     * Populate a section so those controls are in the tree; a second item
     * makes the reorder buttons meaningful, since with one item both are
     * disabled and axe skips disabled controls.
     */
    test("populated document sheet has no WCAG 2.2 AA violations", async ({
      page,
      homePage,
      docEditorPage,
    }) => {
      await homePage.open();
      await homePage.createResume();
      await docEditorPage.assertDocEditorOpen();
      await docEditorPage.addItem("experience", [
        ["Company", "Lumen Health"],
        ["Position", "Engineer"],
      ]);
      await docEditorPage.addItem("experience", [
        ["Company", "Analytical Engines"],
        ["Position", "Designer"],
      ]);
      await docEditorPage.assertSectionItemCount("experience", 2);
      await docEditorPage.assertSaved();
      await expect(page.getByText("New resume created")).toBeHidden({ timeout: 15_000 });
      expect(await scanForViolations(page)).toEqual([]);
    });
  });
});
