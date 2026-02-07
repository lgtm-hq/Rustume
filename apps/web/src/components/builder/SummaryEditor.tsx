import { Show } from "solid-js";
import { TextArea } from "../ui";
import { resumeStore } from "../../stores/resume";

export function SummaryEditor() {
  const { store, updateSummary } = resumeStore;

  return (
    <div class="space-y-4">
      {/* Header */}
      <div class="flex items-center gap-3 pb-4 border-b border-border">
        <div class="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
          <svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h7"
            />
          </svg>
        </div>
        <div>
          <h2 class="font-display text-lg font-semibold text-ink">Summary</h2>
          <p class="text-sm text-stone">A brief overview of your background</p>
        </div>
      </div>

      <Show when={store.resume}>
        {(resume) => (
          <TextArea
            placeholder="Write a compelling summary that highlights your key strengths, experience, and what you're looking for in your next role..."
            value={resume().sections.summary.content}
            onInput={updateSummary}
            rows={6}
          />
        )}
      </Show>

      <p class="text-xs text-stone">
        Tip: Keep it concise (2-4 sentences). Focus on your unique value proposition.
      </p>
    </div>
  );
}
