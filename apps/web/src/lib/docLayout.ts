/**
 * Document-editor layout model.
 *
 * Pure, synchronous helpers that turn a `ResumeData` plus a template's layout
 * metadata into the concrete page/column structure the document editor draws.
 * Nothing here reads a store, touches the DOM, or performs I/O: callers read
 * reactive values and pass them in, and callers own every mutation (this module
 * only computes what the next `metadata.layout` *should* be — the write goes
 * through `resumeStore.updateLayout`).
 *
 * `metadata.layout` is `string[][][]`: pages -> columns -> section ids. Section
 * placement is the only pagination mechanism; there are no item-level page
 * breaks.
 */

import { FIXED_LAYOUT_SECTION_KEYS, isHtmlEmpty } from "./resumeSections";
import { createEmptyUrl } from "../wasm/types";
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
  Volunteer,
} from "../wasm/types";

/** A fixed (non-custom) section id that may appear in `metadata.layout`. */
export type FixedSectionId = "summary" | "coverLetter" | (typeof FIXED_LAYOUT_SECTION_KEYS)[number];

/**
 * Canonical fixed-section ids, in layout order.
 *
 * Derived from `FIXED_LAYOUT_SECTION_KEYS` in `lib/resumeSections` — the single
 * source of truth for item-bearing sections — plus the two rich-text sections
 * that carry content rather than items.
 */
export const FIXED_SECTION_IDS: readonly FixedSectionId[] = [
  "summary",
  "coverLetter",
  ...FIXED_LAYOUT_SECTION_KEYS,
];

const FIXED_SECTION_ID_SET: ReadonlySet<string> = new Set<string>(FIXED_SECTION_IDS);

/** Display labels for the fixed sections, used when a section has no name. */
export const SECTION_LABELS: Readonly<Record<FixedSectionId, string>> = {
  summary: "Summary",
  coverLetter: "Cover Letter",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  profiles: "Profiles",
  awards: "Awards",
  certifications: "Certifications",
  publications: "Publications",
  languages: "Languages",
  interests: "Interests",
  volunteer: "Volunteer",
  references: "References",
};

/** Fallback title for a custom section that has no name yet. */
const UNTITLED_CUSTOM_SECTION = "Untitled";

/**
 * Placeholder id that stands for "every custom section, in order".
 *
 * Templates emit it in their default columns (`main_with_custom()` in
 * `crates/render/src/typst_engine/template_layout.rs`) because they cannot know
 * a resume's custom section ids; it is expanded on the way into a page model.
 */
export const CUSTOM_SECTION_SENTINEL = "custom";

/** Column arrangement of a template's page. */
export type TemplateLayoutMode = "single" | "sidebar-left" | "sidebar-right" | "header-split";

/** Presentation of a template's name/headline block. */
export type TemplateHeaderStyle = "left" | "center" | "banner" | "boxed" | "sidebar";

/** Where a template prints the contact details. */
export type TemplateContactIn = "sidebar" | "header" | "banner";

/**
 * Structural layout metadata for a template, as served by `GET /api/templates`
 * (`LayoutInfo` in `crates/server/src/dto.rs`).
 *
 * Always injected by the caller — this module never fetches it.
 */
export interface TemplateLayout {
  /** Column arrangement of the page. */
  layoutMode: TemplateLayoutMode;
  /**
   * Page-0 section ids per column as `[main, sidebar]`, used when the resume
   * carries no explicit layout. Single-column templates leave the sidebar slot
   * empty. May contain {@link CUSTOM_SECTION_SENTINEL}.
   */
  defaultColumns: string[][];
  /** Presentation of the name/headline block. */
  headerStyle: TemplateHeaderStyle;
  /** Placement of the contact details. */
  contactIn: TemplateContactIn;
  /**
   * Fixed sidebar width in typographic points, or `null` when the split is
   * proportional or the template has no sidebar.
   */
  sidebarWidth: number | null;
}

/** Where a section sits inside a `metadata.layout` array. */
export interface SectionPlacement {
  /** Index of the page. */
  page: number;
  /** Index of the column within that page. */
  column: number;
  /** Index of the section id within that column. */
  index: number;
}

/** Role a column plays on the sheet. Column 0 is always the main column. */
export type ColumnRole = "main" | "sidebar";

/** Geometry of one column on a rendered page. */
export interface LayoutColumn {
  /** Index into the page's column array. */
  index: number;
  /** Whether this column is the main content column or the sidebar. */
  role: ColumnRole;
  /** Relative width; the widths of a page's columns sum to 1. */
  width: number;
  /** Visual left-to-right order, which differs from `index` for left sidebars. */
  order: number;
}

/** Any item type a section can hold. */
export type SectionItem =
  | Award
  | Certification
  | CustomItem
  | Education
  | Experience
  | Interest
  | Language
  | Profile
  | Project
  | Publication
  | Reference
  | Skill
  | Volunteer;

/**
 * Nominal sheet geometry used to turn a template's fixed sidebar width into a
 * relative width. Mirrors `content-width` in `templates/_common.typ` and the
 * ratio math in `components/templates/ThemeEditor.tsx`; keep the three in step.
 */
const A4_PAPER_WIDTH_PT = 595.28;
const DEFAULT_PAGE_MARGIN_PT = 18;
const NOMINAL_CONTENT_WIDTH_PT = A4_PAPER_WIDTH_PT - 2 * DEFAULT_PAGE_MARGIN_PT;

/** Sidebar share used when a template's split is proportional rather than fixed. */
const DEFAULT_SIDEBAR_RATIO = 1 / 3;
const MIN_SIDEBAR_RATIO = 0.1;
const MAX_SIDEBAR_RATIO = 0.5;

function clampSidebarRatio(ratio: number): number {
  return Math.min(MAX_SIDEBAR_RATIO, Math.max(MIN_SIDEBAR_RATIO, ratio));
}

/**
 * Whether an id addresses `sections.custom` rather than a fixed section.
 *
 * True for {@link CUSTOM_SECTION_SENTINEL} as well, which addresses every
 * custom section at once.
 */
export function isCustomId(id: string): boolean {
  return id !== "" && !FIXED_SECTION_ID_SET.has(id);
}

function customSectionIds(resume: ResumeData): string[] {
  return Object.keys(resume.sections.custom ?? {});
}

function fixedSection(
  resume: ResumeData,
  id: string,
): { name: string; visible: boolean } | undefined {
  if (!FIXED_SECTION_ID_SET.has(id)) return undefined;
  return resume.sections[id as FixedSectionId];
}

/**
 * Whether a section is switched on. Unknown ids are not visible.
 */
export function sectionVisible(resume: ResumeData, sectionId: string): boolean {
  if (isCustomId(sectionId)) {
    return resume.sections.custom?.[sectionId]?.visible === true;
  }
  return fixedSection(resume, sectionId)?.visible === true;
}

/**
 * Display title for a section: its own name, falling back to the canonical
 * label. Unknown ids yield an empty string.
 */
export function sectionTitle(resume: ResumeData, sectionId: string): string {
  if (isCustomId(sectionId)) {
    const section = resume.sections.custom?.[sectionId];
    if (!section) return "";
    return section.name.trim() === "" ? UNTITLED_CUSTOM_SECTION : section.name;
  }
  const section = fixedSection(resume, sectionId);
  if (!section) return "";
  return section.name.trim() === "" ? SECTION_LABELS[sectionId as FixedSectionId] : section.name;
}

/** Whether a section holds anything worth drawing chrome for. */
function sectionHasContent(resume: ResumeData, sectionId: string): boolean {
  if (isCustomId(sectionId)) {
    const section = resume.sections.custom?.[sectionId];
    return section !== undefined && section.items.some((item) => item.visible);
  }
  if (sectionId === "summary") {
    return !isHtmlEmpty(resume.sections.summary?.content ?? "");
  }
  if (sectionId === "coverLetter") {
    return !isHtmlEmpty(resume.sections.coverLetter?.content ?? "");
  }
  if (!FIXED_SECTION_ID_SET.has(sectionId)) return false;
  // The item types differ per section; only `visible` matters here, so read the
  // section through the one shape every item-bearing section shares.
  const section = resume.sections[sectionId as FixedSectionId] as
    | { items?: { visible: boolean }[] }
    | undefined;
  return section?.items?.some((item) => item.visible) === true;
}

function dropTrailingEmptyColumns(columns: string[][]): string[][] {
  const trimmed = [...columns];
  while (trimmed.length > 1 && trimmed[trimmed.length - 1].length === 0) {
    trimmed.pop();
  }
  return trimmed;
}

/**
 * Expand {@link CUSTOM_SECTION_SENTINEL}, drop ids that address no section, and
 * drop repeats — the first occurrence of an id wins.
 */
function materializeColumns(
  pages: readonly (readonly string[][])[],
  resume: ResumeData,
): string[][][] {
  const customIds = customSectionIds(resume);
  const knownIds = new Set<string>([...FIXED_SECTION_IDS, ...customIds]);
  const placed = new Set<string>();
  let sentinelExpanded = false;

  return pages.map((page) =>
    page.map((column) => {
      const materialized: string[] = [];
      for (const id of column) {
        let candidates: readonly string[];
        if (id === CUSTOM_SECTION_SENTINEL) {
          candidates = sentinelExpanded ? [] : customIds;
          sentinelExpanded = true;
        } else {
          candidates = [id];
        }
        for (const candidate of candidates) {
          if (!knownIds.has(candidate) || placed.has(candidate)) continue;
          placed.add(candidate);
          materialized.push(candidate);
        }
      }
      return materialized;
    }),
  );
}

function hasAnySection(layout: readonly (readonly string[][])[]): boolean {
  return layout.some((page) => page.some((column) => column.length > 0));
}

/**
 * The resume's page/column section-id structure.
 *
 * Seeded from `metadata.layout`, falling back to the template's default columns
 * when that layout is absent or empty. The custom-section sentinel is expanded,
 * ids that address no section are dropped, and a repeated id is kept only at
 * its first position.
 */
export function layoutPages(resume: ResumeData, templateLayout: TemplateLayout): string[][][] {
  const stored = resume.metadata?.layout;
  const source =
    Array.isArray(stored) && hasAnySection(stored)
      ? stored
      : [dropTrailingEmptyColumns(templateLayout.defaultColumns)];
  return materializeColumns(source, resume);
}

/**
 * {@link layoutPages} reduced to what actually renders: hidden sections and
 * sections with no content are dropped, and any page left entirely empty is
 * removed. Empty columns are kept so column indices stay meaningful.
 */
export function renderPages(resume: ResumeData, templateLayout: TemplateLayout): string[][][] {
  return layoutPages(resume, templateLayout)
    .map((page) =>
      page.map((column) =>
        column.filter((id) => sectionVisible(resume, id) && sectionHasContent(resume, id)),
      ),
    )
    .filter((page) => page.some((column) => column.length > 0));
}

/**
 * Column geometry for one page of a layout.
 *
 * The template's mode sets the baseline column count (1 for `single`, 2
 * otherwise); a page that carries more columns than the mode implies keeps all
 * of them, shared out evenly.
 */
export function layoutColumns(
  page: readonly string[][],
  templateLayout: TemplateLayout,
): LayoutColumn[] {
  const modeColumns = templateLayout.layoutMode === "single" ? 1 : 2;
  const count = Math.max(modeColumns, page.length);

  if (count === 1) {
    return [{ index: 0, role: "main", width: 1, order: 0 }];
  }

  if (count > modeColumns || templateLayout.layoutMode === "header-split") {
    return Array.from({ length: count }, (_, index) => ({
      index,
      role: index === 0 ? ("main" as const) : ("sidebar" as const),
      width: 1 / count,
      order: index,
    }));
  }

  const sidebarWidth = templateLayout.sidebarWidth;
  const sidebarRatio =
    sidebarWidth === null
      ? DEFAULT_SIDEBAR_RATIO
      : clampSidebarRatio(sidebarWidth / NOMINAL_CONTENT_WIDTH_PT);
  const sidebarFirst = templateLayout.layoutMode === "sidebar-left";

  return [
    { index: 0, role: "main", width: 1 - sidebarRatio, order: sidebarFirst ? 1 : 0 },
    { index: 1, role: "sidebar", width: sidebarRatio, order: sidebarFirst ? 0 : 1 },
  ];
}

/** Where `sectionId` sits in `layout`, or `null` when it is not placed. */
export function findSectionPlacement(
  layout: readonly (readonly string[][])[],
  sectionId: string,
): SectionPlacement | null {
  for (let page = 0; page < layout.length; page++) {
    const columns = layout[page];
    for (let column = 0; column < columns.length; column++) {
      const index = columns[column].indexOf(sectionId);
      if (index !== -1) return { page, column, index };
    }
  }
  return null;
}

/**
 * A fresh `metadata.layout` for a template switch.
 *
 * Adopts the template's default columns and re-places anything the defaults do
 * not mention — custom sections, and fixed sections such as `coverLetter` that
 * no template lists — so switching templates never silently drops a section.
 * Existing pagination is deliberately not preserved: the new template's page-0
 * arrangement wins, and everything carried over lands on it.
 *
 * Returns the value to hand to `resumeStore.updateLayout`; nothing is mutated.
 */
export function layoutForTemplate(
  resume: ResumeData,
  templateLayout: TemplateLayout,
): string[][][] {
  const defaults = templateLayout.defaultColumns;
  const seed =
    templateLayout.layoutMode === "single" ? [defaults.flat()] : dropTrailingEmptyColumns(defaults);
  const columns = materializeColumns([seed], resume)[0];

  const placed = new Set(columns.flat());
  const customIds = customSectionIds(resume);
  const known = new Set<string>([...FIXED_SECTION_IDS, ...customIds]);
  // Everything the previous layout carried, plus every custom section, minus
  // whatever the new defaults already place. `coverLetter` is the fixed section
  // this saves: no template lists it in `defaultColumns`.
  const carried = new Set<string>([...(resume.metadata?.layout ?? []).flat(2), ...customIds]);
  const missing = [...carried].filter((id) => known.has(id) && !placed.has(id));
  if (missing.length > 0) {
    if (columns.length === 0) {
      columns.push([...missing]);
    } else {
      columns[0] = [...columns[0], ...missing];
    }
  }

  return [columns];
}

/**
 * A collision-free id of the form `<prefix>-<n>`, given the ids already taken.
 */
export function nextId(prefix: string, existing: Iterable<string>): string {
  const taken = new Set(existing);
  let counter = 1;
  while (taken.has(`${prefix}-${counter}`)) {
    counter += 1;
  }
  return `${prefix}-${counter}`;
}

/**
 * A blank item shaped for `sectionId`, or `null` for the fixed sections that
 * hold rich text rather than items (`summary`, `coverLetter`).
 *
 * Any id that is not a fixed section is treated as a custom section id — same
 * rule as {@link isCustomId} — and yields a blank {@link CustomItem}.
 *
 * The item's `id` is left empty on purpose: id generation is not pure, so the
 * caller assigns one (via {@link nextId} or `generateId`) before storing it.
 */
export function emptyItemFor(sectionId: string): SectionItem | null {
  if (isCustomId(sectionId)) {
    return {
      id: "",
      visible: true,
      name: "",
      description: "",
      date: "",
      location: "",
      summary: "",
      keywords: [],
      url: createEmptyUrl(),
    } satisfies CustomItem;
  }

  switch (sectionId) {
    case "experience":
      return {
        id: "",
        visible: true,
        company: "",
        position: "",
        location: "",
        date: "",
        summary: "",
        url: createEmptyUrl(),
      } satisfies Experience;
    case "education":
      return {
        id: "",
        visible: true,
        institution: "",
        area: "",
        studyType: "",
        date: "",
        score: "",
        summary: "",
        url: createEmptyUrl(),
      } satisfies Education;
    case "skills":
      return {
        id: "",
        visible: true,
        name: "",
        description: "",
        level: 0,
        keywords: [],
      } satisfies Skill;
    case "projects":
      return {
        id: "",
        visible: true,
        name: "",
        description: "",
        date: "",
        summary: "",
        keywords: [],
        url: createEmptyUrl(),
      } satisfies Project;
    case "profiles":
      return {
        id: "",
        visible: true,
        network: "",
        username: "",
        icon: "",
        url: createEmptyUrl(),
      } satisfies Profile;
    case "awards":
      return {
        id: "",
        visible: true,
        title: "",
        awarder: "",
        date: "",
        summary: "",
        url: createEmptyUrl(),
      } satisfies Award;
    case "certifications":
      return {
        id: "",
        visible: true,
        name: "",
        issuer: "",
        date: "",
        summary: "",
        url: createEmptyUrl(),
      } satisfies Certification;
    case "publications":
      return {
        id: "",
        visible: true,
        name: "",
        publisher: "",
        date: "",
        summary: "",
        url: createEmptyUrl(),
      } satisfies Publication;
    case "languages":
      return {
        id: "",
        visible: true,
        name: "",
        description: "",
        level: 0,
      } satisfies Language;
    case "interests":
      return { id: "", visible: true, name: "", keywords: [] } satisfies Interest;
    case "volunteer":
      return {
        id: "",
        visible: true,
        organization: "",
        position: "",
        location: "",
        date: "",
        summary: "",
        url: createEmptyUrl(),
      } satisfies Volunteer;
    case "references":
      return {
        id: "",
        visible: true,
        name: "",
        description: "",
        summary: "",
        url: createEmptyUrl(),
      } satisfies Reference;
    default:
      // `summary` and `coverLetter` hold rich text rather than items.
      return null;
  }
}
