import type { HomeLayout } from "../../lib/homeLayout";
import { HomeLayout as HomeLayoutValues } from "../../lib/homeLayout";

function ListIcon() {
  return (
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M4 6h16M4 12h16M4 18h16"
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
        stroke-width="2"
        d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
      />
    </svg>
  );
}

const toggleBtnClass =
  "inline-flex h-full items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1";

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
      <button
        type="button"
        class={`${toggleBtnClass} ${
          props.layout === HomeLayoutValues.List
            ? "bg-paper text-ink shadow-soft"
            : "text-stone hover:text-ink"
        }`}
        aria-pressed={props.layout === HomeLayoutValues.List}
        aria-label="List view"
        title="List"
        data-testid="home-layout-list"
        onClick={() => props.onChange(HomeLayoutValues.List)}
      >
        <ListIcon />
        List
      </button>
      <button
        type="button"
        class={`${toggleBtnClass} ${
          props.layout === HomeLayoutValues.Grid
            ? "bg-paper text-ink shadow-soft"
            : "text-stone hover:text-ink"
        }`}
        aria-pressed={props.layout === HomeLayoutValues.Grid}
        aria-label="Grid view"
        title="Grid"
        data-testid="home-layout-grid"
        onClick={() => props.onChange(HomeLayoutValues.Grid)}
      >
        <GridIcon />
        Grid
      </button>
    </div>
  );
}
