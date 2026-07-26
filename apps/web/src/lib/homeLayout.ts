export const HOME_LAYOUT_STORAGE_KEY = "rustume:home-layout";

export const HomeLayout = {
  List: "list",
  Grid: "grid",
  Gallery: "gallery",
} as const;

export type HomeLayout = (typeof HomeLayout)[keyof typeof HomeLayout];

/** Grid is the command-center default; unknown/corrupt stored values fall back to it. */
export const DEFAULT_HOME_LAYOUT: HomeLayout = HomeLayout.Grid;

const KNOWN_HOME_LAYOUTS = new Set<string>(Object.values(HomeLayout));

/** Legacy values from Classic / Workspace naming — migrated on read. */
const LEGACY_HOME_LAYOUT: Record<string, HomeLayout> = {
  classic: HomeLayout.List,
  workspace: HomeLayout.Grid,
};

function parseHomeLayout(raw: string | null): HomeLayout | null {
  if (raw && KNOWN_HOME_LAYOUTS.has(raw)) return raw as HomeLayout;
  const migrated = raw ? LEGACY_HOME_LAYOUT[raw] : undefined;
  return migrated ?? null;
}

export function getStoredHomeLayout(): HomeLayout {
  if (typeof localStorage === "undefined") return DEFAULT_HOME_LAYOUT;
  try {
    const raw = localStorage.getItem(HOME_LAYOUT_STORAGE_KEY);
    const layout = parseHomeLayout(raw);
    if (!layout) return DEFAULT_HOME_LAYOUT;
    // Persist migrated value so subsequent reads don't depend on legacy keys.
    if (raw !== layout) {
      localStorage.setItem(HOME_LAYOUT_STORAGE_KEY, layout);
    }
    return layout;
  } catch {
    // localStorage may be unavailable in private browsing or tests
  }
  return DEFAULT_HOME_LAYOUT;
}

export function setStoredHomeLayout(layout: HomeLayout): void {
  try {
    localStorage.setItem(HOME_LAYOUT_STORAGE_KEY, layout);
  } catch {
    // localStorage may be unavailable in private browsing or tests
  }
}
