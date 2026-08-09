/**
 * The document editor at `/edit/:id`: one centered document surface (#785).
 *
 * The sheet is the only document on screen — what the user edits is what they
 * get. The top bar's Edit/Done toggle switches the surface between the
 * in-place editable document and the clean rendered one; there is no preview
 * pane (the server render remains the artifact of record for export, reached
 * through the Export dialog).
 *
 * Opening a legacy resume converts its TipTap HTML rich fields to markdown
 * once and stamps `metadata.contentFormat` (#786) — see `lib/htmlToMarkdown`.
 *
 * The only editing surface: `/edit/:id` routes here unconditionally (#735
 * retired the form builder and its `?ff=form-builder` escape hatch).
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
import { DocSheet, SectionsPanel, TemplatesDrawer, ThemeDialog } from "../components/doc-editor";
import type { SheetMode } from "../components/doc-editor/sheetMode";
import { CustomCssInjector } from "../components/templates/CustomCssInjector";
import { useHotkeys, type Shortcut } from "../hooks/useHotkeys";
import { usePageTitle } from "../hooks/usePageTitle";
import { useNavigationGuard } from "../hooks/useNavigationGuard";
import { useResumeRouteLoad } from "../hooks/useResumeRouteLoad";
import { fetchTemplateLayouts } from "../api/render";
import { FALLBACK_TEMPLATE_LAYOUT, type TemplateLayout } from "../lib/docLayout";
import { migrateResumeContentToMarkdown, needsContentMigration } from "../lib/htmlToMarkdown";
import { isHtmlEmpty } from "../lib/resumeSections";
import { isResumeEmpty, resumeStore } from "../stores/resume";
import { uiStore } from "../stores/ui";
import { undoHistoryStore } from "../stores/undoHistory";
import type { ResumeData } from "../wasm/types";

const VersionHistory = lazy(() =>
  import("../components/version-history/VersionHistory").then((module) => ({
    default: module.VersionHistory,
  })),
);

const ImportModal = lazy(() =>
  import("../components/import/ImportModal").then((module) => ({ default: module.ImportModal })),
);

const ExportModal = lazy(() =>
  import("../components/export/ExportModal").then((module) => ({ default: module.ExportModal })),
);

/**
 * Whether a resume holds no user content at all.
 *
 * `isResumeEmpty` checks the fields the preview's sample-data heuristic cares
 * about (name, email, headline, visible sections). An existing document can
 * carry content none of those cover — a phone number, a location, a URL,
 * custom contact fields, a cover letter, or items in *hidden* sections — so
 * those are checked here on top: only a truly blank resume opens in Edit.
 */
export function isBlankResume(resume: ResumeData): boolean {
  const basics = resume.basics;
  const sections = Object.values(resume.sections) as unknown[];
  const hasItems = sections.some(
    (section) => ((section as { items?: unknown[] }).items?.length ?? 0) > 0,
  );
  const hasCustomItems = Object.values(resume.sections.custom ?? {}).some(
    (section) => section.items.length > 0,
  );
  return (
    isResumeEmpty(resume) &&
    !hasItems &&
    !hasCustomItems &&
    basics.phone.trim() === "" &&
    basics.location.trim() === "" &&
    (basics.url?.href ?? "").trim() === "" &&
    basics.customFields.every((field) => field.value.trim() === "") &&
    // Visibility-independent: `isResumeEmpty` only checks a *visible*
    // summary, but hidden content is still content.
    isHtmlEmpty(resume.sections.summary?.content ?? "") &&
    isHtmlEmpty(resume.sections.coverLetter?.content ?? "")
  );
}

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

  // Lifted so the sheet's Add-section blocks can open the panel (#794). Both
  // drawers hang off the edge tabs on the resume surface, never the top bar
  // (owner decision 2026-08-04).
  const [isSectionsOpen, setIsSectionsOpen] = createSignal(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = createSignal(false);

  // Theme selection lives in the top bar (spec §1.2, owner addition).
  const [isThemeOpen, setIsThemeOpen] = createSignal(false);

  // Edit or Done, per document. A brand-new empty resume opens ready to type;
  // an existing one opens as the clean rendered document. Below the sheet's
  // miniature edit floor (#813) the sheet forces Done; the toggle is disabled
  // so the chrome matches what the surface actually draws.
  const [mode, setMode] = createSignal<SheetMode>("edit");
  const [sheetInteractive, setSheetInteractive] = createSignal(true);
  let modeInitializedFor: string | null = null;

  createEffect(() => {
    const resume = store.resume;
    if (!resume || isLoading()) return;
    const id = store.id;
    if (id === null || modeInitializedFor === id) return;
    modeInitializedFor = id;
    setMode(isBlankResume(resume) ? "edit" : "done");
  });

  createEffect(() => {
    if (!sheetInteractive() && mode() === "edit") setMode("done");
  });

  // One-time legacy migration (#786): a resume whose rich fields are still
  // TipTap HTML is converted to markdown on open, through a store action so
  // autosave persists the migrated form. The stamp `applyContentMigration`
  // writes is what keeps this from ever running twice.
  createEffect(() => {
    const resume = store.resume;
    if (!resume || isLoading() || loadError() !== null) return;
    if (!needsContentMigration(resume)) return;
    try {
      resumeStore.applyContentMigration(migrateResumeContentToMarkdown(resume));
    } catch (error) {
      // A conversion failure must degrade to showing the legacy content, not
      // take down the editor; the resume stays unstamped so a fixed build
      // retries the migration on the next open.
      console.warn("Legacy content migration failed; keeping original content", error);
    }
  });

  return (
    <div class="h-[calc(100vh-3.5rem)] flex flex-col">
      <CustomCssInjector />

      {/*
        Informational chrome only. It reports what the layout produced; it never
        reflows anything. Pagination is a section-level `metadata.layout`
        decision made elsewhere.
      */}
      <div
        class="h-12 flex items-center justify-end gap-4 border-b border-border bg-paper px-4"
        data-testid="doc-editor-topbar"
      >
        <div class="flex items-center gap-2">
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
          <Button variant="ghost" size="sm" onClick={() => openModal("import")}>
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
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            Import
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openModal("export")}>
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
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Export
          </Button>
          <Button
            variant="ghost"
            size="sm"
            data-testid="doc-editor-theme-button"
            onClick={() => setIsThemeOpen(true)}
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
                d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0
                  01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11
                  7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010
                  2.828l-8.486 8.485M7 17h.01"
              />
            </svg>
            Theme
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
          {/* The mode toggle: a push button whose label is the action it
              performs — "Edit" opens the document for editing, "Done" returns
              to the clean rendered document. Disabled below the miniature
              edit floor (#813) where interaction targets become sub-WCAG. */}
          <Button
            variant="secondary"
            size="sm"
            data-testid="doc-editor-mode-toggle"
            disabled={!sheetInteractive()}
            title={
              sheetInteractive()
                ? undefined
                : "Editing needs a wider viewport — the sheet is shown as a read-only miniature"
            }
            onClick={() => setMode(mode() === "edit" ? "done" : "edit")}
          >
            {mode() === "edit" ? "Done" : "Edit"}
          </Button>
        </div>
      </div>

      <div class="relative flex-1 overflow-hidden">
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
          {/* The one document surface: the sheet, centered. */}
          <div class="h-full overflow-auto bg-surface/30" data-testid="doc-editor-surface">
            <div class="mx-auto w-full max-w-4xl">
              <Show when={store.resume}>
                {(resume) => (
                  <DocSheet
                    resume={resume()}
                    templateLayout={templateLayout()}
                    mode={mode()}
                    onOpenSections={() => setIsSectionsOpen(true)}
                    onScaleChange={(info) => setSheetInteractive(info.interactive)}
                  />
                )}
              </Show>
            </div>
          </div>

          {/* Drawer chrome around the sheet (owner decision 2026-08-04: not
              top-bar items): edge tabs on the resume surface expand/collapse
              the Templates and Sections drawers in place. The drawers overlay
              the surface and never disturb the page frames or their drop
              zones. */}
          <Show when={store.resume}>
            {(resume) => (
              <>
                <SurfaceEdgeTab
                  side="left"
                  label="Templates"
                  testId="doc-editor-templates-tab"
                  expanded={isTemplatesOpen()}
                  onToggle={() => setIsTemplatesOpen(!isTemplatesOpen())}
                />
                <SurfaceEdgeTab
                  side="right"
                  label="Sections"
                  testId="doc-editor-sections-tab"
                  expanded={isSectionsOpen()}
                  onToggle={() => setIsSectionsOpen(!isSectionsOpen())}
                />
                <TemplatesDrawer
                  resume={resume()}
                  open={isTemplatesOpen()}
                  onOpenChange={setIsTemplatesOpen}
                />
                <SectionsPanel
                  resume={resume()}
                  open={isSectionsOpen()}
                  onOpenChange={setIsSectionsOpen}
                />
                <ThemeDialog resume={resume()} open={isThemeOpen()} onOpenChange={setIsThemeOpen} />
              </>
            )}
          </Show>
        </Show>
      </div>

      {/* Modals — loaded on demand. */}
      <Show when={ui.modal === "import"}>
        <Suspense fallback={null}>
          <ImportModal />
        </Suspense>
      </Show>
      <Show when={ui.modal === "export"}>
        <Suspense fallback={null}>
          <ExportModal />
        </Suspense>
      </Show>
      <Show when={ui.modal === "versionHistory"}>
        <Suspense fallback={null}>
          <VersionHistory />
        </Suspense>
      </Show>
    </div>
  );
}

interface SurfaceEdgeTabProps {
  side: "left" | "right";
  label: string;
  testId: string;
  expanded: boolean;
  onToggle: () => void;
}

/**
 * A vertical drawer button riding one edge of the resume surface (owner
 * decision 2026-08-04): clicking it expands its drawer in place; clicking
 * again — or the drawer's own backdrop/Escape — collapses it. Vertical
 * writing keeps the tab narrow, so it never crowds the sheet; the left tab
 * is flipped so both read away from the page.
 */
function SurfaceEdgeTab(props: SurfaceEdgeTabProps) {
  return (
    <button
      type="button"
      data-testid={props.testId}
      aria-haspopup="dialog"
      aria-expanded={props.expanded}
      onClick={() => props.onToggle()}
      class={`focus-ring absolute top-1/2 z-10 -translate-y-1/2 border border-border bg-paper
        px-1.5 py-4 font-mono text-xs uppercase tracking-wider text-stone shadow-sm
        transition-colors hover:bg-surface hover:text-ink [writing-mode:vertical-rl]
        ${
          props.side === "left"
            ? "left-0 rotate-180 rounded-l-lg border-r-0"
            : "right-0 rounded-l-lg border-r-0"
        }`}
    >
      {props.label}
    </button>
  );
}
