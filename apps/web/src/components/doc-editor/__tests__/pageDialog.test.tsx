/**
 * Page settings (#859): the top-bar Page dialog exposes a margin control
 * that disables — with an accessible reason — when the active template is
 * full-bleed and ignores `page.margin`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@solidjs/testing-library";
import { loadDocEditorFixture } from "../../../test/docEditorFixture";
import { bundledTemplateLayout } from "../../../lib/docLayout";
import { PageDialog } from "../PageDialog";
import type { ResumeData } from "../../../wasm/types";

const store = vi.hoisted(() => ({
  store: { resume: null as unknown },
  updateMetadata: vi.fn(),
}));

vi.mock("../../../stores/resume", () => ({ resumeStore: store }));

const FULL_BLEED_REASON = "This template is full-bleed and does not use page margins";

describe("page dialog margin control", () => {
  let resume: ResumeData;

  beforeEach(() => {
    vi.clearAllMocks();
    resume = loadDocEditorFixture();
    resume.metadata.page.margin = 18;
    store.store.resume = resume;
  });

  function openDialog(templateId: string) {
    render(() => (
      <PageDialog
        resume={resume}
        templateLayout={bundledTemplateLayout(templateId)}
        open
        onOpenChange={vi.fn()}
      />
    ));
    return screen.getByTestId("page-dialog");
  }

  it("disables the margin control with an explanation on pikachu (full-bleed)", () => {
    const dialog = openDialog("pikachu");
    const input = within(dialog).getByRole("spinbutton", { name: "Page margin" });

    expect(input).toHaveAttribute("aria-disabled", "true");
    expect(within(dialog).getByText(FULL_BLEED_REASON)).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-describedby", "page-margin-full-bleed-reason");
    expect(document.getElementById("page-margin-full-bleed-reason")).toHaveTextContent(
      FULL_BLEED_REASON,
    );

    fireEvent.input(input, { target: { value: "32" } });
    expect(store.updateMetadata).not.toHaveBeenCalled();
  });

  it("enables the margin control on rhyhorn (margin-honoring)", () => {
    const dialog = openDialog("rhyhorn");
    const input = within(dialog).getByRole("spinbutton", { name: "Page margin" });

    expect(input).not.toHaveAttribute("aria-disabled");
    expect(within(dialog).queryByText(FULL_BLEED_REASON)).not.toBeInTheDocument();
    expect(input).toHaveAttribute("aria-describedby", "page-margin-hint");

    fireEvent.input(input, { target: { value: "32" } });
    expect(store.updateMetadata).toHaveBeenCalledExactlyOnceWith("page", {
      ...resume.metadata.page,
      margin: 32,
    });
  });
});
