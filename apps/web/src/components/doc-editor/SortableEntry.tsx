/**
 * Universal item-row chrome (#794 §1.8–§1.9, drag channels reworked in #796).
 *
 * Every structured item on the sheet renders inside this row: a left-edge
 * `⋮⋮` drag grip that fades in on hover, plus the hover action pill. Full
 * rows get the floating top-right pill (edit / move / duplicate / visibility
 * / page break / remove); compact sidebar rows (profiles, languages, skills)
 * get a single bare `✕` at the right edge and make the whole row the edit
 * affordance — click anywhere opens the item dialog.
 *
 * Dragging is whole-surface HTML5 DnD (spec §2.4): the grip *and* the row are
 * drag surfaces, presses that began on controls are vetoed in `dragstart`
 * (never on `mousedown` — the pinned Chromium bug), the payload rides
 * `application/x-entry` mirrored in the sheet's drag signals, and targets are
 * rows of the same section only. The 3px `.doc-sheet__entry-slot` bars mark
 * the insert position; the sheet resolves the drop.
 *
 * Reveal is opacity, never `display`: every control stays focusable and
 * announced, and `@media (hover: none)` keeps them visible for touch. The
 * compact row's move buttons are visually hidden until keyboard focus — the
 * spec draws no arrows there (drag covers pointer reorder), but a keyboard
 * user still needs the path.
 */

import { Show, type JSX } from "solid-js";
import { EyeIcon, PageBreakIcon } from "./icons";
import { useSheetEditable } from "./sheetMode";
import {
  ENTRY_DRAG_MIME,
  dragStartVetoed,
  dropIndexFromPointer,
  readDragPayload,
  useSheetDnd,
  type EntryDragPayload,
} from "./sheetDnd";

/** The insert-page-break pill control's state (owner decision, umbrella Q6). */
export interface InsertBreakAction {
  onInsert: () => void;
  /**
   * Why the action is unavailable, or `null` when it is live. A disabled
   * control stays focusable (`aria-disabled`) with the reason as its
   * tooltip, reachable on hover *and* focus (owner decision 2026-08-03).
   */
  disabledReason: string | null;
}

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
  /** Explicit "insert page break before" (spec §3.4); main-flow rows only. */
  insertBreak?: InsertBreakAction;
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

let breakTooltipCounter = 0;

/**
 * The pill's "insert page break before" control. When the action is
 * unavailable the button stays in the tab order (`aria-disabled`, not
 * `disabled`) and the reason renders as a `role="tooltip"` element wired via
 * `aria-describedby`, shown on hover and on keyboard focus alike — a
 * pointer-only tooltip would strand keyboard and AT users.
 */
function InsertBreakButton(props: { label: string; action: InsertBreakAction }): JSX.Element {
  breakTooltipCounter += 1;
  const tooltipId = `doc-entry-break-tip-${breakTooltipCounter}`;
  const isDisabled = (): boolean => props.action.disabledReason !== null;
  return (
    <span class="doc-sheet__entry-act-slot">
      <button
        type="button"
        class="doc-sheet__entry-act doc-sheet__entry-act--break"
        aria-label={`Insert page break before ${props.label}`}
        title={isDisabled() ? undefined : `Insert page break before ${props.label}`}
        aria-disabled={isDisabled() ? "true" : undefined}
        aria-describedby={isDisabled() ? tooltipId : undefined}
        onClick={(event) => {
          event.stopPropagation();
          if (!isDisabled()) props.action.onInsert();
        }}
      >
        <PageBreakIcon />
      </button>
      <Show when={props.action.disabledReason}>
        {(reason) => (
          <span role="tooltip" id={tooltipId} class="doc-sheet__act-tooltip">
            {reason()}
          </span>
        )}
      </Show>
    </span>
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
        <Show when={props.insertBreak}>
          {(insertBreak) => <InsertBreakButton label={props.label} action={insertBreak()} />}
        </Show>
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
  /** Index into the section's own unfiltered `items` array. */
  index: number;
  /** Whether this row is the last one its section instance draws. */
  isLast: boolean;
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
  const dnd = useSheetDnd();

  /** Where the press that may become a drag started (spec §2.4 veto rule). */
  let pressTarget: HTMLElement | null = null;

  const isDragging = (): boolean => {
    const drag = dnd?.entryDrag() ?? null;
    return drag !== null && drag.sectionId === props.sectionId && drag.id === props.itemId;
  };
  const showSlotBefore = (): boolean => {
    const target = dnd?.entryDropAt() ?? null;
    return target !== null && target.sectionId === props.sectionId && target.index === props.index;
  };
  const showSlotAfter = (): boolean => {
    if (!props.isLast) return false;
    const target = dnd?.entryDropAt() ?? null;
    return (
      target !== null && target.sectionId === props.sectionId && target.index === props.index + 1
    );
  };

  function beginDrag(event: DragEvent): void {
    dnd?.setEntryDrag({ sectionId: props.sectionId, id: props.itemId });
    event.dataTransfer?.setData(
      ENTRY_DRAG_MIME,
      JSON.stringify({ sectionId: props.sectionId, id: props.itemId }),
    );
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  }

  function endDrag(): void {
    dnd?.setEntryDrag(null);
    dnd?.setEntryDropAt(null);
  }

  /** Targets are rows of the same section only (spec §2.4, owner decision). */
  function trackDropTarget(event: DragEvent): void {
    const drag = dnd?.entryDrag() ?? null;
    if (drag === null || drag.sectionId !== props.sectionId) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    dnd?.setEntryDropAt({
      sectionId: props.sectionId,
      index: dropIndexFromPointer(event, props.index, dnd?.scale() ?? 1),
    });
  }

  return (
    <article
      class={`doc-sheet__entry-row ${props.class ?? ""}`}
      classList={{
        "doc-sheet__entry-row--compact": props.isCompact === true,
        "doc-sheet__entry-row--edit": isEditable(),
        "doc-sheet__entry-row--hidden": props.isHidden,
        "doc-sheet__entry-row--dragging": isDragging(),
      }}
      data-entry-id={props.itemId}
      title={
        isEditable()
          ? props.isCompact === true
            ? "Click to edit · hold to drag"
            : "Double-click to edit"
          : undefined
      }
      draggable={isEditable()}
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
      onMouseDown={(event) => {
        // Record only — never preventDefault here (pinned Chromium bug).
        pressTarget = event.target as HTMLElement;
      }}
      onDragStart={(event) => {
        const pressed = pressTarget;
        pressTarget = null;
        // The grip runs its own drag (stopPropagation); anything reaching
        // here grabbed the row surface. Veto presses that began on controls
        // so they keep their native behaviour.
        if (dragStartVetoed(pressed)) {
          event.preventDefault();
          return;
        }
        // Nested rows drag independently of their section card.
        event.stopPropagation();
        beginDrag(event);
      }}
      onDragEnd={endDrag}
      onDragEnter={trackDropTarget}
      onDragOver={trackDropTarget}
      onDrop={(event) => {
        const drag = dnd?.entryDrag() ?? null;
        if (drag === null || drag.sectionId !== props.sectionId) return;
        event.preventDefault();
        event.stopPropagation();
        const payload = readDragPayload<EntryDragPayload>(event, ENTRY_DRAG_MIME) ?? drag;
        if (payload.sectionId === props.sectionId) {
          dnd?.onEntryDrop(payload, dropIndexFromPointer(event, props.index, dnd?.scale() ?? 1));
        }
        endDrag();
      }}
    >
      <Show when={showSlotBefore()}>
        <span class="doc-sheet__entry-slot doc-sheet__entry-slot--before" aria-hidden="true" />
      </Show>
      <Show when={isEditable()}>
        <button
          type="button"
          class="doc-sheet__entry-handle"
          aria-hidden="true"
          tabindex="-1"
          title={`Drag ${props.actions.label} to move it`}
          draggable="true"
          onDragStart={(event) => {
            // Grip drags stopPropagation so the row doesn't double-fire.
            event.stopPropagation();
            beginDrag(event);
          }}
          onDragEnd={endDrag}
        >
          ⋮⋮
        </button>
        <EntryActions {...props.actions} isCompact={props.isCompact === true} />
      </Show>
      {props.children}
      <Show when={showSlotAfter()}>
        <span class="doc-sheet__entry-slot doc-sheet__entry-slot--after" aria-hidden="true" />
      </Show>
    </article>
  );
}
