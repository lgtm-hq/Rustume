/**
 * A structured view of the sheet's restricted markdown dialect.
 *
 * The document sheet is the rendered document (#785), so its rich fields must
 * draw formatted text rather than markdown punctuation. This module parses
 * exactly the grammar the mini editor emits and the migration produces —
 * paragraphs, `- ` / `1. ` lists, `**bold**`, `*italic*`, `[label](href)` —
 * into plain data; `MarkdownView` draws it. Pure text-in/data-out, so the
 * whole renderer is unit-testable without a DOM.
 *
 * Anything outside the dialect (headings, code fences, nesting the toolbar
 * cannot produce) stays literal text: showing the author's punctuation is
 * better than guessing at markdown this pipeline never writes.
 */

/** One inline run of a block. */
export type MarkdownInline =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "em"; text: string }
  | { type: "link"; text: string; href: string };

/** One block of a field's value. */
export type MarkdownBlock =
  | { type: "paragraph"; lines: MarkdownInline[][] }
  | { type: "list"; ordered: boolean; items: MarkdownInline[][] };

const BULLET_LINE = /^\s*-\s+(.*)$/;
const ORDERED_LINE = /^\s*\d+\.\s+(.*)$/;

/**
 * Inline tokens of one line.
 *
 * `**` binds before `*` — the same disambiguation the editor's own
 * `isWrapped` applies — and an unterminated marker stays literal.
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
      inlines.push({ type: "link", text: link[1], href: link[2] });
      index += link[0].length;
      continue;
    }

    const strong = /^\*\*([^*]+)\*\*/.exec(rest);
    if (strong) {
      flush();
      inlines.push({ type: "strong", text: strong[1] });
      index += strong[0].length;
      continue;
    }

    const em = /^\*([^*]+)\*/.exec(rest);
    if (em) {
      flush();
      inlines.push({ type: "em", text: em[1] });
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
 * A blank line separates paragraphs; consecutive marked lines form one list.
 * Single line breaks inside a paragraph are kept as their own lines, matching
 * the `pre-wrap` behaviour the raw sheet had.
 */
export function parseMarkdownBlocks(value: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraph: MarkdownInline[][] = [];
  let list: { ordered: boolean; items: MarkdownInline[][] } | null = null;

  const flushParagraph = (): void => {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", lines: paragraph });
      paragraph = [];
    }
  };
  const flushList = (): void => {
    if (list) {
      blocks.push({ type: "list", ordered: list.ordered, items: list.items });
      list = null;
    }
  };

  for (const line of value.split("\n")) {
    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }

    const bullet = BULLET_LINE.exec(line);
    const ordered = bullet ? null : ORDERED_LINE.exec(line);
    if (bullet || ordered) {
      flushParagraph();
      const isOrdered = ordered !== null;
      if (!list || list.ordered !== isOrdered) {
        flushList();
        list = { ordered: isOrdered, items: [] };
      }
      list.items.push(parseMarkdownInlines((bullet ?? ordered)![1]));
      continue;
    }

    flushList();
    paragraph.push(parseMarkdownInlines(line));
  }

  flushParagraph();
  flushList();
  return blocks;
}
