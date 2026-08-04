/**
 * The universal section card (#794, spec §1.5): every section body on the
 * sheet renders inside this chrome.
 *
 * In edit mode the card is an HA-style dashed block: a header row holding the
 * hidden-until-hover drag grip, the section title, and a pencil button whose
 * popover menu consolidates the structural actions (add item, move up/down,
 * move across columns, rename, hide). The dashed add-block (spec §1.10) draws
 * under the body when the section can take a new item. In Done mode none of
 * this chrome mounts — the card is just the section content.
 *
 * The chrome is presentational: every action arrives as a callback and every
 * drag primitive (the grip's activators, the card's droppable ref) is owned by
 * the caller, so the drag mechanism can be swapped (#796) without touching the
 * card. The `basics` contact block reuses this card with no menu and no grip —
 * template-owned chrome (spec §1.4).
 */

import { Show, createEffect, createSignal, onCleanup, type JSX } from "solid-js";
import { DragGridIcon, PencilIcon, PlusIcon } from "./icons";
import { LiveText } from "./LiveText";
import { useSheetEditable } from "./sheetMode";

/** The pencil menu's structural actions and their enablement. */
export interface SectionMenuActions {
  /** First menu entry, present when the section takes items. */
  addLabel?: string;
  onAdd?: () => void;
  /** One-step column moves; disabled at the column's ends. */
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  /** Cross-column move, absent on single-column templates. */
  otherColumnLabel?: string;
  onMoveToOtherColumn?: () => void;
  /** Arms the inline title editor. */
  onRename: () => void;
  onHide: () => void;
}

export interface SectionChromeProps {
  sectionId: string;
  /** Display title; inline-editable when `onRenameCommit` is provided. */
  title: string;
  /**
   * Commit a new title typed into the inline editor. Absent for chrome whose
   * title is fixed (the `basics` contact card).
   */
  onRenameCommit?: (value: string) => void;
  /** Solid uses `focused` as the last-clicked card (solid accent border). */
  isFocused: boolean;
  onFocus: () => void;
  /** Dashed add-block under the body; absent for rich-text sections. */
  addLabel?: string;
  onAdd?: () => void;
  /** Pencil menu; absent for template-owned chrome (`basics`). */
  menu?: SectionMenuActions;
  /** Drag-grip activator props from the sheet's drag system. */
  gripActivators?: Record<string, unknown>;
  gripTitle?: string;
  /** Ref for the card element (drop target registration). */
  ref?: (element: HTMLElement) => void;
  /** Drag-state classes driven by the sheet's drag system. */
  isDropTarget?: boolean;
  isDragging?: boolean;
  children: JSX.Element;
}

/** Stable trigger id for a section's inline title editor. */
export function sectionTitleTriggerId(sectionId: string): string {
  return `doc-${sectionId}-section-title`;
}

/** Stable id for a section's pencil button, so menu actions can refocus it. */
function pencilId(sectionId: string): string {
  return `doc-${sectionId}-section-pencil`;
}

/** Stable id for a section's pencil menu (`aria-controls` target). */
function menuId(sectionId: string): string {
  return `doc-${sectionId}-section-menu`;
}

/** The menu's operable items, in visual order. */
function enabledMenuItems(menu: HTMLElement): HTMLButtonElement[] {
  return [...menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].filter(
    (item) => !item.disabled,
  );
}

export function SectionChrome(props: SectionChromeProps): JSX.Element {
  const isEditable = useSheetEditable();
  const [isMenuOpen, setIsMenuOpen] = createSignal(false);
  const hasChrome = (): boolean => isEditable() && props.menu !== undefined;

  // The menu closes on outside press or Escape, like any popover; Escape also
  // hands focus back to the pencil so a keyboard user is not stranded.
  createEffect(() => {
    if (!isMenuOpen()) return;
    const onDown = (event: MouseEvent): void => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".doc-sheet__sec-menu, .doc-sheet__sec-pencil")) setIsMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      setIsMenuOpen(false);
      document.getElementById(pencilId(props.sectionId))?.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    onCleanup(() => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    });
  });

  /** Arrow-key roving focus over the menu's enabled items (menu pattern). */
  function handleMenuKeyDown(event: KeyboardEvent): void {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const menu = event.currentTarget as HTMLElement;
    const items = enabledMenuItems(menu);
    if (items.length === 0) return;
    event.preventDefault();
    const active = document.activeElement as HTMLButtonElement | null;
    const current = active === null ? -1 : items.indexOf(active);
    const step = event.key === "ArrowDown" ? 1 : -1;
    const next =
      current === -1
        ? step === 1
          ? 0
          : items.length - 1
        : (current + step + items.length) % items.length;
    items[next]?.focus();
  }

  /**
   * Run a menu action; the menu always closes first.
   *
   * `refocus` hands focus back to the pencil once the sheet redraws, so a
   * keyboard user's next Tab carries on from the card that was acted on. It is
   * off for actions that place focus themselves (renaming arms the inline
   * title editor; adding opens a dialog) and for hiding, which unmounts the
   * card entirely.
   */
  const menuAct =
    (action: (() => void) | undefined, refocus = false) =>
    (): void => {
      setIsMenuOpen(false);
      action?.();
      if (refocus) {
        const id = pencilId(props.sectionId);
        queueMicrotask(() => document.getElementById(id)?.focus());
      }
    };

  return (
    <section
      ref={(element) => props.ref?.(element)}
      class="doc-sheet__sec"
      classList={{
        "doc-sheet__sec--edit": hasChrome(),
        "doc-sheet__sec--focused": hasChrome() && props.isFocused,
        "doc-sheet__sec--menu-open": isMenuOpen(),
        "doc-sheet__sec--drop": props.isDropTarget === true,
        "doc-sheet__sec--dragging": props.isDragging === true,
      }}
      data-section-id={props.sectionId}
      onClick={() => {
        if (isEditable()) props.onFocus();
      }}
    >
      <div class="doc-sheet__sec-bar">
        <Show when={hasChrome() && props.gripActivators}>
          <button
            type="button"
            class="doc-sheet__sec-grip"
            aria-hidden="true"
            tabindex="-1"
            title={props.gripTitle}
            {...(props.gripActivators ?? {})}
          >
            <DragGridIcon />
          </button>
        </Show>
        <h3 class="doc-sheet__sec-title">
          <Show when={props.onRenameCommit} fallback={props.title}>
            {(commit) => (
              <LiveText
                value={props.title}
                label="Section title"
                triggerId={sectionTitleTriggerId(props.sectionId)}
                onCommit={(value) => commit()(value)}
              />
            )}
          </Show>
        </h3>
        <Show when={hasChrome()}>
          <button
            type="button"
            id={pencilId(props.sectionId)}
            class="doc-sheet__sec-pencil"
            title="Section options"
            aria-label={`${props.title} section options`}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen()}
            aria-controls={isMenuOpen() ? menuId(props.sectionId) : undefined}
            onClick={(event) => {
              event.stopPropagation();
              setIsMenuOpen(!isMenuOpen());
            }}
          >
            <PencilIcon />
          </button>
        </Show>
      </div>

      <Show when={hasChrome() && isMenuOpen() && props.menu}>
        {(menu) => (
          <div
            ref={(element) => {
              // Focus moves into the menu when it opens, per the menu pattern.
              queueMicrotask(() => enabledMenuItems(element)[0]?.focus());
            }}
            id={menuId(props.sectionId)}
            class="doc-sheet__sec-menu"
            role="menu"
            aria-label={`${props.title} section options`}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={handleMenuKeyDown}
          >
            <Show when={menu().onAdd}>
              <button type="button" role="menuitem" onClick={menuAct(menu().onAdd)}>
                {menu().addLabel ?? "Add item"}
              </button>
            </Show>
            <button
              type="button"
              role="menuitem"
              disabled={!menu().canMoveUp}
              aria-label={`Move ${props.title} section up`}
              onClick={menuAct(menu().onMoveUp, true)}
            >
              Move up
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={!menu().canMoveDown}
              aria-label={`Move ${props.title} section down`}
              onClick={menuAct(menu().onMoveDown, true)}
            >
              Move down
            </button>
            <Show when={menu().onMoveToOtherColumn}>
              <button
                type="button"
                role="menuitem"
                aria-label={`Move ${props.title} section to the ${menu().otherColumnLabel}`}
                onClick={menuAct(menu().onMoveToOtherColumn, true)}
              >
                Move to {menu().otherColumnLabel}
              </button>
            </Show>
            <div class="doc-sheet__sec-menu-sep" role="separator" />
            <button
              type="button"
              role="menuitem"
              aria-label={`Rename ${props.title} section`}
              onClick={menuAct(menu().onRename)}
            >
              Rename title…
            </button>
            <button
              type="button"
              role="menuitem"
              class="doc-sheet__sec-menu-danger"
              aria-label={`Hide ${props.title} section`}
              onClick={menuAct(menu().onHide)}
            >
              Hide section
            </button>
          </div>
        )}
      </Show>

      <div class="doc-sheet__sec-body">{props.children}</div>

      <Show when={isEditable() && props.onAdd}>
        <button
          type="button"
          class="doc-sheet__add-block"
          onClick={(event) => {
            event.stopPropagation();
            props.onAdd?.();
          }}
        >
          <PlusIcon /> {props.addLabel ?? "Add"}
        </button>
      </Show>
    </section>
  );
}
