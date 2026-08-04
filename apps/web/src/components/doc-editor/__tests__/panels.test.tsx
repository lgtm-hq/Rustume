/**
 * The registry-backed chrome of #731: the templates drawer and sections panel.
 *
 * Cards are asserted against a mocked `GET /api/templates` response — one card
 * per template, layout metadata included — and every control must route to
 * exactly the right store action, one action per operation, with a template
 * switch landing template and layout as a single combined write.
 */

import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@solidjs/testing-library";
import { loadDocEditorFixture } from "../../../test/docEditorFixture";
import { SectionsPanel } from "../SectionsPanel";
import { TemplatesDrawer } from "../TemplatesDrawer";
import type { ResumeData, TemplateInfo } from "../../../wasm/types";

const store = vi.hoisted(() => ({
  store: { resume: null as unknown },
  applyTemplate: vi.fn(),
  toggleSectionVisibility: vi.fn(),
  updateCustomSection: vi.fn(),
  addCustomSection: vi.fn(() => "custom-1"),
  removeCustomSection: vi.fn(),
  updateMetadata: vi.fn(),
  updateLayout: vi.fn(),
}));

vi.mock("../../../stores/resume", () => ({ resumeStore: store }));

const TEMPLATES: TemplateInfo[] = [
  {
    id: "aurora",
    name: "Aurora",
    theme: { background: "#ffffff", text: "#1c1917", primary: "#7c3aed" },
    layout: {
      layoutMode: "sidebar-left",
      defaultColumns: [
        ["summary", "experience", "education", "projects"],
        ["profiles", "skills", "languages", "interests"],
      ],
      headerStyle: "sidebar",
      contactIn: "sidebar",
      sidebarWidth: 180,
    },
  },
  {
    // An older self-hosted server: no layout block on the wire at all.
    id: "plainstone",
    name: "Plainstone",
    theme: { background: "#fafaf9", text: "#0c0a09", primary: "#0d9488" },
  },
];

const api = vi.hoisted(() => ({
  fetchTemplates: vi.fn(),
  getTemplateThumbnailUrl: vi.fn((id: string) => `/api/templates/${id}/thumbnail`),
}));

vi.mock("../../../api/render", () => api);

/** Total writes recorded across every mocked store action. */
function writeCount(): number {
  return Object.entries(store)
    .filter(([key]) => key !== "store")
    .reduce((total, [, action]) => total + (action as Mock).mock.calls.length, 0);
}

describe("document editor panels", () => {
  let resume: ResumeData;

  beforeEach(() => {
    vi.clearAllMocks();
    api.fetchTemplates.mockResolvedValue(TEMPLATES);
    resume = loadDocEditorFixture();
    store.store.resume = resume;
  });

  describe("templates drawer", () => {
    async function openDrawer() {
      render(() => <TemplatesDrawer resume={resume} />);
      fireEvent.click(screen.getByRole("button", { name: "Templates" }));
      await waitFor(() => expect(screen.getByTestId("templates-drawer-list")).toBeInTheDocument());
    }

    it("renders one card per template from the registry, layout metadata included", async () => {
      await openDrawer();

      const list = screen.getByTestId("templates-drawer-list");
      const cards = within(list).getAllByRole("button");
      expect(cards).toHaveLength(2);
      expect(within(list).getByRole("button", { name: "Use Aurora template" })).toBeInTheDocument();
      // The layout block renders as card metadata — sidebar width is in points.
      expect(list.textContent).toContain("Left sidebar · 180pt sidebar");
      // Thumbnails come from the server endpoint, per template.
      expect(api.getTemplateThumbnailUrl).toHaveBeenCalledWith("aurora");
      expect(api.getTemplateThumbnailUrl).toHaveBeenCalledWith("plainstone");
    });

    it("marks the resume's current template", async () => {
      resume.metadata.template = "aurora";
      await openDrawer();

      const current = screen.getByRole("button", { name: "Use Aurora template" });
      expect(current).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: "Use Plainstone template" })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    });

    it("switches template and layout through one combined store action", async () => {
      await openDrawer();

      fireEvent.click(screen.getByRole("button", { name: "Use Aurora template" }));

      expect(store.applyTemplate).toHaveBeenCalledOnce();
      expect(writeCount()).toBe(1);
      const [templateId, layout] = store.applyTemplate.mock.calls[0] as [string, string[][][]];
      expect(templateId).toBe("aurora");
      // The new template's page-0 defaults win...
      expect(layout).toHaveLength(1);
      expect(layout[0][0].slice(0, 4)).toEqual(["summary", "experience", "education", "projects"]);
      // ...and custom sections the defaults do not mention are re-placed,
      // never dropped.
      const placed = layout.flat(2);
      expect(placed).toContain("speaking");
      expect(placed).toContain("advisory");
    });

    it("treats re-picking the current template as a no-op", async () => {
      // Regression: applyTemplate rebuilds metadata.layout onto one page, so
      // activating the Current card must write nothing — otherwise a stray
      // click flattens manual page/column placement and burns an undo entry.
      resume.metadata.template = "aurora";
      await openDrawer();

      fireEvent.click(screen.getByRole("button", { name: "Use Aurora template" }));

      expect(store.applyTemplate).not.toHaveBeenCalled();
      expect(writeCount()).toBe(0);
    });

    it("falls back to the single-column layout for a template without metadata", async () => {
      await openDrawer();

      fireEvent.click(screen.getByRole("button", { name: "Use Plainstone template" }));

      const [templateId, layout] = store.applyTemplate.mock.calls[0] as [string, string[][][]];
      expect(templateId).toBe("plainstone");
      expect(layout).toHaveLength(1);
      expect(layout[0]).toHaveLength(1);
      expect(layout[0][0]).toContain("summary");
      expect(layout[0][0]).toContain("speaking");
      expect(layout[0][0]).toContain("advisory");
    });

    it("reports a registry failure, and retries without reopening", async () => {
      api.fetchTemplates.mockRejectedValue(new Error("down"));
      render(() => <TemplatesDrawer resume={resume} />);

      fireEvent.click(screen.getByRole("button", { name: "Templates" }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(/failed to load templates/i);
      });

      api.fetchTemplates.mockResolvedValue(TEMPLATES);
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));

      await waitFor(() => {
        expect(screen.getByTestId("templates-drawer-list")).toBeInTheDocument();
      });
    });
  });

  describe("sections panel", () => {
    function openPanel() {
      render(() => <SectionsPanel resume={resume} />);
      fireEvent.click(screen.getByRole("button", { name: "Sections" }));
      return screen.getByTestId("sections-panel");
    }

    it("toggles a fixed section through toggleSectionVisibility", () => {
      const panel = openPanel();

      fireEvent.click(within(panel).getByRole("switch", { name: "Experience" }));

      expect(store.toggleSectionVisibility).toHaveBeenCalledExactlyOnceWith("experience");
      expect(writeCount()).toBe(1);
    });

    it("re-shows a custom section that starts hidden", () => {
      // `advisory` is switched off in the fixture, so it has no card on the
      // sheet — the panel is the only way back.
      const panel = openPanel();
      const toggle = within(panel).getByRole("switch", { name: "Advisory & Standards Work" });
      expect(toggle).not.toBeChecked();

      fireEvent.click(toggle);

      expect(store.updateCustomSection).toHaveBeenCalledExactlyOnceWith("advisory", {
        visible: true,
      });
      expect(writeCount()).toBe(1);
    });

    it("adds a custom section through the shared dialog", async () => {
      const panel = openPanel();

      fireEvent.click(within(panel).getByRole("button", { name: "Add section" }));
      const dialog = await screen.findByRole("dialog", { name: "Add section" });
      fireEvent.input(within(dialog).getByRole("textbox", { name: "Section title" }), {
        target: { value: "Patents" },
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Add section" }));

      expect(store.addCustomSection).toHaveBeenCalledExactlyOnceWith("Patents");
      expect(writeCount()).toBe(1);
    });

    it("removes a custom section through removeCustomSection", () => {
      const panel = openPanel();

      fireEvent.click(
        within(panel).getByRole("button", { name: "Delete Talks & Workshops section" }),
      );

      expect(store.removeCustomSection).toHaveBeenCalledExactlyOnceWith("speaking");
      expect(writeCount()).toBe(1);
    });

    it("commits notes as plain text, with no rich-text controls", () => {
      const panel = openPanel();

      const notes = within(panel).getByRole("textbox", { name: "Notes" });
      expect(notes.tagName).toBe("TEXTAREA");
      // Plain scratch text: no rich editor, no markdown toolbar.
      expect(panel.querySelector("[contenteditable]")).toBeNull();
      expect(within(panel).queryByRole("toolbar")).toBeNull();

      fireEvent.input(notes, { target: { value: "Ask about the design-systems team." } });

      expect(store.updateMetadata).toHaveBeenCalledExactlyOnceWith(
        "notes",
        "Ask about the design-systems team.",
      );
    });
  });
});
