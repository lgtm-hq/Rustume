import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { RichTextEditor } from "../RichTextEditor";

describe("RichTextEditor toolbar keyboard navigation", () => {
  it("uses roving tabindex with arrow-key navigation between controls", () => {
    render(() => <RichTextEditor label="Summary" value="" onInput={vi.fn()} />);

    const toolbar = screen.getByRole("toolbar", { name: "Formatting" });
    const buttons = toolbar.querySelectorAll("button");
    expect(buttons.length).toBe(6);

    const tabStops = [...buttons].filter((button) => button.tabIndex === 0);
    expect(tabStops).toHaveLength(1);

    (buttons[0] as HTMLButtonElement).focus();
    fireEvent.keyDown(toolbar, { key: "ArrowRight" });
    expect(document.activeElement).toBe(buttons[1]);

    fireEvent.keyDown(toolbar, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("exposes aria-pressed on toggle buttons", () => {
    render(() => <RichTextEditor label="Summary" value="" onInput={vi.fn()} />);

    const bold = screen.getByRole("button", { name: "Bold" });
    expect(bold).toHaveAttribute("aria-pressed", "false");
  });

  it("exposes a single tab stop so Tab can move focus to the editor", () => {
    render(() => <RichTextEditor label="Summary" value="" onInput={vi.fn()} />);

    const toolbar = screen.getByRole("toolbar", { name: "Formatting" });
    const buttons = toolbar.querySelectorAll("button");
    const tabStops = [...buttons].filter((button) => button.tabIndex === 0);
    expect(tabStops).toHaveLength(1);

    const editor = document.querySelector(
      ".rich-text-editor .tiptap, .rich-text-editor [contenteditable='true']",
    ) as HTMLElement | null;
    expect(editor).toBeTruthy();
    editor?.focus();
    expect(document.activeElement === editor || editor?.contains(document.activeElement)).toBe(
      true,
    );
  });
});
