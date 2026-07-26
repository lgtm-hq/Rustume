import { For, Show, type JSX } from "solid-js";
import { Button } from "../../components/ui";
import {
  isSameScope,
  SCOPE_ALL,
  SCOPE_LOCKED,
  tagScope,
  type HomeScope,
} from "../../lib/homeScope";
import { HOME_SIDEBAR_ID } from "../../stores/homeSidebar";
import type { HomePageModel } from "./useHomePage";

/** Below this width the rail is a temporary drawer rather than a column. */
const NARROW_QUERY = "(max-width: 899px)";

function isNarrowViewport(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(NARROW_QUERY).matches;
}

function rowClass(active: boolean): string {
  return `flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs
    transition-colors motion-reduce:transition-none focus:outline-none focus-visible:ring-2
    focus-visible:ring-accent ${
      active
        ? "bg-accent-light text-ink shadow-[inset_2px_0_0_var(--color-accent)]"
        : "text-stone hover:bg-accent-light hover:text-ink"
    }`;
}

function GroupHeading(props: { id: string; children: JSX.Element }) {
  return (
    <p
      id={props.id}
      class="mt-3.5 mb-1 px-2 font-mono text-[9.5px] font-semibold uppercase tracking-[0.18em]
        text-stone first:mt-0"
    >
      {props.children}
    </p>
  );
}

function ScopeRow(props: {
  label: string;
  count: number;
  active: boolean;
  testId: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      class={rowClass(props.active)}
      aria-pressed={props.active}
      onClick={props.onSelect}
      data-testid={props.testId}
    >
      <span class="truncate">{props.label}</span>
      <span class="flex-shrink-0 font-mono text-[10px] text-stone">{props.count}</span>
    </button>
  );
}

/**
 * Additive scope rail. It decides *which* resumes the library shows; the
 * List/Grid/Gallery switcher decides how they render.
 */
export function HomeSidebar(props: { home: HomePageModel }) {
  const { home } = props;

  const select = (scope: HomeScope) => {
    home.setScope(scope);
    // A drawer that stays open over the result hides the thing it just filtered.
    if (isNarrowViewport()) home.setSidebarOpen(false);
  };

  return (
    <aside
      id={HOME_SIDEBAR_ID}
      aria-label="Library scope"
      data-testid="home-scope-rail"
      class="z-40 flex flex-col border-r border-border bg-surface
        motion-safe:animate-fade-in
        max-[899px]:fixed max-[899px]:inset-y-0 max-[899px]:left-0 max-[899px]:w-[17rem]
        max-[899px]:shadow-card
        min-[900px]:sticky min-[900px]:top-14 min-[900px]:self-start
        min-[900px]:h-[calc(100vh-3.5rem)]
        min-[900px]:w-[228px] min-[900px]:flex-shrink-0"
    >
      <div class="flex flex-col gap-2.5 border-b border-border p-3">
        <div class="flex items-center gap-2">
          <Button
            size="sm"
            class="h-8 flex-1 justify-center text-xs"
            onClick={home.handleNew}
            data-testid="home-sidebar-new"
          >
            New
          </Button>
          <Button
            size="sm"
            variant="secondary"
            class="h-8 flex-1 justify-center text-xs"
            onClick={home.handleImport}
            data-testid="home-sidebar-import"
          >
            Import
          </Button>
        </div>
        <button
          type="button"
          class="inline-flex h-8 items-center justify-center rounded-md border border-border
            bg-paper text-xs text-stone transition-colors motion-reduce:transition-none
            hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent
            min-[900px]:hidden"
          onClick={() => home.setSidebarOpen(false)}
          data-testid="home-scope-rail-close"
        >
          Close scope sidebar
        </button>
      </div>

      <nav class="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
        <GroupHeading id="home-scope-group-scope">Scope</GroupHeading>
        <div role="group" aria-labelledby="home-scope-group-scope" class="flex flex-col gap-px">
          <ScopeRow
            label="All resumes"
            count={home.scopeCounts().total}
            active={home.scope().kind === "all"}
            testId="home-scope-all"
            onSelect={() => select(SCOPE_ALL)}
          />
          <ScopeRow
            label="Locked"
            count={home.scopeCounts().locked}
            active={home.scope().kind === "locked"}
            testId="home-scope-locked"
            onSelect={() => select(SCOPE_LOCKED)}
          />
        </div>

        <Show
          when={home.allTags().length > 0}
          fallback={
            <>
              <GroupHeading id="home-scope-group-tags">Tags</GroupHeading>
              <p
                class="px-2 py-1 font-mono text-[10px] text-stone"
                data-testid="home-scope-no-tags"
              >
                Tag a resume to scope by it.
              </p>
            </>
          }
        >
          <GroupHeading id="home-scope-group-tags">Tags</GroupHeading>
          <div role="group" aria-labelledby="home-scope-group-tags" class="flex flex-col gap-px">
            <For each={home.allTags()}>
              {(tag) => (
                <ScopeRow
                  label={`#${tag}`}
                  count={home.scopeCounts().tags.get(tag) ?? 0}
                  active={isSameScope(home.scope(), tagScope(tag))}
                  testId={`home-scope-tag-${tag}`}
                  onSelect={() => select(tagScope(tag))}
                />
              )}
            </For>
          </div>
        </Show>
      </nav>

      {/* Mirrors the status strip: never claim on-device while a cloud session
          is persisting resumes to Rustume Cloud. */}
      <div
        class="mt-auto flex items-center gap-2 border-t border-border px-3 py-3 font-mono
          text-[9.5px] uppercase tracking-[0.1em] text-stone"
        data-testid="home-scope-rail-storage"
      >
        <span class="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" aria-hidden="true" />
        <Show when={home.syncEnabled()} fallback="on-device">
          cloud
        </Show>
        <span class="ml-auto opacity-75">
          {home.scopeCounts().total} {home.scopeCounts().total === 1 ? "resume" : "resumes"}
        </span>
      </div>
    </aside>
  );
}
