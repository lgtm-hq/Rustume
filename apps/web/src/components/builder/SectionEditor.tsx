import { For, Show, createSignal, type JSX } from "solid-js";
import { Button, Input, TextArea } from "../ui";
import { resumeStore, type SectionKey } from "../../stores/resume";
import { generateId, createEmptyUrl } from "../../wasm/types";
import type { Experience, Education, Skill, Project } from "../../wasm/types";

interface SectionEditorProps<T> {
  sectionKey: SectionKey;
  title: string;
  icon: string;
  renderItem: (item: T, index: number, update: (updates: Partial<T>) => void) => JSX.Element;
  createItem: () => T;
  getItemTitle: (item: T) => string;
  getItemSubtitle?: (item: T) => string;
}

export function SectionEditor<T extends { id: string; visible: boolean }>(
  props: SectionEditorProps<T>,
) {
  const { store, addSectionItem, updateSectionItem, removeSectionItem, reorderSectionItem } =
    resumeStore;
  const [expandedIndex, setExpandedIndex] = createSignal<number | null>(null);

  const items = () => {
    if (!store.resume) return [];
    return store.resume.sections[props.sectionKey].items as unknown as T[];
  };

  const handleAdd = () => {
    const newItem = props.createItem();
    addSectionItem(props.sectionKey, newItem as never);
    setExpandedIndex(items().length); // Will be the new item's index
  };

  const handleUpdate = (index: number) => (updates: Partial<T>) => {
    updateSectionItem(props.sectionKey, index, updates as never);
  };

  const handleRemove = (index: number) => {
    removeSectionItem(props.sectionKey, index);
    setExpandedIndex(null);
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      reorderSectionItem(props.sectionKey, index, index - 1);
      setExpandedIndex(index - 1);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < items().length - 1) {
      reorderSectionItem(props.sectionKey, index, index + 1);
      setExpandedIndex(index + 1);
    }
  };

  return (
    <div class="space-y-4">
      {/* Header */}
      <div class="flex items-center justify-between pb-4 border-b border-border">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
            <svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d={props.icon}
              />
            </svg>
          </div>
          <div>
            <h2 class="font-display text-lg font-semibold text-ink">{props.title}</h2>
            <p class="text-sm text-stone">{items().length} items</p>
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

      {/* Items */}
      <div class="space-y-2">
        <For each={items()}>
          {(item, index) => (
            <div class="border border-border rounded-lg overflow-hidden">
              {/* Item Header */}
              <button
                class="w-full px-4 py-3 flex items-center justify-between
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
                      {props.getItemTitle(item) || "Untitled"}
                    </div>
                    <Show when={props.getItemSubtitle?.(item)}>
                      <div class="text-sm text-stone truncate">{props.getItemSubtitle!(item)}</div>
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

              {/* Item Content */}
              <Show when={expandedIndex() === index()}>
                <div class="px-4 py-4 border-t border-border space-y-4 bg-paper">
                  {/* Controls */}
                  <div class="flex items-center justify-between pb-3 border-b border-border">
                    <div class="flex items-center gap-2">
                      <button
                        class="p-1.5 text-stone hover:text-ink hover:bg-surface rounded
                          disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        onClick={() => handleMoveUp(index())}
                        disabled={index() === 0}
                        title="Move up"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M5 15l7-7 7 7"
                          />
                        </svg>
                      </button>
                      <button
                        class="p-1.5 text-stone hover:text-ink hover:bg-surface rounded
                          disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        onClick={() => handleMoveDown(index())}
                        disabled={index() === items().length - 1}
                        title="Move down"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      <label class="flex items-center gap-2 cursor-pointer">
                        <span class="text-xs font-mono text-stone">Visible</span>
                        <div
                          class={`w-8 h-5 rounded-full transition-colors relative ${
                            item.visible ? "bg-accent" : "bg-border"
                          }`}
                          onClick={() =>
                            handleUpdate(index())({ visible: !item.visible } as Partial<T>)
                          }
                        >
                          <div
                            class={`absolute top-0.5 w-4 h-4 bg-paper rounded-full shadow-sm
                              transition-transform ${item.visible ? "translate-x-3.5" : "translate-x-0.5"}`}
                          />
                        </div>
                      </label>

                      <button
                        class="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        onClick={() => handleRemove(index())}
                        title="Remove"
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

                  {/* Form Fields */}
                  {props.renderItem(item, index(), handleUpdate(index()))}
                </div>
              </Show>
            </div>
          )}
        </For>

        <Show when={items().length === 0}>
          <div class="py-8 text-center">
            <p class="text-stone text-sm mb-3">No items yet</p>
            <Button variant="secondary" size="sm" onClick={handleAdd}>
              Add your first {props.title.toLowerCase().slice(0, -1)}
            </Button>
          </div>
        </Show>
      </div>
    </div>
  );
}

// Pre-configured section editors

export function ExperienceEditor() {
  return (
    <SectionEditor<Experience>
      sectionKey="experience"
      title="Experience"
      icon="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      createItem={() => ({
        id: generateId(),
        visible: true,
        company: "",
        position: "",
        location: "",
        date: "",
        summary: "",
        url: createEmptyUrl(),
      })}
      getItemTitle={(item) => item.position || item.company}
      getItemSubtitle={(item) => (item.company && item.position ? item.company : "")}
      renderItem={(item, _index, update) => (
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <Input
              label="Position"
              placeholder="Software Engineer"
              value={item.position}
              onInput={(v) => update({ position: v })}
            />
            <Input
              label="Company"
              placeholder="Acme Inc."
              value={item.company}
              onInput={(v) => update({ company: v })}
            />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <Input
              label="Location"
              placeholder="San Francisco, CA"
              value={item.location}
              onInput={(v) => update({ location: v })}
            />
            <Input
              label="Date"
              placeholder="Jan 2020 - Present"
              value={item.date}
              onInput={(v) => update({ date: v })}
            />
          </div>
          <TextArea
            label="Summary"
            placeholder="Describe your responsibilities and achievements..."
            value={item.summary}
            onInput={(v) => update({ summary: v })}
            rows={3}
          />
          <div class="grid grid-cols-2 gap-4">
            <Input
              label="Link Label"
              placeholder="Company website"
              value={item.url.label}
              onInput={(v) => update({ url: { ...item.url, label: v } })}
            />
            <Input
              label="Link URL"
              type="url"
              placeholder="https://..."
              value={item.url.href}
              onInput={(v) => update({ url: { ...item.url, href: v } })}
            />
          </div>
        </div>
      )}
    />
  );
}

export function EducationEditor() {
  return (
    <SectionEditor<Education>
      sectionKey="education"
      title="Education"
      icon="M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
      createItem={() => ({
        id: generateId(),
        visible: true,
        institution: "",
        area: "",
        study_type: "",
        date: "",
        score: "",
        summary: "",
        url: createEmptyUrl(),
      })}
      getItemTitle={(item) => item.institution}
      getItemSubtitle={(item) => item.area || item.study_type}
      renderItem={(item, _index, update) => (
        <div class="space-y-4">
          <Input
            label="Institution"
            placeholder="University of California"
            value={item.institution}
            onInput={(v) => update({ institution: v })}
          />
          <div class="grid grid-cols-2 gap-4">
            <Input
              label="Area of Study"
              placeholder="Computer Science"
              value={item.area}
              onInput={(v) => update({ area: v })}
            />
            <Input
              label="Degree"
              placeholder="Bachelor of Science"
              value={item.study_type}
              onInput={(v) => update({ study_type: v })}
            />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <Input
              label="Date"
              placeholder="2016 - 2020"
              value={item.date}
              onInput={(v) => update({ date: v })}
            />
            <Input
              label="Score/GPA"
              placeholder="3.8 / 4.0"
              value={item.score}
              onInput={(v) => update({ score: v })}
            />
          </div>
          <TextArea
            label="Summary"
            placeholder="Notable achievements, activities..."
            value={item.summary}
            onInput={(v) => update({ summary: v })}
            rows={2}
          />
        </div>
      )}
    />
  );
}

export function SkillsEditor() {
  return (
    <SectionEditor<Skill>
      sectionKey="skills"
      title="Skills"
      icon="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
      createItem={() => ({
        id: generateId(),
        visible: true,
        name: "",
        description: "",
        level: 0,
        keywords: [],
      })}
      getItemTitle={(item) => item.name}
      getItemSubtitle={(item) => item.keywords.slice(0, 3).join(", ")}
      renderItem={(item, _index, update) => (
        <div class="space-y-4">
          <Input
            label="Skill Name"
            placeholder="Web Development"
            value={item.name}
            onInput={(v) => update({ name: v })}
          />
          <Input
            label="Description"
            placeholder="Brief description"
            value={item.description}
            onInput={(v) => update({ description: v })}
          />
          <div>
            <label class="font-mono text-xs uppercase tracking-wider text-stone block mb-2">
              Level ({item.level}/5)
            </label>
            <input
              type="range"
              min="0"
              max="5"
              value={item.level}
              onInput={(e) => update({ level: parseInt(e.currentTarget.value) })}
              class="w-full accent-accent"
            />
          </div>
          <Input
            label="Keywords"
            placeholder="React, TypeScript, Node.js (comma separated)"
            value={item.keywords.join(", ")}
            onInput={(v) =>
              update({
                keywords: v
                  .split(",")
                  .map((k) => k.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
      )}
    />
  );
}

export function ProjectsEditor() {
  return (
    <SectionEditor<Project>
      sectionKey="projects"
      title="Projects"
      icon="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
      createItem={() => ({
        id: generateId(),
        visible: true,
        name: "",
        description: "",
        date: "",
        summary: "",
        keywords: [],
        url: createEmptyUrl(),
      })}
      getItemTitle={(item) => item.name}
      getItemSubtitle={(item) => item.description}
      renderItem={(item, _index, update) => (
        <div class="space-y-4">
          <Input
            label="Project Name"
            placeholder="My Awesome Project"
            value={item.name}
            onInput={(v) => update({ name: v })}
          />
          <Input
            label="Description"
            placeholder="A brief one-liner"
            value={item.description}
            onInput={(v) => update({ description: v })}
          />
          <Input
            label="Date"
            placeholder="2023"
            value={item.date}
            onInput={(v) => update({ date: v })}
          />
          <TextArea
            label="Summary"
            placeholder="Detailed description..."
            value={item.summary}
            onInput={(v) => update({ summary: v })}
            rows={3}
          />
          <Input
            label="Technologies"
            placeholder="React, Rust, PostgreSQL (comma separated)"
            value={item.keywords.join(", ")}
            onInput={(v) =>
              update({
                keywords: v
                  .split(",")
                  .map((k) => k.trim())
                  .filter(Boolean),
              })
            }
          />
          <div class="grid grid-cols-2 gap-4">
            <Input
              label="Link Label"
              placeholder="View Project"
              value={item.url.label}
              onInput={(v) => update({ url: { ...item.url, label: v } })}
            />
            <Input
              label="Link URL"
              type="url"
              placeholder="https://..."
              value={item.url.href}
              onInput={(v) => update({ url: { ...item.url, href: v } })}
            />
          </div>
        </div>
      )}
    />
  );
}
