/**
 * Lockstep guard for the Playwright full-template catalog stub (#831 / #856).
 *
 * `apps/web/e2e/support/fullTemplateCatalog.ts` serves every shipped template
 * so visual suites can drive the real set. Themes are asserted against
 * `tests/fixtures/template-themes.json` (authored by Rust `get_template_theme`).
 * Layouts are loaded from `tests/fixtures/template-layouts.json` and asserted
 * here against `bundledTemplateLayout`.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FULL_TEMPLATE_CATALOG } from "../../../e2e/support/fullTemplateCatalog";
import { bundledTemplateLayout } from "../docLayout";

const THEMES_FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../tests/fixtures/template-themes.json",
);

interface ThemeTriple {
  background: string;
  text: string;
  primary: string;
}

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

function loadThemeFixture(): Record<string, ThemeTriple> {
  return JSON.parse(readFileSync(THEMES_FIXTURE_PATH, "utf8")) as Record<string, ThemeTriple>;
}

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

  it("themes deep-equal get_template_theme for all 12 templates + fallback", () => {
    const fixture = loadThemeFixture();
    expect(Object.keys(fixture).sort()).toEqual(
      [...SHIPPED_TEMPLATES, "not-a-template"].toSorted(),
    );
    for (const template of FULL_TEMPLATE_CATALOG) {
      expect(template.theme, template.id).toEqual(fixture[template.id]);
    }
    expect(fixture["not-a-template"]).toEqual(fixture.rhyhorn);
  });
});
