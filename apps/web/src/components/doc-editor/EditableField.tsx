/**
 * Modal-edited text for the sheet (owner decision 2026-08-04, superseding
 * spec §1.11–§1.12): the value is **plain rendered content**; double-clicking
 * it (or activating it by keyboard) opens a typed pop-up dialog — no in-place
 * contenteditable, no floating toolbar.
 *
 * Plain fields open a one-input dialog; rich fields open a full markdown
 * editor ({@link MiniRichEditor}) in the dialog. Either way the dialog holds
 * a draft and commits **once**, on Save, and only when the text actually
 * changed — one edit, one store action, one undo entry. Escape, the
 * backdrop, Cancel and the ✕ all discard the draft (the Escape-reverts
 * decision, now living in the modal). No `window.prompt` anywhere.
 *
 * In Done mode the value is inert document content, and an empty value
 * renders nothing at all. The trigger keeps the value as its own accessible
 * name — no `aria-label` — so a heading wrapping one of these still
 * announces as its text, not as an edit control.
 */

import { Show, createEffect, createSignal, on, type JSX } from "solid-js";
import { Button, Input, Modal } from "../ui";
import { MarkdownView } from "./MarkdownView";
import { MiniRichEditor } from "./MiniRichEditor";
import { useSheetEditable } from "./sheetMode";

export interface EditableFieldProps {
  /** Current stored value — plain text, or markdown when `rich`. */
  value: string;
  /** Field name, e.g. "Headline". Labels the dialog's editor. */
  label: string;
  /** Dialog heading, e.g. "Edit · Headline". */
  dialogTitle: string;
  /** Text shown when the value is empty, so the field stays reachable. */
  placeholder?: string;
  /** Extra class for the trigger, so callers keep their type scale. */
  class?: string;
  /** Markdown field: renders formatted and edits in the markdown dialog. */
  rich?: boolean;
  /**
   * Stable DOM id for the trigger, so chrome (the pencil menu's Rename) can
   * open the dialog by activating the trigger programmatically.
   */
  triggerId?: string;
  /** Called with the new text when the dialog is saved. */
  onCommit: (value: string) => void;
}

export function EditableField(props: EditableFieldProps): JSX.Element {
  const isEditable = useSheetEditable();
  const [isOpen, setIsOpen] = createSignal(false);
  const [draft, setDraft] = createSignal("");

  const isRich = (): boolean => props.rich === true;
  const isEmpty = (): boolean => props.value.trim() === "";
  const placeholder = (): string => props.placeholder ?? `Add ${props.label.toLowerCase()}`;
  const tooltip = (): string => `Double-click to edit ${props.label.toLowerCase()}`;

  // Reseed on every open, so a cancelled edit leaves nothing behind.
  createEffect(
    on(
      () => isOpen(),
      (open) => {
        if (open) setDraft(props.value);
      },
    ),
  );

  function save(): void {
    const next = draft();
    setIsOpen(false);
    if (next !== props.value) props.onCommit(next);
  }

  /** Keyboard activation of the trigger (`detail` 0 — no pointer). */
  function handleTriggerClick(event: MouseEvent): void {
    if (event.detail === 0) setIsOpen(true);
  }

  const dialog = (): JSX.Element => (
    <Modal
      open={isOpen()}
      onOpenChange={setIsOpen}
      title={props.dialogTitle}
      size={isRich() ? "2xl" : "md"}
    >
      <Show
        when={isRich()}
        fallback={
          <div
            onKeyDown={(event) => {
              // Enter saves the one-field dialog; Escape stays Kobalte's
              // close-and-discard.
              if (event.key !== "Enter") return;
              event.preventDefault();
              save();
            }}
          >
            <Input
              label={props.label}
              placeholder={props.placeholder}
              value={draft()}
              onInput={setDraft}
            />
          </div>
        }
      >
        <MiniRichEditor
          label={props.label}
          value={draft()}
          onInput={setDraft}
          hint="Use the toolbar for bold, lists, and links."
        />
      </Show>

      <div class="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={() => setIsOpen(false)}>
          Cancel
        </Button>
        <Button onClick={save}>Save</Button>
      </div>
    </Modal>
  );

  const plainTrigger = (): JSX.Element => (
    <button
      type="button"
      id={props.triggerId}
      class={`doc-sheet__editable ${props.class ?? ""}`}
      classList={{ "doc-sheet__editable--empty": isEmpty() }}
      // No `aria-label` — see the module note.
      title={tooltip()}
      onDblClick={() => setIsOpen(true)}
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
      class={`doc-sheet__editable doc-sheet__rich-text ${props.class ?? ""}`}
      classList={{ "doc-sheet__editable--empty": isEmpty() }}
      title={tooltip()}
      onDblClick={() => setIsOpen(true)}
      onClick={handleTriggerClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setIsOpen(true);
        }
      }}
    >
      <Show when={!isEmpty()} fallback={placeholder()}>
        <MarkdownView value={props.value} />
      </Show>
    </div>
  );

  return (
    // Done mode: plain document content — no trigger, no placeholder. An
    // empty value renders nothing; the rendered document has no slot for a
    // field that holds nothing.
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
      {isRich() ? richTrigger() : plainTrigger()}
      {dialog()}
    </Show>
  );
}
