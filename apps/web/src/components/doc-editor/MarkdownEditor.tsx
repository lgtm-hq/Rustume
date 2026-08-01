/**
 * The sheet's mini rich editor for multi-line fields.
 *
 * It edits **markdown** as text: the textarea holds exactly what is stored, and
 * the toolbar rewrites that text through {@link applyMarkdownCommand}. There is
 * no hidden document model, so nothing can be typed here that the render path
 * cannot reproduce.
 *
 * The toolbar is bold, italic, link, unordered list and ordered list. It has no
 * underline button on purpose — markdown has no underline and the conversion in
 * `crates/utils/src/html_to_typst.rs` has nothing to map one onto.
 *
 * Commit is on focus leaving the editor entirely, or on the explicit Done
 * button; Escape restores the prior value. Toolbar buttons suppress their own
 * mousedown so pressing one neither steals focus nor drops the selection the
 * command is about to act on.
 */

import { For, Show, createSignal, type JSX } from "solid-js";
import { applyMarkdownCommand, type MarkdownCommand, type MarkdownSelection } from "./markdown";

interface ToolbarAction {
  command: MarkdownCommand;
  label: string;
  /** Short glyph drawn in the button; the accessible name is `label`. */
  glyph: string;
}

/** Underline is absent by design — see the module note. */
const TOOLBAR: readonly ToolbarAction[] = [
  { command: "bold", label: "Bold", glyph: "B" },
  { command: "italic", label: "Italic", glyph: "I" },
  // Typographic glyphs, never emoji — see the brand anti-pattern list.
  { command: "link", label: "Link", glyph: "Link" },
  { command: "bulletList", label: "Bulleted list", glyph: "•" },
  { command: "orderedList", label: "Numbered list", glyph: "1." },
];

export interface MarkdownEditorProps {
  /** Markdown to edit. */
  value: string;
  /** Field name, e.g. "Summary". Labels the textarea. */
  label: string;
  /** Called with the new markdown when the edit is committed. */
  onCommit: (value: string) => void;
  /** Called when the edit is abandoned. */
  onCancel: () => void;
}

export function MarkdownEditor(props: MarkdownEditorProps): JSX.Element {
  const [draft, setDraft] = createSignal(props.value);
  const [linkHref, setLinkHref] = createSignal("");
  const [isLinkOpen, setIsLinkOpen] = createSignal(false);

  let root: HTMLDivElement | undefined;
  let textarea: HTMLTextAreaElement | undefined;
  // The selection the link row will act on, captured before focus moves to it.
  let linkRange: MarkdownSelection | null = null;
  // One edit settles once: committing unmounts the editor, and the blur that
  // follows must not reach the store a second time.
  let isSettled = false;

  function selection(): MarkdownSelection {
    const value = draft();
    if (!textarea) return { value, start: value.length, end: value.length };
    return { value, start: textarea.selectionStart, end: textarea.selectionEnd };
  }

  function applyResult(next: MarkdownSelection): void {
    setDraft(next.value);
    queueMicrotask(() => {
      textarea?.focus();
      textarea?.setSelectionRange(next.start, next.end);
    });
  }

  function runCommand(command: MarkdownCommand): void {
    if (command === "link") {
      linkRange = selection();
      setIsLinkOpen(true);
      return;
    }
    // Another command invalidates the snapshot the link row was about to act
    // on, so close it rather than let a later Apply overwrite newer text.
    linkRange = null;
    setLinkHref("");
    setIsLinkOpen(false);
    applyResult(applyMarkdownCommand(selection(), command));
  }

  function applyLink(): void {
    const href = linkHref().trim();
    if (href === "") return;
    applyResult(applyMarkdownCommand(linkRange ?? selection(), "link", href));
    linkRange = null;
    setLinkHref("");
    setIsLinkOpen(false);
  }

  function commit(): void {
    if (isSettled) return;
    isSettled = true;
    const next = draft();
    if (next === props.value) {
      props.onCancel();
      return;
    }
    props.onCommit(next);
  }

  function cancel(): void {
    if (isSettled) return;
    isSettled = true;
    props.onCancel();
  }

  function handleFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget;
    // Moving between the textarea, the toolbar and the link row is still one
    // editing session; only focus leaving the whole editor commits.
    if (next instanceof Node && root?.contains(next)) return;
    commit();
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  }

  return (
    <div
      ref={(element) => (root = element)}
      class="doc-sheet__markdown"
      onFocusOut={handleFocusOut}
      onKeyDown={handleKeyDown}
    >
      <div
        class="doc-sheet__markdown-toolbar"
        role="toolbar"
        aria-label={`${props.label} formatting`}
      >
        <For each={TOOLBAR}>
          {(action) => (
            <button
              type="button"
              class="doc-sheet__markdown-button"
              aria-label={action.label}
              // Keep focus (and therefore the selection) in the textarea.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runCommand(action.command)}
            >
              {action.glyph}
            </button>
          )}
        </For>
      </div>

      <Show when={isLinkOpen()}>
        <div class="doc-sheet__markdown-link">
          <input
            ref={(element) => queueMicrotask(() => element.focus())}
            type="url"
            class="doc-sheet__markdown-href"
            aria-label="Link URL"
            placeholder="https://"
            value={linkHref()}
            onInput={(event) => setLinkHref(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              applyLink();
            }}
          />
          <button
            type="button"
            class="doc-sheet__markdown-button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={applyLink}
          >
            Apply link
          </button>
        </div>
      </Show>

      <textarea
        ref={(element) => {
          textarea = element;
          queueMicrotask(() => element.focus());
        }}
        class="doc-sheet__markdown-input"
        aria-label={props.label}
        rows={5}
        value={draft()}
        onInput={(event) => setDraft(event.currentTarget.value)}
      />

      <div class="doc-sheet__markdown-footer">
        <button
          type="button"
          class="doc-sheet__markdown-button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={commit}
        >
          Done
        </button>
      </div>
    </div>
  );
}
