import { describe, expect, it, vi, beforeEach } from "vitest";
import { axe } from "vitest-axe";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { axeConfig } from "../../test/a11y";
import { Route, Router } from "@solidjs/router";
import { HOME_LAYOUT_STORAGE_KEY, HomeLayout } from "../../lib/homeLayout";
import type { ResumeListItem } from "../../stores/persistence";
import Home from "../Home";

const { mockAuthState, signInMock } = vi.hoisted(() => ({
  mockAuthState: {
    loading: false,
    cloudEnabled: false,
    requireAuth: false,
    user: null as { id: string; plan: string } | null,
  },
  signInMock: vi.fn(),
}));

const mockResumes = vi.hoisted(() => {
  const resumes: ResumeListItem[] = [
    {
      id: "1",
      name: "Software Engineer",
      updatedAt: new Date("2025-01-01"),
      headline: "Staff Platform Engineer",
      tags: ["backend"],
    },
    { id: "2", name: "Product Manager", updatedAt: new Date("2025-02-01") },
    {
      id: "3",
      name: "Jane Doe — Designer",
      updatedAt: new Date("2025-03-01"),
      headline: "   ",
      tags: ["design", "backend"],
    },
  ];
  return resumes;
});

const patchResumeListMetaMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

const resumeListMock = vi.hoisted(() => ({
  resumes: () => mockResumes,
  loading: () => false,
  deleteResume: vi.fn(),
  duplicateResume: vi.fn(),
  renameResume: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("../../stores/auth", () => ({
  authStore: {
    get state() {
      return mockAuthState;
    },
    signIn: signInMock,
  },
}));

vi.mock("../../stores/persistence", () => ({
  useResumeList: () => resumeListMock,
  patchResumeListMeta: patchResumeListMetaMock,
}));

vi.mock("../../wasm/types", () => ({
  generateId: () => "resume-test-id",
}));

function renderHome() {
  return render(() => (
    <Router>
      <Route path="/" component={Home} />
    </Router>
  ));
}

const openModalMock = vi.hoisted(() => vi.fn());

vi.mock("../../stores/ui", () => ({
  uiStore: {
    store: { modal: null },
    openModal: openModalMock,
    closeModal: vi.fn(),
  },
}));

describe("Home resume search", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.removeItem(HOME_LAYOUT_STORAGE_KEY);
    openModalMock.mockClear();
    patchResumeListMetaMock.mockClear();
    resumeListMock.refresh.mockClear();
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = false;
    mockAuthState.requireAuth = false;
    mockAuthState.user = null;
  });

  it("offers create and import actions on the hero", () => {
    renderHome();

    expect(screen.getByTestId("home-create-resume")).toBeInTheDocument();
    expect(screen.getByTestId("home-import-resume")).toBeInTheDocument();
  });

  it("opens the import modal from the hero import button", () => {
    renderHome();

    fireEvent.click(screen.getByTestId("home-import-resume"));
    expect(openModalMock).toHaveBeenCalledWith("import");
  });

  it("shows a labeled search input when resumes exist", () => {
    renderHome();

    expect(screen.getByTestId("resume-search-input")).toBeInTheDocument();
    expect(screen.getByLabelText("Search resumes")).toBeInTheDocument();
  });

  it("shows headline as secondary text under the resume title", () => {
    renderHome();

    expect(screen.getByTestId("resume-list-headline")).toHaveTextContent(
      "Staff Platform Engineer",
    );
  });

  it("omits headline when it is missing or whitespace-only", () => {
    renderHome();

    // Only the first resume has a non-empty headline.
    expect(screen.getAllByTestId("resume-list-headline")).toHaveLength(1);
  });

  it("filters resumes as the user types", () => {
    renderHome();

    fireEvent.input(screen.getByTestId("resume-search-input"), {
      target: { value: "product" },
    });

    expect(screen.getByRole("heading", { name: /Product Manager/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Software Engineer/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Jane Doe/i })).not.toBeInTheDocument();
  });

  it("shows an empty state when no resumes match", () => {
    renderHome();

    fireEvent.input(screen.getByTestId("resume-search-input"), {
      target: { value: "zzzznotfound" },
    });

    expect(screen.getByTestId("resume-search-empty")).toBeInTheDocument();
    expect(screen.getByText(/No matching resumes/i)).toBeInTheDocument();
  });

  it("persists the search query in sessionStorage", () => {
    renderHome();

    fireEvent.input(screen.getByTestId("resume-search-input"), {
      target: { value: "jane" },
    });

    expect(sessionStorage.getItem("rustume:home-resume-search")).toBe("jane");
  });
});

describe("Home resume tags", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.removeItem(HOME_LAYOUT_STORAGE_KEY);
    patchResumeListMetaMock.mockClear();
    resumeListMock.refresh.mockClear();
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = false;
    mockAuthState.requireAuth = false;
    mockAuthState.user = null;
  });

  it("shows tag filter chips and keeps tags below card meta", () => {
    renderHome();

    expect(screen.getByTestId("resume-tag-filters")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "backend" })).toBeInTheDocument();

    const cards = screen.getAllByTestId("resume-card");
    const firstCardTags = cards[0].querySelector('[data-testid="resume-card-tags"]');
    expect(firstCardTags).toBeTruthy();
    expect(firstCardTags?.textContent).toContain("backend");
    expect(firstCardTags?.textContent).toContain("+ Tag");
    // Compact control by default — no always-visible hollow input.
    expect(screen.queryByTestId("resume-tag-input")).not.toBeInTheDocument();
  });

  it("filters resumes when a tag chip is selected", () => {
    renderHome();

    fireEvent.click(screen.getByRole("button", { name: "design" }));

    expect(screen.getByRole("heading", { name: /Jane Doe/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Software Engineer/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Product Manager/i })).not.toBeInTheDocument();
  });

  it("expands + Tag into an input and adds a tag on submit", async () => {
    renderHome();

    fireEvent.click(screen.getByLabelText("Add tag to Software Engineer"));

    const input = await screen.findByTestId("resume-tag-input");
    fireEvent.input(input, { target: { value: "remote" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(patchResumeListMetaMock).toHaveBeenCalledWith("1", {
        tags: ["backend", "remote"],
      });
    });
    // List refresh is driven by rustume:resumes-changed inside patchResumeListMeta,
    // not a redundant Home refresh() that blanked the list.
    expect(resumeListMock.refresh).not.toHaveBeenCalled();
  });

  it("removes a tag from a resume card", async () => {
    renderHome();

    fireEvent.click(screen.getByLabelText("Remove tag backend from Software Engineer"));

    await waitFor(() => {
      expect(patchResumeListMetaMock).toHaveBeenCalledWith("1", { tags: [] });
    });
    expect(resumeListMock.refresh).not.toHaveBeenCalled();
  });

  it("keeps lock and rename actions available beside the tags row", () => {
    renderHome();

    expect(screen.getAllByLabelText("Lock resume").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Rename resume").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Delete resume").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Duplicate resume").length).toBeGreaterThan(0);
  });
});

describe("Home layout toggle", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.removeItem(HOME_LAYOUT_STORAGE_KEY);
    openModalMock.mockClear();
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = false;
    mockAuthState.requireAuth = false;
    mockAuthState.user = null;
  });

  it("defaults to list layout", () => {
    renderHome();

    expect(screen.getByTestId("home-view")).toBeInTheDocument();
    expect(screen.getByTestId("home-resume-list")).toBeInTheDocument();
    expect(screen.queryByTestId("home-resume-grid")).not.toBeInTheDocument();
    expect(screen.getByTestId("home-layout-list")).toHaveAttribute("aria-pressed", "true");
  });

  it("switches to grid layout and renders resumes with the same actions", () => {
    renderHome();

    fireEvent.click(screen.getByTestId("home-layout-grid"));

    expect(screen.getByTestId("home-view")).toBeInTheDocument();
    expect(screen.getByTestId("home-resume-grid")).toBeInTheDocument();
    expect(screen.queryByTestId("home-resume-list")).not.toBeInTheDocument();
    expect(screen.getByTestId("home-layout-grid")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: /Software Engineer/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Product Manager/i })).toBeInTheDocument();
    expect(screen.getAllByTestId("resume-card")).toHaveLength(3);
    expect(screen.getAllByTestId("resume-card-preview")).toHaveLength(3);
    expect(screen.getAllByLabelText("Lock resume").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Rename resume").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Delete resume").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Duplicate resume").length).toBeGreaterThan(0);
  });

  it("keeps list rows without document previews", () => {
    renderHome();

    expect(screen.getByTestId("home-resume-list")).toBeInTheDocument();
    expect(screen.queryByTestId("resume-card-preview")).not.toBeInTheDocument();
  });

  it("persists the layout preference in localStorage", () => {
    renderHome();

    fireEvent.click(screen.getByTestId("home-layout-grid"));

    expect(localStorage.getItem(HOME_LAYOUT_STORAGE_KEY)).toBe(HomeLayout.Grid);
  });

  it("restores grid layout from localStorage", () => {
    localStorage.setItem(HOME_LAYOUT_STORAGE_KEY, HomeLayout.Grid);

    renderHome();

    expect(screen.getByTestId("home-resume-grid")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Software Engineer/i })).toBeInTheDocument();
  });

  it("migrates legacy workspace preference to grid", () => {
    localStorage.setItem(HOME_LAYOUT_STORAGE_KEY, "workspace");

    renderHome();

    expect(screen.getByTestId("home-resume-grid")).toBeInTheDocument();
    expect(localStorage.getItem(HOME_LAYOUT_STORAGE_KEY)).toBe(HomeLayout.Grid);
  });

  it("keeps create and import actions in grid", () => {
    localStorage.setItem(HOME_LAYOUT_STORAGE_KEY, HomeLayout.Grid);
    renderHome();

    expect(screen.getByTestId("home-create-resume")).toBeInTheDocument();
    expect(screen.getByTestId("home-import-resume")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("home-import-resume"));
    expect(openModalMock).toHaveBeenCalledWith("import");
  });

  it("keeps shared chrome identical when toggling list and grid", () => {
    renderHome();

    expect(screen.getByRole("heading", { name: /Build your resume/i })).toBeInTheDocument();
    expect(screen.getByTestId("resume-search-input")).toBeInTheDocument();
    expect(screen.getByTestId("resume-sort-select")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("home-layout-grid"));

    expect(screen.getByRole("heading", { name: /Build your resume/i })).toBeInTheDocument();
    expect(screen.getByTestId("resume-search-input")).toBeInTheDocument();
    expect(screen.getByTestId("resume-sort-select")).toBeInTheDocument();
    expect(screen.getByTestId("home-create-resume")).toBeInTheDocument();
  });

  it("spans library chrome full content width with tools pushed right", () => {
    renderHome();

    const library = screen.getByTestId("home-library");
    const toolbar = screen.getByTestId("resume-library-toolbar");
    const tools = screen.getByTestId("resume-library-tools");
    const tags = screen.getByTestId("resume-tag-filters");
    const list = screen.getByTestId("home-resume-list");

    expect(library).toContainElement(toolbar);
    expect(library).toContainElement(tags);
    expect(library).toContainElement(list);
    expect(toolbar.className).toMatch(/justify-between/);
    expect(toolbar.className).toMatch(/\bw-full\b/);
    expect(tools.className).toMatch(/ml-auto/);
    expect(tags.className).toMatch(/\bw-full\b/);
    expect(list.className).toMatch(/\bw-full\b/);

    fireEvent.click(screen.getByTestId("home-layout-grid"));

    const grid = screen.getByTestId("home-resume-grid");
    expect(library).toContainElement(grid);
    expect(grid.className).toMatch(/\bw-full\b/);
    expect(screen.getByTestId("resume-library-toolbar")).toBeInTheDocument();
    expect(screen.getByTestId("resume-library-tools")).toBeInTheDocument();
  });
});

describe("Home accessibility", () => {
  it("has no axe violations when rendered", async () => {
    localStorage.removeItem(HOME_LAYOUT_STORAGE_KEY);
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = false;
    mockAuthState.user = null;

    const { container } = renderHome();

    expect(await axe(container, axeConfig)).toHaveNoViolations();
  });

  it("has no axe violations in grid layout", async () => {
    localStorage.setItem(HOME_LAYOUT_STORAGE_KEY, HomeLayout.Grid);
    mockAuthState.loading = false;
    mockAuthState.cloudEnabled = false;
    mockAuthState.user = null;

    const { container } = renderHome();

    expect(await axe(container, axeConfig)).toHaveNoViolations();
  });
});
