import { For, onCleanup, onMount, Show, type JSX } from "solid-js";
import { Button } from "../../components/ui";
import {
  folderScope,
  isSameScope,
  SCOPE_ALL,
  SCOPE_LOCKED,
  tagScope,
  type HomeScope,
} from "../../lib/homeScope";
import { MAX_FOLDER_NAME_LENGTH } from "../../lib/homeFolders";
import { HOME_SIDEBAR_ID } from "../../stores/homeSidebar";
import type { HomePageModel } from "./useHomePage";

function rowClass(active: boolean): string {
  return `flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs
    transition-colors motion-reduce:transition-none focus:outline-none focus-visible:ring-2
    focus-visible:ring-accent ${
      active
        ? "bg-accent-light text-ink shadow-[inset_2px_0_0_var(--color-accent)]"
        : "text-stone hover:bg-accent-light hover:text-ink"
    }`;
}

/**
 * Everything inside the rail a Tab can land on; the rail itself is tabindex -1.
 *
 * Includes inputs: the folder name field can be the last focusable thing in the
 * rail, and omitting it lets Tab escape the drawer it is meant to trap.
 */
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keep Tab inside the open drawer.
 *
 * Only the library is marked inert, so without this the next Tab escapes into
 * the app shell sitting behind the scrim.
 */
function trapTab(event: KeyboardEvent, rail: HTMLElement | undefined): void {
  if (!rail) return;
  const focusable = [...rail.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) return;

  const active = document.activeElement;
  if (!rail.contains(active)) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && (active === first || active === rail)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
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

/** Dashed mono affordance, matching the card's `+ Tag` control. */
function DashedRailButton(props: {
  label: string;
  testId: string;
  ariaLabel?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      class="mt-0.5 inline-flex w-full items-center rounded-md border border-dashed border-border
        px-2 py-1 font-mono text-[10px] text-stone transition-colors motion-reduce:transition-none
        hover:border-accent hover:bg-accent-light hover:text-ink focus:outline-none
        focus-visible:ring-2 focus-visible:ring-accent"
      onClick={props.onClick}
      aria-label={props.ariaLabel}
      data-testid={props.testId}
    >
      {props.label}
    </button>
  );
}

/** Inline mono field shared by folder creation and folder rename. */
function FolderNameField(props: {
  value: string;
  placeholder: string;
  ariaLabel: string;
  testId: string;
  onInput: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <form
      class="mt-0.5"
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit();
      }}
    >
      <input
        type="text"
        class="w-full rounded-md border border-accent/40 bg-surface px-2 py-1 font-mono text-[10px]
          text-ink placeholder:text-stone/70 focus:border-accent focus:outline-none
          focus:ring-1 focus:ring-accent/30"
        placeholder={props.placeholder}
        aria-label={props.ariaLabel}
        maxLength={MAX_FOLDER_NAME_LENGTH}
        value={props.value}
        data-testid={props.testId}
        onInput={(event) => props.onInput(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            props.onCancel();
          }
        }}
        ref={(el) => setTimeout(() => el?.focus(), 0)}
      />
    </form>
  );
}

/**
 * One folder in the rail.
 *
 * The row itself scopes the library; rename and delete replace the count on
 * hover or keyboard focus, so the resting state stays identical to a tag row.
 */
function FolderRow(props: {
  folder: string;
  count: number;
  active: boolean;
  busy: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <div class="group/folder relative flex items-center">
      <button
        type="button"
        class={rowClass(props.active)}
        aria-pressed={props.active}
        onClick={props.onSelect}
        data-testid={`home-scope-folder-${props.folder}`}
      >
        <span class="truncate">/{props.folder}</span>
        <span
          class="flex-shrink-0 font-mono text-[10px] text-stone transition-opacity
            motion-reduce:transition-none group-hover/folder:opacity-0
            group-focus-within/folder:opacity-0"
          data-testid={`home-scope-folder-count-${props.folder}`}
        >
          {props.count}
        </span>
      </button>
      <div
        class="pointer-events-none absolute right-1.5 flex items-center gap-0.5 opacity-0
          transition-opacity motion-reduce:transition-none group-hover/folder:pointer-events-auto
          group-hover/folder:opacity-100 group-focus-within/folder:pointer-events-auto
          group-focus-within/folder:opacity-100"
      >
        <button
          type="button"
          class="rounded p-1 text-stone transition-colors motion-reduce:transition-none
            hover:bg-accent/10 hover:text-ink disabled:opacity-50 focus:outline-none
            focus-visible:ring-2 focus-visible:ring-accent"
          onClick={props.onRename}
          disabled={props.busy}
          title={`Rename folder ${props.folder}`}
          aria-label={`Rename folder ${props.folder}`}
          data-testid={`home-scope-folder-rename-${props.folder}`}
        >
          <svg
            class="h-3 w-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        </button>
        <button
          type="button"
          class="rounded p-1 text-stone transition-colors motion-reduce:transition-none
            hover:bg-red-50 hover:text-red-600 disabled:opacity-50 focus:outline-none
            focus-visible:ring-2 focus-visible:ring-accent"
          onClick={props.onDelete}
          disabled={props.busy}
          title={`Delete folder ${props.folder}`}
          aria-label={`Delete folder ${props.folder}`}
          data-testid={`home-scope-folder-delete-${props.folder}`}
        >
          <svg
            class="h-3 w-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * Additive scope rail. It decides *which* resumes the library shows; the
 * List/Grid/Gallery switcher decides how they render.
 */
export function HomeSidebar(props: { home: HomePageModel; isDrawer: () => boolean }) {
  const { home } = props;
  let rail: HTMLElement | undefined = undefined;

  const select = (scope: HomeScope) => {
    home.setScope(scope);
    // A drawer that stays open over the result hides the thing it just filtered.
    if (props.isDrawer()) home.setSidebarOpen(false);
  };

  onMount(() => {
    // Whatever opened the drawer gets focus back when it goes away, so a
    // keyboard user resumes where they left off instead of at the document.
    const invoker = props.isDrawer() ? document.activeElement : null;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!props.isDrawer()) return;
      // The drawer behaves as a modal layer, so Escape has to dismiss it.
      if (event.key === "Escape") {
        home.setSidebarOpen(false);
        return;
      }
      // ...and Tab must not walk out of it into the app behind the scrim.
      if (event.key !== "Tab") return;
      trapTab(event, rail);
    };
    document.addEventListener("keydown", handleKeyDown);

    onCleanup(() => {
      document.removeEventListener("keydown", handleKeyDown);
      // Deferred: the toggle sits inside the library, which is still `inert`
      // until this same update clears it — an inert element cannot take focus.
      queueMicrotask(() => {
        if (invoker instanceof HTMLElement && document.contains(invoker)) invoker.focus();
      });
    });

    if (props.isDrawer()) rail?.focus();
  });

  return (
    <aside
      ref={(el) => (rail = el)}
      id={HOME_SIDEBAR_ID}
      aria-label="Library scope"
      tabindex={-1}
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

        <GroupHeading id="home-scope-group-folders">Folders</GroupHeading>
        <div role="group" aria-labelledby="home-scope-group-folders" class="flex flex-col gap-px">
          <For each={home.allFolders()}>
            {(folder) => (
              <Show
                when={home.renamingFolder() !== folder}
                fallback={
                  <FolderNameField
                    value={home.folderRenameValue()}
                    placeholder="Folder name"
                    ariaLabel={`Rename folder ${folder}`}
                    testId="home-scope-folder-rename-input"
                    onInput={home.setFolderRenameValue}
                    onSubmit={() => void home.confirmFolderRename(folder)}
                    onCancel={home.cancelFolderRename}
                  />
                }
              >
                <FolderRow
                  folder={folder}
                  count={home.folderCount(folder)}
                  active={isSameScope(home.scope(), folderScope(folder))}
                  busy={home.folderBusy()}
                  onSelect={() => select(folderScope(folder))}
                  onRename={() => home.startFolderRename(folder)}
                  onDelete={() => void home.handleDeleteFolder(folder)}
                />
              </Show>
            )}
          </For>

          <Show
            when={home.folderCreating()}
            fallback={
              <DashedRailButton
                label="+ New folder"
                ariaLabel="Create folder"
                testId="home-scope-folder-new"
                onClick={home.openFolderCreator}
              />
            }
          >
            <FolderNameField
              value={home.folderDraft()}
              placeholder="Folder name"
              ariaLabel="New folder name"
              testId="home-scope-folder-input"
              onInput={home.setFolderDraft}
              onSubmit={() => home.handleCreateFolder()}
              onCancel={home.closeFolderCreator}
            />
          </Show>

          {/* Unfiled is a count, not a scope: resumes without a folder are
              already exactly what All shows minus the filed ones. */}
          <Show when={home.scopeCounts().unfiled > 0 && home.allFolders().length > 0}>
            <p
              class="px-2 pt-1 font-mono text-[10px] text-stone"
              data-testid="home-scope-folder-unfiled"
            >
              {home.scopeCounts().unfiled} unfiled
            </p>
          </Show>
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
