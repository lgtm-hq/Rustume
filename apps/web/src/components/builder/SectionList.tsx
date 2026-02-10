import { For, Show } from "solid-js";
import { resumeStore, type SectionKey } from "../../stores/resume";
import { SECTIONS } from "./constants";

export function SectionList() {
  const { store, toggleSectionVisibility } = resumeStore;

  const getItemCount = (key: SectionKey | "summary"): number => {
    if (!store.resume) return 0;
    if (key === "summary") return store.resume.sections.summary.content ? 1 : 0;
    return store.resume.sections[key].items.length;
  };

  const isVisible = (key: SectionKey | "summary"): boolean => {
    if (!store.resume) return false;
    if (key === "summary") return store.resume.sections.summary.visible;
    return store.resume.sections[key].visible;
  };

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
              d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
            />
          </svg>
        </div>
        <div>
          <h2 class="font-display text-lg font-semibold text-ink">Sections</h2>
          <p class="text-sm text-stone">Toggle section visibility</p>
        </div>
      </div>

      {/* Section Toggles */}
      <div class="space-y-1">
        <For each={SECTIONS}>
          {(section) => (
            <div
              class="flex items-center justify-between px-3 py-2.5 rounded-lg
                hover:bg-surface transition-colors cursor-pointer group"
              onClick={() => toggleSectionVisibility(section.key)}
            >
              <div class="flex items-center gap-3">
                <svg
                  class="w-5 h-5 text-stone group-hover:text-ink transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d={section.icon}
                  />
                </svg>
                <span class="font-body text-sm text-ink">{section.name}</span>
                <Show when={getItemCount(section.key) > 0}>
                  <span class="text-xs font-mono text-stone bg-surface px-1.5 py-0.5 rounded">
                    {getItemCount(section.key)}
                  </span>
                </Show>
              </div>

              <div
                role="switch"
                aria-checked={isVisible(section.key)}
                tabIndex={0}
                class={`w-8 h-5 rounded-full transition-colors relative cursor-pointer ${
                  isVisible(section.key) ? "bg-accent" : "bg-border"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSectionVisibility(section.key);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleSectionVisibility(section.key);
                  }
                }}
              >
                <div
                  class={`absolute top-0.5 w-4 h-4 bg-paper rounded-full shadow-sm
                    transition-transform ${
                      isVisible(section.key) ? "translate-x-3.5" : "translate-x-0.5"
                    }`}
                />
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
