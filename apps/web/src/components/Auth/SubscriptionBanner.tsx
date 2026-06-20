import { Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { authStore } from "../../stores/auth";

const COUNTDOWN_REFRESH_MS = 60_000;

function daysUntil(isoDate: string): number {
  const end = new Date(isoDate).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
}

function formatExpiryDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Banner shown during subscription cancellation grace period. */
export function SubscriptionBanner() {
  const { state } = authStore;
  const [now, setNow] = createSignal(Date.now());

  onMount(() => {
    const timer = window.setInterval(() => setNow(Date.now()), COUNTDOWN_REFRESH_MS);
    onCleanup(() => window.clearInterval(timer));
  });

  const grace = createMemo(() => {
    void now();
    const user = state.user;
    if (!user?.subscription) return null;

    const { status, expires_at: expiresAt } = user.subscription;
    if (status !== "canceled" && status !== "past_due" && status !== "paused") {
      return null;
    }
    if (!expiresAt) return null;

    const remaining = daysUntil(expiresAt);
    if (remaining <= 0) return null;

    return { expiresAt, remaining };
  });

  return (
    <Show when={state.cloudEnabled && grace()}>
      {(info) => (
        <div
          class="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          <div class="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Your cloud subscription ends on {formatExpiryDate(info().expiresAt)} (
              {info().remaining} {info().remaining === 1 ? "day" : "days"} remaining). Export your
              resumes before access ends.
            </p>
            <a
              href="/account#export"
              class="inline-flex items-center justify-center rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-border/50"
            >
              Export data
            </a>
          </div>
        </div>
      )}
    </Show>
  );
}
