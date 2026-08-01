/**
 * The sheet's single-line click-to-edit primitive.
 *
 * A value is drawn as a button carrying the value as its own text, so the
 * document still reads as a document and assistive technology still announces
 * the surrounding heading or list item by its content. Activating it — click,
 * Enter or Space, since it is a real button — swaps in an input in place.
 *
 * Commit on blur and on Enter; Escape restores the prior value. Every commit
 * calls `onCommit` at most once and only when the text actually changed, which
 * is what keeps one user-visible edit to one store action and one undo entry.
 */

import { Show, createSignal, type JSX } from "solid-js";

export interface InlineTextProps {
  /** Current stored value. */
  value: string;
  /** Field name, e.g. "Headline". Labels the input and the trigger's tooltip. */
  label: string;
  /** Text shown when the value is empty, so the field stays reachable. */
  placeholder?: string;
  /** Extra class for the trigger and the input, so callers keep their type scale. */
  class?: string;
  /** Called with the new text when an edit is committed. */
  onCommit: (value: string) => void;
}

export function InlineText(props: InlineTextProps): JSX.Element {
  const [isEditing, setIsEditing] = createSignal(false);
  const [draft, setDraft] = createSignal("");
  // One edit settles once. Escape unmounts the input and Enter commits it, and
  // the blur each of those provokes must not reach the store a second time.
  let isSettled = false;

  const placeholder = () => props.placeholder ?? `Add ${props.label.toLowerCase()}`;

  function start(): void {
    isSettled = false;
    setDraft(props.value);
    setIsEditing(true);
  }

  function commit(): void {
    if (isSettled) return;
    isSettled = true;
    const next = draft();
    setIsEditing(false);
    if (next !== props.value) props.onCommit(next);
  }

  function cancel(): void {
    isSettled = true;
    setIsEditing(false);
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  }

  return (
    <Show
      when={isEditing()}
      fallback={
        <button
          type="button"
          class={`doc-sheet__editable ${props.class ?? ""}`}
          classList={{ "doc-sheet__editable--empty": props.value.trim() === "" }}
          // No `aria-label`: the accessible name has to stay the value itself,
          // or every heading that wraps one of these would be announced as
          // "Edit …" instead of as its own text. `title` carries the hint.
          title={`Edit ${props.label.toLowerCase()}`}
          onClick={start}
        >
          {props.value.trim() === "" ? placeholder() : props.value}
        </button>
      }
    >
      <input
        ref={(element) =>
          queueMicrotask(() => {
            element.focus();
            element.select();
          })
        }
        type="text"
        class={`doc-sheet__inline-input ${props.class ?? ""}`}
        aria-label={props.label}
        placeholder={placeholder()}
        value={draft()}
        onInput={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
      />
    </Show>
  );
}
