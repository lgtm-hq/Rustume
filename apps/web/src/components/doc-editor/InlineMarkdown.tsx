/**
 * Click-to-edit for the sheet's multi-line markdown fields.
 *
 * Read state is the same verbatim markdown the read-only sheet drew, wrapped in
 * a button so it can be reached by keyboard; edit state is {@link MarkdownEditor}
 * in place. Rendering markdown faithfully is the PDF pane's job (#732), so the
 * text still shows its own punctuation here.
 */

import { Show, createSignal, type JSX } from "solid-js";
import { MarkdownEditor } from "./MarkdownEditor";

export interface InlineMarkdownProps {
  /** Current stored markdown. */
  value: string;
  /** Field name, e.g. "Summary". Labels the editor and the trigger's tooltip. */
  label: string;
  /** Text shown when the value is empty, so the field stays reachable. */
  placeholder?: string;
  /**
   * Stable DOM id for the trigger button. Supplying it is what lets an edit
   * hand focus back after the commit redraws the sheet — see `InlineText`.
   */
  triggerId?: string;
  /** Called with the new markdown when an edit is committed. */
  onCommit: (value: string) => void;
}

export function InlineMarkdown(props: InlineMarkdownProps): JSX.Element {
  const [isEditing, setIsEditing] = createSignal(false);

  const placeholder = () => props.placeholder ?? `Add ${props.label.toLowerCase()}`;

  function refocusTrigger(): void {
    const id = props.triggerId;
    if (id === undefined) return;
    queueMicrotask(() => document.getElementById(id)?.focus());
  }

  return (
    <Show
      when={isEditing()}
      fallback={
        <button
          type="button"
          id={props.triggerId}
          class="doc-sheet__editable doc-sheet__rich-text"
          classList={{ "doc-sheet__editable--empty": props.value.trim() === "" }}
          title={`Edit ${props.label.toLowerCase()}`}
          onClick={() => setIsEditing(true)}
        >
          {props.value.trim() === "" ? placeholder() : props.value}
        </button>
      }
    >
      <MarkdownEditor
        value={props.value}
        label={props.label}
        onCommit={(next) => {
          setIsEditing(false);
          props.onCommit(next);
          refocusTrigger();
        }}
        onCancel={() => {
          setIsEditing(false);
          refocusTrigger();
        }}
      />
    </Show>
  );
}
