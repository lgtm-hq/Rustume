/**
 * Mid-section pagination model (#796, spec §3.3–§3.5).
 *
 * Pure helpers around `metadata.itemBreaks` — the item ids that start a new
 * page within a section. A section with N honored break markers occupies N+1
 * consecutive pages in the same column; continuation slices render the title
 * with a "(cont.)" suffix. Nothing here reads a store or touches the DOM:
 * callers pass the resume and the template layout in, and every mutation
 * helper returns the *next* value for the caller to write (`null` for a
 * change that would change nothing, so callers write nothing).
 *
 * The rules mirror the renderer (`_common.typ`): breaks are honored only on
 * main-flow sections, only on single-flow templates (Typst cannot page-break
 * inside a grid), and a marker on a slice's first item is inert — slices are
 * never empty.
 */

import {
  findSectionPlacement,
  isCustomId,
  layoutPages,
  mergePageIntoPrevious,
  sectionHasContent,
  sectionVisible,
  type TemplateLayout,
} from "./docLayout";
import type { ResumeData } from "../wasm/types";

/**
 * Main-flow section ids allowed to carry mid-section page breaks (spec §3.4).
 * Break markers on any other section are ignored and stripped by repairs —
 * chip and sidebar sections over-fragment into empty sheets. Mirrors
 * `item-break-sections` in `crates/render/.../_common.typ`; keep in step.
 */
export const ITEM_BREAK_SECTION_IDS: readonly string[] = [
  "experience",
  "education",
  "projects",
  "volunteer",
  "awards",
  "certifications",
  "publications",
  "references",
];

const ITEM_BREAK_SECTION_ID_SET: ReadonlySet<string> = new Set(ITEM_BREAK_SECTION_IDS);

/** Why the insert-break action is unavailable, shown as the tooltip text. */
export const ITEM_BREAK_TEMPLATE_DISABLED_REASON =
  "This template's column layout paginates automatically; " +
  "manual item breaks apply only to single-flow templates.";

/** Whether `sectionId` may carry mid-section page breaks at all. */
export function sectionSupportsItemBreaks(sectionId: string): boolean {
  return ITEM_BREAK_SECTION_ID_SET.has(sectionId);
}

/**
 * Whether the template's layout can honor mid-section breaks. Only
 * single-flow templates can — Typst cannot page-break inside a grid, so
 * markers on sidebar/two-column templates are inert (owner decision
 * 2026-08-03: the editor greys the insert action out there, with a tooltip).
 */
export function templateSupportsItemBreaks(templateLayout: TemplateLayout): boolean {
  return templateLayout.layoutMode === "single";
}

/** The `id`/`visible` shape every section item shares. */
interface BreakableItem {
  id: string;
  visible: boolean;
}

function sectionItems(resume: ResumeData, sectionId: string): BreakableItem[] {
  if (isCustomId(sectionId)) {
    return resume.sections.custom?.[sectionId]?.items ?? [];
  }
  const section = resume.sections[sectionId as keyof typeof resume.sections] as
    | { items?: BreakableItem[] }
    | undefined;
  return section?.items ?? [];
}

/**
 * The item ids a sheet draws for `sectionId`, in stored order. Edit mode
 * draws hidden items as chrome (`includeHidden`); Done mode, like the PDF,
 * draws only visible ones — slicing and page expansion must follow the same
 * list the sheet actually draws.
 */
export function drawnItemIds(
  resume: ResumeData,
  sectionId: string,
  includeHidden: boolean,
): string[] {
  return sectionItems(resume, sectionId)
    .filter((item) => includeHidden || item.visible)
    .map((item) => item.id);
}

/**
 * The section's honored break markers, in item order: markers on sections or
 * templates that cannot carry them, and markers whose item is not drawn, are
 * dropped.
 */
export function orderedItemBreaks(
  resume: ResumeData,
  sectionId: string,
  includeHidden: boolean,
): string[] {
  if (!sectionSupportsItemBreaks(sectionId)) return [];
  const raw = resume.metadata.itemBreaks?.[sectionId] ?? [];
  if (raw.length === 0) return [];
  const markers = new Set(raw);
  return drawnItemIds(resume, sectionId, includeHidden).filter((id) => markers.has(id));
}

/**
 * Split `itemIds` into page slices: each break marker starts a new slice.
 * Never yields an empty slice — a marker on the first drawn item is inert,
 * matching the renderer (`split-items-by-breaks` in `_common.typ`).
 */
export function itemSlices(itemIds: readonly string[], breakIds: readonly string[]): string[][] {
  if (itemIds.length === 0) return [[]];
  if (breakIds.length === 0) return [[...itemIds]];
  const markers = new Set(breakIds);
  const slices: string[][] = [[]];
  for (const id of itemIds) {
    if (markers.has(id) && slices[slices.length - 1].length > 0) {
      slices.push([]);
    }
    slices[slices.length - 1].push(id);
  }
  return slices;
}

function cloneLayout(layout: readonly (readonly (readonly string[])[])[]): string[][][] {
  return layout.map((page) => page.map((column) => [...column]));
}

/**
 * {@link layoutPages} expanded so a section with N honored breaks appears on
 * N+1 consecutive pages in the same column (spec §3.3 step 2). Missing pages
 * and columns are created; nothing is stripped — feed the result through the
 * mode filters below for the drawn page stack.
 */
export function expandItemBreakPages(
  resume: ResumeData,
  templateLayout: TemplateLayout,
  includeHidden: boolean,
): string[][][] {
  const pages = cloneLayout(layoutPages(resume, templateLayout));
  if (!templateSupportsItemBreaks(templateLayout)) return pages;

  const placements: { id: string; page: number; column: number; sliceCount: number }[] = [];
  for (let page = 0; page < pages.length; page++) {
    for (let column = 0; column < pages[page].length; column++) {
      for (const id of pages[page][column]) {
        const breaks = orderedItemBreaks(resume, id, includeHidden);
        if (breaks.length === 0) continue;
        const sliceCount = itemSlices(drawnItemIds(resume, id, includeHidden), breaks).length;
        if (sliceCount > 1) placements.push({ id, page, column, sliceCount });
      }
    }
  }

  for (const { id, page, column, sliceCount } of placements) {
    for (let slice = 1; slice < sliceCount; slice++) {
      const target = page + slice;
      while (pages.length <= target) {
        const columns = Math.max(1, pages[page]?.length ?? 1);
        pages.push(Array.from({ length: columns }, () => []));
      }
      while (pages[target].length <= column) {
        pages[target].push([]);
      }
      if (!pages[target][column].includes(id)) {
        pages[target][column] = [id, ...pages[target][column]];
      }
    }
  }
  return pages;
}

/** Slice position of a section instance within an expanded page list. */
function sliceIndexInPages(
  pages: readonly (readonly (readonly string[])[])[],
  sectionId: string,
  pageIndex: number,
  columnIndex: number,
): number {
  let slice = 0;
  for (let page = 0; page < pageIndex; page++) {
    if (pages[page]?.[columnIndex]?.includes(sectionId)) slice += 1;
  }
  return slice;
}

/**
 * Which item slice the section instance at `pageIndex`/`columnIndex` shows.
 * Counted on the **pre-strip** expanded pages, so indices stay aligned with
 * `itemBreaks` even when empty continuation chrome was stripped (spec §3.3
 * step 4). Instances with slice > 0 render the title as "<Title> (cont.)".
 */
export function sectionSliceIndex(
  resume: ResumeData,
  templateLayout: TemplateLayout,
  sectionId: string,
  pageIndex: number,
  columnIndex: number,
  includeHidden: boolean,
  expandedPages?: readonly (readonly (readonly string[])[])[],
): number {
  return sliceIndexInPages(
    expandedPages ?? expandItemBreakPages(resume, templateLayout, includeHidden),
    sectionId,
    pageIndex,
    columnIndex,
  );
}

/** One drawn instance of a sliced section: which items, and where it sits. */
export interface SectionSlice {
  /** 0-based slice position; slices > 0 render the "(cont.)" title. */
  index: number;
  /** The item ids this instance draws. */
  itemIds: string[];
  /** Only the last slice carries the add affordances (spec §2.6). */
  isLast: boolean;
}

/**
 * The slice a section instance draws, or `null` when the section is not
 * sliced at all (no honored breaks) — callers draw the whole section then.
 *
 * `expandedPages` lets a caller drawing many instances reuse one
 * {@link expandItemBreakPages} result instead of re-deriving it per card.
 */
export function sectionSliceAt(
  resume: ResumeData,
  templateLayout: TemplateLayout,
  sectionId: string,
  pageIndex: number,
  columnIndex: number,
  includeHidden: boolean,
  expandedPages?: readonly (readonly (readonly string[])[])[],
): SectionSlice | null {
  if (!templateSupportsItemBreaks(templateLayout)) return null;
  const breaks = orderedItemBreaks(resume, sectionId, includeHidden);
  if (breaks.length === 0) return null;
  const slices = itemSlices(drawnItemIds(resume, sectionId, includeHidden), breaks);
  if (slices.length <= 1) return null;
  const index = Math.min(
    sectionSliceIndex(
      resume,
      templateLayout,
      sectionId,
      pageIndex,
      columnIndex,
      includeHidden,
      expandedPages,
    ),
    slices.length - 1,
  );
  return { index, itemIds: slices[index], isLast: index === slices.length - 1 };
}

/** Whether a section instance has anything to draw on its slice (spec §3.3). */
function sectionHasSliceContent(
  resume: ResumeData,
  pages: readonly (readonly (readonly string[])[])[],
  sectionId: string,
  pageIndex: number,
  columnIndex: number,
): boolean {
  const slice = sliceIndexInPages(pages, sectionId, pageIndex, columnIndex);
  if (sectionId === "summary" || sectionId === "coverLetter") {
    return slice === 0 && sectionHasContent(resume, sectionId);
  }
  const breaks = orderedItemBreaks(resume, sectionId, false);
  if (breaks.length === 0) {
    return slice === 0 && sectionHasContent(resume, sectionId);
  }
  const slices = itemSlices(drawnItemIds(resume, sectionId, false), breaks);
  return (slices[slice]?.length ?? 0) > 0;
}

/**
 * The page stack Done mode (and the PDF) draws: expanded pages with hidden
 * sections, contentless slices and trailing empty pages stripped. Only
 * *trailing* empty pages are dropped (spec §3.3) — dropping one mid-stack
 * would misalign the drawn page indices the slice lookup and the page-break
 * rules address.
 */
export function renderSheetPages(resume: ResumeData, templateLayout: TemplateLayout): string[][][] {
  const expanded = expandItemBreakPages(resume, templateLayout, false);
  const stripped = expanded.map((page, pageIndex) =>
    page.map((column, columnIndex) =>
      column.filter(
        (id) =>
          sectionVisible(resume, id) &&
          sectionHasSliceContent(resume, expanded, id, pageIndex, columnIndex),
      ),
    ),
  );
  while (stripped.length > 1) {
    const last = stripped[stripped.length - 1];
    if (last.some((column) => column.length > 0)) break;
    stripped.pop();
  }
  return stripped;
}

/**
 * The page stack Edit mode draws: expanded pages with only hidden sections
 * dropped. Placed-but-empty sections stay drawn — their card carries the add
 * affordance — and no page is dropped, so drawn page indices match the
 * expanded pages that drop targets and slice lookups address.
 */
export function editorSheetPages(resume: ResumeData, templateLayout: TemplateLayout): string[][][] {
  return expandItemBreakPages(resume, templateLayout, true).map((page) =>
    page.map((column) => column.filter((id) => sectionVisible(resume, id))),
  );
}

/**
 * `itemBreaks` with a marker added before `itemId` in `sectionId`, or `null`
 * when the marker would change nothing: unsupported section or template,
 * unknown item, already marked, or the section's first drawn item (a marker
 * there is inert — slices are never empty).
 */
export function itemBreaksWithBreakBefore(
  resume: ResumeData,
  templateLayout: TemplateLayout,
  sectionId: string,
  itemId: string,
): Record<string, string[]> | null {
  if (!sectionSupportsItemBreaks(sectionId)) return null;
  if (!templateSupportsItemBreaks(templateLayout)) return null;
  const drawn = drawnItemIds(resume, sectionId, true);
  const position = drawn.indexOf(itemId);
  if (position <= 0) return null;
  const existing = resume.metadata.itemBreaks?.[sectionId] ?? [];
  if (existing.includes(itemId)) return null;
  return {
    ...(resume.metadata.itemBreaks ?? {}),
    [sectionId]: [...existing, itemId],
  };
}

/** `breaks` without `sectionId`'s markers, or `null` when it carries none. */
export function itemBreaksWithoutSection(
  breaks: Record<string, string[]> | undefined,
  sectionId: string,
): Record<string, string[]> | null {
  if (!breaks?.[sectionId]?.length) return null;
  const next = { ...breaks };
  delete next[sectionId];
  return next;
}

/**
 * `layout` split so `sectionId` starts a fresh page: the section and
 * everything after it in its column move to a new page inserted right after
 * its current one. `null` when the split would change nothing (section not
 * placed, or the resulting stack renders identically).
 */
export function splitLayoutBeforeSection(
  layout: readonly (readonly (readonly string[])[])[],
  sectionId: string,
): string[][][] | null {
  const placement = findSectionPlacement(layout, sectionId);
  if (!placement) return null;
  const next = cloneLayout(layout);
  const column = next[placement.page][placement.column];
  // The tail always holds at least the section itself — the placement is real.
  const tail = column.splice(placement.index);
  const columnCount = next[placement.page].length;
  next.splice(
    placement.page + 1,
    0,
    Array.from({ length: columnCount }, (_, index) => (index === placement.column ? tail : [])),
  );
  const pruned = next.filter((page) => page.some((column_) => column_.length > 0));
  const result = pruned.length > 0 ? pruned : next.slice(0, 1);
  return JSON.stringify(result) === JSON.stringify(layout) ? null : result;
}

/** What removing the rule between two drawn pages should write (spec §3.4). */
export type PageBreakRemoval =
  | { kind: "itemBreaks"; itemBreaks: Record<string, string[]> }
  | { kind: "layout"; layout: string[][][] };

/**
 * Resolve "Remove page break" between drawn pages `pageIndex - 1` and
 * `pageIndex`: prefer clearing an item-break continuation shared across the
 * boundary (the responsible marker of every such section is deleted);
 * otherwise merge raw page `pageIndex` into the one before it. `null` when
 * neither applies.
 */
export function resolvePageBreakRemoval(
  resume: ResumeData,
  templateLayout: TemplateLayout,
  pageIndex: number,
): PageBreakRemoval | null {
  if (pageIndex <= 0) return null;
  const drawn = editorSheetPages(resume, templateLayout);
  if (pageIndex >= drawn.length) return null;

  const previous = drawn[pageIndex - 1];
  const current = drawn[pageIndex];
  const columns = Math.max(previous.length, current.length);
  let cleared = false;
  const nextBreaks = { ...(resume.metadata.itemBreaks ?? {}) };
  for (let column = 0; column < columns; column++) {
    for (const sectionId of current[column] ?? []) {
      if (!(previous[column] ?? []).includes(sectionId)) continue;
      const slice = sectionSliceIndex(resume, templateLayout, sectionId, pageIndex, column, true);
      if (slice <= 0) continue;
      const ordered = orderedItemBreaks(resume, sectionId, true);
      const marker = ordered[slice - 1];
      if (marker === undefined) continue;
      const filtered = (nextBreaks[sectionId] ?? []).filter((id) => id !== marker);
      if (filtered.length > 0) nextBreaks[sectionId] = filtered;
      else delete nextBreaks[sectionId];
      cleared = true;
    }
  }
  if (cleared) return { kind: "itemBreaks", itemBreaks: nextBreaks };

  const merged = mergePageIntoPrevious(layoutPages(resume, templateLayout), pageIndex);
  return merged === null ? null : { kind: "layout", layout: merged };
}

/**
 * `breaks` with every unhonorable entry stripped: non-main-flow sections
 * (spec §3.4 guard), empty or non-array marker lists, and non-string
 * markers. Loaded documents can carry any shape here (imports, old
 * clients), so the value is guarded at runtime like `sections.custom` and
 * `metadata.layout` are. Returns `null` when nothing needed stripping, so
 * load-time repairs write nothing for a clean document.
 */
export function sanitizedItemBreaks(breaks: unknown): Record<string, string[]> | null {
  if (breaks === undefined) return null;
  if (typeof breaks !== "object" || breaks === null || Array.isArray(breaks)) {
    // A malformed field is repaired to "no breaks" rather than left to trip
    // every Object.entries reader downstream.
    return {};
  }
  let changed = false;
  const next: Record<string, string[]> = {};
  for (const [sectionId, markers] of Object.entries(breaks)) {
    const valid =
      sectionSupportsItemBreaks(sectionId) &&
      Array.isArray(markers) &&
      markers.length > 0 &&
      markers.every((marker) => typeof marker === "string");
    if (!valid) {
      changed = true;
      continue;
    }
    next[sectionId] = markers as string[];
  }
  return changed ? next : null;
}
