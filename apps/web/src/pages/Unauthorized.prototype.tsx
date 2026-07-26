/*
 * PROTOTYPE — THROWAWAY. DO NOT SHIP.
 *
 * Question: what should the signed-out entry experience on app.rustume.com be,
 * given someone arriving cold from rustume.com?
 *
 * Three structurally different variants of the page currently rendered as the
 * 401 "Sign in required" screen, switchable via ?variant=A|B|C on the real
 * Unauthorized path. Locally, reach it with ?forceUnauthorized=1 (dev only).
 *
 * Each variant mounts its own <SignInDialog />, which is the fix #589 needs —
 * so the sign-in button actually works here, unlike production today.
 */
import { A, useNavigate, useSearchParams } from "@solidjs/router";
import { For, onCleanup, onMount, Show } from "solid-js";
import { SignInDialog } from "../components/Auth/SignInDialog";
import { Button } from "../components/ui";
import { authStore } from "../stores/auth";

export const PROTOTYPE_VARIANTS = ["D3", "D2", "D", "A", "B", "C"] as const;
export type PrototypeVariant = (typeof PROTOTYPE_VARIANTS)[number];

export const VARIANT_NAMES: Record<PrototypeVariant, string> = {
  D3: "A hero + B panels — one screen",
  D2: "D tightened — CTA above the fold",
  D: "A+B combo — hero, fork, Why Rustume",
  A: "Continuation — marketing hero",
  B: "Fork — cloud vs on-device",
  C: "Preview — sign in over the workspace",
};

const MARKETING_URL = "https://rustume.com";

/* --------------------------------------------------------------- Variant D3 */

/**
 * The picked combination: A's centred hero verbatim, B's two equal-weight
 * panels verbatim, closed by the pre-#569 "Why Rustume?" band. Vertical rhythm
 * is budgeted so the whole page lands on one screen at >=900px viewport height;
 * below that the Why band is the part that falls below the fold, by design.
 */
function VariantD3() {
  const { signIn } = authStore;

  return (
    <div class="min-h-screen bg-paper">
      <div class="relative overflow-hidden">
        <div
          class="pointer-events-none absolute inset-x-0 -top-32 h-96 bg-linear-to-b from-accent/12 to-transparent blur-3xl"
          aria-hidden="true"
        />

        <header class="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <a href={MARKETING_URL} class="font-display text-lg font-semibold text-ink">
            Rustume
          </a>
          <a href={`${MARKETING_URL}/docs`} class="text-sm text-stone hover:text-ink">
            Docs
          </a>
        </header>

        {/* A's hero */}
        <section class="relative z-10 mx-auto max-w-3xl px-6 pb-9 pt-4 text-center">
          <p class="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-stone">
            <span class="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
            Rustume Cloud
          </p>

          <h1 class="font-display text-5xl font-bold leading-[1.05] text-ink">
            Your resumes,
            <br />
            typeset properly.
          </h1>

          <p class="mx-auto mt-5 max-w-xl text-base leading-relaxed text-stone">
            Sign in to open, edit, and sync your library across devices. Everything renders through
            the same Typst engine as the desktop build.
          </p>
        </section>
      </div>

      {/* B's panels */}
      <div class="mx-auto grid max-w-5xl gap-6 px-6 pb-10 md:grid-cols-2">
        <section class="rounded-2xl border border-accent/30 bg-paper p-6 shadow-soft">
          <p class="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
            This deployment
          </p>
          <h2 class="mt-2 font-display text-2xl font-semibold text-ink">Rustume Cloud</h2>
          <p class="mt-2.5 text-sm leading-relaxed text-stone">
            An account keeps your library synced across every device you sign in from, and renders
            PDFs server-side so nothing depends on this browser.
          </p>

          <ul class="mt-4 space-y-2">
            <For each={["Sync across devices", "Server-side PDF rendering", "Version history"]}>
              {(item) => (
                <li class="flex items-start gap-2.5 text-sm text-ink">
                  <span class="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                  {item}
                </li>
              )}
            </For>
          </ul>

          <Button
            class="mt-6 w-full"
            size="lg"
            onClick={() => signIn()}
            data-testid="proto-d3-signin"
          >
            Sign in or create an account
          </Button>
        </section>

        <section class="rounded-2xl border border-border bg-paper/60 p-6">
          <p class="font-mono text-[11px] uppercase tracking-[0.18em] text-stone">
            Prefer to stay off the cloud?
          </p>
          <h2 class="mt-2 font-display text-2xl font-semibold text-ink">Run it yourself</h2>
          <p class="mt-2.5 text-sm leading-relaxed text-stone">
            Rustume is local-first and AGPL. The desktop build and self-hosted server keep
            everything on hardware you control — no account anywhere.
          </p>

          <div class="mt-4 space-y-2">
            <a
              href={`${MARKETING_URL}/docs/getting-started`}
              class="flex items-center justify-between rounded-lg border border-border bg-paper px-4 py-3 text-sm text-ink hover:border-ink/20"
            >
              Install the desktop build <span aria-hidden="true">→</span>
            </a>
            <a
              href={`${MARKETING_URL}/docs/deployment`}
              class="flex items-center justify-between rounded-lg border border-border bg-paper px-4 py-3 text-sm text-ink hover:border-ink/20"
            >
              Self-host the server <span aria-hidden="true">→</span>
            </a>
          </div>

          <p class="mt-4 text-xs leading-relaxed text-stone">
            Same editor, same templates, same Typst output. The only difference is where the files
            live.
          </p>
        </section>
      </div>

      {/* Why Rustume — pre-#569 format, padding budgeted to stay on screen */}
      <div class="bg-surface border-t border-border py-9 px-4">
        <div class="max-w-4xl mx-auto">
          <h2 class="font-display text-xl font-semibold text-ink text-center mb-7">Why Rustume?</h2>

          <div class="grid md:grid-cols-3 gap-6">
            <WhyCard
              title="Privacy First"
              body="Local-first by design. Your resumes sync only to the account you choose, and never anywhere else."
              path="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
            <WhyCard
              title="Works Offline"
              body="Edit anywhere. Install as a PWA for the best experience."
              path="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3"
            />
            <WhyCard
              title="Lightning Fast"
              body="Built with Rust and WebAssembly for native performance."
              path="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </div>
        </div>
      </div>

      <SignInDialog />
    </div>
  );
}

/* --------------------------------------------------------------- Variant D2 */

/**
 * D, with the dead space taken out. The centred hero and the fork are collapsed
 * into one two-column band so the sign-in CTA sits above the fold, and the
 * "run it yourself" path drops from a boxed panel to an inline pair of links.
 * "Why Rustume?" keeps its format but loses roughly a third of its padding.
 */
function VariantD2() {
  const { signIn } = authStore;

  return (
    <div class="min-h-screen bg-paper">
      <div class="relative overflow-hidden">
        <div
          class="pointer-events-none absolute inset-x-0 -top-32 h-80 bg-linear-to-b from-accent/12 to-transparent blur-3xl"
          aria-hidden="true"
        />

        <header class="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <a href={MARKETING_URL} class="font-display text-lg font-semibold text-ink">
            Rustume
          </a>
          <a href={`${MARKETING_URL}/docs`} class="text-sm text-stone hover:text-ink">
            Docs
          </a>
        </header>

        <div class="relative z-10 mx-auto grid max-w-5xl items-center gap-10 px-6 pb-12 pt-6 md:grid-cols-[1.1fr_1fr]">
          <section>
            <p class="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-stone">
              <span class="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
              Rustume Cloud
            </p>

            <h1 class="font-display text-4xl font-bold leading-[1.08] text-ink md:text-5xl">
              Your resumes,
              <br />
              typeset properly.
            </h1>

            <p class="mt-4 max-w-md text-base leading-relaxed text-stone">
              Sign in to open, edit, and sync your library across devices — or run the whole thing
              yourself. Same editor, same Typst output either way.
            </p>

            <div class="mt-6 border-t border-border pt-5">
              <p class="font-mono text-[11px] uppercase tracking-[0.18em] text-stone">
                Prefer to stay off the cloud?
              </p>
              <p class="mt-2 text-sm leading-relaxed text-stone">
                Rustume is local-first and AGPL —{" "}
                <a
                  href={`${MARKETING_URL}/docs/getting-started`}
                  class="text-accent hover:underline"
                >
                  install the desktop build
                </a>{" "}
                or{" "}
                <a href={`${MARKETING_URL}/docs/deployment`} class="text-accent hover:underline">
                  self-host the server
                </a>
                . No account anywhere.
              </p>
            </div>
          </section>

          <section class="rounded-2xl border border-accent/30 bg-paper p-6 shadow-soft">
            <p class="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
              This deployment
            </p>
            <h2 class="mt-2 font-display text-2xl font-semibold text-ink">Rustume Cloud</h2>

            <ul class="mt-4 space-y-2">
              <For each={["Sync across devices", "Server-side PDF rendering", "Version history"]}>
                {(item) => (
                  <li class="flex items-start gap-2.5 text-sm text-ink">
                    <span class="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                    {item}
                  </li>
                )}
              </For>
            </ul>

            <Button
              class="mt-6 w-full"
              size="lg"
              onClick={() => signIn()}
              data-testid="proto-d2-signin"
            >
              Sign in or create an account
            </Button>
            <p class="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-stone/70">
              free while in beta · no card required
            </p>
          </section>
        </div>
      </div>

      <div class="bg-surface border-t border-border py-10 px-4">
        <div class="max-w-4xl mx-auto">
          <h2 class="font-display text-xl font-semibold text-ink text-center mb-8">Why Rustume?</h2>

          <div class="grid md:grid-cols-3 gap-6">
            <WhyCard
              title="Privacy First"
              body="Local-first by design. Your resumes sync only to the account you choose, and never anywhere else."
              path="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
            <WhyCard
              title="Works Offline"
              body="Edit anywhere. Install as a PWA for the best experience."
              path="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3"
            />
            <WhyCard
              title="Lightning Fast"
              body="Built with Rust and WebAssembly for native performance."
              path="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </div>
        </div>
      </div>

      <SignInDialog />
    </div>
  );
}

/* ---------------------------------------------------------------- Variant D */

/** Icon tile + copy, in the pre-#569 "Why Rustume?" format. */
function WhyCard(props: { title: string; body: string; path: string }) {
  return (
    <div class="text-center">
      <div class="w-14 h-14 mx-auto bg-accent/10 rounded-2xl flex items-center justify-center mb-4">
        <svg
          class="w-7 h-7 text-accent"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={props.path} />
        </svg>
      </div>
      <h3 class="font-display font-semibold text-ink mb-2">{props.title}</h3>
      <p class="text-sm text-stone">{props.body}</p>
    </div>
  );
}

/**
 * A's hero (no error framing) + B's cloud/on-device fork, closed by the
 * pre-#569 "Why Rustume?" band lifted from HomeLayouts.tsx at 10acc62^.
 */
function VariantD() {
  const { signIn } = authStore;

  return (
    <div class="min-h-screen bg-paper">
      <div class="relative overflow-hidden">
        <div
          class="pointer-events-none absolute inset-x-0 -top-40 h-[32rem] bg-linear-to-b from-accent/12 to-transparent blur-3xl"
          aria-hidden="true"
        />

        <header class="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <a href={MARKETING_URL} class="font-display text-lg font-semibold text-ink">
            Rustume
          </a>
          <a href={`${MARKETING_URL}/docs`} class="text-sm text-stone hover:text-ink">
            Docs
          </a>
        </header>

        <section class="relative z-10 mx-auto max-w-3xl px-6 pb-14 pt-8 text-center">
          <p class="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-stone">
            <span class="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
            Rustume Cloud
          </p>

          <h1 class="font-display text-5xl font-bold leading-[1.05] text-ink md:text-6xl">
            Your resumes,
            <br />
            typeset properly.
          </h1>

          <p class="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-stone">
            Sign in to open, edit, and sync your library across devices — or run the whole thing
            yourself. Same editor, same Typst output either way.
          </p>
        </section>
      </div>

      {/* B's fork, tightened so it reads as a choice rather than two landing pages */}
      <div class="mx-auto grid max-w-4xl gap-5 px-6 pb-16 md:grid-cols-2">
        <section class="rounded-2xl border border-accent/30 bg-paper p-7 shadow-soft">
          <p class="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
            This deployment
          </p>
          <h2 class="mt-2.5 font-display text-2xl font-semibold text-ink">Rustume Cloud</h2>
          <p class="mt-2.5 text-sm leading-relaxed text-stone">
            An account syncs your library across every device you sign in from, and renders PDFs
            server-side.
          </p>

          <ul class="mt-5 space-y-2">
            <For each={["Sync across devices", "Server-side PDF rendering", "Version history"]}>
              {(item) => (
                <li class="flex items-start gap-2.5 text-sm text-ink">
                  <span class="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                  {item}
                </li>
              )}
            </For>
          </ul>

          <Button
            class="mt-7 w-full"
            size="lg"
            onClick={() => signIn()}
            data-testid="proto-d-signin"
          >
            Sign in or create an account
          </Button>
          <p class="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-stone/70">
            free while in beta · no card required
          </p>
        </section>

        <section class="rounded-2xl border border-border bg-surface/40 p-7">
          <p class="font-mono text-[11px] uppercase tracking-[0.18em] text-stone">
            Prefer to stay off the cloud?
          </p>
          <h2 class="mt-2.5 font-display text-2xl font-semibold text-ink">Run it yourself</h2>
          <p class="mt-2.5 text-sm leading-relaxed text-stone">
            Rustume is local-first and AGPL. Keep everything on hardware you control — no account
            anywhere.
          </p>

          <div class="mt-5 space-y-2">
            <a
              href={`${MARKETING_URL}/docs/getting-started`}
              class="flex items-center justify-between rounded-lg border border-border bg-paper px-4 py-3 text-sm text-ink hover:border-ink/20"
            >
              Install the desktop build <span aria-hidden="true">→</span>
            </a>
            <a
              href={`${MARKETING_URL}/docs/deployment`}
              class="flex items-center justify-between rounded-lg border border-border bg-paper px-4 py-3 text-sm text-ink hover:border-ink/20"
            >
              Self-host the server <span aria-hidden="true">→</span>
            </a>
          </div>
        </section>
      </div>

      {/* Pre-#569 "Why Rustume?" band, format preserved verbatim.
          COPY ADAPTED — see the note in the handover: the original
          "No accounts, no tracking" is false on a deployment whose whole
          purpose is signing in. */}
      <div class="bg-surface border-t border-border py-16 px-4">
        <div class="max-w-4xl mx-auto">
          <h2 class="font-display text-2xl font-semibold text-ink text-center mb-12">
            Why Rustume?
          </h2>

          <div class="grid md:grid-cols-3 gap-8">
            <WhyCard
              title="Privacy First"
              body="Local-first by design. Your resumes sync only to the account you choose, and never anywhere else."
              path="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
            <WhyCard
              title="Works Offline"
              body="Edit anywhere. Install as a PWA for the best experience."
              path="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3"
            />
            <WhyCard
              title="Lightning Fast"
              body="Built with Rust and WebAssembly for native performance."
              path="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </div>
        </div>
      </div>

      <SignInDialog />
    </div>
  );
}

/* ---------------------------------------------------------------- Variant A */

/**
 * Treats the entry as a continuation of rustume.com rather than an error.
 * No status code, no lock icon — restates the value proposition and converts.
 */
function VariantA() {
  const { signIn } = authStore;

  return (
    <div class="relative min-h-screen overflow-hidden bg-paper">
      <div
        class="pointer-events-none absolute inset-x-0 -top-40 h-[36rem] bg-linear-to-b from-accent/12 to-transparent blur-3xl"
        aria-hidden="true"
      />

      <header class="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <a href={MARKETING_URL} class="font-display text-lg font-semibold text-ink">
          Rustume
        </a>
        <a href={`${MARKETING_URL}/docs`} class="text-sm text-stone hover:text-ink">
          Docs
        </a>
      </header>

      <main class="relative z-10 mx-auto max-w-3xl px-6 pb-24 pt-10 text-center">
        <p class="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-stone">
          <span class="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
          Rustume Cloud
        </p>

        <h1 class="font-display text-5xl font-bold leading-[1.05] text-ink md:text-6xl">
          Your resumes,
          <br />
          typeset properly.
        </h1>

        <p class="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-stone">
          Sign in to open, edit, and sync your library across devices. Everything renders through
          the same Typst engine as the desktop build.
        </p>

        <div class="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" onClick={() => signIn()} data-testid="proto-a-signin">
            Sign in to Rustume Cloud
          </Button>
          <a
            href={`${MARKETING_URL}/docs/getting-started`}
            class="inline-flex h-11 items-center rounded-lg border border-border px-5 text-sm font-medium text-ink hover:bg-surface"
          >
            Run it yourself instead
          </a>
        </div>

        <p class="mt-5 font-mono text-[11px] uppercase tracking-[0.14em] text-stone/70">
          free while in beta · no card required
        </p>

        <div class="mx-auto mt-16 grid max-w-2xl gap-px overflow-hidden rounded-xl border border-border bg-border text-left sm:grid-cols-3">
          <For
            each={[
              ["Local-first", "Your data lives on your device unless you turn on sync."],
              ["Real typesetting", "Typst templates, not a word processor pretending."],
              ["Open source", "AGPL. Self-host the whole thing if you prefer."],
            ]}
          >
            {([title, body]) => (
              <div class="bg-paper p-5">
                <h2 class="font-display text-sm font-semibold text-ink">{title}</h2>
                <p class="mt-1.5 text-xs leading-relaxed text-stone">{body}</p>
              </div>
            )}
          </For>
        </div>
      </main>

      <SignInDialog />
    </div>
  );
}

/* ---------------------------------------------------------------- Variant B */

/**
 * Makes the cloud-vs-on-device fork the primary information hierarchy, instead
 * of hiding it behind a single CTA. Honest that this deployment requires auth
 * while the project itself is local-first.
 */
function VariantB() {
  const { signIn } = authStore;

  return (
    <div class="min-h-screen bg-surface/40">
      <div class="mx-auto grid min-h-screen max-w-5xl items-center gap-8 px-6 py-16 md:grid-cols-2">
        <section class="rounded-2xl border border-accent/30 bg-paper p-8 shadow-soft">
          <p class="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
            This deployment
          </p>
          <h1 class="mt-3 font-display text-3xl font-semibold text-ink">Rustume Cloud</h1>
          <p class="mt-3 text-sm leading-relaxed text-stone">
            An account keeps your library synced across every device you sign in from, and renders
            PDFs server-side so nothing depends on this browser.
          </p>

          <ul class="mt-6 space-y-2.5">
            <For each={["Sync across devices", "Server-side PDF rendering", "Version history"]}>
              {(item) => (
                <li class="flex items-start gap-2.5 text-sm text-ink">
                  <span class="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                  {item}
                </li>
              )}
            </For>
          </ul>

          <Button
            class="mt-8 w-full"
            size="lg"
            onClick={() => signIn()}
            data-testid="proto-b-signin"
          >
            Sign in or create an account
          </Button>
        </section>

        <section class="rounded-2xl border border-border bg-paper/60 p-8">
          <p class="font-mono text-[11px] uppercase tracking-[0.18em] text-stone">
            Prefer to stay off the cloud?
          </p>
          <h2 class="mt-3 font-display text-3xl font-semibold text-ink">Run it yourself</h2>
          <p class="mt-3 text-sm leading-relaxed text-stone">
            Rustume is local-first and AGPL. The desktop build and self-hosted server keep
            everything on hardware you control — no account anywhere.
          </p>

          <div class="mt-6 space-y-2">
            <a
              href={`${MARKETING_URL}/docs/getting-started`}
              class="flex items-center justify-between rounded-lg border border-border bg-paper px-4 py-3 text-sm text-ink hover:border-ink/20"
            >
              Install the desktop build <span aria-hidden="true">→</span>
            </a>
            <a
              href={`${MARKETING_URL}/docs/deployment`}
              class="flex items-center justify-between rounded-lg border border-border bg-paper px-4 py-3 text-sm text-ink hover:border-ink/20"
            >
              Self-host the server <span aria-hidden="true">→</span>
            </a>
          </div>

          <p class="mt-6 text-xs leading-relaxed text-stone">
            Same editor, same templates, same Typst output. The only difference is where the files
            live.
          </p>
        </section>
      </div>

      <SignInDialog />
    </div>
  );
}

/* ---------------------------------------------------------------- Variant C */

/**
 * Shows what you are signing into: a dimmed, inert mock of the Home command
 * centre behind a compact sign-in card. Continuity rather than a gate.
 */
function VariantC() {
  const { signIn } = authStore;

  return (
    <div class="relative min-h-screen overflow-hidden bg-paper">
      {/* Inert backdrop — deliberately not the real Home component, so the
          prototype cannot accidentally depend on live data. */}
      <div class="pointer-events-none absolute inset-0 select-none blur-[2px]" aria-hidden="true">
        <div class="mx-auto max-w-6xl px-4 pt-4 opacity-40">
          <div class="flex items-center gap-3 border-y border-border py-2 font-mono text-[10px] uppercase tracking-[0.09em] text-stone">
            <span>
              <strong class="text-ink">6</strong> resumes
            </span>
            <span class="h-2.5 w-px bg-border" />
            <span>last edit 2 hours ago</span>
            <span class="h-2.5 w-px bg-border" />
            <span>cloud storage</span>
            <span class="ml-auto">view: grid · scope: all</span>
          </div>

          <div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <For each={[0, 1, 2, 3, 4, 5, 6, 7]}>
              {(i) => (
                <div class="rounded-xl border border-border bg-surface/60 p-3">
                  <div class="mb-3 aspect-[1/1.294] rounded-md border border-border bg-sheet p-3">
                    <div class="mb-2 h-2 w-1/2 rounded-sm bg-sheet-ink/25" />
                    <div class="mb-3 h-1 w-1/3 rounded-sm bg-sheet-ink/15" />
                    <For each={[92, 78, 85, 61, 88, 70]}>
                      {(w) => (
                        <div
                          class="mb-1.5 h-1 rounded-sm bg-sheet-ink/12"
                          style={{ width: `${w - i * 2}%` }}
                        />
                      )}
                    </For>
                  </div>
                  <div class="h-2 w-2/3 rounded-sm bg-ink/15" />
                </div>
              )}
            </For>
          </div>
        </div>
      </div>

      <div class="absolute inset-0 bg-paper/70 backdrop-blur-[1px]" aria-hidden="true" />

      <main class="relative z-10 flex min-h-screen items-center justify-center px-4">
        <section class="w-full max-w-md rounded-2xl border border-border bg-paper p-8 text-center shadow-soft">
          <p class="font-mono text-[11px] uppercase tracking-[0.18em] text-stone">Rustume Cloud</p>
          <h1 class="mt-3 font-display text-3xl font-semibold text-ink">Sign in to your library</h1>
          <p class="mt-3 text-sm leading-relaxed text-stone">
            Your resumes are waiting. Sign in to open, edit, and export them from any device.
          </p>

          <Button
            class="mt-7 w-full"
            size="lg"
            onClick={() => signIn()}
            data-testid="proto-c-signin"
          >
            Continue
          </Button>

          <div class="mt-6 flex items-center gap-3" aria-hidden="true">
            <span class="h-px flex-1 bg-border" />
            <span class="font-mono text-[10px] uppercase tracking-[0.14em] text-stone/70">or</span>
            <span class="h-px flex-1 bg-border" />
          </div>

          <a
            href={`${MARKETING_URL}/docs/getting-started`}
            class="mt-6 inline-block text-sm text-accent hover:underline"
          >
            Use Rustume without an account
          </a>

          <p class="mt-8 text-xs text-stone/70">
            <A href="/account" class="hover:text-ink">
              Learn about cloud accounts
            </A>
          </p>
        </section>
      </main>

      <SignInDialog />
    </div>
  );
}

/* ------------------------------------------------------------- The switcher */

/** Floating dev-only bar. Never rendered in a production build. */
function PrototypeSwitcher(props: { current: PrototypeVariant }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const go = (delta: number) => {
    const i = PROTOTYPE_VARIANTS.indexOf(props.current);
    const next =
      PROTOTYPE_VARIANTS[(i + delta + PROTOTYPE_VARIANTS.length) % PROTOTYPE_VARIANTS.length];
    const params = new URLSearchParams(searchParams as Record<string, string>);
    params.set("variant", next);
    navigate(`?${params.toString()}`, { replace: true, scroll: false });
  };

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable);
      if (typing) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  return (
    <div class="fixed bottom-5 left-1/2 z-[9999] flex -translate-x-1/2 items-center gap-1 rounded-full border-2 border-fuchsia-500 bg-black/90 px-2 py-1.5 text-white shadow-2xl">
      <button
        type="button"
        onClick={() => go(-1)}
        class="h-7 w-7 rounded-full text-lg leading-none hover:bg-white/15"
        aria-label="Previous variant"
      >
        ←
      </button>
      <span class="px-2 font-mono text-xs whitespace-nowrap">
        PROTOTYPE {props.current} — {VARIANT_NAMES[props.current]}
      </span>
      <button
        type="button"
        onClick={() => go(1)}
        class="h-7 w-7 rounded-full text-lg leading-none hover:bg-white/15"
        aria-label="Next variant"
      >
        →
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------- Export */

export function isPrototypeVariant(value: unknown): value is PrototypeVariant {
  return typeof value === "string" && (PROTOTYPE_VARIANTS as readonly string[]).includes(value);
}

/** Renders the requested variant plus the floating switcher. */
export function UnauthorizedPrototype(props: { variant: PrototypeVariant }) {
  return (
    <>
      <Show when={props.variant === "D3"}>
        <VariantD3 />
      </Show>
      <Show when={props.variant === "D2"}>
        <VariantD2 />
      </Show>
      <Show when={props.variant === "D"}>
        <VariantD />
      </Show>
      <Show when={props.variant === "A"}>
        <VariantA />
      </Show>
      <Show when={props.variant === "B"}>
        <VariantB />
      </Show>
      <Show when={props.variant === "C"}>
        <VariantC />
      </Show>
      <PrototypeSwitcher current={props.variant} />
    </>
  );
}
