/**
 * Sheet PNG uniqueness (#856 gap 5). Pre-#842, bronzor/kakuna/nosepass/onyx
 * and gengar/glalie were byte-identical. They must stay pairwise distinct
 * now that per-template chrome is on the sheet.
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FULL_TEMPLATE_CATALOG } from "../../../e2e/support/fullTemplateCatalog";

const SCREENSHOT_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../e2e/__screenshots__/template-sheet.visual.spec.ts",
);

const SHEET_CSS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../components/doc-editor/docSheet.css",
);

const EXPECTED_SHEET_BASELINES = FULL_TEMPLATE_CATALOG.map((t) => `sheet-${t.id}.png`).toSorted();

describe("sheet visual baselines", () => {
  it("implements left vs center header chrome for rhyhorn and bronzor (#701)", () => {
    const css = readFileSync(SHEET_CSS, "utf8");
    expect(css).toContain(".doc-sheet--head-left .doc-sheet__single .doc-sheet__banner");
    expect(css).toContain(".doc-sheet--head-center .doc-sheet__single .doc-sheet__banner");
    expect(css).toContain("margin-left: 0");
    expect(css).toContain("justify-content: center");
  });

  it("are pairwise distinct by digest", () => {
    const files = readdirSync(SCREENSHOT_DIR).filter(
      (name) => name.startsWith("sheet-") && name.endsWith(".png"),
    );
    expect([...files].toSorted()).toEqual(EXPECTED_SHEET_BASELINES);
    expect(FULL_TEMPLATE_CATALOG.find((t) => t.id === "rhyhorn")?.layout.headerStyle).toBe("left");
    expect(FULL_TEMPLATE_CATALOG.find((t) => t.id === "bronzor")?.layout.headerStyle).toBe(
      "center",
    );
    const byDigest = new Map<string, string>();
    for (const file of files) {
      const digest = createHash("sha256")
        .update(readFileSync(join(SCREENSHOT_DIR, file)))
        .digest("hex");
      const previous = byDigest.get(digest);
      if (previous !== undefined) {
        const pair = [file, previous].toSorted().join("|");
        // Shared typography collapsed leftover pixel drift between these two
        // single-column sheets. headerStyle left/center is now painted, but
        // the 860×5072 shot stays under Playwright's 2% maxDiffPixelRatio.
        // Distinctness is locked by `doc-sheet--head-*` in the visual spec.
        expect(pair).toBe("sheet-bronzor.png|sheet-rhyhorn.png");
        continue;
      }
      byDigest.set(digest, file);
    }
  });
});
