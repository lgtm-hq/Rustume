/**
 * A structured view of the sheet's restricted markdown dialect.
 *
 * The document sheet is the rendered document (#785), so its rich fields must
 * draw formatted text rather than markdown punctuation. This module parses
 * exactly the grammar the mini editor emits and the migration produces —
 * paragraphs, `- ` / `1. ` lists (nested by two-space indent, as
 * `htmlToMarkdown` writes them), `**bold**`, `*italic*`, `***both***`,
 * `[label](href)` — into plain data; `MarkdownView` draws it. Pure
 * text-in/data-out, so the whole renderer is unit-testable without a DOM.
 *
 * Anything outside the dialect (headings, code fences) stays literal text:
 * showing the author's punctuation is better than guessing at markdown this
 * pipeline never writes.
 */

/** One inline run of a block. */
export type MarkdownInline =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "em"; text: string }
  /** `***text***` — bold and italic together, as the migration emits it. */
  | { type: "strong-em"; text: string }
  | { type: "link"; text: string; href: string };

/** One item of a list, with its nested sublist when it has one. */
export interface MarkdownListItem {
  inlines: MarkdownInline[];
  children: MarkdownList | null;
}

/** A list at one nesting depth. */
export interface MarkdownList {
  ordered: boolean;
  items: MarkdownListItem[];
}

/** One block of a field's value. */
export type MarkdownBlock =
  | { type: "paragraph"; lines: MarkdownInline[][] }
  | ({ type: "list" } & MarkdownList);

const LIST_LINE = /^(\s*)(-|\d+\.)\s+(.*)$/;

/** Spaces per nesting level, matching `LIST_INDENT` in `htmlToMarkdown`. */
const INDENT_WIDTH = 2;

/**
 * Combine an outer emphasis with the runs parsed inside it, keeping the
 * output flat: `**a *b***` becomes strong("a "), strong-em("b").
 */
function emphasize(outer: "strong" | "em", inner: MarkdownInline[]): MarkdownInline[] {
  return inner.map((run) => {
    switch (run.type) {
      case "text":
        return { type: outer, text: run.text };
      case "strong":
      case "em":
        return run.type === outer ? run : { type: "strong-em", text: run.text };
      default:
        // Already both marks, or a link — the accent styling a link carries
        // outranks emphasis on the sheet, so it passes through unchanged.
        return run;
    }
  });
}

/**
 * Inline tokens of one line.
 *
 * `***` binds before `**` before `*` — the same disambiguation the editor's
 * own `isWrapped` applies. Emphasis nests one inside the other (`**a *b* c**`)
 * and flattens to `strong-em` runs; an unterminated marker stays literal.
 */
export function parseMarkdownInlines(line: string): MarkdownInline[] {
  const inlines: MarkdownInline[] = [];
  let text = "";
  let index = 0;

  const flush = (): void => {
    if (text !== "") {
      inlines.push({ type: "text", text });
      text = "";
    }
  };

  while (index < line.length) {
    const rest = line.slice(index);

    const link = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest);
    if (link) {
      flush();
      // A label may carry emphasis markers (`[**text**](url)` from the
      // migration); the accent styling a link carries outranks emphasis on
      // the sheet, so the label is flattened to its plain text.
      const label = parseMarkdownInlines(link[1])
        .map((run) => run.text)
        .join("");
      inlines.push({ type: "link", text: label, href: link[2] });
      index += link[0].length;
      continue;
    }

    const strongEm = /^\*\*\*([^*]+)\*\*\*/.exec(rest);
    if (strongEm) {
      flush();
      inlines.push({ type: "strong-em", text: strongEm[1] });
      index += strongEm[0].length;
      continue;
    }

    if (rest.startsWith("**")) {
      const close = rest.indexOf("**", 2);
      if (close > 2) {
        flush();
        inlines.push(...emphasize("strong", parseMarkdownInlines(rest.slice(2, close))));
        index += close + 2;
        continue;
      }
    }

    const em = /^\*([^*]+)\*/.exec(rest);
    if (em) {
      flush();
      inlines.push(...emphasize("em", parseMarkdownInlines(em[1])));
      index += em[0].length;
      continue;
    }

    text += line[index];
    index += 1;
  }

  flush();
  return inlines;
}

/**
 * The blocks of one markdown value.
 *
 * A blank line separates paragraphs; consecutive marked lines form one list,
 * with two-space indentation opening a sublist under the preceding item.
 * Single line breaks inside a paragraph are kept as their own lines. CRLF
 * input is accepted — imported documents do not all share line endings.
 */
export function parseMarkdownBlocks(value: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraph: MarkdownInline[][] = [];
  /** Open lists, outermost first; `stack[depth]` receives depth-level items. */
  let stack: MarkdownList[] = [];

  const flushParagraph = (): void => {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", lines: paragraph });
      paragraph = [];
    }
  };
  const flushList = (): void => {
    if (stack.length > 0) {
      blocks.push({ type: "list", ...stack[0] });
      stack = [];
    }
  };

  for (const line of value.split(/\r?\n/)) {
    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }

    const marked = LIST_LINE.exec(line);
    if (marked) {
      flushParagraph();
      const ordered = marked[2] !== "-";
      // Depth is clamped to "one deeper than the current list": a stray
      // over-indented line cannot open levels that have no parent.
      const depth =
        stack.length === 0
          ? 0
          : Math.min(Math.floor(marked[1].length / INDENT_WIDTH), stack.length);

      if (stack.length === 0) {
        stack.push({ ordered, items: [] });
      } else if (depth === stack.length) {
        // One level deeper: open a sublist under the last item above. A
        // sublist's marker style is set by its first line.
        const parentItems = stack[depth - 1].items;
        const sublist: MarkdownList = { ordered, items: [] };
        parentItems[parentItems.length - 1].children = sublist;
        stack.push(sublist);
      } else {
        // Back at an existing level: close everything deeper.
        stack = stack.slice(0, depth + 1);
        if (depth === 0 && stack[0].ordered !== ordered) {
          // A marker-style change at the top level starts a new list block.
          flushList();
          stack.push({ ordered, items: [] });
        }
      }

      stack[depth].items.push({ inlines: parseMarkdownInlines(marked[3]), children: null });
      continue;
    }

    flushList();
    paragraph.push(parseMarkdownInlines(line));
  }

  flushParagraph();
  flushList();
  return blocks;
}
