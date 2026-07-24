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
  PREVIEW_PAGE_HEIGHT,
  PREVIEW_PAGE_WIDTH,
  clampPan,
  createPageSwipeState,
  feedPageSwipe,
  isWheelZoomGesture,
  pageDeltaFromBlockedPan,
  resolveWheelInteraction,
  settleZoom,
  shouldResetPan,
  wheelZoomDelta,
} from "./previewPan";
import { prefetchPrintStackPages } from "./printStack";

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
  // GPU-friendly visual zoom, eased toward ui.previewZoom each animation frame.
  const [visualZoom, setVisualZoom] = createSignal(ui.previewZoom);

  let viewportRef: HTMLDivElement | undefined;
  let dragStartX = 0;
  let dragStartY = 0;
  let panStartX = 0;
  let panStartY = 0;
  let activePointerId: number | null = null;
  let zoomRafId = 0;

  const applyPanClamp = (x: number, y: number, zoom = visualZoom()) => {
    const viewport = viewportRef;
    if (!viewport) return { x: 0, y: 0 };
    return clampPan(x, y, zoom, viewport.clientWidth, viewport.clientHeight);
  };

  const resetPan = () => {
    setPanX(0);
    setPanY(0);
  };

  const reclampPan = (zoom = visualZoom()) => {
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

  const runZoomSmoothing = () => {
    if (zoomRafId !== 0) return;

    const tick = () => {
      const target = ui.previewZoom;
      const current = untrack(visualZoom);
      const next = settleZoom(current, target);
      if (next !== current) {
        setVisualZoom(next);
      }
      reclampPan(next);

      if (next !== target) {
        zoomRafId = requestAnimationFrame(tick);
      } else {
        zoomRafId = 0;
      }
    };

    zoomRafId = requestAnimationFrame(tick);
  };

  // Ease visual zoom toward the store target whenever it changes.
  createEffect(() => {
    void ui.previewZoom;
    runZoomSmoothing();
  });
  onCleanup(() => {
    if (zoomRafId !== 0) {
      cancelAnimationFrame(zoomRafId);
      zoomRafId = 0;
    }
  });

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
  let pageSwipe = createPageSwipeState();

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
      const nextZoom = wheelZoomDelta(event.deltaY, ui.previewZoom, event.deltaMode);
      if (nextZoom !== ui.previewZoom) {
        setPreviewZoom(nextZoom);
      }
      event.preventDefault();
      return;
    }

    // Block browser back/forward history swipes over the preview. CSS
    // overscroll-behavior-x helps too; preventDefault covers wheel-driven cases.
    if (event.deltaX !== 0) {
      event.preventDefault();
    }

    const viewport = viewportRef;
    const result = resolveWheelInteraction({
      panX: panX(),
      panY: panY(),
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaMode: event.deltaMode,
      zoom: visualZoom(),
      viewportWidth: viewport?.clientWidth ?? 0,
      viewportHeight: viewport?.clientHeight ?? 0,
    });

    if (result.panX !== panX() || result.panY !== panY()) {
      setPanX(result.panX);
      setPanY(result.panY);
    }

    const swipe = feedPageSwipe(pageSwipe, result.pageIntentDx, result.pageIntentDy, Date.now());
    pageSwipe = swipe.state;

    if (swipe.pageDelta !== 0) {
      if (goToPageWithCooldown(ui.previewPage + swipe.pageDelta)) {
        resetPan();
        pageSwipe = createPageSwipeState();
      }
      return;
    }

    if (result.consumeEvent) {
      event.preventDefault();
    }
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
    // Zoomed: arrows pan; Left/Right at a horizontal edge flip pages.
    // Fit zoom: Left/Right flip pages; Up/Down use native overflow scroll.
    if (ui.previewZoom > 1) {
      const pan: Record<string, [number, number]> = {
        ArrowUp: [0, KEYBOARD_PAN_STEP],
        ArrowDown: [0, -KEYBOARD_PAN_STEP],
        ArrowLeft: [KEYBOARD_PAN_STEP, 0],
        ArrowRight: [-KEYBOARD_PAN_STEP, 0],
      };
      const delta = pan[event.key];
      if (!delta) return;
      const previousX = panX();
      const clamped = applyPanClamp(previousX + delta[0], panY() + delta[1]);
      const pageDelta = pageDeltaFromBlockedPan(previousX, clamped.x, delta[0]);
      if (pageDelta !== 0 && goToPageWithCooldown(ui.previewPage + pageDelta)) {
        resetPan();
      } else {
        setPanX(clamped.x);
        setPanY(clamped.y);
      }
      event.preventDefault();
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    if (!goToPageWithCooldown(ui.previewPage + (event.key === "ArrowRight" ? 1 : -1))) return;
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

  // Invalidate in-flight print prefetch when the template changes so a stale
  // high totalPages from the previous layout cannot request missing pages.
  createEffect(() => {
    void store.resume?.metadata.template;
    printPagesRequestId += 1;
    printStackErrorToasted = false;
    setPrintPageUrls([]);
  });

  // Prefetch remaining pages for the print stack on a longer idle delay so
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
      const result = await prefetchPrintStackPages({
        pageCount: count,
        currentPage,
        currentUrl,
        renderPage: (page) => renderPreview(resume, page),
        shouldCancel: () => requestId !== printPagesRequestId,
      });
      if (requestId !== printPagesRequestId) return;

      if (
        result.reconciledPageCount !== undefined &&
        result.reconciledPageCount > 0 &&
        result.reconciledPageCount < count
      ) {
        setTotalPages(result.reconciledPageCount);
        if (ui.previewPage >= result.reconciledPageCount) {
          setPreviewPage(Math.max(0, result.reconciledPageCount - 1));
        }
      }

      if (result.hasHardFailure) {
        console.error("Failed to load some print pages");
        if (!printStackErrorToasted) {
          printStackErrorToasted = true;
          toast.error("Some pages may be missing from print output");
        }
      } else {
        printStackErrorToasted = false;
      }

      setPrintPageUrls(result.urls.length > 0 ? result.urls : [currentUrl]);
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
            type="button"
            class="p-1.5 text-stone hover:text-ink hover:bg-surface rounded transition-colors"
            onClick={zoomOut}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
            </svg>
          </button>
          <span class="text-xs font-mono text-stone min-w-[40px] text-center">
            {Math.round(visualZoom() * 100)}%
          </span>
          <button
            type="button"
            class="p-1.5 text-stone hover:text-ink hover:bg-surface rounded transition-colors"
            onClick={zoomIn}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
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
          "overflow-auto": visualZoom() <= 1,
          "overflow-hidden": visualZoom() > 1,
          "cursor-grab": visualZoom() > 1 && !isDragging(),
          "cursor-grabbing": isDragging(),
          "select-none": visualZoom() > 1,
        }}
        style={{
          "touch-action": visualZoom() > 1 ? "none" : "pan-y",
          // Prevent macOS/Chrome "swipe to go back/forward" over the CV.
          "overscroll-behavior-x": "none",
        }}
        tabIndex={0}
        title={
          visualZoom() > 1
            ? "Scroll to pan · Swipe horizontally past the edge to change page · Drag or arrows to pan · Ctrl/Cmd+scroll to zoom · Double-click to reset"
            : "Scroll to move the page · Swipe horizontally to change page · Ctrl/Cmd+scroll to zoom"
        }
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDblClick={handleDoubleClick}
      >
        {/* Spacer tracks zoomed layout size; paper scales on the compositor. */}
        <div
          class="relative"
          style={{
            width: `${PREVIEW_PAGE_WIDTH * visualZoom()}px`,
            height: `${PREVIEW_PAGE_HEIGHT * visualZoom()}px`,
          }}
        >
          <div
            class="absolute top-0 left-0 will-change-transform"
            style={{
              width: `${PREVIEW_PAGE_WIDTH}px`,
              height: `${PREVIEW_PAGE_HEIGHT}px`,
              transform: `translate(${panX()}px, ${panY()}px) scale(${visualZoom()})`,
              "transform-origin": "top left",
            }}
          >
            {/* Paper Effect — marked as the custom CSS root so user CSS
              (scoped via @scope in lib/customCss.ts) can style the resume
              paper surface but never the surrounding app UI. */}
            <div
              data-custom-css-root
              class="bg-white rounded-sm shadow-paper paper-texture h-full w-full"
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
                      <div
                        role="status"
                        aria-live="polite"
                        class="flex flex-col items-center gap-3"
                      >
                        <svg
                          class="w-8 h-8 animate-spin text-accent"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
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
              <div
                role="status"
                class="absolute inset-0 flex items-center justify-center bg-white/50"
              >
                <span class="sr-only">Updating preview</span>
                <svg
                  class="w-6 h-6 animate-spin text-accent"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
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
    </div>
  );
}
