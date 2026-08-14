/**
 * Full 12-template registry stub for visual / contrast suites that must drive
 * every shipped template.
 *
 * The shared Playwright fixture (`fixtures.ts`) serves a deliberately small
 * three-template catalog so other suites' screenshots stay stable. Specs that
 * need the real set override `TEMPLATES_ROUTE` with {@link FULL_TEMPLATE_CATALOG}
 * for the duration of the test only.
 *
 * Themes are asserted against `tests/fixtures/template-themes.json`, authored
 * by `get_template_theme`. Layout blocks come from
 * `tests/fixtures/template-layouts.json` — the same fixture
 * `bundledTemplateLayout` locksteps against — so `applyTemplate`
 * rebuilds columns and chrome the same way production `GET /api/templates`
 * does.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { TemplateLayout } from "../../src/lib/docLayout";

const FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../tests/fixtures/template-layouts.json",
);

const FIXTURE_LAYOUTS = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as Record<
  string,
  TemplateLayout
>;

/** Layout for a shipped template id, including per-template chrome. */
function layoutFor(id: string): TemplateLayout {
  const layout = FIXTURE_LAYOUTS[id];
  if (layout === undefined) {
    throw new Error(`template-layouts.json is missing ${id}`);
  }
  return layout;
}

interface CatalogTheme {
  background: string;
  text: string;
  primary: string;
}

export interface CatalogTemplate {
  id: string;
  name: string;
  theme: CatalogTheme;
  layout: TemplateLayout;
}

/**
 * Every shipped template, in the same order as `TEMPLATE_IDS` /
 * `TEMPLATES` in the render crate.
 */
export const FULL_TEMPLATE_CATALOG: readonly CatalogTemplate[] = [
  {
    id: "azurill",
    name: "Azurill",
    theme: { background: "#ffffff", text: "#1f2937", primary: "#d97706" },
    layout: layoutFor("azurill"),
  },
  {
    id: "bronzor",
    name: "Bronzor",
    theme: { background: "#ffffff", text: "#1f2937", primary: "#0891b2" },
    layout: layoutFor("bronzor"),
  },
  {
    id: "chikorita",
    name: "Chikorita",
    theme: { background: "#ffffff", text: "#166534", primary: "#16a34a" },
    layout: layoutFor("chikorita"),
  },
  {
    id: "ditto",
    name: "Ditto",
    theme: { background: "#ffffff", text: "#1f2937", primary: "#0891b2" },
    layout: layoutFor("ditto"),
  },
  {
    id: "gengar",
    name: "Gengar",
    theme: { background: "#ffffff", text: "#1f2937", primary: "#67b8c8" },
    layout: layoutFor("gengar"),
  },
  {
    id: "glalie",
    name: "Glalie",
    theme: { background: "#ffffff", text: "#0f172a", primary: "#14b8a6" },
    layout: layoutFor("glalie"),
  },
  {
    id: "kakuna",
    name: "Kakuna",
    theme: { background: "#ffffff", text: "#422006", primary: "#78716c" },
    layout: layoutFor("kakuna"),
  },
  {
    id: "leafish",
    name: "Leafish",
    theme: { background: "#ffffff", text: "#1f2937", primary: "#9f1239" },
    layout: layoutFor("leafish"),
  },
  {
    id: "nosepass",
    name: "Nosepass",
    theme: { background: "#ffffff", text: "#1f2937", primary: "#3b82f6" },
    layout: layoutFor("nosepass"),
  },
  {
    id: "onyx",
    name: "Onyx",
    theme: { background: "#ffffff", text: "#111827", primary: "#dc2626" },
    layout: layoutFor("onyx"),
  },
  {
    id: "pikachu",
    name: "Pikachu",
    theme: { background: "#ffffff", text: "#1c1917", primary: "#ca8a04" },
    layout: layoutFor("pikachu"),
  },
  {
    id: "rhyhorn",
    name: "Rhyhorn",
    theme: { background: "#ffffff", text: "#000000", primary: "#65a30d" },
    layout: layoutFor("rhyhorn"),
  },
];
