import { createEffect, createSignal, For, on, onCleanup, Show } from "solid-js";
import { Button, Modal, Spinner, toast } from "../ui";
import { renderPreview } from "../../api/render";
import {
  getResumeVersion,
  listResumeVersions,
  restoreResumeVersion,
  type ResumeVersionSummary,
} from "../../api/resumes";
import { formatRelativeTime } from "../../lib/formatRelativeTime";
import { isCloudAuthenticated, getCloudResumeVersion } from "../../stores/cloudStorage";
import { resumeStore } from "../../stores/resume";
import { uiStore } from "../../stores/ui";
import { getSnapshot, listSnapshots, type SnapshotMetadata } from "../../stores/versionHistory";
import type { ResumeData } from "../../wasm/types";

interface VersionListEntry {
  key: string;
  label: string;
  version?: number;
  timestampMs: number;
}

function localEntry(snapshot: SnapshotMetadata): VersionListEntry {
  return {
    key: snapshot.key,
    label: formatRelativeTime(snapshot.timestamp),
    timestampMs: snapshot.timestamp,
  };
}

function cloudEntry(summary: ResumeVersionSummary): VersionListEntry {
  const timestampMs = Date.parse(summary.created_at);
  return {
    key: String(summary.version),
    label: formatRelativeTime(timestampMs),
    version: summary.version,
    timestampMs,
  };
}

export function VersionHistory() {
  const { store: ui, closeModal } = uiStore;
  const { store, revertToSnapshot, loadResume } = resumeStore;

  const [entries, setEntries] = createSignal<VersionListEntry[]>([]);
  const [selectedKey, setSelectedKey] = createSignal<string | null>(null);
  const [previewUrl, setPreviewUrl] = createSignal<string | null>(null);
  const [previewPages, setPreviewPages] = createSignal(1);
  const [isLoadingList, setIsLoadingList] = createSignal(false);
  const [isLoadingPreview, setIsLoadingPreview] = createSignal(false);
  const [isReverting, setIsReverting] = createSignal(false);
  const [loadError, setLoadError] = createSignal<string | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = createSignal<ResumeData | null>(null);

  const isOpen = () => ui.modal === "versionHistory";
  const resumeId = () => store.id;
  const isCloud = () => isCloudAuthenticated();

  /** Monotonic token so overlapping list/preview loads cannot clobber newer UI state. */
  let loadSeq = 0;

  function revokePreviewUrl() {
    const url = previewUrl();
    if (url) {
      URL.revokeObjectURL(url);
      setPreviewUrl(null);
    }
  }

  async function loadSnapshotData(entry: VersionListEntry): Promise<ResumeData | null> {
    const id = resumeId();
    if (!id) return null;

    if (isCloud()) {
      const snapshot = await getResumeVersion(id, Number(entry.key));
      return snapshot.data;
    }

    return getSnapshot(entry.key);
  }

  async function loadPreview(entry: VersionListEntry, seq: number) {
    if (seq !== loadSeq) return;

    setIsLoadingPreview(true);
    setLoadError(null);
    revokePreviewUrl();
    setSelectedSnapshot(null);

    try {
      const data = await loadSnapshotData(entry);
      if (seq !== loadSeq) return;
      if (!data) {
        setLoadError("Snapshot data is unavailable.");
        return;
      }

      setSelectedSnapshot(data);
      const result = await renderPreview(data, 0);
      if (seq !== loadSeq) return;
      setPreviewUrl(result.url);
      setPreviewPages(result.totalPages);
    } catch (error) {
      if (seq !== loadSeq) return;
      console.error("Failed to load version preview:", error);
      setLoadError(error instanceof Error ? error.message : "Failed to load preview");
    } finally {
      if (seq === loadSeq) {
        setIsLoadingPreview(false);
      }
    }
  }

  async function loadVersionList(seq: number) {
    const id = resumeId();
    if (!id || seq !== loadSeq) return;

    setIsLoadingList(true);
    setLoadError(null);
    setEntries([]);
    setSelectedKey(null);
    revokePreviewUrl();
    setSelectedSnapshot(null);

    try {
      const mapped = isCloud()
        ? (await listResumeVersions(id)).map(cloudEntry)
        : (await listSnapshots(id)).map(localEntry);

      if (seq !== loadSeq) return;

      setEntries(mapped);
      if (mapped.length > 0) {
        setSelectedKey(mapped[0].key);
        await loadPreview(mapped[0], seq);
      }
    } catch (error) {
      if (seq !== loadSeq) return;
      console.error("Failed to load version history:", error);
      setLoadError(error instanceof Error ? error.message : "Failed to load version history");
    } finally {
      if (seq === loadSeq) {
        setIsLoadingList(false);
      }
    }
  }

  createEffect(
    on(
      () => [isOpen(), resumeId()] as const,
      ([open, id]) => {
        if (open && id) {
          const seq = ++loadSeq;
          void loadVersionList(seq);
        }
      },
    ),
  );

  onCleanup(() => {
    loadSeq += 1;
    revokePreviewUrl();
  });

  const handleSelect = async (entry: VersionListEntry) => {
    const seq = ++loadSeq;
    setSelectedKey(entry.key);
    await loadPreview(entry, seq);
  };

  const handleRevert = async () => {
    const id = resumeId();
    const entryKey = selectedKey();
    const snapshot = selectedSnapshot();
    if (!id || !entryKey || !snapshot) return;

    const entry = entries().find((item) => item.key === entryKey);
    const versionLabel = entry?.version !== undefined ? `version ${entry.version}` : entry?.label;
    const confirmed = window.confirm(
      `Revert to ${versionLabel ?? "this snapshot"}? Your current resume will be replaced.`,
    );
    if (!confirmed) return;

    setIsReverting(true);
    try {
      if (isCloud()) {
        const currentVersion = getCloudResumeVersion(id);
        if (currentVersion === undefined) {
          throw new Error("Current resume version is unknown — reload and try again.");
        }
        await restoreResumeVersion(id, Number(entryKey), currentVersion);
        await loadResume(id);
      } else {
        revertToSnapshot(snapshot);
      }
      toast.success("Reverted to selected version");
      closeModal();
    } catch (error) {
      console.error("Failed to revert resume version:", error);
      toast.error(error instanceof Error ? error.message : "Failed to revert version");
    } finally {
      setIsReverting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) closeModal();
  };

  return (
    <Modal
      open={isOpen()}
      onOpenChange={handleOpenChange}
      title="Version History"
      description="Browse saved snapshots, preview a version, and revert when needed."
      size="2xl"
    >
      <Show
        when={!isLoadingList()}
        fallback={
          <div class="flex min-h-[320px] items-center justify-center">
            <Spinner />
          </div>
        }
      >
        <Show
          when={entries().length > 0}
          fallback={
            <div class="min-h-[240px] flex items-center justify-center text-stone text-sm">
              {loadError() ?? "No saved versions yet. Snapshots are created when you save changes."}
            </div>
          }
        >
          <div class="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-4 min-h-[360px]">
            <div class="border border-border rounded-lg overflow-hidden">
              <div class="px-3 py-2 border-b border-border bg-surface">
                <p class="text-xs font-mono uppercase tracking-wider text-stone">Snapshots</p>
              </div>
              <ul class="max-h-[360px] overflow-y-auto divide-y divide-border">
                <For each={entries()}>
                  {(entry) => (
                    <li>
                      <button
                        type="button"
                        class={`w-full text-left px-3 py-2.5 transition-colors hover:bg-surface ${
                          selectedKey() === entry.key ? "bg-accent/10 text-ink" : "text-stone"
                        }`}
                        onClick={() => void handleSelect(entry)}
                      >
                        <span class="block text-sm font-medium text-ink">{entry.label}</span>
                        <Show when={entry.version !== undefined}>
                          <span class="block text-xs text-stone mt-0.5">v{entry.version}</span>
                        </Show>
                      </button>
                    </li>
                  )}
                </For>
              </ul>
            </div>

            <div class="flex flex-col min-h-[360px] border border-border rounded-lg overflow-hidden">
              <div class="px-3 py-2 border-b border-border bg-surface flex items-center justify-between gap-2">
                <p class="text-xs font-mono uppercase tracking-wider text-stone">
                  Read-only preview
                </p>
                <Show when={previewPages() > 1}>
                  <span class="text-xs text-stone">{previewPages()} pages</span>
                </Show>
              </div>

              <div class="flex-1 bg-surface/40 p-3 overflow-auto">
                <Show
                  when={!isLoadingPreview()}
                  fallback={
                    <div class="h-full min-h-[280px] flex items-center justify-center">
                      <Spinner />
                    </div>
                  }
                >
                  <Show
                    when={previewUrl()}
                    fallback={
                      <div class="h-full min-h-[280px] flex items-center justify-center text-sm text-stone px-4 text-center">
                        {loadError() ?? "Select a snapshot to preview"}
                      </div>
                    }
                  >
                    {(url) => (
                      <img
                        src={url()}
                        alt="Read-only snapshot preview"
                        class="mx-auto max-w-full rounded shadow-soft border border-border/60"
                      />
                    )}
                  </Show>
                </Show>
              </div>

              <div class="px-3 py-3 border-t border-border flex justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  loading={isReverting()}
                  disabled={!selectedSnapshot() || isLoadingPreview()}
                  onClick={() => void handleRevert()}
                >
                  Revert to this version
                </Button>
              </div>
            </div>
          </div>
        </Show>
      </Show>
    </Modal>
  );
}
