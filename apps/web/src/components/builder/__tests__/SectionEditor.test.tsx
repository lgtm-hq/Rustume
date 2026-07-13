import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
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
});
