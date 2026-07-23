import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "solid-js";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { CommandPalette, fuzzyMatch } from "../CommandPalette";
import { uiStore } from "../../../stores/ui";

describe("fuzzyMatch", () => {
  it("matches empty query", () => {
    expect(fuzzyMatch("", "Export PDF")).toBe(true);
  });

  it("matches substring", () => {
    expect(fuzzyMatch("pdf", "Export PDF")).toBe(true);
  });

  it("matches sequential characters", () => {
    expect(fuzzyMatch("ct", "Create Resume")).toBe(true);
  });

  it("rejects non-matching query", () => {
    expect(fuzzyMatch("xyz", "Export PDF")).toBe(false);
  });
});

describe("CommandPalette", () => {
  beforeEach(() => {
    sessionStorage.clear();
    createRoot((dispose) => {
      uiStore.closeModal();
      dispose();
    });
  });

  it("opens when command palette modal is active", () => {
    uiStore.openModal("commandPalette");
    render(() => (
      <CommandPalette actions={[{ id: "export-pdf", label: "Export PDF", handler: vi.fn() }]} />
    ));

    expect(screen.getByLabelText("Search commands")).toBeInTheDocument();
    expect(screen.getByText("Export PDF")).toBeInTheDocument();
  });

  it("filters actions by query", () => {
    uiStore.openModal("commandPalette");
    render(() => (
      <CommandPalette
        actions={[
          { id: "export-pdf", label: "Export PDF", handler: vi.fn() },
          { id: "theme", label: "Change Theme", handler: vi.fn() },
        ]}
      />
    ));

    fireEvent.input(screen.getByLabelText("Search commands"), {
      target: { value: "theme" },
    });

    expect(screen.getByText("Change Theme")).toBeInTheDocument();
    expect(screen.queryByText("Export PDF")).not.toBeInTheDocument();
  });

  it("executes selected action on click", () => {
    const handler = vi.fn();
    uiStore.openModal("commandPalette");
    render(() => <CommandPalette actions={[{ id: "export-pdf", label: "Export PDF", handler }]} />);

    fireEvent.click(screen.getByText("Export PDF"));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(uiStore.store.modal).toBe(null);
  });

  it("executes action even when sessionStorage writes are blocked", () => {
    const handler = vi.fn();
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    try {
      uiStore.openModal("commandPalette");
      render(() => (
        <CommandPalette actions={[{ id: "export-pdf", label: "Export PDF", handler }]} />
      ));

      fireEvent.click(screen.getByText("Export PDF"));

      expect(handler).toHaveBeenCalledTimes(1);
      expect(uiStore.store.modal).toBe(null);
    } finally {
      setItemSpy.mockRestore();
    }
  });

  it("wires combobox ARIA attributes to the listbox and options", () => {
    uiStore.openModal("commandPalette");
    render(() => (
      <CommandPalette
        actions={[
          { id: "export-pdf", label: "Export PDF", handler: vi.fn() },
          { id: "theme", label: "Change Theme", handler: vi.fn() },
        ]}
      />
    ));

    const input = screen.getByRole("combobox");
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveAttribute("aria-controls", "command-palette-listbox");
    expect(input).toHaveAttribute("aria-activedescendant", "command-option-0");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", "command-option-1");

    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("id", "command-option-0");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
  });

  it("executes highlighted action on Enter", () => {
    const handler = vi.fn();
    uiStore.openModal("commandPalette");
    render(() => (
      <CommandPalette
        actions={[
          { id: "theme", label: "Change Theme", handler: vi.fn() },
          { id: "export-pdf", label: "Export PDF", handler },
        ]}
      />
    ));

    fireEvent.keyDown(screen.getByLabelText("Search commands"), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByLabelText("Search commands"), { key: "Enter" });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(uiStore.store.modal).toBe(null);
  });
});
