import { For, Show } from "solid-js";
import { resumeStore, type LayoutSectionKey } from "../../stores/resume";
import { uiStore } from "../../stores/ui";
import { SECTIONS } from "./constants";

export function SectionPanel() {
  const { store, toggleSectionVisibility, updateCustomSection } = resumeStore;
  const { store: ui, setSectionPanelOpen } = uiStore;
  const coreSections = () => SECTIONS.filter((section) => section.key !== "custom");
  const customSections = () =>
    Object.entries(store.resume?.sections.custom ?? {}).map(([id, section]) => ({
      id,
      name: section.name || "Untitled",
      visible: section.visible,
    }));

  const isVisible = (key: LayoutSectionKey): boolean => {
    if (!store.resume) return false;
    if (key === "summary") return store.resume.sections.summary.visible;
    if (key === "custom") {
      return Object.values(store.resume.sections.custom).some((section) => section.visible);
    }
    return store.resume.sections[key].visible;
  };

  const visibleCount = () => {
    if (!store.resume) return 0;
    let count = 0;
    for (const section of coreSections()) {
      if (isVisible(section.key)) count++;
    }
    count += customSections().filter((section) => section.visible).length;
    return count;
  };

  const PANEL_ID = "section-visibility-panel";
  const PANEL_HEADER_ID = "section-visibility-header";

  const handleFocusOut = (event: FocusEvent) => {
    const nextTarget = event.relatedTarget;
    const currentTarget = event.currentTarget as HTMLDivElement | null;
    if (currentTarget && nextTarget instanceof Node && currentTarget.contains(nextTarget)) return;
    setSectionPanelOpen(false);
  };

  return (
    <div
      class={`absolute bottom-0 right-0 top-12 z-10 transition-[width] duration-200 ease-out ${
        ui.sectionPanelOpen ? "w-[336px]" : "w-28"
      }`}
      data-print-hide
      onMouseEnter={() => setSectionPanelOpen(true)}
      onMouseLeave={() => setSectionPanelOpen(false)}
      onFocusIn={() => setSectionPanelOpen(true)}
      onFocusOut={handleFocusOut}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setSectionPanelOpen(!ui.sectionPanelOpen)}
        class={`absolute top-0 flex h-[58px] w-28 items-center justify-center gap-2 rounded-l-lg
          border-y border-l border-border bg-paper px-3 shadow-sm transition-[right,background-color]
          duration-200 hover:bg-surface ${ui.sectionPanelOpen ? "right-56" : "right-0"}`}
        title={ui.sectionPanelOpen ? "Hide section controls" : "Show section controls"}
        aria-expanded={ui.sectionPanelOpen}
        aria-controls={PANEL_ID}
        aria-label="Section visibility controls"
      >
        <svg
          class={`h-4 w-4 shrink-0 text-stone transition-transform duration-200 ${
            ui.sectionPanelOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 19l-7-7 7-7"
          />
        </svg>
        <span class="text-xs font-medium leading-none text-stone">Sections</span>
        <span class="rounded bg-accent/10 px-1 font-mono text-xs text-accent">
          {visibleCount()}
        </span>
      </button>

      {/* Panel Content */}
      <div
        id={PANEL_ID}
        role="region"
        aria-labelledby={PANEL_HEADER_ID}
        aria-hidden={!ui.sectionPanelOpen}
        class={`absolute bottom-0 right-0 top-0 overflow-hidden border-l border-border bg-paper
          shadow-lg transition-all duration-200 ease-out ${
            ui.sectionPanelOpen ? "w-56 opacity-100" : "w-0 opacity-0"
          }`}
        inert={!ui.sectionPanelOpen ? true : undefined}
      >
        <div class="w-56 h-full flex flex-col">
          {/* Header */}
          <div class="flex h-[58px] flex-col justify-center border-b border-border bg-surface/50 px-3">
            <h3 id={PANEL_HEADER_ID} class="text-sm font-semibold text-ink">
              Section Visibility
            </h3>
            <p class="text-xs text-stone">Toggle sections on/off</p>
          </div>

          {/* Section Toggles */}
          <div class="flex-1 overflow-auto py-1">
            <For each={coreSections()}>
              {(section) => (
                <button
                  class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left
                    transition-colors hover:bg-surface"
                  onClick={() => toggleSectionVisibility(section.key)}
                  aria-pressed={isVisible(section.key)}
                  tabIndex={ui.sectionPanelOpen ? 0 : -1}
                >
                  <div class="flex min-w-0 items-center gap-2">
                    <svg
                      class={`h-4 w-4 flex-shrink-0 transition-colors ${
                        isVisible(section.key) ? "text-accent" : "text-stone/50"
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
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
                    class={`relative h-4 w-8 flex-shrink-0 rounded-full transition-colors ${
                      isVisible(section.key) ? "bg-accent" : "bg-border"
                    }`}
                    aria-hidden="true"
                  >
                    <div
                      class={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-paper shadow-sm
                        transition-transform ${
                          isVisible(section.key) ? "translate-x-4" : "translate-x-0"
                        }`}
                    />
                  </div>
                </button>
              )}
            </For>

            <Show when={customSections().length > 0}>
              <div class="mt-1 border-t border-border/70 pt-1">
                <button
                  class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left
                    transition-colors hover:bg-surface"
                  onClick={() => toggleSectionVisibility("custom")}
                  aria-pressed={isVisible("custom")}
                  tabIndex={ui.sectionPanelOpen ? 0 : -1}
                >
                  <div class="flex min-w-0 items-center gap-2">
                    <svg
                      class={`h-4 w-4 flex-shrink-0 transition-colors ${
                        isVisible("custom") ? "text-accent" : "text-stone/50"
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    <div class="min-w-0">
                      <span
                        class={`block truncate text-sm font-medium transition-colors ${
                          isVisible("custom") ? "text-ink" : "text-stone/70"
                        }`}
                      >
                        Custom
                      </span>
                      <span class="block truncate text-[11px] text-stone">
                        {customSections().length} sections
                      </span>
                    </div>
                  </div>

                  <div
                    class={`relative h-4 w-8 flex-shrink-0 rounded-full transition-colors ${
                      isVisible("custom") ? "bg-accent" : "bg-border"
                    }`}
                    aria-hidden="true"
                  >
                    <div
                      class={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-paper shadow-sm
                        transition-transform ${
                          isVisible("custom") ? "translate-x-4" : "translate-x-0"
                        }`}
                    />
                  </div>
                </button>

                <For each={customSections()}>
                  {(section) => (
                    <button
                      class="flex w-full items-center justify-between gap-3 px-6 py-1.5 text-left
                        transition-colors hover:bg-surface"
                      onClick={() => updateCustomSection(section.id, { visible: !section.visible })}
                      aria-pressed={section.visible}
                      tabIndex={ui.sectionPanelOpen ? 0 : -1}
                    >
                      <div class="flex min-w-0 items-center gap-2">
                        <svg
                          class={`h-4 w-4 flex-shrink-0 transition-colors ${
                            section.visible ? "text-accent" : "text-stone/50"
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="1.5"
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                        <span
                          class={`truncate text-sm transition-colors ${
                            section.visible ? "text-ink" : "text-stone/70"
                          }`}
                        >
                          {section.name}
                        </span>
                      </div>

                      <div
                        class={`relative h-4 w-8 flex-shrink-0 rounded-full transition-colors ${
                          section.visible ? "bg-accent" : "bg-border"
                        }`}
                        aria-hidden="true"
                      >
                        <div
                          class={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-paper shadow-sm
                            transition-transform ${
                              section.visible ? "translate-x-4" : "translate-x-0"
                            }`}
                        />
                      </div>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}
