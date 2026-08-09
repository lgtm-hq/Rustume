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
 * `metadata.layout` is `string[][][]`: pages -> columns -> section ids.
 * Mid-section pagination (`metadata.itemBreaks`) layers on top of this raw
 * structure — see `docPagination.ts` for the expansion pipeline.
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
 * CSS-pixel A4 geometry of the sheet (#794, spec §3.1).
 *
 * The on-screen sheet is `min(860px, 100%)` wide and sizes to its content;
 * these constants are what the overflow guides, the measured page count and
 * the PDF export agree on. 860×1122 is A4 at ~96 dpi.
 */
export const PAGE_WIDTH_PX = 860;
export const PAGE_HEIGHT_PX = 1122;

/**
 * One typographic point in sheet CSS pixels: stored point sizes (the avatar,
 * its border) render against the 860px sheet exactly as they do against the
 * 595.28pt A4 render.
 */
export const SHEET_PX_PER_PT = PAGE_WIDTH_PX / 595.28;

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

/** Section heading chrome — maps to sheet modifier classes, not free-form CSS. */
export type TemplateHeadingStyle = "band" | "underline" | "rule" | "plain";

/** Letter-case transform for section titles. */
export type TemplateHeadingCase = "upper" | "as-written";

/** Ink colour for section heading text. */
export type TemplateHeadingInk = "accent" | "text";

/** Body typeface id hardcoded by the Typst template. */
export type TemplateBodyFont = "ibm-plex-sans" | "ibm-plex-serif";

/** Keyword list presentation. */
export type TemplateKeywordStyle = "chips" | "plain";

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
  /** Main-column (and single-column) section heading chrome. */
  headingStyle: TemplateHeadingStyle;
  /** Sidebar section heading chrome. */
  sidebarHeadingStyle: TemplateHeadingStyle;
  /** Case transform for section titles. */
  headingCase: TemplateHeadingCase;
  /** Main-column heading ink. Band headings ignore this. */
  headingInk: TemplateHeadingInk;
  /** Sidebar heading ink. */
  sidebarHeadingInk: TemplateHeadingInk;
  /** Body typeface id (`ibm-plex-sans` | `ibm-plex-serif`). */
  fontBody: TemplateBodyFont;
  /** Whether the sidebar paints a tinted background. */
  sidebarTint: boolean;
  /** Keyword list presentation. */
  keywordStyle: TemplateKeywordStyle;
  /** Whether an accent rule sits under the identity header. */
  headerRule: boolean;
}

/** CSS font stack for a template body-font id. */
export function docFontStack(fontBody: TemplateBodyFont): string {
  switch (fontBody) {
    case "ibm-plex-serif":
      return '"IBM Plex Serif", Georgia, "Times New Roman", serif';
    case "ibm-plex-sans":
    default:
      return '"IBM Plex Sans", "Helvetica Neue", Arial, sans-serif';
  }
}

/**
 * Layout used when a template's own metadata cannot be fetched.
 *
 * A single column holding every section in canonical order — the same shape a
 * single-column template declares — so the sheet still draws a faithful,
 * complete document when `GET /api/templates` is unavailable, or when a
 * template served by an older self-hosted server carries no layout block.
 */
const FALLBACK_CHROME = {
  headingStyle: "underline" as TemplateHeadingStyle,
  sidebarHeadingStyle: "underline" as TemplateHeadingStyle,
  headingCase: "upper" as TemplateHeadingCase,
  headingInk: "accent" as TemplateHeadingInk,
  sidebarHeadingInk: "accent" as TemplateHeadingInk,
  fontBody: "ibm-plex-sans" as TemplateBodyFont,
  sidebarTint: false,
  keywordStyle: "plain" as TemplateKeywordStyle,
  headerRule: true,
};

export const FALLBACK_TEMPLATE_LAYOUT: TemplateLayout = {
  layoutMode: "single",
  defaultColumns: [[...FIXED_SECTION_IDS, CUSTOM_SECTION_SENTINEL], []],
  headerStyle: "left",
  contactIn: "header",
  sidebarWidth: null,
  ...FALLBACK_CHROME,
};

/**
 * Bundled mirror of `get_template_layout` in
 * `crates/render/src/typst_engine/template_layout.rs`, for callers that must
 * resolve a template's layout synchronously — the store seeds `metadata.layout`
 * during normalization, before `GET /api/templates` can resolve. Keep the two
 * in lockstep; the server-fetched layout still wins wherever it is available.
 */
const DEFAULT_MAIN_SECTIONS: readonly string[] = [
  "summary",
  "experience",
  "education",
  "awards",
  "certifications",
  "publications",
  "volunteer",
  "projects",
  "references",
];

const DEFAULT_SIDEBAR_SECTIONS: readonly string[] = [
  "profiles",
  "skills",
  "interests",
  "certifications",
  "awards",
  "publications",
  "languages",
];

function uniqueSections(...sources: readonly (readonly string[])[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const source of sources) {
    for (const id of source) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

type BundledChrome = Pick<
  TemplateLayout,
  | "headingStyle"
  | "sidebarHeadingStyle"
  | "headingCase"
  | "headingInk"
  | "sidebarHeadingInk"
  | "fontBody"
  | "sidebarTint"
  | "keywordStyle"
  | "headerRule"
>;

function chromeUnderlinePlain(headerRule: boolean): BundledChrome {
  return {
    headingStyle: "underline",
    sidebarHeadingStyle: "underline",
    headingCase: "upper",
    headingInk: "accent",
    sidebarHeadingInk: "accent",
    fontBody: "ibm-plex-sans",
    sidebarTint: false,
    keywordStyle: "plain",
    headerRule,
  };
}

function chromeUnderlineChips(headerRule: boolean, sidebarTint: boolean): BundledChrome {
  return {
    headingStyle: "underline",
    sidebarHeadingStyle: "underline",
    headingCase: "upper",
    headingInk: "accent",
    sidebarHeadingInk: "accent",
    fontBody: "ibm-plex-sans",
    sidebarTint,
    keywordStyle: "chips",
    headerRule,
  };
}

function bundledSingle(headerStyle: TemplateHeaderStyle, chrome: BundledChrome): TemplateLayout {
  return {
    layoutMode: "single",
    defaultColumns: [
      uniqueSections(DEFAULT_MAIN_SECTIONS, DEFAULT_SIDEBAR_SECTIONS, [CUSTOM_SECTION_SENTINEL]),
      [],
    ],
    headerStyle,
    contactIn: "header",
    sidebarWidth: null,
    ...chrome,
  };
}

function bundledTwoColumn(
  layoutMode: TemplateLayoutMode,
  headerStyle: TemplateHeaderStyle,
  contactIn: TemplateContactIn,
  sidebarWidth: number | null,
  chrome: BundledChrome,
): TemplateLayout {
  return {
    layoutMode,
    defaultColumns: [
      uniqueSections(DEFAULT_MAIN_SECTIONS, [CUSTOM_SECTION_SENTINEL]),
      uniqueSections(DEFAULT_SIDEBAR_SECTIONS),
    ],
    headerStyle,
    contactIn,
    sidebarWidth,
    ...chrome,
  };
}

/**
 * The bundled layout for a template id. Unknown ids fall back to the rhyhorn
 * single-column shape, mirroring the Rust side.
 */
export function bundledTemplateLayout(template: string): TemplateLayout {
  switch (template) {
    case "rhyhorn":
      return bundledSingle("left", chromeUnderlinePlain(true));
    case "onyx":
      return bundledSingle("left", chromeUnderlineChips(true, false));
    case "nosepass":
      return bundledSingle("left", {
        headingStyle: "rule",
        sidebarHeadingStyle: "rule",
        headingCase: "as-written",
        headingInk: "accent",
        sidebarHeadingInk: "accent",
        fontBody: "ibm-plex-serif",
        sidebarTint: false,
        keywordStyle: "plain",
        headerRule: true,
      });
    case "bronzor":
      return bundledSingle("center", chromeUnderlinePlain(true));
    case "kakuna":
      return bundledSingle("boxed", chromeUnderlineChips(false, false));
    case "azurill":
      return bundledTwoColumn(
        "sidebar-left",
        "center",
        "header",
        null,
        chromeUnderlineChips(true, false),
      );
    case "chikorita":
      // Tinted: chikorita.typ wraps the right column in a light-bg box.
      return bundledTwoColumn(
        "sidebar-right",
        "left",
        "header",
        null,
        chromeUnderlineChips(true, true),
      );
    case "ditto":
      return bundledTwoColumn(
        "sidebar-left",
        "banner",
        "banner",
        160,
        chromeUnderlineChips(false, true),
      );
    case "gengar":
      return bundledTwoColumn("sidebar-left", "sidebar", "sidebar", 170, {
        headingStyle: "underline",
        sidebarHeadingStyle: "underline",
        headingCase: "upper",
        headingInk: "text",
        sidebarHeadingInk: "accent",
        fontBody: "ibm-plex-sans",
        sidebarTint: true,
        keywordStyle: "chips",
        headerRule: false,
      });
    case "glalie":
      return bundledTwoColumn("sidebar-left", "sidebar", "sidebar", 170, {
        headingStyle: "underline",
        sidebarHeadingStyle: "underline",
        headingCase: "as-written",
        headingInk: "accent",
        sidebarHeadingInk: "accent",
        fontBody: "ibm-plex-sans",
        sidebarTint: true,
        keywordStyle: "plain",
        headerRule: false,
      });
    case "pikachu":
      return bundledTwoColumn("sidebar-left", "left", "sidebar", 180, {
        headingStyle: "band",
        sidebarHeadingStyle: "plain",
        headingCase: "upper",
        headingInk: "accent",
        sidebarHeadingInk: "accent",
        fontBody: "ibm-plex-sans",
        sidebarTint: true,
        keywordStyle: "plain",
        headerRule: false,
      });
    case "leafish":
      return {
        layoutMode: "header-split",
        defaultColumns: [
          uniqueSections(DEFAULT_MAIN_SECTIONS),
          uniqueSections(DEFAULT_SIDEBAR_SECTIONS, [CUSTOM_SECTION_SENTINEL]),
        ],
        headerStyle: "banner",
        contactIn: "banner",
        sidebarWidth: null,
        ...chromeUnderlineChips(false, false),
      };
    default:
      return bundledSingle("left", chromeUnderlinePlain(true));
  }
}

/**
 * Column index the template's defaults assign `sectionId`, after first-seen
 * dedup across columns — an id listed in both columns resolves to the main
 * column, exactly where `materializeColumns` would place it.
 */
export function defaultColumnIndexFor(sectionId: string, templateLayout: TemplateLayout): number {
  const seen = new Set<string>();
  for (let column = 0; column < templateLayout.defaultColumns.length; column++) {
    for (const id of templateLayout.defaultColumns[column]) {
      if (seen.has(id)) continue;
      seen.add(id);
      if (id === sectionId) return column;
    }
  }
  return 0;
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
 * relative width. Mirrors `content-width` in `templates/_common.typ`; keep the
 * two in step.
 */
const A4_PAPER_WIDTH_PT = 595.28;
const DEFAULT_PAGE_MARGIN_PT = 18;
const NOMINAL_CONTENT_WIDTH_PT = A4_PAPER_WIDTH_PT - 2 * DEFAULT_PAGE_MARGIN_PT;

/** Sidebar share used when a template's split is proportional rather than fixed. */
const DEFAULT_SIDEBAR_RATIO = 1 / 3;
const MIN_SIDEBAR_RATIO = 0.1;
const MAX_SIDEBAR_RATIO = 0.5;

/**
 * The sheet's content width in sheet pixels — what `metadata.page.sidebarRatio`
 * is a fraction *of*. The ratio is content-relative because that is how the
 * renderer reads it (`_common.typ`), so a sheet resize and the PDF agree.
 */
export const SHEET_CONTENT_WIDTH_PX = NOMINAL_CONTENT_WIDTH_PT * SHEET_PX_PER_PT;

/** Clamp a sidebar ratio to the schema's legal 0.1–0.5 range. */
export function clampSidebarRatio(ratio: number): number {
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
export function sectionHasContent(resume: ResumeData, sectionId: string): boolean {
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
 * `layout` with page `pageIndex` merged into the page before it — the layout
 * half of "remove page break" (`metadata.itemBreaks`-aware semantics live in
 * `docPagination.resolvePageBreakRemoval`). Columns concatenate index-wise;
 * the first occurrence of a section id wins. Returns `null` when the merge is
 * impossible (page 0, or an index past the last page), so callers write
 * nothing rather than an unchanged layout.
 */
export function mergePageIntoPrevious(
  layout: readonly (readonly (readonly string[])[])[],
  pageIndex: number,
): string[][][] | null {
  if (pageIndex <= 0 || pageIndex >= layout.length) return null;
  const pages = layout.map((page) => page.map((column) => [...column]));
  const previous = pages[pageIndex - 1];
  const current = pages[pageIndex];
  const columns = Math.max(previous.length, current.length);
  const merged: string[][] = [];
  // Dedup across the whole merged page, not per column: a section sitting in
  // a different column on the two pages must still collapse to one placement.
  const seen = new Set(previous.flat());
  for (let column = 0; column < columns; column++) {
    const head = previous[column] ?? [];
    const tail = (current[column] ?? []).filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    merged.push([...head, ...tail]);
  }
  pages.splice(pageIndex - 1, 2, merged);
  return pages;
}

/**
 * Column geometry for one page of a layout.
 *
 * The template's mode sets the baseline column count (1 for `single`, 2
 * otherwise); a page that carries more columns than the mode implies keeps all
 * of them, shared out evenly.
 */
export function layoutColumns(
  // Only the column count matters, so any drawn column shape is accepted.
  page: readonly (readonly unknown[])[],
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
  layout: readonly (readonly (readonly string[])[])[],
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
 * A fresh `metadata.layout` seeded from the bundled defaults of the resume's
 * own template — the store's synchronous replacement for the flat
 * single-column seed that pinned sidebar sections in the main column (#819).
 * `coverLetter` leads the main column when the defaults leave it unplaced,
 * mirroring `default_layout()` in `crates/schema/src/metadata.rs` (its column
 * position does not affect rendering — it draws as a dedicated page).
 */
export function seededLayoutForResume(resume: ResumeData): string[][][] {
  const templateLayout = bundledTemplateLayout(resume.metadata?.template ?? "");
  const pages = layoutForTemplate(resume, templateLayout);
  const columns = pages[0] ?? [];
  if (!columns.some((column) => column.includes("coverLetter"))) {
    if (columns.length === 0) {
      columns.push(["coverLetter"]);
      pages[0] = columns;
    } else {
      columns[0].unshift("coverLetter");
    }
  }
  return pages;
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
        keywords: [],
        customFields: [],
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
        keywords: [],
        customFields: [],
      } satisfies Education;
    case "skills":
      return {
        id: "",
        visible: true,
        name: "",
        description: "",
        level: 0,
        keywords: [],
        customFields: [],
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
        customFields: [],
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
