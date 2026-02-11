import { createResource, createSignal, For, Show } from "solid-js";
import { Button, Modal } from "../ui";
import { fetchTemplates, getTemplateThumbnailUrl } from "../../api/render";
import { resumeStore } from "../../stores/resume";
import { uiStore } from "../../stores/ui";
import type { TemplateInfo } from "../../wasm/types";

export function TemplatePicker() {
  const { store: ui, closeModal } = uiStore;
  const { store, updateTemplate, updateTheme } = resumeStore;

  const [templates] = createResource(fetchTemplates);
  const [previewing, setPreviewing] = createSignal<TemplateInfo | null>(null);

  const handleSelect = (template: TemplateInfo) => {
    updateTemplate(template.id);
    updateTheme(template.theme);
    setPreviewing(null);
    closeModal();
  };

  const isOpen = () => ui.modal === "template";

  return (
    <Modal
      open={isOpen()}
      onOpenChange={(open) => {
        if (!open) {
          setPreviewing(null);
          closeModal();
        }
      }}
      title="Choose Template"
      description="Select a design that fits your style"
      size="xl"
    >
      <Show
        when={!templates.loading}
        fallback={
          <div class="flex items-center justify-center py-12">
            <svg class="w-6 h-6 animate-spin text-accent" viewBox="0 0 24 24">
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
          </div>
        }
      >
        <Show
          when={!templates.error}
          fallback={
            <div class="text-center py-8 text-red-600">
              Failed to load templates. Please try again.
            </div>
          }
        >
          {/* Lightbox preview */}
          <Show when={previewing()}>
            {(template) => (
              <div class="flex flex-col items-center gap-4 py-2">
                <div class="flex items-center justify-between w-full px-1">
                  <button
                    class="flex items-center gap-1.5 text-sm text-stone hover:text-ink transition-colors"
                    onClick={() => setPreviewing(null)}
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                    Back to templates
                  </button>
                  <h3 class="font-display font-semibold text-ink text-base">{template().name}</h3>
                  <Button variant="primary" onClick={() => handleSelect(template())}>
                    Use Template
                  </Button>
                </div>
                <div class="max-h-[65vh] overflow-auto rounded-lg shadow-elevated border border-border">
                  <img
                    src={getTemplateThumbnailUrl(template().id)}
                    alt={`${template().name} template preview`}
                    class="w-full max-w-[500px]"
                  />
                </div>
              </div>
            )}
          </Show>

          {/* Template grid */}
          <Show when={!previewing()}>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[70vh] overflow-y-auto p-1">
              <For each={templates()}>
                {(template) => (
                  <TemplateCard
                    template={template}
                    isSelected={store.resume?.metadata.template === template.id}
                    onSelect={handleSelect}
                    onPreview={setPreviewing}
                  />
                )}
              </For>
            </div>
          </Show>
        </Show>
      </Show>

      <Show when={!previewing()}>
        <div class="mt-6 pt-4 border-t border-border flex justify-end">
          <Button variant="ghost" onClick={closeModal}>
            Cancel
          </Button>
        </div>
      </Show>
    </Modal>
  );
}

function TemplateCard(props: {
  template: TemplateInfo;
  isSelected: boolean;
  onSelect: (template: TemplateInfo) => void;
  onPreview: (template: TemplateInfo) => void;
}) {
  const [imageLoaded, setImageLoaded] = createSignal(false);
  const [imageError, setImageError] = createSignal(false);

  const thumbnailUrl = () => getTemplateThumbnailUrl(props.template.id);

  return (
    <div
      class={`group relative rounded-xl border-2 transition-all duration-200 overflow-hidden
        hover:border-accent hover:shadow-card
        ${props.isSelected ? "border-accent ring-2 ring-accent/20" : "border-border"}`}
    >
      {/* Thumbnail Preview */}
      <div class="relative aspect-[3/4] bg-muted/30">
        <Show when={!imageError()}>
          <img
            src={thumbnailUrl()}
            alt={`${props.template.name} template preview`}
            class={`w-full h-full object-cover object-top transition-opacity duration-300
              ${imageLoaded() ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            loading="lazy"
          />
        </Show>

        {/* Loading/Fallback State */}
        <Show when={!imageLoaded() || imageError()}>
          <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
            <Show
              when={!imageError()}
              fallback={
                <div class="flex gap-2">
                  <div
                    class="w-8 h-8 rounded-lg shadow-soft border border-border/50"
                    style={{ background: props.template.theme.background }}
                  />
                  <div
                    class="w-8 h-8 rounded-lg shadow-soft"
                    style={{ background: props.template.theme.text }}
                  />
                  <div
                    class="w-8 h-8 rounded-lg shadow-soft"
                    style={{ background: props.template.theme.primary }}
                  />
                </div>
              }
            >
              <svg class="w-5 h-5 animate-spin text-muted" viewBox="0 0 24 24">
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
            </Show>
          </div>
        </Show>

        {/* Hover Actions */}
        <div
          class="absolute inset-x-0 bottom-0 p-2 flex justify-center gap-1.5
          opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0
          transition-all duration-150"
        >
          <button
            class="w-8 h-8 flex items-center justify-center rounded-full
              bg-white/90 hover:bg-white text-gray-700 shadow-md
              backdrop-blur-sm transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              props.onPreview(props.template);
            }}
            title="Preview"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          </button>
          <button
            class="w-8 h-8 flex items-center justify-center rounded-full
              bg-accent hover:bg-accent/90 text-white shadow-md
              backdrop-blur-sm transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              props.onSelect(props.template);
            }}
            title="Use template"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Template Info */}
      <div class="p-3 bg-surface border-t border-border">
        <div class="flex items-center justify-between">
          <div class="text-left">
            <h3 class="font-display font-semibold text-ink capitalize text-sm">
              {props.template.name}
            </h3>
            <div class="flex gap-1 mt-1">
              <div
                class="w-3 h-3 rounded-full border border-border/50"
                style={{ background: props.template.theme.primary }}
                title="Primary color"
              />
              <div
                class="w-3 h-3 rounded-full border border-border/50"
                style={{ background: props.template.theme.text }}
                title="Text color"
              />
              <div
                class="w-3 h-3 rounded-full border border-border/50"
                style={{ background: props.template.theme.background }}
                title="Background color"
              />
            </div>
          </div>

          {/* Selected Indicator */}
          <Show when={props.isSelected}>
            <div class="w-6 h-6 rounded-full bg-accent flex items-center justify-center">
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
