/**
 * The one list of rich-text toolbar actions the modal-local
 * {@link MiniRichEditor} draws, so any future bar renders the same set by
 * construction.
 *
 * No underline and no strikethrough by design: markdown has neither, and
 * `crates/utils/src/html_to_typst.rs` has nothing to map them onto.
 */

import type { MarkdownCommand } from "./markdown";
import type { ToolbarIconKind } from "./icons";

export interface ToolbarAction {
  command: MarkdownCommand;
  /** Accessible name and tooltip of the button. */
  label: string;
  /** Which glyph from `icons.tsx` the button draws. */
  icon: ToolbarIconKind;
}

export const TOOLBAR_ACTIONS: readonly ToolbarAction[] = [
  { command: "bold", label: "Bold", icon: "bold" },
  { command: "italic", label: "Italic", icon: "italic" },
  { command: "bulletList", label: "Bulleted list", icon: "bulletList" },
  { command: "orderedList", label: "Numbered list", icon: "orderedList" },
  { command: "link", label: "Link", icon: "link" },
  { command: "codeBlock", label: "Code block", icon: "codeBlock" },
];
