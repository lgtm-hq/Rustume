import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor } from "@solidjs/testing-library";
import { createDefaultResume } from "../../../wasm/defaults";
import { resumeStore } from "../../../stores/resume";
import { LayoutEditor } from "../LayoutEditor";

vi.mock("../../../wasm", () => ({
  createEmptyResume: () => createDefaultResume(),
  saveResume: vi.fn().mockResolvedValue(undefined),
  getResume: vi.fn(),
  isWasmReady: () => false,
}));

/** Section IDs in the order they currently appear in the DOM. */
function sectionOrder(): string[] {
  return [...document.querySelectorAll("[data-section-id]")].map(
    (el) => el.getAttribute("data-section-id") ?? "",
  );
}

function moveControl(sectionId: string, direction: string): HTMLButtonElement {
  const control = document.querySelector<HTMLButtonElement>(
    `[data-layout-move="${sectionId}-${direction}"]`,
  );
  if (!control) throw new Error(`No ${direction} control for ${sectionId}`);
  return control;
}

/**
 * SC 2.5.7 (Dragging Movements): every rearrangement reachable by dragging
 * must also be reachable with a single pointer. These controls are that path.
 */
describe("LayoutEditor pointer move controls", () => {
  beforeEach(() => {
    localStorage.clear();
    resumeStore.createNewResume("layout-pointer-test");
  });

  it("reorders a section within its column on a single click", async () => {
    render(() => <LayoutEditor />);

    await waitFor(() => {
      expect(document.querySelector('[data-section-id="experience"]')).toBeTruthy();
    });

    const before = sectionOrder();
    const index = before.indexOf("experience");
    const successor = before[index + 1];

    fireEvent.click(moveControl("experience", "ArrowDown"));

    await waitFor(() => {
      const after = sectionOrder();
      expect(after[index]).toBe(successor);
      expect(after[index + 1]).toBe("experience");
    });
  });

  it("announces the move so it is not a silent, sighted-only action", async () => {
    render(() => <LayoutEditor />);

    await waitFor(() => {
      expect(document.querySelector('[data-section-id="experience"]')).toBeTruthy();
    });

    fireEvent.click(moveControl("experience", "ArrowDown"));

    await waitFor(() => {
      const liveRegion = document.querySelector('[aria-live="polite"]');
      expect(liveRegion?.textContent).toMatch(/experience moved to position \d+ of \d+/i);
    });
  });

  it("persists the new order to the store, unlike an in-progress keyboard drag", async () => {
    render(() => <LayoutEditor />);

    await waitFor(() => {
      expect(document.querySelector('[data-section-id="experience"]')).toBeTruthy();
    });

    const before = sectionOrder();
    const successor = before[before.indexOf("experience") + 1];

    fireEvent.click(moveControl("experience", "ArrowDown"));

    await waitFor(() => {
      const column = resumeStore.store.resume?.metadata.layout?.[0]?.[0] ?? [];
      expect(column.indexOf(successor)).toBeLessThan(column.indexOf("experience"));
    });
  });

  it("disables the controls that would move a section past a boundary", async () => {
    render(() => <LayoutEditor />);

    await waitFor(() => {
      expect(document.querySelector('[data-section-id="experience"]')).toBeTruthy();
    });

    const columns = resumeStore.store.resume?.metadata.layout?.[0] ?? [];
    expect(columns.length).toBeGreaterThan(1);

    const firstColumn = columns[0];
    const lastColumn = columns[columns.length - 1];

    expect(moveControl(firstColumn[0], "ArrowUp").disabled).toBe(true);
    expect(moveControl(firstColumn[firstColumn.length - 1], "ArrowDown").disabled).toBe(true);
    // Nothing sits left of the first column or right of the last one.
    expect(moveControl(firstColumn[0], "ArrowLeft").disabled).toBe(true);
    expect(moveControl(lastColumn[0], "ArrowRight").disabled).toBe(true);
    // ...but the inward direction stays available from both ends.
    expect(moveControl(firstColumn[0], "ArrowRight").disabled).toBe(false);
    expect(moveControl(lastColumn[0], "ArrowLeft").disabled).toBe(false);
  });
});
