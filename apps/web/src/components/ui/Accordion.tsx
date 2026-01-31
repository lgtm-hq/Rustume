import { Accordion as KobalteAccordion } from "@kobalte/core/accordion";
import { type ParentComponent, type JSX, For, Show } from "solid-js";

export interface AccordionItemData {
  value: string;
  title: string;
  subtitle?: string;
  badge?: string;
  children: JSX.Element;
}

export interface AccordionProps {
  items: AccordionItemData[];
  defaultValue?: string[];
  multiple?: boolean;
  collapsible?: boolean;
}

export const Accordion: ParentComponent<AccordionProps> = (props) => {
  return (
    <KobalteAccordion
      class="space-y-2"
      defaultValue={props.defaultValue}
      multiple={props.multiple ?? true}
      collapsible={props.collapsible ?? true}
    >
      <For each={props.items}>
        {(item) => (
          <KobalteAccordion.Item value={item.value} class="group">
            <KobalteAccordion.Header class="flex">
              <KobalteAccordion.Trigger
                class="flex-1 flex items-center justify-between px-4 py-3
                  bg-surface rounded-lg border border-border
                  hover:bg-border/30 transition-colors duration-150
                  group-data-[expanded]:rounded-b-none group-data-[expanded]:border-b-0
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div class="flex items-center gap-3">
                  <span class="font-body font-medium text-ink">{item.title}</span>
                  <Show when={item.subtitle}>
                    <span class="text-sm text-stone">{item.subtitle}</span>
                  </Show>
                  <Show when={item.badge}>
                    <span class="px-2 py-0.5 text-xs font-mono bg-accent/10 text-accent rounded-full">
                      {item.badge}
                    </span>
                  </Show>
                </div>

                <svg
                  class="w-5 h-5 text-stone transition-transform duration-200
                    group-data-[expanded]:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </KobalteAccordion.Trigger>
            </KobalteAccordion.Header>

            <KobalteAccordion.Content
              class="overflow-hidden bg-surface border border-t-0 border-border rounded-b-lg
                data-[expanded]:animate-accordion-down data-[closed]:animate-accordion-up"
            >
              <div class="px-4 py-4 stagger-children">{item.children}</div>
            </KobalteAccordion.Content>
          </KobalteAccordion.Item>
        )}
      </For>
    </KobalteAccordion>
  );
};

// Add accordion animation to CSS
const style = document.createElement("style");
style.textContent = `
  @keyframes accordion-down {
    from { height: 0; opacity: 0; }
    to { height: var(--kb-accordion-content-height); opacity: 1; }
  }
  @keyframes accordion-up {
    from { height: var(--kb-accordion-content-height); opacity: 1; }
    to { height: 0; opacity: 0; }
  }
  [data-kb-accordion-content][data-expanded] {
    animation: accordion-down 200ms ease-out;
  }
  [data-kb-accordion-content][data-closed] {
    animation: accordion-up 200ms ease-out;
  }
`;
document.head.appendChild(style);
