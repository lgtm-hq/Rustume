import { createSignal } from "solid-js";
import {
  DEFAULT_HOME_SIDEBAR_OPEN,
  getStoredHomeSidebarOpen,
  setStoredHomeSidebarOpen,
} from "../lib/homeSidebar";

/** Element id of the scope rail, shared by every control that expands it. */
export const HOME_SIDEBAR_ID = "home-scope-rail";

// Module scope on purpose: the utility-bar toggle lives in AppShell, outside the
// Home tree, so both toggles have to read and write one signal rather than
// keeping parallel component state.
const [homeSidebarOpen, setOpenSignal] = createSignal(DEFAULT_HOME_SIDEBAR_OPEN);

export { homeSidebarOpen };

export function setHomeSidebarOpen(open: boolean): void {
  setOpenSignal(open);
  setStoredHomeSidebarOpen(open);
}

/**
 * Close without persisting. The narrow-viewport drawer closes on selection —
 * that incidental close must not overwrite the preference the user set
 * deliberately, which may well have been set on a wider screen.
 */
export function closeHomeSidebarTransiently(): void {
  setOpenSignal(false);
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
