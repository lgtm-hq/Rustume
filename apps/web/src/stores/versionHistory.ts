import { isWasmReady, resumeExists } from "../wasm";
import type { ResumeData } from "../wasm/types";

const DB_NAME = "rustume-version-history";
const STORE_NAME = "snapshots";
const LOCAL_RESUME_PREFIX = "rustume:";
export const MAX_SNAPSHOTS_PER_RESUME = 50;
const MAX_SNAPSHOT_KEY_RETRIES = 5;

export interface SnapshotMetadata {
  key: string;
  resumeId: string;
  timestamp: number;
}

interface SnapshotRecord {
  key: string;
  resumeId: string;
  timestamp: number;
  data: ResumeData;
}

function snapshotKey(resumeId: string, timestamp: number): string {
  return `${resumeId}_v${timestamp}`;
}

function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
        store.createIndex("resumeId", "resumeId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

async function withDatabase<T>(fn: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await openDatabase();
  try {
    return await fn(db);
  } finally {
    db.close();
  }
}

async function getLatestSnapshotRecord(resumeId: string): Promise<SnapshotRecord | null> {
  return withDatabase(async (db) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("resumeId");
    const records = await requestToPromise(index.getAll(resumeId));
    await transactionDone(tx);
    if (records.length === 0) return null;
    return records.reduce((latest, current) =>
      current.timestamp > latest.timestamp ? current : latest,
    );
  });
}

async function pruneSnapshots(resumeId: string): Promise<void> {
  await withDatabase(async (db) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("resumeId");
    const records = (await requestToPromise(index.getAll(resumeId))) as SnapshotRecord[];
    if (records.length <= MAX_SNAPSHOTS_PER_RESUME) {
      await transactionDone(tx);
      return;
    }

    const sorted = [...records].sort((a, b) => a.timestamp - b.timestamp);
    const excess = sorted.slice(0, records.length - MAX_SNAPSHOTS_PER_RESUME);
    for (const record of excess) {
      store.delete(record.key);
    }
    await transactionDone(tx);
  });
}

const resumeSnapshotChains = new Map<string, Promise<void>>();

async function isResumePersisted(resumeId: string): Promise<boolean> {
  if (isWasmReady()) {
    return resumeExists(resumeId);
  }
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(LOCAL_RESUME_PREFIX + resumeId) !== null;
}

async function withResumeSnapshotLock(
  resumeId: string,
  operation: () => Promise<void>,
): Promise<void> {
  const previous = resumeSnapshotChains.get(resumeId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  resumeSnapshotChains.set(resumeId, current);

  await previous;
  try {
    await operation();
  } finally {
    release();
    if (resumeSnapshotChains.get(resumeId) === current) {
      resumeSnapshotChains.delete(resumeId);
    }
  }
}

function isKeyCollisionError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "ConstraintError"
  );
}

/**
 * Insert a snapshot record without overwriting an existing key.
 *
 * Uses `add()` (which rejects on duplicate keys) instead of `put()` so a
 * concurrent save from another tab can never silently replace a snapshot.
 * Returns `false` when the key is already taken.
 */
async function addSnapshotRecord(record: SnapshotRecord): Promise<boolean> {
  return withDatabase(async (db) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    try {
      await requestToPromise(store.add(record));
      await transactionDone(tx);
      return true;
    } catch (error) {
      if (isKeyCollisionError(error)) {
        return false;
      }
      throw error;
    }
  });
}

async function deleteSnapshotRecord(key: string): Promise<void> {
  await withDatabase(async (db) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    await transactionDone(tx);
  });
}

async function saveSnapshotRecord(resumeId: string, clone: ResumeData): Promise<void> {
  if (!(await isResumePersisted(resumeId))) {
    return;
  }

  const latest = await getLatestSnapshotRecord(resumeId);
  if (latest && JSON.stringify(latest.data) === JSON.stringify(clone)) {
    return;
  }

  let timestamp = latest ? Math.max(Date.now(), latest.timestamp + 1) : Date.now();
  for (let attempt = 0; attempt < MAX_SNAPSHOT_KEY_RETRIES; attempt += 1) {
    const key = snapshotKey(resumeId, timestamp);
    const inserted = await addSnapshotRecord({
      key,
      resumeId,
      timestamp,
      data: clone,
    });
    if (inserted) {
      if (!(await isResumePersisted(resumeId))) {
        await deleteSnapshotRecord(key);
        return;
      }
      await pruneSnapshots(resumeId);
      return;
    }
    // Another browser context claimed this key; bump the timestamp and retry.
    timestamp += 1;
  }
  throw new Error(`Could not allocate a unique snapshot key for resume ${resumeId}`);
}

/** Persist a resume snapshot in local IndexedDB. No-op when IndexedDB is unavailable. */
export async function saveSnapshot(resumeId: string, data: ResumeData): Promise<void> {
  if (!isIndexedDbAvailable()) return;

  const snapshotData = structuredClone(data);

  try {
    await withResumeSnapshotLock(resumeId, () => saveSnapshotRecord(resumeId, snapshotData));
  } catch (error) {
    console.error("Failed to save resume snapshot:", error);
  }
}

/** List snapshot metadata for a resume, newest first. */
export async function listSnapshots(resumeId: string): Promise<SnapshotMetadata[]> {
  if (!isIndexedDbAvailable()) return [];

  try {
    return await withDatabase(async (db) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("resumeId");
      const records = (await requestToPromise(index.getAll(resumeId))) as SnapshotRecord[];
      await transactionDone(tx);
      return records
        .map(({ key, resumeId: id, timestamp }) => ({ key, resumeId: id, timestamp }))
        .sort((a, b) => b.timestamp - a.timestamp);
    });
  } catch (error) {
    console.error("Failed to list resume snapshots:", error);
    return [];
  }
}

/** Load a snapshot's resume data by key. */
export async function getSnapshot(key: string): Promise<ResumeData | null> {
  if (!isIndexedDbAvailable()) return null;

  try {
    return await withDatabase(async (db) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const record = (await requestToPromise(store.get(key))) as SnapshotRecord | undefined;
      await transactionDone(tx);
      return record?.data ?? null;
    });
  } catch (error) {
    console.error("Failed to load resume snapshot:", error);
    return null;
  }
}

async function deleteSnapshotRecords(resumeId: string): Promise<void> {
  await withDatabase(async (db) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("resumeId");
    const records = (await requestToPromise(index.getAll(resumeId))) as SnapshotRecord[];
    for (const record of records) {
      store.delete(record.key);
    }
    await transactionDone(tx);
  });
}

/** Remove all snapshots for a resume. */
export async function deleteSnapshotsForResume(resumeId: string): Promise<void> {
  if (!isIndexedDbAvailable()) return;

  try {
    await withResumeSnapshotLock(resumeId, () => deleteSnapshotRecords(resumeId));
  } catch (error) {
    console.error("Failed to delete resume snapshots:", error);
  }
}
