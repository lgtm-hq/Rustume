import { createSignal, onMount, Show } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import { Button } from "../components/ui";
import { SplitPane } from "../components/layout/SplitPane";
import { Sidebar, type SidebarItem } from "../components/layout/Sidebar";
import {
  BasicsForm,
  SummaryEditor,
  SectionList,
  SectionPanel,
  ExperienceEditor,
  EducationEditor,
  SkillsEditor,
  ProjectsEditor,
} from "../components/builder";
import { Preview } from "../components/preview";
import { TemplatePicker, ThemeEditor } from "../components/templates";
import { ImportModal } from "../components/import";
import { ExportModal } from "../components/export";
import { resumeStore } from "../stores/resume";
import { uiStore } from "../stores/ui";
import { isWasmReady } from "../wasm";

type EditorTab =
  | "basics"
  | "summary"
  | "sections"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "theme";

const TABS: SidebarItem[] = [
  {
    id: "basics",
    label: "Basics",
    icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  },
  {
    id: "summary",
    label: "Summary",
    icon: "M4 6h16M4 12h16M4 18h7",
  },
  {
    id: "sections",
    label: "Sections",
    icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z",
  },
  {
    id: "experience",
    label: "Experience",
    icon: "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  },
  {
    id: "education",
    label: "Education",
    icon: "M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z",
  },
  {
    id: "skills",
    label: "Skills",
    icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
  },
  {
    id: "projects",
    label: "Projects",
    icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
  },
  {
    id: "theme",
    label: "Theme",
    icon: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01",
  },
];

export default function Editor() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { store, loadResume, createNewResume } = resumeStore;
  const { store: ui, openModal, setPanel } = uiStore;

  const [activeTab, setActiveTab] = createSignal<EditorTab>("basics");
  const [isLoading, setIsLoading] = createSignal(true);

  onMount(async () => {
    if (!params.id) {
      navigate("/");
      return;
    }

    // Wait for WASM if not ready
    let attempts = 0;
    while (!isWasmReady() && attempts < 20) {
      await new Promise((r) => setTimeout(r, 100));
      attempts++;
    }

    try {
      // Try to load existing resume
      await loadResume(params.id);
    } catch {
      // Create new if not found
      createNewResume(params.id);
    }

    setIsLoading(false);
  });

  const renderTabContent = () => {
    switch (activeTab()) {
      case "basics":
        return <BasicsForm />;
      case "summary":
        return <SummaryEditor />;
      case "sections":
        return <SectionList />;
      case "experience":
        return <ExperienceEditor />;
      case "education":
        return <EducationEditor />;
      case "skills":
        return <SkillsEditor />;
      case "projects":
        return <ProjectsEditor />;
      case "theme":
        return <ThemeEditor />;
      default:
        return null;
    }
  };

  return (
    <div class="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Toolbar */}
      <div class="h-12 border-b border-border bg-paper flex items-center justify-between px-4">
        <div class="flex items-center gap-2">
          {/* Panel Toggle */}
          <div class="flex items-center bg-surface rounded-lg p-0.5">
            <button
              class={`px-3 py-1 text-xs font-mono rounded transition-colors
                ${ui.panel === "editor" ? "bg-paper shadow-sm text-ink" : "text-stone hover:text-ink"}`}
              onClick={() => setPanel("editor")}
            >
              Editor
            </button>
            <button
              class={`px-3 py-1 text-xs font-mono rounded transition-colors
                ${ui.panel === "both" ? "bg-paper shadow-sm text-ink" : "text-stone hover:text-ink"}`}
              onClick={() => setPanel("both")}
            >
              Split
            </button>
            <button
              class={`px-3 py-1 text-xs font-mono rounded transition-colors
                ${ui.panel === "preview" ? "bg-paper shadow-sm text-ink" : "text-stone hover:text-ink"}`}
              onClick={() => setPanel("preview")}
            >
              Preview
            </button>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => openModal("import")}>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            Import
          </Button>

          {/* Template Button with Current Selection Indicator */}
          <Button variant="ghost" size="sm" onClick={() => openModal("template")} class="gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
              />
            </svg>
            <Show when={store.resume}>
              {(resume) => (
                <span class="flex items-center gap-1.5">
                  <span class="capitalize">{resume().metadata.template}</span>
                  <span class="flex gap-0.5">
                    <span
                      class="w-2.5 h-2.5 rounded-full border border-border/30"
                      style={{ background: resume().metadata.theme.primary }}
                    />
                    <span
                      class="w-2.5 h-2.5 rounded-full border border-border/30"
                      style={{ background: resume().metadata.theme.text }}
                    />
                  </span>
                </span>
              )}
            </Show>
            <Show when={!store.resume}>Template</Show>
          </Button>

          <Button size="sm" onClick={() => openModal("export")}>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Export
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div class="flex-1 overflow-hidden">
        <Show
          when={!isLoading() && store.resume}
          fallback={
            <div class="h-full flex items-center justify-center">
              <div class="text-center">
                <svg class="w-8 h-8 animate-spin text-accent mx-auto mb-4" viewBox="0 0 24 24">
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                    fill="none"
                  />
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                <p class="text-stone">Loading resume...</p>
              </div>
            </div>
          }
        >
          <SplitPane
            showLeft={ui.panel !== "preview"}
            showRight={ui.panel !== "editor"}
            defaultRatio={0.45}
            left={
              <div class="h-full flex">
                {/* Sidebar Navigation */}
                <Sidebar
                  items={TABS}
                  activeId={activeTab()}
                  onSelect={(id) => setActiveTab(id as EditorTab)}
                />

                {/* Tab Content */}
                <div class="flex-1 overflow-auto p-6">{renderTabContent()}</div>
              </div>
            }
            right={
              <div class="h-full relative">
                <Preview />
                <SectionPanel />
              </div>
            }
          />
        </Show>
      </div>

      {/* Modals */}
      <TemplatePicker />
      <ImportModal />
      <ExportModal />
    </div>
  );
}
