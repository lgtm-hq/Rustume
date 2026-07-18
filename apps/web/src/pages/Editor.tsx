import { useI18n } from "../i18n";
import { translate } from "../i18n/translate";
import { createMemo, createSignal, lazy, onMount, Show, Suspense } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import { Button, toast, ShortcutsModal, Spinner } from "../components/ui";
import { useHotkeys, type Shortcut } from "../hooks/useHotkeys";
import { useNavigationGuard } from "../hooks/useNavigationGuard";
import { SplitPane } from "../components/layout/SplitPane";
import { Sidebar, type SidebarItem } from "../components/layout/Sidebar";
import {
  BasicsForm,
  SectionPanel,
  ExperienceEditor,
  EducationEditor,
  SkillsEditor,
  ProjectsEditor,
  ProfilesEditor,
  AwardsEditor,
  CertificationsEditor,
  PublicationsEditor,
  LanguagesEditor,
  InterestsEditor,
  VolunteerEditor,
  ReferencesEditor,
  CustomSectionEditor,
  CustomSectionsIndex,
} from "../components/builder";
import { resumeStore, isNotFoundError } from "../stores/resume";
import { uiStore } from "../stores/ui";
import { isWasmReady } from "../wasm";

const Preview = lazy(() =>
  import("../components/preview").then((module) => ({ default: module.Preview })),
);
const LayoutEditor = lazy(() =>
  import("../components/LayoutEditor").then((module) => ({ default: module.LayoutEditor })),
);
const SummaryEditor = lazy(() =>
  import("../components/builder/SummaryEditor").then((module) => ({
    default: module.SummaryEditor,
  })),
);
const ThemeEditor = lazy(() =>
  import("../components/templates/ThemeEditor").then((module) => ({
    default: module.ThemeEditor,
  })),
);
const TemplatePicker = lazy(() =>
  import("../components/templates/TemplatePicker").then((module) => ({
    default: module.TemplatePicker,
  })),
);
const ImportModal = lazy(() =>
  import("../components/import/ImportModal").then((module) => ({ default: module.ImportModal })),
);
const ExportModal = lazy(() =>
  import("../components/export/ExportModal").then((module) => ({ default: module.ExportModal })),
);

function TabFallback() {
  return (
    <div class="flex min-h-[200px] items-center justify-center">
      <Spinner />
    </div>
  );
}

type EditorTab =
  | "basics"
  | "summary"
  | "layout"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "profiles"
  | "awards"
  | "certifications"
  | "publications"
  | "languages"
  | "interests"
  | "volunteer"
  | "references"
  | "custom"
  | `custom:${string}`
  | "theme";

const CUSTOM_ICON = "M12 4v16m8-8H4";

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
    id: "layout",
    label: "Layout",
    icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
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
    id: "profiles",
    label: "Profiles",
    icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1",
  },
  {
    id: "awards",
    label: "Awards",
    icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
  },
  {
    id: "certifications",
    label: "Certs",
    icon: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z",
  },
  {
    id: "publications",
    label: "Pubs",
    icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  },
  {
    id: "languages",
    label: "Langs",
    icon: "M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129",
  },
  {
    id: "interests",
    label: "Interests",
    icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  },
  {
    id: "volunteer",
    label: "Volunteer",
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  },
  {
    id: "references",
    label: "Refs",
    icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  },
  {
    id: "custom",
    label: "Custom",
    icon: CUSTOM_ICON,
  },
  {
    id: "theme",
    label: "Theme",
    icon: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01",
  },
];

const CONTENT_TAB_IDS = new Set([
  "basics",
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "profiles",
  "awards",
  "certifications",
  "publications",
  "languages",
  "interests",
  "volunteer",
  "references",
]);
const SETTINGS_TAB_IDS = new Set(["layout", "theme"]);
const SIDEBAR_GROUP_ORDER = new Map([
  ["Content", 0],
  ["Custom", 1],
  ["Settings", 2],
]);

function withSidebarGroup(item: SidebarItem): SidebarItem {
  if (CONTENT_TAB_IDS.has(item.id)) return { ...item, group: "Content" };
  if (item.id === "custom") return { ...item, group: "Custom" };
  if (SETTINGS_TAB_IDS.has(item.id)) return { ...item, group: "Settings" };
  return item;
}

function sidebarGroupOrder(item: SidebarItem): number {
  return SIDEBAR_GROUP_ORDER.get(item.group ?? "") ?? Number.MAX_SAFE_INTEGER;
}

export default function Editor() {
  const { t } = useI18n();
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { store, loadResume, createNewResume } = resumeStore;
  const { store: ui, openModal, closeModal, setPanel } = uiStore;

  const [activeTab, setActiveTab] = createSignal<EditorTab>("basics");
  const [isLoading, setIsLoading] = createSignal(true);
  const [loadError, setLoadError] = createSignal<string | null>(null);
  const sidebarItems = createMemo<SidebarItem[]>(() =>
    TABS.map(withSidebarGroup)
      .sort((a, b) => sidebarGroupOrder(a) - sidebarGroupOrder(b))
      .map((item) => {
        if (item.id !== "custom") return item;
        const children = Object.entries(store.resume?.sections.custom ?? {}).map(
          ([id, section]) => ({
            id: `custom:${id}`,
            label: section.name || "Untitled",
            icon: CUSTOM_ICON,
          }),
        );
        return { ...item, children };
      }),
  );

  const shortcuts: Shortcut[] = [
    {
      key: "s",
      mod: true,
      handler: () => {
        resumeStore.forceSave();
        toast.success(translate("editor.toasts.saved"));
      },
      label: "Save",
      category: "General",
    },
    {
      key: "p",
      mod: true,
      handler: () => openModal("export"),
      label: "Export PDF",
      category: "General",
    },
    {
      key: "Escape",
      handler: () => {
        if (ui.modal) closeModal();
      },
      label: "Close modal",
      category: "General",
    },
    {
      key: "?",
      shift: true,
      handler: () => openModal("shortcuts"),
      label: "Show shortcuts",
      category: "General",
    },
    {
      key: "1",
      mod: true,
      handler: () => setPanel("editor"),
      label: "Editor panel",
      category: "View",
    },
    {
      key: "2",
      mod: true,
      handler: () => setPanel("both"),
      label: "Split view",
      category: "View",
    },
    {
      key: "3",
      mod: true,
      handler: () => setPanel("preview"),
      label: "Preview panel",
      category: "View",
    },
  ];

  useHotkeys(shortcuts);
  useNavigationGuard(() => store.isDirty);

  async function attemptLoad() {
    if (!params.id) {
      navigate("/");
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    // Wait for WASM if not ready
    let attempts = 0;
    while (!isWasmReady() && attempts < 20) {
      await new Promise((r) => setTimeout(r, 100));
      attempts++;
    }

    try {
      // Try to load existing resume
      await loadResume(params.id);
    } catch (error) {
      if (isNotFoundError(error)) {
        // Resume genuinely does not exist -- safe to create a new one
        try {
          createNewResume(params.id);
          toast.info(translate("editor.toasts.newResume"));
        } catch (createError) {
          console.error("Failed to create new resume:", createError);
          toast.error(translate("editor.toasts.createFailed"));
          navigate("/", { replace: true });
        }
      } else {
        // Non-"not found" error (corruption, transient I/O, deserialization).
        // Do NOT create a new resume -- that would destroy existing data.
        console.error("Failed to load resume:", error);
        const message = error instanceof Error ? error.message : "An unexpected error occurred";
        setLoadError(message);
        toast.error(translate("editor.toasts.loadFailed"));
      }
    } finally {
      setIsLoading(false);
    }
  }

  onMount(attemptLoad);

  const renderTabContent = () => {
    switch (activeTab()) {
      case "basics":
        return <BasicsForm />;
      case "summary":
        return (
          <Suspense fallback={<TabFallback />}>
            <SummaryEditor />
          </Suspense>
        );
      case "layout":
        return (
          <Suspense fallback={<TabFallback />}>
            <LayoutEditor />
          </Suspense>
        );
      case "experience":
        return <ExperienceEditor />;
      case "education":
        return <EducationEditor />;
      case "skills":
        return <SkillsEditor />;
      case "projects":
        return <ProjectsEditor />;
      case "profiles":
        return <ProfilesEditor />;
      case "awards":
        return <AwardsEditor />;
      case "certifications":
        return <CertificationsEditor />;
      case "publications":
        return <PublicationsEditor />;
      case "languages":
        return <LanguagesEditor />;
      case "interests":
        return <InterestsEditor />;
      case "volunteer":
        return <VolunteerEditor />;
      case "references":
        return <ReferencesEditor />;
      case "custom":
        return (
          <CustomSectionsIndex
            onSelectSection={(sectionId) => setActiveTab(`custom:${sectionId}`)}
          />
        );
      case "theme":
        return (
          <Suspense fallback={<TabFallback />}>
            <ThemeEditor />
          </Suspense>
        );
      default:
        if (activeTab().startsWith("custom:")) {
          const sectionId = activeTab().slice("custom:".length);
          return (
            <CustomSectionEditor sectionId={sectionId} onDeleted={() => setActiveTab("custom")} />
          );
        }
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
              {t("editor.panels.editor")}
            </button>
            <button
              class={`px-3 py-1 text-xs font-mono rounded transition-colors
                ${ui.panel === "both" ? "bg-paper shadow-sm text-ink" : "text-stone hover:text-ink"}`}
              onClick={() => setPanel("both")}
            >
              {t("editor.panels.split")}
            </button>
            <button
              class={`px-3 py-1 text-xs font-mono rounded transition-colors
                ${ui.panel === "preview" ? "bg-paper shadow-sm text-ink" : "text-stone hover:text-ink"}`}
              onClick={() => setPanel("preview")}
            >
              {t("templates.preview")}
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
            {t("editor.toolbar.import")}
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
            <Show when={!store.resume}>{t("editor.toolbar.template")}</Show>
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
            {t("editor.toolbar.export")}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div class="flex-1 overflow-hidden">
        <Show
          when={!isLoading() && !loadError() && store.resume}
          fallback={
            <div class="h-full flex items-center justify-center">
              <Show
                when={loadError()}
                fallback={
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
                    <p class="text-stone">{t("editor.loading")}</p>
                  </div>
                }
              >
                {(errorMsg) => (
                  <div class="text-center max-w-md px-4">
                    <svg
                      class="w-12 h-12 text-[var(--turbo-state-danger)] mx-auto mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <h2 class="font-display text-lg font-semibold text-ink mb-2">
                      {t("editor.loadError.title")}
                    </h2>
                    <p class="text-stone text-sm mb-6">{errorMsg()}</p>
                    <div class="flex items-center justify-center gap-3">
                      <Button variant="secondary" onClick={() => attemptLoad()}>
                        {t("common.actions.retry")}
                      </Button>
                      <Button variant="ghost" onClick={() => navigate("/", { replace: true })}>
                        {t("editor.loadError.backHome")}
                      </Button>
                    </div>
                  </div>
                )}
              </Show>
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
                  items={sidebarItems()}
                  activeId={activeTab()}
                  onSelect={(id) => setActiveTab(id as EditorTab)}
                />

                {/* Tab Content */}
                <div class="flex-1 overflow-auto p-6">{renderTabContent()}</div>
              </div>
            }
            right={
              <div class="h-full relative">
                <Suspense fallback={<TabFallback />}>
                  <Preview />
                </Suspense>
                <SectionPanel />
              </div>
            }
          />
        </Show>
      </div>

      {/* Modals — loaded on demand to keep the editor chunk smaller */}
      <Show when={ui.modal === "template"}>
        <Suspense fallback={null}>
          <TemplatePicker />
        </Suspense>
      </Show>
      <Show when={ui.modal === "import"}>
        <Suspense fallback={null}>
          <ImportModal />
        </Suspense>
      </Show>
      <Show when={ui.modal === "export"}>
        <Suspense fallback={null}>
          <ExportModal />
        </Suspense>
      </Show>
      <ShortcutsModal shortcuts={shortcuts} />
    </div>
  );
}
