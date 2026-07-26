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
  isSameScope,
  matchesScope,
  scopeLabel,
  SCOPE_ALL,
  tagScope,
  type HomeScope,
} from "../../lib/homeScope";
import { formatRelativeTime } from "../../lib/formatRelativeTime";
import { authStore } from "../../stores/auth";
import {
  closeHomeSidebarTransiently,
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
    let locked = 0;
    for (const resume of all) {
      if (resume.locked) locked += 1;
      for (const tag of resume.tags ?? []) tags.set(tag, (tags.get(tag) ?? 0) + 1);
    }
    return { total: all.length, locked, tags };
  });

  const allTags = createMemo(() =>
    [...scopeCounts().tags.keys()].sort((a, b) => a.localeCompare(b)),
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
    metaBusyId() !== null;

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
    closeSidebarTransiently: closeHomeSidebarTransiently,
    toggleSidebar: toggleHomeSidebar,
    filteredResumes,
    allTags,
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
