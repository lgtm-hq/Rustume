import { createResource, For, Show, createMemo, onMount } from "solid-js";
import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { editorThemeStore, loadThemeFlavors, type ThemeFlavor } from "../../stores/editorTheme";
import { Spinner } from "./Spinner";

interface ThemeGroup {
  label: string;
  themes: ThemeFlavor[];
}

export function EditorThemeSelector() {
  const [flavors] = createResource(loadThemeFlavors);

  onMount(() => {
    void editorThemeStore.ensureFlavorsLoaded();
  });

  const groupedThemes = createMemo((): ThemeGroup[] => {
    const loaded = flavors();
    if (!loaded) {
      return [];
    }
    const light = loaded.filter((flavor) => flavor.appearance === "light");
    const dark = loaded.filter((flavor) => flavor.appearance === "dark");
    return [
      { label: "Light", themes: light },
      { label: "Dark", themes: dark },
    ];
  });

  const currentTheme = () => editorThemeStore.currentTheme;

  return (
    <Show
      when={!flavors.loading && flavors()}
      fallback={
        <div class="flex items-center gap-2 px-2 py-1.5">
          <Spinner class="w-4 h-4" />
        </div>
      }
    >
      <DropdownMenu>
        <DropdownMenu.Trigger
          aria-label="Editor theme"
          class="focus-ring flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface transition-colors text-sm"
        >
          <div class="flex items-center gap-1.5">
            <div
              class="w-3 h-3 rounded-full border border-border"
              style={{ background: currentTheme()?.tokens.background.base }}
            />
            <div
              class="w-3 h-3 rounded-full border border-border -ml-1.5"
              style={{ background: currentTheme()?.tokens.brand.primary }}
            />
          </div>
          <span class="font-mono text-xs text-stone hidden sm:inline">
            {currentTheme()?.label ?? "Theme"}
          </span>
          <svg class="w-3 h-3 text-stone" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content class="z-50 min-w-[200px] rounded-lg border border-border bg-paper shadow-soft p-1">
            <For each={groupedThemes()}>
              {(group) => (
                <>
                  <DropdownMenu.Group>
                    <DropdownMenu.GroupLabel class="px-2 py-1 text-xs font-mono text-stone uppercase tracking-wider">
                      {group.label}
                    </DropdownMenu.GroupLabel>
                    <For each={group.themes}>
                      {(theme) => (
                        <DropdownMenu.Item
                          class="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer outline-none hover:bg-surface focus:bg-surface"
                          onSelect={() => editorThemeStore.setTheme(theme.id)}
                        >
                          <div class="flex items-center gap-1">
                            <div
                              class="w-3 h-3 rounded-full border border-border"
                              style={{ background: theme.tokens.background.base }}
                            />
                            <div
                              class="w-3 h-3 rounded-full border border-border"
                              style={{ background: theme.tokens.brand.primary }}
                            />
                          </div>
                          <span class="text-sm flex-1">{theme.label}</span>
                          <Show when={editorThemeStore.state.themeId === theme.id}>
                            <svg
                              class="w-4 h-4 text-accent"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </Show>
                        </DropdownMenu.Item>
                      )}
                    </For>
                  </DropdownMenu.Group>
                </>
              )}
            </For>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>
    </Show>
  );
}
