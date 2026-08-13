/**
 * The sheet's whole-surface drag channels (#796, spec §2.4–§2.5).
 *
 * Native HTML5 drag and drop, exactly as the spec pins it: two channels with
 * their own MIME types (`application/x-section` cards across columns and
 * pages, `application/x-entry` rows within one section), mirrored in reactive
 * signals so slot indicators and opacity styling follow the drag. `DocSheet`
 * provides the context and owns drop resolution; rows and cards register the
 * events and read the signals.
 *
 * Pinned constraints (spec §2.4):
 * - never `preventDefault` on `mousedown` of a drag surface — it kills the
 *   Chromium dragstart. Selection is suppressed via `user-select: none`.
 * - a drag that *started* on a control is vetoed in `dragstart` instead, so
 *   controls keep their native behavior ({@link dragStartVetoed}).
 * - grip drags `stopPropagation` so the surface doesn't double-fire; entry
 *   rows claim their presses before the section card sees them.
 */

import { createContext, useContext, type Accessor } from "solid-js";
import type { SectionPlacement } from "../../lib/docLayout";

/** MIME type of an item-row drag (spec §2.4). */
export const ENTRY_DRAG_MIME = "application/x-entry";
/** MIME type of a section-card drag (spec §2.5). */
export const SECTION_DRAG_MIME = "application/x-section";

/** What an item drag carries. */
export interface EntryDragPayload {
  sectionId: string;
  id: string;
}

/** Where an item drop would land: an insert-before index into `items`. */
export interface EntryDropTarget {
  sectionId: string;
  index: number;
}

/** Where a section drop would land, in pre-removal raw-layout coordinates. */
export interface SectionDropTarget {
  page: number;
  column: number;
  index: number;
}

/** The drag state and drop resolution the sheet shares with rows and cards. */
export interface SheetDndValue {
  /** The item in flight, or `null`. */
  entryDrag: Accessor<EntryDragPayload | null>;
  setEntryDrag: (drag: EntryDragPayload | null) => void;
  /** Where the item drag would drop, for the slot indicators. */
  entryDropAt: Accessor<EntryDropTarget | null>;
  setEntryDropAt: (target: EntryDropTarget | null) => void;
  /** The section card in flight, or `null`. */
  sectionDrag: Accessor<string | null>;
  setSectionDrag: (sectionId: string | null) => void;
  /** Where the section drag would drop, for the slot indicators. */
  sectionDropAt: Accessor<SectionDropTarget | null>;
  setSectionDropAt: (target: SectionDropTarget | null) => void;
  /**
   * Live miniature scale `k` of the sheet (#813). Pointer math under the
   * sheet must divide client deltas by this factor; `getBoundingClientRect`
   * already returns the scaled box.
   */
  scale: Accessor<number>;
  /** Raw-layout placement of a drawn card — what its drop target addresses. */
  sectionPlacement: (sectionId: string) => SectionPlacement | null;
  /** How many sections the raw layout stores in a column (after-slot check). */
  columnLength: (page: number, column: number) => number;
  /** Resolve a finished item drop to at most one store action. */
  onEntryDrop: (payload: EntryDragPayload, dropIndex: number) => void;
  /** Resolve a finished section drop to at most one store action. */
  onSectionDrop: (sectionId: string, target: SectionDropTarget) => void;
}

export const SheetDndContext = createContext<SheetDndValue>();

/** The surrounding sheet's drag channels; `null` outside a `DocSheet`. */
export function useSheetDnd(): SheetDndValue | null {
  return useContext(SheetDndContext) ?? null;
}

/**
 * Whether a drag that began on `pressTarget` must be vetoed so the control
 * keeps its native behavior (spec §2.4). `extraVeto` extends the list — the
 * section card adds the entry-row class, because presses on rows belong to
 * the entry drag.
 */
export function dragStartVetoed(pressTarget: Element | null, extraVeto = ""): boolean {
  if (!pressTarget) return false;
  const selectors = 'button, input, textarea, select, [contenteditable="true"]';
  return pressTarget.closest(extraVeto === "" ? selectors : `${selectors}, ${extraVeto}`) !== null;
}

/**
 * The insert-before drop index a pointer position means: the row or card's
 * own index, `+1` when the pointer is in its bottom half (spec §2.4).
 *
 * `scale` is the sheet's miniature factor (#813). `getBoundingClientRect`
 * already returns the scaled visual box, so dividing both the pointer offset
 * and the height by `k` is algebraically equivalent to the unscaled half-box
 * test — the division is kept explicit so every sheet pointer consumer
 * accounts for `k` the same way (and so a future switch to unscaled metrics
 * cannot silently regress).
 */
export function dropIndexFromPointer(event: DragEvent, index: number, scale: number = 1): number {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const k = scale > 0 ? scale : 1;
  const localY = (event.clientY - rect.top) / k;
  const localHeight = rect.height / k;
  return index + (localY > localHeight / 2 ? 1 : 0);
}

/** Parse a drag payload of `mime` from the event, or `null`. */
export function readDragPayload<T>(event: DragEvent, mime: string): T | null {
  const raw = event.dataTransfer?.getData(mime) ?? "";
  if (raw === "") return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
