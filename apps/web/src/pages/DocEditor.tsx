/**
 * The flag-gated document editor at `/edit/:id`.
 *
 * The left pane is the editable paper sheet (structure fidelity); the right
 * pane mounts the server-rendered `Preview` — the ground-truth Typst render,
 * refreshed off resume-store mutations through the preview's own debounce.
 *
 * Reached only when `isDocEditorEnabled()` is true — see `src/lib/flags.ts` and
 * the route swap in `src/index.tsx`.
 */

import {
  Show,
  Suspense,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  lazy,
} from "solid-js";
import { useNavigate, useParams } from "@solidjs/router";
import { Button, Spinner, toast } from "../components/ui";
import { DocSheet, SectionsPanel, TemplatesDrawer } from "../components/doc-editor";
import { SplitPane } from "../components/layout/SplitPane";
import { CustomCssInjector } from "../components/templates/CustomCssInjector";
import { useHotkeys, type Shortcut } from "../hooks/useHotkeys";
import { usePageTitle } from "../hooks/usePageTitle";
import { useNavigationGuard } from "../hooks/useNavigationGuard";
import { useResumeRouteLoad } from "../hooks/useResumeRouteLoad";
import { fetchTemplateLayouts } from "../api/render";
import { FALLBACK_TEMPLATE_LAYOUT, type TemplateLayout } from "../lib/docLayout";
import { resumeStore } from "../stores/resume";
import { uiStore } from "../stores/ui";
import { undoHistoryStore } from "../stores/undoHistory";

const VersionHistory = lazy(() =>
  import("../components/version-history/VersionHistory").then((module) => ({
    default: module.VersionHistory,
  })),
);

const Preview = lazy(() =>
  import("../components/preview").then((module) => ({ default: module.Preview })),
);

export default function DocEditor() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { store, undo, redo } = resumeStore;
  const { store: ui, openModal } = uiStore;
  const undoState = () => undoHistoryStore.state;
  const { isLoading, loadError, reload } = useResumeRouteLoad(() => params.id);

  // Mirrors Editor.tsx's undo wiring: the sheet's inline inputs keep their
  // native text-level undo (`skipWhenEditable`), the store handles the rest.
  const shortcuts: Shortcut[] = [
    {
      key: "z",
      mod: true,
      skipWhenEditable: true,
      handler: () => {
        if (undo()) toast.success("Undone");
      },
      label: "Undo",
      category: "Editing",
    },
    {
      key: "z",
      mod: true,
      shift: true,
      skipWhenEditable: true,
      handler: () => {
        if (redo()) toast.success("Redone");
      },
      label: "Redo",
      category: "Editing",
    },
    {
      key: "y",
      mod: true,
      skipWhenEditable: true,
      handler: () => {
        if (redo()) toast.success("Redone");
      },
      label: "Redo",
      category: "Editing",
    },
  ];
  useHotkeys(shortcuts);

  usePageTitle(() => {
    const name = store.resume?.basics.name.trim();
    return name ? `${name} · Document` : "Document";
  });

  useNavigationGuard(() => store.isDirty);

  // A rejected resource rethrows on read, which would tear down the whole app
  // via `AppErrorBoundary`. An unreachable template endpoint is exactly what
  // FALLBACK_TEMPLATE_LAYOUT exists for, so absorb the failure into an empty
  // map and let the lookup below fall back.
  const [layouts] = createResource(async () => {
    try {
      return await fetchTemplateLayouts();
    } catch {
      return {} as Record<string, TemplateLayout>;
    }
  });
  const templateLayout = createMemo<TemplateLayout>(
    () => layouts()?.[store.resume?.metadata.template ?? ""] ?? FALLBACK_TEMPLATE_LAYOUT,
  );

  const [pageCount, setPageCount] = createSignal(0);
  const [overflowingPages, setOverflowingPages] = createSignal<number[]>([]);

  // Ground truth from the server render. The sheet's own pagination drives the
  // sheet; the pill prefers what Typst actually produced, falling back to the
  // sheet's count until the first render lands.
  const [renderedPageCount, setRenderedPageCount] = createSignal(0);
  const displayedPageCount = () => renderedPageCount() || pageCount();

  // A different document must not inherit the previous one's counts: drop all
  // document-scoped display state until the new sheet and render report in.
  createEffect(() => {
    void params.id;
    setRenderedPageCount(0);
    setPageCount(0);
    setOverflowingPages([]);
  });

  const overflowMessage = () => {
    const pages = overflowingPages();
    if (pages.length === 0) return "";
    const labels = pages.map((page) => page + 1).join(", ");
    return pages.length === 1
      ? `Content overflows page ${labels}`
      : `Content overflows pages ${labels}`;
  };

  const PreviewPane = () => (
    <div class="h-full border-l border-border" data-testid="doc-editor-preview-pane">
      <Suspense
        fallback={
          <div class="h-full flex items-center justify-center bg-surface/40">
            <Spinner ariaLabel="Loading preview" />
          </div>
        }
      >
        <Preview onTotalPagesChange={setRenderedPageCount} />
      </Suspense>
    </div>
  );

  const SheetPane = () => (
    <div class="h-full overflow-auto bg-surface/30" data-testid="doc-editor-sheet-pane">
      <Show when={store.resume}>
        {(resume) => (
          <DocSheet
            resume={resume()}
            templateLayout={templateLayout()}
            onPageCountChange={setPageCount}
            onOverflowChange={setOverflowingPages}
          />
        )}
      </Show>
    </div>
  );

  return (
    <div class="h-[calc(100vh-3.5rem)] flex flex-col">
      <CustomCssInjector />

      {/*
        Informational chrome only. It reports what the layout produced; it never
        reflows anything. Pagination is a section-level `metadata.layout`
        decision made elsewhere.
      */}
      <div class="h-12 flex items-center justify-between gap-4 border-b border-border bg-paper px-4">
        {/* Panel chrome around the sheet: the drawers overlay the surface and
            never disturb the page frames or their drop zones. */}
        <div class="flex items-center gap-2">
          <Show when={store.resume}>
            {(resume) => (
              <>
                <TemplatesDrawer resume={resume()} />
                <SectionsPanel resume={resume()} />
              </>
            )}
          </Show>
        </div>
        <p class="font-mono text-xs text-stone" data-testid="doc-editor-page-count">
          {/* No count until a sheet exists — otherwise this reads "0 pages"
              while loading and behind the load-error screen. Also hidden while
              a same-document reload is in flight so a stale count never shows
              over the loading state. */}
          <Show when={!isLoading() && !loadError() && displayedPageCount() > 0}>
            {displayedPageCount() === 1 ? "1 page" : `${displayedPageCount()} pages`}
          </Show>
        </p>
        <div class="flex items-center gap-2">
          <p
            role="status"
            class="font-mono text-xs text-[var(--turbo-state-warning)]"
            data-testid="doc-editor-overflow"
          >
            {!isLoading() && !loadError() ? overflowMessage() : ""}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => undo()}
            disabled={!undoState().canUndo}
            aria-label="Undo"
            title="Undo"
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
                d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4"
              />
            </svg>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => redo()}
            disabled={!undoState().canRedo}
            aria-label="Redo"
            title="Redo"
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
                d="M21 10H11a5 5 0 00-5 5v2M21 10l-4-4M21 10l-4 4"
              />
            </svg>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openModal("versionHistory")}>
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
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            History
          </Button>
        </div>
      </div>

      <div class="flex-1 overflow-hidden">
        <Show
          when={!isLoading() && !loadError() && store.resume != null}
          fallback={
            <div class="h-full flex items-center justify-center">
              <Show
                when={loadError()}
                fallback={
                  <div class="flex flex-col items-center gap-4 text-center">
                    <Spinner />
                    <p class="text-stone">Loading resume...</p>
                  </div>
                }
              >
                {(errorMessage) => (
                  <div class="max-w-md px-4 text-center">
                    <h2 class="font-display text-lg font-semibold text-ink mb-2">
                      Failed to load resume
                    </h2>
                    <p class="text-stone text-sm mb-6">{errorMessage()}</p>
                    <div class="flex items-center justify-center gap-3">
                      <Button variant="secondary" onClick={() => reload()}>
                        Retry
                      </Button>
                      <Button variant="ghost" onClick={() => navigate("/", { replace: true })}>
                        Back to Home
                      </Button>
                    </div>
                  </div>
                )}
              </Show>
            </div>
          }
        >
          <SplitPane defaultRatio={0.6} left={<SheetPane />} right={<PreviewPane />} />
        </Show>
      </div>

      {/* Loaded on demand, exactly as Editor.tsx mounts it. */}
      <Show when={ui.modal === "versionHistory"}>
        <Suspense fallback={null}>
          <VersionHistory />
        </Suspense>
      </Show>
    </div>
  );
}
