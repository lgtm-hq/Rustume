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

/** Check whether a value matches the ResumeMetaEntry shape. */
function isValidMetaEntry(v: unknown): v is ResumeMetaEntry {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Record<string, unknown>).title === "string" &&
    typeof (v as Record<string, unknown>).updatedAt === "string"
  );
}

/** Read the entire metadata map from localStorage. */
export function getMetaMap(): Record<string, ResumeMetaEntry> {
  const raw = localStorage.getItem(META_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    const result: Record<string, ResumeMetaEntry> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (isValidMetaEntry(value)) {
        result[key] = value;
      }
    }
    return result;
  } catch {
    console.error("Failed to parse resume metadata from localStorage, resetting");
    localStorage.removeItem(META_KEY);
    return {};
  }
}

/** Persist the full metadata map back to localStorage. Throws on quota errors. */
function setMetaMap(map: Record<string, ResumeMetaEntry>): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(map));
  } catch (e) {
    throw new Error("Failed to persist resume metadata: localStorage quota exceeded", { cause: e });
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
export function deriveTitleFromResume(data: ResumeData): string {
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
  try {
    setResumeMeta(id, title);
  } catch (e) {
    console.error("Failed to update resume metadata:", e);
    toast.warning("Resume saved but metadata could not be updated — storage may be full");
  }
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
    try {
      setResumeMeta(id, title);
    } catch (e) {
      console.error("Failed to update resume metadata:", e);
      toast.warning("Resume saved but metadata could not be updated — storage may be full");
    }
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

    // Identify IDs that need migration (no metadata yet)
    const needsMigration = ids.filter((id) => !metaMap[id]);

    // Migrate missing metadata in parallel
    const migratedMap = new Map<string, ResumeListItem>();
    if (needsMigration.length > 0) {
      const migrationResults = await Promise.allSettled(
        needsMigration.map((id) => getResume(id).then((data) => ({ id, data }))),
      );

      for (let i = 0; i < needsMigration.length; i++) {
        const id = needsMigration[i];
        const result = migrationResults[i];
        let title = "Untitled Resume";
        if (result.status === "fulfilled") {
          title = deriveTitleFromResume(result.value.data);
          // Persist the derived metadata so future loads are instant
          try {
            setResumeMeta(id, title);
          } catch (metaErr) {
            console.error("Failed to persist metadata for resume:", id, metaErr);
          }
        }
        migratedMap.set(id, { id, name: title, updatedAt: new Date() });
      }
    }

    // Map over original ids to preserve ordering
    return ids.map((id) => {
      const migrated = migratedMap.get(id);
      if (migrated) return migrated;
      const meta = metaMap[id];
      return {
        id,
        name: meta.title,
        updatedAt: new Date(meta.updatedAt),
      };
    });
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
      let newId: string | undefined;
      let saveCompleted = false;
      try {
        const original = await getResume(id);
        newId = generateId();

        // Set metadata with "(Copy)" suffix before saving so saveResume
        // sees existing metadata and doesn't overwrite it.
        const originalMeta = getResumeMeta(id);
        const baseName = originalMeta?.title ?? deriveTitleFromResume(original);
        setResumeMeta(newId, `${baseName} (Copy)`);

        await saveResume(newId, structuredClone(original));
        saveCompleted = true;
        await refetch();
        return newId;
      } catch (e) {
        // Only roll back pre-created metadata if save didn't complete
        if (newId && !saveCompleted) {
          try {
            deleteResumeMeta(newId);
          } catch {
            // Best-effort cleanup
          }
        }
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
