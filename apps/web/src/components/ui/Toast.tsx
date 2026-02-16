import * as ToastPrimitive from "@kobalte/core/toast";
import type { Component } from "solid-js";

type ToastVariant = "success" | "error" | "warning" | "info";

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: "border-l-[var(--turbo-state-success)]",
  error: "border-l-[var(--turbo-state-danger)]",
  warning: "border-l-[var(--turbo-state-warning)]",
  info: "border-l-[var(--turbo-brand-primary)]",
};

const VARIANT_ICON_CLASSES: Record<ToastVariant, string> = {
  success: "text-[var(--turbo-state-success)]",
  error: "text-[var(--turbo-state-danger)]",
  warning: "text-[var(--turbo-state-warning)]",
  info: "text-[var(--turbo-brand-primary)]",
};

const VARIANT_PROGRESS_CLASSES: Record<ToastVariant, string> = {
  success: "bg-[var(--turbo-state-success)]",
  error: "bg-[var(--turbo-state-danger)]",
  warning: "bg-[var(--turbo-state-warning)]",
  info: "bg-[var(--turbo-brand-primary)]",
};

const VARIANT_ICONS: Record<ToastVariant, string> = {
  success: "M5 13l4 4L19 7",
  error: "M6 18L18 6M6 6l12 12",
  warning:
    "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
};

const DEFAULT_DURATION: Record<ToastVariant, number> = {
  success: 4000,
  error: 6000,
  warning: 6000,
  info: 4000,
};

interface ToastContentProps {
  toastId: number;
  variant: ToastVariant;
  title?: string;
  description: string;
  duration: number;
}

const ToastContent: Component<ToastContentProps> = (props) => {
  return (
    <ToastPrimitive.Root
      toastId={props.toastId}
      duration={props.duration}
      class={`bg-surface border-l-4 ${VARIANT_CLASSES[props.variant]}
        rounded-lg shadow-card p-4 w-80 relative overflow-hidden`}
    >
      <div class="flex items-start gap-3">
        <svg
          class={`w-5 h-5 flex-shrink-0 mt-0.5 ${VARIANT_ICON_CLASSES[props.variant]}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d={VARIANT_ICONS[props.variant]}
          />
        </svg>

        <div class="flex-1 min-w-0">
          {props.title && (
            <ToastPrimitive.Title class="text-sm font-semibold text-ink">
              {props.title}
            </ToastPrimitive.Title>
          )}
          <ToastPrimitive.Description class="text-sm text-stone">
            {props.description}
          </ToastPrimitive.Description>
        </div>

        <ToastPrimitive.CloseButton
          class="p-1 text-stone hover:text-ink hover:bg-paper rounded transition-colors flex-shrink-0"
          aria-label="Dismiss"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </ToastPrimitive.CloseButton>
      </div>

      <ToastPrimitive.ProgressTrack class="absolute bottom-0 left-0 right-0 h-0.5 bg-border/30">
        <ToastPrimitive.ProgressFill
          class={`h-full ${VARIANT_PROGRESS_CLASSES[props.variant]} opacity-40`}
          style={{ width: "var(--kb-toast-progress-fill-width)" }}
        />
      </ToastPrimitive.ProgressTrack>
    </ToastPrimitive.Root>
  );
};

export const ToastRegion: Component = () => {
  return (
    <ToastPrimitive.Region swipeDirection="right" limit={5}>
      <ToastPrimitive.List class="fixed bottom-4 right-4 flex flex-col gap-2 z-50 outline-none" />
    </ToastPrimitive.Region>
  );
};

interface ShowOptions {
  variant: ToastVariant;
  description: string;
  title?: string;
  duration?: number;
}

function show(options: ShowOptions) {
  const duration = options.duration ?? DEFAULT_DURATION[options.variant];
  ToastPrimitive.toaster.show((props) => (
    <ToastContent
      toastId={props.toastId}
      variant={options.variant}
      title={options.title}
      description={options.description}
      duration={duration}
    />
  ));
}

export const toast = {
  success: (description: string, title?: string) =>
    show({ variant: "success", description, title }),
  error: (description: string, title?: string) => show({ variant: "error", description, title }),
  warning: (description: string, title?: string) =>
    show({ variant: "warning", description, title }),
  info: (description: string, title?: string) => show({ variant: "info", description, title }),
};
