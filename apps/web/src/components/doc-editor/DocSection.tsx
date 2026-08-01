/**
 * Read-only section views for the document sheet.
 *
 * Each section type is reduced to one {@link ItemView} descriptor and drawn by
 * a single renderer, so field *order* lives in one obvious place. That order is
 * taken from the Typst templates in
 * `crates/render/src/typst_engine/templates/*.typ`, which are authoritative for
 * what a section shows and in which sequence.
 *
 * Nothing here is interactive. URLs render as text rather than anchors: the
 * sheet is a document surface, not a navigation surface, and click-to-edit
 * (#728) needs the item body free of competing click targets. Faithful
 * rendering — markdown included — is the PDF pane's job (#732).
 */

import { For, Show, type JSX } from "solid-js";
import { isCustomId, sectionTitle } from "../../lib/docLayout";
import { isHtmlEmpty } from "../../lib/resumeSections";
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
 * One item of any section, flattened to the slots the sheet draws.
 *
 * The slots render in declaration order: title/subtitle and meta share the
 * head row, then details, then body, then keywords, level and url.
 */
interface ItemView {
  /** Primary line — company, institution, name, title. */
  title: string;
  /** Secondary line under the title. */
  subtitle?: string;
  /** Right-aligned head-row entries, typically date then location. */
  meta?: string[];
  /** Short plain lines between the head row and the body. */
  details?: string[];
  /** Rich-text (markdown) fields, in template order. */
  body?: string[];
  keywords?: string[];
  /** 0–5 proficiency, drawn as dots. Absent for sections without a level. */
  level?: number;
  url?: Url;
}

function nonEmpty(values: (string | undefined)[]): string[] {
  return values.filter((value): value is string => (value ?? "").trim() !== "");
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
    title: item.company,
    subtitle: item.position,
    meta: nonEmpty([item.date, item.location]),
    body: nonEmpty([item.summary]),
    url: item.url,
  };
}

function educationView(item: Education): ItemView {
  return {
    title: item.institution,
    subtitle: formatDegree(item.studyType, item.area),
    meta: nonEmpty([item.date]),
    details: nonEmpty([item.score]),
    body: nonEmpty([item.summary]),
    url: item.url,
  };
}

function skillView(item: Skill): ItemView {
  return {
    title: item.name,
    body: nonEmpty([item.description]),
    level: item.level,
    keywords: item.keywords,
  };
}

function projectView(item: Project): ItemView {
  return {
    title: item.name,
    meta: nonEmpty([item.date]),
    body: nonEmpty([item.description, item.summary]),
    keywords: item.keywords,
    url: item.url,
  };
}

function profileView(item: Profile): ItemView {
  return {
    title: item.network,
    subtitle: item.username,
    url: item.url,
  };
}

function awardView(item: Award): ItemView {
  return {
    title: item.title,
    subtitle: item.awarder,
    meta: nonEmpty([item.date]),
    body: nonEmpty([item.summary]),
    url: item.url,
  };
}

function certificationView(item: Certification): ItemView {
  return {
    title: item.name,
    subtitle: item.issuer,
    meta: nonEmpty([item.date]),
    body: nonEmpty([item.summary]),
    url: item.url,
  };
}

function publicationView(item: Publication): ItemView {
  return {
    title: item.name,
    subtitle: item.publisher,
    meta: nonEmpty([item.date]),
    body: nonEmpty([item.summary]),
    url: item.url,
  };
}

function languageView(item: Language): ItemView {
  return {
    title: item.name,
    subtitle: item.description,
    level: item.level,
  };
}

function interestView(item: Interest): ItemView {
  return { title: item.name, keywords: item.keywords };
}

function volunteerView(item: Volunteer): ItemView {
  return {
    title: item.organization,
    subtitle: item.position,
    meta: nonEmpty([item.date]),
    details: nonEmpty([item.location]),
    body: nonEmpty([item.summary]),
    url: item.url,
  };
}

function referenceView(item: Reference): ItemView {
  return {
    title: item.name,
    subtitle: item.description,
    body: nonEmpty([item.summary]),
    url: item.url,
  };
}

function customView(item: CustomItem): ItemView {
  return {
    title: item.name,
    subtitle: item.description,
    meta: nonEmpty([item.date]),
    details: nonEmpty([item.location]),
    body: nonEmpty([item.summary]),
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

/**
 * The visible items of `sectionId`, already flattened to {@link ItemView}.
 *
 * Item shapes differ per section, and the adapter table above is the only
 * place that knows which is which — so the lookup is done once, here, behind a
 * cast the table's own keys justify.
 */
function itemViews(resume: ResumeData, sectionId: string): { id: string; view: ItemView }[] {
  if (isCustomId(sectionId)) {
    const section = resume.sections.custom?.[sectionId];
    return (section?.items ?? [])
      .filter((item) => item.visible)
      .map((item) => ({ id: item.id, view: customView(item) }));
  }

  const adapter = ITEM_VIEWS[sectionId as ItemSectionId] as
    | ((item: VisibleItem) => ItemView)
    | undefined;
  if (!adapter) return [];

  const section = resume.sections[sectionId as ItemSectionId] as { items?: VisibleItem[] };
  return (section.items ?? [])
    .filter((item) => item.visible)
    .map((item) => ({ id: item.id, view: adapter(item) }));
}

/** Rich text shown verbatim — see the module note on markdown. */
function RichText(props: { value: string }): JSX.Element {
  return <p class="doc-sheet__rich-text">{props.value}</p>;
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

function Item(props: { view: ItemView }): JSX.Element {
  const meta = () => props.view.meta ?? [];
  const keywords = () => (props.view.keywords ?? []).filter((keyword) => keyword.trim() !== "");
  const url = () => urlLabel(props.view.url);

  return (
    <article class="doc-sheet__item">
      <div class="doc-sheet__item-head">
        <div>
          <Show when={props.view.title.trim() !== ""}>
            <h4 class="doc-sheet__item-title">{props.view.title}</h4>
          </Show>
          <Show when={(props.view.subtitle ?? "").trim() !== ""}>
            <p class="doc-sheet__item-subtitle">{props.view.subtitle}</p>
          </Show>
        </div>
        <Show when={meta().length > 0}>
          <div class="doc-sheet__item-meta">
            <For each={meta()}>{(entry) => <span>{entry}</span>}</For>
          </div>
        </Show>
      </div>

      <For each={props.view.details ?? []}>
        {(detail) => <p class="doc-sheet__item-detail">{detail}</p>}
      </For>

      <For each={props.view.body ?? []}>{(text) => <RichText value={text} />}</For>

      <Show when={props.view.level !== undefined && props.view.level > 0}>
        <Level value={props.view.level ?? 0} />
      </Show>

      <Show when={keywords().length > 0}>
        <ul class="doc-sheet__keywords">
          <For each={keywords()}>{(keyword) => <li class="doc-sheet__keyword">{keyword}</li>}</For>
        </ul>
      </Show>

      <Show when={url() !== ""}>
        <p class="doc-sheet__url">{url()}</p>
      </Show>
    </article>
  );
}

export interface DocSectionProps {
  resume: ResumeData;
  /** A fixed section id, or a custom section's own id. */
  sectionId: string;
}

/**
 * One section of the sheet: its heading plus a read view of its content.
 *
 * `summary` and `coverLetter` carry rich text; every other section carries
 * items. Hidden items are dropped; hidden and empty *sections* never reach
 * here, because `renderPages()` has already filtered them out.
 */
export function DocSection(props: DocSectionProps): JSX.Element {
  const title = () => sectionTitle(props.resume, props.sectionId);
  const richText = () => {
    if (props.sectionId === "summary") return props.resume.sections.summary?.content ?? "";
    if (props.sectionId === "coverLetter") return props.resume.sections.coverLetter?.content ?? "";
    return "";
  };
  const items = () => itemViews(props.resume, props.sectionId);

  return (
    <section class="doc-sheet__section" data-section-id={props.sectionId}>
      <h3 class="doc-sheet__section-title">{title()}</h3>
      <Show when={!isHtmlEmpty(richText())}>
        <RichText value={richText()} />
      </Show>
      <Show when={items().length > 0}>
        <div class="doc-sheet__items">
          <For each={items()}>{(entry) => <Item view={entry.view} />}</For>
        </div>
      </Show>
    </section>
  );
}
