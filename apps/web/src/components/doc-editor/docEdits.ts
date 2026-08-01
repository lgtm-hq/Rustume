/**
 * Every write the document sheet makes, in one place.
 *
 * **Invariant:** the sheet only ever changes a resume through a `resumeStore`
 * action. No component under `components/doc-editor/` may reach for `setStore`
 * — undo (`stores/undoHistory`) and autosave (`markDirty`) both hang off those
 * actions, so a direct write is silently lost from both. Routing the writes
 * through this module keeps that rule checkable in one file.
 *
 * Each function performs exactly **one** store action, so one user-visible edit
 * is one undo entry. A dialog that changes several fields therefore commits
 * once, on save, rather than per keystroke.
 */

import { isCustomId } from "../../lib/docLayout";
import { resumeStore, type LayoutSectionKey, type SectionKey } from "../../stores/resume";
import type { Basics, CustomItem, Picture } from "../../wasm/types";

/** A partial item, keyed by the field names in `itemFields.ts`. */
export type ItemUpdates = Record<string, unknown>;

/** Set one field of `basics`. */
export function updateBasicsField<K extends keyof Basics>(field: K, value: Basics[K]): void {
  resumeStore.updateBasics(field, value);
}

/** Replace the profile picture wholesale — size, shape and effects together. */
export function updatePicture(picture: Picture): void {
  resumeStore.updateBasics("picture", picture);
}

/** Replace the summary section's markdown. */
export function updateSummary(content: string): void {
  resumeStore.updateSummary(content);
}

/** Replace the cover letter's markdown. */
export function updateCoverLetter(content: string): void {
  resumeStore.updateCoverLetter(content);
}

/**
 * Rename a section.
 *
 * Custom sections carry their own record; fixed sections carry a `name` that
 * overrides the canonical label.
 */
export function renameSection(sectionId: string, name: string): void {
  if (isCustomId(sectionId)) {
    resumeStore.updateCustomSection(sectionId, { name });
    return;
  }
  resumeStore.updateSectionName(sectionId as LayoutSectionKey, name);
}

/** Create a custom section and return its generated id. */
export function addCustomSection(name: string): string {
  return resumeStore.addCustomSection(name);
}

/**
 * Update one item of a section.
 *
 * `index` addresses the section's own `items` array, not the filtered list the
 * sheet draws — hidden items still occupy a slot.
 *
 * The store's item types differ per section and the updates arrive keyed by the
 * descriptors in `itemFields.ts`, which is the one place that knows a section's
 * shape; the cast at this boundary is what that indirection costs.
 */
export function updateItem(sectionId: string, index: number, updates: ItemUpdates): void {
  if (isCustomId(sectionId)) {
    resumeStore.updateCustomSectionItem(sectionId, index, updates as Partial<CustomItem>);
    return;
  }
  resumeStore.updateSectionItem(sectionId as SectionKey, index, updates as never);
}

/** Append an item to a section. */
export function addItem(sectionId: string, item: ItemUpdates): void {
  if (isCustomId(sectionId)) {
    resumeStore.addCustomSectionItem(sectionId, item as unknown as CustomItem);
    return;
  }
  resumeStore.addSectionItem(sectionId as SectionKey, item as never);
}

/**
 * Flip a section between shown and hidden.
 *
 * Hidden means "not rendered to PDF": the section stays on the editing surface
 * as chrome, which is also what makes this toggle reversible from the sheet.
 */
export function toggleSection(sectionId: string): void {
  if (isCustomId(sectionId)) {
    const section = resumeStore.store.resume?.sections.custom[sectionId];
    if (!section) return;
    resumeStore.updateCustomSection(sectionId, { visible: !section.visible });
    return;
  }
  resumeStore.toggleSectionVisibility(sectionId as LayoutSectionKey);
}

/** Delete a custom section. Fixed sections can only be hidden, never deleted. */
export function removeSection(sectionId: string): void {
  if (!isCustomId(sectionId)) return;
  resumeStore.removeCustomSection(sectionId);
}

/** Show or hide one item. Same rule as sections: hidden items stay as chrome. */
export function setItemVisibility(sectionId: string, index: number, visible: boolean): void {
  updateItem(sectionId, index, { visible });
}

/** Clone the item at `index` with a fresh id, inserted right after it. */
export function duplicateItem(sectionId: string, index: number): void {
  if (isCustomId(sectionId)) {
    resumeStore.duplicateCustomSectionItem(sectionId, index);
    return;
  }
  resumeStore.duplicateSectionItem(sectionId as SectionKey, index);
}

/** Delete one item of a section. */
export function removeItem(sectionId: string, index: number): void {
  if (isCustomId(sectionId)) {
    resumeStore.removeCustomSectionItem(sectionId, index);
    return;
  }
  resumeStore.removeSectionItem(sectionId as SectionKey, index);
}

/** Reorder one item within its section. */
export function reorderItem(sectionId: string, fromIndex: number, toIndex: number): void {
  if (isCustomId(sectionId)) {
    resumeStore.reorderCustomSectionItem(sectionId, fromIndex, toIndex);
    return;
  }
  resumeStore.reorderSectionItem(sectionId as SectionKey, fromIndex, toIndex);
}

/**
 * Move an item between two custom sections — one store action, one undo entry.
 * The only cross-section pair with a shared item shape (see `docDnd.ts`).
 */
export function moveItemAcrossSections(
  fromSectionId: string,
  fromIndex: number,
  toSectionId: string,
  toIndex: number,
): void {
  if (!isCustomId(fromSectionId) || !isCustomId(toSectionId)) return;
  resumeStore.moveCustomSectionItem(fromSectionId, fromIndex, toSectionId, toIndex);
}

/** Replace `metadata.layout` wholesale — one drop, one layout write. */
export function applyLayout(layout: string[][][]): void {
  resumeStore.updateLayout(layout);
}
