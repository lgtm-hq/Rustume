/**
 * Sheet-parity audit of the 12 resume templates.
 *
 * Since #919 the document sheet (`docSheet.css`) is the visual source of truth
 * for the PDF, and the Typst templates converge on its colour formulas — the
 * raw brand seed as accent ink, `color-mix`-derived tints via the `sheet-*`
 * helpers in `_common.typ`. That direction knowingly retires the WCAG-AA
 * ratio floors this spec used to assert (the raw seed carries no contrast
 * guarantee, and the sheet's own muted formula does not clear AA either);
 * restoring proper WCAG compliance for both renderers is tracked in #921.
 *
 * What still needs gating is DRIFT, in three directions, all source-resolved
 * (a rendered page is pixels — opaque to axe — and the PDF path never touches
 * a browser, so parsing `crates/render/src/typst_engine/templates/` is the
 * only content-independent hold on it):
 *
 * 1. A template that stops painting the sheet's formulas — re-darkening its
 *    accent, hand-rolling a tint — silently un-converges the PDF.
 * 2. The Typst helpers and `docSheet.css` disagreeing on a mix percentage
 *    makes "parity" a fiction while every template still passes.
 * 3. A binding or expression the audit cannot resolve, or never measures,
 *    is a colour nothing watches (`support/templateContrastMatrix.ts`).
 *
 * axe still runs, per template, over the editor chrome that frames the sheet:
 * that surface IS DOM, and it is where a template switch could regress the app.
 */
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { test, expect, TEMPLATES_ROUTE } from "./support/fixtures";
import { pairsFor, uncoveredBindings } from "./support/templateContrastMatrix";
import {
  TEMPLATE_DIR,
  TEMPLATE_IDS,
  evaluateExpression,
  readPalette,
  resolveColor,
} from "./support/typstPalette";

/** WCAG 2.1 AA scan scope, matching the rest of the suite. */
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** Display name the template catalog exposes for a template id. */
function displayName(templateId: string): string {
  return templateId.charAt(0).toUpperCase() + templateId.slice(1);
}

/**
 * The full 12-template catalog.
 *
 * The shared fixture serves a deliberately small three-template catalog that
 * other suites screenshot; this route override widens it to the real shipped
 * set for this spec only, so the picker can be driven across every template
 * without moving anyone else's visual baseline. Only the ids and names matter
 * here — the picker shows a stubbed thumbnail, and the colours a template
 * paints are gated by the matrix above, not by this catalog.
 */
const FULL_TEMPLATE_CATALOG = TEMPLATE_IDS.map((id) => ({
  id,
  name: displayName(id),
  theme: { background: "#ffffff", text: "#000000", primary: "#65a30d" },
}));

/** Read one template's Typst source. */
function readSource(name: string): string {
  return readFileSync(join(TEMPLATE_DIR, `${name}.typ`), "utf8");
}

/**
 * The sheet formulas the Typst side must mirror, one row per mix.
 *
 * `typstRe` matches the declaration in `source` (`_common.typ` for the shared
 * helpers, a template for a tint only that template paints); `cssRe` matches
 * the `docSheet.css` declaration it is named after. Both anchor the mix
 * percentage, so retuning either side without the other fails here rather
 * than silently splitting the sheet and the PDF.
 *
 * The percentage is all these rows lock. `--doc-sheet-muted` is `text 60%` over
 * TRANSPARENT, not over the sheet background — a translucent ink the browser
 * composites over whatever is behind it. Typst has no compositing model here,
 * so `sheet-muted` resolves the same arithmetic against a ground the caller
 * passes (`0.6·text + 0.4·ground` either way); the two agree exactly, provided
 * the caller passes the LOCAL ground. Inside a tinted sidebar that is the rail,
 * not the page — see `sheet-muted`'s own doc comment in `_common.typ`.
 */
const SHEET_FORMULAS: readonly {
  helper: string;
  source: string;
  pct: number;
  typstRe: RegExp;
  cssRe: RegExp;
}[] = [
  {
    helper: "sheet-sidebar-tint",
    pct: 15,
    source: "_common",
    typstRe: /#let sheet-sidebar-tint\(accent, bg\) = sheet-mix\(accent, bg, 15\)/,
    cssRe:
      /\.doc-sheet__side \{\n(?:[^}]*\n)? {2}background: color-mix\(in srgb, var\(--doc-sheet-accent\) 15%, var\(--doc-sheet-bg\)\);/,
  },
  {
    helper: "sheet-muted",
    pct: 60,
    source: "_common",
    typstRe: /#let sheet-muted\(text-color, bg\) = sheet-mix\(text-color, bg, 60\)/,
    cssRe: /--doc-sheet-muted: color-mix\(in srgb, var\(--doc-sheet-text\) 60%, transparent\);/,
  },
  {
    helper: "sheet-chip-fill",
    pct: 10,
    source: "_common",
    typstRe: /#let sheet-chip-fill\(accent, bg\) = sheet-mix\(accent, bg, 10\)/,
    cssRe:
      /\.doc-sheet__tag-chip \{\n(?:[^}]*\n)? {2}background: color-mix\(in srgb, var\(--doc-sheet-accent\) 10%, var\(--doc-sheet-bg\)\);/,
  },
  {
    helper: "sheet-chip-stroke",
    pct: 28,
    source: "_common",
    typstRe: /#let sheet-chip-stroke\(accent\) = sheet-mix\(accent, rgb\("#e7e5e4"\), 28\)/,
    cssRe:
      /\.doc-sheet__tag-chip \{\n(?:[^}]*\n)? {2}border: 1px solid color-mix\(in srgb, var\(--doc-sheet-accent\) 28%, #e7e5e4\);/,
  },
  {
    // Template-local: only leafish paints a banner tint, so it has no shared
    // helper — but it is still a sheet formula and still needs anchoring, or
    // it could be hand-rolled back into a `lighten()` with every other
    // assertion staying green.
    helper: "leafish banner tint",
    pct: 12,
    source: "leafish",
    typstRe: /let header-bg = sheet-mix\(primary-color, bg-color, 12\)/,
    cssRe:
      /\.doc-sheet__banner--tint \{\n {2}background: color-mix\(in srgb, var\(--doc-sheet-accent\) 12%, var\(--doc-sheet-bg\)\);/,
  },
];

/** Every `sheet-mix(…, N)` percentage across `_common.typ` and the templates. */
function typstMixPercentages(): ReadonlySet<number> {
  const found = new Set<number>();
  for (const name of [...TEMPLATE_IDS, "_common"]) {
    // One nested paren level, so a literal operand (`rgb("#e7e5e4")`) counts.
    for (const [, pct] of readSource(name).matchAll(
      /sheet-mix\((?:[^()]|\([^()]*\))*?,\s*(\d+(?:\.\d+)?)\)/g,
    )) {
      found.add(Number(pct));
    }
  }
  return found;
}

/** Every `color-mix(in srgb, var(--doc-sheet-*) N%, …)` percentage in the sheet. */
function cssMixPercentages(css: string): ReadonlySet<number> {
  const found = new Set<number>();
  for (const [, pct] of css.matchAll(
    /color-mix\(in srgb, var\(--doc-sheet-[a-z-]+\) (\d+(?:\.\d+)?)%/g,
  )) {
    found.add(Number(pct));
  }
  return found;
}

/** `docSheet.css`, the stylesheet whose formulas the templates converge on. */
const DOC_SHEET_CSS = join(
  TEMPLATE_DIR,
  "..",
  "..",
  "..",
  "..",
  "..",
  "apps",
  "web",
  "src",
  "components",
  "doc-editor",
  "docSheet.css",
);

test.describe("template sheet-parity matrix", () => {
  TEMPLATE_IDS.forEach((templateId) => {
    test(`${templateId} resolves every audited pair`, () => {
      // The resolver throws on any expression outside the audited grammar, so
      // a retuned tint or renamed binding fails here instead of going unread.
      // With the WCAG ratio floors retired (#921), resolvability IS the
      // assertion — the audited grammar is the guard. The resolved value is
      // still shape-checked so a resolver that started returning something
      // other than an opaque hex could not pass silently; the VALUES the
      // formulas must produce are locked by the mix-maths test above.
      const palette = readPalette(templateId);
      for (const pair of pairsFor(templateId)) {
        for (const expression of [pair.ink, pair.backdrop]) {
          expect(
            resolveColor(palette, expression, templateId),
            `${templateId}: ${pair.label} (${expression})`,
          ).toMatch(/^#[0-9a-f]{6}$/);
        }
      }
    });
  });

  test("every template paints the raw brand seed as its accent", () => {
    // Sheet parity (#919): `--doc-sheet-accent` IS the theme primary, so a
    // template that re-darkens its accent un-converges the PDF.
    const diverged = TEMPLATE_IDS.filter(
      (templateId) => !/let accent-color = primary-color\s*$/m.test(readSource(templateId)),
    );
    expect(diverged).toEqual([]);
  });

  test("every template derives its muted ink from the sheet formula", () => {
    const diverged = TEMPLATE_IDS.filter(
      (templateId) =>
        !/let muted-color = sheet-muted\(text-color, bg-color\)\s*$/m.test(readSource(templateId)),
    );
    expect(diverged).toEqual([]);
  });

  test("every sidebar tint comes from the shared sheet helper", () => {
    // Only templates that declare a sidebar are in scope; hand-rolled tints
    // (`primary-color.lighten(85%)` and friends) are the drift this catches.
    const diverged = TEMPLATE_IDS.filter((templateId) => {
      const source = readSource(templateId);
      return (
        /let sidebar-bg =/.test(source) &&
        !/let sidebar-bg = sheet-sidebar-tint\(primary-color, bg-color\)\s*$/m.test(source)
      );
    });
    expect(diverged).toEqual([]);
  });

  test("the sheet-parity formulas lock the same mix percentages as docSheet.css", () => {
    const css = readFileSync(DOC_SHEET_CSS, "utf8");
    const drifted = SHEET_FORMULAS.filter(
      (formula) => !formula.typstRe.test(readSource(formula.source)) || !formula.cssRe.test(css),
    ).map((formula) => formula.helper);
    expect(drifted).toEqual([]);
  });

  test("every sheet-mix percentage the Typst side uses has a named formula row", () => {
    // The rows above name the mixes we know about. This is the open-ended
    // half: a NEW `sheet-mix(…, N)` anywhere — a fresh helper, a template-local
    // tint like leafish's banner — must come with its own SHEET_FORMULAS row
    // (naming the exact CSS rule it mirrors), not merely reuse a percentage
    // some unrelated `--doc-sheet-*` mix happens to paint.
    const locked = new Set(SHEET_FORMULAS.map((formula) => formula.pct));
    const unanchored = [...typstMixPercentages()].filter((pct) => !locked.has(pct)).sort();
    expect(unanchored).toEqual([]);

    // And every locked percentage really is painted by the sheet — a stale row
    // whose CSS counterpart was retuned fails the regex test above, but a row
    // could still cite a percentage the sheet dropped entirely.
    const painted = cssMixPercentages(readFileSync(DOC_SHEET_CSS, "utf8"));
    const dropped = [...locked].filter((pct) => !painted.has(pct)).sort();
    expect(dropped).toEqual([]);
  });

  test("the mix maths resolves the sheet formulas to their sheet values", () => {
    // The regex rows lock the SOURCE; this locks the ARITHMETIC. Without it an
    // inverted `mixSrgb`, or a helper percentage parsed from the wrong capture
    // group, would leave every assertion above green while the audit measured
    // colours no renderer paints. Values are `color-mix(in srgb, …)` over the
    // fixture theme (`#65a30d` accent on `#ffffff`).
    const palette = { "accent-color": "#65a30d", "bg-color": "#ffffff", "text-color": "#000000" };
    const resolve = (expression: string) => evaluateExpression(expression, palette);
    expect(resolve("sheet-sidebar-tint(accent-color, bg-color)")).toBe("#e8f1db");
    expect(resolve("sheet-chip-fill(accent-color, bg-color)")).toBe("#f0f6e7");
    expect(resolve("sheet-chip-stroke(accent-color)")).toBe("#c3d3a8");
    expect(resolve("sheet-muted(text-color, bg-color)")).toBe("#666666");
    expect(resolve("sheet-mix(accent-color, bg-color, 12)")).toBe("#edf4e2");
  });

  test("every template declares an audited accent ink", () => {
    // The accent binding is where every heading, link and rule gets its ink;
    // a template that drops it falls outside the audit entirely, so its
    // convergence on the sheet would be unverifiable.
    const missing = TEMPLATE_IDS.filter((templateId) => !readPalette(templateId)["accent-color"]);
    expect(missing).toEqual([]);
  });

  test("every colour a template declares is measured by the matrix", () => {
    // The matrix is hand-written, so its coverage was only ever as good as the
    // one-time walk that produced it. Both drift mechanisms are silent in this
    // direction: `parsePalette` skips a binding it cannot resolve without
    // comment, and `resolveColor` throws only for expressions a pair already
    // REFERENCES — a binding no pair mentions is never looked up. So a template
    // that gains a tint and paints text on it would stay unaudited while every
    // test above stayed green — a colour nothing watches. Anything genuinely
    // never painted is named in `UNPAINTED_BINDINGS`, per binding, with a
    // reason.
    const uncovered = TEMPLATE_IDS.flatMap((templateId) =>
      uncoveredBindings(templateId, readPalette(templateId)),
    );
    expect(uncovered).toEqual([]);
  });

  test("no template paints ink over an unaudited gradient", () => {
    // The sheet paints no gradients, so a Typst gradient is un-converged by
    // construction — and it is invisible to the flat pair matrix above, whose
    // resolver only speaks in single colours. No template uses one today; if
    // one appears it needs its own parity story (and, should ratio floors
    // return, ramp sampling like `gradientRamp` in
    // `apps/site/scripts/check-craft-contrast.mjs`), and this guard is what
    // says so.
    const withGradients = [...TEMPLATE_IDS, "_common"].filter((name) =>
      /\bgradient\s*[.(]/.test(readFileSync(join(TEMPLATE_DIR, `${name}.typ`), "utf8")),
    );
    expect(withGradients).toEqual([]);
  });
});

test.describe("template rendering surfaces", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(TEMPLATES_ROUTE, (route) =>
      route.fulfill({ status: 200, json: FULL_TEMPLATE_CATALOG }),
    );
  });

  test.afterEach(async ({ page }) => {
    await page.unroute(TEMPLATES_ROUTE);
  });

  TEMPLATE_IDS.forEach((templateId) => {
    test(`${templateId} editor chrome and PDF export are free of WCAG 2.1 AA violations`, async ({
      page,
      homePage,
      docEditorPage,
      templatesDrawer,
      exportModal,
    }) => {
      await homePage.open();
      await homePage.createResume();
      await docEditorPage.assertDocEditorOpen();
      await docEditorPage.assertSaved();

      await test.step("select the template", async () => {
        await docEditorPage.openTemplatesDrawer();
        await templatesDrawer.assertOpen();
        await templatesDrawer.selectTemplate(displayName(templateId));
        await templatesDrawer.assertClosed();
        await docEditorPage.assertDocEditorOpen();
      });

      await test.step("scan the editor chrome framing the sheet", async () => {
        // The transient creation toast would otherwise be scanned mid-flight.
        await expect(page.getByText("New resume created")).toBeHidden({ timeout: 15_000 });
        expect(await scanForViolations(page)).toEqual([]);
      });

      await test.step("the PDF export carries this template", async () => {
        // Ties the source-resolved matrix to the artefact a user actually
        // sends: the export asks the server for THIS template, so the colours
        // gated above are the colours the PDF is built from.
        await docEditorPage.openExportModal();
        await exportModal.assertOpen();
        const renderRequest = page.waitForRequest(
          (request) =>
            request.url().includes("/api/render/pdf") &&
            (request.postData() ?? "").includes(`"template":"${templateId}"`),
        );
        const download = page.waitForEvent("download");
        await exportModal.exportPdf();
        await renderRequest;
        await download;
        await exportModal.assertClosed();
      });
    });
  });
});

/** Human-readable summary so failures state the rule, impact, and targets. */
interface ViolationSummary {
  rule: string;
  impact: string;
  description: string;
  targets: string[];
}

async function scanForViolations(page: Page): Promise<ViolationSummary[]> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return results.violations.map((violation) => ({
    rule: violation.id,
    impact: violation.impact ?? "unknown",
    description: violation.description,
    targets: violation.nodes.flatMap((node) => node.target.map(String)),
  }));
}
