/**
 * Theme selection (#797, spec §1.2 owner addition): the top-bar theme dialog
 * over the embedded presets plus custom colors. Every control must route to
 * `resumeStore.updateTheme`, one store action per user gesture — a preset
 * click lands its id and all three colors together; a hand-picked color
 * detaches the preset.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@solidjs/testing-library";
import { loadDocEditorFixture } from "../../../test/docEditorFixture";
import { THEME_PRESETS } from "../../../stores/themePresets";
import { ThemeDialog } from "../ThemeDialog";
import type { ResumeData } from "../../../wasm/types";

const store = vi.hoisted(() => ({
  store: { resume: null as unknown },
  updateTheme: vi.fn(),
}));

vi.mock("../../../stores/resume", () => ({ resumeStore: store }));

describe("theme dialog", () => {
  let resume: ResumeData;

  beforeEach(() => {
    vi.clearAllMocks();
    resume = loadDocEditorFixture();
    resume.metadata.theme = {
      preset: undefined,
      background: "#ffffff",
      text: "#000000",
      primary: "#dc2626",
    };
    store.store.resume = resume;
  });

  function openDialog() {
    render(() => <ThemeDialog resume={resume} open onOpenChange={vi.fn()} />);
    return screen.getByTestId("theme-dialog");
  }

  it("lists every embedded preset, grouped by light and dark", () => {
    const dialog = openDialog();

    const light = within(dialog).getByRole("region", { name: "Light themes" });
    const dark = within(dialog).getByRole("region", { name: "Dark themes" });
    const lightCount = THEME_PRESETS.filter((preset) => !preset.isDark).length;
    const darkCount = THEME_PRESETS.filter((preset) => preset.isDark).length;
    expect(within(light).getAllByRole("button")).toHaveLength(lightCount);
    expect(within(dark).getAllByRole("button")).toHaveLength(darkCount);
  });

  it("applies a preset as one store action carrying id and all three colors", () => {
    const dialog = openDialog();
    const preset = THEME_PRESETS.find((candidate) => candidate.id === "light-emerald");
    if (!preset) throw new Error("light-emerald preset missing");

    fireEvent.click(within(dialog).getByRole("button", { name: "Use Emerald theme" }));

    expect(store.updateTheme).toHaveBeenCalledExactlyOnceWith({
      preset: "light-emerald",
      background: preset.colors.background,
      text: preset.colors.text,
      primary: preset.colors.primary,
    });
  });

  it("marks the resume's current preset", () => {
    resume.metadata.theme.preset = "light-emerald";
    const dialog = openDialog();

    expect(within(dialog).getByRole("button", { name: "Use Emerald theme" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(dialog).getByRole("button", { name: "Use Default theme" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("commits a complete hex value and detaches the preset", () => {
    resume.metadata.theme.preset = "light-default";
    const dialog = openDialog();

    fireEvent.input(within(dialog).getByRole("textbox", { name: "Primary" }), {
      target: { value: "#123abc" },
    });

    expect(store.updateTheme).toHaveBeenCalledExactlyOnceWith({
      primary: "#123abc",
      preset: undefined,
    });
  });

  it("never writes a partial hex value", () => {
    const dialog = openDialog();

    fireEvent.input(within(dialog).getByRole("textbox", { name: "Background" }), {
      target: { value: "#12" },
    });

    expect(store.updateTheme).not.toHaveBeenCalled();
    expect(within(dialog).getByText("Use a full #rrggbb value.")).toBeInTheDocument();
  });

  it("commits from the native color picker as one action", () => {
    const dialog = openDialog();

    fireEvent.input(within(dialog).getByLabelText("Pick text color"), {
      target: { value: "#222222" },
    });

    expect(store.updateTheme).toHaveBeenCalledExactlyOnceWith({
      text: "#222222",
      preset: undefined,
    });
  });
});
