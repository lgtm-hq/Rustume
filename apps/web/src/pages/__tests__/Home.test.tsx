import { describe, expect, it, vi, beforeEach } from "vitest";
import { axe } from "vitest-axe";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { axeConfig } from "../../test/a11y";
import { Route, Router } from "@solidjs/router";
import { HOME_LAYOUT_STORAGE_KEY, HomeLayout } from "../../lib/homeLayout";
import { HOME_SIDEBAR_STORAGE_KEY, HomeSidebarState } from "../../lib/homeSidebar";
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
    { id: "2", name: "Product Manager", updatedAt: new Date("2025-02-01"), locked: true },
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

/** Mutable list state so tests can exercise the empty-library state. */
const listState = vi.hoisted(() => ({ items: undefined as ResumeListItem[] | undefined }));

const patchResumeListMetaMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

const resumeListMock = vi.hoisted(() => ({
  resumes: () => listState.items,
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

/** Pretend the viewport is below the 900px breakpoint, where the rail is a drawer. */
function stubNarrowViewport() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(max-width: 899px)",
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }));
}

function resetHomeState() {
  vi.unstubAllGlobals();
  sessionStorage.clear();
  localStorage.removeItem(HOME_LAYOUT_STORAGE_KEY);
  localStorage.removeItem(HOME_SIDEBAR_STORAGE_KEY);
  listState.items = mockResumes;
  openModalMock.mockClear();
  patchResumeListMetaMock.mockClear();
  resumeListMock.refresh.mockClear();
  mockAuthState.loading = false;
  mockAuthState.cloudEnabled = false;
  mockAuthState.requireAuth = false;
  mockAuthState.user = null;
}

describe("Home command shell", () => {
  beforeEach(resetHomeState);

  it("drops the hero and the marketing footer", () => {
    renderHome();

    expect(screen.queryByRole("heading", { name: /Build your resume/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Why Rustume/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Privacy First/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Lightning Fast/i)).not.toBeInTheDocument();
  });

  it("keeps create and import actions in the library toolbar", () => {
    renderHome();

    const toolbar = screen.getByTestId("resume-library-toolbar");
    expect(toolbar).toContainElement(screen.getByTestId("home-create-resume"));
    expect(toolbar).toContainElement(screen.getByTestId("home-import-resume"));

    fireEvent.click(screen.getByTestId("home-import-resume"));
    expect(openModalMock).toHaveBeenCalledWith("import");
  });

  it("reports live library status in the status strip", () => {
    renderHome();

    const strip = screen.getByTestId("home-status-strip");
    expect(strip).toHaveTextContent("3 resumes");
    expect(strip).toHaveTextContent("last edit");
    expect(strip).toHaveTextContent("on-device storage");
    expect(strip).toHaveTextContent("sync off");
  });

  it("reports cloud storage and sync on for a signed-in cloud user", () => {
    mockAuthState.cloudEnabled = true;
    mockAuthState.user = { id: "u1", plan: "free" };

    renderHome();

    const strip = screen.getByTestId("home-status-strip");
    expect(strip).toHaveTextContent("sync on");
    // Storage must not claim on-device while resumes persist to the cloud.
    expect(screen.getByTestId("home-status-storage")).toHaveTextContent("cloud storage");
    expect(strip).not.toHaveTextContent("on-device");
  });

  it("does not promise on-device storage in the empty state for cloud users", () => {
    listState.items = [];
    mockAuthState.cloudEnabled = true;
    mockAuthState.user = { id: "u1", plan: "free" };

    renderHome();

    const empty = screen.getByTestId("home-empty-state");
    expect(empty).toHaveTextContent(/syncs to your Rustume Cloud account/);
    expect(empty).not.toHaveTextContent(/stays on this device/);
  });

  it("tracks the active view and scope in the status strip", () => {
    renderHome();

    expect(screen.getByTestId("home-status-view")).toHaveTextContent("view: grid · scope: all");

    fireEvent.click(screen.getByTestId("home-layout-gallery"));

    expect(screen.getByTestId("home-status-view")).toHaveTextContent("view: gallery · scope: all");
  });

  it("offers a live sidebar toggle in the library toolbar", () => {
    renderHome();

    const toggle = screen.getByTestId("home-sidebar-toggle");
    expect(toggle).toBeEnabled();
    expect(toggle).toHaveAttribute("aria-controls", "home-scope-rail");
  });
});

describe("Home command palette wiring", () => {
  beforeEach(resetHomeState);

  it("opens the command palette on the global shortcut", () => {
    renderHome();

    fireEvent.keyDown(document, { key: "k", ctrlKey: true });

    expect(openModalMock).toHaveBeenCalledWith("commandPalette");
  });

  it("switches views from the number shortcuts", () => {
    renderHome();

    fireEvent.keyDown(document, { key: "3" });
    expect(screen.getByTestId("home-resume-gallery")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "1" });
    expect(screen.getByTestId("home-resume-list")).toBeInTheDocument();
  });

  it("creates and imports from the letter shortcuts", () => {
    renderHome();

    fireEvent.keyDown(document, { key: "i" });
    expect(openModalMock).toHaveBeenCalledWith("import");

    fireEvent.keyDown(document, { key: "s" });
    expect(resumeListMock.refresh).toHaveBeenCalled();
  });
});

describe("Home resume search", () => {
  beforeEach(resetHomeState);

  it("shows a labeled search input when resumes exist", () => {
    renderHome();

    expect(screen.getByTestId("resume-search-input")).toBeInTheDocument();
    expect(screen.getByLabelText("Search resumes")).toBeInTheDocument();
  });

  it("shows headline as secondary text under the resume title", () => {
    renderHome();

    expect(screen.getByTestId("resume-list-headline")).toHaveTextContent("Staff Platform Engineer");
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

  it("shows a designed empty state when no resumes match", () => {
    renderHome();

    fireEvent.input(screen.getByTestId("resume-search-input"), {
      target: { value: "zzzznotfound" },
    });

    expect(screen.getByTestId("resume-search-empty")).toBeInTheDocument();
    expect(screen.getByText(/No matching resumes/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(screen.queryByTestId("resume-search-empty")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("resume-card")).toHaveLength(3);
  });

  it("prompts to create or import when the library is empty", () => {
    listState.items = [];

    renderHome();

    expect(screen.getByTestId("home-empty-state")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Resume" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Import Resume" }));
    expect(openModalMock).toHaveBeenCalledWith("import");
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
  beforeEach(resetHomeState);

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

describe("Home locked resumes", () => {
  beforeEach(resetHomeState);

  it("offers unlock and gates destructive actions while locked", () => {
    renderHome();

    const unlock = screen.getByLabelText("Unlock resume");
    expect(unlock).toBeInTheDocument();
    expect(unlock.className).toMatch(/text-gold/);

    const lockedCard = unlock.closest('[data-testid="resume-card"]')!;
    expect(lockedCard.querySelector('[aria-label="Delete resume"]')).toBeDisabled();
    expect(lockedCard.querySelector('[aria-label="Rename resume"]')).toBeDisabled();
    expect(lockedCard.querySelector('[data-testid="resume-tag-add"]')).toBeDisabled();
  });

  it("badges locked resumes with a gold marker in gallery", () => {
    localStorage.setItem(HOME_LAYOUT_STORAGE_KEY, HomeLayout.Gallery);

    renderHome();

    const badges = screen.getAllByTitle("Locked");
    expect(badges).toHaveLength(1);
    expect(badges[0].className).toMatch(/text-gold/);
  });
});

describe("Home layout switcher", () => {
  beforeEach(resetHomeState);

  it("defaults to grid layout with designed document previews", () => {
    renderHome();

    expect(screen.getByTestId("home-view")).toBeInTheDocument();
    expect(screen.getByTestId("home-resume-grid")).toBeInTheDocument();
    expect(screen.queryByTestId("home-resume-list")).not.toBeInTheDocument();
    expect(screen.getByTestId("home-layout-grid")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByTestId("resume-card-preview")).toHaveLength(3);
  });

  it("offers list, grid and gallery in one switcher", () => {
    renderHome();

    const switcher = screen.getByTestId("home-layout-toggle");
    expect(switcher).toContainElement(screen.getByTestId("home-layout-list"));
    expect(switcher).toContainElement(screen.getByTestId("home-layout-grid"));
    expect(switcher).toContainElement(screen.getByTestId("home-layout-gallery"));
  });

  it("switches to list layout and keeps the row anatomy without previews", () => {
    renderHome();

    fireEvent.click(screen.getByTestId("home-layout-list"));

    expect(screen.getByTestId("home-resume-list")).toBeInTheDocument();
    expect(screen.queryByTestId("home-resume-grid")).not.toBeInTheDocument();
    expect(screen.getByTestId("home-layout-list")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByTestId("resume-card-preview")).not.toBeInTheDocument();
    expect(screen.getAllByText(/^Updated /)).toHaveLength(3);
    expect(screen.getAllByTestId("resume-tag-add").length).toBeGreaterThan(0);
  });

  it("switches to gallery layout with the same card actions", () => {
    renderHome();

    fireEvent.click(screen.getByTestId("home-layout-gallery"));

    expect(screen.getByTestId("home-resume-gallery")).toBeInTheDocument();
    expect(screen.queryByTestId("home-resume-grid")).not.toBeInTheDocument();
    expect(screen.getByTestId("home-layout-gallery")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByTestId("resume-card-preview")).toHaveLength(3);
    expect(screen.getAllByLabelText("Rename resume").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Delete resume").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Duplicate resume").length).toBeGreaterThan(0);
  });

  it("renders the same scoped library in all three views", () => {
    renderHome();

    fireEvent.click(screen.getByRole("button", { name: "backend" }));

    for (const view of ["home-layout-list", "home-layout-grid", "home-layout-gallery"]) {
      fireEvent.click(screen.getByTestId(view));

      expect(screen.getAllByTestId("resume-card")).toHaveLength(2);
      expect(screen.getByRole("heading", { name: /Software Engineer/i })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /Jane Doe/i })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: /Product Manager/i })).not.toBeInTheDocument();
    }
  });

  it("persists the layout preference in localStorage", () => {
    renderHome();

    fireEvent.click(screen.getByTestId("home-layout-gallery"));

    expect(localStorage.getItem(HOME_LAYOUT_STORAGE_KEY)).toBe(HomeLayout.Gallery);
  });

  it("restores the stored layout", () => {
    localStorage.setItem(HOME_LAYOUT_STORAGE_KEY, HomeLayout.List);

    renderHome();

    expect(screen.getByTestId("home-resume-list")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Software Engineer/i })).toBeInTheDocument();
  });

  it("migrates legacy layout preferences", () => {
    localStorage.setItem(HOME_LAYOUT_STORAGE_KEY, "classic");

    renderHome();

    expect(screen.getByTestId("home-resume-list")).toBeInTheDocument();
    expect(localStorage.getItem(HOME_LAYOUT_STORAGE_KEY)).toBe(HomeLayout.List);
  });

  it("falls back to grid for unknown stored layouts", () => {
    localStorage.setItem(HOME_LAYOUT_STORAGE_KEY, "mosaic");

    renderHome();

    expect(screen.getByTestId("home-resume-grid")).toBeInTheDocument();
  });

  it("keeps shared chrome identical across views", () => {
    renderHome();

    for (const view of ["home-layout-list", "home-layout-gallery", "home-layout-grid"]) {
      fireEvent.click(screen.getByTestId(view));

      expect(screen.getByTestId("home-status-strip")).toBeInTheDocument();
      expect(screen.getByTestId("resume-search-input")).toBeInTheDocument();
      expect(screen.getByTestId("resume-sort-select")).toBeInTheDocument();
      expect(screen.getByTestId("resume-tag-filters")).toBeInTheDocument();
      expect(screen.getByTestId("home-create-resume")).toBeInTheDocument();
    }
  });

  it("spans library chrome full content width with tools pushed right", () => {
    renderHome();

    const library = screen.getByTestId("home-library");
    const toolbar = screen.getByTestId("resume-library-toolbar");
    const tools = screen.getByTestId("resume-library-tools");
    const tags = screen.getByTestId("resume-tag-filters");
    const grid = screen.getByTestId("home-resume-grid");

    expect(library).toContainElement(toolbar);
    expect(library).toContainElement(tags);
    expect(library).toContainElement(grid);
    expect(toolbar.className).toMatch(/justify-between/);
    expect(toolbar.className).toMatch(/\bw-full\b/);
    expect(tools.className).toMatch(/ml-auto/);
    expect(tags.className).toMatch(/\bw-full\b/);
    expect(grid.className).toMatch(/\bw-full\b/);

    fireEvent.click(screen.getByTestId("home-layout-list"));

    const list = screen.getByTestId("home-resume-list");
    expect(library).toContainElement(list);
    expect(list.className).toMatch(/\bw-full\b/);
    expect(screen.getByTestId("resume-library-toolbar")).toBeInTheDocument();
    expect(screen.getByTestId("resume-library-tools")).toBeInTheDocument();
  });
});

describe("Home scope sidebar", () => {
  beforeEach(resetHomeState);

  function openRail() {
    fireEvent.click(screen.getByTestId("home-sidebar-toggle"));
    return screen.getByTestId("home-scope-rail");
  }

  it("stays collapsed until a toggle asks for it", () => {
    renderHome();

    expect(screen.queryByTestId("home-scope-rail")).not.toBeInTheDocument();
    expect(screen.getByTestId("home-sidebar-toggle")).toHaveAttribute("aria-pressed", "false");
  });

  it("opens and closes from the toolbar toggle", () => {
    renderHome();

    expect(openRail()).toBeInTheDocument();
    expect(screen.getByTestId("home-sidebar-toggle")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("home-sidebar-toggle")).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByTestId("home-sidebar-toggle"));

    expect(screen.queryByTestId("home-scope-rail")).not.toBeInTheDocument();
  });

  it("toggles the rail from the mod+B hotkey", () => {
    renderHome();

    fireEvent.keyDown(document, { key: "b", ctrlKey: true });
    expect(screen.getByTestId("home-scope-rail")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "b", ctrlKey: true });
    expect(screen.queryByTestId("home-scope-rail")).not.toBeInTheDocument();
  });

  it("persists the open state across mounts", () => {
    const { unmount } = renderHome();

    openRail();
    expect(localStorage.getItem(HOME_SIDEBAR_STORAGE_KEY)).toBe(HomeSidebarState.Open);

    unmount();
    renderHome();

    expect(screen.getByTestId("home-scope-rail")).toBeInTheDocument();
  });

  it("resets the scope on remount so a stale filter never greets the user", () => {
    const { unmount } = renderHome();

    openRail();
    fireEvent.click(screen.getByTestId("home-scope-locked"));
    expect(screen.getByTestId("home-status-view")).toHaveTextContent("scope: locked");

    unmount();
    renderHome();

    expect(screen.getByTestId("home-status-view")).toHaveTextContent("scope: all");
    expect(screen.getAllByTestId("resume-card")).toHaveLength(3);
  });

  it("narrows the library to locked resumes and reports it in the status strip", () => {
    renderHome();

    openRail();
    fireEvent.click(screen.getByTestId("home-scope-locked"));

    expect(screen.getAllByTestId("resume-card")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: /Product Manager/i })).toBeInTheDocument();
    expect(screen.getByTestId("home-status-view")).toHaveTextContent("scope: locked");
  });

  it("clears back to all resumes when the active scope is selected again", () => {
    renderHome();

    openRail();
    fireEvent.click(screen.getByTestId("home-scope-locked"));
    fireEvent.click(screen.getByTestId("home-scope-locked"));

    expect(screen.getAllByTestId("resume-card")).toHaveLength(3);
    expect(screen.getByTestId("home-status-view")).toHaveTextContent("scope: all");
  });

  it("counts each scope from the unfiltered library", () => {
    renderHome();

    openRail();
    fireEvent.click(screen.getByTestId("home-scope-tag-design"));

    // One resume matches, but the rail still measures the whole library.
    expect(screen.getAllByTestId("resume-card")).toHaveLength(1);
    expect(screen.getByTestId("home-scope-all")).toHaveTextContent("3");
    expect(screen.getByTestId("home-scope-locked")).toHaveTextContent("1");
    expect(screen.getByTestId("home-scope-tag-backend")).toHaveTextContent("2");
    expect(screen.getByTestId("home-scope-tag-design")).toHaveTextContent("1");
  });

  it("keeps the rail and the chip row on one scope signal", () => {
    renderHome();

    openRail();

    // Rail selection presses the matching chip.
    fireEvent.click(screen.getByTestId("home-scope-tag-backend"));
    expect(screen.getByRole("button", { name: "backend" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("home-scope-tag-backend")).toHaveAttribute("aria-pressed", "true");

    // And the reverse: chip selection marks the matching rail row.
    fireEvent.click(screen.getByRole("button", { name: "design" }));
    expect(screen.getByTestId("home-scope-tag-design")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("home-scope-tag-backend")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "backend" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    // Clearing from the chip row clears the rail too.
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getByTestId("home-scope-all")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("home-scope-tag-design")).toHaveAttribute("aria-pressed", "false");
  });

  it("scopes list, grid and gallery to the same set", () => {
    renderHome();

    openRail();
    fireEvent.click(screen.getByTestId("home-scope-tag-backend"));

    for (const view of ["home-layout-list", "home-layout-grid", "home-layout-gallery"]) {
      fireEvent.click(screen.getByTestId(view));

      expect(screen.getAllByTestId("resume-card")).toHaveLength(2);
      expect(screen.queryByRole("heading", { name: /Product Manager/i })).not.toBeInTheDocument();
    }
  });

  it("pushes the library beside the rail instead of covering it", () => {
    renderHome();

    const rail = openRail();
    const library = screen.getByTestId("home-library");

    // Siblings in one row: opening the rail narrows the library column.
    expect(rail.parentElement).toBe(library.parentElement);
    expect(rail.className).toMatch(/min-\[900px\]:w-\[228px\]/);
    expect(library.className).toMatch(/flex-1/);
  });

  it("reports cloud storage in the rail footer for a signed-in cloud user", () => {
    mockAuthState.cloudEnabled = true;
    mockAuthState.user = { id: "u1", plan: "free" };

    renderHome();
    openRail();

    const storage = screen.getByTestId("home-scope-rail-storage");
    expect(storage).toHaveTextContent("cloud");
    expect(storage).not.toHaveTextContent("on-device");
  });

  it("closes the narrow-viewport drawer on selection without losing the preference", () => {
    stubNarrowViewport();
    renderHome();

    openRail();
    expect(localStorage.getItem(HOME_SIDEBAR_STORAGE_KEY)).toBe(HomeSidebarState.Open);

    fireEvent.click(screen.getByTestId("home-scope-locked"));

    expect(screen.queryByTestId("home-scope-rail")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("resume-card")).toHaveLength(1);
    // The auto-close is incidental — the stored preference must survive it.
    expect(localStorage.getItem(HOME_SIDEBAR_STORAGE_KEY)).toBe(HomeSidebarState.Open);
  });

  it("dismisses the narrow-viewport drawer on Escape", () => {
    stubNarrowViewport();
    renderHome();

    openRail();
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByTestId("home-scope-rail")).not.toBeInTheDocument();
    expect(localStorage.getItem(HOME_SIDEBAR_STORAGE_KEY)).toBe(HomeSidebarState.Collapsed);
  });

  it("takes the covered library out of the tab order behind the drawer", () => {
    stubNarrowViewport();
    renderHome();

    openRail();

    const library = screen.getByTestId("home-library");
    expect(library).toHaveAttribute("inert");
    expect(library).toHaveAttribute("aria-hidden", "true");
  });

  it("leaves the library reachable when the rail is a column", () => {
    renderHome();

    openRail();

    const library = screen.getByTestId("home-library");
    expect(library).not.toHaveAttribute("inert");
    expect(library).not.toHaveAttribute("aria-hidden");
  });

  it("reports on-device storage in the rail footer without a cloud session", () => {
    renderHome();
    openRail();

    expect(screen.getByTestId("home-scope-rail-storage")).toHaveTextContent("on-device");
  });
});

describe("Home accessibility", () => {
  beforeEach(resetHomeState);

  it("has no axe violations in grid layout", async () => {
    const { container } = renderHome();

    expect(await axe(container, axeConfig)).toHaveNoViolations();
  });

  it("has no axe violations in list layout", async () => {
    localStorage.setItem(HOME_LAYOUT_STORAGE_KEY, HomeLayout.List);

    const { container } = renderHome();

    expect(await axe(container, axeConfig)).toHaveNoViolations();
  });

  it("has no axe violations in gallery layout", async () => {
    localStorage.setItem(HOME_LAYOUT_STORAGE_KEY, HomeLayout.Gallery);

    const { container } = renderHome();

    expect(await axe(container, axeConfig)).toHaveNoViolations();
  });

  it("has no axe violations with the scope rail open", async () => {
    localStorage.setItem(HOME_SIDEBAR_STORAGE_KEY, HomeSidebarState.Open);

    const { container } = renderHome();

    expect(screen.getByTestId("home-scope-rail")).toBeInTheDocument();
    expect(await axe(container, axeConfig)).toHaveNoViolations();
  });
});
