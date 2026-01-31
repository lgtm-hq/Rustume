import { createSignal, Show } from "solid-js";
import { Button, Modal } from "../ui";
import { uiStore } from "../../stores/ui";
import { resumeStore } from "../../stores/resume";
import { downloadPdf } from "../../api/render";
import { resumeToJson, isWasmReady } from "../../wasm";

export function ExportModal() {
  const { store: ui, closeModal } = uiStore;
  const { store } = resumeStore;

  const [isExporting, setIsExporting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const isOpen = () => ui.modal === "export";

  const getFileName = () => {
    const name = store.resume?.basics.name || "resume";
    return name.toLowerCase().replace(/\s+/g, "-");
  };

  const handleExportPdf = async () => {
    if (!store.resume) return;

    setIsExporting(true);
    setError(null);

    try {
      await downloadPdf(store.resume, `${getFileName()}.pdf`);
      closeModal();
    } catch (e) {
      console.error("Export error:", e);
      setError(e instanceof Error ? e.message : "Failed to export PDF");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJson = () => {
    if (!store.resume) return;

    try {
      let json: string;

      if (isWasmReady()) {
        json = resumeToJson(store.resume);
      } else {
        json = JSON.stringify(store.resume, null, 2);
      }

      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${getFileName()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      URL.revokeObjectURL(url);
      closeModal();
    } catch (e) {
      console.error("Export error:", e);
      setError(e instanceof Error ? e.message : "Failed to export JSON");
    }
  };

  return (
    <Modal
      open={isOpen()}
      onOpenChange={(open) => !open && closeModal()}
      title="Export Resume"
      description="Download your resume in various formats"
    >
      <div class="space-y-4">
        {/* Export Options */}
        <div class="space-y-3">
          {/* PDF */}
          <button
            class="w-full p-4 flex items-center gap-4 border border-border rounded-xl
              hover:border-accent hover:bg-accent/5 transition-colors text-left group"
            onClick={handleExportPdf}
            disabled={isExporting()}
          >
            <div class="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg class="w-6 h-6 text-red-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 13.5a1 1 0 1 1 0 2h-1a.5.5 0 0 0-.5.5v1.5h-.5a.5.5 0 0 1 0-1H7v-1a1.5 1.5 0 0 1 1.5-1.5zm6.5 0a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-1.5a.5.5 0 0 1-.5-.5v-3a.5.5 0 0 1 .5-.5H15zm-2.5 0a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0v-1h-.5a.5.5 0 0 1 0-1h.5v-1a.5.5 0 0 1 .5-.5z" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-display font-semibold text-ink group-hover:text-accent transition-colors">
                PDF Document
              </div>
              <div class="text-sm text-stone">Best for printing and sharing</div>
            </div>
            <Show
              when={!isExporting()}
              fallback={
                <svg class="w-5 h-5 animate-spin text-accent" viewBox="0 0 24 24">
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                    fill="none"
                  />
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              }
            >
              <svg
                class="w-5 h-5 text-stone group-hover:text-accent transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </Show>
          </button>

          {/* JSON */}
          <button
            class="w-full p-4 flex items-center gap-4 border border-border rounded-xl
              hover:border-accent hover:bg-accent/5 transition-colors text-left group"
            onClick={handleExportJson}
          >
            <div class="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg class="w-6 h-6 text-amber-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5zm4.5 5a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0v-3a.5.5 0 0 1 .5-.5zm5 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 .5.5h.5a.5.5 0 0 1 0 1H15a1.5 1.5 0 0 1-1.5-1.5v-2a.5.5 0 0 1 .5-.5zM8 14a.5.5 0 0 1 .5.5v1a.5.5 0 0 0 .5.5h.5a.5.5 0 0 1 0 1H9a1.5 1.5 0 0 1-1.5-1.5v-1A.5.5 0 0 1 8 14z" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-display font-semibold text-ink group-hover:text-accent transition-colors">
                JSON Data
              </div>
              <div class="text-sm text-stone">Portable format for backups</div>
            </div>
            <svg
              class="w-5 h-5 text-stone group-hover:text-accent transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </button>
        </div>

        {/* Error */}
        <Show when={error()}>
          <div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error()}
          </div>
        </Show>
      </div>

      <div class="mt-6 pt-4 border-t border-border flex justify-end">
        <Button variant="ghost" onClick={closeModal}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
