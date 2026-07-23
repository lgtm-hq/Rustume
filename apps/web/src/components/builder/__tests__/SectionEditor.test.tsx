import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@solidjs/testing-library";
import { ExperienceEditor } from "../SectionEditor";
import { resumeStore } from "../../../stores/resume";

vi.mock("../../../wasm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../wasm")>();
  return {
    ...actual,
    saveResume: vi.fn().mockResolvedValue(undefined),
    isWasmReady: () => false,
  };
});

describe("SectionEditor keyboard reordering", () => {
  beforeEach(() => {
    localStorage.clear();
    resumeStore.createNewResume("section-editor-reorder-test");
    resumeStore.updateSectionItem("experience", 0, {
      position: "Engineer",
      company: "Acme",
    });
    resumeStore.addSectionItem("experience", {
      id: "exp-2",
      visible: true,
      company: "Beta",
      position: "Senior Engineer",
      location: "",
      date: "",
      summary: "",
      url: { label: "", href: "" },
    });
  });

  it("announces item reorder via the live region", async () => {
    render(() => <ExperienceEditor />);

    const moveDownButtons = screen.getAllByRole("button", { name: "Move down" });
    fireEvent.click(moveDownButtons[0]);

    await waitFor(() => {
      const liveRegion = document.querySelector('[aria-live="polite"]');
      expect(liveRegion?.textContent).toMatch(/Engineer moved to position 2 of \d+/);
    });
  });

  it("hides header move controls while an item is expanded", async () => {
    render(() => <ExperienceEditor />);

    fireEvent.click(screen.getByRole("button", { name: /Engineer.*Acme/i }));

    await waitFor(() => {
      const expandedItem = document.querySelector(
        ".border.border-border.rounded-lg.overflow-hidden",
      );
      expect(expandedItem).not.toBeNull();
      // Only the expanded-panel controls remain — header duplicates are unmounted.
      expect(
        within(expandedItem as HTMLElement).getAllByRole("button", { name: "Move down" }),
      ).toHaveLength(1);
      expect(
        within(expandedItem as HTMLElement).getAllByRole("button", { name: "Move up" }),
      ).toHaveLength(1);
    });
  });

  it("restores focus to the moved item reorder control", async () => {
    render(() => <ExperienceEditor />);

    const moveDown = screen.getAllByRole("button", { name: "Move down" })[0];
    moveDown.focus();
    fireEvent.click(moveDown);

    await waitFor(() => {
      const focused = document.activeElement as HTMLElement | null;
      expect(focused?.getAttribute("data-reorder")).toBe("experience-1-down");
      expect(focused?.getAttribute("aria-label")).toBe("Move down");
    });
  });
});
