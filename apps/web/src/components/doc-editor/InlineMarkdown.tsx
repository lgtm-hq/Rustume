/**
 * Click-to-edit for the sheet's multi-line markdown fields.
 *
 * Read state draws the *rendered* markdown ({@link MarkdownView}) — the sheet
 * is the rendered document (#785), so formatted text is what both modes show.
 * In Edit mode that view is wrapped in a button so it can be reached by
 * keyboard, and activating it swaps in {@link MarkdownEditor} (raw markdown)
 * in place. In Done mode the view is plain content: no button, and an empty
 * value draws nothing at all.
 */

import { Show, createSignal, type JSX } from "solid-js";
import { MarkdownEditor } from "./MarkdownEditor";
import { MarkdownView } from "./MarkdownView";
import { useSheetEditable } from "./sheetMode";

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
  const isEditable = useSheetEditable();
  const [isEditing, setIsEditing] = createSignal(false);

  const placeholder = () => props.placeholder ?? `Add ${props.label.toLowerCase()}`;

  function refocusTrigger(): void {
    const id = props.triggerId;
    if (id === undefined) return;
    queueMicrotask(() => document.getElementById(id)?.focus());
  }

  return (
    <Show
      when={isEditable()}
      fallback={
        <Show when={props.value.trim() !== ""}>
          <div class="doc-sheet__rich-text">
            <MarkdownView value={props.value} />
          </div>
        </Show>
      }
    >
      <Show
        when={isEditing()}
        fallback={
          // Not a native <button>: the rendered value is block content
          // (paragraphs, lists), which phrasing-only button content cannot
          // legally hold. The div carries the button role and the same
          // keyboard contract instead.
          <div
            role="button"
            tabindex="0"
            id={props.triggerId}
            class="doc-sheet__editable doc-sheet__rich-text"
            classList={{ "doc-sheet__editable--empty": props.value.trim() === "" }}
            title={`Edit ${props.label.toLowerCase()}`}
            onClick={() => setIsEditing(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setIsEditing(true);
              }
            }}
          >
            <Show when={props.value.trim() !== ""} fallback={placeholder()}>
              <MarkdownView value={props.value} />
            </Show>
          </div>
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
    </Show>
  );
}
