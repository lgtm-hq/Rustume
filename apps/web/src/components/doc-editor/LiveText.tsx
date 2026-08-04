/**
 * The sheet's inline-editable text primitive (spec §1.11) — the "no sidebar
 * editing" element. Plain rendered content until armed, then editable **in
 * place**: no swap-in input, the text itself takes the caret.
 *
 * - Unarmed (Edit mode): the value drawn as itself, with a hover underline
 *   and the tooltip "Double-click to edit". It stays a real button so the
 *   keyboard can reach it — activating it by key arms it with the caret at
 *   the end; double-click arms it with the caret at the pointer
 *   (`caretRangeFromPoint`, falling back to the end — never select-all).
 * - Armed: the same text as `contenteditable="plaintext-only"` with
 *   `role="textbox"`. Enter commits single-line fields; blur commits any
 *   field; **Escape reverts the in-progress edit** (owner decision — nothing
 *   typed since arming is kept). Commits normalise NBSP to spaces and trim
 *   trailing whitespace, and reach `onCommit` at most once and only when the
 *   text actually changed — one edit, one store action, one undo entry.
 * - Rich fields (`rich`): the unarmed view is the *rendered* markdown; the
 *   armed field edits the raw markdown as plain text and opens the floating
 *   {@link FormatToolbar}, whose commands rewrite the markdown around the
 *   live selection. One storage format end to end — markdown.
 * - Done mode: inert content; an empty value renders nothing at all.
 *
 * Keyboard exits hand focus back to the trigger **by id** — a commit redraws
 * the section, so the button that comes back is a different DOM node from
 * the one a ref would still be holding. A blur exit leaves focus where the
 * user put it.
 */

import { Show, createSignal, onCleanup, type JSX } from "solid-js";
import { useFormatToolbar, type RichFieldController } from "./FormatToolbar";
import { MarkdownView } from "./MarkdownView";
import { applyMarkdownCommand, type MarkdownCommand } from "./markdown";
import {
  editableText,
  placeCaretAtPoint,
  selectionOffsets,
  setSelectionOffsets,
} from "./liveTextDom";
import { useSheetEditable } from "./sheetMode";

export interface LiveTextProps {
  /** Current stored value — plain text, or markdown when `rich`. */
  value: string;
  /** Field name, e.g. "Headline". Labels the armed textbox and the tooltip. */
  label: string;
  /** Text shown when the value is empty, so the field stays reachable. */
  placeholder?: string;
  /** Extra class for the field in every state, so callers keep their type scale. */
  class?: string;
  /**
   * Markdown field: renders formatted, edits the raw markdown multi-line,
   * and opens the floating format toolbar while armed.
   */
  rich?: boolean;
  /**
   * Stable DOM id for the trigger. Supplying it is what lets a keyboard edit
   * hand focus back after the commit redraws the sheet.
   */
  triggerId?: string;
  /** Called with the new text when an edit is committed. */
  onCommit: (value: string) => void;
}

/** What a commit stores: NBSP as plain spaces, no trailing whitespace. */
function normalizeCommit(raw: string): string {
  return raw.replaceAll("\u00A0", " ").trimEnd();
}

export function LiveText(props: LiveTextProps): JSX.Element {
  const isEditable = useSheetEditable();
  const toolbar = useFormatToolbar();
  const [isArmed, setIsArmed] = createSignal(false);

  let field: HTMLElement | undefined;
  /** Pointer position of the arming double-click, for caret placement. */
  let armPoint: { x: number; y: number } | null = null;
  // One edit settles once. Escape reverts and Enter commits, and the blur
  // each of those provokes must not reach the store a second time.
  let isSettled = false;

  const isRich = (): boolean => props.rich === true;
  const isEmpty = (): boolean => props.value.trim() === "";
  const placeholder = (): string => props.placeholder ?? `Add ${props.label.toLowerCase()}`;
  const tooltip = (): string => `Double-click to edit ${props.label.toLowerCase()}`;

  const controller: RichFieldController = {
    get label() {
      return props.label;
    },
    apply(command: MarkdownCommand, href?: string): void {
      if (!field) return;
      const value = editableText(field);
      const range = selectionOffsets(field) ?? { start: value.length, end: value.length };
      const next = applyMarkdownCommand({ value, ...range }, command, href ?? "");
      field.textContent = next.value;
      field.focus();
      setSelectionOffsets(field, next.start, next.end);
    },
    focusField(): void {
      field?.focus();
    },
  };

  function arm(point: { x: number; y: number } | null): void {
    armPoint = point;
    isSettled = false;
    setIsArmed(true);
  }

  /** Mount hook of the armed element: seed the text, focus, place the caret. */
  function setupField(element: HTMLElement): void {
    field = element;
    element.textContent = props.value;
    queueMicrotask(() => {
      element.focus();
      try {
        placeCaretAtPoint(element, armPoint);
      } catch {
        // Caret placement is a nicety; the field is focused and editable
        // regardless (jsdom implements neither caret API).
      }
      armPoint = null;
    });
    if (isRich()) toolbar.setController(controller);
  }

  function disarm(): void {
    setIsArmed(false);
    if (isRich() && toolbar.controller() === controller) toolbar.setController(null);
    field = undefined;
  }

  onCleanup(() => {
    if (isRich() && toolbar.controller() === controller) toolbar.setController(null);
  });

  /**
   * Put focus back on the trigger once the sheet has settled. Only for
   * keyboard exits: a blur means the user has already chosen where focus
   * goes, and stealing it back would fight them.
   */
  function refocusTrigger(): void {
    const id = props.triggerId;
    if (id === undefined) return;
    queueMicrotask(() => document.getElementById(id)?.focus());
  }

  function commit(): void {
    if (isSettled) return;
    isSettled = true;
    const next = field ? normalizeCommit(editableText(field)) : props.value;
    disarm();
    if (next !== props.value) props.onCommit(next);
  }

  /** Escape: throw the in-progress edit away — nothing reaches the store. */
  function revert(): void {
    if (isSettled) return;
    isSettled = true;
    disarm();
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === "Enter" && !isRich()) {
      event.preventDefault();
      commit();
      refocusTrigger();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      revert();
      refocusTrigger();
    }
  }

  function handleFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget;
    // Focus moving into the format toolbar (its URL row) is still the same
    // editing session; only focus truly leaving the field commits.
    if (next instanceof Node && field?.contains(next)) return;
    if (isRich() && toolbar.isWithinToolbar(next)) return;
    commit();
  }

  /** Keyboard activation of the trigger button (`detail` 0 — no pointer). */
  function handleTriggerClick(event: MouseEvent): void {
    if (event.detail === 0) arm(null);
  }

  const armedField = (): JSX.Element => (
    <span
      ref={setupField}
      contenteditable="plaintext-only"
      role="textbox"
      aria-label={props.label}
      aria-multiline={isRich() ? "true" : undefined}
      class={`doc-sheet__live-field ${props.class ?? ""}`}
      classList={{ "doc-sheet__live-field--rich": isRich() }}
      onKeyDown={handleKeyDown}
      onFocusOut={handleFocusOut}
    />
  );

  const plainTrigger = (): JSX.Element => (
    <button
      type="button"
      id={props.triggerId}
      class={`doc-sheet__editable doc-sheet__live ${props.class ?? ""}`}
      classList={{ "doc-sheet__editable--empty": isEmpty() }}
      // No `aria-label`: the accessible name has to stay the value itself, or
      // every heading that wraps one of these would be announced as an edit
      // control instead of as its own text. `title` carries the hint.
      title={tooltip()}
      onDblClick={(event) => arm({ x: event.clientX, y: event.clientY })}
      onClick={handleTriggerClick}
    >
      {isEmpty() ? placeholder() : props.value}
    </button>
  );

  const richTrigger = (): JSX.Element => (
    // Not a native <button>: the rendered markdown is block content
    // (paragraphs, lists), which phrasing-only button content cannot legally
    // hold. The div carries the button role and the same keyboard contract.
    <div
      role="button"
      tabindex="0"
      id={props.triggerId}
      class={`doc-sheet__editable doc-sheet__live doc-sheet__live--rich doc-sheet__rich-text ${props.class ?? ""}`}
      classList={{ "doc-sheet__editable--empty": isEmpty() }}
      title={tooltip()}
      onDblClick={(event) => arm({ x: event.clientX, y: event.clientY })}
      onClick={handleTriggerClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          arm(null);
        }
      }}
    >
      <Show when={!isEmpty()} fallback={placeholder()}>
        <MarkdownView value={props.value} />
      </Show>
    </div>
  );

  return (
    // Done mode: the value as plain document content — no button, no
    // placeholder. An empty value renders nothing at all; the rendered
    // document has no slot for a field that holds nothing.
    <Show
      when={isEditable()}
      fallback={
        <Show when={!isEmpty()}>
          <Show when={isRich()} fallback={<span class={props.class}>{props.value}</span>}>
            <div class={`doc-sheet__rich-text ${props.class ?? ""}`}>
              <MarkdownView value={props.value} />
            </div>
          </Show>
        </Show>
      }
    >
      <Show when={isArmed()} fallback={isRich() ? richTrigger() : plainTrigger()}>
        {armedField()}
      </Show>
    </Show>
  );
}
