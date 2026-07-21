import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import { ThemeEditor } from "../ThemeEditor";
import { resumeStore } from "../../../stores/resume";

vi.mock("../../../wasm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../wasm")>();
  return {
    ...actual,
    saveResume: vi.fn().mockResolvedValue(undefined),
    isWasmReady: () => false,
  };
});

describe("ThemeEditor custom CSS tab", () => {
  beforeEach(() => {
    resumeStore.createNewResume("theme-editor-css-test");
  });

  it("shows the CSS tab and persists textarea changes", async () => {
    render(() => <ThemeEditor />);

    fireEvent.click(screen.getByRole("button", { name: "CSS" }));

    const textarea = screen.getByLabelText("Custom CSS");
    fireEvent.input(textarea, { target: { value: ".resume { color: red; }" } });

    expect(resumeStore.store.resume?.metadata.css.value).toBe(".resume { color: red; }");
  });

  it("toggles custom CSS visibility via metadata.css.visible", async () => {
    render(() => <ThemeEditor />);

    fireEvent.click(screen.getByRole("button", { name: "CSS" }));

    const toggle = screen.getByRole("button", { name: "Enable custom CSS" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(toggle);
    expect(resumeStore.store.resume?.metadata.css.visible).toBe(true);
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(toggle);
    expect(resumeStore.store.resume?.metadata.css.visible).toBe(false);
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("explains that custom CSS applies to HTML and print surfaces only", async () => {
    render(() => <ThemeEditor />);

    fireEvent.click(screen.getByRole("button", { name: "CSS" }));

    expect(screen.getByText(/HTML and print surfaces/i)).toBeInTheDocument();
    expect(
      screen.getByText(/scoped to the resume content area and cannot affect the app UI/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/PDF export use Typst templates and theme controls/i),
    ).toBeInTheDocument();
  });

  it("reflects and updates the proficiency display metadata", async () => {
    render(() => <ThemeEditor />);

    const select = screen.getByLabelText("Proficiency display");
    expect(select).toHaveValue("template-default");

    fireEvent.change(select, { target: { value: "progress-bar" } });

    expect(resumeStore.store.resume?.metadata.levelDisplay).toBe("progress-bar");
    expect(select).toHaveValue("progress-bar");
  });
});

describe("ThemeEditor sidebar width control", () => {
  beforeEach(() => {
    resumeStore.createNewResume("theme-editor-sidebar-test");
  });

  it("only shows the sidebar width slider for sidebar templates", async () => {
    render(() => <ThemeEditor />);

    expect(screen.queryByRole("slider", { name: "Sidebar width" })).not.toBeInTheDocument();

    resumeStore.updateTemplate("azurill");

    expect(screen.getByRole("slider", { name: "Sidebar width" })).toBeInTheDocument();
  });

  it("updates metadata.page.sidebarRatio when the slider moves", async () => {
    resumeStore.updateTemplate("pikachu");
    render(() => <ThemeEditor />);

    const slider = screen.getByRole("slider", { name: "Sidebar width" });
    fireEvent.input(slider, { target: { value: "0.25" } });

    expect(resumeStore.store.resume?.metadata.page.sidebarRatio).toBe(0.25);
  });

  it("clears metadata.page.sidebarRatio when reset to template default", async () => {
    resumeStore.updateTemplate("chikorita");
    resumeStore.updateMetadata("page", {
      ...resumeStore.store.resume!.metadata.page,
      sidebarRatio: 0.25,
    });
    render(() => <ThemeEditor />);

    fireEvent.click(screen.getByRole("button", { name: "Reset to template default" }));

    expect(resumeStore.store.resume?.metadata.page.sidebarRatio).toBeUndefined();
  });
});
