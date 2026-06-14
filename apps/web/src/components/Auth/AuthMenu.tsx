import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { useNavigate } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import { authStore } from "../../stores/auth";
import { Button, Spinner } from "../ui";

export function AuthMenu() {
  const navigate = useNavigate();
  const { state, signIn, signOut, displayName } = authStore;
  const [signingIn, setSigningIn] = createSignal(false);

  const handleSignIn = () => {
    setSigningIn(true);
    signIn();
  };

  return (
    <Show
      when={!state.loading}
      fallback={<Spinner class="w-4 h-4 text-stone" ariaLabel="Loading authentication" />}
    >
      <Show when={state.cloudEnabled} fallback={null}>
        <Show
          when={state.user}
          fallback={
            <Button variant="secondary" size="sm" onClick={handleSignIn} loading={signingIn()}>
              Sign in to Cloud
            </Button>
          }
        >
          {(user) => (
            <DropdownMenu>
              <DropdownMenu.Trigger
                class="flex items-center gap-2 max-w-[12rem] px-2.5 py-1.5 rounded-lg
                  hover:bg-surface transition-colors text-sm text-ink focus-visible:outline-none
                  focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                aria-label="Account menu"
              >
                <div
                  class="w-7 h-7 rounded-full bg-accent/10 text-accent flex items-center
                    justify-center flex-shrink-0 font-mono text-xs font-semibold uppercase"
                  aria-hidden="true"
                >
                  {(displayName(user()) || "A").slice(0, 1)}
                </div>
                <span class="hidden sm:block truncate text-left font-medium">
                  {displayName(user())}
                </span>
                <svg
                  class="w-4 h-4 text-stone flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content class="z-50 min-w-[220px] rounded-lg border border-border bg-paper shadow-soft p-1">
                  <div class="px-3 py-2 border-b border-border mb-1">
                    <p class="text-sm font-medium text-ink truncate">{displayName(user())}</p>
                    <Show when={user().email}>
                      {(email) => <p class="text-xs text-stone truncate mt-0.5">{email()}</p>}
                    </Show>
                  </div>
                  <DropdownMenu.Item
                    class="px-3 py-2 text-sm rounded-md cursor-pointer outline-none
                      hover:bg-surface focus:bg-surface data-[highlighted]:bg-surface"
                    onSelect={() => navigate("/account")}
                  >
                    Account
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    class="px-3 py-2 text-sm rounded-md cursor-pointer outline-none text-red-600
                      hover:bg-red-50 focus:bg-red-50 data-[highlighted]:bg-red-50"
                    onSelect={() => void signOut()}
                  >
                    Sign out
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu>
          )}
        </Show>
      </Show>
    </Show>
  );
}
