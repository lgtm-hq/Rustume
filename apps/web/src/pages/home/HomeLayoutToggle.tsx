import { For } from "solid-js";
import type { JSX } from "solid-js";
import { HomeLayout } from "../../lib/homeLayout";

function ListIcon() {
  return (
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.8"
        d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"
      />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.8"
        d="M4.5 5a.5.5 0 01.5-.5h5a.5.5 0 01.5.5v5a.5.5 0 01-.5.5H5a.5.5 0 01-.5-.5V5zm9 0a.5.5 0 01.5-.5h5a.5.5 0 01.5.5v5a.5.5 0 01-.5.5h-5a.5.5 0 01-.5-.5V5zm-9 9a.5.5 0 01.5-.5h5a.5.5 0 01.5.5v5a.5.5 0 01-.5.5H5a.5.5 0 01-.5-.5v-5zm9 0a.5.5 0 01.5-.5h5a.5.5 0 01.5.5v5a.5.5 0 01-.5.5h-5a.5.5 0 01-.5-.5v-5z"
      />
    </svg>
  );
}

function GalleryIcon() {
  return (
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.8"
        d="M3.5 4.5h7.5v7.5H3.5V4.5zm9.5 0h7.5v7.5H13V4.5zM3.5 14h17v5.5h-17V14z"
      />
    </svg>
  );
}

interface LayoutOption {
  layout: HomeLayout;
  label: string;
  testId: string;
  icon: () => JSX.Element;
}

const LAYOUT_OPTIONS: LayoutOption[] = [
  { layout: HomeLayout.List, label: "List", testId: "home-layout-list", icon: ListIcon },
  { layout: HomeLayout.Grid, label: "Grid", testId: "home-layout-grid", icon: GridIcon },
  {
    layout: HomeLayout.Gallery,
    label: "Gallery",
    testId: "home-layout-gallery",
    icon: GalleryIcon,
  },
];

const toggleBtnClass =
  "inline-flex h-full items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1";

/** Three-way density switcher — List / Grid / Gallery render the same scoped library. */
export function HomeLayoutToggle(props: {
  layout: HomeLayout;
  onChange: (layout: HomeLayout) => void;
  class?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Resume display"
      data-testid="home-layout-toggle"
      class={`inline-flex h-9 items-stretch rounded-lg border border-border bg-surface/60 p-0.5 ${props.class ?? ""}`}
    >
      <For each={LAYOUT_OPTIONS}>
        {(option) => (
          <button
            type="button"
            class={`${toggleBtnClass} ${
              props.layout === option.layout
                ? "bg-paper text-ink shadow-soft"
                : "text-stone hover:text-ink"
            }`}
            aria-pressed={props.layout === option.layout}
            aria-label={`${option.label} view`}
            title={option.label}
            data-testid={option.testId}
            onClick={() => props.onChange(option.layout)}
          >
            <option.icon />
            <span class="hidden sm:inline">{option.label}</span>
          </button>
        )}
      </For>
    </div>
  );
}
