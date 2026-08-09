/**
 * Lockstep guard for the Playwright full-template catalog stub (#831).
 *
 * `apps/web/e2e/support/fullTemplateCatalog.ts` hand-mirrors the production
 * layout registry so visual suites can drive all twelve templates. Themes
 * mirror Rust `get_template_theme` and are asserted by the Rust suite; the
 * layout half is asserted here against `bundledTemplateLayout`.
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
