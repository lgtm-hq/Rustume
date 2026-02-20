import { For, Show } from "solid-js";
import { SortableProvider, createDroppable } from "@thisbeyond/solid-dnd";
import { DraggableSection } from "./DraggableSection";

interface DroppableColumnProps {
  /** Unique identifier for this column droppable (e.g. "col-0", "col-1"). */
  columnId: string;
  /** Column index (0-based). */
  index: number;
  /** Ordered section IDs in this column. */
  sectionIds: string[];
  /** Total number of columns (used for labelling). */
  totalColumns: number;
  /** ID of the section currently being keyboard-dragged, if any. */
  kbActiveId?: string | null;
}

const COLUMN_LABELS: Record<number, string[]> = {
  1: ["Full Width"],
  2: ["Main", "Sidebar"],
  3: ["Left", "Center", "Right"],
};

export function DroppableColumn(props: DroppableColumnProps) {
  const droppable = createDroppable(props.columnId);

  const label = () => {
    const labels = COLUMN_LABELS[props.totalColumns] ?? [];
    return labels[props.index] ?? `Column ${props.index + 1}`;
  };

  return (
    <div
      ref={droppable.ref}
      role="listbox"
      aria-label={label()}
      class="flex-1 min-w-0 rounded-lg border-2 border-dashed transition-colors duration-150 p-2"
      classList={{
        "border-accent/50 bg-accent/5": droppable.isActiveDroppable,
        "border-border bg-surface/30": !droppable.isActiveDroppable,
      }}
    >
      {/* Column Header */}
      <div class="flex items-center justify-between px-2 py-1 mb-2">
        <span class="text-xs font-mono font-semibold text-stone uppercase tracking-wider">
          {label()}
        </span>
        <span class="text-xs font-mono text-stone/60">
          {props.sectionIds.length} {props.sectionIds.length === 1 ? "section" : "sections"}
        </span>
      </div>

      {/* Sortable Section List */}
      <div class="space-y-1.5 min-h-[48px]">
        <SortableProvider ids={props.sectionIds}>
          <For each={props.sectionIds}>
            {(sectionId) => (
              <DraggableSection id={sectionId} kbActive={props.kbActiveId === sectionId} />
            )}
          </For>
        </SortableProvider>

        {/* Empty state */}
        <Show when={props.sectionIds.length === 0}>
          <div class="flex items-center justify-center h-12 text-xs text-stone/50 italic">
            Drop sections here
          </div>
        </Show>
      </div>
    </div>
  );
}
