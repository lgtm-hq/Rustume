import { For, Show } from "solid-js";
import { createSortable, transformStyle, useDragDropContext } from "@thisbeyond/solid-dnd";
import { SECTIONS, type SectionInfo } from "../builder/constants";

/** Arrow key each move control stands in for, reusing the keyboard drag vocabulary. */
export type MoveDirection = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

interface DraggableSectionProps {
  id: string;
  label: string;
  /** Whether this section is currently being keyboard-dragged. */
  kbActive?: boolean;
  /** Move this section one step in the given direction. */
  onMove: (direction: MoveDirection) => void;
  /** Position within its column, for disabling the vertical controls. */
  isFirstInColumn: boolean;
  isLastInColumn: boolean;
  /** Position of its column, for disabling the lateral controls. */
  isFirstColumn: boolean;
  isLastColumn: boolean;
  /** Lateral controls are pointless in a single-column layout. */
  showLateralControls: boolean;
}

/** Look up the human-friendly label and icon for a section ID. */
function getSectionInfo(id: string): SectionInfo | undefined {
  return SECTIONS.find((s) => s.key === id);
}

const ARROW_PATHS: Record<MoveDirection, string> = {
  ArrowUp: "M5 15l7-7 7 7",
  ArrowDown: "M19 9l-7 7-7-7",
  ArrowLeft: "M15 19l-7-7 7-7",
  ArrowRight: "M9 5l7 7-7 7",
};

const DIRECTION_WORDS: Record<MoveDirection, string> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "to the previous column",
  ArrowRight: "to the next column",
};

export function DraggableSection(props: DraggableSectionProps) {
  const sortable = createSortable(props.id);
  const ctx = useDragDropContext();

  const isActive = () => ctx?.[0].active.draggable?.id === props.id;

  const info = () => getSectionInfo(props.id);

  /**
   * Single-pointer alternative to dragging (SC 2.5.7). These live outside the
   * draggable element on purpose: the drag activators are bound to the card,
   * and a press held past solid-dnd's 250 ms activation delay starts a drag
   * and swallows the click — so a control nested inside the card could not be
   * relied on to fire.
   */
  const controls = (): { direction: MoveDirection; disabled: boolean }[] => [
    { direction: "ArrowUp", disabled: props.isFirstInColumn },
    { direction: "ArrowDown", disabled: props.isLastInColumn },
    ...(props.showLateralControls
      ? ([
          { direction: "ArrowLeft", disabled: props.isFirstColumn },
          { direction: "ArrowRight", disabled: props.isLastColumn },
        ] as const)
      : []),
  ];

  return (
    <div ref={sortable.ref} class="flex flex-col gap-1" style={transformStyle(sortable.transform)}>
      <div
        tabindex="0"
        // Deliberately not `role="option"`. The move controls below are
        // interactive, and an `option` may own no focusable descendants (and a
        // `listbox` may own nothing but options/groups) — so keeping the
        // listbox model would have made SC 2.5.7's controls invalid ARIA. The
        // pick-up state that `aria-selected` used to carry is announced by the
        // editor's live region on every pick up, move, drop and cancel.
        aria-roledescription="draggable section"
        data-section-id={props.id}
        class="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-paper
          transition-[opacity,border-color,box-shadow,transform] duration-150
          motion-reduce:transition-none cursor-grab active:cursor-grabbing select-none group
          focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        classList={{
          "opacity-25 border-dashed": sortable.isActiveDraggable,
          "shadow-md ring-2 ring-accent/30 scale-[1.02]": isActive() && !sortable.isActiveDraggable,
          "ring-2 ring-accent bg-accent/5": props.kbActive === true,
        }}
        {...sortable.dragActivators}
      >
        {/* Drag Handle */}
        <svg
          class="w-4 h-4 text-stone group-hover:text-ink flex-shrink-0 transition-colors"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 8h16M4 16h16"
          />
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
        <span class="text-sm font-body text-ink truncate">{props.label}</span>
      </div>

      <div class="flex items-center justify-end gap-0.5">
        <For each={controls()}>
          {(control) => (
            <button
              type="button"
              // 28px square keeps every control clear of the 24px SC 2.5.8 floor.
              class="focus-ring p-1.5 text-stone hover:text-ink hover:bg-surface rounded
                disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              data-layout-move={`${props.id}-${control.direction}`}
              disabled={control.disabled}
              // Named per section: a column holds a dozen identical arrows, so
              // "Move up" alone would not tell them apart out of context.
              aria-label={`Move ${props.label} ${DIRECTION_WORDS[control.direction]}`}
              title={`Move ${props.label} ${DIRECTION_WORDS[control.direction]}`}
              onClick={() => props.onMove(control.direction)}
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d={ARROW_PATHS[control.direction]}
                />
              </svg>
            </button>
          )}
        </For>
      </div>
    </div>
  );
}
