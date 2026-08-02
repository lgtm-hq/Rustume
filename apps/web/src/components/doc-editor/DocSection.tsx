/**
 * Section views for the document sheet, with editing in place.
 *
 * Each section type is reduced to one {@link ItemView} descriptor and drawn by
 * a single renderer, so field *order* lives in one obvious place. That order is
 * taken from the Typst templates in
 * `crates/render/src/typst_engine/templates/*.typ`, which are authoritative for
 * what a section shows and in which sequence.
 *
 * Every slot the renderer draws carries the item key it came from, which is
 * what makes click-to-edit possible without a second mapping: committing a slot
 * writes that one key through `docEdits`. Slots the sheet derives from more than
 * one field (a degree, say) carry no key and are edited in the item dialog
 * instead, which is also where the fields the sheet has no room for live.
 *
 * Structural chrome lives here too: each section is a card with hover/focus
 * controls (move, hide, rename, delete) and each entry carries its own action
 * row. Drags start from the handles only — never from the surface — so text
 * selection and inline editing keep working; the sheet (`DocSheet`) owns the
 * drag-drop context, drop resolution and announcements, and every mutation
 * still goes through `docEdits`.
 *
 * URLs still render as text rather than anchors: the sheet is a document
 * surface, not a navigation surface, and a link inside an item would compete
 * with the item's own click targets. Markdown fields render formatted via
 * {@link MarkdownView} — the sheet *is* the rendered document (#785).
 */

import { For, Show, createSignal, type JSX } from "solid-js";
import { createDraggable, createDroppable } from "@thisbeyond/solid-dnd";
import { CustomSectionDialog } from "./CustomSectionDialog";
import { InlineMarkdown } from "./InlineMarkdown";
import { InlineText } from "./InlineText";
import { ItemDialog } from "./ItemDialog";
import { MarkdownView } from "./MarkdownView";
import { useSheetEditable } from "./sheetMode";
import {
  removeItem,
  removeSection,
  renameSection,
  setItemVisibility,
  toggleSection,
  duplicateItem,
  updateCoverLetter,
  updateItem,
  updateSummary,
} from "./docEdits";
import { itemNoun } from "./itemFields";
import type { MoveStep } from "../../lib/docDnd";
import { isCustomId, sectionTitle } from "../../lib/docLayout";
import type {
  Award,
  Certification,
  CustomItem,
  Education,
  Experience,
  Interest,
  Language,
  Profile,
  Project,
  Publication,
  Reference,
  ResumeData,
  Skill,
  Url,
  Volunteer,
} from "../../wasm/types";

/** Highest level a skill or language can carry. Mirrors `clamp-level`. */
const MAX_LEVEL = 5;

/**
 * One drawn slot of an item.
 *
 * `field` names the item key the slot writes to; a slot without one is derived
 * from several fields and is therefore read-only on the sheet.
 */
interface ItemField {
  value: string;
  /** Human label, announced by the inline editor. */
  label: string;
  field?: string;
}

/**
 * One item of any section, flattened to the slots the sheet draws.
 *
 * The slots render in declaration order: title/subtitle and meta share the
 * head row, then details, then body, then keywords, level and url.
 */
interface ItemView {
  /** Primary line — company, institution, name, title. */
  title: ItemField;
  /**
   * Draw title and subtitle as one inline run rather than stacked lines.
   *
   * Profiles use this: templates print a profile as one `network username`
   * entry (`render-profile-entry` in `_common.typ`), so stacking the same
   * strings as title, subtitle and link reads as duplication (#787).
   */
  inline?: boolean;
  /** Secondary line under the title. */
  subtitle?: ItemField;
  /** Right-aligned head-row entries, typically date then location. */
  meta?: ItemField[];
  /** Short plain lines between the head row and the body. */
  details?: ItemField[];
  /** Rich-text (markdown) fields, in template order. */
  body?: ItemField[];
  keywords?: string[];
  /** 0–5 proficiency, drawn as dots. Absent for sections without a level. */
  level?: number;
  url?: Url;
}

/**
 * A slot bound to one item key.
 *
 * The value is read defensively: imported resumes reach the store with fields
 * the schema declares but the import never filled in.
 */
function bind(value: string | undefined, label: string, field: string): ItemField {
  return { value: value ?? "", label, field };
}

/** A slot the sheet derives rather than stores, so it cannot be edited inline. */
function derived(value: string | undefined, label: string): ItemField {
  return { value: value ?? "", label };
}

function nonEmpty(fields: ItemField[]): ItemField[] {
  return fields.filter((entry) => entry.value.trim() !== "");
}

/** `studyType in area`, matching `format-degree` in `_common.typ`. */
function formatDegree(studyType: string, area: string): string {
  if (studyType !== "" && area !== "") return `${studyType} in ${area}`;
  return area !== "" ? area : studyType;
}

/**
 * Visible text for a URL — label, else href. Mirrors `url-display-label`.
 *
 * Both fields are read defensively: imported resumes reach the store with one
 * or the other missing.
 */
function urlLabel(url: Url | undefined): string {
  const label = url?.label ?? "";
  return label.trim() !== "" ? label : (url?.href ?? "");
}

function experienceView(item: Experience): ItemView {
  return {
    title: bind(item.company, "Company", "company"),
    subtitle: bind(item.position, "Position", "position"),
    meta: nonEmpty([bind(item.date, "Date", "date"), bind(item.location, "Location", "location")]),
    body: nonEmpty([bind(item.summary, "Summary", "summary")]),
    url: item.url,
  };
}

function educationView(item: Education): ItemView {
  return {
    title: bind(item.institution, "Institution", "institution"),
    // `studyType in area` — two fields in one line, so the dialog owns it.
    // Absent rather than empty when neither is set: a derived slot is truthy
    // whatever its value, and `<Show>` would draw a blank line for it.
    subtitle: nonEmpty([derived(formatDegree(item.studyType, item.area), "Degree")])[0],
    meta: nonEmpty([bind(item.date, "Date", "date")]),
    details: nonEmpty([bind(item.score, "Score", "score")]),
    body: nonEmpty([bind(item.summary, "Summary", "summary")]),
    url: item.url,
  };
}

function skillView(item: Skill): ItemView {
  return {
    title: bind(item.name, "Name", "name"),
    body: nonEmpty([bind(item.description, "Description", "description")]),
    level: item.level,
    keywords: item.keywords,
  };
}

function projectView(item: Project): ItemView {
  return {
    title: bind(item.name, "Name", "name"),
    meta: nonEmpty([bind(item.date, "Date", "date")]),
    body: nonEmpty([
      bind(item.description, "Description", "description"),
      bind(item.summary, "Summary", "summary"),
    ]),
    keywords: item.keywords,
    url: item.url,
  };
}

function profileView(item: Profile): ItemView {
  // One entry per profile — network label plus the linked username, the way
  // every template draws it. The URL itself is edited in the item dialog; a
  // third line repeating the username-shaped href is exactly the duplication
  // this view exists to avoid (#787).
  return {
    title: bind(item.network, "Network", "network"),
    subtitle: bind(item.username, "Username", "username"),
    inline: true,
  };
}

function awardView(item: Award): ItemView {
  return {
    title: bind(item.title, "Title", "title"),
    subtitle: bind(item.awarder, "Awarder", "awarder"),
    meta: nonEmpty([bind(item.date, "Date", "date")]),
    body: nonEmpty([bind(item.summary, "Summary", "summary")]),
    url: item.url,
  };
}

function certificationView(item: Certification): ItemView {
  return {
    title: bind(item.name, "Name", "name"),
    subtitle: bind(item.issuer, "Issuer", "issuer"),
    meta: nonEmpty([bind(item.date, "Date", "date")]),
    body: nonEmpty([bind(item.summary, "Summary", "summary")]),
    url: item.url,
  };
}

function publicationView(item: Publication): ItemView {
  return {
    title: bind(item.name, "Name", "name"),
    subtitle: bind(item.publisher, "Publisher", "publisher"),
    meta: nonEmpty([bind(item.date, "Date", "date")]),
    body: nonEmpty([bind(item.summary, "Summary", "summary")]),
    url: item.url,
  };
}

function languageView(item: Language): ItemView {
  return {
    title: bind(item.name, "Name", "name"),
    subtitle: bind(item.description, "Description", "description"),
    level: item.level,
  };
}

function interestView(item: Interest): ItemView {
  return { title: bind(item.name, "Name", "name"), keywords: item.keywords };
}

function volunteerView(item: Volunteer): ItemView {
  return {
    title: bind(item.organization, "Organization", "organization"),
    subtitle: bind(item.position, "Position", "position"),
    meta: nonEmpty([bind(item.date, "Date", "date")]),
    details: nonEmpty([bind(item.location, "Location", "location")]),
    body: nonEmpty([bind(item.summary, "Summary", "summary")]),
    url: item.url,
  };
}

function referenceView(item: Reference): ItemView {
  return {
    title: bind(item.name, "Name", "name"),
    subtitle: bind(item.description, "Description", "description"),
    body: nonEmpty([bind(item.summary, "Summary", "summary")]),
    url: item.url,
  };
}

function customView(item: CustomItem): ItemView {
  return {
    title: bind(item.name, "Name", "name"),
    subtitle: bind(item.description, "Description", "description"),
    meta: nonEmpty([bind(item.date, "Date", "date")]),
    details: nonEmpty([bind(item.location, "Location", "location")]),
    body: nonEmpty([bind(item.summary, "Summary", "summary")]),
    keywords: item.keywords,
    url: item.url,
  };
}

/** Every item-bearing section's adapter, keyed by section id. */
const ITEM_VIEWS = {
  experience: experienceView,
  education: educationView,
  skills: skillView,
  projects: projectView,
  profiles: profileView,
  awards: awardView,
  certifications: certificationView,
  publications: publicationView,
  languages: languageView,
  interests: interestView,
  volunteer: volunteerView,
  references: referenceView,
} as const;

type ItemSectionId = keyof typeof ITEM_VIEWS;

interface VisibleItem {
  id: string;
  visible: boolean;
}

/** A drawn item, plus where it sits in the section's own `items` array. */
interface ItemEntry {
  id: string;
  /** Index into the unfiltered `items` array — what the store actions address. */
  index: number;
  /** Switched off — drawn as chrome, but absent from the PDF. */
  hidden: boolean;
  item: Record<string, unknown>;
  view: ItemView;
}

/**
 * The items of `sectionId`, already flattened to {@link ItemView}.
 *
 * Item shapes differ per section, and the adapter table above is the only
 * place that knows which is which — so the lookup is done once, here, behind a
 * cast the table's own keys justify. Hidden items stay in the drawing as
 * flagged chrome — hidden means "not rendered to PDF", not "gone from the
 * editing surface" — which also keeps drawn order identical to stored order.
 */
function itemEntries(resume: ResumeData, sectionId: string): ItemEntry[] {
  const adapter = isCustomId(sectionId)
    ? (customView as (item: VisibleItem) => ItemView)
    : (ITEM_VIEWS[sectionId as ItemSectionId] as ((item: VisibleItem) => ItemView) | undefined);
  if (!adapter) return [];

  const section = isCustomId(sectionId)
    ? resume.sections.custom?.[sectionId]
    : (resume.sections[sectionId as ItemSectionId] as { items?: VisibleItem[] } | undefined);

  return (section?.items ?? []).map((item, index) => ({
    id: item.id,
    index,
    hidden: !item.visible,
    item: item as unknown as Record<string, unknown>,
    view: adapter(item),
  }));
}

function Level(props: { value: number }): JSX.Element {
  const level = () => Math.min(MAX_LEVEL, Math.max(0, Math.round(props.value)));
  return (
    <span class="doc-sheet__level" role="img" aria-label={`Level ${level()} of ${MAX_LEVEL}`}>
      <For each={Array.from({ length: MAX_LEVEL }, (_, index) => index)}>
        {(index) => (
          <span
            class="doc-sheet__level-dot"
            classList={{ "doc-sheet__level-dot--filled": index < level() }}
            aria-hidden="true"
          />
        )}
      </For>
    </span>
  );
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
    <Show when={props.field.field} fallback={props.field.value}>
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

/** Icon paths for the chrome controls, drawn on a 24x24 grid. */
const CHROME_ICONS = {
  handle: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
  up: "M5 15l7-7 7 7",
  down: "M19 9l-7 7-7-7",
  previous: "M15 19l-7-7 7-7",
  next: "M9 5l7 7-7 7",
} as const;

function ChromeIcon(props: { path: string }): JSX.Element {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={props.path} />
    </svg>
  );
}

/** The one-step move controls: label suffix per step, in render order. */
const STEP_WORDS: Record<MoveStep, string> = {
  up: "up",
  down: "down",
  previous: "to the previous section",
  next: "to the next section",
};

function Item(props: {
  sectionId: string;
  entry: ItemEntry;
  /** Singular noun for this section's items, used in the controls' labels. */
  noun: string;
  onEdit: (entry: ItemEntry) => void;
  onMove: (itemId: string, step: MoveStep) => void;
  /** Announce a completed action to the sheet's live region. */
  onAnnounce: (message: string) => void;
}): JSX.Element {
  const isEditable = useSheetEditable();
  const view = () => props.entry.view;
  // Stable across redraws: the item's own id, not its position. Inline editors
  // use it to find their trigger again after a commit redraws the section.
  const idPrefix = () => `doc-${props.sectionId}-${props.entry.id}`;
  const meta = () => view().meta ?? [];
  const keywords = () => (view().keywords ?? []).filter((keyword) => keyword.trim() !== "");
  const url = () => urlLabel(view().url);
  const label = () => (view().title.value.trim() === "" ? props.noun : view().title.value);

  const draggable = createDraggable(`drag:entry:${props.sectionId}:${props.entry.id}`, {
    type: "entry",
    sectionId: props.sectionId,
    itemId: props.entry.id,
  });
  const droppable = createDroppable(`drop:entry:${props.sectionId}:${props.entry.id}`, {
    type: "entry",
    sectionId: props.sectionId,
    itemId: props.entry.id,
  });

  // Lateral steps mirror the cross-section drag, which only custom sections
  // support — the only pair with a shared item shape.
  const steps = (): MoveStep[] =>
    isCustomId(props.sectionId) ? ["up", "down", "previous", "next"] : ["up", "down"];

  const commit = (field: string, value: string): void => {
    updateItem(props.sectionId, props.entry.index, { [field]: value });
  };

  return (
    <article
      ref={(element) => {
        draggable.ref(element);
        droppable.ref(element);
      }}
      class="doc-sheet__item"
      classList={{
        "doc-sheet__item--hidden": props.entry.hidden,
        "doc-sheet__item--drop": droppable.isActiveDroppable,
        "doc-sheet__item--dragging": draggable.isActiveDraggable,
      }}
      data-entry-id={props.entry.id}
    >
      <Show
        when={!view().inline}
        fallback={
          <p class="doc-sheet__item-inline">
            <span class="doc-sheet__item-inline-label">
              <Slot field={view().title} idPrefix={idPrefix()} onCommit={commit} />
            </span>
            <Show when={view().subtitle}>
              {(subtitle) => (
                <span class="doc-sheet__item-inline-value">
                  <Slot field={subtitle()} idPrefix={idPrefix()} onCommit={commit} />
                </span>
              )}
            </Show>
          </p>
        }
      >
        <div class="doc-sheet__item-head">
          <div>
            <h4 class="doc-sheet__item-title">
              <Slot field={view().title} idPrefix={idPrefix()} onCommit={commit} />
            </h4>
            <Show when={view().subtitle}>
              {(subtitle) => (
                <p class="doc-sheet__item-subtitle">
                  <Slot field={subtitle()} idPrefix={idPrefix()} onCommit={commit} />
                </p>
              )}
            </Show>
          </div>
          <Show when={meta().length > 0}>
            <div class="doc-sheet__item-meta">
              <For each={meta()}>
                {(entry) => (
                  <span>
                    <Slot field={entry} idPrefix={idPrefix()} onCommit={commit} />
                  </span>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>

      <For each={view().details ?? []}>
        {(detail) => (
          <p class="doc-sheet__item-detail">
            <Slot field={detail} idPrefix={idPrefix()} onCommit={commit} />
          </p>
        )}
      </For>

      <For each={view().body ?? []}>
        {(text) => (
          <Show
            when={text.field}
            fallback={
              <div class="doc-sheet__rich-text">
                <MarkdownView value={text.value} />
              </div>
            }
          >
            {(key) => (
              <InlineMarkdown
                value={text.value}
                label={text.label}
                triggerId={`${idPrefix()}-${key()}`}
                onCommit={(value) => commit(key(), value)}
              />
            )}
          </Show>
        )}
      </For>

      <Show when={view().level !== undefined && (view().level ?? 0) > 0}>
        <Level value={view().level ?? 0} />
      </Show>

      <Show when={keywords().length > 0}>
        <ul class="doc-sheet__keywords">
          <For each={keywords()}>{(keyword) => <li class="doc-sheet__keyword">{keyword}</li>}</For>
        </ul>
      </Show>

      <Show when={url() !== ""}>
        <p class="doc-sheet__url">{url()}</p>
      </Show>

      <Show when={isEditable()}>
        <div class="doc-sheet__item-actions" role="group" aria-label={`${label()} actions`}>
          <button
            type="button"
            class="doc-sheet__action doc-sheet__action--icon doc-sheet__drag-handle"
            aria-hidden="true"
            tabindex="-1"
            title={`Drag ${label()} to move it`}
            {...draggable.dragActivators}
          >
            <ChromeIcon path={CHROME_ICONS.handle} />
          </button>
          <For each={steps()}>
            {(step) => (
              <button
                type="button"
                class="doc-sheet__action doc-sheet__action--icon"
                data-doc-move-entry={`${props.entry.id}:${step}`}
                aria-label={`Move ${label()} ${STEP_WORDS[step]}`}
                title={`Move ${label()} ${STEP_WORDS[step]}`}
                onClick={() => props.onMove(props.entry.id, step)}
              >
                <ChromeIcon path={CHROME_ICONS[step]} />
              </button>
            )}
          </For>
          <button
            type="button"
            class="doc-sheet__action"
            aria-label={`Edit ${label()} details`}
            onClick={() => props.onEdit(props.entry)}
          >
            Edit
          </button>
          <button
            type="button"
            class="doc-sheet__action"
            aria-label={`Duplicate ${label()}`}
            onClick={() => {
              duplicateItem(props.sectionId, props.entry.index);
              props.onAnnounce(`${label()} duplicated`);
            }}
          >
            Duplicate
          </button>
          <button
            type="button"
            class="doc-sheet__action"
            aria-label={`${props.entry.hidden ? "Show" : "Hide"} ${label()}`}
            onClick={() => {
              setItemVisibility(props.sectionId, props.entry.index, props.entry.hidden);
              props.onAnnounce(`${label()} ${props.entry.hidden ? "shown" : "hidden"}`);
            }}
          >
            {props.entry.hidden ? "Show" : "Hide"}
          </button>
          <button
            type="button"
            class="doc-sheet__action doc-sheet__action--danger"
            aria-label={`Delete ${label()}`}
            onClick={() => {
              removeItem(props.sectionId, props.entry.index);
              props.onAnnounce(`${label()} deleted`);
            }}
          >
            Delete
          </button>
          <Show when={props.entry.hidden}>
            <span class="doc-sheet__hidden-badge">Hidden</span>
          </Show>
        </div>
      </Show>
    </article>
  );
}

export interface DocSectionProps {
  resume: ResumeData;
  /** A fixed section id, or a custom section's own id. */
  sectionId: string;
  /** Switched off — drawn as chrome, but absent from the PDF. */
  hidden: boolean;
  /** Perform (and announce) a one-step section move. */
  onMoveSection: (sectionId: string, step: MoveStep) => void;
  /** Perform (and announce) a one-step entry move. */
  onMoveEntry: (sectionId: string, itemId: string, step: MoveStep) => void;
  /** Announce a completed action to the sheet's live region. */
  onAnnounce: (message: string) => void;
}

/** The section move controls' label suffixes. */
const SECTION_STEP_WORDS: Record<MoveStep, string> = {
  up: "up",
  down: "down",
  previous: "to the previous column",
  next: "to the next column",
};

/**
 * One section of the sheet: a card with structural chrome around an editable
 * view of its content.
 *
 * `summary` and `coverLetter` carry rich text; every other section carries
 * items. Hidden sections and items are drawn dimmed, as chrome — the editor
 * keeps them reachable, the PDF drops them.
 */
export function DocSection(props: DocSectionProps): JSX.Element {
  const isEditable = useSheetEditable();
  const [editing, setEditing] = createSignal<ItemEntry | null>(null);
  const [isDialogOpen, setIsDialogOpen] = createSignal(false);
  const [isRenameOpen, setIsRenameOpen] = createSignal(false);

  const title = () => sectionTitle(props.resume, props.sectionId);
  const isRichText = () => props.sectionId === "summary" || props.sectionId === "coverLetter";
  const richText = () => {
    if (props.sectionId === "summary") return props.resume.sections.summary?.content ?? "";
    if (props.sectionId === "coverLetter") return props.resume.sections.coverLetter?.content ?? "";
    return "";
  };
  const entries = () => itemEntries(props.resume, props.sectionId);
  const noun = () => itemNoun(title());
  const isCustom = () => isCustomId(props.sectionId);

  const draggable = createDraggable(`drag:section:${props.sectionId}`, {
    type: "section",
    sectionId: props.sectionId,
  });
  const droppable = createDroppable(`drop:section:${props.sectionId}`, {
    type: "section",
    sectionId: props.sectionId,
  });

  function openAdd(): void {
    setEditing(null);
    setIsDialogOpen(true);
  }

  function openEdit(entry: ItemEntry): void {
    setEditing(entry);
    setIsDialogOpen(true);
  }

  return (
    <section
      ref={(element) => {
        draggable.ref(element);
        droppable.ref(element);
      }}
      class="doc-sheet__section"
      classList={{
        "doc-sheet__section--hidden": props.hidden,
        "doc-sheet__section--drop": droppable.isActiveDroppable,
        "doc-sheet__section--dragging": draggable.isActiveDraggable,
      }}
      data-section-id={props.sectionId}
    >
      <Show when={isEditable()}>
        <div
          class="doc-sheet__section-chrome"
          role="group"
          aria-label={`${title()} section controls`}
        >
          <button
            type="button"
            class="doc-sheet__action doc-sheet__action--icon doc-sheet__drag-handle"
            aria-hidden="true"
            tabindex="-1"
            title={`Drag ${title()} section to move it`}
            {...draggable.dragActivators}
          >
            <ChromeIcon path={CHROME_ICONS.handle} />
          </button>
          <For each={["up", "down", "previous", "next"] as MoveStep[]}>
            {(step) => (
              <button
                type="button"
                class="doc-sheet__action doc-sheet__action--icon"
                data-doc-move-section={`${props.sectionId}:${step}`}
                aria-label={`Move ${title()} section ${SECTION_STEP_WORDS[step]}`}
                title={`Move ${title()} section ${SECTION_STEP_WORDS[step]}`}
                onClick={() => props.onMoveSection(props.sectionId, step)}
              >
                <ChromeIcon path={CHROME_ICONS[step]} />
              </button>
            )}
          </For>
          <button
            type="button"
            class="doc-sheet__action"
            aria-label={`${props.hidden ? "Show" : "Hide"} ${title()} section`}
            onClick={() => {
              toggleSection(props.sectionId);
              props.onAnnounce(`${title()} section ${props.hidden ? "shown" : "hidden"}`);
            }}
          >
            {props.hidden ? "Show" : "Hide"}
          </button>
          <Show when={isCustom()}>
            <button
              type="button"
              class="doc-sheet__action"
              aria-label={`Rename ${title()} section`}
              onClick={() => setIsRenameOpen(true)}
            >
              Rename
            </button>
            <button
              type="button"
              class="doc-sheet__action doc-sheet__action--danger"
              aria-label={`Delete ${title()} section`}
              onClick={() => {
                const name = title();
                removeSection(props.sectionId);
                props.onAnnounce(`${name} section deleted`);
              }}
            >
              Delete
            </button>
          </Show>
          <Show when={props.hidden}>
            <span class="doc-sheet__hidden-badge">Hidden</span>
          </Show>
        </div>
      </Show>

      <h3 class="doc-sheet__section-title">
        <InlineText
          value={title()}
          label="Section title"
          triggerId={`doc-${props.sectionId}-section-title`}
          onCommit={(value) => renameSection(props.sectionId, value)}
        />
      </h3>

      <Show when={isRichText()}>
        <InlineMarkdown
          value={richText()}
          label={title()}
          triggerId={`doc-${props.sectionId}-rich-text`}
          onCommit={(value) =>
            props.sectionId === "summary" ? updateSummary(value) : updateCoverLetter(value)
          }
        />
      </Show>

      <Show when={entries().length > 0}>
        <div class="doc-sheet__items">
          <For each={entries()}>
            {(entry) => (
              <Item
                sectionId={props.sectionId}
                entry={entry}
                noun={noun()}
                onEdit={openEdit}
                onMove={(itemId, step) => props.onMoveEntry(props.sectionId, itemId, step)}
                onAnnounce={props.onAnnounce}
              />
            )}
          </For>
        </div>
      </Show>

      <Show when={!isRichText() && isEditable()}>
        <div class="doc-sheet__section-actions">
          <button type="button" class="doc-sheet__action" onClick={openAdd}>
            Add {noun()}
          </button>
        </div>

        <ItemDialog
          open={isDialogOpen()}
          sectionId={props.sectionId}
          sectionTitle={title()}
          index={editing()?.index}
          item={editing()?.item}
          onOpenChange={setIsDialogOpen}
        />
      </Show>

      <Show when={isCustom() && isEditable()}>
        <CustomSectionDialog
          open={isRenameOpen()}
          sectionId={props.sectionId}
          name={title()}
          onOpenChange={setIsRenameOpen}
        />
      </Show>
    </section>
  );
}
