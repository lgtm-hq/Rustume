/**
 * The modal-local rich field (spec §1.13 `MiniRichEditor`): a labelled,
 * bordered box with a light toolbar over the editing area, plus an optional
 * hint line.
 *
 * It edits **markdown** as text — the textarea holds exactly what is stored,
 * and the toolbar rewrites that text through {@link applyMarkdownCommand} —
 * so the modal writes the same format as the sheet's rich `LiveText` and the
 * renderer. No underline or strikethrough by design: markdown has neither,
 * and `crates/utils/src/html_to_typst.rs` has nothing to map them onto. The
 * link button opens an inline URL row, never a prompt.
 *
 * Controlled: every change flows out through `onInput`; the surrounding
 * dialog owns the draft and commits once, on save.
 */

import { For, Show, createSignal, type JSX } from "solid-js";
import { applyMarkdownCommand, type MarkdownCommand, type MarkdownSelection } from "./markdown";
import { TOOLBAR_ACTIONS } from "./toolbarActions";
import { ToolbarIcon } from "./icons";

const BUTTON_CLASS =
  "rounded-md border border-border bg-surface px-2 py-1 font-body text-sm text-ink " +
  "hover:bg-border/60 focus-visible:outline-2 focus-visible:outline-accent min-w-8";

const ICON_BUTTON_CLASS =
  "flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface " +
  "text-ink hover:bg-border/60 focus-visible:outline-2 focus-visible:outline-accent";

export interface MiniRichEditorProps {
  /** Field name, e.g. "Highlights". Labels the textarea. */
  label: string;
  /** Markdown to edit. */
  value: string;
  /** Called with the new markdown on every change. */
  onInput: (value: string) => void;
  /** Hint line under the editor. */
  hint?: string;
}

export function MiniRichEditor(props: MiniRichEditorProps): JSX.Element {
  const [linkHref, setLinkHref] = createSignal("");
  const [isLinkOpen, setIsLinkOpen] = createSignal(false);

  let textarea: HTMLTextAreaElement | undefined;
  // The selection the link row will act on, captured before focus moves to
  // it. Offsets only: the value is read fresh at apply time, so typing after
  // the row opened is never overwritten by a stale snapshot.
  let linkRange: { start: number; end: number } | null = null;

  function selection(): MarkdownSelection {
    const value = props.value;
    if (!textarea) return { value, start: value.length, end: value.length };
    return { value, start: textarea.selectionStart, end: textarea.selectionEnd };
  }

  function applyResult(next: MarkdownSelection): void {
    props.onInput(next.value);
    queueMicrotask(() => {
      textarea?.focus();
      textarea?.setSelectionRange(next.start, next.end);
    });
  }

  function runCommand(command: MarkdownCommand): void {
    if (command === "link") {
      const { start, end } = selection();
      linkRange = { start, end };
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
    const range = linkRange === null ? selection() : { value: props.value, ...linkRange };
    applyResult(applyMarkdownCommand(range, "link", href));
    linkRange = null;
    setLinkHref("");
    setIsLinkOpen(false);
  }

  function closeLinkRow(): void {
    linkRange = null;
    setLinkHref("");
    setIsLinkOpen(false);
  }

  return (
    <div class="flex flex-col gap-1.5">
      <span class="font-mono text-xs uppercase tracking-wider text-stone">{props.label}</span>

      <div class="rounded-lg border border-border bg-paper focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
        <div
          class="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5"
          role="toolbar"
          aria-label={`${props.label} formatting`}
        >
          <For each={TOOLBAR_ACTIONS}>
            {(action) => (
              <button
                type="button"
                class={ICON_BUTTON_CLASS}
                aria-label={action.label}
                title={action.label}
                // Keep focus (and therefore the selection) in the textarea.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runCommand(action.command)}
              >
                <ToolbarIcon kind={action.icon} />
              </button>
            )}
          </For>
        </div>

        <Show when={isLinkOpen()}>
          <div class="flex items-center gap-2 border-b border-border px-2 py-1.5">
            <input
              ref={(element) => queueMicrotask(() => element.focus())}
              type="url"
              class="w-full rounded-md border border-border bg-paper px-2 py-1 font-body text-sm text-ink"
              aria-label="Link URL"
              placeholder="https://"
              value={linkHref()}
              onInput={(event) => setLinkHref(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyLink();
                  return;
                }
                if (event.key === "Escape") {
                  // Abandon the link, not the whole item edit: the dialog
                  // must not see this Escape and discard the draft.
                  event.preventDefault();
                  event.stopPropagation();
                  closeLinkRow();
                  textarea?.focus();
                }
              }}
            />
            <button
              type="button"
              class={BUTTON_CLASS}
              onMouseDown={(event) => event.preventDefault()}
              onClick={applyLink}
            >
              Apply link
            </button>
          </div>
        </Show>

        <textarea
          ref={(element) => (textarea = element)}
          class="max-h-[50vh] min-h-48 w-full resize-y rounded-b-lg bg-paper px-3 py-2 font-body text-ink placeholder:text-stone/50 focus:outline-none"
          aria-label={props.label}
          rows={9}
          placeholder="Markdown — **bold**, *italic*, - item"
          value={props.value}
          onInput={(event) => {
            // Typing invalidates the captured link offsets; the row falls
            // back to the live selection rather than a stale range.
            linkRange = null;
            props.onInput(event.currentTarget.value);
          }}
        />
      </div>

      <Show when={props.hint}>
        <span class="text-xs text-stone">{props.hint}</span>
      </Show>
    </div>
  );
}
