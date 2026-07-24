export const HOME_LAYOUT_STORAGE_KEY = "rustume:home-layout";

export const HomeLayout = {
  List: "list",
  Grid: "grid",
} as const;

export type HomeLayout = (typeof HomeLayout)[keyof typeof HomeLayout];

/** Legacy values from Classic / Workspace naming — migrated on read. */
const LEGACY_HOME_LAYOUT: Record<string, HomeLayout> = {
  classic: HomeLayout.List,
  workspace: HomeLayout.Grid,
};

function parseHomeLayout(raw: string | null): HomeLayout | null {
  if (raw === HomeLayout.List || raw === HomeLayout.Grid) return raw;
  const migrated = raw ? LEGACY_HOME_LAYOUT[raw] : undefined;
  return migrated ?? null;
}

export function getStoredHomeLayout(): HomeLayout {
  if (typeof localStorage === "undefined") return HomeLayout.List;
  try {
    const raw = localStorage.getItem(HOME_LAYOUT_STORAGE_KEY);
    const layout = parseHomeLayout(raw);
    if (!layout) return HomeLayout.List;
    // Persist migrated value so subsequent reads don't depend on legacy keys.
    if (raw !== layout) {
      localStorage.setItem(HOME_LAYOUT_STORAGE_KEY, layout);
    }
    return layout;
  } catch {
    // localStorage may be unavailable in private browsing or tests
  }
  return HomeLayout.List;
}

export function setStoredHomeLayout(layout: HomeLayout): void {
  try {
    localStorage.setItem(HOME_LAYOUT_STORAGE_KEY, layout);
  } catch {
    // localStorage may be unavailable in private browsing or tests
  }
}
