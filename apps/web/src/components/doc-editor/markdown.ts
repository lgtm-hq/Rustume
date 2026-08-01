/**
 * Markdown transforms behind the sheet's mini rich editor.
 *
 * Pure text-in / text-out: a command takes the field's value plus the caret
 * range and returns the next value and the next range. Nothing here touches the
 * DOM, so the whole toolbar is unit-testable without rendering a textarea.
 *
 * The command set is deliberately small — bold, italic, link, unordered list,
 * ordered list. There is no underline: markdown has none, and the render path
 * (`crates/utils/src/html_to_typst.rs`) has nothing to turn one into. Anything
 * emitted here must survive that conversion, which is why the output stays on
 * `**`, `*`, `[label](href)`, `- ` and `1. `.
 */

/** A toolbar action. Underline is absent by design — see the module note. */
export type MarkdownCommand = "bold" | "italic" | "link" | "bulletList" | "orderedList";

/** A field's text with the caret range the user has selected in it. */
export interface MarkdownSelection {
  value: string;
  /** Caret start offset. */
  start: number;
  /** Caret end offset; equal to `start` for an empty selection. */
  end: number;
}

/** Placeholder inserted when a command runs against an empty selection. */
const PLACEHOLDERS: Record<MarkdownCommand, string> = {
  bold: "bold text",
  italic: "italic text",
  link: "link",
  bulletList: "List item",
  orderedList: "List item",
};

const BULLET_PREFIX = /^(\s*)-\s+/;
const ORDERED_PREFIX = /^(\s*)\d+\.\s+/;

function clampRange(selection: MarkdownSelection): MarkdownSelection {
  const start = Math.max(0, Math.min(selection.start, selection.value.length));
  const end = Math.max(start, Math.min(selection.end, selection.value.length));
  return { value: selection.value, start, end };
}

/**
 * Whether `marker` already wraps the selection.
 *
 * A single `*` sitting inside a `**` pair is bold, not italic, so the italic
 * check refuses to treat the inner asterisks of `**text**` as its own markers.
 */
function isWrapped(value: string, start: number, end: number, marker: string): boolean {
  if (start < marker.length || end + marker.length > value.length) return false;
  if (value.slice(start - marker.length, start) !== marker) return false;
  if (value.slice(end, end + marker.length) !== marker) return false;
  if (marker === "*") {
    const before = start - marker.length;
    if (value.slice(before - 1, before) === "*" || value.slice(end + 1, end + 2) === "*") {
      return false;
    }
  }
  return true;
}

/** Wrap the selection in `marker`, or unwrap it when it is already wrapped. */
function toggleWrap(
  selection: MarkdownSelection,
  marker: string,
  placeholder: string,
): MarkdownSelection {
  const { value, start, end } = selection;

  if (isWrapped(value, start, end, marker)) {
    const next =
      value.slice(0, start - marker.length) +
      value.slice(start, end) +
      value.slice(end + marker.length);
    return { value: next, start: start - marker.length, end: end - marker.length };
  }

  const selected = start === end ? placeholder : value.slice(start, end);
  const next = `${value.slice(0, start)}${marker}${selected}${marker}${value.slice(end)}`;
  const contentStart = start + marker.length;
  return { value: next, start: contentStart, end: contentStart + selected.length };
}

/** Bounds of the whole lines the selection touches. */
function lineRange(value: string, start: number, end: number): { from: number; to: number } {
  const from = value.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = value.indexOf("\n", end);
  return { from, to: lineEnd === -1 ? value.length : lineEnd };
}

/**
 * Prefix every touched line with a list marker, or strip the markers when every
 * touched line already carries one.
 */
function toggleList(
  selection: MarkdownSelection,
  ordered: boolean,
  placeholder: string,
): MarkdownSelection {
  const { value, start, end } = selection;
  const { from, to } = lineRange(value, start, end);
  const block = value.slice(from, to);
  const lines = block === "" ? [placeholder] : block.split("\n");
  const pattern = ordered ? ORDERED_PREFIX : BULLET_PREFIX;

  const allMarked = lines.every((line) => pattern.test(line));
  const next = lines
    .map((line, index) => {
      if (allMarked) return line.replace(pattern, "$1");
      const stripped = line.replace(BULLET_PREFIX, "$1").replace(ORDERED_PREFIX, "$1");
      const indent = /^\s*/.exec(stripped)?.[0] ?? "";
      const body = stripped.slice(indent.length);
      return `${indent}${ordered ? `${index + 1}. ` : "- "}${body}`;
    })
    .join("\n");

  const value2 = value.slice(0, from) + next + value.slice(to);
  return { value: value2, start: from, end: from + next.length };
}

/** Wrap the selection as a markdown link pointing at `href`. */
function applyLink(selection: MarkdownSelection, href: string): MarkdownSelection {
  const { value, start, end } = selection;
  const label = start === end ? PLACEHOLDERS.link : value.slice(start, end);
  const link = `[${label}](${href})`;
  const next = value.slice(0, start) + link + value.slice(end);
  return { value: next, start: start + 1, end: start + 1 + label.length };
}

/**
 * Run `command` over `selection` and return the next value and caret range.
 *
 * `href` is only read by the link command; every other command ignores it.
 */
export function applyMarkdownCommand(
  selection: MarkdownSelection,
  command: MarkdownCommand,
  href = "",
): MarkdownSelection {
  const range = clampRange(selection);

  switch (command) {
    case "bold":
      return toggleWrap(range, "**", PLACEHOLDERS.bold);
    case "italic":
      return toggleWrap(range, "*", PLACEHOLDERS.italic);
    case "link":
      return applyLink(range, href);
    case "bulletList":
      return toggleList(range, false, PLACEHOLDERS.bulletList);
    case "orderedList":
      return toggleList(range, true, PLACEHOLDERS.orderedList);
  }
}
