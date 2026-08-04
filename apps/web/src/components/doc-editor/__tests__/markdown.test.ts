import { describe, expect, it } from "vitest";
import { applyMarkdownCommand } from "../markdown";

/** Run a command over `value` with `[start, end)` selected. */
function run(
  value: string,
  start: number,
  end: number,
  command: Parameters<typeof applyMarkdownCommand>[1],
  href?: string,
): string {
  return applyMarkdownCommand({ value, start, end }, command, href).value;
}

describe("applyMarkdownCommand", () => {
  it("emits the markdown each toolbar action is named for", () => {
    expect(run("bold", 0, 4, "bold")).toBe("**bold**");
    expect(run("italic", 0, 6, "italic")).toBe("*italic*");
    expect(run("label", 0, 5, "link", "https://example.com")).toBe("[label](https://example.com)");
    expect(run("item", 0, 4, "bulletList")).toBe("- item");
    expect(run("item", 0, 4, "orderedList")).toBe("1. item");
  });

  it("numbers every line of an ordered list", () => {
    expect(run("one\ntwo\nthree", 0, 13, "orderedList")).toBe("1. one\n2. two\n3. three");
  });

  it("marks every line of a bulleted list", () => {
    expect(run("one\ntwo", 0, 7, "bulletList")).toBe("- one\n- two");
  });

  it("switches a bulleted list to an ordered one", () => {
    expect(run("- one\n- two", 0, 11, "orderedList")).toBe("1. one\n2. two");
  });

  it("removes the markers when every touched line already carries them", () => {
    expect(run("- one\n- two", 0, 11, "bulletList")).toBe("one\ntwo");
    expect(run("1. one\n2. two", 0, 13, "orderedList")).toBe("one\ntwo");
  });

  it("unwraps a selection that is already emphasised", () => {
    expect(run("**bold**", 2, 6, "bold")).toBe("bold");
    expect(run("*italic*", 1, 7, "italic")).toBe("italic");
  });

  it("treats the inner asterisks of bold text as bold, not as italic", () => {
    // Italicising the text inside `**…**` must nest rather than strip the bold.
    expect(run("**bold**", 2, 6, "italic")).toBe("***bold***");
  });

  it("inserts a placeholder when nothing is selected", () => {
    expect(run("", 0, 0, "bold")).toBe("**bold text**");
    expect(run("", 0, 0, "italic")).toBe("*italic text*");
    expect(run("", 0, 0, "link", "https://example.com")).toBe("[link](https://example.com)");
    expect(run("", 0, 0, "bulletList")).toBe("- List item");
  });

  it("selects the inserted text so it can be typed over", () => {
    const result = applyMarkdownCommand({ value: "", start: 0, end: 0 }, "bold");
    expect(result.value.slice(result.start, result.end)).toBe("bold text");
  });

  it("leaves text outside the selection alone", () => {
    expect(run("keep bold keep", 5, 9, "bold")).toBe("keep **bold** keep");
  });

  it("only marks the lines the selection touches", () => {
    expect(run("one\ntwo\nthree", 4, 7, "bulletList")).toBe("one\n- two\nthree");
  });

  it("does not reach the next line when the selection ends on the newline", () => {
    // Shift+Down to the start of line three selects "one\ntwo\n" — the line it
    // lands on is not part of the selection.
    expect(run("one\ntwo\nthree", 0, 8, "bulletList")).toBe("- one\n- two\nthree");
  });

  it("fences the touched lines as a code block", () => {
    expect(run("let x = 1;", 0, 10, "codeBlock")).toBe("```\nlet x = 1;\n```");
    expect(run("one\ntwo", 0, 7, "codeBlock")).toBe("```\none\ntwo\n```");
  });

  it("fences only the touched lines, leaving neighbours alone", () => {
    expect(run("before\ncode\nafter", 7, 11, "codeBlock")).toBe("before\n```\ncode\n```\nafter");
  });

  it("inserts a placeholder code block on an empty selection", () => {
    const result = applyMarkdownCommand({ value: "", start: 0, end: 0 }, "codeBlock");
    expect(result.value).toBe("```\ncode\n```");
    expect(result.value.slice(result.start, result.end)).toBe("code");
  });

  it("unfences when the selection covers the fences", () => {
    expect(run("```\ncode\n```", 0, 12, "codeBlock")).toBe("code");
  });

  it("unfences when the selection sits inside a fenced block", () => {
    expect(run("before\n```\ncode\n```\nafter", 11, 15, "codeBlock")).toBe("before\ncode\nafter");
  });

  it("unfences from a caret on any body line of a multi-line block", () => {
    // Caret on "two" — not adjacent to either fence. The freed body stays
    // selected so the toggle can be re-applied or typed over.
    const result = applyMarkdownCommand(
      { value: "```\none\ntwo\nthree\n```", start: 9, end: 9 },
      "codeBlock",
    );
    expect(result).toEqual({ value: "one\ntwo\nthree", start: 0, end: 13 });
  });

  it("unfences from a caret on a fence line itself", () => {
    const result = applyMarkdownCommand({ value: "```\ncode\n```", start: 1, end: 1 }, "codeBlock");
    expect(result).toEqual({ value: "code", start: 0, end: 4 });
  });

  it("unfences an unterminated block still being typed", () => {
    expect(run("```\ncode", 6, 6, "codeBlock")).toBe("code");
  });

  it("does not treat a fence with trailing text as a closing fence", () => {
    // "```x" is body, not a close — the block runs on to the real fence.
    expect(run("```\na\n```x\nb\n```", 7, 7, "codeBlock")).toBe("a\n```x\nb");
  });
});
