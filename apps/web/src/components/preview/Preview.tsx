import { createSignal, createEffect, Show } from "solid-js";
import { resumeStore } from "../../stores/resume";
import { uiStore } from "../../stores/ui";
import { renderPreview } from "../../api/render";
import { useDebounce } from "../../hooks/useDebounce";
import { useOnline } from "../../hooks/useOnline";

export function Preview() {
  const { store } = resumeStore;
  const { store: ui, setPreviewPage, zoomIn, zoomOut } = uiStore;
  const isOnline = useOnline();

  const [previewUrl, setPreviewUrl] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [lastCachedUrl, setLastCachedUrl] = createSignal<string | null>(null);

  // Request ID to guard against race conditions
  let resumeRequestId = 0;
  let pageRequestId = 0;

  // Debounce the resume data to avoid too many preview requests
  const debouncedResume = useDebounce(
    () => (store.resume ? JSON.stringify(store.resume) : null),
    500,
  );

  // Fetch preview when resume changes
  createEffect(() => {
    const resumeJson = debouncedResume();
    if (!resumeJson || !store.resume) return;

    // Skip if offline — invalidate in-flight requests, keep cached preview
    if (!isOnline()) {
      ++resumeRequestId;
      setIsLoading(false);
      if (lastCachedUrl()) {
        setPreviewUrl(lastCachedUrl());
        setError(null);
      } else {
        setError("Preview unavailable offline");
      }
      return;
    }

    const currentRequestId = ++resumeRequestId;
    setIsLoading(true);
    setError(null);

    renderPreview(store.resume, ui.previewPage)
      .then((url) => {
        if (currentRequestId !== resumeRequestId) return;
        setPreviewUrl(url);
        setLastCachedUrl(url);
        setError(null);
      })
      .catch((e) => {
        if (currentRequestId !== resumeRequestId) return;
        console.error("Preview error:", e);
        setError(e.message || "Failed to load preview");
        // Keep showing last cached preview
        if (lastCachedUrl()) {
          setPreviewUrl(lastCachedUrl());
        }
      })
      .finally(() => {
        if (currentRequestId === resumeRequestId) {
          setIsLoading(false);
        }
      });
  });

  // Also refresh when page changes
  createEffect(() => {
    const page = ui.previewPage;
    if (!store.resume) return;

    // Skip if offline — invalidate in-flight requests, keep cached preview
    if (!isOnline()) {
      ++pageRequestId;
      setIsLoading(false);
      if (lastCachedUrl()) {
        setPreviewUrl(lastCachedUrl());
        setError(null);
      } else {
        setError("Preview unavailable offline");
      }
      return;
    }

    const currentRequestId = ++pageRequestId;
    setIsLoading(true);
    setError(null);

    renderPreview(store.resume, page)
      .then((url) => {
        if (currentRequestId !== pageRequestId) return;
        setPreviewUrl(url);
        setLastCachedUrl(url);
        setError(null);
      })
      .catch((e) => {
        if (currentRequestId !== pageRequestId) return;
        setError(e.message);
      })
      .finally(() => {
        if (currentRequestId === pageRequestId) {
          setIsLoading(false);
        }
      });
  });

  return (
    <div class="h-full flex flex-col bg-stone/5">
      {/* Controls */}
      <div class="flex items-center justify-between px-4 py-2 border-b border-border bg-paper">
        <div class="flex items-center gap-2">
          <button
            class="p-1.5 text-stone hover:text-ink hover:bg-surface rounded transition-colors
              disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={() => setPreviewPage(Math.max(0, ui.previewPage - 1))}
            disabled={ui.previewPage === 0}
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <span class="text-sm font-mono text-stone min-w-[60px] text-center">
            Page {ui.previewPage + 1}
          </span>
          <button
            class="p-1.5 text-stone hover:text-ink hover:bg-surface rounded transition-colors"
            onClick={() => setPreviewPage(ui.previewPage + 1)}
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>

        <div class="flex items-center gap-1">
          <button
            class="p-1.5 text-stone hover:text-ink hover:bg-surface rounded transition-colors"
            onClick={zoomOut}
            title="Zoom out"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
            </svg>
          </button>
          <span class="text-xs font-mono text-stone min-w-[40px] text-center">
            {Math.round(ui.previewZoom * 100)}%
          </span>
          <button
            class="p-1.5 text-stone hover:text-ink hover:bg-surface rounded transition-colors"
            onClick={zoomIn}
            title="Zoom in"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Preview Area */}
      <div class="flex-1 overflow-auto p-6 flex items-start justify-center">
        <div
          class="relative transition-transform duration-200 origin-top"
          style={{ transform: `scale(${ui.previewZoom})` }}
        >
          {/* Paper Effect */}
          <div
            class="bg-white rounded-sm shadow-paper paper-texture
              transition-all duration-300 hover:shadow-elevated
              hover:rotate-[0.3deg]"
            style={{
              // A4 aspect ratio at reasonable size
              width: "595px",
              height: "842px",
            }}
          >
            <Show
              when={previewUrl() && !error()}
              fallback={
                <div class="w-full h-full flex items-center justify-center">
                  <Show
                    when={isLoading()}
                    fallback={
                      <div class="text-center text-stone">
                        <Show when={error()}>
                          <p class="text-sm mb-2">{error()}</p>
                        </Show>
                        <Show when={!isOnline()}>
                          <div class="flex items-center justify-center gap-2 text-offline">
                            <svg
                              class="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3"
                              />
                            </svg>
                            <span>Offline</span>
                          </div>
                        </Show>
                        <Show when={!error() && isOnline()}>
                          <p class="text-sm">Start editing to see preview</p>
                        </Show>
                      </div>
                    }
                  >
                    <div class="flex flex-col items-center gap-3">
                      <svg class="w-8 h-8 animate-spin text-accent" viewBox="0 0 24 24">
                        <circle
                          class="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          stroke-width="4"
                          fill="none"
                        />
                        <path
                          class="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      <span class="text-sm text-stone">Rendering...</span>
                    </div>
                  </Show>
                </div>
              }
            >
              <img
                src={previewUrl()!}
                alt="Resume preview"
                class="w-full h-full object-contain"
                classList={{ "opacity-50": isLoading() }}
              />
            </Show>
          </div>

          {/* Loading overlay */}
          <Show when={isLoading() && previewUrl()}>
            <div class="absolute inset-0 flex items-center justify-center bg-white/50">
              <svg class="w-6 h-6 animate-spin text-accent" viewBox="0 0 24 24">
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                  fill="none"
                />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
