import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { ShareModal } from "../ShareModal";
import { createDefaultResume } from "../../../wasm/defaults";

const { updateSharingMock, getCloudResumeMock, writeTextMock } = vi.hoisted(() => ({
  updateSharingMock: vi.fn(),
  getCloudResumeMock: vi.fn(),
  writeTextMock: vi.fn(),
}));

vi.mock("../../../api/sharing", () => ({
  updateSharing: updateSharingMock,
}));

vi.mock("../../../api/resumes", () => ({
  getCloudResume: getCloudResumeMock,
}));

vi.mock("../../../stores/ui", () => ({
  uiStore: {
    store: { modal: "share" },
    closeModal: vi.fn(),
  },
}));

vi.mock("../../../components/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../components/ui")>();
  return {
    ...actual,
    toast: {
      success: vi.fn(),
      error: vi.fn(),
    },
  };
});

Object.assign(navigator, {
  clipboard: {
    writeText: writeTextMock,
  },
});

function mockCloudRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "resume-1",
    title: "My Resume",
    updated_at: "2026-01-01T00:00:00Z",
    user_id: "user-1",
    data: createDefaultResume(),
    is_public: false,
    public_slug: null,
    version: 1,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("ShareModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCloudResumeMock.mockResolvedValue(mockCloudRow());
    updateSharingMock.mockResolvedValue({
      is_public: true,
      public_slug: "public-slug",
    });
    writeTextMock.mockResolvedValue(undefined);
  });

  it("calls updateSharing when publish toggle is enabled", async () => {
    render(() => <ShareModal resumeId="resume-1" />);

    await waitFor(() => {
      expect(screen.getByText("Publish to web")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("switch"));

    await waitFor(() => {
      expect(updateSharingMock).toHaveBeenCalledWith("resume-1", true);
    });
  });

  it("copies the public URL to the clipboard", async () => {
    getCloudResumeMock.mockResolvedValue(
      mockCloudRow({ is_public: true, public_slug: "public-slug" }),
    );

    render(() => <ShareModal resumeId="resume-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("http://localhost:3000/r/public-slug")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith("http://localhost:3000/r/public-slug");
    });
  });

  it("unpublishes via the Unpublish button", async () => {
    getCloudResumeMock.mockResolvedValue(
      mockCloudRow({ is_public: true, public_slug: "public-slug" }),
    );
    updateSharingMock.mockResolvedValue({
      is_public: false,
      public_slug: "public-slug",
    });

    render(() => <ShareModal resumeId="resume-1" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Unpublish" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Unpublish" }));

    await waitFor(() => {
      expect(updateSharingMock).toHaveBeenCalledWith("resume-1", false);
    });
  });
});
