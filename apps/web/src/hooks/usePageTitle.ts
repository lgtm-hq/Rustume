import { createEffect } from "solid-js";

const BASE_TITLE = "Rustume";

/**
 * Keep `document.title` in sync with the current route (WCAG 2.4.2).
 *
 * Accepts a static string or an accessor so titles can track reactive
 * state (e.g. the resume name in the editor). No cleanup reset: the next
 * route's effect overwrites the title, and resetting on disposal would
 * flash the base title between pages.
 */
export function usePageTitle(title: string | (() => string | undefined)): void {
  createEffect(() => {
    const value = typeof title === "function" ? title() : title;
    document.title = value ? `${value} — ${BASE_TITLE}` : BASE_TITLE;
  });
}
