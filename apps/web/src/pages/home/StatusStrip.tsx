import { Show } from "solid-js";
import type { HomePageModel } from "./useHomePage";

function Separator() {
  return <span class="h-2.5 w-px flex-shrink-0 bg-border" aria-hidden="true" />;
}

/**
 * Terminal-style live status for the library: the privacy/offline claims the old
 * marketing footer asserted, expressed as product state instead of copy.
 */
export function StatusStrip(props: { home: HomePageModel }) {
  const { home } = props;
  const count = () => home.resumeCount();

  return (
    <div
      class="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 border-y border-border py-2
        font-mono text-[10px] uppercase tracking-[0.09em] text-stone"
      data-testid="home-status-strip"
      role="status"
      aria-live="polite"
    >
      <span>
        <strong class="font-semibold text-ink">{count()}</strong>{" "}
        {count() === 1 ? "resume" : "resumes"}
      </span>
      <Separator />
      <span>
        last edit <strong class="font-semibold text-ink">{home.lastEditLabel()}</strong>
      </span>
      <Separator />
      <span class="inline-flex items-center gap-1.5">
        <span
          class="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-subtle motion-reduce:animate-none"
          aria-hidden="true"
        />
        on-device
      </span>
      <Separator />
      <span>
        sync{" "}
        <Show when={home.syncEnabled()} fallback="off">
          on
        </Show>
      </span>
      <span class="ml-auto" data-testid="home-status-view">
        view: <b class="font-semibold text-accent">{home.layout()}</b> · scope:{" "}
        <b class="font-semibold text-accent">{home.scope()}</b>
      </span>
    </div>
  );
}
