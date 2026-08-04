import { afterEach, describe, expect, it } from "vitest";
import {
  editableText,
  placeCaretAtPoint,
  selectionOffsets,
  setSelectionOffsets,
} from "../liveTextDom";

/** A detached-but-attached editable host, cleaned per test. */
function host(html: string): HTMLElement {
  const element = document.createElement("div");
  element.innerHTML = html;
  document.body.append(element);
  return element;
}

afterEach(() => {
  document.body.innerHTML = "";
  window.getSelection()?.removeAllRanges();
});

describe("editableText", () => {
  it("reads a single text node as-is", () => {
    expect(editableText(host("plain markdown *text*"))).toBe("plain markdown *text*");
  });

  it("reads <br> as a newline", () => {
    expect(editableText(host("first<br>second"))).toBe("first\nsecond");
  });

  it("reads split and nested text nodes in document order", () => {
    const element = host("");
    element.append("one ");
    const span = document.createElement("span");
    span.textContent = "two";
    element.append(span, " three");
    expect(editableText(element)).toBe("one two three");
  });

  it("reads an empty element as the empty string", () => {
    expect(editableText(host(""))).toBe("");
  });
});

describe("selectionOffsets / setSelectionOffsets", () => {
  it("round-trips a range inside one text node", () => {
    const element = host("hello world");
    setSelectionOffsets(element, 6, 11);
    expect(selectionOffsets(element)).toEqual({ start: 6, end: 11 });
  });

  it("round-trips a caret (collapsed range)", () => {
    const element = host("hello world");
    setSelectionOffsets(element, 5, 5);
    expect(selectionOffsets(element)).toEqual({ start: 5, end: 5 });
  });

  it("counts a <br> as one character when crossing lines", () => {
    const element = host("ab<br>cd");
    // Select "b\nc": offsets 1..4 in "ab\ncd".
    setSelectionOffsets(element, 1, 4);
    expect(selectionOffsets(element)).toEqual({ start: 1, end: 4 });
  });

  it("resolves element-anchored selections (select-node-contents)", () => {
    const element = host("hello");
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection() as Selection;
    selection.removeAllRanges();
    selection.addRange(range);

    expect(selectionOffsets(element)).toEqual({ start: 0, end: 5 });
  });

  it("returns null when the selection sits outside the element", () => {
    const element = host("inside");
    const other = host("outside");
    setSelectionOffsets(other, 0, 3);
    expect(selectionOffsets(element)).toBeNull();
  });

  it("clamps out-of-range offsets to the end of the content", () => {
    const element = host("abc");
    setSelectionOffsets(element, 99, 120);
    expect(selectionOffsets(element)).toEqual({ start: 3, end: 3 });
  });

  it("orders a backwards range", () => {
    const element = host("hello");
    setSelectionOffsets(element, 4, 1);
    expect(selectionOffsets(element)).toEqual({ start: 1, end: 4 });
  });
});

describe("placeCaretAtPoint", () => {
  it("falls back to a caret at the end — never select-all", () => {
    const element = host("some value");
    // jsdom implements neither caret-from-point API, which is exactly the
    // fallback branch: caret at the end, nothing selected.
    placeCaretAtPoint(element, { x: 10, y: 10 });
    expect(selectionOffsets(element)).toEqual({ start: 10, end: 10 });
  });

  it("places the caret at the end when no point is given", () => {
    const element = host("abc");
    placeCaretAtPoint(element, null);
    expect(selectionOffsets(element)).toEqual({ start: 3, end: 3 });
  });
});
