import { For, Show, createSignal } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { Button, Spinner, toast } from "../components/ui";
import { useResumeList } from "../stores/persistence";
import { generateId } from "../wasm/types";

/** Format a Date as a human-readable relative or absolute string. */
function formatUpdatedAt(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();

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
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function Home() {
  const navigate = useNavigate();
  const { resumes, loading, deleteResume, duplicateResume, renameResume, refresh } =
    useResumeList();
  const [deletingId, setDeletingId] = createSignal<string | null>(null);
  const [duplicatingId, setDuplicatingId] = createSignal<string | null>(null);
  const [renamingId, setRenamingId] = createSignal<string | null>(null);
  const [renameValue, setRenameValue] = createSignal("");

  const handleNew = () => {
    const id = generateId();
    navigate(`/edit/${id}`);
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
            <Button size="lg" onClick={handleNew}>
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
          </div>
        </div>
      </div>

      {/* Resume List */}
      <div class="max-w-4xl mx-auto px-4 pb-16">
        <div class="flex items-center justify-between mb-6">
          <h2 class="font-display text-xl font-semibold text-ink">Your Resumes</h2>
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
                <p class="text-stone text-sm mb-6">Create your first resume to get started</p>
                <Button variant="secondary" onClick={handleNew}>
                  Create Resume
                </Button>
              </div>
            }
          >
            <div class="grid gap-4 stagger-children">
              <For each={resumes()}>
                {(resume) => (
                  <div
                    class="group flex items-center justify-between p-4 border border-border
                      rounded-xl hover:border-accent hover:shadow-card transition-all bg-paper"
                  >
                    <A href={`/edit/${resume.id}`} class="flex items-center gap-4 flex-1 min-w-0">
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
                        <Show
                          when={renamingId() !== resume.id}
                          fallback={
                            <div
                              class="flex items-center gap-2"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                            >
                              <input
                                type="text"
                                class="font-body font-medium text-ink bg-surface border border-border
                                  rounded px-2 py-0.5 text-sm focus:outline-none focus:border-accent w-48"
                                value={renameValue()}
                                onInput={(e) => setRenameValue(e.currentTarget.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") confirmRename(resume.id);
                                  if (e.key === "Escape") cancelRename();
                                }}
                                ref={(el) => setTimeout(() => el.focus(), 0)}
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
                          }
                        >
                          <h3 class="font-body font-medium text-ink group-hover:text-accent transition-colors truncate">
                            {resume.name}
                          </h3>
                          <p class="text-sm text-stone">
                            Updated {formatUpdatedAt(resume.updatedAt)}
                          </p>
                        </Show>
                      </div>
                    </A>

                    <div class="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        class="p-2 text-stone hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                        onClick={(e) => startRename(resume.id, resume.name, e)}
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
                        disabled={deletingId() !== null || duplicatingId() !== null}
                        title="Delete"
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
                        disabled={duplicatingId() !== null || deletingId() !== null}
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

                      <A href={`/edit/${resume.id}`} class="p-1" aria-label={`Edit ${resume.name}`}>
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
    </div>
  );
}
