/**
 * The one list of rich-text toolbar actions, shared by the floating
 * {@link FormatToolbar} and the modal-local {@link MiniRichEditor} so both
 * bars stay the same set by construction.
 *
 * No underline and no strikethrough by design: markdown has neither, and
 * `crates/utils/src/html_to_typst.rs` has nothing to map them onto.
 */

import type { MarkdownCommand } from "./markdown";

export interface ToolbarAction {
  command: MarkdownCommand;
  label: string;
  /** Short glyph drawn in the button; the accessible name is `label`. */
  glyph: string;
}

export const TOOLBAR_ACTIONS: readonly ToolbarAction[] = [
  { command: "bold", label: "Bold", glyph: "B" },
  { command: "italic", label: "Italic", glyph: "I" },
  { command: "bulletList", label: "Bulleted list", glyph: "•" },
  { command: "orderedList", label: "Numbered list", glyph: "1." },
  // Typographic glyphs, never emoji — see the brand anti-pattern list.
  { command: "link", label: "Link", glyph: "Link" },
];
