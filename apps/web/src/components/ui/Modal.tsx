import { Dialog } from "@kobalte/core/dialog";
import { type ParentComponent, Show } from "solid-js";

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  size?: "sm" | "md" | "lg" | "xl";
  /** When false, Escape/backdrop/close button cannot dismiss the dialog. */
  dismissible?: boolean;
}

const SIZE_CLASSES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
} as const;

export const Modal: ParentComponent<ModalProps> = (props) => {
  const size = () => props.size || "md";
  const dismissible = () => props.dismissible !== false;

  const handleOpenChange = (open: boolean) => {
    if (!open && !dismissible()) return;
    props.onOpenChange(open);
  };

  return (
    <Dialog open={props.open} onOpenChange={handleOpenChange} modal>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 bg-ink/40 backdrop-blur-sm z-40 animate-fade-in" />
        <div class="fixed inset-0 flex items-center justify-center z-50 p-4">
          <Dialog.Content
            class={`bg-paper rounded-xl shadow-elevated w-full ${SIZE_CLASSES[size()]}
              animate-slide-up overflow-hidden`}
            onPointerDownOutside={(event) => {
              if (!dismissible()) event.preventDefault();
            }}
            onEscapeKeyDown={(event) => {
              if (!dismissible()) event.preventDefault();
            }}
          >
            <div class="px-6 py-5 border-b border-border">
              <Dialog.Title class="font-display text-xl font-semibold text-ink">
                {props.title}
              </Dialog.Title>
              <Show when={props.description}>
                <Dialog.Description class="mt-1 text-sm text-stone">
                  {props.description}
                </Dialog.Description>
              </Show>
            </div>

            <div class="px-6 py-5">{props.children}</div>

            <Show when={dismissible()}>
              <Dialog.CloseButton
                class="absolute top-4 right-4 p-2 text-stone hover:text-ink
                hover:bg-surface rounded-lg transition-colors"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </Dialog.CloseButton>
            </Show>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
};
