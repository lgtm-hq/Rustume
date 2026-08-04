/**
 * Universal item-row chrome (#794, spec §1.8–§1.9).
 *
 * Every structured item on the sheet renders inside this row: a left-edge
 * `⋮⋮` drag grip that fades in on hover, plus the hover action pill. Full
 * rows get the floating top-right pill (edit / move / duplicate / visibility
 * / remove, in the spec's fixed order); compact sidebar rows (profiles,
 * languages, skills) get a single bare `✕` at the right edge and make the
 * whole row the edit affordance — click anywhere opens the item dialog.
 *
 * Reveal is opacity, never `display`: every control stays focusable and
 * announced, and `@media (hover: none)` keeps them visible for touch. The
 * compact row's move buttons are visually hidden until keyboard focus — the
 * spec draws no arrows there (drag covers pointer reorder), but a keyboard
 * user still needs the path.
 *
 * Drag primitives are created here (grip = activator) but resolved by the
 * sheet; #796 replaces the mechanism without touching this contract.
 */

import { Show, type JSX } from "solid-js";
import { createDraggable, createDroppable } from "@thisbeyond/solid-dnd";
import { EyeIcon } from "./icons";
import { useSheetEditable } from "./sheetMode";

/** The row's action callbacks; absent callbacks render no control. */
export interface EntryActionsProps {
  /** Short human name for the item, used in the buttons' accessible names. */
  label: string;
  isCompact: boolean;
  isHidden: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onToggleVisibility: () => void;
  /** Present only when a neighbour exists in that direction (spec §1.9). */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

/** One 26px circular ghost button of the pill. */
function ActionButton(props: {
  class?: string;
  label: string;
  isKeyboardOnly?: boolean;
  onClick: () => void;
  children: JSX.Element;
}): JSX.Element {
  return (
    <button
      type="button"
      class={`doc-sheet__entry-act ${props.class ?? ""}`}
      classList={{ "doc-sheet__entry-act--kb-only": props.isKeyboardOnly === true }}
      aria-label={props.label}
      title={props.label}
      onClick={(event) => {
        event.stopPropagation();
        props.onClick();
      }}
    >
      {props.children}
    </button>
  );
}

/**
 * The hover action pill (spec §1.9). Full rows float it at the top right;
 * compact rows collapse it to a bare right-edge `✕` plus keyboard-only
 * equivalents for the actions the spec draws no pointer control for.
 */
export function EntryActions(props: EntryActionsProps): JSX.Element {
  return (
    <div
      class="doc-sheet__entry-actions"
      classList={{ "doc-sheet__entry-actions--compact": props.isCompact }}
      role="group"
      aria-label={`${props.label} actions`}
    >
      <ActionButton
        class="doc-sheet__entry-act--edit"
        label={`Edit ${props.label}`}
        isKeyboardOnly={props.isCompact}
        onClick={props.onEdit}
      >
        ✎
      </ActionButton>
      <Show when={props.onMoveUp}>
        {(onMoveUp) => (
          <ActionButton
            label={`Move ${props.label} up`}
            isKeyboardOnly={props.isCompact}
            onClick={() => onMoveUp()()}
          >
            ↑
          </ActionButton>
        )}
      </Show>
      <Show when={props.onMoveDown}>
        {(onMoveDown) => (
          <ActionButton
            label={`Move ${props.label} down`}
            isKeyboardOnly={props.isCompact}
            onClick={() => onMoveDown()()}
          >
            ↓
          </ActionButton>
        )}
      </Show>
      <Show when={!props.isCompact}>
        <ActionButton label={`Duplicate ${props.label}`} onClick={props.onDuplicate}>
          ⧉
        </ActionButton>
        <ActionButton
          label={`${props.isHidden ? "Show" : "Hide"} ${props.label}`}
          onClick={props.onToggleVisibility}
        >
          <EyeIcon isOpen={!props.isHidden} />
        </ActionButton>
      </Show>
      <ActionButton
        class="doc-sheet__entry-act--remove"
        label={`Remove ${props.label}`}
        onClick={props.onRemove}
      >
        {props.isCompact ? "✕" : "−"}
      </ActionButton>
    </div>
  );
}

export interface SortableEntryProps {
  sectionId: string;
  itemId: string;
  /** Extra class naming the row's body layout (`entry`, `edu-entry`, …). */
  class?: string;
  isCompact?: boolean;
  /** Switched off — drawn as chrome, but absent from the PDF. */
  isHidden: boolean;
  actions: Omit<EntryActionsProps, "isCompact">;
  children: JSX.Element;
}

/** One item row: grip strip, action chrome, then the section's own body. */
export function SortableEntry(props: SortableEntryProps): JSX.Element {
  const isEditable = useSheetEditable();

  const draggable = createDraggable(`drag:entry:${props.sectionId}:${props.itemId}`, {
    type: "entry",
    sectionId: props.sectionId,
    itemId: props.itemId,
  });
  const droppable = createDroppable(`drop:entry:${props.sectionId}:${props.itemId}`, {
    type: "entry",
    sectionId: props.sectionId,
    itemId: props.itemId,
  });

  return (
    <article
      ref={(element) => {
        draggable.ref(element);
        droppable.ref(element);
      }}
      class={`doc-sheet__entry-row ${props.class ?? ""}`}
      classList={{
        "doc-sheet__entry-row--compact": props.isCompact === true,
        "doc-sheet__entry-row--edit": isEditable(),
        "doc-sheet__entry-row--hidden": props.isHidden,
        "doc-sheet__entry-row--drop": droppable.isActiveDroppable,
        "doc-sheet__entry-row--dragging": draggable.isActiveDraggable,
      }}
      data-entry-id={props.itemId}
      title={
        isEditable()
          ? props.isCompact === true
            ? "Click to edit · hold to drag"
            : "Double-click to edit"
          : undefined
      }
      onClick={(event) => {
        // Compact rows: the whole row is the edit affordance. Presses on the
        // grip or any button keep their own behaviour.
        if (props.isCompact !== true || !isEditable()) return;
        const target = event.target as HTMLElement;
        if (target.closest("button, a")) return;
        props.actions.onEdit();
      }}
      onDblClick={(event) => {
        // Full rows: double-click anywhere on the entry opens the item modal
        // (owner decision 2026-08-04). Controls keep their own behaviour.
        if (props.isCompact === true || !isEditable()) return;
        const target = event.target as HTMLElement;
        if (target.closest("button, a")) return;
        props.actions.onEdit();
      }}
    >
      <Show when={isEditable()}>
        <button
          type="button"
          class="doc-sheet__entry-handle"
          aria-hidden="true"
          tabindex="-1"
          title={`Drag ${props.actions.label} to move it`}
          {...draggable.dragActivators}
        >
          ⋮⋮
        </button>
        <EntryActions {...props.actions} isCompact={props.isCompact === true} />
      </Show>
      {props.children}
    </article>
  );
}
