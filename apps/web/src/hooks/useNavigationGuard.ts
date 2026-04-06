import { type Accessor, createEffect, onCleanup } from "solid-js";
import { useBeforeLeave } from "@solidjs/router";

/**
 * Blocks navigation when the provided condition is true.
 * Guards both in-app route changes (via @solidjs/router) and
 * browser-level events (tab close, refresh, back button).
 */
export function useNavigationGuard(isDirty: Accessor<boolean>) {
  // Guard in-app route changes
  useBeforeLeave((e) => {
    if (isDirty() && !e.defaultPrevented) {
      e.preventDefault();
      if (window.confirm("You have unsaved changes. Leave anyway?")) {
        e.retry(true);
      }
    }
  });

  // Guard browser-level navigation (tab close, refresh)
  createEffect(() => {
    if (isDirty()) {
      const handler = (e: BeforeUnloadEvent) => {
        e.preventDefault();
      };
      window.addEventListener("beforeunload", handler);
      onCleanup(() => window.removeEventListener("beforeunload", handler));
    }
  });
}
