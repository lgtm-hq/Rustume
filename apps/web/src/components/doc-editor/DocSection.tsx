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
import { EditableField } from "./EditableField";
import { ItemDialog } from "./ItemDialog";
import { MarkdownView } from "./MarkdownView";
import { SectionChrome, sectionTitleTriggerId, type SectionMenuActions } from "./SectionChrome";
import { SortableEntry, type InsertBreakAction } from "./SortableEntry";
import { ContactIcon, ProfileIcon } from "./icons";
import { useSheetEditable } from "./sheetMode";
import {
  SECTION_DRAG_MIME,
  dragStartVetoed,
  dropIndexFromPointer,
  readDragPayload,
  useSheetDnd,
} from "./sheetDnd";
import {
  duplicateItem,
  removeItem,
  renameSection,
  setItemVisibility,
  toggleSection,
  updateCoverLetter,
  updateSummary,
} from "./docEdits";
import { itemNoun } from "./itemFields";
import { entryDisplayLabel, entryStep, type MoveStep } from "../../lib/docDnd";
import { isCustomId, sectionTitle, type SectionPlacement } from "../../lib/docLayout";
import type { SectionSlice } from "../../lib/docPagination";
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

/** The entry's display name, shared with the sheet's announcements. */
function entryLabel(entry: ItemEntry, noun: string): string {
  return entryDisplayLabel(entry.item, noun);
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

/**
 * One drawn slot of an entry — plain rendered text. Editing happens in the
 * item modal (owner decision 2026-08-04): double-clicking the entry opens it.
 */
function Slot(props: { field: ItemField; class?: string }): JSX.Element {
  return (
    <Show when={props.field.value.trim() !== ""}>
      <span class={props.class}>{props.field.value}</span>
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

/** The rich summary of an item: rendered markdown, edited in the item modal. */
function EntrySummary(props: { value: string }): JSX.Element {
  return (
    <Show when={hasText(props.value)}>
      <div class="doc-sheet__entry-sum doc-sheet__rich-text">
        <MarkdownView value={props.value} />
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
  /**
   * The item slice this instance draws, or `null` for the whole section.
   * Continuation instances (slice index > 0) render the "(cont.)" title and
   * carry no add affordance unless they are the last slice (spec §2.6, §3.3).
   */
  slice: SectionSlice | null;
  /** Whether splitting the layout before this section would change anything. */
  canInsertPageBreak: boolean;
  /** Split the layout so this section starts a fresh page (spec §3.4). */
  onInsertPageBreak: (sectionId: string) => void;
  /**
   * The pill's "insert page break before this item" state, or `null` when the
   * section cannot carry item breaks at all (non-main-flow, spec §3.4 guard).
   */
  itemBreakAction: (sectionId: string, itemId: string) => InsertBreakAction | null;
}

/** One section of the sheet: the universal card around a spec-§1.7 body. */
export function DocSection(props: DocSectionProps): JSX.Element {
  const isEditable = useSheetEditable();
  const dnd = useSheetDnd();
  const [editing, setEditing] = createSignal<ItemEntry | null>(null);
  const [isDialogOpen, setIsDialogOpen] = createSignal(false);

  const id = (): string => props.sectionId;
  const baseTitle = (): string => sectionTitle(props.resume, id());
  const isContinuation = (): boolean => (props.slice?.index ?? 0) > 0;
  /** Continuation slices re-render the title as "<Title> (cont.)" (§3.3). */
  const title = (): string => (isContinuation() ? `${baseTitle()} (cont.)` : baseTitle());
  const isRichText = (): boolean => id() === "summary" || id() === "coverLetter";
  const isChips = (): boolean => isCustomId(id());
  const noun = (): string => itemNoun(baseTitle());
  const addLabel = (): string => ADD_LABELS[id()] ?? `Add ${noun()}`;
  /** Add affordances live only on the section's last slice (spec §2.6). */
  const canAdd = (): boolean => props.slice === null || props.slice.isLast;

  // Done mode mirrors the PDF: hidden items are dropped, not dimmed. A sliced
  // instance draws only its own slice of the drawn list.
  const entries = (): ItemEntry[] => {
    const drawn = itemEntries(props.resume, id()).filter((entry) => isEditable() || !entry.hidden);
    const slice = props.slice;
    if (slice === null) return drawn;
    const included = new Set(slice.itemIds);
    return drawn.filter((entry) => included.has(entry.id));
  };

  const richText = (): string => {
    if (id() === "summary") return props.resume.sections.summary?.content ?? "";
    if (id() === "coverLetter") return props.resume.sections.coverLetter?.content ?? "";
    return "";
  };

  /** Where the press that may become a card drag started (spec §2.5 veto). */
  let pressTarget: HTMLElement | null = null;

  const isDragging = (): boolean => dnd !== null && dnd.sectionDrag() === id();
  const placement = (): SectionPlacement | null => dnd?.sectionPlacement(id()) ?? null;

  const slotState = (): { before: boolean; after: boolean } => {
    const target = dnd?.sectionDropAt() ?? null;
    const place = placement();
    if (!target || !place || target.page !== place.page || target.column !== place.column) {
      return { before: false, after: false };
    }
    return {
      before: target.index === place.index,
      after:
        target.index === place.index + 1 &&
        place.index === (dnd?.columnLength(place.page, place.column) ?? 0) - 1,
    };
  };

  function endCardDrag(): void {
    dnd?.setSectionDrag(null);
    dnd?.setSectionDropAt(null);
  }

  /** dragenter *and* dragover both track — fast drags must register (§2.5). */
  function trackCardDropTarget(event: DragEvent): void {
    const dragging = dnd?.sectionDrag() ?? null;
    if (dragging === null || dragging === id()) return;
    const place = placement();
    if (!place) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    dnd?.setSectionDropAt({
      page: place.page,
      column: place.column,
      index: dropIndexFromPointer(event, place.index),
    });
  }

  /** Whole-surface card drag and drop-target wiring (spec §2.5). */
  const cardDragProps = (): JSX.HTMLAttributes<HTMLElement> => ({
    draggable: isEditable() && !isContinuation(),
    onMouseDown: (event: MouseEvent) => {
      // Record only — never preventDefault here (pinned Chromium bug).
      pressTarget = event.target as HTMLElement;
    },
    onDragStart: (event: DragEvent) => {
      const pressed = pressTarget;
      pressTarget = null;
      // Entry rows and the grip run their own drags (stopPropagation).
      // Anything reaching here grabbed the card frame — veto presses that
      // began on controls or on an entry row, so those keep their behaviour.
      if (dragStartVetoed(pressed, ".doc-sheet__entry-row")) {
        event.preventDefault();
        return;
      }
      event.stopPropagation();
      dnd?.setSectionDrag(id());
      event.dataTransfer?.setData(SECTION_DRAG_MIME, JSON.stringify({ id: id() }));
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    },
    onDragEnd: endCardDrag,
    onDragEnter: trackCardDropTarget,
    onDragOver: trackCardDropTarget,
    onDrop: (event: DragEvent) => {
      const dragging = dnd?.sectionDrag() ?? null;
      if (dragging === null) return;
      event.preventDefault();
      const target = dnd?.sectionDropAt() ?? null;
      const payload = readDragPayload<{ id?: string }>(event, SECTION_DRAG_MIME);
      const draggedId = payload?.id ?? dragging;
      if (target !== null) {
        dnd?.onSectionDrop(draggedId, target);
      }
      endCardDrag();
    },
  });

  function openAdd(): void {
    setEditing(null);
    setIsDialogOpen(true);
  }

  function openEdit(entry: ItemEntry): void {
    setEditing(entry);
    setIsDialogOpen(true);
  }

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
    insertBreak?: InsertBreakAction;
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
      insertBreak: props.itemBreakAction(id(), entry.id) ?? undefined,
    };
  }

  const menu = (): SectionMenuActions => ({
    addLabel: isRichText() || !canAdd() ? undefined : addLabel(),
    onAdd: isRichText() || !canAdd() ? undefined : openAdd,
    canMoveUp: props.canMoveSection(id(), "up"),
    canMoveDown: props.canMoveSection(id(), "down"),
    onMoveUp: () => props.onMoveSection(id(), "up"),
    onMoveDown: () => props.onMoveSection(id(), "down"),
    otherColumnLabel: props.otherColumnLabel ?? undefined,
    onMoveToOtherColumn:
      props.otherColumnLabel === null ? undefined : () => props.onMoveSectionToOtherColumn(id()),
    canInsertPageBreak: props.canInsertPageBreak,
    onInsertPageBreak: () => props.onInsertPageBreak(id()),
    onRename: () => document.getElementById(sectionTitleTriggerId(id()))?.click(),
    onHide: () => {
      toggleSection(id());
      props.onAnnounce(`${baseTitle()} section hidden`);
    },
  });

  function experienceBody(entry: ItemEntry): JSX.Element {
    const item = entry.item as Experience;
    return (
      <>
        <div class="doc-sheet__entry-pos">
          <Slot field={bind(item.position, "Position", "position")} />
        </div>
        <div class="doc-sheet__entry-meta">
          <Slot field={bind(item.company, "Company", "company")} class="doc-sheet__entry-co" />
          <Slot field={bind(item.date, "Date", "date")} class="doc-sheet__entry-date" />
        </div>
        <Show when={hasText(item.location)}>
          <div class="doc-sheet__entry-loc">
            <ContactIcon kind="location" />
            <Slot field={bind(item.location, "Location", "location")} />
          </div>
        </Show>
        <EntrySummary value={item.summary ?? ""} />
        <TagChips tags={item.keywords} />
        <ExtraFieldsView fields={item.customFields} />
      </>
    );
  }

  function educationBody(entry: ItemEntry): JSX.Element {
    const item = entry.item as Education;
    const school = (): string =>
      [item.institution, item.area].filter((part) => hasText(part)).join(" · ");
    return (
      <>
        <div class="doc-sheet__edu-degree">
          <Slot field={bind(item.studyType, "Degree", "studyType")} />
        </div>
        <Show when={hasText(school())}>
          <div class="doc-sheet__edu-school">{school()}</div>
        </Show>
        <Show when={hasText(item.date)}>
          <div class="doc-sheet__edu-date">
            <Slot field={bind(item.date, "Date", "date")} />
          </div>
        </Show>
        <EntrySummary value={item.summary ?? ""} />
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
    // Awards store their headline as `title`; everything else uses `name`.
    const isAward = id() === "awards";
    const nameField = isAward
      ? bind((entry.item as unknown as Award).title, "Title", "title")
      : bind(item.name, "Name", "name");
    return (
      <>
        <div class="doc-sheet__entry-top">
          <Slot field={nameField} class="doc-sheet__entry-pos" />
          <Slot field={bind(item.date, "Date", "date")} class="doc-sheet__entry-date" />
        </div>
        <Show when={hasText(item.description)}>
          <div class="doc-sheet__entry-desc">
            <Slot field={bind(item.description, "Description", "description")} />
          </div>
        </Show>
        <EntrySummary value={item.summary ?? ""} />
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
        idKey={props.slice === null ? id() : `${id()}-slice-${props.slice.index}`}
        title={title()}
        onRenameCommit={isContinuation() ? undefined : (value) => renameSection(id(), value)}
        isFocused={props.focusedSection === id()}
        onFocus={() => props.onFocusSection(id())}
        addLabel={isRichText() || !canAdd() ? undefined : addLabel()}
        onAdd={isRichText() || !canAdd() ? undefined : openAdd}
        menu={menu()}
        gripActivators={{
          draggable: "true",
          onDragStart: (event: DragEvent) => {
            // Grip drags stopPropagation so the card doesn't double-fire.
            event.stopPropagation();
            dnd?.setSectionDrag(id());
            event.dataTransfer?.setData(SECTION_DRAG_MIME, JSON.stringify({ id: id() }));
            if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
          },
          onDragEnd: endCardDrag,
        }}
        gripTitle={`Drag ${baseTitle()} section to move it`}
        dragProps={cardDragProps()}
        isDragging={isDragging()}
        showSlotBefore={slotState().before}
        showSlotAfter={slotState().after}
      >
        <Show when={isRichText()}>
          <div class="doc-sheet__summary">
            <EditableField
              rich
              value={richText()}
              label={title()}
              dialogTitle={`Edit · ${title()}`}
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
                  <Show when={isEditable()} fallback={entry.item.name}>
                    <button
                      type="button"
                      class="doc-sheet__editable"
                      title="Click to edit"
                      aria-label={`Edit ${entryLabel(entry, noun())}`}
                      onClick={() => openEdit(entry)}
                    >
                      {entry.item.name}
                    </button>
                  </Show>
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
                  <Show when={isEditable()} fallback={entry.item.name}>
                    <button
                      type="button"
                      class="doc-sheet__editable"
                      title="Click to edit"
                      aria-label={`Edit ${entryLabel(entry, noun())}`}
                      onClick={() => openEdit(entry)}
                    >
                      {entry.item.name}
                    </button>
                  </Show>
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
            {(entry, drawnIndex) => (
              <SortableEntry
                sectionId={id()}
                itemId={entry.id}
                index={entry.index}
                isLast={drawnIndex() === entries().length - 1}
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

        <Show when={!isRichText() && isEditable() && canAdd() && entries().length === 0}>
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
