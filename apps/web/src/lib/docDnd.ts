/**
 * Drop resolution for the document sheet's drag and drop.
 *
 * Pure functions from the current layout (or item list) plus a drag descriptor
 * to the *next* layout (or index pair) — nothing here reads a store, touches
 * the DOM, or knows about pointer events, which is what makes the interesting
 * logic unit-testable. Every resolver returns `null` for a drop that would
 * change nothing, and the callers write nothing for `null`: one drop is one
 * store action, and a drag that ends where it started is no action at all.
 *
 * Layout coordinates are the `metadata.layout` shape (`pages -> columns ->
 * section ids`) as produced by `layoutPages()` in `docLayout.ts`. Item indices
 * address a section's own unfiltered `items` array — the editor draws hidden
 * items as chrome, so drawn order and stored order coincide.
 */

import { findSectionPlacement, isCustomId } from "./docLayout";
import type { ResumeData } from "../wasm/types";

/** One step a move control can take. Lateral steps follow column index order. */
export type MoveStep = "up" | "down" | "previous" | "next";

/** Where a section is asked to land, in pre-removal layout coordinates. */
export interface SectionDropTarget {
  /** Target page; `layout.length` asks for a new page at the end. */
  page: number;
  /** Target column within that page. */
  column: number;
  /** Position within the column, counted before the section is removed. */
  index: number;
}

/** The `id`/`visible` shape every section item shares. */
export interface EntryListItem {
  id: string;
  visible: boolean;
}

function cloneLayout(layout: readonly (readonly (readonly string[])[])[]): string[][][] {
  return layout.map((page) => page.map((column) => [...column]));
}

function layoutsEqual(
  a: readonly (readonly (readonly string[])[])[],
  b: readonly (readonly (readonly string[])[])[],
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Drop pages left with nothing in any column, keeping at least one page.
 *
 * Empty pages only ever arise from a move that vacated one, so pruning here
 * keeps `metadata.layout` free of junk the templates would have to skip.
 */
function pruneEmptyPages(layout: string[][][]): string[][][] {
  const pruned = layout.filter((page) => page.some((column) => column.length > 0));
  return pruned.length > 0 ? pruned : layout.slice(0, 1);
}

/**
 * Move `sectionId` to `target`, returning the next layout — or `null` when the
 * section is not placed or the move changes nothing.
 *
 * `target` is expressed in pre-removal coordinates: "insert before whatever is
 * at this position now". A target page at or past `layout.length` creates the
 * missing pages with the same column count as the last existing page; pages
 * left empty are pruned afterwards, so the section lands on the first fresh
 * page after the existing content.
 */
export function moveSectionInLayout(
  layout: readonly (readonly (readonly string[])[])[],
  sectionId: string,
  target: SectionDropTarget,
): string[][][] | null {
  const placement = findSectionPlacement(layout, sectionId);
  if (!placement || target.page < 0 || target.column < 0) {
    return null;
  }

  const next = cloneLayout(layout);
  next[placement.page][placement.column].splice(placement.index, 1);

  // Auto-create missing pages (spec §2.5): item-break continuations can draw
  // more sheets than the raw layout stores, and a drop on one of those sheets
  // targets a raw page that does not exist yet. The target is clamped to one
  // page past the current count — the only reachable new page, and empty
  // scaffolding pages would be pruned anyway — so a sentinel-sized page value
  // (the shape's `index` already uses `MAX_SAFE_INTEGER`) cannot allocate
  // unboundedly.
  const targetPage = Math.min(target.page, next.length);
  while (targetPage >= next.length) {
    const columnCount = Math.max(1, next[next.length - 1]?.length ?? 1);
    next.push(Array.from({ length: columnCount }, () => []));
  }

  const page = next[targetPage];
  // A template can draw more columns than the stored layout carries (a sidebar
  // page stored as one column, say); dropping on such a column materializes it.
  while (page.length <= target.column) {
    page.push([]);
  }
  const column = page[target.column];

  let index = target.index;
  if (
    targetPage === placement.page &&
    target.column === placement.column &&
    placement.index < index
  ) {
    // The removal above shifted everything after the section up by one.
    index -= 1;
  }
  column.splice(Math.max(0, Math.min(index, column.length)), 0, sectionId);

  const pruned = pruneEmptyPages(next);
  return layoutsEqual(pruned, layout) ? null : pruned;
}

/**
 * Resolve dropping `sectionId` onto another section's card.
 *
 * Standard list-reorder semantics: dragged from above the target, the section
 * lands *after* it; from anywhere else, *before* it — so dragging one step in
 * either direction always changes the order.
 */
export function resolveSectionDropOnSection(
  layout: readonly (readonly (readonly string[])[])[],
  sectionId: string,
  targetSectionId: string,
): string[][][] | null {
  if (sectionId === targetSectionId) return null;
  const source = findSectionPlacement(layout, sectionId);
  const target = findSectionPlacement(layout, targetSectionId);
  if (!source || !target) return null;

  const sameColumn = source.page === target.page && source.column === target.column;
  const index = sameColumn && source.index < target.index ? target.index + 1 : target.index;
  return moveSectionInLayout(layout, sectionId, {
    page: target.page,
    column: target.column,
    index,
  });
}

/** Resolve dropping `sectionId` onto a column's open area: append to its end. */
export function resolveSectionDropOnColumn(
  layout: readonly (readonly (readonly string[])[])[],
  sectionId: string,
  page: number,
  column: number,
): string[][][] | null {
  if (page < 0 || page >= layout.length || column < 0) return null;
  const length = layout[page][column]?.length ?? 0;
  return moveSectionInLayout(layout, sectionId, { page, column, index: length });
}

/** Every column of `layout` in page-then-column order. */
function columnSequence(
  layout: readonly (readonly (readonly string[])[])[],
): { page: number; column: number }[] {
  return layout.flatMap((page, pageIndex) =>
    page.map((_, columnIndex) => ({ page: pageIndex, column: columnIndex })),
  );
}

/**
 * Move `sectionId` one step, mirroring what a drag of the same distance does.
 *
 * `up`/`down` reorder within the column, past the nearest *drawn* neighbour —
 * `isDrawn` names the sections the sheet actually draws, and slots the layout
 * places but the sheet does not draw are stepped over, so one press is always
 * one visible change. `previous`/`next` append the section to the adjacent
 * column in page-then-column order; `next` past the final column starts a new
 * page, exactly like the sheet's new-page drop zone.
 */
export function moveSectionStep(
  layout: readonly (readonly (readonly string[])[])[],
  sectionId: string,
  step: MoveStep,
  isDrawn: (id: string) => boolean = () => true,
): string[][][] | null {
  const placement = findSectionPlacement(layout, sectionId);
  if (!placement) return null;
  const column = layout[placement.page][placement.column];

  if (step === "up") {
    for (let index = placement.index - 1; index >= 0; index--) {
      if (isDrawn(column[index])) {
        return resolveSectionDropOnSection(layout, sectionId, column[index]);
      }
    }
    return null;
  }
  if (step === "down") {
    for (let index = placement.index + 1; index < column.length; index++) {
      if (isDrawn(column[index])) {
        return resolveSectionDropOnSection(layout, sectionId, column[index]);
      }
    }
    return null;
  }

  const sequence = columnSequence(layout);
  const position = sequence.findIndex(
    (entry) => entry.page === placement.page && entry.column === placement.column,
  );
  if (step === "previous") {
    const previous = sequence[position - 1];
    if (!previous) return null;
    return resolveSectionDropOnColumn(layout, sectionId, previous.page, previous.column);
  }
  const next = sequence[position + 1];
  if (next) {
    return resolveSectionDropOnColumn(layout, sectionId, next.page, next.column);
  }
  return moveSectionInLayout(layout, sectionId, { page: layout.length, column: 0, index: 0 });
}

/** Where a section sits among the *drawn* cards of its column. */
export interface DrawnSectionPosition {
  page: number;
  column: number;
  /** 0-based position among the column's drawn cards. */
  index: number;
  /** How many cards the column draws. */
  total: number;
}

/**
 * `sectionId`'s position in `layout`, counted in drawn cards rather than
 * layout slots, so an announcement matches what is on screen. The section
 * itself always counts as drawn — only drawn cards carry move controls.
 */
export function drawnSectionPosition(
  layout: readonly (readonly (readonly string[])[])[],
  sectionId: string,
  isDrawn: (id: string) => boolean = () => true,
): DrawnSectionPosition | null {
  const placement = findSectionPlacement(layout, sectionId);
  if (!placement) return null;
  const drawn = layout[placement.page][placement.column].filter(
    (id) => id === sectionId || isDrawn(id),
  );
  return {
    page: placement.page,
    column: placement.column,
    index: drawn.indexOf(sectionId),
    total: drawn.length,
  };
}

/**
 * Resolve an entry drop at `dropIndex` — an insert-before position in the
 * section's own `items` array, `+1` when the pointer was in the target row's
 * bottom half — as the `(fromIndex, toIndex)` pair the store's splice-based
 * reorder expects. `null` for an unknown item or a drop that changes nothing
 * (one drop is one store action, and a no-op drop is no action at all).
 *
 * Item drags are same-section-only (spec §2.4, owner decision): callers
 * never route a drop here across sections.
 */
export function resolveEntryDropIndex(
  items: readonly EntryListItem[],
  itemId: string,
  dropIndex: number,
): { fromIndex: number; toIndex: number } | null {
  const fromIndex = items.findIndex((item) => item.id === itemId);
  if (fromIndex === -1) return null;
  const clamped = Math.max(0, Math.min(dropIndex, items.length));
  // Removing the dragged item first shifts every later position down by one.
  const toIndex = clamped > fromIndex ? clamped - 1 : clamped;
  if (toIndex === fromIndex) return null;
  return { fromIndex, toIndex: Math.min(toIndex, items.length - 1) };
}

/** One-step reorder of an entry within its section, or `null` at a boundary. */
export function entryStep(
  items: readonly EntryListItem[],
  itemId: string,
  step: "up" | "down",
): { fromIndex: number; toIndex: number } | null {
  const fromIndex = items.findIndex((item) => item.id === itemId);
  if (fromIndex === -1) return null;
  const toIndex = step === "up" ? fromIndex - 1 : fromIndex + 1;
  if (toIndex < 0 || toIndex >= items.length) return null;
  return { fromIndex, toIndex };
}

/** Head-line fields an entry might carry, in display preference order. */
const ENTRY_LABEL_KEYS = [
  "name",
  "position",
  "company",
  "institution",
  "title",
  "network",
  "organization",
] as const;

/**
 * A short human name for an entry — announcements, drag overlays and the
 * accessible names of its row controls all speak the same label.
 */
export function entryDisplayLabel(item: unknown, fallback: string): string {
  const record = item as Record<string, unknown> | undefined;
  for (const key of ENTRY_LABEL_KEYS) {
    const value = record?.[key];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return fallback;
}

/** The `items` list of any section, read through the shape they all share. */
export function sectionItemList(resume: ResumeData, sectionId: string): EntryListItem[] {
  if (isCustomId(sectionId)) {
    return resume.sections.custom?.[sectionId]?.items ?? [];
  }
  const section = resume.sections[sectionId as keyof typeof resume.sections] as
    | { items?: EntryListItem[] }
    | undefined;
  return section?.items ?? [];
}
