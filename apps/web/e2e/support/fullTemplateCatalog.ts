/**
 * Full 12-template registry stub for visual / contrast suites that must drive
 * every shipped template.
 *
 * The shared Playwright fixture (`fixtures.ts`) serves a deliberately small
 * three-template catalog so other suites' screenshots stay stable. Specs that
 * need the real set override `TEMPLATES_ROUTE` with {@link FULL_TEMPLATE_CATALOG}
 * for the duration of the test only.
 *
 * Themes mirror `get_template_theme` in
 * `crates/render/src/typst_engine/engine.rs`. Layout blocks mirror
 * `bundledTemplateLayout` in `apps/web/src/lib/docLayout.ts` so
 * `applyTemplate` rebuilds columns the same way production does.
 */

/** Sentinel id the layout editor uses for "custom sections go here". */
const CUSTOM = "custom";

const MAIN = [
  "summary",
  "experience",
  "education",
  "awards",
  "certifications",
  "publications",
  "volunteer",
  "projects",
  "references",
] as const;

const SIDEBAR = [
  "profiles",
  "skills",
  "interests",
  "certifications",
  "awards",
  "publications",
  "languages",
] as const;

type LayoutMode = "single" | "sidebar-left" | "sidebar-right" | "header-split";
type HeaderStyle = "left" | "center" | "banner" | "boxed" | "sidebar";
type ContactIn = "sidebar" | "header" | "banner";

interface CatalogLayout {
  layoutMode: LayoutMode;
  defaultColumns: string[][];
  headerStyle: HeaderStyle;
  contactIn: ContactIn;
  sidebarWidth: number | null;
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
  layout: CatalogLayout;
}

/** First-seen dedup across sources, matching `uniqueSections` in docLayout.ts. */
function uniqueSections(...sources: readonly (readonly string[])[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const source of sources) {
    for (const id of source) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

function single(headerStyle: HeaderStyle): CatalogLayout {
  return {
    layoutMode: "single",
    defaultColumns: [uniqueSections(MAIN, SIDEBAR, [CUSTOM]), []],
    headerStyle,
    contactIn: "header",
    sidebarWidth: null,
  };
}

function twoColumn(
  layoutMode: Exclude<LayoutMode, "single" | "header-split">,
  headerStyle: HeaderStyle,
  contactIn: ContactIn,
  sidebarWidth: number | null,
): CatalogLayout {
  return {
    layoutMode,
    defaultColumns: [uniqueSections(MAIN, [CUSTOM]), uniqueSections(SIDEBAR)],
    headerStyle,
    contactIn,
    sidebarWidth,
  };
}

/** Display name the template catalog exposes for a template id. */
export function templateDisplayName(templateId: string): string {
  return templateId.charAt(0).toUpperCase() + templateId.slice(1);
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
    layout: twoColumn("sidebar-left", "center", "header", null),
  },
  {
    id: "bronzor",
    name: "Bronzor",
    theme: { background: "#ffffff", text: "#1f2937", primary: "#0891b2" },
    layout: single("center"),
  },
  {
    id: "chikorita",
    name: "Chikorita",
    theme: { background: "#ffffff", text: "#166534", primary: "#16a34a" },
    layout: twoColumn("sidebar-right", "left", "header", null),
  },
  {
    id: "ditto",
    name: "Ditto",
    theme: { background: "#ffffff", text: "#1f2937", primary: "#0891b2" },
    layout: twoColumn("sidebar-left", "banner", "banner", 160),
  },
  {
    id: "gengar",
    name: "Gengar",
    theme: { background: "#ffffff", text: "#1f2937", primary: "#67b8c8" },
    layout: twoColumn("sidebar-left", "sidebar", "sidebar", 170),
  },
  {
    id: "glalie",
    name: "Glalie",
    theme: { background: "#ffffff", text: "#0f172a", primary: "#14b8a6" },
    layout: twoColumn("sidebar-left", "sidebar", "sidebar", 170),
  },
  {
    id: "kakuna",
    name: "Kakuna",
    theme: { background: "#ffffff", text: "#422006", primary: "#78716c" },
    layout: single("boxed"),
  },
  {
    id: "leafish",
    name: "Leafish",
    theme: { background: "#ffffff", text: "#1f2937", primary: "#9f1239" },
    layout: {
      layoutMode: "header-split",
      defaultColumns: [uniqueSections(MAIN), uniqueSections(SIDEBAR, [CUSTOM])],
      headerStyle: "banner",
      contactIn: "banner",
      sidebarWidth: null,
    },
  },
  {
    id: "nosepass",
    name: "Nosepass",
    theme: { background: "#ffffff", text: "#1f2937", primary: "#3b82f6" },
    layout: single("left"),
  },
  {
    id: "onyx",
    name: "Onyx",
    theme: { background: "#ffffff", text: "#111827", primary: "#dc2626" },
    layout: single("left"),
  },
  {
    id: "pikachu",
    name: "Pikachu",
    theme: { background: "#ffffff", text: "#1c1917", primary: "#ca8a04" },
    layout: twoColumn("sidebar-left", "left", "sidebar", 180),
  },
  {
    id: "rhyhorn",
    name: "Rhyhorn",
    theme: { background: "#ffffff", text: "#000000", primary: "#65a30d" },
    layout: single("left"),
  },
] as const;
