import { createStore, produce, type SetStoreFunction } from "solid-js/store";
import { createSignal, createEffect, batch } from "solid-js";
import type {
  ResumeData,
  Basics,
  Sections,
  Metadata,
  Experience,
  Education,
  Skill,
  Project,
  Profile,
  Award,
  Certification,
  Publication,
  Language,
  Interest,
  Volunteer,
  Reference,
  CustomItem,
  Section,
} from "../wasm/types";
import {
  createEmptyResume,
  saveResume as saveToWasmStorage,
  getResume as getFromWasmStorage,
  isWasmReady,
} from "../wasm";

/**
 * Check if a resume is effectively empty (no meaningful content).
 * Used to determine whether to show sample data in preview.
 */
export function isResumeEmpty(resume: ResumeData): boolean {
  // Check if basics has any meaningful content
  const basics = resume.basics;
  const hasBasics =
    basics.name.trim() !== "" ||
    basics.email.trim() !== "" ||
    basics.headline.trim() !== "";

  if (hasBasics) return false;

  // Check if summary has content
  if (resume.sections.summary.visible && resume.sections.summary.content.trim() !== "") {
    return false;
  }

  // Check if any visible section has items
  const sectionKeys: (keyof Omit<Sections, "summary" | "custom">)[] = [
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
  ];

  for (const key of sectionKeys) {
    const section = resume.sections[key];
    if (section.visible && section.items.length > 0) {
      return false;
    }
  }

  return true;
}

// Fallback localStorage storage when WASM is not available
const STORAGE_KEY_PREFIX = "rustume:";

function saveToLocalStorage(id: string, data: ResumeData): void {
  localStorage.setItem(STORAGE_KEY_PREFIX + id, JSON.stringify(data));
  // Also update the list of resume IDs
  const ids = JSON.parse(localStorage.getItem(STORAGE_KEY_PREFIX + "_ids") || "[]") as string[];
  if (!ids.includes(id)) {
    ids.push(id);
    localStorage.setItem(STORAGE_KEY_PREFIX + "_ids", JSON.stringify(ids));
  }
}

function getFromLocalStorage(id: string): ResumeData | null {
  const data = localStorage.getItem(STORAGE_KEY_PREFIX + id);
  if (!data) return null;
  return JSON.parse(data) as ResumeData;
}

async function saveResume(id: string, data: ResumeData): Promise<void> {
  if (isWasmReady()) {
    return saveToWasmStorage(id, data);
  }
  saveToLocalStorage(id, data);
}

async function getResume(id: string): Promise<ResumeData> {
  if (isWasmReady()) {
    return getFromWasmStorage(id);
  }
  const data = getFromLocalStorage(id);
  if (!data) {
    throw new Error("Resume not found");
  }
  return data;
}

export type SectionKey = keyof Omit<Sections, "summary" | "custom">;

export interface ResumeStore {
  resume: ResumeData | null;
  id: string | null;
  isDirty: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  error: string | null;
}

const [store, setStore] = createStore<ResumeStore>({
  resume: null,
  id: null,
  isDirty: false,
  isSaving: false,
  lastSaved: null,
  error: null,
});

// Auto-save debounce timer
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const SAVE_DELAY = 1000;

async function persistResume() {
  if (!store.resume || !store.id) return;

  setStore("isSaving", true);
  setStore("error", null);

  try {
    await saveResume(store.id, store.resume);
    batch(() => {
      setStore("isDirty", false);
      setStore("lastSaved", new Date());
      setStore("isSaving", false);
    });
  } catch (e) {
    setStore("error", e instanceof Error ? e.message : "Failed to save");
    setStore("isSaving", false);
  }
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(persistResume, SAVE_DELAY);
}

// Mark as dirty and schedule save
function markDirty() {
  setStore("isDirty", true);
  scheduleSave();
}

// Public API
export function useResumeStore() {
  return {
    store,

    async loadResume(id: string) {
      try {
        const resume = await getResume(id);
        batch(() => {
          setStore("resume", resume);
          setStore("id", id);
          setStore("isDirty", false);
          setStore("error", null);
        });
      } catch (e) {
        setStore("error", e instanceof Error ? e.message : "Failed to load");
        throw e; // Re-throw so caller can handle (e.g., create new resume)
      }
    },

    createNewResume(id: string) {
      const resume = createEmptyResume();
      batch(() => {
        setStore("resume", resume);
        setStore("id", id);
        setStore("isDirty", true);
        setStore("error", null);
      });
      scheduleSave();
    },

    // Basics updates
    updateBasics<K extends keyof Basics>(field: K, value: Basics[K]) {
      setStore(
        produce((s) => {
          if (s.resume) {
            s.resume.basics[field] = value;
          }
        })
      );
      markDirty();
    },

    // Summary update
    updateSummary(content: string) {
      setStore(
        produce((s) => {
          if (s.resume) {
            s.resume.sections.summary.content = content;
          }
        })
      );
      markDirty();
    },

    // Section visibility
    toggleSectionVisibility(sectionKey: SectionKey | "summary") {
      setStore(
        produce((s) => {
          if (s.resume) {
            if (sectionKey === "summary") {
              s.resume.sections.summary.visible =
                !s.resume.sections.summary.visible;
            } else {
              s.resume.sections[sectionKey].visible =
                !s.resume.sections[sectionKey].visible;
            }
          }
        })
      );
      markDirty();
    },

    // Generic section item operations
    addSectionItem<K extends SectionKey>(
      sectionKey: K,
      item: Sections[K]["items"][number]
    ) {
      setStore(
        produce((s) => {
          if (s.resume) {
            (s.resume.sections[sectionKey] as Section<unknown>).items.push(
              item
            );
          }
        })
      );
      markDirty();
    },

    updateSectionItem<K extends SectionKey>(
      sectionKey: K,
      index: number,
      updates: Partial<Sections[K]["items"][number]>
    ) {
      setStore(
        produce((s) => {
          if (s.resume) {
            const section = s.resume.sections[sectionKey] as Section<Record<string, unknown>>;
            if (section.items[index]) {
              Object.assign(section.items[index], updates);
            }
          }
        })
      );
      markDirty();
    },

    removeSectionItem<K extends SectionKey>(sectionKey: K, index: number) {
      setStore(
        produce((s) => {
          if (s.resume) {
            (s.resume.sections[sectionKey] as Section<unknown>).items.splice(
              index,
              1
            );
          }
        })
      );
      markDirty();
    },

    reorderSectionItem<K extends SectionKey>(
      sectionKey: K,
      fromIndex: number,
      toIndex: number
    ) {
      setStore(
        produce((s) => {
          if (s.resume) {
            const section = s.resume.sections[sectionKey] as Section<unknown>;
            const [item] = section.items.splice(fromIndex, 1);
            section.items.splice(toIndex, 0, item);
          }
        })
      );
      markDirty();
    },

    // Metadata updates
    updateMetadata<K extends keyof Metadata>(field: K, value: Metadata[K]) {
      setStore(
        produce((s) => {
          if (s.resume) {
            s.resume.metadata[field] = value;
          }
        })
      );
      markDirty();
    },

    updateTemplate(template: string) {
      setStore(
        produce((s) => {
          if (s.resume) {
            s.resume.metadata.template = template;
          }
        })
      );
      markDirty();
    },

    updateTheme(theme: Partial<Metadata["theme"]>) {
      setStore(
        produce((s) => {
          if (s.resume) {
            Object.assign(s.resume.metadata.theme, theme);
          }
        })
      );
      markDirty();
    },

    // Import resume data
    importResume(data: ResumeData) {
      batch(() => {
        setStore("resume", data);
        setStore("isDirty", true);
        setStore("error", null);
      });
      scheduleSave();
    },

    // Force save
    async forceSave() {
      if (saveTimer) clearTimeout(saveTimer);
      await persistResume();
    },
  };
}

// Singleton for use outside components
export const resumeStore = useResumeStore();
