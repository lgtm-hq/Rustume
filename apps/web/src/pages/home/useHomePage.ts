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
  const [renameValue, setRenameValue] = createSignal("");
  const [searchQuery, setSearchQuery] = createSignal(getStoredSearchQuery());
  const [sortMode, setSortMode] = createSignal<ResumeSortMode>(getStoredResumeSort());
  const [tagFilter, setTagFilter] = createSignal<string | null>(null);
  const [tagDrafts, setTagDrafts] = createSignal<Record<string, string>>({});
  const [tagEditorId, setTagEditorId] = createSignal<string | null>(null);

  createEffect(() => {
    setStoredSearchQuery(searchQuery());
  });

  createEffect(() => {
    setStoredResumeSort(sortMode());
  });

  createEffect(() => {
    setStoredHomeLayout(layout());
  });

  const searchIndex = createMemo(() => createResumeSearchIndex(resumes() ?? []));
  const filteredResumes = createMemo((): FilteredResumeItem[] => {
    const searched = filterResumes(searchIndex(), searchQuery());
    const tag = tagFilter();
    const tagged = tag
      ? searched.filter(({ resume }) => (resume.tags ?? []).includes(tag))
      : searched;
    const sortedItems = sortResumes(
      tagged.map((row) => row.resume),
      sortMode(),
    );
    const byId = new Map(tagged.map((row) => [row.resume.id, row]));
    return sortedItems
      .map((resume) => byId.get(resume.id))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  });

  const allTags = createMemo(() => {
    const tags = new Set<string>();
    for (const resume of resumes() ?? []) {
      for (const tag of resume.tags ?? []) tags.add(tag);
    }
    return [...tags].sort((a, b) => a.localeCompare(b));
  });

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
    try {
      await patchResumeListMeta(id, { locked: !currentlyLocked });
      toast.success(currentlyLocked ? "Resume unlocked" : "Resume locked");
    } catch (e) {
      console.error(e);
      toast.error("Failed to update lock");
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
      await patchResumeListMeta(id, { tags });
      setTagDrafts((prev) => ({ ...prev, [id]: "" }));
      closeTagEditor(id);
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
      await patchResumeListMeta(id, { tags });
      if (tagFilter() === tag) {
        const stillUsed = (resumes() ?? []).some(
          (resume) => resume.id !== id && (resume.tags ?? []).includes(tag),
        );
        if (!stillUsed) setTagFilter(null);
      }
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
    deletingId() !== null || duplicatingId() !== null || renamingId() !== null;

  return {
    layout,
    setLayout,
    resumes: resumes as () => ResumeListItem[] | undefined,
    loading,
    refresh,
    deletingId,
    duplicatingId,
    renamingId,
    renameValue,
    setRenameValue,
    searchQuery,
    setSearchQuery,
    sortMode,
    setSortMode,
    tagFilter,
    setTagFilter,
    tagDrafts,
    setTagDrafts,
    tagEditorId,
    filteredResumes,
    allTags,
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
