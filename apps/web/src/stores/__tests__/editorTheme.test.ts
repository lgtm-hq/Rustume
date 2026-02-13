import { createRoot } from "solid-js";

vi.mock("@lgtm-hq/turbo-themes", () => ({
  flavors: [
    {
      id: "catppuccin-mocha",
      appearance: "dark",
      tokens: {
        background: { base: "#1e1e2e", surface: "#313244", overlay: "#45475a" },
        text: { primary: "#cdd6f4", secondary: "#a6adc8", inverse: "#1e1e2e" },
        brand: { primary: "#89b4fa" },
        accent: { link: "#89b4fa" },
        state: { info: "#89b4fa", success: "#a6e3a1", warning: "#f9e2af", danger: "#f38ba8" },
        border: { default: "#585b70" },
        content: { selection: { bg: "#585b70" } },
      },
    },
    {
      id: "catppuccin-latte",
      appearance: "light",
      tokens: {
        background: { base: "#eff1f5", surface: "#ccd0da", overlay: "#9ca0b0" },
        text: { primary: "#4c4f69", secondary: "#6c6f85", inverse: "#eff1f5" },
        brand: { primary: "#1e66f5" },
        accent: { link: "#1e66f5" },
        state: { info: "#1e66f5", success: "#40a02b", warning: "#df8e1d", danger: "#d20f39" },
        border: { default: "#9ca0b0" },
        content: { selection: { bg: "#acb0be" } },
      },
    },
  ],
}));

// Import AFTER the mock is set up so the module uses the mocked flavors
import { useEditorTheme } from "../editorTheme";

describe("useEditorTheme", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initial themeId is "catppuccin-mocha"', () => {
    createRoot((dispose) => {
      const { state } = useEditorTheme();
      expect(state.themeId).toBe("catppuccin-mocha");
      dispose();
    });
  });

  it("setTheme with invalid ID does not change themeId", () => {
    createRoot((dispose) => {
      const { state, setTheme } = useEditorTheme();
      const before = state.themeId;

      setTheme("non-existent-theme");
      expect(state.themeId).toBe(before);
      dispose();
    });
  });

  it("setTheme with valid ID updates themeId and saves to localStorage", () => {
    createRoot((dispose) => {
      const { state, setTheme } = useEditorTheme();

      setTheme("catppuccin-latte");
      expect(state.themeId).toBe("catppuccin-latte");
      expect(localStorage.getItem("rustume-editor-theme")).toBe("catppuccin-latte");
      dispose();
    });
  });
});
