import { createSignal, Show } from "solid-js";
import { Button, Modal } from "../ui";
import { uiStore } from "../../stores/ui";
import { resumeStore } from "../../stores/resume";
import {
  parseJsonResume,
  parseReactiveResumeV3,
  parseLinkedInExport,
  isWasmReady,
} from "../../wasm";
import type { ResumeData } from "../../wasm/types";
import { parseResume } from "../../api/render";

type ImportFormat = "json-resume" | "rrv3" | "linkedin" | "rustume";

// Safe base64 encoding for large arrays (avoids call stack overflow)
function uint8ArrayToBase64(data: Uint8Array): string {
  const CHUNK_SIZE = 0x8000; // 32KB chunks
  const chunks: string[] = [];
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const chunk = data.subarray(i, i + CHUNK_SIZE);
    chunks.push(String.fromCharCode.apply(null, chunk as unknown as number[]));
  }
  return btoa(chunks.join(""));
}

export function ImportModal() {
  const { store: ui, closeModal } = uiStore;
  const { importResume } = resumeStore;

  const [isDragging, setIsDragging] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const isOpen = () => ui.modal === "import";

  const detectFormat = (filename: string): ImportFormat => {
    if (filename.endsWith(".zip")) return "linkedin";
    return "json-resume"; // Default, will try to detect from content
  };

  const handleFile = async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      const format = detectFormat(file.name);

      if (format === "linkedin") {
        // LinkedIn ZIP needs binary handling
        const buffer = await file.arrayBuffer();
        const data = new Uint8Array(buffer);

        if (isWasmReady()) {
          const resume = parseLinkedInExport(data);
          importResume(resume);
        } else {
          // Use server API with safe chunked base64 encoding
          const base64 = uint8ArrayToBase64(data);
          const resume = await parseResume({
            format: "linkedin",
            data: base64,
            base64: true,
          });
          importResume(resume);
        }
      } else {
        // JSON formats
        const text = await file.text();
        let parsed: ResumeData;

        // Try to detect format from content
        const json = JSON.parse(text);

        if (isWasmReady()) {
          if (json.basics && json.meta) {
            // Looks like Reactive Resume V3
            parsed = parseReactiveResumeV3(text);
          } else if (json.basics) {
            // JSON Resume format
            parsed = parseJsonResume(text);
          } else if (json.sections && json.metadata) {
            // Native Rustume format - validate basic structure
            parsed = json as ResumeData;
          } else {
            throw new Error("Unrecognized resume format");
          }
        } else {
          // Use server API
          let serverFormat: ImportFormat = "json-resume";
          if (json.basics && json.meta) {
            serverFormat = "rrv3";
          } else if (json.sections) {
            serverFormat = "rustume";
          }

          parsed = await parseResume({
            format: serverFormat,
            data: text,
          });
        }

        importResume(parsed);
      }

      closeModal();
    } catch (e) {
      console.error("Import error:", e);
      setError(e instanceof Error ? e.message : "Failed to import file");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer?.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileInput = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  return (
    <Modal
      open={isOpen()}
      onOpenChange={(open) => !open && closeModal()}
      title="Import Resume"
      description="Import from JSON Resume, Reactive Resume, or LinkedIn export"
    >
      <div class="space-y-4">
        {/* Drop Zone */}
        <div
          class={`relative border-2 border-dashed rounded-xl p-8 text-center
            transition-colors ${
              isDragging() ? "border-accent bg-accent/5" : "border-border hover:border-stone"
            }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            type="file"
            accept=".json,.zip"
            onChange={handleFileInput}
            class="absolute inset-0 opacity-0 cursor-pointer"
          />

          <div class="space-y-3">
            <div class="w-12 h-12 mx-auto bg-surface rounded-xl flex items-center justify-center">
              <svg class="w-6 h-6 text-stone" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>

            <div>
              <p class="font-body text-ink">
                Drop your file here, or <span class="text-accent font-medium">browse</span>
              </p>
              <p class="text-sm text-stone mt-1">
                Supports JSON Resume, Reactive Resume V3, LinkedIn ZIP
              </p>
            </div>
          </div>
        </div>

        {/* Loading */}
        <Show when={isLoading()}>
          <div class="flex items-center justify-center gap-2 py-2 text-stone">
            <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24">
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
            <span class="text-sm">Importing...</span>
          </div>
        </Show>

        {/* Error */}
        <Show when={error()}>
          <div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error()}
          </div>
        </Show>

        {/* Supported Formats */}
        <div class="pt-4 border-t border-border">
          <h4 class="font-mono text-xs uppercase tracking-wider text-stone mb-3">
            Supported Formats
          </h4>
          <div class="grid grid-cols-3 gap-3">
            <div class="p-3 bg-surface rounded-lg text-center">
              <div class="font-mono text-xs text-accent mb-1">JSON Resume</div>
              <div class="text-xs text-stone">.json</div>
            </div>
            <div class="p-3 bg-surface rounded-lg text-center">
              <div class="font-mono text-xs text-accent mb-1">Reactive Resume</div>
              <div class="text-xs text-stone">v3 .json</div>
            </div>
            <div class="p-3 bg-surface rounded-lg text-center">
              <div class="font-mono text-xs text-accent mb-1">LinkedIn</div>
              <div class="text-xs text-stone">.zip export</div>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-6 pt-4 border-t border-border flex justify-end">
        <Button variant="ghost" onClick={closeModal}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
