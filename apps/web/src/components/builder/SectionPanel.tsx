import { For } from "solid-js";
import { resumeStore, type SectionKey } from "../../stores/resume";
import { uiStore } from "../../stores/ui";
import { SECTIONS } from "./constants";

export function SectionPanel() {
  const { store, toggleSectionVisibility } = resumeStore;
  const { store: ui, toggleSectionPanel } = uiStore;

  const isVisible = (key: SectionKey | "summary"): boolean => {
    if (!store.resume) return false;
    if (key === "summary") return store.resume.sections.summary.visible;
    return store.resume.sections[key].visible;
  };

  const visibleCount = () => {
    if (!store.resume) return 0;
    let count = 0;
    for (const section of SECTIONS) {
      if (isVisible(section.key)) count++;
    }
    return count;
  };

  return (
    <div class="absolute right-0 top-0 bottom-0 z-10 flex">
      {/* Toggle Button */}
      <button
        onClick={toggleSectionPanel}
        class="flex items-center gap-1 px-2 py-3 bg-paper border-l border-y border-border
          rounded-l-lg shadow-sm hover:bg-surface transition-colors self-start mt-4"
        title={ui.sectionPanelOpen ? "Hide section controls" : "Show section controls"}
      >
        <svg
          class={`w-4 h-4 text-stone transition-transform duration-200 ${
            ui.sectionPanelOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 19l-7-7 7-7"
          />
        </svg>
        <span
          class="text-xs font-medium text-stone"
          style={{ "writing-mode": "vertical-rl", "text-orientation": "mixed" }}
        >
          Sections
        </span>
        <span class="text-xs font-mono text-accent bg-accent/10 px-1 rounded">
          {visibleCount()}
        </span>
      </button>

      {/* Panel Content */}
      <div
        class={`bg-paper border-l border-border shadow-lg overflow-hidden transition-all duration-200 ease-out ${
          ui.sectionPanelOpen ? "w-56 opacity-100" : "w-0 opacity-0"
        }`}
      >
        <div class="w-56 h-full flex flex-col">
          {/* Header */}
          <div class="px-3 py-2 border-b border-border bg-surface/50">
            <h3 class="text-sm font-semibold text-ink">Section Visibility</h3>
            <p class="text-xs text-stone">Toggle sections on/off</p>
          </div>

          {/* Section Toggles */}
          <div class="flex-1 overflow-auto py-1">
            <For each={SECTIONS}>
              {(section) => (
                <button
                  class="w-full flex items-center justify-between px-3 py-2
                    hover:bg-surface transition-colors text-left"
                  onClick={() => toggleSectionVisibility(section.key)}
                  aria-pressed={isVisible(section.key)}
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <svg
                      class={`w-4 h-4 flex-shrink-0 transition-colors ${
                        isVisible(section.key) ? "text-accent" : "text-stone/50"
                      }`}
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
                    <span
                      class={`text-sm truncate transition-colors ${
                        isVisible(section.key) ? "text-ink" : "text-stone/70"
                      }`}
                    >
                      {section.name}
                    </span>
                  </div>

                  {/* Toggle Switch */}
                  <div
                    class={`w-7 h-4 rounded-full transition-colors relative flex-shrink-0 ${
                      isVisible(section.key) ? "bg-accent" : "bg-border"
                    }`}
                  >
                    <div
                      class={`absolute top-0.5 w-3 h-3 bg-paper rounded-full shadow-sm
                        transition-transform ${
                          isVisible(section.key) ? "translate-x-3.5" : "translate-x-0.5"
                        }`}
                    />
                  </div>
                </button>
              )}
            </For>
          </div>
        </div>
      </div>
    </div>
  );
}
