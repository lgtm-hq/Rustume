import { createStore } from "solid-js/store";
import { flavors as turboFlavors, type ThemeFlavor, type ThemeTokens } from "@lgtm-hq/turbo-themes";
import { toast } from "../components/ui";

const STORAGE_KEY = "rustume-editor-theme";

// Re-export types from turbo-themes
export type { ThemeFlavor, ThemeTokens };

// Use flavors directly from turbo-themes package
export const flavors: readonly ThemeFlavor[] = turboFlavors;

export interface EditorThemeState {
  themeId: string;
}

// Get initial theme from localStorage or default to catppuccin-mocha
function getInitialTheme(): string {
  if (typeof window === "undefined") return "catppuccin-mocha";
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && flavors.some((f) => f.id === saved)) {
      return saved;
    }
  } catch {
    console.error("Failed to read theme from localStorage");
    toast.warning("Could not load saved theme preference");
  }
  return "catppuccin-mocha";
}

const [state, setState] = createStore<EditorThemeState>({
  themeId: getInitialTheme(),
});

// Apply CSS variables to document root
function applyTheme(theme: ThemeFlavor) {
  const root = document.documentElement;
  const { tokens } = theme;

  // Background colors
  root.style.setProperty("--turbo-bg-base", tokens.background.base);
  root.style.setProperty("--turbo-bg-surface", tokens.background.surface);
  root.style.setProperty("--turbo-bg-overlay", tokens.background.overlay);

  // Text colors
  root.style.setProperty("--turbo-text-primary", tokens.text.primary);
  root.style.setProperty("--turbo-text-secondary", tokens.text.secondary);
  root.style.setProperty("--turbo-text-inverse", tokens.text.inverse);

  // Brand/accent colors
  root.style.setProperty("--turbo-brand-primary", tokens.brand.primary);
  root.style.setProperty("--turbo-accent-link", tokens.accent.link);

  // State colors
  root.style.setProperty("--turbo-state-info", tokens.state.info);
  root.style.setProperty("--turbo-state-success", tokens.state.success);
  root.style.setProperty("--turbo-state-warning", tokens.state.warning);
  root.style.setProperty("--turbo-state-danger", tokens.state.danger);

  // Border
  root.style.setProperty("--turbo-border-default", tokens.border.default);

  // Content/selection colors
  root.style.setProperty("--turbo-selection-bg", tokens.content.selection.bg);

  // Set appearance attribute for light/dark mode
  root.setAttribute("data-theme-appearance", theme.appearance);
}

export function useEditorTheme() {
  return {
    state,

    get currentTheme(): ThemeFlavor | undefined {
      return flavors.find((f) => f.id === state.themeId);
    },

    setTheme(themeId: string) {
      const theme = flavors.find((f) => f.id === themeId);
      if (!theme) return;

      setState("themeId", themeId);
      try {
        localStorage.setItem(STORAGE_KEY, themeId);
      } catch {
        console.error("Failed to save theme to localStorage");
        toast.warning("Could not save theme preference");
      }
      applyTheme(theme);
    },

    // Initialize theme on app start
    init() {
      const theme = flavors.find((f) => f.id === state.themeId);
      if (theme) {
        applyTheme(theme);
      }
    },
  };
}

export const editorThemeStore = useEditorTheme();

// Initialize theme immediately when module loads (client-side only)
if (typeof window !== "undefined") {
  editorThemeStore.init();
}
