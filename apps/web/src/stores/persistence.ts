import { createResource } from "solid-js";
import { toast } from "../components/ui";
import {
  listResumes as listWasmResumes,
  deleteResume as deleteFromWasmStorage,
  getResume as getFromWasmStorage,
  saveResume as saveToWasmStorage,
  resumeExists as wasmResumeExists,
  isWasmReady,
} from "../wasm";
import { generateId } from "../wasm/types";
import type { ResumeData } from "../wasm/types";
import { ResumeNotFoundError, ResumeCorruptedError, validateResumeData } from "./resume";

export interface ResumeListItem {
  id: string;
  name: string;
  updatedAt: Date;
}

/** Serialized form stored in localStorage under the `_meta` key. */
export interface ResumeMetaEntry {
  title: string;
  updatedAt: string; // ISO-8601
}

// LocalStorage fallback
const STORAGE_KEY_PREFIX = "rustume:";
const META_KEY = STORAGE_KEY_PREFIX + "_meta";

// ---------------------------------------------------------------------------
// Metadata helpers
// ---------------------------------------------------------------------------

/** Read the entire metadata map from localStorage. */
export function getMetaMap(): Record<string, ResumeMetaEntry> {
  const raw = localStorage.getItem(META_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, ResumeMetaEntry>;
    }
    return {};
  } catch {
    console.error("Failed to parse resume metadata from localStorage, resetting");
    localStorage.removeItem(META_KEY);
    return {};
  }
}

/** Persist the full metadata map back to localStorage. */
function setMetaMap(map: Record<string, ResumeMetaEntry>): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(map));
  } catch (e) {
    console.error("Failed to save resume metadata to localStorage:", e);
  }
}

/** Upsert metadata for a single resume. */
export function setResumeMeta(id: string, title: string, updatedAt?: Date): void {
  const map = getMetaMap();
  map[id] = {
    title,
    updatedAt: (updatedAt ?? new Date()).toISOString(),
  };
  setMetaMap(map);
}

/** Remove metadata for a single resume. */
function deleteResumeMeta(id: string): void {
  const map = getMetaMap();
  delete map[id];
  setMetaMap(map);
}

/** Get metadata for a single resume, or null if missing. */
export function getResumeMeta(id: string): ResumeMetaEntry | null {
  return getMetaMap()[id] ?? null;
}

/**
 * Derive a display title for a resume.
 * Priority: persisted title > basics.name > fallback placeholder.
 */
function deriveTitleFromResume(data: ResumeData): string {
  const name = data.basics?.name?.trim();
  if (name) return name;
  return "Untitled Resume";
}

// ---------------------------------------------------------------------------
// LocalStorage resume CRUD
// ---------------------------------------------------------------------------

function listLocalResumes(): string[] {
  const ids = localStorage.getItem(STORAGE_KEY_PREFIX + "_ids");
  if (!ids) return [];
  try {
    return JSON.parse(ids) as string[];
  } catch {
    console.error("Failed to parse resume IDs from localStorage, resetting list");
    localStorage.removeItem(STORAGE_KEY_PREFIX + "_ids");
    toast.warning("Resume list data was corrupted — it has been reset");
    return [];
  }
}

function deleteLocalResume(id: string): void {
  localStorage.removeItem(STORAGE_KEY_PREFIX + id);
  const ids = listLocalResumes().filter((i) => i !== id);
  localStorage.setItem(STORAGE_KEY_PREFIX + "_ids", JSON.stringify(ids));
  deleteResumeMeta(id);
}

function localResumeExists(id: string): boolean {
  return localStorage.getItem(STORAGE_KEY_PREFIX + id) !== null;
}

function getLocalResume(id: string): ResumeData {
  const data = localStorage.getItem(STORAGE_KEY_PREFIX + id);
  if (!data) throw new ResumeNotFoundError(id);
  try {
    const parsed: unknown = JSON.parse(data);
    return validateResumeData(parsed, id);
  } catch (e) {
    if (e instanceof ResumeCorruptedError) throw e;
    console.error("Failed to parse resume data from localStorage:", STORAGE_KEY_PREFIX + id);
    throw new ResumeCorruptedError(id, e);
  }
}

function saveLocalResume(id: string, data: ResumeData): void {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + id, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save resume to localStorage:", STORAGE_KEY_PREFIX + id, e);
    toast.error("Local storage is full — could not save resume");
    return;
  }
  let ids: string[] = [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY_PREFIX + "_ids") || "[]");
    ids = Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    console.error("Failed to parse resume IDs from localStorage, resetting list");
    toast.warning("Resume ID data was corrupted — it has been reset");
    ids = [];
  }
  if (!ids.includes(id)) {
    ids.push(id);
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + "_ids", JSON.stringify(ids));
    } catch (e) {
      console.error("Failed to update resume ID list in localStorage:", e);
      toast.error("Local storage is full — resume saved but list not updated");
    }
  }

  // Update metadata: keep existing title if set, otherwise derive from data
  const existing = getResumeMeta(id);
  const title = existing?.title ?? deriveTitleFromResume(data);
  setResumeMeta(id, title);
}

// ---------------------------------------------------------------------------
// Unified async API (WASM with localStorage fallback)
// ---------------------------------------------------------------------------

async function listResumes(): Promise<string[]> {
  if (isWasmReady()) {
    return listWasmResumes();
  }
  return listLocalResumes();
}

async function deleteResume(id: string): Promise<void> {
  if (isWasmReady()) {
    await deleteFromWasmStorage(id);
  } else {
    deleteLocalResume(id);
  }
  // Always clean up metadata (stored in localStorage regardless of backend)
  deleteResumeMeta(id);
}

async function resumeExists(id: string): Promise<boolean> {
  if (isWasmReady()) {
    return wasmResumeExists(id);
  }
  return localResumeExists(id);
}

async function getResume(id: string): Promise<ResumeData> {
  if (isWasmReady()) {
    return getFromWasmStorage(id);
  }
  return getLocalResume(id);
}

async function saveResume(id: string, data: ResumeData): Promise<void> {
  if (isWasmReady()) {
    await saveToWasmStorage(id, data);
    // Update metadata in localStorage even for WASM backend
    const existing = getResumeMeta(id);
    const title = existing?.title ?? deriveTitleFromResume(data);
    setResumeMeta(id, title);
    return;
  }
  saveLocalResume(id, data);
}

// ---------------------------------------------------------------------------
// Fetch list with real metadata
// ---------------------------------------------------------------------------

async function fetchResumeList(): Promise<ResumeListItem[]> {
  try {
    const ids = await listResumes();
    const metaMap = getMetaMap();
    const items: ResumeListItem[] = [];

    for (const id of ids) {
      const meta = metaMap[id];
      if (meta) {
        items.push({
          id,
          name: meta.title,
          updatedAt: new Date(meta.updatedAt),
        });
      } else {
        // Migration: no metadata yet — try to derive from stored resume data
        let title = "Untitled Resume";
        try {
          const data = await getResume(id);
          title = deriveTitleFromResume(data);
          // Persist the derived metadata so future loads are instant
          setResumeMeta(id, title);
        } catch {
          // Resume data may be corrupted — use fallback title
        }
        items.push({
          id,
          name: title,
          updatedAt: new Date(),
        });
      }
    }

    return items;
  } catch (e) {
    console.error("Failed to list resumes:", e);
    toast.error("Failed to load resume list");
    return [];
  }
}

// ---------------------------------------------------------------------------
// Public hook
// ---------------------------------------------------------------------------

export function useResumeList() {
  const [resumes, { refetch }] = createResource(fetchResumeList);

  return {
    resumes,
    loading: () => resumes.loading,
    error: () => resumes.error,

    async refresh() {
      await refetch();
    },

    async deleteResume(id: string) {
      try {
        await deleteResume(id);
        await refetch();
      } catch (e) {
        console.error("Failed to delete resume:", e);
        toast.error("Failed to delete resume");
        throw e;
      }
    },

    async duplicateResume(id: string): Promise<string> {
      try {
        const original = await getResume(id);
        const newId = generateId();
        await saveResume(newId, structuredClone(original));

        // Copy metadata with "(Copy)" suffix
        const originalMeta = getResumeMeta(id);
        const baseName = originalMeta?.title ?? deriveTitleFromResume(original);
        setResumeMeta(newId, `${baseName} (Copy)`);

        await refetch();
        return newId;
      } catch (e) {
        console.error("Failed to duplicate resume:", e);
        toast.error("Failed to duplicate resume");
        throw e;
      }
    },

    async renameResume(id: string, newTitle: string) {
      try {
        const trimmed = newTitle.trim();
        if (!trimmed) return;
        setResumeMeta(id, trimmed);
        await refetch();
      } catch (e) {
        console.error("Failed to rename resume:", e);
        toast.error("Failed to rename resume");
        throw e;
      }
    },

    async checkExists(id: string): Promise<boolean> {
      return resumeExists(id);
    },
  };
}
