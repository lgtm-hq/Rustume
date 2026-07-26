export const HOME_SIDEBAR_STORAGE_KEY = "rustume:home-sidebar";

export const HomeSidebarState = {
  Open: "open",
  Collapsed: "collapsed",
} as const;

export type HomeSidebarState = (typeof HomeSidebarState)[keyof typeof HomeSidebarState];

/** The rail starts out of the way; unknown/corrupt stored values fall back to it. */
export const DEFAULT_HOME_SIDEBAR_OPEN = false;

export function getStoredHomeSidebarOpen(): boolean {
  if (typeof localStorage === "undefined") return DEFAULT_HOME_SIDEBAR_OPEN;
  try {
    const raw = localStorage.getItem(HOME_SIDEBAR_STORAGE_KEY);
    if (raw === HomeSidebarState.Open) return true;
    if (raw === HomeSidebarState.Collapsed) return false;
  } catch {
    // localStorage may be unavailable in private browsing or tests
  }
  return DEFAULT_HOME_SIDEBAR_OPEN;
}

export function setStoredHomeSidebarOpen(open: boolean): void {
  try {
    localStorage.setItem(
      HOME_SIDEBAR_STORAGE_KEY,
      open ? HomeSidebarState.Open : HomeSidebarState.Collapsed,
    );
  } catch {
    // localStorage may be unavailable in private browsing or tests
  }
}
