import { For, Show, createSignal } from "solid-js";
import { Button, Input } from "../ui";
import { LazyRichTextEditor as RichTextEditor } from "../ui/LazyRichTextEditor";
import { LiveRegion, announceLive } from "../ui/LiveRegion";
import { reorderAnnouncement } from "../../lib/reorderAnnounce";
import { resumeStore } from "../../stores/resume";
import { createEmptyUrl, generateId, type CustomItem } from "../../wasm/types";

interface CustomSectionEditorProps {
  sectionId: string;
  onDeleted?: () => void;
}

interface CustomSectionsIndexProps {
  onSelectSection: (sectionId: string) => void;
}

function createCustomItem(): CustomItem {
  return {
    id: generateId(),
    visible: true,
    name: "",
    description: "",
    date: "",
    location: "",
    summary: "",
    keywords: [],
    url: createEmptyUrl(),
  };
}

export function CustomSectionEditor(props: CustomSectionEditorProps) {
  const {
    store,
    updateCustomSection,
    removeCustomSection,
    addCustomSectionItem,
    updateCustomSectionItem,
    removeCustomSectionItem,
    reorderCustomSectionItem,
  } = resumeStore;
  const [expandedIndex, setExpandedIndex] = createSignal<number | null>(null);
  const [revision, setRevision] = createSignal(0);
  const [announcement, setAnnouncement] = createSignal("");

  const touch = () => setRevision((value) => value + 1);
  const section = () => {
    revision();
    return store.resume?.sections.custom[props.sectionId] ?? null;
  };
  const currentSection = () => section()!;
  const items = () => section()?.items ?? [];

  const handleAdd = () => {
    const nextIndex = items().length;
    addCustomSectionItem(props.sectionId, createCustomItem());
    touch();
    setExpandedIndex(nextIndex);
  };

  const handleUpdateSection = (updates: Parameters<typeof updateCustomSection>[1]) => {
    updateCustomSection(props.sectionId, updates);
    touch();
  };

  const handleRemoveSection = () => {
    const current = section();
    if (!current) return;
    const ok = window.confirm(`Delete "${current.name || "Untitled"}"?`);
    if (!ok) return;
    removeCustomSection(props.sectionId);
    props.onDeleted?.();
  };

  const focusReorderControl = (itemIndex: number, direction: "up" | "down") => {
    queueMicrotask(() => {
      document
        .querySelector<HTMLButtonElement>(
          `[data-reorder="${props.sectionId}-${itemIndex}-${direction}"]`,
        )
        ?.focus();
    });
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      const item = items()[index];
      const title = item.name || "Untitled";
      const nextIndex = index - 1;
      reorderCustomSectionItem(props.sectionId, index, nextIndex);
      touch();
      setExpandedIndex(nextIndex);
      announceLive(setAnnouncement, reorderAnnouncement(title, nextIndex, items().length));
      focusReorderControl(nextIndex, nextIndex === 0 ? "down" : "up");
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < items().length - 1) {
      const item = items()[index];
      const title = item.name || "Untitled";
      const nextIndex = index + 1;
      reorderCustomSectionItem(props.sectionId, index, nextIndex);
      touch();
      setExpandedIndex(nextIndex);
      announceLive(setAnnouncement, reorderAnnouncement(title, nextIndex, items().length));
      focusReorderControl(nextIndex, nextIndex === items().length - 1 ? "up" : "down");
    }
  };

  const updateItem = (index: number) => (updates: Partial<CustomItem>) => {
    updateCustomSectionItem(props.sectionId, index, updates);
    touch();
  };

  return (
    <Show
      when={section()}
      fallback={
        <div class="py-10 text-center">
          <p class="text-sm text-stone">Custom section not found</p>
        </div>
      }
    >
      <div class="space-y-4">
        <div class="flex items-start justify-between gap-4 pb-4 border-b border-border">
          <div class="min-w-0 flex-1 space-y-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                <svg
                  class="w-5 h-5 text-accent"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </div>
              <div class="min-w-0">
                <h2 class="font-display text-lg font-semibold text-ink truncate">
                  {currentSection().name || "Untitled"}
                </h2>
                <p class="text-sm text-stone">{items().length} items</p>
              </div>
            </div>
            <Input
              label="Section Name"
              value={currentSection().name}
              onInput={(name) => handleUpdateSection({ name })}
            />
          </div>

          <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              class={`focus-ring relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                currentSection().visible ? "bg-accent" : "bg-border"
              }`}
              aria-label={currentSection().visible ? "Hide section" : "Show section"}
              aria-pressed={currentSection().visible}
              onClick={() => handleUpdateSection({ visible: !currentSection().visible })}
            >
              <span
                class={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-paper shadow-sm
                    transition-transform ${
                      currentSection().visible ? "translate-x-4" : "translate-x-0"
                    }`}
              />
            </button>
            <Button variant="secondary" size="sm" onClick={handleAdd}>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add
            </Button>
            <button
              type="button"
              class="focus-ring p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete custom section"
              aria-label="Delete custom section"
              onClick={handleRemoveSection}
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>

        <div class="space-y-2">
          <For each={items()}>
            {(item, index) => (
              <div class="border border-border rounded-lg overflow-hidden">
                <button
                  type="button"
                  class="focus-ring w-full px-4 py-3 flex items-center justify-between
                      bg-surface hover:bg-border/30 transition-colors text-left"
                  onClick={() => setExpandedIndex(expandedIndex() === index() ? null : index())}
                >
                  <div class="flex items-center gap-3 min-w-0">
                    <div
                      class={`w-2 h-2 rounded-full flex-shrink-0 ${
                        item.visible ? "bg-green-500" : "bg-stone/30"
                      }`}
                    />
                    <div class="min-w-0">
                      <div class="font-body font-medium text-ink truncate">
                        {item.name || "Untitled"}
                      </div>
                      <Show when={item.description || item.keywords.slice(0, 3).join(", ")}>
                        <div class="text-sm text-stone truncate">
                          {item.description || item.keywords.slice(0, 3).join(", ")}
                        </div>
                      </Show>
                    </div>
                  </div>
                  <svg
                    class={`w-5 h-5 text-stone transition-transform flex-shrink-0 ${
                      expandedIndex() === index() ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                <Show when={expandedIndex() === index()}>
                  <div class="px-4 py-4 border-t border-border space-y-4 bg-paper">
                    <div class="flex items-center justify-between pb-3 border-b border-border">
                      <div class="flex items-center gap-2">
                        <button
                          type="button"
                          class="focus-ring p-1.5 text-stone hover:text-ink hover:bg-surface rounded
                              disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          data-reorder={`${props.sectionId}-${index()}-up`}
                          onClick={() => handleMoveUp(index())}
                          disabled={index() === 0}
                          aria-label="Move up"
                          title="Move up"
                        >
                          <svg
                            class="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M5 15l7-7 7 7"
                            />
                          </svg>
                        </button>
                        <button
                          type="button"
                          class="focus-ring p-1.5 text-stone hover:text-ink hover:bg-surface rounded
                              disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          data-reorder={`${props.sectionId}-${index()}-down`}
                          onClick={() => handleMoveDown(index())}
                          disabled={index() === items().length - 1}
                          aria-label="Move down"
                          title="Move down"
                        >
                          <svg
                            class="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>
                      </div>

                      <div class="flex items-center gap-3">
                        <div class="flex items-center gap-2">
                          <span
                            id={`custom-item-${props.sectionId}-${index()}-visible-label`}
                            class="text-xs font-mono text-stone"
                          >
                            Visible
                          </span>
                          <button
                            type="button"
                            aria-pressed={item.visible}
                            aria-labelledby={`custom-item-${props.sectionId}-${index()}-visible-label`}
                            class={`w-8 h-5 rounded-full transition-colors relative ${
                              item.visible ? "bg-accent" : "bg-border"
                            }`}
                            onClick={() => updateItem(index())({ visible: !item.visible })}
                          >
                            <span
                              class={`absolute top-0.5 w-4 h-4 bg-paper rounded-full shadow-sm
                                  transition-transform ${
                                    item.visible ? "translate-x-3.5" : "translate-x-0.5"
                                  }`}
                            />
                          </button>
                        </div>

                        <button
                          type="button"
                          class="focus-ring p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          onClick={() => {
                            removeCustomSectionItem(props.sectionId, index());
                            touch();
                            setExpandedIndex(null);
                          }}
                          aria-label="Remove"
                          title="Remove"
                        >
                          <svg
                            class="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div class="space-y-4">
                      <div class="grid grid-cols-2 gap-4">
                        <Input
                          label="Name"
                          placeholder="Tooling"
                          value={item.name}
                          onInput={(name) => updateItem(index())({ name })}
                        />
                        <Input
                          label="Description"
                          placeholder="Brief description"
                          value={item.description}
                          onInput={(description) => updateItem(index())({ description })}
                        />
                      </div>
                      <div class="grid grid-cols-2 gap-4">
                        <Input
                          label="Date"
                          placeholder="2024"
                          value={item.date}
                          onInput={(date) => updateItem(index())({ date })}
                        />
                        <Input
                          label="Location"
                          placeholder="Remote"
                          value={item.location}
                          onInput={(location) => updateItem(index())({ location })}
                        />
                      </div>
                      <RichTextEditor
                        label="Summary"
                        placeholder="Describe this item..."
                        value={item.summary}
                        onInput={(summary) => updateItem(index())({ summary })}
                      />
                      <Input
                        label="Keywords"
                        placeholder="Playwright, Vitest, Jest (comma separated)"
                        value={item.keywords.join(", ")}
                        onInput={(value) =>
                          updateItem(index())({
                            keywords: value
                              .split(",")
                              .map((keyword) => keyword.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                      <div class="grid grid-cols-2 gap-4">
                        <Input
                          label="Link Label"
                          placeholder="Website"
                          value={item.url.label}
                          onInput={(label) => updateItem(index())({ url: { ...item.url, label } })}
                        />
                        <Input
                          label="Link URL"
                          type="url"
                          placeholder="https://..."
                          value={item.url.href}
                          onInput={(href) => updateItem(index())({ url: { ...item.url, href } })}
                        />
                      </div>
                    </div>
                  </div>
                </Show>
              </div>
            )}
          </For>

          <Show when={items().length === 0}>
            <div class="py-8 text-center">
              <p class="text-stone text-sm mb-3">No items yet</p>
              <Button variant="secondary" size="sm" onClick={handleAdd}>
                Add your first item
              </Button>
            </div>
          </Show>
        </div>

        <LiveRegion message={announcement()} />
      </div>
    </Show>
  );
}

export function CustomSectionsIndex(props: CustomSectionsIndexProps) {
  const { store, addCustomSection, updateCustomSection, removeCustomSection } = resumeStore;

  const customSections = () =>
    Object.entries(store.resume?.sections.custom ?? {}).map(([id, section]) => ({ id, section }));

  const handleAdd = () => {
    const id = addCustomSection("Custom Section");
    props.onSelectSection(id);
  };

  const handleRemove = (sectionId: string, name: string) => {
    const ok = window.confirm(`Delete "${name || "Untitled"}"?`);
    if (!ok) return;
    removeCustomSection(sectionId);
  };

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between gap-4 pb-4 border-b border-border">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
            <svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
          </div>
          <div class="min-w-0">
            <h2 class="font-display text-lg font-semibold text-ink">Custom Sections</h2>
            <p class="text-sm text-stone">{customSections().length} sections</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={handleAdd}>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add
        </Button>
      </div>

      <div class="space-y-2">
        <For each={customSections()}>
          {({ id, section }) => (
            <div class="border border-border rounded-lg p-3 space-y-3">
              <div class="flex items-center gap-3">
                <button
                  type="button"
                  class={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
                    section.visible ? "bg-accent" : "bg-border"
                  }`}
                  title={section.visible ? "Hide section" : "Show section"}
                  aria-label={section.visible ? "Hide section" : "Show section"}
                  aria-pressed={section.visible}
                  onClick={() => updateCustomSection(id, { visible: !section.visible })}
                >
                  <span
                    class={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-paper shadow-sm
                      transition-transform ${section.visible ? "translate-x-4" : "translate-x-0"}`}
                  />
                </button>
                <div class="min-w-0 flex-1">
                  <Input
                    label="Section Name"
                    value={section.name}
                    onInput={(name) => updateCustomSection(id, { name })}
                  />
                </div>
              </div>

              <div class="flex items-center justify-between gap-3">
                <span class="text-xs font-mono text-stone">{section.items.length} items</span>
                <div class="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => props.onSelectSection(id)}>
                    Edit Items
                  </Button>
                  <button
                    type="button"
                    class="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete custom section"
                    aria-label="Delete custom section"
                    onClick={() => handleRemove(id, section.name)}
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </For>

        <Show when={customSections().length === 0}>
          <div class="py-8 text-center">
            <p class="text-stone text-sm mb-3">No custom sections yet</p>
            <Button variant="secondary" size="sm" onClick={handleAdd}>
              Add custom section
            </Button>
          </div>
        </Show>
      </div>
    </div>
  );
}
