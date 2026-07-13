import { translate } from "../i18n/translate";
import { createStore } from "solid-js/store";
import type { ThemeFlavor, ThemeTokens } from "@lgtm-hq/turbo-themes";
import { toast } from "../components/ui";

const STORAGE_KEY = "rustume-editor-theme";
const DEFAULT_THEME_ID = "catppuccin-mocha";
const LIGHT_DEFAULT_THEME_ID = "catppuccin-latte";

export type { ThemeFlavor, ThemeTokens };

let flavorsCache: readonly ThemeFlavor[] | null = null;
let flavorsLoad: Promise<readonly ThemeFlavor[]> | null = null;

/** Load theme flavors on demand so the home route avoids the full turbo-themes bundle. */
export async function loadThemeFlavors(): Promise<readonly ThemeFlavor[]> {
  if (flavorsCache) {
    return flavorsCache;
  }
  if (!flavorsLoad) {
    flavorsLoad = import("@lgtm-hq/turbo-themes")
      .then((module) => {
        flavorsCache = module.flavors;
        return flavorsCache;
      })
      .catch((error) => {
        flavorsLoad = null;
        throw error;
      });
  }
  return flavorsLoad;
}

export interface EditorThemeState {
  themeId: string;
  savedThemeLoadFailed: boolean;
  flavorsReady: boolean;
}

function getSystemDefaultThemeId(): string {
  try {
    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (mediaQuery && !mediaQuery.matches) {
      return LIGHT_DEFAULT_THEME_ID;
    }
  } catch {
    // fall through to dark default
  }
  return DEFAULT_THEME_ID;
}

function getInitialThemeId(): { themeId: string; failed: boolean } {
  if (typeof window === "undefined") {
    return { themeId: DEFAULT_THEME_ID, failed: false };
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { themeId: saved, failed: false };
    }
  } catch {
    console.error("Failed to read theme from localStorage");
    return { themeId: DEFAULT_THEME_ID, failed: true };
  }
  return { themeId: getSystemDefaultThemeId(), failed: false };
}

const initialTheme = getInitialThemeId();
const [state, setState] = createStore<EditorThemeState>({
  themeId: initialTheme.themeId,
  savedThemeLoadFailed: initialTheme.failed,
  flavorsReady: false,
});

function applyTheme(theme: ThemeFlavor) {
  const root = document.documentElement;
  const { tokens } = theme;

  root.style.setProperty("--turbo-bg-base", tokens.background.base);
  root.style.setProperty("--turbo-bg-surface", tokens.background.surface);
  root.style.setProperty("--turbo-bg-overlay", tokens.background.overlay);
  root.style.setProperty("--turbo-text-primary", tokens.text.primary);
  root.style.setProperty("--turbo-text-secondary", tokens.text.secondary);
  root.style.setProperty("--turbo-text-inverse", tokens.text.inverse);
  root.style.setProperty("--turbo-brand-primary", tokens.brand.primary);
  root.style.setProperty("--turbo-accent-link", tokens.accent.link);
  root.style.setProperty("--turbo-state-info", tokens.state.info);
  root.style.setProperty("--turbo-state-success", tokens.state.success);
  root.style.setProperty("--turbo-state-warning", tokens.state.warning);
  root.style.setProperty("--turbo-state-danger", tokens.state.danger);
  root.style.setProperty("--turbo-border-default", tokens.border.default);
  root.style.setProperty("--turbo-selection-bg", tokens.content.selection.bg);
  root.setAttribute("data-theme-appearance", theme.appearance);
}

function resolveTheme(flavors: readonly ThemeFlavor[], themeId: string): ThemeFlavor | undefined {
  const theme = flavors.find((flavor) => flavor.id === themeId);
  if (theme) {
    return theme;
  }
  return flavors.find((flavor) => flavor.id === DEFAULT_THEME_ID);
}

export function useEditorTheme() {
  return {
    state,

    get currentTheme(): ThemeFlavor | undefined {
      if (!flavorsCache) {
        return undefined;
      }
      return resolveTheme(flavorsCache, state.themeId);
    },

    async ensureFlavorsLoaded(): Promise<readonly ThemeFlavor[]> {
      const flavors = await loadThemeFlavors();
      setState("flavorsReady", true);

      if (state.savedThemeLoadFailed) {
        toast.warning(translate("theme.toasts.loadFailed"));
        setState("savedThemeLoadFailed", false);
      }

      const savedExists = flavors.some((flavor) => flavor.id === state.themeId);
      if (!savedExists) {
        const systemDefaultId = getSystemDefaultThemeId();
        const fallbackId = flavors.some((flavor) => flavor.id === systemDefaultId)
          ? systemDefaultId
          : DEFAULT_THEME_ID;
        setState("themeId", fallbackId);
        // Only persist corrections for explicit saved preferences. System-derived
        // defaults should stay ephemeral so future visits can re-read color scheme.
        let hadSavedPreference = false;
        try {
          hadSavedPreference = localStorage.getItem(STORAGE_KEY) !== null;
        } catch {
          // ignore read errors; treat as no saved preference
        }
        if (hadSavedPreference) {
          try {
            localStorage.setItem(STORAGE_KEY, fallbackId);
          } catch {
            console.error("Failed to save theme to localStorage");
            toast.warning(translate("theme.toasts.saveFailed"));
          }
        }
      }

      const theme = resolveTheme(flavors, state.themeId);
      if (theme) {
        applyTheme(theme);
      }
      return flavors;
    },

    setTheme(themeId: string) {
      if (!flavorsCache) {
        return;
      }
      const theme = flavorsCache.find((flavor) => flavor.id === themeId);
      if (!theme) {
        return;
      }

      setState("themeId", themeId);
      try {
        localStorage.setItem(STORAGE_KEY, themeId);
      } catch {
        console.error("Failed to save theme to localStorage");
        toast.warning(translate("theme.toasts.saveFailed"));
      }
      applyTheme(theme);
    },
  };
}

export const editorThemeStore = useEditorTheme();
