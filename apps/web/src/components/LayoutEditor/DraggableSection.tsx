import { Show } from "solid-js";
import { createSortable, transformStyle, useDragDropContext } from "@thisbeyond/solid-dnd";
import { SECTIONS, type SectionInfo } from "../builder/constants";

interface DraggableSectionProps {
  id: string;
}

/** Look up the human-friendly label and icon for a section ID. */
function getSectionInfo(id: string): SectionInfo | undefined {
  return SECTIONS.find((s) => s.key === id);
}

export function DraggableSection(props: DraggableSectionProps) {
  const sortable = createSortable(props.id);
  const ctx = useDragDropContext();

  const isActive = () => ctx?.[0].active.draggable?.id === props.id;

  const info = () => getSectionInfo(props.id);

  return (
    <div
      ref={sortable.ref}
      class="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-paper
        transition-all duration-150 cursor-grab active:cursor-grabbing select-none group"
      classList={{
        "opacity-25 border-dashed": sortable.isActiveDraggable,
        "shadow-md ring-2 ring-accent/30 scale-[1.02]": isActive() && !sortable.isActiveDraggable,
      }}
      style={transformStyle(sortable.transform)}
      {...sortable.dragActivators}
    >
      {/* Drag Handle */}
      <svg
        class="w-4 h-4 text-stone/50 group-hover:text-stone flex-shrink-0 transition-colors"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
      </svg>

      {/* Section Icon */}
      <Show when={info()} keyed>
        {(i) => (
          <svg
            class="w-4 h-4 text-stone flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={i.icon} />
          </svg>
        )}
      </Show>

      {/* Section Label */}
      <span class="text-sm font-body text-ink truncate">{info()?.name ?? props.id}</span>
    </div>
  );
}
