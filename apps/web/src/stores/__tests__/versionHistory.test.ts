import "fake-indexeddb/auto";
import { createDefaultResume } from "../../wasm/defaults";
import type { ResumeData } from "../../wasm/types";
import {
  deleteSnapshotsForResume,
  getSnapshot,
  listSnapshots,
  MAX_SNAPSHOTS_PER_RESUME,
  saveSnapshot,
} from "../versionHistory";

const DB_NAME = "rustume-version-history";

function createResume(name: string): ResumeData {
  const resume = createDefaultResume();
  resume.basics.name = name;
  return resume;
}

async function clearSnapshotsDb(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Failed to delete test database"));
    request.onblocked = () => resolve();
  });
}

describe("versionHistory store", () => {
  beforeEach(async () => {
    await clearSnapshotsDb();
    for (const id of ["resume-1", "resume-a", "resume-b"]) {
      localStorage.setItem(`rustume:${id}`, "{}");
    }
  });

  it("saveSnapshot and listSnapshots round-trip, newest first", async () => {
    const resumeA = createResume("Version A");
    const resumeB = createResume("Version B");

    await saveSnapshot("resume-1", resumeA);
    await saveSnapshot("resume-1", resumeB);

    const snapshots = await listSnapshots("resume-1");
    expect(snapshots).toHaveLength(2);
    expect(snapshots[0].timestamp).toBeGreaterThan(snapshots[1].timestamp);
    expect(snapshots[0].key).toBe(`resume-1_v${snapshots[0].timestamp}`);

    const latest = await getSnapshot(snapshots[0].key);
    const oldest = await getSnapshot(snapshots[1].key);
    expect(latest?.basics.name).toBe("Version B");
    expect(oldest?.basics.name).toBe("Version A");
  });

  it("retains both snapshots when concurrent saves are triggered", async () => {
    await Promise.all([
      saveSnapshot("resume-1", createResume("Concurrent A")),
      saveSnapshot("resume-1", createResume("Concurrent B")),
    ]);

    const snapshots = await listSnapshots("resume-1");
    expect(snapshots).toHaveLength(2);

    const timestamps = snapshots.map((snapshot) => snapshot.timestamp);
    expect(new Set(timestamps).size).toBe(2);
    expect(timestamps[0]).toBeGreaterThan(timestamps[1]);
  });

  it("retains all snapshots on rapid consecutive saves without timestamp collisions", async () => {
    for (let i = 0; i < 5; i++) {
      await saveSnapshot("resume-1", createResume(`Rapid ${i}`));
    }

    const snapshots = await listSnapshots("resume-1");
    expect(snapshots).toHaveLength(5);

    const timestamps = snapshots.map((snapshot) => snapshot.timestamp);
    expect(new Set(timestamps).size).toBe(5);
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i - 1]).toBeGreaterThan(timestamps[i]);
    }

    const oldest = await getSnapshot(snapshots[4].key);
    const newest = await getSnapshot(snapshots[0].key);
    expect(oldest?.basics.name).toBe("Rapid 0");
    expect(newest?.basics.name).toBe("Rapid 4");
  });

  it("does not overwrite a snapshot written by another tab with the same key", async () => {
    const now = Date.now();
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(now);

    try {
      // Simulate another tab writing a record whose key collides with the key
      // this tab is about to compute, but which the latest-snapshot lookup for
      // "resume-1" cannot see (the cross-tab race window).
      const otherTabData = createResume("Other tab");
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
          const store = request.result.createObjectStore("snapshots", { keyPath: "key" });
          store.createIndex("resumeId", "resumeId", { unique: false });
        };
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("snapshots", "readwrite");
          tx.objectStore("snapshots").put({
            key: `resume-1_v${now}`,
            resumeId: "resume-ghost",
            timestamp: now,
            data: otherTabData,
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error ?? new Error("seed failed"));
        };
        request.onerror = () => reject(request.error ?? new Error("open failed"));
      });

      await saveSnapshot("resume-1", createResume("This tab"));

      // The other tab's snapshot must survive untouched.
      const otherTabSnapshot = await getSnapshot(`resume-1_v${now}`);
      expect(otherTabSnapshot?.basics.name).toBe("Other tab");

      // This tab's snapshot lands on the next timestamp instead.
      const snapshots = await listSnapshots("resume-1");
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].timestamp).toBe(now + 1);
      const saved = await getSnapshot(snapshots[0].key);
      expect(saved?.basics.name).toBe("This tab");
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("keeps allocating after more than five cross-tab key collisions", async () => {
    const now = Date.now();
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(now);

    try {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
          const store = request.result.createObjectStore("snapshots", { keyPath: "key" });
          store.createIndex("resumeId", "resumeId", { unique: false });
        };
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("snapshots", "readwrite");
          const store = tx.objectStore("snapshots");
          for (let offset = 0; offset < 8; offset += 1) {
            store.put({
              key: `resume-1_v${now + offset}`,
              resumeId: "resume-ghost",
              timestamp: now + offset,
              data: createResume(`Other tab ${offset}`),
            });
          }
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error ?? new Error("seed failed"));
        };
        request.onerror = () => reject(request.error ?? new Error("open failed"));
      });

      await saveSnapshot("resume-1", createResume("This tab"));

      const snapshots = await listSnapshots("resume-1");
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].timestamp).toBe(now + 8);
      const saved = await getSnapshot(snapshots[0].key);
      expect(saved?.basics.name).toBe("This tab");
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("keeps the per-resume lock chain usable after a failed operation", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const openSpy = vi.spyOn(indexedDB, "open").mockImplementationOnce(() => {
      throw new Error("IndexedDB unavailable");
    });

    try {
      const failing = saveSnapshot("resume-1", createResume("Fails"));
      const queued = saveSnapshot("resume-1", createResume("Queued behind failure"));
      await Promise.all([failing, queued]);

      expect(consoleSpy).toHaveBeenCalled();
      const snapshots = await listSnapshots("resume-1");
      expect(snapshots).toHaveLength(1);
      const saved = await getSnapshot(snapshots[0].key);
      expect(saved?.basics.name).toBe("Queued behind failure");
    } finally {
      openSpy.mockRestore();
      consoleSpy.mockRestore();
    }
  });

  it("prunes snapshots beyond the keep-last limit", async () => {
    for (let i = 0; i < MAX_SNAPSHOTS_PER_RESUME + 1; i++) {
      await saveSnapshot("resume-1", createResume(`Version ${i}`));
      await new Promise((resolve) => setTimeout(resolve, 1));
    }

    const snapshots = await listSnapshots("resume-1");
    expect(snapshots).toHaveLength(MAX_SNAPSHOTS_PER_RESUME);

    const timestamps = snapshots.map((snapshot) => snapshot.timestamp);
    expect(new Set(timestamps).size).toBe(MAX_SNAPSHOTS_PER_RESUME);
    expect(Math.max(...timestamps)).toBeGreaterThan(Math.min(...timestamps));

    const oldestTimestamp = Math.min(...timestamps);
    const newestTimestamp = Math.max(...timestamps);
    const oldest = await getSnapshot(`resume-1_v${oldestTimestamp}`);
    const newest = await getSnapshot(`resume-1_v${newestTimestamp}`);
    expect(oldest?.basics.name).toBe("Version 1");
    expect(newest?.basics.name).toBe(`Version ${MAX_SNAPSHOTS_PER_RESUME}`);
  });

  it("skips identical consecutive snapshots", async () => {
    const resume = createResume("Same Data");

    await saveSnapshot("resume-1", resume);
    await saveSnapshot("resume-1", structuredClone(resume));

    const snapshots = await listSnapshots("resume-1");
    expect(snapshots).toHaveLength(1);
  });

  it("captures resume state at enqueue time before lock contention", async () => {
    const resume = createResume("Queued state");
    const queued = saveSnapshot("resume-1", resume);
    resume.basics.name = "Mutated after enqueue";

    await queued;

    const snapshots = await listSnapshots("resume-1");
    expect(snapshots).toHaveLength(1);
    const saved = await getSnapshot(snapshots[0].key);
    expect(saved?.basics.name).toBe("Queued state");
  });

  it("waits for in-flight saves before deleting snapshots", async () => {
    await saveSnapshot("resume-1", createResume("Initial"));

    const inFlight = saveSnapshot("resume-1", createResume("Should not survive delete"));
    await deleteSnapshotsForResume("resume-1");
    await inFlight;

    expect(await listSnapshots("resume-1")).toHaveLength(0);
  });

  it("skips snapshot save when resume no longer exists in storage", async () => {
    localStorage.removeItem("rustume:resume-1");

    await saveSnapshot("resume-1", createResume("After delete"));

    expect(await listSnapshots("resume-1")).toHaveLength(0);
  });

  it("rolls back an inserted snapshot when the resume is deleted during save", async () => {
    const originalGetItem = localStorage.getItem.bind(localStorage);
    let resumeChecks = 0;
    const getItemSpy = vi.spyOn(localStorage, "getItem").mockImplementation((key: string) => {
      if (key === "rustume:resume-1") {
        resumeChecks += 1;
        return resumeChecks === 1 ? "{}" : null;
      }
      return originalGetItem(key);
    });

    try {
      await saveSnapshot("resume-1", createResume("Deleted during save"));

      expect(resumeChecks).toBeGreaterThanOrEqual(2);
      expect(await listSnapshots("resume-1")).toHaveLength(0);
    } finally {
      getItemSpy.mockRestore();
    }
  });

  it("deleteSnapshotsForResume removes only that resume's snapshots", async () => {
    await saveSnapshot("resume-a", createResume("A"));
    await saveSnapshot("resume-b", createResume("B1"));
    await saveSnapshot("resume-b", createResume("B2"));

    await deleteSnapshotsForResume("resume-a");

    expect(await listSnapshots("resume-a")).toHaveLength(0);
    expect(await listSnapshots("resume-b")).toHaveLength(2);
  });

  it("does not throw when IndexedDB is unavailable", async () => {
    const originalIndexedDb = globalThis.indexedDB;
    Object.defineProperty(globalThis, "indexedDB", {
      value: undefined,
      configurable: true,
    });

    try {
      await expect(saveSnapshot("resume-1", createResume("Offline"))).resolves.toBeUndefined();
      await expect(listSnapshots("resume-1")).resolves.toEqual([]);
      await expect(getSnapshot("resume-1_v1")).resolves.toBeNull();
      await expect(deleteSnapshotsForResume("resume-1")).resolves.toBeUndefined();
    } finally {
      Object.defineProperty(globalThis, "indexedDB", {
        value: originalIndexedDb,
        configurable: true,
      });
    }
  });
});
