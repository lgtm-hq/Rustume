import { For, Show, createMemo } from "solid-js";
import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { editorThemeStore, flavors, type ThemeFlavor } from "../../stores/editorTheme";

interface ThemeGroup {
  label: string;
  themes: ThemeFlavor[];
}

export function EditorThemeSelector() {
  const groupedThemes = createMemo((): ThemeGroup[] => {
    const light = flavors.filter((f) => f.appearance === "light");
    const dark = flavors.filter((f) => f.appearance === "dark");
    return [
      { label: "Light", themes: light },
      { label: "Dark", themes: dark },
    ];
  });

  const currentTheme = () => editorThemeStore.currentTheme;

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger class="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface transition-colors text-sm">
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
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          class="min-w-[200px] max-h-[400px] overflow-y-auto bg-paper border border-border rounded-lg shadow-card p-1 z-50"
        >
          <For each={groupedThemes()}>
            {(group) => (
              <>
                <DropdownMenu.Group>
                  <DropdownMenu.GroupLabel class="px-2 py-1.5 text-xs font-mono uppercase tracking-wider text-stone">
                    {group.label}
                  </DropdownMenu.GroupLabel>
                  <For each={group.themes}>
                    {(theme) => (
                      <DropdownMenu.Item
                        class="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-surface outline-none data-[highlighted]:bg-surface"
                        onSelect={() => editorThemeStore.setTheme(theme.id)}
                      >
                        <div class="flex items-center gap-1">
                          <div
                            class="w-3 h-3 rounded-full border border-border"
                            style={{ background: theme.tokens.background.base }}
                          />
                          <div
                            class="w-3 h-3 rounded-full border border-border"
                            style={{ background: theme.tokens.text.primary }}
                          />
                          <div
                            class="w-3 h-3 rounded-full border border-border"
                            style={{ background: theme.tokens.brand.primary }}
                          />
                        </div>
                        <span class="flex-1 text-sm text-ink">{theme.label}</span>
                        <Show when={editorThemeStore.state.themeId === theme.id}>
                          <svg class="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                          </svg>
                        </Show>
                      </DropdownMenu.Item>
                    )}
                  </For>
                </DropdownMenu.Group>
                <DropdownMenu.Separator class="h-px bg-border my-1" />
              </>
            )}
          </For>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu>
  );
}
