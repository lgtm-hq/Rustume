import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@solidjs/testing-library";
import { Preview } from "../Preview";
import { createDefaultResume } from "../../../wasm/defaults";
import { uiStore } from "../../../stores/ui";

const { renderPreviewMock } = vi.hoisted(() => ({
  renderPreviewMock: vi.fn(),
}));

vi.mock("../../../api/render", () => ({
  renderPreview: renderPreviewMock,
}));

vi.mock("../../../hooks/useOnline", () => ({
  useOnline: () => () => true,
}));

vi.mock("../../../hooks/useDebounce", () => ({
  useDebounce: <T,>(getter: () => T) => getter,
}));

describe("Preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uiStore.setPreviewPage(3);
    renderPreviewMock.mockResolvedValue({
      url: "blob:preview",
      totalPages: 1,
    });
  });

  it("requests page 0 for standalone public resume data", async () => {
    const resume = createDefaultResume();

    render(() => <Preview resumeData={resume} />);

    await waitFor(() => {
      expect(renderPreviewMock).toHaveBeenCalled();
    });

    expect(renderPreviewMock.mock.calls[0]?.[1]).toBe(0);
  });
});
