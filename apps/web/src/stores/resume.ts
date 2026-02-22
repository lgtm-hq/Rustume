import { createStore, produce } from "solid-js/store";
import { batch } from "solid-js";
import { toast } from "../components/ui";
import type { ResumeData, Basics, Sections, Metadata, Section } from "../wasm/types";
import {
  createEmptyResume,
  createEmptyPicture,
  saveResume as saveToWasmStorage,
  getResume as getFromWasmStorage,
  isWasmReady,
} from "../wasm";
import { getResumeMeta, setResumeMeta } from "./persistence";

/** Thrown when the requested resume does not exist in storage. */
export class ResumeNotFoundError extends Error {
  constructor(id: string) {
    super(`Resume not found: ${id}`);
    this.name = "ResumeNotFoundError";
  }
}

/** Thrown when stored resume data is corrupted or cannot be deserialized. */
export class ResumeCorruptedError extends Error {
  constructor(id: string, cause?: unknown) {
    super(`Resume data is corrupted: ${id}`);
    this.name = "ResumeCorruptedError";
    this.cause = cause;
  }
}

/**
 * Validates that parsed JSON has the required top-level structure of a resume
 * (`basics`, `sections`, and `metadata` must be non-null objects).
 * Throws `ResumeCorruptedError` if the structure is invalid.
 */
export function validateResumeData(parsed: unknown, id: string): ResumeData {
  const record = parsed as Record<string, unknown>;
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof record.basics !== "object" ||
    record.basics === null ||
    typeof record.sections !== "object" ||
    record.sections === null ||
    typeof record.metadata !== "object" ||
    record.metadata === null
  ) {
    throw new ResumeCorruptedError(id);
  }
  return parsed as ResumeData;
}

/** Returns true when an error indicates the resume simply does not exist. */
export function isNotFoundError(error: unknown): boolean {
  if (error instanceof ResumeNotFoundError) return true;
  if (error instanceof ResumeCorruptedError) return false;
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes("not found") || msg.includes("notfound") || msg.includes("404");
  }
  // WASM rejects with plain strings (JsValue::from_str), not Error objects.
  if (typeof error === "string") {
    const msg = error.toLowerCase();
    return msg.includes("not found") || msg.includes("notfound") || msg.includes("404");
  }
  return false;
}

/** Check if an HTML string is effectively empty (plain empty or TipTap empty editor). */
export function isHtmlEmpty(html: string): boolean {
  const trimmed = html.trim();
  if (trimmed === "") return true;
  // Normalize common HTML whitespace entities to regular spaces.
  const normalized = trimmed.replace(/&nbsp;|&#160;|&#xa0;|&ensp;|&#8194;|&emsp;|&#8195;/gi, " ");
  // Strip all HTML tags and check if any visible text remains.
  const textContent = normalized.replace(/<[^>]*>/g, "").trim();
  return textContent === "";
}

/**
 * Check if a resume is effectively empty (no meaningful content).
 * Used to determine whether to show sample data in preview.
 */
export function isResumeEmpty(resume: ResumeData): boolean {
  // Check if basics has any meaningful content
  const basics = resume.basics;
  const hasBasics =
    basics.name.trim() !== "" || basics.email.trim() !== "" || basics.headline.trim() !== "";

  if (hasBasics) return false;

  // Check if summary has content (accounting for TipTap empty patterns)
  if (resume.sections.summary.visible && !isHtmlEmpty(resume.sections.summary.content)) {
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
  let ids: string[] = [];
  try {
    ids = JSON.parse(localStorage.getItem(STORAGE_KEY_PREFIX + "_ids") || "[]") as string[];
  } catch {
    console.error("Failed to parse resume IDs from localStorage, resetting list");
    toast.warning("Resume ID data was corrupted — it has been reset");
    ids = [];
  }
  if (!ids.includes(id)) {
    ids.push(id);
    localStorage.setItem(STORAGE_KEY_PREFIX + "_ids", JSON.stringify(ids));
  }
}

function getFromLocalStorage(id: string): ResumeData {
  const data = localStorage.getItem(STORAGE_KEY_PREFIX + id);
  if (!data) throw new ResumeNotFoundError(id);
  try {
    const parsed: unknown = JSON.parse(data);
    return validateResumeData(parsed, id);
  } catch (e) {
    if (e instanceof ResumeCorruptedError) throw e;
    console.error("Failed to parse resume data from localStorage:", id);
    throw new ResumeCorruptedError(id, e);
  }
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
  return getFromLocalStorage(id);
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

    // Update persisted list-metadata (title & timestamp).
    // Keep the user-defined title if one exists; otherwise derive from basics.name.
    const existing = getResumeMeta(store.id);
    const name = store.resume.basics?.name?.trim();
    const title = existing?.title ?? (name || "Untitled Resume");
    setResumeMeta(store.id, title);

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
        // Normalize: ensure basics.picture exists (older resumes may lack it)
        if (!resume.basics.picture) {
          resume.basics.picture = createEmptyPicture();
        }
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
        }),
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
        }),
      );
      markDirty();
    },

    // Section visibility
    toggleSectionVisibility(sectionKey: SectionKey | "summary") {
      setStore(
        produce((s) => {
          if (s.resume) {
            if (sectionKey === "summary") {
              s.resume.sections.summary.visible = !s.resume.sections.summary.visible;
            } else {
              s.resume.sections[sectionKey].visible = !s.resume.sections[sectionKey].visible;
            }
          }
        }),
      );
      markDirty();
    },

    // Generic section item operations
    addSectionItem<K extends SectionKey>(sectionKey: K, item: Sections[K]["items"][number]) {
      setStore(
        produce((s) => {
          if (s.resume) {
            (s.resume.sections[sectionKey] as Section<unknown>).items.push(item);
          }
        }),
      );
      markDirty();
    },

    updateSectionItem<K extends SectionKey>(
      sectionKey: K,
      index: number,
      updates: Partial<Sections[K]["items"][number]>,
    ) {
      setStore(
        produce((s) => {
          if (s.resume) {
            const section = s.resume.sections[sectionKey] as unknown as Section<
              Record<string, unknown>
            >;
            if (section.items[index]) {
              Object.assign(section.items[index], updates);
            }
          }
        }),
      );
      markDirty();
    },

    removeSectionItem<K extends SectionKey>(sectionKey: K, index: number) {
      setStore(
        produce((s) => {
          if (s.resume) {
            (s.resume.sections[sectionKey] as Section<unknown>).items.splice(index, 1);
          }
        }),
      );
      markDirty();
    },

    reorderSectionItem<K extends SectionKey>(sectionKey: K, fromIndex: number, toIndex: number) {
      setStore(
        produce((s) => {
          if (s.resume) {
            const section = s.resume.sections[sectionKey] as Section<unknown>;
            const [item] = section.items.splice(fromIndex, 1);
            section.items.splice(toIndex, 0, item);
          }
        }),
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
        }),
      );
      markDirty();
    },

    updateTemplate(template: string) {
      setStore(
        produce((s) => {
          if (s.resume) {
            s.resume.metadata.template = template;
          }
        }),
      );
      markDirty();
    },

    updateTheme(theme: Partial<Metadata["theme"]>) {
      setStore(
        produce((s) => {
          if (s.resume) {
            Object.assign(s.resume.metadata.theme, theme);
          }
        }),
      );
      markDirty();
    },

    // Layout updates (pages -> columns -> section IDs)
    updateLayout(layout: string[][][]) {
      setStore(
        produce((s) => {
          if (s.resume) {
            s.resume.metadata.layout = layout;
          }
        }),
      );
      markDirty();
    },

    // Import resume data
    importResume(data: ResumeData) {
      // Normalize: ensure basics.picture exists (imported data may lack it)
      if (!data.basics.picture) {
        data.basics.picture = createEmptyPicture();
      }
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
