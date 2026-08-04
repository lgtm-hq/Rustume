/**
 * Section views for the document sheet, with editing in place (#794).
 *
 * Every section renders inside {@link SectionChrome} — the universal dashed
 * card with grip, pencil menu and add-block — and every structured item inside
 * {@link SortableEntry} row chrome. The body layouts follow spec §1.7 exactly:
 *
 * - `experience`: position over a company · date meta row, a location row with
 *   a pin glyph, then the rich summary, tag chips and extra fields.
 * - `education`: degree over `institution · area`, a mono date, summary.
 * - `profiles` / `languages` / `skills`: compact rows — brand or name plus
 *   proficiency dots; the whole row is the edit affordance (spec §1.9).
 * - `interests`: a plain list, managed through the add-block and dialog.
 * - custom sections: chip lists with an inline remove.
 * - everything else: a generic entry — name with a right-aligned date, an
 *   optional one-line description, then summary, chips and extra fields.
 *
 * Bound slots stay inline-editable exactly as in #788 (the inline-editing
 * rework is #795's); a slot the sheet derives from several fields is read-only
 * and edited in the item dialog. Every mutation still routes through
 * `docEdits` — one action, one undo entry.
 */

import { For, Show, createSignal, type JSX } from "solid-js";
import { createDraggable, createDroppable } from "@thisbeyond/solid-dnd";
import { InlineMarkdown } from "./InlineMarkdown";
import { InlineText } from "./InlineText";
import { ItemDialog } from "./ItemDialog";
import { MarkdownView } from "./MarkdownView";
import { SectionChrome, sectionTitleTriggerId, type SectionMenuActions } from "./SectionChrome";
import { SortableEntry } from "./SortableEntry";
import { ContactIcon, ProfileIcon } from "./icons";
import { useSheetEditable } from "./sheetMode";
import {
  duplicateItem,
  removeItem,
  renameSection,
  setItemVisibility,
  toggleSection,
  updateCoverLetter,
  updateItem,
  updateSummary,
} from "./docEdits";
import { itemNoun } from "./itemFields";
import { entryStep, type MoveStep } from "../../lib/docDnd";
import { isCustomId, sectionTitle } from "../../lib/docLayout";
import type {
  Award,
  CustomField,
  Education,
  Experience,
  Language,
  Profile,
  ResumeData,
  Skill,
  Url,
} from "../../wasm/types";

/** Highest level a skill or language can carry. Mirrors `clamp-level`. */
const MAX_LEVEL = 5;

/** Add-block labels per fixed section (spec §1.7); customs fall back to noun. */
const ADD_LABELS: Readonly<Record<string, string>> = {
  experience: "Add experience",
  education: "Add education",
  profiles: "Add profile",
  languages: "Add language",
  skills: "Add skill",
  interests: "Add interest",
};

/** A drawn slot: `field` names the writable key; without one it is derived. */
interface ItemField {
  value: string;
  /** Human label, announced by the inline editor. */
  label: string;
  field?: string;
}

function bind(value: string | undefined, label: string, field: string): ItemField {
  return { value: value ?? "", label, field };
}

function hasText(value: string | undefined): boolean {
  return (value ?? "").trim() !== "";
}

/** A generic item as the sheet reads it — every field optional. */
interface AnyItem {
  id: string;
  visible: boolean;
  name?: string;
  description?: string;
  date?: string;
  summary?: string;
  keywords?: string[];
  customFields?: CustomField[];
  level?: number;
  url?: Url;
}

/** A drawn item, plus where it sits in the section's own `items` array. */
interface ItemEntry {
  id: string;
  /** Index into the unfiltered `items` array — what the store actions address. */
  index: number;
  /** Switched off — drawn as chrome, but absent from the PDF. */
  hidden: boolean;
  item: AnyItem;
}

/** Head-line fields an entry might carry, in announcement preference order. */
const ENTRY_LABEL_KEYS = ["name", "position", "institution", "title", "network"] as const;

function entryLabel(entry: ItemEntry, noun: string): string {
  const record = entry.item as unknown as Record<string, unknown>;
  for (const key of ENTRY_LABEL_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return noun;
}

/** The items of `sectionId`, with their stored indices. */
function itemEntries(resume: ResumeData, sectionId: string): ItemEntry[] {
  const section = isCustomId(sectionId)
    ? resume.sections.custom?.[sectionId]
    : (resume.sections[sectionId as keyof ResumeData["sections"]] as
        | { items?: AnyItem[] }
        | undefined);
  return (section?.items ?? []).map((item, index) => ({
    id: item.id,
    index,
    hidden: !item.visible,
    item,
  }));
}

/** A bound slot as an inline editor; a derived slot as plain text. */
function Slot(props: {
  field: ItemField;
  /** Stable per-item id prefix; the field key makes it unique per slot. */
  idPrefix: string;
  class?: string;
  onCommit: (field: string, value: string) => void;
}): JSX.Element {
  return (
    <Show when={props.field.field} fallback={<span class={props.class}>{props.field.value}</span>}>
      {(key) => (
        <InlineText
          value={props.field.value}
          label={props.field.label}
          class={props.class}
          triggerId={`${props.idPrefix}-${key()}`}
          onCommit={(value) => props.onCommit(key(), value)}
        />
      )}
    </Show>
  );
}

/** Soft accent pill per keyword (spec §1.7); hidden when empty. */
function TagChips(props: { tags?: string[] }): JSX.Element {
  const tags = (): string[] => (props.tags ?? []).filter((tag) => tag.trim() !== "");
  return (
    <Show when={tags().length > 0}>
      <ul class="doc-sheet__tag-chips">
        <For each={tags()}>{(tag) => <li class="doc-sheet__tag-chip">{tag}</li>}</For>
      </ul>
    </Show>
  );
}

/** Uppercase label + value rows for an item's extra fields (spec §1.7). */
function ExtraFieldsView(props: { fields?: CustomField[] }): JSX.Element {
  const fields = (): CustomField[] =>
    (props.fields ?? []).filter((field) => hasText(field.name) || hasText(field.value));
  return (
    <Show when={fields().length > 0}>
      <div class="doc-sheet__extra-view">
        <For each={fields()}>
          {(field) => (
            <div class="doc-sheet__extra-row">
              <span class="doc-sheet__extra-label">
                {hasText(field.name) ? field.name : "Field"}
              </span>
              <span class="doc-sheet__extra-val">{field.value}</span>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}

/** Five proficiency dots, filled to `value` (compact rows, spec §1.7). */
function LevelDots(props: { value: number }): JSX.Element {
  const level = (): number => Math.min(MAX_LEVEL, Math.max(0, Math.round(props.value)));
  return (
    <span class="doc-sheet__lang-dots" role="img" aria-label={`Level ${level()} of ${MAX_LEVEL}`}>
      <For each={Array.from({ length: MAX_LEVEL }, (_, index) => index)}>
        {(index) => (
          <i classList={{ "doc-sheet__lang-dot--on": index < level() }} aria-hidden="true" />
        )}
      </For>
    </span>
  );
}

/** The rich summary of an item: inline-editable markdown, formatted in Done. */
function EntrySummary(props: {
  value: string;
  idPrefix: string;
  onCommit: (value: string) => void;
}): JSX.Element {
  const isEditable = useSheetEditable();
  return (
    <Show when={isEditable() || hasText(props.value)}>
      <div class="doc-sheet__entry-sum">
        <Show when={isEditable()} fallback={<MarkdownView value={props.value} />}>
          <InlineMarkdown
            value={props.value}
            label="Summary"
            triggerId={`${props.idPrefix}-summary`}
            onCommit={props.onCommit}
          />
        </Show>
      </div>
    </Show>
  );
}

export interface DocSectionProps {
  resume: ResumeData;
  /** A fixed section id, or a custom section's own id. */
  sectionId: string;
  /** Last-clicked section card, drawn with a solid accent border. */
  focusedSection: string | null;
  onFocusSection: (sectionId: string) => void;
  /** Whether a one-step move in `step` direction would change anything. */
  canMoveSection: (sectionId: string, step: MoveStep) => boolean;
  /** Perform (and announce) a one-step section move. */
  onMoveSection: (sectionId: string, step: MoveStep) => void;
  /** The cross-column move's target name, or `null` on single-column pages. */
  otherColumnLabel: string | null;
  onMoveSectionToOtherColumn: (sectionId: string) => void;
  /** Perform (and announce) a one-step entry move. */
  onMoveEntry: (sectionId: string, itemId: string, step: MoveStep) => void;
  /** Announce a completed action to the sheet's live region. */
  onAnnounce: (message: string) => void;
}

/** One section of the sheet: the universal card around a spec-§1.7 body. */
export function DocSection(props: DocSectionProps): JSX.Element {
  const isEditable = useSheetEditable();
  const [editing, setEditing] = createSignal<ItemEntry | null>(null);
  const [isDialogOpen, setIsDialogOpen] = createSignal(false);

  const id = (): string => props.sectionId;
  const title = (): string => sectionTitle(props.resume, id());
  const isRichText = (): boolean => id() === "summary" || id() === "coverLetter";
  const isChips = (): boolean => isCustomId(id());
  const noun = (): string => itemNoun(title());
  const addLabel = (): string => ADD_LABELS[id()] ?? `Add ${noun()}`;

  // Done mode mirrors the PDF: hidden items are dropped, not dimmed.
  const entries = (): ItemEntry[] =>
    itemEntries(props.resume, id()).filter((entry) => isEditable() || !entry.hidden);

  const richText = (): string => {
    if (id() === "summary") return props.resume.sections.summary?.content ?? "";
    if (id() === "coverLetter") return props.resume.sections.coverLetter?.content ?? "";
    return "";
  };

  const draggable = createDraggable(`drag:section:${id()}`, {
    type: "section",
    sectionId: id(),
  });
  const droppable = createDroppable(`drop:section:${id()}`, {
    type: "section",
    sectionId: id(),
  });

  function openAdd(): void {
    setEditing(null);
    setIsDialogOpen(true);
  }

  function openEdit(entry: ItemEntry): void {
    setEditing(entry);
    setIsDialogOpen(true);
  }

  const commitFor =
    (entry: ItemEntry) =>
    (field: string, value: string): void => {
      updateItem(id(), entry.index, { [field]: value });
    };

  /** Row-chrome action set for one entry; move handlers only at non-edges. */
  function rowActions(entry: ItemEntry): {
    label: string;
    isHidden: boolean;
    onEdit: () => void;
    onRemove: () => void;
    onDuplicate: () => void;
    onToggleVisibility: () => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
  } {
    const label = entryLabel(entry, noun());
    const steps = (step: "up" | "down"): (() => void) | undefined => {
      const items = itemEntries(props.resume, id()).map((each) => ({
        id: each.id,
        visible: !each.hidden,
      }));
      if (entryStep(items, entry.id, step) === null) return undefined;
      return () => props.onMoveEntry(id(), entry.id, step);
    };
    return {
      label,
      isHidden: entry.hidden,
      onEdit: () => openEdit(entry),
      onRemove: () => {
        removeItem(id(), entry.index);
        props.onAnnounce(`${label} removed`);
      },
      onDuplicate: () => {
        duplicateItem(id(), entry.index);
        props.onAnnounce(`${label} duplicated`);
      },
      onToggleVisibility: () => {
        setItemVisibility(id(), entry.index, entry.hidden);
        props.onAnnounce(`${label} ${entry.hidden ? "shown" : "hidden"}`);
      },
      onMoveUp: steps("up"),
      onMoveDown: steps("down"),
    };
  }

  const menu = (): SectionMenuActions => ({
    addLabel: isRichText() ? undefined : addLabel(),
    onAdd: isRichText() ? undefined : openAdd,
    canMoveUp: props.canMoveSection(id(), "up"),
    canMoveDown: props.canMoveSection(id(), "down"),
    onMoveUp: () => props.onMoveSection(id(), "up"),
    onMoveDown: () => props.onMoveSection(id(), "down"),
    otherColumnLabel: props.otherColumnLabel ?? undefined,
    onMoveToOtherColumn:
      props.otherColumnLabel === null ? undefined : () => props.onMoveSectionToOtherColumn(id()),
    onRename: () => document.getElementById(sectionTitleTriggerId(id()))?.click(),
    onHide: () => {
      toggleSection(id());
      props.onAnnounce(`${title()} section hidden`);
    },
  });

  function experienceBody(entry: ItemEntry): JSX.Element {
    const item = entry.item as Experience;
    const idPrefix = `doc-${id()}-${entry.id}`;
    const commit = commitFor(entry);
    return (
      <>
        <div class="doc-sheet__entry-pos">
          <Slot
            field={bind(item.position, "Position", "position")}
            idPrefix={idPrefix}
            onCommit={commit}
          />
        </div>
        <div class="doc-sheet__entry-meta">
          <Slot
            field={bind(item.company, "Company", "company")}
            idPrefix={idPrefix}
            class="doc-sheet__entry-co"
            onCommit={commit}
          />
          <Show when={isEditable() || hasText(item.date)}>
            <Slot
              field={bind(item.date, "Date", "date")}
              idPrefix={idPrefix}
              class="doc-sheet__entry-date"
              onCommit={commit}
            />
          </Show>
        </div>
        <Show when={isEditable() || hasText(item.location)}>
          <div class="doc-sheet__entry-loc">
            <ContactIcon kind="location" />
            <Slot
              field={bind(item.location, "Location", "location")}
              idPrefix={idPrefix}
              onCommit={commit}
            />
          </div>
        </Show>
        <EntrySummary
          value={item.summary ?? ""}
          idPrefix={idPrefix}
          onCommit={(value) => commit("summary", value)}
        />
        <TagChips tags={item.keywords} />
        <ExtraFieldsView fields={item.customFields} />
      </>
    );
  }

  function educationBody(entry: ItemEntry): JSX.Element {
    const item = entry.item as Education;
    const idPrefix = `doc-${id()}-${entry.id}`;
    const commit = commitFor(entry);
    const school = (): string =>
      [item.institution, item.area].filter((part) => hasText(part)).join(" · ");
    return (
      <>
        <div class="doc-sheet__edu-degree">
          <Slot
            field={bind(item.studyType, "Degree", "studyType")}
            idPrefix={idPrefix}
            onCommit={commit}
          />
        </div>
        {/* Derived from two fields, so the dialog owns it (spec §1.7). */}
        <Show when={hasText(school())}>
          <div class="doc-sheet__edu-school">{school()}</div>
        </Show>
        <Show when={isEditable() || hasText(item.date)}>
          <div class="doc-sheet__edu-date">
            <Slot field={bind(item.date, "Date", "date")} idPrefix={idPrefix} onCommit={commit} />
          </div>
        </Show>
        <EntrySummary
          value={item.summary ?? ""}
          idPrefix={idPrefix}
          onCommit={(value) => commit("summary", value)}
        />
        <TagChips tags={item.keywords} />
        <ExtraFieldsView fields={item.customFields} />
      </>
    );
  }

  function profileBody(entry: ItemEntry): JSX.Element {
    const item = entry.item as Profile;
    const text = (): string => (hasText(item.username) ? item.username : item.network);
    const href = (): string | undefined => {
      const value = item.url?.href ?? "";
      return value.trim() === "" ? undefined : value;
    };
    return (
      <div class="doc-sheet__icon-row">
        <ProfileIcon network={item.network} icon={item.icon} />
        {/* Live link in view mode; inert while editing (spec §1.7). */}
        <a
          class="doc-sheet__side-link"
          href={href()}
          target={href() === undefined ? undefined : "_blank"}
          rel="noreferrer"
          onClick={(event) => {
            if (isEditable()) event.preventDefault();
          }}
        >
          {text()}
        </a>
      </div>
    );
  }

  function levelRowBody(entry: ItemEntry): JSX.Element {
    const item = entry.item as Language | Skill;
    return (
      <>
        <span class="doc-sheet__lang-name">{item.name}</span>
        <Show when={(item.level ?? 0) > 0}>
          <LevelDots value={item.level ?? 0} />
        </Show>
        <TagChips tags={(item as Skill).keywords} />
      </>
    );
  }

  function genericBody(entry: ItemEntry): JSX.Element {
    const item = entry.item;
    const idPrefix = `doc-${id()}-${entry.id}`;
    const commit = commitFor(entry);
    // Awards store their headline as `title`; everything else uses `name`.
    const isAward = id() === "awards";
    const nameField = isAward
      ? bind((entry.item as unknown as Award).title, "Title", "title")
      : bind(item.name, "Name", "name");
    return (
      <>
        <div class="doc-sheet__entry-top">
          <Slot
            field={nameField}
            idPrefix={idPrefix}
            class="doc-sheet__entry-pos"
            onCommit={commit}
          />
          <Show when={isEditable() || hasText(item.date)}>
            <Slot
              field={bind(item.date, "Date", "date")}
              idPrefix={idPrefix}
              class="doc-sheet__entry-date"
              onCommit={commit}
            />
          </Show>
        </div>
        <Show when={isEditable() || hasText(item.description)}>
          <div class="doc-sheet__entry-desc">
            <Slot
              field={bind(item.description, "Description", "description")}
              idPrefix={idPrefix}
              onCommit={commit}
            />
          </div>
        </Show>
        <EntrySummary
          value={item.summary ?? ""}
          idPrefix={idPrefix}
          onCommit={(value) => commit("summary", value)}
        />
        <TagChips tags={item.keywords} />
        <ExtraFieldsView fields={item.customFields} />
      </>
    );
  }

  /** Compact rows for the sidebar sections; full rows for everything else. */
  const isCompact = (): boolean => id() === "profiles" || id() === "languages" || id() === "skills";

  function rowClass(): string {
    if (id() === "profiles") return "doc-sheet__profile-row";
    if (id() === "languages" || id() === "skills") return "doc-sheet__lang-row";
    if (id() === "education") return "doc-sheet__edu-entry";
    return "doc-sheet__entry";
  }

  function bodyFor(entry: ItemEntry): JSX.Element {
    if (id() === "experience") return experienceBody(entry);
    if (id() === "education") return educationBody(entry);
    if (id() === "profiles") return profileBody(entry);
    if (id() === "languages" || id() === "skills") return levelRowBody(entry);
    return genericBody(entry);
  }

  return (
    <>
      <SectionChrome
        sectionId={id()}
        title={title()}
        onRenameCommit={(value) => renameSection(id(), value)}
        isFocused={props.focusedSection === id()}
        onFocus={() => props.onFocusSection(id())}
        addLabel={isRichText() ? undefined : addLabel()}
        onAdd={isRichText() ? undefined : openAdd}
        menu={menu()}
        gripActivators={draggable.dragActivators}
        gripTitle={`Drag ${title()} section to move it`}
        ref={(element) => {
          draggable.ref(element);
          droppable.ref(element);
        }}
        isDropTarget={droppable.isActiveDroppable}
        isDragging={draggable.isActiveDraggable}
      >
        <Show when={isRichText()}>
          <div class="doc-sheet__summary">
            <InlineMarkdown
              value={richText()}
              label={title()}
              triggerId={`doc-${id()}-rich-text`}
              onCommit={(value) =>
                id() === "summary" ? updateSummary(value) : updateCoverLetter(value)
              }
            />
          </div>
        </Show>

        <Show when={id() === "interests"}>
          <ul class="doc-sheet__custom-list">
            <For each={entries()}>
              {(entry) => (
                <li
                  data-entry-id={entry.id}
                  classList={{ "doc-sheet__entry-row--hidden": entry.hidden }}
                >
                  {entry.item.name}
                </li>
              )}
            </For>
          </ul>
        </Show>

        <Show when={isChips()}>
          <div class="doc-sheet__chip-list">
            <For each={entries()}>
              {(entry) => (
                <span
                  class="doc-sheet__skill-chip"
                  classList={{ "doc-sheet__entry-row--hidden": entry.hidden }}
                  data-entry-id={entry.id}
                >
                  {entry.item.name}
                  <Show when={isEditable()}>
                    <button
                      type="button"
                      class="doc-sheet__chip-x"
                      aria-label={`Remove ${entryLabel(entry, noun())}`}
                      onClick={() => {
                        const label = entryLabel(entry, noun());
                        removeItem(id(), entry.index);
                        props.onAnnounce(`${label} removed`);
                      }}
                    >
                      ×
                    </button>
                  </Show>
                </span>
              )}
            </For>
          </div>
        </Show>

        <Show when={!isRichText() && !isChips() && id() !== "interests"}>
          <For each={entries()}>
            {(entry) => (
              <SortableEntry
                sectionId={id()}
                itemId={entry.id}
                class={rowClass()}
                isCompact={isCompact()}
                isHidden={entry.hidden}
                actions={rowActions(entry)}
              >
                {bodyFor(entry)}
              </SortableEntry>
            )}
          </For>
        </Show>

        <Show when={!isRichText() && isEditable() && entries().length === 0}>
          <p class="doc-sheet__empty-hint">No items yet — use + to add one.</p>
        </Show>
      </SectionChrome>

      <Show when={!isRichText() && isEditable()}>
        <ItemDialog
          open={isDialogOpen()}
          sectionId={id()}
          sectionTitle={title()}
          index={editing()?.index}
          item={editing()?.item as unknown as Record<string, unknown> | undefined}
          onOpenChange={setIsDialogOpen}
        />
      </Show>
    </>
  );
}
