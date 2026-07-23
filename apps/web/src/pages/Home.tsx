import { For, Show, createEffect, createMemo, createSignal, lazy, Suspense } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { Button, Input, Spinner, toast } from "../components/ui";
import { usePageTitle } from "../hooks/usePageTitle";
import {
  createResumeSearchIndex,
  filterResumes,
  getStoredSearchQuery,
  setStoredSearchQuery,
  type TextSegment,
} from "../lib/resumeSearch";
import {
  getResumeSortLabels,
  getStoredResumeSort,
  setStoredResumeSort,
  sortResumes,
  type ResumeSortMode,
} from "../lib/resumeSort";
import { patchResumeListMeta, useResumeList } from "../stores/persistence";
import { authStore } from "../stores/auth";
import { uiStore } from "../stores/ui";
import { generateId } from "../wasm/types";

const ImportModal = lazy(() =>
  import("../components/import/ImportModal").then((module) => ({ default: module.ImportModal })),
);

function HighlightedText(props: { segments: TextSegment[] }) {
  return (
    <For each={props.segments}>
      {(segment) =>
        segment.highlighted ? (
          <mark class="text-accent bg-accent/10 rounded-sm">{segment.text}</mark>
        ) : (
          <>{segment.text}</>
        )
      }
    </For>
  );
}

/** Format a Date as a human-readable relative or absolute string. */
function formatUpdatedAt(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();

  // Guard against future dates (e.g. clock skew)
  if (diff < 0) return "just now";
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) {
    const mins = Math.floor(diff / 60_000);
    return `${mins}m ago`;
  }
  if (diff < 86_400_000) {
    const hrs = Math.floor(diff / 3_600_000);
    return `${hrs}h ago`;
  }
  if (diff < 604_800_000) {
    const days = Math.floor(diff / 86_400_000);
    return `${days}d ago`;
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function Home() {
  usePageTitle("Your resumes");
  const navigate = useNavigate();
  const { state: authState } = authStore;
  const { openModal } = uiStore;
  const { resumes, loading, deleteResume, duplicateResume, renameResume, refresh } =
    useResumeList();
  const [deletingId, setDeletingId] = createSignal<string | null>(null);
  const [duplicatingId, setDuplicatingId] = createSignal<string | null>(null);
  const [renamingId, setRenamingId] = createSignal<string | null>(null);
  const [renameValue, setRenameValue] = createSignal("");
  const [searchQuery, setSearchQuery] = createSignal(getStoredSearchQuery());
  const [sortMode, setSortMode] = createSignal<ResumeSortMode>(getStoredResumeSort());
  const [tagFilter, setTagFilter] = createSignal<string | null>(null);
  const [tagDrafts, setTagDrafts] = createSignal<Record<string, string>>({});

  createEffect(() => {
    setStoredSearchQuery(searchQuery());
  });

  createEffect(() => {
    setStoredResumeSort(sortMode());
  });

  // Build the Fuse index only when the resume list changes; re-run the search
  // separately as the query changes.
  const searchIndex = createMemo(() => createResumeSearchIndex(resumes() ?? []));
  const filteredResumes = createMemo(() => {
    const searched = filterResumes(searchIndex(), searchQuery());
    const tag = tagFilter();
    const tagged = tag
      ? searched.filter(({ resume }) => (resume.tags ?? []).includes(tag))
      : searched;
    const sortedItems = sortResumes(
      tagged.map((row) => row.resume),
      sortMode(),
    );
    const byId = new Map(tagged.map((row) => [row.resume.id, row]));
    return sortedItems
      .map((resume) => byId.get(resume.id))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  });

  const allTags = createMemo(() => {
    const tags = new Set<string>();
    for (const resume of resumes() ?? []) {
      for (const tag of resume.tags ?? []) tags.add(tag);
    }
    return [...tags].sort((a, b) => a.localeCompare(b));
  });

  const showCloudLocalBanner = () =>
    authState.cloudEnabled && !authState.requireAuth && !authState.loading && !authState.user;

  const handleNew = () => {
    const id = generateId();
    navigate(`/edit/${id}`);
  };

  const handleImport = () => {
    openModal("import");
  };

  const handleToggleLock = async (id: string, currentlyLocked: boolean, event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      await patchResumeListMeta(id, { locked: !currentlyLocked });
      await refresh();
      toast.success(currentlyLocked ? "Resume unlocked" : "Resume locked");
    } catch (e) {
      console.error(e);
      toast.error("Failed to update lock");
    }
  };

  const handleAddTag = async (id: string, existing: string[] | undefined, event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    const draft = (tagDrafts()[id] ?? "").trim();
    if (!draft) return;
    const tags = [...new Set([...(existing ?? []), draft])];
    try {
      await patchResumeListMeta(id, { tags });
      setTagDrafts((prev) => ({ ...prev, [id]: "" }));
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error("Failed to add tag");
    }
  };

  const handleDelete = async (id: string, event: Event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!confirm("Are you sure you want to delete this resume?")) return;

    setDeletingId(id);
    try {
      await deleteResume(id);
      toast.success("Resume deleted");
    } catch (err) {
      console.error("Failed to delete:", err);
      toast.error(err instanceof Error ? err.message : "Failed to delete resume");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDuplicate = async (id: string, event: Event) => {
    event.preventDefault();
    event.stopPropagation();

    setDuplicatingId(id);
    try {
      await duplicateResume(id);
      toast.success("Resume duplicated");
    } catch (err) {
      console.error("Failed to duplicate:", err);
      toast.error(err instanceof Error ? err.message : "Failed to duplicate resume");
    } finally {
      setDuplicatingId(null);
    }
  };

  const startRename = (id: string, currentName: string, event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    setRenamingId(id);
    setRenameValue(currentName);
  };

  const confirmRename = async (id: string) => {
    const trimmed = renameValue().trim();
    if (trimmed) {
      try {
        await renameResume(id, trimmed);
        toast.success("Resume renamed");
      } catch (err) {
        console.error("Failed to rename:", err);
        toast.error(err instanceof Error ? err.message : "Failed to rename resume");
        return;
      }
    }
    setRenamingId(null);
    setRenameValue("");
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
  };

  return (
    <div class="min-h-[calc(100vh-3.5rem)] bg-paper">
      <Show when={showCloudLocalBanner()}>
        <div class="border-b border-border bg-surface/60" data-testid="home-cloud-local-banner">
          <div class="max-w-4xl mx-auto px-4 py-4">
            <p class="text-sm font-medium text-ink">Working locally on this device</p>
            <p class="text-sm text-stone mt-1">
              Use <span class="text-ink">Sign in to sync</span> in the header to sync resumes across
              devices with Rustume Cloud. Local copies stay here until you import them.
            </p>
          </div>
        </div>
      </Show>

      {/* Hero Section */}
      <div class="py-16 px-4">
        <div class="max-w-4xl mx-auto text-center">
          <h1 class="font-display text-4xl md:text-5xl font-bold text-ink mb-4 animate-slide-up">
            Build your resume
            <br />
            <span class="text-accent">with precision</span>
          </h1>
          <p
            class="text-lg text-stone max-w-xl mx-auto mb-8 animate-slide-up"
            style={{ "animation-delay": "50ms" }}
          >
            Privacy-first, offline-capable resume builder. Your data stays on your device.
          </p>
          <div
            class="flex items-center justify-center gap-4 animate-slide-up"
            style={{ "animation-delay": "100ms" }}
          >
            <Button size="lg" onClick={handleNew} data-testid="home-create-resume">
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
              onClick={handleImport}
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

      {/* Resume List */}
      <div class="max-w-4xl mx-auto px-4 pb-16">
        <div class="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 class="font-display text-xl font-semibold text-ink">Your Resumes</h2>
          <div class="flex items-center gap-2">
            <label class="flex items-center gap-2 text-sm text-stone">
              <span class="sr-only">Sort resumes</span>
              <select
                class="rounded-lg border border-border bg-paper px-2 py-1.5 text-sm text-ink"
                value={sortMode()}
                onChange={(e) => setSortMode(e.currentTarget.value as ResumeSortMode)}
                data-testid="resume-sort-select"
              >
                <For each={getResumeSortLabels()}>
                  {(opt) => <option value={opt.value}>{opt.label}</option>}
                </For>
              </select>
            </label>
            <button
              type="button"
              class="p-2 text-stone hover:text-ink hover:bg-surface rounded-lg transition-colors"
              onClick={refresh}
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

        {/* Keep the input mounted during background refreshes so it doesn't
            flicker away and lose focus while a populated list reloads. */}
        <Show when={(resumes()?.length ?? 0) > 0}>
          <div class="mb-6 space-y-3" classList={{ "opacity-60 pointer-events-none": loading() }}>
            <Input
              label="Search resumes"
              type="text"
              placeholder="Search by title or name…"
              value={searchQuery()}
              onInput={setSearchQuery}
              class="max-w-md"
              data-testid="resume-search-input"
            />
            <Show when={allTags().length > 0}>
              <div class="flex flex-wrap items-center gap-2" data-testid="resume-tag-filters">
                <span class="text-xs font-mono uppercase tracking-wider text-stone">Tags</span>
                <button
                  type="button"
                  class={`rounded-full px-2.5 py-1 text-xs border transition-colors ${
                    tagFilter() === null
                      ? "border-accent bg-accent/10 text-ink"
                      : "border-border text-stone hover:text-ink"
                  }`}
                  onClick={() => setTagFilter(null)}
                >
                  All
                </button>
                <For each={allTags()}>
                  {(tag) => (
                    <button
                      type="button"
                      class={`rounded-full px-2.5 py-1 text-xs border transition-colors ${
                        tagFilter() === tag
                          ? "border-accent bg-accent/10 text-ink"
                          : "border-border text-stone hover:text-ink"
                      }`}
                      onClick={() => setTagFilter(tagFilter() === tag ? null : tag)}
                    >
                      {tag}
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Show>

        <Show
          when={!loading()}
          fallback={
            <div class="flex items-center justify-center py-12">
              <Spinner class="w-6 h-6 text-accent" />
            </div>
          }
        >
          <Show
            when={resumes()?.length}
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
                  <Button variant="secondary" onClick={handleNew}>
                    Create Resume
                  </Button>
                  <Button variant="ghost" onClick={handleImport}>
                    Import Resume
                  </Button>
                </div>
              </div>
            }
          >
            <Show
              when={filteredResumes().length > 0}
              fallback={
                <div
                  class="text-center py-16 border-2 border-dashed border-border rounded-xl"
                  data-testid="resume-search-empty"
                >
                  <h3 class="font-display text-lg font-semibold text-ink mb-2">
                    No matching resumes
                  </h3>
                  <p class="text-stone text-sm">
                    No resumes match &ldquo;{searchQuery().trim()}&rdquo;. Try a different search.
                  </p>
                </div>
              }
            >
              <div class="grid gap-4 stagger-children">
                <For each={filteredResumes()}>
                  {({ resume, nameSegments }) => (
                    <div
                      class="group flex items-center justify-between p-4 border border-border
                      rounded-xl hover:border-accent hover:shadow-card transition-all bg-paper"
                    >
                      <Show
                        when={renamingId() !== resume.id}
                        fallback={
                          <div class="flex items-center gap-4 flex-1 min-w-0">
                            <div class="w-12 h-12 bg-surface rounded-lg flex items-center justify-center flex-shrink-0">
                              <svg
                                class="w-6 h-6 text-stone"
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
                            <div class="min-w-0 flex items-center gap-2">
                              <input
                                type="text"
                                class="font-body font-medium text-ink bg-surface border border-border
                                rounded px-2 py-0.5 text-sm focus:outline-none focus:border-accent w-48"
                                aria-label="Rename resume"
                                value={renameValue()}
                                onInput={(e) => setRenameValue(e.currentTarget.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") confirmRename(resume.id);
                                  if (e.key === "Escape") cancelRename();
                                }}
                                ref={(el) => setTimeout(() => el?.focus(), 0)}
                                data-testid="rename-input"
                              />
                              <button
                                type="button"
                                class="p-1 text-accent hover:text-accent/80 transition-colors"
                                onClick={() => confirmRename(resume.id)}
                                title="Confirm rename"
                                aria-label="Confirm rename"
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
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              </button>
                              <button
                                type="button"
                                class="p-1 text-stone hover:text-ink transition-colors"
                                onClick={() => cancelRename()}
                                title="Cancel rename"
                                aria-label="Cancel rename"
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
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              </button>
                            </div>
                          </div>
                        }
                      >
                        <A
                          href={`/edit/${resume.id}`}
                          class="flex items-center gap-4 flex-1 min-w-0"
                        >
                          <div class="w-12 h-12 bg-surface rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg
                              class="w-6 h-6 text-stone group-hover:text-accent transition-colors"
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
                          <div class="min-w-0">
                            <h3 class="font-body font-medium text-ink group-hover:text-accent transition-colors truncate flex items-center gap-2">
                              <HighlightedText segments={nameSegments} />
                              <Show when={resume.locked}>
                                <span
                                  class="inline-flex items-center rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-mono uppercase text-stone border border-border"
                                  title="Locked"
                                >
                                  Locked
                                </span>
                              </Show>
                            </h3>
                            <Show when={resume.headline?.trim()}>
                              {(headline) => (
                                <p
                                  class="text-sm text-accent/65 truncate"
                                  data-testid="resume-list-headline"
                                >
                                  {headline()}
                                </p>
                              )}
                            </Show>
                            <p class="text-xs text-stone">
                              Updated {formatUpdatedAt(resume.updatedAt)}
                            </p>
                            <Show when={(resume.tags ?? []).length > 0}>
                              <div class="mt-1 flex flex-wrap gap-1">
                                <For each={resume.tags ?? []}>
                                  {(tag) => (
                                    <span class="rounded-full border border-border px-2 py-0.5 text-[10px] text-stone">
                                      {tag}
                                    </span>
                                  )}
                                </For>
                              </div>
                            </Show>
                          </div>
                        </A>
                      </Show>

                      <div class="flex items-center gap-2 flex-shrink-0">
                        <form
                          class="hidden sm:flex items-center gap-1"
                          onSubmit={(e) => handleAddTag(resume.id, resume.tags, e)}
                        >
                          <input
                            type="text"
                            class="w-24 rounded border border-border bg-paper px-1.5 py-1 text-xs text-ink"
                            placeholder="Add tag"
                            aria-label={`Add tag to ${resume.name}`}
                            value={tagDrafts()[resume.id] ?? ""}
                            onInput={(e) =>
                              setTagDrafts((prev) => ({
                                ...prev,
                                [resume.id]: e.currentTarget.value,
                              }))
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                        </form>
                        <button
                          type="button"
                          class="p-2 text-stone hover:text-accent hover:bg-accent/10 rounded-lg transition-colors
                          disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={(e) => handleToggleLock(resume.id, Boolean(resume.locked), e)}
                          title={resume.locked ? "Unlock" : "Lock"}
                          aria-label={resume.locked ? "Unlock resume" : "Lock resume"}
                        >
                          <svg
                            class="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <Show
                              when={resume.locked}
                              fallback={
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2"
                                  d="M8 11V7a4 4 0 118 0v4m-9 0h10v8H7v-8z"
                                />
                              }
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M12 15v2m-6-6V9a6 6 0 1112 0v2M6 11h12v8H6v-8z"
                              />
                            </Show>
                          </svg>
                        </button>
                        <button
                          type="button"
                          class="p-2 text-stone hover:text-accent hover:bg-accent/10 rounded-lg transition-colors
                          disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={(e) => startRename(resume.id, resume.name, e)}
                          disabled={
                            Boolean(resume.locked) ||
                            deletingId() !== null ||
                            duplicatingId() !== null ||
                            renamingId() !== null
                          }
                          title="Rename"
                          aria-label="Rename resume"
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
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>

                        <button
                          type="button"
                          class="p-2 text-stone hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors
                          disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={(e) => handleDelete(resume.id, e)}
                          disabled={
                            Boolean(resume.locked) ||
                            deletingId() !== null ||
                            duplicatingId() !== null ||
                            renamingId() !== null
                          }
                          title={resume.locked ? "Unlock to delete" : "Delete"}
                          aria-label="Delete resume"
                        >
                          <Show
                            when={deletingId() !== resume.id}
                            fallback={<Spinner class="w-5 h-5" />}
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
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </Show>
                        </button>

                        <button
                          type="button"
                          class="p-2 text-stone hover:text-accent hover:bg-accent/10 rounded-lg transition-colors
                          disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={(e) => handleDuplicate(resume.id, e)}
                          disabled={
                            duplicatingId() !== null ||
                            deletingId() !== null ||
                            renamingId() !== null
                          }
                          title="Duplicate"
                          aria-label="Duplicate resume"
                        >
                          <Show
                            when={duplicatingId() !== resume.id}
                            fallback={<Spinner class="w-5 h-5" />}
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
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                          </Show>
                        </button>

                        <A
                          href={`/edit/${resume.id}`}
                          class="p-1"
                          aria-label={`Edit ${resume.name}`}
                        >
                          <svg
                            class="w-5 h-5 text-stone group-hover:text-accent transition-colors"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </A>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </Show>
      </div>

      {/* Features */}
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

      <Suspense fallback={null}>
        <ImportModal createAndOpen />
      </Suspense>
    </div>
  );
}
