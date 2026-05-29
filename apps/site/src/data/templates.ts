/** Resume template metadata for the docs gallery. */

export type TemplateLayout =
  | "single-column"
  | "sidebar-left"
  | "sidebar-right"
  | "header-sidebar"
  | "two-column";

export interface TemplateInfo {
  id: string;
  layout: TemplateLayout;
  accent: string;
  accentLabel: string;
}

export const templates: TemplateInfo[] = [
  { id: "rhyhorn", layout: "single-column", accent: "#65a30d", accentLabel: "Olive green" },
  { id: "azurill", layout: "sidebar-left", accent: "#d97706", accentLabel: "Amber" },
  { id: "pikachu", layout: "sidebar-left", accent: "#ca8a04", accentLabel: "Gold" },
  { id: "nosepass", layout: "single-column", accent: "#3b82f6", accentLabel: "Blue" },
  { id: "bronzor", layout: "single-column", accent: "#0891b2", accentLabel: "Teal" },
  { id: "chikorita", layout: "sidebar-right", accent: "#16a34a", accentLabel: "Green" },
  { id: "ditto", layout: "sidebar-left", accent: "#0891b2", accentLabel: "Teal" },
  { id: "gengar", layout: "header-sidebar", accent: "#67b8c8", accentLabel: "Light teal" },
  { id: "glalie", layout: "header-sidebar", accent: "#14b8a6", accentLabel: "Teal" },
  { id: "kakuna", layout: "single-column", accent: "#78716c", accentLabel: "Tan/brown" },
  { id: "leafish", layout: "two-column", accent: "#9f1239", accentLabel: "Rose" },
  { id: "onyx", layout: "single-column", accent: "#dc2626", accentLabel: "Red" },
];

export const layoutLabels: Record<TemplateLayout, string> = {
  "single-column": "Single-column linear",
  "sidebar-left": "Sidebar left + main right",
  "sidebar-right": "Main left + sidebar right",
  "header-sidebar": "Header-in-sidebar + main right",
  "two-column": "Full-width header + two columns",
};
