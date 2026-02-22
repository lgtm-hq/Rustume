import type { ThemePresetInfo } from "../wasm/types";

/**
 * Client-side theme presets -- the single source of truth.
 *
 * These presets are embedded directly in the client bundle so that the theme
 * editor works reliably regardless of network state (offline-first).  There
 * is intentionally **no** dependency on a `/api/themes` server endpoint.
 *
 * Note: `FALLBACK_THEMES` in `src/wasm/index.ts` is an independent system
 * that maps *template* names to default colors. These preset lists serve
 * different purposes and do not need to stay in sync.
 */
export const THEME_PRESETS: readonly ThemePresetInfo[] = [
  // ── Light presets ──────────────────────────────────────────────────
  {
    id: "light-default",
    name: "Default",
    isDark: false,
    colors: { background: "#ffffff", text: "#000000", primary: "#dc2626" },
  },
  {
    id: "light-emerald",
    name: "Emerald",
    isDark: false,
    colors: { background: "#ffffff", text: "#000000", primary: "#65a30d" },
  },
  {
    id: "light-amber",
    name: "Amber",
    isDark: false,
    colors: { background: "#ffffff", text: "#1f2937", primary: "#d97706" },
  },
  {
    id: "light-gold",
    name: "Gold",
    isDark: false,
    colors: { background: "#ffffff", text: "#1c1917", primary: "#ca8a04" },
  },
  {
    id: "light-blue",
    name: "Blue",
    isDark: false,
    colors: { background: "#ffffff", text: "#1f2937", primary: "#3b82f6" },
  },
  {
    id: "light-cyan",
    name: "Cyan",
    isDark: false,
    colors: { background: "#ffffff", text: "#1f2937", primary: "#0891b2" },
  },
  {
    id: "light-green",
    name: "Green",
    isDark: false,
    colors: { background: "#ffffff", text: "#166534", primary: "#16a34a" },
  },
  {
    id: "light-teal",
    name: "Teal",
    isDark: false,
    colors: { background: "#ffffff", text: "#0f172a", primary: "#14b8a6" },
  },
  {
    id: "light-rose",
    name: "Rose",
    isDark: false,
    colors: { background: "#ffffff", text: "#1f2937", primary: "#9f1239" },
  },
  {
    id: "light-stone",
    name: "Stone",
    isDark: false,
    colors: { background: "#ffffff", text: "#422006", primary: "#78716c" },
  },

  // ── Dark presets ───────────────────────────────────────────────────
  {
    id: "dark-charcoal",
    name: "Charcoal",
    isDark: true,
    colors: { background: "#1a1a2e", text: "#e0e0e0", primary: "#dc2626" },
  },
  {
    id: "dark-midnight",
    name: "Midnight",
    isDark: true,
    colors: { background: "#0f172a", text: "#e2e8f0", primary: "#3b82f6" },
  },
  {
    id: "dark-forest",
    name: "Forest",
    isDark: true,
    colors: { background: "#1a2e1a", text: "#d1e7d1", primary: "#16a34a" },
  },
  {
    id: "dark-slate",
    name: "Slate",
    isDark: true,
    colors: { background: "#1e293b", text: "#cbd5e1", primary: "#14b8a6" },
  },
] as const;

/**
 * Retrieve all theme presets.  Always returns synchronously -- no network
 * dependency.  Safe to call in any environment (server, client, test).
 */
export function getThemePresets(): readonly ThemePresetInfo[] {
  return THEME_PRESETS;
}

/**
 * Look up a single preset by id.  Returns `undefined` when not found.
 */
export function getThemePresetById(id: string): ThemePresetInfo | undefined {
  return THEME_PRESETS.find((p) => p.id === id);
}
