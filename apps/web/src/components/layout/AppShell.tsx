import { type ParentComponent, Show } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import { useOnline } from "../../hooks/useOnline";
import { formatShortcut } from "../../hooks/useHotkeys";
import { resumeStore } from "../../stores/resume";
import { uiStore } from "../../stores/ui";
import { EditorThemeSelector } from "../ui/EditorThemeSelector";
import { AuthMenu } from "../Auth/AuthMenu";
import { SignInDialog } from "../Auth/SignInDialog";

export const AppShell: ParentComponent = (props) => {
  const isOnline = useOnline();
  const location = useLocation();

  const isEditor = () => location.pathname.startsWith("/edit");
  /** The Home library turns the top bar into the command-center utility bar. */
  const isHome = () => location.pathname === "/";

  return (
    <div class="min-h-screen bg-paper flex flex-col">
      <a href="#main-content" class="skip-link">
        Skip to content
      </a>

      {/* Top Bar */}
      <header
        class="border-b border-border bg-paper/80 backdrop-blur-sm sticky top-0 z-30"
        data-print-hide
      >
        <div class="h-14 px-4 flex items-center justify-between gap-3">
          {/* Equal-basis outer columns keep the command trigger geometrically
              centred regardless of logo / auth-control widths. */}
          <div class="flex flex-1 min-w-0 items-center gap-3">
            {/* Sidebar mount point — wired with the Phase 3 scope rail */}
            <Show when={isHome()}>
              <button
                type="button"
                class="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-md
                text-stone transition-colors motion-reduce:transition-none hover:bg-surface
                hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed
                focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                disabled
                aria-label="Toggle sidebar"
                title="Scope sidebar — coming soon"
                data-testid="utility-sidebar-toggle"
              >
                <svg
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.8"
                    d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm5.5-2v16"
                  />
                </svg>
              </button>
            </Show>

            {/* Logo */}
            <nav aria-label="Primary" class="flex-shrink-0">
              <A href="/" class="flex items-center gap-2 group">
                <div
                  class="w-8 h-8 bg-ink rounded flex items-center justify-center"
                  aria-hidden="true"
                >
                  <span class="text-paper font-display font-bold text-lg">R</span>
                </div>
                <span
                  class="font-display text-xl font-semibold text-ink
                group-hover:text-accent transition-colors"
                >
                  Rustume
                </span>
              </A>
            </nav>
          </div>

          {/* Command palette trigger — keyboard twin of the library toolbar */}
          <Show when={isHome()}>
            <button
              type="button"
              class="hidden md:flex w-full max-w-sm flex-shrink items-center gap-2
                rounded-lg border border-accent/35 bg-surface px-3 py-1.5 text-left text-sm
                text-stone transition-colors motion-reduce:transition-none hover:border-accent/60
                hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              onClick={() => uiStore.openModal("commandPalette")}
              data-testid="command-palette-trigger"
            >
              <svg
                class="w-4 h-4 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <span class="flex-1 truncate">Search resumes or run a command…</span>
              <kbd class="flex-shrink-0 font-mono text-[10px] rounded border border-border bg-paper px-1.5 py-0.5">
                {formatShortcut({ key: "k", mod: true })}
              </kbd>
            </button>
          </Show>

          {/* Status Indicators — keep compact so AuthMenu / theme stay usable on narrow screens */}
          <div class="flex flex-1 min-w-0 items-center justify-end gap-3 sm:gap-4">
            <AuthMenu />

            {/* Editor Theme Selector */}
            <EditorThemeSelector />

            {/* Save Status */}
            <Show when={isEditor()}>
              <SaveIndicator />
            </Show>

            {/* Offline Indicator */}
            <Show when={!isOnline()}>
              <div class="flex items-center gap-2 px-3 py-1.5 bg-offline/10 rounded-full">
                <div class="w-2 h-2 bg-offline rounded-full animate-pulse-subtle" />
                <span class="text-xs font-mono text-stone">Offline</span>
              </div>
            </Show>
          </div>
        </div>
      </header>

      <SignInDialog />

      {/* Main Content */}
      <main
        id="main-content"
        class="flex-1"
        classList={{ "min-h-0 overflow-hidden": isEditor() }}
        tabindex={-1}
      >
        {props.children}
      </main>

      {/* Footer — hidden on editor to avoid document scroll jumps when
          section controls take focus inside the fixed-height workspace. */}
      <Show when={!isEditor()}>
        <footer
          class="border-t border-border px-4 py-4 text-center text-xs text-stone"
          data-print-hide
        >
          <A href="/terms" class="hover:text-ink underline">
            Terms of Service
          </A>
          <span class="mx-2" aria-hidden="true">
            ·
          </span>
          <A href="/privacy" class="hover:text-ink underline">
            Privacy Policy
          </A>
        </footer>
      </Show>
    </div>
  );
};

function SaveIndicator() {
  const { store } = resumeStore;

  return (
    <div
      role="status"
      aria-live="polite"
      class="flex items-center gap-2 text-xs font-mono text-stone"
    >
      <Show when={store.isSaving}>
        <div class="flex items-center gap-1.5">
          <svg class="w-3 h-3 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
              fill="none"
            />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span>Saving...</span>
        </div>
      </Show>

      <Show when={!store.isSaving && store.isDirty}>
        <div class="flex items-center gap-1.5">
          <div class="w-1.5 h-1.5 bg-accent rounded-full" aria-hidden="true" />
          <span>Unsaved</span>
        </div>
      </Show>

      <Show when={!store.isSaving && !store.isDirty && store.lastSaved}>
        <div class="flex items-center gap-1.5">
          <svg
            class="w-3 h-3 text-green-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span>Saved</span>
        </div>
      </Show>
    </div>
  );
}
