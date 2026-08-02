import { Dialog } from "@kobalte/core/dialog";
import { type ParentComponent, Show } from "solid-js";

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Edge the drawer slides in from. Defaults to `right`. */
  side?: "left" | "right";
}

/**
 * A side sheet built on the same Kobalte dialog as `Modal` — focus trap,
 * Escape-to-close and ARIA labelling for free — but anchored to a screen
 * edge so it reads as chrome around the page rather than an interruption.
 */
export const Drawer: ParentComponent<DrawerProps> = (props) => {
  const sideClass = () =>
    props.side === "left"
      ? "left-0 border-r animate-slide-in-left"
      : "right-0 border-l animate-slide-in-right";

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 bg-ink/40 backdrop-blur-sm z-40 animate-fade-in" />
        <Dialog.Content
          class={`fixed inset-y-0 z-50 flex w-full max-w-sm flex-col border-border bg-paper
            shadow-elevated ${sideClass()}`}
        >
          <div class="border-b border-border px-5 py-4">
            <Dialog.Title class="font-display text-lg font-semibold text-ink">
              {props.title}
            </Dialog.Title>
            <Show when={props.description}>
              <Dialog.Description class="mt-1 text-sm text-stone">
                {props.description}
              </Dialog.Description>
            </Show>
          </div>

          <div class="flex-1 overflow-y-auto px-5 py-4">{props.children}</div>

          <Dialog.CloseButton
            aria-label="Close"
            class="focus-ring absolute top-3 right-3 rounded-lg p-2 text-stone transition-colors
              hover:bg-surface hover:text-ink"
          >
            <svg
              class="w-5 h-5"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </Dialog.CloseButton>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};
