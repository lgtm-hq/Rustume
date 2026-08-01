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

/** A resolved entry drop: a reorder within one section, or a move across two. */
export type EntryDrop =
  | { kind: "reorder"; sectionId: string; fromIndex: number; toIndex: number }
  | {
      kind: "move";
      fromSectionId: string;
      fromIndex: number;
      toSectionId: string;
      toIndex: number;
    };

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
 * at this position now". A target page of `layout.length` appends a fresh page
 * with the same column count as the last existing page.
 */
export function moveSectionInLayout(
  layout: readonly (readonly (readonly string[])[])[],
  sectionId: string,
  target: SectionDropTarget,
): string[][][] | null {
  const placement = findSectionPlacement(layout, sectionId);
  if (!placement || target.page < 0 || target.page > layout.length) return null;

  const next = cloneLayout(layout);
  next[placement.page][placement.column].splice(placement.index, 1);

  if (target.page === next.length) {
    const columnCount = Math.max(1, next[next.length - 1]?.length ?? 1);
    next.push(Array.from({ length: columnCount }, () => []));
  }

  const page = next[target.page];
  // A template can draw more columns than the stored layout carries (a sidebar
  // page stored as one column, say); dropping on such a column materializes it.
  while (page.length <= target.column) {
    page.push([]);
  }
  const column = page[target.column];

  let index = target.index;
  if (
    target.page === placement.page &&
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
 * Whether an entry may leave `fromSectionId` for `toSectionId`.
 *
 * Only custom sections share an item shape, so they are the only pair a move
 * is defined for; a fixed section's items would be structurally wrong anywhere
 * else, and no store action exists to put them there.
 */
export function canMoveEntryAcross(fromSectionId: string, toSectionId: string): boolean {
  return fromSectionId !== toSectionId && isCustomId(fromSectionId) && isCustomId(toSectionId);
}

/**
 * Resolve an entry drop onto another entry (or a section's tail) as index
 * pairs into the sections' unfiltered `items` arrays.
 *
 * `targetItemId: null` addresses the end of the target section. Within one
 * section the usual reorder rule applies — dropping onto the entry below lands
 * after it, onto the entry above lands before it (which is what the store's
 * splice-based reorder computes from a plain target index).
 */
export function resolveEntryDrop(args: {
  fromSectionId: string;
  fromItems: readonly EntryListItem[];
  itemId: string;
  toSectionId: string;
  toItems: readonly EntryListItem[];
  targetItemId: string | null;
}): EntryDrop | null {
  const fromIndex = args.fromItems.findIndex((item) => item.id === args.itemId);
  if (fromIndex === -1) return null;

  if (args.fromSectionId === args.toSectionId) {
    const toIndex =
      args.targetItemId === null
        ? args.toItems.length - 1
        : args.toItems.findIndex((item) => item.id === args.targetItemId);
    if (toIndex === -1 || toIndex === fromIndex) return null;
    return { kind: "reorder", sectionId: args.fromSectionId, fromIndex, toIndex };
  }

  if (!canMoveEntryAcross(args.fromSectionId, args.toSectionId)) return null;
  const toIndex =
    args.targetItemId === null
      ? args.toItems.length
      : args.toItems.findIndex((item) => item.id === args.targetItemId);
  if (toIndex === -1) return null;
  return {
    kind: "move",
    fromSectionId: args.fromSectionId,
    fromIndex,
    toSectionId: args.toSectionId,
    toIndex,
  };
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

/**
 * The custom section an entry moves to for a lateral keyboard step: the
 * previous or next custom section in flattened layout order, or `null` when
 * there is none — the keyboard mirror of a cross-section drag.
 */
export function adjacentCustomSectionId(
  layout: readonly (readonly (readonly string[])[])[],
  fromSectionId: string,
  step: "previous" | "next",
): string | null {
  const customIds = layout.flat(2).filter((id) => isCustomId(id));
  const position = customIds.indexOf(fromSectionId);
  if (position === -1) return null;
  return customIds[step === "previous" ? position - 1 : position + 1] ?? null;
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
