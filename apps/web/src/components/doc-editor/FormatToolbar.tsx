/**
 * The floating format bar for armed rich `LiveText` fields (spec §1.12).
 *
 * Fixed top-centre under the top bar, visible only while a rich field is
 * armed and the sheet is in Edit mode. The armed field registers a controller
 * through {@link FormatToolbarContext}; the bar itself holds no editing state.
 *
 * The actions write **markdown** through `applyMarkdownCommand` — the UX
 * contract of the prototype's bar (floating, same actions, selection
 * preserved) on the production markdown pipeline instead of `execCommand`
 * HTML. There is no underline or strikethrough button on purpose: markdown
 * has neither, and `crates/utils/src/html_to_typst.rs` has nothing to map
 * them onto. The link button opens an inline URL row — never a prompt.
 *
 * Buttons suppress their own mousedown so pressing one neither steals focus
 * from the armed field nor drops the selection the command acts on; the URL
 * row is the one part that takes focus, which is why the toolbar's element is
 * shared through the context — the armed field treats focus inside it as
 * still part of the same editing session.
 */

import { For, Show, createContext, createSignal, useContext, type JSX } from "solid-js";
import type { MarkdownCommand } from "./markdown";
import { useSheetEditable } from "./sheetMode";

/** What an armed rich field offers the toolbar. */
export interface RichFieldController {
  /** Field name, e.g. "Summary" — labels the toolbar for assistive tech. */
  label: string;
  /** Run a markdown command over the field's current selection. */
  apply: (command: MarkdownCommand, href?: string) => void;
  /** Put focus back on the field (after the URL row took it). */
  focusField: () => void;
}

export interface FormatToolbarState {
  controller: () => RichFieldController | null;
  setController: (controller: RichFieldController | null) => void;
  /** Whether `node` sits inside the toolbar — the blur-containment test. */
  isWithinToolbar: (node: unknown) => boolean;
  /** The toolbar registers its root here. */
  setToolbarElement: (element: HTMLElement | undefined) => void;
}

/** Outside a provider the toolbar simply never shows; fields still work. */
function inertState(): FormatToolbarState {
  return {
    controller: () => null,
    setController: () => {},
    isWithinToolbar: () => false,
    setToolbarElement: () => {},
  };
}

export const FormatToolbarContext = createContext<FormatToolbarState>(inertState());

/** One shared toolbar state per sheet; `DocSheet` provides it. */
export function createFormatToolbarState(): FormatToolbarState {
  const [controller, setController] = createSignal<RichFieldController | null>(null);
  let element: HTMLElement | undefined;
  return {
    controller,
    setController,
    isWithinToolbar: (node) =>
      node instanceof Node && element !== undefined && element.contains(node),
    setToolbarElement: (next) => {
      element = next;
    },
  };
}

export function useFormatToolbar(): FormatToolbarState {
  return useContext(FormatToolbarContext);
}

interface ToolbarAction {
  command: MarkdownCommand;
  label: string;
  /** Short glyph drawn in the button; the accessible name is `label`. */
  glyph: string;
}

/** Underline and strikethrough are absent by design — see the module note. */
const TOOLBAR: readonly ToolbarAction[] = [
  { command: "bold", label: "Bold", glyph: "B" },
  { command: "italic", label: "Italic", glyph: "I" },
  { command: "bulletList", label: "Bulleted list", glyph: "•" },
  { command: "orderedList", label: "Numbered list", glyph: "1." },
  // Typographic glyphs, never emoji — see the brand anti-pattern list.
  { command: "link", label: "Link", glyph: "Link" },
];

/** The floating bar. Mounted once per sheet, inside the context provider. */
export function FormatToolbar(): JSX.Element {
  const isEditable = useSheetEditable();
  const toolbar = useFormatToolbar();
  const [linkHref, setLinkHref] = createSignal("");
  const [isLinkOpen, setIsLinkOpen] = createSignal(false);

  const controller = (): RichFieldController | null => (isEditable() ? toolbar.controller() : null);

  function closeLinkRow(): void {
    setLinkHref("");
    setIsLinkOpen(false);
  }

  function runCommand(command: MarkdownCommand): void {
    const field = controller();
    if (!field) return;
    if (command === "link") {
      setIsLinkOpen(true);
      return;
    }
    closeLinkRow();
    field.apply(command);
  }

  function applyLink(): void {
    const field = controller();
    const href = linkHref().trim();
    if (!field || href === "") return;
    field.apply("link", href);
    closeLinkRow();
    field.focusField();
  }

  return (
    <Show when={controller()}>
      {(field) => (
        <div
          ref={(element) => {
            toolbar.setToolbarElement(element);
          }}
          class="doc-sheet__fmtbar"
          role="toolbar"
          aria-label={`${field().label} formatting`}
          data-testid="doc-sheet-format-toolbar"
        >
          <For each={TOOLBAR}>
            {(action) => (
              <button
                type="button"
                class="doc-sheet__fmtbar-button"
                aria-label={action.label}
                // Keep focus (and therefore the selection) in the armed field.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runCommand(action.command)}
              >
                {action.glyph}
              </button>
            )}
          </For>

          <Show when={isLinkOpen()}>
            <input
              ref={(element) => queueMicrotask(() => element.focus())}
              type="url"
              class="doc-sheet__fmtbar-href"
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
                  // Abandon the link, not the whole edit: the field stays armed.
                  event.preventDefault();
                  event.stopPropagation();
                  closeLinkRow();
                  field().focusField();
                }
              }}
            />
            <button
              type="button"
              class="doc-sheet__fmtbar-button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={applyLink}
            >
              Apply link
            </button>
          </Show>
        </div>
      )}
    </Show>
  );
}
