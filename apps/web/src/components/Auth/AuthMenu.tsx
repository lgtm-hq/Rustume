import { Show } from "solid-js";
import { Button, Spinner } from "../ui";
import { authStore } from "../../stores/auth";

export function AuthMenu() {
  const { state, signIn, signOut } = authStore;

  return (
    <Show when={!state.loading} fallback={<Spinner class="w-4 h-4 text-stone" />}>
      <Show when={state.cloudEnabled} fallback={null}>
        <Show
          when={state.user}
          fallback={
            <Button variant="secondary" size="sm" onClick={signIn}>
              Sign in
            </Button>
          }
        >
          {(user) => (
            <div class="flex items-center gap-3">
              <span class="hidden sm:inline text-xs font-mono text-stone truncate max-w-[12rem]">
                {user().name ?? user().email}
              </span>
              <Button variant="ghost" size="sm" onClick={() => void signOut()}>
                Sign out
              </Button>
            </div>
          )}
        </Show>
      </Show>
    </Show>
  );
}
