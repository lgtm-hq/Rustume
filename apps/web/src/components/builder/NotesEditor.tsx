import { Show } from "solid-js";
import { LazyRichTextEditor as RichTextEditor } from "../ui/LazyRichTextEditor";
import { resumeStore } from "../../stores/resume";

export function NotesEditor() {
  const { store, updateMetadata } = resumeStore;

  return (
    <div class="space-y-4">
      <div class="flex items-center gap-3 pb-4 border-b border-border">
        <div class="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
          <svg
            class="w-5 h-5 text-accent"
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
        </div>
        <div>
          <h2 class="font-display text-lg font-semibold text-ink">Private notes</h2>
          <p class="text-sm text-stone">Never appear on the resume or exported PDF</p>
        </div>
      </div>

      <div
        role="note"
        class="rounded-lg border border-border bg-surface/60 px-3 py-2 text-sm text-stone"
      >
        Use this space for job links, interview prep, application status, or recruiter contacts.
        Notes stay private to this resume.
      </div>

      <Show when={store.resume}>
        {(resume) => (
          <RichTextEditor
            label="Notes"
            placeholder="Job posting URL, interview notes, status…"
            value={resume().metadata.notes || ""}
            onInput={(html) => updateMetadata("notes", html)}
          />
        )}
      </Show>
    </div>
  );
}
