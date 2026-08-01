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
 * URLs still render as text rather than anchors: the sheet is a document
 * surface, not a navigation surface, and a link inside an item would compete
 * with the item's own click targets. Faithful markdown rendering is the PDF
 * pane's job (#732).
 */

import { For, Show, createSignal, type JSX } from "solid-js";
import { InlineMarkdown } from "./InlineMarkdown";
import { InlineText } from "./InlineText";
import { ItemDialog } from "./ItemDialog";
import { renameSection, updateCoverLetter, updateItem, updateSummary } from "./docEdits";
import { itemNoun } from "./itemFields";
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
  return {
    title: bind(item.network, "Network", "network"),
    subtitle: bind(item.username, "Username", "username"),
    url: item.url,
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
  item: Record<string, unknown>;
  view: ItemView;
}

/**
 * The visible items of `sectionId`, already flattened to {@link ItemView}.
 *
 * Item shapes differ per section, and the adapter table above is the only
 * place that knows which is which — so the lookup is done once, here, behind a
 * cast the table's own keys justify. Hidden items are dropped from the drawing
 * but keep their index, because that is what `updateSectionItem` addresses.
 */
function itemEntries(resume: ResumeData, sectionId: string): ItemEntry[] {
  const adapter = isCustomId(sectionId)
    ? (customView as (item: VisibleItem) => ItemView)
    : (ITEM_VIEWS[sectionId as ItemSectionId] as ((item: VisibleItem) => ItemView) | undefined);
  if (!adapter) return [];

  const section = isCustomId(sectionId)
    ? resume.sections.custom?.[sectionId]
    : (resume.sections[sectionId as ItemSectionId] as { items?: VisibleItem[] } | undefined);

  return (section?.items ?? [])
    .map((item, index) => ({
      id: item.id,
      index,
      item: item as unknown as Record<string, unknown>,
      view: adapter(item),
      visible: item.visible,
    }))
    .filter((entry) => entry.visible)
    .map(({ visible: _visible, ...entry }) => entry);
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

function Item(props: {
  sectionId: string;
  entry: ItemEntry;
  /** Singular noun for this section's items, used in the edit button's label. */
  noun: string;
  onEdit: (entry: ItemEntry) => void;
}): JSX.Element {
  const view = () => props.entry.view;
  // Stable across redraws: the item's own id, not its position. Inline editors
  // use it to find their trigger again after a commit redraws the section.
  const idPrefix = () => `doc-${props.sectionId}-${props.entry.id}`;
  const meta = () => view().meta ?? [];
  const keywords = () => (view().keywords ?? []).filter((keyword) => keyword.trim() !== "");
  const url = () => urlLabel(view().url);

  const commit = (field: string, value: string): void => {
    updateItem(props.sectionId, props.entry.index, { [field]: value });
  };

  return (
    <article class="doc-sheet__item">
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

      <For each={view().details ?? []}>
        {(detail) => (
          <p class="doc-sheet__item-detail">
            <Slot field={detail} idPrefix={idPrefix()} onCommit={commit} />
          </p>
        )}
      </For>

      <For each={view().body ?? []}>
        {(text) => (
          <Show when={text.field} fallback={<p class="doc-sheet__rich-text">{text.value}</p>}>
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

      <button
        type="button"
        class="doc-sheet__action doc-sheet__action--item"
        aria-label={`Edit ${view().title.value.trim() === "" ? props.noun : view().title.value} details`}
        onClick={() => props.onEdit(props.entry)}
      >
        Edit
      </button>
    </article>
  );
}

export interface DocSectionProps {
  resume: ResumeData;
  /** A fixed section id, or a custom section's own id. */
  sectionId: string;
}

/**
 * One section of the sheet: its heading plus an editable view of its content.
 *
 * `summary` and `coverLetter` carry rich text; every other section carries
 * items. Hidden items are dropped; hidden and empty *sections* never reach
 * here, because `renderPages()` has already filtered them out.
 */
export function DocSection(props: DocSectionProps): JSX.Element {
  const [editing, setEditing] = createSignal<ItemEntry | null>(null);
  const [isDialogOpen, setIsDialogOpen] = createSignal(false);

  const title = () => sectionTitle(props.resume, props.sectionId);
  const isRichText = () => props.sectionId === "summary" || props.sectionId === "coverLetter";
  const richText = () => {
    if (props.sectionId === "summary") return props.resume.sections.summary?.content ?? "";
    if (props.sectionId === "coverLetter") return props.resume.sections.coverLetter?.content ?? "";
    return "";
  };
  const entries = () => itemEntries(props.resume, props.sectionId);
  const noun = () => itemNoun(title());

  function openAdd(): void {
    setEditing(null);
    setIsDialogOpen(true);
  }

  function openEdit(entry: ItemEntry): void {
    setEditing(entry);
    setIsDialogOpen(true);
  }

  return (
    <section class="doc-sheet__section" data-section-id={props.sectionId}>
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
              <Item sectionId={props.sectionId} entry={entry} noun={noun()} onEdit={openEdit} />
            )}
          </For>
        </div>
      </Show>

      <Show when={!isRichText()}>
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
    </section>
  );
}
