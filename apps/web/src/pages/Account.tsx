import { Show, createSignal } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { authStore } from "../stores/auth";
import { Button, Spinner, toast } from "../components/ui";

function ProfileAvatar(props: { label: string }) {
  return (
    <div
      class="w-16 h-16 rounded-2xl bg-accent/10 text-accent flex items-center justify-center
        font-display text-2xl font-semibold uppercase"
      aria-hidden="true"
    >
      {props.label.slice(0, 1)}
    </div>
  );
}

function ComingSoonRow(props: { title: string; description: string }) {
  return (
    <div class="flex items-start justify-between gap-4 py-4 border-b border-border last:border-b-0">
      <div>
        <h3 class="font-medium text-ink">{props.title}</h3>
        <p class="text-sm text-stone mt-1">{props.description}</p>
      </div>
      <span
        class="inline-flex items-center rounded-full bg-surface px-2.5 py-1 text-xs font-mono
          text-stone border border-border flex-shrink-0"
      >
        Coming soon
      </span>
    </div>
  );
}

export default function Account() {
  const { state, signIn, signOut, displayName } = authStore;
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = createSignal(false);
  const [signingIn, setSigningIn] = createSignal(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      toast.success("Signed out");
      navigate("/");
    } catch (error) {
      console.error("Sign out failed:", error);
      toast.error("Failed to sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  };

  const handleSignIn = () => {
    setSigningIn(true);
    try {
      signIn();
    } catch {
      setSigningIn(false);
    }
  };

  return (
    <div class="min-h-[calc(100vh-3.5rem)] bg-paper">
      <div class="max-w-2xl mx-auto px-4 py-12">
        <Show
          when={!state.loading}
          fallback={
            <div class="flex justify-center py-16">
              <Spinner class="w-6 h-6 text-accent" ariaLabel="Loading account information" />
            </div>
          }
        >
          <Show
            when={state.cloudEnabled}
            fallback={
              <div class="text-center py-16">
                <h1 class="font-display text-2xl font-semibold text-ink mb-3">Account</h1>
                <p class="text-stone">
                  Cloud accounts are only available on Rustume Cloud deployments.
                </p>
              </div>
            }
          >
            <Show
              when={state.user}
              fallback={
                <div class="text-center py-16 border border-border rounded-2xl bg-surface/40 px-6">
                  <h1 class="font-display text-2xl font-semibold text-ink mb-3">
                    Sign in to Rustume Cloud
                  </h1>
                  <p class="text-stone text-sm max-w-md mx-auto mb-6">
                    Sync resumes across devices with your Rustume Cloud account. Your local copies
                    stay on this device until you choose to import them.
                  </p>
                  <Button onClick={handleSignIn} loading={signingIn()}>
                    Sign in to Cloud
                  </Button>
                  <p class="mt-4 text-xs text-stone">
                    Prefer local-only?{" "}
                    <A href="/" class="text-accent hover:underline">
                      Continue without signing in
                    </A>
                  </p>
                </div>
              }
            >
              {(user) => (
                <div class="space-y-8">
                  <div>
                    <h1 class="font-display text-3xl font-semibold text-ink mb-2">Account</h1>
                    <p class="text-stone text-sm">
                      Manage your Rustume Cloud profile and sync settings.
                    </p>
                  </div>

                  <section class="rounded-2xl border border-border bg-paper p-6 shadow-card">
                    <div class="flex items-center gap-4">
                      <ProfileAvatar label={displayName(user())} />
                      <div class="min-w-0">
                        <h2 class="font-display text-xl font-semibold text-ink truncate">
                          {displayName(user())}
                        </h2>
                        <Show when={user().email}>
                          {(email) => <p class="text-sm text-stone truncate mt-1">{email()}</p>}
                        </Show>
                        <p class="text-xs font-mono text-stone mt-2 uppercase tracking-wide">
                          Plan: {user().plan}
                        </p>
                      </div>
                    </div>
                  </section>

                  <section class="rounded-2xl border border-border bg-paper p-6 shadow-card">
                    <h2 class="font-display text-lg font-semibold text-ink mb-2">Cloud sync</h2>
                    <p class="text-sm text-stone">
                      Resumes saved to your Rustume Cloud account are available on any signed-in
                      device. Edits sync automatically while you're online.
                    </p>
                  </section>

                  <section class="rounded-2xl border border-border bg-paper p-6 shadow-card">
                    <h2 class="font-display text-lg font-semibold text-ink mb-2">
                      Privacy and data
                    </h2>
                    <p class="text-sm text-stone">
                      Rustume Cloud uses{" "}
                      <a
                        href="https://workos.com/docs/user-management/authkit"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-accent hover:underline"
                      >
                        WorkOS AuthKit
                      </a>{" "}
                      for authentication. Your email and name are stored by both WorkOS and Rustume
                      to identify your account.
                    </p>
                  </section>

                  <section class="rounded-2xl border border-border bg-paper px-6 py-2 shadow-card">
                    <ComingSoonRow
                      title="Billing"
                      description="Manage your subscription and payment details."
                    />
                    <ComingSoonRow
                      title="End-to-end encryption"
                      description="Optional client-side encryption for resume content."
                    />
                  </section>

                  <div class="flex justify-end">
                    <Button
                      variant="secondary"
                      onClick={() => void handleSignOut()}
                      loading={signingOut()}
                    >
                      Sign out
                    </Button>
                  </div>
                </div>
              )}
            </Show>
          </Show>
        </Show>
      </div>
    </div>
  );
}
