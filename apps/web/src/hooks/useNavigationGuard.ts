import { type Accessor, createEffect, onCleanup } from "solid-js";
import { useBeforeLeave } from "@solidjs/router";

/**
 * One-shot bypass for intentional recovery navigations (e.g. restore dirty route).
 * When `targetPath` is set, only that destination consumes the bypass; otherwise
 * the next leave clears it. An unused bypass is cleared on the next microtask so
 * a no-op navigate cannot leave the guard armed.
 */
let bypassTargetPath: string | null = null;

function clearBypass(): void {
  bypassTargetPath = null;
}

/** Allow the next matching in-app navigation to proceed even when the store is dirty. */
export function bypassNextNavigationGuard(targetPath?: string): void {
  bypassTargetPath = targetPath ?? "*";
  // Sync navigate() runs useBeforeLeave before this microtask; no-op navigations
  // never fire it, so disarm here to avoid skipping a later dirty leave confirm.
  queueMicrotask(() => {
    clearBypass();
  });
}

/**
 * Blocks navigation when the provided condition is true.
 * Guards both in-app route changes (via @solidjs/router) and
 * browser-level events (tab close, refresh, back button).
 */
export function useNavigationGuard(isDirty: Accessor<boolean>) {
  // Guard in-app route changes
  useBeforeLeave((e) => {
    if (bypassTargetPath != null) {
      const target = bypassTargetPath;
      clearBypass();
      if (target === "*" || e.to === target) {
        return;
      }
      // Bypass was armed for a different destination — fall through to dirty check.
    }
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
        e.returnValue = "";
      };
      window.addEventListener("beforeunload", handler);
      onCleanup(() => window.removeEventListener("beforeunload", handler));
    }
  });
}
