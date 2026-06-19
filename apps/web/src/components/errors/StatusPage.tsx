import { A } from "@solidjs/router";
import { Show, type JSX } from "solid-js";
import { Button } from "../ui";

export interface StatusPageAction {
  label: string;
  onClick?: () => void;
  href?: string;
  loading?: boolean;
  variant?: "primary" | "secondary";
}

export interface StatusPageProps {
  /** HTTP-style status code shown in the hero. */
  statusCode: string;
  /** Short page title. */
  title: string;
  /** Supporting copy beneath the title. */
  description: string;
  /** Primary call to action. */
  primaryAction: StatusPageAction;
  /** Optional secondary action rendered as a text link. */
  secondaryAction?: StatusPageAction;
  /** Optional decorative icon rendered above the title. */
  icon?: JSX.Element;
  /** Optional test id for the page root. */
  testId?: string;
}

/** Shared layout for application error and auth-required pages. */
export function StatusPage(props: StatusPageProps) {
  return (
    <div
      class="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden px-4 py-16"
      data-testid={props.testId}
    >
      <div
        class="pointer-events-none absolute inset-0 flex items-center justify-center select-none"
        aria-hidden="true"
      >
        <span class="font-display text-[10rem] font-bold leading-none text-ink/[0.04] md:text-[14rem]">
          {props.statusCode}
        </span>
      </div>

      <section
        class="relative z-10 w-full max-w-xl animate-slide-up text-center"
        aria-labelledby="status-page-title"
      >
        <Show when={props.icon}>
          <div class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface shadow-soft">
            {props.icon}
          </div>
        </Show>

        <p class="font-mono text-xs uppercase tracking-[0.3em] text-stone">{props.statusCode}</p>
        <h1
          id="status-page-title"
          class="mt-3 font-display text-3xl font-semibold text-ink md:text-4xl"
        >
          {props.title}
        </h1>
        <p class="mx-auto mt-4 max-w-md text-base leading-7 text-stone">{props.description}</p>

        <div class="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Show
            when={props.primaryAction.href}
            fallback={
              <Button
                size="lg"
                variant={props.primaryAction.variant === "secondary" ? "secondary" : undefined}
                onClick={() => props.primaryAction.onClick?.()}
                loading={props.primaryAction.loading}
              >
                {props.primaryAction.label}
              </Button>
            }
          >
            {(href) => (
              <A
                href={href()}
                class="inline-flex items-center justify-center rounded-lg bg-ink px-6 py-3 text-base font-medium text-paper shadow-soft transition-all hover:bg-ink/90"
              >
                {props.primaryAction.label}
              </A>
            )}
          </Show>

          <Show when={props.secondaryAction}>
            {(action) => (
              <Show
                when={action().href}
                fallback={
                  <button
                    type="button"
                    class="text-sm font-medium text-accent hover:underline"
                    onClick={() => action().onClick?.()}
                  >
                    {action().label}
                  </button>
                }
              >
                {(href) => (
                  <A href={href()} class="text-sm font-medium text-accent hover:underline">
                    {action().label}
                  </A>
                )}
              </Show>
            )}
          </Show>
        </div>
      </section>
    </div>
  );
}
