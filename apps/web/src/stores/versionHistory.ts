import type { ResumeData } from "../wasm/types";

const DB_NAME = "rustume-version-history";
const STORE_NAME = "snapshots";
export const MAX_SNAPSHOTS_PER_RESUME = 50;

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

/** Persist a resume snapshot in local IndexedDB. No-op when IndexedDB is unavailable. */
export async function saveSnapshot(resumeId: string, data: ResumeData): Promise<void> {
  if (!isIndexedDbAvailable()) return;

  try {
    const latest = await getLatestSnapshotRecord(resumeId);
    const clone = structuredClone(data);
    if (latest && JSON.stringify(latest.data) === JSON.stringify(clone)) {
      return;
    }

    const timestamp = Date.now();
    const record: SnapshotRecord = {
      key: snapshotKey(resumeId, timestamp),
      resumeId,
      timestamp,
      data: clone,
    };

    await withDatabase(async (db) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(record);
      await transactionDone(tx);
    });

    await pruneSnapshots(resumeId);
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

/** Remove all snapshots for a resume. */
export async function deleteSnapshotsForResume(resumeId: string): Promise<void> {
  if (!isIndexedDbAvailable()) return;

  try {
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
  } catch (error) {
    console.error("Failed to delete resume snapshots:", error);
  }
}
