import { For, type JSX } from "solid-js";
import { Button } from "../components/ui";
import { usePageTitle } from "../hooks/usePageTitle";
import { authStore } from "../stores/auth";

/** Marketing site this deployment belongs to; the entry page reads as its continuation. */
const MARKETING_URL = "https://rustume.com";

interface CloudBenefit {
  label: string;
}

const CLOUD_BENEFITS: CloudBenefit[] = [
  { label: "Sync across devices" },
  { label: "Server-side PDF rendering" },
  { label: "Version history" },
];

interface SelfHostLink {
  label: string;
  href: string;
}

const SELF_HOST_LINKS: SelfHostLink[] = [
  { label: "Install the desktop build", href: `${MARKETING_URL}/docs/getting-started` },
  { label: "Self-host the server", href: `${MARKETING_URL}/docs/deployment` },
];

interface Reason {
  title: string;
  body: string;
  iconPath: string;
}

/**
 * Restored from the pre-#569 Home page footer.
 *
 * The original privacy copy ("No accounts, no tracking") was true of a
 * local-only Home page but false here, directly above a sign-in button on a
 * deployment that syncs to a server — so it states what is actually promised.
 */
const REASONS: Reason[] = [
  {
    title: "Privacy First",
    body: "Local-first by design. Your resumes sync only to the account you choose, and never anywhere else.",
    iconPath:
      "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
  },
  {
    title: "Works Offline",
    body: "Edit anywhere. Install as a PWA for the best experience.",
    iconPath:
      "M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3",
  },
  {
    title: "Lightning Fast",
    body: "Built with Rust and WebAssembly for native performance.",
    iconPath: "M13 10V3L4 14h7v7l9-11h-7z",
  },
];

function ReasonCard(props: Reason) {
  return (
    <div class="text-center">
      <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
        <svg
          class="h-7 w-7 text-accent"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d={props.iconPath}
          />
        </svg>
      </div>
      <h3 class="mb-2 font-display font-semibold text-ink">{props.title}</h3>
      <p class="text-sm text-stone">{props.body}</p>
    </div>
  );
}

function EyebrowDot() {
  return <span class="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" aria-hidden="true" />;
}

function Panel(props: { accent?: boolean; children: JSX.Element }) {
  return (
    <section
      class="rounded-2xl border p-6"
      classList={{
        "border-accent/30 bg-paper shadow-soft": props.accent,
        "border-border bg-paper/60": !props.accent,
      }}
    >
      {props.children}
    </section>
  );
}

/**
 * Signed-out entry point for hosted Rustume Cloud.
 *
 * Deliberately a landing page rather than an error page: someone arriving from
 * rustume.com has not done anything wrong, so there is no status code and no
 * lock icon. `StatusPage` remains for genuine 404/500 errors.
 *
 * Never rendered in self-hosted mode — see {@link RequireAuthGuard}, which only
 * blocks when cloud is enabled.
 */
export default function CloudEntry() {
  usePageTitle("Rustume Cloud");
  const { signIn } = authStore;

  return (
    <div class="min-h-screen bg-paper" data-testid="cloud-entry-page">
      <div class="relative overflow-hidden">
        <div
          class="pointer-events-none absolute inset-x-0 -top-32 h-96 bg-linear-to-b from-accent/12 to-transparent blur-3xl"
          aria-hidden="true"
        />

        <header class="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <a href={MARKETING_URL} class="font-display text-lg font-semibold text-ink">
            Rustume
          </a>
          <a
            href={`${MARKETING_URL}/docs`}
            class="text-sm text-stone transition-colors hover:text-ink motion-reduce:transition-none"
          >
            Docs
          </a>
        </header>

        <section
          class="relative z-10 mx-auto max-w-3xl px-6 pb-9 pt-4 text-center"
          aria-labelledby="cloud-entry-title"
        >
          <p class="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-stone">
            <EyebrowDot />
            Rustume Cloud
          </p>

          <h1
            id="cloud-entry-title"
            class="font-display text-5xl font-bold leading-[1.05] text-ink"
          >
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

      {/* Equal weight is deliberate: with no anonymous path, self-hosting is the
          only alternative on offer, so it should not read as a footnote. */}
      <div class="mx-auto grid max-w-5xl gap-6 px-6 pb-10 md:grid-cols-2">
        <Panel accent>
          <p class="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
            This deployment
          </p>
          <h2 class="mt-2 font-display text-2xl font-semibold text-ink">Rustume Cloud</h2>
          <p class="mt-2.5 text-sm leading-relaxed text-stone">
            An account keeps your library synced across every device you sign in from, and renders
            PDFs server-side so nothing depends on this browser.
          </p>

          <ul class="mt-4 space-y-2">
            <For each={CLOUD_BENEFITS}>
              {(benefit) => (
                <li class="flex items-start gap-2.5 text-sm text-ink">
                  <span class="mt-1.5">
                    <EyebrowDot />
                  </span>
                  {benefit.label}
                </li>
              )}
            </For>
          </ul>

          <Button
            class="mt-6 w-full"
            size="lg"
            onClick={() => signIn()}
            data-testid="cloud-entry-signin"
          >
            Sign in or create an account
          </Button>
        </Panel>

        <Panel>
          <p class="font-mono text-[11px] uppercase tracking-[0.18em] text-stone">
            Prefer to stay off the cloud?
          </p>
          <h2 class="mt-2 font-display text-2xl font-semibold text-ink">Run it yourself</h2>
          <p class="mt-2.5 text-sm leading-relaxed text-stone">
            Rustume is local-first and AGPL. The desktop build and self-hosted server keep
            everything on hardware you control — no account anywhere.
          </p>

          <div class="mt-4 space-y-2">
            <For each={SELF_HOST_LINKS}>
              {(link) => (
                <a
                  href={link.href}
                  class="flex items-center justify-between rounded-lg border border-border bg-paper px-4 py-3 text-sm text-ink transition-colors hover:border-ink/20 motion-reduce:transition-none"
                >
                  {link.label}
                  <span aria-hidden="true">→</span>
                </a>
              )}
            </For>
          </div>

          <p class="mt-4 text-xs leading-relaxed text-stone">
            Same editor, same templates, same Typst output. The only difference is where the files
            live.
          </p>
        </Panel>
      </div>

      {/* Vertical rhythm is budgeted so the page lands on one screen at >=900px
          viewport height; below that this band is what falls below the fold. */}
      <div class="border-t border-border bg-surface px-4 py-9">
        <div class="mx-auto max-w-4xl">
          <h2 class="mb-7 text-center font-display text-xl font-semibold text-ink">Why Rustume?</h2>

          <div class="grid gap-6 md:grid-cols-3">
            <For each={REASONS}>{(reason) => <ReasonCard {...reason} />}</For>
          </div>
        </div>
      </div>
    </div>
  );
}
