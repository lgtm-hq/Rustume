/**
 * The templates drawer: chrome around the sheet for switching templates.
 *
 * Cards come from the server template registry (`GET /api/templates`) — id,
 * name, theme and the layout block — with server-rendered thumbnails. There is
 * no client-side template table to drift from the server's.
 *
 * Switching goes through `applyTemplate` in `docEdits`, which lands
 * `metadata.template` and the freshly derived `metadata.layout` as one store
 * action — a single undo entry — re-placing custom sections the new template's
 * defaults do not mention. The sheet re-renders from the new layout reactively;
 * nothing here touches the page frames or their drop zones.
 */

import { For, Show, Suspense, createResource, createSignal, type JSX } from "solid-js";
import { Button, Drawer, Spinner } from "../ui";
import { fetchTemplates, getTemplateThumbnailUrl } from "../../api/render";
import { FALLBACK_TEMPLATE_LAYOUT, type TemplateLayoutMode } from "../../lib/docLayout";
import { applyTemplate } from "./docEdits";
import type { ResumeData, TemplateInfo } from "../../wasm/types";

const LAYOUT_MODE_LABELS: Readonly<Record<TemplateLayoutMode, string>> = {
  single: "Single column",
  "sidebar-left": "Left sidebar",
  "sidebar-right": "Right sidebar",
  "header-split": "Split header",
};

/** One line of layout metadata for a card, e.g. "Left sidebar · 180pt sidebar". */
function layoutSummary(template: TemplateInfo): string {
  const layout = template.layout;
  if (!layout) return "";
  const mode = LAYOUT_MODE_LABELS[layout.layoutMode];
  return layout.sidebarWidth === null ? mode : `${mode} · ${layout.sidebarWidth}pt sidebar`;
}

export interface TemplatesDrawerProps {
  resume: ResumeData;
}

export function TemplatesDrawer(props: TemplatesDrawerProps): JSX.Element {
  const [open, setOpen] = createSignal(false);
  // Latches true on first open so the registry is fetched once, lazily.
  const [requested, setRequested] = createSignal(false);
  const [templates, { refetch }] = createResource(
    () => requested() || undefined,
    () => fetchTemplates(),
  );

  function select(template: TemplateInfo): void {
    applyTemplate(template.id, template.layout ?? FALLBACK_TEMPLATE_LAYOUT);
    setOpen(false);
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setRequested(true);
          setOpen(true);
        }}
      >
        Templates
      </Button>

      <Drawer
        open={open()}
        onOpenChange={setOpen}
        title="Templates"
        description="Pick a design from the registry; your sections come along."
        side="left"
      >
        <Suspense
          fallback={
            <div class="flex items-center justify-center py-12">
              <Spinner />
            </div>
          }
        >
          <Show
            when={!templates.error}
            fallback={
              <div class="flex flex-col items-center gap-3 py-8">
                <p class="text-center text-sm text-red-600" role="alert">
                  Failed to load templates. Check that the server is running and try again.
                </p>
                <Button variant="secondary" size="sm" onClick={() => void refetch()}>
                  Retry
                </Button>
              </div>
            }
          >
            <Show
              when={templates()?.length}
              fallback={<p class="py-8 text-center text-sm text-stone">No templates available.</p>}
            >
              <ul class="grid grid-cols-2 gap-3" data-testid="templates-drawer-list">
                <For each={templates()}>
                  {(template) => (
                    <li>
                      <TemplateCard
                        template={template}
                        isCurrent={props.resume.metadata.template === template.id}
                        onSelect={select}
                      />
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </Show>
        </Suspense>
      </Drawer>
    </>
  );
}

function TemplateCard(props: {
  template: TemplateInfo;
  isCurrent: boolean;
  onSelect: (template: TemplateInfo) => void;
}): JSX.Element {
  const [imageLoaded, setImageLoaded] = createSignal(false);
  const [imageError, setImageError] = createSignal(false);

  return (
    <button
      type="button"
      class={`focus-ring group w-full overflow-hidden rounded-lg border-2 text-left
        transition-colors hover:border-accent
        ${props.isCurrent ? "border-accent ring-2 ring-accent/20" : "border-border"}`}
      aria-label={`Use ${props.template.name} template`}
      aria-pressed={props.isCurrent}
      onClick={() => props.onSelect(props.template)}
    >
      <div class="relative aspect-[3/4] bg-surface">
        <Show when={!imageError()}>
          <img
            src={getTemplateThumbnailUrl(props.template.id)}
            alt=""
            loading="lazy"
            class={`h-full w-full object-cover object-top transition-opacity duration-300
              ${imageLoaded() ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        </Show>
        {/* Lightweight placeholder while the server thumbnail loads (or fails):
            the template's own theme swatches, so the card is never blank. */}
        <Show when={!imageLoaded() || imageError()}>
          <div
            class="absolute inset-0 flex items-center justify-center gap-1.5"
            data-testid="template-thumbnail-placeholder"
          >
            <span
              class="h-6 w-6 rounded border border-border/50"
              style={{ background: props.template.theme.background }}
            />
            <span class="h-6 w-6 rounded" style={{ background: props.template.theme.primary }} />
            <span class="h-6 w-6 rounded" style={{ background: props.template.theme.text }} />
          </div>
        </Show>
      </div>

      <div class="border-t border-border bg-paper p-2">
        <p class="font-display text-sm font-semibold capitalize text-ink">
          {props.template.name}
          <Show when={props.isCurrent}>
            <span class="ml-1.5 font-mono text-[10px] uppercase tracking-wider text-accent">
              Current
            </span>
          </Show>
        </p>
        <Show when={layoutSummary(props.template)}>
          {(summary) => <p class="mt-0.5 text-xs text-stone">{summary()}</p>}
        </Show>
      </div>
    </button>
  );
}
