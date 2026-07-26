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

describe("LayoutEditor keyboard reordering", () => {
  beforeEach(() => {
    localStorage.clear();
    resumeStore.createNewResume("layout-keyboard-test");
  });

  it("moves a section with keyboard and updates the live region", async () => {
    render(() => <LayoutEditor />);

    await waitFor(() => {
      expect(document.querySelector('[data-section-id="experience"]')).toBeTruthy();
    });

    const experience = document.querySelector('[data-section-id="experience"]') as HTMLElement;
    experience.focus();
    fireEvent.keyDown(experience, { key: " " });

    await waitFor(() => {
      const liveRegion = document.querySelector('[aria-live="polite"]');
      expect(liveRegion?.textContent).toMatch(/picked up experience/i);
    });

    fireEvent.keyDown(experience, { key: "ArrowDown" });

    await waitFor(() => {
      const liveRegion = document.querySelector('[aria-live="polite"]');
      expect(liveRegion?.textContent).toMatch(/experience moved to position \d+ of \d+/i);
    });
  });
});
