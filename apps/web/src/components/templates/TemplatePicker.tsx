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

  const handleSelect = (template: TemplateInfo) => {
    updateTemplate(template.id);
    updateTheme(template.theme);
    closeModal();
  };

  const isOpen = () => ui.modal === "template";

  return (
    <Modal
      open={isOpen()}
      onOpenChange={(open) => !open && closeModal()}
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
        <Show when={templates.error}>
          <div class="text-center py-8 text-red-600">
            Failed to load templates. Please try again.
          </div>
        </Show>

        <div class="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[70vh] overflow-y-auto p-1">
          <For each={templates()}>
            {(template) => (
              <TemplateCard
                template={template}
                isSelected={store.resume?.metadata.template === template.id}
                onSelect={handleSelect}
              />
            )}
          </For>
        </div>
      </Show>

      <div class="mt-6 pt-4 border-t border-border flex justify-end">
        <Button variant="ghost" onClick={closeModal}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}

function TemplateCard(props: {
  template: TemplateInfo;
  isSelected: boolean;
  onSelect: (template: TemplateInfo) => void;
}) {
  const [imageLoaded, setImageLoaded] = createSignal(false);
  const [imageError, setImageError] = createSignal(false);

  const thumbnailUrl = () => getTemplateThumbnailUrl(props.template.id);

  return (
    <button
      class={`group relative rounded-xl border-2 transition-all duration-200 overflow-hidden
        hover:border-accent hover:shadow-card
        ${props.isSelected ? "border-accent ring-2 ring-accent/20" : "border-border"}`}
      onClick={() => props.onSelect(props.template)}
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
                <>
                  {/* Fallback: Color Preview */}
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
                </>
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

        {/* Hover Overlay */}
        <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
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
    </button>
  );
}
