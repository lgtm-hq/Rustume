import { createStore, produce } from "solid-js/store";
import { batch } from "solid-js";
import { toast } from "../components/ui";
import type { ResumeData, Basics, Sections, Metadata, Section, CustomItem } from "../wasm/types";
import {
  createEmptyResume,
  createEmptyPicture,
  saveResume as saveToWasmStorage,
  getResume as getFromWasmStorage,
  isWasmReady,
} from "../wasm";
import {
  isCloudAuthenticated,
  isCloudWriteBlockedError,
  isResumeVersionConflictError,
  loadCloudResume,
  saveCloudResume,
  showResumeVersionConflictToast,
} from "./cloudStorage";

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

export const FIXED_LAYOUT_SECTION_KEYS: (keyof Omit<
  Sections,
  "summary" | "custom" | "coverLetter"
>)[] = [
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
const FIXED_LAYOUT_SECTION_KEY_SET = new Set<string>([
  "summary",
  "coverLetter",
  ...FIXED_LAYOUT_SECTION_KEYS,
]);

function uniqueLayoutIds(ids: string[]): string[] {
  const seen = new Set<string>();
  return ids.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function removeLayoutIdsFromLaterPages(layout: string[][][], ids: readonly string[]): void {
  const movedIds = new Set(ids);
  for (let pageIndex = 1; pageIndex < layout.length; pageIndex++) {
    layout[pageIndex] = layout[pageIndex].map((column) => column.filter((id) => !movedIds.has(id)));
  }
}

function materializeCustomLayoutSentinels(layout: string[][][], customIds: string[]): Set<string> {
  const layoutIds = new Set<string>();
  let expandedCustom = false;

  for (let pageIndex = 0; pageIndex < layout.length; pageIndex++) {
    layout[pageIndex] = layout[pageIndex].map((column) => {
      const materialized: string[] = [];
      for (const id of column) {
        const ids = id === "custom" ? (expandedCustom ? [] : customIds) : [id];
        if (id === "custom") {
          expandedCustom = true;
        }
        for (const concreteId of ids) {
          if (layoutIds.has(concreteId)) continue;
          layoutIds.add(concreteId);
          materialized.push(concreteId);
        }
      }
      return materialized;
    });
  }

  return layoutIds;
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

  for (const key of FIXED_LAYOUT_SECTION_KEYS) {
    const section = resume.sections[key];
    if (section.visible && section.items.length > 0) {
      return false;
    }
  }

  for (const section of Object.values(resume.sections.custom ?? {})) {
    if (section.visible && section.items.length > 0) {
      return false;
    }
  }

  return true;
}

function normalizeResumeForStore(resume: ResumeData): ResumeData {
  if (!resume.basics.picture) {
    resume.basics.picture = createEmptyPicture();
  }

  if (
    typeof resume.sections.custom !== "object" ||
    resume.sections.custom === null ||
    Array.isArray(resume.sections.custom)
  ) {
    resume.sections.custom = {};
  }
  if (!Array.isArray(resume.metadata.layout)) {
    resume.metadata.layout = [];
  }

  const customIds = Object.keys(resume.sections.custom);
  if (resume.metadata.layout.length === 0) {
    if (customIds.length === 0) return resume;
    resume.metadata.layout = [
      [["summary", "coverLetter", ...FIXED_LAYOUT_SECTION_KEYS, ...customIds]],
    ];
    return resume;
  }

  const layoutIds = materializeCustomLayoutSentinels(resume.metadata.layout, customIds);
  const page0 = resume.metadata.layout[0];
  if (!page0 || page0.length === 0) {
    const fixedIds = uniqueLayoutIds(
      resume.metadata.layout.flat(2).filter((id) => FIXED_LAYOUT_SECTION_KEY_SET.has(id)),
    );
    const page0Ids = uniqueLayoutIds([...fixedIds, ...customIds]);
    resume.metadata.layout[0] = [page0Ids];
    removeLayoutIdsFromLaterPages(resume.metadata.layout, page0Ids);
    return resume;
  }

  if (customIds.length === 0) return resume;

  const missingCustomIds = customIds.filter((id) => !layoutIds.has(id));
  if (missingCustomIds.length > 0) {
    const normalizedPage0 = resume.metadata.layout[0] ?? [];
    const lastColumn = normalizedPage0.at(-1);
    if (lastColumn) {
      lastColumn.push(...missingCustomIds);
    } else {
      resume.metadata.layout[0] = [missingCustomIds];
    }
  }

  return resume;
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
  if (isCloudAuthenticated()) {
    await saveCloudResume(id, data);
    return;
  }
  if (isWasmReady()) {
    return saveToWasmStorage(id, data);
  }
  saveToLocalStorage(id, data);
}

async function getResume(id: string): Promise<ResumeData> {
  if (isCloudAuthenticated()) {
    return loadCloudResume(id);
  }
  if (isWasmReady()) {
    return getFromWasmStorage(id);
  }
  return getFromLocalStorage(id);
}

export type SectionKey = keyof Omit<Sections, "summary" | "coverLetter" | "custom">;
export type LayoutSectionKey = SectionKey | "summary" | "coverLetter" | "custom";
export type CustomSectionKey = `custom:${string}`;

function createCustomSection(name: string): Section<CustomItem> {
  const id = crypto.randomUUID();
  return {
    id,
    name,
    columns: 1,
    separateLinks: false,
    visible: true,
    items: [],
  };
}

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
    if (isResumeVersionConflictError(e) && store.id) {
      showResumeVersionConflictToast(store.id);
      setStore("error", e.message);
      setStore("isSaving", false);
      return;
    }
    if (isCloudWriteBlockedError(e)) {
      setStore("error", "Reload required to sync latest changes");
      setStore("isSaving", false);
      return;
    }
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
        const resume = normalizeResumeForStore(await getResume(id));
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
    toggleSectionVisibility(sectionKey: LayoutSectionKey) {
      setStore(
        produce((s) => {
          if (s.resume) {
            if (sectionKey === "summary") {
              s.resume.sections.summary.visible = !s.resume.sections.summary.visible;
            } else if (sectionKey === "coverLetter") {
              s.resume.sections.coverLetter.visible = !s.resume.sections.coverLetter.visible;
            } else if (sectionKey === "custom") {
              const sections = Object.values(s.resume.sections.custom);
              const nextVisible = !sections.some((section) => section.visible);
              for (const section of sections) {
                section.visible = nextVisible;
              }
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

    addCustomSection(name: string): string {
      const section = createCustomSection(name);
      setStore(
        produce((s) => {
          if (!s.resume) return;

          s.resume.sections.custom[section.id] = section;
          if (s.resume.metadata.layout.length === 0) {
            s.resume.metadata.layout = [
              [["summary", "coverLetter", ...FIXED_LAYOUT_SECTION_KEYS, section.id]],
            ];
            return;
          }

          const page = s.resume.metadata.layout[0] ?? [];
          if (!page || page.length === 0) {
            const fixedIds = uniqueLayoutIds(
              s.resume.metadata.layout.flat(2).filter((id) => FIXED_LAYOUT_SECTION_KEY_SET.has(id)),
            );
            const page0Ids = uniqueLayoutIds([...fixedIds, section.id]);
            s.resume.metadata.layout[0] = [page0Ids];
            removeLayoutIdsFromLaterPages(s.resume.metadata.layout, page0Ids);
            return;
          }

          page[page.length - 1].push(section.id);
        }),
      );
      markDirty();
      return section.id;
    },

    updateCustomSection(
      sectionId: string,
      updates: Partial<Pick<Section<CustomItem>, "name" | "visible">>,
    ) {
      setStore(
        produce((s) => {
          const section = s.resume?.sections.custom[sectionId];
          if (!section) return;
          Object.assign(section, updates);
        }),
      );
      markDirty();
    },

    removeCustomSection(sectionId: string) {
      setStore(
        produce((s) => {
          if (!s.resume) return;
          delete s.resume.sections.custom[sectionId];
          s.resume.metadata.layout = s.resume.metadata.layout.map((page) =>
            page.map((column) => column.filter((id) => id !== sectionId)),
          );
        }),
      );
      markDirty();
    },

    addCustomSectionItem(sectionId: string, item: CustomItem) {
      const items = store.resume?.sections.custom[sectionId]?.items;
      if (!items) return;
      setStore("resume", "sections", "custom", sectionId, "items", items.length, item);
      markDirty();
    },

    updateCustomSectionItem(sectionId: string, index: number, updates: Partial<CustomItem>) {
      const item = store.resume?.sections.custom[sectionId]?.items[index];
      if (!item) return;
      setStore("resume", "sections", "custom", sectionId, "items", index, updates);
      markDirty();
    },

    removeCustomSectionItem(sectionId: string, index: number) {
      const items = store.resume?.sections.custom[sectionId]?.items;
      if (!items) return;
      setStore(
        "resume",
        "sections",
        "custom",
        sectionId,
        "items",
        items.filter((_, itemIndex) => itemIndex !== index),
      );
      markDirty();
    },

    reorderCustomSectionItem(sectionId: string, fromIndex: number, toIndex: number) {
      const items = store.resume?.sections.custom[sectionId]?.items;
      if (!items) return;
      const nextItems = [...items];
      const [item] = nextItems.splice(fromIndex, 1);
      if (!item) return;
      nextItems.splice(toIndex, 0, item);
      setStore("resume", "sections", "custom", sectionId, "items", nextItems);
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
      // Deep clone so Solid store owns a plain tree (imported objects may be frozen / aliased).
      const clone = normalizeResumeForStore(JSON.parse(JSON.stringify(data)) as ResumeData);
      batch(() => {
        setStore("resume", clone);
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
