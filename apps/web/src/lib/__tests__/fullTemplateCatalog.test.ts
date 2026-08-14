/**
 * Lockstep guard for the Playwright full-template catalog stub (#831).
 *
 * `apps/web/e2e/support/fullTemplateCatalog.ts` serves every shipped template
 * so visual suites can drive the real set. Themes mirror Rust
 * `get_template_theme` and are asserted by the Rust suite; layouts are loaded
 * from `tests/fixtures/template-layouts.json` and asserted here against
 * `bundledTemplateLayout`.
 */

import { describe, expect, it } from "vitest";
import { FULL_TEMPLATE_CATALOG } from "../../../e2e/support/fullTemplateCatalog";
import { bundledTemplateLayout } from "../docLayout";

const SHIPPED_TEMPLATES = [
  "rhyhorn",
  "azurill",
  "pikachu",
  "nosepass",
  "bronzor",
  "chikorita",
  "ditto",
  "gengar",
  "glalie",
  "kakuna",
  "leafish",
  "onyx",
];

describe("FULL_TEMPLATE_CATALOG lockstep", () => {
  it("covers exactly the shipped template ids", () => {
    expect(FULL_TEMPLATE_CATALOG.map((t) => t.id).sort()).toEqual([...SHIPPED_TEMPLATES].sort());
  });

  it.each(FULL_TEMPLATE_CATALOG.map((t) => [t.id, t] as const))(
    "mirrors bundledTemplateLayout for %s",
    (id, template) => {
      expect(template.layout).toEqual(bundledTemplateLayout(id));
    },
  );
});
