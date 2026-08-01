/**
 * The flag-gated document editor at `/edit/:id`.
 *
 * This slice is read-only: it draws the resume as a paper sheet and reports
 * what does not fit. Editing affordances (#728) and the PDF preview pane (#732)
 * land on top of it; until then the right pane is a placeholder.
 *
 * Reached only when `isDocEditorEnabled()` is true — see `src/lib/flags.ts` and
 * the route swap in `src/index.tsx`.
 */

import { Show, createMemo, createResource, createSignal } from "solid-js";
import { useNavigate, useParams } from "@solidjs/router";
import { Button, Spinner } from "../components/ui";
import { DocSheet } from "../components/doc-editor";
import { SplitPane } from "../components/layout/SplitPane";
import { CustomCssInjector } from "../components/templates/CustomCssInjector";
import { usePageTitle } from "../hooks/usePageTitle";
import { useNavigationGuard } from "../hooks/useNavigationGuard";
import { useResumeRouteLoad } from "../hooks/useResumeRouteLoad";
import { fetchTemplateLayouts } from "../api/render";
import { CUSTOM_SECTION_SENTINEL, FIXED_SECTION_IDS, type TemplateLayout } from "../lib/docLayout";
import { resumeStore } from "../stores/resume";

/**
 * Layout used when the template's own metadata cannot be fetched.
 *
 * A single column holding every section in canonical order — the same shape a
 * single-column template declares — so the sheet still draws a faithful,
 * complete document when `GET /api/templates` is unavailable.
 */
export const FALLBACK_TEMPLATE_LAYOUT: TemplateLayout = {
  layoutMode: "single",
  defaultColumns: [[...FIXED_SECTION_IDS, CUSTOM_SECTION_SENTINEL], []],
  headerStyle: "left",
  contactIn: "header",
  sidebarWidth: null,
};

function PreviewPlaceholder() {
  return (
    <div
      class="h-full flex items-center justify-center border-l border-border bg-surface/40 p-6"
      data-testid="doc-editor-preview-placeholder"
    >
      <p class="max-w-xs text-center text-sm text-stone">
        The rendered PDF preview appears here once it lands.
      </p>
    </div>
  );
}

export default function DocEditor() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { store } = resumeStore;
  const { isLoading, loadError, reload } = useResumeRouteLoad(() => params.id);

  usePageTitle(() => {
    const name = store.resume?.basics.name.trim();
    return name ? `${name} · Document` : "Document";
  });

  useNavigationGuard(() => store.isDirty);

  const [layouts] = createResource(fetchTemplateLayouts);
  const templateLayout = createMemo<TemplateLayout>(
    () => layouts()?.[store.resume?.metadata.template ?? ""] ?? FALLBACK_TEMPLATE_LAYOUT,
  );

  const [pageCount, setPageCount] = createSignal(0);
  const [overflowingPages, setOverflowingPages] = createSignal<number[]>([]);

  const overflowMessage = () => {
    const pages = overflowingPages();
    if (pages.length === 0) return "";
    const labels = pages.map((page) => page + 1).join(", ");
    return pages.length === 1
      ? `Content overflows page ${labels}`
      : `Content overflows pages ${labels}`;
  };

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
        <p class="font-mono text-xs text-stone" data-testid="doc-editor-page-count">
          {pageCount() === 1 ? "1 page" : `${pageCount()} pages`}
        </p>
        <p
          role="status"
          class="font-mono text-xs text-[var(--turbo-state-warning)]"
          data-testid="doc-editor-overflow"
        >
          {overflowMessage()}
        </p>
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
          <SplitPane defaultRatio={0.6} left={<SheetPane />} right={<PreviewPlaceholder />} />
        </Show>
      </div>
    </div>
  );
}
