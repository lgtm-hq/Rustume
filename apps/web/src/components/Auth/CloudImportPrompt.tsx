import { createEffect, createSignal, on, Show } from "solid-js";
import { importResumes } from "../../api/resumes";
import { Button, Modal, toast } from "../ui";
import {
  deriveTitleFromResume,
  getMetaMap,
  getResumeMeta,
  getStoredResume,
  listStoredResumeIds,
} from "../../stores/persistence";
import { authStore } from "../../stores/auth";

const dismissedKey = (userId: string) => `rustume:cloud-import-dismissed:${userId}`;

export function CloudImportPrompt() {
  const [open, setOpen] = createSignal(false);
  const [count, setCount] = createSignal(0);
  const [importing, setImporting] = createSignal(false);
  const [checkedUserId, setCheckedUserId] = createSignal<string | null>(null);

  createEffect(
    on(
      () =>
        [authStore.state.loading, authStore.state.cloudEnabled, authStore.state.user?.id] as const,
      async ([loading, cloudEnabled, userId]) => {
        if (loading || !cloudEnabled || !userId) {
          setCheckedUserId(null);
          return;
        }
        if (checkedUserId() === userId) return;
        setCheckedUserId(userId);

        if (localStorage.getItem(dismissedKey(userId)) === "true") return;

        try {
          const ids = await listStoredResumeIds();
          if (ids.length === 0) return;
          setCount(ids.length);
          setOpen(true);
        } catch (error: unknown) {
          console.error("Failed to inspect local resumes:", error);
        }
      },
    ),
  );

  const dismiss = (userId: string) => {
    localStorage.setItem(dismissedKey(userId), "true");
    setOpen(false);
  };

  const handleImport = async (userId: string) => {
    setImporting(true);
    try {
      const ids = await listStoredResumeIds();
      const metaMap = getMetaMap();
      const resumes: {
        id: string;
        title: string;
        data: Awaited<ReturnType<typeof getStoredResume>>;
      }[] = [];
      for (const id of ids) {
        try {
          const data = await getStoredResume(id);
          const meta = metaMap[id] ?? getResumeMeta(id);
          const title = meta?.title?.trim() ? meta.title : deriveTitleFromResume(data);
          resumes.push({ id, title, data });
        } catch (error: unknown) {
          console.error("Skipping local resume during cloud import:", id, error);
        }
      }

      if (resumes.length === 0) {
        toast.error("No local resumes could be imported");
        return;
      }

      const { imported, failures } = await importResumes(resumes);

      if (imported.length === 0) {
        toast.error(failures[0]?.message ?? "No local resumes could be imported");
        return;
      }

      localStorage.setItem(dismissedKey(userId), "true");
      setOpen(false);
      window.dispatchEvent(new CustomEvent("rustume:resumes-changed"));

      if (failures.length > 0) {
        toast.error(
          `Imported ${imported.length} resume${imported.length === 1 ? "" : "s"}, but ${failures.length} batch${failures.length === 1 ? "" : "es"} failed`,
        );
        return;
      }

      toast.success(
        `Imported ${imported.length} resume${imported.length === 1 ? "" : "s"} to the cloud`,
      );
    } catch (error: unknown) {
      console.error("Cloud import failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to import resumes");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Show when={authStore.state.user?.id}>
      {(userId) => (
        <Modal
          open={open()}
          onOpenChange={(value) => {
            if (!value) dismiss(userId());
            else setOpen(value);
          }}
          title="Import local resumes?"
          description={
            authStore.state.localMode
              ? "We found resumes saved in this browser. Import them to the server so they persist outside this device?"
              : "We found resumes saved on this device. Import them to your Rustume Cloud account?"
          }
          size="md"
        >
          <div class="px-6 py-5 space-y-4">
            <p class="text-sm text-stone">
              {count()} local resume{count() === 1 ? "" : "s"} can be copied to{" "}
              {authStore.state.localMode ? "server storage" : "cloud storage"}. Your local copies
              will remain on this device.
            </p>
            <div class="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => dismiss(userId())} disabled={importing()}>
                Not now
              </Button>
              <Button
                onClick={() => void handleImport(userId())}
                loading={importing()}
                disabled={importing()}
              >
                <Show when={!importing()} fallback="Importing...">
                  {authStore.state.localMode ? "Import to server" : "Import to cloud"}
                </Show>
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Show>
  );
}
