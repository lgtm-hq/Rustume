import { createSignal } from "solid-js";
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

/**
 * The ProseMirror surface reports `role="textbox"`, so it is an ARIA input
 * field and must carry a name of its own — a nearby heading does not count.
 */
describe("RichTextEditor accessible name", () => {
  // Scoped to the render container: a stale editor left in the document by an
  // earlier test would otherwise be able to satisfy these assertions.
  const surface = (container: HTMLElement) =>
    container.querySelector('.rich-text-editor [role="textbox"]');

  it("points the editing surface at the visible label", () => {
    const { container } = render(() => (
      <RichTextEditor label="Summary" value="" onInput={vi.fn()} />
    ));

    const labelledBy = surface(container)?.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(container.querySelector(`#${labelledBy}`)?.textContent).toBe("Summary");
  });

  it("falls back to ariaLabel where no label is rendered", () => {
    const { container } = render(() => (
      <RichTextEditor ariaLabel="Cover letter body" value="" onInput={vi.fn()} />
    ));

    expect(surface(container)).toHaveAttribute("aria-label", "Cover letter body");
    expect(surface(container)).not.toHaveAttribute("aria-labelledby");
  });

  it("keeps the textbox role that editorProps.attributes would otherwise replace", () => {
    const { container } = render(() => (
      <RichTextEditor label="Summary" value="" onInput={vi.fn()} />
    ));

    expect(surface(container)).toHaveAttribute("aria-multiline", "true");
  });

  it("re-names the surface when the label prop changes", () => {
    const [label, setLabel] = createSignal<string | undefined>(undefined);
    const { container } = render(() => (
      <RichTextEditor label={label()} ariaLabel="Cover letter body" value="" onInput={vi.fn()} />
    ));

    expect(surface(container)).toHaveAttribute("aria-label", "Cover letter body");

    setLabel("Summary");

    const labelledBy = surface(container)?.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(container.querySelector(`#${labelledBy}`)?.textContent).toBe("Summary");
    // The two naming attributes must never coexist — `aria-labelledby` wins,
    // so a leftover `aria-label` would be silently dead markup.
    expect(surface(container)).not.toHaveAttribute("aria-label");
  });
});
