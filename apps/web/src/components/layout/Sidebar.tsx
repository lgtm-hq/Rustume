import { For, Show, createSignal, createEffect, onCleanup } from "solid-js";
import { Tooltip } from "@kobalte/core/tooltip";
import { uiStore } from "../../stores/ui";

export interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  group?: string;
  children?: SidebarItem[];
}

interface SidebarProps {
  items: SidebarItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function Sidebar(props: SidebarProps) {
  const { store: ui } = uiStore;
  const [isPinned, setIsPinned] = createSignal(false);
  const [isHovered, setIsHovered] = createSignal(false);
  const [isKeyboardFocused, setIsKeyboardFocused] = createSignal(false);
  const [isExpanded, setIsExpanded] = createSignal(false);

  // Expand when pinned, hovered, or focused by keyboard navigation.
  createEffect(() => {
    setIsExpanded(isPinned() || isHovered() || isKeyboardFocused());
  });

  // Debounce hover to prevent flicker
  let hoverTimeout: ReturnType<typeof setTimeout> | null = null;

  const handleMouseEnter = () => {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    hoverTimeout = setTimeout(() => {
      setIsHovered(false);
    }, 150);
  };

  const handleFocusOut = (event: FocusEvent) => {
    const nextTarget = event.relatedTarget;
    const currentTarget = event.currentTarget as HTMLDivElement | null;
    if (currentTarget && nextTarget instanceof Node && currentTarget.contains(nextTarget)) return;
    setIsKeyboardFocused(false);
  };

  onCleanup(() => {
    if (hoverTimeout) clearTimeout(hoverTimeout);
  });

  const isItemActive = (item: SidebarItem): boolean =>
    props.activeId === item.id ||
    Boolean(item.children?.some((child) => props.activeId === child.id));

  const startsGroup = (index: number): boolean => {
    if (index === 0) return Boolean(props.items[index]?.group);
    return props.items[index]?.group !== props.items[index - 1]?.group;
  };

  const renderIcon = (icon: string, className = "w-5 h-5") => (
    <svg class={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={icon} />
    </svg>
  );

  return (
    <Show when={ui.sidebarOpen}>
      <div
        class="h-full bg-surface border-r border-border flex flex-col py-2 transition-all duration-200 ease-out"
        style={{ width: isExpanded() ? "180px" : "56px" }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocusIn={() => setIsKeyboardFocused(true)}
        onFocusOut={handleFocusOut}
      >
      {/* Pin Button */}
      <div class="px-2 mb-2">
        <button
          type="button"
          class={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors
            ${isPinned() ? "bg-accent/10 text-accent" : "text-stone hover:text-ink hover:bg-paper"}`}
          onClick={() => setIsPinned(!isPinned())}
          title={isPinned() ? "Unpin sidebar" : "Pin sidebar"}
          aria-label={isPinned() ? "Unpin sidebar" : "Pin sidebar"}
          aria-pressed={isPinned()}
        >
          <svg
            class={`w-4 h-4 flex-shrink-0 transition-transform ${isPinned() ? "" : "rotate-45"}`}
            fill={isPinned() ? "currentColor" : "none"}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 5a2 2 0 012-2h10a2 2 0 012 2v3a1 1 0 01-1 1h-2l-1 8h-6l-1-8H6a1 1 0 01-1-1V5z"
            />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 17v4" />
          </svg>
          <Show when={isExpanded()}>
            <span class="text-xs font-mono truncate">{isPinned() ? "Pinned" : "Pin"}</span>
          </Show>
        </button>
      </div>

      <div class="h-px bg-border mx-2 mb-2" />

      {/* Navigation Items */}
      <nav class="flex-1 overflow-auto px-2">
        <For each={props.items}>
          {(item, index) => (
            <div class={startsGroup(index()) ? "mt-3 first:mt-0" : "mt-1"}>
              <Show when={startsGroup(index())}>
                <Show
                  when={isExpanded()}
                  fallback={
                    <Show when={index() > 0}>
                      <div class="mx-1 mb-2 h-px bg-border/80" aria-hidden="true" />
                    </Show>
                  }
                >
                  <div class="mb-1 px-2 text-[10px] font-mono uppercase tracking-wider text-stone/70">
                    {item.group}
                  </div>
                </Show>
              </Show>

              <Show
                when={isExpanded()}
                fallback={
                  <Tooltip placement="right" openDelay={100} closeDelay={0}>
                    <Tooltip.Trigger
                      as="button"
                      type="button"
                      aria-label={item.label}
                      aria-expanded={item.children?.length ? isExpanded() : undefined}
                      class={`w-full p-2.5 flex items-center justify-center rounded-lg transition-colors
                        ${
                          isItemActive(item)
                            ? "text-accent bg-accent/10"
                            : "text-stone hover:text-ink hover:bg-paper"
                        }`}
                      onClick={() => props.onSelect(item.id)}
                    >
                      {renderIcon(item.icon)}
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content class="z-50 px-2.5 py-1.5 bg-ink text-paper text-xs font-medium rounded-lg shadow-lg animate-fade-in">
                        {item.label}
                        <Tooltip.Arrow />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip>
                }
              >
                <div>
                  <button
                    type="button"
                    aria-label={item.label}
                    aria-expanded={item.children?.length ? isExpanded() : undefined}
                    class={`w-full px-2.5 py-2 flex items-center gap-3 rounded-lg transition-colors
                      ${
                        isItemActive(item)
                          ? "text-accent bg-accent/10"
                          : "text-stone hover:text-ink hover:bg-paper"
                      }`}
                    onClick={() => props.onSelect(item.id)}
                  >
                    {renderIcon(item.icon, "w-5 h-5 flex-shrink-0")}
                    <span class="text-sm font-body truncate">{item.label}</span>
                  </button>

                  <Show when={item.children?.length}>
                    <div class="mt-1 ml-4 pl-2 border-l border-border/70 space-y-1">
                      <For each={item.children}>
                        {(child) => (
                          <button
                            type="button"
                            aria-label={child.label}
                            class={`w-full px-2 py-1.5 flex items-center gap-2 rounded-lg transition-colors
                              ${
                                props.activeId === child.id
                                  ? "text-accent bg-accent/10"
                                  : "text-stone hover:text-ink hover:bg-paper"
                              }`}
                            onClick={() => props.onSelect(child.id)}
                          >
                            {renderIcon(child.icon, "w-4 h-4 flex-shrink-0")}
                            <span class="text-xs font-body truncate">{child.label}</span>
                          </button>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              </Show>
            </div>
          )}
        </For>
      </nav>
      </div>
    </Show>
  );
}
