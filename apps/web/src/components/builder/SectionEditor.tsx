import { For, Show, createSignal, type JSX } from "solid-js";
import { Button, Input, RichTextEditor } from "../ui";
import { resumeStore, type SectionKey } from "../../stores/resume";
import { generateId, createEmptyUrl } from "../../wasm/types";
import type {
  Experience,
  Education,
  Skill,
  Project,
  Profile,
  Award,
  Certification,
  Publication,
  Language,
  Interest,
  Volunteer,
  Reference,
} from "../../wasm/types";

// Singularize section titles for better UX
const SINGULAR_MAP: Record<string, string> = {
  Experience: "experience",
  Education: "education",
  Skills: "skill",
  Projects: "project",
  Profiles: "profile",
  Certifications: "certification",
  Awards: "award",
  Publications: "publication",
  Languages: "language",
  Interests: "interest",
  Volunteer: "volunteer",
  References: "reference",
};

function singularize(title: string): string {
  return SINGULAR_MAP[title] || title.toLowerCase().replace(/s$/, "");
}

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
    setExpandedIndex(items().length - 1); // New item is at the last index
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
              Add your first {singularize(props.title)}
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
          <RichTextEditor
            label="Summary"
            placeholder="Describe your responsibilities and achievements..."
            value={item.summary}
            onInput={(v) => update({ summary: v })}
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
        studyType: "",
        date: "",
        score: "",
        summary: "",
        url: createEmptyUrl(),
      })}
      getItemTitle={(item) => item.institution}
      getItemSubtitle={(item) => item.area || item.studyType}
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
              value={item.studyType}
              onInput={(v) => update({ studyType: v })}
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
          <RichTextEditor
            label="Summary"
            placeholder="Notable achievements, activities..."
            value={item.summary}
            onInput={(v) => update({ summary: v })}
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
          <RichTextEditor
            label="Summary"
            placeholder="Detailed description..."
            value={item.summary}
            onInput={(v) => update({ summary: v })}
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

export function ProfilesEditor() {
  return (
    <SectionEditor<Profile>
      sectionKey="profiles"
      title="Profiles"
      icon="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
      createItem={() => ({
        id: generateId(),
        visible: true,
        network: "",
        username: "",
        icon: "",
        url: createEmptyUrl(),
      })}
      getItemTitle={(item) => item.network || item.username}
      getItemSubtitle={(item) => (item.network && item.username ? `@${item.username}` : "")}
      renderItem={(item, _index, update) => (
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <Input
              label="Network"
              placeholder="GitHub"
              value={item.network}
              onInput={(v) => update({ network: v, icon: v.toLowerCase() })}
            />
            <Input
              label="Username"
              placeholder="johndoe"
              value={item.username}
              onInput={(v) => update({ username: v })}
            />
          </div>
          <Input
            label="Icon"
            placeholder="github (auto-set from network)"
            value={item.icon}
            onInput={(v) => update({ icon: v })}
          />
          <div class="grid grid-cols-2 gap-4">
            <Input
              label="Link Label"
              placeholder="Profile"
              value={item.url.label}
              onInput={(v) => update({ url: { ...item.url, label: v } })}
            />
            <Input
              label="Link URL"
              type="url"
              placeholder="https://github.com/johndoe"
              value={item.url.href}
              onInput={(v) => update({ url: { ...item.url, href: v } })}
            />
          </div>
        </div>
      )}
    />
  );
}

export function AwardsEditor() {
  return (
    <SectionEditor<Award>
      sectionKey="awards"
      title="Awards"
      icon="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
      createItem={() => ({
        id: generateId(),
        visible: true,
        title: "",
        awarder: "",
        date: "",
        summary: "",
        url: createEmptyUrl(),
      })}
      getItemTitle={(item) => item.title}
      getItemSubtitle={(item) => item.awarder}
      renderItem={(item, _index, update) => (
        <div class="space-y-4">
          <Input
            label="Title"
            placeholder="Best Paper Award"
            value={item.title}
            onInput={(v) => update({ title: v })}
          />
          <div class="grid grid-cols-2 gap-4">
            <Input
              label="Awarder"
              placeholder="IEEE"
              value={item.awarder}
              onInput={(v) => update({ awarder: v })}
            />
            <Input
              label="Date"
              placeholder="2023"
              value={item.date}
              onInput={(v) => update({ date: v })}
            />
          </div>
          <RichTextEditor
            label="Summary"
            placeholder="Describe the award and why you received it..."
            value={item.summary}
            onInput={(v) => update({ summary: v })}
          />
          <div class="grid grid-cols-2 gap-4">
            <Input
              label="Link Label"
              placeholder="Award page"
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

export function CertificationsEditor() {
  return (
    <SectionEditor<Certification>
      sectionKey="certifications"
      title="Certifications"
      icon="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
      createItem={() => ({
        id: generateId(),
        visible: true,
        name: "",
        issuer: "",
        date: "",
        summary: "",
        url: createEmptyUrl(),
      })}
      getItemTitle={(item) => item.name}
      getItemSubtitle={(item) => item.issuer}
      renderItem={(item, _index, update) => (
        <div class="space-y-4">
          <Input
            label="Certification Name"
            placeholder="AWS Solutions Architect"
            value={item.name}
            onInput={(v) => update({ name: v })}
          />
          <div class="grid grid-cols-2 gap-4">
            <Input
              label="Issuer"
              placeholder="Amazon Web Services"
              value={item.issuer}
              onInput={(v) => update({ issuer: v })}
            />
            <Input
              label="Date"
              placeholder="2023"
              value={item.date}
              onInput={(v) => update({ date: v })}
            />
          </div>
          <RichTextEditor
            label="Summary"
            placeholder="Details about the certification..."
            value={item.summary}
            onInput={(v) => update({ summary: v })}
          />
          <div class="grid grid-cols-2 gap-4">
            <Input
              label="Link Label"
              placeholder="Verify credential"
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

export function PublicationsEditor() {
  return (
    <SectionEditor<Publication>
      sectionKey="publications"
      title="Publications"
      icon="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
      createItem={() => ({
        id: generateId(),
        visible: true,
        name: "",
        publisher: "",
        date: "",
        summary: "",
        url: createEmptyUrl(),
      })}
      getItemTitle={(item) => item.name}
      getItemSubtitle={(item) => item.publisher}
      renderItem={(item, _index, update) => (
        <div class="space-y-4">
          <Input
            label="Publication Name"
            placeholder="Machine Learning in Practice"
            value={item.name}
            onInput={(v) => update({ name: v })}
          />
          <div class="grid grid-cols-2 gap-4">
            <Input
              label="Publisher"
              placeholder="IEEE / ACM / Springer"
              value={item.publisher}
              onInput={(v) => update({ publisher: v })}
            />
            <Input
              label="Date"
              placeholder="2023"
              value={item.date}
              onInput={(v) => update({ date: v })}
            />
          </div>
          <RichTextEditor
            label="Summary"
            placeholder="Abstract or description of the publication..."
            value={item.summary}
            onInput={(v) => update({ summary: v })}
          />
          <div class="grid grid-cols-2 gap-4">
            <Input
              label="Link Label"
              placeholder="Read paper"
              value={item.url.label}
              onInput={(v) => update({ url: { ...item.url, label: v } })}
            />
            <Input
              label="Link URL"
              type="url"
              placeholder="https://doi.org/..."
              value={item.url.href}
              onInput={(v) => update({ url: { ...item.url, href: v } })}
            />
          </div>
        </div>
      )}
    />
  );
}

export function LanguagesEditor() {
  return (
    <SectionEditor<Language>
      sectionKey="languages"
      title="Languages"
      icon="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
      createItem={() => ({
        id: generateId(),
        visible: true,
        name: "",
        description: "",
        level: 0,
      })}
      getItemTitle={(item) => item.name}
      getItemSubtitle={(item) => item.description}
      renderItem={(item, _index, update) => (
        <div class="space-y-4">
          <Input
            label="Language"
            placeholder="English"
            value={item.name}
            onInput={(v) => update({ name: v })}
          />
          <Input
            label="Proficiency"
            placeholder="Native, Fluent, Intermediate, Basic"
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
        </div>
      )}
    />
  );
}

export function InterestsEditor() {
  return (
    <SectionEditor<Interest>
      sectionKey="interests"
      title="Interests"
      icon="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
      createItem={() => ({
        id: generateId(),
        visible: true,
        name: "",
        keywords: [],
      })}
      getItemTitle={(item) => item.name}
      getItemSubtitle={(item) => item.keywords.slice(0, 3).join(", ")}
      renderItem={(item, _index, update) => (
        <div class="space-y-4">
          <Input
            label="Interest"
            placeholder="Open Source"
            value={item.name}
            onInput={(v) => update({ name: v })}
          />
          <Input
            label="Keywords"
            placeholder="Linux, Rust, WebAssembly (comma separated)"
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

export function VolunteerEditor() {
  return (
    <SectionEditor<Volunteer>
      sectionKey="volunteer"
      title="Volunteer"
      icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      createItem={() => ({
        id: generateId(),
        visible: true,
        organization: "",
        position: "",
        location: "",
        date: "",
        summary: "",
        url: createEmptyUrl(),
      })}
      getItemTitle={(item) => item.position || item.organization}
      getItemSubtitle={(item) => (item.organization && item.position ? item.organization : "")}
      renderItem={(item, _index, update) => (
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <Input
              label="Position"
              placeholder="Volunteer Coordinator"
              value={item.position}
              onInput={(v) => update({ position: v })}
            />
            <Input
              label="Organization"
              placeholder="Red Cross"
              value={item.organization}
              onInput={(v) => update({ organization: v })}
            />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <Input
              label="Location"
              placeholder="New York, NY"
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
          <RichTextEditor
            label="Summary"
            placeholder="Describe your volunteer activities and impact..."
            value={item.summary}
            onInput={(v) => update({ summary: v })}
          />
          <div class="grid grid-cols-2 gap-4">
            <Input
              label="Link Label"
              placeholder="Organization website"
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

export function ReferencesEditor() {
  return (
    <SectionEditor<Reference>
      sectionKey="references"
      title="References"
      icon="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      createItem={() => ({
        id: generateId(),
        visible: true,
        name: "",
        description: "",
        summary: "",
        url: createEmptyUrl(),
      })}
      getItemTitle={(item) => item.name}
      getItemSubtitle={(item) => item.description}
      renderItem={(item, _index, update) => (
        <div class="space-y-4">
          <Input
            label="Name"
            placeholder="Jane Smith"
            value={item.name}
            onInput={(v) => update({ name: v })}
          />
          <Input
            label="Description"
            placeholder="Former Manager at Acme Inc."
            value={item.description}
            onInput={(v) => update({ description: v })}
          />
          <RichTextEditor
            label="Summary"
            placeholder="Reference details or testimonial..."
            value={item.summary}
            onInput={(v) => update({ summary: v })}
          />
          <div class="grid grid-cols-2 gap-4">
            <Input
              label="Link Label"
              placeholder="LinkedIn"
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
