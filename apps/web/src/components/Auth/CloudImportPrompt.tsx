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

const IMPORT_DISMISSED_KEY = "rustume:cloud-import-dismissed";

export function CloudImportPrompt() {
  const [open, setOpen] = createSignal(false);
  const [count, setCount] = createSignal(0);
  const [importing, setImporting] = createSignal(false);
  const [checked, setChecked] = createSignal(false);

  createEffect(
    on(
      () =>
        [authStore.state.loading, authStore.state.cloudEnabled, authStore.state.user?.id] as const,
      async ([loading, cloudEnabled, userId]) => {
        if (loading || !cloudEnabled || !userId || checked()) return;
        setChecked(true);

        if (localStorage.getItem(IMPORT_DISMISSED_KEY) === "true") return;

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

  const dismiss = () => {
    localStorage.setItem(IMPORT_DISMISSED_KEY, "true");
    setOpen(false);
  };

  const handleImport = async () => {
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

      const imported = await importResumes(resumes);
      localStorage.setItem(IMPORT_DISMISSED_KEY, "true");
      setOpen(false);
      window.dispatchEvent(new CustomEvent("rustume:resumes-changed"));
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
    <Modal
      open={open()}
      onOpenChange={(value) => {
        if (!value) dismiss();
        else setOpen(value);
      }}
      title="Import local resumes?"
      description="We found resumes saved on this device. Import them to your Rustume Cloud account?"
      size="md"
    >
      <div class="px-6 py-5 space-y-4">
        <p class="text-sm text-stone">
          {count()} local resume{count() === 1 ? "" : "s"} can be copied to cloud storage. Your
          local copies will remain on this device.
        </p>
        <div class="flex justify-end gap-3">
          <Button variant="ghost" onClick={dismiss} disabled={importing()}>
            Not now
          </Button>
          <Button onClick={() => void handleImport()} loading={importing()} disabled={importing()}>
            <Show when={!importing()} fallback="Importing...">
              Import to cloud
            </Show>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
