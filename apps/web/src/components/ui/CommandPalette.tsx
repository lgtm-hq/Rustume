import { Dialog } from "@kobalte/core/dialog";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { uiStore } from "../../stores/ui";

const RECENT_STORAGE_KEY = "rustume.commandPalette.recent";
const MAX_RECENT = 5;

export interface CommandAction {
  id: string;
  label: string;
  keywords?: string;
  group?: string;
  handler: () => void;
}

export interface CommandPaletteProps {
  actions: CommandAction[];
}

/** Returns true when query matches text via substring or sequential character match. */
export function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase();
  if (!q) return true;
  if (t.includes(q)) return true;

  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

function getRecentIds(): string[] {
  try {
    const raw = sessionStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function pushRecent(id: string) {
  const recent = getRecentIds().filter((entry) => entry !== id);
  recent.unshift(id);
  sessionStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

export function CommandPalette(props: CommandPaletteProps) {
  const { store: ui, closeModal } = uiStore;
  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;

  const [query, setQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [recentIds, setRecentIds] = createSignal<string[]>(getRecentIds());

  const isOpen = () => ui.modal === "commandPalette";

  const actionMap = createMemo(() => {
    const map = new Map<string, CommandAction>();
    for (const action of props.actions) {
      map.set(action.id, action);
    }
    return map;
  });

  const filteredActions = createMemo(() => {
    const q = query().trim();
    const matches = props.actions.filter((action) => {
      const haystack = `${action.label} ${action.keywords ?? ""} ${action.group ?? ""}`;
      return fuzzyMatch(q, haystack);
    });

    if (!q) {
      const recentActions = recentIds()
        .map((id) => actionMap().get(id))
        .filter((action): action is CommandAction => action !== undefined)
        .filter((action) => matches.some((match) => match.id === action.id));

      const recentSet = new Set(recentActions.map((action) => action.id));
      const rest = matches.filter((action) => !recentSet.has(action.id));
      return [...recentActions, ...rest];
    }

    return matches;
  });

  const recentCount = createMemo(() => {
    if (query().trim()) return 0;
    const matchIds = new Set(filteredActions().map((action) => action.id));
    return recentIds().filter((id) => matchIds.has(id)).length;
  });

  createEffect(() => {
    filteredActions();
    setSelectedIndex(0);
  });

  createEffect(() => {
    if (!isOpen()) return;
    setQuery("");
    setSelectedIndex(0);
    setRecentIds(getRecentIds());
    queueMicrotask(() => inputRef?.focus());
  });

  createEffect(() => {
    const index = selectedIndex();
    const list = listRef;
    if (!list) return;
    const item = list.querySelector<HTMLElement>(`[data-index="${index}"]`);
    item?.scrollIntoView?.({ block: "nearest" });
  });

  const handleOpenChange = (open: boolean) => {
    if (!open) closeModal();
  };

  const executeAction = (action: CommandAction) => {
    pushRecent(action.id);
    setRecentIds(getRecentIds());
    closeModal();
    action.handler();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const items = filteredActions();
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((index) => Math.min(index + 1, Math.max(items.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const action = items[selectedIndex()];
      if (action) executeAction(action);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
    }
  };

  return (
    <Dialog open={isOpen()} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 bg-ink/40 backdrop-blur-sm z-40 animate-fade-in" />
        <div class="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[15vh]">
          <Dialog.Content
            class="bg-paper rounded-xl shadow-elevated w-full max-w-lg animate-slide-up overflow-hidden"
            onKeyDown={handleKeyDown}
          >
            <div class="flex items-center gap-3 border-b border-border px-4 py-3">
              <svg
                class="h-5 w-5 flex-shrink-0 text-stone"
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
              <input
                ref={(el) => {
                  inputRef = el;
                }}
                type="text"
                class="flex-1 bg-transparent text-sm text-ink placeholder:text-stone outline-none"
                placeholder="Search commands..."
                aria-label="Search commands"
                value={query()}
                onInput={(event) => setQuery(event.currentTarget.value)}
              />
              <kbd class="hidden sm:inline text-xs font-mono bg-surface border border-border rounded px-1.5 py-0.5 text-stone">
                Esc
              </kbd>
            </div>

            <div
              ref={(el) => {
                listRef = el;
              }}
              class="max-h-80 overflow-y-auto p-2"
              role="listbox"
              aria-label="Commands"
            >
              <Show
                when={filteredActions().length > 0}
                fallback={<p class="px-3 py-6 text-center text-sm text-stone">No matching commands</p>}
              >
                <For each={filteredActions()}>
                  {(action, index) => (
                    <>
                      <Show when={!query().trim() && index() === 0 && recentCount() > 0}>
                        <div class="px-3 pb-1 pt-2 text-[10px] font-mono uppercase tracking-wider text-stone/70">
                          Recent
                        </div>
                      </Show>
                      <Show
                        when={
                          !query().trim() &&
                          recentCount() > 0 &&
                          index() === recentCount() &&
                          index() < filteredActions().length
                        }
                      >
                        <div class="px-3 pb-1 pt-3 text-[10px] font-mono uppercase tracking-wider text-stone/70">
                          All commands
                        </div>
                      </Show>
                      <button
                        type="button"
                        role="option"
                        data-index={index()}
                        aria-selected={selectedIndex() === index()}
                        class={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors
                          ${
                            selectedIndex() === index()
                              ? "bg-accent/10 text-accent"
                              : "text-ink hover:bg-surface"
                          }`}
                        onMouseEnter={() => setSelectedIndex(index())}
                        onClick={() => executeAction(action)}
                      >
                        <span>{action.label}</span>
                        <Show when={action.group}>
                          <span class="text-xs text-stone">{action.group}</span>
                        </Show>
                      </button>
                    </>
                  )}
                </For>
              </Show>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
}
