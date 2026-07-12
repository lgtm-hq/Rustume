import { createRoot } from "solid-js";

const turboThemesMock = vi.hoisted(() => ({
  failImport: false,
  flavors: [
    {
      id: "catppuccin-mocha",
      label: "Mocha",
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
      label: "Latte",
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
  ] as const,
}));

vi.mock("@lgtm-hq/turbo-themes", () => ({
  get flavors() {
    if (turboThemesMock.failImport) {
      throw new Error("network error");
    }
    return turboThemesMock.flavors;
  },
}));

function mockMatchMedia(preferDark: boolean | undefined) {
  if (preferDark === undefined) {
    Object.defineProperty(window, "matchMedia", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    return;
  }

  Object.defineProperty(window, "matchMedia", {
    value: vi.fn().mockImplementation((query: string) => ({
      matches: preferDark,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
    configurable: true,
    writable: true,
  });
}

async function importFreshEditorTheme() {
  vi.resetModules();
  return import("../editorTheme");
}

import { useEditorTheme } from "../editorTheme";

describe("useEditorTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    turboThemesMock.failImport = false;
    mockMatchMedia(true);
  });

  it('initial themeId is "catppuccin-mocha" when system prefers dark', async () => {
    mockMatchMedia(true);
    const { useEditorTheme: useTheme } = await importFreshEditorTheme();
    createRoot((dispose) => {
      const { state } = useTheme();
      expect(state.themeId).toBe("catppuccin-mocha");
      dispose();
    });
  });

  it('initial themeId is "catppuccin-latte" when system prefers light', async () => {
    mockMatchMedia(false);
    const { useEditorTheme: useTheme } = await importFreshEditorTheme();
    createRoot((dispose) => {
      const { state } = useTheme();
      expect(state.themeId).toBe("catppuccin-latte");
      dispose();
    });
  });

  it('initial themeId is "catppuccin-mocha" when matchMedia is unavailable', async () => {
    mockMatchMedia(undefined);
    const { useEditorTheme: useTheme } = await importFreshEditorTheme();
    createRoot((dispose) => {
      const { state } = useTheme();
      expect(state.themeId).toBe("catppuccin-mocha");
      dispose();
    });
  });

  it("saved localStorage value wins over system color scheme", async () => {
    localStorage.setItem("rustume-editor-theme", "catppuccin-mocha");
    mockMatchMedia(false);
    const { useEditorTheme: useTheme } = await importFreshEditorTheme();
    createRoot((dispose) => {
      const { state } = useTheme();
      expect(state.themeId).toBe("catppuccin-mocha");
      dispose();
    });
  });

  it("setTheme with invalid ID does not change themeId", async () => {
    await createRoot(async (dispose) => {
      const { state, setTheme, ensureFlavorsLoaded } = useEditorTheme();
      await ensureFlavorsLoaded();
      const before = state.themeId;

      setTheme("non-existent-theme");
      expect(state.themeId).toBe(before);
      dispose();
    });
  });

  it("retries loading flavors after import failure", async () => {
    turboThemesMock.failImport = true;
    vi.resetModules();
    const { loadThemeFlavors: loadFlavors } = await import("../editorTheme");
    await expect(loadFlavors()).rejects.toThrow("network error");

    turboThemesMock.failImport = false;
    const flavors = await loadFlavors();
    expect(flavors).toHaveLength(2);
  });

  it("resets stale saved theme to default in localStorage", async () => {
    localStorage.setItem("rustume-editor-theme", "removed-theme");
    vi.resetModules();
    const { useEditorTheme: useTheme } = await import("../editorTheme");
    await createRoot(async (dispose) => {
      const { state, ensureFlavorsLoaded } = useTheme();
      await ensureFlavorsLoaded();
      expect(state.themeId).toBe("catppuccin-mocha");
      expect(localStorage.getItem("rustume-editor-theme")).toBe("catppuccin-mocha");
      dispose();
    });
  });

  it("does not persist system default when flavor list lacks light default", async () => {
    mockMatchMedia(false);
    const flavorsWithoutLatte = turboThemesMock.flavors.filter(
      (flavor) => flavor.id !== "catppuccin-latte",
    );
    vi.doMock("@lgtm-hq/turbo-themes", () => ({
      get flavors() {
        return flavorsWithoutLatte;
      },
    }));
    const { useEditorTheme: useTheme } = await importFreshEditorTheme();
    await createRoot(async (dispose) => {
      const { state, ensureFlavorsLoaded } = useTheme();
      expect(state.themeId).toBe("catppuccin-latte");
      await ensureFlavorsLoaded();
      expect(state.themeId).toBe("catppuccin-mocha");
      expect(localStorage.getItem("rustume-editor-theme")).toBeNull();
      dispose();
    });
    vi.doUnmock("@lgtm-hq/turbo-themes");
  });

  it("setTheme with valid ID updates themeId and saves to localStorage", async () => {
    await createRoot(async (dispose) => {
      const { state, setTheme, ensureFlavorsLoaded } = useEditorTheme();

      await ensureFlavorsLoaded();
      setTheme("catppuccin-latte");
      expect(state.themeId).toBe("catppuccin-latte");
      expect(localStorage.getItem("rustume-editor-theme")).toBe("catppuccin-latte");
      dispose();
    });
  });
});
