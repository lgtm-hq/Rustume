/**
 * Contrast audit of the 12 resume templates across screen and print.
 *
 * ## Why this is not an axe scan of the preview
 *
 * A resume template is a Typst document, not DOM. `crates/render` compiles it
 * once and hands it to two backends — `typst-render` rasterises a PNG for the
 * on-screen preview, `typst-pdf` writes the export — so the preview the user
 * sees in the editor is an `<img>`, and every glyph inside it is opaque to axe.
 * Running the colour-contrast rule against the preview would report a clean
 * page while the resume inside it failed, which is the exact false negative
 * this audit exists to prevent.
 *
 * So the matrix gates the source of both renders: every ink/backdrop pair the
 * templates can paint, resolved from the Typst sources themselves
 * (`support/templateContrastMatrix.ts`). That is content-independent — it holds
 * for every resume a template can render, not just whichever fixture a scan
 * happened to load — and it covers the PDF path, which no browser-side check
 * can reach because `renderPdf` in `src/api/render.ts` POSTs to a server.
 *
 * axe still runs, per template, over the editor chrome that frames the preview:
 * that surface IS DOM, and it is where a template switch could regress the app.
 */
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { test, expect, TEMPLATES_ROUTE } from "./support/fixtures";
import { ContrastRole, SURFACES, floorFor, surfaceRatio, type Surface } from "./support/contrast";
import { pairsFor, uncoveredBindings } from "./support/templateContrastMatrix";
import {
  TEMPLATE_DIR,
  TEMPLATE_IDS,
  readPalette,
  resolveColor,
  type TemplateId,
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

/** One measured cell of the matrix. */
interface Measurement {
  readonly label: string;
  readonly ink: string;
  readonly backdrop: string;
  readonly ratio: number;
  readonly required: number;
}

/** Measure every pair a template paints, on one surface. */
function measure(templateId: TemplateId, surface: Surface): Measurement[] {
  const palette = readPalette(templateId);
  return pairsFor(templateId).map((pair) => {
    const ink = resolveColor(palette, pair.ink, templateId);
    const backdrop = resolveColor(palette, pair.backdrop, templateId);
    const role = pair.role ?? ContrastRole.Text;
    return {
      label: pair.label,
      ink,
      backdrop,
      ratio: surfaceRatio(ink, backdrop, surface),
      required: floorFor(role),
    };
  });
}

/** Render a failing cell as an assertion message line. */
function describeFailure(templateId: TemplateId, surface: Surface, cell: Measurement): string {
  return (
    `${templateId} [${surface}] ${cell.label}: ${cell.ink} on ${cell.backdrop} ` +
    `= ${cell.ratio.toFixed(2)}:1 (needs ${cell.required}:1)`
  );
}

test.describe("template contrast matrix", () => {
  TEMPLATE_IDS.forEach((templateId) => {
    SURFACES.forEach((surface) => {
      test(`${templateId} clears WCAG AA on ${surface}`, () => {
        const failures = measure(templateId, surface)
          .filter((cell) => cell.ratio < cell.required)
          .map((cell) => describeFailure(templateId, surface, cell));
        expect(failures).toEqual([]);
      });
    });
  });

  test("every template declares an audited accent ink", () => {
    // The accent is what makes headings, links and rules readable; a template
    // that drops the binding would silently fall back to the raw brand seed,
    // which is the failure this whole audit started from.
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
    // test above stayed green, which is the same false-negative class as
    // scanning the preview `<img>` with axe, one level up. Anything genuinely
    // never painted is named in `UNPAINTED_BINDINGS`, per binding, with a
    // reason.
    const uncovered = TEMPLATE_IDS.flatMap((templateId) =>
      uncoveredBindings(templateId, readPalette(templateId)),
    );
    expect(uncovered).toEqual([]);
  });

  test("no template paints ink over an unaudited gradient", () => {
    // axe flattens a gradient to a single colour and misses one-end failures,
    // and so would the flat pair matrix above: sRGB blending is linear per
    // channel but luminance is not, so a ramp dips below the chord between its
    // endpoints and both stops can clear the floor while the middle does not.
    // No template uses a Typst gradient today. If one appears, its ink has to
    // be gated against every sample of the ramp — `gradientRamp` in
    // `apps/site/scripts/check-craft-contrast.mjs` already does the sampling —
    // rather than against a single stop, and this guard is what says so.
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
    test(`${templateId} preview and PDF export are free of WCAG 2.1 AA violations`, async ({
      page,
      homePage,
      docEditorPage,
      templatesDrawer,
      exportModal,
    }) => {
      await homePage.open();
      await homePage.createResume();
      await docEditorPage.assertEditorOpen();
      await docEditorPage.assertSaved();

      await test.step("select the template", async () => {
        await docEditorPage.templatesButton.click();
        await templatesDrawer.assertOpen();
        await templatesDrawer.selectTemplate(displayName(templateId));
        await templatesDrawer.assertClosed();
        await docEditorPage.assertPreviewVisible();
      });

      await test.step("scan the editor chrome framing the preview", async () => {
        // The transient creation toast would otherwise be scanned mid-flight.
        await expect(page.getByText("New resume created")).toBeHidden({ timeout: 15_000 });
        expect(await scanForViolations(page)).toEqual([]);
      });

      await test.step("the PDF export carries this template", async () => {
        // Ties the print half of the matrix to the artefact a user actually
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
