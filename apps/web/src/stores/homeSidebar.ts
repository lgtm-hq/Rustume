import { createSignal } from "solid-js";
import {
  DEFAULT_HOME_SIDEBAR_OPEN,
  getStoredHomeSidebarOpen,
  HOME_SIDEBAR_NARROW_QUERY,
  setStoredHomeSidebarOpen,
} from "../lib/homeSidebar";

/** Element id of the scope rail, shared by every control that expands it. */
export const HOME_SIDEBAR_ID = "home-scope-rail";

// Module scope on purpose: the utility-bar toggle lives in AppShell, outside the
// Home tree, so both toggles have to read and write one signal rather than
// keeping parallel component state.
const [homeSidebarOpen, setOpenSignal] = createSignal(DEFAULT_HOME_SIDEBAR_OPEN);

export { homeSidebarOpen };

function isDrawerViewport(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia(HOME_SIDEBAR_NARROW_QUERY).matches;
  } catch {
    // matchMedia is unavailable in this environment; treat it as the wide layout
    return false;
  }
}

/**
 * Open or close the rail.
 *
 * The stored value describes the wide layout, where the rail is a column the
 * user chose to keep. Below the breakpoint it is an ephemeral drawer, so opening
 * and dismissing it there is not written back — otherwise filtering on a phone
 * would silently discard the choice made on a larger screen.
 */
export function setHomeSidebarOpen(open: boolean): void {
  setOpenSignal(open);
  if (!isDrawerViewport()) setStoredHomeSidebarOpen(open);
}

export function toggleHomeSidebar(): void {
  setHomeSidebarOpen(!homeSidebarOpen());
}

/**
 * Re-read the persisted state when Home mounts, so storage stays the source of
 * truth across navigations without the signal having to be read at import time.
 */
export function restoreHomeSidebarOpen(): void {
  setOpenSignal(getStoredHomeSidebarOpen());
}
