import { describe, expect, it } from "vitest";
import { parseMarkdownBlocks, parseMarkdownInlines, type MarkdownInline } from "../markdownBlocks";

/** A leaf list item, in the shape `parseMarkdownBlocks` produces. */
function item(...inlines: MarkdownInline[]) {
  return { inlines, children: null };
}

function text(value: string): MarkdownInline {
  return { type: "text", text: value };
}

describe("parseMarkdownInlines", () => {
  it("returns plain text as one run", () => {
    expect(parseMarkdownInlines("just text")).toEqual([text("just text")]);
  });

  it("parses bold, binding ** before *", () => {
    expect(parseMarkdownInlines("with **eleven years** of")).toEqual([
      text("with "),
      { type: "strong", text: "eleven years" },
      text(" of"),
    ]);
  });

  it("parses italic", () => {
    expect(parseMarkdownInlines("cut by *60%* overall")).toEqual([
      text("cut by "),
      { type: "em", text: "60%" },
      text(" overall"),
    ]);
  });

  it("parses ***both*** as bold italic — the migration emits it", () => {
    expect(parseMarkdownInlines("is ***both*** marks")).toEqual([
      text("is "),
      { type: "strong-em", text: "both" },
      text(" marks"),
    ]);
  });

  it("parses links into label and href", () => {
    expect(parseMarkdownInlines("see [the docs](https://example.com) now")).toEqual([
      text("see "),
      { type: "link", text: "the docs", href: "https://example.com" },
      text(" now"),
    ]);
  });

  it("keeps an unterminated marker literal", () => {
    expect(parseMarkdownInlines("2 * 3 = 6")).toEqual([text("2 * 3 = 6")]);
  });
});

describe("parseMarkdownBlocks", () => {
  it("splits paragraphs on blank lines and keeps single breaks as lines", () => {
    expect(parseMarkdownBlocks("first\nstill first\n\nsecond")).toEqual([
      {
        type: "paragraph",
        lines: [[text("first")], [text("still first")]],
      },
      { type: "paragraph", lines: [[text("second")]] },
    ]);
  });

  it("accepts CRLF line endings", () => {
    expect(parseMarkdownBlocks("first\r\n\r\n- one\r\n- two")).toEqual([
      { type: "paragraph", lines: [[text("first")]] },
      { type: "list", ordered: false, items: [item(text("one")), item(text("two"))] },
    ]);
  });

  it("groups consecutive dash lines into one unordered list", () => {
    expect(parseMarkdownBlocks("- one\n- two")).toEqual([
      { type: "list", ordered: false, items: [item(text("one")), item(text("two"))] },
    ]);
  });

  it("groups numbered lines into one ordered list", () => {
    expect(parseMarkdownBlocks("1. one\n2. two")).toEqual([
      { type: "list", ordered: true, items: [item(text("one")), item(text("two"))] },
    ]);
  });

  it("nests a two-space-indented line under the preceding item", () => {
    // The shape `htmlToMarkdown` writes for a nested TipTap list.
    expect(parseMarkdownBlocks("- Parent\n  - Child\n- Sibling")).toEqual([
      {
        type: "list",
        ordered: false,
        items: [
          {
            inlines: [text("Parent")],
            children: { ordered: false, items: [item(text("Child"))] },
          },
          item(text("Sibling")),
        ],
      },
    ]);
  });

  it("nests a sublist of the other marker style", () => {
    expect(parseMarkdownBlocks("- Parent\n  1. First\n  2. Second")).toEqual([
      {
        type: "list",
        ordered: false,
        items: [
          {
            inlines: [text("Parent")],
            children: { ordered: true, items: [item(text("First")), item(text("Second"))] },
          },
        ],
      },
    ]);
  });

  it("clamps over-indented lines to one level below their parent", () => {
    expect(parseMarkdownBlocks("- Parent\n        - Deep")).toEqual([
      {
        type: "list",
        ordered: false,
        items: [
          {
            inlines: [text("Parent")],
            children: { ordered: false, items: [item(text("Deep"))] },
          },
        ],
      },
    ]);
  });

  it("keeps a paragraph and a following list as separate blocks", () => {
    const blocks = parseMarkdownBlocks("Intro text\n\n- bullet");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("paragraph");
    expect(blocks[1]).toEqual({ type: "list", ordered: false, items: [item(text("bullet"))] });
  });

  it("splits a top-level list when the marker style changes", () => {
    const blocks = parseMarkdownBlocks("- one\n1. two");
    expect(blocks).toEqual([
      { type: "list", ordered: false, items: [item(text("one"))] },
      { type: "list", ordered: true, items: [item(text("two"))] },
    ]);
  });

  it("parses inline marks inside list items", () => {
    expect(parseMarkdownBlocks("- **Led** the migration")).toEqual([
      {
        type: "list",
        ordered: false,
        items: [item({ type: "strong", text: "Led" }, text(" the migration"))],
      },
    ]);
  });

  it("returns nothing for an empty value", () => {
    expect(parseMarkdownBlocks("")).toEqual([]);
    expect(parseMarkdownBlocks("\n\n")).toEqual([]);
  });

  it("leaves out-of-dialect markdown literal", () => {
    // Headings are outside the dialect the editor can produce; the text stays
    // as authored rather than being guessed at.
    expect(parseMarkdownBlocks("# Not a heading")).toEqual([
      { type: "paragraph", lines: [[text("# Not a heading")]] },
    ]);
  });
});
