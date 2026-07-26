import { createEffect, createMemo, createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { toast } from "../../components/ui";
import {
  createResumeSearchIndex,
  filterResumes,
  getStoredSearchQuery,
  setStoredSearchQuery,
  type FilteredResumeItem,
} from "../../lib/resumeSearch";
import {
  getStoredResumeSort,
  setStoredResumeSort,
  sortResumes,
  type ResumeSortMode,
} from "../../lib/resumeSort";
import { getStoredHomeLayout, setStoredHomeLayout, type HomeLayout } from "../../lib/homeLayout";
import {
  folderScope,
  isSameScope,
  matchesScope,
  scopeLabel,
  SCOPE_ALL,
  tagScope,
  type HomeScope,
} from "../../lib/homeScope";
import {
  folderKey,
  getStoredFolders,
  mergeFolderNames,
  normalizeFolderName,
  setStoredFolders,
} from "../../lib/homeFolders";
import { formatRelativeTime } from "../../lib/formatRelativeTime";
import { authStore } from "../../stores/auth";
import {
  homeSidebarOpen,
  restoreHomeSidebarOpen,
  setHomeSidebarOpen,
  toggleHomeSidebar,
} from "../../stores/homeSidebar";
import { patchResumeListMeta, useResumeList, type ResumeListItem } from "../../stores/persistence";
import { uiStore } from "../../stores/ui";
import { generateId } from "../../wasm/types";

export function useHomePage() {
  const navigate = useNavigate();
  const { openModal } = uiStore;
  const { resumes, loading, deleteResume, duplicateResume, renameResume, refresh } =
    useResumeList();

  const [layout, setLayout] = createSignal<HomeLayout>(getStoredHomeLayout());
  const [deletingId, setDeletingId] = createSignal<string | null>(null);
  const [duplicatingId, setDuplicatingId] = createSignal<string | null>(null);
  const [renamingId, setRenamingId] = createSignal<string | null>(null);
  const [lockingId, setLockingId] = createSignal<string | null>(null);
  const [metaBusyId, setMetaBusyId] = createSignal<string | null>(null);
  const [renameValue, setRenameValue] = createSignal("");
  const [searchQuery, setSearchQuery] = createSignal(getStoredSearchQuery());
  const [sortMode, setSortMode] = createSignal<ResumeSortMode>(getStoredResumeSort());
  // Scope is deliberately session-only: reopening Rustume into a stale tag or
  // locked scope reads as data loss. Only the rail's open state persists.
  const [scope, setScopeSignal] = createSignal<HomeScope>(SCOPE_ALL);
  const [tagDrafts, setTagDrafts] = createSignal<Record<string, string>>({});
  const [tagEditorId, setTagEditorId] = createSignal<string | null>(null);
  // Folder names the user created. Assignments live on the resumes themselves;
  // this only additionally remembers folders nothing is filed into yet.
  const [knownFolders, setKnownFolders] = createSignal<string[]>(getStoredFolders());
  const [folderDraft, setFolderDraft] = createSignal("");
  const [folderCreating, setFolderCreating] = createSignal(false);
  const [renamingFolder, setRenamingFolder] = createSignal<string | null>(null);
  const [folderRenameValue, setFolderRenameValue] = createSignal("");
  const [folderBusy, setFolderBusy] = createSignal(false);

  // The rail's open state outlives this page, so re-read it on every mount.
  restoreHomeSidebarOpen();

  /** Selecting the active scope again clears back to the whole library. */
  const setScope = (next: HomeScope) => {
    setScopeSignal(next.kind !== "all" && isSameScope(scope(), next) ? SCOPE_ALL : next);
  };

  /** Serialize lock/tag writes per resume to avoid last-write-wins races. */
  const metaChains = new Map<string, Promise<void>>();

  const enqueueResumeMeta = (id: string, task: () => Promise<void>): Promise<void> => {
    const prev = metaChains.get(id) ?? Promise.resolve();
    const next = prev
      .catch(() => undefined)
      .then(async () => {
        setMetaBusyId(id);
        try {
          await task();
        } finally {
          setMetaBusyId((current) => (current === id ? null : current));
        }
      });
    metaChains.set(
      id,
      next.then(
        () => undefined,
        () => undefined,
      ),
    );
    return next;
  };

  createEffect(() => {
    setStoredSearchQuery(searchQuery());
  });

  createEffect(() => {
    setStoredResumeSort(sortMode());
  });

  createEffect(() => {
    setStoredHomeLayout(layout());
  });

  /** Scope narrows the library first, so search and sort only ever see one set. */
  const scopedResumes = createMemo(() => {
    const active = scope();
    const all = resumes() ?? [];
    return active.kind === "all" ? all : all.filter((resume) => matchesScope(resume, active));
  });

  const searchIndex = createMemo(() => createResumeSearchIndex(scopedResumes()));
  const filteredResumes = createMemo((): FilteredResumeItem[] => {
    const searched = filterResumes(searchIndex(), searchQuery());
    const sortedItems = sortResumes(
      searched.map((row) => row.resume),
      sortMode(),
    );
    const byId = new Map(searched.map((row) => [row.resume.id, row]));
    return sortedItems
      .map((resume) => byId.get(resume.id))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  });

  /** Counts come from the unfiltered list — scoping them would collapse each row to itself. */
  const scopeCounts = createMemo(() => {
    const all = resumes() ?? [];
    const tags = new Map<string, number>();
    // Keyed by canonical folder key, carrying a display name, so folders that
    // differ only in case are counted as the one folder the rail shows.
    const folders = new Map<string, { name: string; count: number }>();
    let locked = 0;
    let unfiled = 0;
    for (const resume of all) {
      if (resume.locked) locked += 1;
      for (const tag of resume.tags ?? []) tags.set(tag, (tags.get(tag) ?? 0) + 1);
      const folder = normalizeFolderName(resume.folder ?? "");
      if (!folder) {
        unfiled += 1;
        continue;
      }
      const existing = folders.get(folderKey(folder));
      if (existing) existing.count += 1;
      else folders.set(folderKey(folder), { name: folder, count: 1 });
    }
    return { total: all.length, locked, tags, folders, unfiled };
  });

  /** Count for a folder, matched however it happens to be capitalised. */
  const folderCount = (folder: string) => scopeCounts().folders.get(folderKey(folder))?.count ?? 0;

  const allTags = createMemo(() =>
    [...scopeCounts().tags.keys()].sort((a, b) => a.localeCompare(b)),
  );

  /**
   * Folders offered in the rail: the ones created here, unioned with the ones
   * resumes are actually filed into. The union matters on a second device,
   * where assignments arrive with the resumes but the name list does not.
   */
  const allFolders = createMemo(() =>
    mergeFolderNames(
      knownFolders(),
      [...scopeCounts().folders.values()].map((entry) => entry.name),
    ),
  );

  /** Live status-strip state — the trust signals the old marketing footer used to assert. */
  const resumeCount = () => resumes()?.length ?? 0;

  const lastEditedAt = createMemo<Date | null>(() => {
    let latest: Date | null = null;
    for (const resume of resumes() ?? []) {
      if (!latest || resume.updatedAt.getTime() > latest.getTime()) latest = resume.updatedAt;
    }
    return latest;
  });

  const lastEditLabel = createMemo(() => {
    const latest = lastEditedAt();
    return latest ? formatRelativeTime(latest.getTime()) : "never";
  });

  /** Cloud sync is only live once a signed-in user exists on a cloud-enabled build. */
  const syncEnabled = () => Boolean(authStore.state.cloudEnabled && authStore.state.user);

  /** What the status strip's `scope:` slot reports. */
  const activeScopeLabel = createMemo(() => scopeLabel(scope()));

  const handleNew = () => {
    const id = generateId();
    navigate(`/edit/${id}`);
  };

  const handleImport = () => {
    openModal("import");
  };

  const handleToggleLock = async (id: string, currentlyLocked: boolean, event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    setLockingId(id);
    try {
      await enqueueResumeMeta(id, async () => {
        await patchResumeListMeta(id, { locked: !currentlyLocked });
        toast.success(currentlyLocked ? "Resume unlocked" : "Resume locked");
      });
    } catch (e) {
      console.error(e);
      toast.error("Failed to update lock");
    } finally {
      setLockingId(null);
    }
  };

  const openTagEditor = (id: string, event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    setTagEditorId(id);
  };

  const closeTagEditor = (id?: string) => {
    const active = id ?? tagEditorId();
    if (!active) return;
    setTagEditorId((current) => (current === active ? null : current));
  };

  const handleAddTag = async (id: string, existing: string[] | undefined, event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    const draft = (tagDrafts()[id] ?? "").trim();
    if (!draft) return;
    const tags = [...new Set([...(existing ?? []), draft])];
    try {
      // List updates via rustume:resumes-changed (optimistic mutate + refetch).
      await enqueueResumeMeta(id, async () => {
        await patchResumeListMeta(id, { tags });
        setTagDrafts((prev) => ({ ...prev, [id]: "" }));
        closeTagEditor(id);
      });
    } catch (e) {
      console.error(e);
      toast.error("Failed to add tag");
    }
  };

  const handleRemoveTag = async (
    id: string,
    tag: string,
    existing: string[] | undefined,
    event: Event,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const tags = (existing ?? []).filter((t) => t !== tag);
    try {
      await enqueueResumeMeta(id, async () => {
        await patchResumeListMeta(id, { tags });
        // Drop a tag scope that no resume can satisfy any more.
        if (isSameScope(scope(), tagScope(tag))) {
          const stillUsed = (resumes() ?? []).some(
            (resume) => resume.id !== id && (resume.tags ?? []).includes(tag),
          );
          if (!stillUsed) setScope(SCOPE_ALL);
        }
      });
    } catch (e) {
      console.error(e);
      toast.error("Failed to remove tag");
    }
  };

  const persistKnownFolders = (next: string[]) => {
    setKnownFolders(next);
    setStoredFolders(next);
  };

  /** Resumes currently filed under a folder, however it is capitalised. */
  const resumesInFolder = (folder: string) =>
    (resumes() ?? []).filter(
      (resume) => resume.folder && folderKey(resume.folder) === folderKey(folder),
    );

  /** An existing folder that differs from `name` only in case, if any. */
  const conflictingFolder = (name: string, ignore?: string) =>
    allFolders().find(
      (existing) =>
        folderKey(existing) !== folderKey(ignore ?? "") && folderKey(existing) === folderKey(name),
    );

  const openFolderCreator = () => {
    setFolderDraft("");
    setFolderCreating(true);
  };

  const closeFolderCreator = () => {
    setFolderCreating(false);
    setFolderDraft("");
  };

  /**
   * Create an empty folder.
   *
   * Nothing is written to any resume — a folder only reaches a resume when the
   * user files one into it.
   */
  const handleCreateFolder = (event?: Event) => {
    event?.preventDefault();
    const name = normalizeFolderName(folderDraft());
    if (!name) {
      closeFolderCreator();
      return;
    }
    const existing = conflictingFolder(name);
    if (existing) {
      toast.error(`Folder "${existing}" already exists`);
      return;
    }
    persistKnownFolders(mergeFolderNames(knownFolders(), [name]));
    closeFolderCreator();
  };

  /** File a resume into a folder, or unfile it when `folder` is null. */
  const handleAssignFolder = async (id: string, folder: string | null) => {
    const next = folder === null ? null : normalizeFolderName(folder) || null;
    try {
      await enqueueResumeMeta(id, async () => {
        await patchResumeListMeta(id, { folder: next });
        // Filing into a folder the rail has not heard of yet keeps it listed
        // even if the resume later moves out.
        if (next) persistKnownFolders(mergeFolderNames(knownFolders(), [next]));
      });
    } catch (e) {
      console.error(e);
      toast.error("Failed to update folder");
    }
  };

  const startFolderRename = (folder: string) => {
    setRenamingFolder(folder);
    setFolderRenameValue(folder);
  };

  const cancelFolderRename = () => {
    setRenamingFolder(null);
    setFolderRenameValue("");
  };

  /**
   * Re-file every given resume, reporting how many actually moved.
   *
   * Settled rather than all-or-nothing: one failed write must not discard the
   * writes that already succeeded, because those resumes really have moved and
   * pretending otherwise leaves the rail describing a library that no longer
   * exists.
   */
  const refileResumes = async (
    ids: readonly string[],
    folder: string | null,
  ): Promise<{ moved: number; failed: number }> => {
    const results = await Promise.allSettled(
      ids.map((id) =>
        enqueueResumeMeta(id, async () => {
          await patchResumeListMeta(id, { folder });
        }),
      ),
    );
    const failures = results.filter((result) => result.status === "rejected");
    for (const failure of failures) console.error(failure.reason);
    return { moved: results.length - failures.length, failed: failures.length };
  };

  /** Rename a folder, carrying every resume filed under it across. */
  const confirmFolderRename = async (folder: string) => {
    const next = normalizeFolderName(folderRenameValue());
    if (!next || folderKey(next) === folderKey(folder)) {
      cancelFolderRename();
      return;
    }
    // Same guard as creating one: two folders the user cannot tell apart are
    // worse than a rejected rename.
    const conflict = conflictingFolder(next, folder);
    if (conflict) {
      toast.error(`Folder "${conflict}" already exists`);
      return;
    }

    const affected = resumesInFolder(folder);
    setFolderBusy(true);
    try {
      const { failed } = await refileResumes(
        affected.map((resume) => resume.id),
        next,
      );
      // Keep the old name listed while any resume is still filed under it, so
      // the stragglers stay reachable and the rename can be retried.
      const remaining = failed > 0 ? [folder] : [];
      persistKnownFolders(
        mergeFolderNames(
          knownFolders().filter((f) => folderKey(f) !== folderKey(folder)),
          remaining,
          [next],
        ),
      );
      // Follow the folder rather than dropping the user back to All.
      if (isSameScope(scope(), folderScope(folder))) setScopeSignal(folderScope(next));
      cancelFolderRename();
      if (failed > 0) {
        toast.error(
          `${failed} ${failed === 1 ? "resume" : "resumes"} stayed in "${folder}" — try again`,
        );
      }
    } finally {
      setFolderBusy(false);
    }
  };

  /**
   * Delete a folder without deleting anything filed in it.
   *
   * Every affected resume is unfiled, so it stays in the library and remains
   * visible under All. Losing a filing decision is recoverable; losing the
   * resume is not.
   */
  const handleDeleteFolder = async (folder: string) => {
    // A second click while the first delete is in flight would re-confirm and
    // re-issue writes for resumes that are already being unfiled.
    if (folderBusy()) return;

    const affected = resumesInFolder(folder);
    const detail = affected.length
      ? `${affected.length} ${affected.length === 1 ? "resume" : "resumes"} will be unfiled, not deleted.`
      : "It is empty.";
    if (!confirm(`Delete the folder "${folder}"? ${detail}`)) return;

    setFolderBusy(true);
    try {
      const { moved, failed } = await refileResumes(
        affected.map((resume) => resume.id),
        null,
      );
      // Only forget the folder once nothing is left in it; otherwise the
      // stragglers would have no row to reach them by.
      if (failed === 0) {
        persistKnownFolders(knownFolders().filter((f) => folderKey(f) !== folderKey(folder)));
        if (isSameScope(scope(), folderScope(folder))) setScopeSignal(SCOPE_ALL);
        toast.success(
          moved
            ? `Folder deleted — ${moved} ${moved === 1 ? "resume" : "resumes"} unfiled`
            : "Folder deleted",
        );
      } else {
        toast.error(
          `${failed} ${failed === 1 ? "resume" : "resumes"} could not be unfiled — try again`,
        );
      }
    } finally {
      setFolderBusy(false);
    }
  };

  const handleDelete = async (id: string, event: Event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!confirm("Are you sure you want to delete this resume?")) return;

    setDeletingId(id);
    try {
      await deleteResume(id);
      toast.success("Resume deleted");
    } catch (err) {
      console.error("Failed to delete:", err);
      toast.error(err instanceof Error ? err.message : "Failed to delete resume");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDuplicate = async (id: string, event: Event) => {
    event.preventDefault();
    event.stopPropagation();

    setDuplicatingId(id);
    try {
      await duplicateResume(id);
      toast.success("Resume duplicated");
    } catch (err) {
      console.error("Failed to duplicate:", err);
      toast.error(err instanceof Error ? err.message : "Failed to duplicate resume");
    } finally {
      setDuplicatingId(null);
    }
  };

  const startRename = (id: string, currentName: string, event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    setRenamingId(id);
    setRenameValue(currentName);
  };

  const confirmRename = async (id: string) => {
    const trimmed = renameValue().trim();
    if (trimmed) {
      try {
        await renameResume(id, trimmed);
        toast.success("Resume renamed");
      } catch (err) {
        console.error("Failed to rename:", err);
        toast.error(err instanceof Error ? err.message : "Failed to rename resume");
        return;
      }
    }
    setRenamingId(null);
    setRenameValue("");
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
  };

  const actionsBusy = () =>
    deletingId() !== null ||
    duplicatingId() !== null ||
    renamingId() !== null ||
    lockingId() !== null ||
    metaBusyId() !== null ||
    folderBusy();

  return {
    layout,
    setLayout,
    resumes: resumes as () => ResumeListItem[] | undefined,
    loading,
    refresh,
    deletingId,
    duplicatingId,
    renamingId,
    lockingId,
    metaBusyId,
    renameValue,
    setRenameValue,
    searchQuery,
    setSearchQuery,
    sortMode,
    setSortMode,
    tagDrafts,
    setTagDrafts,
    tagEditorId,
    scope,
    setScope,
    scopeCounts,
    activeScopeLabel,
    sidebarOpen: homeSidebarOpen,
    setSidebarOpen: setHomeSidebarOpen,
    toggleSidebar: toggleHomeSidebar,
    filteredResumes,
    allTags,
    allFolders,
    folderCount,
    folderDraft,
    setFolderDraft,
    folderCreating,
    openFolderCreator,
    closeFolderCreator,
    handleCreateFolder,
    handleAssignFolder,
    renamingFolder,
    folderRenameValue,
    setFolderRenameValue,
    startFolderRename,
    cancelFolderRename,
    confirmFolderRename,
    handleDeleteFolder,
    folderBusy,
    resumeCount,
    lastEditedAt,
    lastEditLabel,
    syncEnabled,
    handleNew,
    handleImport,
    handleToggleLock,
    openTagEditor,
    closeTagEditor,
    handleAddTag,
    handleRemoveTag,
    handleDelete,
    handleDuplicate,
    startRename,
    confirmRename,
    cancelRename,
    actionsBusy,
  };
}

export type HomePageModel = ReturnType<typeof useHomePage>;
