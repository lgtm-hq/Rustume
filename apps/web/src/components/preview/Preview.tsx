import { createSignal, createEffect, For, onCleanup, untrack, Show } from "solid-js";
import { toast } from "../ui";
import { resumeStore } from "../../stores/resume";
import { uiStore } from "../../stores/ui";
import { renderPreview } from "../../api/render";
import { useDebounce } from "../../hooks/useDebounce";
import { useOnline } from "../../hooks/useOnline";
import { clearPrintPageFormat, setPrintPageFormat } from "../../lib/printFormat";
import {
  KEYBOARD_PAN_STEP,
  clampPan,
  isWheelZoomGesture,
  shouldResetPan,
  wheelZoomDelta,
} from "./previewPan";

export function Preview() {
  const { store } = resumeStore;
  const { store: ui, setPreviewPage, setPreviewZoom, zoomIn, zoomOut } = uiStore;
  const isOnline = useOnline();

  const [previewUrl, setPreviewUrl] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [lastCachedUrl, setLastCachedUrl] = createSignal<string | null>(null);
  const [totalPages, setTotalPages] = createSignal(1);
  const [printPageUrls, setPrintPageUrls] = createSignal<string[]>([]);

  let printPagesRequestId = 0;

  // Dedup guard so a degraded print stack only toasts once until a full success
  let printStackErrorToasted = false;

  const [panX, setPanX] = createSignal(0);
  const [panY, setPanY] = createSignal(0);
  const [isDragging, setIsDragging] = createSignal(false);

  let viewportRef: HTMLDivElement | undefined;
  let dragStartX = 0;
  let dragStartY = 0;
  let panStartX = 0;
  let panStartY = 0;
  let activePointerId: number | null = null;

  const applyPanClamp = (x: number, y: number, zoom = ui.previewZoom) => {
    const viewport = viewportRef;
    if (!viewport) return { x: 0, y: 0 };
    return clampPan(x, y, zoom, viewport.clientWidth, viewport.clientHeight);
  };

  const resetPan = () => {
    setPanX(0);
    setPanY(0);
  };

  const reclampPan = (zoom = ui.previewZoom) => {
    if (shouldResetPan(zoom)) {
      resetPan();
      return;
    }
    const clamped = applyPanClamp(untrack(panX), untrack(panY), zoom);
    if (clamped.x !== untrack(panX) || clamped.y !== untrack(panY)) {
      setPanX(clamped.x);
      setPanY(clamped.y);
    }
  };

  // Re-clamp only when zoom changes; pan updates are already clamped at write.
  createEffect(() => reclampPan(ui.previewZoom));

  // Viewport resizes can leave a previously valid pan out of bounds.
  const resizeObserver = new ResizeObserver(() => reclampPan());
  createEffect(() => {
    if (viewportRef) resizeObserver.observe(viewportRef);
  });
  onCleanup(() => resizeObserver.disconnect());

  // Request ID to guard against race conditions
  let resumeRequestId = 0;
  let pageRequestId = 0;

  // Dedup guard to prevent toast spam on repeated preview errors
  let lastToastedError = "";
  let lastWheelNavigation = 0;

  const resolvePage = (page: number) => Math.min(Math.max(page, 0), totalPages() - 1);

  const goToPage = (page: number) => {
    const nextPage = resolvePage(page);
    if (nextPage !== ui.previewPage) {
      setPreviewPage(nextPage);
    }
  };

  const goToPageWithCooldown = (page: number) => {
    if (totalPages() <= 1) return false;

    const now = Date.now();
    if (now - lastWheelNavigation < 400) return false;

    const nextPage = resolvePage(page);
    if (nextPage === ui.previewPage) return false;

    lastWheelNavigation = now;
    goToPage(nextPage);
    return true;
  };

  const handleWheel = (event: WheelEvent) => {
    if (isWheelZoomGesture(event)) {
      const nextZoom = wheelZoomDelta(event.deltaY, ui.previewZoom);
      if (nextZoom !== ui.previewZoom) {
        setPreviewZoom(nextZoom);
      }
      event.preventDefault();
      return;
    }

    if (Math.abs(event.deltaY) < 30) return;
    if (!goToPageWithCooldown(ui.previewPage + (event.deltaY > 0 ? 1 : -1))) return;
    event.preventDefault();
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (ui.previewZoom <= 1 || event.button !== 0 || activePointerId !== null) return;

    setIsDragging(true);
    activePointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    panStartX = panX();
    panStartY = panY();
    (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (!isDragging() || event.pointerId !== activePointerId) return;

    const deltaX = event.clientX - dragStartX;
    const deltaY = event.clientY - dragStartY;
    const clamped = applyPanClamp(panStartX + deltaX, panStartY + deltaY);
    setPanX(clamped.x);
    setPanY(clamped.y);
  };

  const endDrag = (event: PointerEvent) => {
    if (!isDragging() || event.pointerId !== activePointerId) return;

    setIsDragging(false);
    activePointerId = null;
    const el = event.currentTarget as HTMLDivElement;
    if (el.hasPointerCapture(event.pointerId)) {
      el.releasePointerCapture(event.pointerId);
    }
  };

  const handleDoubleClick = () => {
    setPreviewZoom(1);
    resetPan();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    // When zoomed in, arrow keys pan (keyboard equivalent of drag);
    // at fit zoom, up/down keep navigating pages.
    if (ui.previewZoom > 1) {
      const pan: Record<string, [number, number]> = {
        ArrowUp: [0, KEYBOARD_PAN_STEP],
        ArrowDown: [0, -KEYBOARD_PAN_STEP],
        ArrowLeft: [KEYBOARD_PAN_STEP, 0],
        ArrowRight: [-KEYBOARD_PAN_STEP, 0],
      };
      const delta = pan[event.key];
      if (!delta) return;
      const clamped = applyPanClamp(panX() + delta[0], panY() + delta[1]);
      setPanX(clamped.x);
      setPanY(clamped.y);
      event.preventDefault();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    if (!goToPageWithCooldown(ui.previewPage + (event.key === "ArrowDown" ? 1 : -1))) return;
    event.preventDefault();
  };

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
      .then((result) => {
        if (currentRequestId !== resumeRequestId) return;
        setPreviewUrl(result.url);
        setLastCachedUrl(result.url);
        setTotalPages(result.totalPages);
        // Clamp page index when content shrinks (e.g., user deletes text)
        if (ui.previewPage >= result.totalPages) {
          setPreviewPage(Math.max(0, result.totalPages - 1));
        }
        setError(null);
        lastToastedError = "";
      })
      .catch((e) => {
        if (currentRequestId !== resumeRequestId) return;
        console.error("Preview error:", e);
        const msg = e instanceof Error ? e.message : String(e) || "Failed to load preview";
        setError(msg);
        if (msg !== lastToastedError) {
          lastToastedError = msg;
          toast.error("Preview rendering failed");
        }
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
      .then((result) => {
        if (currentRequestId !== pageRequestId) return;
        setPreviewUrl(result.url);
        setLastCachedUrl(result.url);
        setTotalPages(result.totalPages);
        setError(null);
        lastToastedError = "";
      })
      .catch((e) => {
        if (currentRequestId !== pageRequestId) return;
        console.error("Preview error:", e);
        const msg = e instanceof Error ? e.message : String(e) || "Failed to load preview";
        setError(msg);
        if (msg !== lastToastedError) {
          lastToastedError = msg;
          toast.error("Preview rendering failed");
        }
        if (lastCachedUrl()) {
          setPreviewUrl(lastCachedUrl());
        }
      })
      .finally(() => {
        if (currentRequestId === pageRequestId) {
          setIsLoading(false);
        }
      });
  });

  createEffect(() => {
    const format = store.resume?.metadata.page.format;
    if (format) {
      setPrintPageFormat(format);
    } else {
      clearPrintPageFormat();
    }
  });

  onCleanup(() => {
    clearPrintPageFormat();
  });

  // The multi-page prefetch is debounced, so a print triggered inside that
  // window can go out with pages missing — warn rather than print silently
  // incomplete output.
  const handleBeforePrint = () => {
    if (totalPages() > 1 && printPageUrls().length < totalPages()) {
      toast.error("Print pages are still loading — some pages may be missing");
    }
  };
  window.addEventListener("beforeprint", handleBeforePrint);
  onCleanup(() => window.removeEventListener("beforeprint", handleBeforePrint));

  // Always keep the current page's URL in the print stack synchronously so
  // single-page printing never regresses while the multi-page prefetch idles.
  createEffect(() => {
    const currentUrl = previewUrl();
    const currentPage = untrack(() => ui.previewPage);

    if (!currentUrl) {
      setPrintPageUrls([]);
      return;
    }

    setPrintPageUrls((prev) => {
      if (currentPage >= prev.length) return [currentUrl];
      const next = [...prev];
      next[currentPage] = currentUrl;
      return next;
    });
  });

  // Prefetch the remaining pages for the print stack on a longer idle delay so
  // rapid edits and page navigation don't multiply server render load.
  const debouncedPrintStackUrl = useDebounce(previewUrl, 2500);

  createEffect(() => {
    const currentUrl = debouncedPrintStackUrl();
    if (!currentUrl) return;

    const resume = untrack(() => store.resume);
    const count = untrack(totalPages);
    const currentPage = untrack(() => ui.previewPage);

    if (!resume || count <= 1) return;
    if (!untrack(isOnline)) return;

    const requestId = ++printPagesRequestId;

    void (async () => {
      const results = await Promise.allSettled(
        Array.from({ length: count }, async (_, page) => {
          if (page === currentPage) return currentUrl;
          const result = await renderPreview(resume, page);
          return result.url;
        }),
      );
      if (requestId !== printPagesRequestId) return;

      const urls = results
        .filter((result): result is PromiseFulfilledResult<string> => result.status === "fulfilled")
        .map((result) => result.value);
      const failures = results.filter((result) => result.status === "rejected");

      if (failures.length > 0) {
        console.error("Failed to load print pages:", failures[0].reason);
        if (!printStackErrorToasted) {
          printStackErrorToasted = true;
          toast.error("Some pages may be missing from print output");
        }
      } else {
        printStackErrorToasted = false;
      }

      // Keep the successfully fetched pages rather than collapsing the stack
      setPrintPageUrls(urls.length > 0 ? urls : [currentUrl]);
    })();
  });

  return (
    <div class="h-full flex flex-col bg-stone/5">
      <div data-print-stack aria-hidden="true">
        <For each={printPageUrls()}>
          {(url) => (
            <div data-print-root class="bg-white">
              <img src={url} alt="Resume page" />
            </div>
          )}
        </For>
      </div>

      {/* Controls */}
      <div
        class="flex items-center justify-between px-4 py-2 border-b border-border bg-paper"
        data-print-hide
      >
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="p-1.5 text-stone hover:text-ink hover:bg-surface rounded transition-colors
              disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Previous page"
            title="Previous page"
            onClick={() => goToPage(ui.previewPage - 1)}
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
            {ui.previewPage + 1} / {totalPages()}
          </span>
          <button
            type="button"
            class="p-1.5 text-stone hover:text-ink hover:bg-surface rounded transition-colors
              disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next page"
            title="Next page"
            onClick={() => goToPage(ui.previewPage + 1)}
            disabled={ui.previewPage >= totalPages() - 1}
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

        <div class="flex items-center gap-2">
          <Show when={totalPages() > 1}>
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono"
              style={{
                background: "color-mix(in srgb, var(--turbo-state-warning) 15%, transparent)",
                color: "var(--turbo-state-warning)",
              }}
              title={`Content spans ${totalPages()} pages`}
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {totalPages()} pages
            </span>
          </Show>
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
      <div
        ref={(el) => {
          viewportRef = el;
        }}
        class="flex-1 p-6 flex items-start justify-center
          focus:outline-none focus-visible:ring-2 focus-visible:ring-accent
          focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        data-print-screen
        classList={{
          "overflow-auto": ui.previewZoom <= 1,
          "overflow-hidden": ui.previewZoom > 1,
          "cursor-grab": ui.previewZoom > 1 && !isDragging(),
          "cursor-grabbing": isDragging(),
          "select-none": ui.previewZoom > 1,
        }}
        style={{ "touch-action": ui.previewZoom > 1 ? "none" : "auto" }}
        tabIndex={0}
        title={
          ui.previewZoom > 1
            ? "Drag or arrow keys to pan · Ctrl/Cmd+scroll to zoom · Double-click to reset"
            : undefined
        }
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDblClick={handleDoubleClick}
      >
        <div
          class="relative transition-[width,height] duration-200 origin-top"
          style={{
            width: `${595 * ui.previewZoom}px`,
            height: `${842 * ui.previewZoom}px`,
            transform: `translate(${panX()}px, ${panY()}px)`,
          }}
        >
          {/* Paper Effect — marked as the custom CSS root so user CSS
              (scoped via @scope in lib/customCss.ts) can style the resume
              paper surface but never the surrounding app UI. */}
          <div
            data-custom-css-root
            class="bg-white rounded-sm shadow-paper paper-texture
              transition-all duration-300 hover:shadow-elevated
              hover:rotate-[0.3deg]"
            style={{
              // A4 aspect ratio at reasonable size
              width: "100%",
              height: "100%",
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
                class="w-full h-full object-fill"
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
