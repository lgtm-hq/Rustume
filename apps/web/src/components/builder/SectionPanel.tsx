import { For } from "solid-js";
import { resumeStore, type SectionKey } from "../../stores/resume";
import { uiStore } from "../../stores/ui";

interface SectionInfo {
  key: SectionKey | "summary";
  name: string;
  icon: string;
}

const SECTIONS: SectionInfo[] = [
  { key: "summary", name: "Summary", icon: "M4 6h16M4 12h16M4 18h7" },
  {
    key: "experience",
    name: "Experience",
    icon: "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  },
  {
    key: "education",
    name: "Education",
    icon: "M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z",
  },
  {
    key: "skills",
    name: "Skills",
    icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
  },
  {
    key: "projects",
    name: "Projects",
    icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
  },
  {
    key: "profiles",
    name: "Profiles",
    icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1",
  },
  {
    key: "certifications",
    name: "Certifications",
    icon: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z",
  },
  {
    key: "awards",
    name: "Awards",
    icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
  },
  {
    key: "publications",
    name: "Publications",
    icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  },
  {
    key: "languages",
    name: "Languages",
    icon: "M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129",
  },
  {
    key: "interests",
    name: "Interests",
    icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  },
  {
    key: "volunteer",
    name: "Volunteer",
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  },
  {
    key: "references",
    name: "References",
    icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  },
];

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
    let count = store.resume.sections.summary.visible ? 1 : 0;
    const sectionKeys: SectionKey[] = [
      "experience",
      "education",
      "skills",
      "projects",
      "profiles",
      "certifications",
      "awards",
      "publications",
      "languages",
      "interests",
      "volunteer",
      "references",
    ];
    for (const key of sectionKeys) {
      if (store.resume.sections[key].visible) count++;
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
