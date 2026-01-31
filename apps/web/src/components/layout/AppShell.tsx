import { type ParentComponent, Show } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import { useOnline } from "../../hooks/useOnline";
import { resumeStore } from "../../stores/resume";
import { EditorThemeSelector } from "../ui/EditorThemeSelector";

export const AppShell: ParentComponent = (props) => {
  const isOnline = useOnline();
  const location = useLocation();

  const isEditor = () => location.pathname.startsWith("/edit");

  return (
    <div class="min-h-screen bg-paper flex flex-col">
      {/* Top Bar */}
      <header class="h-14 border-b border-border bg-paper/80 backdrop-blur-sm sticky top-0 z-30">
        <div class="h-full px-4 flex items-center justify-between">
          {/* Logo */}
          <A href="/" class="flex items-center gap-2 group">
            <div class="w-8 h-8 bg-ink rounded flex items-center justify-center">
              <span class="text-paper font-display font-bold text-lg">R</span>
            </div>
            <span
              class="font-display text-xl font-semibold text-ink
              group-hover:text-accent transition-colors"
            >
              Rustume
            </span>
          </A>

          {/* Status Indicators */}
          <div class="flex items-center gap-4">
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

      {/* Main Content */}
      <main class="flex-1">{props.children}</main>
    </div>
  );
};

function SaveIndicator() {
  const { store } = resumeStore;

  return (
    <div class="flex items-center gap-2 text-xs font-mono text-stone">
      <Show when={store.isSaving}>
        <div class="flex items-center gap-1.5">
          <svg class="w-3 h-3 animate-spin" viewBox="0 0 24 24">
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
          <div class="w-1.5 h-1.5 bg-accent rounded-full" />
          <span>Unsaved</span>
        </div>
      </Show>

      <Show when={!store.isSaving && !store.isDirty && store.lastSaved}>
        <div class="flex items-center gap-1.5">
          <svg class="w-3 h-3 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
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
