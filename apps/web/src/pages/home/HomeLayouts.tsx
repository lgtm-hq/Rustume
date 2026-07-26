import { createEffect, For, Show } from "solid-js";
import { Button, Input, Spinner } from "../../components/ui";
import { HomeLayout } from "../../lib/homeLayout";
import { isSameScope, SCOPE_ALL, tagScope } from "../../lib/homeScope";
import { getResumeSortLabels, type ResumeSortMode } from "../../lib/resumeSort";
import { HOME_SIDEBAR_NARROW_QUERY } from "../../lib/homeSidebar";
import { HOME_SIDEBAR_ID } from "../../stores/homeSidebar";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { HomeLayoutToggle } from "./HomeLayoutToggle";
import { HomeSidebar } from "./HomeSidebar";
import { HomeResumeCard } from "./HomeResumeCard";
import { StatusStrip } from "./StatusStrip";
import type { HomePageModel } from "./useHomePage";

function tagChipClass(active: boolean): string {
  return `inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium border transition-colors motion-reduce:transition-none ${
    active
      ? "border-accent bg-accent/10 text-ink"
      : "border-border bg-paper text-stone hover:text-ink hover:border-ink/20"
  }`;
}

const iconButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-paper text-stone hover:text-ink hover:bg-surface transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1";

function TagFilters(props: { home: HomePageModel }) {
  const { home } = props;
  return (
    <Show when={home.allTags().length > 0}>
      <div class="flex w-full flex-wrap items-center gap-1.5" data-testid="resume-tag-filters">
        <span class="text-xs text-stone mr-0.5">Tags</span>
        <button
          type="button"
          class={tagChipClass(home.scope().kind === "all")}
          aria-pressed={home.scope().kind === "all"}
          onClick={() => home.setScope(SCOPE_ALL)}
        >
          All
        </button>
        <For each={home.allTags()}>
          {(tag) => (
            <button
              type="button"
              class={tagChipClass(isSameScope(home.scope(), tagScope(tag)))}
              aria-pressed={isSameScope(home.scope(), tagScope(tag))}
              onClick={() => home.setScope(tagScope(tag))}
            >
              {tag}
            </button>
          )}
        </For>
      </div>
    </Show>
  );
}

/** Toolbar twin of the utility-bar toggle — both drive the one rail. */
function SidebarToggle(props: { home: HomePageModel }) {
  const { home } = props;
  return (
    <button
      type="button"
      class={iconButtonClass}
      aria-label="Toggle sidebar"
      title="Toggle scope sidebar"
      aria-pressed={home.sidebarOpen()}
      aria-expanded={home.sidebarOpen()}
      aria-controls={HOME_SIDEBAR_ID}
      onClick={() => home.toggleSidebar()}
      data-testid="home-sidebar-toggle"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.8"
          d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm5.5-2v16"
        />
      </svg>
    </button>
  );
}

function LibraryToolbar(props: { home: HomePageModel }) {
  const { home } = props;
  const hasResumes = () => (home.resumes()?.length ?? 0) > 0;

  return (
    <div class="w-full space-y-3" data-testid="home-library-chrome">
      <div
        class="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-2"
        role="toolbar"
        aria-label="Resume library tools"
        data-testid="resume-library-toolbar"
        aria-busy={home.loading() && hasResumes()}
        classList={{ "opacity-60 pointer-events-none": home.loading() && hasResumes() }}
      >
        <div class="flex items-center gap-2">
          <Button size="sm" class="h-9" onClick={home.handleNew} data-testid="home-create-resume">
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
                d="M12 5v14M5 12h14"
              />
            </svg>
            New resume
          </Button>
          <Button
            size="sm"
            class="h-9"
            variant="secondary"
            onClick={home.handleImport}
            data-testid="home-import-resume"
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
                d="M12 3v11m-4.5-4.5L12 14l4.5-4.5M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
              />
            </svg>
            Import
          </Button>
        </div>

        <Show when={hasResumes()}>
          <Input
            type="text"
            placeholder="Search by title or name…"
            value={home.searchQuery()}
            onInput={home.setSearchQuery}
            aria-label="Search resumes"
            data-testid="resume-search-input"
            class="w-full min-w-0 max-w-none basis-full grow sm:max-w-sm sm:basis-auto sm:grow-0 sm:min-w-[12rem]"
            inputClass="h-9 py-0"
          />
        </Show>

        <div
          class="ml-auto flex flex-wrap items-center gap-2 shrink-0"
          data-testid="resume-library-tools"
        >
          <SidebarToggle home={home} />
          <label class="inline-flex">
            <span class="sr-only">Sort resumes</span>
            <select
              class="h-9 rounded-lg border border-border bg-paper px-2.5 text-sm font-body text-ink
                focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              value={home.sortMode()}
              onChange={(e) => home.setSortMode(e.currentTarget.value as ResumeSortMode)}
              data-testid="resume-sort-select"
            >
              <For each={getResumeSortLabels()}>
                {(opt) => <option value={opt.value}>{opt.label}</option>}
              </For>
            </select>
          </label>
          <HomeLayoutToggle layout={home.layout()} onChange={home.setLayout} />
          <button
            type="button"
            class={iconButtonClass}
            onClick={home.refresh}
            title="Refresh"
            aria-label="Refresh resume list"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      <Show when={hasResumes()}>
        <TagFilters home={home} />
      </Show>
    </div>
  );
}

function EmptyLibrary(props: { home: HomePageModel }) {
  const { home } = props;
  return (
    <div
      class="rounded-xl border border-dashed border-border bg-surface/40 px-6 py-16 text-center"
      data-testid="home-empty-state"
    >
      <div class="mx-auto mb-5 w-16 h-16 rounded-2xl bg-paper border border-border flex items-center justify-center">
        <svg
          class="w-8 h-8 text-stone"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>
      <h3 class="font-display text-2xl font-semibold text-ink mb-2">Your library is empty</h3>
      {/* Mirror the status strip: promise on-device only when that is actually true. */}
      <p class="mx-auto mb-6 max-w-sm text-sm text-stone">
        Start a resume from scratch or import an existing one —{" "}
        <Show when={home.syncEnabled()} fallback="everything stays on this device.">
          everything syncs to your Rustume Cloud account.
        </Show>
      </p>
      <div class="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={home.handleNew}>Create Resume</Button>
        <Button variant="secondary" onClick={home.handleImport}>
          Import Resume
        </Button>
      </div>
      <p class="mt-6 font-mono text-[10px] uppercase tracking-[0.14em] text-stone/70">
        press ⌘K for commands
      </p>
    </div>
  );
}

function NoSearchMatches(props: { home: HomePageModel }) {
  const { home } = props;
  return (
    <div
      class="rounded-xl border border-dashed border-border bg-surface/40 px-6 py-16 text-center"
      data-testid="resume-search-empty"
    >
      <h3 class="font-display text-2xl font-semibold text-ink mb-2">No matching resumes</h3>
      <p class="mx-auto max-w-sm text-sm text-stone">
        Nothing matches{" "}
        <span class="font-mono text-ink">&ldquo;{home.searchQuery().trim()}&rdquo;</span>
        <Show when={home.scope().kind !== "all"}>
          {" "}
          in <span class="font-mono text-ink">{home.activeScopeLabel()}</span>
        </Show>
        . Try a different search.
      </p>
      <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button
          variant="secondary"
          onClick={() => {
            home.setSearchQuery("");
            home.setScope(SCOPE_ALL);
          }}
        >
          Clear filters
        </Button>
      </div>
    </div>
  );
}

/**
 * A scope with nothing in it and no search to blame.
 *
 * Only reachable since folders can exist while empty — every other scope is
 * derived from resumes and so always has at least one.
 */
function EmptyScope(props: { home: HomePageModel }) {
  const { home } = props;
  return (
    <div
      class="rounded-xl border border-dashed border-border bg-surface/40 px-6 py-16 text-center"
      data-testid="home-empty-scope"
    >
      <h3 class="font-display text-2xl font-semibold text-ink mb-2">Nothing here yet</h3>
      <p class="mx-auto max-w-sm text-sm text-stone">
        No resumes are in <span class="font-mono text-ink">{home.activeScopeLabel()}</span>. Use the
        folder control on a resume to file one here.
      </p>
      <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button variant="secondary" onClick={() => home.setScope(SCOPE_ALL)}>
          Show all resumes
        </Button>
      </div>
    </div>
  );
}

const LAYOUT_CONTAINERS: Record<HomeLayout, { class: string; testId: string }> = {
  [HomeLayout.List]: { class: "grid w-full gap-2.5 stagger-children", testId: "home-resume-list" },
  [HomeLayout.Grid]: {
    class:
      "grid w-full gap-4 stagger-children [grid-template-columns:repeat(auto-fill,minmax(min(100%,16rem),1fr))] content-start",
    testId: "home-resume-grid",
  },
  [HomeLayout.Gallery]: {
    class:
      "grid w-full gap-5 stagger-children [grid-template-columns:repeat(auto-fill,minmax(min(100%,19rem),1fr))] content-start",
    testId: "home-resume-gallery",
  },
};

function ResumeListBody(props: { home: HomePageModel }) {
  const { home } = props;
  const container = () => LAYOUT_CONTAINERS[home.layout()];

  return (
    <Show
      when={home.resumes() !== undefined}
      fallback={
        <div class="flex items-center justify-center py-12">
          <Spinner class="w-6 h-6 text-accent" />
        </div>
      }
    >
      <Show when={home.resumes()?.length} fallback={<EmptyLibrary home={home} />}>
        <Show
          when={home.filteredResumes().length > 0}
          fallback={
            <Show when={home.searchQuery().trim()} fallback={<EmptyScope home={home} />}>
              <NoSearchMatches home={home} />
            </Show>
          }
        >
          <div class={container().class} data-testid={container().testId}>
            <For each={home.filteredResumes()}>
              {({ resume, nameSegments }) => (
                <HomeResumeCard
                  home={home}
                  resume={resume}
                  nameSegments={nameSegments}
                  variant={home.layout()}
                />
              )}
            </For>
          </div>
        </Show>
      </Show>
    </Show>
  );
}

/** Command-center library shell — status strip, dense toolbar, and the active view. */
export function HomePageLayout(props: { home: HomePageModel }) {
  const { home } = props;
  const isNarrow = useMediaQuery(HOME_SIDEBAR_NARROW_QUERY);
  /** Below 900px the rail overlays the library rather than sitting beside it. */
  const isDrawer = () => home.sidebarOpen() && isNarrow();
  let library: HTMLDivElement | undefined = undefined;

  // `inert` is set through the DOM API so it always lands as an attribute,
  // which is what removes the covered subtree from the tab order.
  createEffect(() => {
    library?.toggleAttribute("inert", isDrawer());
  });

  return (
    <div class="min-h-[calc(100vh-3.5rem)] bg-paper" data-testid="home-view">
      {/* At >=900px the rail is a column in this row, so opening it narrows the
          library rather than covering it. Below that it becomes a drawer. */}
      <div class="mx-auto flex w-full max-w-6xl items-stretch">
        <Show when={home.sidebarOpen()}>
          <button
            type="button"
            class="fixed inset-0 z-30 bg-ink/50 motion-safe:animate-fade-in min-[900px]:hidden"
            aria-label="Close scope sidebar"
            onClick={() => home.setSidebarOpen(false)}
            data-testid="home-scope-scrim"
          />
          <HomeSidebar home={home} isDrawer={isDrawer} />
        </Show>

        {/* While the drawer covers the library, keep the covered content out of
            the tab order instead of letting focus wander behind the scrim. */}
        <div
          ref={(el) => (library = el)}
          class="min-w-0 flex-1 px-4 pt-4 pb-16"
          data-testid="home-library"
          aria-hidden={isDrawer() || undefined}
        >
          <StatusStrip home={home} />

          <div class="my-4 w-full">
            <LibraryToolbar home={home} />
          </div>

          <div class="w-full">
            <ResumeListBody home={home} />
          </div>
        </div>
      </div>
    </div>
  );
}
