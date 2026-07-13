import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@solidjs/testing-library";
import { Route, MemoryRouter, createMemoryHistory } from "@solidjs/router";
import PublicResume from "../PublicResume";
import { createDefaultResume } from "../../wasm/defaults";
import { ApiError } from "../../api/client";

const { fetchPublicResumeMock } = vi.hoisted(() => ({
  fetchPublicResumeMock: vi.fn(),
}));

vi.mock("../../api/sharing", () => ({
  fetchPublicResume: fetchPublicResumeMock,
}));

vi.mock("../../components/preview", () => ({
  Preview: (props: { resumeData?: { basics: { name: string } } }) => (
    <div data-testid="public-preview">{props.resumeData?.basics.name}</div>
  ),
}));

function renderPublicResume(slug = "public-slug") {
  const history = createMemoryHistory();
  history.set({ value: `/r/${slug}`, scroll: false, replace: true });

  return render(() => (
    <MemoryRouter history={history}>
      <Route path="/r/:slug" component={PublicResume} />
    </MemoryRouter>
  ));
}

describe("PublicResume page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders fetched resume data in the preview", async () => {
    const resume = createDefaultResume();
    resume.basics.name = "Ada Lovelace";

    fetchPublicResumeMock.mockResolvedValue({
      id: "resume-1",
      title: "Ada Lovelace",
      data: resume,
      updated_at: "2026-01-01T00:00:00Z",
    });

    renderPublicResume();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Ada Lovelace" })).toBeInTheDocument();
      expect(screen.getByTestId("public-preview")).toHaveTextContent("Ada Lovelace");
    });
  });

  it("shows not-found state on ApiError 404", async () => {
    fetchPublicResumeMock.mockRejectedValue(new ApiError(404, "Resume not found"));

    renderPublicResume("missing");

    await waitFor(() => {
      expect(screen.getByTestId("public-resume-not-found")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Resume not found" })).toBeInTheDocument();
    });
  });
});
