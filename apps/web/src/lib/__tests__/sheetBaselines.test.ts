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

const EXPECTED_SHEET_BASELINES = FULL_TEMPLATE_CATALOG.map((t) => `sheet-${t.id}.png`).toSorted();

describe("sheet visual baselines", () => {
  it("are pairwise distinct by digest", () => {
    const files = readdirSync(SCREENSHOT_DIR).filter(
      (name) => name.startsWith("sheet-") && name.endsWith(".png"),
    );
    expect([...files].toSorted()).toEqual(EXPECTED_SHEET_BASELINES);
    const byDigest = new Map<string, string>();
    for (const file of files) {
      const digest = createHash("sha256")
        .update(readFileSync(join(SCREENSHOT_DIR, file)))
        .digest("hex");
      const previous = byDigest.get(digest);
      expect(previous, `${file} is byte-identical to ${previous}`).toBeUndefined();
      byDigest.set(digest, file);
    }
  });
});
