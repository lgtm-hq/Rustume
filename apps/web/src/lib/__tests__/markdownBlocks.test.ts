import { describe, expect, it } from "vitest";
import { parseMarkdownBlocks, parseMarkdownInlines } from "../markdownBlocks";

describe("parseMarkdownInlines", () => {
  it("returns plain text as one run", () => {
    expect(parseMarkdownInlines("just text")).toEqual([{ type: "text", text: "just text" }]);
  });

  it("parses bold, binding ** before *", () => {
    expect(parseMarkdownInlines("with **eleven years** of")).toEqual([
      { type: "text", text: "with " },
      { type: "strong", text: "eleven years" },
      { type: "text", text: " of" },
    ]);
  });

  it("parses italic", () => {
    expect(parseMarkdownInlines("cut by *60%* overall")).toEqual([
      { type: "text", text: "cut by " },
      { type: "em", text: "60%" },
      { type: "text", text: " overall" },
    ]);
  });

  it("parses links into label and href", () => {
    expect(parseMarkdownInlines("see [the docs](https://example.com) now")).toEqual([
      { type: "text", text: "see " },
      { type: "link", text: "the docs", href: "https://example.com" },
      { type: "text", text: " now" },
    ]);
  });

  it("keeps an unterminated marker literal", () => {
    expect(parseMarkdownInlines("2 * 3 = 6")).toEqual([{ type: "text", text: "2 * 3 = 6" }]);
  });
});

describe("parseMarkdownBlocks", () => {
  it("splits paragraphs on blank lines and keeps single breaks as lines", () => {
    expect(parseMarkdownBlocks("first\nstill first\n\nsecond")).toEqual([
      {
        type: "paragraph",
        lines: [[{ type: "text", text: "first" }], [{ type: "text", text: "still first" }]],
      },
      { type: "paragraph", lines: [[{ type: "text", text: "second" }]] },
    ]);
  });

  it("groups consecutive dash lines into one unordered list", () => {
    expect(parseMarkdownBlocks("- one\n- two")).toEqual([
      {
        type: "list",
        ordered: false,
        items: [[{ type: "text", text: "one" }], [{ type: "text", text: "two" }]],
      },
    ]);
  });

  it("groups numbered lines into one ordered list", () => {
    expect(parseMarkdownBlocks("1. one\n2. two")).toEqual([
      {
        type: "list",
        ordered: true,
        items: [[{ type: "text", text: "one" }], [{ type: "text", text: "two" }]],
      },
    ]);
  });

  it("keeps a paragraph and a following list as separate blocks", () => {
    const blocks = parseMarkdownBlocks("Intro text\n\n- bullet");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("paragraph");
    expect(blocks[1]).toEqual({
      type: "list",
      ordered: false,
      items: [[{ type: "text", text: "bullet" }]],
    });
  });

  it("splits a list when the marker style changes", () => {
    const blocks = parseMarkdownBlocks("- one\n1. two");
    expect(blocks).toEqual([
      { type: "list", ordered: false, items: [[{ type: "text", text: "one" }]] },
      { type: "list", ordered: true, items: [[{ type: "text", text: "two" }]] },
    ]);
  });

  it("parses inline marks inside list items", () => {
    expect(parseMarkdownBlocks("- **Led** the migration")).toEqual([
      {
        type: "list",
        ordered: false,
        items: [
          [
            { type: "strong", text: "Led" },
            { type: "text", text: " the migration" },
          ],
        ],
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
      { type: "paragraph", lines: [[{ type: "text", text: "# Not a heading" }]] },
    ]);
  });
});
