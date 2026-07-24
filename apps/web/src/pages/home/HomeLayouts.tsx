import { For, Show } from "solid-js";
import { Button, Input, Spinner } from "../../components/ui";
import { HomeLayout } from "../../lib/homeLayout";
import { getResumeSortLabels, type ResumeSortMode } from "../../lib/resumeSort";
import { HomeLayoutToggle } from "./HomeLayoutToggle";
import { HomeResumeCard } from "./HomeResumeCard";
import type { HomePageModel } from "./useHomePage";

function tagChipClass(active: boolean): string {
  return `inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium border transition-colors ${
    active
      ? "border-accent bg-accent/10 text-ink"
      : "border-border bg-paper text-stone hover:text-ink hover:border-ink/20"
  }`;
}

function TagFilters(props: { home: HomePageModel }) {
  const { home } = props;
  return (
    <Show when={home.allTags().length > 0}>
      <div class="flex w-full flex-wrap items-center gap-1.5" data-testid="resume-tag-filters">
        <span class="text-xs text-stone mr-0.5">Tags</span>
        <button
          type="button"
          class={tagChipClass(home.tagFilter() === null)}
          onClick={() => home.setTagFilter(null)}
        >
          All
        </button>
        <For each={home.allTags()}>
          {(tag) => (
            <button
              type="button"
              class={tagChipClass(home.tagFilter() === tag)}
              onClick={() => home.setTagFilter(home.tagFilter() === tag ? null : tag)}
            >
              {tag}
            </button>
          )}
        </For>
      </div>
    </Show>
  );
}

function LibraryToolbar(props: { home: HomePageModel }) {
  const { home } = props;
  const hasResumes = () => (home.resumes()?.length ?? 0) > 0;

  return (
    <div class="w-full space-y-3" data-testid="home-library-chrome">
      <h2 class="font-display text-xl font-semibold text-ink tracking-tight">Your Resumes</h2>

      <div
        class="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-2"
        role="toolbar"
        aria-label="Resume library tools"
        data-testid="resume-library-toolbar"
        classList={{ "opacity-60 pointer-events-none": home.loading() && hasResumes() }}
      >
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
          <HomeLayoutToggle layout={home.layout()} onChange={home.setLayout} />
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
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border
              bg-paper text-stone hover:text-ink hover:bg-surface transition-colors
              focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
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

function ResumeListBody(props: { home: HomePageModel }) {
  const { home } = props;
  const isGrid = () => home.layout() === HomeLayout.Grid;

  return (
    <Show
      when={home.resumes() !== undefined}
      fallback={
        <div class="flex items-center justify-center py-12">
          <Spinner class="w-6 h-6 text-accent" />
        </div>
      }
    >
      <Show
        when={home.resumes()?.length}
        fallback={
          <div class="text-center py-16 border-2 border-dashed border-border rounded-xl">
            <div class="w-16 h-16 mx-auto bg-surface rounded-2xl flex items-center justify-center mb-4">
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
            <h3 class="font-display text-lg font-semibold text-ink mb-2">No resumes yet</h3>
            <p class="text-stone text-sm mb-6">Create or import your first resume to get started</p>
            <div class="flex flex-wrap items-center justify-center gap-3">
              <Button variant="secondary" onClick={home.handleNew}>
                Create Resume
              </Button>
              <Button variant="ghost" onClick={home.handleImport}>
                Import Resume
              </Button>
            </div>
          </div>
        }
      >
        <Show
          when={home.filteredResumes().length > 0}
          fallback={
            <div
              class="text-center py-16 border-2 border-dashed border-border rounded-xl"
              data-testid="resume-search-empty"
            >
              <h3 class="font-display text-lg font-semibold text-ink mb-2">No matching resumes</h3>
              <p class="text-stone text-sm">
                No resumes match &ldquo;{home.searchQuery().trim()}&rdquo;. Try a different search.
              </p>
            </div>
          }
        >
          <div
            class={
              isGrid()
                ? "grid w-full gap-3.5 stagger-children [grid-template-columns:repeat(auto-fill,minmax(min(100%,16.5rem),1fr))] content-start"
                : "grid w-full gap-2.5 stagger-children"
            }
            data-testid={isGrid() ? "home-resume-grid" : "home-resume-list"}
          >
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

/** Single home page shell — list vs grid only swaps the resume display below search. */
export function HomePageLayout(props: { home: HomePageModel }) {
  const { home } = props;

  return (
    <div class="min-h-[calc(100vh-3.5rem)] bg-paper" data-testid="home-view">
      <div class="pt-8 pb-10 px-4">
        <div class="max-w-4xl mx-auto text-center">
          <h1 class="font-display text-4xl md:text-5xl font-bold text-ink mb-3 animate-slide-up">
            Build your resume
            <br />
            <span class="text-accent">with precision</span>
          </h1>
          <p
            class="text-lg text-stone max-w-xl mx-auto mb-6 animate-slide-up"
            style={{ "animation-delay": "50ms" }}
          >
            Privacy-first, offline-capable resume builder. Your data stays on your device.
          </p>
          <div
            class="flex items-center justify-center gap-4 animate-slide-up"
            style={{ "animation-delay": "100ms" }}
          >
            <Button size="lg" onClick={home.handleNew} data-testid="home-create-resume">
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create New Resume
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={home.handleImport}
              data-testid="home-import-resume"
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
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              Import Resume
            </Button>
          </div>
        </div>
      </div>

      <div class="max-w-4xl mx-auto w-full px-4 pb-16" data-testid="home-library">
        <div class="mb-5 w-full">
          <LibraryToolbar home={home} />
        </div>

        <div class="w-full">
          <ResumeListBody home={home} />
        </div>
      </div>

      <div class="bg-surface border-t border-border py-16 px-4">
        <div class="max-w-4xl mx-auto">
          <h2 class="font-display text-2xl font-semibold text-ink text-center mb-12">
            Why Rustume?
          </h2>

          <div class="grid md:grid-cols-3 gap-8">
            <div class="text-center">
              <div class="w-14 h-14 mx-auto bg-accent/10 rounded-2xl flex items-center justify-center mb-4">
                <svg
                  class="w-7 h-7 text-accent"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h3 class="font-display font-semibold text-ink mb-2">Privacy First</h3>
              <p class="text-sm text-stone">
                Your data stays on your device. No accounts, no tracking.
              </p>
            </div>

            <div class="text-center">
              <div class="w-14 h-14 mx-auto bg-accent/10 rounded-2xl flex items-center justify-center mb-4">
                <svg
                  class="w-7 h-7 text-accent"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3"
                  />
                </svg>
              </div>
              <h3 class="font-display font-semibold text-ink mb-2">Works Offline</h3>
              <p class="text-sm text-stone">
                Edit anywhere. Install as a PWA for the best experience.
              </p>
            </div>

            <div class="text-center">
              <div class="w-14 h-14 mx-auto bg-accent/10 rounded-2xl flex items-center justify-center mb-4">
                <svg
                  class="w-7 h-7 text-accent"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h3 class="font-display font-semibold text-ink mb-2">Lightning Fast</h3>
              <p class="text-sm text-stone">
                Built with Rust and WebAssembly for native performance.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
