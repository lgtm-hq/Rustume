/**
 * Loads the resume addressed by an `/edit/:id` route into the shared store.
 *
 * Shared by the form editor and the document sheet so both surfaces agree on
 * the tricky parts: flushing a pending autosave before switching resumes,
 * refusing to clobber data when a load fails for any reason other than "not
 * found", and never letting a slow load overwrite a newer route's state.
 */

import { type Accessor, createEffect, createSignal, on } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { toast } from "../components/ui";
import { bypassNextNavigationGuard } from "./useNavigationGuard";
import { resumeStore, isNotFoundError } from "../stores/resume";
import { isWasmReady } from "../wasm";

/** How long to wait for WASM before attempting the load anyway. */
const WASM_POLL_ATTEMPTS = 20;
const WASM_POLL_INTERVAL_MS = 100;

export interface ResumeRouteLoad {
  /** True while a load is in flight. */
  isLoading: Accessor<boolean>;
  /** The message of a failed load, or `null`. Never set for "not found". */
  loadError: Accessor<string | null>;
  /** Retry the current route's load. */
  reload: () => void;
}

/**
 * Keep the shared resume store aligned with `id()`.
 *
 * A missing resume is created rather than treated as an error — `/edit/:id` is
 * also how a brand new resume is opened. Any other failure surfaces through
 * {@link ResumeRouteLoad.loadError} with the stored data untouched.
 */
export function useResumeRouteLoad(id: Accessor<string | undefined>): ResumeRouteLoad {
  const navigate = useNavigate();
  const { store, loadResume, createNewResume, forceSave } = resumeStore;

  const [isLoading, setIsLoading] = createSignal(true);
  const [loadError, setLoadError] = createSignal<string | null>(null);

  /** Monotonic token so overlapping loads cannot clobber a newer route's state. */
  let loadSeq = 0;

  async function attemptLoad(resumeId: string | undefined): Promise<void> {
    const seq = ++loadSeq;

    if (!resumeId) {
      navigate("/");
      return;
    }

    // Flush pending autosave before switching resumes so dirty edits aren't lost
    // or persisted under the destination id after the shared store is replaced.
    const previousId = store.id;
    if (previousId && previousId !== resumeId) {
      await forceSave();
      if (seq !== loadSeq) return;
      // persistResume swallows errors — if still dirty, restore the previous route
      // so the URL stays aligned with the shared store instead of showing A at /edit/B.
      if (store.isDirty) {
        toast.error(store.error ?? "Failed to save current resume before switching");
        // Bypass the dirty-leave confirm so recovery can realign the URL with the store.
        const recoveryPath = `/edit/${previousId}`;
        bypassNextNavigationGuard(recoveryPath);
        navigate(recoveryPath, { replace: true });
        return;
      }
    } else if (store.id === resumeId && store.resume) {
      // Already editing this resume (e.g. restored route after a failed flush).
      setIsLoading(false);
      setLoadError(null);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    // Wait for WASM if not ready
    let attempts = 0;
    while (!isWasmReady() && attempts < WASM_POLL_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, WASM_POLL_INTERVAL_MS));
      attempts++;
    }
    if (seq !== loadSeq) return;

    try {
      // Try to load existing resume
      await loadResume(resumeId);
      if (seq !== loadSeq) return;
    } catch (error) {
      if (seq !== loadSeq) return;
      if (isNotFoundError(error)) {
        // Resume genuinely does not exist -- safe to create a new one
        try {
          createNewResume(resumeId);
          toast.info("New resume created");
        } catch (createError) {
          console.error("Failed to create new resume:", createError);
          toast.error("Failed to create new resume — redirecting to home");
          navigate("/", { replace: true });
        }
      } else {
        // Non-"not found" error (corruption, transient I/O, deserialization).
        // Do NOT create a new resume -- that would destroy existing data.
        console.error("Failed to load resume:", error);
        const message = error instanceof Error ? error.message : "An unexpected error occurred";
        setLoadError(message);
        toast.error("Failed to load resume — your data has not been modified");
      }
    } finally {
      if (seq === loadSeq) {
        setIsLoading(false);
      }
    }
  }

  // Reload whenever the route id changes (Create Resume navigates /edit/:id → /edit/:id).
  createEffect(
    on(id, (resumeId) => {
      void attemptLoad(resumeId);
    }),
  );

  return {
    isLoading,
    loadError,
    reload: () => {
      void attemptLoad(id());
    },
  };
}
