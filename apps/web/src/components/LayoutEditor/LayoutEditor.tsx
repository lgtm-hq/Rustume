import { createEffect, createSignal, on, untrack, For, Show } from "solid-js";
import {
  DragDropProvider,
  DragDropSensors,
  DragOverlay,
  closestCenter,
} from "@thisbeyond/solid-dnd";
import type { DragEvent } from "@thisbeyond/solid-dnd";
import { resumeStore } from "../../stores/resume";
import { toast } from "../ui";
import { SECTIONS } from "../builder/constants";
import { DroppableColumn } from "./DroppableColumn";
import { DraggableSection } from "./DraggableSection";
import { ColumnControls } from "./ColumnControls";

/** Column droppable IDs follow the pattern "col-{index}". */
function columnId(index: number): string {
  return `col-${index}`;
}

/** Parse a column index from a droppable ID. Returns -1 if not a column ID. */
function parseColumnIndex(id: string | number): number {
  const str = String(id);
  if (!str.startsWith("col-")) return -1;
  const n = Number(str.slice(4));
  return Number.isFinite(n) ? n : -1;
}

/** All known section keys from the constants file. */
export const ALL_SECTION_IDS = SECTIONS.map((s) => s.key);

/**
 * Ensures every known section ID appears in exactly one column.
 * Sections missing from the layout are appended to the last column.
 * Duplicate or unknown IDs are silently removed.
 */
export function normalizeLayout(columns: string[][]): string[][] {
  if (columns.length === 0) {
    return [ALL_SECTION_IDS.slice()];
  }
  const seen = new Set<string>();
  const result: string[][] = columns.map((col) => {
    const filtered: string[] = [];
    for (const id of col) {
      if (ALL_SECTION_IDS.includes(id as (typeof ALL_SECTION_IDS)[number]) && !seen.has(id)) {
        seen.add(id);
        filtered.push(id);
      }
    }
    return filtered;
  });

  // Append missing sections to the last column
  const missing = ALL_SECTION_IDS.filter((id) => !seen.has(id));
  if (missing.length > 0) {
    const lastCol = result[result.length - 1] ?? [];
    result[result.length - 1] = [...lastCol, ...missing];
  }

  return result;
}

export function LayoutEditor() {
  const { store, updateLayout } = resumeStore;

  // Local mutable copy of the columns (page 0 only for now).
  // We work with a flat column array and wrap in the page dimension on save.
  const [columns, setColumns] = createSignal<string[][]>([]);
  const [activeId, setActiveId] = createSignal<string | null>(null);

  // Keyboard DnD state
  const [kbDragId, setKbDragId] = createSignal<string | null>(null);
  const [kbDragOrigin, setKbDragOrigin] = createSignal<string[][] | null>(null);
  const [announcement, setAnnouncement] = createSignal("");

  // Sync from store -> local state on initial load and external layout changes.
  // Uses `on()` to track only the layout reference, and `untrack` in persistLayout
  // to avoid a write->effect->re-normalize loop during drag operations.
  let isPersisting = false;
  createEffect(
    on(
      () => store.resume?.metadata.layout,
      (layout) => {
        if (isPersisting) return; // Skip re-sync caused by our own persist
        if (!layout || layout.length === 0) {
          setColumns(normalizeLayout([ALL_SECTION_IDS.slice()]));
          return;
        }
        const page0 = layout[0] ?? [];
        setColumns(normalizeLayout(page0.map((col) => [...col])));
      },
      { defer: false },
    ),
  );

  // --- Helpers ---

  /** Persist the current local column state back to the store. */
  function persistLayout(cols: string[][]) {
    // Wrap columns back into the pages array. We only edit page 0.
    isPersisting = true;
    try {
      const existingLayout = untrack(() => store.resume?.metadata.layout ?? []);
      const newLayout = existingLayout.map((page) => page.map((col) => [...col]));
      newLayout[0] = cols;
      updateLayout(newLayout);
    } finally {
      isPersisting = false;
    }
  }

  /** Find which column contains a given section ID. */
  function findColumnOfSection(sectionId: string): number {
    const cols = columns();
    for (let i = 0; i < cols.length; i++) {
      if (cols[i].includes(sectionId)) return i;
    }
    return -1;
  }

  /**
   * Resolve the container (column index) for a draggable or droppable ID.
   * A section ID resolves to its parent column. A column ID resolves to itself.
   */
  function resolveColumnIndex(id: string | number): number {
    const colIdx = parseColumnIndex(id);
    if (colIdx >= 0) return colIdx;
    return findColumnOfSection(String(id));
  }

  // --- Keyboard DnD helpers ---

  /** Look up the human-friendly label for a section ID. */
  function sectionLabel(id: string): string {
    return SECTIONS.find((s) => s.key === id)?.name ?? id;
  }

  /** Announce a message to screen readers via the live region. */
  function announce(message: string) {
    setAnnouncement("");
    requestAnimationFrame(() => setAnnouncement(message));
  }

  /** Move a section in the given direction during keyboard drag. */
  function moveSection(sectionId: string, key: string) {
    const cols = columns();
    const colIdx = findColumnOfSection(sectionId);
    if (colIdx < 0) return;

    const col = cols[colIdx];
    const sectionIdx = col.indexOf(sectionId);
    const newCols = cols.map((c) => [...c]);

    if (key === "ArrowUp" && sectionIdx > 0) {
      [newCols[colIdx][sectionIdx - 1], newCols[colIdx][sectionIdx]] = [
        newCols[colIdx][sectionIdx],
        newCols[colIdx][sectionIdx - 1],
      ];
      setColumns(newCols);
      announce(`${sectionLabel(sectionId)} moved up`);
    } else if (key === "ArrowDown" && sectionIdx < col.length - 1) {
      [newCols[colIdx][sectionIdx], newCols[colIdx][sectionIdx + 1]] = [
        newCols[colIdx][sectionIdx + 1],
        newCols[colIdx][sectionIdx],
      ];
      setColumns(newCols);
      announce(`${sectionLabel(sectionId)} moved down`);
    } else if (key === "ArrowLeft" && colIdx > 0) {
      newCols[colIdx] = newCols[colIdx].filter((id) => id !== sectionId);
      newCols[colIdx - 1].push(sectionId);
      setColumns(newCols);
      announce(`${sectionLabel(sectionId)} moved to column ${colIdx}`);
    } else if (key === "ArrowRight" && colIdx < cols.length - 1) {
      newCols[colIdx] = newCols[colIdx].filter((id) => id !== sectionId);
      newCols[colIdx + 1].push(sectionId);
      setColumns(newCols);
      announce(`${sectionLabel(sectionId)} moved to column ${colIdx + 2}`);
    }

    // Re-focus the section after DOM updates
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-section-id="${sectionId}"]`) as HTMLElement | null;
      el?.focus();
    });
  }

  /** Handle keyboard events for accessible drag and drop. */
  function handleKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    const sectionEl = target.closest("[data-section-id]");
    const sectionId = sectionEl?.getAttribute("data-section-id");
    if (!sectionId) return;

    const dragging = kbDragId();

    if (!dragging) {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setKbDragId(sectionId);
        setKbDragOrigin(columns().map((c) => [...c]));
        announce(
          `Picked up ${sectionLabel(sectionId)}. Use arrow keys to move, Enter or Space to drop, Escape to cancel.`,
        );
      }
      return;
    }

    e.preventDefault();

    if (e.key === " " || e.key === "Enter") {
      persistLayout(columns());
      const label = sectionLabel(dragging);
      setKbDragId(null);
      setKbDragOrigin(null);
      announce(`Dropped ${label}`);
    } else if (e.key === "Escape") {
      const origin = kbDragOrigin();
      if (origin) setColumns(origin);
      const label = sectionLabel(dragging);
      setKbDragId(null);
      setKbDragOrigin(null);
      announce(`Cancelled. ${label} returned to original position`);
      // Re-focus the section at its original position
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-section-id="${dragging}"]`) as HTMLElement | null;
        el?.focus();
      });
    } else if (
      e.key === "ArrowUp" ||
      e.key === "ArrowDown" ||
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight"
    ) {
      moveSection(dragging, e.key);
    }
  }

  // --- DnD Callbacks ---

  function onDragStart({ draggable }: DragEvent) {
    // Cancel any active keyboard drag when pointer drag starts
    if (kbDragId()) {
      setKbDragId(null);
      setKbDragOrigin(null);
    }
    setActiveId(String(draggable.id));
  }

  function onDragOver({ draggable, droppable }: DragEvent) {
    if (!droppable) return;

    const draggableId = String(draggable.id);
    const fromCol = resolveColumnIndex(draggable.id);
    const toCol = resolveColumnIndex(droppable.id);

    if (fromCol < 0 || toCol < 0 || fromCol === toCol) return;

    // Move section to the new column (append at the end for now; onDragEnd handles ordering)
    setColumns((prev) => {
      const next = prev.map((col) => [...col]);
      // Remove from source
      next[fromCol] = next[fromCol].filter((id) => id !== draggableId);
      // Append to target
      if (!next[toCol].includes(draggableId)) {
        // Insert before the droppable section if it's a section, else append
        const droppableIdx = parseColumnIndex(droppable.id);
        if (droppableIdx >= 0) {
          // Dropped on column itself -> append
          next[toCol].push(draggableId);
        } else {
          // Dropped on a sibling section -> insert at that position
          const targetIdx = next[toCol].indexOf(String(droppable.id));
          if (targetIdx >= 0) {
            next[toCol].splice(targetIdx, 0, draggableId);
          } else {
            next[toCol].push(draggableId);
          }
        }
      }
      return next;
    });
  }

  function onDragEnd({ draggable, droppable }: DragEvent) {
    setActiveId(null);

    if (!droppable) {
      // Revert to persisted layout
      const layout = store.resume?.metadata.layout;
      if (layout && layout.length > 0 && layout[0]) {
        setColumns(normalizeLayout(layout[0].map((col) => [...col])));
      } else {
        setColumns(normalizeLayout([ALL_SECTION_IDS.slice()]));
      }
      return;
    }

    const draggableId = String(draggable.id);
    const droppableId = String(droppable.id);

    // Same item dropped on itself -> no-op
    if (draggableId === droppableId) {
      persistLayout(columns());
      return;
    }

    const fromCol = resolveColumnIndex(draggable.id);
    const toCol = resolveColumnIndex(droppable.id);

    if (fromCol < 0 || toCol < 0) {
      persistLayout(columns());
      return;
    }

    const currentCols = columns();
    const newCols = currentCols.map((col) => [...col]);

    if (fromCol === toCol) {
      // Reorder within the same column
      const col = newCols[fromCol];
      const fromIdx = col.indexOf(draggableId);
      let toIdx = col.indexOf(droppableId);
      if (fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
        col.splice(fromIdx, 1);
        // After removal, indices shift down for items below fromIdx
        if (fromIdx < toIdx) {
          toIdx--;
        }
        col.splice(toIdx, 0, draggableId);
      }
    }
    // Cross-column moves are already handled in onDragOver

    setColumns(newCols);
    persistLayout(newCols);
  }

  // --- Column count changes ---

  function handleColumnCountChange(newCount: number) {
    if (!Number.isFinite(newCount) || newCount < 1 || newCount > 3) return;

    const current = columns();
    const currentCount = current.length;

    if (newCount === currentCount) return;

    let newColumns: string[][];

    if (newCount > currentCount) {
      // Adding columns: add empty columns at the end
      newColumns = [...current];
      for (let i = currentCount; i < newCount; i++) {
        newColumns.push([]);
      }
    } else {
      // Removing columns: merge trailing columns into the last remaining column
      newColumns = current.slice(0, newCount);
      const overflow = current.slice(newCount).flat();
      newColumns[newCount - 1] = [...newColumns[newCount - 1], ...overflow];
    }

    const normalized = normalizeLayout(newColumns);
    setColumns(normalized);
    persistLayout(normalized);
    toast.success(`Layout updated to ${newCount} column${newCount > 1 ? "s" : ""}`);
  }

  return (
    <div class="space-y-4">
      {/* Header */}
      <div class="flex items-center gap-3 pb-4 border-b border-border">
        <div class="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
          <svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
            />
          </svg>
        </div>
        <div>
          <h2 class="font-display text-lg font-semibold text-ink">Layout</h2>
          <p class="text-sm text-stone">Drag sections between columns to rearrange</p>
        </div>
      </div>

      {/* Column Controls */}
      <div class="flex items-center justify-between">
        <span class="text-sm font-body text-stone">Columns</span>
        <ColumnControls columnCount={columns().length} onChange={handleColumnCountChange} />
      </div>

      {/* DnD Layout Area */}
      <Show when={columns().length > 0}>
        <DragDropProvider
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          collisionDetector={closestCenter}
        >
          <DragDropSensors />

          <div
            class="flex gap-3"
            classList={{
              "flex-col": columns().length === 1,
              "flex-row": columns().length > 1,
            }}
            onKeyDown={handleKeyDown}
          >
            <For each={columns()}>
              {(col, index) => (
                <DroppableColumn
                  columnId={columnId(index())}
                  index={index()}
                  sectionIds={col}
                  totalColumns={columns().length}
                  kbActiveId={kbDragId()}
                />
              )}
            </For>
          </div>

          {/* Drag Overlay - shows a floating copy of the dragged item */}
          <DragOverlay>
            <Show when={activeId()}>
              {(id) => (
                <div class="pointer-events-none">
                  <DraggableSection id={id()} />
                </div>
              )}
            </Show>
          </DragOverlay>
        </DragDropProvider>
      </Show>

      {/* Help Text */}
      <p class="text-xs text-stone/60 leading-relaxed">
        Drag sections or use the keyboard (Space to pick up, arrow keys to move, Space to drop,
        Escape to cancel) to reorder them within a column or move them between columns. The layout
        determines how sections appear in your resume PDF.
      </p>

      {/* Screen reader live region for DnD announcements */}
      <div aria-live="assertive" aria-atomic="true" class="sr-only">
        {announcement()}
      </div>
    </div>
  );
}
