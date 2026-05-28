import { Show } from "solid-js";
import { Button, Spinner } from "../ui";
import { authStore } from "../../stores/auth";

export function AuthMenu() {
  const { state, signIn, signOut } = authStore;

  return (
    <Show
      when={!state.loading}
      fallback={<Spinner class="w-4 h-4 text-stone" ariaLabel="Loading authentication" />}
    >
      <Show when={state.cloudEnabled} fallback={null}>
        <Show
          when={state.user}
          fallback={
            <Button variant="secondary" size="sm" onClick={signIn}>
              Sign in
            </Button>
          }
        >
          {(_user) => (
            <div class="flex items-center gap-3">
              <span class="hidden sm:inline text-xs font-mono text-stone">Signed in</span>
              <Button variant="ghost" size="sm" onClick={signOut}>
                Sign out
              </Button>
            </div>
          )}
        </Show>
      </Show>
    </Show>
  );
}
