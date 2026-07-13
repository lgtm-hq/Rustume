import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { For, Show } from "solid-js";
import { useI18n } from "../../i18n";

/** Language selector for account/settings UI. */
export function LanguageSelector() {
  const { t, locale, setLocale, locales } = useI18n();
  const current = () => locales.find((entry) => entry.id === locale());

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        class="flex w-full items-center justify-between gap-3 rounded-lg border border-border
          bg-surface px-3 py-2.5 text-sm text-ink hover:bg-border/30 transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label={t("account.language.title")}
      >
        <span class="font-medium">{current()?.nativeName ?? locale()}</span>
        <svg class="h-4 w-4 text-stone" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content class="z-50 min-w-[220px] rounded-lg border border-border bg-paper shadow-soft p-1">
          <For each={locales}>
            {(entry) => (
              <DropdownMenu.Item
                class="flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-md cursor-pointer
                  outline-none hover:bg-surface focus:bg-surface data-[highlighted]:bg-surface"
                onSelect={() => setLocale(entry.id)}
              >
                <span>{entry.nativeName}</span>
                <Show when={locale() === entry.id}>
                  <svg
                    class="h-4 w-4 text-accent"
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
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu>
  );
}
